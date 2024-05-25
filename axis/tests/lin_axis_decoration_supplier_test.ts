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

import {
  assertArrayEquals,
  assertEquals,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {Options} from '../../common/options';
import {NumberFormatterBuilder} from '../../format/formatting';
import {AxisDecoration} from '../axis_decoration';
import {LinAxisDecorationSupplier} from '../lin_axis_decoration_supplier';
import {LinMapper} from '../lin_mapper';
import {Orientation} from '../text_measurer';
import {FixedFont} from '../text_measurer_fixed_font';

class LinAxisDecorationSupplierTest {
  /** @export */
  testWideDecorations() {
    const supplier = new LinAxisDecorationSupplier(
      new LinMapper(0, 50, 0, 100),
      new NumberFormatterBuilder(),
      new FixedFont(7, 11),
      () => true,
      Orientation.HORIZONTAL,
      new Options([{'gridlines': {'minSpacing': 10}}]),
    );
    const decorations = supplier.getDecorations();
    assertArrayEquals(
      ['0', '5', '10', '15', '20', '25', '30', '35', '40', '45', '50'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  /** @export */
  testMediumDecorations() {
    const supplier = new LinAxisDecorationSupplier(
      new LinMapper(0, 100, 0, 100),
      new NumberFormatterBuilder(),
      new FixedFont(7, 11),
      () => true,
      Orientation.HORIZONTAL,
      new Options([{'gridlines': {'minSpacing': 10}}]),
    );
    const decorations = supplier.getDecorations();
    assertArrayEquals(
      ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  /** @export */
  testNarrowDecorations() {
    const supplier = new LinAxisDecorationSupplier(
      new LinMapper(0, 100, 0, 50),
      new NumberFormatterBuilder(),
      new FixedFont(7, 11),
      () => true,
      Orientation.HORIZONTAL,
      new Options([{'gridlines': {'minSpacing': 10}}]),
    );
    const decorations = supplier.getDecorations();
    assertArrayEquals(
      ['0', '20', '40', '60', '80', '100'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  /** @export */
  testReallyNarrowDecorations() {
    const supplier = new LinAxisDecorationSupplier(
      new LinMapper(0, 100, 0, 25),
      new NumberFormatterBuilder(),
      new FixedFont(7, 11),
      () => true,
      Orientation.HORIZONTAL,
      new Options([{'gridlines': {'minSpacing': 10}}]),
    );
    const decorations = supplier.getDecorations();
    assertArrayEquals(
      ['0', '50', '100'],
      this.collectLabels(decorations.majorGridlines),
    );
  }

  /** @export */
  testCalcMinSpacingValue() {
    const supplier = new LinAxisDecorationSupplier(
      new LinMapper(0, 100, 0, 100),
      new NumberFormatterBuilder(),
      new FixedFont(7, 11),
      () => true,
      Orientation.HORIZONTAL,
      new Options([{'gridlines': {'minSpacing': 10}}]),
    );
    assertEquals(10, supplier.calcMinSpacingValue());
  }

  /**
   * Returns a list of labels collected from the given decorations.
   * @param decorations Decorations to collect labels from.
   * @return The collected labels.
   */
  collectLabels(decorations: AxisDecoration[]): string[] {
    const labels = [];
    for (let i = 0; i < decorations.length; i++) {
      labels.push(decorations[i].getLabel());
    }
    // AnyDuringAssistedMigration because: error TS2322: Type '(string |
    // null)[]' is not assignable to type 'string[]'.
    return labels as AnyDuringAssistedMigration;
  }
}

testSuite(new LinAxisDecorationSupplierTest());
