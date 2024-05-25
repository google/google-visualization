/**
 * @fileoverview The container class for the trendlines enum.
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

import {exponentialTrendline} from './exponential_trendline';
import {linearTrendline} from './linear_trendline';
import {polynomialTrendline} from './polynomial_trendline';

/** The type of trendline. */
export enum TrendlineType {
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  POLYNOMIAL = 'polynomial',
}

/** A map of trendline symbol to trendline function. */
export const TRENDLINE_TYPE_TO_FUNCTION: {[key: string]: Function} = {
  [TrendlineType.LINEAR]: linearTrendline,
  [TrendlineType.EXPONENTIAL]: exponentialTrendline,
  [TrendlineType.POLYNOMIAL]: polynomialTrendline,
};
