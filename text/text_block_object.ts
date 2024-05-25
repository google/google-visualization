/**
 * @fileoverview A multi-line text block structure.
 *
 * TODO(dlaliberte) Merge this with the TextBlock.
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

import {assert} from '@npm//@closure/asserts/asserts';
import {Box} from '@npm//@closure/math/box';
import {calcBoundingBox as commonUtilCalcBoundingBox} from '../common/util';
import {Brush} from '../graphics/brush';
import {DrawingGroup} from '../graphics/drawing_group';
import {Coordinate} from '../math/coordinate';
import {TooltipDefinition} from '../tooltip/tooltip_definition';
import * as textalign from './text_align';
import {TextStyle} from './text_style';

/**
 * text: The full text before splitting it into lines.
 * textStyle: As its name implies.
 * boxStyle: A brush for the box containing the text block.
 * lines: An array of objects where each element describe a single line.
 * paralAlign: The alignment parallel to the text line.
 * perpenAlign: The alignment perpendicular to the text line.
 * tooltip: The content of the tooltip to be displayed when hovering over the
 *   area covered by the text, or empty string for no tooltip.
 * angle: An optional property to indicate the angle of the text. Default is
 *   zero (horizontal text), and going clockwise, i.e. 90 is top to bottom.
 * anchor: An optional property that is the position of the text block. All
 *   lines coordinates are relative to this position. Default is {x: 0, y: 0}.
 *
 */
export interface TextBlock {
  text: string;
  textStyle: TextStyle;
  boxStyle: Brush | null | undefined;
  lines: Line[];
  paralAlign: textalign.TextAlign;
  perpenAlign: textalign.TextAlign;
  // TODO(dlaliberte): Move these tooltip properties to a subtype.
  tooltip: string;
  tooltip1?: string;
  tooltipHtml?: TooltipDefinition;
  angle: number;
  anchor: Coordinate | null | undefined;
}

/**
 * A single line of text in the text block.
 * x,y: Coordinates of the line.
 * length: The length in pixels of the area allocated for the line. The text
 *   itself can be shorter than this length.
 * text: The text of the line.
 */
export interface Line {
  x: number;
  y: number;
  length: number;
  text: string;
}

/**
 * Calculate the bounding box surrounding a single line of text. Works properly
 * only for a horizontal line (i.e. angle == 0).
 * Returns null if the line is empty.
 * @param textLine The text line.
 * @param textBlock The text block the line belongs to.
 * @return the bounding box.
 */
export function calcLineBoundingBox(
  textLine: Line,
  textBlock: TextBlock,
): Box | null {
  assert(
    textBlock.angle == null || textBlock.angle === 0,
    'Can only calculate the bounding box of axis aligned texts (angle is 0)',
  );
  const anchor = textBlock.anchor ? textBlock.anchor : {x: 0, y: 0};

  const xStartEnd = textalign.getAbsoluteCoordinates(
    textLine.x + anchor.x,
    textLine.length,
    textBlock.paralAlign,
  );
  const yStartEnd = textalign.getAbsoluteCoordinates(
    textLine.y + anchor.y,
    textBlock.textStyle.fontSize,
    textBlock.perpenAlign,
  );

  if (xStartEnd.start === xStartEnd.end || yStartEnd.start === yStartEnd.end) {
    // If the line text is an empty string we wish to avoid a bogus bounding box
    // with 0 width/height (such a bogus BB would trick functions like
    // gviz.common.util.calcBoundingBox into giving wrong results).
    return null;
  }
  return new Box(
    yStartEnd.start,
    xStartEnd.end,
    yStartEnd.end,
    xStartEnd.start,
  );
}

/**
 * Calculate the bounding box surrounding all lines of text. Works properly only
 * for horizontal text boxes (i.e. angle == 0).
 * @param textBlock The text block.
 * @return the bounding box.
 */
export function calcBoundingBox(textBlock: TextBlock): Box | null {
  const linesBoundingBoxes = textBlock.lines.map((line) =>
    calcLineBoundingBox(line, textBlock),
  );
  // Filter out null bounding boxes (happens when text line is empty).
  const notEmpty = <TValue>(
    value: TValue | null | undefined,
  ): value is TValue => {
    return value != null;
  };
  return commonUtilCalcBoundingBox(linesBoundingBoxes.filter(notEmpty));
}

/**
 * Type for a helper function for drawing text blocks.
 * @see ChartBuilder.prototype.drawTextBlock for details.
 */
export type DrawTextBlockFunc = (
  p1: TextBlock,
  p2: DrawingGroup,
  p3?: boolean,
) => Element | null;
