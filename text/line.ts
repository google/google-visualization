/**
 * @fileoverview A single line of text.
 *
 * @license
 * Copyright 2024 Google LLC
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
 * A class for representing a single line of text.
 *
 * Most often these are used in TextBlocks.
 *
 * Lines are constructed from a single object. This is to simplify conversion
 * from the old TextBlock.Line typedefs.
 */
export class Line {
  /** The x coordinate. */
  x: number;

  /** The y coordinate. */
  y: number;

  /**
   * The length in pixels of the area allocated for the line. The text itself
   * may be shorter.
   */
  length: number;

  /** The text of the line. */
  text: string;

  /** @param line The line object to construct from. */
  constructor(line: {
    x?: number | null;
    y?: number | null;
    length: number;
    text: string;
  }) {
    this.x = line.x || 0;
    this.y = line.y || 0;

    this.length = line.length;
    this.text = line.text;
  }
}
