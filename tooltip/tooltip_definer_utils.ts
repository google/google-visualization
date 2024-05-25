/**
 * @fileoverview Utilities for defining tooltips.
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
import {Coordinate} from '@npm//@closure/math/coordinate';
import {Line} from '@npm//@closure/math/line';
import * as googMath from '@npm//@closure/math/math';
import {Size} from '@npm//@closure/math/size';
import {GOLDEN_RATIO} from '../common/constants';
import {Brush} from '../graphics/brush';
import {TextMeasureFunction} from '../text/text_measure_function';
import {TextStyle} from '../text/text_style';
import {DEFAULT_MARGINS} from './defs';
import * as htmldefiner from './html_definer';
import * as tooltipDefinition from './tooltip_definition';
import * as util from './tooltip_utils';

/**
 * Information about the size of a body line.
 * See diagram in calcLineSize for more information.
 */
interface LineSize {
  width: number;
  height: number;
  topMargin: number;
}

/**
 * Information about the size of a body item.
 * The margins indicate the number of pixels to the left/top of the item that
 * must be left empty.
 */
interface ItemSize {
  width: number;
  height: number;
  topMargin: number;
  leftMargin: number;
}

/** Radius of tooltip corners. */
export const CORNER_RADIUS = 4;

/** Color of the separator. */
export const SEPARATOR_COLOR = '#eee';

/** Width of the separator in pixels. */
export const SEPARATOR_WIDTH = 1;

/**
 * Creates a BodyEntry object containing a single text item, with an optional
 * title item, and an optional color code square item.
 * @param text The text.
 * @param style The text style.
 * @param titleText An optional title text.
 * @param titleStyle The title text style.
 * @param color Optional color code to add to the line.
 * @param opacity The opacity of the fill, 1 by default.
 * @param prefixText Optional prefix text to add to the line.
 * @param isHtml Optional, specifies if this tooltip is HTML.
 * @param id Optional line ID. Only used if the line is interactive, in which case it will be used as the entity name.
 * @return body The newly created body line entry.
 */
export function createBodyTextLineEntry(
  text: string | null | undefined,
  style: TextStyle,
  titleText?: string | null,
  titleStyle?: TextStyle | null,
  color?: string | null,
  opacity?: number | null,
  prefixText?: string | null,
  isHtml?: boolean,
  id?: string | null,
): tooltipDefinition.BodyEntry {
  const data: tooltipDefinition.BodyLine = {
    items: [],
  } as unknown as tooltipDefinition.BodyLine;

  // Adds a color square at the beginning of the line if requested.
  if (color != null) {
    const squareItem = createBodySquareItem(
      style.fontSize / 2,
      Brush.createFillBrush(color, opacity),
    );
    data.items.push(squareItem);
  }

  // Adds prefix text if requested.
  if (prefixText != null) {
    const prefixTextItem = createBodyTextItem(prefixText, style);
    data.items.push(prefixTextItem);
  }

  // Adds the title if requested.
  if (titleText != null && titleText !== '') {
    if (titleStyle == null) {
      throw new Error('Line title is specified without a text style.');
    }
    const textItem = createBodyTextItem(`${titleText}:`, titleStyle);
    data.items.push(textItem);
  }

  // Adds the text item.
  const textItem = createBodyTextItem(text, style, isHtml);
  data.items.push(textItem);

  if (id != null) {
    data.id = id;
    // Adds a transparent background to the line.
    data.background = {brush: new Brush(Brush.TRANSPARENT_BRUSH)};
  }

  return {
    type: tooltipDefinition.BodyEntryType.LINE,
    data,
  } as unknown as tooltipDefinition.BodyEntry;
}

/**
 * Creates a custom line for a tooltip.
 * @param items The array of items that should be created.
 * @return body The newly created body line entry.
 */
export function createCustomBodyTextLineEntry(
  items: Array<{text: string; html?: boolean; style: TextStyle}>,
): tooltipDefinition.BodyEntry {
  const data: tooltipDefinition.BodyLine = {
    items: items.map((item) => {
      if (item.text != null) {
        return createBodyTextItem(item.text, item.style, item.html);
      } else {
        throw new Error('Unrecognized item.');
      }
    }),
  } as unknown as tooltipDefinition.BodyLine;
  return {
    type: tooltipDefinition.BodyEntryType.LINE,
    data,
  } as unknown as tooltipDefinition.BodyEntry;
}

/**
 * Syntactic sugar to create a separator entry for the tooltip body.
 * @return The created separator entry.
 */
export function createBodySeparatorEntry(): tooltipDefinition.BodyEntry {
  return {
    type: tooltipDefinition.BodyEntryType.SEPARATOR,
    data: {brush: Brush.createStrokeBrush(SEPARATOR_COLOR, SEPARATOR_WIDTH)},
  } as unknown as tooltipDefinition.BodyEntry;
}

/**
 * Syntactic sugar to create a text item for the tooltip body.
 * @param text The text.
 * @param style The text style.
 * @param customHtml Whether the text is custom HTML.
 * @return The created body item.
 */
export function createBodyTextItem(
  text: string | null | undefined,
  style: TextStyle,
  customHtml = false,
): tooltipDefinition.BodyItem {
  const bodyItem = {
    type: tooltipDefinition.BodyItemType.TEXT,
    data: {text: text || '', style},
    html: customHtml,
  };
  return bodyItem as unknown as tooltipDefinition.BodyItem;
}

/**
 * Syntactic sugar to create a square item for the tooltip body.
 * @param size The square size.
 * @param brush The square brush.
 * @return The created body item.
 */
export function createBodySquareItem(
  size: number,
  brush: Brush,
): tooltipDefinition.BodyItem {
  return {
    type: tooltipDefinition.BodyItemType.SQUARE,
    data: {size, brush},
  } as unknown as tooltipDefinition.BodyItem;
}

/**
 * Creates a tooltip definition given body and an anchor.
 * The body consists of lines, each line containing multiple items (e.g., text).
 * Caller can choose if he wants to attach a handle to the tooltip or not.
 * If a handle is requested the anchor is the tip of the handle. Otherwise, it
 * is the nearest corner of the tooltip.
 * Another parameter is the pivot point. A tooltip will attempt to open away
 * from the pivot point. If it exceeds the permitted boundaries this way, the
 * tooltip will be flipped in relation to the given pivot.
 * Note that if your body is text-free then you must provide a default base unit
 * in defaultBaseUnit. See calcBaseUnit for more details.
 * @param body The body (items inside the tooltip).
 * @param textMeasureFunction The function to use for measuring text width.
 * @param attachHandle Should the tooltip have a handle.
 * @param anchor The anchor (explanation above).
 * @param boundaries The permitted tooltip boundaries.
 * @param pivot The pivot (explanation above).
 * @param defaultBaseUnit A default base unit (explanation above).
 * @param isHtml whether to use an html tooltop (default false).
 * @param rtl Whether the text is right-to-left.
 * @param boxStyle The Brush to use for the tooltip box.
 * @return The tooltip definition.
 */
export function createTooltipDefinition(
  body: tooltipDefinition.Body,
  textMeasureFunction: TextMeasureFunction,
  attachHandle: boolean,
  anchor: Coordinate,
  boundaries: Box,
  pivot: Coordinate,
  defaultBaseUnit?: number,
  isHtml?: boolean,
  rtl?: boolean,
  boxStyle?: Brush | null,
): tooltipDefinition.TooltipDefinition {
  if (isHtml) {
    return htmldefiner.createTooltipDefinition(
      body,
      textMeasureFunction,
      attachHandle,
      boundaries,
      anchor,
      pivot,
    );
  } else {
    const baseUnit = calcBaseUnit(body, defaultBaseUnit);
    const tooltipSize = calcTooltipSize(body, baseUnit, textMeasureFunction);
    const outline = calcTooltipOutline(
      attachHandle,
      anchor,
      tooltipSize,
      baseUnit,
      boundaries,
      pivot,
    );
    const bodyLayout = calcTooltipBodyLayout(
      outline,
      body,
      baseUnit,
      textMeasureFunction,
      rtl,
    );
    boxStyle =
      boxStyle || new Brush({fill: 'white', stroke: '#ccc', strokeWidth: 1});
    return {boxStyle, outline, bodyLayout};
  }
}

/**
 * Calculates the base unit that will be used for the following calculations:
 * 1. Minimal width of the tooltip (2*baseUnit).
 * 2. Margins, i.e. space between text and outline (baseUnit / golden ratio).
 * 3. The size of the tooltip handle (if exists).
 * The base unit is set to be the maximum font size specified in the tooltip
 * body, or defaultBaseUnit if the body is text-free.
 * @param body The body (items inside the tooltip).
 * @param defaultBaseUnit A default base unit.
 * @return The base unit.
 */
function calcBaseUnit(
  body: tooltipDefinition.Body,
  defaultBaseUnit?: number,
): number {
  let fontSize = 0;

  // Calculate the maximum font size specified in the tooltip body.
  for (let i = 0; i < body.entries.length; i++) {
    const entry = body.entries[i];
    if (entry.type !== tooltipDefinition.BodyEntryType.LINE) {
      continue;
    }
    const line = entry.data as tooltipDefinition.BodyLine;
    for (let j = 0; j < line.items.length; j++) {
      const item = line.items[j];
      if (item.type === tooltipDefinition.BodyItemType.TEXT) {
        fontSize = Math.max(
          fontSize,
          (item.data as tooltipDefinition.TextItem).style.fontSize,
        );
      }
    }
  }

  // If we didn't find a text item return the default base unit.
  if (fontSize === 0) {
    defaultBaseUnit = defaultBaseUnit || 0;
    return defaultBaseUnit;
  }

  return fontSize;
}

/**
 * Calculates the size of the tooltip (width and height).
 * The tooltip handle is ignored (if the tooltip has one).
 * @param body The body (items inside the tooltip).
 * @param baseUnit The base unit (see calcBaseUnit).
 * @param textMeasureFunction The function to use for measuring text width.
 * @return The tooltip size (width and height) rounded to the nearest integer.
 */
export function calcTooltipSize(
  body: tooltipDefinition.Body,
  baseUnit: number,
  textMeasureFunction: TextMeasureFunction,
): Size {
  let width = 0;
  let height = 0;

  for (let i = 0; i < body.entries.length; i++) {
    const entry = body.entries[i];
    switch (entry.type) {
      case tooltipDefinition.BodyEntryType.LINE:
        const line = entry.data as tooltipDefinition.BodyLine;
        const lineSize = calcLineSize(line, textMeasureFunction);
        height += lineSize.height + (i > 0 ? lineSize.topMargin : 0);
        width = Math.max(width, lineSize.width);
        break;

      case tooltipDefinition.BodyEntryType.SEPARATOR:
        // 1 unit above the separator and 0.5 unit below it.
        const separator = entry.data as tooltipDefinition.BodySeparator;
        height += 1.5 * baseUnit + separator.brush.getStrokeWidth();
        break;

      default:
        asserts.fail('Invalid tooltip entry type "' + entry.type + '"');
    }
  }

  // Minimum of 2 * baseUnit.
  width = Math.max(width, 2 * baseUnit);

  // The total size is determined by the text size plus the margin on each side.
  const totalWidth = Math.round(width + (2 * baseUnit) / GOLDEN_RATIO);
  const totalHeight = Math.round(height + (2 * baseUnit) / GOLDEN_RATIO);

  return new Size(totalWidth, totalHeight);
}

/**
 * Calculates the size of a line in the body of the tooltip (width, height, and
 * top margins).
 *
 * Some visual aid:
 *
 *            |x     x    xx            |
 * Line n-1   |x     x                  |
 *            |xxxxxxx                  |
 *            +=========================+  -+  -+
 * Top margin |                         |   |   | topMargin
 *            +=========================+   |  -+            -+
 *            |x     x                  |   |                 |
 *            |xx    x                  |   | marginHelper    |
 * Our line   |x x   x    xx            |   |                 |
 *    (n)     +-------------------------+  -+                 | height
 *            |x   x x    xx            |                     |
 *            |x    xx                  |                     |
 *            |x     x                  |                     |
 *            +=========================+                    -+
 *
 * @param line The body line.
 * @param textMeasureFunction The function to use for measuring text width.
 * @return The line size.
 */
function calcLineSize(
  line: tooltipDefinition.BodyLine,
  textMeasureFunction: TextMeasureFunction,
): LineSize {
  let width = 0;
  let height = 0;
  let marginHelper = 0;

  for (let i = 0; i < line.items.length; i++) {
    const item = line.items[i];
    const itemSize = calcItemSize(item, textMeasureFunction);
    width += itemSize.width + (i > 0 ? itemSize.leftMargin : 0);
    height = Math.max(height, itemSize.height);

    // We want to make sure that the top margins of the line are big enough so
    // that each item, when vertically centered in the line, will have enough
    // space for its own top margins.
    marginHelper = Math.max(
      marginHelper,
      itemSize.height / 2 + itemSize.topMargin,
    );
  }

  const topMargin = marginHelper - height / 2;
  return {width, height, topMargin};
}

/**
 * Calculates the size of an item in the body of the tooltip (width and height).
 * @param item The body item.
 * @param textMeasureFunction The function to use for measuring text width.
 * @return The item size.
 */
function calcItemSize(
  item: tooltipDefinition.BodyItem,
  textMeasureFunction: TextMeasureFunction | null,
): ItemSize {
  switch (item.type) {
    case tooltipDefinition.BodyItemType.TEXT: {
      const textItem = item.data as tooltipDefinition.TextItem;
      return calcTextItemSize(
        textItem.text,
        textItem.style,
        textMeasureFunction,
      );
    }
    case tooltipDefinition.BodyItemType.SQUARE: {
      const size = (item.data as tooltipDefinition.SquareItem).size;
      const margin = size;
      return {width: size, height: size, topMargin: margin, leftMargin: margin};
    }
    default:
      throw new Error(`Invalid tooltip item type "${item.type}"`);
  }
}

/**
 * Calculates the size of a text item in the tooltip (width and height).
 * @param text The text.
 * @param style The text style.
 * @param textMeasureFunction The function to use for measuring text width.
 * @return The item size.
 */
function calcTextItemSize(
  text: string,
  style: TextStyle,
  textMeasureFunction: TextMeasureFunction | null,
): ItemSize {
  return {
    width: textMeasureFunction
      ? textMeasureFunction(String(text), style).width
      : 0,
    height: style.fontSize,
    topMargin: style.fontSize / (2 * GOLDEN_RATIO),
    leftMargin: style.fontSize / (2 * GOLDEN_RATIO),
  };
}

/**
 * Calculates the body layout.
 * @param outline The tooltip outline.
 * @param body The body (items inside the tooltip).
 * @param baseUnit The base unit (see calcBaseUnit).
 * @param textMeasureFunction The function to use for measuring text width.
 * @param rtl Whether the text is right-to-left.
 * @return The body layout.
 */
export function calcTooltipBodyLayout(
  outline: tooltipDefinition.Outline,
  body: tooltipDefinition.Body,
  baseUnit: number,
  textMeasureFunction: TextMeasureFunction,
  rtl?: boolean,
): tooltipDefinition.BodyLayout {
  const bodyLayout = {} as unknown as tooltipDefinition.BodyLayout;

  // Tooltip body items must be a certain distance from the tooltip outline.
  const outlineInnerMargin = baseUnit / GOLDEN_RATIO;
  const bodyBoundingBox = new Box(
    outline.box.top + outlineInnerMargin,
    outline.box.right - outlineInnerMargin,
    outline.box.bottom - outlineInnerMargin,
    outline.box.left + outlineInnerMargin,
  );

  const entriesLayout = [];
  // The top of the current entry.
  let entryTop = bodyBoundingBox.top;

  const entriesLen = body.entries.length;
  let entryIndex;

  // Decides whether columns must be aligned.
  let alignColumns = false;
  for (entryIndex = 0; entryIndex < entriesLen; entryIndex++) {
    if (body.entries[entryIndex].alignColumns) {
      alignColumns = true;
      break;
    }
  }

  // Compute maximum width of items in each column, to be used
  // for correct alignment of items in multiple lines.
  // Also memoize matrix with items size to avoid recomputation.
  const maximumItemsWidthInColumn: number[] = [];
  const itemSizeMatrix = [];
  for (entryIndex = 0; entryIndex < entriesLen; entryIndex++) {
    const entry = body.entries[entryIndex];
    if (entry.type === tooltipDefinition.BodyEntryType.LINE) {
      const line = entry.data as tooltipDefinition.BodyLine;
      // Creates new array for current line items, and stores in matrix.
      const lineItemsSize: ItemSize[] = [];
      itemSizeMatrix.push(lineItemsSize);
      // For each item, computes its size, stores its size in a
      // matrix and updates the maximum size for that particular column.
      for (
        let itemIndex = 0, lenItems = line.items.length;
        itemIndex < lenItems;
        itemIndex++
      ) {
        // Computes size for this item.
        const item = line.items[itemIndex];
        const itemSize = calcItemSize(item, textMeasureFunction);
        // Stores item size in the current line.
        lineItemsSize.push(itemSize);
        // Updates/creates maximum size found in this itemIndex.
        if (entry.alignColumns) {
          if (itemIndex > maximumItemsWidthInColumn.length - 1) {
            maximumItemsWidthInColumn.push(itemSize.width);
          } else {
            const oldItemWidth = maximumItemsWidthInColumn[itemIndex];
            maximumItemsWidthInColumn[itemIndex] = Math.max(
              oldItemWidth,
              itemSize.width,
            );
          }
        }
      }
    }
  }

  // Computes matrix with margin for items alignment in multiple lines.
  const lineWidthMargin = [];
  const itemWidthMargin = [];
  let lineIndex = 0;
  if (alignColumns) {
    for (entryIndex = 0; entryIndex < entriesLen; entryIndex++) {
      const entry = body.entries[entryIndex];
      if (entry.type === tooltipDefinition.BodyEntryType.LINE) {
        // Creates new line for item margins, and stores in matrix.
        const lineItemsMargin: number[] = [];
        itemWidthMargin.push(lineItemsMargin);
        let sumOfItemsMargins = 0;

        if (entry.alignColumns) {
          const line = entry.data as tooltipDefinition.BodyLine;
          // Computes the margin as difference between maximum size in each
          // column and the corresponding item's size.
          for (
            let itemIndex = 0, lenItems = line.items.length;
            itemIndex < lenItems;
            itemIndex++
          ) {
            const itemSize = itemSizeMatrix[lineIndex][itemIndex];
            const maximumItemWidth = maximumItemsWidthInColumn[itemIndex];
            const margin = maximumItemWidth - itemSize.width;
            lineItemsMargin.push(margin);
            sumOfItemsMargins += margin;
          }
        }
        lineWidthMargin.push(sumOfItemsMargins);
        lineIndex++;
      }
    }
  }

  // Calculate the layout of each line.
  lineIndex = 0;
  for (entryIndex = 0; entryIndex < entriesLen; entryIndex++) {
    const entry = body.entries[entryIndex];
    const entryLayout = {entry, data: {}};

    switch (entry.type) {
      case tooltipDefinition.BodyEntryType.LINE:
        const line = entry.data as tooltipDefinition.BodyLine;
        const lineLayout = entryLayout.data as tooltipDefinition.BodyLineLayout;

        const lineSize = calcLineSize(line, textMeasureFunction);
        if (entry.alignColumns) {
          lineSize.width += lineWidthMargin[lineIndex];
        }

        let lineTop = entryTop;
        // Skip top margin to reach top coordinate of current line.
        if (entryIndex > 0) {
          lineTop += lineSize.topMargin;
        }

        if (line.background) {
          lineLayout.background = {
            // The background bounding box starts half the margin above the line
            // and finishes half the margin beneath it.
            box: new Box(
              lineTop - lineSize.topMargin / 2,
              outline.box.right,
              lineTop + lineSize.height + lineSize.topMargin,
              outline.box.left,
            ),
          };
        }

        const itemsLayout: tooltipDefinition.BodyItemLayout[] = [];
        // Left of the current item (left margin is left of this coordinate).
        let itemLeft = bodyBoundingBox.left;
        for (
          let itemIndex = 0, lenItems = line.items.length;
          itemIndex < lenItems;
          itemIndex++
        ) {
          const itemLayout = {} as unknown as tooltipDefinition.BodyItemLayout;

          const itemSize = itemSizeMatrix[lineIndex][itemIndex];
          if (entry.alignColumns) {
            itemSize.width += itemWidthMargin[lineIndex][itemIndex];
          }

          // Skip left margin to reach left coordinate of current item.
          if (itemIndex > 0) {
            itemLeft += itemSize.leftMargin;
          }

          // Vertically center the item in relation to the line.
          const itemTop = lineTop + (lineSize.height - itemSize.height) / 2;

          // The bounding box of the current item.
          itemLayout.box = new Box(
            Math.round(itemTop),
            Math.round(itemLeft + itemSize.width),
            Math.round(itemTop + itemSize.height),
            Math.round(itemLeft),
          );
          if (rtl) {
            const textXOffset = itemLayout.box.left - bodyBoundingBox.left;
            const targetX = bodyBoundingBox.right - textXOffset;
            const xDiff = targetX - itemLayout.box.left - itemSize.width;
            itemLayout.box.left += xDiff;
            itemLayout.box.right += xDiff;
          }

          // Add item to layout.
          itemsLayout.push(itemLayout);

          // Advance left coordinate to right of current item.
          itemLeft += itemSize.width;
        }

        lineLayout.items = itemsLayout;

        // Advance top coordinate to bottom of current line.
        entryTop = lineTop + lineSize.height;

        lineIndex++;
        break;

      case tooltipDefinition.BodyEntryType.SEPARATOR:
        const separator = entry.data as tooltipDefinition.BodySeparator;
        const separatorLayout =
          entryLayout.data as tooltipDefinition.BodySeparatorLayout;

        const separatorY =
          entryTop + baseUnit + separator.brush.getStrokeWidth() / 2;
        separatorLayout.line = new Line(
          outline.box.left,
          separatorY,
          outline.box.right,
          separatorY,
        );

        entryTop += 1.5 * baseUnit + separator.brush.getStrokeWidth() / 2;
        break;

      default:
        asserts.fail('Invalid tooltip entry type "' + entry.type + '"');
    }

    entriesLayout.push(entryLayout);
  }
  bodyLayout.entries =
    entriesLayout as unknown as tooltipDefinition.BodyEntryLayout[];
  bodyLayout.rtl = !!rtl;

  return bodyLayout;
}

/**
 * Calculates the tooltip outline which includes the handle exact location and
 * the text bounding box.
 * @param attachHandle Should the tooltip have a handle.
 * @param anchor The anchor (@see createTooltipDefinition).
 * @param tooltipSize The tooltip size (width and height).
 * @param baseUnit The base unit (see calcBaseUnit).
 * @param boundaries The permitted tooltip boundaries.
 * @param pivot The pivot (@see createTooltipDefinition).
 * @return The tooltip outline.
 */
export function calcTooltipOutline(
  attachHandle: boolean,
  anchor: Coordinate,
  tooltipSize: Size,
  baseUnit: number,
  boundaries: Box,
  pivot: Coordinate,
): tooltipDefinition.Outline {
  // The tooltip attempts to open away from the pivot.
  const hDirection = googMath.sign(anchor.x - pivot.x);
  const vDirection = googMath.sign(anchor.y - pivot.y);

  // Center of the main tooltip box.
  let center = null;
  if (attachHandle) {
    // See specification of the tooltip outline in the "Canonical Chart Design"
    // document by raess@.
    center = new Coordinate(
      anchor.x + hDirection * baseUnit,
      anchor.y + vDirection * (baseUnit + tooltipSize.height / 2),
    );
  } else {
    center = new Coordinate(
      anchor.x + (hDirection * tooltipSize.width) / 2,
      anchor.y + (vDirection * tooltipSize.height) / 2,
    );
  }

  const left = center.x - tooltipSize.width / 2;
  const right = left + tooltipSize.width;
  const top = center.y - tooltipSize.height / 2;
  const bottom = top + tooltipSize.height;

  const outline = {} as unknown as tooltipDefinition.Outline;

  if (attachHandle) {
    // y is distanced baseUnit from the anchor and height/2 from the center.
    const closePoint = new Coordinate(
      center.x,
      googMath.lerp(
        anchor.y,
        center.y,
        baseUnit / (baseUnit + tooltipSize.height / 2),
      ),
    );
    // x is distanced baseUnit from the center, away from the anchor.
    const farPoint = new Coordinate(
      googMath.lerp(center.x, anchor.x, -1),
      closePoint.y,
    );
    closePoint.x = Math.round(closePoint.x);
    closePoint.y = Math.round(closePoint.y);
    farPoint.x = Math.round(farPoint.x);
    farPoint.y = Math.round(farPoint.y);
    // The handlePoints are orderer clockwise.
    if (hDirection * vDirection === 1) {
      outline.handlePoints = [closePoint, anchor, farPoint];
    } else {
      outline.handlePoints = [farPoint, anchor, closePoint];
    }
  }

  outline.box = new Box(
    Math.round(top),
    Math.round(right),
    Math.round(bottom),
    Math.round(left),
  );

  // If the tooltip does not fit in the chart, attempt adjusting its position.
  // Horizontal and vertical adjustments are independent of each other.
  util.adjustTooltipHorizontally(
    outline,
    boundaries,
    pivot,
    DEFAULT_MARGINS,
    CORNER_RADIUS,
  );
  util.adjustTooltipVertically(outline, boundaries, pivot, DEFAULT_MARGINS);

  return outline as unknown as tooltipDefinition.Outline;
}
