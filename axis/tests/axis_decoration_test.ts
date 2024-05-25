/**
 * @fileoverview Tests for AxisDecoration.
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
  assertFalse,
  assertNull,
  assertTrue,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {Alignment, AxisDecoration} from '../axis_decoration';

class AxisDecorationTest {
  /** @export */
  testDefaultAlignmentCenter() {
    const decoration = new AxisDecoration(1, 1, true, true, true, '1');
    assertEquals(Alignment.CENTER, decoration.getLabelAlignment());
  }

  /** @export */
  testMakeDecoration() {
    const decoration = AxisDecoration.makeLeftAlignedLabel(10, 20, 'hi');
    assertEquals(10, decoration.getValue());
    assertEquals(20, decoration.getPosition());
    assertEquals('hi', decoration.getLabel());
    assertFalse(decoration.labelAlignedRight());
    assertTrue(decoration.labelAlignedLeft());
    assertFalse(decoration.labelAlignedCenter());
    assertFalse(decoration.isTickHeavy());
    assertFalse(decoration.hasTick());
    assertFalse(decoration.hasLine());
  }

  /** @export */
  testMakeLineWithTick() {
    const decoration = AxisDecoration.makeLineWithTick(20, 30);
    assertTrue(decoration.hasLine());
    assertTrue(decoration.hasTick());
    assertEquals(Alignment.CENTER, decoration.getLabelAlignment());
  }

  /** @export */
  testMakeLineWithHeavyTick() {
    const decoration = AxisDecoration.makeLineWithHeavyTick(20, 30);
    assertTrue(decoration.hasLine());
    assertNull(decoration.getLabel());
    assertTrue(decoration.hasTick());
    assertTrue(decoration.isTickHeavy());
    assertEquals(Alignment.CENTER, decoration.getLabelAlignment());
  }
}

testSuite(new AxisDecorationTest());
