/**
 * @fileoverview A Sequence of powers of 10.
 * Copyright 2010 Google Inc. All Rights Reserved.
 *
 * @license
 * Copyright 2021 Google LLC
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

import {assert} from '@npm//@closure/asserts/asserts';

import {
  ceilExponent,
  exactScientific,
  floorExponent,
  round,
  roundExponent,
} from './pow_10_math';
import {Sequence} from './sequence';

/**
 * Creates a sequence of powers of 10.
 */
export class PowersOf10Sequence extends Sequence {
  /**
   * The internal representation of where in the sequence we're currently at.
   */
  private position = 0;
  constructor() {
    super();
  }

  /**
   * Advances one position and returns the new current value.
   * @return The new current value.
   */
  next(): number {
    this.position++;
    return this.getValue();
  }

  /**
   * Decreases the sequence's position by 1 and returns the new value.
   * @return The new current value.
   */
  previous(): number {
    this.position--;
    return this.getValue();
  }

  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  getValue(): number {
    return exactScientific(1, this.position);
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or less than the parameter value and then returns this "floored"
   * value corresponding to the new position.
   *
   * @param newValue The value to floor.
   * @return The new value of the sequence.
   */
  floor(newValue: number): number {
    assert(newValue > 0, 'newValue must be > 0');
    this.position = floorExponent(newValue);
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or greater than the parameter value and then returns this "ceiled"
   * value corresponding to the new position.
   *
   * @param newValue The value to ceil.
   * @return The new value of the sequence.
   */
  ceil(newValue: number): number {
    assert(newValue > 0, 'newValue must be > 0');
    this.position = ceilExponent(newValue);
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * closest possible to the parameter value and then returns this
   * "rounded" value corresponding to the new position.
   *
   * @param newValue The value to round.
   * @return The new value of the sequence.
   */
  round(newValue: number): number {
    assert(newValue > 0, 'newValue must be > 0');
    // Can't just get rounded exponent, because that will not perform
    // linear rounding of newValue.
    this.position = roundExponent(round(newValue));
    return this.getValue();
  }

  /**
   * Returns the size of the next step following the current position.
   * @return The size of next step.
   */
  getNextSize(): number {
    return this.next() - this.previous();
  }
}
