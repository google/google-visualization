/**
 * @fileoverview Utilities for drawing a color bar.
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

import {AbstractRenderer} from '../graphics/abstract_renderer';
import {DrawingGroup} from '../graphics/drawing_group';
import {PathSegments} from '../graphics/path_segments';
import {TextAlign} from '../text/text_align';

import * as definition from './definition';

/**
 * Given a color bar definition, this function renders all it's building blocks
 * inside the given drawing group, using the given renderer.
 *
 * @param colorBarDef A a color bar definition object.
 * @param renderer Renderer to use for drawing.
 * @param drawingGroup A group to draw the color bar into.
 */
export function draw(
  colorBarDef: definition.Definition,
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
) {
  // Render the color gradient on the lower part of the color bar.
  drawColorGradient(
    colorBarDef.colorGradientRectanglesDefinitions,
    renderer,
    drawingGroup,
  );
  // Render the markers above the color gradient.
  drawMarkers(colorBarDef.markersDefinitions, renderer, drawingGroup);
  // Render text items.
  drawTextItems(colorBarDef.textItemsDefinitions, renderer, drawingGroup);
}

/**
 * Draw a color gradient according to the rectangles and brushes building
 * blocks.
 * @param colorGradientRectanglesDefinitions The rectangles and colors used for
 *     drawing the color gradient.
 * @param renderer Renderer to use for drawing.
 * @param drawingGroup A group to draw the color bar into.
 */
function drawColorGradient(
  colorGradientRectanglesDefinitions: definition.ColorGradientRectangleDefinition[],
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
) {
  for (let i = 0; i < colorGradientRectanglesDefinitions.length; ++i) {
    renderer.drawRect(
      colorGradientRectanglesDefinitions[i].rectangle.left,
      colorGradientRectanglesDefinitions[i].rectangle.top,
      colorGradientRectanglesDefinitions[i].rectangle.width,
      colorGradientRectanglesDefinitions[i].rectangle.height,
      colorGradientRectanglesDefinitions[i].brush,
      drawingGroup,
    );
  }
}

/**
 * Create a triangle according to the given coordinates and fill it using
 * the given brush.
 * @param markersDefinitions The paths and colors used for drawing the markers.
 * @param renderer Renderer to use for drawing.
 * @param drawingGroup A group to draw the color bar into.
 */
function drawMarkers(
  markersDefinitions: definition.MarkerDefinition[],
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
) {
  for (let i = 0; i < markersDefinitions.length; ++i) {
    const path = new PathSegments();
    path.move(markersDefinitions[i].path[0], markersDefinitions[i].path[1]);
    path.addLine(markersDefinitions[i].path[2], markersDefinitions[i].path[3]);
    path.addLine(markersDefinitions[i].path[4], markersDefinitions[i].path[5]);
    path.close();
    renderer.drawPath(path, markersDefinitions[i].brush, drawingGroup);
  }
}

/**
 * Render text items in the drawing group in the desired locations.
 * @param textItemsDefinitions An array of definitions objects specifying how to
 *     render text items over the color bar.
 * @param renderer Renderer to use for drawing.
 * @param drawingGroup A group to draw the color bar into.
 */
function drawTextItems(
  textItemsDefinitions: definition.TextItemDefinition[],
  renderer: AbstractRenderer,
  drawingGroup: DrawingGroup,
) {
  for (let i = 0; i < textItemsDefinitions.length; ++i) {
    // Note: we use width=1 because this is good enough for the renderer, as
    // long as the horizontal alignment remains START.
    renderer.drawText(
      textItemsDefinitions[i].text,
      textItemsDefinitions[i].x,
      textItemsDefinitions[i].y,
      1, // See note above.
      TextAlign.START,
      TextAlign.START,
      textItemsDefinitions[i].style,
      drawingGroup,
    );
  }
}
