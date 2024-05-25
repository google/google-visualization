/**
 * @fileoverview Utilities for defining a color bar.
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

import {Rect as GoogRect} from '@npm//@closure/math/rect';
import * as numberformat from '../format/numberformat';
import {Brush, Gradient} from '../graphics/brush';
import {TextMeasureFunction} from '../text/text_measure_function';
import {TextStyle} from '../text/text_style';

import * as definition from './definition';
import {Scale} from './scale';
import * as types from './types';

const NumberFormat = numberformat.NumberFormat;

/**
 * Builds a color bar definition object that describes all the building blocks
 * needed for drawing the color bar.
 *
 * @param colorScale A color scale logical representation.
 * @param drawingOptions Color bar drawing options.
 * @param markers An array of markers descriptors to place above the color
 *     gradient.
 * @param textMeasureFunction The function to use for measuring text width.
 * @return A a color bar definition object that describes all the building
 *     blocks needed for drawing the color bar.
 */
export function define(
  colorScale: Scale,
  drawingOptions: types.Options,
  markers: types.Marker[],
  textMeasureFunction: TextMeasureFunction,
): definition.Definition | null {
  // Color bar drawing rectangle.
  let drawingRect;
  let extremeValuesTextSize: definition.TextProperties;
  const numberFormat =
    drawingOptions.numberFormat || NumberFormat.DECIMAL_PATTERN;
  // TODO(eilaty): Handle vertical orientation.
  if (drawingOptions.orientation === types.Orientation.HORIZONTAL) {
    extremeValuesTextSize = calculateExtremeValuesTextProperties(
      colorScale,
      drawingOptions.textStyle,
      numberFormat,
      textMeasureFunction,
    );
    // The space in pixels between the text and the and the drawing rectangle.
    /**
     * @suppress {strictMissingProperties} Auto-added to unblock
     * check_level=STRICT
     */
    const textDrawingRectBuffer = extremeValuesTextSize.minValue.height / 4;
    // The drawing rectangle defines the space to draw the color gradient and
    // the markers in. When want to show text in the color bar visualization,
    // we need to make this space smaller, start with an offset and reduce the
    // width, in order to leave space to the text.
    /**
     * @suppress {strictMissingProperties} Auto-added to unblock
     * check_level=STRICT
     */
    const drawingRectStartOffset =
      extremeValuesTextSize.minValue.width + textDrawingRectBuffer;
    // The width of the drawing rectangle is computed as the total size of the
    // color bar, minus the extreme values text width and needed space.
    /**
     * @suppress {strictMissingProperties} Auto-added to unblock
     * check_level=STRICT
     */
    const drawingRectWidth =
      drawingOptions.width -
      (extremeValuesTextSize.minValue.width +
        extremeValuesTextSize.maxValue.width +
        2 * textDrawingRectBuffer);
    // Color bar drawing rectangle.
    drawingRect = new GoogRect(
      drawingRectStartOffset,
      0,
      drawingRectWidth,
      drawingOptions.height,
    );
  } else {
    // Don't show extreme values text, drawing rectangle takes all the spaces.
    drawingRect = new GoogRect(
      0,
      0,
      drawingOptions.width,
      drawingOptions.height,
    );
    // extremeValuesTextSize not used for vertical orientation.
    extremeValuesTextSize = {} as definition.TextProperties;
  }
  // A marker triangle height. Calculated relatively to the drawing rectangle
  // height, using a fixed ratio.
  const markerHeight = drawingRect.height * MARKER_HEIGHT_RATIO;
  // A marker triangle edge size. Calculated relatively to the marker height
  // as an edge of an equilateral triangle.
  const markerEdge = 2 * (markerHeight / Math.sqrt(3));
  // Calculate colors gradient rectangle.
  const colorsGradientDrawingRect = new GoogRect(
    drawingRect.left + markerEdge / 2,
    drawingRect.top + markerHeight + 1,
    drawingRect.width - markerEdge,
    drawingRect.height - markerHeight - 1,
  );
  // Build color gradient rectangles definitions.
  const colorGradientRectanglesDefinitions = defineColorsGradient(
    colorScale,
    colorsGradientDrawingRect,
  );
  if (
    colorGradientRectanglesDefinitions != null &&
    colorGradientRectanglesDefinitions.length > 0 &&
    (colorGradientRectanglesDefinitions[0].rectangle.width < 0 ||
      colorGradientRectanglesDefinitions[0].rectangle.height < 0)
  ) {
    return null;
  }
  // Build markers definitions.
  const markersDefinitions = defineMarkers(
    colorScale,
    drawingRect,
    markers,
    markerHeight,
    markerEdge,
    drawingOptions.markerColor,
  );

  // Build text items definitions.
  let textItemsDefinitions: definition.TextItemDefinition[] = [];
  if (drawingOptions.orientation === types.Orientation.HORIZONTAL) {
    textItemsDefinitions = defineTextItems(
      drawingOptions,
      extremeValuesTextSize,
    );
  }
  const colorBarDefinition = {
    colorGradientRectanglesDefinitions,
    markersDefinitions,
    textItemsDefinitions,
  };
  trasformOrientationAndPosition(colorBarDefinition, drawingOptions);
  return colorBarDefinition;
}

/**
 * The ratio to used when dividing the color bar area between the colors
 * gradient and the markers strip.
 */
export const MARKER_HEIGHT_RATIO = 0.33;

/**
 * Adds colors gradient definitions according to a color bar definition object
 * according to the coordinates stated in the given drawing rectangle. The
 * colors spreads are defined according to the values in the associated color
 * bar.
 * @param colorScale A color scale logical representation.
 * @param colorsGradientDrawingRect The rectangle to draw the colors gradient
 *     into.
 * @return An array of rectangles and brushes used for drawing the colors
 *     gradient.
 */
function defineColorsGradient(
  colorScale: Scale,
  colorsGradientDrawingRect: GoogRect,
): definition.ColorGradientRectangleDefinition[] {
  // Create a group that will contain all the colors gradient elements.
  const colorsScale = colorScale.getColorsScale();
  const valuesScale = colorScale.getValuesScale();
  // Calculate the ratio used to make the transformation from a section in
  // scale values to a section in the colors gradient.
  const valuesRange = valuesScale![valuesScale!.length - 1] - valuesScale![0];
  let colorGradientRectanglesDefinitions;
  if (valuesRange === 0) {
    // For an empty range, we have a uni-color rectangle.
    colorGradientRectanglesDefinitions = [
      {
        rectangle: new GoogRect(
          colorsGradientDrawingRect.left,
          colorsGradientDrawingRect.top,
          colorsGradientDrawingRect.width,
          colorsGradientDrawingRect.height,
        ),
        brush: new Brush({fill: colorsScale[0]}),
      },
    ];
  } else {
    colorGradientRectanglesDefinitions = [];
    const rectBarRatio = colorsGradientDrawingRect.width / valuesRange;
    // Build the color gradient by placing together rectangles colored by
    // gradient brushes. The size of each rectangle is in proportion to its
    // part in the values range.
    let leftBound: number = colorsGradientDrawingRect.left;
    let rightBound = 0;
    for (let i = 0; i < valuesScale!.length - 1; ++i) {
      rightBound =
        leftBound + (valuesScale![i + 1] - valuesScale![i]) * rectBarRatio;
      colorGradientRectanglesDefinitions[i] = {
        // Adding color gradient rectangle definition.
        rectangle: new GoogRect(
          leftBound,
          colorsGradientDrawingRect.top,
          rightBound - leftBound,
          colorsGradientDrawingRect.height,
        ), // Adding color gradient brush definition.
        brush: new Brush({
          gradient: {
            x1: leftBound,
            y1: 0,
            x2: rightBound,
            y2: 0,
            color1: colorsScale[i],
            color2: colorsScale[i + 1],
          } as Gradient,
        }),
      };
      leftBound = rightBound;
    }
  }
  return colorGradientRectanglesDefinitions;
}

/**
 * Builds a marker definition object that describes the building blocks for
 * drawing the given marker.
 * @param colorScale A color scale logical representation.
 * @param drawingRect The color bar drawing rectangle.
 * @param markers The markers objects array to build definition to.
 * @param markerHeight marker triangle height.
 * @param markerEdge marker triangle edge size.
 * @param markerColor The color of the markers.
 * @return An array of paths and brushes used for drawing the markers.
 */
function defineMarkers(
  colorScale: Scale,
  drawingRect: GoogRect,
  markers: types.Marker[] | null,
  markerHeight: number,
  markerEdge: number,
  markerColor: string,
): definition.MarkerDefinition[] {
  const markersDefinitions = [];
  for (let i = 0; i < markers!.length; ++i) {
    // Create the marker triangle path.
    const markerAbsolutCenterPosition =
      drawingRect.left +
      getValuePosition(markers![i].value, colorScale, drawingRect, markerEdge) +
      markerEdge / 2;
    const markerPath = [
      markerAbsolutCenterPosition - markerEdge / 2,
      drawingRect.top,
      markerAbsolutCenterPosition + markerEdge / 2,
      drawingRect.top,
      markerAbsolutCenterPosition,
      drawingRect.top + markerHeight,
    ];
    // Create marker brush.
    const markerBrush = new Brush({fill: markerColor, stroke: markerColor});
    markersDefinitions[i] = {path: markerPath, brush: markerBrush};
  }
  return markersDefinitions;
}

/**
 * Gets the position on the color bar (relative to the color bar left) that
 * represents the given value.
 * @param value The value to find the position for.
 * @param colorScale A color scale logical representation.
 * @param drawingRect The color bar drawing rectangle.
 * @param markerEdge marker triangle edge size.
 * @return The position on the color bar.
 */
function getValuePosition(
  value: number,
  colorScale: Scale,
  drawingRect: GoogRect,
  markerEdge: number,
): number {
  const valuesScale = colorScale.getValuesScale();
  if (value < valuesScale![0]) {
    return 0;
  }
  const colorsGradientWidth = drawingRect.width - markerEdge;
  if (value > valuesScale![valuesScale!.length - 1]) {
    return colorsGradientWidth;
  }
  const valuesRange = valuesScale![valuesScale!.length - 1] - valuesScale![0];
  if (valuesRange === 0) {
    return colorsGradientWidth * 0.5;
  } else {
    return colorsGradientWidth * ((value - valuesScale![0]) / valuesRange);
  }
}

/**
 * Performs a transformation of the definition from horizontal orientation to
 * vertical orientation if needed, and moves the color bar to the desired
 * position. The transformation is basically:
 * If horizontal: (x,y) <- (x,y) + (left, top).
 * If vertical: (x,y) <- (y,x) + (left, top).
 * @param colorBarDef The definition object to transform.
 * @param drawingOptions The options object that holds the desired position and
 *     orientation for the color bar.
 */
function trasformOrientationAndPosition(
  colorBarDef: definition.Definition,
  drawingOptions: types.Options,
) {
  const colorGradientRectanglesDefinitions =
    colorBarDef.colorGradientRectanglesDefinitions;
  for (let i = 0; i < colorGradientRectanglesDefinitions.length; ++i) {
    const colorGradientRectangle = colorGradientRectanglesDefinitions[i];
    if (drawingOptions.orientation === types.Orientation.VERTICAL) {
      // Transform rectangle (top,left) <- (left,top),
      // (width, height) <- (height, width).
      const left = colorGradientRectangle.rectangle.left;
      colorGradientRectangle.rectangle.left =
        colorGradientRectangle.rectangle.top;
      colorGradientRectangle.rectangle.top = left;
      const width = colorGradientRectangle.rectangle.width;
      colorGradientRectangle.rectangle.width =
        colorGradientRectangle.rectangle.height;
      colorGradientRectangle.rectangle.height = width;
    }
    // Move rectangle to required offset.
    // TODO(dlaliberte): maybe use useObjectBoundingBoxUnits option.
    colorGradientRectangle.rectangle.left += drawingOptions.left;
    colorGradientRectangle.rectangle.top += drawingOptions.top;
    const brush = colorGradientRectangle.brush.clone();
    colorGradientRectangle.brush = brush; // don't touch the original
    const brushGradient = brush.getGradient();
    if (drawingOptions.orientation === types.Orientation.VERTICAL) {
      // Transform gradient brush (y1, y2) <- (x1, x2), (x1, x2) <- (0, 0)
      // and move to offset.
      brushGradient!.y1 = brushGradient!.x1;
      brushGradient!.x1 = 0;
      brushGradient!.y2 = brushGradient!.x2;
      brushGradient!.x2 = 0;
    }
    if (brushGradient != null) {
      brushGradient.x1 = Number(brushGradient.x1) + drawingOptions.left;
      brushGradient.y1 = Number(brushGradient.y1) + drawingOptions.top;
      brushGradient.x2 = Number(brushGradient.x2) + drawingOptions.left;
      brushGradient.y2 = Number(brushGradient.y2) + drawingOptions.top;
    }
  }
  // Transform markers, for every point in a path (x, y) <- (y, x).
  const markersDefinitions = colorBarDef.markersDefinitions;
  for (let i = 0; i < markersDefinitions.length; ++i) {
    for (let j = 0; j < 3; ++j) {
      if (drawingOptions.orientation === types.Orientation.VERTICAL) {
        const x = markersDefinitions[i].path[j * 2];
        markersDefinitions[i].path[j * 2] =
          markersDefinitions[i].path[j * 2 + 1];
        markersDefinitions[i].path[j * 2 + 1] = x;
      }
      markersDefinitions[i].path[j * 2] += drawingOptions.left;
      markersDefinitions[i].path[j * 2 + 1] += drawingOptions.top;
    }
  }
  // Move text items.
  const textItemsDefinitions = colorBarDef.textItemsDefinitions;
  for (let i = 0; i < textItemsDefinitions.length; ++i) {
    textItemsDefinitions[i].x += drawingOptions.left;
    textItemsDefinitions[i].y += drawingOptions.top;
  }
}

/**
 * Calculates the value and size of the color bar end values text
 * representation, according to the given textStyle and measure function.
 * @param colorScale A color scale logical representation.
 * @param textStyle The text style.
 * @param numberPattern The pattern to use for formatting numbers.
 * @param textMeasureFunction The function to use for measuring text width.
 * @return The text strings and sizes of the color bar min and max values.
 */
function calculateExtremeValuesTextProperties(
  colorScale: Scale,
  textStyle: TextStyle,
  numberPattern: string,
  textMeasureFunction: TextMeasureFunction,
): definition.TextProperties {
  const colorBarMinValue = colorScale.getValuesScale()![0];
  const colorBarMaxValue =
    colorScale.getValuesScale()![colorScale.getValuesScale()!.length - 1];
  const numberFormatter = new NumberFormat({'pattern': numberPattern});
  const colorBarMinValueText = numberFormatter.formatValue(colorBarMinValue);
  const colorBarMaxValueText = numberFormatter.formatValue(colorBarMaxValue);
  return {
    minValue: {
      text: colorBarMinValueText,
      width: textMeasureFunction
        ? textMeasureFunction(colorBarMinValueText, textStyle).width
        : 0,
      height: textStyle.fontSize,
    },
    maxValue: {
      text: colorBarMaxValueText,
      width: textMeasureFunction
        ? textMeasureFunction(colorBarMaxValueText, textStyle).width
        : 0,
      height: textStyle.fontSize,
    },
  };
}

/**
 * Builds definition object for all needed text items in the color bar.
 * Note: Currently we define text items only for the color bar extreme values,
 * but this will probably change in the future.
 * @param drawingOptions The options object that holds the desired position and
 *     orientation for the color bar.
 * @param extremeValuesTextSize returned form calculateExtremeValuesTextSize_
 *     contains the text size of the color bar values scale extreme values.
 * @return An array of definition object for text items to be applied on the
 *     color bar.
 */
function defineTextItems(
  drawingOptions: types.Options,
  extremeValuesTextSize: definition.TextProperties,
): definition.TextItemDefinition[] {
  /** An Array of text item definitions. */
  const textItemsDefinitions: definition.TextItemDefinition[] = [];
  textItemsDefinitions[0] = {
    x: 0,
    y: drawingOptions.height - extremeValuesTextSize.minValue.height,
    text: extremeValuesTextSize.minValue.text,
    style: drawingOptions.textStyle,
  };
  textItemsDefinitions[1] = {
    x: drawingOptions.width - extremeValuesTextSize.maxValue.width,
    y: drawingOptions.height - extremeValuesTextSize.maxValue.height,
    text: extremeValuesTextSize.maxValue.text,
    style: drawingOptions.textStyle,
  };
  return textItemsDefinitions;
}
