import Handlebars from "handlebars";
import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import modules from "./modules.json";
import { sync } from "./sync-extension";
import { Subscriber } from "./util";

interface HtmlParams {
  importmap: string;
  script: string;
}

const open = async (
  context: vscode.ExtensionContext,
  log: vscode.LogOutputChannel,
  template: Handlebars.TemplateDelegate<HtmlParams>,
) => {
  const extensions = await Promise.all(
    (
      vscode.workspace
        .getConfiguration("codemirror")
        .get<string[]>("extensions") ?? []
    ).map((command) => vscode.commands.executeCommand<vscode.Uri>(command)),
  );

  const active = vscode.window.activeTextEditor;
  if (active === undefined) {
    vscode.window.showErrorMessage("no active editor to open in CodeMirror");
    return;
  }
  const { document } = active;
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
    { enableScripts: true },
  );
  const { webview } = panel;
  sub.add(panel); // Let the webview itself be disposed when `document` closes.
  // Dispose of everything else when the webview is closed.
  sub.scribe(panel.onDidDispose, () => sub.dispose());

  sync({ log, extensions, document, sub, webview });

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
  log.trace("import map:", importmap);
  const script = webview
    .asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "dist", "webview.js"),
    )
    .toString();
  log.trace("script as webview URI:", script);
  webview.html = template({ importmap: JSON.stringify(importmap), script });
};

export const activate = (context: vscode.ExtensionContext) => {
  const log = vscode.window.createOutputChannel("CodeMirror", { log: true });
  log.info("CodeMirror extension activated");

  const templatePath = path.join(context.extensionPath, "src", "webview.hbs");
  log.debug("located HTML template:", templatePath);
  const templateText = fs.readFileSync(templatePath, "utf8");
  log.trace("read HTML template:\n", templateText);
  const template = Handlebars.compile<HtmlParams>(templateText);

  for (const name of ["basicSetup", "vscodeDark"]) {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        `codemirror.extension.${name}`,
        (): vscode.Uri => {
          return vscode.Uri.joinPath(
            context.extensionUri,
            "dist",
            "extensions",
            `${name}.js`,
          );
        },
      ),
    );
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("codemirror.open", () =>
      open(context, log, template),
    ),
  );
};
