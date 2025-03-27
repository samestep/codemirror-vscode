import * as vscode from "vscode";

/** Context passed to a VS Code command for a CodeMirror extension. */
export interface CodeMirrorContext {
  /** Convert a `file:` URI to a webview URI. */
  asWebviewUri: (uri: vscode.Uri) => vscode.Uri;

  /** VS Code language ID of the document. */
  languageId: string;
}

/** Data returned from a VS Code command for a CodeMirror extension. */
export interface ExtensionData<T> {
  /** Stringified webview URI of the JavaScript module. */
  uri: string;

  /** Name of the exported function; implicitly `default` export if omitted. */
  name?: string;

  /** Serializable arguments to pass to the function. */
  args: T;
}
