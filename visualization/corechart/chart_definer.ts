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

import {concat} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {Box} from '@npm//@closure/math/box';
import {sum} from '@npm//@closure/math/math';
import {ColorBarDefiner} from '../../colorbar/color_bar_definer';
import {AnyCallbackWrapper} from '../../common/async_helper';
import {GOLDEN_RATIO} from '../../common/constants';
import {
  ChartType,
  ColorBarPosition,
  InOutPosition,
  InteractivityModel,
  LegendPosition,
  SelectionMode,
  SerieType,
} from '../../common/option_types';
import {Options} from '../../common/options';
import {distributeRealEstateWithKeys} from '../../common/util';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {DataView} from '../../data/dataview';
import {Brush} from '../../graphics/brush';
import * as chartarea from '../../graphics/chart_area';
import {LegendDefiner} from '../../legend/legend_definer';

import {TextAlign} from '../../text/text_align';
import {TextMeasureFunction} from '../../text/text_measure_function';

import {DEFAULT_DIFF_LEGEND_ICON_WIDTH_SCALE_FACTOR} from '../../common/defaults';
import {calcTextLayout} from '../../text/text_utils';
import {ChartDefinition} from './chart_definition';

const {END, START} = TextAlign;

/**
 * Construct a new ChartDefiner instance.
 * After construction, use the getChartDefinition() function to get the
 * ChartDefinition object.
 * @unrestricted
 */
export abstract class ChartDefiner {
  /**
   * The internal data.  Might not be a DataView but just another DataTable.
   * TODO - rename to just data.
   */
  dataView: AbstractDataTable;

  /**
   * Legend definer.
   */
  protected legendDefiner: LegendDefiner | null = null;

  /**
   * Color-bar definer.
   */
  protected colorBarDefiner: ColorBarDefiner | null = null;

  /**
   * The result ChartDefinition.
   */
  protected chartDef: ChartDefinition;
  /**
   * @param dataTable The table whose data
   *     should be drawn.
   * @param options The options controlling how the chart
   *     will look and behave.
   * @param textMeasureFunction A function
   *     for measuring width and height of text objects.
   * @param width Chart's width.
   * @param height Chart's height.
   */
  constructor(
    protected dataTable: AbstractDataTable,
    protected options: Options,
    protected textMeasureFunction: TextMeasureFunction,
    width: number,
    height: number,
  ) {
    this.dataView = dataTable;

    this.chartDef = this.constructChartDefinition();
    const chartDef = this.chartDef;

    // TODO(dlaliberte): Create and use setters for initializing chartDef.
    chartDef.textMeasureFunction = textMeasureFunction;

    chartDef.width = width;
    chartDef.height = height;

    chartDef.chartType = options.inferStringValue(
      'type',
      ChartType.NONE,
      ChartType,
    ) as ChartType;

    chartDef.defaultFontName = options.inferStringValue('fontName');
    chartDef.defaultFontSize = options.inferNonNegativeNumberValue(
      'fontSize',
      Math.round(Math.pow((chartDef.width + chartDef.height) * 2, 1 / 3)),
    );

    chartDef.defaultSerieType = options.inferStringValue(
      'seriesType',
      SerieType.LINE,
      SerieType,
    ) as SerieType;

    chartDef.enableInteractivity = options.inferBooleanValue(
      'enableInteractivity',
      true,
    );

    chartDef.isHtmlTooltip = options.inferBooleanValue('tooltip.isHtml');

    chartDef.tooltipBoxStyle = options.inferBrushValue('tooltip.boxStyle');

    chartDef.selectionMode = options.inferStringValue(
      'selectionMode',
      SelectionMode.SINGLE,
      SelectionMode,
    ) as SelectionMode;

    chartDef.useNewLegend = options.inferBooleanValue('legend.newLegend');

    chartDef.backgroundBrush = options.inferBrushValue('backgroundColor');
    chartDef.chartAreaBackgroundBrush = options.inferBrushValue(
      'chartArea.backgroundColor',
    );
    // We store the actual color users see on the chart area, which is the blend
    // of the chart area color and the general background.
    chartDef.actualChartAreaBackgoundColor = Brush.blendFills(
      chartDef.chartAreaBackgroundBrush,
      chartDef.backgroundBrush,
    );

    chartDef.baselineColor = options.inferColorValue('baselineColor', '');
    chartDef.gridlineColor = options.inferColorValue('gridlineColor', '');

    chartDef.insideLabelsAuraColor =
      chartDef.actualChartAreaBackgoundColor || '';

    const titleText = options.inferStringValue('title');
    chartDef.titlePosition = options.inferStringValue(
      'titlePosition',
      InOutPosition.OUTSIDE,
      InOutPosition,
    ) as InOutPosition;
    const auraColor =
      chartDef.titlePosition === InOutPosition.INSIDE
        ? chartDef.insideLabelsAuraColor
        : 'none';
    const defaultTitleTextStyle = {
      fontName: chartDef.defaultFontName,
      fontSize: chartDef.defaultFontSize,
      auraColor,
    };
    const titleTextStyle = options.inferTextStyleValue(
      'titleTextStyle',
      defaultTitleTextStyle,
    );
    chartDef.title = {
      text: titleText,
      textStyle: titleTextStyle,
      boxStyle: null,
      lines: [],
      paralAlign: START,
      perpenAlign: END,
      tooltip: '',
      anchor: null,
      angle: 0,
    };

    chartDef.axisTitlesPosition = options.inferStringValue(
      'axisTitlesPosition',
      InOutPosition.OUTSIDE,
      InOutPosition,
    ) as InOutPosition;

    chartDef.is3D = options.inferBooleanValue('is3D');
    chartDef.isRtl = options.inferBooleanValue('isRtl', false);
    chartDef.shouldHighlightSelection = options.inferBooleanValue(
      'shouldHighlightSelection',
      true,
    );

    chartDef.interpolateNulls = options.inferBooleanValue('interpolateNulls');

    chartDef.interactivityModel = options.inferStringValue(
      'interactivityModel',
      InteractivityModel.DEFAULT,
      InteractivityModel,
    ) as InteractivityModel;

    this.createDataView();
  }

  getDefinition(): ChartDefinition {
    return this.chartDef;
  }

  getDataView(): AbstractDataTable {
    assert(this.dataView != null);
    return this.dataView;
  }

  getTextMeasureFunction(): TextMeasureFunction {
    return this.textMeasureFunction;
  }

  /**
   * Throws an error if the chart's interactivityModel is DIVE and
   * all series are not of type line.  Called via init().
   */
  checkDiveInteractivityModel() {
    const diveInteractivityModel = InteractivityModel.DIVE;
    const lineSerieType = SerieType.LINE;
    if (
      this.chartDef.interactivityModel === diveInteractivityModel &&
      (!this.chartDef.serieTypeCount ||
        this.chartDef.serieTypeCount[lineSerieType] !==
          this.chartDef.series.length)
    ) {
      throw new Error(
        'DIVE interactivity model is only supported when all series ' +
          'are of type line.',
      );
    }
  }

  /**
   * Construct and return the chart definition for this class.
   * @return The chart definition.
   */
  constructChartDefinition(): ChartDefinition {
    return new ChartDefinition();
  }

  /**
   * Returns the built chart definition.
   * @return The chart definition.
   */
  getChartDefinition(): ChartDefinition {
    return this.chartDef;
  }

  /**
   * Performs initialization of the definer, optionally asynchronously.
   * Calls initSteps() to get a list of functions.  During one or more time
   * slices, the initialization steps are run in order.  If any step returns a
   * list of functions, they are prepended to the steps so they will be run
   * next. Once all the init steps are done, the afterInit function, if any, is
   * called with the chart definer. The 'async' option is used to determine
   * whether to run asynchronously, and what the runtime per slice is. Steps are
   * run until the slice runtime has been exceeded. If there is no afterInit, or
   * if 'async' is Infinity, then all steps are run synchronously in one time
   * slice.  If 'async' is 0, then all steps are run asynchronously, even the
   * first step.
   *
   * The init steps can be interrupted before completion, say if there is
   * another draw() call, by calling stopInit().  The afterInit function is not
   * called in this case.
   *
   * @param asyncWrapper From
   *     AbstractVisualization.
   * @param afterInit Function to call with chart
   *     definer after all init steps are done.  If missing, this forces
   *     synchronous running of all init steps.
   */
  init(
    asyncWrapper: AnyCallbackWrapper,
    afterInit?: ((p1: ChartDefiner) => void) | undefined,
  ) {
    // Compute the maximum number of milliseconds each init time slice gets.
    let maxSliceRunTime = Infinity;
    if (afterInit != null) {
      let asyncOption = this.options.inferValue('async', null);
      if (typeof asyncOption === 'number') {
        maxSliceRunTime = asyncOption;
      } else {
        asyncOption = this.options.inferBooleanValue('async', false);
        maxSliceRunTime = asyncOption ? DEFAULT_SLICE_RUNTIME : Infinity;
      }
    }

    const afterInitCallback = (chartDefiner: ChartDefiner) => {
      chartDefiner.checkDiveInteractivityModel(); // Always do this check.
      if (afterInit) {
        afterInit(this);
      }
    };

    // Set up the initSteps list.
    let initSteps = concat(this.preInitSteps(), this.initSteps());
    // TODO(dlaliberte): Make this reusable.
    const runInitSteps = asyncWrapper(() => {
      // Run one or more init steps until the max slice runtime is exceeded.
      const sliceStartTime = Date.now();
      let sliceRunTime = 0;
      while (initSteps.length > 0 && sliceRunTime <= maxSliceRunTime) {
        // Pop one step off the front of the list and run it.
        const step = initSteps.shift();
        const result = step();
        if (result) {
          // Push more steps on the front of the list.
          initSteps = concat(result, initSteps);
        }
        sliceRunTime = Date.now() - sliceStartTime;
      }

      if (initSteps.length === 0) {
        // Done
        afterInitCallback(this);
      } else {
        // Run remaining steps more asynchronously, after a timeout.
        setTimeout(runInitSteps, 0);
      }
    });

    runInitSteps();
  }

  /**
   * Returns functions which initialize the chart definition *before*
   * subclasses. Each function should return either nothing or an array of
   * functions, which are inserted at the head of the queue.
   */
  protected preInitSteps(): InitFunctionList {
    return [this.calcChartAreaLayout.bind(this)];
  }

  /**
   * Returns functions which initialize the chart definition, making it ready
   * to be drawn.  Each function should return either nothing or an
   * array of functions, which are inserted at the head of the queue.
   */
  initSteps(): InitFunctionList {
    let chartDef: ChartDefinition;

    return [
      () => {
        chartDef = this.getChartDefinition();
      },

      () => {
        const defaultLegendPosition = this.getDefaultLegendPosition();
        const defaultColorBarPosition = this.getDefaultColorBarPosition();

        // For diff mode, legend definer creates rectangles for icons,
        // to show colors both for new and old data in some type of charts.
        let legendIconWidthScaleFactor = null;
        const chartType = chartDef.chartType;
        if (
          chartDef.isDiff &&
          (chartType === ChartType.PIE || chartType === ChartType.SCATTER)
        ) {
          legendIconWidthScaleFactor =
            DEFAULT_DIFF_LEGEND_ICON_WIDTH_SCALE_FACTOR;
        } else if (
          chartDef.useNewLegend &&
          chartType !== ChartType.PIE &&
          chartType !== ChartType.BUBBLE
        ) {
          // TODO(dlaliberte): Make an option to configure icon width scale
          // factor.
          legendIconWidthScaleFactor = 2;
        }
        legendIconWidthScaleFactor =
          this.options.inferOptionalNumberValue('legend.iconAspectRatio') ||
          legendIconWidthScaleFactor;
        this.legendDefiner = new LegendDefiner(
          chartDef,
          this.options,
          defaultLegendPosition,
          legendIconWidthScaleFactor,
        );
        this.colorBarDefiner = new ColorBarDefiner(
          this.options,
          defaultColorBarPosition,
          chartDef.defaultFontName,
          chartDef.defaultFontSize,
          chartDef.insideLabelsAuraColor,
          chartDef.textMeasureFunction,
        );
      },

      // Among other things, this can set the legend area in some cases.
      this.calcLayout.bind(this),

      () => {
        this.legendDefiner!.calcLegendEntries();

        // Among other things, this can set the legend area in some cases.
        this.calcTopCanvasAreaLayout();

        // At this point, after the calls to calcLayout() and
        // this.calcTopCanvasAreaLayout(), the legend area and color-bar
        // area may have been allocated. The legend/color-bar definer can
        // now be used to calculate the legend/color-bar definition.
        chartDef.legend = this.legendDefiner!.define();
        chartDef.colorBar = this.colorBarDefiner!.define();
      },
    ];
  }

  /**
   * Creates the member: this.dataView.
   */
  protected createDataView() {
    // TODO(dlaliberte) Determine if we can avoid creating a DataView
    // for every corechart.
    this.dataView = new DataView(this.dataTable);

    // We must have at least two columns in order to draw a chart.
    if (this.dataView.getNumberOfColumns() < 2) {
      throw new Error('Not enough columns given to draw the requested chart.');
    }
  }

  /**
   * Populates the dataview, if needed.  This will be called after
   * axes are defined and options processed.
   */
  protected populateDataView() {}

  /**
   * Calculates the layout for the chart area.
   */
  private calcChartAreaLayout() {
    const chartDef = this.chartDef;

    // User defined chartArea option.
    const chartArea = {
      width: this.options.inferOptionalAbsOrPercentageValue(
        'chartArea.width',
        chartDef.width,
      ),
      left: this.options.inferOptionalAbsOrPercentageValue(
        'chartArea.left',
        chartDef.width,
      ),
      right: this.options.inferOptionalAbsOrPercentageValue(
        'chartArea.right',
        chartDef.width,
      ),
      height: this.options.inferOptionalAbsOrPercentageValue(
        'chartArea.height',
        chartDef.height,
      ),
      top: this.options.inferOptionalAbsOrPercentageValue(
        'chartArea.top',
        chartDef.height,
      ),
      bottom: this.options.inferOptionalAbsOrPercentageValue(
        'chartArea.bottom',
        chartDef.height,
      ),
    };

    chartDef.chartArea = chartarea.calcChartAreaLayout(
      chartDef.width,
      chartDef.height,
      chartArea,
    );
  }

  /**
   * Calculates the layout of elements in the top part of the canvas. This means
   * title and legend positions, for "labels outside" mode.
   * Changes the members: title, legend.
   */
  private calcTopCanvasAreaLayout() {
    const chartDef = this.chartDef;

    const titleFontSize = chartDef.title.textStyle.fontSize;
    const legendFontSize = this.legendDefiner!.getTextStyle().fontSize;
    const legendPosition = this.legendDefiner!.getPosition();
    const colorBarFontSize = this.colorBarDefiner!.getTextStyle().fontSize;
    const colorBarPosition = this.colorBarDefiner!.getPosition();

    const titleText =
      chartDef.titlePosition === InOutPosition.OUTSIDE
        ? chartDef.title.text
        : '';

    // Do some work in order to understand how many lines can fit in the space
    // between the chart area top boundary and the canvas top boundary.
    // The general idea is try keeping the title no less than 1em*GR from top
    // of chart area compromising only when that would result in a title closer
    // to canvas top than to chart area. In any case the title should never be
    // positioned less than two pixels from the chart area top.

    // Title layout
    const optimisticTitleLayout = calcTextLayout(
      this.textMeasureFunction,
      titleText,
      chartDef.title.textStyle,
      chartDef.chartArea.width,
      Infinity,
    );

    const minGap = 2; // No less than 2 pixels distance between lines.
    const gapBetweenTitleLines = Math.max(
      minGap,
      Math.round(titleFontSize / (2 * GOLDEN_RATIO)),
    );
    const gapAboveLegend = Math.max(
      minGap,
      Math.round(legendFontSize / GOLDEN_RATIO),
    );
    const gapAboveColorBar = Math.max(
      minGap,
      Math.round(colorBarFontSize / GOLDEN_RATIO),
    );
    const gapAboveChart = Math.max(
      minGap,
      Math.round(chartDef.defaultFontSize * GOLDEN_RATIO),
    );

    const keyBottomSpace = 'bottom-space';
    const keyTopSpace = 'top-space';
    const keyTitle = 'title';
    const keyLegend = 'legend';
    const keyColorBar = 'colorBar';

    const items = [];
    // Bottom space. This ensures there's minimal space below the elements, so
    // they don't touch elements at the bottom of the chart area (horizontal
    // axis ticks in "labels inside" mode). This has highest priority.
    items.push({
      key: keyBottomSpace,
      min: minGap,
      extra: [gapAboveChart - minGap],
    });
    // Top space.
    items.push({key: keyTopSpace, min: 0, extra: [Infinity]});
    // First line of title.
    if (optimisticTitleLayout.lines.length > 0) {
      items.push({key: keyTitle, min: titleFontSize + minGap, extra: []});
    }
    // Legend.
    if (legendPosition === LegendPosition.TOP) {
      // Calculate the needed number of rows and push an item per legend row.
      const lines = this.legendDefiner!.calcMaxNeededLines(
        chartDef.chartArea.width,
      );
      for (let i = 0; i < lines; ++i) {
        items.push({
          key: keyLegend,
          min: legendFontSize + minGap,
          extra: [gapAboveLegend - minGap],
        });
      }
    }
    // Color-bar.
    if (colorBarPosition === ColorBarPosition.TOP) {
      items.push({
        key: keyColorBar,
        min: Number(this.colorBarDefiner!.getHeight()) + minGap,
        extra: [gapAboveColorBar - minGap],
      });
    }
    // Rest of title lines.
    for (let i = 1; i < optimisticTitleLayout.lines.length; i++) {
      items.push({
        key: keyTitle,
        min: titleFontSize + minGap,
        extra: [gapBetweenTitleLines - minGap],
      });
    }

    // Calling the real-estate algorithm.
    const allocatedHeights = distributeRealEstateWithKeys(
      items,
      chartDef.chartArea.top,
    );

    let y: number = allocatedHeights[keyTopSpace][0] || 0;

    // Calculate title layout.
    const actualTitleLines = allocatedHeights[keyTitle] || [];
    const layout = calcTextLayout(
      this.textMeasureFunction,
      titleText,
      chartDef.title.textStyle,
      chartDef.chartArea.width,
      actualTitleLines.length,
    );
    for (let i = 0; i < layout.lines.length; i++) {
      y += actualTitleLines[i];
      chartDef.title.lines.push({
        text: layout.lines[i],
        x: chartDef.chartArea.left,
        y,
        length: chartDef.chartArea.width,
      });
    }
    chartDef.title.tooltip = layout.needTooltip ? titleText : '';

    // Calculate legend layout.
    const actualLegendLines: number[] = allocatedHeights[keyLegend] || [];
    if (actualLegendLines.length > 0) {
      this.legendDefiner!.actualLinesPerHorizontalPage =
        actualLegendLines.length;
      const top = y + actualLegendLines[0] - legendFontSize;
      y += sum.apply(null, actualLegendLines);
      const legendArea = new Box(
        top,
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
   * Returns the default color-bar position. Null means there can't be a
   * color-bar at all.
   * @return See above.
   */
  abstract getDefaultColorBarPosition(): ColorBarPosition | null;

  /**
   * Returns the default legend position. Null means there can't be a legend at
   * all. The default is RIGHT as first priority (if there's no right axis),
   * LEFT as second priority (if there right axis but not left axis), or TOP as
   * last priority (if both left and right axes exist).
   * @return See above.
   */
  abstract getDefaultLegendPosition(): LegendPosition | null;

  /**
   * The public function of this class, that does all the work.
   * Called via initSteps(), so return array of functions.
   */
  abstract calcLayout(): InitFunctionList;
}

/**
 * A list of functions to execute
 */
export type InitFunctionList = Array<(() => void) | InitFunctionList | null>;

/**
 * Default value, in milliseconds, for the sliceRuntime_
 */
const DEFAULT_SLICE_RUNTIME = 100;
