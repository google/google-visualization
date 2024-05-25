/**
 * Tests FixedFontTextMeasurer.
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
import {Orientation} from '../text_measurer';
import {FixedFont} from '../text_measurer_fixed_font';

class FixedFontTextMeasurerTest {
  /** @export */
  testTextMeasurer() {
    const measurer = new FixedFont(7, 10);
    assertEquals(10, measurer.getHeight('hello'));
    assertEquals(35, measurer.getWidth('hello'));
    assertEquals(10, measurer.getSizeByOrientation('hi', Orientation.VERTICAL));
    assertEquals(
      14,
      measurer.getSizeByOrientation('hi', Orientation.HORIZONTAL),
    );
  }
}

testSuite(new FixedFontTextMeasurerTest());
