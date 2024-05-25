/**
 * Tests com.google.trendalyzer.number.sequence.CustomPowersOf10.
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
  assertNotNullNorUndefined,
  assertThrows,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import {CustomPowersOf10} from '../custom_powers_of_10';

testSuite({
  testNext_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 5]);
    assertEquals(1, sequence.getValue());
    assertEquals(2, sequence.next());
    assertEquals(5, sequence.next());
    assertEquals(10, sequence.next());
    assertEquals(20, sequence.next());
    assertEquals(50, sequence.next());
    assertEquals(100, sequence.next());
    assertEquals(200, sequence.next());
  },

  testPrevious_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 4, 6]);
    assertEquals(1, sequence.getValue());
    assertEquals(0.6, sequence.previous());
    assertEquals(0.4, sequence.previous());
    assertEquals(0.2, sequence.previous());
    assertEquals(0.1, sequence.previous());
    assertEquals(0.06, sequence.previous());
    assertEquals(0.04, sequence.previous());
    assertEquals(0.02, sequence.previous());
    assertEquals(0.01, sequence.previous());
    assertEquals(0.006, sequence.previous());
    assertEquals(0.006, sequence.getValue());
  },

  testGetNextSize_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 5]);
    sequence.round(1);
    assertEquals(1, sequence.getNextSize());
    sequence.next();
    assertEquals(3, sequence.getNextSize());
    sequence.next();
    assertEquals(5, sequence.getNextSize());
  },

  testRidiculouslySmallValues_ns1() {
    const sequence = new CustomPowersOf10([1, 3, 6]);
    assertEquals(0.000000000003, sequence.floor(0.000000000005969));
    assertEquals(0.000000000001, sequence.previous());
    assertEquals(0.0000000000006, sequence.previous());
    assertEquals(0.0000000000003, sequence.previous());
    assertEquals(0.0000000000001, sequence.previous());
    assertEquals(0.00000000000006, sequence.previous());

    assertEquals(0.000000000003, sequence.ceil(0.000000000001001));
    assertEquals(0.000000000006, sequence.next());
    assertEquals(0.00000000001, sequence.next());
    assertEquals(0.00000000003, sequence.next());
    assertEquals(0.00000000006, sequence.next());
    assertEquals(0.0000000001, sequence.next());
  },

  testRound_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 5]);
    assertEquals(0.005, sequence.round(0.0074999999999999999));
    assertEquals(0.002, sequence.previous());
    assertEquals(0.01, sequence.round(0.0075000000001));
    assertEquals(0.02, sequence.next());
    assertEquals(2000000, sequence.round(2678999));
    assertEquals(1000000, sequence.previous());

    // Test rounding a value equal to a value in the sequence.
    assertEquals(0.000002, sequence.round(0.000002));
    assertEquals(0.000005, sequence.next());
  },

  testCeil_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 4, 6]);
    // Test ceiling a value equal to a value in the sequence.
    assertEquals(0.004, sequence.ceil(0.004));
    assertEquals(0.002, sequence.previous());
    assertEquals(0.002, sequence.ceil(0.001001));
    assertEquals(0.004, sequence.next());
    assertEquals(60000, sequence.ceil(45678));
    assertEquals(40000, sequence.previous());
    assertEquals(0.06, sequence.ceil(0.05));
    assertEquals(0.1, sequence.next());
  },

  testFloor_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 4, 6]);
    // Test flooring a value equal to a value in the sequence.
    assertEquals(0.004, sequence.floor(0.004));
    assertEquals(0.002, sequence.previous());
    assertEquals(0.06, sequence.floor(0.099));
    assertEquals(0.1, sequence.next());
    assertEquals(4000, sequence.floor(4919));
    assertEquals(6000, sequence.next());
    assertEquals(0.006, sequence.floor(0.006001));
    assertEquals(0.004, sequence.previous());
    assertEquals(4, sequence.floor(5.5));
    assertEquals(6, sequence.next());
    assertEquals(4, sequence.floor(5.49));
    assertEquals(6, sequence.next());
  },

  testNegativeValueInputs_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 5]);
    assertThrows('round(-1) should have thrown an Error.', () => {
      sequence.round(-1);
    });
    assertThrows('floor(-0.0001) should have thrown an Error.', () => {
      sequence.floor(-0.0001);
    });
    assertThrows('ceil(-0.00011) should have thrown an Error.', () => {
      sequence.ceil(-0.00011);
    });
    assertThrows('ceil(-999) should have thrown an Error.', () => {
      sequence.ceil(-999);
    });
  },

  testValueZeroInputs_ns1() {
    const sequence = new CustomPowersOf10([1, 2, 5]);
    assertThrows('round(0) should have thrown an Error.', () => {
      sequence.round(0);
    });
    assertThrows('floor(0) should have thrown an Error.', () => {
      sequence.floor(0);
    });
    assertThrows('ceil(0) should have thrown an Error.', () => {
      sequence.ceil(0);
    });
  },

  testMultiplierErrors() {
    assertThrows('Multipliers [] should have thrown an Error.', () => {
      assertNotNullNorUndefined(new CustomPowersOf10([]));
    });
    assertThrows(
      'Multipliers [0.99, 2, 5] should have thrown an Error.',
      () => {
        assertNotNullNorUndefined(new CustomPowersOf10([0.99, 2, 5]));
      },
    );
    assertThrows(
      'Multipliers [1, 2, 5, 10] should have thrown an Error.',
      () => {
        assertNotNullNorUndefined(new CustomPowersOf10([1, 2, 5, 10]));
      },
    );
    assertThrows('Multipliers [1, "2", 5] should have thrown an Error.', () => {
      assertNotNullNorUndefined(
        new CustomPowersOf10([1, '2', 5] as unknown as number[]),
      );
    });
    assertThrows('Multipliers [1, 5, 2] should have thrown an Error.', () => {
      assertNotNullNorUndefined(new CustomPowersOf10([1, 5, 2]));
    });
  },
});
