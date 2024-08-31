/**
 * @fileoverview The builder for pie charts.
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
import {assertIsElement} from '@npm//@closure/asserts/dom';
import {LayeredObject} from '../../common/layered_object';
import {unsafeEquals} from '../../common/object';
import {Brush} from '../../graphics/brush';

import {AbstractRenderer} from '../../graphics/abstract_renderer';
import {DrawingGroup} from '../../graphics/drawing_group';
import {OverlayArea} from '../../graphics/overlay_area';
import {PathSegments} from '../../graphics/path_segments';
import {TextAlign} from '../../text/text_align';

import * as labeledLegendBuilder from '../../legend/labeled_legend_builder';
import {LabeledLegendDefinition} from '../../legend/labeled_legend_definition';
import {Entry} from '../../legend/legend_definition';
import {
  GlowDefinition,
  PointShapeType,
  SerieDefinition,
} from '../../visualization/corechart/chart_definition_types';
import {Token, generateId} from '../../visualization/corechart/id_utils';
import {ChartBuilder} from './chart_builder';
import {ChartDefinition} from './chart_definition';
import * as chartDefinitionTypes from './chart_definition_types';

/**
 * A builder for pie charts.
 * @unrestricted
 */
export class PieChartBuilder extends ChartBuilder {
  private drawingGroup: DrawingGroup | null = null;

  private labeledLegendDrawingGroup: DrawingGroup | null = null;

  /**
   * @param overlayArea An html element into which tooltips should be added.
   * @param renderer The drawing renderer.
   */
  constructor(overlayArea: OverlayArea, renderer: AbstractRenderer) {
    super(overlayArea, renderer);
  }

  /**
   * @param chartDef Chart definition.
   * @param drawingGroup A group of the chart to draw into.
   * @return True if chart was created, false if there is no enough data to
   *     create the chart.
   */
  drawChartContent(
    chartDef: ChartDefinition,
    drawingGroup: DrawingGroup,
  ): boolean {
    const renderer = this.renderer;
    if (chartDef.series.length < 1) {
      return false;
    }
    this.drawingGroup = drawingGroup;

    // Draws the slices.
    const layers = chartDef.pie.layers;
    const seriesCountInLayer = chartDef.series.length / layers.length;
    for (let layerIndex = 0; layerIndex < layers.length; ++layerIndex) {
      const radiusX = layers[layerIndex].radiusX;
      const radiusY = layers[layerIndex].radiusY;
      const otherSlice = layers[layerIndex].otherSlice;

      // We need to draw the slice that contain the bottom part last to avoid a
      // strange effect in the middle of the pie.
      let middleSlice = layerIndex * seriesCountInLayer;
      const lastSliceInLayer = middleSlice + seriesCountInLayer;
      while (
        middleSlice < lastSliceInLayer &&
        chartDef.series[middleSlice].toDegrees < 180
      ) {
        this.drawSlice(chartDef.series[middleSlice], radiusX, radiusY);
        middleSlice += 1;
      }
      if (otherSlice) {
        this.drawSlice(otherSlice, radiusX, radiusY);
      }
      for (let i = lastSliceInLayer - 1; i >= middleSlice; --i) {
        this.drawSlice(chartDef.series[i], radiusX, radiusY);
      }
    }

    if (chartDef.labeledLegend) {
      this.labeledLegendDrawingGroup = renderer.createGroup();
      this.drawLabeledLegend(chartDef.labeledLegend);
      renderer.appendChild(this.drawingGroup, this.labeledLegendDrawingGroup);
    }

    return true;
  }

  /**
   * Draws the square for a legend entry. Takes into account what type of series
   * is being drawn and draws the legend item in the style of the series.
   * @param legendEntry The entry to draw.
   * @param legendEntryDrawingGroup The drawing group to which the elements of
   *     this square should be added.
   */
  override drawLegendEntrySquare(
    legendEntry: Entry,
    legendEntryDrawingGroup: DrawingGroup,
  ) {
    if (this.chartDefinition!.useNewLegend) {
      const squareLeft = legendEntry.square!.coordinates.left;
      const squareTop = legendEntry.square!.coordinates.top;
      const squareWidth = legendEntry.square!.coordinates.width;
      const squareHeight = legendEntry.square!.coordinates.height;
      const midX = squareLeft + squareWidth / 2;
      const midY = squareTop + squareHeight / 2;
      const shape = {'type': PointShapeType.CIRCLE};
      const legendPointBrush: Brush = legendEntry.square!.brush.clone();
      // We never want transparent legend entries.
      legendPointBrush.setFillOpacity(1.0);
      this.drawMarker(
        midX,
        midY,
        squareHeight / 2,
        legendPointBrush,
        shape as chartDefinitionTypes.PointShape,
        legendEntryDrawingGroup,
      );
    } else {
      super.drawLegendEntrySquare(legendEntry, legendEntryDrawingGroup);
    }
  }

  /**
   * Draws a single pie chart slice.
   * @param slice The slice, in the same format as the output of
   *     chartDefinitionTypes.calcPieLayout, which is??
   * @param radiusX The pie radius in X.
   * @param radiusY The pie radius in Y.
   */
  private drawSlice(slice: SerieDefinition, radiusX: number, radiusY: number) {
    if (!slice.isVisible) {
      return;
    }
    const sliceGroup = this.renderer.createGroup();

    const chartDef = this.chartDefinition;
    const center = chartDef!.pie.center;
    const offset = slice.offset;

    let pieHeight = 0;

    // We first draw the side of the pie if exists, for 3D pie slices.
    if (slice.side3D) {
      pieHeight = chartDef!.pie.pieHeight;
      const side = slice.side3D;
      const sliceSidePath = new PathSegments();
      sliceSidePath.move(
        offset.x + side.fromPixel.x,
        offset.y + side.fromPixel.y,
      );
      sliceSidePath.addLine(
        offset.x + side.fromPixel.x,
        offset.y + side.fromPixel.y + pieHeight,
      );
      sliceSidePath.addArc(
        offset.x + center.x,
        offset.y + center.y + pieHeight,
        radiusX,
        radiusY,
        side.fromDegrees,
        side.toDegrees,
        true,
      );
      sliceSidePath.addLine(
        offset.x + side.toPixel.x,
        offset.y + side.toPixel.y,
      );
      sliceSidePath.addArc(
        offset.x + center.x,
        offset.y + center.y,
        radiusX,
        radiusY,
        side.toDegrees,
        side.fromDegrees,
        false,
      );
      this.renderer.drawPath(sliceSidePath, side.brush, sliceGroup);
    }
    // Draw the inner part of the pie if exists, for 3D pie slices.
    if (slice.drawInnerFrom || slice.drawInnerTo) {
      pieHeight = chartDef!.pie.pieHeight;
      const innerPath = new PathSegments();
      innerPath.move(offset.x + center.x, offset.y + center.y);
      innerPath.addLine(offset.x + center.x, offset.y + center.y + pieHeight);
      if (slice.drawInnerTo) {
        innerPath.addLine(
          offset.x + slice.toPixel.x,
          offset.y + slice.toPixel.y + pieHeight,
        );
        innerPath.addLine(
          offset.x + slice.toPixel.x,
          offset.y + slice.toPixel.y,
        );
      }
      if (slice.drawInnerFrom) {
        innerPath.addLine(
          offset.x + slice.fromPixel.x,
          offset.y + slice.fromPixel.y + pieHeight,
        );
        innerPath.addLine(
          offset.x + slice.fromPixel.x,
          offset.y + slice.fromPixel.y,
        );
      }
      this.renderer.drawPath(innerPath, slice.innerBrush, sliceGroup);
    }

    // Chooses default slice brush or a highlight brush.
    // But slice.highlight is always undefined at this time.
    const sliceBrush = slice.brush;
    assert(sliceBrush != null);
    if (slice.isWholeCircle) {
      if (slice.innerRadiusX === 0 && slice.innerRadiusY === 0) {
        this.renderer.drawEllipse(
          center.x,
          center.y,
          radiusX,
          radiusY,
          sliceBrush!,
          sliceGroup,
        );
      } else {
        // A single slice with a hole is constructed of two arcs, each one
        // stretches the full 360 degrees. The outer one is clockwise and the
        // inner one is counter-clockwise, and the reason for this is to create
        // a "hole" - inner path that has an opposite direction of the outer one
        // is "reduced", and creates a hole. In practice, each arc is divided
        // into two 180 degrees arcs because a 360 degrees arc doesn't work.
        const pathSegments = new PathSegments();
        pathSegments.move(center.x, center.y - radiusY);
        pathSegments.addArc(center.x, center.y, radiusX, radiusY, 0, 180, true);
        pathSegments.addArc(
          center.x,
          center.y,
          radiusX,
          radiusY,
          180,
          360,
          true,
        );
        pathSegments.move(center.x, center.y - slice.innerRadiusY);
        pathSegments.addArc(
          center.x,
          center.y,
          slice.innerRadiusX,
          slice.innerRadiusY,
          360,
          180,
          false,
        );
        pathSegments.addArc(
          center.x,
          center.y,
          slice.innerRadiusX,
          slice.innerRadiusY,
          180,
          0,
          false,
        );
        pathSegments.close();
        this.renderer.drawPath(pathSegments, sliceBrush!, sliceGroup);
      }
    } else {
      const slicePath = new PathSegments();
      slicePath.move(
        offset.x + slice.innerFromPixel.x,
        offset.y + slice.innerFromPixel.y,
      );
      slicePath.addLine(
        offset.x + slice.fromPixel.x,
        offset.y + slice.fromPixel.y,
      );
      slicePath.addArc(
        offset.x + center.x,
        offset.y + center.y,
        radiusX,
        radiusY,
        slice.fromDegrees,
        slice.toDegrees,
        true,
      );
      slicePath.addLine(
        offset.x + slice.innerToPixel.x,
        offset.y + slice.innerToPixel.y,
      );
      slicePath.addArc(
        offset.x + center.x,
        offset.y + center.y,
        slice.innerRadiusX,
        slice.innerRadiusY,
        slice.toDegrees,
        slice.fromDegrees,
        false,
      );
      this.renderer.drawPath(slicePath, sliceBrush!, sliceGroup);
    }

    if (slice.ring && chartDef!.shouldHighlightSelection) {
      // The slice.ring is really a GlowDefinition.
      const glow = slice.ring as unknown as GlowDefinition;
      this.drawDonut(glow, sliceGroup);
    }

    const glow = slice.glow;
    if (glow) {
      if (glow.side3D) {
        const sideGlowPath = new PathSegments();
        sideGlowPath.move(glow.side3D.fromPixel.x, glow.side3D.fromPixel.y);
        sideGlowPath.addLine(
          glow.side3D.fromPixel.x,
          glow.side3D.fromPixel.y + pieHeight,
        );
        sideGlowPath.addArc(
          glow.side3D.tip.x,
          glow.side3D.tip.y + pieHeight,
          glow.side3D.radiusX,
          glow.side3D.radiusY,
          glow.side3D.fromDegrees,
          glow.side3D.toDegrees,
          true,
        );
        sideGlowPath.addLine(glow.side3D.toPixel.x, glow.side3D.toPixel.y);
        sideGlowPath.addArc(
          glow.side3D.tip.x,
          glow.side3D.tip.y,
          glow.side3D.radiusX,
          glow.side3D.radiusY,
          glow.side3D.toDegrees,
          glow.side3D.fromDegrees,
          false,
        );
        this.renderer.drawPath(sideGlowPath, glow.side3D.brush, sliceGroup);
      }
      if (glow.drawInnerFrom || glow.drawInnerTo) {
        const innerGlowPath = new PathSegments();
        innerGlowPath.move(glow.innerClose.x, glow.innerClose.y);
        innerGlowPath.addLine(glow.innerFar.x, glow.innerFar.y);
        innerGlowPath.addLine(glow.innerFar.x, glow.innerFar.y + pieHeight);
        innerGlowPath.addLine(glow.innerClose.x, glow.innerClose.y + pieHeight);
        innerGlowPath.addLine(glow.innerClose.x, glow.innerClose.y);
        this.renderer.drawPath(innerGlowPath, glow.innerBrush, sliceGroup);
      }
      this.drawDonut(glow, sliceGroup);
    }

    if (slice.isTextVisible) {
      this.renderer.drawText(
        slice.text,
        slice.textBoxTopLeft.x + offset.x,
        slice.textBoxTopLeft.y + offset.y,
        slice.textBoxSize.width,
        TextAlign.START,
        TextAlign.START,
        slice.textStyle,
        sliceGroup,
      );
    }

    const sliceID = generateId([Token.SLICE, slice.index]);
    const sliceElement = sliceGroup.getElement();
    this.drawElement(this.drawingGroup!, sliceID, sliceElement);

    if (slice.tooltip) {
      const tooltipID = generateId([Token.TOOLTIP, slice.index]);
      this.openTooltip(slice.tooltip, tooltipID);
    }
  }

  /**
   * Draws a single pie chart donut into a given drawing group.
   * TODO(dlaliberte): Create a typedef for donuts.
   * @param donut The donut.
   *     Expected properties are: tip, fromPixel, radiusX, radiusY, fromDegrees,
   * toDegrees, isWholeCircle, brush.
   * @param drawingGroup A drawing group.
   */
  private drawDonut(donut: GlowDefinition, drawingGroup: DrawingGroup) {
    if (donut.isWholeCircle) {
      this.renderer.drawEllipse(
        donut.tip.x,
        donut.tip.y,
        donut.radiusX,
        donut.radiusY,
        donut.brush,
        drawingGroup,
      );
    } else {
      const path = new PathSegments();
      path.move(donut.fromPixel.x, donut.fromPixel.y);
      path.addArc(
        donut.tip.x,
        donut.tip.y,
        donut.radiusX,
        donut.radiusY,
        donut.fromDegrees,
        donut.toDegrees,
        true,
      );
      this.renderer.drawPath(path, donut.brush, drawingGroup);
    }
  }

  /**
   * Draws the chart's labeled legend.
   * @param labeledLegendDefinition The labeled legend definition.
   */
  private drawLabeledLegend(labeledLegendDefinition: LabeledLegendDefinition) {
    const drawTextBlockFunc = this.drawTextBlock.bind(this);
    const registerElementFunc = this.registerElement.bind(this);

    assert(this.labeledLegendDrawingGroup != null);
    labeledLegendBuilder.build(
      this.renderer,
      drawTextBlockFunc,
      labeledLegendDefinition,
      this.labeledLegendDrawingGroup!,
      registerElementFunc,
    );
  }

  /**
   * An abstract method for refreshing the content of the chart.
   * Attempts refreshing the chart using a sequence of short-circuit operations,
   * but may resort to a full redraw of the chart contents when it sees fit.
   * @param baseLayer Base layer of the chart definition. Needed when resorting
   *     to a full redraw.
   * @param refreshLayer Very similar to a ChartDefinition, the refresh layer
   *     specifies only the properties whose value should override the one given
   *     in the chart definition passed in the last drawChartContent() call.
   */
  protected refreshChartContent(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ) {
    // If the labeledLegend has changed, redraw it.
    if (
      !unsafeEquals(
        refreshLayer.labeledLegend,
        this.drawnRefreshLayer!.labeledLegend,
      )
    ) {
      // Delete the drawn legend.
      assertIsElement(this.labeledLegendDrawingGroup);
      this.renderer.removeChildren(this.labeledLegendDrawingGroup!);
      // Apply the refresh layer changes on top of the original legend
      // definition and redraw from scratch.
      const layeredLegendDefinition = new LayeredObject(2);
      layeredLegendDefinition.setLayer(0, baseLayer.labeledLegend || {});
      layeredLegendDefinition.setLayer(1, refreshLayer.labeledLegend || {});
      const labeledLegendDefinition =
        layeredLegendDefinition.compact() as LabeledLegendDefinition;
      assert(labeledLegendDefinition != null);
      this.drawLabeledLegend(labeledLegendDefinition);
    }

    // First revert all changes done in the previous call to this function, then
    // apply the changes of the new refresh layer to the original chart.
    // TODO(dlaliberte): If an element is in both the drawn and the new refresh
    // layers then we redraw it twice instead of once. If it is the same in both
    // layers then we actually redraw it twice instead of just leaving it as is.
    this.revertChartContentChanges(baseLayer);
    this.applyChartContentChanges(baseLayer, refreshLayer);
  }

  /**
   * @param baseLayer Base layer of the chart definition. Needed when resorting
   *     to a full redraw.
   */
  revertChartContentChanges(baseLayer: ChartDefinition) {
    // The refresh layer whose changes were previously
    //   applied to the chart and should now be reverted.
    const refreshLayer = this.drawnRefreshLayer;
    if (!refreshLayer || !refreshLayer.series) {
      return; // nothing to revert
    }
    // Iterate over all changed series.
    for (const serieKey of Object.keys(refreshLayer.series)) {
      const serieIndex = Number(serieKey);
      // Close the tooltip if one is associated with the slice.
      if (refreshLayer.series[serieIndex].tooltip) {
        const tooltipID = generateId([Token.TOOLTIP, Number(serieIndex)]);
        this.closeTooltip(tooltipID);
      }
      // Draw original slice in lieu of the existing one.
      // Solves for radius.
      const layersCount = baseLayer.pie.layers.length;
      const seriesCount = baseLayer.series.length;
      const layerIndex = serieIndex < seriesCount / layersCount ? 0 : 1;
      const layer = baseLayer.pie.layers[layerIndex];
      const radiusX = layer.radiusX;
      const radiusY = layer.radiusY;
      const slice = baseLayer.series[serieIndex];
      this.drawSlice(slice, radiusX, radiusY);
    }
  }

  /**
   * Perform a sequence of short-circuit operations to apply the visual effects
   * of the refresh layer to the chart. If revertChartContentChanges() was
   * called prior to this function, then upon return the drawn chart reflect the
   * refreshLayer precisely.
   * @param baseLayer Base layer of the chart definition. Needed when resorting
   *     to a full redraw.
   * @param refreshLayer The refresh layer whose changes should be applied to
   *     the chart.
   */
  private applyChartContentChanges(
    baseLayer: ChartDefinition,
    refreshLayer: ChartDefinition,
  ) {
    // Iterate over all changed series.
    for (const serieKey of Object.keys(refreshLayer?.series || {})) {
      const serieIndex = Number(serieKey);
      // Draw new slice in lieu of the original one.
      const slice = baseLayer.series[serieIndex];
      const layeredSlice = new LayeredObject(2);
      layeredSlice.setLayer(0, slice);
      layeredSlice.setLayer(1, refreshLayer.series[serieIndex]);

      // Solves for radius.
      const layersCount = baseLayer.pie.layers.length;
      const seriesCount = baseLayer.series.length;
      const layerIndex = serieIndex < seriesCount / layersCount ? 0 : 1;
      const layer = baseLayer.pie.layers[layerIndex];
      const radiusX = layer.radiusX;
      const radiusY = layer.radiusY;
      this.drawSlice(layeredSlice.compact(), radiusX, radiusY);
    }
  }
}
