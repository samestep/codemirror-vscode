import { EditorView, basicSetup } from "codemirror";
import { sync } from "./sync-webview";

const vscode = acquireVsCodeApi();

new EditorView({
  extensions: [basicSetup, sync({ vscode })],
  parent: document.getElementById("editor") as HTMLElement,
});
