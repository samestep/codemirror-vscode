import * as vscode from "vscode";
import * as Y from "yjs";
import {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionToWebview,
  Id,
  originExtension,
  WebviewRequest,
  WebviewResponse,
  WebviewToExtension,
} from "./protocol";
import { Subscriber } from "./util";

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
  const postRequest = (body: ExtensionRequest) => {
    post({ kind: "request", id: nextId++, body });
  };
  const postResponse = (id: Id, body: ExtensionResponse) => {
    post({ kind: "response", id, body });
  };

  let ydoc = new Y.Doc();
  const register = () => {
    // When we change the Yjs document, send that update to the webview.
    ydoc.on("update", (update, origin) => {
      if (origin !== originExtension) return; // Don't send edits right back.
      postRequest({ kind: "update", update });
    });

    // When the webview changes the Yjs document, update the VS Code editor.
    ydoc.getText().observe(async (event, transaction) => {
      log.trace("Yjs document changed:", event);
      if (transaction.origin === originExtension) return; // Don't repeat edits.
      const edit = new vscode.WorkspaceEdit();
      // https://github.com/yjs/y-monaco/blob/v0.1.6/src/y-monaco.js#L137-L155
      let index = 0;
      for (const op of event.changes.delta) {
        if (op.retain !== undefined) {
          index += op.retain;
        } else if (op.insert !== undefined) {
          const { insert } = op;
          if (typeof insert !== "string") {
            log.error("Yjs insert not a string:", insert);
            continue;
          }
          edit.insert(document.uri, document.positionAt(index), insert);
          index += insert.length;
        } else if (op.delete !== undefined) {
          const start = document.positionAt(index);
          const end = document.positionAt(index + op.delete);
          edit.delete(document.uri, new vscode.Range(start, end));
        } else {
          log.error("unexpected Yjs delta:", op);
        }
      }
      const applied = await vscode.workspace.applyEdit(edit);
      if (!applied) log.error("failed to apply Yjs change to VS Code:", event);
    });
  };
  register();

  // When an edit happens on the VS Code side, update the Yjs document.
  sub.scribe(vscode.workspace.onDidChangeTextDocument, (event) => {
    if (event.document !== document) return;
    log.trace("VS Code document changed:", event);
    const ytext = ydoc.getText();
    // https://github.com/yjs/y-monaco/blob/v0.1.6/src/y-monaco.js#L175-L180
    ydoc.transact(() => {
      for (const change of [...event.contentChanges].sort(
        (change1, change2) => change2.rangeOffset - change1.rangeOffset,
      )) {
        ytext.delete(change.rangeOffset, change.rangeLength);
        ytext.insert(change.rangeOffset, change.text);
      }
    }, originExtension); // Note this is from our side, to not repeat it.
  });

  const onRequest = (request: WebviewRequest): ExtensionResponse => {
    switch (request.kind) {
      case "start": {
        // The webview sends this message when it first starts, or when VS Code
        // destroys and recreates it for going into the background and becoming
        // visible again. This means its Yjs document has been reset to an empty
        // state, so we need to do the same and then catch it up to speed via
        // update messages.
        ydoc = new Y.Doc();
        register();
        ydoc.transact(() => {
          ydoc.getText().insert(0, document.getText());
        }, originExtension); // Note this is from our side, to not repeat it.
        return { kind: "start" }; // Acknowledge the request.
      }
      case "update": {
        // When the webview sends us an update, apply it to the Yjs document.
        Y.applyUpdate(ydoc, request.update);
        return { kind: "update" }; // Acknowledge the update.
      }
    }
  };
  const onResponse = (response: WebviewResponse) => {
    switch (response.kind) {
      case "update": {
        break; // Our update request was acknowledged; nothing to do.
      }
    }
  };
  webview.onDidReceiveMessage((message: WebviewToExtension) => {
    log.trace("received message:", message);
    switch (message.kind) {
      case "request": {
        const { id, body } = message;
        const response = onRequest(body);
        postResponse(id, response);
        break;
      }
      case "response": {
        onResponse(message.body);
        break;
      }
    }
  });
};
