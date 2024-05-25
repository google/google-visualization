/**
 * @fileoverview Tests for axis decorations creator.
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

import {AxisDecorationsCreator} from '../axis_decorations_creator';

import {map} from '@npm//@closure/array/array';
import {
  assertArrayEquals,
  assertEquals,
  assertRoughlyEquals,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {
  NumberFormatterBuilder,
  TimeFormatterImpl,
} from '../../format/formatting';
import {AxisDecoration} from '../axis_decoration';
import {BoxCoxMapper} from '../box_cox_mapper';
import {LinMapper} from '../lin_mapper';
import {TimeUnit} from '../milliseconds';
import {Orientation} from '../text_measurer';
import {FixedFont} from '../text_measurer_fixed_font';
import {isoStrToMilliseconds} from '../utils';

class AxisDecorationsCreatorTest {
  setUp() {}

  /**
   * Run a test with the given range against the expected positions.
   * @param expected Expected values.
   * @param decorations Decorations to test.
   */
  utilTestDecorationPositions(
    expected: number[],
    decorations: AxisDecoration[],
  ) {
    const decorationPositions = map(decorations, (item) => item.getPosition());
    assertArrayEquals(expected, decorationPositions);
  }

  /**
   * Run a test with the given range against the expected values.
   * @param expected Expected values.
   * @param decorations Decorations to test.
   */
  utilTestDecorationValues(expected: number[], decorations: AxisDecoration[]) {
    const decorationPositions = map(decorations, (item) => item.getValue());
    assertArrayEquals(expected, decorationPositions);
  }

  /** @export */
  testSmallLogInterval() {
    const positions = [0, 1, 10, 100];
    const decorations = AxisDecorationsCreator.getNumberDecorations(
      0.5,
      10.31866,
      7,
      177,
      true,
      0,
      0.849,
      Orientation.VERTICAL,
      12,
      new FixedFont(7, 11),
      new NumberFormatterBuilder().build(),
    );
    this.utilTestDecorationValues(positions, decorations);
  }

  /** @export */
  testBasicNumberPositions() {
    const positions = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const decorations = AxisDecorationsCreator.getNumberDecorations(
      0,
      100,
      0,
      1000,
      false,
      1,
      1,
      Orientation.HORIZONTAL,
      80,
      new FixedFont(7, 11),
      new NumberFormatterBuilder().build(),
    );
    this.utilTestDecorationPositions(positions, decorations);
  }

  /** @export */
  testReversedBasicNumberPositions() {
    const positions = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0];
    const decorations = AxisDecorationsCreator.getNumberDecorations(
      0,
      100,
      0,
      1000,
      true,
      1,
      1,
      Orientation.HORIZONTAL,
      80,
      new FixedFont(7, 11),
      new NumberFormatterBuilder().build(),
    );
    this.utilTestDecorationPositions(positions, decorations);
  }

  /** @export */
  testBasicLogNumberPositions() {
    const positions = [0, 435, 565, 869, 1000];
    const decorations = AxisDecorationsCreator.getNumberDecorations(
      0,
      100,
      0,
      1000,
      false,
      0,
      1,
      Orientation.HORIZONTAL,
      80,
      new FixedFont(7, 11),
      new NumberFormatterBuilder().build(),
    );
    this.utilTestDecorationPositions(positions, decorations);
  }

  /** @export */
  testBasicTimePositions() {
    const positions = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const decorations = AxisDecorationsCreator.getTimeDecorations(
      isoStrToMilliseconds('2000'),
      isoStrToMilliseconds('2010'),
      0,
      1000,
      false,
      TimeUnit.YEAR,
      Orientation.HORIZONTAL,
      50,
      new FixedFont(7, 11),
      new TimeFormatterImpl(),
      false,
    );
    this.utilTestDecorationPositions(positions, decorations);
  }

  /** @export */
  testReversedTimePositions() {
    const positions = [1000, 900, 800, 700, 600, 500, 400, 300, 200, 100, 0];
    const decorations = AxisDecorationsCreator.getTimeDecorations(
      isoStrToMilliseconds('2000'),
      isoStrToMilliseconds('2010'),
      0,
      1000,
      true,
      TimeUnit.YEAR,
      Orientation.HORIZONTAL,
      50,
      new FixedFont(7, 11),
      new TimeFormatterImpl(),
      false,
    );
    this.utilTestDecorationPositions(positions, decorations);
  }

  /** @export */
  testNoTimeLabels() {
    const decorations = AxisDecorationsCreator.getTimeDecorations(
      isoStrToMilliseconds('2000-01'),
      isoStrToMilliseconds('2000-02'),
      0,
      10,
      false,
      TimeUnit.YEAR,
      Orientation.HORIZONTAL,
      50,
      new FixedFont(7, 11),
      new TimeFormatterImpl(),
      false,
    );
    assertArrayEquals([], decorations);
  }

  /** @export */
  testDataDensityRatioLinNoZero() {
    const mapper = new LinMapper(100, 110, 0, 100);
    assertEquals(1, AxisDecorationsCreator.calculateDataDensityRatio(mapper));
  }

  /** @export */
  testDataDensityRatioLin() {
    const mapper = new LinMapper(0, 10000, 0, 100);
    assertEquals(1, AxisDecorationsCreator.calculateDataDensityRatio(mapper));
  }

  /** @export */
  testDataDensityRatioAlmostLin() {
    const mapper = new BoxCoxMapper(0, 10000, 0, 100, 0.25, 1);
    assertRoughlyEquals(
      0.002,
      AxisDecorationsCreator.calculateDataDensityRatio(mapper),
      0.001,
    );
  }

  /** @export */
  testDataDensityRatioHalfLog() {
    const mapper = new BoxCoxMapper(0, 10000, 0, 100, 0.5, 1);
    assertRoughlyEquals(
      0.05,
      AxisDecorationsCreator.calculateDataDensityRatio(mapper),
      0.01,
    );
  }

  /** @export */
  testDataDensityRatioAlmostLog() {
    const mapper = new BoxCoxMapper(0, 10000, 0, 100, 0.75, 1);
    assertRoughlyEquals(
      0.35,
      AxisDecorationsCreator.calculateDataDensityRatio(mapper),
      0.01,
    );
  }

  /** @export */
  testDataDensityRatioLog() {
    const mapper = new BoxCoxMapper(0, 10000, 0, 100, 0, 1);
    assertRoughlyEquals(
      0,
      AxisDecorationsCreator.calculateDataDensityRatio(mapper),
      0.0001,
    );
  }

  /** @export */
  testDataDensityRatioNoDataSpan() {
    const mapper = new LinMapper(10, 10, 0, 100);
    assertEquals(1, AxisDecorationsCreator.calculateDataDensityRatio(mapper));
  }
}

testSuite(new AxisDecorationsCreatorTest());
