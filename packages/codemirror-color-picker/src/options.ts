import { IroColorPickerOptions } from "@irojs/iro-core";

export type ComponentName =
  | "wheel"
  | "box"
  | "hue slider"
  | "saturation slider"
  | "value slider"
  | "red slider"
  | "green slider"
  | "blue slider"
  | "alpha slider"
  | "kelvin temperature slider";

export interface Options extends IroColorPickerOptions {
  layout?: ComponentName[];
  margin?: number;
  backgroundColor?: string;
  borderRadius?: number;
}
