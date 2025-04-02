import { CodeMirrorContext, ExtensionData } from "codemirror-vscode";
import * as path from "node:path";
import * as vscode from "vscode";
import lang from "./lang";
import modules from "./modules.json";
import { sync } from "./sync";
import { Subscriber } from "./util";

const template = (importmap: string, script: string) => `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script type="importmap">${importmap}</script>
    <script type="module" src="${script}"></script>
  </head>
</html>`;

const open = async (
  context: vscode.ExtensionContext,
  log: vscode.LogOutputChannel,
  options: { wordWrap: boolean },
) => {
  const editor = vscode.window.activeTextEditor;
  if (editor === undefined) {
    vscode.window.showErrorMessage("no active editor to open in CodeMirror");
    return;
  }
  const { document } = editor;
  const sub = new Subscriber(log, document.uri.toString());

  sub.scribe(vscode.workspace.onDidCloseTextDocument, (doc) => {
    if (doc !== document) return;
    // If `document` closes, the webview no longer has anywhere to send its
    // changes, so it must be disposed to avoid the user making unsaved
    // changes that would be dropped.
    sub.dispose();
  });

  const panel = vscode.window.createWebviewPanel(
    "codemirror",
    `${path.basename(document.fileName)} (CodeMirror)`,
    vscode.ViewColumn.Active, // Open on top of the active editor.
    {
      enableScripts: true,

      // Allow files from other extensions, not just this one.
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "..")],
    },
  );
  const { webview } = panel;
  sub.add(panel); // Let the webview itself be disposed when `document` closes.
  // Dispose of everything else when the webview is closed.
  sub.scribe(panel.onDidDispose, () => sub.dispose());

  const cmCtx: CodeMirrorContext = {
    asWebviewUri: (uri) => webview.asWebviewUri(uri),
    languageId: document.languageId,
    wordWrap: options.wordWrap,
  };
  Object.freeze(cmCtx);
  log.debug("CodeMirror context:", cmCtx);
  const extensions = await Promise.all(
    (
      vscode.workspace
        .getConfiguration("codemirror")
        .get<string[]>("extensions") ?? []
    ).map((command) =>
      vscode.commands.executeCommand<ExtensionData<any>>(command, cmCtx),
    ),
  );
  sync({ log, editor, sub, webview, extensions });

  const importmap = {
    imports: Object.fromEntries(
      Object.entries(modules).flatMap(([org, packages]) =>
        Object.keys(packages).map((name) => {
          const uri = vscode.Uri.joinPath(
            context.extensionUri,
            "dist",
            org,
            `${name}.js`,
          );
          return [`@${org}/${name}`, webview.asWebviewUri(uri).toString()];
        }),
      ),
    ),
  };
  const script = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "dist", "webview.js"),
  );
  const html = template(JSON.stringify(importmap), script.toString());
  log.debug("HTML:", html);
  webview.html = html;
};

export const activate = (context: vscode.ExtensionContext) => {
  const log = vscode.window.createOutputChannel("CodeMirror", { log: true });
  log.info("activating CodeMirror extension");

  const getUri = (cmCtx: CodeMirrorContext, name: string): string => {
    const base = context.extensionUri;
    const uri = vscode.Uri.joinPath(base, "dist", "extensions", `${name}.js`);
    return cmCtx.asWebviewUri(uri).toString();
  };

  const registry = new Map<string, number>();

  context.subscriptions.push(
    vscode.Disposable.from({
      dispose: () => {
        log.debug("unregistering all commands");
        registry.clear();
      },
    }),
    vscode.commands.registerCommand(
      "codemirror.extension.basicSetup",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[]>> => {
        return { uri: getUri(cmCtx, "basic-setup"), name: "basic", args: [] };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.extension.minimalSetup",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[]>> => {
        return { uri: getUri(cmCtx, "basic-setup"), name: "minimal", args: [] };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.extension.wordWrap",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<any>> => {
        const uri = getUri(cmCtx, cmCtx.wordWrap ? "word-wrap" : "empty");
        return { uri, args: [] };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.extension.themeVscode",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[]>> => {
        let name = "dark";
        switch (vscode.window.activeColorTheme.kind) {
          case vscode.ColorThemeKind.Light:
          case vscode.ColorThemeKind.HighContrastLight:
            name = "light";
        }
        return { uri: getUri(cmCtx, "theme-vscode"), name, args: [] };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.extension.vscodeDark",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[]>> => {
        return { uri: getUri(cmCtx, "theme-vscode"), name: "dark", args: [] };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.extension.vscodeLight",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[]>> => {
        return { uri: getUri(cmCtx, "theme-vscode"), name: "light", args: [] };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.extension.lang",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<any>> => {
        return (await lang(cmCtx)) ?? { uri: getUri(cmCtx, "empty"), args: [] };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.extension.auto",
      async (
        cmCtx: CodeMirrorContext,
      ): Promise<ExtensionData<ExtensionData<any>[]>> => {
        const groups = new Map<number, string[]>();
        for (const [command, order] of registry.entries()) {
          if (!groups.has(order)) groups.set(order, []);
          groups.get(order)!.push(command);
        }
        const sorted = [...groups.entries()].sort(([a], [b]) => a - b);
        log.debug("registry:", sorted);
        const commands: string[] = [];
        for (const [, group] of sorted) {
          group.sort();
          commands.push(...group);
        }
        log.debug("commands:", commands);
        const args = await Promise.all(
          commands.map((command) =>
            vscode.commands.executeCommand<ExtensionData<any>>(command, cmCtx),
          ),
        );
        return { uri: getUri(cmCtx, "multiple"), args };
      },
    ),
    vscode.commands.registerCommand(
      "codemirror.register",
      (command: string, order?: number): vscode.Disposable => {
        log.debug("registering command:", command);
        if (typeof command !== "string")
          throw Error("command must be a string");
        if (!(order === undefined || Number.isFinite(order)))
          throw Error("command order must be a finite number");
        if (registry.has(command)) throw Error("command already registered");
        registry.set(command, order ?? 0);
        return vscode.Disposable.from({
          dispose: () => {
            log.debug("unregistering command:", command);
            registry.delete(command);
          },
        });
      },
    ),
    vscode.commands.registerCommand("codemirror.open", () =>
      open(context, log, { wordWrap: false }),
    ),
    // Ideally, `codemirror.openWordWrap` would call `codemirror.open` instead
    // of just calling the `open` function directly, so that extensions
    // depending on this one could just list `onCommand:codemirror.open` in
    // their `activationEvents` instead of also having to list
    // `onCommand:codemirror.openWordWrap`. Unfortunately, for some reason that
    // doesn't work.
    vscode.commands.registerCommand("codemirror.openWordWrap", () =>
      open(context, log, { wordWrap: true }),
    ),
  );
};
