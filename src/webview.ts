import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { basicSetup } from "codemirror";
import { sync } from "./sync-webview";

sync({
  vscode: acquireVsCodeApi(),
  extensions: [basicSetup, vscodeDark],
  parent: document.getElementById("editor")!,
});
