# CodeMirror in VS Code

[CodeMirror](https://codemirror.net/) as a [VS Code](https://code.visualstudio.com/) extension.

## Why?

In 2012, Bret Victor gave a talk titled [Inventing on Principle](https://youtu.be/PUv66718DII), in which he showed a demo of editing a JavaScript file that was being re-executed immediately on every change, with a little widget to edit numbers by dragging the mouse in an analog fashion instead of just typing:

[![Inventing on Principle](images/bret-victor.png)](https://youtu.be/PUv66718DII?t=252)

As of 2025, this sort of thing is not possible in Visual Studio Code, which [73.6% of developers "use regularly" according to the 2024 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2024/technology#1-integrated-development-environment). However, it is possible in CodeMirror; for instance, here's a short demo video of [CodeMirror Interact by Replit](https://github.com/replit/codemirror-interact):

[![CodeMirror Interact](images/codemirror-interact.gif)](https://user-images.githubusercontent.com/9929523/147966613-270cdece-564f-4906-b6e8-b48975a0d9e2.mp4)

## What?

According to [the CodeMirror website](https://codemirror.net/):

> CodeMirror is a code editor component for the web. It can be used in websites to implement a text input field with support for many editing features, and has a rich programming interface to allow further extension.

This project packages CodeMirror as a [webview](https://code.visualstudio.com/api/extension-guides/webview) extension for Visual Studio Code.

## How?

This extension is not yet published to the VS Code Marketplace; check back later, or if you're curious then you can refer to [`CONTRIBUTING.md`](CONTRIBUTING.md) to build it from source.

Use the **Open in CodeMirror** command to open the current file in a new CodeMirror editor. To configure CodeMirror, add or remove items from the **`codemirror.extensions`** and **`codemirror.languages`** VS Code settings:

![VS Code settings for languages and CodeMirror extensions](images/settings.png)

Here is a list of the CodeMirror extensions included in this VS Code extension:

- **`codemirror.extension.basicSetup`** is the `basicSetup` extension from the [`codemirror`](https://github.com/codemirror/basic-setup/tree/86f3699347713440e5b1a50b6a98d82963335d50) npm package, which "pulls together a number of extensions that you might want in a basic editor."

- **`codemirror.extension.minimalSetup`** is the `minimalSetup` extension from that same `codemirror` npm package, which is a "minimal set of extensions to create a functional editor."

- **`codemirror.extension.themeVscode`** uses the VS Code [color theme kind](https://code.visualstudio.com/api/references/vscode-api#ColorThemeKind) to select between the dark and light themes provided by the [`@uiw/codemirror-theme-vscode`](https://www.npmjs.com/package/@uiw/codemirror-theme-vscode/v/4.23.10) npm package.

- **`codemirror.extension.vscodeDark`** applies the VS Code dark theme from the `@uiw/codemirror-theme-vscode` npm package.

- **`codemirror.extension.vscodeLight`** applies the VS Code light theme from the `@uiw/codemirror-theme-vscode` npm package.

- **`codemirror.extension.lang`** uses the [VS Code language identifier](https://code.visualstudio.com/docs/languages/identifiers) to dispatch according to the `codemirror.languages` setting, or loads and configures a [`@codemirror/lang-*`](https://www.npmjs.com/org/codemirror) extension as a fallback if one is [known](https://code.visualstudio.com/docs/languages/identifiers#_known-language-identifiers).

## Ecosystem

The default value for the `codemirror.extensions` setting only includes VS Code [command IDs](https://code.visualstudio.com/api/extension-guides/command) provided by this VS Code extension, listed above. However, commands from other VS Code extensions can be used as well, making this extension, itself, extensible. For instance, the CodeMirror Interact extension mentioned earlier is implemented as a [separate VS Code extension in this same repository](packages/codemirror-interact). And if you want, you can easily make your own VS Code extension to provide other CodeMirror extensions!

For instance, let's say you want [CodeMirror support for Julia](https://www.npmjs.com/package/@plutojl/lang-julia/v/0.12.1). If you have [Node.js](https://nodejs.org/) installed, you just need to create four files. First, create a `.vscodeignore` file specifying what should be included in the package:

```
**
!dist
```

Next, put metadata and build scripts in `package.json`:

```json
{
  "publisher": "your-publisher-name",
  "name": "codemirror-julia",
  "version": "0.0.0",
  "engines": {
    "vscode": "^1.75.0"
  },
  "extensionDependencies": ["samestep.codemirror"],
  "main": "./dist/extension.js",
  "activationEvents": ["onCommand:codemirrorJulia.extension"],
  "devDependencies": {
    "@plutojl/lang-julia": "^0.12",
    "@types/vscode": "^1",
    "@vscode/vsce": "^3",
    "codemirror-vscode": "^0.1",
    "esbuild": "^0.25"
  },
  "scripts": {
    "esm": "esbuild src/codemirror.ts --bundle --format=esm --external:@codemirror --external:@lezer --outdir=dist",
    "cjs": "esbuild src/extension.ts --bundle --format=cjs --platform=node --external:vscode --outdir=dist",
    "vsix": "vsce package --allow-missing-repository --skip-license",
    "build": "npm run esm && npm run cjs && npm run vsix"
  }
}
```

Then, put your VS Code extension entry point in `src/extension.ts`:

```typescript
import { CodeMirrorContext, ExtensionData } from "codemirror-vscode";
import * as vscode from "vscode";

export const activate = (context: vscode.ExtensionContext) => {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "codemirrorJulia.extension",
      async (cmCtx: CodeMirrorContext): Promise<ExtensionData<[]>> => ({
        uri: cmCtx
          .asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, "dist", "codemirror.js"),
          )
          .toString(),
        args: [],
      }),
    ),
  );
};
```

And put the CodeMirror extension itself in `src/codemirror.ts`:

```typescript
import { Extension } from "@codemirror/state";
import { julia } from "@plutojl/lang-julia";

export default async (): Promise<Extension> => julia();
```

Then run a couple commands to build it:

```sh
npm install
npm run build
```

If you're already in VS Code, right-click on the `codemirror-julia-0.0.0.vsix` file that just got created, and click **Install Extension VSIX**. Finally, map `julia` to `codemirrorJulia.extension` in the `codemirror.languages` setting:

![VS Code setting for Julia in CodeMirror](images/language-julia.png)

And you're done! Now you'll get syntax highlighting if you execute **Open in CodeMirror** on a Julia file, and with no effect on non-Julia files.

This is just a simple example, but you should be able to use the same pattern for pretty much any CodeMirror extension. If this doesn't work for your use case, feel free to open a [GitHub issue](https://github.com/samestep/codemirror-vscode/issues)!

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

This project is licensed under the [MIT License](https://en.wikipedia.org/wiki/MIT_License).
