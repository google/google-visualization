/**
 * @fileoverview This file provides a function for calculating a linear
 * regression.
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

import * as numberScale from '../common/number_scale_util';
import {polynomialTrendline} from './polynomial_trendline';
import {TrendlineEquation} from './polynomial_trendline_definer';

/**
 * Calculates the linear regression for a given dataset.
 * @param size The size of the data.
 * @param domainGetter A function that, given the index of the datum, returns the domain value for that index.
 * @param dataGetter A function that, given the index of the datum, returns the data value for that index.
 * @param options The set of options for this trendline:
 *   range: The real range for which the trendline should be calculated.
 *   maxGap: The largest gap size that should appear in the trendline.
 *   domainScale: The scale to convert from data-space to screen-space and back.
 * @return The data for the linear regression of the given data.
 */
export function linearRegression(
  size: number,
  domainGetter: (p1: number) => number,
  dataGetter: (p1: number) => number | null,
  options: {
    range?: {min?: number | null; max?: number | null} | null;
    domainScale?: numberScale.Converter;
    maxGap?: number;
  },
): {
  r2: number;
  data: number[][];
  equation: {offset: number; slope: number};
} | null {
  const trendline = polynomialTrendline(size, domainGetter, dataGetter, {
    range: options.range,
    maxGap: options.maxGap,
    degree: 1,
    domainScale: options.domainScale,
  });
  if (trendline === null || isNaN(trendline.r2)) {
    return null;
  }
  // Otherwise trendline.coefficients[0] is the offset and
  // trendline.coefficients[1] is the slope.
  const trendlineEquation = trendline as TrendlineEquation;
  return {
    data: trendline.data,
    r2: trendline.r2,
    equation: {
      offset: trendlineEquation.coefficients[0],
      slope: trendlineEquation.coefficients[1],
    },
  };
}
