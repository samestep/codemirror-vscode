import { sync } from "./sync-webview";

sync({
  vscode: acquireVsCodeApi(),
  parent: document.getElementById("editor")!,
});
