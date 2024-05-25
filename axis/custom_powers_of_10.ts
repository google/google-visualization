/**
 * @fileoverview Provides a sequence of custom multipliers of powers of 10.
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

import * as asserts from '@npm//@closure/asserts/asserts';

import * as pow10Math from './pow_10_math';
import {Sequence} from './sequence';

/**
 * Represents a customized numerical sequence based on the powers of 10. A list
 * of multipliers that is passed to the constructor defines the steps between
 * the powers of 10.
 *
 * The round, floor and ceil methods may only take positive values as parameter.
 *
 * Increasing from 0.1 the following multipliers will give the following
 * sequences:
 *
 * multipliers [1, 2, 5] -> 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100 \
 * multipliers [1, 2, 2.5, 5] -> 0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25,
 * 50, 100 \
 * multipliers [1, 2, 4, 6] -> 0.1, 0.2, 0.4, 0.6, 1, 2, 4, 6, 10, 20, 40, 60,
 * 100\
 */
export class CustomPowersOf10 extends Sequence {
  private readonly multipliers: number[];
  private readonly levelLength: number;

  /**
   * The internal representation of where in the sequence we're currently at.
   */
  private position = 0;
  /**
   * @param multipliers The multipliers to use.
   */
  constructor(multipliers: number[]) {
    super();

    this.checkMultipliers(multipliers);

    /**
     * A list of values that defines the steps between the powers of 10.
     */
    this.multipliers = multipliers.concat();

    /**
     * The number of steps between each power of 10.
     */
    this.levelLength = multipliers.length;
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
   * Returns the size of the next step following the current position.
   * @return The size of next step.
   */
  getNextSize(): number {
    return this.next() - this.previous();
  }

  /**
   * Checks that multipliers is correct. To be correct, the multipliers
   * must follow these 5 rules:
   * 1.  Must contain at least one value.
   * 2.  Lowest/first value cannot be less than 1.
   * 3.  Highest/last value cannot be greater than or equal to 10.
   * 4.  May only contains numerical values.
   * 5.  Is sorted.
   * @param multipliers The multipliers to check.
   */
  checkMultipliers(multipliers: number[]) {
    const length = multipliers.length;
    asserts.assert(length > 0, 'Multiplier is empty.');
    asserts.assert(multipliers[0] >= 1, 'Multipliers first value is too low.');
    asserts.assert(
      multipliers[length - 1] < 10,
      'Multipliers last value is too high.',
    );

    let previous = 0;
    let value: number;
    // Loop through multipliers to check that each element is a numerical
    // value and that it's greater than the preceding value
    for (let i = 0; i < length; i++) {
      value = multipliers[i];
      asserts.assert(
        typeof value === 'number',
        'Multipliers contain non-numerical values.',
      );
      asserts.assert(value > previous, 'Multipliers are not sorted.');
      previous = value;
    }
  }

  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  getValue(): number {
    const k = Math.floor(this.position / this.levelLength);
    const i = this.position - k * this.levelLength;
    // Have to call pow10Math to fix computer math's weird number handling
    // where 6 * Math.pow(10, -1) = 0.6000000000000001 instead of 0.6 etc.
    return pow10Math.exactScientific(this.multipliers[i], k);
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or less than the parameter value and then returns this "floored"
   * value corresponding to the new position.
   * @param value The value to floor.
   * @return The new value of the sequence.
   */
  floor(value: number): number {
    asserts.assert(value > 0, `Value, ${value}, must be positive`);

    this.position = this.levelLength * pow10Math.ceilExponent(value);
    // If values aren't equal keep decreasing until internal value is
    // equal or lesser than the parameter value.
    if (this.getValue() !== value) {
      while (this.previous() > value) {}
    }
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or greater than the parameter value and then returns this "ceiled"
   * value corresponding to the new position.
   * @param value The value to ceil.
   * @return The new value of the sequence.
   */
  ceil(value: number): number {
    asserts.assert(value > 0, `Value ${value} must be positive`);

    this.position = this.levelLength * pow10Math.floorExponent(value);
    // If values aren't equal keep increasing until internal value is
    // equal or greater than the parameter value.
    if (this.getValue() !== value) {
      while (this.next() < value) {}
    }
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * closest possible to the parameter value and then returns this
   * "rounded" value corresponding to the new position.
   * @param value The value to round.
   * @return The new value of the sequence.
   */
  round(value: number): number {
    asserts.assert(value > 0, 'Value must be positive');

    this.position = this.levelLength * pow10Math.ceilExponent(value);
    if (this.getValue() !== value) {
      // If values aren't equal keep decreasing until internal value is
      // equal or lesser than the parameter value.
      while (this.previous() > value) {}
      // Now increase, but if that is further away then decrease again.
      if (value - this.getValue() < this.next() - value) {
        return this.previous();
      }
    }
    return this.getValue();
  }
}
