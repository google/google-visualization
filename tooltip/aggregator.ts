/**
 * @fileoverview Aggregator superclass for the default tooltip body creator.
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

import {forEach} from '@npm//@closure/array/array';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import * as chartDefinitionTypes from '../visualization/corechart/chart_definition_types';
import {TooltipBodyCreator} from './tooltip_body_creator';
import {BodyEntry} from './tooltip_definition';

/** A class that aggregates data based on any number of criteria. */
export abstract class Aggregator {
  /** @param chartDefinition The chart definition. */
  constructor(public chartDefinition: ChartDefinition) {}

  abstract getKey(datum: chartDefinitionTypes.Datum): number;

  abstract getTitle(datum: chartDefinitionTypes.Datum): string | null;

  abstract getContent(
    bodyCreator: TooltipBodyCreator,
    text: chartDefinitionTypes.TooltipText,
    datum: chartDefinitionTypes.Datum,
  ): BodyEntry[];

  /**
   * Aggregates data based on the unique keys returned by the getKey method of
   *     this class
   * @param data The data that should be aggregated.
   * @return The organized aggregated data.
   */
  aggregate(
    data: chartDefinitionTypes.Datum[],
  ): chartDefinitionTypes.Aggregate {
    const aggregate: chartDefinitionTypes.Aggregate = {
      index: {},
      order: [],
      titles: {},
    };
    forEach(data, (datum, datumIndex) => {
      const key = this.getKey(datum);
      if (key == null) {
        return;
      }
      // We'll need key to be a string in the following, so make it so.
      const keyString = key.toString();
      if (!aggregate.titles.hasOwnProperty(keyString)) {
        const title = this.getTitle(datum);
        if (title) {
          aggregate.titles[keyString] = title;
        }
      }
      if (!aggregate.index.hasOwnProperty(keyString)) {
        aggregate.index[keyString] = [];
        aggregate.order.push(keyString);
      }
      aggregate.index[keyString].push(datum);
    });
    return aggregate;
  }

  /**
   * Gets the category title of a given datum.
   * @param datum The relevant datum.
   * @return The category title of the given datum or null if there is no such category.
   */
  getCategoryTitle(datum: chartDefinitionTypes.Datum): string | null {
    return this.chartDefinition.getCategoryTitleForDatum(datum);
  }

  /**
   * Gets the series title of a given datum.
   * @param datum The relevant datum.
   * @return The series title of the given datum.
   */
  getSeriesTitle(datum: chartDefinitionTypes.Datum): string | null {
    return this.chartDefinition.getSeriesTitleForDatum(datum);
  }
}
