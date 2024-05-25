/**
 * @fileoverview Tests for time axis decoration supplier.
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
import {TimeFormatterImpl} from '../../format/formatting';
import {AxisDecoration} from '../axis_decoration';
import {LinMapper} from '../lin_mapper';
import * as milliseconds from '../milliseconds';
import {Orientation} from '../text_measurer';
import {FixedFont} from '../text_measurer_fixed_font';
import * as utils from '../utils';

import {TimeAxisDecorationSupplier} from '../time_axis_decoration_supplier';

class TimeAxisDecorationSupplierTest {
  setUp() {}

  /** @export */
  testYear2000_2200() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2200'),
        0,
        500,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    assertArrayEquals(
      ['2000', '2050', '2100', '2150', '2200'],
      this.collectLabels(supplier.getDecorations()),
    );
  }

  /** @export */
  testYear2000_2100() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2100'),
        0,
        1000,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    const decorations = supplier.getDecorations();
    assertArrayEquals(
      [
        '2000',
        '2010',
        '2020',
        '2030',
        '2040',
        '2050',
        '2060',
        '2070',
        '2080',
        '2090',
        '2100',
      ],
      this.collectLabels(decorations),
    );
    assertEquals(102, this.collectTicks(decorations).length);
  }

  /** @export */
  testYear2000_2010() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2010'),
        0,
        1000,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    const decorations = supplier.getDecorations();
    assertArrayEquals(
      [
        '2000',
        '2001',
        '2002',
        '2003',
        '2004',
        '2005',
        '2006',
        '2007',
        '2008',
        '2009',
        '2010',
      ],
      this.collectLabels(decorations),
    );
  }

  /** @export */
  testYear1950_1970_fifth() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('1950'),
        utils.isoStrToMilliseconds('1970'),
        0,
        200,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      10,
      Orientation.HORIZONTAL,
      true,
    );

    const decorations = supplier.getDecorations();
    assertArrayEquals(
      ['1950', '1955', '1960', '1965', '1970'],
      this.collectLabels(decorations),
    );
  }

  /** @export */
  testYear2000_2010_smaller() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2010'),
        0,
        100,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    const decorations = supplier.getDecorations();
    assertArrayEquals(['2000', '2010'], this.collectLabels(decorations));
    assertEquals(12, this.collectTicks(decorations).length);
  }

  /** @export */
  testYear2000_2010_small_noRoomForTicks() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2010'),
        0,
        40,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    const decorations = supplier.getDecorations();
    assertArrayEquals(['2000-2010'], this.collectLabels(decorations));
    assertEquals(0, this.collectTicks(decorations).length);
  }

  /** @export */
  testMonth2000_2002_feb_wide() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2002-2'),
        0,
        1000,
      ),
      milliseconds.TimeUnit.MONTH,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    assertArrayEquals(
      [
        'Jan 2000',
        'Apr 2000',
        'Jul 2000',
        'Oct 2000',
        'Jan 2001',
        'Apr 2001',
        'Jul 2001',
        'Oct 2001',
        'Feb 2002',
      ],
      this.collectLabels(supplier.getDecorations()),
    );
  }

  /** @export */
  testMonth2000_2002_feb_narrow() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2002-2'),
        0,
        500,
      ),
      milliseconds.TimeUnit.MONTH,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    assertArrayEquals(
      ['2000', '2001', 'Feb 2002'],
      this.collectLabels(supplier.getDecorations()),
    );
  }

  /** @export */
  testQuarters() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2001-04'),
        0,
        1000,
      ),
      milliseconds.TimeUnit.QUARTER,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      10,
      Orientation.HORIZONTAL,
      true,
    );

    assertArrayEquals(
      ['Q1 2000', 'Q2 2000', 'Q3 2000', 'Q4 2000', 'Q1 2001', 'Q2 2001'],
      this.collectLabels(supplier.getDecorations()),
    );
  }

  /** @export */
  testMinMaxAreEqual() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2000'),
        0,
        500,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );
    const decorations = supplier.getDecorations();
    assertEquals(250, decorations[0].getPosition());
    assertArrayEquals(['2000'], this.collectLabels(decorations));
  }

  /** @export */
  testMergedLabelWhenNoRoom() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('1999'),
        utils.isoStrToMilliseconds('2000'),
        0,
        40,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      48,
      Orientation.HORIZONTAL,
      true,
    );
    const decorations = supplier.getDecorations();
    assertArrayEquals(['1999-2000'], this.collectLabels(decorations));
  }

  /** @export */
  testNoRoomForAnyLabels() {
    const supplier = new TimeAxisDecorationSupplier(
      new LinMapper(
        utils.isoStrToMilliseconds('1999'),
        utils.isoStrToMilliseconds('2000'),
        0,
        30,
      ),
      milliseconds.TimeUnit.YEAR,
      new FixedFont(8, 9),
      new TimeFormatterImpl(),
      40,
      Orientation.HORIZONTAL,
      true,
    );
    const decorations = supplier.getDecorations();
    assertArrayEquals([], this.collectLabels(decorations));
  }

  /**
   * Returns a list of labels collected from the given decorations.
   * @param decorations Decorations to collect labels from.
   * @return The collected labels.
   */
  collectLabels(decorations: AxisDecoration[]): string[] {
    const res = [];
    for (let i = 0; i < decorations.length; i++) {
      const decoration = decorations[i];
      if (decoration.getLabel() != null) {
        res.push(decoration.getLabel()!);
      }
    }
    return res;
  }

  /**
   * Returns a list of ticks collected from the given decorations.
   * @param decorations Decorations to collect ticks from.
   * @return The collected ticks.
   */
  collectTicks(decorations: AxisDecoration[]): string[] {
    const res = [];
    for (let i = 0; i < decorations.length; i++) {
      const decoration = decorations[i];
      if (decoration.hasTick()) {
        res.push(decoration);
      }
    }
    return res as unknown as string[];
  }
}

testSuite(new TimeAxisDecorationSupplierTest());
