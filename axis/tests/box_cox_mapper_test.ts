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

import {
  assertEquals,
  assertRoughlyEquals,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {BoxCoxMapper} from '../box_cox_mapper';

const LIN = 1;
const LOG = 0;

class BoxCoxMapperTest {
  /**
   * Tests the mapper with the given parameters.
   * @param mapper Mapper to test.
   * @param dataValues Data values.
   * @param screenValues Screen values.
   * @param tolerance Assertion tolerance.
   */
  runTest(
    mapper: BoxCoxMapper,
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
  testReversed() {
    this.runTest(
      new BoxCoxMapper(0, 10, 100, 0, LIN, 0),
      [0, 5, 10],
      [100, 50, 0],
      0,
    );
  }

  /** @export */
  testMapZeroRangeToZeroLin() {
    const mapper = new BoxCoxMapper(-5, 5, 0, 100, LIN, 1);
    assertEquals(50, mapper.getScreenValue(0));
    assertEquals(50, mapper.getScreenValue(0.5));
    assertEquals(50, mapper.getScreenValue(-0.5));
  }

  /** @export */
  testMapZeroRangeToZeroLog() {
    const mapper = new BoxCoxMapper(-5, 5, 0, 100, LOG, 1);
    assertEquals(50, mapper.getScreenValue(0));
    assertEquals(50, mapper.getScreenValue(0.5));
    assertEquals(50, mapper.getScreenValue(-0.5));
  }

  /** @export */
  testMapZeroRangeToZeroLogUsingFallbackEpsilon() {
    const mapper = new BoxCoxMapper(-5, 5, 0, 100, LIN, NaN);
    assertEquals(50, mapper.getScreenValue(0));
    assertEquals(50, mapper.getScreenValue(0.005));
    assertEquals(50, mapper.getScreenValue(-0.005));
  }

  /** @export */
  testNoRange() {
    this.runTest(new BoxCoxMapper(10, 10, 0, 100, LIN, 10), [10], [50], 0.1);
  }

  /** @export */
  testPositiveRange() {
    this.runTest(
      new BoxCoxMapper(1, 11, 0, 100, LIN, 1),
      [1, 6, 11],
      [0, 50, 100],
      0.1,
    );
  }

  /** @export */
  testPositiveRangeWithZero() {
    this.runTest(
      new BoxCoxMapper(0, 10, 0, 100, LIN, 0),
      [0, 5, 10],
      [0, 50, 100],
      0.1,
    );
  }

  /** @export */
  testNegativeRange() {
    this.runTest(
      new BoxCoxMapper(-11, -1, 0, 100, LIN, 1),
      [-11, -6, -1],
      [0, 50, 100],
      0.1,
    );
  }

  /** @export */
  testNegativeRangeWithZero() {
    this.runTest(
      new BoxCoxMapper(-10, 0, 0, 100, LIN, 0),
      [-10, -5, 0],
      [0, 50, 100],
      0.1,
    );
  }

  /** @export */
  testIncludeZeroRangeNoNegatives() {
    this.runTest(
      new BoxCoxMapper(-0.1, 10, 0, 100, LIN, 1),
      [-0.1, 10],
      [0, 100],
      0.1,
    );
  }

  /** @export */
  testIncludeZeroRangeNoPositives() {
    this.runTest(
      new BoxCoxMapper(-10, 0.1, 0, 100, LIN, 1),
      [-10, 0.1],
      [0, 100],
      0.1,
    );
  }

  /** @export */
  testIncludeZeroRangeNoNegatives2() {
    this.runTest(
      new BoxCoxMapper(-10, 10, 0, 100, LIN, 1),
      [-10, 0, 10],
      [0, 50, 100],
      0.1,
    );
  }

  /** @export */
  testIncludeZeroRangeNoNegatives2Reversed() {
    this.runTest(
      new BoxCoxMapper(-10, 10, 100, 0, LIN, 1),
      [-10, 0, 10],
      [100, 50, 0],
      0.1,
    );
  }

  /** @export */
  testIncludeZeroRangeNoNegatives3() {
    this.runTest(
      new BoxCoxMapper(-10, 5, 0, 100, LIN, 0),
      [-10, -2.5, 5],
      [0, 50, 100],
      0.5,
    );
  }

  /** @export */
  testCalculateZeroThreshold() {
    const mapper = new BoxCoxMapper(0, 10, 50, 100, LIN, 1);
    assertEquals(0.5, mapper.calculateZeroThreshold());
  }

  /** @export */
  testCalculateDefaultZeroThreshold() {
    const mapper = new BoxCoxMapper(0, 10, 50, 100, LIN);
    assertEquals(0.01, mapper.calculateZeroThreshold());
  }

  /** @export */
  testGetters() {
    const mapper = new BoxCoxMapper(0, 10, 50, 100, LIN, 0);
    assertEquals(0, mapper.getDataMin());
    assertEquals(10, mapper.getDataMax());
    assertEquals(50, mapper.getScreenStart());
    assertEquals(100, mapper.getScreenEnd());
  }
}

testSuite(new BoxCoxMapperTest());
