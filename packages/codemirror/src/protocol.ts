import { Update } from "@codemirror/collab";
import { ChangeSet } from "@codemirror/state";
import { ExtensionData } from "codemirror-vscode";

/** A message ID, unique for a given sender but not across senders. */
export type Id = number;

/** A request. */
export interface Req<T> {
  kind: "request";
  id: Id;
  body: T;
}

/** A response. */
export interface Resp<T> {
  kind: "response";
  id: Id;
  body: T;
}

/** Message-passing wrapper using promises. */
export class Connection<WeRequest, TheyRespond, TheyRequest, WeRespond> {
  private postMessage: (message: Req<WeRequest> | Resp<WeRespond>) => void;
  private id: number;
  private pending: Map<Id, (response: TheyRespond) => void>;

  /** Create a new connection. */
  constructor({
    postMessage,
    setOnMessage,
    respond,
  }: {
    postMessage: (message: Req<WeRequest> | Resp<WeRespond>) => void;
    setOnMessage: (
      listener: (message: Req<TheyRequest> | Resp<TheyRespond>) => void,
    ) => void;
    respond: (request: TheyRequest) => Promise<WeRespond>;
  }) {
    this.postMessage = postMessage;
    this.id = 0;
    this.pending = new Map();
    setOnMessage(async (message) => {
      switch (message.kind) {
        case "request": {
          const { id, body } = message;
          const response = await respond(body);
          postMessage({ kind: "response", id, body: response });
          break;
        }
        case "response": {
          const { id, body } = message;
          const resolve = this.pending.get(id);
          if (resolve === undefined) break;
          this.pending.delete(id);
          resolve(body);
          break;
        }
      }
    });
  }

  /** Send a request and wait for a response. */
  request<T extends TheyRespond>(request: WeRequest): Promise<T> {
    const id = this.id++;
    this.postMessage({ kind: "request", id, body: request });
    return new Promise((resolve) =>
      this.pending.set(id, resolve as (response: TheyRespond) => void),
    );
  }
}

/** A VS Code document version. */
export type Version = number;

/** Offsets of a selection in a document. */
export interface Selection {
  /** Cursor position. */
  head: number;

  /** Other end of the selection. */
  anchor: number;
}

/** We cheat a bit by telling CodeMirror that both sides are the same client. */
export const clientID = "";

/** Serializable form of `Update` from `@codemirror/collab`. */
export interface UpdateData {
  /** Returned by `ChangeSet.toJSON`. */
  changes: any;
}

/** Convert `Update` to `UpdateData`. */
export const updatesToData = (updates: readonly Update[]): UpdateData[] =>
  updates.map((u) => ({ changes: u.changes.toJSON() }));

/** Convert `UpdateData` to `Update`. */
export const dataToUpdates = (updates: UpdateData[]): readonly Update[] =>
  updates.map((u) => ({ changes: ChangeSet.fromJSON(u.changes), clientID }));

/** Webview to extension: send the initial configuration. */
export interface StartRequest {
  kind: "start";
}

/** Extension responding to webview: here is the initial configuration. */
export interface StartResponse {
  /** CodeMirror extensions. */
  extensions: ExtensionData<any>[];

  /** Initial version number. */
  version: Version;

  /** Initial document text. */
  text: string;

  /** Initial selection. */
  selection: Selection;
}

/** Webview to extension: send a nonempty list of updates after a version. */
export interface PullRequest {
  kind: "pull";

  /** Only send updates after this version.. */
  version: Version;
}

/** Extension responding to webview: here are the updates. */
export interface PullResponse {
  updates: UpdateData[];
}

/** Webview to extension: please apply these updates on top of a version. */
export interface PushRequest {
  kind: "push";

  /** Version to which the updates apply. */
  version: Version;

  /** The updates. */
  updates: UpdateData[];
}

/** Extension responding to webview: push processed. */
export interface PushResponse {
  accepted: boolean;
}

/** Body of a request from webview to extension. */
export type WebviewRequests = StartRequest | PullRequest | PushRequest;

/** Body of a response from extension to webview. */
export type ExtensionResponds = StartResponse | PullResponse | PushResponse;

/** Body of a request from extension to webview. */
export type ExtensionRequests = never;

/** Body of a response from webview to extension. */
export type WebviewResponds = never;

/** A message from extension to webview. */
export type ExtensionToWebview =
  | Req<ExtensionRequests>
  | Resp<ExtensionResponds>;

/** A message from webview to extension. */
export type WebviewToExtension = Req<WebviewRequests> | Resp<WebviewResponds>;
