import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {
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
      webview.html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <div id="editor"></div>
  <script src="${script}"></script>
</body>
</html>
`;
      webview.postMessage(active.document.getText());
    }),
  );
};
