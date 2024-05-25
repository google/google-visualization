/**
 * @fileoverview Provides functionality for creating tooltip content for the
 * canonical visualizations.
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
  DEFAULT_DIFF_NEW_DATA_PREFIX_TEXT,
  DEFAULT_DIFF_OLD_DATA_PREFIX_TEXT,
} from '../common/defaults';
import {ActionsMenuDefiner} from './actions_menu_definer';

import {AggregationTarget, FocusTarget} from '../common/option_types';
import {Options} from '../common/options';
import {TextStyle} from '../text/text_style';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import * as chartDefinitionTypes from '../visualization/corechart/chart_definition_types';
import {createBodyTextLineEntry} from './tooltip_definer_utils';
import {Body, BodyEntry, InteractionState} from './tooltip_definition';

/** Base class for tooltip body creators. */
export abstract class TooltipBodyCreator {
  /**
   * Whether to draw an element colored same as the serie next to the value
   * to better indicate the serie the value comes from.
   * By default, only show color code when the tooltip contains multiple
   * values.
   */
  protected showColorCode: boolean;

  /**
   * Whether to draw an element colored same as the serie next to the value
   * to better indicate the serie the value comes from.
   * By default, only show color code when the tooltip contains multiple
   * values.
   */
  showColorCodeForAggregate: boolean;

  /** Whether empty tooltips should be shown. */
  protected showEmpty: boolean;

  /** The normal text style to use in the tooltips. */
  protected textStyle: TextStyle;

  /** The bold text style to use in the tooltips. */
  protected boldTextStyle: TextStyle;

  /** The action menu which should be embedded inside the tooltip, or null. */
  protected actionsMenuDefiner: ActionsMenuDefiner | null;

  /** Tooltip prefix for new data in diff charts. */
  protected diffTooltipNewDataPrefix: string;

  /** Tooltip prefix for old data in diff charts. */
  protected diffTooltipOldDataPrefix: string;

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
    // Only use the default font name and size. Ignore any other property.
    const tooltipTextStyle = chartOptions.inferTextStyleValue(
      'tooltip.textStyle',
      {fontName: chartTextStyle.fontName, fontSize: chartTextStyle.fontSize},
    );

    this.showColorCode = chartOptions.inferBooleanValue(
      'tooltip.showColorCode',
      focusTarget.has(FocusTarget.CATEGORY),
    );

    this.showColorCodeForAggregate = chartOptions.inferBooleanValue(
      'tooltip.showColorCode',
      true,
    );

    this.showEmpty = chartOptions.inferBooleanValue('tooltip.showEmpty', true);

    this.textStyle = tooltipTextStyle;

    this.boldTextStyle = chartOptions.inferTextStyleValue('tooltip.textStyle', {
      fontName: chartTextStyle.fontName,
      fontSize: chartTextStyle.fontSize,
      bold: true,
    });

    this.actionsMenuDefiner = actionsMenuDefiner || null;

    this.diffTooltipNewDataPrefix = chartOptions.inferStringValue(
      'diff.newData.tooltip.prefix',
      DEFAULT_DIFF_NEW_DATA_PREFIX_TEXT,
    );

    this.diffTooltipOldDataPrefix = chartOptions.inferStringValue(
      'diff.oldData.tooltip.prefix',
      DEFAULT_DIFF_OLD_DATA_PREFIX_TEXT,
    );
  }

  abstract createDatumBody(
    interactionState: InteractionState,
    seriesIndex: number,
    categoryIndex: number,
  ): Body;

  abstract createAggregateDataBody(
    interactionState: InteractionState,
    data: chartDefinitionTypes.Datum[],
    aggregationTarget: AggregationTarget,
  ): Body;

  abstract createAggregateSeriesBody(
    interactionState: InteractionState,
    seriesIndices: number[],
  ): Body;

  abstract createSeriesBody(
    interactionState: InteractionState,
    seriesIndex: number,
  ): Body;

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
  abstract getSerieLines(
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
  ): BodyEntry[];

  /**
   * Returns a line for the tooltip body that describes a key/value pair.
   * The line contains the specified key + ': ' + the value in bold.
   * @param key The key to write in the line.
   * @param value The value to write in the line.
   * @return The line for a tooltip that describes a key/value pair or undefined.
   */
  abstract getKeyValueLine(key: string, value: string): BodyEntry | null;

  abstract createCategoryBody(
    interactionState: InteractionState,
    categoryIndex: number,
  ): Body | null;

  /**
   * Embeds the actions menu in the tooltip body.
   * Adds a separator followed by the actions menu entries to the tooltip body.
   * @param body The tooltip body.
   * @param actionsMenuEntries The actions menu entries.
   * @param addSeparator Whether to add a separator to the body.
   */
  embedActionsMenu(
    body: Body,
    actionsMenuEntries: BodyEntry[],
    addSeparator = true,
  ) {} // Do nothing in the "abstract" implementation.

  /**
   * Creates a tooltip body for a datum annotation.
   * @param seriesIndex The series index.
   * @param categoryIndex The category index.
   * @param annotationIndex The annotation index.
   * @return The tooltip body.
   */
  createDatumAnnotationBody(
    interactionState: InteractionState,
    seriesIndex: number,
    categoryIndex: number,
    annotationIndex: number,
  ): Body {
    const series = (interactionState.chartDefinition as ChartDefinition).series[
      seriesIndex
    ];
    const datum = series.points[categoryIndex];
    // TS2352: Conversion of type 'TextBlock' to type 'Annotation' may be a
    // mistake because neither type sufficiently overlaps with the other.
    const annotation = datum!.annotation!.labels[
      annotationIndex
    ] as unknown as chartDefinitionTypes.Annotation;

    const body: Body = {
      entries: [
        createBodyTextLineEntry(
          (annotation.tooltipText as chartDefinitionTypes.TooltipText).content,
          this.getTextStyle(),
        ),
      ],
    };

    this.embedActionsMenu(body, interactionState.actionsMenuEntries);

    return body;
  }

  /**
   * Creates a tooltip body for a datum annotation.
   * @param categoryIndex The category index.
   * @param annotationIndex The annotation index.
   * @return The tooltip body.
   */
  createCategoryAnnotationBody(
    interactionState: InteractionState,
    categoryIndex: number,
    annotationIndex: number,
  ): Body {
    const category = (interactionState.chartDefinition as ChartDefinition)
      .categories[categoryIndex];
    // TS2352: Conversion of type 'TextBlock | null' to type 'Annotation' may be
    // a mistake because neither type sufficiently overlaps with the other.
    const annotation = (category.annotation &&
      category.annotation.labels[
        annotationIndex
      ]) as unknown as chartDefinitionTypes.Annotation;

    const body: Body = {
      entries: [
        createBodyTextLineEntry(
          (annotation.tooltipText as chartDefinitionTypes.TooltipText).content,
          this.getTextStyle(),
        ),
      ],
    };

    if (interactionState.actionsMenuEntries.length > 0) {
      this.embedActionsMenu(body, interactionState.actionsMenuEntries);
    }

    return body;
  }

  /** @return The normal tooltip text style. */
  getTextStyle(): TextStyle {
    return this.textStyle;
  }

  /** @return The bold tooltip text style. */
  getBoldTextStyle(): TextStyle {
    return this.boldTextStyle;
  }

  /**
   * @return Whether the tooltip has an embedded actions menu.
   *     The actions menu is expected to have at least one entry.
   */
  hasActionsMenu(): boolean {
    return (
      this.actionsMenuDefiner != null &&
      this.actionsMenuDefiner.getEntries().length > 0
    );
  }
}
