/**
 * @fileoverview Tests for time axis strategy.
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
  assertFalse,
  assertNull,
  assertTrue,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {TimeFormatterImpl} from '../../format/formatting';
import {AxisDecoration} from '../axis_decoration';
import {LinMapper} from '../lin_mapper';
import * as milliseconds from '../milliseconds';
import {Orientation} from '../text_measurer';
import {FixedFont} from '../text_measurer_fixed_font';
import {TimeAxisStrategy} from '../time_axis_strategy';
import * as utils from '../utils';

class TimeAxisStrategyTest {
  /** @export */
  testTicksCollide() {
    // Create dummy. Properties not used.
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.YEAR,
      milliseconds.TimeUnit.YEAR,
      10,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2005'),
        0,
        170,
      ),
      40,
      Orientation.HORIZONTAL,
      true,
    );
    const t1 = AxisDecoration.makeTick(1, 1);
    const t2 = AxisDecoration.makeTick(2, 2);
    const t3 = AxisDecoration.makeTick(10, 10);
    const t4 = AxisDecoration.makeTick(20, 20);
    const t5 = AxisDecoration.makeTick(22, 22);
    assertFalse(strat.ticksCollide([]));
    assertFalse(strat.ticksCollide([t1]));
    assertFalse(strat.ticksCollide([t1, t3]));
    assertTrue(strat.ticksCollide([t1, t2]));
    assertFalse(strat.ticksCollide([t2, t3, t4]));
    assertTrue(strat.ticksCollide([t3, t4, t5]));
  }

  /** @export */
  testHideLastLabelIfOverLapsWithMax() {
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.MONTH,
      milliseconds.TimeUnit.YEAR,
      1,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2005-05'),
        0,
        250,
      ), // Not enough room for 2004.
      10,
      Orientation.HORIZONTAL,
      true,
    );
    this.assertHasLabels(
      ['2000', '2001', '2002', '2003', 'May 2005'],
      strat.attempt(),
    );
  }

  /** @export */
  testDontHideLastLabelSinceThereIsRoom() {
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.MONTH,
      milliseconds.TimeUnit.YEAR,
      1,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2005-05'),
        0,
        300,
      ), // Room for all.
      10,
      Orientation.HORIZONTAL,
      true,
    );
    this.assertHasLabels(
      ['2000', '2001', '2002', '2003', '2004', 'May 2005'],
      strat.attempt(),
    );
  }

  /** @export */
  testDontIncludeLastTimePoint() {
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.MONTH,
      milliseconds.TimeUnit.YEAR,
      1,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2005-05'),
        0,
        300,
      ), // Room for all.
      10,
      Orientation.HORIZONTAL,
      false,
    );
    this.assertHasLabels(
      ['2000', '2001', '2002', '2003', '2004'],
      strat.attempt(),
    );
  }

  /** @export */
  testIncludeLastIfEvenIfNotFullIfThereIsRoom() {
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.MONTH,
      milliseconds.TimeUnit.YEAR,
      1,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2008-01'),
        utils.isoStrToMilliseconds('2011-11'),
        0,
        600,
      ),
      10,
      Orientation.HORIZONTAL,
      false,
    );
    this.assertHasLabels(['2008', '2009', '2010', '2011'], strat.attempt());
  }

  /** @export */
  testIncludeLastIfEvenIfNotFullIfThereIsRoom_december() {
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.MONTH,
      milliseconds.TimeUnit.YEAR,
      1,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2008-01'),
        utils.isoStrToMilliseconds('2011-12'),
        0,
        600,
      ),
      10,
      Orientation.HORIZONTAL,
      false,
    );
    this.assertHasLabels(['2008', '2009', '2010', '2011'], strat.attempt());
  }

  /** @export */
  testIncludeLastIfEvenIfNotFullIfThereIsRoom_thereIsNot() {
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.MONTH,
      milliseconds.TimeUnit.YEAR,
      1,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2008-01'),
        utils.isoStrToMilliseconds('2011-07'),
        0,
        600,
      ),
      10,
      Orientation.HORIZONTAL,
      false,
    );
    this.assertHasLabels(['2008', '2009', '2010'], strat.attempt());
  }

  /**
   * Asserts that the given decorations have the expected labels.
   * @param expected Expected labels.
   * @param decorations Decorations from which to extract labels.
   */
  assertHasLabels(expected: string[], decorations: AxisDecoration[] | null) {
    const actual = [];
    if (decorations) {
      for (let i = 0; i < decorations.length; i++) {
        const decoration = decorations[i];
        if (decoration.getLabel() != null) {
          actual.push(decoration.getLabel());
        }
      }
    }
    assertArrayEquals(expected, actual);
  }

  /** @export */
  testTwoLabelsCollide() {
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.YEAR,
      milliseconds.TimeUnit.YEAR,
      10,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2005'),
        0,
        80,
      ),
      40,
      Orientation.HORIZONTAL,
      true,
    );

    assertTrue(
      strat.twoLabelsCollide(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2001'),
      ),
    );

    assertFalse(
      strat.twoLabelsCollide(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2005'),
      ),
    );
  }

  /** @export */
  testFindLastLabeledDecoration() {
    // Create dummy. Properties not used.
    const strat = new TimeAxisStrategy(
      milliseconds.TimeUnit.YEAR,
      milliseconds.TimeUnit.YEAR,
      10,
      new FixedFont(5, 8),
      new TimeFormatterImpl(),
      new LinMapper(
        utils.isoStrToMilliseconds('2000'),
        utils.isoStrToMilliseconds('2005'),
        0,
        170,
      ),
      40,
      Orientation.HORIZONTAL,
      true,
    );
    const t1 = AxisDecoration.makeLabel(1, 1, '1');
    const t2 = AxisDecoration.makeLabel(2, 2, '2');
    const t3 = AxisDecoration.makeLabel(10, 10, '10');
    const t4 = AxisDecoration.makeTick(20, 20);
    const t5 = AxisDecoration.makeTick(22, 22);
    assertNull(strat.findLastLabeledDecoration([t4, t5]));
    assertEquals(t3, strat.findLastLabeledDecoration([t1, t2, t3, t4]));
  }
}

testSuite(new TimeAxisStrategyTest());
