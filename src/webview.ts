import { basicSetup } from "codemirror";
import { sync } from "./sync-webview";

sync({
  vscode: acquireVsCodeApi(),
  extensions: [basicSetup],
  parent: document.getElementById("editor")!,
});
