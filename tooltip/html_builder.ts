/**
 * @fileoverview Utilities for defining and drawing html snippets.
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

import * as dom from '@npm//@closure/dom/dom';
import {Box} from '@npm//@closure/math/box';
import {Coordinate} from '@npm//@closure/math/coordinate';
import * as googMath from '@npm//@closure/math/math';
import {Size} from '@npm//@closure/math/size';
import {SafeHtml} from '@npm//@safevalues';
import * as util from '../graphics/util';
import {HtmlTooltipDefinition, Outline} from './tooltip_definition';
import {
  adjustTooltipHorizontally,
  adjustTooltipVertically,
} from './tooltip_utils';

/**
 * Draws a tooltip according to the given definition. Same as
 * gviz.util.tooltip.builder.draw but builds an html version.
 * @param tooltipDef The tooltip definition.
 * @param container The container into which the tooltip should be added.
 * @return The tooltip element.
 */
export function draw(
  tooltipDef: HtmlTooltipDefinition,
  container: Element,
): Element {
  const tooltip = createOverlayHtml(container, tooltipDef.html);
  const size = new Size(tooltip.clientWidth, tooltip.clientHeight);
  const topLeft = positionTooltip(
    tooltipDef.anchor,
    tooltipDef.pivot,
    tooltipDef.boundaries,
    tooltipDef.spacing,
    tooltipDef.margin,
    size,
  );
  // The following lines make sure the box dimensions do not change when moved.
  // TODO(dlaliberte): Adding 1 to the width prevents line breaking. Why? Beats me.
  tooltip.style.width = `${tooltip.clientWidth + 1}px`;
  tooltip.style.height = `${tooltip.clientHeight}px`;
  tooltip.style.left = `${topLeft.x}px`;
  tooltip.style.top = `${topLeft.y}px`;
  return tooltip;
}

/**
 * Positions a tooltip given its definition and size.
 * Tries to position the tooltip within the boundaries, prefers to the top
 * right (north east) of the point, but fallbacks with the precedence NE,
 * SE, NW, SW. After choosing direction tooltip is positioned in that direction
 * allowing it to be pushed back in the opposite direction just enough for it to
 * fit within the boundaries.
 * @param point The point the tooltip points to.
 * @param pivot The pivot signifying the direction in which to "push" the tooltip.
 * @param boundaries The chart boundaries.
 * @param spacing The spacing between the point and the tooltip.
 * @param margin The spacing between the boundaries and the tooltip.
 * @param size The tooltip size (given in pixels).
 * @return The top left corner of the tooltip.
 */
export function positionTooltip(
  point: Coordinate,
  pivot: Coordinate,
  boundaries: Box,
  spacing: number,
  margin: number,
  size: Size,
): Coordinate {
  // Calculate which directions are clear (there is enough space for a tooltip)
  const east = boundaries.right - point.x >= size.width + margin;
  const west = point.x - boundaries.left >= size.width + margin;
  const south = boundaries.bottom - point.y >= size.height + margin;
  const north = point.y - boundaries.top >= size.height + margin;

  // Calculate the dx and dy based on the relative position of the pivot to the
  // anchor. If these turn out to be zero, that would mean that the tooltip will
  // be centered, which we would rarely want.
  // TODO(dlaliberte): This currently conflicts with the customPivot signal, which
  // can be set to (0, 0). If it is, it will be ignored. This may be correct.
  let dx = Math.sign(point.x - pivot.x);
  let dy = Math.sign(point.y - pivot.y);

  // Choose direction pair (dx, dy), preferring the north east (dx = 1, dy = -1)
  // Open westward only if it is possible to open west and it is the only
  // possible direction (if opening to the south or to the north is possible
  // then east is always ok since pushing back a bit to the west will not cover
  // point - the tooltip is to the north or south of it).
  // Open southward only if there is no way to open north or east (east is true
  // means opening north is ok since puhing back a bit will never cover point).
  if (dx === 0 && dx === dy) {
    dx = west && !east && !south && !north ? -1 : 1;
    dy = north || east ? -1 : 1;
  }

  // Use the (dx,dy) vector to position tooltip center.
  const cx = point.x + (spacing + size.width / 2) * dx;
  const cy = point.y + (spacing + size.height / 2) * dy;

  // Make sure it fits within the boundaries.

  const outline: Outline = {
    box: new Box(
      cy - size.height / 2,
      cx + size.width / 2,
      cy + size.height / 2,
      cx - size.width / 2,
    ),
    handlePoints: null,
  };

  adjustTooltipHorizontally(outline, boundaries, pivot, margin, 0);
  adjustTooltipVertically(outline, boundaries, pivot, margin);

  return new Coordinate(outline.box.left, outline.box.top);
}

/**
 * Creates an html that is a layer above the graphics containing a given html
 * structure. The structure is given as a json object mirroring the desired
 * html dom tree.
 * @param container The dom container to place the tooltip in.
 * @param htmlStructure The html structure to create.
 * @return The created element.
 */
export function createOverlayHtml(
  container: Element,
  htmlStructure: SafeHtml,
): HTMLElement {
  const domHelper = dom.getDomHelper(container);
  const element = util.createDom(domHelper, htmlStructure) as HTMLElement;
  container.appendChild(element);
  return element;
}
