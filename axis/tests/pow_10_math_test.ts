/**
 * @fileoverview Tests Pow-10-math.
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
import * as pow10Math from '../pow_10_math';

const {
  ceil,
  ceilExponent,
  exactScientific,
  exponentOf,
  floor,
  floorExponent,
  isPowerOf10,
  powerOf,
  round,
  roundExponent,
} = pow10Math;

testSuite({
  testExactScientific_ns6() {
    assertEquals(0.6000000000000001, 6 * Math.pow(10, -1));
    assertEquals(0.6, exactScientific(6, -1));
    assertEquals(6000, exactScientific(6, 3));
  },

  testPowerOf_ns6() {
    assertEquals(100, powerOf(2));
  },

  testIsPowerOf10_ns6() {
    assertEquals(false, isPowerOf10(0.5));
    assertEquals(false, isPowerOf10(0.00011));
    assertEquals(false, isPowerOf10(25));
    assertEquals(false, isPowerOf10(50));
    assertEquals(true, isPowerOf10(0.01));
    assertEquals(true, isPowerOf10(0.0001));
    assertEquals(true, isPowerOf10(100));
    assertEquals(true, isPowerOf10(1000));
  },

  testExponentOf_ns6() {
    assertEquals(3, exponentOf(1000));
  },

  testFloor_ns6() {
    assertEquals(10, floor(10));
    assertEquals(0.01, floor(0.012));
    assertEquals(1, floor(7));
    assertEquals(1000, floor(4523));
    assertEquals(10000, floor(94523));
  },

  testCeil_ns6() {
    assertEquals(10, ceil(10));
    assertEquals(0.01, ceil(0.006));
    assertEquals(10, ceil(5));
    assertEquals(100, ceil(22));
  },

  testRound_ns6() {
    assertEquals(10, round(10));
    assertEquals(100, round(88));
    assertEquals(1000, round(550));
    assertEquals(100, round(549));
  },

  testFloorExponent_ns6() {
    assertEquals(0, floorExponent(1));
    assertEquals(3, floorExponent(1222));
    assertEquals(1, floorExponent(99));
    assertEquals(1, floorExponent(10));
    assertEquals(0, floorExponent(9));
  },

  testCeilExponent_ns6() {
    assertEquals(0, ceilExponent(1));
    assertEquals(4, ceilExponent(1222));
    assertEquals(2, ceilExponent(99));
    assertEquals(1, ceilExponent(10));
    assertEquals(1, ceilExponent(9));
  },

  testRoundExponent_ns6() {
    assertEquals(0, roundExponent(1));
    assertEquals(1, roundExponent(31));
    assertEquals(2, roundExponent(32));
    assertEquals(3, roundExponent(400));
    assertEquals(3, roundExponent(750));
    assertEquals(3, roundExponent(1250));
  },
});
