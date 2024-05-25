/**
 * @fileoverview This file provides linear trendlines.
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
import {Add} from '../math/expression/add';
import {Eq} from '../math/expression/eq';
import {Expression} from '../math/expression/expression';
import {Mul} from '../math/expression/mul';
import {GVizNumber} from '../math/expression/number';
import {Variable} from '../math/expression/variable';
import {linearRegression} from './linear_regression';

/**
 * @param dataSize The number of rows in the data.
 * @param domainGetter The function that should be used to get the domain value for a row.
 * @param dataGetter The function that should be used to get the data value for a row.
 * @param options The set of options for this trendline:
 *   range: The real range for which the trendline should be calculated.
 *   maxGap: The largest gap size that should appear in the trendline.
 * @return The data and equation of the trendline.
 */
export function linearTrendline(
  dataSize: number,
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
  equation: Expression;
  makeEquation: (p1?: string, p2?: string) => Expression;
} | null {
  const trendline = linearRegression(
    dataSize,
    domainGetter,
    dataGetter,
    options,
  );
  if (trendline === null) {
    return null;
  }

  const makeEquation: (p1?: string, p2?: string) => Expression = (
    optX,
    optY,
  ) => {
    const equation = new Eq([
      new Variable(optY || 'y'),
      new Add([
        new Mul([
          new GVizNumber(trendline.equation.slope),
          new Variable(optX || 'x'),
        ]),
        new GVizNumber(trendline.equation.offset),
      ]),
    ]);
    return equation;
  };
  return {
    data: trendline.data,
    r2: trendline.r2,
    equation: makeEquation().simplify(),
    makeEquation,
  };
}
