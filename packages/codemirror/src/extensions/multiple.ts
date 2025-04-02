import { Extension } from "@codemirror/state";
import { ExtensionData } from "codemirror-vscode";

export default async (
  ...extensions: ExtensionData<any>[]
): Promise<Extension> =>
  await Promise.all(
    extensions.map(async ({ uri, name, args }) => {
      const mod = await import(uri);
      const func: (...args: any) => Extension | Promise<Extension> =
        name === undefined ? mod.default : mod[name];
      return func(...args);
    }),
  );
