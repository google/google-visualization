/**
 * @fileoverview Tests for utils.
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

import {Range} from '@npm//@closure/math/range';
import {
  assertEquals,
  assertNotThrows,
  assertThrows,
  assertTrue,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import * as milliseconds from '../milliseconds';
import * as utils from '../utils';

const {
  getLeadingDigit,
  isoStrToMilliseconds,
  millisecondsToIsoStr,
  roundToNumDecimals,
  timeLengthStr,
  timeToCustomIsoStr,
  zeroPad,
} = utils;

class UtilsTest {
  /**
   * Run a test with the given range against the expected values.
   * @param expected Expected values.
   * @param inputRange Values to test.
   * @param maxChange Maximum allowed change.
   */
  rangeTest(expected: number[], inputRange: number[], maxChange: number) {
    const result = utils.expandRange(
      new Range(inputRange[0], inputRange[1]),
      maxChange,
    );
    assertEquals(expected[0], result.start);
    assertEquals(expected[1], result.end);
  }

  /** @export */
  testCreateWeekTimeSequence() {
    const sequence = utils.createTimeSequence(milliseconds.WEEK);
    assertEquals('1970-01-05', millisecondsToIsoStr(sequence.getValue()));
  }

  /** @export */
  testCreateWeekTimeSequenceSundayStart() {
    const sequence = utils.createTimeSequence(milliseconds.WEEK, 0);
    assertEquals('1970-01-04', millisecondsToIsoStr(sequence.getValue()));
  }

  /** @export */
  testCreateHourTimeSequence() {
    const sequence = utils.createTimeSequence(milliseconds.HOUR);
    sequence.next();
    assertEquals(
      '1970-01-01T01:00:00.000',
      millisecondsToIsoStr(sequence.getValue()),
    );
  }

  /** @export */
  testCreateTwoMonthTimeSequence() {
    const sequence = utils.createTimeSequence(milliseconds.MONTH * 2);
    sequence.next();
    assertEquals('1970-04', millisecondsToIsoStr(sequence.getValue()));
  }

  /** @export */
  testCreateQuarterTimeSequence() {
    const sequence = utils.createTimeSequence(milliseconds.QUARTER);
    sequence.next();
    assertEquals('1970-04', millisecondsToIsoStr(sequence.getValue()));
  }

  /** @export */
  testMillisecondsToIsoStr() {
    assertEquals('notime', millisecondsToIsoStr(NaN));
    assertEquals('notime', millisecondsToIsoStr(Infinity));
    assertEquals('notime', millisecondsToIsoStr(-Infinity));
    assertEquals('1970', millisecondsToIsoStr(0));
    const date = new Date();
    date.setUTCFullYear(1980, 3, 22);
    date.setUTCHours(0, 0, 0, 0);
    assertEquals('1980-04-22', millisecondsToIsoStr(date.getTime()));
    assertEquals('1977-07-08T14:43:00.000', millisecondsToIsoStr(237220980000));
  }

  /** @export */
  testMillisecondsToIsoStrOnlyYearAndMonth() {
    const date = new Date();
    date.setUTCFullYear(1980, 3, 1);
    date.setUTCHours(0, 0, 0, 0);
    assertEquals('1980-04', millisecondsToIsoStr(date.getTime()));
  }

  /** @export */
  testZeroPad() {
    assertEquals('1', zeroPad('1', 1));
    assertEquals('01', zeroPad('1', 2));
    assertEquals('001', zeroPad('1', 3));
    assertEquals('00123', zeroPad('123', 5));
  }

  /** @export */
  testIsoStrToMilliseconds() {
    assertEquals(0, isoStrToMilliseconds('1970'));
    assertEquals(0, isoStrToMilliseconds('1970-01'));
    assertEquals(0, isoStrToMilliseconds('1970-01-01'));
    assertEquals(0, isoStrToMilliseconds('1970-01-01T00:00:00.000'));
    assertEquals(237220980000, isoStrToMilliseconds('1977-07-08T14:43:00.000'));
    assertTrue(isNaN(isoStrToMilliseconds('notime')));
    assertTrue(isNaN(isoStrToMilliseconds(null)));
    assertTrue(isNaN(isoStrToMilliseconds('')));
  }

  /** @export */
  testTimeToCustomIsoStrThrowsExceptionOnNonFiniteTime() {
    assertThrows(() => {
      timeToCustomIsoStr(NaN, milliseconds.TimeUnit.YEAR);
    });
  }

  /** @export */
  testTimeToCustomIsoStr() {
    assertEquals(
      '2005',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005'),
        milliseconds.TimeUnit.YEAR,
      ),
    );

    assertEquals(
      '2005',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005-06-07'),
        milliseconds.TimeUnit.YEAR,
      ),
    );

    assertEquals(
      '2005-01',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005-01-07'),
        milliseconds.TimeUnit.MONTH,
      ),
    );

    assertEquals(
      '2005-01-01',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005-01-01'),
        milliseconds.TimeUnit.DAY,
      ),
    );

    assertEquals(
      '2005-01-01',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005'),
        milliseconds.TimeUnit.DAY,
      ),
    );

    assertEquals(
      '2005-08-02',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005-08-02'),
        milliseconds.TimeUnit.DAY,
      ),
    );

    assertEquals(
      '2005-08-02T00:00:00.000',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005-08-02'),
        milliseconds.TimeUnit.HOUR,
      ),
    );

    assertEquals(
      '2005-08-02T02:03:04.123',
      timeToCustomIsoStr(
        isoStrToMilliseconds('2005-08-02T02:03:04.123'),
        milliseconds.TimeUnit.HOUR,
      ),
    );
  }

  /** @export */
  testTimeLengthStr() {
    const value =
      2 * milliseconds.SECOND +
      2 * milliseconds.MINUTE +
      2 * milliseconds.HOUR +
      2 * milliseconds.DAY +
      2 * milliseconds.YEAR;
    assertEquals('2 years, 2 days, 2 h, 2 m, 2 s', utils.timeLengthStr(value));
  }

  /** @export */
  testTimeIsNan() {
    assertEquals('Time is NaN.', timeLengthStr(NaN));
  }

  /** @export */
  testExpandRangeThrowsErrorOnNonFiniteRanges() {
    assertThrows(() => {
      this.rangeTest([0, 0], [NaN, NaN], 0.1);
    });
    assertThrows(() => {
      this.rangeTest([0, 0], [-Infinity, Infinity], 0.1);
    });
  }

  /** @export */
  testExpandRangeNoDiffNoChange() {
    this.rangeTest([101, 299], [101, 299], 0);
  }

  /** @export */
  testExpandRangeOnReversedRange() {
    assertNotThrows(() => {
      this.rangeTest([30, 200], [200, 30], 0.1);
    });
  }

  /** @export */
  testExpandRangeNoRange() {
    this.rangeTest([-5, -5], [-5, -5], 0.1);
    this.rangeTest([0, 0], [0, 0], 0.1);
    this.rangeTest([5, 5], [5, 5], 0.1);
  }

  /** @export */
  testExpandRange() {
    this.rangeTest([25, 50], [26, 48], 0.1);
    this.rangeTest([25, 85], [26, 84], 0.1);
    this.rangeTest([40, 60], [41, 59], 0.1);

    this.rangeTest([0, 60], [0, 55], 0.1);
    this.rangeTest([-60, 0], [-55, 0], 0.1);

    this.rangeTest([100000, 200000], [100000, 200000], 0.1);
    this.rangeTest([100000, 200500], [100200, 200200], 0.1);

    this.rangeTest([40000000, 70000000], [42000000, 68000000], 0.1);
    this.rangeTest([40, 70], [42, 68], 0.1);
    this.rangeTest([0.0000004, 0.0000007], [0.00000042, 0.00000068], 0.1);

    this.rangeTest([0.0001, 0.00035], [0.0001, 0.00034], 0.1);
    this.rangeTest([0.00015, 0.00035], [0.00015, 0.00034], 0.1);

    this.rangeTest([7000, 22000], [7713, 21194], 0.1);

    this.rangeTest([9000, 20000], [9999, 20000], 0.1);
    this.rangeTest([9500, 15000], [9999, 15000], 0.1);
    this.rangeTest([9900, 11000], [9999, 11000], 0.1);
    this.rangeTest([9950, 10500], [9999, 10500], 0.1);
    this.rangeTest([9995, 10050], [9999, 10050], 0.1);
    this.rangeTest([9990, 10200], [9999, 10200], 0.1);

    this.rangeTest([0.5, 0.6], [0.5, 0.6], 0.1);

    this.rangeTest([10, 18], [10, 18], 0.1);
    this.rangeTest([10, 19], [10, 19], 0.1);
    this.rangeTest([10, 20], [10, 19.5], 0.1);

    this.rangeTest([10, 23], [10, 23], 0.1);
    this.rangeTest([10, 21], [10, 21], 0.1);

    this.rangeTest([8, 21], [8.5, 21], 0.1);

    // Should probably return 0 instead.
    this.rangeTest([5, 1000], [8.9, 999], 0.1);
  }

  /** @export */
  testExpandRangeMaxDiff() {
    this.rangeTest([30, 50], [31, 50], 0.1);
    this.rangeTest([33, 50], [33, 50], 0.1);
    this.rangeTest([30, 50], [33, 50], 0.2);
    this.rangeTest([32, 50], [32.4, 50], 0.1);

    this.rangeTest([50, 77], [50, 77], 0.1);
    this.rangeTest([50, 80], [50, 77], 0.2);
    this.rangeTest([50, 82], [50, 81.5], 0.1);
  }

  /** @export */
  testExpandRangeNegative() {
    this.rangeTest([-10, 20], [-10, 20], 0.1);
    this.rangeTest([-20, -10], [-20, -10], 0.1);
  }

  /** @export */
  testRoundToNumDecimals() {
    assertEquals(5.556, roundToNumDecimals(5.5555, 3));
    assertEquals(2.2, roundToNumDecimals(2.222, 1));
    assertEquals(2, roundToNumDecimals(2.222, 0));
    assertEquals(0.00052, roundToNumDecimals(0.0005222, -5));
    assertEquals(0, roundToNumDecimals(0, 10));
    assertEquals(-1.89, roundToNumDecimals(-1.888, 2));
  }

  /** @export */
  testRoundToEvenValue() {
    assertEquals(
      6,
      utils.roundToPrevEvenValue(5.999999999999999, 0.2000000000000001),
    );
    assertEquals(
      6,
      utils.roundToNextEvenValue(5.7999999999999994, 0.2000000000000001),
    );
  }

  /** @export */
  testGetLeadingDigit() {
    assertEquals(5, getLeadingDigit(5));
    assertEquals(5, getLeadingDigit(52));
    assertEquals(5, getLeadingDigit(520));
    assertEquals(5, getLeadingDigit(542423442343));
    assertEquals(4, getLeadingDigit(0.0004));
    assertEquals(4, getLeadingDigit(0.000432));
  }
}

testSuite(new UtilsTest());
