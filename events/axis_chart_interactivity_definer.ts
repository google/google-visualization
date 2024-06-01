/**
 * @fileoverview Implementation of the default interactivity model for axis
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

import * as asserts from '@npm//@closure/asserts/asserts';
import * as googColor from '@npm//@closure/color/color';
import {Box} from '@npm//@closure/math/box';
import {Coordinate} from '@npm//@closure/math/coordinate';
import * as googMath from '@npm//@closure/math/math';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import {Size} from '@npm//@closure/math/size';

import {ColorBarDefinition} from '../colorbar/color_bar_definition';
import * as colorbarDefiner from '../colorbar/definer';
import {Marker} from '../colorbar/types';
import {
  AggregationTarget,
  ChartType,
  CrosshairOrientation,
  CrosshairTrigger,
  FocusTarget,
  InteractivityModel,
  LegendPosition,
  SerieType,
  TooltipTrigger,
} from '../common/option_types';
import {Options} from '../common/options';
import '../common/selection_object';
import {ActionsMenu, ChartState} from '../events/chart_state';
import {Brush} from '../graphics/brush';
import {PathSegments} from '../graphics/path_segments';
import * as pathsegmentsutil from '../graphics/path_segments_util';
import {
  LegendDefinition,
  Entry as LegendEntry,
  Page,
} from '../legend/legend_definition';
import {TextBlock} from '../text/text_block_object';
import {TextStyle} from '../text/text_style';
import {ActionsMenuDefiner} from '../tooltip/actions_menu_definer';
import * as tooltipDefinition from '../tooltip/tooltip_definition';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import * as chartDefinitionTypes from '../visualization/corechart/chart_definition_types';
import * as chartDefinitionUtil from '../visualization/corechart/chart_definition_utils';
import {ColumnRole} from '../visualization/corechart/serie_columns';
import {ChartInteractivityDefiner} from './chart_interactivity_definer';

// Create aliases for namespaces used extensively throughout this file.

const {StackingType} = chartDefinitionTypes;

/**
 * Implementation of a ChartInteractivityDefiner for axis charts.
 * @unrestricted
 */
export class AxisChartInteractivityDefiner extends ChartInteractivityDefiner {
  //------------------------------------------------------------------------------
  //                         DEFAULT INTERACTIVITY MODEL
  //------------------------------------------------------------------------------

  /** The glow color. */
  static readonly GLOW_COLOR = 'black';

  /** The glow opacity levels for points. */
  static readonly GLOW_OPACITY_LEVELS_FOR_POINTS: number[] = [0.25, 0.1, 0.05];

  /** The glow opacity levels for lines. */
  static readonly GLOW_OPACITY_LEVELS_FOR_LINES: number[] = [0.3, 0.1, 0.05];

  /** The glow opacity levels for bars. */
  static readonly GLOW_OPACITY_LEVELS_FOR_BARS: number[] = [0.3, 0.15, 0.05];

  /**
   * The distance between the end of the point stroke and the beginning of the
   * ring stroke.
   */
  static readonly POINT_RING_DISTANCE = 1.5;

  /**
   * The distance between the end of the line stroke and the beginning of the
   * ring stroke.
   */
  static readonly LINE_RING_DISTANCE = 2;

  /**
   * The distance between the end of the bar stroke and the beginning of the
   * ring stroke.
   */
  static readonly BAR_RING_DISTANCE = 1.5;

  /** The action that will trigger crosshairs. */
  private readonly crosshairTrigger: CrosshairTrigger;

  /** The orientation of the crosshairs on a selected datum. */
  private readonly crosshairSelectedOrientation: CrosshairOrientation;

  /** The orientation of the crosshairs on a focused datum. */
  private readonly crosshairFocusedOrientation: CrosshairOrientation;

  /** The color that should be used on a crosshair for a selected datum. */
  private readonly crosshairSelectedColor: string | null;

  /** The color that should be used on a crosshair for a focused datum. */
  private readonly crosshairFocusedColor: string | null;

  /** The opacity that should be used on a crosshair for a selected datum. */
  private readonly crosshairSelectedOpacity: number;

  /** The opacity that should be used on a crosshair for a focused datum. */
  private readonly crosshairFocusedOpacity: number;

  private readonly aggregationTarget: AggregationTarget;

  /**
   * Whether to ignore the cursor or not when comparing two chart states.
   * If set to true then two chart states discerned only by their cursor
   * position are considered equal.
   */
  private ignoreCursorInChartStateComparison = true;

  /**
   * @param chartOptions The chart configuration options.
   * @param chartDimensions Width and height of the chart.
   * @param chartTextStyle Default text style used throughout the chart.
   * @param interactivityModel The interactivity model.
   * @param focusTarget The focus target.
   * @param numberOfSeries The number of series inferred from the data.
   * @param actionsMenuDefiner An optional actions menu definer.
   */
  constructor(
    chartOptions: Options,
    chartDimensions: Size,
    chartTextStyle: TextStyle,
    interactivityModel: InteractivityModel,
    focusTarget: Set<FocusTarget>,
    numberOfSeries: number,
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

    this.crosshairTrigger = chartOptions.inferOptionalStringValue(
      'crosshair.trigger',
      CrosshairTrigger,
    ) as CrosshairTrigger;

    this.crosshairSelectedOrientation = chartOptions.inferStringValue(
      ['crosshair.selected.orientation', 'crosshair.orientation'],
      CrosshairOrientation.BOTH,
      CrosshairOrientation,
    ) as CrosshairOrientation;

    this.crosshairFocusedOrientation = chartOptions.inferStringValue(
      ['crosshair.focused.orientation', 'crosshair.orientation'],
      CrosshairOrientation.BOTH,
      CrosshairOrientation,
    ) as CrosshairOrientation;

    this.crosshairSelectedColor = chartOptions.inferOptionalColorValue([
      'crosshair.selected.color',
      'crosshair.color',
    ]);

    this.crosshairFocusedColor = chartOptions.inferOptionalColorValue([
      'crosshair.focused.color',
      'crosshair.color',
    ]);

    this.crosshairSelectedOpacity = chartOptions.inferRatioNumberValue(
      ['crosshair.selected.opacity', 'crosshair.opacity'],
      1,
    );

    this.crosshairFocusedOpacity = chartOptions.inferRatioNumberValue(
      ['crosshair.focused.opacity', 'crosshair.opacity'],
      1,
    );

    this.aggregationTarget = chartOptions.inferStringValue(
      'aggregationTarget',
      AggregationTarget.NONE,
      AggregationTarget,
    ) as AggregationTarget;
  }

  extendInteractivityLayer(
    chartDefinition: ChartDefinition,
    chartState: ChartState,
    interactivityLayer: ChartDefinition,
  ) {
    // Optimization: when the cursor position is not taken into account by
    // interactivity definer do not regenerate the interactivity layer on every
    // change to the cursor position.
    this.ignoreCursorInChartStateComparison = true;

    switch (chartDefinition.interactivityModel) {
      case InteractivityModel.DEFAULT:
        this.defaultInteractivityModel(
          chartDefinition,
          chartState,
          interactivityLayer,
        );
        break;

      case InteractivityModel.DIVE:
        this.diveInteractivityModel(
          chartDefinition,
          chartState,
          interactivityLayer,
        );
        break;

      default:
        asserts.fail(
          `Invalid interactivity model "${chartDefinition.interactivityModel}"`,
        );
    }
  }

  equalChartStates(chartState1: ChartState, chartState2: ChartState): boolean {
    return chartState1.equals(
      chartState2,
      this.ignoreCursorInChartStateComparison,
    );
  }

  /**
   * Returns whether a given serie is interactive or not.
   * @param chartDef The chart definition.
   * @param serieIndex The index of the serie.
   * @return Whether the serie is interactive.
   */
  private isSerieInteractive(
    chartDef: ChartDefinition,
    serieIndex: number,
  ): boolean {
    return chartDef.series[serieIndex].enableInteractivity;
  }

  /**
   * Returns whether any series is interactive or not.
   * @param chartDef The chart definition.
   * @return Whether any serie is interactive.
   */
  private isAnySeriesInteractive(chartDef: ChartDefinition): boolean {
    return chartDef.series.some((series) => series.enableInteractivity);
  }

  /**
   * Returns whether a given annotation is interactive or not.
   * @param chartDef The chart definition.
   * @param serieIndex The serie index (or null for category annotation).
   * @return Whether the annotation is interactive.
   */
  private isAnnotationInteractive(
    chartDef: ChartDefinition,
    serieIndex?: number | null,
  ): boolean {
    return serieIndex != null
      ? this.isSerieInteractive(chartDef, serieIndex)
      : chartDef.enableInteractivity;
  }

  /**
   * Creates a datum object in the interactivity layer. Also create the entire
   * path of objects leading to this datum. Paths that already exist are not
   * recreated, and in particular if the datum already exists it is simply
   * retrieved.
   * @param interactivityLayer The interactivity layer of the chart definition.
   * @param serieIndex Index of the serie the datum belongs to.
   * @param datumIndex Index of the datum within the serie.
   * @return A reference to the datum object created in (or retrieved from) the interactivity layer.
   */
  private createInteractiveDatum(
    interactivityLayer: ChartDefinition,
    serieIndex: number,
    datumIndex: number,
  ): chartDefinitionTypes.DatumDefinition {
    interactivityLayer.series = interactivityLayer.series || {};

    const series = interactivityLayer.series;
    series[serieIndex] = series[serieIndex] || {};

    const serie = series[serieIndex];
    serie.points = serie.points || {};

    const points = serie.points;
    const datum = (points[datumIndex] ||
      {}) as chartDefinitionTypes.DatumDefinition;
    points[datumIndex] = datum;

    return datum;
  }

  /**
   * Creates an annotation object in the interactivity layer. Also create the
   * entire path of objects leading to this annotation. Paths that already exist
   * are not recreated, and in particular if the annotation already exists it is
   * simply retrieved.
   * @param interactivityLayer The interactivity layer of the chart definition.
   * @param serieIndex The serie index (or null for category annotation).
   * @param datumOrCategoryIndex The datum index, or category index if serieIndex is null.
   * @return A reference to the annotation object created in (or retrieved from) the interactivity layer.
   */
  private createInteractiveAnnotation(
    interactivityLayer: ChartDefinition,
    serieIndex: number | null | undefined,
    datumOrCategoryIndex: number,
  ): chartDefinitionTypes.Annotation {
    if (serieIndex != null) {
      // Datum annotation.
      const datum = this.createInteractiveDatum(
        interactivityLayer,
        serieIndex,
        datumOrCategoryIndex,
      );
      datum.annotation = (datum.annotation ||
        {}) as chartDefinitionTypes.Annotation;
      return datum.annotation;
    } else {
      // Category annotation.
      const category = this.createInteractiveCategory(
        interactivityLayer,
        datumOrCategoryIndex,
      );
      category.annotation = (category.annotation ||
        {}) as chartDefinitionTypes.Annotation;
      return category.annotation;
    }
  }

  /**
   * Creates a serie object in the interactivity layer. Also create the entire
   * path of objects leading to this serie. Paths that already exist are not
   * recreated, and in particular if the serie already exists it is simply
   * retrieved.
   * @param interactivityLayer The interactivity layer of the chart definition.
   * @param serieIndex Index of the serie.
   * @return A reference to the serie object created in (or retrieved from) the interactivity layer.
   */
  private createInteractiveSerie(
    interactivityLayer: ChartDefinition,
    serieIndex: number,
  ): chartDefinitionTypes.SerieDefinition {
    interactivityLayer.series =
      interactivityLayer.series ||
      ([] as chartDefinitionTypes.SerieDefinition[]);

    const series = interactivityLayer.series;
    series[serieIndex] = series[serieIndex] || {};

    return series[serieIndex];
  }

  /**
   * Creates a category object in the interactivity layer. Also create the
   * entire path of objects leading to this category. Paths that already exist
   * are not recreated, and in particular if the category already exists it is
   * simply retrieved.
   * @param interactivityLayer The interactivity layer of the chart definition.
   * @param categoryIndex Index of the category.
   * @return A reference to the category object created in (or retrieved from) the interactivity layer.
   */
  private createInteractiveCategory(
    interactivityLayer: ChartDefinition,
    categoryIndex: number,
  ): chartDefinitionTypes.CategoryDefinition {
    interactivityLayer.categories = interactivityLayer.categories || {};

    const categories = interactivityLayer.categories;
    categories[categoryIndex] = categories[categoryIndex] || {};

    return categories[categoryIndex];
  }

  /**
   * Creates a legend entry object in the interactivity layer. Also create the
   * entire path of objects leading to this entry. Paths that already exist are
   * not recreated, and in particular if the entry already exists it is simply
   * retrieved.
   * @param interactivityLayer The interactivity layer of the chart definition.
   * @param legendEntryIndex Index of the legend entry.
   * @return A reference to the legend entry object created in (or retrieved from) the interactivity layer.
   */
  private createInteractiveLegendEntry(
    interactivityLayer: ChartDefinition,
    legendEntryIndex: number,
  ): LegendEntry {
    interactivityLayer.legend = (interactivityLayer.legend ||
      {}) as LegendDefinition;

    const legend = interactivityLayer.legend;
    legend.currentPage = (legend.currentPage || {}) as Page;

    const currentPage = legend.currentPage;
    currentPage[legendEntryIndex] = currentPage[legendEntryIndex] || {};

    return currentPage[legendEntryIndex];
  }

  /**
   * Fills the given interactivity layer according to the way an axis chart
   * construes the chart state in the default interactivity model.
   * TODO(dlaliberte): subdivide this huge mess.
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
    const actionsMenuDefiner = this.actionsMenuDefiner as ActionsMenuDefiner;
    const interactionState: tooltipDefinition.InteractionState = {
      chartDefinition,
      actionsMenuEntries: actionsMenuDefiner.getEntries(),
      interactivityLayer,
      actionsMenuState: chartState.actionsMenu,
    };

    const focusedActionId = chartState.actionsMenu.focused.entryID;
    if (focusedActionId != null) {
      chartState.actionsMenu.focused.action =
        actionsMenuDefiner.getAction(focusedActionId)!.action;
    }

    // Figure out what triggers tooltips: focus, selection, both or none.
    const tooltipTrigger = this.tooltipDefiner.getTrigger();
    const selectionTriggersTooltip =
      chartDefinitionUtil.isTooltipTriggeredBySelection(tooltipTrigger);
    const focusTriggersTooltip = chartDefinitionUtil.isTooltipTriggeredByFocus(
      tooltipTrigger,
      chartState.selected,
    );

    // Examine selection first, then focus.
    // This is because the visual effects for selection are taken into account
    // when creating the visual effects for focus (for example: place the glow
    // around the ring surrounding a selected point that is also focused).

    // ---------------------------------------------------------------------------
    // Cell Selection
    // ---------------------------------------------------------------------------

    const shouldAggregate = this.aggregationTarget !== AggregationTarget.NONE;
    const showActionsMenu = interactionState.actionsMenuEntries.length > 0;
    const selectedCells = chartState.selected.getCells();
    const showAggregateTooltip =
      selectedCells.length > 1 && (shouldAggregate || showActionsMenu);

    for (let i = 0; i < selectedCells.length; ++i) {
      const selectedCell = selectedCells[i];
      const selectedColumn = selectedCell.column;
      const selectedRow = selectedCell.row;
      // asserts.assert(selectedColumn != null);
      // asserts.assert(selectedRow != null);

      const selectedColumnInfo =
        chartDefinition.dataTableColumnRoleInfo[selectedColumn];
      const selectedSerieIndex = selectedColumnInfo.serieIndex;

      const selectedDatum = chartDefinition.getDatumForCellRef({
        column: selectedColumn,
        row: selectedRow,
      });
      if (!selectedDatum) {
        // Ignore null datum
        continue;
      }

      switch (selectedColumnInfo.role) {
        case ColumnRole.DATA:
          asserts.assert(selectedSerieIndex != null);
          // Selected data points receive a ring and possibly a tooltip.
          this.ringDatum(
            chartDefinition,
            selectedDatum.serie,
            selectedDatum.category,
            interactivityLayer,
          );
          if (selectionTriggersTooltip && !showAggregateTooltip) {
            // Embed the actions menu in tooltips of selected elements.
            this.addTooltipToDatum(
              interactionState,
              selectedDatum.serie,
              selectedDatum.category,
            );
          }
          break;

        case ColumnRole.ANNOTATION:
          if (
            !this.isAnnotationInteractive(chartDefinition, selectedSerieIndex)
          ) {
            break;
          }
          const selectedAnnotationIndex = selectedColumnInfo.roleIndex;
          if (selectedAnnotationIndex != null) {
            this.makeAnnotationBold(
              chartDefinition,
              selectedDatum.serie,
              selectedDatum.category,
              selectedAnnotationIndex,
              interactivityLayer,
            );
            if (selectionTriggersTooltip) {
              this.addTooltipToAnnotation(
                interactionState,
                selectedDatum.serie,
                selectedDatum.category,
                selectedAnnotationIndex,
              );
            }
          }
          break;

        default:
          throw new Error(`Unsupported column role ${selectedColumnInfo.role}`);
      }
    }

    if (
      selectionTriggersTooltip &&
      showAggregateTooltip &&
      !chartDefinition.histogramAsColumnChart
    ) {
      const data = selectedCells
        .map((cell) =>
          chartDefinition.getDatumForCellRef({
            column: cell.column,
            row: cell.row,
          }),
        )
        .filter((x) => x != null) as chartDefinitionTypes.Datum[];

      if (data.length > 0) {
        // TODO(dlaliberte) don't aggregate if tooltipTrigger is 'selection'
        // and user is merely hovering, or when hovering and data is unchanged.
        this.addAggregateTooltipToData(
          interactionState,
          shouldAggregate ? data : [],
          data[data.length - 1],
        );
      }
    }

    // ---------------------------------------------------------------------------
    // Column Selection
    // ---------------------------------------------------------------------------

    const selectedColumns = chartState.selected.getColumnIndexes();
    for (let i = 0; i < selectedColumns.length; ++i) {
      const selectedColumn = selectedColumns[i];

      const selectedColumnInfo =
        chartDefinition.dataTableColumnRoleInfo[selectedColumn];
      if (selectedColumnInfo == null) {
        // TODO: Consider fixing the selection.
        continue;
      }
      const selectedSerieIndex = selectedColumnInfo.serieIndex;

      if (selectedSerieIndex == null) {
        continue;
      }
      // Selected series receive a ring (or all their data points receive one).
      this.ringSerie(chartDefinition, selectedSerieIndex, interactivityLayer);
    }

    // ---------------------------------------------------------------------------
    // Row Selection
    // ---------------------------------------------------------------------------

    const isBubbleChart = chartDefinition.chartType === ChartType.BUBBLE;
    const selectedRows = chartState.selected.getRowIndexes();
    const showAggregateTooltipRows =
      selectedRows.length > 1 && (shouldAggregate || showActionsMenu);
    for (let i = 0; i < selectedRows.length; ++i) {
      const selectedRow = selectedRows[i];

      const selectedCategoryIndex =
        chartDefinition.dataTableToCategoryMap[selectedRow];
      // In BubbleChart a data table row is a single datum, while in other axis
      // charts a row is an entire category. The 'if' below is all about this
      // difference.
      if (isBubbleChart) {
        const selectedSerieIndex = 0;
        // Selected bubble receives a ring and possibly a tooltip.
        this.ringDatum(
          chartDefinition,
          selectedSerieIndex,
          selectedCategoryIndex,
          interactivityLayer,
        );
        if (selectionTriggersTooltip && !showAggregateTooltipRows) {
          // Embed the actions menu in tooltips of selected elements.
          this.addTooltipToDatum(
            interactionState,
            selectedSerieIndex,
            selectedCategoryIndex,
          );
        }
      } else {
        // All the data points in the selected category receive a ring.
        // In addition, the category may receive a tooltip.
        this.ringCategory(
          chartDefinition,
          selectedCategoryIndex,
          interactivityLayer,
        );
        if (selectionTriggersTooltip && !showAggregateTooltipRows) {
          // Embed the actions menu in tooltips of selected elements.
          this.addTooltipToCategory(
            interactionState,
            chartState.cursor.positionAtLastClick,
            selectedCategoryIndex,
          );
        }
      }
    }
    if (showAggregateTooltipRows) {
      if (isBubbleChart) {
        // Bubble chart doesn't yet support multiple selection, but we should
        // show a tooltip for at least the last selected row.
        const lastSelectedRow = selectedRows[selectedRows.length - 1];
        this.addTooltipToDatum(
          interactionState,
          0,
          chartDefinition.dataTableToCategoryMap[lastSelectedRow],
        );
      } else if (selectionTriggersTooltip) {
        // We can reuse the datum aggregation algorithm for the categories. This
        // way we will give users a choice of what they want to aggregate on.
        // The way this works is we iterate over each category and each series;
        // we push all of these points onto a list. We then pass a list of data
        // to the aggregate tooltip function, which will do the heavy lifting.
        const categories = selectedRows.map(
          (row) => chartDefinition.dataTableToCategoryMap[row],
        );

        if (categories.length > 0) {
          this.addAggregateTooltipToCategory(
            interactionState,
            chartState.cursor.positionAtLastClick,
            categories,
          );
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Cell Focus
    // ---------------------------------------------------------------------------

    let focusedSerieIndex = chartState.focused.serie;
    const focusedDatumIndex = chartState.focused.datum;
    if (focusedDatumIndex != null) {
      // Focused datum has no meaning without the serie it belongs to.
      asserts.assert(focusedSerieIndex != null);
    }

    if (focusedDatumIndex != null) {
      focusedSerieIndex = focusedSerieIndex as number;
      if (this.isSerieInteractive(chartDefinition, focusedSerieIndex)) {
        // Focused data points receive a glow, and possibly a tooltip.
        this.glowDatum(
          chartDefinition,
          focusedSerieIndex,
          focusedDatumIndex,
          interactivityLayer,
        );
        if (focusTriggersTooltip) {
          // Do not embed the actions menu in tooltips of focused elements.
          this.addTooltipToDatum(
            interactionState,
            focusedSerieIndex,
            focusedDatumIndex,
          );
        }
        this.markDatumInColorBar(
          chartDefinition,
          focusedSerieIndex,
          focusedDatumIndex,
          interactivityLayer,
        );
      }
    } else if (focusedSerieIndex != null) {
      if (this.isSerieInteractive(chartDefinition, focusedSerieIndex)) {
        // Add glow to the serie.
        this.glowSerie(chartDefinition, focusedSerieIndex, interactivityLayer);
      }
    }

    const focusedLegendEntryIndex = chartState.legend.focused.entry;
    if (focusedLegendEntryIndex != null) {
      if (this.isSerieInteractive(chartDefinition, focusedLegendEntryIndex)) {
        // Add glow to the serie represented by the legend entry.
        this.glowSerie(
          chartDefinition,
          focusedLegendEntryIndex,
          interactivityLayer,
        );
      }
    }

    // ---------------------------------------------------------------------------
    // Row Focus
    // ---------------------------------------------------------------------------

    const focusedCategoryIndex = chartState.focused.category;
    if (
      focusedCategoryIndex != null &&
      chartDefinition.categories[focusedCategoryIndex]
    ) {
      // All the data points in the focused category receive glow.
      // In addition, the category may receive a tooltip.
      this.glowCategory(
        chartDefinition,
        focusedCategoryIndex,
        interactivityLayer,
      );
      if (
        focusTriggersTooltip &&
        this.isAnySeriesInteractive(interactionState.chartDefinition)
      ) {
        // Do not embed the actions menu in tooltips of focused elements.
        this.addTooltipToCategory(
          interactionState,
          chartState.cursor.position,
          focusedCategoryIndex,
        );
        // As long as there is a focused category, changes to the cursor
        // position should initiate regeneration of the interactivity layer, so
        // that the tooltip can move together with the cursor.
        this.ignoreCursorInChartStateComparison = false;
      }
    }

    // Handle annotation expansion.
    const expandedAnnotation = chartState.annotations.expanded;
    if (expandedAnnotation) {
      const interactiveAnnotation = this.createInteractiveAnnotation(
        interactivityLayer,
        expandedAnnotation.serieIndex,
        expandedAnnotation.datumOrCategoryIndex,
      );
      interactiveAnnotation.bundle =
        interactiveAnnotation.bundle ||
        ({} as chartDefinitionTypes.AnnotationBundle);
      interactiveAnnotation.bundle.isExpanded = true;
    }

    const focusedAnnotation = chartState.annotations.focused;
    if (focusedAnnotation && focusTriggersTooltip) {
      const annotationColumn = focusedAnnotation.column;
      const annotationRow = focusedAnnotation.row;

      const annotationColumnInfo =
        chartDefinition.dataTableColumnRoleInfo[annotationColumn];
      const annotationSerieIndex = annotationColumnInfo.serieIndex;
      const annotationCategoryIndex =
        chartDefinition.dataTableToCategoryMap[annotationRow];
      const annotationLabelIndex = annotationColumnInfo.roleIndex;

      if (this.isAnnotationInteractive(chartDefinition, annotationSerieIndex)) {
        this.addTooltipToAnnotation(
          interactionState,
          annotationSerieIndex,
          annotationCategoryIndex,
          annotationLabelIndex,
        );
      }
    }

    const overlayBox = chartState.overlayBox;
    if (overlayBox) {
      interactivityLayer.overlayBox = overlayBox;
    }
  }

  /**
   * Adds glow to a given data point by updating the interactivity layer.
   * @param chartDefinition The base layer of the chart definition.
   * @param serieIndex Index of the serie the datum belongs to.
   * @param datumIndex Index of the datum within the serie.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private glowDatum(
    chartDefinition: ChartDefinition,
    serieIndex: number,
    datumIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const serie = chartDefinition.series[serieIndex];
    const datum = serie.points[datumIndex];
    if (chartDefinitionUtil.isDatumNull(datum) || !datum!.scaled) {
      // Cannot add glow to a null data point or one with no screen coordinates.
      return;
    }
    const scaledDatum = datum as chartDefinitionTypes.DatumDefinition;
    if (
      chartDefinitionUtil.isSeriePathBased(serie) &&
      serie.lineWidth === 0 &&
      !chartDefinitionUtil.isDatumVisible(scaledDatum, serie)
    ) {
      // If both line and point are invisible, do not interact with the point.
      return;
    }

    const GLOW_OPACITY_LEVELS =
      serie.type === SerieType.BARS
        ? AxisChartInteractivityDefiner.GLOW_OPACITY_LEVELS_FOR_BARS
        : AxisChartInteractivityDefiner.GLOW_OPACITY_LEVELS_FOR_POINTS;

    // Create a datum object in the interactivity layer.
    const interactiveDatum = this.createInteractiveDatum(
      interactivityLayer,
      serieIndex,
      datumIndex,
    );
    interactiveDatum.glow = {} as chartDefinitionTypes.GlowDefinition;
    const interactiveGlow = interactiveDatum.glow;
    // Every glow level has a brush and position related properties.
    interactiveGlow.levels = [];

    // Create the glow level brushes.
    for (let i = 0; i < GLOW_OPACITY_LEVELS.length; i++) {
      const glowBrush = new Brush({
        fill: 'none',
        stroke: AxisChartInteractivityDefiner.GLOW_COLOR,
        strokeOpacity: GLOW_OPACITY_LEVELS[i],
        strokeWidth: 1,
      });
      const glowLevel = {brush: glowBrush};
      interactiveGlow.levels.push(glowLevel);
    }

    switch (serie.type) {
      case SerieType.BARS:
      case SerieType.STEPPED_AREA:
      case SerieType.CANDLESTICKS:
      case SerieType.BOXPLOT:
        const scaledBar =
          scaledDatum.scaled!.bar ||
          scaledDatum.scaled!.rect ||
          scaledDatum.scaled;
        const rect = new GoogRect(
          scaledBar.left,
          scaledBar.top,
          scaledBar.width,
          scaledBar.height,
        );
        // Create the glow levels by increasing rectangle size.
        for (let i = 0; i < GLOW_OPACITY_LEVELS.length; i++) {
          const glowStrokeWidth =
            interactiveGlow.levels[i].brush.getStrokeWidth();
          // The rectangle coordinates should be in the middle of the stroke.
          interactiveGlow.levels[i].rect = new GoogRect(
            rect.left - glowStrokeWidth / 2,
            rect.top - glowStrokeWidth / 2,
            rect.width + glowStrokeWidth,
            rect.height + glowStrokeWidth,
          );
          // Next level starts from the end of the stroke of the current level.
          rect.left -= glowStrokeWidth;
          rect.top -= glowStrokeWidth;
          rect.width += 2 * glowStrokeWidth;
          rect.height += 2 * glowStrokeWidth;
        }
        break;

      case SerieType.LINE:
      case SerieType.AREA:
      case SerieType.SCATTER:
      case SerieType.BUBBLES:
        // Regardless of whether it is visible by default or not, a highlighted
        // point is visible.
        interactiveDatum.visible = true;

        // Center of the glow is the same as that of the point.
        interactiveGlow.x = scaledDatum.scaled!.x;
        interactiveGlow.y = scaledDatum.scaled!.y;
        // Note that if the point/ring has a stroke, the radius is the distance
        // from the center to the end of the stroke.

        if (
          this.crosshairTrigger === CrosshairTrigger.BOTH ||
          this.crosshairTrigger === CrosshairTrigger.FOCUS
        ) {
          const datumBrush = chartDefinitionUtil.getDatumBrush(
            scaledDatum,
            serie,
          );
          const crosshairBrush = Brush.createStrokeBrush(
            this.crosshairFocusedColor || datumBrush.getFill(),
            1,
            false,
            this.crosshairFocusedOpacity,
          );
          this.drawCrosshair(
            chartDefinition,
            scaledDatum,
            interactiveDatum,
            crosshairBrush,
            this.crosshairFocusedOrientation,
          );
        }

        let radius;
        if (interactiveDatum.ring) {
          // The datum is marked with a ring. The glow starts where the ring
          // ends.
          const ring = interactiveDatum.ring;
          radius = ring.radius + ring.brush.getStrokeWidth() / 2;
        } else {
          radius = chartDefinitionUtil.getPointTotalRadius(scaledDatum, serie);
        }
        // Create the glow levels by increasing radius size.
        for (let i = 0; i < GLOW_OPACITY_LEVELS.length; i++) {
          const glowStrokeWidth =
            interactiveGlow.levels[i].brush.getStrokeWidth();
          // The radius should be the distance between the center and the middle
          // of the stroke.
          interactiveGlow.levels[i].radius = radius + glowStrokeWidth / 2;
          // Next level starts from the end of the stroke of the current level.
          radius += glowStrokeWidth;
        }
        break;

      default:
        throw new Error('Unsupported serie type: ' + serie.type);
    }
  }

  /**
   * Adds glow to a given serie by updating the interactivity layer.
   * If the serie has its own visual representation (line for example), add glow
   * to it. Also, add glow to all the visible data points of the serie.
   * @param chartDefinition The base layer of the chart definition.
   * @param serieIndex Index of the serie.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private glowSerie(
    chartDefinition: ChartDefinition,
    serieIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const serie = chartDefinition.series[serieIndex];
    let interactiveSerie;
    if (chartDefinitionUtil.isSeriePathBased(serie) && serie.lineWidth > 0) {
      const GLOW_OPACITY_LEVELS =
        AxisChartInteractivityDefiner.GLOW_OPACITY_LEVELS_FOR_LINES;

      // Create a serie object in the interactivity layer.
      interactiveSerie = this.createInteractiveSerie(
        interactivityLayer,
        serieIndex,
      );
      interactiveSerie.glow = {} as chartDefinitionTypes.GlowDefinition;
      const interactiveGlow = interactiveSerie.glow;
      // Every glow level has a brush and position related properties.
      interactiveGlow.levels = [];

      let pathSegments;
      if (serie.type === SerieType.AREA) {
        if (chartDefinition.stackingType !== StackingType.NONE) {
          pathSegments =
            chartDefinitionUtil.createPathSegmentsForStackedArea(serie);
        } else {
          // interpolateNulls is not yet supported for area charts.
          pathSegments = chartDefinitionUtil.createPathSegments(serie, false);
        }
      } else {
        pathSegments = chartDefinitionUtil.createPathSegments(
          serie,
          chartDefinition.interpolateNulls,
        );
      }
      // The glow ignores changes in the brush of the original path.
      pathSegments = pathSegments.toSingleBrush();

      // Create the glow level brushes.
      let glowOffset = serie.lineBrush!.getStrokeWidth() / 2;
      for (let i = 0; i < GLOW_OPACITY_LEVELS.length; i++) {
        const glowBrush = new Brush({
          fill: 'none',
          stroke: AxisChartInteractivityDefiner.GLOW_COLOR,
          strokeOpacity: GLOW_OPACITY_LEVELS[i],
          strokeWidth: 1,
        });
        const glowPath = pathsegmentsutil.calcParallelPath(
          pathSegments,
          glowOffset + glowBrush.getStrokeWidth() / 2,
        );
        interactiveGlow.levels.push({brush: glowBrush, path: glowPath});
        glowOffset += glowBrush.getStrokeWidth();
      }
    }
    const interactiveSeries = interactivityLayer.series;
    interactiveSerie = interactiveSeries && interactiveSeries[serieIndex];
    // The points of the interactive serie (if exists), or undefined.
    const interactivePoints = interactiveSerie && interactiveSerie.points;
    // Add glow to all the visible data points.
    for (let datumIndex = 0; datumIndex < serie.points.length; ++datumIndex) {
      const datum = serie.points[datumIndex];
      if (chartDefinitionUtil.isDatumNull(datum)) {
        // Skip null data points.
        continue;
      }
      asserts.assert(datum != null); // avoid compiler warning
      // Check whether the datum is visible by default or by interactivity.
      if (
        chartDefinitionUtil.isDatumVisible(datum!, serie) ||
        (interactivePoints &&
          interactivePoints[datumIndex] &&
          interactivePoints[datumIndex]!.visible)
      ) {
        // Datum is visible. Add glow to it.
        this.glowDatum(
          chartDefinition,
          serieIndex,
          datumIndex,
          interactivityLayer,
        );
      }
    }

    // Highlights old data items when in diff mode, for some chart types.
    if (
      chartDefinition.isDiff &&
      serie.type === SerieType.SCATTER &&
      !this.serieHasOldData(serie.columns)
    ) {
      // In scatter chart, one serie for new data follows a serie with old data.
      this.glowSerie(chartDefinition, serieIndex - 1, interactivityLayer);
    }
  }

  /**
   * Returns whether a serie contains old data or new data.
   * Useful for diff charts.
   *
   * @param serieColumns array of columns in serie, to help determine whether series contains old data.
   * @return true when serie contains old data.
   */
  private serieHasOldData(serieColumns: {[key: string]: number[]}): boolean {
    const oldDataColumns = serieColumns[ColumnRole.DIFF_OLD_DATA];
    return oldDataColumns != null && oldDataColumns.length > 0;
  }

  /**
   * Adds glow to all the data points of a given category by updating the
   * interactivity layer.
   * @param chartDefinition The base layer of the chart definition.
   * @param categoryIndex Index of the category the datum belongs to.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private glowCategory(
    chartDefinition: ChartDefinition,
    categoryIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const series = chartDefinition.series;
    for (let serieIndex = 0; serieIndex < series.length; ++serieIndex) {
      const actualCategoryIndex = chartDefinition.getCanonicalCategoryIndex(
        serieIndex,
        categoryIndex,
      );
      if (
        this.isSerieInteractive(chartDefinition, serieIndex) &&
        actualCategoryIndex != null
      ) {
        this.glowDatum(
          chartDefinition,
          serieIndex,
          actualCategoryIndex,
          interactivityLayer,
        );
      }
    }
  }

  /**
   * Adds a ring to a given data point by updating the interactivity layer.
   * @param chartDefinition The base layer of the chart definition.
   * @param serieIndex Index of the serie the datum belongs to.
   * @param datumIndex Index of the datum within the serie.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private ringDatum(
    chartDefinition: ChartDefinition,
    serieIndex: number,
    datumIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const serie = chartDefinition.series[serieIndex];
    const datum = serie.points[datumIndex];
    if (chartDefinitionUtil.isDatumNull(datum) || !datum!.scaled) {
      // Cannot add a ring to a null data point or one with no screen
      // coordinates.
      return;
    }
    const scaledDatum = datum as chartDefinitionTypes.DatumDefinition;
    if (
      chartDefinitionUtil.isSeriePathBased(serie) &&
      serie.lineWidth === 0 &&
      !chartDefinitionUtil.isDatumVisible(scaledDatum, serie)
    ) {
      // If both line and point are invisible, do not interact with the point.
      return;
    }
    const datumBrush = chartDefinitionUtil.getDatumBrush(scaledDatum, serie);

    // Create a datum object in the interactivity layer.
    const interactiveDatum = this.createInteractiveDatum(
      interactivityLayer,
      serieIndex,
      datumIndex,
    );
    interactiveDatum.ring = {} as chartDefinitionTypes.RingDefinition;
    const interactiveRing = interactiveDatum.ring;

    let backgroundColor = chartDefinition.actualChartAreaBackgoundColor;
    let ringOpacity = 1;
    if (backgroundColor == null) {
      // Both the backgrounds can be seen through. Use a transparent fill which
      // can catch events.
      backgroundColor = 'white';
      ringOpacity = 0;
    }

    switch (serie.type) {
      case SerieType.BARS:
      case SerieType.STEPPED_AREA:
      case SerieType.CANDLESTICKS:
      case SerieType.BOXPLOT:
        ringOpacity = 1;

        // The stroke of the ring is the same as the background color, and the
        // fill is transparent.
        interactiveRing.brush = new Brush(Brush.TRANSPARENT_BRUSH);
        interactiveRing.brush.setStroke(backgroundColor);
        // Inverted candlesticks are an exception, because the fill of the
        // candlestick may already be the same color as the background. In this
        // case we use the candlestick color as the ring color instead.
        if (serie.type === SerieType.CANDLESTICKS) {
          const rgbDatumFillColor = googColor.hexToRgb(
            googColor.parse(datumBrush.getFill()).hex,
          );
          const rgbBackgroundColor = googColor.hexToRgb(
            googColor.parse(backgroundColor).hex,
          );
          const rgbBarFillColor = googColor.hexToRgb(
            googColor.parse(scaledDatum.barBrush.getFill()).hex,
          );
          interactiveRing.brush.setStroke(
            googColor.rgbArrayToHex(
              googColor.highContrast(rgbBarFillColor, [
                rgbDatumFillColor,
                rgbBackgroundColor,
              ]),
            ),
          );
        }
        interactiveRing.brush.setStrokeOpacity(ringOpacity);
        interactiveRing.brush.setStrokeWidth(1);

        const BAR_RING_DISTANCE =
          AxisChartInteractivityDefiner.BAR_RING_DISTANCE;
        const scaledBar =
          scaledDatum.scaled!.bar ||
          scaledDatum.scaled!.rect ||
          scaledDatum.scaled;

        const barStrokeWidth = datumBrush.getStrokeWidth();
        const ringStrokeWidth = interactiveRing.brush.getStrokeWidth();
        interactiveRing.rect = new GoogRect(
          scaledBar.left +
            barStrokeWidth / 2 +
            BAR_RING_DISTANCE +
            ringStrokeWidth / 2,
          scaledBar.top +
            barStrokeWidth / 2 +
            BAR_RING_DISTANCE +
            ringStrokeWidth / 2,
          scaledBar.width -
            (barStrokeWidth + 2 * BAR_RING_DISTANCE + ringStrokeWidth),
          scaledBar.height -
            (barStrokeWidth + 2 * BAR_RING_DISTANCE + ringStrokeWidth),
        );
        if (
          interactiveRing.rect.width <= 0 ||
          interactiveRing.rect.height <= 0
        ) {
          // The bar is too small to have a ring.
          delete interactiveDatum.ring;
        }
        break;

      case SerieType.LINE:
      case SerieType.AREA:
      case SerieType.SCATTER:
      case SerieType.BUBBLES:
        // Regardless of whether it is visible by default or not, a marked point
        // is visible.
        interactiveDatum.visible = true;

        // Center of the ring is the same as that of the point.
        interactiveRing.x = scaledDatum.scaled!.x;
        interactiveRing.y = scaledDatum.scaled!.y;

        if (
          this.crosshairTrigger === CrosshairTrigger.BOTH ||
          this.crosshairTrigger === CrosshairTrigger.SELECTION
        ) {
          const crosshairBrush = Brush.createStrokeBrush(
            this.crosshairSelectedColor || datumBrush.getFill(),
            1,
            false,
            this.crosshairSelectedOpacity,
          );
          this.drawCrosshair(
            chartDefinition,
            scaledDatum,
            interactiveDatum,
            crosshairBrush,
            this.crosshairSelectedOrientation,
          );
        }

        // The fill of the ring is the same as the background color, and the
        // stroke is the same as the point color.
        interactiveRing.brush = new Brush({
          fill: backgroundColor,
          fillOpacity: ringOpacity,
          stroke: datumBrush.getFill(),
          strokeWidth: 1,
        });
        // The radius should be the distance between the center and the middle
        // of the ring stroke.
        // Note that if the point has a stroke the "total radius" is the
        // distance from the center to the end of the stroke.
        interactiveRing.radius =
          chartDefinitionUtil.getPointTotalRadius(scaledDatum, serie) +
          AxisChartInteractivityDefiner.POINT_RING_DISTANCE +
          interactiveRing.brush.getStrokeWidth() / 2;
        break;

      default:
        throw new Error('Unsupported serie type: ' + serie.type);
    }
  }

  /**
   * Draws a crosshair on a given interactive datum.
   * @param chartDefinition The base layer of the chart definition.
   * @param datum The datum that the crosshair should be drawn for.
   * @param interactiveDatum A reference to the datum object in the interactivity layer.
   * @param brush The brush that should be used for the crosshairs.
   * @param orientation The orientation of these crosshairs.
   */
  private drawCrosshair(
    chartDefinition: ChartDefinition,
    datum: chartDefinitionTypes.DatumDefinition,
    interactiveDatum: chartDefinitionTypes.DatumDefinition,
    brush: Brush,
    orientation: CrosshairOrientation,
  ) {
    interactiveDatum.crosshair =
      interactiveDatum.crosshair ||
      ({} as chartDefinitionTypes.CrosshairDefinition);
    const crosshair = interactiveDatum.crosshair;

    // Center of the crosshair is the same as that of the point.
    crosshair.x = datum.scaled!.x;
    crosshair.y = datum.scaled!.y;

    crosshair.brush = brush;

    const left = new Coordinate(chartDefinition.chartArea.left, crosshair.y);
    const right = new Coordinate(chartDefinition.chartArea.right, crosshair.y);
    const top = new Coordinate(crosshair.x, chartDefinition.chartArea.top);
    const bottom = new Coordinate(
      crosshair.x,
      chartDefinition.chartArea.bottom,
    );

    crosshair.path = crosshair.path || new PathSegments();

    if (
      orientation === CrosshairOrientation.BOTH ||
      orientation === CrosshairOrientation.VERTICAL
    ) {
      const vertPath = PathSegments.fromVertices([top, bottom]);
      for (let i = 0; i < vertPath.segments.length - 1; i++) {
        crosshair.path.addSegment(vertPath.segments[i]);
      }
    }

    if (
      orientation === CrosshairOrientation.BOTH ||
      orientation === CrosshairOrientation.HORIZONTAL
    ) {
      const horizPath = PathSegments.fromVertices([left, right]);
      for (let i = 0; i < horizPath.segments.length - 1; i++) {
        crosshair.path.addSegment(horizPath.segments[i]);
      }
    }

    crosshair.path.close();
  }

  /**
   * Adds a ring to a given serie by updating the interactivity layer.
   * If the serie has its own visual representation (line for example), add a
   * ring to it. Also, add a ring to all the visible data points of the serie.
   * @param chartDefinition The base layer of the chart definition.
   * @param serieIndex Index of the serie.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private ringSerie(
    chartDefinition: ChartDefinition,
    serieIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const serie = chartDefinition.series[serieIndex];
    if (
      (serie.type === SerieType.LINE ||
        serie.type === SerieType.AREA ||
        serie.type === SerieType.SCATTER) &&
      serie.lineWidth > 0
    ) {
      // Create a serie object in the interactivity layer.
      const interactiveSerie = this.createInteractiveSerie(
        interactivityLayer,
        serieIndex,
      );
      interactiveSerie.ring = {} as chartDefinitionTypes.RingDefinition;
      const interactiveRing = interactiveSerie.ring;

      let pathSegments;
      if (serie.type === SerieType.AREA) {
        if (chartDefinition.stackingType !== StackingType.NONE) {
          pathSegments =
            chartDefinitionUtil.createPathSegmentsForStackedArea(serie);
        } else {
          // interpolateNulls is not yet supported for area charts.
          pathSegments = chartDefinitionUtil.createPathSegments(serie, false);
        }
      } else {
        pathSegments = chartDefinitionUtil.createPathSegments(
          serie,
          chartDefinition.interpolateNulls,
        );
      }
      // The ring ignores changes in the brush of the original path.
      pathSegments = pathSegments.toSingleBrush();

      interactiveRing.brush = new Brush({
        stroke: serie.lineBrush!.getStroke(),
        // Use 1 for lineWidth >= 2 and half the line width for thinner lines.
        strokeWidth: Math.min(1, serie.lineBrush!.getStrokeWidth() / 2),
      });
      const ringOffset =
        serie.lineBrush!.getStrokeWidth() / 2 +
        AxisChartInteractivityDefiner.LINE_RING_DISTANCE +
        interactiveRing.brush.getStrokeWidth() / 2;
      // The distance is negative, so the ring will be to the left of the path.
      interactiveRing.path = pathsegmentsutil.calcParallelPath(
        pathSegments,
        -ringOffset,
      );
    }
    // Add a ring to all the visible data points.
    for (let datumIndex = 0; datumIndex < serie.points.length; ++datumIndex) {
      const datum = serie.points[datumIndex];
      if (chartDefinitionUtil.isDatumNull(datum)) {
        // Skip null data points.
        continue;
      }
      asserts.assert(datum != null);
      if (
        chartDefinitionUtil.isDatumVisible(datum!, serie) ||
        (chartDefinitionUtil.isLonelyPoint(serie, datumIndex) &&
          !chartDefinition.interpolateNulls)
      ) {
        this.ringDatum(
          chartDefinition,
          serieIndex,
          datumIndex,
          interactivityLayer,
        );
      }
    }

    // Also rings old data items when in diff mode, for some chart types.
    if (
      chartDefinition.isDiff &&
      serie.type === SerieType.SCATTER &&
      !this.serieHasOldData(serie.columns)
    ) {
      // In scatter chart, one serie for new data follows a serie with old data.
      this.ringSerie(chartDefinition, serieIndex - 1, interactivityLayer);
    }
  }

  /**
   * Adds a ring to all the data points of a given category by updating the
   * interactivity layer.
   * @param chartDefinition The base layer of the chart definition.
   * @param categoryIndex Index of the category.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private ringCategory(
    chartDefinition: ChartDefinition,
    categoryIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const series = chartDefinition.series;
    for (let serieIndex = 0; serieIndex < series.length; ++serieIndex) {
      const actualCategoryIndex = chartDefinition.getCanonicalCategoryIndex(
        serieIndex,
        categoryIndex,
      );
      if (actualCategoryIndex != null) {
        this.ringDatum(
          chartDefinition,
          serieIndex,
          actualCategoryIndex,
          interactivityLayer,
        );
      }
    }
  }

  /**
   * Given a tooltip definition, it sets it as the tooltip for the given datum.
   * @param interactionState A collection of objects that are necessary to draw a tooltip, including the ChartDefinition, and InteractivityLayer.
   * @param datum The datum to which the tooltip should be added.
   * @param tooltipDefinitionOrNull The tooltip definition, or null if tooltip is for an annotation which has no tooltip text.
   */
  private setTooltipOnDatum(
    interactionState: tooltipDefinition.InteractionState,
    datum: chartDefinitionTypes.Datum,
    tooltipDefinitionOrNull: tooltipDefinition.TooltipDefinition | null,
  ) {
    // Create an object for the datum in the interactivity layer (or simply
    // retrieve it if it already exists).
    const interactiveDatum = this.createInteractiveDatum(
      interactionState.interactivityLayer as ChartDefinition,
      datum.serie,
      datum.category,
    );

    // Create the tooltip definition and attach it to the data point.
    const embedActionsMenu = interactionState.actionsMenuState != null;

    // Only an annotation can have a null tooltip.
    asserts.assert(tooltipDefinitionOrNull);
    interactiveDatum.tooltip = tooltipDefinitionOrNull;

    // Allow an embedded actions menu to extend the interactivity layer.
    if (embedActionsMenu) {
      asserts.assert(this.actionsMenuDefiner);
      const actionsMenuState = interactionState.actionsMenuState as ActionsMenu;
      // Note that because the entire tooltip definition is generated on
      // interaction, tooltipDefinition is the same as interactiveDatum.tooltip.
      this.actionsMenuDefiner!.extendInteractivityLayer(
        tooltipDefinitionOrNull!,
        actionsMenuState,
        interactiveDatum.tooltip!,
      );
    }
  }

  /**
   * Given a tooltip definition, it sets it as the tooltip for the given
   * category.
   * @param interactionState A collection of objects that are necessary to draw a tooltip, including the ChartDefinition, and InteractivityLayer.
   * @param categoryIndex The index of the category to which the tooltip should be added.
   * @param tooltipDefinitionOrNull The tooltip definition, or null if tooltip is for an annotation which has no tooltip text.
   */
  private setTooltipOnCategory(
    interactionState: tooltipDefinition.InteractionState,
    categoryIndex: number,
    tooltipDefinitionOrNull: tooltipDefinition.TooltipDefinition | null,
  ) {
    // Create an object for the category in the interactivity layer (or simply
    // retrieve it if it already exists).
    const interactiveCategory = this.createInteractiveCategory(
      interactionState.interactivityLayer as ChartDefinition,
      categoryIndex,
    );

    // Create the tooltip definition and attach it to the category.
    const embedActionsMenu = interactionState.actionsMenuState != null;

    asserts.assert(tooltipDefinitionOrNull != null);
    interactiveCategory.tooltip = tooltipDefinitionOrNull;

    // Allow an embedded actions menu to extend the interactivity layer.
    if (embedActionsMenu) {
      asserts.assert(this.actionsMenuDefiner != null);
      const actionsMenuState = interactionState.actionsMenuState as ActionsMenu;
      // Note that because the entire tooltip definition is generated on
      // interaction, tooltipDefinitionOrNull is the same as
      // interactiveCategory.tooltip.
      this.actionsMenuDefiner!.extendInteractivityLayer(
        tooltipDefinitionOrNull!,
        actionsMenuState,
        interactiveCategory.tooltip!,
      );
    }
  }

  /**
   * Adds a tooltip to a given data point by updating the interactivity layer.
   * @param interactionState A collection of objects that are necessary to draw a tooltip, including the ChartDefinition, and InteractivityLayer.
   * @param serieIndex Index of the serie the datum belongs to.
   * @param datumIndex Index of the datum within the serie.
   */
  private addTooltipToDatum(
    interactionState: tooltipDefinition.InteractionState,
    serieIndex: number,
    datumIndex: number,
  ) {
    const tooltipDefinition = this.tooltipDefiner.createTooltip(
      interactionState,
      serieIndex,
      datumIndex,
      null,
    );
    if (tooltipDefinition != null) {
      this.setTooltipOnDatum(
        interactionState,
        {serie: serieIndex, category: datumIndex},
        tooltipDefinition,
      );
    }
  }

  /**
   * Adds an aggregate tooltip to the last given data point based off of all the
   *     given data by updating the interactivity layer.
   * @param interactionState A collection of objects that are necessary to draw a tooltip, including the ChartDefinition, and InteractivityLayer.
   * @param data The data.
   * @param positionDatum The datum that should be used to position the tooltip.
   */
  private addAggregateTooltipToData(
    interactionState: tooltipDefinition.InteractionState,
    data: chartDefinitionTypes.Datum[],
    positionDatum: chartDefinitionTypes.Datum,
  ) {
    const tooltipDefinition = this.tooltipDefiner.createAggregateTooltip(
      interactionState,
      data,
      positionDatum,
      this.aggregationTarget,
    );
    this.setTooltipOnDatum(interactionState, positionDatum, tooltipDefinition);
  }

  /**
   * Adds an aggregate tooltip to the last given category based off of all the
   *     given categories by updating the interactivity layer.
   * @param interactionState A collection of objects that are necessary to draw a tooltip, including the ChartDefinition, and InteractivityLayer.
   * @param cursorPosition The cursor position, or null.
   * @param categoryIndices The categories.
   */
  private addAggregateTooltipToCategory(
    interactionState: tooltipDefinition.InteractionState,
    cursorPosition: Coordinate | null,
    categoryIndices: number[],
  ) {
    if (!cursorPosition) {
      // When the tooltip is for a selected category there may not be a cursor
      // position, for example when the selection is set programmatically and
      // not by mouse click. In such case we do not know how to position the
      // tooltip.
      return;
    }
    const tooltipDefinition =
      this.tooltipDefiner.createAggregateCategoryTooltip(
        interactionState,
        categoryIndices,
        cursorPosition,
        this.aggregationTarget,
      );
    this.setTooltipOnCategory(
      interactionState,
      categoryIndices[categoryIndices.length - 1],
      tooltipDefinition,
    );
  }

  /**
   * Adds a tooltip to a given category by updating the interactivity layer.
   * @param interactionState A collection of objects that are necessary to draw a tooltip, including the ChartDefinition, and InteractivityLayer.
   * @param cursorPosition The cursor position.
   * @param categoryIndex Index of the category.
   */
  private addTooltipToCategory(
    interactionState: tooltipDefinition.InteractionState,
    cursorPosition: Coordinate | null,
    categoryIndex: number,
  ) {
    if (!cursorPosition) {
      // When the tooltip is for a selected category there may not be a cursor
      // position, for example when the selection is set programmatically and
      // not by mouse click. In such case we do not know how to position the
      // tooltip.
      return;
    }
    // Create an object for the category in the interactivity layer (or simply
    // retrieve it if it already exists).
    const interactiveCategory = this.createInteractiveCategory(
      interactionState.interactivityLayer as ChartDefinition,
      categoryIndex,
    );

    // Create the tooltip definition and attach it to the category.
    const embedActionsMenu = interactionState.actionsMenuState != null;
    const tooltipDefinition = this.tooltipDefiner.createTooltip(
      interactionState,
      null,
      categoryIndex,
      null,
      cursorPosition,
    );
    if (tooltipDefinition === null) {
      return;
    }
    interactiveCategory.tooltip = tooltipDefinition;

    // Allow an embedded actions menu to extend the interactivity layer.
    if (embedActionsMenu) {
      asserts.assert(this.actionsMenuDefiner != null);
      const actionsMenuState = interactionState.actionsMenuState as ActionsMenu;
      // Note that because the entire tooltip definition is generated on
      // interaction, tooltipDefinition is the same as
      // interactiveCategory.tooltip.
      this.actionsMenuDefiner!.extendInteractivityLayer(
        tooltipDefinition,
        actionsMenuState,
        interactiveCategory.tooltip,
      );
    }
  }

  /**
   * Adds a tooltip to a given annotation by updating the interactivity layer.
   * @param interactionState A collection of objects that are necessary to draw a tooltip, including the ChartDefinition, and InteractivityLayer.
   * @param serieIndex Index of the serie, or null for category annotations.
   * @param datumIndex Index of the datum within the serie.
   * @param annotationIndex Index of the annotation.
   */
  private addTooltipToAnnotation(
    interactionState: tooltipDefinition.InteractionState,
    serieIndex: number | null | undefined,
    datumIndex: number,
    annotationIndex: number | null | undefined,
  ) {
    if (serieIndex == null || annotationIndex == null) {
      return;
    }
    // Create an object for the annotation in the interactivity layer (or simply
    // retrieve it if it already exists).
    const interactiveAnnotation = this.createInteractiveAnnotation(
      interactionState.interactivityLayer as ChartDefinition,
      serieIndex,
      datumIndex,
    );

    interactiveAnnotation.labels = interactiveAnnotation.labels || {};
    const interactiveLabels = interactiveAnnotation.labels;
    interactiveLabels[annotationIndex] =
      interactiveLabels[annotationIndex] || {};
    const interactiveLabel = interactiveLabels[annotationIndex];

    // Create the tooltip definition and attach it to the data point.
    const embedActionsMenu = interactionState.actionsMenuState != null;
    const tooltipDefinition = this.tooltipDefiner.createTooltip(
      interactionState,
      serieIndex,
      datumIndex,
      annotationIndex,
    );
    // Attach an SVG/HTML tooltip, not the yellow one closure adds on text
    // elements. This is why we use tooltipHtml instead of tooltip.
    interactiveLabel.tooltipHtml = tooltipDefinition || undefined;

    // Allow an embedded actions menu to extend the interactivity layer.
    if (embedActionsMenu && tooltipDefinition) {
      // TODO(dlaliberte): Allow tooltip to be null. In this case create a dummy
      // tooltip for text ' ' and embed the actions menu in it.
      asserts.assert(interactiveLabel.tooltipHtml != null);
      asserts.assert(this.actionsMenuDefiner != null);
      const actionsMenuState = interactionState.actionsMenuState as ActionsMenu;
      // Note that because the entire tooltip definition is generated on
      // interaction, tooltipDefinition is the same as
      // interactiveLabel.tooltipHtml.
      this.actionsMenuDefiner!.extendInteractivityLayer(
        tooltipDefinition,
        actionsMenuState,

        interactiveLabel.tooltipHtml!,
      );
    }
  }

  /**
   * Adds a marker to the color-bar for the given datum.
   * @param chartDefinition The base layer of the chart definition.
   * @param serieIndex Index of the serie the datum belongs to.
   * @param datumIndex Index of the datum within the serie.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private markDatumInColorBar(
    chartDefinition: ChartDefinition,
    serieIndex: number,
    datumIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    if (chartDefinition.colorBar) {
      const colorBar = chartDefinition.colorBar;
      const point = chartDefinition.series[serieIndex].points[datumIndex];
      const marker = {value: point!.nonScaled.color};
      const definition = colorbarDefiner.define(
        colorBar.scale,
        colorBar.drawingOptions,
        [marker as Marker],
        chartDefinition.textMeasureFunction,
      );
      // definition should not be null
      asserts.assert(definition != null);
      interactivityLayer.colorBar = {
        definition,
      } as ColorBarDefinition;
    }
  }

  /**
   * Makes the annotation text bold.
   * @param chartDefinition The base layer of the chart definition.
   * @param serieIndex The serie index (or null for category annotation).
   * @param datumOrCategoryIndex The datum index, or category index if serieIndex is null.
   * @param annotationIndex Index of the annotation within the datum/category (in other words, within the annotation bundle).
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private makeAnnotationBold(
    chartDefinition: ChartDefinition,
    serieIndex: number | null,
    datumOrCategoryIndex: number,
    annotationIndex: number,
    interactivityLayer: ChartDefinition,
  ) {
    const interactiveAnnotation = this.createInteractiveAnnotation(
      interactivityLayer,
      serieIndex,
      datumOrCategoryIndex,
    );
    interactiveAnnotation.labels = interactiveAnnotation.labels || {};
    const labels = interactiveAnnotation.labels;
    labels[annotationIndex] = labels[annotationIndex] || {};
    const label = labels[annotationIndex];
    label.textStyle = label.textStyle || {};
    const textStyle = label.textStyle;
    textStyle.bold = true;
  }

  /**
   * Fills the given interactivity layer according to the way an axis chart
   * construes the chart state in the DIVE interactivity model.
   *
   * @param chartDefinition The base layer of the chart definition.
   * @param chartState The state will induce which properties of the base layer should be overridden.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  diveInteractivityModel(
    chartDefinition: ChartDefinition,
    chartState: ChartState,
    interactivityLayer: ChartDefinition,
  ) {
    const interactionState: tooltipDefinition.InteractionState = {
      chartDefinition, // The dive interactivity model doesn't have an actionsMenuDefiner, so
      // we'll just default to an empty list of entries.
      actionsMenuEntries: [],
      interactivityLayer,
      actionsMenuState: null,
    };

    let focusedSerieIndex = chartState.focused.serie;
    let focusedDatumIndex = chartState.focused.datum;
    if (focusedDatumIndex != null) {
      // Focused datum has no meaning without the serie it belongs to.
      asserts.assert(focusedSerieIndex != null);
    }

    const DIMMED_OPACITY = 0.3;
    const DIMMED_ENTRY_COLOR = '#CCCCCC';

    if (chartDefinition.legend) {
      // Permitted tooltip boundaries.
      // If the tooltip covers a legend label, it will interfere with the
      // natural act of moving from one legend entry to the other. Therefore, we
      // set the right boundary to the beginning of the legend. The other 3
      // boundaries are left to be the background boundaries. We use the same
      // boundaries for focused data points for consistency.
      const tooltipBoundaries = new Box(
        0,
        chartDefinition.legend.area.left,
        chartDefinition.height,
        0,
      );
      this.tooltipDefiner.setBoundaries(tooltipBoundaries);
    }
    const tooltipTrigger = this.tooltipDefiner.getTrigger();

    // If there is a focused line, focus in the data point on the line which is
    // nearest to the cursor.
    if (focusedSerieIndex != null && focusedDatumIndex == null) {
      const cursorX = chartState.cursor.position!.x;

      const allPoints = chartDefinition.series[focusedSerieIndex].points;
      const concretePoints = allPoints.filter((element) => element != null);

      // Find the first point whose X coordinate is greater than or equal to the
      // X coordinate of the cursor.
      let i = 0;
      while (
        i < concretePoints.length &&
        concretePoints[i]!.scaled!.x < cursorX
      ) {
        i++;
      }

      if (i === 0) {
        // Edge case 1: serie hovered before first point (can happen when the
        // view window is used for clipping).
        focusedDatumIndex = 0;
      } else if (i === concretePoints.length) {
        // Edge case 2: serie hovered after last point (can happen when the view
        // window is used for clipping).
        focusedDatumIndex = concretePoints.length - 1;
      } else {
        // Common case: serie hovered between two points. Choose the nearest of
        // the two.
        const prevX = concretePoints[i - 1]!.scaled!.x;
        const nextX = concretePoints[i]!.scaled!.x;
        const nearestDataPoint =
          cursorX < googMath.average(prevX, nextX) ? i - 1 : i;
        focusedDatumIndex = allPoints.indexOf(concretePoints[nearestDataPoint]);
      }

      // As long as there is a focused line, changes to the cursor position
      // should initiate regeneration of the interactivity layer, so that the
      // nearest point can be updated according the cursor.
      this.ignoreCursorInChartStateComparison = false;
    }

    let interactiveDatum = null;
    if (focusedDatumIndex != null) {
      focusedSerieIndex = focusedSerieIndex as number;
      // Turn the focused datum visible and possibly add a tooltip to it.
      interactiveDatum = this.createInteractiveDatum(
        interactivityLayer,
        focusedSerieIndex,
        focusedDatumIndex,
      );
      interactiveDatum.visible = true;
      if (tooltipTrigger === TooltipTrigger.FOCUS) {
        this.addTooltipToDatum(
          interactionState,
          focusedSerieIndex,
          focusedDatumIndex,
        );
      }

      // Make the remove serie button visible on the corresponding legend entry.
      if (chartDefinition.legend) {
        const interactiveLegendEntry = this.createInteractiveLegendEntry(
          interactivityLayer,
          focusedSerieIndex,
        );
        interactiveLegendEntry.removeSerieButton = {
          isVisible: chartDefinition.showRemoveSerieButton,
        };
      }

      // Dim all other series.
      for (
        let serieIndex = 0;
        serieIndex < chartDefinition.series.length;
        serieIndex++
      ) {
        // Skip the focused serie (don't dim it).
        if (serieIndex === focusedSerieIndex) {
          continue;
        }

        // Dim the legend label of the current serie.
        if (chartDefinition.legend) {
          const unfocusedInteractiveLegendEntry =
            this.createInteractiveLegendEntry(interactivityLayer, serieIndex);
          unfocusedInteractiveLegendEntry.textBlock = {
            textStyle: {color: DIMMED_ENTRY_COLOR},
          } as TextBlock;
        }

        // Create a serie object for the current serie in the interactivity
        // layer.
        const unfocusedInteractiveSerie = this.createInteractiveSerie(
          interactivityLayer,
          serieIndex,
        );
        // Reduce the opacity of the current serie line.
        const unfocusedSerie = chartDefinition.series[serieIndex];
        unfocusedInteractiveSerie.lineBrush = unfocusedSerie.lineBrush!.clone();
        unfocusedInteractiveSerie.lineBrush.setStrokeOpacity(DIMMED_OPACITY);
      }
    }

    // Handle annotation expansion.
    const expandedAnnotation = chartState.annotations.expanded;
    if (expandedAnnotation) {
      const interactiveAnnotation = this.createInteractiveAnnotation(
        interactivityLayer,
        expandedAnnotation.serieIndex,
        expandedAnnotation.datumOrCategoryIndex,
      );
      interactiveAnnotation.bundle =
        interactiveAnnotation.bundle ||
        ({} as chartDefinitionTypes.AnnotationBundle);
      interactiveAnnotation.bundle.isExpanded = true;
    }

    const focusedAnnotation = chartState.annotations.focused;
    if (focusedAnnotation) {
      const annotationColumn = focusedAnnotation.column;
      const annotationRow = focusedAnnotation.row;

      const annotationColumnInfo =
        chartDefinition.dataTableColumnRoleInfo[annotationColumn];
      const annotationSerieIndex = annotationColumnInfo.serieIndex;
      const annotationCategoryIndex =
        chartDefinition.dataTableToCategoryMap[annotationRow];
      const annotationLabelIndex = annotationColumnInfo.roleIndex;

      if (this.isAnnotationInteractive(chartDefinition, annotationSerieIndex)) {
        this.addTooltipToAnnotation(
          interactionState,
          annotationSerieIndex,
          annotationCategoryIndex,
          annotationLabelIndex,
        );
      }
    }

    // For labeled legend, there are visual effects for focused entries.
    const labeledLegendPosition = LegendPosition.LABELED;
    if (
      !chartDefinition.legend ||
      chartDefinition.legend.position !== labeledLegendPosition
    ) {
      return;
    }
    if (chartState.legend.focused.entry != null) {
      const focusedLegendEntryIndex = chartState.legend.focused.entry;
      // Create a legend entry object in the interactivity layer.

      const interactiveLegendEntry = this.createInteractiveLegendEntry(
        interactivityLayer,
        focusedLegendEntryIndex,
      );
      // Make the remove serie button visible.
      interactiveLegendEntry.removeSerieButton = {
        isVisible: chartDefinition.showRemoveSerieButton,
      };

      // Highlight the last datum point of the corresponding serie (last within
      // the view window), and open a tooltip for it.
      const points = chartDefinition.series[focusedLegendEntryIndex].points;
      let lastDatumIndex;
      for (let datumIndex = points.length - 1; datumIndex >= 0; datumIndex--) {
        const datum = points[datumIndex];
        if (chartDefinitionUtil.isDatumNull(datum) || !datum!.scaled) {
          continue;
        }
        const chartArea = new Box(
          chartDefinition.chartArea.top,
          chartDefinition.chartArea.right,
          chartDefinition.chartArea.bottom,
          chartDefinition.chartArea.left,
        );
        const coordinate = new Coordinate(datum!.scaled.x, datum!.scaled.y);
        if (chartArea.contains(coordinate)) {
          lastDatumIndex = datumIndex;
          break;
        }
      }
      if (lastDatumIndex != null) {
        // Create a datum object in the interactivity layer.
        interactiveDatum = this.createInteractiveDatum(
          interactivityLayer,
          focusedLegendEntryIndex,
          lastDatumIndex,
        );
        interactiveDatum.visible = true;
        // Turn on tooltip for it.
        if (tooltipTrigger === TooltipTrigger.FOCUS) {
          this.addTooltipToDatum(
            interactionState,
            focusedLegendEntryIndex,
            lastDatumIndex,
          );
        }
      }

      // Dim all other series.
      for (
        let serieIndex = 0;
        serieIndex < chartDefinition.series.length;
        serieIndex++
      ) {
        // Skip the serie represented by the focused label (don't dim it).
        if (serieIndex === focusedLegendEntryIndex) {
          continue;
        }

        // Dim the legend label of the current serie.
        // TODO(dlaliberte): Add opacity support for text blocks so we will be able
        // to dim the legend label instead of graying it out.
        const unfocusedInteractiveLegendEntry =
          this.createInteractiveLegendEntry(interactivityLayer, serieIndex);
        unfocusedInteractiveLegendEntry.textBlock = {
          textStyle: {color: DIMMED_ENTRY_COLOR},
        } as TextBlock;

        const unfocusedInteractiveSerie = this.createInteractiveSerie(
          interactivityLayer,
          serieIndex,
        );
        // Create a serie object in the interactivity layer.
        const unfocusedSerie = chartDefinition.series[serieIndex];
        unfocusedInteractiveSerie.lineBrush = unfocusedSerie.lineBrush!.clone();
        // Reduce the opacity of the serie line.
        unfocusedInteractiveSerie.lineBrush.setStrokeOpacity(DIMMED_OPACITY);
      }
    }
  }
}

//------------------------------------------------------------------------------
//                          DIVE INTERACTIVITY MODEL
//------------------------------------------------------------------------------
