import { ChangeSet, Extension } from "@codemirror/state";
import { EditorView } from "codemirror";
import { WebviewApi } from "vscode-webview";
import {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionToWebview,
  Id,
  Patch,
  StartResponse,
  Version,
  VersionResponse,
  WebviewRequest,
  WebviewResponse,
} from "./protocol";
import { Diff, Doc, Replace } from "./text";

const patchStart = 0;

interface PatchInfo {
  prior?: Patch;
  diff?: Diff;
}

const codemirrorToDiff = (changes: ChangeSet): Diff => {
  const replacements: Replace[] = [];
  changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    replacements.push({
      start: fromA,
      end: toA,
      text: inserted.toString(),
    });
  });
  return new Diff(...replacements);
};

export const sync = ({
  vscode,
  extensions,
  parent,
}: {
  vscode: WebviewApi<unknown>;
  extensions: Extension[];
  parent: Element;
}): EditorView => {
  let nextId = 0;
  const pending = new Map<Id, WebviewRequest>();
  const postRequest = (body: WebviewRequest) => {
    const id = nextId++;
    pending.set(id, body);
    vscode.postMessage({ kind: "request", id, body });
  };
  const postResponse = <T extends WebviewResponse>(id: Id, body: T) => {
    vscode.postMessage({ kind: "response", id, body });
  };

  let patch = -1;
  let doc = new Doc("");
  const versions = new Map<Version, Doc>();
  const patches: PatchInfo[] = [];
  const versionPatches = new Map<Patch, Version>();

  const listener = EditorView.updateListener.of((update) => {
    const diff = codemirrorToDiff(update.changes);
    const edited = doc.edit(diff);
    if (edited.equals(doc)) return;
    doc = edited;
    const prior = patch;
    patch = patches.length;
    patches.push({ prior, diff });
    postRequest({ kind: "patch", prior, patch, diff: diff.data() });
  });

  const view = new EditorView({
    extensions: [...extensions, listener],
    parent,
  });

  const onRequest = (
    request: ExtensionRequest,
    respond: <T extends WebviewResponse>(response: T) => void,
  ) => {
    switch (request.kind) {
      case "version": {
        const { previous, version, patch: versionPatch, diff } = request;
        doc = versions.get(previous)!.edit(new Diff(...diff));
        versions.set(version, doc);
        if (versionPatch !== undefined) {
          // In this case, the extension told us that this update corresponds to
          // a patch we've already sent in the past, so there are no conflicts
          // and thus we don't need to modify our editor state.
          versionPatches.set(versionPatch, version);
          respond<VersionResponse>({ patch: versionPatch });
        } else {
          patch = patches.length;
          patches.push({});
          versionPatches.set(patch, version);
          respond<VersionResponse>({ patch });
          view.dispatch({
            changes: {
              from: 0,
              to: view.state.doc.length,
              insert: doc.toString(),
            },
          });
        }
        break;
      }
    }
  };
  const onResponse = (request: WebviewRequest, response: ExtensionResponse) => {
    switch (request.kind) {
      case "start": {
        const { version, text } = response as StartResponse;
        patch = patchStart;
        doc = new Doc(text);
        versions.set(version, doc);
        patches.push({});
        versionPatches.set(patchStart, version);
        break;
      }
      case "patch": {
        break; // Our request was acknowledged; nothing to do.
      }
    }
  };
  window.addEventListener("message", (event) => {
    const message: ExtensionToWebview = event.data;
    switch (message.kind) {
      case "request": {
        const { id, body } = message;
        onRequest(body, (response) => postResponse(id, response));
        break;
      }
      case "response": {
        const { id, body } = message;
        const request = pending.get(id);
        if (request === undefined) break;
        pending.delete(id);
        onResponse(request, body);
        break;
      }
    }
  });

  postRequest({ kind: "start", patch: patchStart }); // Ask for initial version.

  return view;
};
