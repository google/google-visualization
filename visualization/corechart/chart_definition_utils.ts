/**
 * @fileoverview This file provides utility functions for manipulating and
 * accessing a chart definition object.
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
import {Coordinate} from '@npm//@closure/math/coordinate';
import {Rect} from '@npm//@closure/math/rect';
import {
  ChartType,
  Orientation,
  SerieType,
  SeriesRelativeColor,
  TooltipTrigger,
} from '../../common/option_types';
import {Selection} from '../../common/selection';
import {Value} from '../../data/types';
import {Brush} from '../../graphics/brush';

import {MultiBrushPathSegments} from '../../graphics/multi_brush_path_segments';

import {
  DatumDefinition,
  PixelTransformation,
  SerieDefinition,
  StackingType,
} from '../../visualization/corechart/chart_definition_types';
import {ChartDefinition} from './chart_definition';

// tslint:disable:ban-types Migration

/**
 * Gets the brush of a given datum, or serie.pointBrush.
 *
 * @param datum The datum.
 * @param serie The serie containing the datum.
 * @return The brush of the datum.
 */
export function getDatumBrush(
  datum: DatumDefinition,
  serie: SerieDefinition,
): Brush {
  // TODO(dlaliberte) Should we:  goog.asserts.assert(serie.pointBrush)
  return (
    (datum.scaled && datum.scaled.brush) || datum.brush || serie.pointBrush
  );
}

/**
 * Gets the "incoming" line brush of a given datum, or serie.lineBrush.
 *
 * @param datum The datum.
 * @param serie The serie containing the datum.
 * @return The incoming line brush of the datum.
 */
export function getIncomingLineBrush(
  datum: DatumDefinition | null,
  serie: SerieDefinition,
): Brush {
  assert(serie.lineBrush != null);
  //   TS2322: Type 'Brush | null' is not assignable to type 'Brush'.
  return ((datum && datum.incomingLineBrush) || serie.lineBrush)!;
}

/**
 * Gets the "incoming" area brush of a given datum, or serie.areaBrush.
 *
 * @param datum The datum.
 * @param serie The serie containing the datum.
 * @return The incoming area brush of the datum.
 */
export function getIncomingAreaBrush(
  datum: DatumDefinition | null,
  serie: SerieDefinition,
): Brush {
  assert(serie.areaBrush != null);
  //   TS2322: Type 'Brush | null' is not assignable to type 'Brush'.
  return ((datum && datum.incomingAreaBrush) || serie.areaBrush)!;
}

/**
 * Checks if a given datum is null.
 * Please note that in certain cases (such as stacked area chart) we always put
 * aggregated calculations on every datum, even if it is null. We explicitly
 * specify the value as null is these cases.
 *
 * @param datum The datum.
 * @return Returns true if the datum is null.
 */
export function isDatumNull(datum: DatumDefinition | null): boolean {
  return !datum || datum.isNull;
}

/**
 * Checks if a given serie is path based (Line, Area or Scatter).
 *
 * @param serie The serie.
 * @return Returns true if the serie is path based.
 */
export function isSeriePathBased(serie: SerieDefinition): boolean {
  return (
    serie.type === SerieType.LINE ||
    serie.type === SerieType.AREA ||
    serie.type === SerieType.SCATTER
  );
}

/**
 * Checks if a given datum should be visible.
 * @param datum The datum.
 * @param serie The serie containing the datum.
 * @return Returns true if the datum should be visible.
 * @suppress {missingProperties} TODO(b/139559424): Remove this suppression
 */
export function isDatumVisible(
  datum: DatumDefinition,
  serie: SerieDefinition,
): boolean {
  return datum.visible != null ? datum.visible : serie.visiblePoints;
}

/**
 * A point is said to be 'lonely' when it is non-null and it doesn't have any
 * neighbors.
 * @param series The series containing the point.
 * @param pointIndex The index of the point.
 * @return Whether the point is lonely or not.
 */
export function isLonelyPoint(
  series: SerieDefinition,
  pointIndex: number,
): boolean {
  const point = series.points[pointIndex];
  const prevPoint = series.points[pointIndex - 1];
  const nextPoint = series.points[pointIndex + 1];
  const pointIsNull = !point || !point.scaled || point.isNull;
  const prevPointIsNull = !prevPoint || !prevPoint.scaled || prevPoint.isNull;
  const nextPointIsNull = !nextPoint || !nextPoint.scaled || nextPoint.isNull;
  return !pointIsNull && prevPointIsNull && nextPointIsNull;
}

/**
 * Gets the radius of a given point.
 * @param point The point.
 * @param serie The serie containing the point.
 * @return The radius of the point.
 * @suppress {missingProperties} TODO(b/139559424): Remove this suppression
 */
export function getPointRadius(
  point: DatumDefinition,
  serie: SerieDefinition,
): number {
  if (point.scaled && point.scaled.radius != null) {
    return point.scaled.radius;
  } else if (point.radius != null) {
    return point.radius;
  } else {
    return serie.pointRadius;
  }
}

/**
 * Gets the radius of the sensitivity area of a given point.
 * @param point The point.
 * @param serie The serie containing the point.
 * @return The radius of the sensitivity area of the point.
 * @suppress {missingProperties} TODO(b/139559424): Remove this suppression
 */
export function getPointSensitivityAreaRadius(
  point: DatumDefinition,
  serie: SerieDefinition,
): number {
  if (point.scaled && point.scaled.sensitivityAreaRadius != null) {
    return point.scaled.sensitivityAreaRadius;
  } else if (point.sensitivityAreaRadius != null) {
    return point.sensitivityAreaRadius;
  } else {
    return serie.pointSensitivityAreaRadius;
  }
}

/**
 * Gets the visible radius of a given point, including the stroke.
 *
 * @param point The point.
 * @param serie The serie containing the point.
 * @return The visible radius of the point.
 */
export function getPointTotalRadius(
  point: DatumDefinition,
  serie: SerieDefinition,
): number {
  const radius = getPointRadius(point, serie);
  const brush = getDatumBrush(point, serie);
  const visibleRadius = radius + brush.getVisibleStrokeWidth() / 2;
  return visibleRadius;
}

/**
 * Whether a tooltip is triggered by selection or not.
 * It may be triggered by focus as well.
 *
 * @param tooltipTrigger The tooltip trigger.
 * @return Returns true if a tooltip is triggered by selection.
 */
export function isTooltipTriggeredBySelection(
  tooltipTrigger: TooltipTrigger,
): boolean {
  return (
    tooltipTrigger === TooltipTrigger.SELECTION ||
    tooltipTrigger === TooltipTrigger.BOTH
  );
}

/**
 * Whether a tooltip is triggered by focus or not.
 * It may be triggered by selection as well, as long as there is no standing
 * selection.
 *
 * @param tooltipTrigger The tooltip trigger.
 * @param selection The current selection from the chart state.
 * @return Returns true if a tooltip is triggered by focus.
 */
export function isTooltipTriggeredByFocus(
  tooltipTrigger: TooltipTrigger,
  selection: Selection,
): boolean {
  return (
    tooltipTrigger === TooltipTrigger.FOCUS ||
    tooltipTrigger === TooltipTrigger.BOTH
  );
}

/**
 * Returns true if the labels of the series, when presented vertically, should
 * be reversed. We want this behavior when the chart is stacked and then
 * visually, the first serie is actually at the bottom.
 * This is true only for horizontal function charts which are stacked.
 *
 * @param chartDef The chart definition.
 * @return Should we reverse vertical series labels.
 */
export function reverseSeriesLabelsVertically(
  chartDef: ChartDefinition,
): boolean {
  return (
    chartDef.stackingType !== StackingType.NONE &&
    chartDef.chartType === ChartType.FUNCTION &&
    chartDef.orientation === Orientation.HORIZONTAL
  );
}

/**
 * Takes a path-based serie (Line, Area, Scatter) and returns a path object.
 * @param serie The serie (structure should conform with that of
 *     series[i]).
 * @param interpolateNulls Whether null data points are interpolated.
 * @return The path.
 */
export function createPathSegments(
  serie: SerieDefinition,
  interpolateNulls: boolean,
): MultiBrushPathSegments {
  const pathSegments = new MultiBrushPathSegments();
  // Whether all area data points are null (or serie has no points at all).
  let allPointsAreNull = true;
  // Whether current data point is first in its connected component - first in
  // serie or a concrete data point following a sequence of null data points.
  // If null values are interpolated the entire path is a single component,
  // making this flag true only for the first data point of the serie.
  let isFirstPointOfComponent = true;
  // First and previous data points which are not null.
  let firstConcretePoint = null;
  let previousConcretePoint = null;
  let previousScaledPoint = null;
  for (let i = 0; i < serie.points.length; i++) {
    const point = serie.points[i];
    if (
      !point ||
      !point.scaled ||
      point.scaled.x == null ||
      point.scaled.y == null
    ) {
      // Null data point detected, making the next data point first in its
      // component if nulls are not interpolated.
      // Also, if nulls are interpolated but all data points so far were nulls,
      // next data point is first of the serie.
      isFirstPointOfComponent = !interpolateNulls || allPointsAreNull;
      continue;
    }
    if (allPointsAreNull) {
      firstConcretePoint = i;
      allPointsAreNull = false;
    }
    const scaledPoint = point.scaled;
    assert(!isNaN(scaledPoint.x));
    assert(!isNaN(scaledPoint.y));
    const brush = getIncomingLineBrush(point, serie);
    if (isFirstPointOfComponent || brush === null) {
      pathSegments.move(scaledPoint.x, scaledPoint.y);
      isFirstPointOfComponent = false;
    } else {
      // This will not be the first point, so previousConcretePoint
      // must be a non-null number.
      assert(previousConcretePoint != null);
      if (previousConcretePoint == null) {
        throw new Error('previousConcretePoint is null');
      }
      const rightPoint = serie.points[previousConcretePoint]!;
      // When animating between curved and non-curved, the control points
      // will be missing from non-curved lines.
      if (serie.isCurved && rightPoint.rightControlPoint) {
        pathSegments.addCurve(
          brush,
          serie.points[previousConcretePoint]!.rightControlPoint!.x,
          serie.points[previousConcretePoint]!.rightControlPoint!.y,
          point.leftControlPoint!.x,
          point.leftControlPoint!.y,
          scaledPoint.x,
          scaledPoint.y,
        );
      } else {
        if (serie.stepped && previousScaledPoint) {
          // if stepped, move horizontally first then vertically
          pathSegments.addLine(brush, scaledPoint.x, previousScaledPoint.y);
          pathSegments.addLine(brush, scaledPoint.x, scaledPoint.y);
        } else {
          pathSegments.addLine(brush, scaledPoint.x, scaledPoint.y);
        }
      }
    }
    previousConcretePoint = i;
    previousScaledPoint = scaledPoint;
  }

  // Close the path if necessary.
  if (!allPointsAreNull && serie.isClosed) {
    // If nulls are interpolated we connect the last concrete point to the first
    // one. Otherwise we connect the last point to the first point only if both
    // are not null.
    assert(firstConcretePoint != null);
    const connectFrom = interpolateNulls
      ? previousConcretePoint
      : serie.points.length - 1;
    const connectTo = (interpolateNulls ? firstConcretePoint : 0)!;
    const toPoint = serie.points[connectTo];
    if (
      connectFrom != null &&
      connectTo != null &&
      serie.points[connectFrom] &&
      !isDatumNull(toPoint)
    ) {
      assert(toPoint != null);
      const brush = getIncomingLineBrush(toPoint, serie);
      assert(brush != null);
      if (serie.isCurved) {
        pathSegments.addCurve(
          brush,
          serie.points[connectFrom]!.rightControlPoint!.x,
          serie.points[connectFrom]!.rightControlPoint!.y,
          toPoint!.leftControlPoint!.x,
          toPoint!.leftControlPoint!.y,
          toPoint!.scaled!.x,
          toPoint!.scaled!.y,
        );
      } else {
        pathSegments.close(brush);
      }
    }
  }

  return pathSegments;
}

/**
 * Takes a stacked area serie and returns a path object for its top line.
 * @param serie The stacked area serie (structure should conform with that of
 *     series[i]).
 * @return The path of the top line.
 */
export function createPathSegmentsForStackedArea(
  serie: SerieDefinition,
): MultiBrushPathSegments {
  // Path of the top line.
  const pathSegments = new MultiBrushPathSegments();
  // Whether current data point is first in its connected component - first in
  // serie or a concrete data point following a sequence of null data points.
  let isFirstPointOfComponent = true;

  // Draw the top line.
  for (let i = 0; i < serie.points.length; i++) {
    const point = serie.points[i];
    const scaledPoint = point && point.scaled;
    if (
      isDatumNull(point) ||
      !scaledPoint ||
      scaledPoint.x == null ||
      scaledPoint.y == null
    ) {
      // Null data point detected, making the next one first in its component.
      isFirstPointOfComponent = true;
      continue;
    }
    if (!isFirstPointOfComponent) {
      // We are in the middle of a component - draw line to current point.
      const brush = getIncomingLineBrush(point, serie);
      assert(brush != null);
      pathSegments.addLine(
        brush,
        scaledPoint.continueToX,
        scaledPoint.continueToY,
      );
    }
    // If current point is a 'jump point' (see wikipedia), well, jump.
    // Also, if current point is first in its component we have to move there
    // regardless of it being a jump point or not.
    if (
      isFirstPointOfComponent ||
      scaledPoint.continueToX !== scaledPoint.continueFromX ||
      scaledPoint.continueToY !== scaledPoint.continueFromY
    ) {
      pathSegments.move(scaledPoint.continueFromX, scaledPoint.continueFromY);
    }
    isFirstPointOfComponent = false;
  }

  return pathSegments;
}

/**
 * Returns the x physical location for a given data value on a specific
 * horizontal axis.
 * @param chartDef The chart definition.
 * @param hValue The value to convert.
 * @param hAxisIndex The axis index.
 * @return The screen coordinate relative to the chart's div.
 */
export function getXLocation(
  chartDef: ChartDefinition,
  hValue: Value | null,
  hAxisIndex?: number,
): number | null {
  const hAxes = chartDef.hAxes;
  const axis = hAxes && hAxes[hAxisIndex || 0];
  return axis && axis.position.fromValue(hValue);
}

/**
 * Returns the y physical location for a given data value on a specific vertical
 * axis.
 * @param chartDef The chart definition.
 * @param vValue The value to convert.
 * @param vAxisIndex The axis index.
 * @return The screen coordinate relative to the chart's div.
 */
export function getYLocation(
  chartDef: ChartDefinition,
  vValue: Value | null,
  vAxisIndex?: number,
): number | null {
  const vAxes = chartDef.vAxes;
  const axis = vAxes && vAxes[vAxisIndex || 0];
  return axis && axis.position.fromValue(vValue);
}

/**
 * Returns the logical value on a horizontal axis given an x-location and the
 * axis index.
 * @param chartDef The chart definition.
 * @param xLocation The location to convert.
 * @param hAxisIndex The axis index.
 * @return The value of the axis at the given point.
 */
export function getHAxisValue(
  chartDef: ChartDefinition,
  xLocation: number,
  hAxisIndex?: number,
): AnyDuringMigration {
  const hAxes = chartDef.hAxes;
  const axis = hAxes && hAxes[hAxisIndex || 0];
  return axis && axis.position.toValue(xLocation);
}

/**
 * Returns the logical value on a vertical axis given a y-location and the axis
 * index.
 * @param chartDef The chart definition.
 * @param yLocation The location to convert.
 * @param vAxisIndex The axis index.
 * @return The value of the axis at the given point.
 */
export function getVAxisValue(
  chartDef: ChartDefinition,
  yLocation: number,
  vAxisIndex?: number,
): AnyDuringMigration {
  const vAxes = chartDef.vAxes;
  const axis = vAxes && vAxes[vAxisIndex || 0];
  return axis && axis.position.toValue(yLocation);
}

/**
 * Returns the array of ticks in the H axis.
 * @param chartDef The chart definition.
 * @param hAxisIndex The axis index.
 * @return The set of ticks.
 */
export function getHAxisTicks(
  chartDef: ChartDefinition,
  hAxisIndex?: number,
): number[] {
  const hAxes = chartDef.hAxes;
  const axis = hAxes && hAxes[hAxisIndex || 0];
  const ticksData = axis.gridlines;
  const tickValues: number[] = [];
  for (let i = 0; i < ticksData.length; i++) {
    tickValues.push(Number(ticksData[i].dataValue));
  }
  return tickValues;
}

/**
 * Returns the array of ticks in the V axis.
 * @param chartDef The chart definition.
 * @param vAxisIndex The axis index.
 * @return The set of ticks.
 */
export function getVAxisTicks(
  chartDef: ChartDefinition,
  vAxisIndex?: number,
): Array<number | null> {
  const vAxes = chartDef.vAxes;
  const axis = vAxes && vAxes[vAxisIndex || 0];
  const ticksData = axis.gridlines;
  const tickValues: Array<number | null> = [];
  for (let i = 0; i < ticksData.length; i++) {
    tickValues.push(ticksData[i].dataValue as number | null);
  }
  return tickValues;
}

/**
 * Given a point and a radius, return the datum that is closest to that point
 * and also within the radius given.
 * TODO: refactor with detectHoveredPoint ../../events/axis_chart_event_handler.ts
 * @param chartDef The chart definition.
 * @param x The x coordinate to check.
 * @param y The y coordinate to check.
 * @param r The radius to search.
 * @return The datum associated with the given point.
 */
export function getPointDatum(
  chartDef: ChartDefinition,
  x: number,
  y: number,
  r: number,
): {row: number; col?: number} | null {
  const series = chartDef.series;
  let match = null;
  let dist = Infinity;
  let distance;
  const testPoint = new Coordinate(x, y);
  for (let i = 0, leni = series.length; i < leni; i++) {
    const singleSeries = series[i];
    if (singleSeries.isVirtual) {
      continue;
    }
    const singleSeriesReal = singleSeries as unknown as PixelTransformation;
    if (chartDef.chartType === 'pie') {
      if (getPointDatumPie(singleSeriesReal, x, y, r)) {
        return {row: i, col: undefined};
      }
    } else {
      for (let j = 0, lenj = singleSeries.points.length; j < lenj; j++) {
        const pointObj = singleSeries.points[j];
        if (!pointObj || pointObj.scaled == null) {
          continue;
        }
        const point = pointObj.scaled;
        switch (singleSeries.type) {
          case 'line':
          // TODO(dlaliberte): Might have to do something if the user touches a
          // line, and not just a point on the chart.
          case 'bubbles':
          case 'scatter':
            // Maybe use: adjustedRadius = r + (point.radius || 0);
            distance = Coordinate.distance(
              testPoint,
              point as unknown as Coordinate,
            );
            if (distance < r && distance < dist) {
              match = {col: j, row: i};
              dist = distance;
            }
            break;
          case 'candlesticks':
          case 'boxplot':
          case 'bars':
            let box = null;
            if (singleSeries.type === 'bars') {
              box = new Rect(point.left, point.top, point.width, point.height);
            } else if (
              singleSeries.type === 'candlesticks' ||
              singleSeries.type === 'boxplot'
            ) {
              const line = point.line;
              // Construct a box that includes the candlestick / boxplot and the
              // bar.
              const boxTop = Math.min(point.rect.top, line!.top);
              box = new Rect(
                point.rect.left,
                boxTop,
                point.rect.width,
                Math.max(
                  Number(point.rect.top) + Number(point.rect.height),
                  Number(line!.top) + Number(line!.height),
                ) - boxTop,
              );
            }
            distance = getPointDatumBox(box as Rect, testPoint, r);

            if (distance && distance < dist) {
              match = {col: j, row: i};
              dist = distance;
            }
            break;
          default:
            throw new Error('Unknown chart type for getPointDatum.');
        }
      }
      if (dist === 0) {
        break;
      }
    }
  }
  return match;
}

/**
 * Determines if a given point is within a box, or close to the box within a
 * given radius.
 * @param box The box to test against.
 * @param point The point to test.
 * @param r The radius to search.
 * @return The distance the point is from the box, or null if it's too far away.
 */
export function getPointDatumBox(
  box: Rect,
  point: Coordinate,
  r: number,
): number | null {
  // determine the distance between the box and the point. distance will
  // be 0 if the point is in the box.
  const distance = box.distance(point);
  if (distance > r) {
    return null;
  }
  return distance;
}

/**
 * Determines if a given point is within a pie chart slice, or if it's just
 * outside of it but still within a given radius.
 * @param singleSeries The series for the slice.
 * @param x The x coordinate to check.
 * @param y The y coordinate to check.
 * @param r The radius to search.
 * @return True if the point is within the pie chart slice.
 */
export function getPointDatumPie(
  singleSeries: PixelTransformation,
  x: number,
  y: number,
  r: number,
): boolean {
  assert(
    singleSeries.innerFromPixel.toString() ===
      singleSeries.innerToPixel.toString(),
    'getPointDatumPie cannot handle donut holes yet.',
  );

  // Calculate the vectors of the edges of the pie slice we're looking at.
  const vectorTo = {
    x: singleSeries.innerToPixel.x - singleSeries.toPixel.x,
    y: singleSeries.innerToPixel.y - singleSeries.toPixel.y,
  };
  const vectorFrom = {
    x: singleSeries.innerFromPixel.x - singleSeries.fromPixel.x,
    y: singleSeries.innerFromPixel.y - singleSeries.fromPixel.y,
  };

  // Calculate the vector of the point we're testing against.
  const vectorTestPoint = {
    x: singleSeries.innerFromPixel.x - x,
    y: singleSeries.innerFromPixel.y - y,
  };

  // If that point is clockwise from vectorTo, and counter-clockwise from
  // vectorFrom, we know the point lies within the pie slice.
  const clockwiseTo =
    -vectorTo.x * vectorTestPoint.y + vectorTo.y * vectorTestPoint.x > 0;
  const counterClockwiseFrom =
    -vectorTestPoint.x * vectorFrom.y + vectorTestPoint.y * vectorFrom.x > 0;
  if (clockwiseTo && counterClockwiseFrom) {
    // The point is between the two edges of the pie slice, so now we need
    // to calculate if it's close enough to be inside the pie plus the
    // tolerance radius.
    // TODO(dlaliberte): convert to use actual distance util in closure.
    const distance = Math.sqrt(
      Math.pow(singleSeries.innerToPixel.x - singleSeries.toPixel.x, 2) +
        Math.pow(singleSeries.innerToPixel.y - singleSeries.toPixel.y, 2),
    );
    const pointDistance = Math.sqrt(
      Math.pow(singleSeries.innerToPixel.x - x, 2) +
        Math.pow(singleSeries.innerToPixel.y - y, 2),
    );
    if (pointDistance < distance + r) {
      // The point is within the radius of the circle plus the tolerance.
      return true;
    }
  }
  return false;
}

/**
 * Transforms a serie relative color to an absolute color. If it is a value
 * that is part of the SeriesRelativeColor enum, it returns
 * the correct color from serieColor construct, otherwise it returns the given
 * string, assuming it is a color.
 * @param colorString The string representation of the color string (can also be
 *     relative to the serie).
 * @param serieColor An object representing the serie color structure. May be
 *     null.
 * @return The resolved string representation of the absolute color.
 */
export function resolveSerieRelativeColor(
  colorString: string | SeriesRelativeColor,
  serieColor: AnyDuringMigration | null,
): string {
  const color = (serieColor || {}) as {
    color: string;
    light: string;
    dark: string;
  };
  switch (colorString) {
    case SeriesRelativeColor.DARK:
      return color.dark;
    case SeriesRelativeColor.LIGHT:
      return color.light;
    case SeriesRelativeColor.COLOR:
      return color.color;
    default:
      return colorString;
  }
}
