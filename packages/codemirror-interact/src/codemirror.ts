import { Extension } from "@codemirror/state";
import interact from "@replit/codemirror-interact";

// https://www.npmjs.com/package/@replit/codemirror-interact/v/6.3.1
export default async (): Promise<Extension> =>
  interact({
    rules: [
      // a rule for a number dragger
      {
        // the regexp matching the value
        regexp: /-?\b\d+\.?\d*\b/g,
        // set cursor to "ew-resize" on hover
        cursor: "ew-resize",
        // change number value based on mouse X movement on drag
        onDrag: (text, setText, e) => {
          const newVal = Number(text) + e.movementX;
          if (isNaN(newVal)) return;
          setText(newVal.toString());
        },
      },
    ],
  });
