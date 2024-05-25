/**
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

import * as asserts from 'google3/javascript/typescript/contrib/assert';
import * as googArray from '@npm//@closure/array/array';
import {Matrix} from '@npm//@closure/math/matrix';
import * as numberScale from '../common/number_scale_util';
import {Add} from '../math/expression/add';
import {Eq} from '../math/expression/eq';
import {Expression} from '../math/expression/expression';
import {Mul} from '../math/expression/mul';
import {GVizNumber} from '../math/expression/number';
import {Pow} from '../math/expression/power';
import {Variable} from '../math/expression/variable';
import {DataBuilder} from './data_builder';

/** The equation and data for a trendline. */
export interface TrendlineEquation {
  readonly coefficients: number[];
  readonly r2: number;
  readonly data: number[][];
  readonly equation: Expression;
  readonly makeEquation: (p1?: string, p2?: string) => Expression;
}

/** @unrestricted */
export class PolynomialTrendlineDefiner {
  /** The degree of the polynomial. */
  private readonly degree: number;

  /** The range for which the data should be generated. */
  private readonly range?: {min?: number | null; max?: number | null} | null;

  /** The largest gap size that should appear in the trendline. */
  private readonly maxGap?: number;

  /**
   * The sum of all the gaps between the data points. Used for calculating the
   * average gap.
   */
  private gapSum = 0;

  /**
   * The scale to convert from data space coordinates to coordinates that take
   * the domain scale into account, e.g. gaps and log scale.
   */
  private readonly domainScale: numberScale.Converter;

  /**
   * The sum of all the y points in the data. Used for calculating the average
   * for the r^2.
   */
  private ySum = 0;

  /**
   * All the points that should be considered for this trendline. Only valid
   * points should be added here.
   */
  private readonly data: Array<{x: number; y: number}> = [];

  /**
   * @param options The set of options for this trendline:
   *   range: The real range for which the trendline should be calculated.
   *   maxGap: The largest gap size that should appear in the trendline.
   *   degree: The degree of the polynomial that should be fit to the data.
   *   domainScale: The scale to convert from data-space to screen-space and back.
   */
  constructor(options: {
    range?: {min?: number | null; max?: number | null} | null;
    maxGap?: number;
    domainScale?: numberScale.Converter;
    degree: number;
  }) {
    this.degree = options.degree + 1;

    this.range = options.range;

    this.maxGap = options.maxGap;

    this.domainScale = options.domainScale || numberScale.getIdentityScale();
  }

  /**
   * Adds a point to the data set. Numbers must be finite and numbers.
   * @param x The X component.
   * @param y The Y component.
   */
  add(x: number, y: number) {
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));
    if (isFinite(this.domainScale.transform(x))) {
      if (this.data.length > 0) {
        const gap = x - this.data[this.data.length - 1].x;
        if (gap > 0) {
          this.gapSum += gap;
        }
      }
      this.ySum += y;
      this.data.push({x, y});
    }
  }

  /** @return Whether the range minimum specified in the options is valid. */
  hasValidRangeMin(): boolean {
    return (
      this.range != null && this.range.min != null && isFinite(this.range.min)
    );
  }

  /** @return Whether the range maximum specified in the options is valid. */
  hasValidRangeMax(): boolean {
    return (
      this.range != null && this.range.max != null && isFinite(this.range.max)
    );
  }

  /** @return Whether the range specified in the options is valid. */
  hasValidRange(): boolean {
    return (
      this.range != null &&
      this.range.min != null &&
      isFinite(this.range.min) &&
      this.range.max != null &&
      isFinite(this.range.max)
    );
  }

  /**
   * Calculates the maximum gap size that the trendline data can contain. This
   * will either be:
   *   1. The user-specified maximum gap size,
   *   2. The trendline domain range divided by 100 or,
   *   3. The average gap size of the data.
   * The gap will be in transformed data space.
   * @return The maximum gap size.
   */
  private calculateGapSize(): number {
    let gap = this.maxGap;
    if (!gap) {
      if (this.hasValidRange()) {
        asserts.assert(this.range!.min != null);
        asserts.assert(this.range!.max != null);
        gap = (this.range!.max! - this.range!.min!) / 100;
      } else {
        gap = undefined;
      }
    }
    if (gap == null || !isFinite(gap)) {
      gap = this.gapSum / (this.data.length - 1);
    }
    return gap;
  }

  /**
   * Produces the value of a non-solution-column cell of the matrix. This is
   * essentially sum(point.x ^ exponent for point in data).
   * @param exponent The exponent to which things should be raised.
   */
  private getMatrixCoefficient(exponent: number): number {
    return this.data.reduce((r, v) => {
      return r + Math.pow(this.domainScale.inverse(v.x), exponent);
    }, 0);
  }

  /**
   * Produces the value of a cell for the solution column of the matrix. This is
   * essentially sum(point.y * point.x ^ exponent for point in data).
   * @param exponent The exponent to which things should be raised.
   */
  private getMatrixRHSCoefficient(exponent: number): number {
    return this.data.reduce((r, v) => {
      return r + Math.pow(this.domainScale.inverse(v.x), exponent) * v.y;
    }, 0);
  }

  /**
   * Constructs the matrix of linear equations that should be solved.
   * The matrix will have [degree] rows, and [degree + 1] columns. The last
   * column of the matrix will be filled with the sums of the y values (the
   * solution column). More reading can be found at
   * http://arachnoid.com/sage/polynomial.html. Each cell in the solution column
   * may be defined as: sum(point.y * point.x ^ row for point in data). Any other
   * cell in the matrix may be defined as: sum(point.x ^ (row + column) for
   * point in data)
   * @return The matrix that should be solved.
   */
  private getMatrix(): Matrix {
    const rows = [];
    const degree = this.degree;
    for (let matrixRowIndex = 0; matrixRowIndex < degree; matrixRowIndex++) {
      const row = new Array(degree + 1);
      for (
        let matrixColumnIndex = 0;
        matrixColumnIndex <= degree;
        matrixColumnIndex++
      ) {
        if (matrixColumnIndex < degree) {
          row[matrixColumnIndex] = this.getMatrixCoefficient(
            matrixRowIndex + matrixColumnIndex,
          );
        } else {
          row[matrixColumnIndex] = this.getMatrixRHSCoefficient(matrixRowIndex);
        }
      }
      rows.push(row);
    }
    return new Matrix(rows);
  }

  /** @return The coefficients of the solution for this trendline. */
  private getSolutionCoefficients(): number[] {
    const solutionMatrix = this.getMatrix().getReducedRowEchelonForm();
    return googArray.range(this.degree).map((d) => {
      return solutionMatrix.getValueAt(d, this.degree)!;
    });
  }

  /**
   * @param coefficients The solution coefficients.
   * @return A function that evaluates the trendline function at any given x point.
   */
  private getEvaluationFunction(
    coefficients: number[],
  ): (p1: number) => number {
    const degree = this.degree;
    return (x) => {
      // All of the units for the TrendlineDefiner are in scaled coordinates,
      // but all the coefficients are calculated in unscaled space. this means
      // that in order to be able to use them to calculate a Y value, we have to
      // unscale our x first.
      const unscaledX = this.domainScale.inverse(x);
      let sum = 0;
      for (let i = 0; i < degree; i++) {
        sum += coefficients[i] * Math.pow(unscaledX, i);
      }
      return sum;
    };
  }

  /**
   * @param coefficients The solution coefficients.
   * @return The equation for the trendline.
   */
  private constructEquation(
    coefficients: number[],
    x?: string,
    y?: string,
  ): Expression {
    const terms = [];
    for (let c = coefficients.length - 1; c >= 0; c--) {
      const coefficient = coefficients[c];
      if (coefficient != null && coefficient !== 0) {
        let term: Expression = new GVizNumber(coefficient);
        if (c > 0) {
          let variable: Expression = new Variable(x || 'x');
          if (c > 1) {
            variable = new Pow([variable, new GVizNumber(c)]);
          }
          term = new Mul([term, variable], true);
        }
        terms.push(term);
      }
    }

    return new Eq([new Variable(y || 'y'), new Add(terms)]);
  }

  /**
   * @param coefficients The solution coefficients.
   * @return The data and r^2 value for this trendline.
   */
  private constructTrendlineData(
    coefficients: number[],
  ): {data: number[][]; r2: number} | null {
    const evaluateEquationAt = this.getEvaluationFunction(coefficients);
    const gapSize = this.calculateGapSize();
    if (
      gapSize == null ||
      isNaN(gapSize) ||
      !isFinite(gapSize) ||
      gapSize === 0
    ) {
      return null;
    }
    const dataBuilder = new DataBuilder(
      gapSize,
      evaluateEquationAt,
      this.domainScale,
    );

    const data = this.data;
    data.sort((a, b) => (a.x > b.x ? 1 : a.x < b.x ? -1 : 0));
    const yMean = this.ySum / data.length;
    const range = this.range;

    if (
      this.hasValidRangeMin() &&
      data.length > 0 &&
      asserts.assertNumber(range!.min) < data[0].x
    ) {
      dataBuilder.addData(range!.min!);
    }

    let ssRes = 0;
    let ssTot = 0;
    let isPerfectTrendline = true;
    for (let i = 0; i < data.length; i++) {
      const x = data[i].x;
      const y = data[i].y;
      const trendlineY = evaluateEquationAt(x);
      isPerfectTrendline = isPerfectTrendline && trendlineY === y;
      dataBuilder.addData(x);
      ssRes += Math.pow(y - trendlineY, 2);
      ssTot += Math.pow(y - yMean, 2);
    }
    const r2 = isPerfectTrendline ? 1 : 1 - ssRes / ssTot;

    if (
      this.hasValidRangeMax() &&
      data.length > 1 &&
      asserts.assertNumber(range!.max) > data[data.length - 1].x
    ) {
      dataBuilder.addData(range!.max!);
    }

    return {data: dataBuilder.build(), r2};
  }

  /** @return The data and equation of the trendline. */
  getTrendline(): {
    coefficients: number[];
    r2: number;
    data: number[][];
    equation: Expression;
    makeEquation: (p1?: string, p2?: string) => Expression;
  } | null {
    const coefficients = this.getSolutionCoefficients();
    const makeEquation: (p1?: string, p2?: string) => Expression = (
      optX,
      optY,
    ) => {
      return this.constructEquation(coefficients, optX, optY);
    };
    const trendline = this.constructTrendlineData(coefficients);

    if (trendline == null || trendline.data.length === 0) {
      return null;
    }

    return {
      coefficients,
      data: trendline.data,
      r2: trendline.r2,
      equation: makeEquation().simplify(),
      makeEquation,
    };
  }
}
