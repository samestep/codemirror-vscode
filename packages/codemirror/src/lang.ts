import { CodeMirrorContext, ExtensionData } from "codemirror-vscode";
import * as vscode from "vscode";

// https://code.visualstudio.com/docs/languages/identifiers#_known-language-identifiers
// https://www.npmjs.com/org/codemirror
/**
 * VS Code language IDs that exactly match CodeMirror package and function names
 * with no configuration.
 */
const known = new Set([
  "cpp",
  "css",
  "go",
  "java",
  "javascript",
  "json",
  "less",
  "python",
  "rust",
  "yaml",
]);

export default async (
  cmCtx: CodeMirrorContext,
): Promise<ExtensionData<any> | undefined> => {
  const name = cmCtx.languageId;
  const cfg =
    vscode.workspace
      .getConfiguration("codemirror")
      .get<Record<string, string>>("languages") ?? {};
  if (name in cfg)
    return vscode.commands.executeCommand<ExtensionData<any>>(cfg[name], cmCtx);
  const uri = `@codemirror/lang-${name}`;
  if (known.has(name)) return { uri, name, args: [] };
  switch (name) {
    case "html": {
      // TODO: https://www.npmjs.com/package/@codemirror/lang-html
      return { uri, name, args: [] };
    }
    case "javascriptreact": {
      const args = [{ jsx: true }];
      return { uri: "@codemirror/lang-javascript", name: "javascript", args };
    }
    case "markdown": {
      // TODO: https://www.npmjs.com/package/@codemirror/lang-markdown
      return { uri, name, args: [] };
    }
    case "php": {
      // TODO: https://www.npmjs.com/package/@codemirror/lang-php
      return { uri, name, args: [] };
    }
    case "sass": {
      const args = [{ indented: true }];
      return { uri, name, args };
    }
    case "scss": {
      return { uri: "@codemirror/lang-sass", name: "sass", args: [] };
    }
    case "sql": {
      // TODO: https://www.npmjs.com/package/@codemirror/lang-sql
      return { uri, name, args: [] };
    }
    case "typescript": {
      const args = [{ typescript: true }];
      return { uri: "@codemirror/lang-javascript", name: "javascript", args };
    }
    case "typescriptreact": {
      const args = [{ jsx: true, typescript: true }];
      return { uri: "@codemirror/lang-javascript", name: "javascript", args };
    }
    case "vue": {
      // TODO: https://www.npmjs.com/package/@codemirror/lang-vue
      return { uri, name, args: [] };
    }
    case "xml": {
      // TODO: https://www.npmjs.com/package/@codemirror/lang-xml
      return { uri, name, args: [] };
    }
  }
};
