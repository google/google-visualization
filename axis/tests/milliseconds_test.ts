/**
 * @fileoverview Tests for Milliseconds.
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

const {MILLISECOND, MONTH, QUARTER, SECOND, WEEK, YEAR, closestUnit} =
  milliseconds;

class MillisecondsTest {
  /** @export */
  testClosestUnit() {
    assertEquals(MILLISECOND, closestUnit(1));

    assertEquals(SECOND, closestUnit(600));

    assertEquals(WEEK, closestUnit(WEEK * 2));

    assertEquals(MONTH, closestUnit(WEEK * 3));

    assertEquals(QUARTER, closestUnit(MONTH * 5));

    assertEquals(YEAR, closestUnit(MONTH * 9));

    assertEquals(YEAR, closestUnit(YEAR * 300));
  }
}

testSuite(new MillisecondsTest());
