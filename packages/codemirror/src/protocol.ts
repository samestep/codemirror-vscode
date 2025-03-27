import { ExtensionData } from "codemirror-vscode";
import { Replace } from "./text";

/** A message ID, unique for a given sender but not across senders. */
export type Id = number;

/** A VS Code document version. */
export type Version = number;

/** A CodeMirror document version. */
export type Patch = number;

/** A request. */
interface Req<T> {
  kind: "request";
  id: Id;
  body: T;
}

/** A response. */
interface Resp<T> {
  kind: "response";
  id: Id;
  body: T;
}

/** Webview to extension: send the initial configuration. */
export interface StartRequest {
  kind: "start";

  /** The patch number pre-allocated for the initial document version. */
  patch: Patch;
}

/** Extension responding to webview: here is the initial configuration. */
export interface StartResponse {
  /** CodeMirror extensions. */
  extensions: ExtensionData<any>[];

  /** Initial version number. */
  version: Version;

  /** Initial document text. */
  text: string;
}

/** Extension to webview: the VS Code document has a new version. */
export interface VersionRequest {
  kind: "version";

  /** Previous version to which the diff applies. */
  previous: Version;

  /** New version number. */
  version: Version;

  /** Patch to which this new version is exactly equal, if any is known. */
  patch?: Patch;

  /** Changes to apply to the previous version to get this one. */
  diff: Replace[];
}

/** Webview responding to extension: new VS Code doc version acknowledged. */
export interface VersionResponse {
  /** Patch number assigned to be equivalent to this version number. */
  patch: Patch;
}

/** Webview to extension: apply this patch on top of a prior patch. */
export interface PatchRequest {
  kind: "patch";

  /** Prior patch version to which the diff applies. */
  prior: Patch;

  /** New patch number. */
  patch: Patch;

  /** Changes to apply to the prior patch to get this one. */
  diff: Replace[];
}

/** Extension responding to webview: patch acknowledged. */
export interface PatchResponse {}

/** Body of a request from webview to extension. */
export type WebviewRequest = StartRequest | PatchRequest;

/** Body of a response from webview to extension. */
export type ExtensionResponse = StartResponse | PatchResponse;

/** Body of a request from extension to webview. */
export type ExtensionRequest = VersionRequest;

/** Body of a response from webview to extension. */
export type WebviewResponse = VersionResponse;

/** A message from extension to webview. */
export type ExtensionToWebview =
  | Req<ExtensionRequest>
  | Resp<ExtensionResponse>;

/** A message from webview to extension. */
export type WebviewToExtension = Req<WebviewRequest> | Resp<WebviewResponse>;
