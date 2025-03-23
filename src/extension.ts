import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.commands.registerCommand("codemirror.open", () => {
      vscode.window.showInformationMessage("It's CodeMirror!");
    })
  );
};
