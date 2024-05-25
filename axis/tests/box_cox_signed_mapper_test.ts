/**
 * @fileoverview Tests for boxcox mapper.
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

import {assertRoughlyEquals} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {BoxCoxSignedMapper} from '../box_cox_signed_mapper';

/** Tolerance for mappers created with a lambda value of 0.5. */
const HALF_AND_HALF_TOLERANCE = 0.1;

/** Tolerance for mappers created with a lambda value of 9. */
const LAMBDA_9_TOLERANCE = 0.1;

/** Tolerance for mappers created with a lambda value of 0. */
const LOG_TOLERANCE = 0.01;

class BoxCoxSignedMapperTest {
  /**
   * Create a mapper for testing using a 0.5 lambda value.
   * @param dMin The minimum data value.
   * @param dMax The maximum data value.
   * @param sStart The first screen value.
   * @param sEnd The last screen value.
   * @return The mapper.
   */
  createHalfHalfMapper(
    dMin: number,
    dMax: number,
    sStart: number,
    sEnd: number,
  ): BoxCoxSignedMapper {
    return new BoxCoxSignedMapper(dMin, dMax, sStart, sEnd, 0.5);
  }

  /**
   * Create a mapper for testing using a zero lambda value.
   * @param dMin The minimum data value.
   * @param dMax The maximum data value.
   * @param sStart The first screen value.
   * @param sEnd The last screen value.
   * @return The mapper.
   */
  createLogMapper(
    dMin: number,
    dMax: number,
    sStart: number,
    sEnd: number,
  ): BoxCoxSignedMapper {
    return new BoxCoxSignedMapper(dMin, dMax, sStart, sEnd, 0);
  }

  /**
   * Create a mapper for testing using a lambda value of 9.
   * @param dMin The minimum data value.
   * @param dMax The maximum data value.
   * @param sStart The first screen value.
   * @param sEnd The last screen value.
   * @return The mapper.
   */
  createLambda9Mapper(
    dMin: number,
    dMax: number,
    sStart: number,
    sEnd: number,
  ): BoxCoxSignedMapper {
    return new BoxCoxSignedMapper(dMin, dMax, sStart, sEnd, 9);
  }

  /**
   * Tests the mapper with the given parameters.
   * @param mapper Mapper to test.
   * @param dataValues Data values.
   * @param screenValues Screen values.
   * @param tolerance Assertion tolerance.
   */
  runTest(
    mapper: BoxCoxSignedMapper,
    dataValues: number[],
    screenValues: number[],
    tolerance: number,
  ) {
    for (let i = 0; i < dataValues.length; i++) {
      const screenValue = screenValues[i];
      const dataValue = dataValues[i];
      assertRoughlyEquals(
        screenValue,
        mapper.getScreenValue(dataValue),
        tolerance,
      );
      assertRoughlyEquals(
        dataValue,
        mapper.getDataValue(screenValue),
        tolerance,
      );
    }
  }

  /** @export */
  testBoxCoxHalfAndHalfSuperSimple() {
    const mapper = this.createHalfHalfMapper(100, 200, 100, 200);
    this.runTest(
      mapper,
      [100, 150, 200],
      [100, 154.258, 200],
      HALF_AND_HALF_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxHalfAndHalfSimple() {
    const mapper = this.createHalfHalfMapper(1, 100, 1, 100);
    this.runTest(
      mapper,
      [0, 1, 33, 50, 100, 200],
      [-10, 1, 53.19, 67.78, 100, 145.56],
      HALF_AND_HALF_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxHalfAndHalfAround100() {
    const mapper = this.createHalfHalfMapper(95, 101, 100, 300);
    this.runTest(
      mapper,
      [0.1, 2, 33, 95, 100, 101, 1000],
      [-6123.1, -5398.6, -2541, 100, 267, 300, 14535.72],
      HALF_AND_HALF_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxHalfAndHalfTwisted() {
    const mapper = this.createHalfHalfMapper(0.001, 1000, 300, -100);
    this.runTest(
      mapper,
      [0.0002, 0.001, 0.777, 1.1, 333, 1000, 1234],
      [300.2, 300, 289.2, 287.1, 69.34, -100.0, -144.4],
      HALF_AND_HALF_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxHalfAndHalfComplicated() {
    const mapper = this.createHalfHalfMapper(11.567, 234.1, 88, 0);
    this.runTest(
      mapper,
      [1, 7.77, 11.567, 100, 234.1, 250],
      [105.8, 92.5, 88.0, 39.2, 0.0, -3.8],
      HALF_AND_HALF_TOLERANCE,
    );
  }

  /** @export */
  testLinearMapperNegative() {
    const mapper = new BoxCoxSignedMapper(-100, 100, 100, 300, 1);
    this.runTest(
      mapper,
      [-100, -50, 0, 33, 100, 200],
      [100, 150, 200, 233, 300, 400],
      LOG_TOLERANCE,
    );
  }

  /** @export */
  testLinearMapperReversedPositiveAndZero() {
    const mapper = new BoxCoxSignedMapper(0, 100, 200, 100, 1);
    this.runTest(
      mapper,
      [0, 33, 50, 75, 100],
      [200, 167, 150, 125, 100],
      LOG_TOLERANCE,
    );
  }

  /** @export */
  testLogarithmicMapperSuperSimple() {
    const mapper = this.createLogMapper(100, 200, 100, 200);
    this.runTest(mapper, [100, 150, 200], [100, 158.5, 200], LOG_TOLERANCE);
  }

  /** @export */
  testLogarithmicMapperSimple() {
    const mapper = this.createLogMapper(1, 100, 1, 100);
    this.runTest(
      mapper,
      [1, 33, 50, 100, 200],
      [1, 76.17, 85.1, 100, 114.9],
      LOG_TOLERANCE,
    );
  }

  /** @export */
  testLogarithmicMapperAround100() {
    const mapper = this.createLogMapper(95, 101, 100, 300);
    this.runTest(
      mapper,
      [0.1, 2, 33, 95, 100, 101, 1000],
      [-22290.778, -12507.777, -3353, 100, 267.5, 300, 7786.934],
      LOG_TOLERANCE,
    );
  }

  /** @export */
  testLogarithmicMapperTwisted() {
    const mapper = this.createLogMapper(1, 1000, 300, -100);
    this.runTest(
      mapper,
      [1, 33.167, 577.06, 1000, 1111],
      [300, 97.24, -68.163, -100, -106.095],
      LOG_TOLERANCE,
    );
  }

  /** @export */
  testLogarithmicMapperComplicated() {
    const mapper = this.createLogMapper(11.567, 234.1, 88, 0);
    this.runTest(
      mapper,
      [1, 7.77, 11.567, 100, 234.1, 250],
      [159.631, 99.642, 88, 24.887, 0, -1.923],
      LOG_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxLambda9SuperSimple() {
    const mapper = this.createLambda9Mapper(100, 200, 100, 200);
    this.runTest(
      mapper,
      [100, 150, 200],
      [100, 107.327, 200],
      LAMBDA_9_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxLambda9Simple() {
    const mapper = this.createLambda9Mapper(1, 100, 1, 100);
    this.runTest(
      mapper,
      [1, 33, 50, 100, 200],
      [1, 1.004595, 1.193359, 100, 50689],
      LAMBDA_9_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxLambda9Around100() {
    const mapper = this.createLambda9Mapper(95, 101, 100, 300);
    this.runTest(
      mapper,
      [33, 95, 100, 101, 1000],
      [-171.97, 100, 259.57, 300, 431559177667],
      LAMBDA_9_TOLERANCE,
    );
    // These will be NaN if reverse mapped. Is that a problem?
    assertRoughlyEquals(-171.99, mapper.getScreenValue(0.1), 0.1);
    assertRoughlyEquals(-171.99, mapper.getScreenValue(11), 0.1);
  }

  /** @export */
  testBoxCoxLambda9Twisted() {
    const mapper = this.createLambda9Mapper(0.001, 1000, 300, -100);
    this.runTest(
      mapper,
      [1, 332.74, 1000, 1234],
      [300, 299.98, -100, -2354],
      LAMBDA_9_TOLERANCE,
    );
  }

  /** @export */
  testBoxCoxLambda9Complicated() {
    const mapper = this.createLambda9Mapper(11.567, 234.1, 88, 0);
    this.runTest(
      mapper,
      [11.567, 99.55, 234.1, 250],
      [88, 87.96, 0, -70.98],
      LAMBDA_9_TOLERANCE,
    );
  }
}

testSuite(new BoxCoxSignedMapperTest());
