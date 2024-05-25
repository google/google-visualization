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

import {Orientation, TextMeasurer} from './text_measurer';

/**
 * Measures text with a fixed size font.
 */
export class FixedFont extends TextMeasurer {
  /**
   * @param charWidth Character width.
   * @param charHeight Character height.
   */
  constructor(
    private readonly charWidth: number,
    private readonly charHeight: number,
  ) {
    super();
  }

  /**
   * Measures the width of a text field.
   * @param str The string to measure.
   * @return Width.
   */
  getWidth(str: string | null): number {
    return str!.length * this.charWidth;
  }

  /**
   * Measures the width of a text field.
   * @param str The string to measure.
   * @return Width.
   */
  getHeight(str: string | null): number {
    return this.charHeight;
  }

  /**
   * Measures the width or height of a text field.
   * @param str The string to measure.
   * @param orientation The orientation.
   * @return The measured size.
   */
  getSizeByOrientation(str: string | null, orientation: Orientation): number {
    return orientation === Orientation.HORIZONTAL
      ? this.getWidth(str)
      : this.getHeight(str);
  }
}
