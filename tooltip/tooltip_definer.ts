/**
 * @fileoverview This file provides the TooltipDefiner class which generates
 * the tooltips for the canonical visualizations.
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
import * as googMath from '@npm//@closure/math/math';
import {Vec2} from '@npm//@closure/math/vec2';
import * as googObject from '@npm//@closure/object/object';
import {
  AggregationTarget,
  AxisType,
  ChartType,
  Orientation,
  SerieType,
  TooltipTrigger,
} from '../common/option_types';
import {Options} from '../common/options';
import {Value} from '../data/types';
import {DEFAULT_MARGINS} from './defs';
import * as tooltipDefinerUtils from './tooltip_definer_utils';

import {sanitizeHtml} from 'google3/third_party/javascript/safevalues';
import {SafeHtml, createHtml} from 'safevalues';
import {DynamicLoading} from '../loader/dynamic_loading';
import * as vectorutils from '../math/vector_utils';
import {TextBlock} from '../text/text_block_object';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import * as chartDefinitionTypes from '../visualization/corechart/chart_definition_types';
import * as chartDefinitionUtils from '../visualization/corechart/chart_definition_utils';
import * as htmldefiner from './html_definer';
import {TooltipBodyCreator} from './tooltip_body_creator';
import {
  InteractionState,
  Body as TooltipBody,
  TooltipDefinition,
} from './tooltip_definition';

/** Class used to build the Canonical Visualizations' tooltips. */
export class TooltipDefiner {
  /** The permitted tooltip boundaries. */
  private boundaries: Box;

  /** This is where we store the custom pivot. If we have one. */
  private readonly customPivot: Coordinate | null = null;

  /** What triggers the opening of a tooltip. */
  private readonly trigger: TooltipTrigger;

  /**
   * @param chartOptions The chart configuration options.
   * @param bodyCreator Tooltip body creator.
   *     A body creator provides the content of the tooltip,
   *     while the tooltip definer creates its outline and position.
   *     The bodyCreator is a strategy that can vary with, for example,
   *     interactivity model and chart type.
   * @param chartDimensions Width and height of the chart.
   */
  constructor(
    chartOptions: Options,
    private readonly bodyCreator: TooltipBodyCreator,
    chartDimensions: googMath.Size,
  ) {
    this.boundaries = new Box(
      0,
      chartDimensions.width,
      chartDimensions.height,
      0,
    );
    if (
      chartOptions.inferBooleanValue(
        ['tooltip.ignoreBounds.left', 'tooltip.ignoreBounds'],
        false,
      )
    ) {
      this.boundaries.left = -Infinity;
    } else {
      this.boundaries.left -= chartOptions.inferNumberValue(
        ['tooltip.bounds.left', 'tooltip.bounds'],
        0,
      );
    }
    if (
      chartOptions.inferBooleanValue(
        ['tooltip.ignoreBounds.top', 'tooltip.ignoreBounds'],
        false,
      )
    ) {
      this.boundaries.top = -Infinity;
    } else {
      this.boundaries.top -= chartOptions.inferNumberValue(
        ['tooltip.bounds.top', 'tooltip.bounds'],
        0,
      );
    }
    if (
      chartOptions.inferBooleanValue(
        ['tooltip.ignoreBounds.right', 'tooltip.ignoreBounds'],
        false,
      )
    ) {
      this.boundaries.right = Infinity;
    } else {
      this.boundaries.right += chartOptions.inferNumberValue(
        ['tooltip.bounds.right', 'tooltip.bounds'],
        0,
      );
    }
    if (
      chartOptions.inferBooleanValue(
        ['tooltip.ignoreBounds.bottom', 'tooltip.ignoreBounds'],
        false,
      )
    ) {
      this.boundaries.bottom = Infinity;
    } else {
      this.boundaries.bottom += chartOptions.inferNumberValue(
        ['tooltip.bounds.bottom', 'tooltip.bounds'],
        0,
      );
    }

    const customPivotX =
      chartOptions.inferOptionalNumberValue('tooltip.pivot.x');
    const customPivotY =
      chartOptions.inferOptionalNumberValue('tooltip.pivot.y');
    if (
      customPivotX != null &&
      typeof customPivotX === 'number' &&
      isFinite(customPivotX) &&
      customPivotY != null &&
      typeof customPivotY === 'number' &&
      isFinite(customPivotY)
    ) {
      this.customPivot = new Coordinate(customPivotX, customPivotY);
    }

    const defaultTooltipTrigger = bodyCreator.hasActionsMenu()
      ? TooltipTrigger.BOTH
      : TooltipTrigger.FOCUS;
    this.trigger = chartOptions.inferStringValue(
      'tooltip.trigger',
      defaultTooltipTrigger,
      TooltipTrigger,
    ) as TooltipTrigger;
  }

  /** @return The tooltip trigger. */
  getTrigger(): TooltipTrigger {
    return this.trigger;
  }

  /**
   * Returns the origin of the chart.
   * For AxisChart this is the intersection of the baselines.
   * For PieChart this is the center.
   * @param chartDefinition The chart definition.
   * @return The origin of the chart.
   */
  private calcChartOrigin(chartDefinition: ChartDefinition): Coordinate {
    if (chartDefinition.chartType === ChartType.PIE) {
      // TODO(dlaliberte): Is there a safer way to access the center?
      const center = chartDefinition.pie.center;
      return new Coordinate(center.x, center.y);
    }
    // This is an axis chart
    const hAxis = googObject.getAnyValue(chartDefinition.hAxes)!;
    const x =
      hAxis.baseline != null
        ? hAxis.baseline.coordinate
        : Math.min(hAxis.startPos, hAxis.endPos);
    const vAxis = googObject.getAnyValue(chartDefinition.vAxes)!;
    const y =
      vAxis.baseline != null
        ? vAxis.baseline.coordinate
        : Math.max(vAxis.startPos, vAxis.endPos);
    return new Coordinate(x, y);
    // TODO(dlaliberte): make sure this is the correct strategy for choosing baseline,
    // given there might be a few target axes.
  }

  /**
   * Sets the permitted tooltip boundaries.
   * @param boundaries The permitted tooltip boundaries.
   */
  setBoundaries(boundaries: Box) {
    this.boundaries = boundaries;
  }

  /**
   * Calculates the tooltip anchor for a point (line, area or scatter).
   * @param chartDefinition The chart definition.
   * @param pointData An object containing point properties.
   * @param serie The serie.
   * @return The tooltip anchor.
   */
  private calcPointTooltipAnchor(
    chartDefinition: ChartDefinition,
    pointData: chartDefinitionTypes.DatumDefinition,
    serie: chartDefinitionTypes.SerieDefinition,
  ): Coordinate {
    const scaledPoint = pointData.scaled!;
    const pointRadius = chartDefinitionUtils.getPointTotalRadius(
      pointData,
      serie,
    );
    const origin = this.calcChartOrigin(chartDefinition);
    // The tooltip should be located on the radius of the circle so we need
    // to take the center point and add/subtract to each coordinate
    // delta = radius / sqrt(2).
    // We add 1 to delta to have some space between the tooltip and the circle.
    const delta = 1 + Math.ceil(pointRadius / Math.sqrt(2));
    const x = scaledPoint.x + (scaledPoint.x >= origin.x ? delta : -delta);
    const y = scaledPoint.y + (scaledPoint.y <= origin.y ? -delta : delta);
    return new Coordinate(x, y);
  }

  /**
   * Calculates the tooltip anchor for a bubble.
   * @param chartDefinition The chart definition.
   * @param bubbleData An object containing point properties.
   * @param serie The serie.
   * @return The tooltip anchor.
   */
  private calcBubbleTooltipAnchor(
    chartDefinition: ChartDefinition,
    bubbleData: chartDefinitionTypes.DatumDefinition,
    serie: chartDefinitionTypes.SerieDefinition,
  ): Coordinate {
    const scaledBubble = bubbleData.scaled;
    const anchor = this.calcPointTooltipAnchor(
      chartDefinition,
      bubbleData,
      serie,
    );

    // If the anchor is outside the chart area, flip it relative to the center
    // of the bubble. The reason is that bubbles, unlike points, are clipped by
    // the boundaries of the chart area, and therefore it looks weird if the
    // anchor is outside the chart area, and the tooltip handle will start in
    // mid-air. Assuming the center of the bubble is inside the chart area, the
    // flipping will move the anchor inside it too. Flipping is done
    // independently for the X and Y coordinates.
    if (
      anchor.x < chartDefinition.chartArea.left ||
      anchor.x > chartDefinition.chartArea.right
    ) {
      anchor.x += 2 * (scaledBubble!.x - anchor.x);
    }
    if (
      anchor.y < chartDefinition.chartArea.top ||
      anchor.y > chartDefinition.chartArea.bottom
    ) {
      anchor.y += 2 * (scaledBubble!.y - anchor.y);
    }
    return anchor;
  }

  /**
   * Calculates the tooltip anchor for a bar.
   * @param chartDefinition The chart definition.
   * @param barData An object containing bar properties.
   * @return The tooltip anchor.
   */
  private calcBarTooltipAnchor(
    chartDefinition: ChartDefinition,
    barData: chartDefinitionTypes.DatumDefinition,
  ): Coordinate {
    // The following line is a hack to get around the fact that the scaled bar
    // is sometimes a Bar and sometimes a ScaledBar, apparently.
    // TODO(dlaliberte): Fix this.
    const scaledBar = barData.scaled!.bar || barData.scaled!;
    const origin = this.calcChartOrigin(chartDefinition);
    const x =
      scaledBar.left + (scaledBar.left < origin.x ? 0 : scaledBar.width);
    const y = scaledBar.top + (scaledBar.top < origin.y ? 0 : scaledBar.height);
    const anchor = new Coordinate(x, y);
    // Clamp anchor so that the tooltip does not open outside the chart area.
    this.clampAnchorToChartArea(chartDefinition, anchor);
    return anchor;
  }

  /**
   * Calculates the tooltip anchor for a candlestick, placing it on the
   * rectangle portion of the candlestick in the same fashion as tooltips are
   * placed for bars.
   * @param chartDefinition The chart definition.
   * @param candlestickData An object containing candlestick properties.
   * @return The tooltip anchor.
   */
  private calcCandlestickTooltipAnchor(
    chartDefinition: ChartDefinition,
    candlestickData: chartDefinitionTypes.DatumDefinition,
  ): Coordinate {
    const scaledRect = candlestickData.scaled!.rect;
    const origin = this.calcChartOrigin(chartDefinition);
    const x =
      scaledRect.left + scaledRect.width > origin.x
        ? scaledRect.left + scaledRect.width
        : scaledRect.left;
    const y =
      scaledRect.top < origin.y
        ? scaledRect.top
        : scaledRect.top + scaledRect.height;
    const anchor = new Coordinate(x, y);
    // Clamp anchor so that the tooltip does not open outside the chart area.
    this.clampAnchorToChartArea(chartDefinition, anchor);
    return anchor;
  }

  /**
   * Calculates the tooltip anchor for a boxplot, placing it on the
   * rectangle portion of the boxplot in the same fashion as tooltips are
   * placed for bars.
   * @param chartDefinition The chart definition.
   * @param boxplotData An object containing boxplot properties.
   * @return The tooltip anchor.
   */
  private calcBoxplotTooltipAnchor(
    chartDefinition: ChartDefinition,
    boxplotData: chartDefinitionTypes.DatumDefinition,
  ): Coordinate {
    const scaledRect = boxplotData.scaled!.rect;
    const origin = this.calcChartOrigin(chartDefinition);
    const x =
      scaledRect.left + scaledRect.width > origin.x
        ? scaledRect.left + scaledRect.width
        : scaledRect.left;
    const y =
      scaledRect.top < origin.y
        ? scaledRect.top
        : scaledRect.top + scaledRect.height;
    const anchor = new Coordinate(x, y);
    // Clamp anchor so that the tooltip does not open outside the chart area.
    this.clampAnchorToChartArea(chartDefinition, anchor);
    return anchor;
  }

  /**
   * Calculates the tooltip anchor for a pie slice.
   * @param chartDefinition The chart definition.
   * @param slice An object containing slice properties.
   * @return The tooltip anchor.
   */
  private calcSliceTooltipAnchor(
    chartDefinition: ChartDefinition,
    slice: chartDefinitionTypes.SerieDefinition,
  ): Coordinate {
    // The tooltip is opened in the middle of the slice's arc.
    // We first need to compute the degree for the middle of the slice and then
    // to compute the exact point.
    const degrees = slice.isWholeCircle
      ? 45
      : (slice.fromDegrees + slice.toDegrees) / 2;
    const locationDxDy = vectorutils.vectorOnEllipse(
      (degrees / 180 - 0.5) * Math.PI,
      chartDefinition.pie.radiusX,
      chartDefinition.pie.radiusY,
    );
    const location = Vec2.sum(chartDefinition.pie.center, locationDxDy);
    const anchor = new Coordinate(
      location.x + slice.offset.x,
      location.y + slice.offset.y,
    );
    // In pie chart, the tooltip can open outside the chart area, just not
    // outside of the drawing frame.
    this.clampAnchorToFrame(chartDefinition, anchor);
    return anchor;
  }

  /**
   * Calculates the tooltip anchor for an annotation.
   * @param chartDefinition The chart definition.
   * @param annotation An object containing annotation properties.
   * @return The tooltip anchor.
   */
  private calcAnnotationTooltipAnchor(
    chartDefinition: ChartDefinition,
    annotation: TextBlock,
  ): Coordinate {
    asserts.assert(annotation.lines.length > 0);
    const anchor = annotation.anchor ? annotation.anchor : new Coordinate(0, 0);
    const line = annotation.lines[0];
    const fontSize = annotation.textStyle.fontSize;
    // Return the top right corner of the label text.
    // TODO(dlaliberte): Take parallel and perpendicular alignment into account.
    // TODO(dlaliberte): Once BarChart supports annotations, take chart orientation
    // into account.
    if (annotation.angle === 270) {
      // For vertical labels, the line (x,y) indicates the coordinate ABOVE the
      // center of the text.
      // That is, for 'ABC' it will be above the center of the 'B' (then rotate
      // both text and coordinate by 270 degrees).
      return new Coordinate(
        anchor.x + line.x + fontSize,
        anchor.y + line.y - line.length / 2,
      );
    }
    // TODO(dlaliberte): Handle all angles, not just 270 and 0.
    asserts.assert(!annotation.angle); // angle is undefined, null or 0.
    // For horizontal labels, the line (x,y) indicates the coordinate BELOW the
    // center of the text.
    // That is, for 'ABC' it will be below the center of the 'B'.
    return new Coordinate(
      anchor.x + line.x + line.length / 2,
      anchor.y + line.y - fontSize,
    );
  }

  /**
   * Calculates the tooltip anchor for a datum.
   * The anchor is the point on the relevant element which is most far from the
   * chart's origin.
   * @param chartDefinition The chart definition.
   * @param seriesIndex The series index.
   * @param categoryIndex The category index.
   * @return The tooltip anchor.
   */
  private calcDatumTooltipAnchor(
    chartDefinition: ChartDefinition,
    seriesIndex: number,
    categoryIndex: number,
  ): Coordinate {
    const series = chartDefinition.series[seriesIndex];
    const seriesType = series.type;
    categoryIndex = chartDefinition.getCanonicalCategoryIndex(
      seriesIndex,
      categoryIndex,
    );
    const point = series.points[categoryIndex];
    if (!point) {
      return new Coordinate(0, 0);
    }

    const switchBySeries = (): Coordinate => {
      // We need to distinguish between the series' types.
      switch (seriesType) {
        case SerieType.BARS:
        case SerieType.STEPPED_AREA:
          return this.calcBarTooltipAnchor(chartDefinition, point);
        case SerieType.LINE:
        case SerieType.AREA:
        case SerieType.SCATTER:
          return this.calcPointTooltipAnchor(chartDefinition, point, series);
        case SerieType.CANDLESTICKS:
          return this.calcCandlestickTooltipAnchor(chartDefinition, point);
        case SerieType.BOXPLOT:
          return this.calcBoxplotTooltipAnchor(chartDefinition, point);
        default:
          asserts.fail(`Invalid series type "${seriesType}"`);
      }
      return new Coordinate(0, 0); // Never used.
    };

    switch (chartDefinition.chartType) {
      case ChartType.FUNCTION:
        return switchBySeries();
      case ChartType.HISTOGRAM:
        return switchBySeries();
      case ChartType.SCATTER:
        return this.calcPointTooltipAnchor(chartDefinition, point, series);
      case ChartType.BUBBLE:
        return this.calcBubbleTooltipAnchor(chartDefinition, point, series);
      default:
        throw new Error(`Invalid chart type "${chartDefinition.chartType}"`);
    }
  }

  /**
   * Clamps the anchor coordinate to the chart area.
   * @param chartDefinition The chart definition.
   * @param anchor The anchor.
   */
  private clampAnchorToChartArea(
    chartDefinition: ChartDefinition,
    anchor: Coordinate,
  ) {
    const chartArea = chartDefinition.chartArea;
    anchor.x = googMath.clamp(anchor.x, chartArea.left, chartArea.right);
    anchor.y = googMath.clamp(anchor.y, chartArea.top, chartArea.bottom);
  }

  /**
   * Clamps the anchor coordinate to the frame area.
   * @param chartDefinition The chart definition.
   * @param anchor The anchor.
   */
  private clampAnchorToFrame(
    chartDefinition: ChartDefinition,
    anchor: Coordinate,
  ) {
    anchor.x = googMath.clamp(anchor.x, 0, chartDefinition.width);
    anchor.y = googMath.clamp(anchor.y, 0, chartDefinition.height);
  }

  /**
   * Calculates the tooltip anchor for a category.
   * The anchor is offset 1em away from the pivot position on the X or Y axis,
   * depending on the orientation, and 1em away from the category position
   * on the other axis.
   * The direction of the offset is opposite to that of the axis, because
   * for a Date axis, for example, it makes more sense to cover the past data
   * rather than the future data.  Note that for vertical orientation,
   * the direction is reversed by default.
   * This method also causes a side-effect on the pivot point, which might
   * start out as the cursor position; the x or y value is moved
   * to the position of the category, computed from the categoryIndex.
   * @param chartDefinition The chart definition.
   * @param pivot The pivot point, initially the cursor position.
   * @param categoryIndex The category index
   * @return The tooltip anchor.
   */
  private calcCategoryTooltipAnchor(
    chartDefinition: ChartDefinition,
    pivot: Coordinate,
    categoryIndex: number,
  ): Coordinate {
    let x = null;
    let y = null;
    const hAxis = googObject.getAnyValue(chartDefinition.hAxes)!;
    const vAxis = googObject.getAnyValue(chartDefinition.vAxes)!;
    const hDirection = hAxis.dataDirection;
    let vDirection = vAxis.dataDirection;
    let value: Value = categoryIndex;
    if (
      !chartDefinition.orientation ||
      chartDefinition.orientation === Orientation.HORIZONTAL
    ) {
      // Domain axis is hAxis.
      if (hAxis.type === AxisType.VALUE) {
        value = chartDefinition.categories[categoryIndex].data;
      }
      x = hAxis.position.fromValue(value);
    } else {
      // Domain axis is vAxis, which is reversed in direction.
      vDirection = -vDirection;
      if (vAxis.type === AxisType.VALUE) {
        value = chartDefinition.categories[categoryIndex].data;
      }
      y = vAxis.position.fromValue(value);
    }
    const fontSize = this.bodyCreator.getTextStyle().fontSize;
    // Side-effect on pivot is necessary.
    pivot.x = x === null ? pivot.x : x;
    pivot.y = y === null ? pivot.y : y;
    x = pivot.x - hDirection * fontSize;
    y = pivot.y + vDirection * fontSize;
    return new Coordinate(x, y);
  }

  /**
   * Calculates the tooltip pivot for a bar.
   * @param chartDefinition The chart definition.
   * @param barData An object containing bar properties.
   * @return The tooltip pivot.
   */
  private calcBarTooltipPivot(
    chartDefinition: ChartDefinition,
    barData: chartDefinitionTypes.ScaledDatumDefinition,
  ): Coordinate {
    // The tooltip anchor is set to the right or upper corner of the bar, on the
    // side that is farthest from the baseline (right corner for vertical bars,
    // upper corner for horizontal bars. See calcBarTooltipAnchor).
    // If the tooltip doesn't fit in the chart area, we want it to open from the
    // other corner on the same side. Thus, the tooltip pivot is the middle of
    // the side farthest from the baseline.
    const left = barData.left;
    const width = barData.width;
    const right = left + width;
    const top = barData.top;
    const height = barData.height;
    const bottom = top + height;
    // Hack alert:
    // Because the pivot is also used to determine the orientation of the
    // tooltip (the tooltip attempts to open away from the pivot), setting it to
    // the middle of the side farthest from the baseline results in it opening
    // in the same direction for bars representing positive and negative values.
    // But we want it to open away from the bar, not always upwards, so we place
    // the pivot slightly inside the bar (0.1 pixels inwards). Because the
    // tooltip coordinates are rounded to integers at the end of all
    // calculations, this hack should not be expressed visually in the chart.
    const EPSILON = 0.1;
    const origin = this.calcChartOrigin(chartDefinition);
    const orientation = chartDefinition.orientation;
    if (orientation === Orientation.HORIZONTAL) {
      if (bottom > origin.y) {
        return new Coordinate(left + width / 2, bottom - EPSILON);
      } else {
        return new Coordinate(left + width / 2, top + EPSILON);
      }
    } else {
      if (left < origin.x) {
        return new Coordinate(left + EPSILON, top + height / 2);
      } else {
        return new Coordinate(right - EPSILON, top + height / 2);
      }
    }
  }

  /**
   * Calculates the tooltip pivot for a pie slice.
   * @param chartDefinition The chart definition.
   * @param slice An object containing slice properties.
   * @return The tooltip pivot.
   */
  private calcSliceTooltipPivot(
    chartDefinition: ChartDefinition,
    slice: chartDefinitionTypes.SerieDefinition,
  ): Coordinate {
    // The tooltip is opened in the middle of the slice's arc.
    // We first need to compute the degree for the middle of the slice and then
    // to compute the exact point.
    const degrees = slice.isWholeCircle
      ? 45
      : (slice.fromDegrees + slice.toDegrees) / 2;
    // The pivot should be on near the anchor, slightly into the pie itself.
    const locationDxDy = vectorutils.vectorOnEllipse(
      (degrees / 180 - 0.5) * Math.PI,
      chartDefinition.pie.radiusX - 0.1,
      chartDefinition.pie.radiusY - 0.1,
    );
    const location = Vec2.sum(chartDefinition.pie.center, locationDxDy);
    return new Coordinate(
      location.x + slice.offset.x,
      location.y + slice.offset.y,
    );
  }

  /**
   * Calculates the tooltip pivot.
   * Calculates the tooltip pivot for an annotation.
   * @param chartDefinition The chart definition.
   * @param annotation An object containing annotation properties.
   * @return The tooltip pivot.
   */
  private calcAnnotationTooltipPivot(
    chartDefinition: ChartDefinition,
    annotation: TextBlock,
  ): Coordinate {
    asserts.assert(annotation.lines.length > 0);
    const anchor = annotation.anchor ? annotation.anchor : new Coordinate(0, 0);
    const line = annotation.lines[0];
    const fontSize = annotation.textStyle.fontSize;
    // Return the center of the label text.
    // TODO(dlaliberte): Take parallel and perpendicular alignment into account.
    // TODO(dlaliberte): Once BarChart supports annotations, take chart orientation
    // into account.
    if (annotation.angle === 270) {
      // For vertical labels, the line (x,y) indicates the coordinate ABOVE the
      // center of the text.
      // That is, for 'ABC' it will be above the center of the 'B' (then rotate
      // both text and coordinate by 270 degrees).
      return new Coordinate(
        anchor.x + line.x + fontSize / 2,
        anchor.y + line.y,
      );
    }
    // TODO(dlaliberte): Handle all angles, not just 270 and 0.
    asserts.assert(!annotation.angle); // angle is undefined, null or 0.
    // For horizontal labels, the line (x,y) indicates the coordinate BELOW the
    // center of the text.
    // That is, for 'ABC' it will be below the center of the 'B'.
    return new Coordinate(anchor.x + line.x, anchor.y + line.y - fontSize / 2);
  }

  /**
   * Calculates the tooltip pivot for a datum.
   * The pivot is used when a tooltip does not fit in the chart area in its
   * default orientation. Such a tooltip will be flipped in relation to the
   * pivot. Also, the tooltip orientation is set according to the pivot - it
   * attempts to open away from it.
   * @param chartDefinition The chart definition.
   * @param seriesIndex The series index.
   * @param categoryIndex The category index.
   * @return The tooltip pivot.
   */
  private calcDatumTooltipPivot(
    chartDefinition: ChartDefinition,
    seriesIndex: number,
    categoryIndex: number,
  ): Coordinate {
    categoryIndex = chartDefinition.getCanonicalCategoryIndex(
      seriesIndex,
      categoryIndex,
    );
    const series = chartDefinition.series[seriesIndex];
    const seriesType = series.type;
    const scaledDatum = series.points[categoryIndex]!.scaled;

    if (
      seriesType === SerieType.BARS ||
      seriesType === SerieType.STEPPED_AREA ||
      seriesType === SerieType.CANDLESTICKS ||
      seriesType === SerieType.BOXPLOT
    ) {
      // TS2352: Conversion of type 'Rect' to type 'ScaledDatumDefinition' may be
      // a mistake because neither type sufficiently overlaps with the other.
      const barData = (scaledDatum!.bar ||
        scaledDatum!.rect ||
        scaledDatum) as unknown as chartDefinitionTypes.ScaledDatumDefinition;
      return this.calcBarTooltipPivot(chartDefinition, barData);
    }
    // If the tooltip doesn't fit in the chart area, we want to reflect it to
    // the opposite "corner" of the data point. Thus, the tooltip pivot is the
    // center of the point.
    return new Coordinate(scaledDatum!.x, scaledDatum!.y);
  }

  /**
   * Creates a tooltip for a data element.
   * Supported data elements are data points, series, categories and
   * annotations. The position of the tooltip is determined by the position of
   * the element.
   * @param seriesIndex The series index, or null (for category tooltips).
   * @param categoryIndex The category index, or null (for series tooltips).
   * @param annotationIndex The annotation index, or null.
   * @param cursorPosition The cursor position.
   *     Required for category tooltips.
   * @return The tooltip definition, or null if tooltip is for an annotation which has no tooltip text.
   */
  createTooltip(
    interactionState: InteractionState,
    seriesIndex: number | null,
    categoryIndex: number | null,
    annotationIndex: number | null,
    cursorPosition?: Coordinate,
  ): TooltipDefinition | null {
    asserts.assert(seriesIndex !== null || categoryIndex !== null);

    if (
      seriesIndex !== null &&
      categoryIndex !== null &&
      annotationIndex !== null
    ) {
      return this.createDatumAnnotationTooltip(
        interactionState,
        seriesIndex,
        categoryIndex,
        annotationIndex,
      );
    }
    if (seriesIndex !== null && categoryIndex !== null) {
      return this.createDatumTooltip(
        interactionState,
        seriesIndex,
        categoryIndex,
      );
    }
    if (seriesIndex !== null && categoryIndex === null) {
      return this.createSeriesTooltip(interactionState, seriesIndex);
    }
    if (
      seriesIndex === null &&
      categoryIndex !== null &&
      annotationIndex !== null
    ) {
      return this.createCategoryAnnotationTooltip(
        interactionState,
        categoryIndex,
        annotationIndex,
      );
    }
    if (seriesIndex === null && categoryIndex !== null) {
      asserts.assert(cursorPosition !== undefined);
      return this.createCategoryTooltip(
        interactionState,
        categoryIndex,
        cursorPosition!,
      );
    }
    return null;
  }

  /**
   * Creates an aggregate tooltip for data.
   * Supported data elements are data points, series, categories and
   * annotations. The position of the tooltip is determined by the position of
   * the element.
   * @param data The data to aggregate.
   * @param positionDatum The datum around which the tooltip should be anchored.
   * @param aggregationTarget The aggregate target.
   * @return The tooltip definition, or null if tooltip is for an annotation which has no tooltip text.
   */
  createAggregateTooltip(
    interactionState: InteractionState,
    data: chartDefinitionTypes.Datum[],
    positionDatum: chartDefinitionTypes.Datum,
    aggregationTarget: AggregationTarget,
  ): TooltipDefinition {
    return this.createAggregateDataTooltip(
      interactionState,
      data,
      positionDatum,
      aggregationTarget,
    );
  }

  /**
   * Creates a tooltip for a datum.
   * The position of the tooltip is determined by the position of the datum.
   * @param seriesIndex The series index.
   * @param categoryIndex The category index.
   * @return The tooltip definition.
   */
  private createDatumTooltip(
    interactionState: InteractionState,
    seriesIndex: number,
    categoryIndex: number,
  ): TooltipDefinition | null {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    if (!chartDefinition.series[seriesIndex].showTooltip) {
      return null;
    }
    // Tooltip position.
    const anchor = this.calcDatumTooltipAnchor(
      chartDefinition,
      seriesIndex,
      categoryIndex,
    );
    const pivot = this.customPivot
      ? Coordinate.sum(anchor, this.customPivot)
      : this.calcDatumTooltipPivot(chartDefinition, seriesIndex, categoryIndex);

    const tooltipText =
      chartDefinition.series[seriesIndex].points[categoryIndex]!.tooltipText;
    if (!tooltipText) {
      return null;
    }
    if (typeof tooltipText.customCalcFunction === 'function') {
      const customContent = tooltipText.customCalcFunction(
        chartDefinition,
        seriesIndex,
        categoryIndex,
      );
      if (!customContent) {
        return null;
      }

      if (
        !(typeof customContent === 'string') &&
        // tslint:disable-next-line:ban-types
        !((customContent as AnyDuringMigration) instanceof SafeHtml)
      ) {
        throw new Error(
          'Custom calc function for tooltip content should produce string ' +
            'literal or safe HTML.',
        );
      }
      let safeContent = null;
      // tslint:disable-next-line:ban-types
      if ((customContent as AnyDuringMigration) instanceof SafeHtml) {
        safeContent = customContent;
      } else if (typeof customContent === 'string') {
        safeContent = sanitizeHtml(customContent);
      }
      return this.createHTMLTooltipWithCustomContent(
        safeContent as SafeHtml,
        anchor,
        pivot,
      );
    }

    if (tooltipText.hasHtmlContent && tooltipText.hasCustomContent) {
      const safeContent = DynamicLoading.getSafeHtml(tooltipText.content || '');
      return this.createHTMLTooltipWithCustomContent(
        safeContent,
        anchor,
        pivot,
      );
    }

    // Tooltip body (formatted content).
    const body: TooltipBody = this.bodyCreator.createDatumBody(
      interactionState,
      seriesIndex,
      categoryIndex,
    );

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      true, // Create tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }

  /**
   * Creates an aggregate tooltip for a set of series.
   * @param seriesIndices A list of series indices.
   * @param positionSeriesIndex The index of the series that the tooltip position should be based on.
   * @return The tooltip definition.
   */
  createAggregateSeriesTooltip(
    interactionState: InteractionState,
    seriesIndices: number[],
    positionSeriesIndex: number,
  ): TooltipDefinition {
    // For now, the only series element that may have a tooltip is a Pie slice.
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    asserts.assert(chartDefinition.chartType === ChartType.PIE);

    const positionSlice = chartDefinition.series[positionSeriesIndex];

    // Tooltip position.
    const anchor = this.calcSliceTooltipAnchor(chartDefinition, positionSlice);
    const pivot = this.calcSliceTooltipPivot(chartDefinition, positionSlice);

    // TODO(dlaliberte): Support HTML tooltip aggregation.
    // But is not clear what to do in the case of an aggregation.

    // Tooltip body (formatted content).
    const body: TooltipBody = this.bodyCreator.createAggregateSeriesBody(
      interactionState,
      seriesIndices,
    );

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      true, // Create tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }

  /**
   * Creates an aggregate tooltip for arbitrary data.
   * The position of the tooltip is determined by the position of the datum.
   * @param data An array of data that should be included in the tooltip.
   * @param positionDatum The datum from which the position of the tooltip should be determined.
   * @param aggregateTarget The type of aggregation that should be done.
   * @return The tooltip definition.
   */
  createAggregateDataTooltip(
    interactionState: InteractionState,
    data: Array<{serie: number; category: number}>,
    positionDatum: {serie: number; category: number},
    aggregateTarget: AggregationTarget,
  ): TooltipDefinition {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    // Tooltip position.
    const anchor = this.calcDatumTooltipAnchor(
      chartDefinition,
      positionDatum.serie,
      positionDatum.category,
    );
    const pivot = this.calcDatumTooltipPivot(
      chartDefinition,
      positionDatum.serie,
      positionDatum.category,
    );

    // TODO(dlaliberte): Support HTML tooltip aggregation.

    // Tooltip body (formatted content).
    const body: TooltipBody = this.bodyCreator.createAggregateDataBody(
      interactionState,
      data,
      aggregateTarget,
    );

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      true, // Create tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }

  /**
   * Creates an aggregate tooltip for arbitrary categories.
   * @param categoryIndices The category indices.
   * @param cursorPosition The cursor position.
   * @param aggregateTarget The type of aggregation that should be done.
   * @return The tooltip definition.
   */
  createAggregateCategoryTooltip(
    interactionState: InteractionState,
    categoryIndices: number[],
    cursorPosition: Coordinate,
    aggregateTarget: AggregationTarget,
  ): TooltipDefinition | null {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;

    // Tooltip position.
    let pivot = cursorPosition.clone();
    const anchor = this.calcCategoryTooltipAnchor(
      chartDefinition,
      pivot,
      categoryIndices[categoryIndices.length - 1],
    );
    pivot = this.customPivot ? Coordinate.sum(anchor, this.customPivot) : pivot;

    // TODO(dlaliberte): Support HTML tooltip aggregation.

    const data: chartDefinitionTypes.Datum[] = [];
    categoryIndices.forEach((categoryIndex) => {
      chartDefinition.series.forEach((series, seriesIndex) => {
        data.push({serie: seriesIndex, category: categoryIndex});
      });
    });

    // Tooltip body (formatted content).
    const body = this.bodyCreator.createAggregateDataBody(
      interactionState,
      data,
      aggregateTarget,
    );
    if (body === null) {
      return null;
    }

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      false, // No tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }

  /**
   * Creates a tooltip for a series (e.g. a pie slice).
   * The position of the tooltip is determined by the position of the series.
   * @param seriesIndex The series index.
   * @return The tooltip definition.
   */
  private createSeriesTooltip(
    interactionState: InteractionState,
    seriesIndex: number,
  ): TooltipDefinition | null {
    // For now, the only series element that may have a tooltip is a Pie slice.
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    asserts.assert(chartDefinition.chartType === ChartType.PIE);
    const slice = chartDefinition.series[seriesIndex];
    if (slice.offset == null) {
      // Too small to display?  We should have a cleaner way to detect this.
      return null;
    }

    // Tooltip position.
    const anchor = this.calcSliceTooltipAnchor(chartDefinition, slice);
    const pivot = this.calcSliceTooltipPivot(chartDefinition, slice);

    const tooltipText = chartDefinition.series[seriesIndex].tooltipText;

    if (tooltipText.hasHtmlContent && tooltipText.hasCustomContent) {
      const safeContent = DynamicLoading.getSafeHtml(tooltipText.content || '');
      return this.createHTMLTooltipWithCustomContent(
        safeContent,
        anchor,
        pivot,
      );
    }

    // Tooltip body (formatted content).
    const body = this.bodyCreator.createSeriesBody(
      interactionState,
      seriesIndex,
    );

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      true, // Create tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }

  /**
   * Creates a tooltip for a datum annotation.
   * The position of the tooltip is determined by the position of the
   * annotation.
   * @param seriesIndex The series index.
   * @param categoryIndex The category index.
   * @param annotationIndex The annotation index.
   * @return The tooltip definition, or null if annotation has no tooltip text.
   */
  private createDatumAnnotationTooltip(
    interactionState: InteractionState,
    seriesIndex: number,
    categoryIndex: number,
    annotationIndex: number,
  ): TooltipDefinition | null {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    const series = chartDefinition.series[seriesIndex];
    const datum = series.points[categoryIndex];
    asserts.assertObject(datum!.annotation);
    const annotation = datum!.annotation!.labels[annotationIndex];

    const tooltipText =
      (annotation as unknown as chartDefinitionTypes.Annotation | null)!
        .tooltipText;
    if (!tooltipText) {
      return null;
    }

    // Tooltip position.
    const anchor = this.calcAnnotationTooltipAnchor(
      chartDefinition,
      annotation,
    );
    const pivot = this.calcAnnotationTooltipPivot(chartDefinition, annotation);

    if (tooltipText.hasHtmlContent && tooltipText.hasCustomContent) {
      const safeContent = DynamicLoading.getSafeHtml(tooltipText.content || '');
      return this.createHTMLTooltipWithCustomContent(
        safeContent,
        anchor,
        pivot,
      );
    }

    // Tooltip body (formatted content).
    const body = this.bodyCreator.createDatumAnnotationBody(
      interactionState,
      seriesIndex,
      categoryIndex,
      annotationIndex,
    );

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      false, // No tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }

  /**
   * Creates a tooltip for a category.
   * The position of the tooltip is determined by the position of the category.
   * @param categoryIndex The category index.
   * @param cursorPosition The cursor position.
   * @return The tooltip definition.
   */
  private createCategoryTooltip(
    interactionState: InteractionState,
    categoryIndex: number,
    cursorPosition: Coordinate,
  ): TooltipDefinition | null {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;

    // Tooltip position.
    let pivot = cursorPosition.clone();
    const anchor = this.calcCategoryTooltipAnchor(
      chartDefinition,
      pivot,
      categoryIndex,
    );
    pivot = this.customPivot ? Coordinate.sum(anchor, this.customPivot) : pivot;

    const tooltipText = chartDefinition.categories[categoryIndex].tooltipText;
    if (
      tooltipText &&
      tooltipText.hasHtmlContent &&
      tooltipText.hasCustomContent
    ) {
      asserts.assert(tooltipText.content != null);
      const safeContent = DynamicLoading.getSafeHtml(tooltipText.content!);
      return this.createHTMLTooltipWithCustomContent(
        safeContent,
        anchor,
        pivot,
      );
    }

    // Tooltip body (formatted content).
    const body = this.bodyCreator.createCategoryBody(
      interactionState,
      categoryIndex,
    );
    if (body === null) {
      return null;
    }

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      false, // No tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }

  /**
   * Creates an HTML tooltip with custom content.
   * @param content The custom HTML content.
   * @param anchor The tooltip anchor.
   * @param pivot The tooltip pivot.
   * @return The tooltip definition.
   */
  private createHTMLTooltipWithCustomContent(
    content: SafeHtml,
    anchor: Coordinate,
    pivot: Coordinate,
  ): TooltipDefinition {
    return {
      html: createHtml(
        'div',
        {'class': 'google-visualization-tooltip'},
        content,
      ),
      customHtml: true,
      pivot,
      anchor,
      boundaries: this.boundaries,
      spacing: htmldefiner.SPACING,
      margin: DEFAULT_MARGINS,
    };
  }

  /**
   * Creates a tooltip for a category annotation.
   * The position of the tooltip is determined by the position of the
   * annotation.
   * @param categoryIndex The category index.
   * @param annotationIndex The annotation index.
   * @return The tooltip definition, or null if annotation has no tooltip text.
   */
  private createCategoryAnnotationTooltip(
    interactionState: InteractionState,
    categoryIndex: number,
    annotationIndex: number,
  ): TooltipDefinition | null {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    const category = chartDefinition.categories[categoryIndex];
    const annotationTextBlock = category.annotation!.labels[annotationIndex];

    const tooltipText = // Sometimes the annotationTextBlock is really an Annotation?
      (annotationTextBlock as unknown as chartDefinitionTypes.Annotation | null)!
        .tooltipText;
    if (!tooltipText) {
      return null;
    }

    // Tooltip position.
    const anchor = this.calcAnnotationTooltipAnchor(
      chartDefinition,
      annotationTextBlock,
    );
    const pivot = this.calcAnnotationTooltipPivot(
      chartDefinition,
      annotationTextBlock,
    );

    if (tooltipText.hasHtmlContent && tooltipText.hasCustomContent) {
      const safeContent = DynamicLoading.getSafeHtml(tooltipText.content || '');
      return this.createHTMLTooltipWithCustomContent(
        safeContent,
        anchor,
        pivot,
      );
    }

    // Tooltip text.
    const body = this.bodyCreator.createCategoryAnnotationBody(
      interactionState,
      categoryIndex,
      annotationIndex,
    );

    return tooltipDefinerUtils.createTooltipDefinition(
      body,
      chartDefinition.textMeasureFunction,
      false, // No tooltip handle.
      anchor,
      this.boundaries,
      pivot,
      undefined,
      chartDefinition.isHtmlTooltip,
      chartDefinition.isRtl,
      chartDefinition.tooltipBoxStyle,
    );
  }
}
