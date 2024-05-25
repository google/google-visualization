/**
 * @fileoverview This file provides utility functions for the graphics code.
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

import {isObject} from 'google3/javascript/common/asserts/guards';
import * as assertsDom from '@npm//@closure/asserts/dom';
import * as googColor from '@npm//@closure/color/color';
import {DomHelper} from '@npm//@closure/dom/dom';
import {SafeHtml} from 'safevalues';

import * as logicalname from './logicalname';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A color specifying that a color is totally transparent or non-existing.
 * The value 'none' is known by SVG and the VML renderer takes care of treating
 * it as a non-color.
 */
export const NO_COLOR = 'none';

/**
 * Parses a generic color string into an RGB hex color string (e.g. #ff00ff),
 * if possible.  Errors in parsing are ignored if `ignoreError` is true, in
 * which case, any string may represent a color; this is used for special color
 * values like 'series-color'.
 *
 * If the value is null, the empty string, or 'none' or 'transparent',
 * the special color NO_COLOR ('none') is returned.
 *
 * @param color The color to parse.
 * @param ignoreError Whether to ignore error when parsing.
 * @return An RGB color string (or 'none').
 */
export function parseColor(
  color?: {color?: string} | null | string, //
  ignoreError?: boolean, //
): string {
  if (
    color == null ||
    color === '' ||
    color === 'transparent' ||
    color === NO_COLOR
  ) {
    return NO_COLOR;
  } else {
    if (isObject(color)) {
      // TODO(dlaliberte): if (color.color == null) throw error?
      return (color as {color?: string}).color || '';
    }
    if (typeof color === 'string') {
      try {
        // If color is in RGBA format, return it as is.
        if (color.includes('rgba')) {
          return color;
        }
        return googColor.parse(color).hex;
      } catch (e: unknown) {
        if (!ignoreError) {
          // An unknown color string will cause an exception.
          throw new Error(`Invalid color: ${color}`);
        }
      }
      return color;
    }
  }
  return NO_COLOR;
}

/**
 * Returns a grayed-out version of the given color.
 * @param color The color string to process, already parsed to be hex.
 * @return An RGB color string (or NO_COLOR).
 */
export function grayOutColor(color: string): string {
  if (color === NO_COLOR) {
    return NO_COLOR;
  }
  // We create the gray version by taking the average of the RGB values of the
  // original color, and returning a color for which R = G = B = this average.
  // It seems this is not the default graying out of an image/movie, but it is
  // not clear what is best here. See http://en.wikipedia.org/wiki/Grayscale.
  const colorRgb = googColor.hexToRgb(color);
  const value = Math.round((colorRgb[0] + colorRgb[1] + colorRgb[2]) / 3);
  return googColor.rgbToHex(value, value, value);
}

/**
 * Blend two colors together, using the specified factor to indicate the weight
 * given to the first color. Similar to goog.color.blend, but handles colors as
 * hex strings and not as RGB arrays.
 * @param color1 First color as hex string.
 * @param color2 Second color as hex string.
 * @param factor The weight to be given to color1 over color2. Values
 *     should be in the range [0, 1]. If less than 0, factor will be set to 0.
 *     If greater than 1, factor will be set to 1.
 * @return Combined color as hex string.
 */
export function blendHexColors(
  color1: string,
  color2: string,
  factor: number,
): string {
  if (!color1 || color1 === NO_COLOR) {
    return color2;
  }
  if (!color2 || color2 === NO_COLOR) {
    return color1;
  }
  return googColor.rgbArrayToHex(
    googColor.blend(
      googColor.hexToRgb(color1),
      googColor.hexToRgb(color2),
      factor,
    ),
  );
}

/**
 * Figure out the colors array desired for a visualization.
 * This can be specified by options as an array of values in 'colors',
 * or as a single value in 'color' (which is only tried if 'colors'
 * is missing). Each value is intended to be an #RRGGBB string (e.g. '#3399CC').
 * If neither 'colors' nor 'color' is provided, returns defaultValue.
 * @param options The same as specifying a colors value of length 1. Only
 *         used if a colors value isn't specified.
 * @param defaultValue The default colors. May be undefined.
 * @return The colors to use.
 */
export function getDesiredColors(
  options?: AnyDuringMigration,
  defaultValue?: string[],
): string[] | undefined {
  const colors = options && options['colors'];
  if (colors && colors.length > 0) return colors;
  const color = options?.['color'] || null;
  return color ? [color] : defaultValue;
}

/**
 * Creates a dom tree according to a given dom structure and returns its root.
 * TODO(dlaliberte): Move this to dom utilities.
 * @param domHelper A dom helper used for creating html nodes.
 * @param definition The html structure to create.
 * @return The built DOM Node.
 */
export function createDom(domHelper: DomHelper, definition: SafeHtml): Element {
  const element = assertsDom.assertIsElement(
    domHelper.safeHtmlToNode(definition),
  );
  const needLogicalName: Element[] = [];
  if (element.hasAttribute('data-logicalname')) {
    needLogicalName.push(element);
  }
  Array.from(element.querySelectorAll('[data-logicalname]')).forEach((el) => {
    needLogicalName.push(el);
  });

  needLogicalName.forEach((el) => {
    const name = el.getAttribute('data-logicalname');
    logicalname.setLogicalName(el, name!);
  });
  return element;
}
