/**
 * @fileoverview Tests PacedPowersOf10Mirror with negative values.
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
  assertTrue,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {PacedPowersOf10Mirror} from '../paced_powers_of_10_mirror';

testSuite({
  testPrevious_ns5() {
    const sequence = new PacedPowersOf10Mirror(2, 0.1);
    assertEquals(-1, sequence.round(-1));
    assertEquals(-5, sequence.previous());
    assertEquals(-10, sequence.previous());
    assertEquals(-50, sequence.previous());
    assertEquals(-100, sequence.previous());
    assertEquals(-500, sequence.previous());
    assertEquals(-1000, sequence.previous());
    assertEquals(-5000, sequence.previous());
    assertEquals(-5000, sequence.getValue());
  },

  testSpecialPrevious_ns5() {
    // 3 is a bit messy.
    let sequence = new PacedPowersOf10Mirror(3, 0.1);
    assertEquals(-1, sequence.round(-1));
    assertTrue(sequence.previous() + 10 / 3 < Math.pow(10, -6));
    assertTrue(sequence.previous() + 20 / 3 < Math.pow(10, -6));
    assertEquals(-10, sequence.previous());
    assertTrue(sequence.previous() + 100 / 3 < Math.pow(10, -6));
    assertTrue(sequence.previous() + 200 / 3 < Math.pow(10, -6));
    assertEquals(-100, sequence.previous());
    assertTrue(sequence.previous() + 1000 / 3 < Math.pow(10, -6));
    assertTrue(sequence.previous() + 2000 / 3 < Math.pow(10, -6));
    assertEquals(-1000, sequence.previous());
    assertTrue(sequence.previous() + 10000 / 3 < Math.pow(10, -6));
    assertTrue(sequence.previous() + 20000 / 3 < Math.pow(10, -6));
    assertEquals(-10000, sequence.previous());
    // 4 is useful.
    sequence = new PacedPowersOf10Mirror(4, 0.1);
    assertEquals(-1, sequence.round(-1));
    assertEquals(-2.5, sequence.previous());
    assertEquals(-5, sequence.previous());
    assertEquals(-7.5, sequence.previous());
    assertEquals(-10, sequence.previous());
    assertEquals(-25, sequence.previous());
    assertEquals(-50, sequence.previous());
    assertEquals(-75, sequence.previous());
    assertEquals(-100, sequence.previous());
    assertEquals(-250, sequence.previous());
    assertEquals(-500, sequence.previous());
  },

  testNext_ns5() {
    const sequence = new PacedPowersOf10Mirror(5, 0.001);
    assertEquals(-1, sequence.round(-1));
    assertEquals(-0.8, sequence.next());
    assertEquals(-0.6, sequence.next());
    assertEquals(-0.4, sequence.next());
    assertEquals(-0.2, sequence.next());
    assertEquals(-0.1, sequence.next());
    assertEquals(-0.08, sequence.next());
    assertEquals(-0.06, sequence.next());
    assertEquals(-0.04, sequence.next());
    assertEquals(-0.02, sequence.next());
    assertEquals(-0.01, sequence.next());
    assertEquals(-0.008, sequence.next());
    assertEquals(-0.008, sequence.getValue());
  },
  testPrevious20Divisor_ns5() {
    const sequence = new PacedPowersOf10Mirror(20, 0.001);
    assertEquals(-0.01, sequence.round(-0.01));
    assertEquals(-0.015, sequence.previous());
    assertEquals(-0.02, sequence.previous());
    assertEquals(-0.025, sequence.previous());
    assertEquals(-0.03, sequence.previous());
    assertEquals(-0.035, sequence.previous());
    assertEquals(-0.04, sequence.previous());
    assertEquals(-0.045, sequence.previous());
    assertEquals(-0.05, sequence.previous());
    assertEquals(-0.055, sequence.previous());
    assertEquals(-0.06, sequence.previous());
    assertEquals(-0.065, sequence.previous());
    assertEquals(-0.07, sequence.previous());
    assertEquals(-0.075, sequence.previous());
    assertEquals(-0.08, sequence.previous());
    assertEquals(-0.085, sequence.previous());
    assertEquals(-0.09, sequence.previous());
    assertEquals(-0.095, sequence.previous());
    assertEquals(-0.1, sequence.previous());
    assertEquals(-0.15, sequence.previous());
    assertEquals(-0.2, sequence.previous());
    assertEquals(-0.25, sequence.previous());
    assertEquals(-0.3, sequence.previous());
    assertEquals(-0.35, sequence.previous());
    assertEquals(-0.4, sequence.previous());
    assertEquals(-0.45, sequence.previous());
    assertEquals(-0.5, sequence.previous());
    assertEquals(-0.55, sequence.previous());
    assertEquals(-0.6, sequence.previous());
    assertEquals(-0.65, sequence.previous());
    assertEquals(-0.7, sequence.previous());
    assertEquals(-0.75, sequence.previous());
    assertEquals(-0.8, sequence.previous());
    assertEquals(-0.85, sequence.previous());
    assertEquals(-0.9, sequence.previous());
    assertEquals(-0.95, sequence.previous());
    assertEquals(-1, sequence.previous());
    assertEquals(-1.5, sequence.previous());
    assertEquals(-1.5, sequence.getValue());
  },

  testNext20Divisor_ns5() {
    const sequence = new PacedPowersOf10Mirror(20, 0.001);
    assertEquals(-1, sequence.round(-1));
    assertEquals(-0.95, sequence.next());
    assertEquals(-0.9, sequence.next());
    assertEquals(-0.85, sequence.next());
    assertEquals(-0.8, sequence.next());
    assertEquals(-0.75, sequence.next());
    assertEquals(-0.7, sequence.next());
    assertEquals(-0.65, sequence.next());
    assertEquals(-0.6, sequence.next());
    assertEquals(-0.55, sequence.next());
    assertEquals(-0.5, sequence.next());
    assertEquals(-0.45, sequence.next());
    assertEquals(-0.4, sequence.next());
    assertEquals(-0.35, sequence.next());
    assertEquals(-0.3, sequence.next());
    assertEquals(-0.25, sequence.next());
    assertEquals(-0.2, sequence.next());
    assertEquals(-0.15, sequence.next());
    assertEquals(-0.1, sequence.next());
    assertEquals(-0.095, sequence.next());
    assertEquals(-0.09, sequence.next());
    assertEquals(-0.085, sequence.next());
    assertEquals(-0.08, sequence.next());
    assertEquals(-0.075, sequence.next());
    assertEquals(-0.07, sequence.next());
    assertEquals(-0.065, sequence.next());
    assertEquals(-0.06, sequence.next());
    assertEquals(-0.055, sequence.next());
    assertEquals(-0.05, sequence.next());
    assertEquals(-0.045, sequence.next());
    assertEquals(-0.04, sequence.next());
    assertEquals(-0.035, sequence.next());
    assertEquals(-0.03, sequence.next());
    assertEquals(-0.025, sequence.next());
    assertEquals(-0.02, sequence.next());
    assertEquals(-0.015, sequence.next());
    assertEquals(-0.01, sequence.next());
    assertEquals(-0.0095, sequence.next());
    assertEquals(-0.0095, sequence.getValue());
  },

  testRidiculouslySmallValues_ns5() {
    const sequence = new PacedPowersOf10Mirror(2, 0.00000000000001);
    assertEquals(-0.000000000005, sequence.ceil(-0.000000000005969));
    assertEquals(-0.000000000001, sequence.next());
    assertEquals(-0.0000000000005, sequence.next());
    assertEquals(-0.0000000000001, sequence.next());
    assertEquals(-0.00000000000005, sequence.next());
    assertEquals(-0.00000000000005, sequence.getValue());
  },

  testRound_ns5() {
    const sequence = new PacedPowersOf10Mirror(2, 0.000005);
    assertEquals(-0.005, sequence.round(-0.007499999999));
    assertEquals(-0.001, sequence.next());
    assertEquals(-0.01, sequence.round(-0.0075000000001));
    assertEquals(-0.05, sequence.previous());
    assertEquals(-10000, sequence.round(-24999));
    assertEquals(-10000, sequence.round(-25001));
    assertEquals(-1000000, sequence.round(-2678999));
    assertEquals(-500000, sequence.next());

    assertEquals(-0.000005, sequence.round(-0.000005));
    assertEquals(-0.00001, sequence.previous());
  },

  testFloor_ns5() {
    const sequence = new PacedPowersOf10Mirror(5, 0.001);
    assertEquals(-0.004, sequence.floor(-0.004));
    assertEquals(-0.002, sequence.next());
    assertEquals(-0.002, sequence.floor(-0.001001));
    assertEquals(-0.004, sequence.previous());
    assertEquals(-60000, sequence.floor(-45678));
    assertEquals(-40000, sequence.next());
    assertEquals(-0.08, sequence.floor(-0.07));
    assertEquals(-0.1, sequence.previous());
  },

  testDivisor20Floor_ns5() {
    const sequence = new PacedPowersOf10Mirror(20, 0.0001);
    assertEquals(-0.004, sequence.floor(-0.004));
    assertEquals(-0.0035, sequence.next());
    assertEquals(-0.0015, sequence.floor(-0.001001));
    assertEquals(-0.002, sequence.previous());
    assertEquals(-50000, sequence.floor(-45678));
    assertEquals(-45000, sequence.next());
    assertEquals(-0.015, sequence.floor(-0.0125));
    assertEquals(-0.02, sequence.previous());
  },

  testDivisor20Ceil_ns5() {
    const sequence = new PacedPowersOf10Mirror(20, 0.0001);
    assertEquals(-0.004, sequence.ceil(-0.004));
    assertEquals(-0.0035, sequence.next());
    assertEquals(-0.001, sequence.ceil(-0.001001));
    assertEquals(-0.0015, sequence.previous());
    assertEquals(-45000, sequence.ceil(-45678));
    assertEquals(-40000, sequence.next());
    assertEquals(-0.01, sequence.ceil(-0.0125));
    assertEquals(-0.015, sequence.previous());
  },

  testCeil_ns5() {
    const sequence = new PacedPowersOf10Mirror(4, 0.0005);
    assertEquals(-0.0025, sequence.ceil(-0.0025));
    assertEquals(-0.001, sequence.next());

    assertEquals(-0.075, sequence.ceil(-0.099));
    assertEquals(-0.1, sequence.previous());
    assertEquals(-50000, sequence.ceil(-74919));
    assertEquals(-75000, sequence.previous());
    assertEquals(-0.005, sequence.ceil(-0.006001));
    assertEquals(-0.0025, sequence.next());
    assertEquals(-5, sequence.ceil(-5.5));
    assertEquals(-7.5, sequence.previous());
    assertEquals(-500, sequence.ceil(-549));
    assertEquals(-750, sequence.previous());

    assertEquals(-1, sequence.ceil(-2.444));
    assertEquals(-2.5, sequence.previous());
  },

  testValueZeroInputs_ns5() {
    const sequence = new PacedPowersOf10Mirror(2, 0);
    assertEquals(0, sequence.round(0));
    assertEquals(0, sequence.ceil(0));
    assertEquals(0, sequence.floor(0));
  },
});
