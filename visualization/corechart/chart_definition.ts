/**
 * @fileoverview Chart definitions for gviz.canviz.Chart API.
 *
 * This class includes all the properties and measures that are needed to
 * draw the chart, register events, etc. It also includes the logic
 * for calculating these properties and measures.
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

import {binarySearch} from '@npm//@closure/array/array';
import {ColorBarDefinition} from '../../colorbar/color_bar_definition';
import {
  ChartType,
  FocusTarget,
  InOutPosition,
  InteractivityModel,
  Orientation,
  SelectionMode,
  SerieType,
} from '../../common/option_types';
import {OverlayBox} from '../../events/chart_state';
import {Brush} from '../../graphics/brush';
import {ChartArea} from '../../graphics/chart_area';
import {LabeledLegendDefinition} from '../../legend/labeled_legend_definition';
import {
  CategoryDefinition,
  CellRef,
  Datum,
  LegendEntry,
  PieParams,
  SerieDefinition,
  StackingType,
  TooltipText,
} from '../../visualization/corechart/chart_definition_types';
import {
  ColumnRoleInfo,
  DomainColumnStructure,
} from '../../visualization/corechart/serie_columns';

import {TextMeasureFunction} from '../../text/text_measure_function';

import {LegendDefinition} from '../../legend/legend_definition';
import {TextBlock} from '../../text/text_block_object';
import {AxisDefinition} from './axis_definition';

// During migration
// tslint:disable:ban-types Migration
// tslint:disable:ban-strict-prop-init-comment

/**
 * This is the main object describing how the chart should look. It contains
 * numerous properties, described below.
 */
export class ChartDefinition {
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  textMeasureFunction!: TextMeasureFunction;

  /** The width of the canvas to draw the chart on. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  width!: number;

  /** The height of the canvas to draw the chart on. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  height!: number;

  /** The main type of this chart (given in the options type field). */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  chartType!: ChartType;

  /**
   * The area where we draw the actual chart, not including title,
   *     legend (when it is not inside), ticks (when they are not inside) and
   *     axis titles.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  chartArea!: ChartArea;

  /** The default font name. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  defaultFontName!: string;

  /** The default font size. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  defaultFontSize!: number;

  /** The default serie type. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  defaultSerieType!: SerieType;

  /** Whether interactivity should be enabled. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  enableInteractivity!: boolean;

  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  interactivityModel!: InteractivityModel;

  /** Whether the tooltip should be html. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  isHtmlTooltip!: boolean;

  /** Whether the chart should be laid out right-to-left. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  isRtl!: boolean;

  /** The focus target - datum/category/series. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  focusTarget!: Set<FocusTarget>;

  /** The selection mode - single/multiple. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  selectionMode!: SelectionMode;

  /**
   * Whether to show a remove button when legend entries
   *     are focused. Relevant for labeled legend.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  showRemoveSerieButton!: boolean;

  /** The background brush. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  backgroundBrush!: Brush;

  /** The background color for the chart area. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  chartAreaBackgroundBrush!: Brush;

  /**
   * The actual color of the chart area background,
   *     by blending both of the above brushes.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  actualChartAreaBackgoundColor!: string | null;

  /** The default baseline color. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  baselineColor!: string;

  /** The default gridline color. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  gridlineColor!: string;

  /**
   * The aura color used for labels that are printed inside
   *     the chart area. This is a blend of chartAreaBackgroundBrush over
   *     backgroundBrush.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  insideLabelsAuraColor!: string;

  /**
   * The title layout parameters. Holds all the information needed to draw
   *     the chart title.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  title!: TextBlock;

  /**
   * The inner axis title layout parameters. Holds all the
   *     information needed to draw the axis title, if it's inside.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  innerAxisTitle!: TextBlock | null;

  /** The position of the title. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  titlePosition!: InOutPosition;

  /** The position of the axis titles. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  axisTitlesPosition!: InOutPosition;

  /** A flag indicating this is a 3D chart. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  is3D!: boolean;

  /** A flag indicating if selection should be highlighted. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  shouldHighlightSelection!: boolean;

  /**
   * Indicates whether the chart is stacked and what type of stacking.
   * The default, when isStacked is unspecified or false, is 'none'.
   * When isStacked is true, this means stacking type is 'absolute', which
   * just stacks using the values as given. When isStacked is 'relative', this
   * means scale values to a fraction (0..1) of the total of all values in the
   * stack. When isStacked is 'percent', this means scale proportionally to
   * 100%, which is a shortcut for using 'relative' and a format of '#%'.
   */
  stackingType!: StackingType;

  /** A flag indicating this is a chart with diff of 2 datatables. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  isDiff!: boolean | null;

  /** An object that depends on the chart type. */
  diff: AnyDuringMigration | null;

  /**
   * A flag indicating null values are not skipped but rather
   *     interpolated over.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  interpolateNulls!: boolean;

  /** The categories drawing data, such as formatted values. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  categories!: CategoryDefinition[];

  /**
   * The series drawing data. For each serie, holds all the data needed to
   *     draw the serie (title, brush, data-points layout, etc).
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  series!: SerieDefinition[];

  /** Its serie/domain index, its role and its role index. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  dataTableColumnRoleInfo!: ColumnRoleInfo[];

  /**
   * Map from data table row/column index to category
   *     index.
   */
  dataTableToCategoryMap: AnyDuringMigration;

  /** The column structure of all the domains this chart has. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  domainsColumnStructure!: DomainColumnStructure[];

  /** The data type along the domain axis (for function types only). */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  domainDataType!: string;

  /** The data type of each of the target axes. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  targetAxisToDataType!: {[key: number]: string} | null;

  /**
   * A list of all legend entries, usually has entries
   *     corresponding exactly to the series list but may have more or less
   *     entries than series (common in pie charts).
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  legendEntries!: LegendEntry[];

  /**
   * This mapping holds for each serie type that appears in the chart,
   *     the number of series of that type. Note that counts of 0 are not
   *     saved at all.
   */
  serieTypeCount: AnyDuringMigration;

  /** Holds all the information needed to draw the legend. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  legend!: LegendDefinition | null;

  /**
   * Holds all the information needed to draw the labeled legend
   *     if such a legend exists.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  labeledLegend!: LabeledLegendDefinition | null;

  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  colorBar!: ColorBarDefinition | null;

  /** Holds all the information needed to draw the horizontal axes. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  hAxes!: {[key: number]: AxisDefinition};

  /** Holds all the information needed to draw the vertical axes. */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  vAxes!: {[key: number]: AxisDefinition};

  /**
   * For function chart, which of the axes (horizontal or vertical)
   *     is the domain axis. Null for non-function charts.
   */
  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  orientation!: Orientation | null;

  /** Holds information relevant for pie charts. */
  pie!: PieParams;

  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  tooltipBoxStyle!: Brush | null;

  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  histogramAsColumnChart!: boolean;

  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  useNewLegend!: boolean;

  // TODO(b/109816955): remove '!', see go/strict-prop-init-fix.
  overlayBox!: OverlayBox | null;

  /**
   * Returns the actual category index for a series. This is for series that
   * have a different frequency than the number of rows in the DataTable. The
   * current primary use of this is for trendlines.
   * @param seriesIndex The series index.
   * @param categoryIndex The category index that would be on a primary series.
   * @return The category index for the given seriesIndex (or the original
   *     category index if one could not be computed for some reason).
   */
  getCanonicalCategoryIndex(
    seriesIndex: number,
    categoryIndex: number,
  ): number {
    const series = this.series[seriesIndex];
    if (series.isVirtual && series.originalSeries !== undefined) {
      const originalSeries = this.series[series.originalSeries];
      const categoryValue = originalSeries.points[categoryIndex];
      const categoryValueOrNull =
        categoryValue != null ? categoryValue.nonScaled.d : categoryValue;
      return categoryValueOrNull != null
        ? binarySearch(
            series.points,
            categoryValueOrNull,
            (target, p) => target - p!.nonScaled.d,
          )
        : categoryIndex;
    }
    return categoryIndex;
  }

  /**
   * Gets the category title of a given datum.
   * @param datum The relevant datum.
   * @return The category title of the given datum or null if none.
   */
  getCategoryTitleForDatum(datum: Datum) {
    const seriesIndex = datum.serie;
    const categoryIndex = datum.category;

    const datumIndex = this.getCanonicalCategoryIndex(
      seriesIndex,
      categoryIndex,
    );
    const title =
      this.series[seriesIndex].points[datumIndex]!.tooltipText!.categoryTitle ||
      (this.categories[datumIndex]
        ? this.categories[categoryIndex].titles[0]
        : null);

    return title;
  }

  /**
   * Gets the series title of a given datum.
   * @param datum The relevant datum.
   * @return The series title of the given datum or null if none.
   */
  getSeriesTitleForDatum(datum: Datum): string | null {
    const seriesIndex = datum.serie;
    const categoryIndex = datum.category;

    const datumIndex = this.getCanonicalCategoryIndex(
      seriesIndex,
      categoryIndex,
    );
    const title =
      this.series[seriesIndex].points[datumIndex]!.tooltipText!.serieTitle ||
      this.series[seriesIndex].title;
    // The title can be undefined, but callers only want null.
    return title == null ? null : title;
  }

  /**
   * Gets the category index of a given datum.
   * @param datum The relevant datum.
   * @return The category of the given datum.
   */
  getCategoryIndexForDatum(datum: Datum): number {
    return datum.category;
  }

  /**
   * Gets the series index of a given datum.
   * @param datum The relevant datum.
   * @return The series of the given datum.
   */
  getSeriesIndexForDatum(datum: Datum): number {
    return datum.serie;
  }

  /**
   * Gets the cell reference of a given datum.
   * @param datum The relevant datum.
   * @return The row column pair.
   */
  getCellRefForDatum(datum: Datum): CellRef {
    const serie = this.series[datum.serie];
    const column = serie.dataTableIdx;
    return {row: datum.category, column};
  }

  /**
   * Gets the datum given the cell reference.
   * @param cell The cell row and column.
   * @return The datum.
   */
  getDatumForCellRef(cell: CellRef): Datum | null {
    const columnInfo = this.dataTableColumnRoleInfo[cell.column];
    const serieIndex = columnInfo.serieIndex;
    if (serieIndex == null) {
      return null;
    }
    const datum = {
      serie: serieIndex,
      category: this.dataTableToCategoryMap[cell.row],
    };
    return datum;
  }

  /**
   * Gets the tooltipText given the series and category indices.
   * (Could be one Datum param.)
   * @param seriesIndex The index of the series.
   * @param categoryIndex The index of the category.
   * @return The tooltipText object.
   */
  getTooltipText(
    seriesIndex: number,
    categoryIndex: number,
  ): TooltipText | null {
    const series = this.series[seriesIndex];
    return series.points[categoryIndex]!.tooltipText;
  }
}
