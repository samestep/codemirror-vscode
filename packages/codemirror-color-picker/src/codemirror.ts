import { Extension, Range } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import iro from "@jaames/iro";
import { Options } from "./options";

type Format = "hex" | "hex8" | "rgb" | "rgba" | "hsl" | "hsla";

const colorString = (format: Format, color: iro.Color): string => {
  switch (format) {
    case "hex":
      return color.alpha < 1 ? color.hex8String : color.hexString;
    case "hex8":
      return color.hex8String;
    case "rgb":
      return color.alpha < 1 ? color.rgbaString : color.rgbString;
    case "rgba":
      return color.rgbaString;
    case "hsl":
      return color.alpha < 1 ? color.hslaString : color.hslString;
    case "hsla":
      return color.hslaString;
  }
};

// https://iro.js.org/color_api.html#supported-color-formats
const regexes: { fmt: Format; re: RegExp }[] = [
  { fmt: "hex", re: /#[0-9A-Fa-f]{6}\b/g },
  { fmt: "hex8", re: /#[0-9A-Fa-f]{8}\b/g },
  { fmt: "hex", re: /#[0-9A-Fa-f]{3}\b/g },
  { fmt: "hex8", re: /#[0-9A-Fa-f]{4}\b/g },
  { fmt: "rgb", re: /rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)/g },
  { fmt: "rgba", re: /rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*\d(\.\d+)?\)/g },
  { fmt: "rgb", re: /rgb\(\d{1,3}%,\s*\d{1,3}%,\s*\d{1,3}%\)/g },
  { fmt: "rgba", re: /rgba\(\d{1,3}%,\s*\d{1,3}%,\s*\d{1,3}%,\s*\d{1,3}%\)/g },
  { fmt: "hsl", re: /hsl\(\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%\)/g },
  { fmt: "hsla", re: /hsla\(\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%,\s*\d(\.\d+)?\)/g },
];

class ColorWidget extends WidgetType {
  /** The square element whose color can be changed. */
  private square: HTMLElement | undefined;

  constructor(
    /** The start index in the document for this widget. */
    public readonly index: number,

    /** The format of the color string in the document for this widget. */
    public readonly format: Format,

    /** The color string in the document for this widget. */
    public color: string,

    /** A callback for when this widget's `square` is clicked. */
    private activate: (widget: ColorWidget, parent: HTMLElement) => void,
  ) {
    super();
  }

  eq(other: ColorWidget) {
    // When the user interacts with the color picker, it will edit the document,
    // which will cause decorations to be recomputed. While that is happening,
    // the color picker is the child element of one of these widgets, so in this
    // method we must tell CodeMirror not to recreate this widget if its start
    // position hasn't changed.
    return this.index === other.index;
  }

  toDOM() {
    const parent = document.createElement("div");
    Object.assign(parent.style, {
      display: "inline-block", // Position children in the correct column.
    });
    this.square = document.createElement("span");
    parent.appendChild(this.square);
    Object.assign(this.square.style, {
      display: "inline-block", // Be able to be a square.
      height: "0.75em",
      width: "0.75em",
      marginRight: "0.5ch", // Gap before the actual color text.
      outline: "1px solid",
      cursor: "pointer",
    });
    this.setColor(this.color);
    this.square.addEventListener("click", () => {
      this.activate(this, parent);
    });
    return parent;
  }

  /** Set the color state and the square DOM element's color. */
  setColor(color: string) {
    this.color = color;
    const square = this.square;
    if (square !== undefined) square.style.backgroundColor = color;
  }
}

const slider = (sliderType: string) => {
  return { component: iro.ui.Slider, options: { sliderType } };
};

export default async (options: Options): Promise<Extension> =>
  ViewPlugin.fromClass(
    class {
      /** The DOM element containing the color picker. */
      element: HTMLElement;

      /** The color picker. */
      picker: iro.ColorPicker;

      /** The current decorations. */
      decorations: DecorationSet;

      /** The color widget to which the color picker is currently attached. */
      active: ColorWidget | undefined;

      constructor(private view: EditorView) {
        this.element = document.createElement("div");
        Object.assign(this.element.style, {
          position: "absolute", // Draw on top of other stuff.
          backgroundColor: options.backgroundColor,
          padding: `${options.margin}px`,
          borderRadius: `${options.borderRadius}px`,
        });
        this.picker = iro.ColorPicker(this.element, {
          ...options,
          layout: (options.layout ?? []).map(
            (name) =>
              ({
                wheel: { component: iro.ui.Wheel },
                box: { component: iro.ui.Box },
                "hue slider": slider("hue"),
                "saturation slider": slider("saturation"),
                "value slider": slider("value"),
                "red slider": slider("red"),
                "green slider": slider("green"),
                "blue slider": slider("blue"),
                "alpha slider": slider("alpha"),
                "kelvin temperature slider": slider("kelvin"),
              })[name],
          ),
        });
        this.decorations = this.computeDecorations();
        this.picker.on("color:change", (color: iro.Color) => {
          this.changeColor(color);
        });
      }

      computeDecorations(): DecorationSet {
        const ranges: Range<Decoration>[] = [];
        for (const { from, to } of this.view.visibleRanges) {
          const str = this.view.state.sliceDoc(from, to);
          for (const { fmt, re } of regexes) {
            for (const match of str.matchAll(re)) {
              const { index } = match;
              const absolute = from + index;
              const spec = {
                widget: new ColorWidget(
                  absolute,
                  fmt,
                  match[0],
                  (widget, parent) => {
                    this.active = widget;
                    this.picker.setColors([this.active.color]);
                    parent.appendChild(this.element);
                  },
                ),
              };
              ranges.push(Decoration.widget(spec).range(absolute));
            }
          }
        }
        // The `true` here means we need to sort the ranges, because we iterated
        // through multiple different regexes.
        return Decoration.set(ranges, true);
      }

      changeColor(color: iro.Color) {
        const active = this.active;
        if (active === undefined) return;
        const { index: from, format, color: str } = active;
        const insert = colorString(format, color);
        active.setColor(insert);
        const to = from + str.length;
        this.view.dispatch({ changes: { from, to, insert } });
      }

      update(update: ViewUpdate) {
        if (update.selectionSet) {
          // The user moved the cursor somewhere else, so hide the color picker.
          this.element.remove();
          this.active = undefined;
        }
        if (update.docChanged || update.viewportChanged) {
          // The visible ranges may have changed, so recompute the decorations.
          this.decorations = this.computeDecorations();
        }
      }
    },
    { decorations: (value) => value.decorations },
  );
