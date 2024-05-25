/**
 * @fileoverview Category aggregator for the default tooltip body creator.
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

import {ChartDefinition} from '../visualization/corechart/chart_definition';
import * as chartDefinitionTypes from '../visualization/corechart/chart_definition_types';
import {Aggregator} from './aggregator';
import {TooltipBodyCreator} from './tooltip_body_creator';
import {BodyEntry} from './tooltip_definition';

/**
 * A class that aggregates data based on any number of criteria.
 * @unrestricted
 */
export class CategoryAggregator extends Aggregator {
  /** @param chartDefinition The chart definition. */
  constructor(chartDefinition: ChartDefinition) {
    super(chartDefinition);
  }

  getKey(datum: chartDefinitionTypes.Datum): number {
    return this.chartDefinition.getCategoryIndexForDatum(datum);
  }

  getTitle(datum: chartDefinitionTypes.Datum): string | null {
    return this.getCategoryTitle(datum);
  }

  /** @suppress {missingProperties} */
  getContent(
    bodyCreator: TooltipBodyCreator,
    text: chartDefinitionTypes.TooltipText,
    datum: chartDefinitionTypes.Datum,
  ): BodyEntry[] {
    const title = this.getSeriesTitle(datum);
    return bodyCreator.getSerieLines(
      title,
      text.content || '',
      true,
      bodyCreator.showColorCodeForAggregate,
      this.chartDefinition.series[datum.serie],
    );
  }
}
