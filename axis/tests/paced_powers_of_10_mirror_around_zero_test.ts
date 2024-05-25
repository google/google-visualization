/**
 * @fileoverview Tests PacedPowersOf10Mirror with values close to zero.
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
import {PacedPowersOf10Mirror} from '../paced_powers_of_10_mirror';

testSuite({
  testPrevious_ns4() {
    const sequence = new PacedPowersOf10Mirror(2, 0.01);
    assertEquals(1, sequence.round(1));
    assertEquals(0.5, sequence.previous());
    assertEquals(0.1, sequence.previous());
    assertEquals(0.05, sequence.previous());
    assertEquals(0, sequence.previous());
    assertEquals(-0.05, sequence.previous());
    assertEquals(-0.1, sequence.previous());
    assertEquals(-0.5, sequence.previous());
    assertEquals(-1, sequence.previous());
    assertEquals(-1, sequence.getValue());
  },

  testSpecialPrevious_ns4() {
    const sequence = new PacedPowersOf10Mirror(4, 0.1);
    assertEquals(1, sequence.round(1));
    assertEquals(0.75, sequence.previous());
    assertEquals(0.5, sequence.previous());
    assertEquals(0.25, sequence.previous());
    assertEquals(0, sequence.previous());
    assertEquals(-0.25, sequence.previous());
    assertEquals(-0.5, sequence.previous());
    assertEquals(-0.75, sequence.previous());
    assertEquals(-1.0, sequence.previous());
    assertEquals(-2.5, sequence.previous());
    assertEquals(-5.0, sequence.previous());
  },

  testNext_ns4() {
    const sequence = new PacedPowersOf10Mirror(5, 99);
    assertEquals(-100, sequence.round(-100));
    assertEquals(-80, sequence.next());
    assertEquals(-60, sequence.next());
    assertEquals(-40, sequence.next());
    assertEquals(-20, sequence.next());
    assertEquals(0, sequence.next());
    assertEquals(20, sequence.next());
    assertEquals(40, sequence.next());
    assertEquals(60, sequence.next());
    assertEquals(80, sequence.next());
    assertEquals(100, sequence.next());
    assertEquals(200, sequence.next());
    assertEquals(200, sequence.getValue());
  },

  testPrevious20Div_ns4() {
    const sequence = new PacedPowersOf10Mirror(20, 0.01);
    assertEquals(0.1, sequence.round(0.1));
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
    assertEquals(0, sequence.previous());
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
    assertEquals(-0.15, sequence.getValue());
  },

  testNext20Div_ns4() {
    const sequence = new PacedPowersOf10Mirror(20, 0.1);
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
    assertEquals(0, sequence.next());
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
    assertEquals(2, sequence.next());
    assertEquals(2, sequence.getValue());
  },

  testRidiculouslySmallValues_ns4() {
    const sequence = new PacedPowersOf10Mirror(2, 0.00000000000091);
    assertEquals(-0.000000000005, sequence.ceil(-0.000000000005969));
    assertEquals(-0.000000000001, sequence.next());
    assertEquals(-0.0000000000005, sequence.next());
    assertEquals(0, sequence.next());
    assertEquals(0.0000000000005, sequence.next());
    assertEquals(0.000000000001, sequence.next());
    assertEquals(0.000000000001, sequence.getValue());
  },

  testRound_ns4() {
    const sequence = new PacedPowersOf10Mirror(2, 0.001);
    assertEquals(0.005, sequence.round(0.007499999999));
    assertEquals(0.01, sequence.next());
    assertEquals(0.01, sequence.round(0.0075000000001));
    assertEquals(0.005, sequence.previous());
    assertEquals(0, sequence.round(-0.0024999));
    assertEquals(-0.005, sequence.round(-0.0025001));
    assertEquals(-0.01, sequence.round(-0.02678999));
    assertEquals(-0.005, sequence.next());
    assertEquals(0, sequence.round(0.0024));
    assertEquals(-0.005, sequence.previous());
    assertEquals(0, sequence.round(-0.0024));
    assertEquals(-0.005, sequence.previous());
    assertEquals(0, sequence.round(0.000005));
    assertEquals(1, sequence.round(2.9999));
    assertEquals(5, sequence.round(3));
  },

  testCeil_ns4() {
    const sequence = new PacedPowersOf10Mirror(5, 0.001);
    assertEquals(0.004, sequence.ceil(0.004));
    assertEquals(-0.004, sequence.ceil(-0.004));
    assertEquals(-0.002, sequence.next());
    assertEquals(0.002, sequence.ceil(0.001001));
    assertEquals(0, sequence.previous());
    assertEquals(0, sequence.ceil(-0.00145678));
    assertEquals(0.002, sequence.next());
    assertEquals(-0.06, sequence.ceil(-0.07));
    assertEquals(-0.08, sequence.previous());
  },

  testFloor_ns4() {
    const sequence = new PacedPowersOf10Mirror(4, 0.001);
    assertEquals(0, sequence.floor(0.0024999));
    assertEquals(0.0025, sequence.floor(0.0025));
    assertEquals(-0.0025, sequence.floor(-0.0025));
    assertEquals(0, sequence.next());

    assertEquals(0.075, sequence.floor(0.099));
    assertEquals(0.05, sequence.previous());
    assertEquals(-0.0075, sequence.floor(-0.006001));
    assertEquals(-0.005, sequence.next());

    assertEquals(-0.0025, sequence.floor(-0.0011));
    assertEquals(0, sequence.floor(0.0011));
    assertEquals(-0.0025, sequence.previous());

    assertEquals(0.01, sequence.floor(0.02444));
    assertEquals(0.0075, sequence.previous());

    assertEquals(-0.025, sequence.floor(-0.02444));
    assertEquals(-0.05, sequence.previous());

    assertEquals(0, sequence.floor(0.0000005));
    assertEquals(-0.0025, sequence.floor(-0.000005));
  },

  testDivisor20Ceil_ns4() {
    const sequence = new PacedPowersOf10Mirror(20, 0.0001);
    assertEquals(0.004, sequence.ceil(0.004));
    assertEquals(0.0045, sequence.next());
    assertEquals(-0.001, sequence.ceil(-0.001001));
    assertEquals(-0.0015, sequence.previous());
    assertEquals(0.05, sequence.ceil(0.045678));
    assertEquals(0.055, sequence.next());
    assertEquals(-0.015, sequence.ceil(-0.0175));
    assertEquals(-0.02, sequence.previous());

    assertEquals(0, sequence.ceil(-0.000124999));
    assertEquals(-0.00015, sequence.previous());
    assertEquals(0.00015, sequence.ceil(0.000124999));
    assertEquals(0, sequence.previous());
  },

  testValueZeroInputs_ns4() {
    const sequence = new PacedPowersOf10Mirror(2, 0);
    sequence.next();
    assertEquals(0, sequence.round(0));
    sequence.next();
    assertEquals(0, sequence.floor(0));
    sequence.next();
    assertEquals(0, sequence.ceil(0));
  },
});
