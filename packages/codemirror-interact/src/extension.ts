import { CodeMirrorContext, ExtensionData } from "codemirror-vscode";
import * as vscode from "vscode";

export const activate = async (context: vscode.ExtensionContext) => {
  const command = "codemirrorInteract.extension";
  context.subscriptions.push(
    await vscode.commands.executeCommand("codemirror.register", command),
    vscode.commands.registerCommand(
      command,
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[]>> => ({
        uri: cmCtx
          .asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, "dist", "codemirror.js"),
          )
          .toString(),
        args: [],
      }),
    ),
  );
};
