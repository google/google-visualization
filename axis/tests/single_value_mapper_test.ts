/**
 * @fileoverview Tests for single value mapper.
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
import {SingleValueMapper} from '../single_value_mapper';

class SingleValueMapperTest {
  /** @export */
  testMapper() {
    const mapper = new SingleValueMapper(8, 10, 100);
    assertEquals(55, mapper.getScreenValue(8));
    assertEquals(55, mapper.getScreenValue(12));
    assertEquals(8, mapper.getDataValue(9999));
    assertEquals(8, mapper.getDataMin());
    assertEquals(8, mapper.getDataMax());
    assertEquals(10, mapper.getScreenStart());
    assertEquals(100, mapper.getScreenEnd());
  }
}

testSuite(new SingleValueMapperTest());
