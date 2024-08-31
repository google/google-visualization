/**
 * @fileoverview Chart builder for axis charts.
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

import {
  clone,
  defaultCompare,
  forEach,
  insertAt,
  isEmpty,
  sort,
  stableSort,
} from '@npm//@closure/array/array';
import {
  assert,
  fail,
} from '@npm//@closure/asserts/asserts';
import {Rect} from '@npm//@closure/math/rect';
import * as googObject from '@npm//@closure/object/object';
import {LayeredObject} from '../../common/layered_object';
import {
  ColorBarPosition,
  InOutPosition,
  IntervalStyle,
  LegendPosition,
  Orientation,
  SerieType,
} from '../../common/option_types';
import {containsNoOtherProperties, rangeMap} from '../../common/util';
import {AbstractRenderer} from '../../graphics/abstract_renderer';
import {Brush} from '../../graphics/brush';
import {DrawingGroup} from '../../graphics/drawing_group';
import {OverlayArea} from '../../graphics/overlay_area';
import {PathSegments} from '../../graphics/path_segments';
import {TextAlign} from '../../text/text_align';
import * as tooltipDefinition from '../../tooltip/tooltip_definition';
import {
  AxisDefinition,
  TickLine,
} from '../../visualization/corechart/axis_definition';
import {
  TOKEN_PRECEDENCE,
  Token,
  generateId,
} from '../../visualization/corechart/id_utils';
import {ChartBuilder} from './chart_builder';
import {ChartDefinition} from './chart_definition';
import * as chartDefinitionTypes from './chart_definition_types';
import * as chartdefinitionutil from './chart_definition_utils';

const IdutilsToken = Token;
const {
  createPathSegments,
  createPathSegmentsForStackedArea,
  getDatumBrush,
  getIncomingAreaBrush,
  getPointRadius,
  getPointTotalRadius,
  isDatumNull,
  isDatumVisible,
  isLonelyPoint,
} = chartdefinitionutil;

// Ignore the ts-ignore comments. They are remnants of the TS migration.
// They do not affect the code's behavior.
// tslint:disable:ban-ts-suppressions

/**
 * A builder for axis charts: Bar, Column, Candlesticks, Line, Area & Scatter.
 */
export class AxisChartBuilder extends ChartBuilder {
  /**
   * Maps an element type to the drawing group containing these type of
   * elements, and additional information about that group.
   */
  private drawingGroupInfo: {
    [key: string]: AxisChartBuilderDrawingGroupInfo | null;
  } | null = null;

  /**
   * Stores tooltips for drawing later.
   * When drawing series, we could draw tooltips at that time, but this won't
   * work for image mode rendering. As such, we queue up the tooltips to draw
   * after we've finished drawing all series.
   */
  private tooltipQueue: AnyDuringAssistedMigration[] = [];

  /**
   * @param overlayArea An html element into which tooltips should be added.
   * @param renderer The drawing renderer.
   */
  constructor(overlayArea: OverlayArea, renderer: AbstractRenderer) {
    super(overlayArea, renderer);
  }

  /**
   * Queue tooltip for later rendering.
   * @param tooltipDefinition The tooltip definition.
   * @param tooltipID Unique tooltip ID.
   */
  private queueTooltip(
    tooltipDefinition: tooltipDefinition.TooltipDefinition,
    tooltipID: string,
  ) {
    this.tooltipQueue.push({definition: tooltipDefinition, id: tooltipID});
  }

  /** Dequeue and draw all tooltips. */
  private renderTooltips() {
    const clipRect = this.renderer.disableClipping();
    forEach(this.tooltipQueue, (entry) => {
      this.openTooltip(entry.definition, entry.id);
    });
    this.renderer.describeClipRegion(clipRect);
    this.tooltipQueue = [];
  }

  /**
   * An abstract method for drawing the content of the chart from scratch.
   * @param chartDef Chart definition.
   * @param drawingGroup A group of the chart to draw into.
   * @return True if chart was created, false if there is no enough data to create the chart.
   */
  protected drawChartContent(
    chartDef: ChartDefinition,
    drawingGroup: DrawingGroup,
  ): boolean {
    this.initDrawingGroupInfo(chartDef);

    // Create the root drawing group for all elements in the chart area.
    const chartAreaDrawingGroup = this.renderer.createGroup(false);
    this.renderer.appendChild(drawingGroup, chartAreaDrawingGroup);
    this.registerElement(
      chartAreaDrawingGroup.getElement(),
      IdutilsToken.CHART_AREA,
    );

    // Create the drawing subgroups.
    googObject.forEach(this.drawingGroupInfo, (info, name) => {
      if (!info!.drawingGroup) {
        // Unless explicitly set to False, lazy creation is allowed.
        const allowLazyCreation =
          info!.allowLazyCreation === undefined || info!.allowLazyCreation;
        info!.drawingGroup = this.renderer.createGroup(!!allowLazyCreation);
      }
    });

    // Draw the chart background (even if transparent so we can hang events on
    // the entire chart).
    this.renderer.drawRect(
      chartDef.chartArea.left,
      chartDef.chartArea.top,
      chartDef.chartArea.width,
      chartDef.chartArea.height,
      chartDef.chartAreaBackgroundBrush,
      chartAreaDrawingGroup,
    );

    // Draw the title.
    if (chartDef.titlePosition === InOutPosition.INSIDE) {
      assert(chartDef.title != null);
      this.drawTextBlock(
        chartDef.title,
        this.drawingGroupInfo![IdutilsToken.TITLE]!.drawingGroup,
        true,
      );
    }

    // Draw the axes title.
    if (chartDef.innerAxisTitle) {
      this.drawTextBlock(
        chartDef.innerAxisTitle,
        this.drawingGroupInfo![IdutilsToken.AXIS_TITLE]!.drawingGroup,
        true,
      );
    }

    forEach(chartDef.categories, (category, index) => {
      if (category.annotation) {
        this.drawAnnotation(category.annotation, null, null, index);
      }
    });

    // In some cases we don't draw series points, such as those with old data
    // in diff scatter charts.
    const isSerieVisible = (serieIndex: AnyDuringAssistedMigration) => {
      const serie = chartDef.series[serieIndex];
      return (
        !chartDef.isDiff ||
        serie.type !== SerieType.SCATTER ||
        serie.visiblePoints
      );
    };

    // Draw the chart axis lines.
    // We draw the axis after we draw the chart content so the if labels are
    // inside chart area, they overlap the drawing of the chart.
    googObject.forEach(chartDef.hAxes, (hAxis) => {
      this.drawHorizontalAxisLines(chartDef, hAxis);
    });
    googObject.forEach(chartDef.vAxes, (vAxis) => {
      this.drawVerticalAxisLines(chartDef, vAxis);
    });

    // Describe the clip area.
    // Basically, the canvas-renderer can't clip by adding SVG elements to a
    // clipping element; therefore, we describe the region we'll clip to the
    // renderer BEFORE we draw. Only the canvas renderer really cares.
    const clipRect = new Rect(
      chartDef.chartArea.left,
      chartDef.chartArea.top,
      chartDef.chartArea.width,
      chartDef.chartArea.height,
    );
    this.renderer.describeClipRegion(clipRect);

    // Order the series by z-order (affects the order within a drawing group).
    const sortedSeries = [];
    for (let i = 0; i < chartDef.series.length; i++) {
      // We don't draw points for old data in diff charts for scatter chart,
      // so we skip series with old data.
      if (isSerieVisible(i)) {
        sortedSeries.push({zOrder: chartDef.series[i].zOrder, index: i});
      }
    }
    stableSort(sortedSeries, (a, b) => defaultCompare(a.zOrder, b.zOrder));

    for (let i = 0; i < sortedSeries.length; i++) {
      const serieIndex = sortedSeries[i].index;
      const serie = chartDef.series[serieIndex];
      this.drawSerie(serie, serieIndex);
    }

    // For some chart types, draws a line/arrow between old and new data
    // to highlight change.
    if (chartDef.isDiff && chartDef.series[0].type === SerieType.SCATTER) {
      this.drawLinesBetweenOldAndNewData(chartDef, drawingGroup);
    }

    for (let i = 0; i < chartDef.categories.length; i++) {
      // Open a tooltip if one is associated with the category.
      if (chartDef.categories[i].tooltip) {
        const tooltipID = generateId([IdutilsToken.TOOLTIP, i]);
        this.queueTooltip(
          (
            chartDef.categories[i] as {
              tooltip: tooltipDefinition.TooltipDefinition;
            }
          ).tooltip,
          tooltipID,
        );
      }
    }

    // Draw the title and ticks of the chart axes.
    const oldClipRect = this.renderer.disableClipping();
    googObject.forEach(chartDef.hAxes, (hAxis) => {
      this.drawAxisText(chartDef, hAxis);
    });
    googObject.forEach(chartDef.vAxes, (vAxis) => {
      this.drawAxisText(chartDef, vAxis);
    });
    this.renderer.describeClipRegion(oldClipRect);

    // Render the tooltips.
    this.renderTooltips();

    // Create clipping rectangle for some groups in the chart area.
    // TODO(dlaliberte): Clip every parent group separately so that precedence will
    // be taken into account when one element is INSIDE and the other one
    // CLIPPED. The drawing group should be used to append child elements and
    // the clipping element should be used to append the drawing group as a
    // child of another group.
    const clippedDrawingGroup = this.renderer.createGroup(false);
    const clippingElement = this.renderer.clipGroup(
      clippedDrawingGroup,
      clipRect,
    );

    this.renderer.appendChild(chartAreaDrawingGroup, clippingElement);

    // Add drawing subgroups from background to foreground.
    // IMPORTANT: The element precedence only affects elements with the same
    // DrawingGroupPosition EXCEPT for sensitivity area elements. OUTSIDE
    // elements will always precede INSIDE ones which will always precede
    // CLIPPED ones.
    forEach(TOKEN_PRECEDENCE, (token) => {
      const elementDrawingGroup = this.drawingGroupInfo![token]!.drawingGroup;
      if (elementDrawingGroup) {
        let parentDrawingGroup;
        const drawingGroupPosition = this.drawingGroupInfo![token]!.position;
        switch (drawingGroupPosition) {
          case AxisChartBuilderDrawingGroupPosition.CLIPPED:
            parentDrawingGroup = clippedDrawingGroup;
            break;
          case AxisChartBuilderDrawingGroupPosition.INSIDE:
            parentDrawingGroup = chartAreaDrawingGroup;
            break;
          case AxisChartBuilderDrawingGroupPosition.OUTSIDE:
            parentDrawingGroup = drawingGroup;
            break;
          default:
            fail(`Invalid drawing group position "${drawingGroupPosition}"`);
        }
        assert(parentDrawingGroup != null);
        if (parentDrawingGroup == null) {
          throw new Error('parentDrawingGroup is null');
        }
        this.renderer.appendChild(parentDrawingGroup, elementDrawingGroup);
      }
    });

    return true;
  }

  /**
   * Initializes this.drawingGroupInfo based on a chart definition.
   * @param chartDef Chart definition.
   */
  private initDrawingGroupInfo(chartDef: ChartDefinition) {
    // Clear any previous drawing groups.
    this.drawingGroupInfo = {};
    // Shorter aliases.
    const Token = IdutilsToken;
    const DrawingGroupPosition = AxisChartBuilderDrawingGroupPosition;
    const info = this.drawingGroupInfo;
    // IMPORTANT: Please note that CLIPPED drawing groups will always be behind
    // INSIDE drawing groups which will always be behind OUTSIDE drawing groups.
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.OUTSIDE; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.ACTIONS_MENU_ENTRY] = {position: DrawingGroupPosition.OUTSIDE};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.ANNOTATION] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.INSIDE; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.ANNOTATION_TEXT] = {position: DrawingGroupPosition.INSIDE};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.AREA] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.BAR] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.BASELINE] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.BUBBLE] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.CATEGORY_SENSITIVITY_AREA] = {
      position: DrawingGroupPosition.CLIPPED,
    };
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.CANDLESTICK] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.BOXPLOT] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.HISTOGRAM] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.GRIDLINE] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.INTERVAL] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.LINE] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.MINOR_GRIDLINE] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.OVERLAY_BOX] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.PATH_INTERVAL] = {position: DrawingGroupPosition.CLIPPED};
    // Lazy creation is disallowed because points may show up as a result of
    // interaction.
    // TODO(dlaliberte): Allow lazy creation if interactivity is completely
    // disabled.
    // Suppressing errors for ts-migration.
    //   TS2741: Property 'drawingGroup' is missing in type '{ position: AxisChartBuilderDrawingGroupPosition.INSIDE; allowLazyCreation: false; }' but required in type 'AxisChartBuilderDrawingGroupInfo'.
    // @ts-ignore
    info[Token.POINT] = {
      position: DrawingGroupPosition.INSIDE,
      allowLazyCreation: false,
    };
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.INSIDE; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.POINT_SENSITIVITY_AREA] = {
      position: DrawingGroupPosition.INSIDE,
    };
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.CLIPPED; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.STEPPED_AREA_BAR] = {position: DrawingGroupPosition.CLIPPED};
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.OUTSIDE; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.TOOLTIP] = {position: DrawingGroupPosition.OUTSIDE};

    // The following elements can be inside or outside the chart area.

    const titlePosition =
      chartDef.titlePosition === InOutPosition.INSIDE
        ? DrawingGroupPosition.INSIDE
        : DrawingGroupPosition.OUTSIDE;
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.OUTSIDE | AxisChartBuilderDrawingGroupPosition.INSIDE; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCr...
    // @ts-ignore
    info[Token.TITLE] = {position: titlePosition};

    // TODO(dlaliberte): Right now we always put the axis ticks INSIDE, which also
    // works when they are outside the chart area, because we do not clip them.
    // Obviously, we want to put ticks which are outside the chart area OUTSIDE.
    // There are two things we have to do:
    // 1. Create a ticks group per axis (one axis can be OUT and a second one
    // IN).
    // 2. Mark it down in the axis definition (right now we could guess from the
    //    text pixel position or the aura color, but this would be a hack).
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.INSIDE; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCreation
    // @ts-ignore
    info[Token.AXIS_TICK] = {position: DrawingGroupPosition.INSIDE};
    const axisTitlePosition =
      chartDef.axisTitlesPosition === InOutPosition.INSIDE
        ? DrawingGroupPosition.INSIDE
        : DrawingGroupPosition.OUTSIDE;
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ position: AxisChartBuilderDrawingGroupPosition.OUTSIDE | AxisChartBuilderDrawingGroupPosition.INSIDE; }' is missing the following properties from type 'AxisChartBuilderDrawingGroupInfo': drawingGroup, allowLazyCr...
    // @ts-ignore
    info[Token.AXIS_TITLE] = {position: axisTitlePosition};

    const insideLegend =
      chartDef.legend && chartDef.legend.position === LegendPosition.INSIDE;
    const legendDrawingGroup = insideLegend ? this.legendDrawingGroup : null;
    const legendDrawingGroupPosition = insideLegend
      ? DrawingGroupPosition.INSIDE
      : DrawingGroupPosition.OUTSIDE;
    info[Token.LEGEND] = {
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'DrawingGroup | null' is not assignable to type 'DrawingGroup'.
      // @ts-ignore
      drawingGroup: legendDrawingGroup,
      position: legendDrawingGroupPosition,
    };
    info[Token.LEGEND_SCROLL_BUTTON] = {
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'DrawingGroup | null' is not assignable to type 'DrawingGroup'.
      // @ts-ignore
      drawingGroup: legendDrawingGroup,
      position: legendDrawingGroupPosition,
    };
    info[Token.LEGEND_ENTRY] = {
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'DrawingGroup | null' is not assignable to type 'DrawingGroup'.
      // @ts-ignore
      drawingGroup: legendDrawingGroup,
      position: legendDrawingGroupPosition,
    };

    const insideColorBar =
      chartDef.colorBar &&
      chartDef.colorBar.position === ColorBarPosition.INSIDE;
    const colorBarDrawingGroup = insideColorBar
      ? this.colorBarDrawingGroup
      : null;
    const colorBarDrawingGroupPosition = insideColorBar
      ? DrawingGroupPosition.INSIDE
      : DrawingGroupPosition.OUTSIDE;
    info[Token.COLOR_BAR] = {
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'DrawingGroup | null' is not assignable to type 'DrawingGroup'.
      // @ts-ignore
      drawingGroup: colorBarDrawingGroup,
      position: colorBarDrawingGroupPosition,
    };
  }

  /**
   * Draws a serie according to its type.
   * @param serie The serie to draw.
   * @param serieIndex The index of the serie.
   */
  private drawSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
  ) {
    if (serie.type === SerieType.BUBBLES) {
      this.drawBubbleSerie(serie, serieIndex);
    } else if (serie.type === SerieType.BARS) {
      this.drawBarSerie(serie, serieIndex);
    } else if (serie.type === SerieType.STEPPED_AREA) {
      this.drawBarSerie(serie, serieIndex);
    } else if (serie.type === SerieType.CANDLESTICKS) {
      this.drawCandlestickSerie(serie, serieIndex);
    } else if (serie.type === SerieType.BOXPLOT) {
      this.drawBoxplotSerie(serie, serieIndex);
    } else if (serie.type === SerieType.AREA) {
      this.drawAreaSerie(
        serie,
        serieIndex,
        this.chartDefinition!.stackingType !==
          chartDefinitionTypes.StackingType.NONE,
        this.chartDefinition!.interpolateNulls,
      );
    } else {
      // LINE or SCATTER.
      this.drawPathBasedSerie(
        serie,
        serieIndex,
        this.chartDefinition!.interpolateNulls,
      );
    }
    if (serie.intervals && serie.intervals.paths) {
      this.drawPathIntervals(serie, serieIndex);
    }
  }

  /**
   * Draws intervals that are lines or areas spanning multiple points on a
   * serie.
   * @param serie The serie the interval path belongs to.
   * @param serieIndex The index of the serie.
   */
  private drawPathIntervals(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
  ) {
    const intervalPaths = serie.intervals!.paths;
    for (let i = 0, intervalPath; (intervalPath = intervalPaths![i]); ++i) {
      if (intervalPath.line.length === 0) {
        continue;
      }
      const path = new PathSegments();

      path.extendFromVertices(intervalPath.line, intervalPath.controlPoints);

      if (intervalPath.bottom) {
        path.extendFromVertices(
          intervalPath.bottom,
          intervalPath.bottomControlPoints || undefined,
        );
      }

      const intervalsGroup = this.renderer.createGroup();
      this.renderer.drawPath(path, intervalPath.brush, intervalsGroup);
      const intervalsElement = intervalsGroup.getElement();

      const intervalToken = IdutilsToken.PATH_INTERVAL;
      const intervalsId = generateId([intervalToken, serieIndex, i]);
      const pathIntervalsDrawingGroup =
        this.drawingGroupInfo![intervalToken]!.drawingGroup;
      this.drawElement(
        pathIntervalsDrawingGroup,
        intervalsId,
        intervalsElement,
      );
    }
  }

  /**
   * Draws a datum according to its type.
   * @param serie The serie the point belongs to.
   * @param serieIndex The index of the serie the point belongs to.
   * @param datum The datum to draw.
   * @param datumIndex The index of the datum within the serie.
   * @param interpolateNulls Whether this chart has the interpolateNulls option set to true.
   */
  private drawDatum(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    datum: chartDefinitionTypes.DatumDefinition | null,
    datumIndex: number,
    interpolateNulls?: boolean,
  ) {
    if (
      serie.type === SerieType.BARS ||
      serie.type === SerieType.STEPPED_AREA
    ) {
      this.drawBar(serie, serieIndex, datum, datumIndex);
    } else if (serie.type === SerieType.CANDLESTICKS) {
      this.drawCandlestick(serie, serieIndex, datum, datumIndex);
    } else if (serie.type === SerieType.BOXPLOT) {
      this.drawBoxplot(serie, serieIndex, datum, datumIndex);
    } else if (serie.type === SerieType.BUBBLES) {
      this.drawBubble(serie, serieIndex, datum, datumIndex);
    } else {
      this.drawPoint(serie, serieIndex, datum, datumIndex, interpolateNulls);
    }
  }

  /**
   * Draws a bubble serie.
   * @param serie The serie to draw.
   * @param serieIndex The index of the serie.
   */
  private drawBubbleSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
  ) {
    const bubblesGroup =
      this.drawingGroupInfo![IdutilsToken.BUBBLE]!.drawingGroup;

    const bubbleIndices = rangeMap(serie.points.length, (i) => i);
    if (serie.sortBySize) {
      // If sortBySize is true, we sort the bubbles by their size, in descending
      // order, to achieve the effect of larger bubbles drawn behind smaller
      // bubbles. This helps in avoiding cases where small bubbles are hidden
      // behind large bubbles, and/or not easily accessible.
      sort(bubbleIndices, (i1, i2) => {
        const bubble1 = serie.points[i1];
        const bubble2 = serie.points[i2];
        // Using the scaled part and not the nonScaled part because the scaled
        // part is what's changed by animation interpolation.
        const size1 = bubble1 ? bubble1.scaled!.radius || 0 : 0;
        const size2 = bubble2 ? bubble2.scaled!.radius || 0 : 0;
        return size2 - size1;
      });
    }

    for (let i = 0; i < bubbleIndices.length; i++) {
      const bubbleIndex = bubbleIndices[i];
      const bubble = serie.points[bubbleIndex];
      if (!bubble) {
        continue;
      }
      this.drawBubble(serie, serieIndex, bubble, bubbleIndex);

      assert(bubble.textStyle != null);
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'TextStyle | null' is not assignable to parameter of type 'TextStyle'.
      // @ts-ignore
      const textSize = this.renderer.getTextSize(bubble.text, bubble.textStyle);
      const bubbleRadius = bubble.scaled!.radius || 0;
      if (
        textSize.width < 2 * bubbleRadius ||
        textSize.height < 2 * bubbleRadius
      ) {
        // Draw bubble texts on top of any bubble element.
        const bubbleTextElement = this.renderer.drawText(
          bubble.text,
          bubble.scaled!.x,
          bubble.scaled!.y,
          bubble.textLength,
          TextAlign.CENTER,
          TextAlign.CENTER,
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'TextStyle | null' is not assignable to parameter of type 'TextStyle'.
          // @ts-ignore
          bubble.textStyle,
          bubblesGroup,
        );
        // The bubble text is identified the same as the bubble element.
        const bubbleID = generateId([
          IdutilsToken.BUBBLE,
          serieIndex,
          bubbleIndex,
        ]);
        // At the moment the text and bubble has the same ID so we cannot
        // register the same name twice - hence we use the renderer's function
        // directly.
        // TODO: Move the text drawing to be in the drawBubble and then make
        // both the text and the bubble children of the same group (which will
        // have the logical name).
        this.renderer.setLogicalName(bubbleTextElement, bubbleID);
      }
    }
  }

  /**
   * Draws a bar serie.
   * @param serie The serie to draw.
   * @param serieIndex The index of the serie.
   */
  private drawBarSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
  ) {
    // TODO(dlaliberte): When serie type is bars store data under 'bars' instead of
    // 'points', or alternatively always store under 'data'.
    for (let i = 0; i < serie.points.length; i++) {
      this.drawBar(serie, serieIndex, serie.points[i], i);
    }
  }

  /**
   * Draws a bar and all its related elements (glow, ring, tooltip, annotation,
   * outline, intervals), and hangs events on them.
   * @param serie The serie the point belongs to.
   * @param serieIndex The index of the serie the point belongs to.
   * @param bar The bar to draw.
   * @param barIndex The index of the bar within the serie.
   */
  private drawBar(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    bar: chartDefinitionTypes.DatumDefinition | null,
    barIndex: number,
  ) {
    if (isDatumNull(bar) || !bar!.scaled) {
      // Farewell, null bars!
      return;
    }
    assert(bar != null);

    // Create the bar element.
    // Note: bar.barBrush was bar.brush, but that should be undefined.
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'DatumDefinition | null' is not assignable to parameter of type 'DatumDefinition'.
    // @ts-ignore
    const barBrush = bar!.barBrush || getDatumBrush(bar, serie);
    assert(barBrush != null);

    const barToken =
      serie.type === SerieType.BARS
        ? IdutilsToken.BAR
        : IdutilsToken.STEPPED_AREA_BAR;
    const barID = generateId([barToken, serieIndex, barIndex]);
    const scaledBar = bar!.scaled.bar || bar!.scaled;
    assert(scaledBar?.left != null);
    const barElement = this.renderer.createRect(
      scaledBar.left,
      scaledBar.top,
      scaledBar.width,
      scaledBar.height,
      barBrush,
    );
    let barGroup = null;

    const outline = bar!.scaled.outline;
    const glow = bar!.glow;
    const ring = bar!.ring;
    if (outline || glow || ring) {
      barGroup = this.renderer.createGroup();
      this.renderer.appendChild(barGroup, barElement);

      // Draw the bar outline (STEPPED_AREA can have one for example).
      if (outline) {
        const lineBrush = bar!.lineBrush || serie.lineBrush;
        const pathSegments = PathSegments.fromVertices(outline, true);
        this.renderer.drawPath(pathSegments, lineBrush, barGroup);
      }

      if (glow) {
        // The bar group contains the bar element, the outline (if requested),
        // and all the glow levels. If the glow brushes have only a stroke
        // (transparent fill) then the order of the elements in the bar group is
        // unimportant.
        for (let i = 0; i < glow.levels.length; i++) {
          const glowRect = glow.levels[i].rect;
          this.renderer.drawRect(
            glowRect!.left,
            glowRect!.top,
            glowRect!.width,
            glowRect!.height,
            glow.levels[i].brush,
            barGroup,
          );
        }
      }

      if (ring) {
        this.renderer.drawRect(
          ring.rect.left,
          ring.rect.top,
          ring.rect.width,
          ring.rect.height,
          ring.brush,
          barGroup,
        );
      }
    }

    // The bar object we hang events on.
    const barEventTarget = barGroup ? barGroup.getElement() : barElement;
    const barsGroup = this.drawingGroupInfo![barToken]!.drawingGroup;
    this.drawElement(barsGroup, barID, barEventTarget);

    if (bar!.tooltip) {
      const tooltipID = generateId([
        IdutilsToken.TOOLTIP,
        serieIndex,
        barIndex,
      ]);
      this.queueTooltip(bar!.tooltip, tooltipID);
    }

    if (bar!.annotation) {
      this.drawAnnotation(bar!.annotation, serie, serieIndex, barIndex);
    }

    if (bar!.scaled.intervalRects) {
      this.drawIntervals(
        serie,
        serieIndex,
        barIndex,
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '{ rect: Rect; columnIndex: number; }[]' is not assignable to parameter of type '{ rect: Rect; columnIndex: number; brush: Brush; }[]'.
        // @ts-ignore
        bar!.scaled.intervalRects,
      );
    }
  }

  /**
   * Draws an area serie.
   * @param serie The serie to draw.
   * @param serieIndex The index of the serie.
   * @param isStacked True if this is a stacked chart.
   * @param interpolateNulls Whether null data points are interpolated.
   */
  private drawAreaSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    isStacked: boolean,
    interpolateNulls: boolean,
  ) {
    // Handle the case where there are no data rows.
    if (serie.points.length === 0) {
      return;
    }

    // InterpolateNulls is not supported for stacked charts.
    interpolateNulls = interpolateNulls && !isStacked;

    // Different parts of the serie may need different brushes to draw the area.
    // Here we loop over the points of the serie. Each time the brush changes,
    // we create the necessary path segments to draw the area part for the
    // previous brush. We collect all the area parts for a single brush in a
    // single path segments object, so it would ultimately be drawn as a single
    // element.

    const areaPathRanges = [];
    let areaPathRange = {start: null, end: null, brush: null};
    for (let i = 0; i <= serie.points.length; i++) {
      const point = serie.points[i];
      if (!isDatumNull(point)) {
        // As long as the point is not null, if we don't yet have a starting
        // position for the current range, set it.
        if (areaPathRange.start === null) {
          // Suppressing errors for ts-migration.
          //   TS2322: Type 'number' is not assignable to type 'null'.
          // @ts-ignore
          areaPathRange.start = i;
        } else {
          // If we already have a starting position (and the point is still not
          // null), then we need to modify our current range as long as the
          // brush hasn't changed.
          const areaBrush = getIncomingAreaBrush(point, serie);
          if (
            areaPathRange.brush === null ||
            Brush.equals(areaPathRange.brush, areaBrush)
          ) {
            // If the brush hasn't changed, or the current range doesn't have a
            // brush, update the endpoint of the range and the brush (in case
            // it's not set).
            // Suppressing errors for ts-migration.
            //   TS2322: Type 'number' is not assignable to type 'null'.
            // @ts-ignore
            areaPathRange.end = i;
            // Suppressing errors for ts-migration.
            //   TS2322: Type 'Brush' is not assignable to type 'null'.
            // @ts-ignore
            areaPathRange.brush = areaBrush;
          } else {
            // The brush for this range has changed, so add the range to our
            // list of ranges and start a new range (from the previous point).
            areaPathRanges.push(areaPathRange);
            // Suppressing errors for ts-migration.
            //   TS2322: Type 'number' is not assignable to type 'null'.
            //   TS2322: Type 'number' is not assignable to type 'null'.
            //   TS2322: Type 'Brush' is not assignable to type 'null'.
            // @ts-ignore
            areaPathRange = {start: i - 1, end: i, brush: areaBrush};
          }
        }
      } else if (!interpolateNulls || i === serie.points.length) {
        // We will be here if we get a null point. If this happens, we need to
        // start a new range (and add the current one to our list, as longs as
        // it's valid).
        // However, if interpolateNulls is on, then we don't actually want to
        // hit this block until the end, since everything is just one big range;
        // or, more accurately, a set of ranges if the brush ever changes. This
        // block doubles as a way to add the range to the list at the end of the
        // series. So we will always hit this block when i is at the point after
        // the last one.

        // If the current range is valid, add it to the list.
        if (areaPathRange.start !== null && areaPathRange.end !== null) {
          areaPathRanges.push(areaPathRange);
        }

        // If there is the possibility of more ranges in the future, reset the
        // current range.
        if (i < serie.points.length) {
          areaPathRange = {start: null, end: null, brush: null};
        }
      }
    }

    // Draw all of the area paths (one per brush) under a single group.
    const areaGroup = this.renderer.createGroup();
    for (let i = 0; i < areaPathRanges.length; i++) {
      areaPathRange = areaPathRanges[i];
      const areaPath = {
        brush: areaPathRange.brush,
        segments: new PathSegments(),
      };
      this.addAreaPathSegments(
        areaPath.segments,
        serie,
        isStacked,
        // Suppressing errors for ts-migration.
        //   TS2352: Conversion of type 'null' to type 'number' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
        // @ts-ignore
        areaPathRange.start as number,
        // Suppressing errors for ts-migration.
        //   TS2352: Conversion of type 'null' to type 'number' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
        // @ts-ignore
        areaPathRange.end as number,
      );
      this.renderer.drawPath(
        areaPath.segments,
        // Suppressing errors for ts-migration.
        //   TS2352: Conversion of type 'null' to type 'Brush' may be a mistake because neither type sufficiently overlaps with the other. If this was intentional, convert the expression to 'unknown' first.
        // @ts-ignore
        areaPath.brush as Brush,
        areaGroup,
      );
    }
    const areaID = generateId([IdutilsToken.AREA, serieIndex]);
    const areasGroup = this.drawingGroupInfo![IdutilsToken.AREA]!.drawingGroup;
    this.drawElement(areasGroup, areaID, areaGroup.getElement());

    // Draw the top line and the data points.
    // Note: In stacked mode we draw the line based on the continueTo X/Y
    // values, so we cannot simply call drawPathBasedSerie() which looks at
    // the point X/Y values.
    if (isStacked) {
      const linePathSegments = createPathSegmentsForStackedArea(serie);
      const lineID = generateId([IdutilsToken.LINE, serieIndex]);
      const lineElement = linePathSegments.createPath(this.renderer);
      let lineGroup = this.findAndRenderLonelyPoints(serie);
      if (lineElement) {
        const glow = serie.glow;
        const ring = serie.ring;
        if (glow || ring) {
          lineGroup = lineGroup || this.renderer.createGroup();
          if (glow) {
            for (let i = 0; i < glow.levels.length; i++) {
              const path = glow.levels[i].path;
              assert(path != null);
              // Suppressing errors for ts-migration.
              //   TS2345: Argument of type 'PathSegments | undefined' is not assignable to parameter of type 'PathSegments'.
              // @ts-ignore
              this.renderer.drawPath(path, glow.levels[i].brush, lineGroup);
            }
          }
          if (ring) {
            this.renderer.drawPath(ring.path, ring.brush, lineGroup);
          }
        }

        if (lineGroup) {
          this.renderer.appendChild(lineGroup, lineElement);
        }
      }

      // The line object we hang events on.
      const lineEventTarget = lineGroup ? lineGroup.getElement() : lineElement;
      if (lineEventTarget != null) {
        const linesGroup =
          this.drawingGroupInfo![IdutilsToken.LINE]!.drawingGroup;
        this.drawElement(linesGroup, lineID, lineEventTarget);
      }

      this.drawPoints(serie, serieIndex, interpolateNulls);
    } else {
      // Interpolate nulls option is currently disabled for area series.
      this.drawPathBasedSerie(serie, serieIndex, interpolateNulls);
    }
  }

  /**
   * Creates the area path segments for a part of an area serie, and adds them
   * to an existing path segments object.
   * @param areaPathSegments The path segments object to modify.
   * @param serie The serie to draw.
   * @param isStacked True if this is a stacked chart.
   * @param fromPoint The starting point of the part to draw.
   * @param toPoint The ending point of the part to draw.
   */
  private addAreaPathSegments(
    areaPathSegments: PathSegments,
    serie: chartDefinitionTypes.SerieDefinition,
    isStacked: boolean,
    fromPoint: number,
    toPoint: number,
  ) {
    // Whether all area data points are null (or serie has no points at all).
    let allPointsAreNull = true;
    // Last data point which is not null.
    let lastConcretePoint = null;
    // Path of the area (polygon).

    // Start area from the bottom of the first point.
    areaPathSegments.move(
      serie.points[fromPoint]!.scaled!.bottomFromX,
      serie.points[fromPoint]!.scaled!.bottomFromY,
    );

    // Draw the top area polygon boundary.
    for (let i = fromPoint; i <= toPoint; i++) {
      const point = serie.points[i];
      if (isDatumNull(point)) {
        continue;
      }
      // Note that null data points in area chart are no longer expected
      // to have their point.scaled.x and point.scaled.y set to null.
      assert(point?.scaled != null);
      const scaledPoint = point!.scaled;

      // Draw area path to continueTo, then if necessary to continueFrom.
      // No longer applies to null data points as well.
      areaPathSegments.addLine(
        scaledPoint!.continueToX,
        scaledPoint!.continueToY,
      );
      if (
        scaledPoint!.continueFromX !== scaledPoint!.continueToX ||
        scaledPoint!.continueFromY !== scaledPoint!.continueToY
      ) {
        areaPathSegments.addLine(
          scaledPoint!.continueFromX,
          scaledPoint!.continueFromY,
        );
      }
      if (scaledPoint!.x != null && scaledPoint!.y != null) {
        allPointsAreNull = false;
        lastConcretePoint = i;
      }
    }

    // No point drawing an area with no points (pun intended).
    if (allPointsAreNull) {
      return;
    }

    // Draw the bottom area polygon boundary.
    if (isStacked) {
      // For stacked area chart we complete the area path by going over the
      // points at the bottom of the area.
      for (let i = toPoint; i >= fromPoint; i--) {
        const scaledPoint = serie.points[i]!.scaled;
        // Draw line to bottomTo, then if necessary to bottomFrom.
        // Applies to null data points as well.
        areaPathSegments.addLine(
          scaledPoint!.bottomToX,
          scaledPoint!.bottomToY,
        );
        if (
          scaledPoint!.bottomFromX !== scaledPoint!.bottomToX ||
          scaledPoint!.bottomFromY !== scaledPoint!.bottomToY
        ) {
          areaPathSegments.addLine(
            scaledPoint!.bottomFromX,
            scaledPoint!.bottomFromY,
          );
        }
      }
    } else {
      // Draw line to bottomTo of last concrete point, then close the area path.
      // Note: lastConcretePoint should never be null.
      if (lastConcretePoint != null) {
        const scaledPoint = serie.points[lastConcretePoint]!.scaled;
        areaPathSegments.addLine(
          scaledPoint!.bottomToX,
          scaledPoint!.bottomToY,
        );
        areaPathSegments.close();
      }
    }
  }

  /**
   * Looks for lonely points (points that are surrounded by null points) in the
   * series and renders them onto a new drawing group if it finds any.
   * @param serie The serie to draw the path for.
   * @return The drawing group with the lonely points, or null if none were found.
   */
  private findAndRenderLonelyPoints(
    serie: chartDefinitionTypes.SerieDefinition,
  ): DrawingGroup | null {
    let pathGroup: AnyDuringAssistedMigration = null;
    let lonelyPointBrush: AnyDuringAssistedMigration = null;

    // This forEach will iterate over each point and find lonely points, that is
    // points that don't have any sensible value to their left or to their
    // right, and will therefore not have a line going to or from them.
    // If it finds a lonely point, it will initialize the pathGroup and
    // lonelyPointBrush, and will draw a circle of lineWidth where that point
    // is.
    // All the code below takes the possibility of the group being initialized
    // into account.
    forEach(
      serie.points,
      (point, pointIndex) => {
        if (isLonelyPoint(serie, pointIndex)) {
          if (!pathGroup) {
            pathGroup = this.renderer.createGroup();
          }

          if (!lonelyPointBrush) {
            lonelyPointBrush = Brush.createFillBrush(
              serie.lineBrush!.getStroke(),
              serie.lineBrush!.getStrokeOpacity(),
            );
          }
          if (point && !isDatumVisible(point, serie)) {
            this.renderer.drawCircle(
              point.scaled!.x,
              point.scaled!.y,
              serie.lineWidth,
              lonelyPointBrush,
              pathGroup,
            );
          }
        }
      },
      this,
    );

    return pathGroup;
  }

  /**
   * Draws a path and its points for a line/area/scatter serie.
   * TODO(dlaliberte): Hang events on the path element.
   * @param serie The serie to draw the path for.
   * @param serieIndex The index of the serie.
   * @param interpolateNulls Whether null data points are interpolated.
   */
  private drawPathBasedSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    interpolateNulls: boolean,
  ) {
    const pathID = generateId([IdutilsToken.LINE, serieIndex]);
    if (serie.lineWidth <= 0) {
      // No logic in drawing a line of zero width.
      // However, if this line replaces an existing one, delete the existing
      // one.
      this.deleteElementByID(pathID);
      // Draw the data points and you're done.
      this.drawPoints(serie, serieIndex);
      return;
    }

    const pathSegments = createPathSegments(serie, interpolateNulls);
    if (isEmpty(pathSegments.segments)) {
      // No point in drawing a line with no points.
      // TODO(dlaliberte): In fact, we may want to delete the existing line.
      return;
    }

    const pathElement = pathSegments.createPath(this.renderer);

    // If interpolateNulls is not on, then we need to find and render all the
    // lonely points. However, if it is on, then all the lonely points have
    // lines leading to them and are not so lonely anymore. However, when we
    // don't have a path element, then we should try to render the lonely points
    // anyway, as we might have missed one point (that won't be rendered when
    // interpolateNulls is true).
    let pathGroup =
      pathElement && interpolateNulls
        ? null
        : this.findAndRenderLonelyPoints(serie);

    if (pathElement) {
      const glow = serie.glow;
      const ring = serie.ring;
      if (glow || ring) {
        if (!pathGroup) {
          pathGroup = this.renderer.createGroup();
        }

        // We definitely have a non-null pathGroup here. Tell the compiler.
        assert(pathGroup != null);

        if (glow) {
          for (let i = 0; i < glow.levels.length; i++) {
            const path = glow.levels[i].path;
            assert(path != null);
            // Suppressing errors for ts-migration.
            //   TS2345: Argument of type 'PathSegments | undefined' is not assignable to parameter of type 'PathSegments'.
            // @ts-ignore
            this.renderer.drawPath(path, glow.levels[i].brush, pathGroup);
          }
        }
        if (ring) {
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'DrawingGroup | null' is not assignable to parameter of type 'DrawingGroup'.
          // @ts-ignore
          this.renderer.drawPath(ring.path, ring.brush, pathGroup);
        }
      }

      if (pathGroup) {
        this.renderer.appendChild(pathGroup, pathElement);
      }
    }

    // The path object we hang events on.
    const pathEventTarget = pathGroup ? pathGroup.getElement() : pathElement;
    if (pathEventTarget != null) {
      const linesGroup =
        this.drawingGroupInfo![IdutilsToken.LINE]!.drawingGroup;
      this.drawElement(linesGroup, pathID, pathEventTarget);
    }

    // Draw the data points.
    this.drawPoints(serie, serieIndex, interpolateNulls);
  }

  /**
   * For some chart types, draws a line between old and new data
   * to highlight change. Used in diff charts.
   * @param chartDef The chart definition.
   * @param drawingGroup drawing group for lines.
   */
  private drawLinesBetweenOldAndNewData(
    chartDef: ChartDefinition,
    drawingGroup: DrawingGroup,
  ) {
    // Traverses all points in pairs of series with old and new data, and
    // draw a line between each corresponding point (old data -> new data).
    for (
      let serieIndex = 0, lenSeries = chartDef.series.length;
      serieIndex < lenSeries;
      serieIndex += 2
    ) {
      const oldDataSerie = chartDef.series[serieIndex];
      const newDataSerie = chartDef.series[serieIndex + 1];

      // At this point, series pair should have the same number of points.
      const numberOfPoints = oldDataSerie.points.length;
      assert(numberOfPoints === newDataSerie.points.length);

      // Skips serie with no point in it.
      if (numberOfPoints === 0) {
        continue;
      }

      // Creates brush for line: uses old data serie color and opacity, slightly
      // faded out.
      const color = oldDataSerie.pointBrush.getFill();
      const opacity = oldDataSerie.pointBrush.getFillOpacity();

      // Stroke width is set afterwards.
      const brush = new Brush({
        stroke: color,
        strokeOpacity: opacity,
        strokeWidth: 1,
      });

      for (let pointIndex = 0; pointIndex < numberOfPoints; pointIndex++) {
        const oldDataPoint = oldDataSerie.points[pointIndex];
        const newDataPoint = newDataSerie.points[pointIndex];

        // Farewell, null points!
        if (isDatumNull(oldDataPoint) || !oldDataPoint!.scaled) {
          assert(isDatumNull(newDataPoint) || !newDataPoint!.scaled);
          continue;
        }
        assert(!isDatumNull(newDataPoint) && newDataPoint!.scaled != null);

        // Draws line from old data to new data.
        const x1 = oldDataPoint!.scaled.x;
        const y1 = oldDataPoint!.scaled.y;
        const x2 = newDataPoint!.scaled!.x;
        const y2 = newDataPoint!.scaled!.y;

        this.renderer.drawLine(x1, y1, x2, y2, brush, drawingGroup);
      }
    }
  }

  /**
   * Draws all data points of a serie.
   * @param serie The serie to draw the points for.
   * @param serieIndex The index of the serie.
   * @param interpolateNulls Whether this chart has the interpolateNulls option set to true.
   */
  private drawPoints(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    interpolateNulls?: boolean,
  ) {
    for (let i = 0; i < serie.points.length; i++) {
      this.drawPoint(serie, serieIndex, serie.points[i], i, interpolateNulls);
    }
  }

  /**
   * Check if a point overlaps the chart area.
   * @param pointCenter The x,y coordinate of the point's center.
   * @param pointRadius The radius of the point.
   * @return true if overlaps, false otherwise.
   */
  private isPointInsideViewWindow(
    pointCenter: {x: number; y: number},
    pointRadius: number,
  ): boolean {
    const chartArea = this.chartDefinition!.chartArea;
    // Check if the point's bounding box is completely outside the chart.
    if (
      pointCenter.x - pointRadius >= chartArea.right ||
      pointCenter.x + pointRadius <= chartArea.left ||
      pointCenter.y - pointRadius >= chartArea.bottom ||
      pointCenter.y + pointRadius <= chartArea.top
    ) {
      // Point is completely out of the chart area.
      return false;
    }
    // Check if the point's center is not inside the chart.
    if (
      (pointCenter.x >= chartArea.right || pointCenter.x <= chartArea.left) &&
      (pointCenter.y >= chartArea.bottom || pointCenter.y <= chartArea.top)
    ) {
      // The point is near the corners of the chart.
      // Check its intersections with the corners.
      const r2 = pointRadius * pointRadius;
      const xr = pointCenter.x - chartArea.right;
      const xl = pointCenter.x - chartArea.left;
      const yb = pointCenter.y - chartArea.bottom;
      const yt = pointCenter.y - chartArea.top;
      const xr2 = xr * xr;
      const xl2 = xl * xl;
      const yb2 = yb * yb;
      const yt2 = yt * yt;
      // Point has no intersection with any of the chart's corners when the
      // center of the point is not close to any corner: (x - right)^2 + (y -
      // bottom)^2 >= r^2 && (x - right)^2 + (y - top)^2 >= r^2 && (x - left)^2
      // + (y - top)^2 >= r^2 && (x - left)^2 + (y - bottom)^2 >= r^2 We use >=
      // because only if there is less than pointRadius between the center and a
      // corner there will be a part of the point that intersects the chart
      // area.
      if (
        xr2 + yb2 >= r2 &&
        xr2 + yt2 >= r2 &&
        xl2 + yt2 >= r2 &&
        xl2 + yb2 >= r2
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Draws a data point and all its related elements (ring, tooltip, annotation,
   * intervals), and hangs events on them.
   * @param serie The serie the point belongs to.
   * @param serieIndex The index of the serie the point belongs to.
   * @param point The point to draw.
   * @param pointIndex The index of the point within the serie.
   * @param interpolateNulls Whether this chart has the interpolateNulls option set to true.
   */
  private drawPoint(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    point: chartDefinitionTypes.DatumDefinition | null,
    pointIndex: number,
    interpolateNulls?: boolean,
  ) {
    const pointsGroup =
      this.drawingGroupInfo![IdutilsToken.POINT]!.drawingGroup;
    const sensitivityAreasGroup =
      this.drawingGroupInfo![IdutilsToken.POINT_SENSITIVITY_AREA]!.drawingGroup;
    this.drawPointOrBubble(
      serie,
      serieIndex,
      point,
      pointIndex,
      pointsGroup,
      sensitivityAreasGroup,
      interpolateNulls,
    );
  }

  /**
   * Draws a bubble and all its related elements (ring, tooltip), and hangs
   * events on them.
   * @param serie The serie the bubble belongs to.
   * @param serieIndex The index of the serie the bubble belongs to.
   * @param point The bubble to draw.
   * @param pointIndex The index of the bubble within the serie.
   */
  private drawBubble(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    point: chartDefinitionTypes.DatumDefinition | null,
    pointIndex: number,
  ) {
    const bubblesGroup =
      this.drawingGroupInfo![IdutilsToken.BUBBLE]!.drawingGroup;
    this.drawPointOrBubble(
      serie,
      serieIndex,
      point,
      pointIndex,
      bubblesGroup,
      null,
    );
  }

  /**
   * Creates a point element, and the crosshair, glow, and ring of the point, as
   * necessary. Returns either the point element, or the element of the group.
   * @param point The point/bubble to draw.
   * @param radius The radius of the point.
   * @param brush The brush for the point.
   * @return Either the point element, or the group element which contains the point, as well as all the other components of it.
   */
  private createPoint(
    point: chartDefinitionTypes.DatumDefinition,
    radius: number,
    brush: Brush,
  ): Element {
    let pointGroup = null;

    const ring = point.ring;
    const glow = point.glow;
    const crosshair = point.crosshair;
    if (ring || glow || crosshair) {
      pointGroup = this.renderer.createGroup();
    }

    if (crosshair) {
      this.renderer.drawPath(
        crosshair.path,
        crosshair.brush,
        pointGroup as DrawingGroup,
      );
    }

    let shape = point.shape;
    if (!shape || !shape.type) {
      shape = {'type': 'circle'} as chartDefinitionTypes.NamedPointShape;
    }

    if (ring) {
      // If the ring brush fill is not transparent then it is important to
      // draw it behind the point itself.
      this.drawMarker(
        ring.x,
        ring.y,
        ring.radius + 0.5,
        ring.brush,
        shape,
        pointGroup,
      );
    }

    if (glow) {
      // The point group contains the point element and all the glow levels.
      // If the glow brushes have only a stroke (transparent fill) then the
      // order of the elements in the point group is unimportant.
      for (let i = 0; i < glow.levels.length; i++) {
        const radius = glow.levels[i].radius || 0;
        this.drawMarker(
          glow.x,
          glow.y,
          radius,
          glow.levels[i].brush,
          shape,
          pointGroup,
        );
      }
    }

    // Draw the point after we've drawn the glow and the ring, ensuring the
    // correct z-indexing, regardless of renderer.
    const pointElement = this.drawMarker(
      point.scaled!.x,
      point.scaled!.y,
      radius,
      brush,
      shape,
    );
    if (pointGroup) {
      this.renderer.appendChild(pointGroup, pointElement);
    }

    return pointGroup ? pointGroup.getElement() : pointElement;
  }

  /**
   * Draws a data point or bubble and all its related elements (ring, tooltip,
   * annotation, intervals), and hangs events on them.
   * @param serie The serie the point/bubble belongs to.
   * @param serieIndex The index of the serie the point/bubble belongs to.
   * @param point The point/bubble to draw.
   * @param pointIndex The index of the point/bubble within the serie.
   * @param pointsDrawingGroup The drawing group for the points/bubbles.
   * @param sensitivityAreasDrawingGroup The drawing group for the sensitivity areas.
   * @param interpolateNulls Whether this chart has the interpolateNulls option set to true.
   */
  private drawPointOrBubble(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    point: chartDefinitionTypes.DatumDefinition | null,
    pointIndex: number,
    pointsDrawingGroup: DrawingGroup,
    sensitivityAreasDrawingGroup: DrawingGroup | null,
    interpolateNulls?: boolean,
  ) {
    // TODO(dlaliberte): If the point should not be drawn (null, invisible or
    // outside the chart area) as a result of interaction, then we need to
    // delete the existing point element. However, calling deleteElementByID()
    // will cause the point to lose its original z-index on the next call to
    // drawElement() - it will be placed on top of all other points.
    if (isDatumNull(point) || !point!.scaled) {
      // Farewell, null points!
      return;
    }

    // Point radius including the stroke.
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'DatumDefinition | null' is not assignable to parameter of type 'DatumDefinition'.
    // @ts-ignore
    const pointTotalRadius = getPointTotalRadius(point, serie);
    assert(pointTotalRadius != null);

    // Points that are entirely outside the chart area are treated the same way
    // as null points.
    if (!this.isPointInsideViewWindow(point!.scaled, pointTotalRadius)) {
      return;
    }

    const pointOrBubble =
      serie.type === SerieType.BUBBLES
        ? IdutilsToken.BUBBLE
        : IdutilsToken.POINT;
    const pointID = generateId([pointOrBubble, serieIndex, pointIndex]);

    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'DatumDefinition | null' is not assignable to parameter of type 'DatumDefinition'.
    // @ts-ignore
    const pointIsVisible = isDatumVisible(point, serie);
    assert(pointIsVisible != null);
    // No need to draw invisible points, their rings or their glow.
    if (pointIsVisible) {
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'DatumDefinition | null' is not assignable to parameter of type 'DatumDefinition'.
      // @ts-ignore
      const pointBrush = getDatumBrush(point, serie);
      // Point radius without the stroke.
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'DatumDefinition | null' is not assignable to parameter of type 'DatumDefinition'.
      // @ts-ignore
      const pointRadius = getPointRadius(point, serie);
      assert(pointRadius != null);

      this.drawElement(
        pointsDrawingGroup,
        pointID,
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'DatumDefinition | null' is not assignable to parameter of type 'DatumDefinition'.
        // @ts-ignore
        this.createPoint(point, pointRadius, pointBrush),
      );
    } else {
      // If this point replaces an existing one, delete the existing one.
      this.deleteElementByID(pointID);
    }

    // Tooltips, annotations and intervals can also be drawn on invisible
    // points.

    if (point!.tooltip) {
      const tooltipID = generateId([
        IdutilsToken.TOOLTIP,
        serieIndex,
        pointIndex,
      ]);
      this.queueTooltip(point!.tooltip, tooltipID);
    }
    if (point!.annotation) {
      this.drawAnnotation(point!.annotation, serie, serieIndex, pointIndex);
    }

    if (point!.scaled.intervalRects) {
      this.drawIntervals(
        serie,
        serieIndex,
        pointIndex,
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '{ rect: Rect; columnIndex: number; }[]' is not assignable to parameter of type '{ rect: Rect; columnIndex: number; brush: Brush; }[]'.
        // @ts-ignore
        point!.scaled.intervalRects,
      );
    }
  }

  /**
   * Draws a candlestick serie.
   * @param serie The serie to draw.
   * @param serieIndex The index of the serie.
   */
  private drawCandlestickSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
  ) {
    for (let i = 0; i < serie.points.length; i++) {
      this.drawCandlestick(serie, serieIndex, serie.points[i], i);
    }
  }

  /**
   * Draws a boxplot serie.
   * @param serie The serie to draw.
   * @param serieIndex The index of the serie.
   */
  private drawBoxplotSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
  ) {
    for (let i = 0; i < serie.points.length; i++) {
      this.drawBoxplot(serie, serieIndex, serie.points[i], i);
    }
  }

  /**
   * Draws a candlestick and all its related elements (tooltip, annotation), and
   * hangs events on them.
   * @param serie The serie the candlestick belongs to.
   * @param serieIndex The index of the serie the candlestick belongs to.
   * @param candlestick The candlestick to draw.
   * @param candlestickIndex The index of the candlestick within the serie.
   */
  private drawCandlestick(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    candlestick: chartDefinitionTypes.DatumDefinition | null,
    candlestickIndex: number,
  ) {
    if (!candlestick || !candlestick.scaled) {
      // Farewell, null candlesticks!
      return;
    }
    assert(candlestick.barBrush != null);
    assert(candlestick.lineBrush != null);

    const lineElement = this.renderer.createRect(
      candlestick.scaled.line!.left,
      candlestick.scaled.line!.top,
      candlestick.scaled.line!.width,
      candlestick.scaled.line!.height,
      candlestick.lineBrush,
    );

    const barElement = this.renderer.createRect(
      candlestick.scaled.rect.left,
      candlestick.scaled.rect.top,
      candlestick.scaled.rect.width,
      candlestick.scaled.rect.height,
      candlestick.barBrush,
    );

    const candlestickGroup = this.renderer.createGroup();
    this.renderer.appendChild(candlestickGroup, lineElement);
    this.renderer.appendChild(candlestickGroup, barElement);

    const glow = candlestick.glow;
    if (glow) {
      for (let i = 0; i < glow.levels.length; i++) {
        const glowRect = glow.levels[i].rect;
        this.renderer.drawRect(
          glowRect!.left,
          glowRect!.top,
          glowRect!.width,
          glowRect!.height,
          glow.levels[i].brush,
          candlestickGroup,
        );
      }
    }

    const ring = candlestick.ring;
    if (ring) {
      this.renderer.drawRect(
        ring.rect.left,
        ring.rect.top,
        ring.rect.width,
        ring.rect.height,
        ring.brush,
        candlestickGroup,
      );
    }

    const candlestickToken = IdutilsToken.CANDLESTICK;
    const candlestickID = generateId([
      candlestickToken,
      serieIndex,
      candlestickIndex,
    ]);
    const candlesticksGroup =
      this.drawingGroupInfo![candlestickToken]!.drawingGroup;
    this.drawElement(
      candlesticksGroup,
      candlestickID,
      candlestickGroup.getElement(),
    );

    if (candlestick.tooltip) {
      const tooltipID = generateId([
        IdutilsToken.TOOLTIP,
        serieIndex,
        candlestickIndex,
      ]);
      this.queueTooltip(candlestick.tooltip, tooltipID);
    }
  }

  /**
   * Draws a Boxplot and all its related elements (tooltip, annotation), and
   * hangs events on them.
   * @param serie The serie the boxplot belongs to.
   * @param serieIndex The index of the serie the boxplot belongs to.
   * @param boxplot The boxplot to draw.
   * @param boxplotIndex The index of the boxplot within the serie.
   */
  private drawBoxplot(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    boxplot: chartDefinitionTypes.DatumDefinition | null,
    boxplotIndex: number,
  ) {
    if (!boxplot || !boxplot.scaled) {
      // Farewell, null boxplot!
      return;
    }
    assert(boxplot.barBrush != null);
    assert(boxplot.lineBrush != null);

    const lineElement = this.renderer.createRect(
      boxplot.scaled.line!.left,
      boxplot.scaled.line!.top,
      boxplot.scaled.line!.width,
      boxplot.scaled.line!.height,
      boxplot.lineBrush,
    );

    const bottomBarElement = this.renderer.createRect(
      boxplot.scaled.bottomRect.left,
      boxplot.scaled.bottomRect.top,
      boxplot.scaled.bottomRect.width,
      boxplot.scaled.bottomRect.height,
      boxplot.barBrush,
    );

    const topBarElement = this.renderer.createRect(
      boxplot.scaled.topRect.left,
      boxplot.scaled.topRect.top,
      boxplot.scaled.topRect.width,
      boxplot.scaled.topRect.height,
      boxplot.barBrush,
    );

    const boxplotGroup = this.renderer.createGroup();
    this.renderer.appendChild(boxplotGroup, lineElement);
    this.renderer.appendChild(boxplotGroup, bottomBarElement);
    this.renderer.appendChild(boxplotGroup, topBarElement);

    const glow = boxplot.glow;
    if (glow) {
      for (let i = 0; i < glow.levels.length; i++) {
        const glowRect = glow.levels[i].rect;
        this.renderer.drawRect(
          glowRect!.left,
          glowRect!.top,
          glowRect!.width,
          glowRect!.height,
          glow.levels[i].brush,
          boxplotGroup,
        );
      }
    }

    const ring = boxplot.ring;
    if (ring) {
      this.renderer.drawRect(
        ring.rect.left,
        ring.rect.top,
        ring.rect.width,
        ring.rect.height,
        ring.brush,
        boxplotGroup,
      );
    }

    const boxplotToken = IdutilsToken.BOXPLOT;
    const boxplotID = generateId([boxplotToken, serieIndex, boxplotIndex]);
    const boxplotsGroup = this.drawingGroupInfo![boxplotToken]!.drawingGroup;
    this.drawElement(boxplotsGroup, boxplotID, boxplotGroup.getElement());

    if (boxplot.tooltip) {
      const tooltipID = generateId([
        IdutilsToken.TOOLTIP,
        serieIndex,
        boxplotIndex,
      ]);
      this.queueTooltip(boxplot.tooltip, tooltipID);
    }
  }

  /**
   * Draws the annotation for the given point, if exists.
   * @param annotation the annotation to draw.
   * @param serie The serie the annotation belongs to.
   * @param serieIndex The serie index (or null for category annotation).
   * @param categoryIndex The category index.
   */
  private drawAnnotation(
    annotation: chartDefinitionTypes.Annotation | null,
    serie: chartDefinitionTypes.SerieDefinition | null,
    serieIndex: number | null,
    categoryIndex: number,
  ) {
    if (!annotation) {
      return;
    }

    const stem = annotation.stem;
    const chartArea = this.chartDefinition!.chartArea;
    if (!stem || stem.x < chartArea.left || stem.x > chartArea.right) {
      // The stem line is out of the chart area.
      return;
    }

    let labels = annotation.labels;
    if (!labels || isEmpty(labels)) {
      return;
    }

    let idTokens = [IdutilsToken.ANNOTATION, categoryIndex];
    // The serieIndex may be null, which becomes an empty string in the id.
    insertAt(idTokens, serieIndex, 1);
    const annotationID = generateId(idTokens);

    // Draw stem line.
    const annotationGroup = this.createAxisAlignedLine(
      stem.orientation,
      stem.x,
      stem.y,
      stem.length,
      stem.color,
    );
    this.drawElement(
      this.drawingGroupInfo![IdutilsToken.ANNOTATION]!.drawingGroup,
      annotationID,
      annotationGroup,
    );

    // Create a group that will hold either the expanded annotation labels or
    // the bundle label (a visual indication that the annotations are
    // collapsed).
    const annotationTextGroup = this.renderer.createGroup();
    idTokens = [IdutilsToken.ANNOTATION_TEXT, categoryIndex];
    insertAt(idTokens, serieIndex, 1);

    // If the annotations are collapsed, draw only the bundle label.
    let annotationIndex = null;
    if (annotation.bundle && !annotation.bundle.isExpanded) {
      labels = [annotation.bundle.label];
      // Mark the bundle label as annotation index -1. This is later used by
      // the event handler to identify a click that expands the bundle.
      annotationIndex = -1;
    }

    // Draw the entire bundle (collapsed or expanded).
    const rect = this.renderer.disableClipping();
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      // Draw annotation text and always add a sensitivity area.
      const annotationLabelGroup = this.createTextBlock(label, true);
      if (annotationLabelGroup) {
        // Open an SVG/HTML tooltip, not the yellow one closure adds on text
        // elements. This is why we use tooltipHtml instead of tooltip.
        if (label.tooltipHtml) {
          // For category annotations we pass null as serieIndex.
          // The generated ID will have two consequent dots: 'tooltip..i.j'.
          // We cannot omit the series index as 'tooltip.i.j' would be
          // ambiguous: it may be either a tooltip for a datum, or for a
          // category annotation.
          const tooltipID = generateId([
            IdutilsToken.TOOLTIP,
            serieIndex,
            categoryIndex,
            i,
          ]);
          this.queueTooltip(label.tooltipHtml, tooltipID);
        }
        this.renderer.appendChild(annotationTextGroup, annotationLabelGroup);
        const labelIdTokens = clone(idTokens);
        labelIdTokens.push(annotationIndex || i);
        const annotationLabelID = generateId(labelIdTokens);
        this.registerElement(annotationLabelGroup, annotationLabelID);
      }
    }
    this.renderer.describeClipRegion(rect);
    const annotationBundleID = generateId(idTokens);
    this.drawElement(
      this.drawingGroupInfo![IdutilsToken.ANNOTATION_TEXT]!.drawingGroup,
      annotationBundleID,
      annotationTextGroup.getElement(),
    );
  }

  /**
   * Creates a line that is either horizontal or vertical starting at a given
   * point and ending some distance above it / below it / to its right / to its
   * left.
   * @param orientation The orientation of the line.
   * @param x The starting point x value.
   * @param y The starting point y value.
   * @param length The signed length.
   * @param color the line color.
   * @return The created element.
   */
  private createAxisAlignedLine(
    orientation: Orientation | null,
    x: number,
    y: number,
    length: number,
    color: string,
  ): Element {
    const v =
      orientation === Orientation.HORIZONTAL ? [length, 1] : [1, length];
    return this.renderer.createRect(
      Math.min(x, x + v[0]),
      Math.min(y, y + v[1]),
      Math.abs(v[0]),
      Math.abs(v[1]),
      new Brush({fill: color}),
    );
  }

  /**
   * Draws the interval-marks for the given point, if any.
   * @param serie the serie that the arks belong to.
   * @param serieIndex index of the serie.
   * @param datumIndex index of the point in the serie.
   * @param intervalRects Array of rectangles to draw as intervals. If the width or eight is zero, then the rectangle is drawn as a line; if both are zero then t is drawn as a point.
   * @return drawn interval marks.
   * /
   */
  private drawIntervals(
    serie: chartDefinitionTypes.SerieDefinition,
    serieIndex: number,
    datumIndex: number,
    intervalRects: Array<{rect: Rect; columnIndex: number; brush: Brush}>,
  ): Element | null {
    if (serie.intervals == null) {
      return null;
    }

    const intervalsGroup = this.renderer.createGroup();

    const settingsOfColumn = serie.intervals.settings;

    for (let i = 0; i < intervalRects.length; i++) {
      const columnIndex = intervalRects[i].columnIndex;
      const rect = intervalRects[i].rect;
      const settings = settingsOfColumn[columnIndex];
      if (
        !settings ||
        settings.style === IntervalStyle.AREA ||
        settings.style === IntervalStyle.LINE
      ) {
        continue;
      }
      const brush = intervalRects[i].brush;
      if (rect.width === 0 && rect.height === 0) {
        // Point interval.
        const pointRadius = settings.pointSize / 2;
        if (pointRadius > 0) {
          const point = this.renderer.createCircle(
            rect.left,
            rect.top,
            pointRadius,
            brush,
          );
          this.renderer.appendChild(intervalsGroup, point);
        }
      } else if (rect.width === 0 || rect.height === 0) {
        // Line interval (stick or bar).
        const path = new PathSegments();
        path.move(rect.left, rect.top);
        path.addLine(rect.left + rect.width, rect.top + rect.height);
        this.renderer.drawPath(path, brush, intervalsGroup);
      } else {
        // Box interval.
        this.renderer.appendChild(
          intervalsGroup,
          this.renderer.createRect(
            rect.left,
            rect.top,
            rect.width,
            rect.height,
            brush,
          ),
        );
      }
    }

    if (!intervalsGroup.isElementCreated()) {
      return null;
    }

    const intervalToken = IdutilsToken.INTERVAL;
    const intervalsId = generateId([intervalToken, serieIndex, datumIndex]);
    const intervalsElement = intervalsGroup.getElement();
    this.drawElement(
      this.drawingGroupInfo![intervalToken]!.drawingGroup,
      intervalsId,
      intervalsElement,
    );
    return intervalsElement;
  }

  /**
   * Draws the gridlines and the baseline of a horizontal axis.
   * Note that the lines determined by a horizontal axis are themselves
   * vertical.
   * @param chartDef The chart definition.
   * @param axisDef The definition of the axis to draw.
   */
  drawHorizontalAxisLines(chartDef: ChartDefinition, axisDef: AxisDefinition) {
    // Note that drawAxisGridlineElement and drawAxisTicklineElement are
    // almost the same now, but they are likely to differ in the future.
    const drawAxisGridlineElement = (
      tickline: AnyDuringAssistedMigration,
      drawingGroup: AnyDuringAssistedMigration,
    ) => {
      // Tick lines are floored (and not rounded) so that they will contain
      // their un-rounded coordinate.
      const x = Math.floor(tickline.coordinate);
      const length =
        tickline.length != null ? tickline.length : chartDef.chartArea.height;
      const y1 = axisDef.ticklinesOrigin.coordinate;
      const y2 = y1 + axisDef.ticklinesOrigin.direction * length;
      const y = Math.min(y1, y2);
      return this.renderer.drawRect(
        x,
        y,
        1,
        length,
        tickline.brush,
        drawingGroup,
      );
    };

    const drawAxisTicklineElement = (
      tickline: AnyDuringAssistedMigration,
      drawingGroup: AnyDuringAssistedMigration,
    ) => {
      // Tick lines are floored (and not rounded) so that they will contain
      // their un-rounded coordinate.
      const x = Math.floor(tickline.coordinate);
      const length =
        tickline.length != null ? tickline.length : chartDef.chartArea.bottom;
      const y1 = axisDef.ticklinesOrigin.coordinate;
      const y2 = y1 - axisDef.ticklinesOrigin.direction * length;
      const y = Math.min(y1, y2);
      return this.renderer.drawRect(
        x,
        y,
        1,
        length,
        tickline.brush,
        drawingGroup,
      );
    };

    this.drawAxisLines(
      axisDef,
      drawAxisGridlineElement,
      drawAxisTicklineElement,
    );
  }

  /**
   * Draws the gridlines and the baseline of a vertical axis.
   * Note that the lines determined by a vertical axis are themselves
   * horizontal.
   * @param chartDef The chart definition.
   * @param axisDef The definition of the axis to draw.
   */
  drawVerticalAxisLines(chartDef: ChartDefinition, axisDef: AxisDefinition) {
    const drawAxisGridlineElement = (
      tickline: AnyDuringAssistedMigration,
      drawingGroup: AnyDuringAssistedMigration,
    ) => {
      // Tick lines are floored (and not rounded) so that they will contain
      // their un-rounded coordinate.
      const y = Math.floor(tickline.coordinate);
      const length =
        tickline.length != null ? tickline.length : chartDef.chartArea.width;
      const x1 = axisDef.ticklinesOrigin.coordinate;
      const x2 = x1 + axisDef.ticklinesOrigin.direction * length;
      const x = Math.min(x1, x2);
      return this.renderer.drawRect(
        x,
        y,
        length,
        1,
        tickline.brush,
        drawingGroup,
      );
    };

    const drawAxisTicklineElement = (
      tickline: AnyDuringAssistedMigration,
      drawingGroup: AnyDuringAssistedMigration,
    ) => {
      // Tick lines are floored (and not rounded) so that they will contain
      // their un-rounded coordinate.
      const y = Math.floor(tickline.coordinate);
      const length =
        tickline.length != null ? tickline.length : chartDef.chartArea.left; // TODO: chartArea.right
      const x1 = axisDef.ticklinesOrigin.coordinate;
      const x2 = x1 - axisDef.ticklinesOrigin.direction * length;
      const x = Math.min(x1, x2);
      return this.renderer.drawRect(
        x,
        y,
        length,
        1,
        tickline.brush,
        drawingGroup,
      );
    };

    this.drawAxisLines(
      axisDef,
      drawAxisGridlineElement,
      drawAxisTicklineElement,
    );
  }

  /**
   * Draws the gridlines and the baseline of an axis. The actual code that calls
   * the renderer is accepted as a callback argument.
   * @param axisDef The definition of the axis to draw.
   * @param drawAxisGridlineElement A function to draw gridline graphics element.
   * @param drawAxisTicklineElement A function to draw a tickline graphics element.
   */
  drawAxisLines(
    axisDef: AxisDefinition,
    drawAxisGridlineElement: AxisChartBuilderDrawAxisLineFunc,
    drawAxisTicklineElement: AxisChartBuilderDrawAxisLineFunc,
  ) {
    const drawFunc = (
      lines: AnyDuringAssistedMigration,
      token: AnyDuringAssistedMigration,
      drawAxisLineElement: AnyDuringAssistedMigration,
    ) => {
      if (!lines) {
        return;
      }
      const drawingGroup = this.drawingGroupInfo![token]!.drawingGroup;
      const linesID = generateId([axisDef.name, token]);
      forEach(lines, (line, index) => {
        const lineID = generateId([axisDef.name, token, index]);
        this.drawAxisLine(
          line,
          drawAxisLineElement,
          drawingGroup,
          lineID,
          linesID,
        );
      });
    };

    // Draw the grid lines.
    drawFunc(axisDef.gridlines, IdutilsToken.GRIDLINE, drawAxisGridlineElement);

    // Draw the base line.
    const baselineDrawingGroup =
      this.drawingGroupInfo![IdutilsToken.BASELINE]!.drawingGroup;
    // Suppressing errors for ts-migration.
    //   TS2322: Type 'string' is not assignable to type 'number | Token | null'.
    // @ts-ignore
    const baselineID = generateId([axisDef.name, IdutilsToken.BASELINE]);
    // The baseline may not always exist, or be visible, or have a proper value.
    if (
      axisDef.baseline &&
      axisDef.baseline.isVisible &&
      axisDef.baseline.dataValue != null &&
      axisDef.baseline.coordinate !== Infinity
    ) {
      this.drawAxisLine(
        axisDef.baseline,
        drawAxisGridlineElement,
        baselineDrawingGroup,
        baselineID,
      );
    }
  }

  /**
   * Draws a single tick line of an axis. The actual code that calls
   * the renderer is accepted as a callback argument.
   * @param tickline the tick line.
   * @param drawAxisLineElement A function to draw an axis line graphics element.
   * @param drawingGroup The drawing group.
   * @param id The ID to be associated with the element.
   * @param parentID The parent element's ID.
   */
  drawAxisLine(
    tickline: TickLine | null,
    drawAxisLineElement: AxisChartBuilderDrawAxisLineFunc,
    drawingGroup: DrawingGroup,
    id: string,
    parentID?: string,
  ) {
    if (!tickline || !tickline.isVisible || tickline.brush.isTransparent()) {
      return;
    }
    const element = drawAxisLineElement(tickline, drawingGroup);
    this.registerElement(element, id, parentID);
  }

  /**
   * Draws the axis title and ticks.
   * @param chartDef The chart definition.
   * @param axisDef The definition of the axis to draw.
   */
  drawAxisText(chartDef: ChartDefinition, axisDef: AxisDefinition) {
    const drawingGroupInfo = this.drawingGroupInfo;

    // Draw title, if any.
    if (!axisDef.title) {
      return;
    }
    const axisTitlesGroup =
      drawingGroupInfo![IdutilsToken.AXIS_TITLE]!.drawingGroup;
    const titleTextBlock = this.drawTextBlock(
      axisDef.title,
      axisTitlesGroup,
      true,
    );
    // Suppressing errors for ts-migration.
    //   TS2322: Type 'string' is not assignable to type 'number | Token | null'.
    // @ts-ignore
    const axisTitleID = generateId([axisDef.name, IdutilsToken.TITLE]);
    this.registerElement(titleTextBlock, axisTitleID);

    // Draw text, if any.
    if (!axisDef.text) {
      return;
    }
    const axisTicksGroup =
      drawingGroupInfo![IdutilsToken.AXIS_TICK]!.drawingGroup;
    // Suppressing errors for ts-migration.
    //   TS2322: Type 'string' is not assignable to type 'number | Token | null'.
    //   TS2322: Type '"label"' is not assignable to type 'number | Token | null'.
    // @ts-ignore
    const axisLabelsID = generateId([axisDef.name, 'label']);
    forEach(axisDef.text, (textItem, index) => {
      if (textItem.isVisible) {
        assert(textItem.textBlock != null);
        // Useful for debugging:
        // textItem.textBlock.boxStyle =
        //   new gviz.graphics.Brush({ stroke: 'black', strokeWidth: 1 });
        const labelTextBlock = this.drawTextBlock(
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'TextBlock | undefined' is not assignable to parameter of type 'TextBlock'.
          // @ts-ignore
          textItem.textBlock,
          axisTicksGroup,
        );
        // Suppressing errors for ts-migration.
        //   TS2322: Type 'string' is not assignable to type 'number | Token | null'.
        //   TS2322: Type '"label"' is not assignable to type 'number | Token | null'.
        // @ts-ignore
        const axisLabelID = generateId([axisDef.name, 'label', index]);
        this.registerElement(labelTextBlock, axisLabelID, axisLabelsID);
      }
    });
  }

  /**
   * An abstract method for refreshing the content of the chart.
   * Attempts refreshing the chart using a sequence of short-circuit operations,
   * but may resort to a full redraw of the chart contents when it sees fit.
   * @param baseLayer Base layer of the chart definition. Needed when resorting to a full redraw.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer specifies only the properties whose value should override the one given in the chart definition passed in the last drawChartContent() call.
   */
  protected refreshChartContent(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ) {
    // First revert all changes done in the previous call to this function, then
    // apply the changes of the new refresh layer to the original chart.
    // TODO(dlaliberte): If an element is in both the drawn and the new refresh
    // layers then we redraw it twice instead of once. If it is the same in both
    // layers then we actually redraw it twice instead of just leaving it as is.
    this.revertChartContentChanges(baseLayer);
    this.applyChartContentChanges(baseLayer, refreshLayer);
  }

  // TSJS Migration
  // tslint:disable:no-for-in-array
  // tslint:disable:forin

  /**
   * Perform a sequence of short-circuit operations to revert the visual effects
   * from the previous call to refresh. Upon return, the drawn chart will be the
   * same as the one displayed after the last call to drawChartContent().
   * @param baseLayer Base layer of the chart definition. Needed when resorting to a full redraw.
   */
  revertChartContentChanges(baseLayer: ChartDefinition) {
    // The refresh layer whose changes were previously
    //   applied to the chart and should now be reverted.
    const refreshLayer = this.drawnRefreshLayer;
    if (!refreshLayer) {
      return; // nothing to revert
    }
    // Iterate over all changed series.
    for (const serieKey in refreshLayer.series) {
      const serieIndex = Number(serieKey);
      const serie = baseLayer.series[serieIndex];
      // We refresh the serie if all altered values reside within the 'points'
      // array. Any modification to other properties of the serie definition
      // initiates a full redraw of the serie.
      // We need this hack because JSCompiler obfuscates 'points'.
      const shortCircuitedPropsObj = {points: null};
      const shortCircuitedProps = googObject.getKeys(shortCircuitedPropsObj);
      if (
        containsNoOtherProperties(
          refreshLayer.series[serieIndex],
          shortCircuitedProps,
        )
      ) {
        const changedDataPoints = refreshLayer.series[serieIndex].points;
        // Revert all changed data points in this serie.
        for (const datumKey in changedDataPoints) {
          const datumIndex = Number(datumKey);
          const changedDatum = changedDataPoints[datumIndex];
          // Close the tooltip if one is associated with the data point.
          if (changedDatum!.tooltip) {
            const tooltipID = generateId([
              IdutilsToken.TOOLTIP,
              Number(serieIndex),
              Number(datumIndex),
            ]);
            this.closeTooltip(tooltipID);
          }
          const changedAnnotation = changedDatum!.annotation;
          if (changedAnnotation) {
            for (const annotationIndex in changedAnnotation.labels) {
              // Close the tooltip if one is associated with the annotation
              // label.
              if (
                changedAnnotation.labels[Number(annotationIndex)].tooltipHtml
              ) {
                const tooltipID = generateId([
                  IdutilsToken.TOOLTIP,
                  Number(serieIndex),
                  Number(datumIndex),
                  // Suppressing errors for ts-migration.
                  //   TS2322: Type 'string' is not assignable to type 'number | Token | null'.
                  // @ts-ignore
                  annotationIndex,
                ]);
                this.closeTooltip(tooltipID);
              }
            }
          }
          // Draw original data point in place of the existing one.
          const datum = serie.points[datumIndex];
          this.drawDatum(
            serie,
            Number(serieIndex),
            datum,
            Number(datumIndex),
            refreshLayer.interpolateNulls != null
              ? refreshLayer.interpolateNulls
              : baseLayer.interpolateNulls,
          );
        }
      } else {
        for (const datumIndex in refreshLayer.series[serieIndex].points) {
          // Close the tooltip if one is associated with the data point.
          if (
            refreshLayer.series[serieIndex].points[Number(datumIndex)]!.tooltip
          ) {
            const tooltipID = generateId([
              IdutilsToken.TOOLTIP,
              Number(serieIndex),
              Number(datumIndex),
            ]);
            this.closeTooltip(tooltipID);
          }
        }
        // Draw original serie in place of the existing one.
        this.drawSerie(serie, Number(serieIndex));
      }
    }

    for (const categoryKey in refreshLayer.categories) {
      const categoryIndex = Number(categoryKey);
      const changedCategory = refreshLayer.categories[categoryIndex];
      // Close the tooltip if one is associated with the category.
      if (changedCategory.tooltip) {
        const tooltipID = generateId([
          IdutilsToken.TOOLTIP,
          Number(categoryIndex),
        ]);
        this.closeTooltip(tooltipID);
      }
      const changedAnnotation = changedCategory.annotation;
      if (changedAnnotation) {
        for (const annotationIndex in changedAnnotation.labels) {
          if (changedAnnotation.labels[Number(annotationIndex)].tooltipHtml) {
            // See comment in drawAnnotation() for why we have to specify null
            // for serieIndex, instead of just omitting it.
            const tooltipID = generateId([
              IdutilsToken.TOOLTIP,
              null,
              Number(categoryIndex),
              Number(annotationIndex),
            ]);
            this.closeTooltip(tooltipID);
          }
        }
        // Draw original category annotation in place of the existing one.
        const annotation = baseLayer.categories[categoryIndex].annotation;
        this.drawAnnotation(annotation, null, null, Number(categoryIndex));
      }
    }

    this.renderTooltips();
  }

  /**
   * Perform a sequence of short-circuit operations to apply the visual effects
   * of the refresh layer to the chart. If revertChartContentChanges_() was
   * called prior to this function, then upon return the drawn chart reflect the
   * refreshLayer precisely.
   * @param baseLayer Base layer of the chart definition. Needed when resorting to a full redraw.
   * @param refreshLayer The refresh layer whose changes should be applied to the chart.
   */
  private applyChartContentChanges(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ) {
    // Iterate over all changed series.
    for (const serieKey in refreshLayer.series) {
      const serieIndex = Number(serieKey);
      const serie = baseLayer.series[serieIndex];
      // We refresh the serie if all altered values reside within the 'points'
      // array. Any modification to other properties of the serie definition
      // initiates a full redraw of the serie.
      // We need this hack because JSCompiler obfuscates 'points'.
      const shortCircuitedPropsObj = {points: null};
      const shortCircuitedProps = googObject.getKeys(shortCircuitedPropsObj);
      if (
        containsNoOtherProperties(
          refreshLayer.series[serieIndex],
          shortCircuitedProps,
        )
      ) {
        // Redraw all changed data points in this serie.
        for (const datumKey in refreshLayer.series[serieIndex].points) {
          const datumIndex = Number(datumKey);
          // Draw new data point in place of the original one.
          const layeredDatum = new LayeredObject(2);
          layeredDatum.setLayer(0, serie.points[datumIndex]);
          layeredDatum.setLayer(
            1,
            refreshLayer.series[serieIndex].points[datumIndex],
          );
          const datum =
            layeredDatum.compact() as chartDefinitionTypes.DatumDefinition;
          this.drawDatum(
            serie,
            Number(serieIndex),
            datum,
            Number(datumIndex),
            refreshLayer.interpolateNulls,
          );
        }
      } else {
        // Draw new serie in place of the original one.
        const layeredSerie = new LayeredObject(2);
        layeredSerie.setLayer(0, serie);
        layeredSerie.setLayer(1, refreshLayer.series[serieIndex]);
        const compactSerie =
          layeredSerie.compact() as chartDefinitionTypes.SerieDefinition;
        this.drawSerie(compactSerie, Number(serieIndex));
      }
    }

    for (const categoryKey in refreshLayer.categories) {
      const categoryIndex = Number(categoryKey);
      // Open a tooltip if one is associated with the category.
      const tooltip = refreshLayer.categories[categoryIndex].tooltip;
      if (tooltip) {
        const tooltipID = generateId([
          IdutilsToken.TOOLTIP,
          Number(categoryIndex),
        ]);
        this.queueTooltip(tooltip, tooltipID);
      }
      // Redraw the category annotations if changed (e.g., bundle expanded).
      if (refreshLayer.categories[categoryIndex].annotation) {
        const layeredAnnotation = new LayeredObject(2);
        layeredAnnotation.setLayer(
          0,
          baseLayer.categories[categoryIndex].annotation,
        );
        layeredAnnotation.setLayer(
          1,
          refreshLayer.categories[categoryIndex].annotation,
        );
        const annotation =
          layeredAnnotation.compact() as chartDefinitionTypes.Annotation;
        this.drawAnnotation(annotation, null, null, Number(categoryIndex));
      }
    }

    this.renderTooltips();
  }
}

/**
 * Contains:
 * - A reference to a drawing group.
 * - The position of the drawing group: outside the chart area, inside it, or
 *   inside it and clipped to it.
 * - A flag indicating whether lazy creation is allowed for this group (assumed
 *   to be true if undefined).
 */
interface AxisChartBuilderDrawingGroupInfo {
  drawingGroup: DrawingGroup;
  position: AxisChartBuilderDrawingGroupPosition;
  allowLazyCreation: boolean | null;
}

/**
 * Enumeration of all drawing group positions: a drawing group can reside
 * outside the chart area, inside it, or inside it and be clipped to it.
 * Drawing group position.
 */
enum AxisChartBuilderDrawingGroupPosition {
  OUTSIDE = 'outside',
  INSIDE = 'inside',
  CLIPPED = 'clipped',
}

type AxisChartBuilderDrawAxisLineFunc = (
  p1: TickLine,
  p2: DrawingGroup,
) => Element;
