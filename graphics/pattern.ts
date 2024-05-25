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

import {PatternStyle} from './types';
import * as util from './util';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * The pattern class is used to describe the fill pattern used by a brush,
 * specifically, a style, a foreground color, and a background color.
 */
export class Pattern {
  private readonly color: string;
  bgcolor: AnyDuringMigration;

  /**
   * @param style The style of the pattern.
   * @param color The color of the pattern.
   * @param bgcolor The background color, default is 'white'.
   */
  constructor(
    private readonly style: PatternStyle,
    color: string,
    bgcolor?: string,
  ) {
    /**
     * The color of the pattern.
     */
    this.color = util.parseColor(color);

    bgcolor = bgcolor != null ? bgcolor : '#ffffff';
    this.bgcolor = util.parseColor(bgcolor);
  }

  /**
   * Returns the style of the pattern.
   * @return The style of the pattern.
   */
  getStyle(): PatternStyle {
    return this.style;
  }

  /**
   * Returns the color of the pattern.
   * @return The color of the pattern.
   */
  getColor(): string {
    return this.color;
  }

  /**
   * Returns the background color of the pattern.
   * @return The background color of the pattern.
   */
  getBackgroundColor(): string {
    return this.bgcolor;
  }

  /**
   * Creates a copy of the pattern with the same properties.
   * @return A clone of this pattern.
   */
  clone(): Pattern {
    const newPattern = new Pattern(this.style, this.color, this.bgcolor);
    return newPattern;
  }

  /**
   * Returns a clone of this pattern, after graying out the colors.
   * @return The grayed out pattern.
   */
  grayOut(): Pattern {
    const newPattern = new Pattern(
      this.style,
      util.grayOutColor(this.color),
      util.grayOutColor(this.bgcolor),
    );
    return newPattern;
  }

  /**
   * Tests whether two given patterns are equal.
   * @param a The 1st pattern.
   * @param b The 2nd pattern.
   * @return true if the two patterns are equal.
   */
  static equals(a: Pattern | null, b: Pattern | null): boolean {
    if (a === b) {
      return true;
    }

    if (a == null || b == null) {
      return false;
    }

    return (
      a.bgcolor === b.bgcolor && //
      a.color === b.color && //
      a.style === b.style
    );
  }
}
