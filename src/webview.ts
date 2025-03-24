import { EditorView, basicSetup } from "codemirror";

const view = new EditorView({
  extensions: [basicSetup],
  parent: document.getElementById("editor") as HTMLElement,
});

window.addEventListener("message", (event) => {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: event.data },
  });
});
