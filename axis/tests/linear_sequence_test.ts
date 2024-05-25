/**
 * @fileoverview Tests for LinearSequence.
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
import {LinearSequence} from '../linear_sequence';

testSuite({
  testSimpleSequence() {
    const sequence = new LinearSequence(1);
    assertEquals(0, sequence.getValue());
    assertEquals(1, sequence.getNextSize());
    assertEquals(1, sequence.next());
    assertEquals(2, sequence.next());
    assertEquals(3, sequence.next());
    assertEquals(2, sequence.previous());
    assertEquals(2, sequence.getValue());
  },

  testSpacing5() {
    const sequence = new LinearSequence(5);
    assertEquals(0, sequence.getValue());
    assertEquals(5, sequence.getNextSize());
    assertEquals(5, sequence.next());
    assertEquals(5, sequence.getValue());
  },

  testFloor_ns2() {
    const sequence = new LinearSequence(5);
    assertEquals(10, sequence.floor(10));
    assertEquals(10, sequence.floor(11));
    assertEquals(10, sequence.floor(14));
  },

  testCeil_ns2() {
    const sequence = new LinearSequence(5);
    assertEquals(10, sequence.ceil(10));
    assertEquals(10, sequence.ceil(6));
    assertEquals(10, sequence.ceil(10));
  },

  testFloorOffset2_ns2() {
    const sequence = new LinearSequence(5, 2);
    assertEquals(7, sequence.floor(7));
    assertEquals(7, sequence.floor(10));
    assertEquals(12, sequence.floor(15));
  },

  testRound_ns2() {
    const sequence = new LinearSequence(5);
    assertEquals(100, sequence.round(100));
    assertEquals(100, sequence.round(102));
    assertEquals(100, sequence.round(98));
  },

  testNormalizerInUse_ns2() {
    const sequence = new LinearSequence(0.05);
    assertEquals(0.05, sequence.next());
    assertEquals(0.1, sequence.next());
    assertEquals(0.15, sequence.next());
  },
});
