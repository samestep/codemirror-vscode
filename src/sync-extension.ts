import * as vscode from "vscode";
import {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionToWebview,
  Id,
  Patch,
  PatchResponse,
  StartResponse,
  Version,
  VersionResponse,
  WebviewRequest,
  WebviewResponse,
  WebviewToExtension,
} from "./protocol";
import { Diff, Doc } from "./text";
import { Subscriber } from "./util";

interface PatchInfo {
  prior: Patch;
  diff: Diff;
}

const vscodeToDiff = (
  changes: readonly vscode.TextDocumentContentChangeEvent[],
): Diff =>
  new Diff(
    ...changes.map(({ rangeOffset, rangeLength, text }) => ({
      start: rangeOffset,
      end: rangeOffset + rangeLength,
      text,
    })),
  );

const diffToVscode = (
  document: vscode.TextDocument,
  diff: Diff,
): vscode.WorkspaceEdit => {
  const edit = new vscode.WorkspaceEdit();
  for (const change of diff.changes) {
    const start = document.positionAt(change.start);
    const end = document.positionAt(change.end);
    edit.replace(document.uri, new vscode.Range(start, end), change.text);
  }
  return edit;
};

export const sync = ({
  log,
  document,
  sub,
  webview,
}: {
  log: vscode.LogOutputChannel;
  document: vscode.TextDocument;
  sub: Subscriber;
  webview: vscode.Webview;
}) => {
  const post = async (message: ExtensionToWebview) => {
    log.trace("posting message:", message);
    const posted = await webview.postMessage(message);
    if (!posted) log.error("failed to post message:", message);
  };
  let nextId = 0;
  const pending = new Map<Id, ExtensionRequest>();
  const postRequest = (body: ExtensionRequest) => {
    const id = nextId++;
    pending.set(id, body);
    post({ kind: "request", id, body });
  };
  const postResponse = <T extends ExtensionResponse>(id: Id, body: T) => {
    post({ kind: "response", id, body });
  };

  let { version } = document;
  let doc = new Doc(document.getText());
  const patches = new Map<Patch, PatchInfo>();
  const versionPatches = new Map<Patch, Version>();
  let waiting: Patch | undefined = undefined;

  const propose = async (patch: Patch) => {
    log.trace("proposing patch:", patch);
    const stack: Diff[] = [];
    let v = versionPatches.get(patch);
    while (v === undefined) {
      const info = patches.get(patch);
      if (info === undefined) {
        log.error("patch info not found:", patch);
        waiting = undefined;
        return;
      }
      stack.push(info.diff);
      patch = info.prior;
      v = versionPatches.get(patch);
    }
    if (v !== version) {
      log.trace("skipping proposal due to old version:", v);
      waiting = undefined;
      return;
    }
    const diff = Diff.flatten(stack.reverse());
    log.trace("applying VS Code document change:", diff);
    const edit = diffToVscode(document, diff);
    const applied = await vscode.workspace.applyEdit(edit);
    if (!applied) log.warn("failed to apply VS Code document change:", diff);
    waiting = undefined;
  };

  // On new VS Code doc versions, update our `Doc` and notify the webview.
  sub.scribe(vscode.workspace.onDidChangeTextDocument, (event) => {
    if (event.document !== document) return;
    const previous = version;
    ({ version } = event.document);
    if (waiting !== undefined) propose(waiting);
    if (version === previous) return;
    const diff = vscodeToDiff(event.contentChanges);
    log.trace("VS Code document changed:", diff);
    doc = doc.edit(diff);
    postRequest({ kind: "version", previous, version, diff: diff.data() });
  });

  const onRequest = (
    request: WebviewRequest,
    respond: <T extends ExtensionResponse>(response: T) => void,
  ) => {
    switch (request.kind) {
      case "start": {
        // The webview sends this message when it first starts, or when VS Code
        // destroys and recreates it for going into the background and becoming
        // visible again. This means it has been reset to an empty state, so we
        // reset any memory of what its sent us before.
        patches.clear();
        versionPatches.clear();
        waiting = undefined;
        versionPatches.set(request.patch, version);
        respond<StartResponse>({ version, text: document.getText() });
        break;
      }
      case "patch": {
        const { prior, patch, diff } = request;
        patches.set(patch, { prior, diff: new Diff(...diff) });
        respond<PatchResponse>({});
        if (waiting === undefined) {
          waiting = patch;
          propose(patch);
        } else waiting = patch;
        break;
      }
    }
  };
  const onResponse = (request: ExtensionRequest, response: WebviewResponse) => {
    switch (request.kind) {
      case "version": {
        const { patch } = response as VersionResponse;
        versionPatches.set(patch, request.version);
        break;
      }
    }
  };
  webview.onDidReceiveMessage((message: WebviewToExtension) => {
    log.trace("received message:", message);
    switch (message.kind) {
      case "request": {
        const { id, body } = message;
        onRequest(body, (response) => postResponse(id, response));
        break;
      }
      case "response": {
        const { id, body } = message;
        const request = pending.get(id);
        if (request === undefined) {
          log.warn("received response for unknown request ID:", id);
          break;
        }
        pending.delete(id);
        onResponse(request, body);
        break;
      }
    }
  });
};
