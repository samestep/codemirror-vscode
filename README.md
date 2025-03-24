# CodeMirror in VS Code

[CodeMirror](https://codemirror.net/) as a [VS Code](https://code.visualstudio.com/) extension.

## Why?

In 2012, Bret Victor gave a talk titled [Inventing on Principle](https://youtu.be/PUv66718DII), in which he showed a demo of editing a JavaScript file that was being re-executed immediately on every change, with a little widget to edit numbers by dragging the mouse in an analog fashion instead of just typing:

[![Inventing on Principle](bretvictor.png)](https://youtu.be/PUv66718DII?t=253)

As of 2025, this sort of thing is not possible in Visual Studio Code, which [73.6% of developers "use regularly" according to the 2024 Stack Overflow Developer Survey](https://survey.stackoverflow.co/2024/technology#1-integrated-development-environment). However, it is possible in CodeMirror; for instance, here's a short demo GIF of [CodeMirror Interact by Replit](https://github.com/replit/codemirror-interact):

![CodeMirror Interact](codemirror-interact.gif)

## What?

According to [the CodeMirror website](https://codemirror.net/):

> CodeMirror is a code editor component for the web. It can be used in websites to implement a text input field with support for many editing features, and has a rich programming interface to allow further extension.

This project packages CodeMirror as a [webview](https://code.visualstudio.com/api/extension-guides/webview) extension for Visual Studio Code.

## How?

This extension is not yet published to the VS Code Marketplace; check back later, or if you're curious then you can refer to [`CONTRIBUTING.md`](CONTRIBUTING.md) to build it from source.

Use the **Open in CodeMirror** command to open the current file in a new CodeMirror editor.

## License

This project is licensed under the MIT license.
