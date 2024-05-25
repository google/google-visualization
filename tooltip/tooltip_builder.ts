/**
 * @fileoverview Utilities for defining and drawing tooltips.
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
import {AbstractRenderer} from '../graphics/abstract_renderer';
import {DrawingGroup} from '../graphics/drawing_group';
import {PathSegments} from '../graphics/path_segments';
import {TextAlign} from '../text/text_align';
import {Token, generateId} from '../visualization/corechart/id_utils';
import {
  BodyEntryType,
  BodyItemType,
  BodyLine,
  BodyLineLayout,
  BodySeparator,
  BodySeparatorLayout,
  NativeTooltipDefinition,
  Outline,
  SquareItem,
  TextItem,
} from './tooltip_definition';

/** Radius of tooltip corners. */
const CORNER_RADIUS = 1;

/** Radius of nightingale tooltip corners. */
const NIGHTINGALE_CORNER_RADIUS = 2;

/**
 * Draws a tooltip according to the given definition.
 * @param tooltipDef The tooltip definition.
 * @param renderer The renderer.
 * @param drawingGroup The drawing group.
 * @return The group containing the tooltip.
 */
export function draw(
  tooltipDef: NativeTooltipDefinition,
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
): DrawingGroup {
  const group = create(tooltipDef, renderer);
  renderer.appendChild(drawingGroup, group);
  return group;
}

/**
 * Creates a tooltip according to the given definition.
 * @param tooltipDef The tooltip definition.
 * @param renderer The renderer.
 * @return The group containing the tooltip.
 */
export function create(
  tooltipDef: NativeTooltipDefinition,
  renderer: AbstractRenderer,
): DrawingGroup {
  const group = renderer.createGroup();
  // goog.dom.classlist.add cannot safely be used on SVG elements due to issues
  // on IE 11. See b/111425835 for details.
  group.getElement().setAttribute('class', 'google-visualization-tooltip');
  drawTooltipOutline(tooltipDef, renderer, group);
  drawTooltipBody(tooltipDef, renderer, group);
  return group;
}

/**
 * Creates a tooltip according to the given definition.
 * @param tooltipDef The tooltip definition.
 * @param renderer The renderer.
 * @return The group containing the tooltip.
 */
export function createNightingale(
  tooltipDef: NativeTooltipDefinition,
  renderer: AbstractRenderer,
): DrawingGroup {
  const group = renderer.createGroup();
  drawNightingaleTooltipOutline(tooltipDef, renderer, group);
  drawTooltipBody(tooltipDef, renderer, group);
  return group;
}

/**
 * Draws the tooltip outline in the nightingale style given the layout.
 * @param tooltipDef The tooltip definition.
 * @param renderer The renderer.
 * @param drawingGroup The drawing group.
 */
function drawNightingaleTooltipOutline(
  tooltipDef: NativeTooltipDefinition,
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
) {
  const path = createOutlinePath(tooltipDef.outline, NIGHTINGALE_CORNER_RADIUS);
  const shadowBrush = tooltipDef.boxStyle;
  renderer.drawPath(path, shadowBrush, drawingGroup);
}

/**
 * Draws the tooltip outline given the layout.
 * @param tooltipDef The tooltip definition.
 * @param renderer The renderer.
 * @param drawingGroup The drawing group.
 */
function drawTooltipOutline(
  tooltipDef: NativeTooltipDefinition,
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
) {
  const path = createOutlinePath(tooltipDef.outline, CORNER_RADIUS);
  const shadowBrush = tooltipDef.boxStyle;
  renderer.drawPath(path, shadowBrush, drawingGroup);
}

/**
 * Draws the tooltip body.
 * @param tooltipDef The tooltip definition.
 * @param renderer The renderer.
 * @param drawingGroup The drawing group.
 */
function drawTooltipBody(
  tooltipDef: NativeTooltipDefinition,
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
) {
  const bodyLayout = tooltipDef.bodyLayout;
  // Draw the body items.
  for (let i = 0; i < bodyLayout.entries.length; i++) {
    const entryLayout = bodyLayout.entries[i];
    const entry = entryLayout.entry;

    const entryDrawingGroup = renderer.createGroup();
    renderer.appendChild(drawingGroup, entryDrawingGroup);

    switch (entry.type) {
      case BodyEntryType.LINE:
        const line = entry.data as BodyLine;
        const lineLayout = entryLayout.data as BodyLineLayout;

        // Draw the background first. All the items are drawn on top of it.
        if (lineLayout.background) {
          renderer.drawRect(
            lineLayout.background.box.left,
            lineLayout.background.box.top,
            lineLayout.background.box.right - lineLayout.background.box.left,
            lineLayout.background.box.bottom - lineLayout.background.box.top,
            line.background!.brush,
            entryDrawingGroup,
          );
        }
        // Now draw the other line items.
        for (let j = 0; j < lineLayout.items.length; j++) {
          const item = line.items[j];
          const itemLayout = lineLayout.items[j];
          switch (item.type) {
            case BodyItemType.TEXT:
              // Note: we use width=1 because this is good enough for the
              // renderer, as long as the horizontal alignment remains START.
              const textItem = item.data as TextItem;
              renderer.drawText(
                textItem.text,
                bodyLayout.rtl ? itemLayout.box.right : itemLayout.box.left,
                itemLayout.box.top,
                1, // See note above.
                TextAlign.START,
                TextAlign.START,
                textItem.style,
                entryDrawingGroup,
                bodyLayout.rtl,
              );
              break;
            case BodyItemType.SQUARE:
              const squareItem = item.data as SquareItem;
              const box = itemLayout.box;
              renderer.drawRect(
                box.left,
                box.top,
                box.right - box.left,
                box.bottom - box.top,
                squareItem.brush,
                entryDrawingGroup,
              );
              break;
            default:
              asserts.fail(`Invalid tooltip item type "${item.type}"`);
          }
        }

        // If the line has an ID, hang events on it (this is what the ID is
        // for).
        if (line.id != null) {
          // TODO(dlaliberte): The tooltip builder should not be aware of actions.
          const lineID = generateId([
            Token.ACTIONS_MENU_ENTRY,
            line.id as Token,
          ]);
          renderer.setLogicalName(entryDrawingGroup, lineID);
        }
        break;

      case BodyEntryType.SEPARATOR:
        const separator = entry.data as BodySeparator;
        const separatorLayout = entryLayout.data as BodySeparatorLayout;

        const separatorPath = new PathSegments();
        separatorPath.move(separatorLayout.line.x0, separatorLayout.line.y0);
        separatorPath.addLine(separatorLayout.line.x1, separatorLayout.line.y1);
        renderer.drawPath(separatorPath, separator.brush, entryDrawingGroup);
        break;

      default:
        asserts.fail(`Invalid tooltip entry type "${entry.type}"`);
    }
  }
}

/**
 * Creates a bubble outline path given the layout.
 * @param outline The tooltip outline.
 * @param cornerRadius The radius of the round corners.
 * @return The created path.
 */
function createOutlinePath(
  outline: Outline,
  cornerRadius: number,
): PathSegments {
  const path = new PathSegments();
  // Adding 0.5 for crispness.
  const box = new Box(
    outline.box.top + 0.5,
    outline.box.right + 0.5,
    outline.box.bottom + 0.5,
    outline.box.left + 0.5,
  );
  const handlePoints = outline.handlePoints;

  // We first add the left side of the bubble.
  path.move(box.left + cornerRadius, box.bottom);
  path.addArc(
    box.left + cornerRadius,
    box.bottom - cornerRadius,
    cornerRadius,
    cornerRadius,
    180,
    270,
    true,
  );

  path.addLine(box.left, box.top + cornerRadius);
  path.addArc(
    box.left + cornerRadius,
    box.top + cornerRadius,
    cornerRadius,
    cornerRadius,
    270,
    0,
    true,
  );

  // If the handle is at the top, we need to add it now.
  if (handlePoints != null && handlePoints[0].y === outline.box.top) {
    for (let i = 0; i < 3; ++i) {
      // Adding 0.5 for crispness.
      path.addLine(handlePoints[i].x + 0.5, handlePoints[i].y + 0.5);
    }
  }

  // We now add the right side of the bubble.
  path.addLine(box.right - cornerRadius, box.top);
  path.addArc(
    box.right - cornerRadius,
    box.top + cornerRadius,
    cornerRadius,
    cornerRadius,
    0,
    90,
    true,
  );

  path.addLine(box.right, box.bottom - cornerRadius);
  path.addArc(
    box.right - cornerRadius,
    box.bottom - cornerRadius,
    cornerRadius,
    cornerRadius,
    90,
    180,
    true,
  );

  // If the handle is at the bottom, we need to add it now.
  if (handlePoints != null && handlePoints[0].y === outline.box.bottom) {
    for (let i = 0; i < 3; ++i) {
      // Adding 0.5 for crispness.
      path.addLine(handlePoints[i].x + 0.5, handlePoints[i].y + 0.5);
    }
  }

  path.close();
  return path;
}
