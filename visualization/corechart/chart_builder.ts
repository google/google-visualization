/**
 * @fileoverview ChartBuilder is in charge of drawing and refreshing the chart.
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

import * as googArray from '@npm//@closure/array/array';
import * as asserts from '@npm//@closure/asserts/asserts';
import {assert} from '@npm//@closure/asserts/asserts';
import * as dom from '@npm//@closure/asserts/dom';
import {Box} from '@npm//@closure/math/box';
import * as googMath from '@npm//@closure/math/math';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import {Vec2} from '@npm//@closure/math/vec2';
import * as googObject from '@npm//@closure/object/object';
import * as colorBarBuilder from '../../colorbar/builder';
import {LayeredObject} from '../../common/layered_object';
import * as gvizObject from '../../common/object';
import {ColorBarPosition, InOutPosition} from '../../common/option_types';
import * as util from '../../common/util';
import {calcBoundingBox as commonUtilCalcBoundingBox} from '../../common/util';
import {OverlayBox} from '../../events/chart_state';
import {Brush} from '../../graphics/brush';
import {TextStyle} from '../../text/text_style';
import * as htmlTooltipBuilder from '../../tooltip/html_builder';

import {AbstractRenderer} from '../../graphics/abstract_renderer';
import {DrawingGroup} from '../../graphics/drawing_group';
import {OverlayArea} from '../../graphics/overlay_area';
import {PathSegments} from '../../graphics/path_segments';
import {Coordinate} from '../../math/coordinate';
import {TextAlign} from '../../text/text_align';
import * as tooltipBuilder from '../../tooltip/tooltip_builder';
import {
  isHtmlTooltipDefinition,
  TooltipDefinition,
} from '../../tooltip/tooltip_definition';

import {ColorBarDefinition} from '../../colorbar/color_bar_definition';
import {
  Entry,
  LegendDefinition,
  ScrollButton,
  ScrollItems,
} from '../../legend/legend_definition';
import {calcBoundingBox, TextBlock} from '../../text/text_block_object';
import {generateId, Token} from '../../visualization/corechart/id_utils';
import {ChartDefinition} from './chart_definition';
import * as chartDefinitionTypes from './chart_definition_types';

import * as messages from '../../common/messages';
import * as textutils from '../../text/text_utils';

// Create aliases for namespaces used extensively throughout this file.

const {PointShapeType} = chartDefinitionTypes;

/**
 * ChartBuilder is in charge of drawing and refreshing the chart.
 * Note this is not the same as the ChartEditor ChartBuilder
 */
export abstract class ChartBuilder {
  /**
   * The refresh layer of the chart that is currently drawn (not BEING drawn,
   * but rather ALREADY drawn). Needed by refreshChart() to revert former
   * visual effects.
   */
  protected drawnRefreshLayer: ChartDefinition | null = null;

  /**
   * An object mapping element IDs (logical names) to drawing (SVG/VML)
   * elements that represent them.
   */
  private idToElementMapping: {[key: string]: Element} = {};

  /**
   * An object mapping group IDs (logical names) to the IDs of all elements in
   * it. A typical example is a group of all the labels belonging to a
   * specific axis. The values represent sets, but for simplicity we use
   * arrays.
   */
  private groupIDToElementIDs: {[key: string]: string[]} = {};

  /** The chart's definition. */
  protected chartDefinition: ChartDefinition | null = null;

  /**
   * The tooltip renderer group under which the tooltip is rendered. Each
   * tooltip that is created would have its own group as a child of this
   * group.
   * Renderer group for the tooltips.
   */
  private tooltipDrawingGroup: DrawingGroup | null = null;

  /**
   * The legend renderer group under which the legend is rendered.
   * Renderer group for the legend.
   */
  protected legendDrawingGroup: DrawingGroup | null = null;

  /**
   * The color-bar renderer group under which the color-bar is rendered.
   * Renderer group for the color-bar.
   */
  protected colorBarDrawingGroup: DrawingGroup | null = null;

  /**
   * @param overlayArea An html element into which tooltips should be added.
   * @param renderer An SVG or VML implementation of the rendering functions.
   */
  constructor(
    protected overlayArea: OverlayArea,
    protected renderer: AbstractRenderer,
  ) {}

  /**
   * Draws a chart by removing the chart container and events attached to it and
   * then building all parts over again.
   * @param baseLayer Base layer of the chart definition.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer
   *     specifies only the properties whose value should override the one given
   *     in the base layer.
   */
  drawChart(baseLayer: ChartDefinition, refreshLayer: ChartDefinition) {
    this.clearChart();
    this.updateDefinition(baseLayer, refreshLayer);
    const chartDefinition = this.chartDefinition;
    const chartCanvas = this.renderer.createCanvas(
      chartDefinition!.width,
      chartDefinition!.height,
    );
    this.internalDrawChart(baseLayer, refreshLayer, chartCanvas);
  }

  /**
   * Redraws a chart by clearing the chart area and building all parts over
   * again.
   * @param baseLayer Base layer of the chart definition.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer
   *     specifies only the properties whose value should override the one given
   *     in the base layer.
   */
  redrawChart(baseLayer: ChartDefinition, refreshLayer: ChartDefinition) {
    if (
      !refreshLayer?.overlayBox &&
      this.idToElementMapping[Token.OVERLAY_BOX]
    ) {
      // Removes overlayBox element altogether if element exists but state has
      // changed (i.e refreshLayer)
      this.deleteElementByID(Token.OVERLAY_BOX);
    }

    this.idToElementMapping = {};
    this.groupIDToElementIDs = {};
    this.updateDefinition(baseLayer, refreshLayer);
    this.renderer.deleteContents(/* markForFlush = */ true);
    this.internalDrawChart(
      baseLayer,
      refreshLayer,
      this.renderer.getCanvas() as DrawingGroup,
    );
    this.renderer.flush();
  }

  /**
   * Updates the chartDefinition with the baseLayer (old chart definition) and
   * refreshLayer (additions to the chart definition) specifications.
   * @param baseLayer Base layer of the chart definition.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer
   *     specifies only the properties whose value should override the one given
   *     in the base layer.
   */
  updateDefinition(baseLayer: ChartDefinition, refreshLayer: ChartDefinition) {
    // Apply the refresh layer changes on top of the base layer.
    const layeredChartDefinition = new LayeredObject(2);
    layeredChartDefinition.setLayer(0, baseLayer);
    layeredChartDefinition.setLayer(1, refreshLayer);
    // Draw will be performed based on this chart definition.
    this.chartDefinition = layeredChartDefinition.compact() as ChartDefinition;
  }

  /**
   * Draw a chart from scratch. The chart definition is given in two layers:
   * base and refresh. The refresh layer is needed for the first call to
   * refreshChart() (which will revert it and apply a new one in its stead).
   * @param baseLayer Base layer of the chart definition.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer
   *     specifies only the properties whose value should override the one given
   *     in the base layer.
   * @param chartCanvas The canvas we will be drawing on.
   */
  internalDrawChart(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
    chartCanvas: DrawingGroup,
  ) {
    this.registerElement(chartCanvas.getElement(), Token.CHART);
    const chartDefinition = this.chartDefinition;
    const renderer = this.renderer;

    // Draw the background.
    const backgroundBrush = chartDefinition!.backgroundBrush;
    if (!backgroundBrush.isTransparent()) {
      renderer.drawRect(
        0,
        0,
        chartDefinition!.width,
        chartDefinition!.height,
        backgroundBrush,
        chartCanvas,
      );
    }

    // Draw the title.
    const titlePosition = chartDefinition!.titlePosition;
    if (titlePosition === InOutPosition.OUTSIDE) {
      asserts.assert(chartDefinition!.title != null);
      const titleTextBlock = this.drawTextBlock(
        chartDefinition!.title,
        chartCanvas,
        true,
      );
      this.registerElement(titleTextBlock, Token.TITLE);
    }

    // Draw the legend.
    this.legendDrawingGroup = renderer.createGroup(true);
    const legendDefinition = chartDefinition!.legend;
    this.drawLegend(legendDefinition);
    if (legendDefinition) {
      renderer.appendChild(chartCanvas, this.legendDrawingGroup);
      this.registerElement(this.legendDrawingGroup.getElement(), Token.LEGEND);
    }

    // Draw the color-bar.
    this.colorBarDrawingGroup = renderer.createGroup(true);
    const colorBarDefinition = chartDefinition!.colorBar;
    this.drawColorBar(colorBarDefinition);
    if (
      colorBarDefinition &&
      colorBarDefinition.position !== ColorBarPosition.INSIDE
    ) {
      renderer.appendChild(chartCanvas, this.colorBarDrawingGroup);
      this.idToElementMapping[Token.COLOR_BAR] =
        this.colorBarDrawingGroup.getElement();
    }

    // Create a dedicated group for tooltips, we append the group _after_
    // drawing the chart so the tooltips end up at the top.
    // TODO(eyalmc): Allow lazy creation if tooltips are never triggered.
    this.tooltipDrawingGroup = renderer.createGroup(false);

    // Draw the chart itself.
    if (!this.drawChartContent(chartDefinition!, chartCanvas)) {
      this.drawEmptyChart(chartDefinition!, chartCanvas);
    }

    renderer.appendChild(chartCanvas, this.tooltipDrawingGroup);

    // Needed by the next refresh() to determine what should be reverted.
    this.drawnRefreshLayer = refreshLayer;

    // Flush the renderer.
    renderer.flushRenderingCommands();
  }

  /**
   * Refresh the chart (apply changes made since the last draw/refresh request).
   * Attempts refreshing the chart using a sequence of short-circuit operations,
   * but may resort to a full redraw of the chart when it sees fit.
   * @param baseLayer Base layer of the chart definition. Needed when resorting
   *     to a full redraw.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer
   *     specifies only the properties whose value should override the one given
   *     in base layer.
   * TODO(eyalmc): For compatibility with drawChart(), we should change this
   * function to return a boolean indicating success. Alternatively, we can
   * change drawChart() to raise an exception instead and eliminate the boolean.
   */
  refreshChart(baseLayer: ChartDefinition, refreshLayer: ChartDefinition) {
    // We need this hack because JSCompiler obfuscates the properties.
    const shortCircuitedPropsObj = {
      series: null,
      categories: null,
      legend: null,
      labeledLegend: null,
      colorBar: null,
      overlayBox: null,
    };
    const shortCircuitedProps = googObject.getKeys(shortCircuitedPropsObj);
    const containsNoOtherProperties = util.containsNoOtherProperties;

    // We refresh upon changes to 'series', 'categories', 'overlayBox' or
    // 'legend'. Changes to other properties initiate a full redraw of the
    // chart.
    if (
      !containsNoOtherProperties(refreshLayer, shortCircuitedProps) ||
      !containsNoOtherProperties(this.drawnRefreshLayer, shortCircuitedProps)
    ) {
      this.drawChart(baseLayer, refreshLayer);
      return;
    }
    // TODO(eyalmc): We need to update this.chartDefinition to take the new
    // refresh layer into account. Right now we draw according to the previous
    // chart definition, which means that changes to certain properties in the
    // interactivity layer (isStacked, interpolateNulls, etc.) will be ignored.

    this.refreshLegend(baseLayer, refreshLayer);
    this.refreshColorBar(baseLayer, refreshLayer);

    // Refresh the chart contents.
    this.refreshChartContent(baseLayer, refreshLayer);

    // Draw an overlay box if needed.
    this.refreshOverlayBox(baseLayer, refreshLayer);

    // Needed by the next refresh() to determine what should be reverted.
    this.drawnRefreshLayer = refreshLayer;
  }

  /**
   * If the legend has changed, redraw it.
   * @param baseLayer Base layer of the chart definition. See refreshChart
   *     above.
   * @param refreshLayer Refresh layer of the chart definition. See refreshChart
   *     above.
   */
  private refreshLegend(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ) {
    if (
      gvizObject.unsafeEquals(
        refreshLayer.legend,
        this.drawnRefreshLayer!.legend,
      )
    ) {
      return;
    }

    // TODO(eyalmc): Instead of asserting that the legend position stays the
    // same, move the legend group to the correct location in the DOM.
    asserts.assert(
      !refreshLayer.legend ||
        !this.drawnRefreshLayer!.legend ||
        refreshLayer.legend.position ===
          this.drawnRefreshLayer!.legend.position,
      'Legend position should not be changed by the interactivity layer',
    );
    // Delete the drawn legend.
    // Suppressing errors for ts-migration.
    asserts.assert(this.legendDrawingGroup != null);
    this.renderer.removeChildren(this.legendDrawingGroup!);
    // Apply the refresh layer changes on top of the original legend definition
    // and redraw from scratch.
    const layeredLegendDefinition = new LayeredObject(2);
    layeredLegendDefinition.setLayer(0, baseLayer.legend || {});
    layeredLegendDefinition.setLayer(1, refreshLayer.legend || {});
    const legendDefinition =
      layeredLegendDefinition.compact() as LegendDefinition;
    this.drawLegend(legendDefinition);
  }

  /**
   * If the color-bar has changed, redraw it.
   * @param baseLayer Base layer of the chart definition. See refreshChart
   *     above.
   * @param refreshLayer Refresh layer of the chart definition. See refreshChart
   *     above.
   */
  private refreshColorBar(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ) {
    if (
      gvizObject.unsafeEquals(
        refreshLayer.colorBar,
        this.drawnRefreshLayer!.colorBar,
      )
    ) {
      return;
    }

    // Delete the drawn color-bar.
    dom.assertIsElement(this.colorBarDrawingGroup);
    this.renderer.removeChildren(this.colorBarDrawingGroup!);
    // Apply the refresh layer changes on top of the original definition and
    // redraw from scratch.
    const layeredColorBarDefinition = new LayeredObject(2);
    layeredColorBarDefinition.setLayer(0, baseLayer.colorBar || {});
    layeredColorBarDefinition.setLayer(1, refreshLayer.colorBar || {});
    const colorBarDefinition =
      layeredColorBarDefinition.compact() as ColorBarDefinition;
    this.drawColorBar(colorBarDefinition);
  }

  /**
   * If the overlayBox has changed, redraw it.
   * @param baseLayer Base layer of the chart definition. See refreshChart
   *     above.
   * @param refreshLayer Refresh layer of the chart definition. See refreshChart
   *     above.
   */
  private refreshOverlayBox(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ) {
    if (
      !refreshLayer?.overlayBox ||
      gvizObject.unsafeEquals(
        refreshLayer.overlayBox,
        this.drawnRefreshLayer!.overlayBox,
      )
    ) {
      return;
    }
    this.deleteElementByID(Token.OVERLAY_BOX);
    assert(refreshLayer.overlayBox != null);
    this.drawOverlayBox(refreshLayer.overlayBox);
  }

  /**
   * Draw an empty chart (when there is no data to draw).
   *
   * @param chartDef For top, left, width and height of chart area.
   * @param drawingGroup A group of the chart to draw into.
   */
  private drawEmptyChart(
    chartDef: ChartDefinition,
    drawingGroup: DrawingGroup,
  ) {
    const msg = messages.MSG_NO_DATA;
    const fontName = chartDef.defaultFontName;
    let fontSize = chartDef.defaultFontSize;
    const textStyle: TextStyle = {
      color: 'black',
      fontName,
      fontSize,
      bold: false,
      italic: false,
      underline: false,
    } as TextStyle;
    fontSize = this.fitFontSize(msg, textStyle, chartDef.chartArea.width);
    const y =
      chartDef.chartArea.top + Math.round(chartDef.chartArea.height / 2);
    this.renderer.drawTextOnLine(
      msg,
      chartDef.chartArea.left,
      y,
      chartDef.chartArea.left + chartDef.chartArea.width,
      y,
      TextAlign.CENTER,
      TextAlign.CENTER,
      textStyle,
      drawingGroup,
    );
  }

  /**
   * Draws the chart's legend.
   * @param legendDefinition The legend definition.
   */
  drawLegend(legendDefinition: LegendDefinition | null) {
    if (!legendDefinition) {
      // The legend is an urban legend.
      return;
    }
    const currentPage = legendDefinition.currentPage;
    if (!currentPage) {
      return;
    }
    const currentPageIndex = legendDefinition.currentPageIndex || 0;
    const totalPages = legendDefinition.pages!.length;

    // Draw a transparent background that covers the legend area.
    // It is used to identify hover & click events on the legend.
    let legendBoundingBox;
    if (legendDefinition.scrollItems) {
      // The entire area allocated for the legend is being used.
      legendBoundingBox = legendDefinition.area;
    } else {
      // Use the part of the legend area allocated for the entries.
      const legendEntryBoundingBoxes: Box[] = currentPage
        .map((legendEntry) => {
          return this.calcLegendEntryBoundingBox(legendEntry);
        })
        .filter((item) => item != null) as Box[];
      legendBoundingBox = commonUtilCalcBoundingBox(legendEntryBoundingBoxes);
    }
    // TODO(eyalmc): Add a bit of extra padding around the legend once
    // hoppenheim@ comes up with the exact specification.
    if (legendBoundingBox) {
      const legendBoundingRect = GoogRect.createFromBox(legendBoundingBox);
      asserts.assert(this.legendDrawingGroup != null);
      this.renderer.drawRect(
        legendBoundingRect.left,
        legendBoundingRect.top,
        legendBoundingRect.width,
        legendBoundingRect.height,
        new Brush(Brush.TRANSPARENT_BRUSH),
        this.legendDrawingGroup!,
      );
    }

    // Draw the legend entries in the current page.
    for (let i = 0; i < currentPage.length; i++) {
      this.drawLegendEntry(currentPage[i]);
    }

    // Now draw the scroll items.
    this.drawLegendScrollItems(
      legendDefinition.scrollItems,
      currentPageIndex,
      totalPages,
    );
  }

  /**
   * Calculates the bounding box of a given legend entry.
   * Returns null if the legend entry is empty.
   * @param legendEntry The entry.
   * @return The bounding box.
   */
  private calcLegendEntryBoundingBox(legendEntry: Entry): googMath.Box | null {
    // An array of the bounding boxes of each the legend entry item.
    const legendEntryItemsBoundingBoxes = [];

    if (legendEntry.textBlock) {
      const textBlockBoundingBox = calcBoundingBox(legendEntry.textBlock);
      if (textBlockBoundingBox) {
        legendEntryItemsBoundingBoxes.push(textBlockBoundingBox);
      }
    }

    if (legendEntry.square) {
      legendEntryItemsBoundingBoxes.push(
        legendEntry.square.coordinates.toBox(),
      );
    }

    // TODO(eyalmc): Add a bit of extra padding around every legend entry once
    // hoppenheim@ comes up with the exact specification, and leave no dead
    // space between entries.

    return commonUtilCalcBoundingBox(legendEntryItemsBoundingBoxes);
  }

  /**
   * Draws a path of a point with the brush. Draws different things, depending
   * on the point's shape and adds it to the group, if one is specified.
   * @param centerX The X center of the point.
   * @param centerY The Y center of the point.
   * @param radius The radius of the point.
   * @param brush The brush for the point.
   * @param shape The shape of the point.
   * @param group The drawing group to which to add the point elements.
   * @return The element drawn.
   */
  drawMarker(
    centerX: number,
    centerY: number,
    radius: number,
    brush: Brush,
    shape: chartDefinitionTypes.PointShape,
    group?: DrawingGroup | null,
  ): Element {
    // disable clipping
    const clipRect = this.renderer.disableClipping();

    let type = shape.type;

    // tslint:disable-next-line:ban-types  Migration
    let sides = Number((shape as AnyDuringMigration)['sides']);
    if (sides == null || !isFinite(sides)) {
      sides = 5;
    }

    let rotation = Number(shape.rotation);
    if (rotation == null || !isFinite(rotation)) {
      rotation = 0;
    }
    // Convert the rotation to radians and offset it by -45º, so that the first
    // corner of a polygon (or star) points up instead of to the right.
    rotation = (rotation / 180) * Math.PI - Math.PI / 2;

    if (type === PointShapeType.TRIANGLE) {
      type = PointShapeType.POLYGON;
      sides = 3;
    } else if (type === PointShapeType.SQUARE) {
      type = PointShapeType.POLYGON;
      sides = 4;
      // For a square, we don't want the first vertex pointing up, we want it
      // offset by 90º.
      rotation += Math.PI / 4;
    } else if (type === PointShapeType.DIAMOND) {
      type = PointShapeType.POLYGON;
      sides = 4;
    }

    const isStar = type === PointShapeType.STAR;
    // If we have a polygon or star with more than 500 sides, make them circles.
    if (
      sides > 500 &&
      (type === PointShapeType.POLYGON || type === PointShapeType.STAR)
    ) {
      type = PointShapeType.CIRCLE;
    }

    let element = null;
    if (type === PointShapeType.POLYGON || type === PointShapeType.STAR) {
      // Calculate the dent amount for stars.
      // tslint:disable-next-line:ban-types  Migration
      let dentRadius = Number((shape as AnyDuringMigration)['dent']);
      if (dentRadius == null || !isFinite(dentRadius)) {
        if (sides >= 5) {
          // Choose a dentRadius that will align the uppermost arms of the star.
          dentRadius = Math.cos(Math.PI / sides);
          dentRadius -=
            Math.pow(Math.sin(Math.PI / sides), 2) /
            Math.sin(Math.PI / 2 - Math.PI / sides);
        } else {
          // Choose a reasonable default for "stars" with an unreasonably
          // small number of sides.
          dentRadius = 0.3;
        }
      }
      dentRadius *= radius;

      if (type === PointShapeType.STAR) {
        // For a star, sides is really the number of corners, so we multiply by
        // 2, because stars have inset corners.
        sides *= 2;
      }

      const path = new PathSegments();
      for (let p = 0; p < sides; p++) {
        let pointRadius = radius;
        if (isStar && p % 2) {
          pointRadius = dentRadius;
        }
        const r = ((Math.PI * 2) / sides) * p + rotation;
        const x = Math.cos(r) * pointRadius + centerX;
        const y = Math.sin(r) * pointRadius + centerY;
        if (p > 0) {
          path.addLine(x, y);
        } else {
          path.move(x, y);
        }
      }
      path.close();
      element = this.renderer.createPath(path, brush);
    } else {
      // Default to circle.
      element = this.renderer.createCircle(centerX, centerY, radius, brush);
    }

    if (element && group) {
      this.renderer.appendChild(group, element);
    }
    this.renderer.describeClipRegion(clipRect); // reenable clipping

    return element;
  }

  /**
   * Draws the square for a legend entry. Takes into account what type of series
   * is being drawn and draws the legend item in the style of the series.
   * @param legendEntry The entry to draw.
   * @param legendEntryDrawingGroup The drawing group to which the elements of
   *     this square should be added.
   */
  protected drawLegendEntrySquare(
    legendEntry: Entry,
    legendEntryDrawingGroup: DrawingGroup,
  ) {
    const series = this.chartDefinition!.series[legendEntry.index];
    if (
      this.chartDefinition!.useNewLegend &&
      series &&
      !series.diff &&
      series.pointShape
    ) {
      // If this isn't a diff series and has a point shape, then we should
      // render a 'complex' legend shape.

      const squareLeft = legendEntry.square!.coordinates.left;
      const squareTop = legendEntry.square!.coordinates.top;
      const squareWidth = legendEntry.square!.coordinates.width;
      const squareHeight = legendEntry.square!.coordinates.height;
      const midX = squareLeft + squareWidth / 2;
      const midY = squareTop + squareHeight / 2;

      // If the line has an area brush, draw the area.
      if (series.areaBrush) {
        this.renderer.drawRect(
          squareLeft,
          midY,
          squareWidth,
          squareHeight / 2,
          series.areaBrush,
          legendEntryDrawingGroup,
        );
      }

      // The maximum line width that we can sanely render in the square.
      const lineWidthCap = squareHeight * 0.5;
      let lineBrush = series.lineBrush;
      if (lineBrush) {
        // If the stroke width is of an unreasonable size, modify the brush.
        if (lineBrush.getStrokeWidth() > lineWidthCap) {
          lineBrush = lineBrush.clone();
          lineBrush.setStrokeWidth(lineWidthCap);
        }
        this.renderer.drawLine(
          squareLeft,
          midY,
          squareLeft + squareWidth,
          midY,
          lineBrush,
          legendEntryDrawingGroup,
        );
      }

      // If the line has a point brush, draw it, with a point shape if it has
      // one.
      if (series.pointBrush && series.visiblePoints) {
        let pointShape = series.pointShape;
        // If the series doesn't have a point shape, use the default one
        // (circle).
        if (!pointShape) {
          pointShape = {
            'type': PointShapeType.CIRCLE,
          } as chartDefinitionTypes.PointShape;
        }
        const legendPointBrush = series.pointBrush;
        this.drawMarker(
          midX,
          midY,
          Math.min(series.pointRadius, squareHeight / 2, squareWidth / 2),
          legendPointBrush,
          pointShape,
          legendEntryDrawingGroup,
        );
      }
    } else {
      this.renderer.drawRect(
        legendEntry.square!.coordinates.left,
        legendEntry.square!.coordinates.top,
        legendEntry.square!.coordinates.width,
        legendEntry.square!.coordinates.height,
        legendEntry.square!.brush,
        legendEntryDrawingGroup,
      );
    }
  }

  /**
   * Draws the scroll items of the legend.
   * @param legendEntry The entry to draw.
   */
  private drawLegendEntry(legendEntry: Entry) {
    if (!legendEntry.isVisible) {
      return;
    }
    const legendEntryDrawingGroup = this.renderer.createGroup(false);
    const legendEntryDrawingGroupElement = legendEntryDrawingGroup.getElement();
    if (legendEntry.id) {
      legendEntryDrawingGroupElement.setAttribute('column-id', legendEntry.id);
    }
    const legendEntryID = generateId([Token.LEGEND_ENTRY, legendEntry.index]);
    this.registerElement(
      legendEntryDrawingGroupElement,
      legendEntryID,
      Token.LEGEND_ENTRY,
    );

    // Draw a transparent background that covers the legend entry area.
    // It is used to identify hover & click events on the legend entry.
    // We must put it behind the text block so we don't disable the tooltip in
    // case the legend entry doesn't fit.
    const legendEntryBoundingBox = this.calcLegendEntryBoundingBox(legendEntry);
    if (legendEntryBoundingBox) {
      const legendEntryBoundingRect = GoogRect.createFromBox(
        legendEntryBoundingBox,
      );
      this.renderer.drawRect(
        legendEntryBoundingRect.left,
        legendEntryBoundingRect.top,
        legendEntryBoundingRect.width,
        legendEntryBoundingRect.height,
        new Brush(Brush.TRANSPARENT_BRUSH),
        legendEntryDrawingGroup,
      );
    }

    // Draw the text of the legend entry.
    if (legendEntry.textBlock) {
      this.drawTextBlock(legendEntry.textBlock, legendEntryDrawingGroup);
    }

    // Draw the square indicating the serie associated with the legend entry.
    if (legendEntry.square) {
      this.drawLegendEntrySquare(legendEntry, legendEntryDrawingGroup);
    }

    // Draw the remove button.
    let removeSerieButtonElement = null;
    if (
      legendEntry.removeSerieButton &&
      legendEntry.removeSerieButton.isVisible &&
      legendEntry.removeSerieButton.brush
    ) {
      removeSerieButtonElement = this.drawRemoveSerieButton(
        legendEntry.removeSerieButton.coordinates!.x,
        legendEntry.removeSerieButton.coordinates!.y,
        legendEntry.removeSerieButton.brush,
        legendEntryDrawingGroup,
      );
      const removeSerieButtonID = generateId([
        Token.REMOVE_SERIE_BUTTON,
        legendEntry.index,
      ]);
      this.registerElement(removeSerieButtonElement, removeSerieButtonID);
    }

    asserts.assert(this.legendDrawingGroup != null);
    this.renderer.appendChild(
      this.legendDrawingGroup!,
      legendEntryDrawingGroup,
    );
  }

  /**
   * Draws the scroll items of the legend.
   * @param scrollItems The legend scroll items to draw.
   * @param currentPageIndex The index of legend current page.
   * @param totalPages The total number of legend pages.
   */
  private drawLegendScrollItems(
    scrollItems: ScrollItems | null,
    currentPageIndex: number,
    totalPages: number,
  ) {
    if (!scrollItems) {
      // No scroll items, no deal.
      return;
    }

    // Draw previous button.
    this.drawLegendScrollButton(
      scrollItems.previousButton,
      currentPageIndex,
      totalPages,
      -1,
    );

    // Draw page numbers.
    if (scrollItems.pageIndexTextBlock) {
      asserts.assert(this.legendDrawingGroup != null);
      this.drawTextBlock(
        scrollItems.pageIndexTextBlock,
        this.legendDrawingGroup!,
      );
    }

    // Draw next button.
    this.drawLegendScrollButton(
      scrollItems.nextButton,
      currentPageIndex,
      totalPages,
      1,
    );
  }

  /**
   * Draws a scroll button of the legend.
   * @param button The button to draw.
   * @param currentPageIndex The index of legend current page.
   * @param totalPages The total number of legend pages.
   * @param scrollStep The scroll step in case of a click.
   */
  private drawLegendScrollButton(
    button: ScrollButton | null,
    currentPageIndex: number,
    totalPages: number,
    scrollStep: number,
  ) {
    if (!button) {
      return;
    }
    asserts.assert(this.legendDrawingGroup != null);
    const buttonPathSegments = PathSegments.fromVertices(button.path);
    const buttonElement = this.renderer.drawPath(
      buttonPathSegments,
      button.brush,
      this.legendDrawingGroup!,
    );
    // Hang a click event on the button (only if it is active).
    if (!button.active) {
      return;
    }
    const buttonID = generateId([
      Token.LEGEND_SCROLL_BUTTON,
      scrollStep,
      currentPageIndex,
      totalPages,
    ]);
    this.registerElement(buttonElement, buttonID);
  }

  /**
   * Draws a square with a white cross on it.
   * @param x X position.
   * @param y Y position.
   * @param brush The brush to use.
   * @param drawingGroup The group to attach to.
   * @return The created element.
   */
  drawRemoveSerieButton(
    x: number,
    y: number,
    brush: Brush,
    drawingGroup: DrawingGroup,
  ): Element {
    const renderer = this.renderer;
    const width = 12;
    const height = 12;
    const group = renderer.createGroup();
    renderer.drawRect(x, y, width, height, brush, group);
    renderer.appendChild(drawingGroup, group);
    const path = new PathSegments();
    const strokeWidth = 2;
    path.move(x + strokeWidth, y + strokeWidth);
    path.addLine(x + width - strokeWidth, y + height - strokeWidth);
    path.move(x + width - strokeWidth, y + strokeWidth);
    path.addLine(x + strokeWidth, y + height - strokeWidth);
    const crossBrush = new Brush();
    crossBrush.setStroke('#ffffff');
    crossBrush.setStrokeWidth(2);
    renderer.drawPath(path, crossBrush, group);
    return group.getElement();
  }

  /**
   * Draws the chart's color-bar.
   * @param colorBarDefinition The color-bar definition.
   */
  drawColorBar(colorBarDefinition: ColorBarDefinition | null) {
    if (!colorBarDefinition) {
      return;
    }

    asserts.assert(this.colorBarDrawingGroup != null);
    colorBarBuilder.draw(
      colorBarDefinition.definition,
      this.renderer,
      this.colorBarDrawingGroup!,
    );

    // Draw a transparent foreground that covers the color-bar area.
    // It is used to identify hover & click events on the color-bar.
    const foreground = this.renderer.drawRect(
      colorBarDefinition.drawingOptions.left,
      colorBarDefinition.drawingOptions.top,
      colorBarDefinition.drawingOptions.width,
      colorBarDefinition.drawingOptions.height,
      new Brush(Brush.TRANSPARENT_BRUSH),
      this.colorBarDrawingGroup!,
    );
    this.registerElement(foreground, Token.COLOR_BAR);
  }

  /**
   * Return a fontSize that can fit the given text string in the available size.
   *
   * @param text The text that is measured.
   * @param textStyle The text style.
   *     The fontSize property of it is considered to be a 'preferred font
   * size'.
   * @param maximalLength The maximal size (pixels) available on screen.
   *
   * @return The font size to use to that the text fits in the given area.
   */
  fitFontSize(
    text: string,
    textStyle: TextStyle,
    maximalLength: number,
  ): number {
    asserts.assert(textStyle.fontSize != null);
    let fontSize = textStyle.fontSize;
    const textWidth = this.renderer.getTextWidth(text, textStyle);
    if (textWidth > maximalLength) {
      fontSize = Math.max(
        1,
        Math.floor((fontSize * maximalLength) / textWidth),
      );
    }
    return fontSize;
  }

  /**
   * Close the tooltip for a given data point (point, bar) or serie (pie slice).
   * @param tooltipID Unique tooltip ID.
   */
  closeTooltip(tooltipID: string) {
    const tooltipElement = this.idToElementMapping[tooltipID];
    if (tooltipElement) {
      // Remove the tooltip from the DOM.
      this.renderer.removeElement(tooltipElement);
      // Remove the tooltip from idToElementMapping_.
      delete this.idToElementMapping[tooltipID];
    }
  }

  /**
   * Open a tooltip for a given data point (point, bar) or serie (pie slice).
   * @param tooltipDefinition The tooltip definition.
   * @param tooltipID Unique tooltip ID.
   */
  openTooltip(tooltipDefinition: TooltipDefinition, tooltipID: string) {
    // Create a tooltip element.
    asserts.assert(this.tooltipDrawingGroup != null);
    /**
     * @suppress {strictMissingProperties} TODO(b/214874268): Remove
     * strictMissingProperties suppression after b/214427036 is fixed
     */
    const tooltipElement = isHtmlTooltipDefinition(tooltipDefinition)
      ? htmlTooltipBuilder.draw(
          tooltipDefinition,
          this.overlayArea.getContainer(),
        )
      : tooltipBuilder
          .draw(tooltipDefinition, this.renderer, this.tooltipDrawingGroup!)
          .getElement();

    this.registerElement(tooltipElement, tooltipID);
  }

  /**
   * Draws a given text block.
   * @param textBlock The block of text.
   * @param drawingGroup The drawing group in which we draw the block.
   * @param addSensitivityArea If a sensitivity area should be added around the
   *     text. The default is false unless there is a tooltip.
   * @return The group with the text.
   */
  drawTextBlock(
    textBlock: TextBlock,
    drawingGroup: DrawingGroup,
    addSensitivityArea?: boolean,
  ): Element | null {
    const element = this.createTextBlock(textBlock, addSensitivityArea);
    if (element) {
      this.renderer.appendChild(drawingGroup, element);
    }
    return element;
  }

  /**
   * Creates a text block element ready to be drawn.
   * @param textBlock The block of text.
   * @param addSensitivityArea If a sensitivity area should be added around the
   *     text. The default is false unless there is a tooltip.
   * @return The group with the text, or null.
   */
  createTextBlock(
    textBlock: TextBlock,
    addSensitivityArea?: boolean,
  ): Element | null {
    const lines = textBlock.lines;
    if (!lines || lines.length === 0) {
      return null;
    }

    const renderer = this.renderer;
    const textStyle = textBlock.textStyle;
    const boxStyle = textBlock.boxStyle;
    const angle = textBlock.angle != null ? textBlock.angle : 0;
    const anchor = textBlock.anchor ? textBlock.anchor : {x: 0, y: 0};
    const tooltip = textBlock.tooltip;
    // If there is a tooltip, we always add a sensitivity area.
    addSensitivityArea = !!tooltip || addSensitivityArea || false;

    const group = renderer.createGroup();

    // First draw the background button.
    if (angle === 0 && boxStyle) {
      const box = calcBoundingBox(textBlock);
      if (box) {
        const paddingLeftRight = 3;
        const paddingTopBottom = 1;
        // To get nice crisp edges, values need to be even 0.5.
        const left = Math.ceil(box.left - paddingLeftRight) + 0.5;
        const right = Math.floor(box.right + paddingLeftRight) + 0.5;
        const top = Math.floor(box.top - paddingTopBottom) + 0.5;
        const bottom = Math.floor(box.bottom + paddingTopBottom) + 0.5;
        renderer.drawRect(
          left,
          top,
          right - left,
          bottom - top,
          boxStyle,
          group,
        );
      }
    }

    // Next draw all the text lines.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (angle === 0) {
        renderer.drawText(
          line.text,
          line.x + anchor.x,
          line.y + anchor.y,
          line.length,
          textBlock.paralAlign,
          textBlock.perpenAlign,
          textStyle,
          group,
        );
      } else {
        renderer.drawTextOnLineByAngle(
          line.text,
          line.x + anchor.x,
          line.y + anchor.y,
          line.length,
          angle,
          textBlock.paralAlign,
          textBlock.perpenAlign,
          textStyle,
          group,
        );
      }
    }

    // We now add the sensitivity area and tooltip if needed.
    // We add a transparent rectangle around all the text so that the
    // sensitivity area will trigger events when the cursor is not on a black
    // (or whatever color is chosen) pixel.
    if (addSensitivityArea) {
      let sensitivityArea = null;
      if (angle === 0) {
        const box = calcBoundingBox(textBlock);
        if (box) {
          sensitivityArea = renderer.drawRect(
            box.left,
            box.top,
            box.right - box.left,
            box.bottom - box.top,
            new Brush(Brush.TRANSPARENT_BRUSH),
            group,
          );
        }
      } else {
        // The algorithm here is similar to the algorithm in the angle == 0
        // case, with a difference - first rotate the coordinates in reverse
        // direction of the angle, compute the surrounding box, and then rotate
        // back the box.
        const radians = googMath.toRadians(angle);

        const rotatedTextBlock = googObject.unsafeClone(textBlock);
        rotatedTextBlock.angle = 0;
        const rotatedAnchor = new Vec2(anchor.x, anchor.y).rotate(-radians);
        rotatedTextBlock.anchor = new Coordinate(
          rotatedAnchor.x,
          rotatedAnchor.y,
        );
        for (let i = 0; i < lines.length; i++) {
          const rotatedLinePoint = new Vec2(lines[i].x, lines[i].y).rotate(
            -radians,
          );
          rotatedTextBlock.lines[i].x = rotatedLinePoint.x;
          rotatedTextBlock.lines[i].y = rotatedLinePoint.y;
        }
        const box = calcBoundingBox(rotatedTextBlock);

        if (box) {
          const boxPoints = [
            new Vec2(box.left, box.top),
            new Vec2(box.right, box.top),
            new Vec2(box.right, box.bottom),
            new Vec2(box.left, box.bottom),
          ];
          boxPoints.forEach((point) => {
            point.rotate(radians);
          });
          // Use the computed rotated box corners as path segments.
          const path = PathSegments.fromVertices(boxPoints, false);
          sensitivityArea = renderer.drawPath(
            path,
            new Brush(Brush.TRANSPARENT_BRUSH),
            group,
          );
        }
      }

      if (tooltip && sensitivityArea) {
        renderer.addTooltip(
          sensitivityArea,
          tooltip,
          textutils.tooltipCssStyle(textStyle),
        );
      }
    }

    return group.getElement();
  }

  /**
   * Draws an overlay box.
   * @param overlayBox The bounds of the overlay box.
   */
  drawOverlayBox(overlayBox: OverlayBox) {
    const brush = new Brush();
    brush.setFill(overlayBox.color);
    brush.setFillOpacity(overlayBox.opacity);
    const box = this.renderer.drawRect(
      overlayBox.left,
      overlayBox.top,
      overlayBox.width,
      overlayBox.height,
      brush,
      this.renderer.getCanvas() as DrawingGroup,
    );
    this.registerElement(box, Token.OVERLAY_BOX);
  }

  /**
   * Draws an element into a given group.
   * If an element with the same ID already appears in the group, override it.
   * This way we maintain the original order in which elements were drawn.
   * Otherwise, draw it as the last element in the group.
   *
   * @param group The group to draw the element into.
   * @param elementID The ID associated with the element.
   * @param newElement The element to draw.
   */
  protected drawElement(
    group: DrawingGroup,
    elementID: string,
    newElement: Element,
  ) {
    const oldElement = this.idToElementMapping[elementID];
    if (oldElement == null) {
      this.renderer.appendChild(group, newElement);
    } else {
      this.renderer.replaceChild(group, newElement, oldElement);
    }
    // Register the element so we can access it when performing a short circuit
    // (not drawing from scratch).
    this.registerElement(newElement, elementID);
  }

  /**
   * Register an elements by doing the following:
   * - Set its logical name.
   * - Add it to the idToElementMapping.
   * - If a parentID is given, we also add the ID as a child to the parent ID.
   *
   * @param element The element to set its name and ID, or null.
   * @param elementID The ID associated with the element.
   * @param parentID The parent element's ID.
   */
  protected registerElement(
    element: Element | null,
    elementID: string,
    parentID?: string,
  ) {
    if (!element) {
      return;
    }
    this.renderer.setLogicalName(element, elementID);
    this.idToElementMapping[elementID] = element;
    if (parentID) {
      this.addChildElementID(parentID, elementID);
    }
  }

  /**
   * Deletes a drawn element by ID.
   * Has no effect if no element is associated with the ID.
   *
   * @param elementID The ID associated with the element to delete.
   */
  protected deleteElementByID(elementID: string) {
    const element = this.idToElementMapping[elementID];
    if (element) {
      // TODO(eyalmc): Should perform faster if we specify the parent.
      this.renderer.removeElement(element);
      delete this.idToElementMapping[elementID];
    }
  }

  /** Clears the chart entirely, including HTML tooltips drawn on top of it. */
  private clearChart() {
    this.idToElementMapping = {};
    this.groupIDToElementIDs = {};
    this.renderer.clear();
    this.overlayArea.clear();
  }

  /**
   * Adds a subelement ID to a given ID.
   * @param parentID The "parent" ID.
   * @param childID The "child" ID.
   */
  private addChildElementID(parentID: string, childID: string) {
    if (!this.groupIDToElementIDs[parentID]) {
      this.groupIDToElementIDs[parentID] = [];
    }
    // We do not expect the child ID to be present but to be on the safe side we
    // do not add it if already exists.
    if (!googArray.contains(this.groupIDToElementIDs[parentID], childID)) {
      this.groupIDToElementIDs[parentID].push(childID);
    }
  }

  /**
   * Returns the bounding box of an element according to its ID.
   * The ID may not correspond to a single element. Some IDs actually refer to a
   * set of sub-elements which are stored in the groupIDToElementIDs mapping.
   *
   * @param id The element's ID.
   * @return The bounding box of the requested element, or null.
   */
  getBoundingBox(id: string): googMath.Box | null {
    const boxes = [];
    if (this.idToElementMapping[id]) {
      const box = this.renderer.getBoundingBox(this.idToElementMapping[id]);
      if (box) {
        boxes.push(box);
      }
    }

    // We also add the boxes of the child elements if exist.
    const childElements = this.groupIDToElementIDs[id] || [];
    for (let i = 0; i < childElements.length; ++i) {
      const box = this.renderer.getBoundingBox(
        this.idToElementMapping[childElements[i]],
      );
      if (box) {
        boxes.push(box);
      }
    }
    return commonUtilCalcBoundingBox(boxes);
  }

  /**
   * @param chartDef Chart definition.
   * @param drawingGroup A group of the chart to draw into.
   * @return True if chart was created, false if there is no enough data to
   *     create the chart.
   */
  protected abstract drawChartContent(
    chartDef: ChartDefinition,
    drawingGroup: DrawingGroup,
  ): boolean;

  /**
   * @param baseLayer Base layer of the chart definition. Needed when resorting
   *     to a full redraw.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer
   *     specifies only the properties whose value should override the one given
   *     in the chart definition passed in the last drawChartContent() call.
   */
  protected abstract refreshChartContent(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ): void;

  /**
   * @param baseLayer Base layer of the chart definition. Needed when resorting
   *     to a full redraw.
   */
  abstract revertChartContentChanges(baseLayer: ChartDefinition): void;
}
