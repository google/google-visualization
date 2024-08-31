/**
 * @fileoverview A builder of ChartDefinition objects.
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
import {
  assert,
  assertNumber,
} from '@npm//@closure/asserts/asserts';

import {isValidColor} from '@npm//@closure/color/color';
import {identity} from '@npm//@closure/functions/functions';
import {Box} from '@npm//@closure/math/box';
import {Coordinate} from '@npm//@closure/math/coordinate';
import {average} from '@npm//@closure/math/math';
import {Rect} from '@npm//@closure/math/rect';
import {Vec2} from '@npm//@closure/math/vec2';
import * as googObject from '@npm//@closure/object/object';
import {
  contains,
  isEmptyOrWhitespace,
  trim,
} from '@npm//@closure/string/string';
import {parseStyleAttribute} from '@npm//@closure/style/style';
import * as gvizJson from '../../common/json';
import * as datautils from '../../data/datautils';
import {
  CategoryDefinition,
  DatumDefinition,
  DivisionDefinition,
  IntervalMark,
  IntervalSettings,
  NonScaledDatumDefinition,
  PointShape,
  ScaledDatumDefinition,
  SerieDefinition,
  StackingType,
} from '../../visualization/corechart/chart_definition_types';
import {
  getPointTotalRadius,
  isDatumNull,
  resolveSerieRelativeColor,
} from '../../visualization/corechart/chart_definition_utils';
import * as chartDefinitionTypes from './chart_definition_types';

import {
  ColumnRole,
  ColumnRoleInfo,
  DomainColumnStructure,
  Structure,
} from '../../visualization/corechart/serie_columns';

import * as defaults from '../../common/defaults';
import * as canvizTextBlock from '../../text/text_block_object';
// Unused import preserved for side-effects. Remove if unneeded.
import '../../axis/value_scale/scale_initializer';

import {GOLDEN_RATIO} from '../../common/constants';
import {arrayFromSet} from '../../common/object';
import {
  AxisType,
  ChartType,
  ColorBarPosition,
  CurveType,
  FocusTarget,
  InOutPosition,
  IntervalStyle,
  LegendPosition,
  Orientation,
  SerieType,
  SeriesRelativeColor,
  TooltipTrigger,
  ViewWindowMode,
} from '../../common/option_types';
import {Options} from '../../common/options';
import {RelativeColor, toStandardColor} from '../../common/theme';
import {
  calculateControlPoints,
  distributeRealEstateWithKeys,
  piecewiseLinearInterpolation,
  roundToNumSignificantDigits,
} from '../../common/util';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {Value} from '../../data/types';

import {Brush, calcCompensatedPointRadius} from '../../graphics/brush';
import {Pattern} from '../../graphics/pattern';
import {parseStyle} from '../../graphics/style';
import {TextAlign} from '../../text/text_align';
import {TextMeasureFunction} from '../../text/text_measure_function';

import {PatternStyle, StrokeDashStyleType} from '../../graphics/types';

import {AxisDefiner} from '../../axis/axis_definer';
import {NumberFormat} from '../../i18n/format';
import {Eq} from '../../math/expression/eq';
import {GVizNumber} from '../../math/expression/number';
import {Pow} from '../../math/expression/power';
import {StringRenderer} from '../../math/expression/renderer/string_renderer';
import {Variable} from '../../math/expression/variable';
import {cornersToRectangle} from '../../math/vector_utils';
import {TooltipText} from '../../text/text_block';
import {
  AxisDefinition,
  TextItem,
} from '../../visualization/corechart/axis_definition';
import {AnnotationDefiner} from './annotation_definer';
import {AxisChartDefinerInterface} from './axis_chart_definer_interface';
import {BubbleChartDefiner} from './bubble_chart_definer';
import {ChartDefiner, InitFunctionList} from './chart_definer';
import {ChartDefinition} from './chart_definition';

import {HorizontalAxisDefiner} from '../../axis/horizontal_axis_definer';
import {VerticalAxisDefiner} from '../../axis/vertical_axis_definer';
import * as textutils from '../../text/text_utils';
import {
  TRENDLINE_TYPE_TO_FUNCTION,
  TrendlineType,
} from '../../trendlines/trendlines';

const {getDefaultFormattedValue} = datautils;
const {parse} = gvizJson;

const {calcBoundingBox} = canvizTextBlock;

const {
  DEFAULT_DIFF_NEW_DATA_OPACITY,
  DEFAULT_DIFF_NEW_DATA_WIDTH_FACTOR,
  DEFAULT_DIFF_OLD_DATA_OPACITY,
  DEFAULT_DIFF_SERIES_BACKGROUND_COLOR,
  DEFAULT_DISCRETE_COLORS,
  DEFAULT_LINE_WIDTH,
  DEFAULT_POINT_SENSITIVITY_AREA_RADIUS,
  DEFAULT_POINT_SIZE_FOR_LINE,
  DEFAULT_POINT_SIZE_FOR_SCATTER,
  DEFAULT_SCATTER_TOOLTIP_X_PREFIX_TEXT,
  DEFAULT_SCATTER_TOOLTIP_Y_PREFIX_TEXT,
  DEFAULT_TRENDLINE_TYPE,
} = defaults;

const {
  CERTAINTY,
  DATA,
  DIFF_OLD_DATA,
  DOMAIN,
  EMPHASIS,
  INTERVAL,
  SCOPE,
  STYLE,
  TOOLTIP,
} = ColumnRole;

// tslint:disable:ban-types
// tslint:disable:ban-ts-suppressions
// tslint:disable:no-dict-access-on-struct-type
// tslint:disable:no-unnecessary-type-assertion  Editor and compiler can't agree.

/**
 * Fills the given chart definition with axis-specific stuff.
 * @unrestricted
 */
export class AxisChartDefiner
  extends ChartDefiner
  implements AxisChartDefinerInterface
{
  /**
   * The colors given by the user. For each element we support both a string
   * and an object, as documented in toStandardColor.
   */
  // TODO(dlaliberte): Add specific type for colors.
  private colors: Array<AnyDuringMigration | string> | null = null;

  /** The horizontal axis definers. */
  private hAxisDefiners: {[key: number]: HorizontalAxisDefiner} | null = null;

  /** The vertical axis definers. */
  private vAxisDefiners: {[key: number]: VerticalAxisDefiner} | null = null;

  /**
   * The domain axis definer for function charts. Either the single horizontal
   * axis definer or the single vertical axis definer.
   */
  private domainAxisDefiner: AxisDefiner | null = null;

  /**
   * The target axis definers for function charts. Either the horizontal axis
   * definers or the vertical axis definers.
   */
  private targetAxisDefiners: {[key: number]: AxisDefiner} | null = null;

  /** The set of target axis indices. */
  private targetAxisIndices: Set<number> | null = null;

  /** The counts of each series type for each target axis. */
  private targetAxisSerieTypeCount: AnyDuringMigration[] | null = null;

  /** Bubble chart definer. */
  private bubbleChartDefiner: BubbleChartDefiner | null = null;

  /** The number of domain subdivisions (e.g. side-by-side bars) requested. */
  private numSubdivisions = 1;

  /**
   * The domain division definition (e.g. groups of bars and side-by-side
   * bars).
   */
  private divisionDefinition: DivisionDefinition | null = null;

  /** Which columns have bar-like elements. */
  private barLikeColumns: Set<number> | null = null;

  /**
   * Whether bars or steps have variable width.
   * (dlaliberte) Should be per-series option.
   */
  private variableWidth = false;

  /** The data view, used by the bubble chart and histogram chart. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  override dataView!: AbstractDataTable;

  /** Can the tooltip be triggered? */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  private isTooltipEnabledFlag!: boolean;

  /**
   * @param data The data to be drawn.
   * @param options The options controlling how the chart will look and behave.
   * @param textMeasureFunction A function for measuring width and height of text objects.
   * @param width Chart's width.
   * @param height Chart's height.
   */
  constructor(
    data: AbstractDataTable,
    options: Options,
    textMeasureFunction: TextMeasureFunction,
    width: number,
    height: number,
  ) {
    super(data, options, textMeasureFunction, width, height);
  }

  getDomainAxisDefiner(): AxisDefiner | null {
    return this.domainAxisDefiner;
  }

  /**
   * Returns the nth target axis definer.
   * @param n The index of the target axis definer.
   */
  getTargetAxisDefiner(n: number): AxisDefiner {
    assert(this.targetAxisDefiners != null);
    return this.targetAxisDefiners![n];
  }

  /** Returns the division definition. */
  getDivisionDefinition(): DivisionDefinition | null {
    return this.divisionDefinition;
  }

  /** Returns whether tooltips are enabled. */
  isTooltipEnabled(): boolean {
    return this.isTooltipEnabledFlag;
  }

  /** Sets flag whether tooltips are enabled. */
  setTooltipEnabled(flag: boolean) {
    this.isTooltipEnabledFlag = flag;
  }

  /**
   * Returns functions which initialize the chart definition, making it ready
   * to be drawn.  Each function should return either nothing or an
   * array of functions, which are inserted at the head of the queue.
   */
  override initSteps(): InitFunctionList {
    let chartDef: AnyDuringMigration;

    return [
      () => {
        const options = this.options;
        chartDef = this.chartDef;

        chartDef.isDiff = options.inferBooleanValue('isDiff');

        // Hack to replace SCATTER with FUNCTION
        // Doesn't work with diff chart yet, so we need to keep SCATTER til
        // then.
        if (!chartDef.isDiff && chartDef.chartType === ChartType.SCATTER) {
          chartDef.chartType = ChartType.FUNCTION;
          options.insertLayer(1, {
            'pointSize': 7,
            'trendlines': {'pointsVisible': false, 'lineWidth': 2},
            'lineWidth': 0,
            'orientation': 'horizontal',
            'domainAxis': {'viewWindowMode': 'pretty'},
          });
        }

        const tooltipTrigger = options.inferOptionalStringValue(
          'tooltip.trigger',
          TooltipTrigger,
        ) as TooltipTrigger | null;

        this.setTooltipEnabled(tooltipTrigger !== TooltipTrigger.NONE);

        /** @suppress {deprecated} Removing these later. */
        chartDef.focusTarget = new Set(
          options.inferStringArrayValue(
            'focusTarget',
            [FocusTarget.DATUM],
            // tslint:disable-next-line:no-implicit-dictionary-conversion
            FocusTarget,
          ) as FocusTarget[],
        );

        if (
          chartDef.focusTarget.has(FocusTarget.CATEGORY) &&
          chartDef.chartType !== ChartType.FUNCTION
        ) {
          throw new Error(
            `Focus target ${FocusTarget.CATEGORY}` +
              ` is not supported for the chosen chart type, ${chartDef.chartType}`,
          );
        }

        if (chartDef.chartType === ChartType.BUBBLE) {
          this.bubbleChartDefiner = new BubbleChartDefiner(
            this.dataView,
            this.options,
            this.textMeasureFunction,
            chartDef,
          );
        } else {
          this.colors = options.inferValue('colors', DEFAULT_DISCRETE_COLORS);
          this.createSeriesAndCategoriesDrawingData();
        }

        const serieType = SerieType;
        const hasBarsOrArea =
          chartDef.serieTypeCount[serieType.BARS] > 0 ||
          chartDef.serieTypeCount[serieType.AREA] > 0 ||
          chartDef.serieTypeCount[serieType.STEPPED_AREA] > 0;

        let stackingType = this.options.inferOptionalStringValue(
          'isStacked',
          StackingType,
        ) as StackingType | null;
        if (stackingType == null) {
          // The enum didn't match, but check for boolean.
          stackingType = this.options.inferBooleanValue('isStacked')
            ? StackingType.ABSOLUTE
            : StackingType.NONE;
        }

        chartDef.stackingType =
          (hasBarsOrArea && stackingType) || StackingType.NONE;

        chartDef.showRemoveSerieButton = this.options.inferBooleanValue(
          'showRemoveSeriesButton',
          false,
        );
      },

      this.createAxes.bind(this),

      this.populateDataView.bind(this),

      () => {
        if (chartDef.chartType === ChartType.HISTOGRAM) {
          // Hack for Histogram: we need to regenerate the categories and
          // series and other structures now, given the new data.
          this.createSeriesAndCategoriesDrawingData();
        }
      },

      this.initScales.bind(this),

      () => super.initSteps(),
    ];
  }

  /**
   * Calculates the series and categories drawing data (brushes, colors etc.).
   * Changes the members: categories, series, serieTypeCount.
   */
  private createSeriesAndCategoriesDrawingData() {
    const chartDef = this.chartDef;
    const dataView = this.dataView;

    const serieTypeExtractor =
      chartDef.chartType === ChartType.SCATTER
        ? (serieIndex: AnyDuringMigration) => SerieType.SCATTER
        : chartDef.chartType === ChartType.HISTOGRAM
          ? (serieIndex: AnyDuringMigration) => SerieType.BARS
          : (serieIndex: AnyDuringMigration) => {
              return this.options.inferStringValue(
                `series.${serieIndex}.type`,
                chartDef.defaultSerieType,
                SerieType,
              ) as SerieType;
            };
    const columnStructure = chartDef.isDiff
      ? AxisChartDefiner.inferSerieAndCategoryStructuresForDiffChart(
          dataView,
          serieTypeExtractor,
          chartDef.chartType,
        )
      : AxisChartDefiner.inferSerieAndCategoryStructures(
          dataView,
          serieTypeExtractor,
        );

    this.barLikeColumns = columnStructure.barLikeColumns;

    // Create the category definitions and a reversed lookup map (from data
    // table index to category index). We initialize chartDef.categories even in
    // case of scatter chart because we use the same hover/click events for
    // CATEGORY axis and VALUE axis.
    chartDef.categories = [];
    chartDef.dataTableToCategoryMap = {};
    const domainsColumnStructure = columnStructure.domainsColumnStructure;
    for (let i = 0; i < dataView.getNumberOfRows(); i++) {
      const dataTableIdx = dataView.getTableRowIndex(i);
      // TODO(dlaliberte): Extract all data.
      const data = dataView.getValue(i, 0);
      const titles = domainsColumnStructure.map((domainColumnsStructure) => {
        const columnIndex = domainColumnsStructure.columns[DOMAIN][0];
        // Getting the formatted values has an undesirable side effect
        // on the axis ticks for category or categorypoint.  The default
        // formatting pattern is applied to numbers and date/time values
        // instead of the axis format options, and cached in the cell so
        // it will be used for axis ticks, thus overriding the format
        // options. But we don't need to use the titles generated here for
        // the axis ticks.  See axis-definer.
        const title = dataView.getFormattedValue(i, columnIndex) || '';
        return title;
      });
      const category = {
        data,
        titles,
        dataTableIdx,
      } as unknown as CategoryDefinition;
      // A category tooltip is expected to be specified on the first domain.
      const domain = domainsColumnStructure[0];
      const tooltipColumnIndices = domain.columns[TOOLTIP];
      if (tooltipColumnIndices) {
        // Only one tooltip column per domain is allowed.
        assert(tooltipColumnIndices.length === 1);
        const tooltipColumnIndex = tooltipColumnIndices[0];
        // Will be set to null if no custom tooltip content is specified.
        const customTooltipText = this.getCustomTooltipText(
          tooltipColumnIndex,
          i,
        ) as unknown as chartDefinitionTypes.TooltipText;
        category.tooltipText = customTooltipText;
      }
      chartDef.categories.push(category);
      chartDef.dataTableToCategoryMap[dataTableIdx] = i;
    }

    // Create the serie definitions.
    chartDef.series = [];
    for (let i = 0; i < columnStructure.seriesColumnStructure.length; i++) {
      const serieStructure = columnStructure.seriesColumnStructure[i];
      const serieDefinition = this.createSerieDefinition(i, serieStructure);
      chartDef.series.push(serieDefinition);
      if (!googObject.isEmpty(dataView.getColumnProperties(i))) {
        chartDef.series[i].properties = dataView.getColumnProperties(i);
      }
    }

    // Keep information in the chart definition about each data table column:
    // its serie/domain index, its role and its role index.
    chartDef.dataTableColumnRoleInfo = columnStructure.columnRoleInfo;

    chartDef.domainsColumnStructure = columnStructure.domainsColumnStructure;
    chartDef.domainDataType = columnStructure.domainDataType;

    chartDef.targetAxisToDataType = {}; // Not array. Map from number to type.
    chartDef.serieTypeCount = {};
    /** @suppress {deprecated} Removing these later. */
    this.targetAxisIndices = new Set();
    this.targetAxisSerieTypeCount = [];
    for (let i = 0; i < chartDef.series.length; ++i) {
      const serie = chartDef.series[i];
      this.targetAxisIndices.add(serie.targetAxisIndex);
      const targetAxisType =
        chartDef.targetAxisToDataType[serie.targetAxisIndex];
      if (targetAxisType == null) {
        chartDef.targetAxisToDataType[serie.targetAxisIndex] = serie.dataType;
      } else if (targetAxisType !== serie.dataType) {
        throw new Error(
          'All series on a given axis must be of the same data type',
        );
      }
      chartDef.serieTypeCount[serie.type] =
        Number(chartDef.serieTypeCount[serie.type] || 0) + 1;
      const axisSTC =
        this.targetAxisSerieTypeCount[serie.targetAxisIndex] || {};
      this.targetAxisSerieTypeCount[serie.targetAxisIndex] = axisSTC;
      axisSTC[serie.type] = Number(axisSTC[serie.type] || 0) + 1;
    }
  }

  /** Initializes the legend for the chart. */
  private initLegend() {
    // TODO(dlaliberte): Add type for addedIndices.
    const addedIndices = {};
    const chartDef = this.chartDef;
    chartDef.legendEntries = [];
    const addLegendEntry = (serieIndex: AnyDuringMigration) => {
      const serieDef = chartDef.series[serieIndex];
      // Suppressing errors for ts-migration.
      //   TS2367: This comparison appears to be unintentional because the types 'SerieType' and 'ChartType' have no overlap.
      // @ts-ignore
      if (chartDef.isDiff && serieDef.type === ChartType.SCATTER) {
        // Creates legend entry with a gradient for the colored box:
        // old to new data color.
        const alpha = [
          this.options.inferValue(
            'diff.oldData.opacity',
            DEFAULT_DIFF_OLD_DATA_OPACITY,
          ) as number,
          this.options.inferValue(
            'diff.newData.opacity',
            DEFAULT_DIFF_NEW_DATA_OPACITY,
          ) as number,
        ];
        const color = serieDef.color!.color;
        chartDef.legendEntries.push({
          id: serieDef.id,
          text: serieDef.labelInLegend,
          brush: new Brush({
            gradient: {
              color1: color,
              color2: color,
              opacity1: alpha[0],
              opacity2: alpha[1],
              x1: '100%',
              y1: '0%',
              x2: '0%',
              y2: '0%',
              useObjectBoundingBoxUnits: true,
              sharpTransition: true,
            },
          }),
          index: serieIndex,
          isVisible: serieDef.visibleInLegend,
        });
        (addedIndices as AnyDuringMigration)[serieIndex] = true;
      } else {
        const brush = new Brush({fill: serieDef.color!.color});
        if (serieDef.colorOpacity) {
          brush.setFillOpacity(serieDef.colorOpacity);
        } else if (serieDef.areaBrush) {
          brush.setFillOpacity(serieDef.areaBrush.getFillOpacity());
        }
        chartDef.legendEntries.push({
          id: serieDef.id,
          text: serieDef.labelInLegend,
          brush,
          index: serieIndex,
          isVisible: serieDef.visibleInLegend,
        });
        (addedIndices as AnyDuringMigration)[serieIndex] = true;
      }
    };

    chartDef.series.forEach((serieDef, serieIndex) => {
      if ((addedIndices as AnyDuringMigration)[serieIndex]) {
        return;
      }
      addLegendEntry(serieIndex);
      if (serieDef.trendlineIndex != null) {
        addLegendEntry(serieDef.trendlineIndex);
      }
    }, this);
    if (chartDef.isDiff) {
      // Adds legend entry for previous data for specific charts.
      const serieType = chartDef.series[0].type;
      if (serieType === SerieType.BARS) {
        chartDef.legendEntries.push({
          id: -1,
          text: 'Previous data',
          brush: new Brush({fill: DEFAULT_DIFF_SERIES_BACKGROUND_COLOR.color}),
          index: -1,
          isVisible: true,
        });
      }
    }
  }

  /**
   * Initializes the trendlines as specified by the options.
   *
   * @param data The data table/view.
   */
  private initTrendlines(data: AbstractDataTable) {
    /* Trendline options is of the following form:
     * trendlines: {
     *   <targetSeriesIndex>: {
     *     type: <string>,      // 'linear', 'logarithmic'... Default: 'linear'.
     *     title: <string>,
     *     color: <string>,     // Uses the next available color if unspecified.
     *     opacity: <number>,
     *     pointSize: <number>, // Uses 0 if unspecified.
     *     lineWidth: <number>, // Uses the default line width if unspecified.
     *     curveType:
     *     smoothingFactor: <number>
     *     zOrder: <number>,    // Defaults to 0.
     *     visibleInLegend: <boolean>, // Uses false if unspecified.
     *     labelInLegend: <string>
     *   }
     * }
     */
    const baseTime = new Date(1900, 0, 1, 0, 0, 0).getTime();
    // 1000 ms/sec * 60 sec/min * 60 min/hr * 24 hr/day
    const timeScale = 1000 * 60 * 60 * 24;
    // TODO(dlaliberte): Remove this closure.
    const dateTransformDomain = (numericValue: AnyDuringMigration) => {
      numericValue -= baseTime;
      numericValue /= timeScale;
      return numericValue;
    };
    const dateUntransformDomain = (numericValue: AnyDuringMigration) => {
      numericValue *= timeScale;
      numericValue += baseTime;
      return numericValue;
    };

    const scientificFormat = new NumberFormat('0.###E0');
    const numberFormat = new NumberFormat('#.###');
    const stringRenderer = new StringRenderer((n) => {
      if (n !== 0 && (Math.abs(n) > 100000 || Math.abs(n) < 0.01)) {
        return scientificFormat.format(n);
      } else {
        return numberFormat.format(n);
      }
    });
    const DEFAULT_COLOR = '<default>';
    const chartDef = this.chartDef;
    const trendlineSeriesType = SerieType.LINE;
    let trendlineCount = 0;
    const isVertical = chartDef.orientation === Orientation.VERTICAL;
    const seriesCount = chartDef.series.length;
    for (let i = 0; i < seriesCount; i++) {
      const series = chartDef.series[i];
      /**
       * @param optionName The name of the option.
       * @return The options array
       */
      const optionPath = (
        optionName: string,
        otherParamNames?: string[],
      ): string[] => {
        const path = [
          `trendlines.${i}.${optionName}`,
          `trendlines.${optionName}`,
        ].concat(otherParamNames || []);
        return path;
      };
      const trendlineExists =
        this.options.inferValue(`trendlines.${i}`) != null;
      if (trendlineExists) {
        trendlineCount++;
        const trendlineType = this.options.inferStringValue(
          optionPath('type'),
          DEFAULT_TRENDLINE_TYPE,
          TrendlineType,
        );
        // TODO(dlaliberte) This should be using inferColorValue with
        // a default color of 'none', perhaps.
        let rawColor = this.options.inferValue(
          optionPath('color'),
          DEFAULT_COLOR,
        ) as string;
        const isDefaultColor = rawColor === DEFAULT_COLOR;
        if (isDefaultColor) {
          rawColor = series.pointBrush.getFill();
        }
        const opacity = this.options.inferRatioNumberValue(
          optionPath('opacity', ['dataOpacity']),
          isDefaultColor ? 0.5 : 1,
        );
        let pointSize = this.options.inferNonNegativeNumberValue(
          optionPath('pointSize', ['pointSize']),
          0,
        );
        const visiblePoints = this.options.inferBooleanValue(
          optionPath('pointsVisible', ['pointsVisible']),
          pointSize > 0,
        );
        if (pointSize <= 0) {
          pointSize = DEFAULT_POINT_SIZE_FOR_LINE;
        }
        let pointRadius = pointSize / 2;
        if (pointRadius > 0) {
          pointRadius += 1;
        }

        const trendlineColumns: {[key: string]: number[]} = {};
        if (series.columns[DATA] != null) {
          trendlineColumns[DATA] = series.columns[DATA];
        }

        const lineWidth = this.options.inferNonNegativeNumberValue(
          optionPath('lineWidth', ['lineWidth']),
          DEFAULT_LINE_WIDTH,
        );

        const curveType = this.options.inferStringValue(
          optionPath('curveType'),
          CurveType.NONE,
          CurveType,
        ) as CurveType;

        const visibleInLegend = this.options.inferBooleanValue(
          optionPath('visibleInLegend'),
          false,
        );
        const color = toStandardColor(rawColor);
        const trendlineGenerator = TRENDLINE_TYPE_TO_FUNCTION[trendlineType];
        const domainAxisDefiners = isVertical
          ? this.vAxisDefiners
          : this.hAxisDefiners;
        const targetAxisDefiners = isVertical
          ? this.hAxisDefiners
          : this.vAxisDefiners;
        const domainAxisDefiner = domainAxisDefiners![0];
        const targetAxisDefiner = targetAxisDefiners![series.targetAxisIndex];
        if (domainAxisDefiner.type !== AxisType.VALUE) {
          continue;
        }
        const domainAxisValueScale = domainAxisDefiner.valueScale;
        const targetAxisValueScale = targetAxisDefiner.valueScale;
        const domainColumn = 0;
        const domainLabel = data.getColumnLabel(0);
        const dataColumn = series.columns[DATA][0];

        let transformDomain = identity;
        let untransformDomain = identity;

        const isDomainDateLike =
          data.getNumberOfRows() > 0 &&
          goog.isDateLike(data.getValue(0, domainColumn));

        let domainScale = null;
        // For date-like domains, we convert the .getTime() representation from
        // 'milliseconds since 1970' to 'days since 1900', since that's what
        // Excel uses. This also allows our calculations to be on much smaller
        // numbers, which reduces the risk of numeric overflow. This primarily
        // works because date-like axes don't support different scale types
        // (like log). Hence, the following todo:
        // TODO(dlaliberte): if/when date axes support log scale, this will break.
        if (isDomainDateLike) {
          transformDomain = dateTransformDomain;
          untransformDomain = dateUntransformDomain;
        } else {
          domainScale = {
            transform(v: AnyDuringMigration) {
              return domainAxisValueScale!.scaleNumericValue(
                untransformDomain(v),
              );
            },
            inverse(v: AnyDuringMigration) {
              return transformDomain(
                domainAxisValueScale!.unscaleNumericValue(v),
              );
            },
          };
        }

        // ValueScale.getNumeric{Min,Max}Value() will return a scaled number.
        const range = {
          min: transformDomain(domainAxisValueScale!.getNumericMinValue()),
          max: transformDomain(domainAxisValueScale!.getNumericMaxValue()),
        };
        const trendlineDefinition = trendlineGenerator(
          data.getNumberOfRows(), // Data size
          // Function to interpret domain values.
          (i: number) => {
            const value = data.getValue(i, 0);
            const num = domainAxisValueScale!.valueToNumber(value);
            return transformDomain(num);
          }, // Function to interpret target values.
          (i: number) =>
            targetAxisValueScale!.valueToNumber(data.getValue(i, dataColumn)),
          {
            range,
            domainScale,
            degree: this.options.inferNumberValue(optionPath('degree'), 3),
          },
        );

        if (trendlineDefinition === null) {
          continue;
        }

        const trendLabel = this.options.inferStringValue(
          optionPath('label'),
          data.getColumnLabel(dataColumn),
        );
        const equation = trendlineDefinition.makeEquation
          ? trendlineDefinition.makeEquation(domainLabel, trendLabel).simplify()
          : trendlineDefinition.equation;
        const legendLabel =
          stringRenderer.render(equation.compose()) ||
          `Trendline ${trendlineCount}`;
        const title = this.options.inferStringValue(
          optionPath('title'),
          legendLabel,
        );

        // The trendline definer produced data for us, but it's all transformed
        // and scaled. Since the renderer will scale the data itself, we want to
        // convert the data back to unscaled raw values (i.e. Date instead of
        // milliseconds).
        const trendlineData = trendlineDefinition.data.map(
          (row: AnyDuringMigration) => {
            const domainNumber = untransformDomain(row[0]);
            const domainValue =
              domainAxisValueScale!.numberToValue(domainNumber);
            return [domainValue, targetAxisValueScale!.numberToValue(row[1])];
          },
        );

        series.trendlineIndex = chartDef.series.length;

        const lineBrush = Brush.createStrokeBrush(color.color, lineWidth);
        lineBrush.setStrokeOpacity(opacity);

        // Support for dash trendline style
        const lineDashStyle = this.options.inferOptionalNumberArrayValue(
          optionPath('lineDashStyle'),
        );
        if (lineDashStyle) {
          lineBrush.setStrokeDashStyle(lineDashStyle);
        }

        const pointBrush = Brush.createFillBrush(color.color);
        pointBrush.setFillOpacity(opacity);

        let labelInLegend = this.options.inferStringValue(
          optionPath('labelInLegend'),
          title,
        );
        if (this.options.inferBooleanValue(optionPath('showR2'), false)) {
          labelInLegend +=
            '\n' +
            stringRenderer.render(
              new Eq([
                new Pow([new Variable('r'), new GVizNumber(2)]),
                new GVizNumber(trendlineDefinition.r2),
              ]).compose(),
            );
        }

        const showTooltip =
          this.options.inferValue(optionPath('tooltip')) !== false;
        const pointShape = this.options.inferValue(optionPath('pointShape'), {
          'type': 'circle',
        });

        // TODO(dlaliberte): Avoid this cast
        const trendlineSeries = {
          id: series.id + '_trendline',
          title,
          isVirtual: true,
          data: trendlineData,
          dataType: series.dataType,
          enableInteractivity: this.options.inferBooleanValue(
            optionPath('enableInteractivity', ['enableInteractivity']),
            true,
          ),
          showTooltip,
          isVisible: true,
          dataTableIdx: 0,
          columns: trendlineColumns,
          originalSeries: i,
          domainIndex: series.domainIndex,
          intervals: null,
          color,
          colorOpacity: opacity,
          pointBrush,
          lineBrush,
          areaBrush: null,
          candlestick: null,
          boxplot: null,
          type: trendlineSeriesType,
          zOrder: this.options.inferNumberValue(optionPath('zOrder'), 0),
          lineWidth,
          pointRadius,
          pointShape,
          pointSensitivityAreaRadius: DEFAULT_POINT_SENSITIVITY_AREA_RADIUS,
          curveType,
          smoothingFactor: this.options.inferNonNegativeNumberValue(
            optionPath('smoothingFactor', ['smoothingFactor']),
            1,
          ),
          visiblePoints,
          points: [],
          controlPoints: [],
          targetAxisIndex: series.targetAxisIndex,
          visibleInLegend,
          labelInLegend,
        } as unknown as SerieDefinition;
        chartDef.series.push(trendlineSeries);
      }
    }
  }

  /**
   * Scans the columns and infers what the series types are and what columns are
   * mapped to every role of every serie.
   *
   * @param data The data table/view.
   * @param serieTypeInferenceFunction A function for extracting the serie type of a series with a given index.
   * @return The per serie and per category type and column definition.
   */
  private static inferSerieAndCategoryStructures(
    data: AbstractDataTable,
    serieTypeInferenceFunction: (p1: number) => SerieType,
  ): ColumnStructure {
    // TODO(dlaliberte): Add types for these variables.
    const seriesColumnStructure = [];
    const domainsColumnStructure = [];
    let currentUpdatedDescription = null;
    let currentIndex = null;
    let remainingDataColumns = 0;
    const columnRoleInfo = [];
    /** @suppress {deprecated} Removing these later. */
    const barLikeColumns = new Set<number>();
    const numColumns = data.getNumberOfColumns();
    let newDomainColumn = false;
    let serieType;

    for (let i = 0; i < numColumns; ++i) {
      const columnType = data.getColumnType(i);
      const columnRole =
        data.getColumnProperty(i, 'role') || (i === 0 ? DOMAIN : DATA);
      if (i === 0 && columnRole !== DOMAIN) {
        throw new Error(
          `First column has role "${columnRole}", but must be "${DOMAIN}".`,
        );
      }
      // Open new serie if needed (A new series must start with either a data
      // column or an xvalues column.
      if (columnRole === DOMAIN) {
        if (newDomainColumn || remainingDataColumns > 0) {
          throw new Error(`Unexpected ${DOMAIN} column (column #${i})`);
        }
        newDomainColumn = true;
        currentUpdatedDescription = {columns: {}, dataType: columnType};
        currentIndex = {
          serieIndex: null,
          domainIndex: domainsColumnStructure.length,
        };
        domainsColumnStructure.push(currentUpdatedDescription);
      } else if (columnRole === DATA) {
        if (remainingDataColumns === 0) {
          // Start a new set of serie.
          const newSerieIndex = seriesColumnStructure.length;
          serieType = serieTypeInferenceFunction(newSerieIndex);
          currentUpdatedDescription = {
            type: serieType,
            dataType: columnType,
            columns: {},
          };
          currentIndex = {serieIndex: newSerieIndex, domainIndex: null};
          seriesColumnStructure.push(currentUpdatedDescription);
          remainingDataColumns =
            serieType === SerieType.CANDLESTICKS
              ? 4
              : serieType === SerieType.BOXPLOT
                ? 5
                : 1;
        }

        remainingDataColumns--;
        if (columnType !== currentUpdatedDescription!.dataType) {
          // This is now only testing that the candlestick serieses are the
          // same.
          // TODO(dlaliberte) Need to compare with the prior column that has
          // the same targetAxisIndex.
          throw new Error(
            `All data columns targeting the same axis must be of the same data type.
              Column #${i} is of type ${columnType} but expected type is ${
                currentUpdatedDescription!.dataType
              }`,
          );
        }

        if (
          serieType === SerieType.BARS ||
          serieType === SerieType.CANDLESTICKS ||
          serieType === SerieType.BOXPLOT
        ) {
          barLikeColumns.add(i);
        }
      } else if (
        columnRole === TOOLTIP &&
        (currentUpdatedDescription!.columns as AnyDuringMigration)[columnRole]
      ) {
        throw new Error(
          "Only one column with role 'tooltip' per series is allowed",
        );
      }
      if (columnRole !== DOMAIN) {
        newDomainColumn = false;
      }

      (currentUpdatedDescription!.columns as AnyDuringMigration)[columnRole] =
        (currentUpdatedDescription!.columns as AnyDuringMigration)[
          columnRole
        ] || [];

      // Keep role information per column.
      columnRoleInfo.push({
        serieIndex: currentIndex!.serieIndex,
        domainIndex: currentIndex!.domainIndex,
        role: columnRole,
        roleIndex: (currentUpdatedDescription!.columns as AnyDuringMigration)[
          columnRole
        ].length,
      });

      (currentUpdatedDescription!.columns as AnyDuringMigration)[
        columnRole
      ].push(i);
    }

    // Validate result and fill in domain index for those not explicitly
    // specified for already.
    if (remainingDataColumns > 0) {
      throw new Error(
        `Last domain does not have enough data columns (missing ${remainingDataColumns})`,
      );
    }
    let currentDomain = 0;
    const domainDataType = domainsColumnStructure[0].dataType;
    for (let i = 0; i < seriesColumnStructure.length; ++i) {
      // Make sure currentDomain which is supposed to be a legal domain index
      // is indeed legal (smaller than the length of domainsColumnStructure).
      if (domainsColumnStructure.length <= currentDomain) {
        throw new Error(`Series #${i} does not have a ` + DOMAIN + ' column.');
      }
      // Now scan and find the last column bundle whose domain column is smaller
      // than current bundle's data column.
      const nextColumnStructure = domainsColumnStructure[currentDomain + 1];
      // nextColumnStructure might not be defined, since there might not be a
      // next column structure and in that case we stay with the current till
      // the end.
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'data' does not exist on type '{}'.
      // @ts-ignore
      const dataColumns = seriesColumnStructure[i].columns[DATA];
      if (
        nextColumnStructure &&
        (nextColumnStructure.columns as AnyDuringMigration)[DOMAIN][0] <=
          dataColumns![0]
      ) {
        ++currentDomain;
        if (domainDataType !== domainsColumnStructure[currentDomain].dataType) {
          throw new Error('All domains must be of the same data type');
        }
      }
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'domainIndex' does not exist on type '{ type: SerieType; dataType: ColumnType; columns: {}; }'.
      // @ts-ignore
      seriesColumnStructure[i].domainIndex = currentDomain;
    }
    return {
      // Suppressing errors for ts-migration.
      //   TS2322: Type '{ type: SerieType; dataType: ColumnType; columns: {}; }[]' is not assignable to type 'Structure[]'.
      // @ts-ignore
      seriesColumnStructure,
      domainsColumnStructure,
      domainDataType,
      columnRoleInfo,
      barLikeColumns,
    };
  }

  /**
   * Validates whether a column type is equal to expected,
   * and throws error when not.
   */
  private static validateColumnDataType(
    expectedColumnType: string,
    columnType: string,
  ) {
    if (expectedColumnType !== columnType) {
      throw new Error(
        'Column types must be consistent: equal for ' +
          'domain columns and for columns in the same serie.',
      );
    }
  }

  /**
   * Scans the columns and infers what the series types are and what columns are
   * mapped to every role of every serie in a diff chart.
   * TODO(dlaliberte) Integrate this with inferSerieAndCategoryStructures().
   * And integrate diff chart elements with intervals.
   *
   * @param data The data table/view.
   * @param serieTypeInferenceFunction A function for extracting the serie type of a series with a given index.
   * @return The per serie and per category type and column definition.
   */
  private static inferSerieAndCategoryStructuresForDiffChart(
    data: AbstractDataTable,
    serieTypeInferenceFunction: (p1: number) => SerieType,
    chartType: ChartType,
  ): ColumnStructure {
    const seriesColumnStructure: Structure[] = [];
    const domainsColumnStructure: Structure[] = [];
    let domainDataType = null;
    const columnRoleInfo = [];
    const barLikeColumns = new Set<number>();

    // Handles scatter charts separately, since it has a domain for old data and
    // one for new data.
    if (chartType === ChartType.SCATTER) {
      // Support for scatter chart.
      const numberOfDataColumns = data.getNumberOfColumns();
      const numberOfDomainColumns = 2; // One for old data and one for new data.
      const numberOfSeries = numberOfDataColumns - numberOfDomainColumns;

      const validateColumnRole = (columnRole: AnyDuringMigration) => {
        if (columnRole !== DATA && columnRole !== DIFF_OLD_DATA) {
          throw new Error(
            `All columns must be either ${DATA} or ${DIFF_OLD_DATA}` +
              ' columns',
          );
        }
      };

      // Domain columns are the first two.
      const domainColumns = {};
      (domainColumns as AnyDuringMigration)[DATA] = null;
      (domainColumns as AnyDuringMigration)[DIFF_OLD_DATA] = null;

      domainDataType = data.getColumnType(0);
      for (let i = 0; i < numberOfDomainColumns; ++i) {
        const columnType = data.getColumnType(i);
        const columnRole = data.getColumnProperty(i, 'role');
        // Validates role and data type.
        validateColumnRole(columnRole);
        AxisChartDefiner.validateColumnDataType(domainDataType, columnType);

        // Stores return value and domain column for later reference.
        const domainColumnStructure: Structure = {
          columns: {},
          dataType: columnType,
        } as Structure;
        (domainColumnStructure.columns as AnyDuringMigration)[DOMAIN] = [i];
        domainsColumnStructure.push(domainColumnStructure);
        (domainColumns as AnyDuringMigration)[columnRole] = i;

        // Stores column role info.
        columnRoleInfo.push({
          domainIndex: i,
          role: DOMAIN,
          roleIndex: 0,
          serieIndex: null,
        });
      }

      // Processes each serie.
      for (let serieIndex = 0; serieIndex < numberOfSeries; ++serieIndex) {
        const columnIndex = numberOfDomainColumns + serieIndex;
        const columnType = data.getColumnType(serieIndex);
        const columnRole = data.getColumnProperty(serieIndex, 'role');

        // Validates role and data type.
        validateColumnRole(columnRole);
        if (serieIndex % 2) {
          // serie column type must be equal to the previous one: old and new
          // data columns must have same type.
          const previousSerieDataType =
            seriesColumnStructure[serieIndex - 1].dataType;
          AxisChartDefiner.validateColumnDataType(
            previousSerieDataType,
            columnType,
          );
        }

        // Stores serie column structure.
        const domainColumnIndex = (domainColumns as AnyDuringMigration)[
          columnRole
        ];
        const serieColumnStructure = {
          type: serieTypeInferenceFunction(serieIndex),
          dataType: columnType,
          domainIndex: domainColumnIndex,
          columns: {},
        };
        (serieColumnStructure.columns as AnyDuringMigration)[columnRole] = [
          columnIndex,
        ];
        seriesColumnStructure.push(serieColumnStructure);

        // Stores column role info.
        columnRoleInfo.push({
          domainIndex: domainColumnIndex,
          role: columnRole,
          roleIndex: 0,
          serieIndex,
        });
      }
    } else if (chartType === ChartType.FUNCTION) {
      let currentUpdatedDescription: Structure | null = null;
      let currentIndex = null;
      let remainingDataColumns = 0;
      const numColumns = data.getNumberOfColumns();

      for (let i = 0; i < numColumns; ++i) {
        const columnType = data.getColumnType(i);
        const columnRole =
          data.getColumnProperty(i, 'role') || (i === 0 ? DOMAIN : DATA);
        if (i === 0 && columnRole !== DOMAIN) {
          throw new Error(`First column must be a ${DOMAIN} column`);
        }
        // Open new serie if needed (A new series must start with either a data
        // column or an xvalues column.
        if (columnRole === DOMAIN) {
          if (remainingDataColumns > 0) {
            throw new Error(`Unexpected ${DOMAIN} column (column #${i})`);
          }
          currentUpdatedDescription = {
            columns: {},
            dataType: columnType,
          } as Structure;
          currentIndex = {
            serieIndex: null,
            domainIndex: domainsColumnStructure.length,
          };
          domainsColumnStructure.push(currentUpdatedDescription);
        }
        if (
          remainingDataColumns === 0 &&
          (columnRole === DATA || columnRole === DIFF_OLD_DATA)
        ) {
          const newSerieIndex = seriesColumnStructure.length;
          const serieType = serieTypeInferenceFunction(newSerieIndex);
          currentUpdatedDescription = {
            type: serieType,
            dataType: columnType,
            columns: {},
          } as Structure;
          currentIndex = {serieIndex: newSerieIndex, domainIndex: null};
          seriesColumnStructure.push(currentUpdatedDescription);
          if (serieType === SerieType.CANDLESTICKS) {
            remainingDataColumns = 4;
          } else if (serieType === SerieType.BOXPLOT) {
            remainingDataColumns = 5;
          } else if (columnRole === DIFF_OLD_DATA) {
            remainingDataColumns = 2; // Diff always has new and old data.
          } else {
            remainingDataColumns = 1;
          }

          if (
            serieType === SerieType.BARS ||
            serieType === SerieType.CANDLESTICKS ||
            serieType === SerieType.BOXPLOT
          ) {
            barLikeColumns.add(i);
          }
        }

        if (columnRole === DATA || columnRole === DIFF_OLD_DATA) {
          remainingDataColumns--;
          if (columnType !== currentUpdatedDescription!.dataType) {
            throw new Error(
              `All data columns targeting the same axis must be of the same ` +
                `data type.  Column #${i} is of type ${columnType} but ` +
                `expected type is ${currentUpdatedDescription!.dataType}`,
            );
          }
        }
        if (
          columnRole === TOOLTIP &&
          (currentUpdatedDescription!.columns as AnyDuringMigration)[columnRole]
        ) {
          throw new Error(
            "Only one data column with role 'tooltip' per series is allowed",
          );
        }
        (currentUpdatedDescription!.columns as AnyDuringMigration)[columnRole] =
          (currentUpdatedDescription!.columns as AnyDuringMigration)[
            columnRole
          ] || [];

        // Keep role information per column.
        columnRoleInfo.push({
          serieIndex: currentIndex!.serieIndex,
          domainIndex: currentIndex!.domainIndex,
          role: columnRole,
          roleIndex: (currentUpdatedDescription!.columns as AnyDuringMigration)[
            columnRole
          ].length,
        });

        (currentUpdatedDescription!.columns as AnyDuringMigration)[
          columnRole
        ].push(i);
      }

      // Validate result and fill in domain index for those not explicitly
      // specified for already.
      if (remainingDataColumns > 0) {
        throw new Error(
          `Last domain does not have enough data columns (missing ${remainingDataColumns})`,
        );
      }
      let currentDomain = 0;
      domainDataType = domainsColumnStructure[0].dataType;
      for (let i = 0; i < seriesColumnStructure.length; ++i) {
        // Make sure currentDomain which is supposed to be a legal domain index
        // is indeed legal (smaller than the length of domainsColumnStructure).
        if (domainsColumnStructure.length <= currentDomain) {
          throw new Error(
            `Series #${i} does not have a ` + DOMAIN + ' column.',
          );
        }
        // Now scan and find the last column bundle whose domain column is
        // smaller than current bundle's data column.
        const nextColumnStructure = domainsColumnStructure[currentDomain + 1];
        // nextColumnStructure might not be defined, since there might not be a
        // next column structure and in that case we stay with the current till
        // the end.
        const dataColumns =
          // Suppressing errors for ts-migration.
          //   TS2339: Property 'old-data' does not exist on type '{}'.
          // @ts-ignore
          seriesColumnStructure[i].columns[DIFF_OLD_DATA] ||
          // Suppressing errors for ts-migration.
          //   TS2339: Property 'data' does not exist on type '{}'.
          // @ts-ignore
          seriesColumnStructure[i].columns[DATA];
        if (
          nextColumnStructure &&
          (nextColumnStructure.columns as AnyDuringMigration)[DOMAIN][0] <=
            dataColumns![0]
        ) {
          ++currentDomain;
          if (
            domainDataType !== domainsColumnStructure[currentDomain].dataType
          ) {
            throw new Error('All domains must be of the same data type');
          }
        }
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'domainIndex' does not exist on type '{ type: SerieType; dataType: ColumnType; columns: {}; }'.
        // @ts-ignore
        seriesColumnStructure[i].domainIndex = currentDomain;
      }
    }

    domainDataType = domainDataType!;
    return {
      seriesColumnStructure,
      domainsColumnStructure,
      domainDataType,
      columnRoleInfo,
      barLikeColumns,
    };
  }

  /**
   * Returns whether a serie contains old data or new data.
   * Useful for diff charts.
   *
   * @param serieStructure The structure of the serie and its type.
   * @return true when serie contains old data.
   */
  private serieHasOldData(serieStructure: Structure): boolean {
    const oldDataColumns = serieStructure.columns[DIFF_OLD_DATA];
    return oldDataColumns != null && oldDataColumns.length > 0;
  }

  /**
   * Calculates the series and categories drawing data for a specific series.
   *
   * @param serieIndex The index of the serie to define.
   * @param serieStructure The structure of the serie and its type.
   * @return The object defining that serie.
   */
  private createSerieDefinition(
    serieIndex: number,
    serieStructure: Structure,
  ): SerieDefinition {
    let serieType = serieStructure.type;
    const columns = serieStructure.columns;
    const domainIndex = serieStructure.domainIndex;
    const options = this.options;
    const optionPrefix = `series.${serieIndex}.`;
    const chartTypePrefix = `${serieType}.`;
    // Data may come from DATA or DIFF_OLD_DATA columns.
    const dataColumns = columns[DATA] || columns[DIFF_OLD_DATA];
    let diff;

    // Translates series index to the corresponding column in the data table.
    // Since the first column in the view is categories, we need to add 1 to the
    // index before translating to the actual column.
    const dataTableIdx = this.dataView.getColumnIndex(dataColumns[0]);
    const title = this.dataView.getColumnLabel(dataColumns[0]) || '';
    const defaultLineWidth =
      serieType === SerieType.SCATTER ? 0 : DEFAULT_LINE_WIDTH;

    // Default point size as specified in the external user documentation.
    const defaultPointSize =
      serieType === SerieType.SCATTER ? DEFAULT_POINT_SIZE_FOR_SCATTER : 0;
    let pointSize = options.inferNonNegativeNumberValue(
      [`${optionPrefix}pointSize`, 'pointSize'],
      defaultPointSize,
    );

    let visiblePoints =
      serieType === SerieType.LINE ||
      serieType === SerieType.AREA ||
      serieType === SerieType.SCATTER
        ? pointSize > 0
        : true;
    visiblePoints = options.inferBooleanValue(
      [`${optionPrefix}pointsVisible`, 'pointsVisible'],
      visiblePoints,
    );

    // If pointSize is 0 use default point size for interactivity.
    if (pointSize === 0) {
      pointSize =
        serieType === SerieType.SCATTER
          ? DEFAULT_POINT_SIZE_FOR_SCATTER
          : DEFAULT_POINT_SIZE_FOR_LINE;
    }

    let pointRadius = pointSize / 2;

    // Adjusting pointRadius for backward compatibility:
    // Previously, we painted a stroke for each point circle which
    // increased the size of the radius of the circle by 1 pixel.
    // Now we don't paint the stroke, so instead we adjust the given size.
    if (pointRadius > 0) {
      pointRadius += 1;
    }

    // Gets color index: for scatter chart in diff mode, there are n series,
    // n/2 are for old data and n/2 for new data. We set the color of each
    // consecutive pair of series to the same color: old color is faded out
    // using opacity.
    let serieColorIndex;
    if (this.chartDef.isDiff && serieType === SerieType.SCATTER) {
      serieColorIndex = Math.floor(serieIndex / 2);
    } else {
      serieColorIndex = serieIndex;
    }

    // Note: There may be a way of getting null or other types in this.colors,
    // and therefore into 'rawColor', so the following type may not be accurate.
    const rawColor = options.inferValue(
      `${optionPrefix}color`,
      this.colors![serieColorIndex % this.colors!.length],
    ) as RelativeColor | string;
    const color = toStandardColor(rawColor);

    // For area serie: define the brush used for filling the area.
    let areaBrush = null;
    if (serieType === SerieType.AREA || serieType === SerieType.STEPPED_AREA) {
      const areaOpacity = options.inferRatioNumberValue([
        `${optionPrefix}areaOpacity`,
        'areaOpacity',
      ]);
      areaBrush = Brush.createFillBrush(color.color, areaOpacity);
    }

    // For candlestick serie: define the brushes used for rising and falling
    // candlesticks.
    let candlestick = null;
    if (serieType === SerieType.CANDLESTICKS) {
      const filledBrush = new Brush({
        stroke: color.color,
        strokeWidth: 2,
        fill: color.color,
      });
      const hollowBrush = new Brush({
        stroke: color.color,
        strokeWidth: 2,
        fill: '#fff',
      });
      const hollowIsRising = options.inferBooleanValue(
        'candlestick.hollowIsRising',
      );
      const defaultRisingBrush = hollowIsRising ? hollowBrush : filledBrush;
      const defaultFallingBrush = hollowIsRising ? filledBrush : hollowBrush;
      candlestick = {
        risingBrush: options.inferBrushValue(
          [`${optionPrefix}candlestick.risingColor`, 'candlestick.risingColor'],
          defaultRisingBrush,
        ),
        fallingBrush: options.inferBrushValue(
          [
            `${optionPrefix}candlestick.fallingColor`,
            'candlestick.fallingColor',
          ],
          defaultFallingBrush,
        ),
      };
    }

    // For boxplot serie: define the brushes used for the main box and
    // the middle line (stroke)
    let boxplot = null;
    if (serieType === SerieType.BOXPLOT) {
      const defaultBarBrush = new Brush({
        stroke: color.color,
        strokeWidth: 2,
        fill: color.color,
      });
      const barBrush = options.inferBrushValue(
        [`${optionPrefix}boxplot.boxColor`, 'boxplot.boxColor'],
        defaultBarBrush,
      );
      boxplot = {barBrush};
    }

    // Define the brush for drawing the line of the serie.
    const lineWidth = options.inferNonNegativeNumberValue(
      [`${optionPrefix}lineWidth`, 'lineWidth'],
      defaultLineWidth,
    );
    const lineBrush = Brush.createStrokeBrush(color.color, lineWidth);
    const lineDashStyle = options.inferOptionalNumberArrayValue([
      `${optionPrefix}lineDashStyle`,
      'lineDashStyle',
    ]);
    if (lineDashStyle) {
      lineBrush.setStrokeDashStyle(lineDashStyle);
    }
    let dataOpacity = options.inferNonNegativeNumberValue(
      [
        `${optionPrefix}dataOpacity`,
        `${chartTypePrefix}dataOpacity`,
        'dataOpacity',
      ],
      1.0,
    );

    let pointShape = null;
    if (
      serieType === SerieType.SCATTER ||
      serieType === SerieType.LINE ||
      serieType === SerieType.AREA
    ) {
      pointShape = options.inferValue(
        [`${optionPrefix}pointShape`, 'pointShape'],
        {'type': 'circle'},
      );
      if (typeof pointShape === 'string') {
        pointShape = {'type': pointShape};
      }
    }

    // Handles diff chart for some chart types: redefine opacity for
    // series with old data and for new data, and make old data not
    // visible in legend.
    let visibleInLegend = null;
    if (this.chartDef.isDiff && serieType === SerieType.SCATTER) {
      // Data may come from DATA or DIFF_OLD_DATA columns.
      const isOldDataSerie = this.serieHasOldData(serieStructure);
      dataOpacity = isOldDataSerie
        ? (this.options.inferValue(
            'diff.oldData.opacity',
            DEFAULT_DIFF_OLD_DATA_OPACITY,
          ) as number)
        : (this.options.inferValue(
            'diff.newData.opacity',
            DEFAULT_DIFF_NEW_DATA_OPACITY,
          ) as number);
      if (isOldDataSerie) {
        visibleInLegend = false;
      }
    }
    const pointBrush =
      serieType === SerieType.STEPPED_AREA
        ? areaBrush
        : Brush.createFillBrush(color.color, dataOpacity);

    // For diff chart: defines the brush used for filling old data (for some
    // chart types).
    if (this.chartDef.isDiff) {
      if (serieType === SerieType.BARS) {
        const diffBgRawColor = options.inferValue(
          'diff.oldData.color',
          DEFAULT_DIFF_SERIES_BACKGROUND_COLOR,
        ) as RelativeColor | string;
        const diffBgColor = toStandardColor(diffBgRawColor);
        diff = {
          background: {
            pointBrush: Brush.createFillBrush(diffBgColor.color, dataOpacity),
          },
        };
      } else if (
        serieType === SerieType.SCATTER &&
        this.serieHasOldData(serieStructure)
      ) {
        visiblePoints = false;
      }
    } else if (serieType === SerieType.SCATTER) {
      // Convert to line type.
      serieType = SerieType.LINE;
    }

    const intervals = this.getIntervalDefinitions(
      columns,
      options,
      optionPrefix,
      color,
    );

    const showTooltip =
      this.options.inferValue(`${optionPrefix}tooltip`) !== false;

    return {
      id: this.dataView.getColumnId(dataColumns[0]),
      title,
      dataType: serieStructure.dataType,
      isVisible: true,
      showTooltip,
      dataTableIdx,
      columns,
      domainIndex,
      enableInteractivity: options.inferBooleanValue(
        [`${optionPrefix}enableInteractivity`, 'enableInteractivity'],
        true,
      ),
      intervals,
      color,
      colorOpacity: dataOpacity,
      pointBrush,
      lineBrush,
      areaBrush,
      pointShape,
      diff,
      candlestick,
      boxplot,
      type: serieType,
      zOrder: options.inferNumberValue(`${optionPrefix}zOrder`, 0),
      lineWidth,
      pointRadius,
      pointSensitivityAreaRadius: DEFAULT_POINT_SENSITIVITY_AREA_RADIUS,
      curveType: options.inferStringValue(
        [`${optionPrefix}curveType`, 'curveType'],
        CurveType.NONE,
        CurveType,
      ),
      smoothingFactor: options.inferNonNegativeNumberValue(
        [`${optionPrefix}smoothingFactor`, 'smoothingFactor'],
        1,
      ),
      visiblePoints,
      points: [],
      controlPoints: [],
      targetAxisIndex: options.inferNonNegativeNumberValue(
        [`${optionPrefix}targetAxisIndex`, 'targetAxisIndex'],
        0,
      ),
      visibleInLegend:
        visibleInLegend != null
          ? visibleInLegend
          : options.inferBooleanValue(`${optionPrefix}visibleInLegend`, true),
      labelInLegend: options.inferStringValue(
        `${optionPrefix}labelInLegend`,
        title,
      ),
      stepped: options.inferBooleanValue(
        [`${optionPrefix}stepped`, 'stepped'],
        false,
      ),
    } as unknown as SerieDefinition;
  }

  /**
   * Returns the interval-definitions for a serie.
   *
   * Intervals are a sequence of values associated with a serie, defined in
   * columns with role='interval'. Expected usage is to define min/max values of
   * an aggregated point; percentile sampling of the point, confidence intervals
   * around the point, etc. Where these concepts are ordered, it is expected
   * that the "low" value precedes the "high" (relative to column numbers).
   *
   * Multiple columns may be associated with an "interval". For example a
   * "min-max" interval may have two columns, while "percentiles" might have
   * many (e.g. six columns for the 0th, 20th, 40th, 60th, 80th, and 100th
   * percentiles). When multiple columns are associated with an interval, the
   * column-label for all the columns of an interval should be the same. This
   * will allow rendering options to be applied to the interval as a whole.
   *
   * In an axis-chart, intervals are rendered in the styles defined in the enum,
   * IntervalStyle. The option may be applied to the whole
   * chart, to a single serie, to a single interval in a serie, or to the
   * intervals of a given name across all series:
   *
   *   intervals.style = <value>
   *   interval.<interval-name>.style = <value>
   *   series.<number>.intervals.style = <value>
   *   series.<number>.interval.<interval-name>.style = <value>
   *
   * The styles are:
   *   BARS: The intervals are rendered as "error bars": the first and last
   *   columns of the interval are drawn as wide bars parallel to the
   *   domain-axis; inner columns are drawn as shorter "ticks". A "stick" is
   *   added to join the wide bars (if these two bars have the same value then
   *   the stick is rendered as a point, unless the pointSize option is zero).
   *
   *   STICKS: Pairs of columns are drawn as a set of sticks parallel to the
   *   target-axis. A stick of zero height is rendered as a point, which can be
   *   suppressed by setting the pointSize option to zero.
   *
   *   BOXES: The columns are rendered as a set of nested rectangles: the first/
   *   last columns form the outermost rectangle; inner columns render as darker
   *   rectangles within their containing box.
   *
   *   AREA: The columns are rendered as a set of nested shaded areas. Nesting
   *   of pairs of columns is similar to that of BOXES, except that we require
   *   an even number of columns.
   *
   *   POINTS: The interval-columns are drawn as discrete points (small cicles).
   *
   *   LINE: The intervals are drawn as lines, similar to the main data line
   *   except that the line width can be narrower (the intended use is to show
   *   the raw data from which a trend line was extracted).
   *
   *   NONE: The interval is not drawn.
   *
   * Note that if multiple intervals are assigned the same style, then the
   * intervals are merged for the purpose of the rendering. Thus, if two
   * intervals are both given the BARS style, then only two "wide" bars are
   * drawn (the first/last columns) with all others being rendered as short
   * ticks.
   *
   * In addition to the style, a number of other options are available to define
   * the detailed rendering of the interval.
   *
   *   intervals.lineWidth      -- Stroke-thickness when drawing the intervals.
   *   intervals.fillOpacity    -- FillOpacity for boxes and points.
   *   intervals.barWidth       -- Width of the top/bottom bars for error-bars.
   *   intervals.shortBarWidth  -- Width of "ticks" for inner-intervals of
   *                               error-bars.
   *   intervals.boxWidth       -- Width of the rectangle for 'boxes'.
   *   intervals.pointSize      -- Diameter of 'points'.
   *   intervals.color          -- The color to draw the interval marks. Any
   * valid gviz color, or one of series-relative values from
   * SeriesRelativeColor.
   *
   * 'barWidth', 'shortBarWidth', and 'boxWidth' define their width as a
   * fraction of the 'subdivision' spacing along the domain-axis; 'lineWidth'
   * and 'pointSize' are defined in pixels.
   *
   * All options can also be set per-interval, using similar syntax to the
   * 'style' option: "interval.<interval-name>.<option-name> = <value>".
   *
   * @param columns Role-to-columns map.
   * @param options The chart options.
   * @param optionPrefix The per-serie option prefix.
   * @param color The set of colors for the serie.
   * @return The definition of the intervals. Contains bars, sticks, boxes, points, areas and lines as arrays of column indices; plus the values of the settings for each column. Returns null if the serie has no interval columns.
   */
  private getIntervalDefinitions(
    columns: AnyDuringMigration,
    options: Options,
    optionPrefix: string,
    color: AnyDuringMigration,
  ): {
    bars: number[];
    sticks: number[];
    boxes: number[];
    points: number[];
    areas: number[];
    lines: number[];
    settings: {[key: number]: IntervalSettings};
  } | null {
    const intervalColumns = columns[INTERVAL];

    if (!intervalColumns) {
      return null;
    }

    // TODO(dlaliberte): Define a type for intervals, and its properties.
    const intervals = {
      bars: [],
      sticks: [],
      boxes: [],
      points: [],
      areas: [],
      lines: [],
      settings: {},
    };
    const columnsOfInterval: {[key: string]: number[]} = {};

    const optionNamesOfIntervalOption = (
      intervalName: string,
      optionName: string,
    ) => [
      `${optionPrefix}interval.${intervalName}.${optionName}`,
      `${optionPrefix}intervals.${optionName}`,
      `interval.${intervalName}.${optionName}`,
      `intervals.${optionName}`,
    ];

    const optionNamesOfIntervalOrGlobalOption = (
      intervalName: string,
      optionName: string,
    ) => {
      const names = optionNamesOfIntervalOption(intervalName, optionName);
      return names.concat([optionPrefix + optionName, optionName]);
    };

    for (let i = 0; i < intervalColumns.length; i++) {
      const columnIndex = intervalColumns[i];
      const intervalName =
        this.dataView.getColumnId(columnIndex) ||
        this.dataView.getColumnLabel(columnIndex) ||
        'default';
      const intervalStyle = options.inferOptionalStringValue(
        optionNamesOfIntervalOption(intervalName, 'style'),
        IntervalStyle,
      );
      switch (intervalStyle) {
        case IntervalStyle.BARS:
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
          // @ts-ignore
          intervals.bars.push(columnIndex);
          this.barLikeColumns!.add(columnIndex);
          break;
        case IntervalStyle.STICKS:
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
          // @ts-ignore
          intervals.sticks.push(columnIndex);
          break;
        case IntervalStyle.BOXES:
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
          // @ts-ignore
          intervals.boxes.push(columnIndex);
          this.barLikeColumns!.add(columnIndex);
          break;
        case IntervalStyle.POINTS:
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
          // @ts-ignore
          intervals.points.push(columnIndex);
          break;
        case IntervalStyle.AREA:
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
          // @ts-ignore
          intervals.areas.push(columnIndex);
          break;
        case IntervalStyle.LINE:
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'any' is not assignable to parameter of type 'never'.
          // @ts-ignore
          intervals.lines.push(columnIndex);
          break;
        case IntervalStyle.NONE:
          break;
        default:
          throw new Error(`Invalid interval style: ${intervalStyle}`);
      }
      if (intervalName in columnsOfInterval) {
        columnsOfInterval[intervalName].push(columnIndex);
      } else {
        columnsOfInterval[intervalName] = [columnIndex];
      }
    }
    if (intervals.bars.length > 1 && intervals.sticks.length === 0) {
      // Add the vertical stick between the horizontal error bars -- unless the
      // user has defines explicit sticks.
      intervals.sticks = [
        intervals.bars[0],
        intervals.bars[intervals.bars.length - 1],
      ];
    }
    if (intervals.sticks.length % 2 !== 0) {
      throw new Error(
        'Stick-intervals must be defined by an even number of columns',
      );
    }
    if (intervals.areas.length % 2 !== 0) {
      throw new Error(
        'Area-intervals must be defined by an even number of columns',
      );
    }

    for (const intervalName in columnsOfInterval) {
      if (!columnsOfInterval.hasOwnProperty(intervalName)) continue;
      const intervalLineWidth = options.inferNonNegativeNumberValue(
        optionNamesOfIntervalOption(intervalName, 'lineWidth'),
      );

      const intervalFillOpacity = options.inferRatioNumberValue(
        optionNamesOfIntervalOption(intervalName, 'fillOpacity'),
      );

      let intervalColor = options.inferColorValue(
        optionNamesOfIntervalOption(intervalName, 'color'),
        '',
        googObject.getValues(SeriesRelativeColor),
      );
      intervalColor = resolveSerieRelativeColor(intervalColor, color);

      const intervalBrush = new Brush({
        stroke: intervalColor,
        strokeWidth: intervalLineWidth,
        fill: intervalColor,
        fillOpacity: intervalFillOpacity,
      });

      const intervalBarWidth = options.inferNonNegativeNumberValue(
        optionNamesOfIntervalOption(intervalName, 'barWidth'),
      );

      const intervalShortBarWidth = options.inferNonNegativeNumberValue(
        optionNamesOfIntervalOption(intervalName, 'shortBarWidth'),
      );

      const intervalBoxWidth = options.inferNonNegativeNumberValue(
        optionNamesOfIntervalOption(intervalName, 'boxWidth'),
      );

      const intervalPointSize = options.inferNonNegativeNumberValue(
        optionNamesOfIntervalOption(intervalName, 'pointSize'),
      );

      const intervalStyle = options.inferOptionalStringValue(
        optionNamesOfIntervalOption(intervalName, 'style'),
        IntervalStyle,
      );

      const interpolateNulls = options.inferBooleanValue(
        optionNamesOfIntervalOrGlobalOption(intervalName, 'interpolateNulls'),
      );

      const curveType = options.inferStringValue(
        optionNamesOfIntervalOrGlobalOption(intervalName, 'curveType'),
        CurveType.NONE,
        CurveType,
      );

      const smoothingFactor = options.inferNonNegativeNumberValue(
        optionNamesOfIntervalOrGlobalOption(intervalName, 'smoothingFactor'),
        1,
      );

      const intervalSettings = {
        style: intervalStyle,
        brush: intervalBrush,
        barWidth: intervalBarWidth,
        shortBarWidth: intervalShortBarWidth,
        boxWidth: intervalBoxWidth,
        pointSize: intervalPointSize,
        interpolateNulls,
        curveType,
        smoothingFactor,
      };

      // Make the options visible for each column of the interval in this serie.
      const columnIndices = (columnsOfInterval as AnyDuringMigration)[
        intervalName
      ];
      for (let i = 0; i < columnIndices.length; ++i) {
        const columnIndex = columnIndices[i];
        (intervals.settings as AnyDuringMigration)[columnIndex] =
          intervalSettings;
      }
    }

    return intervals;
  }

  /** Create the axes. */
  private createAxes() {
    const chartDef = this.chartDef;
    switch (chartDef.chartType) {
      case ChartType.FUNCTION:
      case ChartType.HISTOGRAM:
        chartDef.orientation = this.options.inferStringValue(
          'orientation',
          '',
          Orientation,
        ) as Orientation;
        if (!chartDef.orientation) {
          throw new Error('Unspecified orientation.');
        }
        // Now figure out what actual axis each target / domain axis maps to.
        this.targetAxisDefiners = {};
        this.hAxisDefiners = {};
        this.vAxisDefiners = {};

        const [targetAxisCtor, targetAxisChartDefField] =
          chartDef.orientation === Orientation.HORIZONTAL
            ? [VerticalAxisDefiner, this.vAxisDefiners]
            : [HorizontalAxisDefiner, this.hAxisDefiners];
        const [domainAxisCtor, domainAxisChartDefField] =
          chartDef.orientation === Orientation.HORIZONTAL
            ? [HorizontalAxisDefiner, this.hAxisDefiners]
            : [VerticalAxisDefiner, this.vAxisDefiners];

        const targetAxisIndices =
          this.targetAxisIndices == null
            ? []
            : arrayFromSet(this.targetAxisIndices);
        for (let i = 0; i < targetAxisIndices.length; ++i) {
          const targetAxisIndex = targetAxisIndices[i];
          const targetAxisDefiner = new targetAxisCtor(
            chartDef,
            this.options,
            [`targetAxes.${targetAxisIndex}`, 'targetAxis'],
            targetAxisIndex,
            AxisType.VALUE,
            ViewWindowMode.PRETTY,
          );
          if (targetAxisDefiner.type !== AxisType.VALUE) {
            throw new Error('Target-axis must be of type ' + AxisType.VALUE);
          }
          // Suppressing errors for ts-migration.
          //   TS2322: Type 'HorizontalAxisDefiner | VerticalAxisDefiner' is not assignable to type 'AxisDefiner'.
          // @ts-ignore
          this.targetAxisDefiners[targetAxisIndex] = targetAxisDefiner;
          targetAxisChartDefField[targetAxisIndex] = targetAxisDefiner;
        }

        // Suppressing errors for ts-migration.
        //   TS2322: Type 'HorizontalAxisDefiner | VerticalAxisDefiner' is not assignable to type 'AxisDefiner | null'.
        // @ts-ignore
        this.domainAxisDefiner = new domainAxisCtor(
          chartDef,
          this.options,
          ['domainAxis'],
          0,
          this.getDefaultDomainAxisType(),
          ViewWindowMode.MAXIMIZED,
        );
        // Suppressing errors for ts-migration.
        //   TS2322: Type 'AxisDefiner | null' is not assignable to type 'HorizontalAxisDefiner | VerticalAxisDefiner'.
        // @ts-ignore
        domainAxisChartDefField[0] = this.domainAxisDefiner;
        break;
      case ChartType.SCATTER:
      case ChartType.BUBBLE:
        // TODO(dlaliberte) Do away with this case, once we merge scatter
        // and bubble entirely with other core charts.
        this.hAxisDefiners = {
          0: new HorizontalAxisDefiner(
            chartDef,
            this.options,
            [],
            0,
            AxisType.VALUE,
            ViewWindowMode.PRETTY,
          ),
        };
        this.vAxisDefiners = {
          0: new VerticalAxisDefiner(
            chartDef,
            this.options,
            [],
            0,
            AxisType.VALUE,
            ViewWindowMode.PRETTY,
          ),
        };
        if (chartDef.orientation === Orientation.HORIZONTAL) {
          this.domainAxisDefiner = this.hAxisDefiners[0];
          // Suppressing errors for ts-migration.
          //   TS2322: Type '{ [key: number]: VerticalAxisDefiner; }' is not assignable to type '{ [key: number]: AxisDefiner; }'.
          // @ts-ignore
          this.targetAxisDefiners = this.vAxisDefiners;
        } else {
          // Suppressing errors for ts-migration.
          //   TS2322: Type 'VerticalAxisDefiner' is not assignable to type 'AxisDefiner'.
          // @ts-ignore
          this.domainAxisDefiner = this.vAxisDefiners[0];
          this.targetAxisDefiners = this.hAxisDefiners;
        }
        break;
      default:
        throw new Error('Invalid chart type');
    }
  }

  /**
   * Returns the default domain axis type, based on the dominant serie type.
   *
   * @return See above.
   */
  private getDefaultDomainAxisType(): AxisType {
    if (this.dataView.getColumnType(0) === 'string') {
      const dominantSerieType = this.findDominantSerieType();
      return this.getRecommendedDomainAxisTypeForSerieType(dominantSerieType);
    } else {
      return AxisType.VALUE;
    }
  }

  /**
   * Calculates the dominant serie type. Bars and candlesticks are stronger than
   * area (because in a mixed bars/area chart, we want the domain axis be of
   * type CATEGORY, like for bars), and all are stronger than line (because in a
   * mixed line/area chart, we want the domain axis be of type CATEGORY_POINT,
   * like for area).
   *
   * @return The dominant serie type.
   */
  private findDominantSerieType(): SerieType {
    // The following lines build the serieTypePriorities map, which is actually
    // a constant - its value depends on the code only, and is independent of
    // any runtime parameter.
    const serieTypeHierarchy = [
      // Lower index means lower priority.
      SerieType.LINE,
      SerieType.SCATTER,
      SerieType.AREA,
      SerieType.STEPPED_AREA,
      SerieType.BARS,
      SerieType.CANDLESTICKS,
      SerieType.BOXPLOT,
    ];
    const serieTypePriorities = {};
    serieTypeHierarchy.forEach((serieType, i) => {
      (serieTypePriorities as AnyDuringMigration)[serieType] = i;
    });

    // The following finds the "strongest" (the one with highest priority) serie
    // type of all types used in this chart.
    const highest = this.chartDef.series.reduce(
      (highest, serie) =>
        Math.max(
          highest,
          (serieTypePriorities as AnyDuringMigration)[serie.type],
        ),
      0,
    );

    return serieTypeHierarchy[highest];
  }

  /**
   * Returns the recommended axis type for the specified serie type.
   * This is only used when column 0 is of type 'string'.
   *
   * @param serieType The serie type.
   * @return See above.
   * @suppress {checkTypes}
   */
  private getRecommendedDomainAxisTypeForSerieType(
    serieType: SerieType,
  ): AxisType {
    switch (serieType) {
      case SerieType.AREA:
        // Generally we use CATEGORY_POINT axis type for area charts,
        // except for the degenerate case where there is only one category -
        // then we want this category to be centered.
        return this.chartDef.categories.length > 1
          ? AxisType.CATEGORY_POINT
          : AxisType.CATEGORY;
      case SerieType.LINE:
      case SerieType.SCATTER:
      case SerieType.BARS:
      case SerieType.STEPPED_AREA:
      case SerieType.CANDLESTICKS:
      case SerieType.BOXPLOT:
        return AxisType.CATEGORY;
      default:
        throw new Error(`Invalid serie type "${serieType}"`);
    }
  }

  /**
   * Initializes scales of the two axes, mainly by finding what datatype
   * every axis shows and creates the proper value scale for that axis.
   */
  private initScales() {
    const chartDef = this.chartDef;

    switch (chartDef.chartType) {
      case ChartType.SCATTER:
      case ChartType.BUBBLE:
        if (chartDef.domainDataType === 'string') {
          throw new Error('X values column cannot be of type string');
        }
        const targetDataType = chartDef.targetAxisToDataType![0];
        if (targetDataType === 'string') {
          throw new Error('Data column(s) cannot be of type string');
        }
        const hAxis = this.hAxisDefiners![0];
        const vAxis = this.vAxisDefiners![0];
        if (hAxis.type !== AxisType.VALUE) {
          throw new Error('The x-axis must be of type ' + AxisType.VALUE);
        }
        hAxis.initScale(chartDef.domainDataType);
        if (vAxis.type !== AxisType.VALUE) {
          throw new Error('The y-axis must be of type ' + AxisType.VALUE);
        }
        vAxis.initScale(targetDataType);
        break;
      case ChartType.FUNCTION:
      case ChartType.HISTOGRAM:
        const domainAxis = this.domainAxisDefiner;
        if (chartDef.chartType === ChartType.HISTOGRAM) {
          const explicitTicks = this.dataView.getColumnProperty(
            0,
            'histogramBuckets',
          );
          // Insert domain axis tick option.
          domainAxis!.options.insertLayer(1, {'ticks': explicitTicks});
        }
        if (domainAxis!.type === AxisType.VALUE) {
          if (chartDef.domainDataType === 'string') {
            throw new Error(
              'Domain column cannot be of type string, it should ' +
                'be the X values on a continuous domain axis',
            );
          }
          domainAxis!.initScale(chartDef.domainDataType);
        }

        googObject.forEach(
          this.targetAxisDefiners,
          (axisDefiner, index) => {
            const dataType = chartDef.targetAxisToDataType![index];
            if (dataType === 'string') {
              throw new Error(
                `Data column(s) for axis #${index} cannot be of type string`,
              );
            }
            axisDefiner.initScale(dataType);
          },
          this,
        );
        break;
      default:
        throw new Error('Invalid chart type');
    }
    googObject.forEach(this.hAxisDefiners, (axisDefiner) => {
      axisDefiner.validateHasScale();
    });
    googObject.forEach(this.vAxisDefiners, (axisDefiner) => {
      axisDefiner.validateHasScale();
    });
  }

  /** @return Whether the chart has a left vertical axis. */
  private hasLeftAxis(): boolean {
    return this.vAxisDefiners![0] != null;
  }

  /** @return Whether the chart has a right vertical axis. */
  private hasRightAxis(): boolean {
    return this.vAxisDefiners![1] != null;
  }

  getDefaultLegendPosition(): LegendPosition | null {
    if (
      this.bubbleChartDefiner &&
      this.bubbleChartDefiner.isContinuousColorMode()
    ) {
      return null;
    }
    if (this.hasLeftAxis() && this.hasRightAxis()) {
      return LegendPosition.TOP;
    }
    if (!this.hasRightAxis()) {
      return LegendPosition.RIGHT;
    }
    return LegendPosition.LEFT;
  }

  /** @return See above. */
  getDefaultColorBarPosition(): ColorBarPosition | null {
    return this.bubbleChartDefiner &&
      this.bubbleChartDefiner.isContinuousColorMode()
      ? ColorBarPosition.TOP
      : null;
  }

  /**
   * Returns the index of the first column with data,
   * be it DATA or DIFF_OLD_DATA.
   * This is used to handle diff charts seemingly.
   * @param serie serie definition.
   * @return index of first column with data.
   */
  private getFirstDataColumnIndex(serie: SerieDefinition): number {
    // Returns first column index of DATA columns when they exist.
    const dataColumns = serie.columns[DATA];
    if (dataColumns) {
      return dataColumns[0];
    }
    // Diff mode: returns first column index of DIFF_OLD_DATA.
    const oldDataColumns = serie.columns[DIFF_OLD_DATA];
    assert(oldDataColumns?.length > 0);
    return oldDataColumns[0];
  }

  /**
   * Find the values closest to zero for all value scales for function charts.
   * This is used to be able to map negative values on a log scale.
   */
  private findValuesClosestToZeroFunctionChart() {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;

    for (let i = 0; i < chartDef.categories.length; i++) {
      for (let j = 0; j < chartDef.series.length; j++) {
        const serie = chartDef.series[j];
        const targetAxisIndex = serie.targetAxisIndex;
        const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
        const columnIdx = this.getFirstDataColumnIndex(serie);
        const targetValue = dataView.getValue(i, columnIdx);
        const numericTargetValue =
          targetAxis.valueScale!.valueToUnscaledNumber(targetValue);
        if (numericTargetValue != null) {
          targetAxis.markClosestValueToZero(numericTargetValue);
        }
      }
      if (domainAxis!.type === AxisType.VALUE) {
        const domainValue = dataView.getValue(i, 0);
        const numericDomainValue =
          domainAxis!.valueScale!.valueToUnscaledNumber(domainValue) as number;
        domainAxis!.markClosestValueToZero(numericDomainValue);
      }
    }
  }

  /**
   * Find the values closest to zero for all value scales for scatter charts.
   * This is used to be able to map negative values on a log scale.
   */
  private findValuesClosestToZeroScatter() {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const hAxis = this.hAxisDefiners![0];
    const vAxis = this.vAxisDefiners![0];

    for (let i = 0; i < dataView.getNumberOfRows(); i++) {
      for (let j = 0; j < chartDef.series.length; j++) {
        const serie = chartDef.series[j];
        const domainIndex = serie.domainIndex;
        assert(domainIndex != null);
        const columnIdxX =
          // Suppressing errors for ts-migration.
          //   TS2538: Type 'null' cannot be used as an index type.
          // @ts-ignore
          chartDef.domainsColumnStructure[domainIndex].columns[DOMAIN][0];
        const columnIdxY = this.getFirstDataColumnIndex(serie);
        const xValue = dataView.getValue(i, columnIdxX);
        const yValue = dataView.getValue(i, columnIdxY);
        const xNumeric = hAxis.valueScale!.valueToUnscaledNumber(xValue);
        const yNumeric = vAxis.valueScale!.valueToUnscaledNumber(yValue);
        if (xNumeric != null) {
          hAxis.markClosestValueToZero(xNumeric);
        }
        if (yNumeric != null) {
          vAxis.markClosestValueToZero(yNumeric);
        }
      }
    }
  }

  /**
   * The public function of this class, that does all the work.
   * Called via initSteps(), so return array of functions.
   */
  calcLayout(): InitFunctionList {
    let chartDef: ChartDefinition;

    return [
      () => {
        chartDef = this.getChartDefinition();
      },

      // Among other things, this sets the legend area if the legend is INSIDE
      // and if there is enough space.
      this.calcTopAxisChartAreaLayout.bind(this),

      () => {
        // For stacked and diff charts we always want to include the
        // baseline.
        // TODO(dlaliberte): Why diff chart?  Also, stacked charts could
        // allow non-zero baseline as well. Histogram is treated as stacked.
        if (
          chartDef.stackingType !== StackingType.NONE ||
          chartDef.isDiff ||
          chartDef.chartType === ChartType.HISTOGRAM
        ) {
          googObject.forEach(this.targetAxisDefiners, (targetAxisDefiner) => {
            // TODO(dlaliberte): Probably should use this instead.
            // const numericBaseline = targetAxisDefiner.valueScale.
            //    getNumericBaseline() || 0;
            // Instead, hard-code to include 0, the assumed baseline.
            targetAxisDefiner.extendRangeToIncludeNumber(0);
          });
        }
      },

      () => {
        if (
          chartDef.chartType === ChartType.FUNCTION ||
          chartDef.chartType === ChartType.HISTOGRAM
        ) {
          // The following line is only needed for mirrorLog.
          this.findValuesClosestToZeroFunctionChart();
          if (this.domainAxisDefiner!.type === AxisType.VALUE) {
            this.domainAxisDefiner!.initPreCalculator();
          }
          this.domainAxisDefiner!.initViewWindow();
          googObject.forEach(
            this.targetAxisDefiners,
            (targetAxisDefiner) => {
              targetAxisDefiner.initPreCalculator();
              targetAxisDefiner.initViewWindow();
            },
            this,
          );
        } else {
          const hAxisDefiner = this.hAxisDefiners![0];
          const vAxisDefiner = this.vAxisDefiners![0];
          if (chartDef.chartType === ChartType.BUBBLE) {
            this.bubbleChartDefiner!.findValuesClosestToZero(
              hAxisDefiner,
              // Suppressing errors for ts-migration.
              //   TS2345: Argument of type 'VerticalAxisDefiner' is not assignable to parameter of type 'AxisDefiner'.
              // @ts-ignore
              vAxisDefiner,
            );
          } else if (chartDef.chartType === ChartType.SCATTER) {
            this.findValuesClosestToZeroScatter();
          }
          hAxisDefiner.initPreCalculator();
          hAxisDefiner.initViewWindow();
          vAxisDefiner.initPreCalculator();
          vAxisDefiner.initViewWindow();
        }
      },

      () => {
        // TODO(dlaliberte): Don't assume only global variableWidth option.
        // Should be per-series.
        this.variableWidth =
          this.variableWidth ||
          this.options.inferBooleanValue('bar.variableWidth');
        if (chartDef.chartType === ChartType.HISTOGRAM) {
          // Disable variableWidth for Histogram, as currently implemented.
          this.variableWidth = false;
        }
      },

      () => {
        // Calculate visual elements, while understanding, per axis,
        // the min and max value.
        if (chartDef.serieTypeCount[SerieType.BARS]) {
          this.calcBarLikeLayout(SerieType.BARS);
        }
        if (chartDef.serieTypeCount[SerieType.STEPPED_AREA]) {
          if (this.domainAxisDefiner!.type === AxisType.VALUE) {
            this.variableWidth = true;
          }
          this.calcBarLikeLayout(SerieType.STEPPED_AREA);
        }
        if (chartDef.serieTypeCount[SerieType.CANDLESTICKS]) {
          this.calcCandlesticksLayout();
        }
        if (chartDef.serieTypeCount[SerieType.BOXPLOT]) {
          this.calcBoxplotLayout();
        }
        if (chartDef.serieTypeCount[SerieType.LINE]) {
          this.calcLinesLayout();
          this.calculateControlPoints();
        }
        if (chartDef.serieTypeCount[SerieType.AREA]) {
          this.calcAreaLayout();
        }
        if (chartDef.serieTypeCount[SerieType.SCATTER]) {
          this.calcScatterLayout();
          this.calculateControlPoints();
        }
        if (chartDef.serieTypeCount[SerieType.BUBBLES]) {
          // Being a bubble chart, it can be assumed that there is only one
          // hAxis and only one vAxis.
          assert(this.hAxisDefiners != null && this.hAxisDefiners[0]);
          assert(this.vAxisDefiners != null && this.vAxisDefiners[0]);
          assert(this.bubbleChartDefiner != null);
          this.bubbleChartDefiner!.calcBubblesLayout(
            this.hAxisDefiners![0],
            // Suppressing errors for ts-migration.
            //   TS2345: Argument of type 'VerticalAxisDefiner' is not assignable to parameter of type 'AxisDefiner'.
            // @ts-ignore
            this.vAxisDefiners![0],
            this.colorBarDefiner,
          );
        }
      },

      () => {
        const isHistogram = chartDef.chartType === ChartType.HISTOGRAM;
        const barLike =
          chartDef.serieTypeCount[SerieType.BARS] ||
          chartDef.serieTypeCount[SerieType.CANDLESTICKS] ||
          chartDef.serieTypeCount[SerieType.BOXPLOT];
        const hasIntervals =
          null != chartDef.series.find((serie) => serie.intervals != null);

        if ((barLike && !isHistogram && !this.variableWidth) || hasIntervals) {
          // The following hack must not come before the above Layout is
          // done.
          this.expandMinMaxValuesForBarLikeCharts();
        }
      },

      () => {
        // Among other things, this sets the legend area if the legend is at
        // the BOTTOM and if there is enough space.
        chartDef.hAxes = googObject.map(
          this.hAxisDefiners,
          function (definer) {
            return definer.calcAxisDefinition(
              this.legendDefiner,
              this.colorBarDefiner,
            );
          },
          this,
        );
        chartDef.vAxes = googObject.map(
          this.vAxisDefiners,
          function (definer) {
            return definer.calcAxisDefinition(
              this.legendDefiner,
              this.colorBarDefiner,
            );
          },
          this,
        );

        // Can't calc subdivisions until axes are defined.
        this.calcDivisionDefinition();
      },

      this.calcCategorySensitivityAreas.bind(this),

      // Now that the axes are positioned and calibrated, all non scaled
      // elements can be positioned on the scales.
      this.positionNonScaledElements.bind(this),

      // After all elements are positioned, annotations can be drawn so they
      // overlap elements to the minimum.
      () => {
        const annotationDefiner = new AnnotationDefiner(
          this as AxisChartDefinerInterface,
          this.options,
        );
        annotationDefiner.positionAnnotations();
      },

      () => {
        const legendPosition = this.legendDefiner!.getPosition();
        const sideMargin = this.legendDefiner!.getTextStyle().fontSize;
        let legendArea = null;
        if (
          (legendPosition === LegendPosition.RIGHT ||
            legendPosition === LegendPosition.LABELED) &&
          !this.hasRightAxis()
        ) {
          legendArea = new Box(
            chartDef.chartArea.top,
            chartDef.width - sideMargin,
            chartDef.chartArea.bottom,
            chartDef.chartArea.right + sideMargin,
          );
        }
        if (legendPosition === LegendPosition.LEFT && !this.hasLeftAxis()) {
          legendArea = new Box(
            chartDef.chartArea.top,
            chartDef.chartArea.left - sideMargin,
            chartDef.chartArea.bottom,
            sideMargin,
          );
        }
        if (legendArea && legendArea.right >= legendArea.left) {
          this.legendDefiner!.setArea(legendArea);
        }
      },

      this.resolveTextCollisions.bind(this),

      () => {
        if (!this.bubbleChartDefiner) {
          // Bubble charts define their own legend and don't entirely match
          // up to the model of series that all the other charts have.
          this.initTrendlines(this.dataView);
          this.initLegend();
          this.calcTrendlinesLayout();
        }
      },
    ];
  }

  /**
   * Calculates the layout of elements in the top part of the chart area. This
   * means the title and legend positions, for "labels inside" mode.
   */
  private calcTopAxisChartAreaLayout() {
    const chartDef = this.chartDef;

    const measureFunction = this.textMeasureFunction;
    const titleFontSize = chartDef.title.textStyle.fontSize;
    // The text style for the horizontal axis title must be the same as the text
    // style for the vertical axis title, so we take one of them and apply to
    // both. Put preference to horizontal, but if it's empty then use vertical.
    const axisDefinerValue =
      googObject.getAnyValue(this.hAxisDefiners) ||
      googObject.getAnyValue(this.vAxisDefiners);
    const axisTitleTextStyle = axisDefinerValue!.title.textStyle;
    const axisTitleFontSize = axisTitleTextStyle.fontSize;
    const maxTitleFontSize = Math.max(titleFontSize, axisTitleFontSize);
    const legendFontSize = this.legendDefiner!.getTextStyle().fontSize;
    const legendPosition = this.legendDefiner!.getPosition();
    const colorBarFontSize = this.colorBarDefiner!.getTextStyle().fontSize;
    const colorBarPosition = this.colorBarDefiner!.getPosition();
    const titleText =
      chartDef.titlePosition === InOutPosition.INSIDE
        ? chartDef.title.text
        : '';
    let firstAxisTitleText = '';
    let secondAxisTitleText = '';
    if (chartDef.axisTitlesPosition === InOutPosition.INSIDE) {
      const getJointAxesTitle = (axisDefiners: AnyDuringMigration) => {
        const axisIndices = googObject.getKeys(axisDefiners);
        axisIndices.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
        const titles = axisIndices.map((index) => {
          const axisDefiner = axisDefiners[index];
          return axisDefiner.title.text;
        });
        const nonEmptyTitles = titles.filter((title) => title !== '');
        return nonEmptyTitles.join(', ');
      };

      switch (chartDef.chartType) {
        case ChartType.SCATTER:
        case ChartType.BUBBLE:
          firstAxisTitleText = getJointAxesTitle(this.hAxisDefiners);
          secondAxisTitleText = getJointAxesTitle(this.vAxisDefiners);
          break;
        case ChartType.FUNCTION:
          firstAxisTitleText = getJointAxesTitle({0: this.domainAxisDefiner});
          secondAxisTitleText = getJointAxesTitle(this.targetAxisDefiners);
          break;
        default:
          throw new Error(`Unsupported chart type: ${chartDef.chartType}`);
      }
    }
    let axisTitleText;
    if (firstAxisTitleText && secondAxisTitleText) {
      axisTitleText = `${firstAxisTitleText} / ${secondAxisTitleText}`;
    } else if (firstAxisTitleText) {
      axisTitleText = firstAxisTitleText;
    } else if (secondAxisTitleText) {
      axisTitleText = secondAxisTitleText;
    } else {
      axisTitleText = '';
    }

    const minGap = 2; // No less than 2 pixels distance between lines.
    // The following 2 gaps are optimistic values, assuming we have enough real
    // estate.
    const gapAboveTitle = Math.max(
      minGap,
      Math.round(maxTitleFontSize / GOLDEN_RATIO),
    );
    const gapBesidesTitle = gapAboveTitle;
    const gapAboveLegend = Math.max(
      minGap,
      Math.round(legendFontSize / GOLDEN_RATIO),
    );
    const gapAboveColorBar = Math.max(
      minGap,
      Math.round(colorBarFontSize / GOLDEN_RATIO),
    );

    // Title layout
    const availableTitleWidth = chartDef.chartArea.width - 2 * gapBesidesTitle;
    const titleLayout = textutils.calcTextLayout(
      measureFunction,
      titleText,
      chartDef.title.textStyle,
      availableTitleWidth,
      1,
    );
    const displayedTitle =
      titleLayout.lines.length > 0 ? titleLayout.lines[0] : '';
    const displayedTitleWidth = measureFunction(
      displayedTitle,
      chartDef.title.textStyle,
    ).width;
    const gapBetweenTitles = Math.round(
      Math.max(minGap, maxTitleFontSize * GOLDEN_RATIO),
    );
    const availableAxisTitleWidth = Math.max(
      availableTitleWidth - displayedTitleWidth - gapBetweenTitles,
      0,
    );
    const axisTitleLayout = textutils.calcTextLayout(
      measureFunction,
      axisTitleText,
      axisTitleTextStyle,
      availableAxisTitleWidth,
      1,
    );
    const displayedAxisTitle =
      axisTitleLayout.lines.length > 0 ? axisTitleLayout.lines[0] : '';

    const keyBottomSpace = 'bottom-space';
    const keyTitle = 'title';
    const keyLegend = 'legend';
    const keyColorBar = 'colorBar';

    const items = [];
    // Bottom space. This has highest priority.
    items.push({key: keyBottomSpace, min: minGap, extra: [Infinity]});
    // Title.
    if (displayedTitle || displayedAxisTitle) {
      items.push({
        key: keyTitle,
        min: maxTitleFontSize + minGap,
        extra: [gapAboveTitle - minGap],
      });
    }
    // Legend.
    if (legendPosition === LegendPosition.INSIDE) {
      items.push({
        key: keyLegend,
        min: legendFontSize + minGap,
        extra: [gapAboveLegend - minGap],
      });
    }
    // Color-bar.
    if (colorBarPosition === ColorBarPosition.INSIDE) {
      items.push({
        key: keyColorBar,
        min: this.colorBarDefiner!.getHeight() + minGap,
        extra: [gapAboveColorBar - minGap],
      });
    }

    // The space we allocate for the 'inside' titles/legend is half the height
    // of the chart area. The other half is allocated to the 'inside' axis
    // ticks.
    const availableRealEstate = Math.floor(chartDef.chartArea.height / 2);
    // Calling the real-estate algorithm.
    const allocatedHeights = distributeRealEstateWithKeys(
      items,
      availableRealEstate,
    );

    let y = chartDef.chartArea.top;

    // Calculate title/axis-title layout.
    const actualTitleLines = allocatedHeights[keyTitle] || [];
    if (actualTitleLines.length > 0) {
      y += actualTitleLines[0];
      if (displayedTitle) {
        chartDef.title.lines.push({
          text: displayedTitle,
          x: chartDef.chartArea.left + gapBesidesTitle,
          y,
          length: displayedTitleWidth,
        });
        chartDef.title.tooltip = titleLayout.needTooltip ? titleText : '';
      }
      if (displayedAxisTitle) {
        chartDef.innerAxisTitle = {
          text: axisTitleText,
          textStyle: axisTitleTextStyle,
          boxStyle: null,
          lines: [],
          paralAlign: TextAlign.END,
          perpenAlign: TextAlign.END,
          tooltip: axisTitleLayout.needTooltip ? axisTitleText : '',
          anchor: null,
          angle: 0,
        };

        chartDef.innerAxisTitle.lines.push({
          text: displayedAxisTitle,
          x: chartDef.chartArea.right - gapBesidesTitle,
          y,
          length: availableAxisTitleWidth,
        });
      }
    }

    // Calculate legend layout.
    const actualLegendLines = allocatedHeights[keyLegend] || [];
    if (actualLegendLines.length > 0) {
      y += actualLegendLines[0];
      const legendArea = new Box(
        y - legendFontSize,
        chartDef.chartArea.right,
        y,
        chartDef.chartArea.left,
      );
      this.legendDefiner!.setArea(legendArea);
    }

    // Calculate color-bar layout.
    const actualColorBarLines = allocatedHeights[keyColorBar] || [];
    if (actualColorBarLines.length > 0) {
      y += actualColorBarLines[0];
      const colorBarArea = new Box(
        y - this.colorBarDefiner!.getHeight(),
        chartDef.chartArea.right,
        y,
        chartDef.chartArea.left,
      );
      this.colorBarDefiner!.setArea(colorBarArea);
    }
  }

  /**
   * Calculates the layout of all the series of a bar-like type - bars or
   * stepped area.
   *
   * @param seriesType The type of series to calculate. Can be stepped area or bars.
   */
  private calcBarLikeLayout(seriesType: SerieType) {
    const chartDef = this.chartDef;

    // TODO(dlaliberte): Merge these into calcBars.
    if (chartDef.isDiff) {
      this.calcDiffBars(seriesType);
    } else {
      this.calcBars(seriesType, chartDef.stackingType);
    }
  }

  /**
   * Adjustment for bar-like charts with continuous domain.
   * Extend range to include half the bar width, or bar group width, except
   * for histograms which should extend all the way to the edges in spite of
   * their barness.
   * TODO(dlaliberte) This is actually wrong since it looks at all domain values
   * rather than only those with bar-like column data.
   * Should use {@see calcMinDistanceBetweenBarLikeColumns} instead.
   */
  private expandMinMaxValuesForBarLikeCharts() {
    const domainAxis = this.domainAxisDefiner;
    if (!domainAxis!.valueScale) {
      // Must be discrete axis, so no need to expand the axis.
      return;
    }
    const categories = this.chartDef.categories.filter((category, i) => {
      return this.calcGap(i) !== 0;
    });

    // Compute minimum distance in numeric value (not pixels) between
    // bar like columns.
    let minDistance = Infinity;
    let previousValue: AnyDuringMigration;
    categories.forEach((category) => {
      const dataValue = category.data;
      const numericValue = domainAxis!.valueScale!.valueToNumber(dataValue);
      if (numericValue != null && previousValue != null) {
        // workaround compiler complaint about previousValue not being a number.
        const pv = previousValue || 0;
        const diff = Math.abs(numericValue - pv);
        // Ignore zero difference, which happens due to duplicate domain values.
        // But the calcGap filter above should already filter out duplicates.
        if (diff > 0) {
          minDistance = Math.min(minDistance, diff);
        }
      }
      previousValue = numericValue;
    }, this);
    if (isFinite(minDistance)) {
      const halfBarWidthNumericValue = minDistance / 2;
      domainAxis!.extendRangeToIncludeNumber(
        domainAxis!.valueScale.getNumericMinValue() - halfBarWidthNumericValue,
      );
      domainAxis!.extendRangeToIncludeNumber(
        domainAxis!.valueScale.getNumericMaxValue() + halfBarWidthNumericValue,
      );
    }
  }

  /**
   * For relative stacking, we first have to compute the totals across all
   * series for each category.
   * @param seriesType The type of series to calculate. Can be stepped area or bars.
   */
  private computeTotals(seriesType: SerieType): RelativeTotal[] {
    const chartDef = this.chartDef;
    const allTotals = [];
    for (let i = 0; i < chartDef.categories.length; i++) {
      const totals = {positive: 0, negative: 0};
      allTotals[i] = totals;

      for (let j = 0; j < chartDef.series.length; j++) {
        const serie = chartDef.series[j];
        if (serie.type !== seriesType) {
          continue;
        }

        const targetAxisIndex = serie.targetAxisIndex;
        const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
        const columnIdx = serie.columns[DATA][0];

        const value = this.dataView.getValue(i, columnIdx);
        if (value == null) {
          continue;
        }
        // skip
        // TODO(dlaliberte) Fix this for log scale.
        const numericValue = targetAxis.valueScale!.valueToNumber(value);
        if (numericValue != null) {
          assert(numericValue != null);
          if (numericValue > 0) {
            totals.positive += numericValue;
          } else {
            totals.negative -= numericValue;
          }
        }
      }
    }
    return allTotals;
  }

  /**
   * For relative stacking, we force the target axes to use
   * viewWindowMode: maximized.
   * @param seriesType The type of series.
   */
  private forceSeriesAxesViewWindowModeMaximized(seriesType: SerieType) {
    const chartDef = this.chartDef;
    // Set the viewWindowMode of each series
    for (let j = 0; j < chartDef.series.length; j++) {
      const serie = chartDef.series[j];
      if (serie.type !== seriesType) {
        continue;
      }

      const targetAxisIndex = serie.targetAxisIndex;
      const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
      // Too late to set defaultViewWindowMode.
      targetAxis.viewWindowMode = ViewWindowMode.MAXIMIZED;
    }
  }

  /**
   * Calculates the layout of stacked or side-by-side bars. Takes into account
   * both positive and negative bars. We leave 1px gap between stacked bars and
   * between adjacent side-by-side bars.
   *
   * This method can handle bar charts, column charts, stepped area charts, and
   * histograms.
   *
   * @param seriesType The type of series to calculate. Can be stepped area or bars.
   * @param stackingType Whether to stack and how.
   */
  private calcBars(seriesType: SerieType, stackingType: StackingType) {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;
    const isHistogram = this.chartDef.chartType === ChartType.HISTOGRAM;

    const isVariableWidth = this.variableWidth;

    const isStacked = stackingType !== StackingType.NONE;
    const relativeStacking =
      isStacked && chartDef.stackingType !== StackingType.ABSOLUTE;
    const defaultFormat =
      chartDef.stackingType === StackingType.PERCENT ? '#.##%' : '0.00#';

    if (isHistogram) {
      // See b/12030183.
      //
      // BAD HACK implemented this way due to time
      // pressure. The first argument below should be
      // targetAxis.numericValueToPixelsFactor, but that's
      // calculated in setMinMaxProps, which hasn't been
      // called yet. So here we do our own calculation.  Now,
      // in setMinMaxProps, the calculation is effectively:
      //
      //   this.axisLength / (numericMaxValue - numericMinValue)
      //
      // I don't know how to identify numericMinValue at this point,
      // so am assuming it's zero. It usually will be, but perhaps
      // not always.
      //
      // So look here if:
      //   a) histograms with a lot of points and a flipped
      //      orientation (so that they're like bar charts, not
      //      column charts) wrongly highlight each data value
      //      on hover.
      //   b) histograms with a lot of points and odd axes
      //      wrongly highlight each data value on hover.
      const approxPixelRatio =
        (chartDef.chartArea.height - 1) / this.getLargestStack(isStacked);
      this.chartDef.histogramAsColumnChart = this.treatHistogramAsColumnChart(
        approxPixelRatio,
        this.options.inferBooleanValue('histogram.hideBucketItems'),
      );
    }

    /**
     * For each target axis, we keep two totals, one for positive values
     * and one for negative values.  Which property to use is computed and
     * stored in the index variable below.  Also applies to the
     * accumulatedValues.
     */
    let allTotals: RelativeTotal[] = [];
    if (relativeStacking) {
      allTotals = this.computeTotals(seriesType);
      this.forceSeriesAxesViewWindowModeMaximized(seriesType);
    }

    let previousNumericDomainValue: AnyDuringMigration = null;
    let numericDomainValue = domainAxis!.valueScale
      ? domainAxis!.valueScale.getNumericBaseline()
      : null;
    if (isVariableWidth) {
      domainAxis!.extendRangeToIncludeNumber(numericDomainValue);
    }

    for (let i = 0; i < chartDef.categories.length; i++) {
      const isCollapsed = this.calcGap(i) === 0;

      const accumulatedValues = googObject.map(this.targetAxisDefiners, () => ({
        positive: 0,
        negative: 0,
      }));
      // This is incremented on each iteration of the for loop, for each series
      // that is of seriesType. This is to fix b/12567524 so that now we don't
      // assume that all the bars will be consecutive series. It has to be
      // initialized to -1 because it is incremented at the beginning of the
      // loop.
      let correctedSeriesIndex = -1;

      if (numericDomainValue != null) {
        // Ignore null domain values.
        previousNumericDomainValue = numericDomainValue;
      }
      numericDomainValue = this.getNumericDomainValue(i);
      // We have to extend the domainAxis now in order to determine
      // whether the target axis should be extended.
      domainAxis!.extendRangeToIncludeNumber(numericDomainValue);
      const shouldExtendTargetAxisRange =
        domainAxis!.isValueInViewWindow(numericDomainValue);

      for (let j = 0; j < chartDef.series.length; j++) {
        const serie = chartDef.series[j];
        if (serie.type !== seriesType) {
          continue;
        }
        correctedSeriesIndex++;
        if (!isStacked) {
          // reset -- this makes un-stacked histograms work right.
          accumulatedValues[serie.targetAxisIndex] = {
            positive: 0,
            negative: 0,
          };
        }

        const points = serie.points;
        if (isCollapsed) {
          // Don't draw bars right after a gap of size 0 - they have the same
          // domain position as the bar group before that gap.
          points.push(null);
          continue;
        }

        const targetAxisIndex = serie.targetAxisIndex;
        const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
        const targetAxisIsLogScale = targetAxis.isLogScale();
        const columnIdx = serie.columns[DATA][0];
        const value = dataView.getValue(i, columnIdx);
        // Converting values with valueToNumber is necessary
        // for non-numeric values, but it is wrong for log scale,
        // particularly when stacking.  We have to first stack in value space,
        // then convert to numerics.
        const numericValue = targetAxisIsLogScale
          ? value
          : targetAxis.valueScale!.valueToNumber(value);

        let formatter: AnyDuringMigration;
        if (relativeStacking) {
          targetAxis.valueScale!.setDefaultFormat(defaultFormat);
          formatter = targetAxis.valueScale!.getFormatter();
        }

        const isPositive = Number(numericValue) >= 0;
        const accumulated = accumulatedValues[targetAxisIndex];

        if (!isStacked) {
          this.allocateSubdivisions(correctedSeriesIndex + 1);
        }

        const getTotal = (total: RelativeTotal) => {
          return isPositive ? total.positive : total.negative;
        };
        const setTotal = (total: RelativeTotal, value: number) => {
          if (isPositive) {
            total.positive = value;
          } else {
            total.negative = value;
          }
        };

        // For relative stacking, we scale values based on positive
        // or negative total.  For non-relative stacking, scale is 1.
        const scale = (allTotals[i] && getTotal(allTotals[i])) || 1;
        const scalingFunc = (value: AnyDuringMigration) => {
          if (value == null) {
            return null;
          }
          return value / scale;
        };

        // Adds a new point for the current series, with height of val.
        // For regular series, we'll do this just once using the real value.
        // For histograms, each item in the table represents a count of how many
        // items in the original data are in this particular bucket. So we add
        // n points where n is the item's value, each with a value of 1,
        // to represent the counted-up items separately.
        const addAndAccumulate = (
          val: Value | null,
          subdivision: AnyDuringMigration,
          fromVal: AnyDuringMigration,
        ) => {
          let toVal = null;

          if (typeof val === 'number' && !isNaN(val)) {
            toVal =
              val + (isStacked || isHistogram ? getTotal(accumulated) : 0);
          }
          if (relativeStacking) {
            toVal = scalingFunc(toVal);
            fromVal = scalingFunc(fromVal);
          }
          // Convert from value to number for logscale.
          if (targetAxisIsLogScale) {
            toVal = targetAxis.valueScale!.valueToNumber(toVal);
            fromVal = targetAxis.valueScale!.valueToNumber(fromVal);
          }
          if (shouldExtendTargetAxisRange) {
            targetAxis.extendRangeToIncludeNumber(toVal);
          }
          let intervals;
          if (val != null) {
            // Only compute intervals if there is a place for them.
            intervals = this.calcIntervalsLayout(
              serie,
              i,
              getTotal(accumulated),
              // Suppressing errors for ts-migration.
              //   TS2345: Argument of type '(value: AnyDuringMigration) => number | null' is not assignable to parameter of type '(p1: number) => number'.
              // @ts-ignore
              scalingFunc,
              true,
            );
          }
          const point = {
            nonScaled: {
              division: i,
              subdivision,
              from: fromVal,
              to: toVal,
              dPrevious: previousNumericDomainValue,
              d: numericDomainValue,
              intervalMarks: intervals,
            },
          } as unknown as DatumDefinition;
          if (val == null) {
            point.isNull = true;
          }
          if (serie.type === SerieType.STEPPED_AREA) {
            const len = points.length;
            point.nonScaled.previousTo =
              len === 0 || points[len - 1] == null
                ? null
                : points[len - 1]!.nonScaled.to;
          }
          this.addCommonPointProperties(point, serie, j, i);
          if (relativeStacking && point.tooltipText) {
            // Change tooltip to show both content and relative value.
            const relativeVal = toVal! - fromVal;
            point.tooltipText.content = `${
              point.tooltipText.content
            } (${formatter.formatValue(relativeVal)})`;
          }
          points.push(point);
          if (typeof val === 'number' && !isNaN(val)) {
            setTotal(accumulated, getTotal(accumulated) + val);
          }
        }; // end of addAndAccumulate

        const subdivision = isStacked ? 0 : correctedSeriesIndex;
        let from = isStacked || isHistogram ? getTotal(accumulated) : null;

        if (isHistogram && !this.chartDef.histogramAsColumnChart) {
          // Create many separate bar segments for histogram.
          for (let p = 0; p < Number(numericValue); p++) {
            from = isStacked || isHistogram ? getTotal(accumulated) : null;
            addAndAccumulate(1, subdivision, from);
          }
        } else {
          addAndAccumulate(numericValue, subdivision, from);
        }
      }
    }
    if (!isStacked) {
      // Ensure we don't have any columns with zero length.
      googObject.forEach(this.targetAxisDefiners, (targetAxisDefiner) => {
        targetAxisDefiner.expandRangeABit();
      });
    }
  }

  /**
   * Calculates the layout of bars used for diff of datatables. Takes into
   * account both positive and negative bars.
   *
   * @param seriesType The type of series to calculate. Can be stepped area or bars.
   */
  private calcDiffBars(seriesType: SerieType) {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;

    const plottedSeries = chartDef.series.filter(
      (serie) => serie.type === seriesType,
    );

    // Loop through, adding all the data points and extending the target axis as
    // needed.
    for (let catIndex = 0; catIndex < chartDef.categories.length; ++catIndex) {
      const isCollapsed = this.calcGap(catIndex) === 0;
      const numericDomainValue = this.getNumericDomainValue(catIndex);
      domainAxis!.extendRangeToIncludeNumber(numericDomainValue);
      const shouldExtendTargetAxisRange =
        domainAxis!.isValueInViewWindow(numericDomainValue);

      // Handles columns with specific roles to create series accordingly.
      const rolesToHandle = [DIFF_OLD_DATA, DATA];

      for (
        let serieIndex = 0;
        serieIndex < plottedSeries.length;
        ++serieIndex
      ) {
        const serie = plottedSeries[serieIndex];
        if (isCollapsed) {
          // Don't draw bars right after a gap of size 0 - they have the same
          // domain position as the bar group before that gap.
          serie.points.push(null);
          return;
        }
        const targetAxisIndex = serie.targetAxisIndex;
        const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
        const valueScale = targetAxis.valueScale;

        for (let roleIndex = 0; roleIndex < rolesToHandle.length; ++roleIndex) {
          const role = rolesToHandle[roleIndex];
          const columnIdx = serie.columns[role][0];
          const value = dataView.getValue(catIndex, columnIdx);
          const numericValue = valueScale!.valueToNumber(value);
          if (numericValue === null) {
            serie.points.push(null);
            return;
          }

          if (shouldExtendTargetAxisRange) {
            targetAxis.extendRangeToIncludeNumber(numericValue);
          }

          this.allocateSubdivisions(serieIndex + 1);

          // The baseline is calculated later and the bar will be scaled to
          // start from it.
          const point = {
            brush: this.getDiffBarBrush(serie, role),
            nonScaled: {
              division: catIndex,
              subdivision: serieIndex,
              from: null,
              to: numericValue,
              d: numericDomainValue,
              isDiffForeground: role === DATA,
              intervalMarks: this.calcIntervalsLayout(
                serie,
                catIndex,
                0,
                null,
                true,
              ),
            },
          } as unknown as DatumDefinition;
          this.addCommonPointProperties(point, serie, serieIndex, catIndex);
          serie.points.push(point);
        }
        // for each role
      }
      // for each serie
    }
    // for each category
    // Ensure we don't have any columns with zero length.
    googObject.forEach(this.targetAxisDefiners, (targetAxisDefiner) => {
      targetAxisDefiner.expandRangeABit();
    });
  }

  /** Calculates the layout of the candlesticks graph. */
  private calcCandlesticksLayout() {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;

    const plottedSeries = chartDef.series.filter(
      (serie) => serie.type === SerieType.CANDLESTICKS,
    );
    chartDef.categories.forEach((category, i) => {
      const isCollapsed = this.calcGap(i) === 0;
      plottedSeries.forEach((serie, j) => {
        if (isCollapsed) {
          // Don't draw candlesticks right after a gap of size 0 - they have the
          // same domain position as the bar group before that gap.
          serie.points.push(null);
          return;
        }
        const dataColumns = serie.columns[DATA];
        const targetAxisIndex = serie.targetAxisIndex;
        const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
        this.allocateSubdivisions(j + 1);

        const minValue = dataView.getValue(i, dataColumns[0]);
        const openValue = dataView.getValue(i, dataColumns[1]);
        const closeValue = dataView.getValue(i, dataColumns[2]);
        const maxValue = dataView.getValue(i, dataColumns[3]);

        const numericMinValue = targetAxis.valueScale!.valueToNumber(minValue);
        const numericOpenValue =
          targetAxis.valueScale!.valueToNumber(openValue);
        const numericCloseValue =
          targetAxis.valueScale!.valueToNumber(closeValue);
        const numericMaxValue = targetAxis.valueScale!.valueToNumber(maxValue);

        if (
          numericMinValue === null ||
          numericMaxValue === null ||
          numericOpenValue === null ||
          numericCloseValue === null
        ) {
          // Need all 4 points to build this, so skip it if we can't get any
          // one.
          serie.points.push(null);
          return;
        }

        const numericDomainValue = this.getNumericDomainValue(i);
        domainAxis!.extendRangeToIncludeNumber(numericDomainValue);

        const inverted = numericCloseValue < numericOpenValue;
        const shouldExtendTargetAxisRange =
          domainAxis!.isValueInViewWindow(numericDomainValue);
        if (shouldExtendTargetAxisRange) {
          // For waterfall charts, the min and max may be set to the same
          // value in order to hide the stick (line) part of the candle
          // so we use min and max fx's to find the actual min and max
          targetAxis.extendRangeToIncludeNumber(
            Math.min(
              numericMinValue,
              numericOpenValue,
              numericCloseValue,
              numericMaxValue,
            ),
          );
          targetAxis.extendRangeToIncludeNumber(
            Math.max(
              numericMinValue,
              numericOpenValue,
              numericCloseValue,
              numericMaxValue,
            ),
          );
        }

        const barBrush = this.getCandleStickBrush(inverted, serie);
        const point = {
          barBrush,
          lineBrush: Brush.createFillBrush(serie.color!.color),
          nonScaled: {
            division: i,
            subdivision: j,
            lineFrom: numericMinValue,
            lineTo: numericMaxValue,
            rectFrom: inverted ? numericCloseValue : numericOpenValue,
            rectTo: inverted ? numericOpenValue : numericCloseValue,
            inverted,
            d: numericDomainValue,
          },
        } as unknown as DatumDefinition;
        this.addCommonPointProperties(point, serie, j, i);
        serie.points.push(point);
      });
    });
  }

  /** Calculates the layout of the boxplot graph. */
  private calcBoxplotLayout() {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;

    const plottedSeries = chartDef.series.filter(
      (serie) => serie.type === SerieType.BOXPLOT,
    );
    chartDef.categories.forEach((category, i) => {
      const isCollapsed = this.calcGap(i) === 0;
      plottedSeries.forEach((serie, j) => {
        if (isCollapsed) {
          // Don't draw boxplots right after a gap of size 0 - they have the
          // same domain position as the bar group before that gap.
          serie.points.push(null);
          return;
        }
        const dataColumns = serie.columns[DATA];
        const targetAxisIndex = serie.targetAxisIndex;
        const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
        this.allocateSubdivisions(j + 1);

        const minValue = dataView.getValue(i, dataColumns[0]);
        const openValue = dataView.getValue(i, dataColumns[1]);
        const midValue = dataView.getValue(i, dataColumns[2]);
        const closeValue = dataView.getValue(i, dataColumns[3]);
        const maxValue = dataView.getValue(i, dataColumns[4]);

        const numericMinValue = targetAxis.valueScale!.valueToNumber(minValue);
        const numericOpenValue =
          targetAxis.valueScale!.valueToNumber(openValue);
        const numericMidValue = targetAxis.valueScale!.valueToNumber(midValue);
        const numericCloseValue =
          targetAxis.valueScale!.valueToNumber(closeValue);
        const numericMaxValue = targetAxis.valueScale!.valueToNumber(maxValue);

        if (
          numericMinValue === null ||
          numericMaxValue === null ||
          numericOpenValue === null ||
          numericCloseValue === null ||
          numericMidValue == null
        ) {
          // Need all 5 points to build this, so skip it if we can't get any
          // one.
          serie.points.push(null);
          return;
        }

        const numericDomainValue = this.getNumericDomainValue(i);
        domainAxis!.extendRangeToIncludeNumber(numericDomainValue);

        const inverted = numericCloseValue < numericOpenValue;
        const shouldExtendTargetAxisRange =
          domainAxis!.isValueInViewWindow(numericDomainValue);
        if (shouldExtendTargetAxisRange) {
          targetAxis.extendRangeToIncludeNumber(numericMinValue);
          targetAxis.extendRangeToIncludeNumber(numericMaxValue);
        }

        const barBrush = this.getBoxplotBrush(serie);
        const point = {
          barBrush,
          lineBrush: Brush.createFillBrush(serie.color!.color),
          nonScaled: {
            division: i,
            subdivision: j,
            lineFrom: numericMinValue,
            lineTo: numericMaxValue,
            rectFrom: inverted ? numericCloseValue : numericOpenValue,
            rectTo: inverted ? numericOpenValue : numericCloseValue,
            rectMiddleLine: numericMidValue,
            inverted,
            d: numericDomainValue,
          },
        } as unknown as DatumDefinition;
        this.addCommonPointProperties(point, serie, j, i);
        serie.points.push(point);
      });
    });
  }

  /**
   * Calculates the layout of a single line series on the chart, as given by the
   * serieIndex. For each data point we calculate the (x,y) position of that
   * point, plus the positions of any interval markers around the point.
   * @param serieIndex The index of the series whose layout should be calculated.
   */
  private calcLineSerieLayout(serieIndex: number) {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;
    const serie = chartDef.series[serieIndex];
    if (serie.type !== SerieType.LINE) {
      return;
    }
    let numericDomainValue;

    const serieCategories = serie.isVirtual ? serie.data : chartDef.categories;
    for (let i = 0; i < serieCategories!.length; i++) {
      const targetAxisIndex = serie.targetAxisIndex;
      const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
      const columnIdx = serie.columns[DATA][0];
      const targetValue = serie.isVirtual
        ? serie.data![i][1]
        : dataView.getValue(i, columnIdx);
      const numericTargetValue =
        targetAxis.valueScale!.valueToNumber(targetValue);

      let shouldExtendTargetAxisRange;
      let intervalMarks;
      if (numericTargetValue != null) {
        numericDomainValue = this.getNumericDomainValue(i, serie);
        domainAxis!.extendRangeToIncludeNumber(numericDomainValue);

        shouldExtendTargetAxisRange =
          domainAxis!.isValueInViewWindow(numericDomainValue) &&
          !serie.isVirtual;
        if (shouldExtendTargetAxisRange) {
          // If the point is within the domain visible range, extend the
          // target axis to accommodate this point.
          targetAxis.extendRangeToIncludeNumber(numericTargetValue);
        }
        intervalMarks = serie.isVirtual
          ? null
          : this.calcIntervalsLayout(
              serie,
              i,
              0,
              null,
              shouldExtendTargetAxisRange,
            );
      } else {
        shouldExtendTargetAxisRange = false;
        intervalMarks = null;
      }

      const point = {
        nonScaled: {
          division: i,
          subdivision: 0,
          d: numericDomainValue,
          t: numericTargetValue,
          intervalMarks,
        },
        shape: serie.pointShape,
        shouldExtendTargetAxisRange,
      } as unknown as DatumDefinition;

      // If data is null, mark point as null
      if (numericTargetValue == null) {
        point.isNull = true;
      }

      this.addCommonPointProperties(point, serie, serieIndex, i);
      serie.points.push(point);
    }
  }

  /** Calculates the layout of all the line series in the chart. */
  private calcLinesLayout() {
    const chartDef = this.chartDef;
    for (let j = 0; j < chartDef.series.length; j++) {
      this.calcLineSerieLayout(j);
    }
    this.extendToIncludeLineValuesAtViewWindow();

    this.adjustLineBrushProperties();
  }

  /**
   * For every view window, extend the other axis to include the value where the
   * view window cuts the line.
   */
  private extendToIncludeLineValuesAtViewWindow() {
    const domainAxis = this.domainAxisDefiner;
    const series = this.chartDef.series;
    for (let i = 0; i < series.length; i++) {
      const serie = series[i];
      // TODO(dlaliberte): Also support SCATTER series. This requires more complex
      // handling as there may be several places where the view window cuts the
      // line instead of just one, and we are interested in the minimum and
      // maximum out of these.
      if (serie.type !== SerieType.LINE && serie.type !== SerieType.AREA) {
        continue;
      }
      if (serie.lineWidth === 0) {
        continue;
      }
      const targetAxis = this.getTargetAxisDefiner(serie.targetAxisIndex);
      const points = serie.points.map((point) =>
        isDatumNull(point)
          ? null
          : new Coordinate(point!.nonScaled.d, point!.nonScaled.t),
      );
      const interpolateNulls = this.chartDef.interpolateNulls;
      // TODO(dlaliberte): Linear interpolation is an inaccurate estimate for curved
      // lines, but it is still better than no estimate at all.

      const valueAtDomainMin = piecewiseLinearInterpolation(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '(Coordinate | null)[]' is not assignable to parameter of type 'Coordinate[]'.
        // @ts-ignore
        points,
        domainAxis!.getMinNumericValue(),
        interpolateNulls,
      );
      const valueAtDomainMax = piecewiseLinearInterpolation(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '(Coordinate | null)[]' is not assignable to parameter of type 'Coordinate[]'.
        // @ts-ignore
        points,
        domainAxis!.getMaxNumericValue(),
        interpolateNulls,
      );
      targetAxis.extendRangeToIncludeNumber(valueAtDomainMin);
      targetAxis.extendRangeToIncludeNumber(valueAtDomainMax);
    }
  }

  /**
   * Calculates the layout of all the area series in the chart. For each data
   * point we calculate the (x,y) position of the point, and a set of (x,y)
   * positions that define the area polygon.
   * The following values (assigned to each value point) are used to specify the
   * layout for the area polygon and the serie line:
   * continueTo - The point where the line from the previous value should
   * connect to. continueFrom - The point where the line to the next value
   * should start from. bottomTo/From - Same as a continueTo/From for the bottom
   * part of the polygon.
   */
  private calcAreaLayout() {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;
    const interpolateNulls = chartDef.interpolateNulls;
    const seriesType = SerieType.AREA;

    const isStacked = chartDef.stackingType !== StackingType.NONE;
    const relativeStacking =
      isStacked && chartDef.stackingType !== StackingType.ABSOLUTE;
    const defaultFormat =
      chartDef.stackingType === StackingType.PERCENT ? '#.##%' : '0.00#';

    // For relative stacking, we first have to compute the totals across all
    // series for each category.  Same as for bars, except without negatives.
    let allTotals: RelativeTotal[] = [];
    if (relativeStacking) {
      allTotals = this.computeTotals(seriesType);
      this.forceSeriesAxesViewWindowModeMaximized(seriesType);
    }

    for (let i = 0; i < chartDef.categories.length; i++) {
      // For stacking, we accumulate total values for each target axis.
      const accumulatedValue = googObject.map(this.targetAxisDefiners, () => 0);

      // For relative stacking, scale values based on total.
      // For non-relative stacking, scale is 1.
      const scale =
        (allTotals[i] && allTotals[i].positive + allTotals[i].negative) || 1;
      const scalingFunc = (value: AnyDuringMigration) => {
        if (value == null) {
          return null;
        }
        return value / scale;
      };

      // Each segment of the area chart will be drawn with a trapezoid
      // where left and right sides are vertical.  For each category,
      // we iterate through all the series, adding points which will be joined
      // in either left to right or right to left ordering.
      // (Note: From and To might be swapped here.)
      //
      //   continueFrom        continueTo
      //       --------->+<-------
      //                 |
      //       --------->+<-------
      //     bottomTo         bottomFrom
      //
      // For non-stacked, the continue value is set to value, unless null.
      // For stacked, initial continue is the baseline, and updated to the
      // accumulated total.  null is interpreted as the baseline value.
      let continueTo = null;
      let continueFrom = null;

      // For each category, iterate through all series.
      for (let j = 0; j < chartDef.series.length; j++) {
        const serie = chartDef.series[j];
        if (serie.type !== SerieType.AREA) {
          continue;
        }

        const targetAxisIndex = serie.targetAxisIndex;
        const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);

        // For non-stacked, the bottom stays at the baseline.
        // For stacked, initial bottom is the baseline, and updated to the
        // continue values.  null is interpreted as the baseline value.
        let bottomTo = null;
        let bottomFrom = null;

        const columnIdx = serie.columns[DATA][0];
        const targetValue = dataView.getValue(i, columnIdx);
        // Converting values with valueToNumber is necessary
        // for non-numeric values, but it is wrong for log scale,
        // particularly when stacking.
        // Let's do it unscaled instead.
        let numericTargetValue =
          targetAxis.valueScale!.valueToUnscaledNumber(targetValue);

        const thisValueNull =
          numericTargetValue == null || isNaN(numericTargetValue);
        if (thisValueNull) {
          numericTargetValue = 0;
          // TODO(dlaliberte): Support (isStacked && interpolateNulls)
          // We will need to properly interpolate between non-null values.
        }
        const numericDomainValue = this.getNumericDomainValue(i);
        if (numericDomainValue == null) {
          continue; // We can't process this category.
        }

        let formatter;
        if (relativeStacking) {
          targetAxis.valueScale!.setDefaultFormat(defaultFormat);
          // TODO(dlaliberte) This fails for date or time values,
          // since the valuescale has not been 'calibrated' yet.
          formatter = targetAxis.valueScale!.getFormatter();
        }

        let nonScaledPoint;
        let shouldExtendTargetAxisRange;

        // Variable 'val' simply holds the current numeric target value for
        // non-stacked chart, and the accumulated numeric value for stacked
        // chart.
        let val;

        // Check whether previous row value is null or NaN.
        const prevValue = i > 0 ? dataView.getValue(i - 1, columnIdx) : null;
        const prevValueNull =
          // TODO(dlaliberte): Logic below would make more sense as:
          // (prevValue === null || !isNaN(prevValue)).
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          i === 0 || (prevValue === null && !isNaN(prevValue));

        // Check whether next row value is null or NaN.
        const nextValue =
          i < dataView.getNumberOfRows() - 1
            ? dataView.getValue(i + 1, columnIdx)
            : null;
        const nextValueNull =
          i === dataView.getNumberOfRows() - 1 ||
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          (nextValue === null && !isNaN(nextValue));

        if (isStacked) {
          val = accumulatedValue[targetAxisIndex];
          if (!thisValueNull) {
            val += numericTargetValue!;
          }

          // Bottoms always move up to previous continues, opposite direction.
          bottomTo = continueFrom;
          bottomFrom = continueTo;

          // Continue values are updated to accumulated value, if current value
          // and corresponding next or prev values are non-null.
          if (!thisValueNull) {
            if (!nextValueNull) {
              continueFrom = val;
            }
            if (!prevValueNull) {
              continueTo = val;
            }
          }
        } else {
          val = numericTargetValue;
          continueFrom = continueTo = val;
          if (!interpolateNulls) {
            if (nextValueNull) {
              continueFrom = null;
            }
            if (prevValueNull) {
              continueTo = null;
            }
          }
        }

        domainAxis!.extendRangeToIncludeNumber(numericDomainValue);

        shouldExtendTargetAxisRange =
          domainAxis!.isValueInViewWindow(numericDomainValue);

        val = scalingFunc(val);
        continueTo = scalingFunc(continueTo);
        continueFrom = scalingFunc(continueFrom);

        if (shouldExtendTargetAxisRange && !thisValueNull) {
          // If the point is within the domain visible range, extend the
          // target axis to accommodate this point.
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          const scaledVal = targetAxis.valueScale!.scaleNumericValue(val);
          // This method requires scaled values.
          targetAxis.extendRangeToIncludeNumber(scaledVal);
        }

        const intervalMarks = this.calcIntervalsLayout(
          serie,
          i,
          accumulatedValue[targetAxisIndex],
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type '(value: AnyDuringMigration) => number | null' is not assignable to parameter of type '(p1: number) => number'.
          // @ts-ignore
          scalingFunc,
          shouldExtendTargetAxisRange,
        );

        if (isStacked && !thisValueNull) {
          accumulatedValue[targetAxisIndex] += numericTargetValue!;
        }

        // Says nonScaledPoint, but actually, values are scaled.
        nonScaledPoint = {
          d: numericDomainValue,
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          t: targetAxis.valueScale!.scaleNumericValue(val),
          division: i,
          subdivision: 0,
          continueToD: numericDomainValue,
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          continueToT: targetAxis.valueScale!.scaleNumericValue(continueTo),
          continueFromD: numericDomainValue,
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          continueFromT: targetAxis.valueScale!.scaleNumericValue(continueFrom),
          bottomToD: numericDomainValue,
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          bottomToT: targetAxis.valueScale!.scaleNumericValue(bottomTo),
          bottomFromD: numericDomainValue,
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          bottomFromT: targetAxis.valueScale!.scaleNumericValue(bottomFrom),
          intervalMarks,
        };

        const point = {
          nonScaled: nonScaledPoint,
          shape: serie.pointShape,
          shouldExtendTargetAxisRange,
        } as unknown as DatumDefinition;
        // If data is null, mark point as null
        point.isNull = thisValueNull;

        if (!thisValueNull) {
          this.addCommonPointProperties(point, serie, j, i);
          if (relativeStacking && point.tooltipText) {
            // Fix tooltip to show both content and relative value.
            const relativeVal = scalingFunc(numericTargetValue);
            point.tooltipText.content = `${
              point.tooltipText.content
            } (${formatter!.formatValue(relativeVal)})`;
          }
        }

        serie.points.push(point);
      }
    }
    this.extendToIncludeLineValuesAtViewWindow();

    this.adjustLineBrushProperties();
  }

  /**
   * Calculates the layout of all the trendlines that have been calculated for
   * this chart.
   */
  calcTrendlinesLayout() {
    const chartDef = this.chartDef;
    chartDef.series.forEach((serie, i) => {
      if (serie.isVirtual) {
        if (serie.type === SerieType.SCATTER) {
          this.calcScatterSerieLayout(i);
        } else if (serie.type === SerieType.LINE) {
          this.calcLineSerieLayout(i);
        }
        this.positionNonScaledElementsForSerie(i);
      }
    });
  }

  /**
   * Calculates the layout of a single scatter series in the chart. For each
   * data point we calculate the (x,y) position.
   * @param serieIndex The index of the scatter series whose layout should be calculated.
   */
  private calcScatterSerieLayout(serieIndex: number) {
    const chartDef = this.chartDef;
    const dataView = this.dataView;

    const hAxis = this.hAxisDefiners![0];
    const vAxis = this.vAxisDefiners![0];

    const serie = chartDef.series[serieIndex];
    const domainIndex = serie.domainIndex;
    assert(domainIndex != null);
    if (serie.type !== SerieType.SCATTER) {
      return;
    }
    const dataLength = serie.isVirtual
      ? serie.data!.length
      : dataView.getNumberOfRows();
    for (let i = 0; i < dataLength; i++) {
      const columnIdxX =
        // Suppressing errors for ts-migration.
        //   TS2538: Type 'null' cannot be used as an index type.
        // @ts-ignore
        chartDef.domainsColumnStructure[domainIndex].columns[DOMAIN][0];
      const columnIdxY = this.getFirstDataColumnIndex(serie);
      const xValue = serie.isVirtual
        ? serie.data![i][0]
        : dataView.getValue(i, columnIdxX);
      const yValue = serie.isVirtual
        ? serie.data![i][1]
        : dataView.getValue(i, columnIdxY);
      const xNumeric = hAxis.valueScale!.valueToNumber(xValue);
      const yNumeric = vAxis.valueScale!.valueToNumber(yValue);
      if (xNumeric !== null && yNumeric !== null) {
        const shouldExtendAxesRange =
          hAxis.isValueInViewWindow(xNumeric) &&
          vAxis.isValueInViewWindow(yNumeric);
        if (shouldExtendAxesRange && !serie.isVirtual) {
          hAxis.extendRangeToIncludeNumber(xNumeric);
          vAxis.extendRangeToIncludeNumber(yNumeric);
        }
        const point = {
          nonScaled: {x: xNumeric, y: yNumeric},
          shape: serie.pointShape,
          shouldExtendAxesRange,
        } as unknown as DatumDefinition;
        this.addCommonPointProperties(point, serie, serieIndex, i);
        serie.points.push(point);
      } else {
        serie.points.push(null);
      }
    }
  }

  /** Calculates the layout of all the scatter series in the chart. */
  private calcScatterLayout() {
    const chartDef = this.chartDef;

    for (let j = 0; j < chartDef.series.length; j++) {
      this.calcScatterSerieLayout(j);
    }

    this.adjustLineBrushProperties();
  }

  /**
   * Adjust the brushes of lines that have special properties such as
   * uncertainty, emphasis, out-of-scope and gaps. Their visual effect are
   * dashing, thicker lines, graying out and removal (correspondingly). A line
   * segment is certain/emphasized/in-scope only if *both* its end-points are
   * so.
   */
  private adjustLineBrushProperties() {
    const isNotNull = (point: DatumDefinition | null) => !isDatumNull(point);

    const getProperties = (point: DatumDefinition) => {
      const division =
        point.nonScaled != null ? point.nonScaled.division : null;
      return {
        certainty: point.certainty != null ? point.certainty : 1,
        emphasis: point.emphasis != null ? point.emphasis : 1,
        scope: point.scope != null ? point.scope : true,
        gap: division != null ? this.calcGap(division) : null,
      };
    };

    for (let s = 0; s < this.chartDef.series.length; s++) {
      const serie = this.chartDef.series[s];
      const areaBrush = serie.areaBrush;

      // Performance: ignore a serie if it does not have certainty, scope,
      // emphasis or gap information.
      const certaintyCols = serie.columns[CERTAINTY] || [];
      const emphasisCols = serie.columns[EMPHASIS] || [];
      const scopeCols = serie.columns[SCOPE] || [];

      if (
        certaintyCols.length === 0 &&
        emphasisCols.length === 0 &&
        scopeCols.length === 0
      ) {
        continue;
      }

      // Initialize the properties according to the last non-null point of the
      // serie, because it precedes the first point for closed series.
      let prevPoint = googArray.findRight(serie.points, isNotNull);
      let prevProperties = getProperties(prevPoint || ({} as DatumDefinition));

      // Calculate the incoming line brush for each point in the serie.
      for (let p = 0; p < serie.points.length; p++) {
        let point = serie.points[p]!;
        if (isNotNull(point)) {
          point = point!;
          const properties = getProperties(point!);
          let lineBrush = serie.lineBrush;

          // A line is considered out-of-scope only if both its end-points are
          // out-of-scope. For out-of-scope, we gray out the colors of the
          // brush. NOTE: Gray-out must be done before any other brush
          // manipulation, or else preceding manipulations will be lost. That's
          // because we're using a single grayLineBrush per serie, to improve
          // performance.
          if (!properties.scope && !prevProperties.scope) {
            serie.grayLineBrush = serie.grayLineBrush || lineBrush!.grayOut();
            lineBrush = serie.grayLineBrush;
            point.incomingLineBrush = lineBrush;
            if (areaBrush) {
              serie.grayAreaBrush = serie.grayAreaBrush || areaBrush.grayOut();
              point.incomingAreaBrush = serie.grayAreaBrush;
            }
          }

          // The line is uncertain if any of its end-points is uncertain.
          if (properties.certainty < 1 || prevProperties.certainty < 1) {
            // Make the incoming line brush dashed.
            lineBrush = this.createUncertainBrush(
              (point.incomingLineBrush || lineBrush)!,
              false,
            );
            point.incomingLineBrush = lineBrush;
          }

          // The line is emphasized if both its end-points are emphasized,
          // and we use the smaller emphasis between the two.
          if (properties.emphasis !== 1 && prevProperties.emphasis !== 1) {
            const actualEmphasis = Math.min(
              prevProperties.emphasis,
              properties.emphasis,
            );
            lineBrush = this.createEmphasizedBrush(
              (point.incomingLineBrush || lineBrush)!,
              actualEmphasis,
            );
            point.incomingLineBrush = lineBrush;
          }

          // If the point is right after a fully collapsed gap, don't draw a
          // line to it, unless the point before the gap is a null point (then
          // it will depend on whether interpolateNulls is true or not).
          if (properties.gap === 0 && isNotNull(prevPoint)) {
            point.incomingLineBrush = null;
          }

          prevProperties = properties;
        }
        prevPoint = point;
      }
    }
  }

  /**
   * Converts a CSS style object to the accepted JSON-like representation.
   * The 'fill' and 'stroke' properties must not be empty, to avoid ambiguity
   * with empty colors, so they are deleted if no rules apply.
   * TODO(dlaliberte) This ambiguity should be fixed.
   *
   * @param rules The CSS rules that should be canonicalized.
   * @return The canonicalized style.
   */
  private static canonicalizeCssStyle(
    rules: AnyDuringMigration,
  ): AnyDuringMigration {
    const style = {'fill': {}, 'stroke': {}, 'shape': {}};
    if (rules != null) {
      if (rules['visible'] != null) {
        (style as AnyDuringMigration)['visible'] = rules['visible'];
      }
      if (rules['size'] != null) {
        (style as AnyDuringMigration)['size'] = rules['size'];
      }
      if (rules['color'] != null) {
        (style as AnyDuringMigration)['fill']['color'] = (
          style as AnyDuringMigration
        )['stroke']['color'] = rules['color'];
      }
      if (rules['opacity'] != null) {
        (style as AnyDuringMigration)['fill']['opacity'] = (
          style as AnyDuringMigration
        )['stroke']['opacity'] = rules['opacity'];
      }

      if (rules['fillColor'] != null) {
        (style as AnyDuringMigration)['fill']['color'] = rules['fillColor'];
      }
      if (rules['fillOpacity'] != null) {
        (style as AnyDuringMigration)['fill']['opacity'] = rules['fillOpacity'];
      }
      if (
        (style as AnyDuringMigration)['fill']['color'] == null &&
        (style as AnyDuringMigration)['fill']['opacity'] == null
      ) {
        // Suppressing errors for ts-migration.
        //   TS2790: The operand of a 'delete' operator must be optional.
        // @ts-ignore
        delete style['fill'];
      }

      if (rules['strokeColor'] != null) {
        (style as AnyDuringMigration)['stroke']['color'] = rules['strokeColor'];
      }
      if (rules['strokeOpacity'] != null) {
        (style as AnyDuringMigration)['stroke']['opacity'] =
          rules['strokeOpacity'];
      }
      if (rules['strokeWidth'] != null) {
        (style as AnyDuringMigration)['stroke']['width'] = rules['strokeWidth'];
      }
      if (
        (style as AnyDuringMigration)['stroke']['color'] == null &&
        (style as AnyDuringMigration)['stroke']['opacity'] == null &&
        (style as AnyDuringMigration)['stroke']['width'] == null
      ) {
        // Suppressing errors for ts-migration.
        //   TS2790: The operand of a 'delete' operator must be optional.
        // @ts-ignore
        delete style['stroke'];
      }

      if (rules['shapeType'] != null) {
        (style as AnyDuringMigration)['shape']['type'] = rules['shapeType'];
      }
      if (rules['shapeSides'] != null) {
        (style as AnyDuringMigration)['shape']['sides'] = rules['shapeSides'];
      }
      if (rules['shapeRotation'] != null) {
        (style as AnyDuringMigration)['shape']['rotation'] =
          rules['shapeRotation'];
      }
      if (rules['shapeDent'] != null) {
        (style as AnyDuringMigration)['shape']['dent'] = rules['shapeDent'];
      }
      if (rules['shortSize'] != null) {
        (style as AnyDuringMigration)['shortSize'] = rules['shortSize'];
      }
    }
    return style;
  }

  /**
   * Processes a style string into an Object. The style must be one of:
   *   - A simple color, in which case that color is assigned to the fill and
   *       stroke colors.
   *   - A JSON representation of the style (braces required), in the following
   *       format:
   *     {
   *       'fill': (string|{
   *         'color': string,
   *         'opacity': number
   *       }),
   *       'stroke': (string|{
   *         'color': string,
   *         'opacity': number,
   *         'width': number
   *       })
   *     }
   *       It may also have the properties 'line', 'bar', or 'point', each with
   *       a nested object like the one outlined above.
   *   - A simple CSS style, which will be applied to any type of datum.
   *   - A complex CSS style, with which you can(/have to) specify exactly what
   *       series types each style applies to. Valid selectors are line, bar,
   * and point. The following properties are supported in CSS format: color,
   * opacity, fill-color, fill-opacity, stroke-color, stroke-opacity,
   *   stroke-width
   * TODO(dlaliberte) Use visualizationStyle.processStyleString
   *
   * @param style The style string.
   * @return The processed style object, or undefined if the style was invalid.
   */
  private static processStyleString(
    style: string,
  ): AnyDuringMigration | undefined {
    let customStyle;
    let customPointStyle;
    style = trim(style);
    if (isValidColor(style)) {
      // The user has specified a color string.
      customStyle = {'fill': {'color': style}, 'stroke': {'color': style}};
    } else if (style.charAt(0) === '{') {
      // If the string starts with a brace, try parsing it as JSON.
      try {
        customPointStyle = parse(style);
      } catch (e) {}

      if (customPointStyle != null) {
        customStyle = customPointStyle;
      }
    }

    if (customStyle == null) {
      // Either the JSON parsing never started, or failed.
      // We still haven't succeeded in figuring out what the user gave us.
      // At this point, the only other thing they could have done is either
      // specified CSS attributes ("stroke-color: #f00; stroke-width: 3") or
      // specified CSS attributes with what they apply to.
      if (contains(style, '{')) {
        customStyle = googObject.map(
          parseStyle(style),
          AxisChartDefiner.canonicalizeCssStyle,
        );
        // If the style contains the empty string as a key, that means that it
        // should be applied to everything.
        if (googObject.containsKey(customStyle, '')) {
          Object.assign(customStyle, customStyle['']);
          googObject.remove(customStyle, '');
        }
        if (googObject.containsKey(customStyle, '*')) {
          Object.assign(customStyle, customStyle['*']);
          googObject.remove(customStyle, '*');
        }
      } else {
        customStyle = AxisChartDefiner.canonicalizeCssStyle(
          parseStyleAttribute(style),
        );
      }
    }
    return customStyle;
  }

  /**
   * Extracts a custom style for a point, if any. The style for a point, if any
   * exists, will be stored in the style column that is applied to the data
   * column. {@see AxisChartDefiner.processStyleString} * @param serie The serie that the point
   *     belongs to.
   * @param categoryIndex The category index.
   * @return The style for this point, or undefined if none.
   */
  private getCustomPointStyle(
    serie: SerieDefinition,
    categoryIndex: number,
  ): Options | undefined {
    let customStyle = undefined;
    const styleColumnIndex =
      serie.columns[STYLE] != null ? serie.columns[STYLE][0] : undefined;
    if (
      styleColumnIndex != null &&
      this.dataView.getColumnType(styleColumnIndex) === 'string'
    ) {
      const customStyleString = this.dataView.getValue(
        categoryIndex,
        styleColumnIndex,
      ) as string;
      if (customStyleString != null) {
        customStyle = AxisChartDefiner.processStyleString(customStyleString);
      }
    }
    if (customStyle != null) {
      return new Options([customStyle]);
    } else {
      return undefined;
    }
  }

  /**
   * Mutates the "brush", given a set of options for the brush. The options
   * should be in the form:
   * {
   *   fill: (string|{
   *     color: string,
   *     opacity: number
   *   }),
   *   stroke: (string|{
   *     color: string,
   *     opacity: number,
   *     width: number
   *   })
   * } * @param brush The brush to modify.
   * @param styleOptions The options from which to take the style.
   * @param onlyFillOrStroke A string that must be either 'fill' or 'stroke'. If it is one of those, only that will be applied. If it is neither of those, both the fill and stroke will be applied.
   */
  private static mutateBrush(
    brush: Brush,
    styleOptions: Options,
    onlyFillOrStroke?: string,
  ) {
    if (onlyFillOrStroke !== 'stroke') {
      brush.setFill(
        styleOptions.inferColorValue(['fill.color', 'fill'], brush.getFill()),
      );
      brush.setFillOpacity(
        styleOptions.inferRatioNumberValue(
          'fill.opacity',
          brush.getFillOpacity(),
        ),
      );
    }

    if (onlyFillOrStroke !== 'fill') {
      brush.setStroke(
        styleOptions.inferColorValue(
          ['stroke.color', 'stroke'],
          brush.getStroke(),
        ),
      );
      brush.setStrokeOpacity(
        styleOptions.inferRatioNumberValue(
          'stroke.opacity',
          brush.getStrokeOpacity(),
        ),
      );
      brush.setStrokeWidth(
        styleOptions.inferNumberValue('stroke.width', brush.getStrokeWidth()),
      );
    }
  }

  /**
   * Adds common properties to a given point, such as tooltip, certainty, scope,
   * emphasis and brush when necessary (e.g., point is uncertain).
   *
   * @param point The point.
   * @param serie The serie that the point belongs to.
   * @param serieIndex The serie index.
   * @param categoryIndex The category index.
   */
  private addCommonPointProperties(
    point: DatumDefinition,
    serie: SerieDefinition,
    serieIndex: number,
    categoryIndex: number,
  ) {
    if (this.isTooltipEnabled()) {
      point.tooltipText = this.getTooltipText(serie, serieIndex, categoryIndex);
    }

    const customStyle: Options | undefined = this.getCustomPointStyle(
      serie,
      categoryIndex,
    );

    const certainty = this.calcCertainty(serie, categoryIndex);
    const emphasis = this.calcEmphasis(serie, categoryIndex);
    const scope = this.calcScope(serie, categoryIndex);
    let radius = getPointTotalRadius(point, serie);

    // Since we might do several changes, one on top of the other, we save the
    // aggregated brush/radius locally and each time apply the transformation
    // over them (and update as needed).
    let brush = serie.pointBrush;

    // We only modify the color of the point in this function though, and not
    // the line/area brushes.
    if (!scope) {
      point.scope = scope;
      // We cache the gray point brush for the serie under serie.grayPointBrush.
      serie.grayPointBrush = serie.grayPointBrush || brush.grayOut();
      brush = serie.grayPointBrush;
      point.brush = brush;
    }

    // Currently there is emphasis support for points datums, for which we
    // multiply the radius by sqrt(emphasis). We use sqrt as the area of the
    // point is relative to its radius^2. For other types we just mark the datum
    // as emphasized.
    if (emphasis !== 1) {
      point.emphasis = emphasis;
      if (
        serie.type === SerieType.LINE ||
        serie.type === SerieType.AREA ||
        serie.type === SerieType.SCATTER
      ) {
        // Rounding with 1 digit of accuracy to have more options.
        radius = Math.round(radius * Math.sqrt(emphasis) * 10) / 10;
        point.radius = radius;
      }
    }

    // If point is 'uncertain' remember its certainty value and adjust its brush
    // to show it.
    if (certainty < 1) {
      point.certainty = certainty;
      switch (serie.type) {
        case SerieType.LINE:
        case SerieType.AREA:
        case SerieType.SCATTER:
          point.brush = this.createUncertainBrush(brush, true);
          point.radius = calcCompensatedPointRadius(point.brush, radius);
          break;
        case SerieType.BARS:
        case SerieType.STEPPED_AREA:
          point.brush = this.createUncertainBrush(brush, false);
          break;
        default:
          break;
      }
    }

    if (customStyle != null) {
      brush = (point.brush || serie.pointBrush).clone();

      point.radius = radius = customStyle.inferNonNegativeNumberValue(
        'point.size',
        radius,
      );
      const customShape = customStyle.inferValue('point.shape');
      if (customShape != null) {
        point.shape = customShape as PointShape;
      }
      const pointVisible =
        customStyle.inferOptionalBooleanValue('point.visible');
      if (pointVisible != null) {
        point.visible = pointVisible;
      }

      AxisChartDefiner.mutateBrush(brush, customStyle);
      switch (serie.type) {
        case SerieType.LINE:
        case SerieType.SCATTER:
        case SerieType.AREA:
          AxisChartDefiner.mutateBrush(brush, customStyle.view('point'));
          if (serie.lineBrush != null) {
            point.incomingLineBrush = (
              point.incomingLineBrush ||
              point.lineBrush ||
              serie.lineBrush
            ).clone();
            AxisChartDefiner.mutateBrush(
              point.incomingLineBrush,
              customStyle.view(['line', '']),
              'stroke',
            );
          }
          if (serie.areaBrush != null) {
            point.incomingAreaBrush = (
              point.incomingAreaBrush ||
              point.lineBrush ||
              serie.areaBrush
            ).clone();
            AxisChartDefiner.mutateBrush(
              point.incomingAreaBrush,
              customStyle.view(['area', '']),
              'fill',
            );
          }
          break;
        // Suppressing errors for ts-migration.
        //   TS7029: Fallthrough case in switch.
        // @ts-ignore
        case SerieType.STEPPED_AREA:
          AxisChartDefiner.mutateBrush(
            brush,
            customStyle.view('area'),
            'fill',
          );
          if (serie.lineBrush != null) {
            point.lineBrush = (point.lineBrush || serie.lineBrush).clone();
            // We should apply the global brush to the line stroke, as well as
            // the line brush.
            AxisChartDefiner.mutateBrush(
              point.lineBrush,
              customStyle.view(['line', '']),
              'stroke',
            );
          }
        case SerieType.BARS:
          AxisChartDefiner.mutateBrush(brush, customStyle.view('bar'));
          break;
        case SerieType.CANDLESTICKS:
        // Suppressing errors for ts-migration.
        //   TS7029: Fallthrough case in switch.
        // @ts-ignore
        case SerieType.BOXPLOT:
          point.barBrush = point.barBrush.clone();
          AxisChartDefiner.mutateBrush(
            point.barBrush,
            customStyle.view(['bar', '']),
          );
          AxisChartDefiner.mutateBrush(
            point.lineBrush,
            customStyle.view(['line', '']),
          );
        default:
      }
      point.brush = brush;
    }
  }

  /**
   * Extracts the custom tooltip text for a given data cell if there is custom
   * text. If not, it returns the default text.
   *
   * @param serie The serie that the point belongs to.
   * @param serieIndex The serie index.
   * @param categoryIndex The category index.
   * @return The tooltip text.
   */
  private getTooltipText(
    serie: SerieDefinition,
    serieIndex: number,
    categoryIndex: number,
  ): chartDefinitionTypes.TooltipText {
    const tooltipText = this.calcTooltipText(serie, serieIndex, categoryIndex);

    const tooltipColumnIndices = serie.columns[TOOLTIP];
    if (tooltipColumnIndices && !serie.isVirtual) {
      // Only one tooltip column per serie is allowed.
      assert(tooltipColumnIndices.length === 1);
      const tooltipColumnIndex = tooltipColumnIndices[0];
      if (this.dataView.getColumnType(tooltipColumnIndex) === 'function') {
        // A tooltip calc function is given in the serie definition, set it on
        // |tooltipText| and defer the tooltip content creation until tooltip
        // triggering events.
        tooltipText.customCalcFunction = this.dataView.getValue(
          categoryIndex,
          tooltipColumnIndex,
        ) as AnyDuringMigration as
          | ((p1: AnyDuringMigration, p2: number, p3: number) => string)
          | undefined;
        tooltipText.hasHtmlContent = true;
        tooltipText.hasCustomContent = true;
        return tooltipText;
      }
      const customTooltipText = this.getCustomTooltipText(
        tooltipColumnIndex,
        categoryIndex,
      );
      if (customTooltipText && customTooltipText.hasCustomContent) {
        Object.assign(tooltipText, customTooltipText);
      }
    }
    tooltipText.hasHtmlContent = !!tooltipText.hasHtmlContent;
    return tooltipText;
  }

  /**
   * Extracts the custom tooltip text for a given data cell.
   *
   * @param tooltipColumnIndex The index of the tooltip column.
   * @param rowIndex The index of the row.
   * @return The tooltip text.
   */
  getCustomTooltipText(
    tooltipColumnIndex: number,
    rowIndex: number,
  ): TooltipText {
    const dataView = this.dataView;
    // chartDefinition.isHtmlTooltip indicates whether the tooltip outline is
    // HTML or SVG/VML. If set to HTML, it enables the option of putting HTML
    // content in the tooltip by specifying a custom property on a data
    // column/cell. Tooltip text should be interpreted as HTML if the custom
    // tooltip column is decorated with an 'html' property.
    const hasHtmlContent =
      this.chartDef.isHtmlTooltip &&
      (dataView.getProperty(rowIndex, tooltipColumnIndex, 'html') ||
        dataView.getColumnProperty(tooltipColumnIndex, 'html'));

    const tooltipContent = dataView.getFormattedValue(
      rowIndex,
      tooltipColumnIndex,
    );
    return {
      hasHtmlContent: !!hasHtmlContent,
      hasCustomContent: tooltipContent ? true : false,
      content: tooltipContent,
    };
  }

  /**
   * Calculates the tooltip text for a given data point.
   *
   * @param serie The serie object.
   * @param serieIndex The serie index.
   * @param categoryIndex The category index.
   * @return The tooltip text.
   */
  private calcTooltipText(
    serie: SerieDefinition,
    serieIndex: number,
    categoryIndex: number,
  ): chartDefinitionTypes.TooltipText {
    const chartType = this.chartDef.chartType;
    // If it is a scatter chart or behaves like a scatter chart (lineWidth: 0)
    // or if the series is actually a trendline, display as for scatter chart.
    if (
      chartType === ChartType.SCATTER ||
      serie.isVirtual ||
      serie.lineWidth === 0
    ) {
      return this.calcScatterTooltipText(serie, serieIndex, categoryIndex);
    } else {
      return this.calcFunctionTooltipText(serie, categoryIndex);
    }
  }

  /**
   * Calculates the tooltip text for a given data point in a scatter chart.
   *
   * @param serie The serie object.
   * @param serieIndex The serie index.
   * @param categoryIndex The category index.
   * @return The tooltip text.
   */
  private calcScatterTooltipText(
    serie: SerieDefinition,
    serieIndex: number,
    categoryIndex: number,
  ): chartDefinitionTypes.TooltipText {
    const dataView = this.dataView;
    const chartDef = this.chartDef;
    let valueX;
    let valueY;
    let content;
    let categoryTitle;

    assert(serie.domainIndex != null);
    const serieDomainIndex = serie.domainIndex!;

    if (serie.isVirtual) {
      valueX = serie.data![categoryIndex][0];
      valueY = serie.data![categoryIndex][1];
      if (valueX != null) {
        valueX = getDefaultFormattedValue(
          valueX,
          dataView.getColumnType(serieDomainIndex),
        );
      }
      if (valueY != null) {
        valueY = getDefaultFormattedValue(valueY, serie.dataType);
      }
      if (chartDef.focusTarget.has(FocusTarget.CATEGORY)) {
        content = valueY;
      } else {
        content = `${valueX}, ${valueY}`;
      }
      categoryTitle = valueX;
    } else if (this.chartDef.isDiff) {
      const hAxisTitle = this.hAxisDefiners![0].title.text;
      const vAxisTitle = this.vAxisDefiners![0].title.text;
      const valueXPrefixText =
        hAxisTitle || DEFAULT_SCATTER_TOOLTIP_X_PREFIX_TEXT;
      const valueYPrefixText =
        vAxisTitle || DEFAULT_SCATTER_TOOLTIP_Y_PREFIX_TEXT;

      // Gets values from pair of old and new data series.
      const oldDataSerieIndex = serieIndex % 2 ? serieIndex - 1 : serieIndex;
      const newDataSerieIndex = oldDataSerieIndex + 1;
      const oldDataSerie = chartDef.series[oldDataSerieIndex];
      const newDataSerie = chartDef.series[newDataSerieIndex];

      // Fetches formatted values.
      let columnIdxX;
      let columnIdxY;

      // New data values.
      assert(newDataSerie.domainIndex != null);
      columnIdxX =
        // Suppressing errors for ts-migration.
        //   TS2538: Type 'null' cannot be used as an index type.
        // @ts-ignore
        chartDef.domainsColumnStructure[newDataSerie.domainIndex].columns[
          DOMAIN
        ][0];
      columnIdxY = this.getFirstDataColumnIndex(newDataSerie);
      valueX = dataView.getFormattedValue(categoryIndex, columnIdxX);
      valueY = dataView.getFormattedValue(categoryIndex, columnIdxY);

      content = `${valueXPrefixText}: ${valueX}, ${valueYPrefixText}: ${valueY}`;

      // Old data values.
      assert(oldDataSerie.domainIndex != null);
      columnIdxX =
        // Suppressing errors for ts-migration.
        //   TS2538: Type 'null' cannot be used as an index type.
        // @ts-ignore
        chartDef.domainsColumnStructure[oldDataSerie.domainIndex].columns[
          DOMAIN
        ][0];
      columnIdxY = this.getFirstDataColumnIndex(oldDataSerie);
      valueX = dataView.getFormattedValue(categoryIndex, columnIdxX);
      valueY = dataView.getFormattedValue(categoryIndex, columnIdxY);

      content += `\n${valueXPrefixText}: ${valueX}, ${valueYPrefixText}: ${valueY}`;
    } else {
      const columnIdxX =
        chartDef.domainsColumnStructure[serieDomainIndex].columns[DOMAIN][0];
      const columnIdxY = this.getFirstDataColumnIndex(serie);
      valueX = dataView.getFormattedValue(categoryIndex, columnIdxX);
      valueY = dataView.getFormattedValue(categoryIndex, columnIdxY);
      if (chartDef.focusTarget.has(FocusTarget.CATEGORY)) {
        content = valueY;
      } else {
        content = `${valueX}, ${valueY}`;
      }
    }
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ hasCustomContent: false; content: any; serieTitle: any; categoryTitle: any; }' is missing the following properties from type 'TooltipText': hasHtmlContent, title, lines
    // @ts-ignore
    return {
      hasCustomContent: false,
      content,
      serieTitle: serie.title,
      categoryTitle,
    };
  }

  /**
   * Calculates the tooltip text for a given data point in a function chart.
   *
   * @param serie The serie object.
   * @param categoryIndex The category index.
   * @return The tooltip text.
   */
  private calcFunctionTooltipText(
    serie: SerieDefinition,
    categoryIndex: number,
  ): chartDefinitionTypes.TooltipText {
    assert(serie.domainIndex != null);
    const serieDomainIndex = serie.domainIndex!;
    const dataView = this.dataView;
    const category = this.chartDef.categories[categoryIndex];
    const categoryTitle = serie.isVirtual
      ? serie.data![categoryIndex][0].toString()
      : category.titles[serieDomainIndex];
    let formattedDataValue;
    const hasHtmlContent = false;
    if (serie.type === SerieType.CANDLESTICKS) {
      const dataColumns = serie.columns[DATA];
      formattedDataValue =
        dataView.getFormattedValue(categoryIndex, dataColumns[0]) +
        ' - ' +
        dataView.getFormattedValue(categoryIndex, dataColumns[3]) +
        ', ' +
        dataView.getFormattedValue(categoryIndex, dataColumns[1]) +
        ' - ' +
        dataView.getFormattedValue(categoryIndex, dataColumns[2]);
    } else if (serie.type === SerieType.BOXPLOT) {
      const dataColumns = serie.columns[DATA];
      formattedDataValue =
        dataView.getFormattedValue(categoryIndex, dataColumns[0]) +
        ' - ' +
        dataView.getFormattedValue(categoryIndex, dataColumns[1]) +
        ' - ' +
        dataView.getFormattedValue(categoryIndex, dataColumns[2]) +
        ' - ' +
        dataView.getFormattedValue(categoryIndex, dataColumns[3]) +
        ' - ' +
        dataView.getFormattedValue(categoryIndex, dataColumns[4]);
    } else if (this.chartDef.isDiff) {
      const oldDataColumns = serie.columns[DIFF_OLD_DATA];
      const newDataColumns = serie.columns[DATA];
      const oldValue = this.dataView.getValue(categoryIndex, oldDataColumns[0]);
      const newValue = this.dataView.getValue(categoryIndex, newDataColumns[0]);
      const formattedOldDataValue = dataView.getFormattedValue(
        categoryIndex,
        oldDataColumns[0],
      );
      const formattedNewDataValue = dataView.getFormattedValue(
        categoryIndex,
        newDataColumns[0],
      );
      if (
        oldValue === null &&
        isEmptyOrWhitespace(formattedOldDataValue) &&
        newValue === null &&
        isEmptyOrWhitespace(formattedNewDataValue)
      ) {
        // Suppressing errors for ts-migration.
        //   TS2739: Type '{ hasCustomContent: false; content: null; }' is missing the following properties from type 'TooltipText': hasHtmlContent, categoryTitle, serieTitle, title, lines
        // @ts-ignore
        return {hasCustomContent: false, content: null};
      }
      formattedDataValue = `${formattedNewDataValue}
${formattedOldDataValue}`;
      // TODO(dlaliberte) Add support for interval columns in diff mode.
    } else {
      const dataColumns = serie.columns[DATA];
      const value = serie.isVirtual
        ? serie.data![categoryIndex][1]
        : this.dataView.getValue(categoryIndex, dataColumns[0]);
      formattedDataValue = serie.isVirtual
        ? serie.data![categoryIndex][1].toString()
        : this.dataView.getFormattedValue(categoryIndex, dataColumns[0]);
      if (value === null && isEmptyOrWhitespace(formattedDataValue)) {
        // Suppressing errors for ts-migration.
        //   TS2739: Type '{ hasCustomContent: false; content: null; }' is missing the following properties from type 'TooltipText': hasHtmlContent, categoryTitle, serieTitle, title, lines
        // @ts-ignore
        return {hasCustomContent: false, content: null};
      }
      const intervalColumns = serie.columns[INTERVAL] || [];
      if (intervalColumns.length) {
        const values = intervalColumns.map((columnIndex: number) =>
          dataView.getFormattedValue(categoryIndex, columnIndex),
        );
        formattedDataValue += ' [' + values.join(', ') + ']';
      }
    }
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ hasCustomContent: false; content: any; categoryTitle: any; serieTitle: any; hasHtmlContent: false; }' is missing the following properties from type 'TooltipText': title, lines
    // @ts-ignore
    return {
      hasCustomContent: false,
      content: formattedDataValue,
      categoryTitle,
      serieTitle: serie.title,
      hasHtmlContent,
    };
  }

  /**
   * Calculates the control points of all scatter and line series.
   * Changes the members: series, in particular for each changed series:
   * isClosed, isCurved and controlPoints.
   */
  private calculateControlPoints() {
    const chartDef = this.chartDef;
    const domainAxis = this.domainAxisDefiner;

    // The gviz.canviz.util.calculateControlPoints algorithm has an interface
    // that accepts/returns Vec2 objects with X and Y properties, and we need to
    // translate the nonScaled point to/from a Vec2. This translation is done
    // differently for function charts and for scatter charts, and the code
    // below gaps this difference.
    const scatterNonScaledToVec = (nonScaled: AnyDuringMigration) =>
      new Vec2(nonScaled.x, nonScaled.y);
    const scatterVecToNonScaled = (vec: AnyDuringMigration) => ({
      x: vec.x,
      y: vec.y,
    });
    const scatterExtendRangeToIncludePoint = (
      serie: AnyDuringMigration,
      point: AnyDuringMigration,
      nonScaled: AnyDuringMigration,
    ) => {
      if (point.shouldExtendAxesRange) {
        this.hAxisDefiners![0].extendRangeToIncludeNumber(nonScaled.x);
        this.vAxisDefiners![0].extendRangeToIncludeNumber(nonScaled.y);
      }
    };
    const functionNonScaledToVec = (nonScaled: AnyDuringMigration) =>
      new Vec2(nonScaled.d, nonScaled.t);
    const functionVecToNonScaled = (vec: AnyDuringMigration) => ({
      d: vec.x,
      t: vec.y,
    });
    const functionExtendRangeToIncludePoint = (
      serie: AnyDuringMigration,
      point: AnyDuringMigration,
      nonScaled: AnyDuringMigration,
    ) => {
      domainAxis!.extendRangeToIncludeNumber(nonScaled.d);
      if (point.shouldExtendTargetAxisRange) {
        const targetAxis = this.getTargetAxisDefiner(serie.targetAxisIndex);
        targetAxis.extendRangeToIncludeNumber(nonScaled.t);
      }
    };
    let nonScaledToVec: AnyDuringMigration;
    let vecToNonScaled;
    let extendRangeToIncludePoint;
    switch (chartDef.chartType) {
      case ChartType.SCATTER:
        nonScaledToVec = scatterNonScaledToVec;
        vecToNonScaled = scatterVecToNonScaled;
        extendRangeToIncludePoint = scatterExtendRangeToIncludePoint;
        break;
      case ChartType.FUNCTION:
        nonScaledToVec = functionNonScaledToVec;
        vecToNonScaled = functionVecToNonScaled;
        extendRangeToIncludePoint = functionExtendRangeToIncludePoint;
        break;
      default:
        throw new Error(`Unsupported chart type: ${chartDef.chartType}`);
    }

    for (let j = 0; j < chartDef.series.length; j++) {
      const serie = chartDef.series[j];
      if (serie.type === SerieType.SCATTER || serie.type === SerieType.LINE) {
        if (
          !googArray.contains(
            [CurveType.FUNCTION, CurveType.PHASE, CurveType.CLOSED_PHASE],
            serie.curveType,
          )
        ) {
          serie.isCurved = false;
          continue;
        }

        const isClosed =
          serie.type === SerieType.SCATTER &&
          serie.curveType === CurveType.CLOSED_PHASE;
        const isFunction = serie.curveType === CurveType.FUNCTION;
        serie.isCurved = true;
        serie.isClosed = isClosed;
        const controlPoints = calculateControlPoints(
          serie.points.map((p) =>
            isDatumNull(p) ? null : nonScaledToVec(p!.nonScaled),
          ),
          serie.smoothingFactor,
          isFunction,
          isClosed,
          chartDef.interpolateNulls,
        );
        for (let i = 0; i < serie.points.length; ++i) {
          const point = serie.points[i]!;
          if (controlPoints[i]) {
            const leftControlPoint = vecToNonScaled(controlPoints[i]![0]);
            const rightControlPoint = vecToNonScaled(controlPoints[i]![1]);
            // Suppressing errors for ts-migration.
            //   TS2339: Property 'nonScaledLeftControlPoint' does not exist on type 'DatumDefinition'.
            // @ts-ignore
            point.nonScaledLeftControlPoint = leftControlPoint;
            // Suppressing errors for ts-migration.
            //   TS2339: Property 'nonScaledRightControlPoint' does not exist on type 'DatumDefinition'.
            // @ts-ignore
            point.nonScaledRightControlPoint = rightControlPoint;
            extendRangeToIncludePoint(serie, point, leftControlPoint);
            extendRangeToIncludePoint(serie, point, rightControlPoint);
          }
        }
      }
    }
  }

  /**
   * Calculate the sensitivity area of every category.
   * This is done by dividing the chart area into strips (vertical or
   * horizontal, depending on the chart's orientation), where the line
   * separating two categories passes through their middle.
   */
  private calcCategorySensitivityAreas() {
    // Category sensitivity areas are only used when focus target is CATEGORY.
    if (!this.chartDef.focusTarget.has(FocusTarget.CATEGORY)) {
      return;
    }

    const categories = this.chartDef.categories;
    // Precalculate the position of each category.
    const categoryPositions = categories.map((c, index) => {
      return this.calcCategoryPosition(index);
    });

    const domainAxisDefiner = this.domainAxisDefiner;
    const categoryOrder = googArray.range(categories.length);
    googArray.stableSort(categoryOrder, (a, b) =>
      googArray.defaultCompare(categoryPositions[a], categoryPositions[b]),
    );
    let startPos = domainAxisDefiner!.startPos as number;
    assert(startPos != null);
    let endPos = domainAxisDefiner!.endPos as number;
    assert(endPos != null);

    if (startPos > endPos) {
      const t = startPos;
      startPos = endPos;
      endPos = t;
    }

    // Find the first category which resides within the view window.
    let firstCategoryInViewWindow;
    let currentCategoryPosition;
    for (let i = 0; i < categoryOrder.length; i++) {
      const categoryIndex = categoryOrder[i];
      currentCategoryPosition = this.calcCategoryPosition(categoryIndex);
      if (currentCategoryPosition == null) {
        // Skip null categories (can only happen in VALUE axis).
        continue;
      }
      if (domainAxisDefiner!.isPositionPastTheEnd(currentCategoryPosition)) {
        // If the category resides past the end of the view window, then there
        // are no categories within the view window and we can simply return.
        return;
      }
      if (
        domainAxisDefiner!.isPositionBeforeTheStart(currentCategoryPosition)
      ) {
        // If the category resides before the start of the view window, skip it.
        continue;
      }
      // Gotcha! The first category within the view window.
      firstCategoryInViewWindow = i;
      break;
    }
    if (firstCategoryInViewWindow === undefined) {
      // There are no categories, or all categories are null.
      return;
    }

    // Pixel coordinates of the current sensitivity area.
    // Initializated as if a previous sensitivity area ends where the axis
    // starts.
    let sensitivityAreaStart;
    let sensitivityAreaEnd = startPos;

    // The next category refers to the one whose index is i + 1 whereas the
    // current category refers to the one at index i.
    let nextCategoryPosition;
    // There might be multiple null values in a row. This variable is used for
    // skipping them.
    let nextI = null;

    // Note that we start from the first category in the view window, not from
    // 0.
    for (let i = firstCategoryInViewWindow; i < categoryOrder.length; i++) {
      if (nextI != null && i < nextI) {
        i = nextI;
        nextI = null;
      }
      const categoryIndex = categoryOrder[i];
      // Current sensitivity area starts where the previous one ends.
      sensitivityAreaStart = sensitivityAreaEnd;

      if (i === categoryOrder.length - 1) {
        // Reached the last category, so there is no next one.
        // Set the sensitivity area of the last category from where the previous
        // one ends to the end of the axis.
        this.setCategorySensitivityArea(
          categoryIndex,
          sensitivityAreaStart,
          endPos,
        );
        return;
      }
      nextCategoryPosition = this.calcCategoryPosition(categoryOrder[i + 1]);
      if (nextCategoryPosition == null) {
        // If the next category position is null, we need to find the next
        // non-null category.
        for (let j = i + 2; j < categoryOrder.length; j++) {
          nextCategoryPosition = this.calcCategoryPosition(categoryOrder[j]);
          if (nextCategoryPosition != null) {
            // Once we've found it, we need to make sure that the loop continues
            // with it, and not the null category that it would continue with
            // otherwise. In order to accomplish this, we set nextI, and set i
            // to be nextI on the next loop iteration.
            nextI = j;
            break;
          }
        }
        if (nextCategoryPosition == null) {
          // We got to the last category without seeing anything that's not
          // null. We should do the same thing as if this was the last category
          // (which it technically is).
          this.setCategorySensitivityArea(
            categoryIndex,
            sensitivityAreaStart,
            endPos,
          );
          return;
        }
      }
      if (domainAxisDefiner!.isPositionPastTheEnd(nextCategoryPosition)) {
        // Next category exceeds the end of the view window.
        // Set the sensitivity area of the last category within the view window
        // from where the previous one ends to the end of the axis.
        this.setCategorySensitivityArea(
          categoryIndex,
          sensitivityAreaStart,
          endPos,
        );
        return;
      }
      // The end coordinate is set to be the average of the coordinate of the
      // current category and that of the next one.
      assert(currentCategoryPosition != null);
      sensitivityAreaEnd = average(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'number | null | undefined' is not assignable to parameter of type 'number'.
        // @ts-ignore
        currentCategoryPosition,
        nextCategoryPosition,
      );

      this.setCategorySensitivityArea(
        categoryIndex,
        sensitivityAreaStart,
        sensitivityAreaEnd,
      );

      // Because the next category position is not null, we can safely prepare
      // the current one for the next iteration.
      currentCategoryPosition = nextCategoryPosition;
    }
  }

  /**
   * Calculate the pixel position of a given category.
   * @param categoryIndex The category index.
   * @return The pixel position of the given category, or null if the category represents a null data point (possible in VALUE axis only).
   */
  private calcCategoryPosition(categoryIndex: number): number | null {
    const categories = this.chartDef.categories;
    const domainAxisDefiner = this.domainAxisDefiner;
    if (domainAxisDefiner!.type === AxisType.VALUE) {
      if (categories[categoryIndex].data == null) {
        return null;
      }
      return domainAxisDefiner!.calcPositionFromDataValue(
        categories[categoryIndex].data,
      );
    }
    return domainAxisDefiner!.calcPositionForNumericValue(categoryIndex);
  }

  /**
   * Set the sensitivity area for a given category.
   * Takes the chart orientation and the domain axis direction into account.
   * @param categoryIndex The category of the category.
   * @param sensitivityAreaStart The pixel position of the start of the sensitivity area.
   * @param sensitivityAreaEnd The pixel position of the end of the sensitivity area.
   */
  private setCategorySensitivityArea(
    categoryIndex: number,
    sensitivityAreaStart: number,
    sensitivityAreaEnd: number,
  ) {
    const top = this.chartDef.chartArea.top;
    const bottom = this.chartDef.chartArea.bottom;
    const left = this.chartDef.chartArea.left;
    const right = this.chartDef.chartArea.right;

    const orientation = this.chartDef.orientation;
    const direction = this.domainAxisDefiner!.direction;

    const category = this.chartDef.categories[categoryIndex];

    const swapSensitivityAreaStartAndEnd = () => {
      const t = sensitivityAreaStart;
      sensitivityAreaStart = sensitivityAreaEnd;
      sensitivityAreaEnd = t;
    };

    if (orientation === Orientation.HORIZONTAL) {
      if (direction === 1) {
        if (sensitivityAreaEnd < sensitivityAreaStart) {
          swapSensitivityAreaStartAndEnd();
        }
        // Left to right.
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'sensitivityArea' does not exist on type 'CategoryDefinition'.
        // @ts-ignore
        category.sensitivityArea = new Box(
          top,
          sensitivityAreaEnd,
          bottom,
          sensitivityAreaStart,
        );
      } else {
        if (sensitivityAreaEnd > sensitivityAreaStart) {
          swapSensitivityAreaStartAndEnd();
        }
        // Right to left.
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'sensitivityArea' does not exist on type 'CategoryDefinition'.
        // @ts-ignore
        category.sensitivityArea = new Box(
          top,
          sensitivityAreaStart,
          bottom,
          sensitivityAreaEnd,
        );
      }
    } else {
      if (direction === 1) {
        if (sensitivityAreaEnd < sensitivityAreaStart) {
          swapSensitivityAreaStartAndEnd();
        }
        // Top to bottom.
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'sensitivityArea' does not exist on type 'CategoryDefinition'.
        // @ts-ignore
        category.sensitivityArea = new Box(
          sensitivityAreaStart,
          right,
          sensitivityAreaEnd,
          left,
        );
      } else {
        if (sensitivityAreaEnd > sensitivityAreaStart) {
          swapSensitivityAreaStartAndEnd();
        }
        // Bottom to top.
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'sensitivityArea' does not exist on type 'CategoryDefinition'.
        // @ts-ignore
        category.sensitivityArea = new Box(
          sensitivityAreaEnd,
          right,
          sensitivityAreaStart,
          left,
        );
      }
    }
  }

  /** Remove all text boxes that collide with each other. */
  private resolveTextCollisions() {
    // First remove ticks that collide with the chart.
    this.resolveTicksWithChartCollisions();
    // Now resolve collisions between remaining ticks.
    this.resolveTicksWithTicksCollisions();
  }

  /**
   * Remove all ticks that collide with other chart elements except for other
   * ticks - for that we have resolveTicksWithTicksCollisions.
   */
  private resolveTicksWithChartCollisions() {
    const chartDef = this.chartDef;
    googObject.forEach(chartDef.vAxes, (vAxis, i) => {
      this.filterAxisTicks(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'VerticalAxisDefiner' is not assignable to parameter of type 'AxisDefiner'.
        // @ts-ignore
        this.vAxisDefiners![i],
        chartDef.vAxes[i],
        this.isVerticalTickClearOfChartCollisions,
      );
    });
    googObject.forEach(chartDef.hAxes, (hAxis, i) => {
      this.filterAxisTicks(
        this.hAxisDefiners![i],
        chartDef.hAxes[i],
        this.isHorizontalTickClearOfChartCollisions,
      );
    });
  }

  /** Remove all ticks that collide with other ticks. */
  private resolveTicksWithTicksCollisions() {
    const chartDef = this.chartDef;
    googObject.forEach(chartDef.vAxes, (vAxis, i) => {
      this.filterAxisTicks(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'VerticalAxisDefiner' is not assignable to parameter of type 'AxisDefiner'.
        // @ts-ignore
        this.vAxisDefiners![i],
        vAxis,
        (vAxisDefiner: VerticalAxisDefiner, tickText: TextItem): boolean => {
          return this.isVerticalTickClearOfTicksCollisions(
            vAxisDefiner,
            tickText,
          );
        },
      );
    });

    googObject.forEach(chartDef.hAxes, (hAxis, i) => {
      this.filterAxisTicks(
        this.hAxisDefiners![i],
        hAxis,
        (hAxisDefiner: HorizontalAxisDefiner, tickText: TextItem): boolean => {
          return this.isHorizontalTickClearOfTicksCollisions(
            hAxisDefiner,
            tickText,
          );
        },
      );
    });
  }

  /**
   * Filter out ticks on an axis definition according to a filter function.
   *
   * @param axisDefiner The axis definer.
   * @param axisDefinition The axis definition.
   * @param filterFunc A filter function that accepts a chart definition, axis definer and tick text block.
   */
  private filterAxisTicks(
    axisDefiner: AxisDefiner,
    axisDefinition: AxisDefinition,
    filterFunc: Function,
  ) {
    if (axisDefinition.text) {
      axisDefinition.text = axisDefinition.text.filter(
        filterFunc.bind(this, axisDefiner),
      );
    }
  }

  /**
   * Detects whether the current position of a given horizontal tick is
   * completely contained within the chart area.
   *
   * @param hAxisDefiner the horizontal axis definer.
   * @param tickText the tick text object.
   * @return true if no collision were detected.
   */
  private isHorizontalTickClearOfChartCollisions(
    hAxisDefiner: HorizontalAxisDefiner,
    tickText: TextItem,
  ): boolean {
    const chartDef = this.chartDef;
    const textBlock = tickText.textBlock;
    if (textBlock!.angle) {
      // Ignore textBlocks with non-zero angles.
      return true;
    }
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'TextBlock | undefined' is not assignable to parameter of type 'TextBlock'.
    // @ts-ignore
    const boundingBox = calcBoundingBox(textBlock);
    if (!boundingBox) {
      return true;
    }
    if (hAxisDefiner.tickTextPosition === InOutPosition.INSIDE) {
      const chartAreaBox = new Box(
        chartDef.chartArea.top,
        chartDef.chartArea.right,
        chartDef.chartArea.bottom,
        chartDef.chartArea.left,
      );
      if (!chartAreaBox.contains(boundingBox)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Detects whether the current position of a given horizontal tick is clear of
   * collisions with vertical ticks.
   *
   * @param hAxisDefiner the horizontal axis definer.
   * @param tickText the tick text object.
   * @return true if no collision were detected.
   */
  private isHorizontalTickClearOfTicksCollisions(
    hAxisDefiner: HorizontalAxisDefiner,
    tickText: TextItem,
  ): boolean {
    const chartDef = this.chartDef;
    const textBlock = tickText.textBlock;
    if (textBlock!.angle) {
      // Ignore textBlocks with non-zero angles.
      return true;
    }
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'TextBlock | undefined' is not assignable to parameter of type 'TextBlock'.
    // @ts-ignore
    const boundingBox = calcBoundingBox(textBlock);
    if (!boundingBox) {
      return true; // no collisions possible
    }
    const margin = Math.ceil(textBlock!.textStyle.fontSize / 8);

    const boundingBoxWithMargin = new Box(
      boundingBox.top,
      boundingBox.right + margin,
      boundingBox.bottom,
      boundingBox.left - margin,
    );

    // Check for collision of horizontal ticks with first and last vertical
    // ticks.
    for (const index in chartDef.vAxes) {
      if (chartDef.vAxes[Number(index)] === undefined) {
        continue;
      }
      const i = Number(index);
      if (this.vAxisDefiners![i].tickTextPosition !== InOutPosition.INSIDE) {
        continue;
      }
      const numberOfVerticalTicks = chartDef.vAxes[i].text
        ? chartDef.vAxes[i].text.length
        : 0;
      if (numberOfVerticalTicks < 1) {
        continue;
      }
      // Assumes vertical ticks are in order.
      const firstVerticalTickBoundingBox = calcBoundingBox(
        chartDef.vAxes[i].text[0].textBlock as canvizTextBlock.TextBlock,
      );
      const lastVerticalTickBoundingBox = calcBoundingBox(
        googArray.peek(chartDef.vAxes[i].text)
          .textBlock as canvizTextBlock.TextBlock,
      );

      // TODO(dlaliberte): Clean-up this code. Reconsider the way we handle the case
      // where one of the boxes are null, and the logic of testing for tick
      // confusion.

      if (firstVerticalTickBoundingBox || lastVerticalTickBoundingBox) {
        // Does our tick collide with the first/last vertical tick?
        if (
          (firstVerticalTickBoundingBox &&
            Box.intersects(
              boundingBoxWithMargin,
              firstVerticalTickBoundingBox,
            )) ||
          (lastVerticalTickBoundingBox &&
            Box.intersects(boundingBoxWithMargin, lastVerticalTickBoundingBox))
        ) {
          return false;
        }

        // If the tick is inside the chart, it might be aligned with the
        // vertical ticks and that will be confusing.
        let verticalMaxRight;
        let verticalMinLeft;

        if (firstVerticalTickBoundingBox) {
          if (lastVerticalTickBoundingBox) {
            verticalMinLeft = Math.min(
              firstVerticalTickBoundingBox.left,
              lastVerticalTickBoundingBox.left,
            );
            verticalMaxRight = Math.max(
              firstVerticalTickBoundingBox.right,
              lastVerticalTickBoundingBox.right,
            );
          } else {
            verticalMinLeft = firstVerticalTickBoundingBox.left;
            verticalMaxRight = firstVerticalTickBoundingBox.right;
          }
        } else {
          verticalMinLeft = lastVerticalTickBoundingBox!.left;
          verticalMaxRight = lastVerticalTickBoundingBox!.right;
        }

        if (
          Math.abs(boundingBox.left - verticalMinLeft) < margin ||
          Math.abs(boundingBox.right - verticalMaxRight) < margin
        ) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Detects whether the current position of a given vertical tick is clear of
   * collisions with the chart title, the axis titles, or the legend and that it
   * is completely contained within the chart area.
   *
   * @param vAxisDefiner the vertical axis definer.
   * @param tickText the tick text object.
   * @return true if no collision were detected.
   */
  private isVerticalTickClearOfChartCollisions(
    vAxisDefiner: VerticalAxisDefiner,
    tickText: TextItem,
  ): boolean {
    const chartDef = this.chartDef;
    const chartAreaBox = new Box(
      chartDef.chartArea.top,
      chartDef.chartArea.right,
      chartDef.chartArea.bottom,
      chartDef.chartArea.left,
    );
    const textBlock = tickText.textBlock;
    // Use same margin as in vertical-axis-definer.
    const margin = textBlock!.textStyle.fontSize / 8;
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'TextBlock | undefined' is not assignable to parameter of type 'TextBlock'.
    // @ts-ignore
    const boundingBox = calcBoundingBox(textBlock);
    if (!boundingBox) {
      return true;
    }
    if (vAxisDefiner.tickTextPosition === InOutPosition.INSIDE) {
      if (!chartAreaBox.contains(boundingBox)) {
        return false;
      }
    }
    const boundingBoxWithMargin = new Box(
      boundingBox.top,
      boundingBox.right + margin,
      boundingBox.bottom,
      boundingBox.left - margin,
    );
    const titleBoundingBox = calcBoundingBox(chartDef.title);
    if (
      titleBoundingBox &&
      Box.intersects(boundingBoxWithMargin, titleBoundingBox)
    ) {
      return false;
    }
    const axisTitlesBoundingBox = chartDef.innerAxisTitle
      ? calcBoundingBox(chartDef.innerAxisTitle)
      : null;
    if (
      axisTitlesBoundingBox &&
      Box.intersects(boundingBoxWithMargin, axisTitlesBoundingBox)
    ) {
      return false;
    }
    const legendBoundingBox = this.legendDefiner!.getArea();
    if (
      legendBoundingBox &&
      Box.intersects(boundingBoxWithMargin, legendBoundingBox)
    ) {
      return false;
    }
    return true;
  }

  /**
   * Detects whether the current position of a given vertical tick is clear of
   * collisions with vertical ticks.
   *
   * @param vAxisDefiner the vertical axis definer.
   * @param tickText the tick text object.
   * @return true if no collision were detected.
   */
  private isVerticalTickClearOfTicksCollisions(
    vAxisDefiner: VerticalAxisDefiner,
    tickText: TextItem,
  ): boolean {
    // Nothing left to do, since we have taken care of this via
    // vertical-axis-definer combined with axis-definer layout tests.
    return true;
  }

  /**
   * Positions all non scaled elements on the well defined and calibrated axes
   * for a given series.
   * @param serieIndex The index of the series for which the non-scaled elements should be positioned.
   */
  private positionNonScaledElementsForSerie(serieIndex: number) {
    const chartDef = this.chartDef;
    const serie = chartDef.series[serieIndex];
    const scaleFunction = this.chooseScaleFunctionForSerie(serie);
    if (serie.points) {
      serie.points.forEach((point, categoryIndex) => {
        if (point != null && !point.isNull) {
          point.scaled = scaleFunction(point.nonScaled);
          // Suppressing errors for ts-migration.
          //   TS2339: Property 'nonScaledLeftControlPoint' does not exist on type 'DatumDefinition'.
          // @ts-ignore
          if (point.nonScaledLeftControlPoint != null) {
            point.leftControlPoint = scaleFunction(
// Suppressing errors for ts-migration.
//   TS2339: Property 'nonScaledLeftControlPoint' does not exist on type 'DatumDefinition'.
// @ts-ignore
              point.nonScaledLeftControlPoint,
            );
          }
          // Suppressing errors for ts-migration.
          //   TS2339: Property 'nonScaledRightControlPoint' does not exist on type 'DatumDefinition'.
          // @ts-ignore
          if (point.nonScaledRightControlPoint != null) {
            point.rightControlPoint = scaleFunction(
// Suppressing errors for ts-migration.
//   TS2339: Property 'nonScaledRightControlPoint' does not exist on type 'DatumDefinition'.
// @ts-ignore
              point.nonScaledRightControlPoint,
            );
          }
        }
      });
    }
    if (serie.intervals) {
      if (
        serie.intervals.lines.length > 0 ||
        serie.intervals.areas.length > 0
      ) {
        this.createPathIntervals(serie);
      }
    }
  }

  /**
   * Positions all non scaled elements on the well defined and calibrated axes.
   */
  private positionNonScaledElements() {
    const chartDef = this.chartDef;

    chartDef.series.forEach((serie, serieIndex) => {
      this.positionNonScaledElementsForSerie(serieIndex);
    });
  }

  /**
   * Extracts path definitions for line/area intervals. These are unlike other
   * interval marks in that they span multiple the points in the serie: if an
   * interval contains null values then multiple lines or areas are rendered for
   * that interval; otherwise one line or area is used for the entire interval.
   * @param serie The serie for which to create the paths.
   */
  private createPathIntervals(serie: SerieDefinition) {
    const paths: {[key: number]: AnyDuringMigration} = {};
    const serieIntervals = serie.intervals!;
    const settings = serieIntervals.settings;

    serieIntervals.paths = [];

    /**
     * Tests if an interval is a path-interval.
     * @param columnIndex Identifies the interval.
     * @return True if the interval identified by the column index has a style of 'line' or 'area'.
     */
    const intervalIsPathInterval = (columnIndex: number): boolean => {
      const style = settings[columnIndex].style;
      return style === IntervalStyle.AREA || style === IntervalStyle.LINE;
    };

    /**
     * Adds vertices from an intervalRect to the path associated with an
     * interval.
     * @param columnIndex Identifies the interval.
     * @param rect The rectangle that defines a point on the interval. If the interval-style is a line then only the top-left of the rectangle is used, otherwise the height (or width, depending on the chart's orientation) is used to calculate the return-path (the "bottom") of the area polygon.
     */
    const addPathVerticesFromIntervalRect = (
      columnIndex: number,
      rect: Rect,
    ) => {
      if (!(paths as AnyDuringMigration)[columnIndex]) {
        addIntervalPath(columnIndex);
      }
      (paths as AnyDuringMigration)[columnIndex].line.push(
        new Vec2(rect.left, rect.top),
      );
      if ((paths as AnyDuringMigration)[columnIndex].bottom) {
        (paths as AnyDuringMigration)[columnIndex].bottom.push(
          new Vec2(rect.left + rect.width, rect.top + rect.height),
        );
      }
    };

    /**
     * Creates a new, empty, path for an interval. This function is called once
     * (per interval) at the start of the serie, and then again if the interval
     * path is broken by a non-interpolated null value.
     * @param columnIndex Identifies the interval.
     */
    const addIntervalPath = (columnIndex: number) => {
      const brush = settings[columnIndex].brush.clone();
      const style = settings[columnIndex].style;
      const path = {};
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'columnIndex' does not exist on type '{}'.
      // @ts-ignore
      path.columnIndex = columnIndex;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'line' does not exist on type '{}'.
      // @ts-ignore
      path.line = [];
      if (style === IntervalStyle.AREA) {
        // Special case: force the strokeWidth to be 0.
        // TODO(dlaliberte) Allow user options to override.
        brush.setStrokeWidth(0);
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'bottom' does not exist on type '{}'.
        // @ts-ignore
        path.bottom = [];
      } else {
        brush.setFillOpacity(0);
      }
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'brush' does not exist on type '{}'.
      // @ts-ignore
      path.brush = brush;
      (paths as AnyDuringMigration)[columnIndex] = path;
    };

    /**
     * Creates the set of points used to draw a single line or area for an
     * interval. This function is called either at the end of a serie, or when
     * no value is found for a point in an interval and interpolateNulls is not
     * enabled.
     * @param columnIndex Identifies the interval whose path is to be pushed to the serie.intervals.paths list.
     */
    const flushIntervalPath = (columnIndex: number) => {
      const path = (paths as AnyDuringMigration)[columnIndex];
      delete (paths as AnyDuringMigration)[columnIndex];

      if (path && path.line.length > 1) {
        if (path.bottom) {
          path.bottom.reverse();
        }
        if (settings[columnIndex].curveType !== CurveType.NONE) {
          const isFunction =
            settings[columnIndex].curveType === CurveType.FUNCTION;
          const smoothingFactor = settings[columnIndex].smoothingFactor;
          path.controlPoints = calculateControlPoints(
            path.line,
            smoothingFactor,
            isFunction,
            false,
            false,
          );
          if (path.bottom) {
            path.bottomControlPoints = calculateControlPoints(
              path.bottom,
              smoothingFactor,
              isFunction,
              false,
              false,
            );
          }
        }
        serieIntervals.paths!.push(path);
      }
    };

    // The main loop of the path-interval extraction. The structure is to loop
    // over the rectangles (inner-loop) of each point in the serie (outer-loop).
    // Where interval-values are null, the rect for an interval may be missing,
    // in which case, unless interpolateNulls is enabled, the path to that point
    // is flushed to the serie.intervals.path data structure. Otherwise, the
    // paths are flushed after the last point has been processed.
    for (let i = 0; i < serie.points.length; i++) {
      /**
       * For the current point, note which intervals have non-null values. If no
       * value was seen for an interval, and interpolateNulls is disabled, then
       * the path is flushed (to be restarted later if future points have values
       * for the interval).
       */
      const seenColumnIndices: {[key: number]: boolean} = {};

      const point = serie.points[i];
      if (point && point.scaled && point.scaled.intervalRects) {
        const intervalRects = point.scaled.intervalRects;
        for (let rectIndex = 0; rectIndex < intervalRects.length; ++rectIndex) {
          const columnIndex = intervalRects[rectIndex].columnIndex;
          if (intervalIsPathInterval(columnIndex)) {
            seenColumnIndices[columnIndex] = true;
            addPathVerticesFromIntervalRect(
              columnIndex,
              intervalRects[rectIndex].rect,
            );
          }
        }
      }

      // Flush any path that didn't get a value for this point (unless
      // interpolateNulls is disabled for the interval).
      for (const columnIndex in paths) {
        // tslint:disable-next-line:ban-unsafe-reflection
        if (!paths.hasOwnProperty(columnIndex)) continue;
        const columnIndexNum = Number(columnIndex);
        if (
          !seenColumnIndices[columnIndexNum] &&
          !settings[columnIndexNum].interpolateNulls
        ) {
          flushIntervalPath(columnIndexNum);
        }
      }
    }

    // End of serie: flush all paths that have not already been flushed.
    for (const columnIndex in paths) {
      // tslint:disable-next-line:ban-unsafe-reflection
      if (!paths.hasOwnProperty(columnIndex)) continue;
      flushIntervalPath(Number(columnIndex));
    }
  }

  /**
   * Chooses, based on the given serie, how a non-scaled datum visual element
   * should be transformed to a scaled datum visual element.
   * @param serie The serie for which to decide.
   * @return The transforming function.
   */
  private chooseScaleFunctionForSerie(
    serie: SerieDefinition,
  ): (p1: NonScaledDatumDefinition) => ScaledDatumDefinition | null {
    switch (serie.type) {
      case SerieType.SCATTER:
        return this.scaleScatterPoint.bind(this, serie);
      case SerieType.BUBBLES:
        return this.scaleBubblePoint.bind(this, serie);
      case SerieType.LINE:
        return this.scaleLinePoint.bind(this, serie);
      case SerieType.BARS:
        return this.scaleBar.bind(this, serie);
      case SerieType.STEPPED_AREA:
        return this.scaleSteppedArea.bind(this, serie);
      case SerieType.CANDLESTICKS:
        return this.scaleCandlestick.bind(this, serie);
      case SerieType.BOXPLOT:
        return this.scaleBoxplot.bind(this, serie);
      case SerieType.AREA:
        return this.scaleAreaPoint.bind(this, serie);
      default:
        throw new Error(`Unsupported serie type: ${serie.type}`);
    }
  }

  /**
   * Transforms a non scaled point in a scatter chart to a properly scaled
   * point.
   *
   * @param serie The serie.
   * @param nonScaledPoint The point to scale.
   * @return The scaled point.
   */
  private scaleScatterPoint(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition {
    // Being it a scatter chart, it can be assumed that both hAxis[0] and
    // vAxis[0] exist.
    assert(this.hAxisDefiners != null && this.hAxisDefiners[0]);
    assert(this.vAxisDefiners != null && this.vAxisDefiners[0]);
    const x = this.hAxisDefiners![0].calcPositionForNumericValue(
      nonScaledPoint.x,
    );
    const y = this.vAxisDefiners![0].calcPositionForNumericValue(
      nonScaledPoint.y,
    );
    return {x, y} as ScaledDatumDefinition;
  }

  /**
   * Transforms a non scaled point in a bubble chart to a properly scaled point.
   *
   * @param serie The serie.
   * @param nonScaledPoint The point to scale.
   * @return The scaled point.
   */
  private scaleBubblePoint(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition {
    // Being it a bubble chart, it can be assumed that both hAxis[0] and
    // vAxis[0] exist.
    assert(this.hAxisDefiners != null && this.hAxisDefiners[0]);
    assert(this.vAxisDefiners != null && this.vAxisDefiners[0]);
    assert(this.bubbleChartDefiner);
    return this.bubbleChartDefiner!.scaleBubble(
      this.hAxisDefiners![0],
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'VerticalAxisDefiner' is not assignable to parameter of type 'AxisDefiner'.
      // @ts-ignore
      this.vAxisDefiners![0],
      nonScaledPoint,
    );
  }

  /**
   * Transforms a non scaled point in a line chart to a properly scaled point.
   *
   * @param serie The serie.
   * @param nonScaledPoint The point to scale.
   * @return The scaled point.
   */
  private scaleLinePoint(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition {
    const scaled = this.getPhysicalPositionByFunctionValues(
      serie.targetAxisIndex,
      nonScaledPoint.d,
      nonScaledPoint.t,
    );
    scaled.intervalRects = this.scaleIntervals(serie, nonScaledPoint);
    return scaled;
  }

  /**
   * Transforms a non scaled column in a column or bar chart to a properly
   * scaled one, in screen space.  The width and height will be at least half a
   * pixel.
   * TODO(dlaliberte): Rendering zero width or height should look like a line.
   *
   * @param serie The serie.
   * @param nonScaledPoint The column to scale.
   * @return The scaled bar.
   */
  private scaleBar(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition | null {
    const scaled = this.scaleBarlike(
      serie,
      nonScaledPoint,
      nonScaledPoint.from,
      nonScaledPoint.to,
    );
    if (!scaled) {
      return null;
    }
    return {
      top: scaled.top,
      left: scaled.left,
      width: Math.max(0.5, scaled.width),
      height: Math.max(0.5, scaled.height),
      intervalRects: this.scaleIntervals(serie, nonScaledPoint),
    } as ScaledDatumDefinition;
  }

  /**
   * Transform a non-scaled candlestick to a scaled one.
   * A candlestick consists of a rectangle and a line, each of which
   * behave roughly like a column in a bar chart.
   *
   * @param serie The serie.
   * @param nonScaledPoint The candlestick to scale.
   * @return The scaled candlestick.
   */
  private scaleCandlestick(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition | null {
    const rect = this.scaleBarlike(
      serie,
      nonScaledPoint,
      nonScaledPoint.rectFrom,
      nonScaledPoint.rectTo,
    );
    const line = this.scaleBarlike(
      serie,
      nonScaledPoint,
      nonScaledPoint.lineFrom,
      nonScaledPoint.lineTo,
    );
    if (!rect || !line) {
      return null;
    }

    // TODO(dlaliberte): The line width should match the stroke width of a hollow bar,
    // but this requires access to the serie the candlestick belongs to.
    const position = this.getFunctionPositionByPhysicalPositions(
      line.left,
      line.top,
    );
    const rectSize = this.getFunctionPositionByPhysicalPositions(
      rect.width,
      rect.height,
    );
    const size = this.getFunctionPositionByPhysicalPositions(
      line.width,
      line.height,
    );
    size.domain = 2;
    const lineWidth = rectSize.domain % 2 ? 3 : 2;
    position.domain += (rectSize.domain - lineWidth) / 2;

    const screenPosition = this.getPhysicalPositionByFunctionPositions(
      position.domain,
      position.target,
    );
    const screenSize = this.getPhysicalPositionByFunctionPositions(
      size.domain,
      size.target,
    );
    line.width = screenSize.x;
    line.height = screenSize.y;
    line.left = screenPosition.x;
    line.top = screenPosition.y;

    // A shape's stroke extends equally inwards and outwards (that is, a stroke
    // of 4 pixels will extend 2 pixels into the shape and 2 pixels out of it).
    // Since we wish bars to have the same size regardless of whether they are
    // hollow or full we shrink hollow bars so that together with the stroke
    // they will match the size of a full bar and not exceed it.
    // TODO(dlaliberte): This is a general graphics utility that should be placed in
    // a more appropriate location. Make sure we handle cases in which the
    // stroke has to be reduced (since the size of the box is lower than the
    // stroke width.

    const barBrush = this.getCandleStickBrush(nonScaledPoint.inverted, serie);
    if (barBrush.hasStroke()) {
      const strokeCompensation = barBrush.getStrokeWidth() / 2;
      rect.height = rect.height - 2 * strokeCompensation;
      rect.width = rect.width - 2 * strokeCompensation;
      rect.left += strokeCompensation;
      rect.top += strokeCompensation;
    }
    // Even if open + close were the same, use a line to show where they were.
    rect.height = Math.max(rect.height, 2);
    rect.width = Math.max(rect.width, 1);

    return {rect, line} as unknown as ScaledDatumDefinition;
  }

  /**
   * Transform a non-scaled boxplot to a scaled one.
   * A boxplot consists of a rectangle and a line, each of which
   * behave roughly like a column in a bar chart.
   *
   * @param serie The serie.
   * @param nonScaledPoint The candlestick to scale.
   * @return The scaled candlestick.
   */
  private scaleBoxplot(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition | null {
    const rect = this.scaleBarlike(
      serie,
      nonScaledPoint,
      nonScaledPoint.rectFrom,
      nonScaledPoint.rectTo,
    );
    const bottomRect = this.scaleBarlike(
      serie,
      nonScaledPoint,
      nonScaledPoint.rectMiddleLine,
      nonScaledPoint.rectTo,
    );
    const topRect = this.scaleBarlike(
      serie,
      nonScaledPoint,
      nonScaledPoint.rectFrom,
      nonScaledPoint.rectMiddleLine,
    );
    const line = this.scaleBarlike(
      serie,
      nonScaledPoint,
      nonScaledPoint.lineFrom,
      nonScaledPoint.lineTo,
    );
    if (!bottomRect || !topRect || !rect || !line) {
      return null;
    }

    const position = this.getFunctionPositionByPhysicalPositions(
      line.left,
      line.top,
    );
    const rectSize = this.getFunctionPositionByPhysicalPositions(
      rect.width,
      rect.height,
    );
    const size = this.getFunctionPositionByPhysicalPositions(
      line.width,
      line.height,
    );
    size.domain = 2;
    const lineWidth = rectSize.domain % 2 ? 3 : 2;
    position.domain += (rectSize.domain - lineWidth) / 2;

    const screenPosition = this.getPhysicalPositionByFunctionPositions(
      position.domain,
      position.target,
    );
    const screenSize = this.getPhysicalPositionByFunctionPositions(
      size.domain,
      size.target,
    );
    line.width = screenSize.x;
    line.height = screenSize.y;
    line.left = screenPosition.x;
    line.top = screenPosition.y;

    // A shape's stroke extends equally inwards and outwards (that is, a stroke
    // of 4 pixels will extend 2 pixels into the shape and 2 pixels out of it).
    // Since we wish bars to have the same size regardless of whether they are
    // hollow or full we shrink hollow bars so that together with the stroke
    // they will match the size of a full bar and not exceed it.
    // TODO(dlaliberte): This is a general graphics utility that should be placed in
    // a more appropriate location. Make sure we handle cases in which the
    // stroke has to be reduced (since the size of the box is lower than the
    // stroke width.

    const barBrush = this.getBoxplotBrush(serie);
    if (barBrush.hasStroke()) {
      const strokeCompensation = barBrush.getStrokeWidth() / 2;
      rect.height = rect.height - 2 * strokeCompensation;
      rect.width = rect.width - 2 * strokeCompensation;
      rect.left += strokeCompensation;
      rect.top += strokeCompensation;
    }
    // Even if open + close were the same, use a line to show where they were.
    rect.height = Math.max(rect.height, 2);
    rect.width = Math.max(rect.width, 1);

    return {
      line,
      rect,
      bottomRect,
      topRect,
    } as unknown as ScaledDatumDefinition;
  }

  /**
   * Gets the brush used to draw the candlestick.
   * @param inverted True iff the candlestick is inverted (falling).
   * @param serie The serie it belongs to.
   * @return The brush used to draw the candlestick.
   */
  private getCandleStickBrush(
    inverted: boolean,
    serie: SerieDefinition,
  ): Brush {
    return inverted
      ? serie.candlestick!.fallingBrush
      : serie.candlestick!.risingBrush;
  }

  /**
   * Gets the brush used to draw the candlestick.
   * @param serie The serie it belongs to.
   * @return The brush used to draw the boxplot.
   */
  private getBoxplotBrush(serie: SerieDefinition): Brush {
    // TODO(dlaliberte): Either boxplot should have a barBrush, or this
    // method will always return undefined.
    return (serie.boxplot! as unknown as {barBrush: Brush}).barBrush;
  }

  /**
   * Gets the brush used to draw background or foreground bars in diff chart.
   * @param serie The serie it belongs to.
   * @param columnRole column role for point to which brush must be set.
   * @return The brush used to draw the bar; may be null when we want the default serie brush to be used for bar.
   */
  private getDiffBarBrush(
    serie: SerieDefinition,
    columnRole: ColumnRole | null,
  ): Brush | null {
    return columnRole === DIFF_OLD_DATA
      ? serie.diff!.background.pointBrush
      : null;
  }

  /**
   * Bar chart scaling, but without margin between bars.
   * TODO(dlaliberte): Combine with scaleBarChart.
   *
   * @param serie The serie.
   * @param nonScaledPoint The column to scale.
   * @return The scaled bar.
   */
  private scaleSteppedArea(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition | null {
    // TODO(dlaliberte): This has nothing to do with scaling. Move to calc phase.
    const targetAxis = this.getTargetAxisDefiner(serie.targetAxisIndex);
    if (nonScaledPoint.from == null) {
      nonScaledPoint.from = targetAxis.valueScale!.valueToNumber(
        targetAxis.baseline!.dataValue,
      ) as number;
      if (nonScaledPoint.from == null) {
        nonScaledPoint.from = 0; // Works better than null.
      }
    }

    const domainAxis = this.domainAxisDefiner;
    const division = nonScaledPoint.division;
    let domainFrom;
    let domainTo;

    if (this.variableWidth || domainAxis!.valueScale) {
      if (nonScaledPoint.dPrevious == null) {
        return null;
      }
      domainFrom = Math.floor(
        domainAxis!.calcPosForNumOrError(nonScaledPoint.dPrevious),
      );
      domainTo = Math.floor(domainAxis!.calcPosForNumOrError(nonScaledPoint.d));
      domainAxis!.extendRangeToIncludeNumber(nonScaledPoint.dPrevious);
      domainAxis!.extendRangeToIncludeNumber(nonScaledPoint.d);
    } else {
      // TODO(dlaliberte) It is wrong to use the domainAxis ticks.
      const divisionMiddle = domainAxis!.ticks[division].coordinate || 0;
      // Note: domainAxis.subdivisionWidth assumes whitespace between bars.
      const divisionWidth = domainAxis!.numericValueToPixelsFactor;

      domainFrom = Math.floor(
        divisionMiddle - (domainAxis!.direction * divisionWidth) / 2,
      );
      domainTo = Math.floor(
        divisionMiddle + (domainAxis!.direction * divisionWidth) / 2,
      );
      domainAxis!.extendRangeToIncludeNumber(nonScaledPoint.d);
    }

    // Target from/to (assuming horizontal orientation).
    // TODO(dlaliberte): Why only floor domain values to integers and ignore target
    // values (moreover doing so before taking orientation into account).
    const targetFrom = targetAxis.calcPositionForNumericValue(
      nonScaledPoint.from,
    );
    const targetTo = targetAxis.calcPositionForNumericValue(nonScaledPoint.to);

    // Take orientation into account to obtain x/y coordinates of the corners.
    // Corners of the bar are arranged as following under horizontal
    // orientation:
    //    3 4
    //    1 2
    // And as following under vertical orientation:
    //    1 3
    //    2 4
    const corner1 = this.getPhysicalPositionByFunctionPositions(
      domainFrom,
      targetFrom,
    );
    const corner3 = this.getPhysicalPositionByFunctionPositions(
      domainFrom,
      targetTo,
    );
    const corner4 = this.getPhysicalPositionByFunctionPositions(
      domainTo,
      targetTo,
    );

    // Note: We used to place the outline inside the step and not on its border
    // to avoid distorting the real size of the step and avoid having half the
    // line being darker due to overlap with the step stacked on top. However,
    // this cannot work when one step has a positive value and the following
    // step has a negative value. Therefore we choose the lesser of two evils,
    // and place the outline on the border of the step.
    const outline = [];
    // TODO(dlaliberte): Add to chart definition instead of inferring over and over.
    const connectSteps = this.options.inferBooleanValue('connectSteps', true);
    if (connectSteps) {
      // Do not connect the first step of a serie, or the first step following a
      // null value.
      if (nonScaledPoint.previousTo != null) {
        // No space between steps on domain axis.
        const previousDomainTo = domainFrom;
        const previousTargetTo = targetAxis.calcPositionForNumericValue(
          nonScaledPoint.previousTo,
        );
        const previousCorner4 = this.getPhysicalPositionByFunctionPositions(
          previousDomainTo,
          previousTargetTo,
        );
        outline.push(previousCorner4);
      }
    }
    outline.push(corner3);
    outline.push(corner4);

    return {
      bar: cornersToRectangle(
        assertNumber(corner1.x),
        assertNumber(corner1.y),
        assertNumber(corner4.x),
        assertNumber(corner4.y),
      ),
      outline,
      intervalRects: this.scaleIntervals(serie, nonScaledPoint),
    } as ScaledDatumDefinition;
  }

  /**
   * @param targetAxis The target axis.
   * @param from The nonscaled from value.
   * @param to The nonscaled to value.
   * @return The minimum position for a scaled bar.
   */
  private getBarScaledMin(
    targetAxis: AxisDefiner,
    from: number,
    to: number,
  ): number {
    return Math.min(
      targetAxis.calcPosForNumOrError(from),
      targetAxis.calcPosForNumOrError(to),
    );
  }

  /**
   * @param targetAxis The target axis.
   * @param from The nonscaled from value.
   * @param to The nonscaled to value.
   * @return The maximum position for a scaled bar.
   */
  private getBarScaledMax(
    targetAxis: AxisDefiner,
    from: number,
    to: number,
  ): number {
    return Math.max(
      targetAxis.calcPosForNumOrError(from),
      targetAxis.calcPosForNumOrError(to),
    );
  }

  /**
   * Scales a single bar-like object.
   *
   * @param serie The serie.
   * @param nonScaledPoint The column to scale.
   * @param from The lower value of the bar.
   * @param to The upper value of the bar.
   * @return The scaled bar (rectangle).
   */
  private scaleBarlike(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
    from: number,
    to: number,
  ): ScaledDatumDefinition | null {
    const domainAxis = this.domainAxisDefiner;
    const targetAxis = this.getTargetAxisDefiner(serie.targetAxisIndex);
    assert(targetAxis != null);
    assert(this.divisionDefinition != null);
    const divisionDef = this.divisionDefinition!;

    const targetBaseline = targetAxis.valueScale!.valueToNumber(
      targetAxis.baseline!.dataValue,
    );
    if (from == null) {
      from = targetBaseline || 0;
    }
    if (to == null) {
      to = targetBaseline || 0;
    }

    let scaledMin = this.getBarScaledMin(targetAxis, from, to);
    let scaledMax = this.getBarScaledMax(targetAxis, from, to);

    let margin; // Vertical space between stacked bars.
    if (this.chartDef.chartType === ChartType.HISTOGRAM) {
      // For histogram, sub-pixel margins wind up looking stripey -- tiny bars
      // of the same color nearly adjacent to each other get helpfully
      // antialiased and we wind up with weird halftone effects. So for
      // histograms only, if bars are less than 4 pixels tall, use no margin,
      // otherwise use 1px margin. See b/11111514.

      if (
        this.treatHistogramAsColumnChart(
          targetAxis.numericValueToPixelsFactor,
          this.options.inferBooleanValue('histogram.hideBucketItems'),
        )
      ) {
        margin = 0;
      } else {
        margin = 1;
      }
    } else {
      // Margin should default to min of 1 pixel and 20% of the bar.
      // TODO(dlaliberte) Use an option here.
      margin = Math.min(1, 0.2 * (scaledMax - scaledMin));
    }

    // If rounding the bars will not cause the bar to disappear or the margin
    // to disappear, round the bar, otherwise, keep the bar anti aliased.
    // Additionally, if the margin is zero, always round.
    if (
      margin === 0 ||
      (Math.floor(scaledMin + margin) < Math.floor(scaledMax) &&
        Math.floor(scaledMin + margin) > Math.floor(scaledMin))
    ) {
      scaledMin = Math.floor(scaledMin + margin);
      scaledMax = Math.floor(scaledMax);
    } else {
      scaledMin += margin;
    }

    // Scales when serie corresponds to foreground bars in diff chart,
    // with new data.
    const newDataWidthScaleFactor = this.options.inferNumberValue(
      'diff.newData.widthFactor',
      DEFAULT_DIFF_NEW_DATA_WIDTH_FACTOR,
    );
    const widthScaleFactor = nonScaledPoint.isDiffForeground
      ? newDataWidthScaleFactor
      : 1.0;

    let domainAxisFrom;
    let domainAxisTo;

    if (this.variableWidth) {
      if (nonScaledPoint.dPrevious == null) {
        return null;
      }
      domainAxisFrom = Math.floor(
        domainAxis!.calcPosForNumOrError(nonScaledPoint.dPrevious),
      );
      domainAxisTo = Math.floor(
        domainAxis!.calcPosForNumOrError(nonScaledPoint.d),
      );
      domainAxis!.extendRangeToIncludeNumber(nonScaledPoint.dPrevious);
    } else {
      // Defines bar's center and width on domain axis.
      const domainAxisBarCenter =
        this.getPointCenterAlongDomainAxis(nonScaledPoint);

      const barHalfWidth =
        (widthScaleFactor * divisionDef.subdivisionWidth) / 2;

      domainAxisFrom = divisionDef.roundingFunction(
        domainAxisBarCenter - barHalfWidth,
      );
      domainAxisTo = divisionDef.roundingFunction(
        domainAxisBarCenter + barHalfWidth,
      );
    }

    /* Expand axis to include entire bar.
     * This doesn't work, unfortunately, because the axis is already
     * initialized, which it needs to be in order to determine the data/pixel
     * ratio.
     */
    domainAxis!.extendRangeToIncludeNumber(
      domainAxis!.calcNumericValueFromPosition(domainAxisFrom),
    );
    domainAxis!.extendRangeToIncludeNumber(
      domainAxis!.calcNumericValueFromPosition(domainAxisTo),
    );

    const corner1 = this.getPhysicalPositionByFunctionPositions(
      domainAxisFrom,
      scaledMin,
    );
    const corner2 = this.getPhysicalPositionByFunctionPositions(
      domainAxisTo,
      scaledMax,
    );
    const rect = cornersToRectangle(
      assertNumber(corner1.x),
      assertNumber(corner1.y),
      assertNumber(corner2.x),
      assertNumber(corner2.y),
    );
    return rect as unknown as ScaledDatumDefinition;
  }

  /**
   * Transforms a non scaled point in an area chart to a properly scaled point.
   *
   * @param serie The serie.
   * @param nonScaledPoint The point to scale.
   * @return The scaled point.
   */
  private scaleAreaPoint(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): ScaledDatumDefinition {
    const targetAxis = this.getTargetAxisDefiner(serie.targetAxisIndex);
    const targetNumericBaseline = targetAxis.valueScale!.valueToNumber(
      targetAxis.baseline!.dataValue,
    );
    const bottom = targetNumericBaseline != null ? targetNumericBaseline : 0;
    const applyBaseline = (v: AnyDuringMigration) => (v != null ? v : bottom);

    const p = this.getPhysicalPositionByFunctionValues(
      serie.targetAxisIndex,
      nonScaledPoint.d,
      nonScaledPoint.t,
    );
    const bottomFrom = this.getPhysicalPositionByFunctionValues(
      serie.targetAxisIndex,
      nonScaledPoint.bottomFromD,
      applyBaseline(nonScaledPoint.bottomFromT),
    );
    const bottomTo = this.getPhysicalPositionByFunctionValues(
      serie.targetAxisIndex,
      nonScaledPoint.bottomToD,
      applyBaseline(nonScaledPoint.bottomToT),
    );
    const continueFrom = this.getPhysicalPositionByFunctionValues(
      serie.targetAxisIndex,
      nonScaledPoint.continueFromD,
      applyBaseline(nonScaledPoint.continueFromT),
    );
    const continueTo = this.getPhysicalPositionByFunctionValues(
      serie.targetAxisIndex,
      nonScaledPoint.continueToD,
      applyBaseline(nonScaledPoint.continueToT),
    );
    const intervalRects = this.scaleIntervals(serie, nonScaledPoint);

    return {
      x: p.x,
      y: p.y,
      bottomFromX: bottomFrom.x,
      bottomFromY: bottomFrom.y,
      bottomToX: bottomTo.x,
      bottomToY: bottomTo.y,
      continueFromX: continueFrom.x,
      continueFromY: continueFrom.y,
      continueToX: continueTo.x,
      continueToY: continueTo.y,
      intervalRects,
    } as ScaledDatumDefinition;
  }

  /**
   * Transforms the interval definitions of a point to a set of scaled
   * rectangles.
   *
   * @param serie The serie.
   * @param nonScaledPoint The point to scale. Intervals are defined on the point in its intervalMarks list property.
   * @return The scaled interval definitions. If the interval mark is a line then either width or height of the rectangle will be zero. For points, both width and height will be zero.
   */
  private scaleIntervals(
    serie: SerieDefinition,
    nonScaledPoint: NonScaledDatumDefinition,
  ): Array<{rect: Rect; columnIndex: number}> {
    if (!nonScaledPoint.intervalMarks) {
      return [];
    }

    const domainAxis = this.domainAxisDefiner;
    const targetAxis = this.getTargetAxisDefiner(serie.targetAxisIndex);
    assert(this.divisionDefinition != null);
    const divisionDef = this.divisionDefinition!;

    if (
      nonScaledPoint.subdivision >= divisionDef.numSubdivisions ||
      (domainAxis!.type !== AxisType.VALUE && // TODO(dlaliberte) This use of domainAxis.ticks looks wrong.
        nonScaledPoint.division >= domainAxis!.ticks.length)
    ) {
      return [];
    }

    let domainCenter = this.getPointCenterAlongDomainAxis(nonScaledPoint);
    let domainSpacing;
    const roundingFunction = divisionDef.roundingFunction;

    if (this.variableWidth) {
      domainSpacing =
        domainAxis!.calcPosForNumOrError(nonScaledPoint.d) -
        domainAxis!.calcPosForNumOrError(nonScaledPoint.dPrevious);
      domainCenter = domainCenter - domainSpacing / 2;
    } else {
      domainSpacing = divisionDef.subdivisionWidth + divisionDef.subdivisionGap;
    }

    const intervalRects = [];
    for (let i = 0, mark; (mark = nonScaledPoint.intervalMarks[i]); i++) {
      // TODO(dlaliberte) Unify this with scaleBarlike.
      const highPosition = targetAxis.calcPosForNumOrError(mark.highT);
      const lowPosition = targetAxis.calcPosForNumOrError(mark.lowT);

      const domainSize = domainSpacing * mark.spanD;
      const barHalfWidth = domainSize / 2;

      const domainAxisFrom = roundingFunction(domainCenter - barHalfWidth);
      const domainAxisTo = roundingFunction(domainCenter + barHalfWidth);

      /* Expand the domain axis to include the interval.
       * Doesn't work, unfortunately, because the axis is already initialized.
       * TODO(dlaliberte) Make this work
       *  domainAxis.extendRangeToIncludeNumber(
       *   domainAxis.calcNumericValueFromPosition(domainAxisFrom));
       *  domainAxis.extendRangeToIncludeNumber(
       *  domainAxis.calcNumericValueFromPosition(domainAxisTo));
       */

      const corner1 = this.getPhysicalPositionByFunctionPositions(
        domainAxisFrom,
        Math.min(lowPosition, highPosition),
      );
      const corner2 = this.getPhysicalPositionByFunctionPositions(
        domainAxisTo,
        Math.max(lowPosition, highPosition),
      );
      const rect = cornersToRectangle(
        assertNumber(corner1.x),
        assertNumber(corner1.y),
        assertNumber(corner2.x),
        assertNumber(corner2.y),
      );

      intervalRects.push({
        rect,
        columnIndex: mark.columnIndex,
        brush: mark.brush,
      });
    }

    return intervalRects;
  }

  /**
   * Returns a non-scaled point's center along the domain axis.
   * Used for bar-like chart elements including intervals.
   *
   * @param nonScaledPoint The point.
   * @return The point's center along the domain axis.
   */
  private getPointCenterAlongDomainAxis(
    nonScaledPoint: NonScaledDatumDefinition,
  ): number {
    const domainAxis = this.domainAxisDefiner;
    assert(this.divisionDefinition != null);
    const divisionDef = this.divisionDefinition!;

    let targetNumericValue;
    if (domainAxis!.type === AxisType.VALUE) {
      targetNumericValue = domainAxis!.calcPosForNumOrError(nonScaledPoint.d);
    } else {
      // TODO(dlaliberte) This use of domainAxis.ticks is wrong in the case
      // that there are no ticks, or ticks don't correspond to bars.
      targetNumericValue = assertNumber(
        domainAxis!.ticks &&
          domainAxis!.ticks[nonScaledPoint.division] &&
          domainAxis!.ticks[nonScaledPoint.division].coordinate,
      );
    }

    if (this.variableWidth) {
      return targetNumericValue;
    } else {
      const barGap = divisionDef.subdivisionGap;
      const barWidth = divisionDef.subdivisionWidth;
      return (
        targetNumericValue - // Subtract the divisionOffsetFromTick to get to left edge of group.
        divisionDef.divisionOffsetFromTick + // Add subdivision width offset to get the ith bar.
        (barWidth + barGap) * nonScaledPoint.subdivision + // Add half bar width to get to center of bar.
        barWidth / 2
      );
    }
  }

  /**
   * Create a function point (with domain and target coordinates) from physical
   * horizontal/vertical coordinates. The created function point matches the
   * horizontal/vertical coordinates depending on the orientation of the chart.
   * Either domain is mapped to horizontal and target is mapped to vertical, or
   * vice versa.
   *
   * @param horizontalPos The horizontal coordinate.
   * @param verticalPos The vertical coordinate.
   * @return The function point.
   */
  private getFunctionPositionByPhysicalPositions<T>(
    horizontalPos: T,
    verticalPos: T,
  ): {domain: T; target: T} {
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'T' is not assignable to parameter of type 'number'.
    // @ts-ignore
    assert(!isNaN(horizontalPos));
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'T' is not assignable to parameter of type 'number'.
    // @ts-ignore
    assert(!isNaN(verticalPos));
    switch (this.chartDef.orientation) {
      case Orientation.HORIZONTAL:
        return {domain: horizontalPos, target: verticalPos};
      case Orientation.VERTICAL:
        return {domain: verticalPos, target: horizontalPos};
      default:
        throw new Error('Invalid orientation.');
    }
  }

  /**
   * Create a physical point (with X and Y coordinates) from logical
   * domain/target coordinates. The created physical point matches the
   * domain/target coordinates depending on the orientation of the chart. Either
   * domain is mapped to horizontal and target is mapped to vertical, or vice
   * versa.
   *
   * @param domainPos The domain coordinate.
   * @param targetPos The target coordinate.
   * @return The physical point.
   */
  private getPhysicalPositionByFunctionPositions<T>(
    domainPos: T,
    targetPos: T,
  ): {x: T; y: T} {
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'T' is not assignable to parameter of type 'number'.
    // @ts-ignore
    assert(!isNaN(domainPos));
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'T' is not assignable to parameter of type 'number'.
    // @ts-ignore
    assert(!isNaN(targetPos));
    switch (this.chartDef.orientation) {
      case Orientation.HORIZONTAL:
        return {x: domainPos, y: targetPos};
      case Orientation.VERTICAL:
        return {x: targetPos, y: domainPos};
      default:
        throw new Error('Invalid orientation.');
    }
  }

  /**
   * Similar to getPhysicalPositionByFunctionPositions above, but works on
   * values from the original data.
   *
   * @param targetAxisIndex The index of the target axis relative to which the point should be positioned.
   * @param domainValue The domain value.
   * @param targetValue The target value.
   * @return The physical point.
   */
  private getPhysicalPositionByFunctionValues(
    targetAxisIndex: number,
    domainValue: number | null,
    targetValue: number | null,
  ): ScaledDatumDefinition {
    const domainAxisDefiner = this.domainAxisDefiner;
    const targetAxisDefiner = this.getTargetAxisDefiner(targetAxisIndex);

    const d = domainAxisDefiner!.calcPositionForNumericValue(domainValue);
    const t = targetAxisDefiner.calcPositionForNumericValue(targetValue);
    const point = this.getPhysicalPositionByFunctionPositions(d, t);
    return point as ScaledDatumDefinition;
  }

  /**
   * Creates a brush for drawing an 'uncertain' element, based on the normal
   * brush used for such 'certain' elements.
   *
   * @param normalBrush The normal brush used for 'certain' elements.
   * @param needStroking If true then make sure there's a stroke around the stripes pattern.
   *
   * @return The 'uncertain' brush.
   */
  private createUncertainBrush(
    normalBrush: Brush,
    needStroking: boolean,
  ): Brush {
    // Start with the normal brush.
    const brush = normalBrush.clone();

    // If the brush has a fill color make it uncertain by "striping" it.
    if (brush.hasFill() && brush.getFill() !== '#ffffff') {
      brush.setPattern(
        new Pattern(PatternStyle.PRIMARY_DIAGONAL_STRIPES, brush.getFill()),
      );
      // Make sure there's a stroke around the stripes pattern. Relevant only if
      // the normal brush has a fill.
      if (!brush.hasStroke() && needStroking) {
        brush.setStroke(brush.getFill());
        brush.setStrokeWidth(1);
      }
    } else if (brush.hasStroke()) {
      // If the brush has a stroke but no fill, dash it to make it look
      // uncertain.
      brush.setStrokeDashStyle(StrokeDashStyleType.DASH);
    }

    return brush;
  }

  /**
   * Creates a brush for drawing an emphasized element, based on the given brush
   * for such an element and the amount of emphasis it has (where 1 is the
   * default value). We basically multiply the stroke by the emphasis.
   *
   * @param normalBrush The normal brush used for these elements.
   * @param emphasis The emphasis for the requested brush.
   *
   * @return The emphasized brush.
   */
  private createEmphasizedBrush(normalBrush: Brush, emphasis: number): Brush {
    // Start with the normal brush.
    const brush = normalBrush.clone();
    brush.setStrokeWidth(brush.getStrokeWidth() * emphasis);
    return brush;
  }

  /**
   * Calculates the certainty [0..1] for a given data point.
   * The 'certainty' value is passed in the data as a separate column or
   * columns with role 'certainty'.
   * If there is more than one 'certainty' column, we take the first value.
   *
   * @param serie The serie object.
   * @param categoryIndex The category index.
   * @return The level of certainty [0..1].
   */
  private calcCertainty(serie: SerieDefinition, categoryIndex: number): number {
    const dataView = this.dataView;
    const certaintyColumns = serie.columns[CERTAINTY] || [];
    if (certaintyColumns.length) {
      const certainty = dataView.getValue(categoryIndex, certaintyColumns[0]);
      if (certainty != null) {
        // We consider boolean column differently than numeric.
        // For boolean, true means certain (value of 1).
        if (dataView.getColumnType(certaintyColumns[0]) === 'boolean') {
          return certainty ? 1 : 0;
        }
        // For numeric value, we simply return it as is.
        return certainty as number;
      }
    }
    return 1;
  }

  /**
   * Calculates the scope for a given data point.
   * The 'scope' value is passed in the data as a separate column or
   * columns with role 'scope'.
   * If there is more than one 'scope' column, we take the first value.
   *
   * @param serie The serie object.
   * @param categoryIndex The category index.
   * @return The scope, where false means "out-of-scope".
   */
  private calcScope(serie: SerieDefinition, categoryIndex: number): boolean {
    const dataView = this.dataView;
    const scopeColumns = serie.columns[SCOPE] || [];
    if (scopeColumns.length) {
      const scope = dataView.getValue(categoryIndex, scopeColumns[0]);
      if (scope != null) {
        return !!scope;
      }
    }
    return true;
  }

  /**
   * Calculates the emphasis for a given data point.
   * The 'emphasis' value is passed in the data as a separate column or
   * columns with role 'emphasis'.
   * If there is more than one 'emphasis' column, we take first value.
   *
   * @param serie The serie object.
   * @param categoryIndex The category index.
   * @return The emphasis of the point (higher = more emphasized).
   */
  private calcEmphasis(serie: SerieDefinition, categoryIndex: number): number {
    const dataView = this.dataView;
    const emphasisColumns = serie.columns[EMPHASIS] || [];
    if (emphasisColumns.length) {
      const emphasis = dataView.getValue(categoryIndex, emphasisColumns[0]);
      if (emphasis != null) {
        // We consider boolean column differently than numeric.
        // For boolean, true means emphasized (value of 2).
        if (dataView.getColumnType(emphasisColumns[0]) === 'boolean') {
          return emphasis ? 2 : 1;
        }
        // For numeric value, we simply return it as is.
        return emphasis as number;
      }
    }
    return 1;
  }

  /**
   * Calculates the gap for a given category.
   * The 'gap' value is passed in the data as a separate column with role 'gap'.
   * @param categoryIndex The category index.
   * @return The gap from the previous category, where null means the default gap.
   */
  private calcGap(categoryIndex: number): number | null {
    return null;
  }

  /**
   * Calculates the layout of interval markers for a point in a serie. Intervals
   * are represented as a set of boxes: each bar, stick, box, and point is given
   * its own box (error-bars, therefore, need three boxes: one for the
   * top/bottom bars, and another for the stick that joins them). Each box is
   * defined as the low/high values on the target-axis, and the 'span' that is
   * the proportion of the domain-axis (gridline) spacing used by the box. If
   * the high/low values are equal, or the span is zero, then a line is implied.
   * If both then a point.
   *
   * @param serie The serie for which to calculate the layout.
   * @param division The position of the point on the domain-axis.
   * @param offset An offset to be added to values on the target axis.
   * @param scalingFunc A function to scale the values.
   * @param shouldExtendTargetAxisRange Is point in the view window?
   * @return The low/high values along the target axis; the span on the domain axis; and the column index of the mark (when multiple columns are used to define a mark, only the first is included).
   */
  private calcIntervalsLayout(
    serie: SerieDefinition,
    division: number,
    offset: number,
    scalingFunc: ((p1: number) => number) | null,
    shouldExtendTargetAxisRange: boolean,
  ): IntervalMark[] | null {
    const intervals = serie.intervals;
    if (!intervals) {
      return null;
    }

    const customStyle = this.getCustomPointStyle(serie, division);

    const targetAxisIndex = serie.targetAxisIndex;
    const targetAxis = this.getTargetAxisDefiner(targetAxisIndex);
    const targetAxisIsLogScale = targetAxis.isLogScale();
    // For log scale, we have to first add offset in value space,
    // then convert to numeric.
    const valueToNumber = targetAxis.valueScale!.valueToNumber.bind(
      targetAxis.valueScale,
    );

    const dataView = this.dataView;

    const intervalMarks: AnyDuringMigration[] = [];
    const addIntervalRect = (
      lowColumn: AnyDuringMigration,
      highColumn: AnyDuringMigration,
      span: AnyDuringMigration,
      intervalType: AnyDuringMigration,
      spanProperty = 'size',
    ) => {
      const settings = intervals.settings[lowColumn];
      const lowValue = dataView.getValue(division, lowColumn);
      let lowNumber = targetAxisIsLogScale
        ? (lowValue as number)
        : valueToNumber(lowValue);
      const highValue = dataView.getValue(division, highColumn);
      let highNumber = targetAxisIsLogScale
        ? (highValue as number)
        : valueToNumber(highValue);
      if (lowNumber != null && highNumber != null) {
        lowNumber += offset;
        highNumber += offset;

        if (scalingFunc) {
          lowNumber = scalingFunc(lowNumber);
          highNumber = scalingFunc(highNumber);
        }
        if (targetAxisIsLogScale) {
          lowNumber = valueToNumber(lowNumber);
          highNumber = valueToNumber(highNumber);
        }
        if (shouldExtendTargetAxisRange) {
          targetAxis.extendRangeToIncludeNumber(lowNumber);
          targetAxis.extendRangeToIncludeNumber(highNumber);
        }
        let brush = settings.brush;
        if (customStyle != null) {
          brush = brush.clone();
          AxisChartDefiner.mutateBrush(
            brush,
            customStyle.view([intervalType, '']),
          );

          span = customStyle.inferNumberValue(
            [`${intervalType}.${spanProperty}`, spanProperty],
            span,
          );
        }
        const mark = {
          lowT: lowNumber,
          highT: highNumber,
          spanD: span,
          columnIndex: lowColumn,
          brush,
        };
        intervalMarks.push(mark);
      }
    };

    for (
      let stickIndex = 0;
      stickIndex < intervals.sticks.length;
      stickIndex += 2
    ) {
      // Suppressing errors for ts-migration.
      //   TS2554: Expected 5 arguments, but got 4.
      // @ts-ignore
      addIntervalRect(
        intervals.sticks[stickIndex],
        intervals.sticks[stickIndex + 1],
        0,
        'interval stick',
      );
    }
    for (
      let boxLowIndex = 0, boxHighIndex = intervals.boxes.length - 1;
      boxLowIndex <= boxHighIndex;
      boxLowIndex++, boxHighIndex--
    ) {
      const lowColumn = intervals.boxes[boxLowIndex];
      const highColumn = intervals.boxes[boxHighIndex];
      const boxWidth = intervals.settings[lowColumn].boxWidth;
      // Suppressing errors for ts-migration.
      //   TS2554: Expected 5 arguments, but got 4.
      // @ts-ignore
      addIntervalRect(lowColumn, highColumn, boxWidth, 'interval box');
    }
    for (
      let pointIndex = 0;
      pointIndex < intervals.points.length;
      pointIndex++
    ) {
      const column = intervals.points[pointIndex];
      // Suppressing errors for ts-migration.
      //   TS2554: Expected 5 arguments, but got 4.
      // @ts-ignore
      addIntervalRect(column, column, 0, 'interval point');
    }
    for (let barIndex = 0; barIndex < intervals.bars.length; barIndex++) {
      const column = intervals.bars[barIndex];
      const settings = intervals.settings[column];
      const isShortBar = !(
        barIndex === 0 || barIndex === intervals.bars.length - 1
      );
      const span = isShortBar ? settings.shortBarWidth : settings.barWidth;
      addIntervalRect(
        column,
        column,
        span,
        'interval bar',
        isShortBar ? 'shortSize' : undefined,
      );
    }
    for (
      let areaLowIndex = 0, areaHighIndex = intervals.areas.length - 1;
      areaLowIndex <= areaHighIndex;
      areaLowIndex++, areaHighIndex--
    ) {
      const lowColumn = intervals.areas[areaLowIndex];
      const highColumn = intervals.areas[areaHighIndex];
      // Suppressing errors for ts-migration.
      //   TS2554: Expected 5 arguments, but got 4.
      // @ts-ignore
      addIntervalRect(lowColumn, highColumn, 0, 'interval area');
    }
    for (let lineIndex = 0; lineIndex < intervals.lines.length; lineIndex++) {
      const column = intervals.lines[lineIndex];
      // Suppressing errors for ts-migration.
      //   TS2554: Expected 5 arguments, but got 4.
      // @ts-ignore
      addIntervalRect(column, column, 0, 'interval line');
    }

    return intervalMarks.length ? intervalMarks : null;
  }

  /**
   * Makes sure that each bar group will be divided into at least the given
   * number of inner slots (in case there are side by side bars).
   * @param numSubdivisions The required number of subdivisions.
   */
  private allocateSubdivisions(numSubdivisions: number) {
    this.numSubdivisions = Math.max(this.numSubdivisions, numSubdivisions);
  }

  /**
   * Calculates the bar group subdivision definition, including actual number of
   * subdivisions, the width in pixels of each subdivision, and the pixel offset
   * of the bar group relative to the axis tick.
   */
  private calcDivisionDefinition() {
    const chartDef = this.chartDef;
    const isHistogram = chartDef.chartType === ChartType.HISTOGRAM;
    const domainAxisDefiner = this.domainAxisDefiner;
    assert(domainAxisDefiner != null);

    const minDistance = this.calcMinDistanceBetweenBarLikeColumns();
    const divisionTotalWidth = minDistance;

    // Try to draw all subdivisions, the bars and gaps within a group.
    // This is true even if the scale is zoomed such that bars would be less
    // than 1 pixel wide. But we effectively reserve at least 1 pixel per bar.
    // See subdivision calculations below.
    const numSubdivisions = this.numSubdivisions;

    // For both groups and bars, setting 100% for width or gap means,
    // by default, leave 0 pixels for the gap or width, respectively.
    // Specifying both a width and a gap is an overconstraint,
    // in which case, the gap will override the width, currently.

    let groupGap = this.options.inferOptionalAbsOrPercentageValue(
      'bar.group.gap',
      divisionTotalWidth,
    );

    let groupWidth = this.options.inferOptionalAbsOrPercentageValue(
      ['bar.group.width', 'bar.groupWidth'],
      divisionTotalWidth,
    );

    if (numSubdivisions === 1) {
      // Special case: since there is only one subdivision, we can use
      // the bar options, if defined.
      if (groupGap == null) {
        groupGap = this.options.inferOptionalAbsOrPercentageValue(
          'bar.gap',
          divisionTotalWidth,
        );
      }
      if (groupWidth == null) {
        groupWidth = this.options.inferOptionalAbsOrPercentageValue(
          ['bar.width'],
          divisionTotalWidth,
        );
      }
    }

    // If still undefined, use default values.
    if (groupGap == null && isHistogram) {
      groupGap = 1;
    }
    if (groupWidth == null) {
      // Another special case: if bar width and gap are numbers,
      // we can compute the groupWidth from these.
      const barGapNum = this.options.inferOptionalNumberValue('bar.gap') || 1;
      const barWidthNum = this.options.inferOptionalNumberValue('bar.width');
      if (barWidthNum != null) {
        groupWidth = numSubdivisions * (barWidthNum + barGapNum) - barGapNum; // Subtract the extra bar gap here.
      } else if (!isHistogram) {
        // Default for histogram is a group gap of 1, set above.
        // Default for non-histogram is golden ratio fraction.
        groupWidth = Options.convertAbsOrPercentageToNumber(
          `${100 / GOLDEN_RATIO}%`,
          divisionTotalWidth,
        );
      }
    }

    // Either groupGap or groupWidth must be defined at this time.
    assert(groupGap != null || groupWidth != null);

    if (groupGap == null) {
      // The group.gap option was not specified, so compute from groupWidth.
      assert(groupWidth != null);
      groupGap = Math.max(0, divisionTotalWidth - groupWidth!);
    }
    // Now recompute the groupWidth from groupGap.
    // At least one pixel is required per bar, hence numSubdivisions.
    groupWidth = Math.max(numSubdivisions, divisionTotalWidth - groupGap);

    // And recompute groupGap from groupWidth, in case it changed.
    groupGap = divisionTotalWidth - groupWidth;

    let subdivisionTotalWidth;
    let barGap: number | null = null;
    let barWidth;

    const calculateSubdivisions = () => {
      // Compute total space for each subdivision bar, based on the groupWidth
      // and number of subdivisions.  Each subdivision is a bar and a gap, but
      // note, this also includes an extra gap after the last bar,
      // but that's ok because, well, keep reading...
      subdivisionTotalWidth = groupWidth! / numSubdivisions;

      // Checking for width less than 7 is to align gridlines exactly in
      // the middle of bars or gaps, in which case there would be up to
      // 3 pixels on either side.  More than 3 is not so visible.
      // Less than 7 allows a bit more.
      if (subdivisionTotalWidth < 7) {
        // For small subdivisions, we want to ensure the subdivision width
        // is a rounded value, so each subdivision will end up the same.
        subdivisionTotalWidth = Math.floor(subdivisionTotalWidth);
      }
      subdivisionTotalWidth = Math.max(1, subdivisionTotalWidth);

      // Get specified bar gap and width, if any.
      barGap = this.options.inferOptionalAbsOrPercentageValue(
        'bar.gap',
        subdivisionTotalWidth,
      );
      // Cap width at subdivision total width for now.
      barWidth = this.options.inferAbsOrPercentageValue(
        'bar.width',
        '100%',
        subdivisionTotalWidth,
      );

      if (barGap == null) {
        // No bar gap was specified; default is remainder of subdivision,
        // minimum 1 for backward compatibility, except when only one
        // subdivision.
        barGap = Math.max(
          numSubdivisions > 1 ? 1 : 0,
          subdivisionTotalWidth - barWidth,
        );
      }

      // Both barGap and barWidth are defined, and total subdivisionTotalWidth.
      barWidth = subdivisionTotalWidth - barGap;
    };

    calculateSubdivisions();

    // Group gap must be at least as large as barGap.
    if (barGap! > groupGap) {
      groupGap = barGap!; // Math.max(groupGap, barGap);
      groupWidth = divisionTotalWidth - groupGap!;
    }

    // Adjust group width and gap to move the last bar gap into the groupWidth.
    groupGap = groupGap! - barGap!;
    groupWidth = groupWidth + Number(barGap!);

    // Now we must recompute the bar gap and width based on this adjusted
    // groupWidth.
    calculateSubdivisions();

    // We need to round numbers to some precision less than the max for JS
    // so we can properly test for even and odd numbers.
    // Needs to be rather imprecise, but perhaps the math below is wrong.
    const roundToPrecision = (num: AnyDuringMigration) =>
      roundToNumSignificantDigits(10, num);

    barWidth = roundToPrecision(barWidth);
    barGap = roundToPrecision(barGap);
    groupWidth = roundToPrecision(groupWidth);
    groupGap = roundToPrecision(groupGap);

    // When we draw the bars we can either (a) make sure the bars have exactly
    // the same width in pixels, or (b) the width of each bar will be x or x+1
    // pixels, depending upon the specific pixels-per-data ratio.  Note that if
    // bars are exactly the same width, the gaps between bars might not be the
    // same width, and vice versa.  We can also vary the center position of a
    // bar relative to the precise screen coordinate value computed from the
    // data.
    //
    // When the bars or gaps are small enough, then it is better to try to
    // keep them the same width since the difference in a small width
    // would be more apparent.  Alignment with gridlines, which are rounded,
    // can also be significant.

    const direction = domainAxisDefiner!.direction;

    // Compute offset for a bar group, relative to the screen position
    // corresponding to the data value.  Imagine a gridline at that value.
    const divisionOffsetFromTick = roundToPrecision(
      isHistogram // For histograms, we want to center the buckets between ticks, so
        ? // we offset to the center the groupGap, which excludes the extra
          // barGap. For reverse direction, we shift the bucket in the
          // opposite direction.
          (direction === -1 ? groupWidth + groupGap : 0) +
            -(groupGap + barGap) / 2 // For non-histogram, the desired offset is half the groupWidth
        : // after excluding the extra barGap.
          (groupWidth - barGap) / 2,
    );

    // We look at the gapTotal because the divisionGap excludes the
    // subdivisionGap and the gridlines we care about are typically in the
    // middle of this gap.
    const gapTotal = groupGap + barGap;

    // Gridlines are drawn at the floor of calculated screen coordinate,
    // (see drawHorizontalAxisLines in AxisChartBuilder)
    // so we must do something similar here.  But we treat even-sized
    // bars or gaps differently, rounding to nearest half pixels, to evenly
    // split the half-pixels across gridlines.
    const rounder: (p1: number) => number =
      (barWidth < 7 && barWidth % 2 === 0) ||
      (gapTotal < 7 && gapTotal % 2 === 0)
        ? (num) => Math.floor(num) + 0.5
        : (num) => Math.floor(num + 0.5);

    this.divisionDefinition = {
      numSubdivisions: assertNumber(numSubdivisions),
      divisionOffsetFromTick: assertNumber(divisionOffsetFromTick),
      divisionGap: assertNumber(groupGap),
      divisionWidth: assertNumber(groupWidth),
      subdivisionWidth: assertNumber(barWidth),
      subdivisionGap: assertNumber(barGap),
      roundingFunction: rounder,
    };
  }

  /**
   * Calculates the minimal distance in pixels between two categories (i.e.,
   * domain values that are used in the data).
   * @return The minimal distance in pixels.
   */
  private calcMinDistanceBetweenBarLikeColumns(): number {
    const domainAxisDefiner = this.domainAxisDefiner;
    let categories = this.chartDef.categories;
    // Note: we are ignoring data values that are right after a gap of size 0
    // since they will not be drawn anyway, because they're on the same domain
    // value as the data value before that gap.
    categories = categories.filter((category, i) => {
      return this.calcGap(i) !== 0;
    }) as AnyDuringMigration[];
    if (categories.length === 0) {
      return 0;
    }
    const barLikeColumns = this.barLikeColumns;
    if (!barLikeColumns || barLikeColumns.size === 0) {
      return 0;
    }
    if (domainAxisDefiner!.type === AxisType.VALUE) {
      // Find the minimal distance between consecutive category positions.
      // Assumes values are sorted.
      // TODO: Ensure values are sorted.
      let minDistance = domainAxisDefiner!.axisLength;
      let prevPosition = null;
      for (let i = 0; i < categories.length; i++) {
        const numericValue = this.getNumericDomainValue(i);
        const position =
          numericValue == null
            ? null
            : domainAxisDefiner!.calcPositionForNumericValue(numericValue);
        if (position != null && prevPosition != null) {
          const distance = Math.abs(position - prevPosition);
          if (distance > 0) {
            // Ignore distance == 0, since duplicate values should take up
            // no additional space.
            minDistance = Math.min(minDistance, distance);
          }
        }
        prevPosition = position;
      }
      return minDistance;
    } else {
      // Category domain axis: categories are evenly spaced, just subtract #0
      // position from #1 position.  Assumes at least two categories.
      // TODO(dlaliberte): Ensure this works for 0 or 1 categories also.
      return Math.abs(
        domainAxisDefiner!.calcPosFromDataOrError(1) -
          domainAxisDefiner!.calcPosFromDataOrError(0),
      );
    }
  }

  /**
   * Get the scaled numeric value of a specific position on the domain axis.
   * @param row The data view row number of the requested domain value.
   * @param serie If this refers to a virtual series, the series should be specified here.
   * @return The numeric domain value. Might be null.
   */
  getNumericDomainValue(row: number, serie?: SerieDefinition): number | null {
    const dataView = this.dataView;
    const domainAxis = this.domainAxisDefiner;

    let numericDomainValue;
    if (domainAxis!.type === AxisType.VALUE) {
      const domainValue =
        serie && serie.isVirtual
          ? serie.data![row][0]
          : dataView.getValue(row, 0);
      numericDomainValue = domainAxis!.valueScale!.valueToNumber(domainValue);
    } else {
      numericDomainValue = row;
    }
    return numericDomainValue;
  }

  // These abstract methods should be in AxisChartDefiner, but it would have
  // to be an abstract class, which is a problem because we also need to
  // instantiate it.

  /** For Histogram only.  {@see histogram-chart-definer} */
  treatHistogramAsColumnChart(
    numericValueToPixelsFactor: number,
    hideBucketItems: boolean,
  ): boolean {
    return false;
  }

  /** For Histogram only.  {@see histogram-chart-definer} */
  getLargestStack(isStacked: boolean): number {
    return 0;
  }
}

declare interface RelativeTotal {
  positive: number;
  negative: number;
}

interface ColumnStructure {
  barLikeColumns: Set<number>;
  seriesColumnStructure: Structure[];
  domainsColumnStructure: DomainColumnStructure[];
  domainDataType: string;
  columnRoleInfo: ColumnRoleInfo[];
}
