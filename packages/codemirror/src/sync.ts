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
  HistoryConfig,
  PullResponse,
  PushResponse,
  StartResponse,
  TraceResponse,
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
    const start = document.positionAt(fromA);
    const end = document.positionAt(toA);
    const range = new vscode.Range(start, end);
    edit.replace(document.uri, range, inserted.toString());
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
  editor,
  sub,
  webview,
  extensions,
}: {
  log: vscode.LogOutputChannel;
  editor: vscode.TextEditor;
  sub: Subscriber;
  webview: vscode.Webview;
  extensions: ExtensionData<any>[];
}) => {
  const { document } = editor;

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

  new Connection<
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
            historyConfig: vscode.workspace
              .getConfiguration("codemirror")
              .get<HistoryConfig>("history")!,
            extensions,
            version: document.version,
            text: document.getText(),
            selection: {
              head: document.offsetAt(editor.selection.active),
              anchor: document.offsetAt(editor.selection.anchor),
            },
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
        case "trace": {
          // Already logged via `setOnMessage` above.
          const response: TraceResponse = {};
          return response;
        }
      }
    },
  });
};
