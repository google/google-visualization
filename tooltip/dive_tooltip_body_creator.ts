/**
 * @fileoverview Creates a tooltip body for the line chart used in google
 * public data.
 * The dive tooltip body has the numeric value in large bold font, and the time
 * value underneath in smaller, gray, normal font.
 * Example:
 *   __________________________________
 *   |                                 |
 *   | <largeBold>76%</largeBold>      |
 *   | <smallGray>May 2004</smallGray> |
 *   |_________________________________|.
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

import * as googObject from '@npm//@closure/object/object';
import {FocusTarget} from '../common/option_types';
import {Options} from '../common/options';
import {TextStyle} from '../text/text_style';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {TooltipBodyCreatorDefault} from './tooltip_body_creator_default';
import * as definer from './tooltip_definer_utils';
import {Body, InteractionState} from './tooltip_definition';

/** @unrestricted */
export class DiveTooltipBodyCreator extends TooltipBodyCreatorDefault {
  /** Style for the value text. */
  private readonly valueStyle: TextStyle;

  /** Style for the time point text. */
  private readonly timeStyle: TextStyle;

  /**
   * @param chartOptions The chart configuration options.
   * @param chartTextStyle Default text style used throughout the chart.
   * @param focusTarget The focus target.
   */
  constructor(
    chartOptions: Options,
    chartTextStyle: TextStyle,
    focusTarget: Set<FocusTarget>,
  ) {
    super(chartOptions, chartTextStyle, focusTarget);

    /** Style for the value text. */
    this.valueStyle = this.getBoldTextStyle();

    /** Style for the time point text. */
    this.timeStyle = googObject.clone(this.getTextStyle()) as TextStyle;
    this.timeStyle.color = '#666666';
    this.timeStyle.fontSize -= 2;
  }

  override createDatumBody(
    interactionState: InteractionState,
    seriesIndex: number,
    categoryIndex: number,
  ): Body {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    const series = chartDefinition.series[seriesIndex];
    const text = series.points[categoryIndex]!.tooltipText;

    const content = [];
    if (!series.visibleInLegend) {
      const entityName = definer.createBodyTextLineEntry(
        series.title || '',
        this.valueStyle,
      );
      content.push(entityName);
    }
    const value = definer.createBodyTextLineEntry(
      text!.content,
      this.valueStyle,
    );
    content.push(value);

    const time = definer.createBodyTextLineEntry(
      text!.categoryTitle,
      this.timeStyle,
    );
    content.push(time);
    return {entries: content};
  }

  override createSeriesBody(
    interactionState: InteractionState,
    seriesIndex: number,
  ): Body {
    // Not supported for dive interactivity model. Noop.
    return {entries: []};
  }

  override createCategoryBody(
    interactionState: InteractionState,
    categoryIndex: number,
  ): Body | null {
    // Not supported for dive interactivity model. Noop.
    return {entries: []};
  }
}
