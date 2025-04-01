import { CodeMirrorContext, ExtensionData } from "codemirror-vscode";
import * as vscode from "vscode";
import { Options } from "./options";

export const activate = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codemirrorColorPicker.extension",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[Options]>> => ({
        uri: cmCtx
          .asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, "dist", "codemirror.js"),
          )
          .toString(),
        args: [
          Object.fromEntries(
            [
              "backgroundColor",
              "borderRadius",
              "width",
              "layout",
              "layoutDirection",
              "borderWidth",
              "borderColor",
              "padding",
              "margin",
              "handleRadius",
              "activeHandleRadius",
              "wheelLightness",
              "wheelAngle",
              "wheelDirection",
              "sliderSize",
              "boxHeight",
            ].flatMap((key) => {
              const value = vscode.workspace
                .getConfiguration("codemirrorColorPicker")
                .get(key);
              // The `activeHandleRadius`, `sliderSize`, and `boxHeight` options
              // are `null` by default, but that's not a valid `number`, so we
              // must filter those out.
              return value === null ? [] : [[key, value]];
            }),
          ),
        ],
      }),
    ),
  );
};
