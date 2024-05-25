/**
 * @fileoverview An interface for the AxisChartDefiner.
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

import {AxisDefiner} from '../../axis/axis_definer';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {TooltipText} from '../../text/text_block';
import {TextMeasureFunction} from '../../text/text_measure_function';
import {
  DivisionDefinition,
  SerieDefinition,
} from '../../visualization/corechart/chart_definition_types';
import {ChartDefinition} from './chart_definition';

/**
 * Provides interface for the AxisChartDefiner, which is used by AnnotationDefiner.
 * @unrestricted
 */
export interface AxisChartDefinerInterface {
  getChartDefinition(): ChartDefinition;

  getDataView(): AbstractDataTable;

  getDomainAxisDefiner(): AxisDefiner | null;
  getTargetAxisDefiner(n: number): AxisDefiner | null;

  getDivisionDefinition(): DivisionDefinition | null;

  getNumericDomainValue(row: number, serie?: SerieDefinition): number | null;

  getTextMeasureFunction(): TextMeasureFunction;

  isTooltipEnabled(): boolean;

  getCustomTooltipText(
    tooltipColumnIndex: number,
    rowIndex: number,
  ): TooltipText;
}
