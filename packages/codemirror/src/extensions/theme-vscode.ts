import { Extension } from "@codemirror/state";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";

export const dark = async (): Promise<Extension> => vscodeDark;

export const light = async (): Promise<Extension> => vscodeLight;
