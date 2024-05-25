/**
 * @fileoverview Tests for time unit sequence.
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

import {assertEquals} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import * as milliseconds from '../milliseconds';
import {TimeUnitSequence} from '../time_unit_sequence';

class TimeUnitSequenceTest {
  /** @export */
  testStandardNext() {
    const sequence = new TimeUnitSequence();
    assertEquals(milliseconds.SECOND, sequence.getValue());
    assertEquals(milliseconds.MINUTE, sequence.next());
    assertEquals(milliseconds.HOUR, sequence.next());
    assertEquals(milliseconds.DAY, sequence.next());
    assertEquals(milliseconds.WEEK, sequence.next());
    assertEquals(milliseconds.MONTH, sequence.next());
    assertEquals(milliseconds.QUARTER, sequence.next());
    assertEquals(milliseconds.YEAR, sequence.next());
    assertEquals(milliseconds.YEAR * 10, sequence.next());
    assertEquals(milliseconds.YEAR * 100, sequence.next());
    assertEquals(milliseconds.YEAR * 1000, sequence.next());
    assertEquals(milliseconds.YEAR * 10000, sequence.next());
  }

  /** @export */
  testGranularNext() {
    const sequence = new TimeUnitSequence(true);
    assertEquals(milliseconds.SECOND, sequence.getValue());
    assertEquals(milliseconds.SECOND * 5, sequence.next());
    assertEquals(milliseconds.SECOND * 10, sequence.next());
    assertEquals(milliseconds.SECOND * 15, sequence.next());
    assertEquals(milliseconds.SECOND * 30, sequence.next());
    assertEquals(milliseconds.MINUTE, sequence.next());
    assertEquals(milliseconds.MINUTE * 5, sequence.next());
    assertEquals(milliseconds.MINUTE * 10, sequence.next());
    assertEquals(milliseconds.MINUTE * 15, sequence.next());
    assertEquals(milliseconds.MINUTE * 30, sequence.next());
    assertEquals(milliseconds.HOUR, sequence.next());
    assertEquals(milliseconds.HOUR * 3, sequence.next());
    assertEquals(milliseconds.HOUR * 6, sequence.next());
    assertEquals(milliseconds.HOUR * 12, sequence.next());
    assertEquals(milliseconds.DAY, sequence.next());
    assertEquals(milliseconds.WEEK, sequence.next());
    assertEquals(milliseconds.MONTH, sequence.next());
    assertEquals(milliseconds.QUARTER, sequence.next());
    assertEquals(milliseconds.YEAR, sequence.next());
    assertEquals(milliseconds.YEAR * 2, sequence.next());
    assertEquals(milliseconds.YEAR * 5, sequence.next());
    assertEquals(milliseconds.YEAR * 10, sequence.next());
    assertEquals(milliseconds.YEAR * 20, sequence.next());
  }

  /** @export */
  testStandardPrevious() {
    const sequence = new TimeUnitSequence();
    sequence.round(milliseconds.YEAR);
    assertEquals(milliseconds.QUARTER, sequence.previous());
    assertEquals(milliseconds.MONTH, sequence.previous());
    assertEquals(milliseconds.WEEK, sequence.previous());
    assertEquals(milliseconds.DAY, sequence.previous());
    assertEquals(milliseconds.HOUR, sequence.previous());
    assertEquals(milliseconds.MINUTE, sequence.previous());
    assertEquals(milliseconds.SECOND, sequence.previous());
  }

  /** @export */
  testGranularPrevious() {
    const sequence = new TimeUnitSequence(true);
    sequence.round(milliseconds.DAY);
    assertEquals(milliseconds.HOUR * 12, sequence.previous());
    assertEquals(milliseconds.HOUR * 6, sequence.previous());
    assertEquals(milliseconds.HOUR * 3, sequence.previous());
    assertEquals(milliseconds.HOUR, sequence.previous());
    sequence.round(milliseconds.SECOND);
    assertEquals(500, sequence.previous());
    assertEquals(200, sequence.previous());
    assertEquals(100, sequence.previous());
    sequence.round(milliseconds.YEAR * 2);
    assertEquals(milliseconds.YEAR, sequence.previous());
  }

  /** @export */
  testStandardFloor() {
    const sequence = new TimeUnitSequence();
    assertEquals(100, sequence.floor(milliseconds.SECOND / 2));
    assertEquals(milliseconds.SECOND, sequence.floor(milliseconds.SECOND * 59));
    assertEquals(milliseconds.MINUTE, sequence.floor(milliseconds.SECOND * 60));
    assertEquals(milliseconds.DAY, sequence.floor(milliseconds.DAY * 2));
    assertEquals(milliseconds.WEEK, sequence.floor(milliseconds.DAY * 30));
    assertEquals(milliseconds.MONTH, sequence.floor(milliseconds.DAY * 31));
    assertEquals(milliseconds.QUARTER, sequence.floor(milliseconds.MONTH * 6));
    assertEquals(milliseconds.YEAR, sequence.floor(milliseconds.YEAR * 2));
    assertEquals(
      milliseconds.YEAR * 10,
      sequence.floor(milliseconds.YEAR * 16),
    );
  }

  /** @export */
  testGranularFloor() {
    const sequence = new TimeUnitSequence(true);
    assertEquals(
      milliseconds.MINUTE * 30,
      sequence.floor(milliseconds.MINUTE * 45),
    );
    assertEquals(milliseconds.HOUR * 3, sequence.floor(milliseconds.HOUR * 4));
    assertEquals(milliseconds.YEAR * 5, sequence.floor(milliseconds.YEAR * 8));
  }

  /** @export */
  testStandardCeil() {
    const sequence = new TimeUnitSequence();
    assertEquals(100, sequence.ceil(50));
    assertEquals(milliseconds.SECOND, sequence.ceil(500));
    assertEquals(milliseconds.MINUTE, sequence.ceil(milliseconds.SECOND * 60));
    assertEquals(milliseconds.DAY, sequence.ceil(milliseconds.DAY / 2));
    assertEquals(milliseconds.WEEK, sequence.ceil(milliseconds.DAY * 5));
    assertEquals(milliseconds.MONTH, sequence.ceil(milliseconds.DAY * 30));
    assertEquals(milliseconds.QUARTER, sequence.ceil(milliseconds.MONTH * 2));
    assertEquals(milliseconds.YEAR, sequence.ceil(milliseconds.YEAR / 2));
    assertEquals(milliseconds.YEAR * 10, sequence.ceil(milliseconds.YEAR * 8));
  }

  /** @export */
  testGranularCeil() {
    const sequence = new TimeUnitSequence(true);
    assertEquals(
      milliseconds.MINUTE * 30,
      sequence.ceil(milliseconds.MINUTE * 25),
    );
    assertEquals(milliseconds.HOUR * 3, sequence.ceil(milliseconds.HOUR * 2));
    assertEquals(milliseconds.YEAR * 5, sequence.ceil(milliseconds.YEAR * 4));
  }

  /** @export */
  testRound() {
    const sequence = new TimeUnitSequence();
    assertEquals(100, sequence.round(90));
    assertEquals(milliseconds.SECOND, sequence.round(milliseconds.SECOND * 30));
    assertEquals(milliseconds.MINUTE, sequence.round(milliseconds.SECOND * 31));
    assertEquals(milliseconds.QUARTER, sequence.round(milliseconds.MONTH * 7));
    assertEquals(milliseconds.YEAR, sequence.round(milliseconds.MONTH * 8));
  }

  /** @export */
  testGranularRound() {
    const sequence = new TimeUnitSequence(true);
    assertEquals(
      milliseconds.SECOND * 30,
      sequence.round(milliseconds.SECOND * 35),
    );
    assertEquals(
      milliseconds.SECOND * 30,
      sequence.round(milliseconds.SECOND * 25),
    );
    assertEquals(
      milliseconds.YEAR * 50,
      sequence.round(milliseconds.YEAR * 55),
    );
  }

  /** @export */
  testGetNextSize() {
    const sequence = new TimeUnitSequence();
    sequence.round(milliseconds.SECOND);
    assertEquals(
      milliseconds.MINUTE - milliseconds.SECOND,
      sequence.getNextSize(),
    );
    sequence.round(milliseconds.HOUR);
    assertEquals(milliseconds.DAY - milliseconds.HOUR, sequence.getNextSize());
  }
}

testSuite(new TimeUnitSequenceTest());
