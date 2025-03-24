import Handlebars from "handlebars";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {
  const template = Handlebars.compile(
    fs.readFileSync(
      path.join(context.extensionPath, "src", "webview.hbs"),
      "utf8",
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("codemirror.open", () => {
      const active = vscode.window.activeTextEditor;
      if (active === undefined) {
        vscode.window.showErrorMessage("no active text editor");
        return;
      }
      const { webview } = vscode.window.createWebviewPanel(
        "codemirror",
        `${active.document.fileName} (CodeMirror)`,
        vscode.ViewColumn.Active,
        { enableScripts: true },
      );
      const script = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "dist", "webview.js"),
      );
      webview.html = template({ script });
      webview.postMessage(active.document.getText());
    }),
  );
};
