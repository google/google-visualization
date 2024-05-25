/**
 * @fileoverview Utilities to handle text, including long text handling.
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

import {Size} from '@npm//@closure/math/size';
import * as util from '../common/layout_utils';
import {TextMeasureFunction} from './text_measure_function';
import {TextStyle} from './text_style';

/**
 * The layout of the text, in the following structure:
 *     lines {Array.<string>} - The string for each line.
 *     maxLineWidth - The maximum width.
 *     needTooltip {boolean} True if tooltip is needed, i.e. the text did not
 *                           fit entirely.
 */
export interface TextLayout {
  lines: string[];
  needTooltip: boolean;
  maxLineWidth: number;
}

/**
 * Computes the layout of a given text.
 * The restraints are the width and number of lines which can be used. If there
 * isn't enough space in one line, at most maxLines are used where we split
 * lines only at spaces. If still there is not enough space, ellipsis is used
 * and we set the tooltip member to the original text..
 * @param textMeasureFunction The function to use for measuring text width and
 *     height.
 * @param text The given text to layout.
 * @param textStyle The text style.
 * @param width The maximal width of a single line.
 * @param maxLines The maximal number of lines allowed, default = 1.
 * @param requireOneChar If true, we must include at least one character in the
 *     original text, default = false.
 */
export function calcTextLayout(
  textMeasureFunction: TextMeasureFunction,
  text: string,
  textStyle: TextStyle,
  width: number,
  maxLines?: number,
  requireOneChar?: boolean,
): TextLayout {
  maxLines = maxLines != null ? Math.floor(maxLines) : 1;
  requireOneChar = requireOneChar != null ? requireOneChar : false;
  if (width <= 0) {
    return {lines: [], needTooltip: text.length > 0, maxLineWidth: 0};
  }
  if (maxLines === 0) {
    return {lines: [], needTooltip: false, maxLineWidth: 0};
  }
  // TODO(dlaliberte): "text as string" should just be "text"
  const simpleTextMeasure = (text: string | string[]) =>
    textMeasureFunction(text as string, textStyle);
  const brokenUpText = util.breakLines(
    simpleTextMeasure,
    text,
    textStyle,
    width,
    maxLines,
    {truncate: true, requireOneChar, dontBreakWords: true},
  );
  return {
    lines: brokenUpText.lines,
    needTooltip: brokenUpText.truncated,
    maxLineWidth:
      brokenUpText.lines.length > 0
        ? Math.max.apply(
            null,
            brokenUpText.lines
              .map(simpleTextMeasure)
              .map((obj: Size) => obj.width),
          )
        : 0,
  };
}

/**
 * @param textStyle The text style object from which the font size and font
 *     family will be copied to the css style.
 * @return An object that can be set as the style of a dom element using goog.style. @see goog.style.
 */
export function tooltipCssStyle(textStyle: TextStyle): {
  [key: string]: string | undefined;
} {
  const cssStyle = {
    'background': 'infobackground',
    'padding': '1px',
    'border': '1px solid infotext',
    'fontSize': textStyle.fontSize ? `${textStyle.fontSize}px` : undefined,
    'fontFamily': textStyle.fontName ? textStyle.fontName : undefined,
    'margin': textStyle.fontSize ? `${textStyle.fontSize}px` : undefined,
  };
  return cssStyle;
}
