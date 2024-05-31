/**
 * @fileoverview A multi-line text block structure.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import {Box} from '@npm//@closure/math/box';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import * as messages from '../common/messages';
import {calcBoundingBox} from '../common/util';
import {Brush} from '../graphics/brush';
import {Coordinate} from '../math/coordinate';
import {Line} from './line';
import {TextAlign, getAbsoluteCoordinates} from './text_align';
import {TextMeasureFunction} from './text_measure_function';
import {TextStyle} from './text_style';
import * as textutils from './text_utils';

/**
 * A structure for holding the tooltip text.
 */
export interface TooltipText {
  hasHtmlContent: boolean;
  hasCustomContent: boolean;
  content: string;
}

/**
 * A structure for holding the text block.
 */
export interface TextBlockType {
  text: string;
  textStyle: TextStyle;
  lines: Line[];
  boxStyle: Brush | undefined;
  paralAlign: TextAlign;
  perpenAlign: TextAlign;
  tooltip: string | undefined;
  angle: number | undefined;
  anchor: Coordinate | undefined;
  truncated: boolean;
  tooltipText?: TooltipText;
}

/**
 * An object type corresponding to TextBlockType.
 */
export type TextBlockTypeObject = {
  [key in keyof TextBlockType]: TextBlockType[key];
};

/**
 * Enumeration of possible positions to place test.
 * Position.
 */
export enum TextBlockPosition {
  TOP = 'top',
  RIGHT = 'right',
  BOTTOM = 'bottom',
  LEFT = 'left',
}

/**
 * A class for representing a text block.
 * Text blocks are constructed from a single object. This is to simplify
 * conversion from the old TextBlock typedefs. This is the set of keys we will
 * construct from:
 *   text: {string} The full text before splitting into lines.
 *   textStyle: {!TextStyle} The text style.
 *   lines: {Array.<Line>} An array of text lines.
 *   paralAlign: {TextAlign} The alignment parallel to the text line.
 *   perpenAlign: {TextAlign} The alignment perpendicular to the text line.
 *   tooltip: {string} The content of the tooltip to be displayed when
 *     hovering over the area covered by the text, or empty string for no
 *     tooltip.
 *   angle: {number=} Indicates the angle of the text.
 *       Default is 0° (horizontal), and going clockwise, i.e. 90° is top to
 *       bottom.
 *   anchor: {Coordinate=} The position of the text block. All line
 *       coordinates are relative to this position.
 * @unrestricted
 */
export class TextBlock {
  /** The full text before splitting lines */
  text: string;

  /** The text style. */
  textStyle: TextStyle;

  /** The box style. */
  boxStyle?: Brush;

  /** An array of text lines. */
  lines: Line[];

  /** The alignment parallel to the text line. */
  paralAlign: TextAlign;

  /** The alignment perpendicular to the text line. */
  perpenAlign: TextAlign;

  /**
   * The content of the tooltip to be displayed when hovering over the text
   * block area.
   * TODO(dlaliberte): Pretty sure this is not a string...
   */
  tooltip: string;

  /**
   * @suppress {strictMissingProperties} Auto-added to unblock
   * check_level=STRICT
   */
  tooltipText?: TooltipText;

  /** The text style. */
  angle: number;

  /** The text style. */
  anchor: Coordinate | null;

  /**
   * Whether we truncated the text.
   * @suppress {strictMissingProperties} Auto-added to unblock
   * check_level=STRICT
   */
  truncated: boolean;

  /** @param textBlock The textBlock object to construct from. */
  constructor(textBlock: TextBlockTypeObject) {
    this.text = textBlock.text;
    this.textStyle = textBlock.textStyle;
    this.boxStyle = textBlock.boxStyle;
    this.lines = textBlock.lines;
    this.paralAlign = textBlock.paralAlign;
    this.perpenAlign = textBlock.perpenAlign;
    this.tooltip = textBlock.tooltip !== undefined ? textBlock.tooltip : '';
    this.tooltipText = textBlock.tooltipText;
    this.angle = textBlock.angle != null ? textBlock.angle : 0;
    this.anchor = textBlock.anchor !== undefined ? textBlock.anchor : null;
    this.truncated = !!textBlock.truncated;
  }

  /**
   * Calculate the bounding box surrounding a single line of text. Works
   * properly only for a horizontal line (i.e. angle == 0). Returns null if the
   * line is empty.
   * @param textLine The text line.
   * @return the bounding box.
   */
  calcLineBoundingBox(textLine: Line): Box | null {
    asserts.assert(
      this.angle == null || this.angle === 0,
      'Can only calculate the bounding box of axis aligned texts (angle is 0)',
    );
    const anchor = this.anchor ? this.anchor : {x: 0, y: 0};

    const xStartEnd = getAbsoluteCoordinates(
      textLine.x + anchor.x,
      textLine.length,
      this.paralAlign,
    );
    const yStartEnd = getAbsoluteCoordinates(
      textLine.y + anchor.y,
      this.textStyle.fontSize,
      this.perpenAlign,
    );

    if (
      xStartEnd.start === xStartEnd.end ||
      yStartEnd.start === yStartEnd.end
    ) {
      // If the line text is an empty string we wish to avoid a bogus bounding
      // box with 0 width/height (such a bogus BB would trick functions like
      // calcBoundingBox into giving wrong results).
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
   * Calculate the bounding box surrounding all lines of text. Works properly
   * only for horizontal text boxes (i.e. angle == 0).
   * @return the bounding box.
   */
  calcBoundingBox(): Box | null {
    const self = this;
    let linesBoundingBoxes: Box[];
    // Filter out null bounding boxes (happens when text line is empty).
    linesBoundingBoxes = this.lines
      .map((line) => {
        return self.calcLineBoundingBox(line);
      })
      .filter((x) => x != null) as Box[];
    return calcBoundingBox(linesBoundingBoxes);
  }

  /** Create a text block which will fit in a given rectangle. */
  static createToFit(
    text: string,
    textStyle: TextStyle,
    position: TextBlockPosition,
    boundingRect: GoogRect,
    textMeasureFunction: TextMeasureFunction,
    appendTooltips: boolean,
    optSideMargin?: number,
    optTopMargin?: number,
  ): TextBlock | null {
    const sideMargin = typeof optSideMargin === 'number' ? optSideMargin : 0;
    const topMargin = typeof optTopMargin === 'number' ? optTopMargin : 0;
    const textSize = textMeasureFunction(text, textStyle);
    const fits = textSize.fitsInside(boundingRect.getSize());
    const label: TextBlockType = {} as TextBlockType;
    let lines: string[] = [];
    const linePadding = 2;
    label.text = text;
    label.textStyle = textStyle;
    // TextBlockPosition === Top if Orientation === Horizontal
    let labelX;
    let labelY;
    if (position === TextBlockPosition.TOP) {
      labelX = Math.floor(boundingRect.getCenter().x);
      labelY = boundingRect.top + topMargin;
      label.paralAlign = TextAlign.CENTER;
      label.perpenAlign = TextAlign.START;
    } else if (position === TextBlockPosition.RIGHT) {
      labelX = boundingRect.left + boundingRect.width - sideMargin;
      labelY = Math.floor(boundingRect.getCenter().y);
      label.paralAlign = TextAlign.END;
      label.perpenAlign = TextAlign.CENTER;
    } else if (position === TextBlockPosition.BOTTOM) {
      labelX = Math.floor(boundingRect.getCenter().x);
      labelY = boundingRect.top + boundingRect.height - topMargin;
      label.paralAlign = TextAlign.CENTER;
      label.perpenAlign = TextAlign.END;
    } else if (position === TextBlockPosition.LEFT) {
      labelX = boundingRect.left + sideMargin;
      labelY = Math.floor(boundingRect.getCenter().y);
      label.paralAlign = TextAlign.START;
      label.perpenAlign = TextAlign.CENTER;
    } else {
      throw new Error('Invalid text block position.');
    }
    let tooltipText;
    if (!fits || textSize.width > boundingRect.width - sideMargin) {
      if (textSize.height < boundingRect.height) {
        // Maybe we can break or trim the text.
        const maxLines = boundingRect.height / (textSize.height + linePadding);
        const textLayout = textutils.calcTextLayout(
          textMeasureFunction,
          text,
          textStyle,
          boundingRect.width - sideMargin,
          maxLines,
        );
        lines = textLayout.lines;
        if (textLayout.needTooltip) {
          tooltipText = text;
          label.truncated = true;
        }
      } else if (boundingRect.height > textStyle.fontSize / 3) {
        // TODO(dlaliberte): Is fontSize / 3 too much of a hack for approximating
        // ellipsis height? If not...
        // Still enough height to draw ellipsis.
        tooltipText = text;
        lines = [messages.MSG_MISSING_TEXT_INDICATION];
        labelY = Math.floor(boundingRect.getCenter().y);
        label.perpenAlign = TextAlign.CENTER;
        label.truncated = true;
      } else {
        // We can't fit at all. Bail out.
        return null;
      }
    }

    label.lines = [];
    let y;
    if (lines.length) {
      y = 0;
      const leni = lines.length;
      for (let i = 0; i < leni; i++) {
        label.lines.push(
          new Line({x: 0, y, length: boundingRect.width, text: lines[i]}),
        );
        y += textSize.height; // TODO(dlaliberte) + 1?
      }
    } else {
      label.lines.push(new Line({x: 0, y: 0, length: textSize.width, text}));
    }
    label.angle = 0;
    label.anchor = new Coordinate(labelX, labelY);
    if (appendTooltips && tooltipText) {
      label.tooltipText = {
        hasHtmlContent: false,
        hasCustomContent: false,
        content: tooltipText,
      };
    }
    return new TextBlock(label);
  }
}
