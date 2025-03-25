/** A message ID. */
export type Id = number;

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

/** Body of a `start` request. */
interface StartRequest {
  kind: "start";
}

/** Body of a `start` response. */
interface StartResponse {
  kind: "start";
}

/** Body of an `update` request. */
interface UpdateRequest {
  kind: "update";
  update: Uint8Array;
}

/** Body of an `update` response. */
interface UpdateResponse {
  kind: "update";
}

/** Body of a request from webview to extension. */
export type WebviewRequest = StartRequest | UpdateRequest;

/** Body of a response from webview to extension. */
export type ExtensionResponse = StartResponse | UpdateResponse;

/** Body of a request from extension to webview. */
export type ExtensionRequest = UpdateRequest;

/** Body of a response from webview to extension. */
export type WebviewResponse = UpdateResponse;

/** A message from extension to webview. */
export type ExtensionToWebview =
  | Req<ExtensionRequest>
  | Resp<ExtensionResponse>;

/** A message from webview to extension. */
export type WebviewToExtension = Req<WebviewRequest> | Resp<WebviewResponse>;

/** A Yjs transaction origin for the extension. */
export const originExtension = "extension";
