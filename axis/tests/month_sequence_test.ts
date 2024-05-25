/**
 * @fileoverview Tests for MonthSequence.
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
  assertNotNullNorUndefined,
  assertThrows,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {MonthSequence} from '../month_sequence';

class MonthSequenceTest {
  /** @export */
  testErrorIfStepsLessThanOne() {
    assertThrows('Error should have been trown', () => {
      assertNotNullNorUndefined(new MonthSequence(-1));
    });
  }

  /** @export */
  testErrorIfStepsNotInt() {
    assertThrows('Error should have been trown', () => {
      assertNotNullNorUndefined(new MonthSequence(1.5));
    });
  }

  /** @export */
  testErrorIfOffsetOutOfBounds() {
    assertThrows('Error should have been trown', () => {
      assertNotNullNorUndefined(new MonthSequence(1, 12));
    });
    assertThrows('Error should have been trown', () => {
      assertNotNullNorUndefined(new MonthSequence(1, -12));
    });
  }

  /** @export */
  testErrorIfOffsetNotInt() {
    assertThrows('Error should have been trown', () => {
      assertNotNullNorUndefined(new MonthSequence(1, 2.5));
    });
  }

  /** @export */
  testLargeMonthStep() {
    const sequence = new MonthSequence(20);
    assertEquals(Date.UTC(1970, 0), sequence.getValue());
    sequence.next();
    assertEquals(Date.UTC(1971, 8), sequence.getValue());
  }

  /** @export */
  testGetNextSize() {
    const sequence = new MonthSequence();
    assertEquals(Date.UTC(1970, 1) - Date.UTC(1970, 0), sequence.getNextSize());
    sequence.next();
    assertEquals(Date.UTC(1970, 2) - Date.UTC(1970, 1), sequence.getNextSize());
    sequence.next();
    assertEquals(Date.UTC(1970, 3) - Date.UTC(1970, 2), sequence.getNextSize());
  }

  /** @export */
  testMonthUnitNext() {
    const sequence = new MonthSequence();
    assertEquals(Date.UTC(1970, 0), sequence.getValue());
    assertEquals(Date.UTC(1970, 1), sequence.next());
    assertEquals(Date.UTC(1970, 2), sequence.next());
  }

  /** @export */
  testMonthUnitPrevious() {
    const sequence = new MonthSequence();
    assertEquals(Date.UTC(1969, 11), sequence.previous());
    sequence.previous();
    sequence.previous();
    assertEquals(Date.UTC(1969, 8), sequence.previous());
    sequence.previous();
    sequence.previous();
    sequence.previous();
    assertEquals(Date.UTC(1969, 4), sequence.previous());
  }

  /** @export */
  testMonthUnitFloor() {
    const sequence = new MonthSequence();
    sequence.floor(Date.UTC(1968, 11, 13));
    assertEquals(Date.UTC(1968, 11), sequence.getValue());
    sequence.floor(Date.UTC(2010, 2, 1, 23, 59, 59, 999));
    assertEquals(Date.UTC(2010, 2), sequence.getValue());
    sequence.floor(Date.UTC(2010, 2, 1, 0, 0, 0, 5));
    assertEquals(Date.UTC(2010, 2), sequence.getValue());
    sequence.floor(Date.UTC(2010, 2));
    assertEquals(Date.UTC(2010, 2), sequence.getValue());
  }

  /** @export */
  testMonthUnitCeil() {
    const sequence = new MonthSequence();
    sequence.ceil(Date.UTC(1968, 11, 24, 12, 12, 12, 12));
    assertEquals(Date.UTC(1969, 0), sequence.getValue());
    sequence.ceil(Date.UTC(2010, 2, 1, 23, 59, 59, 999));
    assertEquals(Date.UTC(2010, 3), sequence.getValue());
    sequence.ceil(Date.UTC(2010, 2, 1, 0, 0, 0, 1));
    assertEquals(Date.UTC(2010, 3), sequence.getValue());
    sequence.ceil(Date.UTC(2010, 2));
    assertEquals(Date.UTC(2010, 2), sequence.getValue());
  }

  /** @export */
  testMonthUnitRound() {
    const sequence = new MonthSequence();
    sequence.round(Date.UTC(1989, 1, 14, 23, 59, 59, 999));
    assertEquals(Date.UTC(1989, 1), sequence.getValue());
    sequence.round(Date.UTC(1989, 1, 15));
    assertEquals(
      'Right inbetween should round up.',
      Date.UTC(1989, 2),
      sequence.getValue(),
    );
    sequence.round(Date.UTC(1989, 1, 15, 0, 0, 0, 1));
    assertEquals(Date.UTC(1989, 2), sequence.getValue());
    sequence.round(Date.UTC(1989, 1, 28, 23, 59, 59, 999));
    assertEquals(Date.UTC(1989, 2), sequence.getValue());
    sequence.round(Date.UTC(1989, 1, 1, 0, 0, 0, 1));
    assertEquals(Date.UTC(1989, 1), sequence.getValue());
    sequence.round(Date.UTC(1989, 1));
    assertEquals(Date.UTC(1989, 1), sequence.getValue());
  }

  /** @export */
  testQuarterUnitNext() {
    const sequence = new MonthSequence(3);
    assertEquals(Date.UTC(1970, 0), sequence.getValue());
    assertEquals(Date.UTC(1970, 3), sequence.next());
    assertEquals(Date.UTC(1970, 6), sequence.next());
  }

  /** @export */
  testQuarterUnitPrevious() {
    const sequence = new MonthSequence(3);
    assertEquals('A', Date.UTC(1969, 9), sequence.previous());
    sequence.previous();
    sequence.previous();
    assertEquals('B', Date.UTC(1969, 0), sequence.previous());
    sequence.previous();
    sequence.previous();
    sequence.previous();
    sequence.previous();
    assertEquals('C', Date.UTC(1967, 9), sequence.previous());
  }

  /** @export */
  testQuarterUnitFloor() {
    const sequence = new MonthSequence(3);
    sequence.floor(Date.UTC(1968, 11, 13));
    assertEquals('A', Date.UTC(1968, 9), sequence.getValue());

    sequence.floor(Date.UTC(2010, 2, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2010, 0), sequence.getValue());

    sequence.floor(Date.UTC(2010, 3, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(2010, 3), sequence.getValue());

    sequence.floor(Date.UTC(2010, 9));
    assertEquals('D', Date.UTC(2010, 9), sequence.getValue());
  }

  /** @export */
  testQuarterUnitCeil() {
    const sequence = new MonthSequence(3);
    sequence.ceil(Date.UTC(1968, 11, 13));
    assertEquals('A', Date.UTC(1969, 0), sequence.getValue());

    sequence.ceil(Date.UTC(2010, 2, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2010, 3), sequence.getValue());

    sequence.ceil(Date.UTC(2010, 3, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(2010, 6), sequence.getValue());

    sequence.ceil(Date.UTC(2010, 9));
    assertEquals('D', Date.UTC(2010, 9), sequence.getValue());
  }

  /** @export */
  testQuarterUnitRound() {
    const sequence = new MonthSequence(3);
    let betweenValue = (Date.UTC(1989, 3) - Date.UTC(1989, 0)) / 2;
    betweenValue += Date.UTC(1989, 0);

    sequence.round(betweenValue - 1);
    assertEquals(Date.UTC(1989, 0), sequence.getValue());

    sequence.round(betweenValue);
    assertEquals(
      'Right inbetween should round up.',
      Date.UTC(1989, 3),
      sequence.getValue(),
    );

    sequence.round(betweenValue + 1);
    assertEquals(Date.UTC(1989, 3), sequence.getValue());

    sequence.round(Date.UTC(1989, 2, 31, 23, 59, 59, 999));
    assertEquals(Date.UTC(1989, 3), sequence.getValue());

    sequence.round(Date.UTC(1989, 0, 1, 0, 0, 0, 1));
    assertEquals(Date.UTC(1989, 0), sequence.getValue());

    sequence.round(Date.UTC(1989, 9));
    assertEquals(Date.UTC(1989, 9), sequence.getValue());
  }

  /** @export */
  testOffsetQuarterUnitNext() {
    const sequence = new MonthSequence(3, 1);
    // Start at floored value which in this case is November 1969.
    assertEquals(Date.UTC(1969, 10), sequence.getValue());
    assertEquals(Date.UTC(1970, 1), sequence.next());
    assertEquals(Date.UTC(1970, 4), sequence.next());
    assertEquals(Date.UTC(1970, 7), sequence.next());
  }

  /** @export */
  testOffsetQuarterUnitPrevious() {
    const sequence = new MonthSequence(3, 1);
    // Start at floored value which in this case is November 1969.
    assertEquals('A', Date.UTC(1969, 10), sequence.getValue());
    sequence.previous();
    sequence.previous();
    assertEquals('B', Date.UTC(1969, 1), sequence.previous());
    sequence.previous();
    sequence.previous();
    sequence.previous();
    sequence.previous();
    assertEquals('C', Date.UTC(1967, 10), sequence.previous());
  }

  /** @export */
  testOffsetQuarterUnitFloor() {
    const sequence = new MonthSequence(3, 1);
    sequence.floor(Date.UTC(1969, 0, 13));
    assertEquals('A', Date.UTC(1968, 10), sequence.getValue());

    sequence.floor(Date.UTC(2010, 3, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2010, 1), sequence.getValue());

    sequence.floor(Date.UTC(2010, 4, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(2010, 4), sequence.getValue());

    sequence.floor(Date.UTC(2010, 10));
    assertEquals('D', Date.UTC(2010, 10), sequence.getValue());
  }

  /** @export */
  testOffsetQuarterUnitCeil() {
    const sequence = new MonthSequence(3, 1);
    sequence.ceil(Date.UTC(1969, 0, 13));
    assertEquals('A', Date.UTC(1969, 1), sequence.getValue());

    sequence.ceil(Date.UTC(2010, 3, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2010, 4), sequence.getValue());

    sequence.ceil(Date.UTC(2010, 4, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(2010, 7), sequence.getValue());

    sequence.ceil(Date.UTC(2010, 10));
    assertEquals('D', Date.UTC(2010, 10), sequence.getValue());
  }

  /** @export */
  testOffsetQuarterUnitRound() {
    const sequence = new MonthSequence(3, 1);
    let betweenValue = (Date.UTC(1989, 4) - Date.UTC(1989, 1)) / 2;
    betweenValue += Date.UTC(1989, 1);

    sequence.round(betweenValue - 1);
    assertEquals(Date.UTC(1989, 1), sequence.getValue());

    sequence.round(betweenValue);
    assertEquals(
      'Right inbetween should round up.',
      Date.UTC(1989, 4),
      sequence.getValue(),
    );

    sequence.round(betweenValue + 1);
    assertEquals(Date.UTC(1989, 4), sequence.getValue());

    sequence.round(Date.UTC(1989, 3, 31, 23, 59, 59, 999));
    assertEquals(Date.UTC(1989, 4), sequence.getValue());

    sequence.round(Date.UTC(1989, 1, 1, 0, 0, 0, 1));
    assertEquals(Date.UTC(1989, 1), sequence.getValue());

    sequence.round(Date.UTC(1989, 10));
    assertEquals(Date.UTC(1989, 10), sequence.getValue());
  }

  /** @export */
  testFiveYearsUnitNext() {
    const sequence = new MonthSequence(60);
    assertEquals(Date.UTC(1970, 0), sequence.getValue());
    assertEquals(Date.UTC(1975, 0), sequence.next());
    assertEquals(Date.UTC(1980, 0), sequence.next());
    assertEquals(Date.UTC(1985, 0), sequence.next());
    assertEquals(Date.UTC(1990, 0), sequence.next());
  }

  /** @export */
  testDecadeUnitNext() {
    const sequence = new MonthSequence(120);
    assertEquals(Date.UTC(1970, 0), sequence.getValue());
    assertEquals(Date.UTC(1980, 0), sequence.next());
    assertEquals(Date.UTC(1990, 0), sequence.next());
    assertEquals(Date.UTC(2000, 0), sequence.next());
    assertEquals(Date.UTC(2010, 0), sequence.next());
  }

  /** @export */
  testDecadeUnitPrevious() {
    const sequence = new MonthSequence(120);
    assertEquals(Date.UTC(1960, 0), sequence.previous());
    assertEquals(Date.UTC(1950, 0), sequence.previous());
    assertEquals(Date.UTC(1940, 0), sequence.previous());
    assertEquals(Date.UTC(1930, 0), sequence.previous());
    assertEquals(Date.UTC(1920, 0), sequence.previous());
    assertEquals(Date.UTC(1910, 0), sequence.previous());
    assertEquals(Date.UTC(1900, 0), sequence.previous());
    assertEquals(Date.UTC(1890, 0), sequence.previous());
  }

  /** @export */
  testDecadeUnitCeil() {
    const sequence = new MonthSequence(120);

    sequence.ceil(Date.UTC(1968, 11, 13));
    assertEquals('A', Date.UTC(1970, 0), sequence.getValue());

    sequence.ceil(Date.UTC(2010, 2, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2020, 0), sequence.getValue());

    sequence.ceil(Date.UTC(1066, 3, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(1070, 0), sequence.getValue());

    sequence.ceil(Date.UTC(3333, 9));
    assertEquals('D', Date.UTC(3340, 0), sequence.getValue());
  }

  /** @export */
  testDecadeUnitFloor() {
    const sequence = new MonthSequence(120);
    sequence.floor(Date.UTC(1968, 11, 13));
    assertEquals('A', Date.UTC(1960, 0), sequence.getValue());

    sequence.floor(Date.UTC(2010, 2, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2010, 0), sequence.getValue());

    sequence.floor(Date.UTC(1066, 3, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(1060, 0), sequence.getValue());

    sequence.floor(Date.UTC(3333, 9));
    assertEquals('D', Date.UTC(3330, 0), sequence.getValue());
  }

  /** @export */
  testDecadeUnitRound() {
    const sequence = new MonthSequence(120);
    sequence.round(Date.UTC(1968, 11, 13));
    assertEquals('A', Date.UTC(1970, 0), sequence.getValue());

    sequence.round(Date.UTC(2010, 2, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2010, 0), sequence.getValue());

    sequence.round(Date.UTC(1066, 3, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(1070, 0), sequence.getValue());

    sequence.round(Date.UTC(3333, 9));
    assertEquals('D', Date.UTC(3330, 0), sequence.getValue());
  }

  /** @export */
  testCenturyUnitRound() {
    const sequence = new MonthSequence(1200);
    sequence.round(Date.UTC(1968, 11, 13));
    assertEquals('A', Date.UTC(2000, 0), sequence.getValue());

    sequence.round(Date.UTC(2010, 2, 28, 23, 59, 59, 999));
    assertEquals('B', Date.UTC(2000, 0), sequence.getValue());

    sequence.round(Date.UTC(1066, 3, 1, 0, 0, 0, 5));
    assertEquals('C', Date.UTC(1100, 0), sequence.getValue());

    sequence.round(Date.UTC(3333, 9));
    assertEquals('D', Date.UTC(3300, 0), sequence.getValue());
  }
}

testSuite(new MonthSequenceTest());
