/**
 * @fileoverview This file provides the TextAlign enumeration.
 * Copyright 2010 Google Inc. All Rights Reserved.
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

import {fail} from '@npm//@closure/asserts/asserts';
import {average} from '@npm//@closure/math/math';

/**
 * Enumeration of the possible text alignment possibilities.
 * Text alignment.
 */
export enum TextAlign {
  START = 'start',
  CENTER = 'center',
  END = 'end',
}

/**
 * Returns the absolute start and end coordinates of a given text alignment
 * and text position which is relative to the alignment (the opposite of
 * getRelativeCoordinate below).
 * @param coordinate The relative coordinate.
 * @param length The length of the text.
 * @param align The text alignment.
 * @param rtl Whether the text is right-to-left.
 * @return The absolute start and end coordinates of the text.
 */
export function getAbsoluteCoordinates(
  coordinate: number,
  length: number,
  align: TextAlign,
  rtl?: boolean,
): {start: number; end: number} {
  if (rtl) {
    align =
      align === TextAlign.START
        ? TextAlign.END
        : align === TextAlign.END
          ? TextAlign.START
          : align;
  }
  let end;
  let start;

  switch (align) {
    case TextAlign.START:
      start = coordinate;
      end = coordinate + length;
      break;
    case TextAlign.END:
      start = coordinate - length;
      end = coordinate;
      break;
    case TextAlign.CENTER:
      start = coordinate - length / 2;
      end = coordinate + length / 2;
      break;
    default:
      start = end = NaN;
      fail(`Invalid TextAlign: "${align}"`);
  }
  return {start, end};
}

/**
 * Returns a coordinate relative to the text alignment given absolute start and
 * end coordinates (the opposite of getAbsoluteCoordinates above).
 * @param start The absolute start coordinate.
 * @param end The absolute start coordinate.
 * @param align The text alignment.
 * @param rtl Whether the text is right-to-left.
 * @return The relative coordinate.
 */
export function getRelativeCoordinate(
  start: number,
  end: number,
  align: TextAlign,
  rtl?: boolean,
): number {
  if (rtl) {
    align =
      align === TextAlign.START
        ? TextAlign.END
        : align === TextAlign.END
          ? TextAlign.START
          : align;
  }
  switch (align) {
    case TextAlign.END:
      return end;
    case TextAlign.CENTER:
      return average(start, end);
    case TextAlign.START:
    default:
      return start;
  }
}
