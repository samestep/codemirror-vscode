import { CodeMirrorContext, ExtensionData } from "codemirror-vscode";
import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codemirrorInteract.extension",
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
