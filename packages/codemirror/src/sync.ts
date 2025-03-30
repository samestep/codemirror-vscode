import { rebaseUpdates, Update } from "@codemirror/collab";
import { ChangeSet, Text } from "@codemirror/state";
import { ExtensionData } from "codemirror-vscode";
import * as vscode from "vscode";
import {
  clientID,
  Connection,
  dataToUpdates,
  ExtensionRequests,
  ExtensionResponds,
  PullResponse,
  PushResponse,
  StartResponse,
  UpdateData,
  updatesToData,
  WebviewRequests,
  WebviewResponds,
} from "./protocol";
import { Subscriber } from "./util";

// https://github.com/codemirror/state/blob/6.5.2/src/change.ts#L3
const DefaultSplit = /\r\n?|\n/;

const codemirrorToVscode = (
  document: vscode.TextDocument,
  update: Update,
): vscode.WorkspaceEdit => {
  const edit = new vscode.WorkspaceEdit();
  update.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    // Two different representations: CodeMirror lists changes from left to
    // right, whereas VS Code applies edits in order. So, for each change, we
    // want to tell VS Code the range right before that change is applied.
    // Because we're going from left to right, the start of that range is just
    // the same as after all edits are applied. Then we can compute the end of
    // the range by adding the length of the text that was replaced.
    const start = document.positionAt(fromB);
    const end = document.positionAt(fromB + (toA - fromA));
    edit.replace(
      document.uri,
      new vscode.Range(start, end),
      inserted.toString(),
    );
  });
  return edit;
};

const vscodeToCodemirror = (
  text: Text,
  changes: readonly vscode.TextDocumentContentChangeEvent[],
): Update => ({
  changes: ChangeSet.of(
    changes.map(({ rangeOffset, rangeLength, text }) => {
      return { from: rangeOffset, to: rangeOffset + rangeLength, insert: text };
    }),
    text.length,
  ),
  clientID,
});

// https://github.com/codemirror/website/blob/b7247cacfcd389e359a038a41fff679185538ef8/site/examples/collab/worker.ts
export const sync = ({
  log,
  extensions,
  document,
  sub,
  webview,
}: {
  log: vscode.LogOutputChannel;
  extensions: ExtensionData<any>[];
  document: vscode.TextDocument;
  sub: Subscriber;
  webview: vscode.Webview;
}) => {
  const updates: Update[] = new Array(document.version);
  let doc = Text.of(document.getText().split(DefaultSplit));
  const pending: ((updates: UpdateData[]) => void)[] = [];

  sub.scribe(vscode.workspace.onDidChangeTextDocument, (event) => {
    if (event.document !== document) return;
    const { version } = event.document;
    if (version === updates.length) return;
    const update = vscodeToCodemirror(doc, event.contentChanges);
    updates[version - 1] = update;
    doc = update.changes.apply(doc);
    // Notify pending requests
    const data = updatesToData([update]);
    while (pending.length > 0) pending.pop()!(data);
  });

  const connection = new Connection<
    ExtensionRequests,
    WebviewResponds,
    WebviewRequests,
    ExtensionResponds
  >({
    postMessage: async (message) => {
      log.trace("posting message:", message);
      const posted = await webview.postMessage(message);
      if (!posted) log.error("failed to post message:", message);
    },
    setOnMessage: (listener) =>
      sub.scribe(webview.onDidReceiveMessage, (message) => {
        log.trace("received message:", message);
        listener(message);
      }),
    respond: async (request) => {
      switch (request.kind) {
        case "start": {
          const response: StartResponse = {
            extensions,
            version: document.version,
            text: document.getText(),
          };
          return response;
        }
        case "pull": {
          const { version } = request;
          if (version < updates.length) {
            const response: PullResponse = { updates: updates.slice(version) };
            return response;
          } else {
            return new Promise((resolve) =>
              pending.push((updates) => {
                const response: PullResponse = { updates };
                resolve(response);
              }),
            );
          }
        }
        case "push": {
          // Convert the JSON representation to an actual ChangeSet
          // instance
          let received = dataToUpdates(request.updates);
          if (request.version !== updates.length)
            received = rebaseUpdates(received, updates.slice(request.version));
          let accepted = true;
          for (let update of received) {
            const edit = codemirrorToVscode(document, update);
            if (!(await vscode.workspace.applyEdit(edit))) {
              accepted = false;
              break;
            }
          }
          const response: PushResponse = { accepted };
          return response;
        }
      }
    },
  });
};
