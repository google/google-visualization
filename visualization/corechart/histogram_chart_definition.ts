/**
 * @fileoverview Definition for Histogram charts.
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

import {roundToNumSignificantDigits} from '../../common/util';
import {ChartDefinition} from './chart_definition';

import {
  CellRef,
  Datum,
} from '../../visualization/corechart/chart_definition_types';

// During migration
// tslint:disable:ban-types Migration
// tslint:disable:ban-strict-prop-init-comment

/**
 * Extend ChartDefinition to add Histogram specific properties and behavior.
 * @unrestricted
 */
export class HistogramChartDefinition extends ChartDefinition {
  /**
   * Whether to draw all histograms as column charts (no
   *     subdivisions within buckets).
   */
  override histogramAsColumnChart: boolean = this.histogramAsColumnChart;

  constructor() {
    super();
  }

  override getCategoryTitleForDatum(datum: Datum) {
    const seriesIndex = datum.serie;
    const categoryIndex = datum.category;

    if (!this.histogramAsColumnChart) {
      // Get category title from incoming datatable.
      const mapping = (this.series as AnyDuringMigration)[seriesIndex]
        .properties['histogramBucketItems'][categoryIndex];
      return mapping['label'].categoryTitle;
    } else {
      return super.getCategoryTitleForDatum(datum);
    }
  }

  override getCategoryIndexForDatum(datum: Datum) {
    if (!this.histogramAsColumnChart) {
      const mapping = (this.series as AnyDuringMigration)[datum.serie]
        .properties['histogramBucketItems'][datum.category];
      return mapping.row;
    } else {
      return super.getCategoryIndexForDatum(datum);
    }
  }

  override getCellRefForDatum(datum: Datum) {
    if (!this.histogramAsColumnChart) {
      const mapping = (this.series as AnyDuringMigration)[datum.serie]
        .properties['histogramBucketItems'][datum.category];
      return {row: mapping.row, column: mapping.column};
    } else {
      return super.getCellRefForDatum(datum);
    }
  }

  override getDatumForCellRef(cell: CellRef) {
    const columnInfo = this.dataTableColumnRoleInfo[cell.column];
    const serieIndex = columnInfo.serieIndex;
    if (serieIndex == null) {
      return null;
    }

    if (!this.histogramAsColumnChart) {
      const datum = {
        serie: serieIndex,
        category: (this.series as AnyDuringMigration)[serieIndex].properties[
          'histogramElementIndexes'
        ][cell.row],
      };
      return datum;
    } else {
      return super.getDatumForCellRef(cell);
    }
  }

  override getTooltipText(seriesIndex: number, categoryIndex: number) {
    /**
     * @desc Label for the count of items in a histogram bucket, presented in
     * a tooltip in a context like: "Items: 19" to show that there are 19
     * items in this numeric bucket.
     */
    const MSG_GENERIC_COUNT_LABEL = goog.getMsg('Items');

    const series = this.series[seriesIndex];
    const point = series.points[categoryIndex];
    let tooltipText;

    if (!this.histogramAsColumnChart) {
      // Histograms show a different tooltip depending on which segment of this
      // aggregate-point you're hovering on. Set the tooltip text to be used
      // accordingly.
      const mapping = series.properties['histogramBucketItems'][categoryIndex];
      tooltipText = mapping['label'];
    } else {
      // When histograms are shown as col charts (no separation between items)
      // show a tooltip representing the aggregate of the bucket instead.
      // Need to convert from nonscaled numbers back to values.
      const numb = point!.nonScaled.to - point!.nonScaled.from;
      const targetAxis =
        this.orientation === 'horizontal'
          ? this.vAxes[series.targetAxisIndex]
          : this.hAxes[series.targetAxisIndex];
      const value = roundToNumSignificantDigits(
        15,
        targetAxis.number.toValue(numb) as number,
      );
      tooltipText = {lines: [{title: MSG_GENERIC_COUNT_LABEL, value}]};
    }
    return tooltipText;
  }
}
