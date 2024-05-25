/**
 * @fileoverview Provides default implementation for TooltipBodyCreator
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
  extend,
  forEach,
} from '@npm//@closure/array/array';
import {
  assert,
  fail,
} from '@npm//@closure/asserts/asserts';
import {
  isEmptyOrWhitespace,
  makeSafe,
} from '@npm//@closure/string/string';
import {
  AggregationTarget,
  FocusTarget,
  SerieType,
} from '../common/option_types';
import {Options} from '../common/options';
import {NO_COLOR} from '../graphics/util';
import {TextStyle} from '../text/text_style';
import {ActionsMenuDefiner} from './actions_menu_definer';
import {CategoryAggregator} from './category_aggregator';
import {SeriesAggregator} from './series_aggregator';
import {
  createBodySeparatorEntry,
  createBodyTextLineEntry,
} from './tooltip_definer_utils';

import {ChartDefinition} from '../visualization/corechart/chart_definition';
import * as chartDefinitionTypes from '../visualization/corechart/chart_definition_types';
import {reverseSeriesLabelsVertically} from '../visualization/corechart/chart_definition_utils';
import {TooltipBodyCreator} from './tooltip_body_creator';
import {Body, BodyEntry, InteractionState} from './tooltip_definition';

/** Default implementation of TooltipBodyCreator. */
export class TooltipBodyCreatorDefault extends TooltipBodyCreator {
  /**
   * @param chartOptions The chart configuration options.
   * @param chartTextStyle Default text style used throughout the chart.
   * @param focusTarget The focus target.
   * @param actionsMenuDefiner A definer of an actions menu, if one should be embedded inside the tooltip body.
   */
  constructor(
    chartOptions: Options,
    chartTextStyle: TextStyle,
    focusTarget: Set<FocusTarget>,
    actionsMenuDefiner?: ActionsMenuDefiner,
  ) {
    super(chartOptions, chartTextStyle, focusTarget, actionsMenuDefiner);
  }

  createDatumBody(
    interactionState: InteractionState,
    seriesIndex: number,
    categoryIndex: number,
  ): Body {
    const chartDef = interactionState.chartDefinition as ChartDefinition;
    const series = chartDef.series[seriesIndex];
    const tooltipText = chartDef.getTooltipText(seriesIndex, categoryIndex);

    // Handles setup for diff mode, where old and new data are displayed in
    // different rows, with (x) colored to clearly identify what is current
    // and what is old data.
    let isTitleInSeparateLine = false;
    let linesColor = null;
    let prefixText = null;
    const alignColumns = chartDef.isDiff != null && chartDef.isDiff;
    if (chartDef.isDiff) {
      isTitleInSeparateLine = true;
      prefixText = [
        this.diffTooltipNewDataPrefix,
        this.diffTooltipOldDataPrefix,
      ];

      const serieType = series.type;
      if (serieType === SerieType.BARS) {
        linesColor = [
          {
            color: series.pointBrush.getFill(),
            alpha: series.pointBrush.getFillOpacity(),
          },
          {
            color: series.diff!.background.pointBrush.getFill(),
            alpha: series.diff!.background.pointBrush.getFillOpacity(),
          },
        ];
      } else if (serieType === SerieType.SCATTER) {
        // Old data series indices are always even, and new data are odd.
        const oldDataSerieIndex =
          seriesIndex % 2 ? seriesIndex - 1 : seriesIndex;
        const newDataSerieIndex = oldDataSerieIndex + 1;
        const oldDataSerie = chartDef.series[oldDataSerieIndex];
        const newDataSerie = chartDef.series[newDataSerieIndex];
        linesColor = [
          {
            color: newDataSerie.pointBrush.getFill(),
            alpha: newDataSerie.pointBrush.getFillOpacity(),
          },
          {
            color: oldDataSerie.pointBrush.getFill(),
            alpha: oldDataSerie.pointBrush.getFillOpacity(),
          },
        ];
      } else {
        throw new Error('Diff chart not supported for the chosen chart type.');
      }
    }

    // Build tooltip body from text.
    // There are 4 different formats described below using the following legend:
    // - <UPPERCASE-TEMPLATE> = bold text
    // - <lowercase-template> = normal text
    // - (x) = optional color square indicating serie
    const body: Body = {entries: []};
    if (tooltipText!.lines) {
      // Format #1 - plain title/key/value layout:
      //   <TITLE>
      //   <line-1-title>: <VALUE1>
      //   <line-2-title>: <VALUE2>
      //   ...
      if (tooltipText!.title) {
        this.addTitleLine(body, tooltipText!.title);
      }
      for (let i = 0; i < tooltipText!.lines.length; i++) {
        const line = tooltipText!.lines[i];
        this.addKeyValueLine(body, line.title, line.value);
      }
    } else if (tooltipText!.categoryTitle && !tooltipText!.hasCustomContent) {
      // Format #2 - category driven:
      //   <CATEGORY-TITLE>
      //   (x) <serie-title>: <CONTENT>
      // Legend: upper case
      this.addTitleLine(body, tooltipText!.categoryTitle);
      this.addSerieLine(
        body,
        tooltipText!.serieTitle,
        tooltipText!.content,
        true,
        this.showColorCode,
        series,
        isTitleInSeparateLine,
        linesColor,
        prefixText,
        alignColumns,
      );
    } else if (tooltipText!.serieTitle && !tooltipText!.hasCustomContent) {
      // Format #3 - serie driven (scatter and pie charts):
      //   (x) <serie-title>
      //       <CONTENT>
      isTitleInSeparateLine = true;
      this.addSerieLine(
        body,
        tooltipText!.serieTitle,
        tooltipText!.content,
        true,
        this.showColorCode,
        series,
        isTitleInSeparateLine,
        linesColor,
        prefixText,
        alignColumns,
      );
    } else if (tooltipText!.content != null) {
      // Format #4 - free text (user defined):
      //   (x) <content>
      this.addSerieLine(
        body,
        null,
        tooltipText!.content,
        false,
        this.showColorCode,
        series,
      );
    } else {
      fail('Cannot create tooltip for datum.');
    }

    this.embedActionsMenu(body, interactionState.actionsMenuEntries);

    return body;
  }

  createAggregateDataBody(
    interactionState: InteractionState,
    data: chartDefinitionTypes.Datum[],
    aggregationTarget: AggregationTarget,
  ): Body {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    const categoryAggregator = new CategoryAggregator(chartDefinition);
    const seriesAggregator = new SeriesAggregator(chartDefinition);
    let aggregator: SeriesAggregator | CategoryAggregator | null = null;

    if (aggregationTarget === AggregationTarget.CATEGORY) {
      aggregator = categoryAggregator;
    } else if (aggregationTarget === AggregationTarget.SERIES) {
      aggregator = seriesAggregator;
    }

    let aggregate: chartDefinitionTypes.Aggregate | null;
    if (!aggregator) {
      const categoryAggregate = categoryAggregator.aggregate(data);
      const seriesAggregate = seriesAggregator.aggregate(data);
      aggregator = seriesAggregator;
      aggregate = seriesAggregate;
      if (
        categoryAggregate.order.length === 1 &&
        seriesAggregate.order.length > 1
      ) {
        aggregator = categoryAggregator;
        aggregate = categoryAggregate;
      }
    } else {
      aggregate = aggregator.aggregate(data);
    }

    const body: Body = {entries: []};
    forEach(aggregate.order, (key) => {
      const title = aggregate.titles[key] || '';
      this.addTitleLine(body, title.toString());
      forEach(aggregate.index[key], (datum) => {
        const tooltipText = chartDefinition.getTooltipText(
          datum.serie,
          datum.category,
        );
        if (tooltipText!.hasCustomContent) {
          const series = chartDefinition.series[datum.serie];
          this.addSerieLine(
            body,
            null,
            tooltipText!.content,
            false,
            this.showColorCode,
            series,
          );
        } else {
          body.entries.push.apply(
            body.entries,
            aggregator.getContent(this, tooltipText!, datum),
          );
        }
      });
    });

    this.embedActionsMenu(
      body,
      interactionState.actionsMenuEntries,
      data.length > 0,
    );

    return body;
  }

  createSeriesBody(
    interactionState: InteractionState,
    seriesIndex: number,
  ): Body {
    const chartDef = interactionState.chartDefinition as ChartDefinition;
    const series = chartDef.series[seriesIndex];
    const text = series.tooltipText;

    let linesColor = null;
    let prefixText = null;
    const alignColumns = chartDef.isDiff != null && chartDef.isDiff;
    if (chartDef.isDiff) {
      // Decides color for new and old data series.
      const seriesCount = chartDef.series.length;
      const seriesInEachLayer = seriesCount / chartDef.pie.layers.length;
      const twinIndex = (seriesIndex + seriesInEachLayer) % seriesCount;
      const twinSeries = chartDef.series[twinIndex];
      assert(series.brush != null);
      assert(twinSeries.brush != null);
      const seriesColor = {
        color: series.brush!.getFill(),
        alpha: series.brush!.getFillOpacity(),
      };
      const twinColor = {
        color: twinSeries.brush!.getFill(),
        alpha: twinSeries.brush!.getFillOpacity(),
      };
      // Sets color testing whether seriesIndex corresponds to a
      // background (old data) or foreground (new data) serie.
      linesColor =
        seriesIndex > twinIndex
          ? [seriesColor, twinColor]
          : [twinColor, seriesColor];
      prefixText = [
        this.diffTooltipNewDataPrefix,
        this.diffTooltipOldDataPrefix,
      ];
    }

    // Build tooltip body from text.
    // There are 2 different formats described below using the following legend:
    // - <UPPERCASE-TEMPLATE> = bold text
    // - <lowercase-template> = normal text
    // - (x) = optional color square indicating serie
    const body: Body = {entries: []};
    if (text.serieTitle) {
      // Format #1 - serie driven (scatter and pie charts):
      //   (x) <serie-title>
      //       <CONTENT>
      const isTitleInSeparateLine = true;
      this.addSerieLine(
        body,
        text.serieTitle,
        text.content,
        true,
        this.showColorCode,
        series,
        isTitleInSeparateLine,
        linesColor,
        prefixText,
        alignColumns,
      );
    } else {
      // Format #2 - free text (user defined):
      //   (x) <content>
      this.addSerieLine(
        body,
        null,
        text.content,
        false,
        this.showColorCode,
        series,
      );
    }

    this.embedActionsMenu(body, interactionState.actionsMenuEntries);

    return body;
  }

  createAggregateSeriesBody(
    interactionState: InteractionState,
    seriesIndices: number[],
  ): Body {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    const body: Body = {entries: []};
    forEach(seriesIndices, (seriesIndex) => {
      const series = chartDefinition.series[seriesIndex];
      const text = series.tooltipText;

      // Build tooltip body from text.
      // There are 2 different formats described below using the following
      // legend:
      // - <UPPERCASE-TEMPLATE> = bold text
      // - <lowercase-template> = normal text
      // - (x) = optional color square indicating serie
      if (text.serieTitle) {
        // Format #1 - serie driven (scatter and pie charts):
        //   (x) <serie-title>
        //       <CONTENT>
        this.addSerieLine(
          body,
          text.serieTitle,
          text.content,
          true,
          this.showColorCode,
          series,
          true,
        );
      } else {
        // Format #2 - free text (user defined):
        //   (x) <content>
        this.addSerieLine(
          body,
          null,
          text.content,
          false,
          this.showColorCode,
          series,
        );
      }
    });

    this.embedActionsMenu(body, interactionState.actionsMenuEntries);

    return body;
  }

  createCategoryBody(
    interactionState: InteractionState,
    categoryIndex: number,
  ): Body | null {
    const chartDefinition = interactionState.chartDefinition as ChartDefinition;
    const category = chartDefinition.categories[categoryIndex];
    let text = category.tooltipText;

    let hasData = false;
    const body: Body = {entries: []};
    if (text && text.content) {
      // Free text (user defined).
      this.addSerieLine(body, null, text.content, false, false);
    } else {
      // The order of the series in the tooltip is reversed if the chart is
      // stacked as we do in a vertical legend. The multi-domain logic is
      // preserved.
      let seriesIndex = 0;
      let direction = 1;
      let lastIndex = chartDefinition.series.length;
      if (reverseSeriesLabelsVertically(chartDefinition)) {
        seriesIndex = chartDefinition.series.length - 1;
        direction = -1;
        lastIndex = -1;
      }
      let domainIndex = null;
      for (; seriesIndex !== lastIndex; seriesIndex += direction) {
        const series = chartDefinition.series[seriesIndex];
        if (!series.showTooltip) {
          continue;
        }
        const actualCategoryIndex = chartDefinition.getCanonicalCategoryIndex(
          seriesIndex,
          categoryIndex,
        );
        if (domainIndex !== series.domainIndex) {
          domainIndex = series.domainIndex;
          if (domainIndex == null) {
            continue;
          }
          const domainTitle =
            chartDefinition.categories[categoryIndex].titles[domainIndex];
          if (!isEmptyOrWhitespace(makeSafe(domainTitle))) {
            this.addTitleLine(body, domainTitle);
          }
        }

        if (
          series.points[actualCategoryIndex] &&
          series.points[actualCategoryIndex]!.tooltipText &&
          series.points[actualCategoryIndex]!.tooltipText!.content
        ) {
          text = series.points[actualCategoryIndex]!.tooltipText;
          this.addSerieLine(
            body,
            text!.serieTitle,
            text!.content,
            true,
            this.showColorCode,
            series,
            undefined,
            undefined,
            undefined,
            undefined,
            text!.hasCustomContent && text!.hasHtmlContent,
          );
          hasData = true;
        }
      }
    }

    if (
      interactionState.actionsMenuEntries != null &&
      interactionState.actionsMenuEntries.length > 0
    ) {
      hasData = true;
    }

    this.embedActionsMenu(body, interactionState.actionsMenuEntries);

    if (!hasData && !this.showEmpty) {
      return null;
    }

    return body;
  }

  /**
   * Adds a title line to the tooltip body.
   * @param body The tooltip body.
   * @param title The text of the title.
   */
  private addTitleLine(body: Body, title: string) {
    const lineEntry = createBodyTextLineEntry(title, this.getBoldTextStyle());
    body.entries.push(lineEntry);
  }

  /**
   * Adds a line to the tooltip body that describes a serie value.
   * The line contains:
   * 1. A square with the color of the serie (optional).
   * 2. The specified text (preceded by the serieTitle + ': ' if not null).
   * The line may be split into a few lines if '\n' appears in the text.
   * @param serieTitle The serie title text.
   * @param text The text to write in the line.
   * @param isTextBold Should the text be bold or not.
   * @param showColorCode Whether to add a square colored the same as the series.
   * @param serie The relevant serie.
   *     Required only if showColorCode is true.
   * @param isTitleInSeparateLine If true, we put the title in a separate line, false - we put the title and the content in the same line. Default is 'false'.
   * @param linesColor optional color for each line defined.
   *     Especially useful for customization of body in diff mode. Consists of string (for color) and number (for alpha, from 0 to 1).
   * @param prefixText optional prefix text to be added to each line defined. Especially useful for customization of body in diff mode.
   * @param alignColumns optional flag to align columns among lines.
   * @param isHtml optional flag to signal that the content should be interpreted as HTML.
   * @return The line for a tooltip that describes a key/value pair or undefined.
   */
  getSerieLines(
    serieTitle: string | null | undefined,
    text: string | null,
    isTextBold: boolean,
    showColorCode: boolean,
    serie?: chartDefinitionTypes.SerieDefinition,
    isTitleInSeparateLine = false,
    linesColor?: Array<{color: string; alpha: number}> | null,
    prefixText?: string[] | null,
    alignColumns?: boolean,
    isHtml?: boolean,
  ): BodyEntry[] {
    const textStyle = isTextBold
      ? this.getBoldTextStyle()
      : this.getTextStyle();
    const textLines = text == null ? [] : text.split('\n');

    assert(linesColor == null || linesColor.length === textLines.length);

    // When lines color defined, always put title in separate line to correctly
    // color each line.  This line was effectively obsoleted. Is it needed?
    // isTitleInSeparateLine = isTitleInSeparateLine || linesColor != null;

    // First line.
    let color = showColorCode ? serie!.color!.color : null;
    let lineEntry;
    if (isTitleInSeparateLine && serieTitle != null) {
      lineEntry = createBodyTextLineEntry(
        serieTitle,
        this.getTextStyle(),
        null,
        null,
        color,
        serie && serie.colorOpacity,
      );
    } else {
      lineEntry = createBodyTextLineEntry(
        textLines[0],
        textStyle,
        serieTitle,
        this.getTextStyle(),
        color,
        serie && serie.colorOpacity,
        null,
        isHtml,
      );
    }

    const entries = [lineEntry];
    // Additional lines.
    for (let i = isTitleInSeparateLine ? 0 : 1; i < textLines.length; i++) {
      // Use a transparent square for aligning the lines with the 1st line.
      color =
        linesColor != null
          ? linesColor[i].color
          : showColorCode
            ? NO_COLOR
            : null;
      const alpha = linesColor != null ? linesColor[i].alpha : null;
      const tlPrefixText = prefixText != null ? prefixText[i] : null;
      lineEntry = createBodyTextLineEntry(
        textLines[i],
        textStyle,
        null,
        null,
        color,
        alpha,
        tlPrefixText,
        isHtml,
      );
      lineEntry.alignColumns = alignColumns;
      entries.push(lineEntry);
    }

    return entries;
  }

  /**
   * Adds a line to the tooltip body that describes a serie value.
   * The line contains:
   * 1. A square with the color of the serie (optional).
   * 2. The specified text (preceded by the serieTitle + ': ' if not null).
   * The line may be split into a few lines if '\n' appears in the text.
   * @param body The tooltip body.
   * @param serieTitle The serie title text.
   * @param text The text to write in the line.
   * @param isTextBold Should the text be bold or not.
   * @param showColorCode Whether to add a square colored the same as the series.
   * @param serie The relevant serie.
   *     Required only if showColorCode is true.
   * @param isTitleInSeparateLine If true, we put the title in a separate line, false - we put the title and the content in the same line. Default is 'false'.
   * @param linesColor optional color for each line defined in text.
   *     Especially useful for customization in diff mode.
   * @param prefixText optional prefix text to be added to each line defined. Especially useful for customization of body in diff mode.
   * @param alignColumns optional flag to align columns among lines.
   * @param isHtml optional flag to signal that the content should be interpreted as HTML.
   */
  private addSerieLine(
    body: Body,
    serieTitle: string | null | undefined,
    text: string | null,
    isTextBold: boolean,
    showColorCode: boolean,
    serie?: chartDefinitionTypes.SerieDefinition,
    isTitleInSeparateLine?: boolean,
    linesColor?: Array<{color: string; alpha: number}> | null,
    prefixText?: string[] | null,
    alignColumns?: boolean,
    isHtml?: boolean,
  ) {
    body.entries.push.apply(
      body.entries,
      this.getSerieLines(
        serieTitle,
        text,
        isTextBold,
        showColorCode,
        serie,
        isTitleInSeparateLine,
        linesColor,
        prefixText,
        alignColumns,
        isHtml,
      ),
    );
  }

  /**
   * Returns a line for the tooltip body that describes a key/value pair.
   * The line contains the specified key + ': ' + the value in bold.
   * @param key The key to write in the line.
   * @param value The value to write in the line.
   * @return The line for a tooltip that describes a key/value pair or undefined.
   */
  getKeyValueLine(key: string, value: string): BodyEntry | null {
    if (!key) {
      return null;
    }
    return createBodyTextLineEntry(
      value,
      this.getBoldTextStyle(),
      key,
      this.getTextStyle(),
    );
  }

  /**
   * Adds a line to the tooltip body that describes a key/value pair.
   * The line contains the specified key + ': ' + the value in bold.
   * @param body The tooltip body.
   * @param key The key to write in the line.
   * @param value The value to write in the line.
   */
  private addKeyValueLine(body: Body, key: string, value: string) {
    const line = this.getKeyValueLine(key, value);
    if (line != null) {
      body.entries.push(line);
    }
  }

  /** @param body The tooltip body. */
  override embedActionsMenu(
    body: Body,
    actionsMenuEntries: BodyEntry[],
    addSeparator = true,
  ) {
    if (!actionsMenuEntries || actionsMenuEntries.length === 0) {
      return;
    }
    if (addSeparator) {
      body.entries.push(createBodySeparatorEntry());
    }
    // Add the actions menu entries to the tooltip body.
    extend(body.entries, actionsMenuEntries);
  }
}
