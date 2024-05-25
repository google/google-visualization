/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as gvizJson from '../common/json';

// tslint:disable:no-unnecessary-type-assertion

/**
 * Properties of TextStyle
 */
export interface TextStyleProperties {
  fontName: string;
  fontSize: string | number;
  color: string;
  opacity: number;
  auraColor: string;
  auraWidth: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

/** Partial of TextStyleProperties */
export type PartialTextStyleProperties = Partial<TextStyleProperties>;

/**
 * Default property values for text styles.
 */
const DEFAULT: TextStyleProperties = {
  fontName: 'sans-serif',
  fontSize: 10,
  color: 'black',
  opacity: 1,
  auraColor: '',
  auraWidth: 3,
  bold: false,
  italic: false,
  underline: false,
};

/**
 * A builder for the TextStyle typedef.
 * @unrestricted
 */
export class TextStyle {
  fontName: string = DEFAULT.fontName;
  fontSize = Number(DEFAULT.fontSize); // Must be positive number.
  color: string = DEFAULT.color;
  opacity: number = DEFAULT.opacity; // Range 0..1
  auraColor: string = DEFAULT.auraColor;
  auraWidth: number = DEFAULT.auraWidth;
  bold: boolean = DEFAULT.bold;
  italic: boolean = DEFAULT.italic;
  underline: boolean = DEFAULT.underline;

  /**
   * @param textStyle An object or TextStyle
   *     that is used to construct a TextStyle. If null or missing,
   *     or if any of the properties is null or missing,
   *     the corresponding default value will be used.
   */
  constructor(textStyle?: TextStyle | null | Partial<TextStyleProperties>) {
    this.setProperties(textStyle || {});
  }

  /**
   * Sets all the properties given TextStyleProperties
   */
  setProperties(
    textStyleProps?: TextStyle | null | Partial<TextStyleProperties>,
  ): TextStyle {
    textStyleProps = textStyleProps || {};
    this.setFontName(textStyleProps!.fontName);
    this.setFontSize(textStyleProps!.fontSize);
    this.setColor(textStyleProps!.color);
    this.setOpacity(textStyleProps!.opacity);
    this.setAuraColor(textStyleProps!.auraColor);
    this.setAuraWidth(textStyleProps!.auraWidth);
    this.setBold(textStyleProps!.bold);
    this.setItalic(textStyleProps!.italic);
    this.setUnderline(textStyleProps!.underline);

    return this;
  }

  getProperties(): TextStyleProperties {
    return {
      'fontName': this.fontName,
      'fontSize': this.fontSize,
      'color': this.color,
      'auraColor': this.auraColor,
      'auraWidth': this.auraWidth,
      'bold': this.bold,
      'italic': this.italic,
      'underline': this.underline,
      'opacity': this.opacity,
    };
  }

  /**
   * Returns a JSON string that represents the text style.
   *
   * @return a JSON encoded string.
   */
  toJSON(): string {
    return gvizJson.stringify(this.getProperties());
  }

  /**
   * Sets the font name.
   * Empty string is treated the same as null/undefined.
   */
  setFontName(fontName: string | null | undefined): TextStyle {
    if (fontName != null && fontName !== '') {
      this.fontName = fontName;
    }
    return this;
  }

  /**
   * Sets the font size, which must be non-negative.
   * Zero is treated the same as null/undefined.
   * Also allows string with floating point number. e.g. "9.5"
   */
  setFontSize(fontSize: number | null | string | undefined): TextStyle {
    if (fontSize != null) {
      if (typeof fontSize === 'string') {
        fontSize = Number(fontSize);
      }
      if (typeof fontSize === 'number') {
        if (fontSize < 0) {
          throw new Error('Negative fontSize not allowed.');
        } else if (fontSize > 0) {
          this.fontSize = fontSize;
        }
      }
    }
    return this;
  }

  /**
   * Sets the font color.
   */
  setColor(color: string | null | undefined): TextStyle {
    if (color != null) {
      this.color = color;
    }
    return this;
  }

  /**
   * Sets the font opacity.
   */
  setOpacity(opacity: number | null | undefined): TextStyle {
    if (opacity != null) {
      this.opacity = opacity;
    }
    return this;
  }

  /**
   * Sets the font aura color.
   */
  setAuraColor(auraColor: string | null | undefined): TextStyle {
    if (auraColor != null) {
      this.auraColor = auraColor;
    }
    return this;
  }

  /**
   * Sets the font aura width.
   */
  setAuraWidth(auraWidth: number | null | undefined): TextStyle {
    if (auraWidth != null) {
      this.auraWidth = auraWidth;
    }
    return this;
  }

  /**
   * Sets the font bold property.
   */
  setBold(bold: boolean | null | undefined): TextStyle {
    if (bold != null) {
      this.bold = bold;
    }
    return this;
  }

  /**
   * Sets the font italic property.
   */
  setItalic(italic: boolean | null | undefined): TextStyle {
    if (italic != null) {
      this.italic = italic;
    }
    return this;
  }

  /**
   * Sets the font underline property.
   */
  setUnderline(underline: boolean | null | undefined): TextStyle {
    if (underline != null) {
      this.underline = underline;
    }
    return this;
  }
}
