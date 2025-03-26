import { ChangeSet, EditorState, Extension } from "@codemirror/state";
import { EditorView } from "codemirror";
import { WebviewApi } from "vscode-webview";
import {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionToWebview,
  Id,
  Patch,
  StartResponse,
  Version,
  VersionRequest,
  VersionResponse,
  WebviewRequest,
  WebviewResponse,
} from "./protocol";
import { Diff, Doc, Replace } from "./text";

const patchStart: Patch = 0;

const codemirrorToDiff = (changes: ChangeSet): Diff => {
  const replacements: Replace[] = [];
  changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    replacements.push({
      start: fromA,
      end: toA,
      text: inserted.toString(),
    });
  });
  return new Diff(...replacements);
};

class State {
  postRequest: (request: WebviewRequest) => void;
  patch: Patch;
  doc: Doc;
  versions: Map<Version, Doc>;
  numPatches: number;
  suppress: boolean;
  view: EditorView;

  constructor({
    extensions,
    parent,
    postRequest,
    version,
    text,
  }: {
    extensions: Extension[];
    parent: Element;
    postRequest: (request: WebviewRequest) => void;
    version: Version;
    text: string;
  }) {
    this.postRequest = postRequest;
    this.patch = patchStart;
    this.doc = new Doc(text);
    this.versions = new Map([[version, this.doc]]);
    this.numPatches = 1;
    this.suppress = false;
    this.view = new EditorView({
      state: EditorState.create({
        doc: text,
        extensions: [
          EditorView.updateListener.of(({ changes }) => this.handle(changes)),
          ...extensions,
        ],
      }),
      parent,
    });
  }

  makePatch(): Patch {
    return this.numPatches++;
  }

  handle(changes: ChangeSet) {
    const diff = codemirrorToDiff(changes);
    const edited = this.doc.edit(diff);
    if (edited.equals(this.doc)) return;
    this.doc = edited;
    const prior = this.patch;
    this.patch = this.makePatch();
    if (this.suppress) return;
    this.postRequest({
      kind: "patch",
      prior,
      patch: this.patch,
      diff: diff.data(),
    });
  }

  reset(doc: Doc) {
    this.suppress = true;
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: doc.toString(),
      },
    });
    this.suppress = false;
  }

  version(
    { previous, version, patch, diff }: VersionRequest,
    respond: (response: VersionResponse) => void,
  ) {
    const doc = this.versions.get(previous)!.edit(new Diff(...diff));
    this.versions.set(version, doc);
    if (patch !== undefined) {
      // In this case, the extension told us that this update corresponds to a
      // patch we've already sent in the past, so there are no conflicts and
      // thus we don't need to modify our editor state.
      respond({ patch });
    } else {
      this.reset(doc);
      respond({ patch: this.patch });
    }
  }
}

export const sync = ({
  vscode,
  parent,
}: {
  vscode: WebviewApi<unknown>;
  parent: Element;
}) => {
  let nextId = 0;
  const pending = new Map<Id, WebviewRequest>();
  const postRequest = (body: WebviewRequest) => {
    const id = nextId++;
    pending.set(id, body);
    vscode.postMessage({ kind: "request", id, body });
  };
  const postResponse = <T extends WebviewResponse>(id: Id, body: T) => {
    vscode.postMessage({ kind: "response", id, body });
  };

  let state: State | undefined = undefined;

  const onRequest = (
    request: ExtensionRequest,
    respond: <T extends WebviewResponse>(response: T) => void,
  ) => {
    switch (request.kind) {
      case "version": {
        if (state === undefined) break;
        state.version(request, respond);
        break;
      }
    }
  };
  const onResponse = async (
    request: WebviewRequest,
    response: ExtensionResponse,
  ) => {
    switch (request.kind) {
      case "start": {
        const { extensions: uris, version, text } = response as StartResponse;
        const extensions = await Promise.all(
          uris.map(async (uri) => (await import(uri)).default),
        );
        state = new State({ extensions, parent, postRequest, version, text });
        break;
      }
      case "patch": {
        break; // Our request was acknowledged; nothing to do.
      }
    }
  };
  window.addEventListener("message", (event) => {
    const message: ExtensionToWebview = event.data;
    switch (message.kind) {
      case "request": {
        const { id, body } = message;
        onRequest(body, (response) => postResponse(id, response));
        break;
      }
      case "response": {
        const { id, body } = message;
        const request = pending.get(id);
        if (request === undefined) break;
        pending.delete(id);
        onResponse(request, body);
        break;
      }
    }
  });

  postRequest({ kind: "start", patch: patchStart }); // Ask for initial version.
};
