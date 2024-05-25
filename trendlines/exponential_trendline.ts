/**
 * @fileoverview This file provides exponential trendlines.
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
import {NaryOperator} from '../math/expression/nary_operator';
import {GVizNumber} from '../math/expression/number';
import {Pow} from '../math/expression/power';
import {Variable} from '../math/expression/variable';
import {linearRegression} from './linear_regression';

/**
 * Calculates an exponential trendline for the given data.
 * @param dataSize The number of rows in the data.
 * @param domainGetter The function that should be used to get the domain value for a row.
 * @param dataGetter The function that should be used to get the data value for a row.
 * @param options The set of options for this trendline:
 *   range: The real range for which the trendline should be calculated.
 *   maxGap: The largest gap size that should appear in the trendline.
 * @return The data and equation of the trendline.
 */
export function exponentialTrendline(
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
  let minimum: number | null = Infinity;
  for (let i = 0; i < dataSize; i++) {
    const y = dataGetter(i);
    if (y == null) {
      continue;
    }
    if (y < minimum) {
      minimum = y;
    }
  }
  if (minimum > 0) {
    minimum = null;
  } else {
    minimum = minimum - 1;
  }

  const trendline = linearRegression(
    dataSize,
    domainGetter,
    (i) => {
      let value = dataGetter(i);
      if (value == null) {
        return null;
      }
      if (minimum != null) {
        value -= minimum;
      }
      return Math.log(value);
    },
    options,
  );
  if (trendline === null) {
    return null;
  }
  const outdata = [];
  for (let i = 0; i < trendline.data.length; i++) {
    const x = trendline.data[i][0];
    let y = Math.exp(trendline.data[i][1]);
    if (minimum != null) {
      y += minimum;
    }
    outdata.push([x, y]);
  }

  const makeEquation: (p1?: string, p2?: string) => Expression = (x, y) => {
    let equation: NaryOperator = new Mul(
      [
        new GVizNumber(Math.exp(trendline.equation.offset)),
        new Pow([
          new Variable('e'),
          new Mul([
            new GVizNumber(trendline.equation.slope),
            new Variable(x || 'x'),
          ]),
        ]),
      ],
      true,
    );
    if (minimum !== null) {
      equation = new Add([equation, new GVizNumber(minimum)]);
    }
    equation = new Eq([new Variable(y || 'y'), equation]);

    return equation;
  };

  return {
    data: outdata,
    r2: trendline.r2,
    equation: makeEquation().simplify(),
    makeEquation,
  };
}
