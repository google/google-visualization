/**
 * @fileoverview Core charts.
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

import {PieChartEventHandler} from '../../events/pie_chart_event_handler';
import {PieChartInteractivityDefiner} from '../../events/pie_chart_interactivity_definer';
import {ChartDefiner} from './chart_definer';
import {PieChartBuilder} from './pie_chart_builder';
import {PieChartDefiner} from './pie_chart_definer';

import * as events from '@npm//@closure/events/events';
import {Size} from '@npm//@closure/math/size';
import * as optionTypes from '../../common/option_types';
import {Options} from '../../common/options';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {DataTable} from '../../data/datatable';
import {AbstractRenderer} from '../../graphics/abstract_renderer';
import {OverlayArea} from '../../graphics/overlay_area';
import {TextMeasureFunction} from '../../text/text_measure_function';
import {TextStyle} from '../../text/text_style';
import {ActionsMenuDefiner} from '../../tooltip/actions_menu_definer';
import {ChartDefinition} from './chart_definition';

import {CoreChart} from './corechart';

// tslint:disable:ban-types Migration

/**
 * Construct a new area chart.
 * @unrestricted
 */
export class AreaChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.AREA,
      optionTypes.Orientation.HORIZONTAL,
    );
  }
}

/**
 * Construct a new area chart.
 * @unrestricted
 */
export class SteppedAreaChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.STEPPED_AREA,
      optionTypes.Orientation.HORIZONTAL,
    );
  }
}

/**
 * Construct a new sparkline chart.
 * @unrestricted
 */
export class SparklineChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.NONE,
      optionTypes.Orientation.HORIZONTAL,
      'sparkline',
    );
  }
}

/**
 * Construct a new line chart.
 * @unrestricted
 */
export class LineChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.LINE,
      optionTypes.Orientation.HORIZONTAL,
    );
  }
}

/**
 * Construct a new scatter chart.
 * @unrestricted
 */
export class ScatterChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(optionTypes.ChartType.SCATTER);
  }

  override computeDiff(
    oldDataTable: DataTable | null,
    newDataTable: DataTable | null,
  ) {
    return this.computeDiffInternal(oldDataTable, newDataTable);
  }
}

/**
 * Construct a new bubble chart.
 * @unrestricted
 */
export class BubbleChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(optionTypes.ChartType.BUBBLE);
  }
}

/**
 * Construct a new bar chart.
 * @unrestricted
 */
export class BarChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.BARS,
      optionTypes.Orientation.VERTICAL,
    );
  }

  override computeDiff(
    oldDataTable: DataTable | null,
    newDataTable: DataTable | null,
  ) {
    return this.computeDiffInternal(oldDataTable, newDataTable);
  }
}

/**
 * Construct a new candlestick chart.
 * @unrestricted
 */
export class CandlestickChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.CANDLESTICKS,
      optionTypes.Orientation.HORIZONTAL,
    );
  }
}

/**
 * Construct a new boxplot chart.
 * @unrestricted
 */
export class BoxplotChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.BOXPLOT,
      optionTypes.Orientation.HORIZONTAL,
    );
  }
}

/**
 * Construct a new column chart.
 * @unrestricted
 */
export class ColumnChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.BARS,
      optionTypes.Orientation.HORIZONTAL,
    );
  }

  override computeDiff(
    oldDataTable: DataTable | null,
    newDataTable: DataTable | null,
  ) {
    return this.computeDiffInternal(oldDataTable, newDataTable);
  }
}

/**
 * Construct a new combination (combo) chart.
 * @unrestricted
 */
export class ComboChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.FUNCTION,
      optionTypes.SerieType.NONE,
      optionTypes.Orientation.HORIZONTAL,
    );
  }
}

/**
 * Construct a new histogram.
 * @unrestricted
 */
export class Histogram extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(
      optionTypes.ChartType.HISTOGRAM,
      optionTypes.SerieType.BARS,
      optionTypes.Orientation.HORIZONTAL,
    );
  }
}

/**
 * Construct a new pie chart.
 * @unrestricted
 */
export class PieChart extends CoreChart {
  /**
   * @param container The dom element to draw in.
   */
  constructor(container: Element | null) {
    super(container);
    this.setChartType(optionTypes.ChartType.PIE);
  }

  maybeMutateToPieChart(isTypePie: boolean) {
    // Already a PieChart, so nothing to do.
  }

  override constructChartDefiner(
    dataTable: AbstractDataTable,
    options: Options,
    textMeasureFunction: TextMeasureFunction, //
    width: number,
    height: number,
    afterInit?: (chartDefiner: ChartDefiner) => void,
  ) {
    const chartDefiner = new PieChartDefiner(
      dataTable,
      options,
      textMeasureFunction,
      width,
      height,
    );
    this.initChartDefiner(chartDefiner, afterInit);
    return chartDefiner;
  }

  override constructInteractivityDefiner(
    options: Options, //
    chartDimensions: Size, //
    chartTextStyle: TextStyle, //
    interactivityModel: optionTypes.InteractivityModel,
    // Planning to migrate to es6 set, but not all at once.
    // tslint:disable-next-line:deprecation
    focusTarget: Set<optionTypes.FocusTarget>, //
    numberOfSeries: number, //
    actionsMenuDefiner?: ActionsMenuDefiner,
  ) {
    return new PieChartInteractivityDefiner(
      options,
      chartDimensions,
      chartTextStyle,
      interactivityModel,
      focusTarget,
      numberOfSeries,
      actionsMenuDefiner,
    );
  }

  /**
   * Construct the appropriate EventHandler.
   * @param interactionEventTarget The target to
   *     dispatch interaction events to.
   * @param renderer Used for hanging events
   *     on chart elements and obtaining the cursor position.
   * @param overlayArea Used for hanging events
   *     on the overlay area above the chart.
   * @param chartDef The chart definition.
   */
  override constructEventHandler(
    interactionEventTarget: events.EventTarget,
    renderer: AbstractRenderer,
    overlayArea: OverlayArea,
    chartDef?: ChartDefinition,
  ): PieChartEventHandler {
    return new PieChartEventHandler(
      interactionEventTarget,
      renderer,
      overlayArea,
    );
  }

  /**
   * Construct the appropriate Builder.
   * @param overlayArea An html element into which
   *     tooltips should be added.
   * @param renderer The drawing renderer.
   */
  override constructBuilder(
    overlayArea: OverlayArea,
    renderer: AbstractRenderer,
  ) {
    return new PieChartBuilder(overlayArea, renderer);
  }

  override computeDiff(
    oldDataTable: DataTable | null,
    newDataTable: DataTable | null,
  ) {
    const diffData = this.computeDiffInternal(oldDataTable, newDataTable);
    return diffData;
  }
}
