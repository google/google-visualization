/**
 * @fileoverview Implementation of the default interactivity model for pie
 * charts.
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
import {
  Size,
  toRadians,
} from '@npm//@closure/math/math';
import {Vec2} from '@npm//@closure/math/vec2';

import {FocusTarget, InteractivityModel} from '../common/option_types';
import {Options} from '../common/options';
import {rangeMap} from '../common/util';
import {Brush} from '../graphics/brush';
import {generateInteractivityLayer} from '../legend/labeled_legend_definer';
import {LabeledLegendDefinition} from '../legend/labeled_legend_definition';
import {vectorOnEllipse} from '../math/vector_utils';
import {TextStyle} from '../text/text_style';
import {ActionsMenuDefiner} from '../tooltip/actions_menu_definer';
import {InteractionState} from '../tooltip/tooltip_definition';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {
  GlowDefinition,
  RingDefinition,
  SerieDefinition,
} from '../visualization/corechart/chart_definition_types';
import {
  isTooltipTriggeredByFocus,
  isTooltipTriggeredBySelection,
} from '../visualization/corechart/chart_definition_utils';
import {ChartInteractivityDefiner} from './chart_interactivity_definer';
import {ChartState} from './chart_state';

/**
 * Implementation of a ChartInteractivityDefiner for pie charts.
 * @unrestricted
 */
export class PieChartInteractivityDefiner extends ChartInteractivityDefiner {
  /** The glow opacity level. */
  static readonly GLOW_OPACITY_LEVEL = 0.3;

  /** The glow width in pixels. */
  static readonly GLOW_WIDTH = 6.5;

  /** The ring width in pixels. */
  static readonly RING_WIDTH = 2;

  /**
   * The distance between the end of the slice stroke and the beginning of the
   * ring stroke.
   */
  static readonly RING_DISTANCE = 2.5;

  /** The highlight width in pixels. */
  static readonly HIGHLIGHT_WIDTH = 2;

  /** Value of enableInteractivity option per slice. */
  private readonly enableInteractivityPerSlice: boolean[];

  /** Value of enableInteractivity option per slice. */
  private readonly shouldHighlightHover: boolean;

  /**
   * @param chartOptions The chart configuration options.
   * @param chartDimensions Width and height of the chart.
   * @param chartTextStyle Default text style used throughout the chart.
   * @param interactivityModel The interactivity model.
   * @param focusTarget The focus target.
   * @param numberOfSlices The number of slices inferred from the data.
   * @param actionsMenuDefiner An optional actions menu definer.
   */
  constructor(
    chartOptions: Options,
    chartDimensions: Size,
    chartTextStyle: TextStyle,
    interactivityModel: InteractivityModel,
    focusTarget: Set<FocusTarget>,
    numberOfSlices: number,
    actionsMenuDefiner?: ActionsMenuDefiner,
  ) {
    super(
      chartOptions,
      chartDimensions,
      chartTextStyle,
      interactivityModel,
      focusTarget,
      actionsMenuDefiner,
    );

    // Whether all slices are interactive by default or not.
    const enableInteractivity = chartOptions.inferBooleanValue(
      'enableInteractivity',
      true,
    );

    this.enableInteractivityPerSlice = rangeMap(numberOfSlices, (sliceIndex) =>
      chartOptions.inferBooleanValue(
        `slices.${sliceIndex}.enableInteractivity`,
        enableInteractivity,
      ),
    );

    this.shouldHighlightHover = chartOptions.inferBooleanValue(
      'shouldHighlightHover',
      true,
    );
  }

  extendInteractivityLayer(
    chartDefinition: ChartDefinition,
    chartState: ChartState,
    interactivityLayer: ChartDefinition,
  ) {
    assert(chartDefinition.interactivityModel === InteractivityModel.DEFAULT);
    this.defaultInteractivityModel(
      chartDefinition,
      chartState,
      interactivityLayer,
    );
  }

  equalChartStates(chartState1: ChartState, chartState2: ChartState): boolean {
    // There is no use of the cursor position in Pie chart.
    return chartState1.equals(chartState2, true);
  }

  /**
   * Returns whether a given slice is interactive or not.
   * @param sliceIndex The index of the slice.
   * @return Whether the slice is interactive.
   */
  private isSliceInteractive(sliceIndex: number): boolean {
    return this.enableInteractivityPerSlice[sliceIndex];
  }

  /**
   * Creates a slice object in the interactivity layer. Also create the entire
   * path of objects leading to this slice. Paths that already exist are not
   * recreated, and in particular if the slice already exists it is simply
   * retrieved.
   * @param interactivityLayer The interactivity layer of the chart definition.
   * @param sliceIndex Index of the slice.
   * @return A reference to the slice object created in (or retrieved from) the interactivity layer.
   */
  private createInteractiveSlice(
    interactivityLayer: ChartDefinition,
    sliceIndex: number,
  ): SerieDefinition {
    interactivityLayer.series = interactivityLayer.series || {};

    const series = interactivityLayer.series;
    series[sliceIndex] = series[sliceIndex] || {};

    return series[sliceIndex];
  }

  /**
   * Fills the given interactivity layer according to the way a pie chart
   * construes the chart state in the default interactivity model.
   *
   * @param chartDefinition The base layer of the chart definition.
   * @param chartState The state will induce which properties of the base layer should be overridden.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  defaultInteractivityModel(
    chartDefinition: ChartDefinition,
    chartState: ChartState,
    interactivityLayer: ChartDefinition,
  ) {
    const interactionState: InteractionState = {
      chartDefinition,
      actionsMenuEntries: this.actionsMenuDefiner!.getEntries(),
      interactivityLayer,
      actionsMenuState: chartState.actionsMenu,
    };

    const focusedActionId = chartState.actionsMenu.focused.entryID;
    if (focusedActionId != null) {
      chartState.actionsMenu.focused.action =
        this.actionsMenuDefiner!.getAction(focusedActionId)!.action;
    }

    // Figure out what triggers tooltips: focus, selection, both or none.
    const tooltipTrigger = this.tooltipDefiner.getTrigger();
    const selectionTriggersTooltip =
      isTooltipTriggeredBySelection(tooltipTrigger);
    const focusTriggersTooltip = isTooltipTriggeredByFocus(
      tooltipTrigger,
      chartState.selected,
    );

    // Examine selection first, then focus.
    // This is because the visual effects for selection are taken into account
    // when creating the visual effects for focus (for example: place the glow
    // around the ring surrounding a selected slice that is also focused).

    const showActionsMenu =
      this.actionsMenuDefiner && interactionState.actionsMenuEntries.length > 0;
    const selectedRows = chartState.selected.getRowIndexes();
    const showAggregateTooltip = selectedRows.length > 1 && showActionsMenu;
    for (let i = 0; i < selectedRows.length; ++i) {
      let selectedSliceIndex = selectedRows[i];
      // In diff mode, creates a ring for the slice with new data,
      // which is always in the last layer.
      const seriesCount = chartDefinition.series.length;
      const layersCount = chartDefinition.pie.layers.length;
      const seriesInEachLayer = seriesCount / layersCount;
      selectedSliceIndex += (layersCount - 1) * seriesInEachLayer;
      // Selected slices receive a ring and possibly a tooltip.
      this.ringSlice(chartDefinition, selectedSliceIndex, interactivityLayer);
      if (selectionTriggersTooltip && !showAggregateTooltip) {
        // Embed the actions menu in tooltips of selected elements.
        this.addTooltipToSlice(interactionState, selectedSliceIndex);
      }
    }

    if (selectionTriggersTooltip && showAggregateTooltip) {
      this.addAggregateTooltipToSlices(
        interactionState,
        selectedRows,
        selectedRows[selectedRows.length - 1],
      );
    }

    // Returns array with slice index and its twin, if any.
    // If not in diff mode, returns array with only sliceIndex.
    // Useful for highlighting old and new data in diff mode.
    const getSliceAndItsTwin = (sliceIndex: number) => {
      if (chartDefinition.isDiff) {
        const seriesCount = chartDefinition.series.length;
        const seriesInEachLayer =
          seriesCount / chartDefinition.pie.layers.length;
        const twin = (sliceIndex + seriesInEachLayer) % seriesCount;
        return [sliceIndex, twin];
      } else {
        return [sliceIndex];
      }
    };

    // Handles focus on slice or on legend entry.
    // In a diff chart must select both slices for old and new data.
    // Focused slices receive either a glow (not in diff mode) or an outline
    // (in diff mode), and possibly a tooltip.
    const handleFocus = (
      serieIndex: AnyDuringAssistedMigration,
      mustShowTooltip: AnyDuringAssistedMigration,
    ) => {
      if (serieIndex != null) {
        // Processes selected slice along with its twin, if there is any.
        const focusedSliceIndices = getSliceAndItsTwin(serieIndex);
        let anySlicesFocused = false;
        for (let i = 0; i < focusedSliceIndices.length; ++i) {
          const focusedSlice = focusedSliceIndices[i];
          if (focusedSlice != null && this.isSliceInteractive(focusedSlice)) {
            anySlicesFocused = anySlicesFocused || true;
            if (chartDefinition.isDiff) {
              // TODO(dlaliberte) Never supported?
              // if (this.shouldHighlightSelect) {
              //   this.highlightSlice(chartDefinition, focusedSlice,
              //       interactivityLayer);
              // }
            } else if (this.shouldHighlightHover) {
              this.glowSlice(chartDefinition, focusedSlice, interactivityLayer);
            }
            // Also handle the legend entry (if labeled).
            PieChartInteractivityDefiner.glowLabeledLegend(
              chartDefinition,
              focusedSlice,
              interactivityLayer,
            );
          }
        }
        if (mustShowTooltip && focusTriggersTooltip && anySlicesFocused) {
          // Embed the actions menu in tooltips of focused element.
          this.addTooltipToSlice(interactionState, serieIndex);
        }
      }
    };

    const overlayBox = chartState.overlayBox;
    if (overlayBox) {
      interactivityLayer.overlayBox = overlayBox;
    }

    handleFocus(chartState.focused.serie, true);
    handleFocus(chartState.legend.focused.entry, false);
  }

  /**
   * Adds glow to a given slice by updating the interactivity layer.
   * @param chartDefinition The base layer of the chart definition.
   * @param sliceIndex Index of the slice.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private glowSlice(
    chartDefinition: ChartDefinition,
    sliceIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const pie = chartDefinition.pie;

    const slice = chartDefinition.series[sliceIndex];
    // If the slice offset doesn't exist, that means that the slice wasn't
    // drawn. So we shouldn't continue with ringing it.
    if (slice.offset == null) {
      return;
    }

    // Create a slice object in the interactivity layer.
    const interactiveSlice = this.createInteractiveSlice(
      interactivityLayer,
      sliceIndex,
    );
    const glow: GlowDefinition = {} as GlowDefinition;
    interactiveSlice.glow = glow;

    const GLOW_OPACITY_LEVEL = PieChartInteractivityDefiner.GLOW_OPACITY_LEVEL;

    // Use the same brush as the slice itself, with reduced opacity.
    glow.brush = new Brush({
      stroke: slice.brush!.getFill(),
      strokeWidth: PieChartInteractivityDefiner.GLOW_WIDTH,
      strokeOpacity: GLOW_OPACITY_LEVEL,
    });

    // The glow has the same tip and same angle as the slice.
    glow.tip = new Coordinate(
      pie.center.x + slice.offset.x,
      pie.center.y + slice.offset.y,
    );
    glow.fromDegrees = slice.fromDegrees;
    glow.toDegrees = slice.toDegrees;
    glow.isWholeCircle = slice.isWholeCircle;
    // The radius should be the distance between the slice tip and the middle
    // of the glow stroke.
    let radiusX;
    let radiusY;

    // If the slice has a ring, start the glow from it.
    const ring = interactiveSlice.ring;
    if (ring && chartDefinition.shouldHighlightSelection) {
      radiusX = ring.radiusX + ring.brush.getStrokeWidth() / 2;
      radiusY = ring.radiusY + ring.brush.getStrokeWidth() / 2;
    } else {
      const halfSliceStrokeWidth = slice.brush!.getStrokeWidth() / 2;
      radiusX = pie.radiusX + halfSliceStrokeWidth;
      radiusY = pie.radiusY + halfSliceStrokeWidth;
    }
    const halfGlowStrokeWidth = glow.brush.getStrokeWidth() / 2;
    glow.radiusX = radiusX + halfGlowStrokeWidth;
    glow.radiusY = radiusY + halfGlowStrokeWidth;
    // Compute the glow from/to pixel coordinates.
    let glowFromRadians = toRadians(glow.fromDegrees - 90);
    let glowToRadians = toRadians(glow.toDegrees - 90);
    glow.fromPixel = Coordinate.sum(
      glow.tip,
      vectorOnEllipse(glowFromRadians, glow.radiusX, glow.radiusY),
    );
    glow.toPixel = Coordinate.sum(
      glow.tip,
      vectorOnEllipse(glowToRadians, glow.radiusX, glow.radiusY),
    );

    const side3D = slice.side3D;
    if (side3D) {
      glow.side3D = glow.side3D || {};

      glow.side3D.brush = Brush.createFillBrush(
        side3D.brush.getFill(),
        GLOW_OPACITY_LEVEL,
      );

      glow.side3D.tip = glow.tip.clone();
      glow.side3D.fromDegrees = side3D.fromDegrees;
      glow.side3D.toDegrees = side3D.toDegrees;

      glow.side3D.radiusX = glow.radiusX + halfGlowStrokeWidth;
      glow.side3D.radiusY = glow.radiusY + halfGlowStrokeWidth;
      // Compute the side glow from/to pixel coordinates.
      glowFromRadians = toRadians(glow.side3D.fromDegrees - 90);
      glowToRadians = toRadians(glow.side3D.toDegrees - 90);
      glow.side3D.fromPixel = Coordinate.sum(
        glow.side3D.tip,
        vectorOnEllipse(
          glowFromRadians,
          glow.side3D.radiusX,
          glow.side3D.radiusY,
        ),
      );
      glow.side3D.toPixel = Coordinate.sum(
        glow.side3D.tip,
        vectorOnEllipse(
          glowToRadians,
          glow.side3D.radiusX,
          glow.side3D.radiusY,
        ),
      );
    }

    glow.drawInnerFrom = slice.drawInnerFrom;
    glow.drawInnerTo = slice.drawInnerTo;
    if (glow.drawInnerFrom || glow.drawInnerTo) {
      glow.innerBrush = Brush.createFillBrush(
        slice.innerBrush.getFill(),
        GLOW_OPACITY_LEVEL,
      );

      glow.radians = glow.drawInnerFrom ? glowFromRadians : glowToRadians;
      const calcInnerCoordinate = (glow: GlowDefinition, direction: number) =>
        Coordinate.sum(
          glow.tip,
          vectorOnEllipse(
            glow.radians,
            glow.radiusX + (direction * glow.brush.getStrokeWidth()) / 2,
            glow.radiusY + (direction * glow.brush.getStrokeWidth()) / 2,
          ),
        );

      glow.innerClose = calcInnerCoordinate(glow, -1) as Vec2;
      glow.innerFar = calcInnerCoordinate(glow, 1) as Vec2;
    }
  }

  /**
   * Adds a ring to a given slice by updating the interactivity layer.
   * @param chartDefinition The base layer of the chart definition.
   * @param sliceIndex Index of the slice.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private ringSlice(
    chartDefinition: ChartDefinition,
    sliceIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const pie = chartDefinition.pie;
    // TODO(dlaliberte): Support 3D slices.
    if (pie.pieHeight > 0) {
      return;
    }

    const slice = chartDefinition.series[sliceIndex];
    // If the slice offset doesn't exist, that means that the slice wasn't
    // drawn. So we shouldn't continue with ringing it.
    if (slice.offset == null) {
      return;
    }

    // Creates a slice object in the interactivity layer and attach ring to it.
    const interactiveSlice = this.createInteractiveSlice(
      interactivityLayer,
      sliceIndex,
    );

    // PieChart uses the slice (aka series) "ring" property as a glow.
    // So we create a GlowDefinition, but store as if it's a RingDefinition.
    const ring: GlowDefinition = {} as GlowDefinition;
    interactiveSlice.ring = ring as unknown as RingDefinition;

    // Uses the same color as the slice when brush is not specified.
    ring.brush = Brush.createStrokeBrush(
      slice.brush!.getFill(),
      PieChartInteractivityDefiner.RING_WIDTH,
    );

    // The ring has the same tip and same angle as the slice.
    ring.tip = new Coordinate(
      pie.center.x + slice.offset.x,
      pie.center.y + slice.offset.y,
    );
    ring.fromDegrees = slice.fromDegrees;
    ring.toDegrees = slice.toDegrees;
    ring.isWholeCircle = slice.isWholeCircle;
    // The radius should be the distance between the slice tip and the middle
    // of the ring stroke.
    const ringOffset =
      slice.brush!.getStrokeWidth() / 2 +
      PieChartInteractivityDefiner.RING_DISTANCE +
      ring.brush.getStrokeWidth() / 2;
    ring.radiusX = pie.radiusX + ringOffset;
    ring.radiusY = pie.radiusY + ringOffset;
    // Compute the ring from/to pixel coordinates.
    const ringFromRadians = toRadians(ring.fromDegrees - 90);
    const ringToRadians = toRadians(ring.toDegrees - 90);
    ring.fromPixel = Coordinate.sum(
      ring.tip,
      vectorOnEllipse(ringFromRadians, ring.radiusX, ring.radiusY),
    );
    ring.toPixel = Coordinate.sum(
      ring.tip,
      vectorOnEllipse(ringToRadians, ring.radiusX, ring.radiusY),
    );
  }

  /**
   * Adds a tooltip to a given slice by updating the interactivity layer.
   * @param interactionState The interaction state.
   * @param sliceIndex Index of the slice.
   */
  private addTooltipToSlice(
    interactionState: InteractionState,
    sliceIndex: number,
  ) {
    // Create an object for the slice in the interactivity layer (or simply
    // retrieve it if it already exists).
    const interactiveSlice = this.createInteractiveSlice(
      interactionState.interactivityLayer as ChartDefinition,
      sliceIndex,
    );

    // Creates the tooltip definition and attach it to the slice.
    const tooltipDefinition = this.tooltipDefiner.createTooltip(
      interactionState,
      sliceIndex,
      null,
      null,
    );
    // Only an annotation can have a null tooltip.
    // except for all the invisible slices.
    if (!tooltipDefinition) {
      return;
    }
    assert(tooltipDefinition != null);
    interactiveSlice.tooltip = tooltipDefinition;

    // Allow an embedded actions menu to extend the interactivity layer.
    if (interactionState.actionsMenuState) {
      assert(this.actionsMenuDefiner != null);
      // Note that because the entire tooltip definition is generated on
      // interaction, tooltipDefinition is the same as interactiveDatum.tooltip.
      this.actionsMenuDefiner!.extendInteractivityLayer(
        tooltipDefinition,
        interactionState.actionsMenuState,
        interactiveSlice.tooltip,
      );
    }
  }

  /**
   * Adds a tooltip to a given slice by updating the interactivity layer.
   * @param interactionState The interaction state.
   * @param sliceIndices Indices of the slices.
   * @param positionSlice Index of the slice that the tooltip position should be based on.
   */
  private addAggregateTooltipToSlices(
    interactionState: InteractionState,
    sliceIndices: number[],
    positionSlice: number,
  ) {
    // Create an object for the slice in the interactivity layer (or simply
    // retrieve it if it already exists).
    const interactiveSlice = this.createInteractiveSlice(
      interactionState.interactivityLayer as ChartDefinition,
      positionSlice,
    );

    // Create the tooltip definition and attach it to the slice.
    const tooltipDefinition = this.tooltipDefiner.createAggregateSeriesTooltip(
      interactionState,
      sliceIndices,
      positionSlice,
    );
    // Only an annotation can have a null tooltip.
    assert(tooltipDefinition != null);
    interactiveSlice.tooltip = tooltipDefinition;

    // Allow an embedded actions menu to extend the interactivity layer.
    if (interactionState.actionsMenuState) {
      assert(this.actionsMenuDefiner != null);
      // Note that because the entire tooltip definition is generated on
      // interaction, tooltipDefinition is the same as interactiveDatum.tooltip.
      this.actionsMenuDefiner!.extendInteractivityLayer(
        tooltipDefinition,
        interactionState.actionsMenuState,
        interactiveSlice.tooltip,
      );
    }
  }

  /**
   * Adds a glow to a labeled entry index.
   * @param chartDefinition The base layer of the chart definition.
   * @param entryIndex Index of the entry.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private static glowLabeledLegend(
    chartDefinition: ChartDefinition,
    entryIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    if (!chartDefinition.labeledLegend) {
      return;
    }

    interactivityLayer.labeledLegend = generateInteractivityLayer(
      chartDefinition.labeledLegend,
      entryIndex,
    ) as LabeledLegendDefinition;
  }
}
