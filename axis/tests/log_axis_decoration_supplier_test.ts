/**
 * @fileoverview Tests for LinAxisDecorationSupplier.
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

import {map} from '@npm//@closure/array/array';
import {
  assertArrayEquals,
  assertEquals,
  assertObjectRoughlyEquals,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {Options} from '../../common/options';
import {NumberFormatterBuilder} from '../../format/formatting';
import {AxisDecoration} from '../axis_decoration';
import {BoxCoxMapper} from '../box_cox_mapper';
import {LogAxisDecorationSupplier} from '../log_axis_decoration_supplier';
import {Orientation} from '../text_measurer';
import {FixedFont} from '../text_measurer_fixed_font';

class LogAxisDecorationSupplierTest {
  testGetDecorations0To10000() {
    const supplier = this.makeSupplier(0, 10000, 0, 500, 0, 1, 40);
    assertEquals('maxStepping', 1, supplier.calcMaxSteppingValue());

    const decorations = this.makeDecorations(0, 10000, 0, 500, 0, 1, 40);
    assertArrayEquals(
      ['0', '10', '100', '1,000', '10,000'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  test0To10() {
    const decorations = this.makeDecorations(0, 10, 0, 500, 0, 1, 40);
    assertArrayEquals(
      ['0', '5', '10'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  testGetDecorations1To10() {
    const supplier = this.makeSupplier(1, 10, 0, 500, 0, 1, 40);
    assertEquals('maxStepping', 5, supplier.calcMaxSteppingValue());

    const decorations = this.makeDecorations(1, 10, 0, 500, 0, 1, 40);
    // Not sure about '0'.
    assertArrayEquals(
      ['0', '2', '4', '6', '8', '10'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  testGetDecorations5To10() {
    const supplier = this.makeSupplier(5, 10, 0, 500, 0, 1, 40);
    assertEquals('maxStepping', 10, supplier.calcMaxSteppingValue());

    const decorations = this.makeDecorations(5, 10, 0, 500, 0, 1, 40);
    assertArrayEquals(
      ['5', '6', '7', '8', '9', '10'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  testGetDecorationsMiddle() {
    const supplier = this.makeSupplier(600, 800, 0, 500, 0, 1, 40);
    assertEquals('maxStepping', 20, supplier.calcMaxSteppingValue());

    const decorations = this.makeDecorations(600, 800, 0, 500, 0, 1, 40);
    assertArrayEquals(
      ['600', '650', '700', '750', '800'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  testGetDecorationsSmallSpanLargeNumbers() {
    const decorations = this.makeDecorations(
      1000000000000000,
      1000000100009000,
      0,
      500,
      0,
      1,
      40,
    );
    assertArrayEquals(
      [
        '999,999,990,000,000',
        '1,000,000,000,000,000',
        '1,000,000,100,000,000',
        '1,000,000,200,000,000',
      ],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  testGetDecorationsSmallSpanTinyNumbers() {
    const decorations = this.makeDecorations(
      0.0000000001,
      0.000000000100100009,
      0,
      500,
      0,
      0.00000000001,
      40,
    );
    assertArrayEquals(
      ['0.0000000001', '0.0000000001001', '0.0000000001002'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  testZeroSizedInterval() {
    const decorations = this.makeDecorations(0, 0, 0, 500, 0, 1, 40);
    assertArrayEquals(['0'], this.collectLabels(decorations.majorGridlines));
  }

  testMinus1To10() {
    let decorations;
    decorations = this.makeDecorations(-1, 10, 0, 500, 0, 1, 40);
    assertArrayEquals(
      'epsilon 1',
      ['-5', '0', '5', '10'],
      this.collectLabels(decorations.majorGridlines),
    );

    decorations = this.makeDecorations(-1, 10, 0, 500, 0, 0.1, 40);
    assertArrayEquals(
      'epsilon 0.1',
      ['-1', '-0.5', '0', '0.5', '1', '5', '10'],
      this.collectLabels(decorations.majorGridlines),
    );

    decorations = this.makeDecorations(-1, 10, 0, 500, 0, 0.5, 40);
    assertArrayEquals(
      'epsilon 0.5',
      ['-1', '-0.5', '0', '0.5', '1', '5', '10'],
      this.collectLabels(decorations.majorGridlines),
    );

    decorations = this.makeDecorations(-1, 10, 0, 500, 0, 0.9, 40);
    assertArrayEquals(
      'epsilon 0.9',
      ['-1', '0', '1', '5', '10'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  testInfiniteLoop() {
    // This test is intended to cause an infinite loop when the epsilon value
    // ends up being the same as the initial 'secondValue' of the generated
    // dataValues.  But we can't test this exactly due to variations in font
    // size or other issues.
    const decorations = this.makeDecorations(
      0.45,
      1.866484338855,
      149,
      50.5,
      0,
      0.9,
      20,
    );
    assertArrayEquals(
      'infinite loop',
      ['0', '1', '5'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  test0to100() {
    const decorations = this.makeDecorations(
      0.0005,
      28.9,
      0,
      2000,
      0,
      0.0005,
      30,
    );
    assertObjectRoughlyEquals(
      [
        '0.0005',
        '0.001',
        '0.005',
        '0.01',
        '0.05',
        '0.1',
        '0.5',
        '1',
        '5',
        '10',
        '50',
      ],
      this.collectLabels(decorations.majorGridlines),
      0.00001,
    );
  }

  makeSupplier(
    dataMin: number,
    dataMax: number,
    screenStart: number,
    screenEnd: number,
    boxCoxLambda: number,
    epsilonValue: number,
    minSpacing: number,
  ) {
    const mapper = new BoxCoxMapper(
      dataMin,
      dataMax,
      screenStart,
      screenEnd,
      boxCoxLambda,
      epsilonValue,
    );
    const options = new Options([{'gridlines': {'minSpacing': minSpacing}}]);
    const supplier = new LogAxisDecorationSupplier(
      mapper,
      new NumberFormatterBuilder(),
      new FixedFont(7, 11),
      () => true,
      Orientation.HORIZONTAL,
      options,
      epsilonValue,
    );
    return supplier;
  }

  makeDecorations(
    dataMin: number,
    dataMax: number,
    screenStart: number,
    screenEnd: number,
    boxCoxLambda: number,
    epsilonValue: number,
    minSpacing: number,
  ) {
    const supplier = this.makeSupplier(
      dataMin,
      dataMax,
      screenStart,
      screenEnd,
      boxCoxLambda,
      epsilonValue,
      minSpacing,
    );
    return supplier.getDecorations(null, null);
  }

  /**
   * Returns a list of labels collected from the given decorations.
   * @param decorations Decorations to collect labels from.
   * @return The collected labels.
   */
  collectLabels(decorations: AxisDecoration[]): string[] {
    return map(
      decorations,
      (decoration: AxisDecoration) => decoration.getLabel() || '',
    );
  }
}

testSuite(new LogAxisDecorationSupplierTest());
