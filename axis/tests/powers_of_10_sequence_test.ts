/**
 * @fileoverview Tests PowersOf10.
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
  fail,
} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
// ts-ignore was either removed or relocated below Fix code and remove this comment. Error:
// TS2307: Cannot find module
// '../powers_of_10_sequence' or its
// corresponding type declarations.
import {assertThrowsJsUnitException} from '@npm//@closure/testing/asserts';
import {PowersOf10Sequence} from '../powers_of_10_sequence';

class PowersOf10SequenceTest {
  /** @export */
  testPowersOf10Increase() {
    const sequence = new PowersOf10Sequence();
    assertEquals(1, sequence.getValue());
    assertEquals(10, sequence.next());
    assertEquals(100, sequence.next());
    assertEquals(1000, sequence.next());
    assertEquals(10000, sequence.next());
    assertEquals(100000, sequence.next());
    assertEquals(1000000, sequence.next());
    assertEquals(1000000, sequence.getValue());
  }

  /** @export */
  testPowersOf10Decrease() {
    const sequence = new PowersOf10Sequence();
    assertEquals(1, sequence.getValue());
    assertEquals(0.1, sequence.previous());
    assertEquals(0.01, sequence.previous());
    assertEquals(0.001, sequence.previous());
    assertEquals(0.0001, sequence.previous());
    assertEquals(0.00001, sequence.previous());
    assertEquals(0.000001, sequence.previous());
    assertEquals(0.000001, sequence.getValue());
  }

  /** @export */
  testPowersOf10Floor() {
    const sequence = new PowersOf10Sequence();
    assertEquals(1, sequence.floor(9.9));
    assertEquals(0.1, sequence.previous());
    assertEquals(0.001, sequence.floor(0.009191));
    assertEquals(0.01, sequence.next());
    assertEquals(10000, sequence.floor(15678));
    assertEquals(1000, sequence.previous());

    // Test flooring a value equal to a value in the sequence.
    assertEquals(0.000001, sequence.floor(0.000001));

    assertEquals(0.00001, sequence.next());
  }

  /** @export */
  testPowersOf10Ceil() {
    const sequence = new PowersOf10Sequence();

    // Test ceiling a value equal to a value in the sequence.
    assertEquals(1, sequence.ceil(1));

    assertEquals(0.1, sequence.previous());
    assertEquals(0.01, sequence.ceil(0.001001));
    assertEquals(0.1, sequence.next());
    assertEquals(100000, sequence.ceil(15678));
    assertEquals(10000, sequence.previous());

    // Test ceiling a value equal to a value in the sequence.
    assertEquals(0.000001, sequence.ceil(0.000001));

    assertEquals(0.00001, sequence.next());
  }

  /** @export */
  testPowersOf10Round() {
    const sequence = new PowersOf10Sequence();
    assertEquals('A', 10, sequence.round(9.9));
    assertEquals('B', 1, sequence.previous());

    // Test rounding a value equal to a value in the sequence.
    assertEquals('C', 0.01, sequence.round(0.01));

    assertEquals('D', 0.1, sequence.next());
    assertEquals('E', 0.01, sequence.round(0.009191));
    assertEquals('F', 0.1, sequence.next());
    assertEquals('G', 0.001, sequence.round(0.001001));
    assertEquals('H', 0.0001, sequence.previous());
    assertEquals('I', 10, sequence.round(5.5));
    assertEquals('J', 100, sequence.next());
    assertEquals('K', 1, sequence.round(3.1515));
    assertEquals('K', 1, sequence.round(5.49));
    assertEquals('L', 10, sequence.next());
  }

  /** @export */
  testPowersOf10NegativeValueInputs() {
    const sequence = new PowersOf10Sequence();
    try {
      sequence.round(-1);
      fail('PowersOf10.round(-1) did not throw a Error');
    } catch (error) {
      if (error instanceof assertThrowsJsUnitException) {
        throw error;
      }
    }
    try {
      sequence.floor(-0.0001);
      fail('PowersOf10.floor(-0.0001) did not throw a Error');
    } catch (error) {
      if (error instanceof assertThrowsJsUnitException) {
        throw error;
      }
    }
    try {
      sequence.ceil(-0.00011);
      fail('PowersOf10.ceil(-0.00011) did not throw a Error');
    } catch (error) {
      if (error instanceof assertThrowsJsUnitException) {
        throw error;
      }
    }
    try {
      sequence.ceil(-999);
      fail('PowersOf10.ceil(-999) did not throw a Error');
    } catch (error) {
      if (error instanceof assertThrowsJsUnitException) {
        throw error;
      }
    }
  }

  /** @export */
  testPowersOf10ValueZeroInputs() {
    const sequence = new PowersOf10Sequence();
    try {
      sequence.round(0);
      fail('PowersOf10.round(0) did not throw a Error');
    } catch (error) {
      if (error instanceof assertThrowsJsUnitException) {
        throw error;
      }
    }
    try {
      sequence.floor(0);
      fail('PowersOf10.floor(0) did not throw a Error');
    } catch (error) {
      if (error instanceof assertThrowsJsUnitException) {
        throw error;
      }
    }
    try {
      sequence.ceil(0);
      fail('PowersOf10.ceil(0) did not throw a Error');
    } catch (error) {
      if (error instanceof assertThrowsJsUnitException) {
        throw error;
      }
    }
  }
}

testSuite(new PowersOf10SequenceTest());
