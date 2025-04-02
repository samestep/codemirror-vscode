import {
  collab,
  getSyncedVersion,
  receiveUpdates,
  sendableUpdates,
  Update,
} from "@codemirror/collab";
import { EditorState, Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import multiple from "./extensions/multiple";
import {
  clientID,
  Connection,
  dataToUpdates,
  ExtensionRequests,
  ExtensionResponds,
  PullResponse,
  PushResponse,
  StartResponse,
  updatesToData,
  WebviewRequests,
  WebviewResponds,
} from "./protocol";

const vscode = acquireVsCodeApi();

const connection = new Connection<
  WebviewRequests,
  ExtensionResponds,
  ExtensionRequests,
  WebviewResponds
>({
  postMessage: (message) => vscode.postMessage(message),
  setOnMessage: (listener) =>
    window.addEventListener("message", (event) => listener(event.data)),
  respond: () => {
    throw Error("impossible: request was sent to webview");
  },
});

const push = async (
  version: number,
  updates: readonly Update[],
): Promise<boolean> =>
  (
    await connection.request<PushResponse>({
      kind: "push",
      version,
      updates: updatesToData(updates),
    })
  ).accepted;

const pull = async (version: number): Promise<readonly Update[]> =>
  dataToUpdates(
    (await connection.request<PullResponse>({ kind: "pull", version })).updates,
  );

// https://github.com/codemirror/website/blob/b7247cacfcd389e359a038a41fff679185538ef8/site/examples/collab/collab.ts
const sync = (startVersion: number): Extension => [
  collab({ startVersion, clientID }),
  ViewPlugin.fromClass(
    class {
      private pushing = false;
      private done = false;

      constructor(private view: EditorView) {
        this.pull();
      }

      update(update: ViewUpdate) {
        if (update.docChanged) this.push();
      }

      async push() {
        const updates = sendableUpdates(this.view.state);
        if (this.pushing || updates.length === 0) return;
        this.pushing = true;
        const version = getSyncedVersion(this.view.state);
        await push(version, updates);
        this.pushing = false;
        // Regardless of whether the push failed or new updates came in
        // while it was running, try again if there's updates remaining
        if (sendableUpdates(this.view.state).length > 0)
          setTimeout(() => this.push(), 100);
      }

      async pull() {
        while (!this.done) {
          const version = getSyncedVersion(this.view.state);
          const updates = await pull(version);
          this.view.dispatch(receiveUpdates(this.view.state, updates));
        }
      }

      destroy() {
        this.done = true;
      }
    },
  ),
];

connection.request<StartResponse>({ kind: "start" }).then(async (start) => {
  const { extensions, version, text, selection } = start;
  new EditorView({
    state: EditorState.create({
      doc: text,
      selection,
      extensions: [sync(version), await multiple(...extensions)],
    }),
    parent: document.body,
    scrollTo: EditorView.scrollIntoView(selection.head, { y: "center" }),
  }).focus();
});
