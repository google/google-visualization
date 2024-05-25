/**
 * @fileoverview Provides a simple text measurer interface and fixed font
 * implementation for testing.
 *
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

/**
 * Enum for axis orientation.
 */
export enum Orientation {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
}

/**
 * Provides a simple text measurer interface and fixed font
 * implementation for testing.
 */
export abstract class TextMeasurer {
  /**
   * Measures the width of a text field.
   * @param str The string to measure.
   * @return Width.
   */
  abstract getWidth(str: string | null): number;

  /**
   * Measures the width of a text field.
   * @param str The string to measure.
   * @return Width.
   */
  abstract getHeight(str: string | null): number;

  /**
   * Measures the width or height of a text field.
   * @param str The string to measure.
   * @param orientation The orientation.
   * @return The measured size.
   */
  abstract getSizeByOrientation(
    str: string | null,
    orientation: Orientation,
  ): number;
}
