/**
 * @fileoverview Tests PacedPowersOf10Mirror with positive values.
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
  testNext_ns3() {
    const sequence = new PacedPowersOf10Mirror(2, 0.1);
    assertEquals(1, sequence.round(1));
    assertEquals(5, sequence.next());
    assertEquals(10, sequence.next());
    assertEquals(50, sequence.next());
    assertEquals(100, sequence.next());
    assertEquals(500, sequence.next());
    assertEquals(1000, sequence.next());
    assertEquals(5000, sequence.next());
    assertEquals(5000, sequence.getValue());
  },

  testSpecialNext_ns3() {
    // 3 is a bit messy
    let sequence = new PacedPowersOf10Mirror(3, 0.1);
    assertEquals(1, sequence.round(1));
    assertTrue(sequence.next() - 10 / 3 < Math.pow(10, -6));
    assertTrue(sequence.next() - 20 / 3 < Math.pow(10, -6));
    assertEquals(10, sequence.next());
    assertTrue(sequence.next() - 100 / 3 < Math.pow(10, -6));
    assertTrue(sequence.next() - 200 / 3 < Math.pow(10, -6));
    assertEquals(100, sequence.next());
    assertTrue(sequence.next() - 1000 / 3 < Math.pow(10, -6));
    assertTrue(sequence.next() - 2000 / 3 < Math.pow(10, -6));
    assertEquals(1000, sequence.next());
    assertTrue(sequence.next() - 10000 / 3 < Math.pow(10, -6));
    assertTrue(sequence.next() - 20000 / 3 < Math.pow(10, -6));
    assertEquals(10000, sequence.next());
    // 4 is useful
    sequence = new PacedPowersOf10Mirror(4, 0.1);
    assertEquals(1, sequence.round(1));
    assertEquals(2.5, sequence.next());
    assertEquals(5, sequence.next());
    assertEquals(7.5, sequence.next());
    assertEquals(10, sequence.next());
    assertEquals(25, sequence.next());
    assertEquals(50, sequence.next());
    assertEquals(75, sequence.next());
    assertEquals(100, sequence.next());
    assertEquals(250, sequence.next());
    assertEquals(500, sequence.next());
  },

  testPrevious_ns3() {
    const sequence = new PacedPowersOf10Mirror(5, 0.001);
    assertEquals(1, sequence.round(1));
    assertEquals(0.8, sequence.previous());
    assertEquals(0.6, sequence.previous());
    assertEquals(0.4, sequence.previous());
    assertEquals(0.2, sequence.previous());
    assertEquals(0.1, sequence.previous());
    assertEquals(0.08, sequence.previous());
    assertEquals(0.06, sequence.previous());
    assertEquals(0.04, sequence.previous());
    assertEquals(0.02, sequence.previous());
    assertEquals(0.01, sequence.previous());
    assertEquals(0.008, sequence.previous());
    assertEquals(0.008, sequence.getValue());
  },

  testNext20Divisor_ns3() {
    const sequence = new PacedPowersOf10Mirror(20, 0.001);
    assertEquals(0.01, sequence.round(0.01));
    assertEquals(0.015, sequence.next());
    assertEquals(0.02, sequence.next());
    assertEquals(0.025, sequence.next());
    assertEquals(0.03, sequence.next());
    assertEquals(0.035, sequence.next());
    assertEquals(0.04, sequence.next());
    assertEquals(0.045, sequence.next());
    assertEquals(0.05, sequence.next());
    assertEquals(0.055, sequence.next());
    assertEquals(0.06, sequence.next());
    assertEquals(0.065, sequence.next());
    assertEquals(0.07, sequence.next());
    assertEquals(0.075, sequence.next());
    assertEquals(0.08, sequence.next());
    assertEquals(0.085, sequence.next());
    assertEquals(0.09, sequence.next());
    assertEquals(0.095, sequence.next());
    assertEquals(0.1, sequence.next());
    assertEquals(0.15, sequence.next());
    assertEquals(0.2, sequence.next());
    assertEquals(0.25, sequence.next());
    assertEquals(0.3, sequence.next());
    assertEquals(0.35, sequence.next());
    assertEquals(0.4, sequence.next());
    assertEquals(0.45, sequence.next());
    assertEquals(0.5, sequence.next());
    assertEquals(0.55, sequence.next());
    assertEquals(0.6, sequence.next());
    assertEquals(0.65, sequence.next());
    assertEquals(0.7, sequence.next());
    assertEquals(0.75, sequence.next());
    assertEquals(0.8, sequence.next());
    assertEquals(0.85, sequence.next());
    assertEquals(0.9, sequence.next());
    assertEquals(0.95, sequence.next());
    assertEquals(1, sequence.next());
    assertEquals(1.5, sequence.next());
    assertEquals(1.5, sequence.getValue());
  },

  testPrevious20Divisor_ns3() {
    const sequence = new PacedPowersOf10Mirror(20, 0.001);
    assertEquals(1, sequence.round(1));
    assertEquals(0.95, sequence.previous());
    assertEquals(0.9, sequence.previous());
    assertEquals(0.85, sequence.previous());
    assertEquals(0.8, sequence.previous());
    assertEquals(0.75, sequence.previous());
    assertEquals(0.7, sequence.previous());
    assertEquals(0.65, sequence.previous());
    assertEquals(0.6, sequence.previous());
    assertEquals(0.55, sequence.previous());
    assertEquals(0.5, sequence.previous());
    assertEquals(0.45, sequence.previous());
    assertEquals(0.4, sequence.previous());
    assertEquals(0.35, sequence.previous());
    assertEquals(0.3, sequence.previous());
    assertEquals(0.25, sequence.previous());
    assertEquals(0.2, sequence.previous());
    assertEquals(0.15, sequence.previous());
    assertEquals(0.1, sequence.previous());
    assertEquals(0.095, sequence.previous());
    assertEquals(0.09, sequence.previous());
    assertEquals(0.085, sequence.previous());
    assertEquals(0.08, sequence.previous());
    assertEquals(0.075, sequence.previous());
    assertEquals(0.07, sequence.previous());
    assertEquals(0.065, sequence.previous());
    assertEquals(0.06, sequence.previous());
    assertEquals(0.055, sequence.previous());
    assertEquals(0.05, sequence.previous());
    assertEquals(0.045, sequence.previous());
    assertEquals(0.04, sequence.previous());
    assertEquals(0.035, sequence.previous());
    assertEquals(0.03, sequence.previous());
    assertEquals(0.025, sequence.previous());
    assertEquals(0.02, sequence.previous());
    assertEquals(0.015, sequence.previous());
    assertEquals(0.01, sequence.previous());
    assertEquals(0.0095, sequence.previous());
    assertEquals(0.0095, sequence.getValue());
  },

  testRidiculouslySmallValues_ns3() {
    const sequence = new PacedPowersOf10Mirror(2, 0.00000000000001);
    assertEquals(0.000000000005, sequence.floor(0.000000000005969));
    assertEquals(0.000000000001, sequence.previous());
    assertEquals(0.0000000000005, sequence.previous());
    assertEquals(0.0000000000001, sequence.previous());
    assertEquals(0.00000000000005, sequence.previous());
    assertEquals(0.00000000000005, sequence.getValue());
  },

  testRound_ns3() {
    const sequence = new PacedPowersOf10Mirror(2, 0.000005);
    assertEquals(0.005, sequence.round(0.007499999999));
    assertEquals(0.001, sequence.previous());
    assertEquals(0.01, sequence.round(0.0075000000001));
    assertEquals(0.05, sequence.next());
    assertEquals(10000, sequence.round(24999));
    assertEquals(10000, sequence.round(25001));
    assertEquals(1000000, sequence.round(2678999));
    assertEquals(500000, sequence.previous());

    assertEquals(0.000005, sequence.round(0.000005));
    assertEquals(0.00001, sequence.next());
  },

  testCeil_ns3() {
    const sequence = new PacedPowersOf10Mirror(5, 0.001);
    assertEquals(0.004, sequence.ceil(0.004));
    assertEquals(0.002, sequence.previous());
    assertEquals(0.002, sequence.ceil(0.001001));
    assertEquals(0.004, sequence.next());
    assertEquals(60000, sequence.ceil(45678));
    assertEquals(40000, sequence.previous());
    assertEquals(0.08, sequence.ceil(0.07));
    assertEquals(0.1, sequence.next());
  },

  testDivisor20Ceil_ns3() {
    const sequence = new PacedPowersOf10Mirror(20, 0.001);
    assertEquals(0.004, sequence.ceil(0.004));
    assertEquals(0.0035, sequence.previous());
    assertEquals(0.0015, sequence.ceil(0.001001));
    assertEquals(0.002, sequence.next());
    assertEquals(50000, sequence.ceil(45678));
    assertEquals(45000, sequence.previous());
    assertEquals(0.015, sequence.ceil(0.0125));
    assertEquals(0.02, sequence.next());
  },

  testFloor_ns3() {
    const sequence = new PacedPowersOf10Mirror(4, 0.0005);
    assertEquals(0.0025, sequence.floor(0.0025));
    assertEquals(0.001, sequence.previous());

    assertEquals(0.075, sequence.floor(0.099));
    assertEquals(0.1, sequence.next());
    assertEquals(50000, sequence.floor(74919));
    assertEquals(75000, sequence.next());
    assertEquals(0.005, sequence.floor(0.006001));
    assertEquals(0.0025, sequence.previous());
    assertEquals(5, sequence.floor(5.5));
    assertEquals(7.5, sequence.next());
    assertEquals(500, sequence.floor(549));
    assertEquals(750, sequence.next());

    assertEquals(1, sequence.floor(2.444));
    assertEquals(2.5, sequence.next());
  },

  testValueZeroInputs_ns3() {
    const sequence = new PacedPowersOf10Mirror(2, 0);
    assertEquals(0, sequence.round(0));
    assertEquals(0, sequence.floor(0));
    assertEquals(0, sequence.ceil(0));
  },
});
