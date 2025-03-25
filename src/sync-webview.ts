import { Extension } from "@codemirror/state";
import { WebviewApi } from "vscode-webview";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";
import {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionToWebview,
  Id,
  originExtension,
  WebviewRequest,
  WebviewResponse,
} from "./protocol";

export const sync = ({
  vscode,
}: {
  vscode: WebviewApi<unknown>;
}): Extension => {
  let nextId = 0;
  const postRequest = (body: WebviewRequest) => {
    vscode.postMessage({ kind: "request", id: nextId++, body });
  };
  const postResponse = (id: Id, body: WebviewResponse) => {
    vscode.postMessage({ kind: "response", id, body });
  };

  const ydoc = new Y.Doc();
  const ytext = ydoc.getText();
  // When we change the Yjs document, send that update to the extension.
  ydoc.on("update", (update, origin) => {
    if (origin === originExtension) return; // Don't send edits right back.
    postRequest({ kind: "update", update });
  });

  const onRequest = (request: ExtensionRequest): WebviewResponse => {
    switch (request.kind) {
      case "update": {
        // When the extension sends us an update, apply it to the Yjs document.
        Y.applyUpdate(ydoc, request.update, originExtension);
        return { kind: "update" }; // Acknowledge the update.
      }
    }
  };
  const onResponse = (response: ExtensionResponse) => {
    switch (response.kind) {
      case "start": {
        break; // The actual content will come in a separate update message.
      }
      case "update": {
        break; // Our update request was acknowledged; nothing to do.
      }
    }
  };
  window.addEventListener("message", (event) => {
    const message: ExtensionToWebview = event.data;
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

  postRequest({ kind: "start" }); // Ask the extension for the initial text.

  const awareness = undefined;
  return yCollab(ytext, awareness);
};
