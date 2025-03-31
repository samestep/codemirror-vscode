import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export default async (): Promise<Extension> => EditorView.lineWrapping;
