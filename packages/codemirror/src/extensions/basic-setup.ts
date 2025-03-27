import { Extension } from "@codemirror/state";
import { basicSetup, minimalSetup } from "codemirror";

export const basic = async (): Promise<Extension> => basicSetup;

export const minimal = async (): Promise<Extension> => minimalSetup;
