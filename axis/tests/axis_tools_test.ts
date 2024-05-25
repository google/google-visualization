/**
 * @fileoverview Tests for AxisAxisTools.
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
  assertArrayEquals,
  assertEquals,
  assertFalse,
  assertTrue,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {NumberFormatterBuilder} from '../../format/formatting';
import {AxisTools} from '../axis_tools';
import {LinMapper} from '../lin_mapper';
import {LinearSequence} from '../linear_sequence';
import {Orientation} from '../text_measurer';
import {FixedFont} from '../text_measurer_fixed_font';

class AxisToolsTest {
  // TODO(dlaliberte): remove '!'
  mapper!: LinMapper;

  // TODO(dlaliberte): remove '!'
  formatterBuilder!: NumberFormatterBuilder;

  // TODO(dlaliberte): remove '!'
  orientation!: Orientation;

  // TODO(dlaliberte): remove '!'
  textMeasurer!: FixedFont;

  // TODO(dlaliberte): remove '!'
  axisTools!: AxisTools;

  setUp() {
    this.mapper = new LinMapper(0, 100, 0, 100);
    this.formatterBuilder = new NumberFormatterBuilder();
    this.textMeasurer = new FixedFont(7, 11);
    this.orientation = Orientation.HORIZONTAL;
    this.initAxisTools();
  }

  /** Initializes the axis tools. */
  initAxisTools() {
    this.axisTools = new AxisTools(
      this.mapper,
      this.textMeasurer,
      this.orientation,
      this.formatterBuilder,
    );
    this.axisTools.buildFormatter();
  }

  /** @export */
  testIsMultiple() {
    assertTrue(this.axisTools.isMultiple(0, 1));
    assertTrue(this.axisTools.isMultiple(1, 1));
    assertTrue(this.axisTools.isMultiple(-1, 1));
    assertTrue(this.axisTools.isMultiple(1e10, 1));

    assertTrue(
      '1.0000000000000001 rounds to 1',
      this.axisTools.isMultiple(1.0000000000000001, 1),
    );

    assertFalse('1.1, 1', this.axisTools.isMultiple(1.1, 1));

    assertTrue('1.1, 0.1', this.axisTools.isMultiple(1.1, 0.1));
    assertTrue('-1.1, 0.1', this.axisTools.isMultiple(-1.1, 0.1));
    assertFalse('1.10000001, 0.1', this.axisTools.isMultiple(1.10000001, 0.1));
    // Ignore differences beyond precision.
    assertTrue(
      '1.1000000000000001, 0.1',
      this.axisTools.isMultiple(1.1000000000000001, 0.1),
    );
  }

  /** @export */
  testAllLabelsUnique() {
    assertTrue(this.axisTools.allLabelsUnique([0, 30, 50]));

    // Any duplicate values should fail.
    assertFalse(this.axisTools.allLabelsUnique([0, 0]));
    assertFalse(this.axisTools.allLabelsUnique([1, 1]));

    assertTrue(this.axisTools.allLabelsUnique([1, 1.5]));

    this.formatterBuilder.setMaxNumDecimals(0);
    this.initAxisTools();

    // For the purpose of axis ticks, the values need to be formatted
    // accurately, so all but the smallest difference is a failure.

    assertTrue(
      '1.0001 rounds to 1, but still unique',
      this.axisTools.allLabelsUnique([0, 1.0001]),
    );

    assertTrue(
      '1.0001 rounds to 1, so not a dup',
      this.axisTools.allLabelsUnique([0, 1.0001]),
    );

    assertTrue(
      '1.0000000000000001 rounds to 1, close enough and not a dup',
      this.axisTools.allLabelsUnique([0, 1.0000000000000001]),
    );

    assertFalse(
      '1.0000000000000001 rounds to 1, a dup of 1',
      this.axisTools.allLabelsUnique([1, 1.0000000000000001]),
    );

    assertTrue(
      '0.0000000000000001 rounds to 0, not a dup',
      this.axisTools.allLabelsUnique([0.0000000000000001, 1]),
    );

    assertFalse(
      '0.0000000000000001 rounds to 0, a dup of 0',
      this.axisTools.allLabelsUnique([0, 0.0000000000000001]),
    );

    assertTrue(
      '0.0000000000000001 rounds to 0, not a dup',
      this.axisTools.allLabelsUnique([0.0000000000000001, 1]),
    );

    assertTrue(
      'Big number, 1234567890129000 should round to 1234567890130000',
      this.axisTools.allLabelsUnique([1234567890120000, 1234567890129000]),
    );

    assertFalse(
      'Big number, 12345678901290001 rounds to dup',
      this.axisTools.allLabelsUnique([1234567890120000, 1234567890120001]),
    );
  }

  /** @export */
  testAllLabelsFit() {
    assertTrue(this.axisTools.allLabelsFit([30, 50]));
    assertFalse(this.axisTools.allLabelsFit([1, 2, 3]));
  }

  /** @export */
  testDetectLabelCollision() {
    assertTrue(this.axisTools.detectLabelCollision(10, 11));
    assertFalse(this.axisTools.detectLabelCollision(10, 80));
  }

  /** @export */
  testRemoveCollisionsWithZero() {
    assertArrayEquals(
      [0, 1, 5, 30, 90],
      this.axisTools.removeCollisionsWithZero([0, 1, 5, 30, 90]),
    );
  }

  /** @export */
  testGetDataSpanSize() {
    assertEquals(60, this.axisTools.getDataSpanSize(20, 80));
    this.mapper = new LinMapper(0, 1000, 0, 100);
    this.initAxisTools();
    assertEquals(600, this.axisTools.getDataSpanSize(20, 80));
  }

  /** @export */
  testMakeLabels() {
    const decorations = this.axisTools.makeLabels([22, 77]);
    assertEquals(2, decorations.length);
    assertEquals('22', decorations[0].getLabel());
    assertEquals('77', decorations[1].getLabel());
  }

  /** @export */
  testMakeDataValues() {
    const lineSequence = new LinearSequence(10);
    const values = this.axisTools.makeDataValues(lineSequence, 0, 50, null);
    this.initAxisTools();
    assertArrayEquals([0, 10, 20, 30, 40, 50], values);
  }

  /** @export */
  testMakeDataValuesInZeroSpan() {
    const lineSequence = new LinearSequence(0);
    this.initAxisTools();
    const values = this.axisTools.makeDataValues(lineSequence, 0, 0, null);
    assertArrayEquals([0], values);
  }

  /** @export */
  testMakeDataValuesInOneSpan() {
    const lineSequence = new LinearSequence(2);
    this.initAxisTools();
    const values = this.axisTools.makeDataValues(lineSequence, 1, 9, null);
    assertArrayEquals([0, 2, 4, 6, 8, 10], values);
  }

  /** @export */
  testMakeDataValuesAddALine() {
    const lineSequence = new LinearSequence(100);
    this.initAxisTools();
    const values = this.axisTools.makeDataValues(lineSequence, 91, 129, null);
    assertArrayEquals([0, 100, 200], values);
  }

  /** @export */
  testMakeDataValuesWithMultiple() {
    let lineSequence = new LinearSequence(10);
    let values = this.axisTools.makeDataValues(lineSequence, 0, 50, 5);
    this.initAxisTools();
    assertArrayEquals([0, 10, 20, 30, 40, 50], values);

    lineSequence = new LinearSequence(1);
    values = this.axisTools.makeDataValues(lineSequence, 0, 5, 0.5);
    this.initAxisTools();
    assertArrayEquals([0, 1, 2, 3, 4, 5], values);

    lineSequence = new LinearSequence(0.5);
    values = this.axisTools.makeDataValues(lineSequence, 0, 2, 0.5);
    this.initAxisTools();
    assertArrayEquals([0, 0.5, 1, 1.5, 2], values);

    lineSequence = new LinearSequence(0.5);
    values = this.axisTools.makeDataValues(lineSequence, 0, 2, 1);
    this.initAxisTools();
    assertArrayEquals([0, 1, 2], values);
  }
}

testSuite(new AxisToolsTest());
