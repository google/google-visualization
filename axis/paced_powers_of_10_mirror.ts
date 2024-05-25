/**
 * @fileoverview Represents a numerical sequence based on powers of 10 but with
 * linearly interpolated values in between these values.
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

import * as pow10Math from './pow_10_math';
import {Sequence} from './sequence';

/**
 * The *most important feature* of a pacedPowersOf10Mirror compared to a
 * pacedPowersOf10 sequence is that this sequence has a minimum data value so
 * that when values are decreased below this value they are "mirrored" onto a
 * identical but negative pacedPowersOf10 sequence.
 *
 * The round, floor and ceil methods *may take negative values* as parameter.
 *
 * With a minimumValue of 0.1 and the numSteps 5,
 * increasing stepwise from -10 to +10 would give the following sequence:
 *
 * -10, -8, -6, -4, -2, -1, -0.8, -0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6,
 * 0.8, 1, 2, 4, 6, 8, 10
 */
export class PacedPowersOf10Mirror extends Sequence {
  private readonly numExcluded: number;
  private readonly actualNumSteps: number;

  /**
   * The internal position of the sequence. This value is mapped to the
   * position property in the getValue method.
   */
  private location = 0;
  private readonly minExponent: number;
  private readonly zeroOffset: number;

  private position = 0;

  /**
   * Creates a PacedPowersOf10Mirror instance. Values lesser or equal to
   * minimumValue will be treated as zero.
   * @param numSteps Number of steps to divide each power of ten with.
   * @param minimumValue Values less than this are considered zero.
   */
  constructor(
    private readonly numSteps: number,
    minimumValue: number,
  ) {
    super();

    /**
     * The number of steps whose values would be less than or equal to the
     * preceding power of 10.
     *
     * If `numSteps` is 10, the first value between 1 and 10 would be 1. But 1
     * is a power of 10 so this means `numExcluded` will be 1. If `numSteps`is
     * 20, the first two values between 1 and 10 would be 0.5 and 1 and
     * `numExcluded` will be 2. and so on.
     */
    this.numExcluded = Math.floor(numSteps / 10);

    /**
     * The value of `numSteps` minus `numExcluded`.
     */
    this.actualNumSteps = numSteps - this.numExcluded;

    /**
     * The order of magnitude of the minimum absolute value.
     */
    this.minExponent = pow10Math.floorExponent(Math.abs(minimumValue));

    /**
     * Location's zero offset.
     */
    this.zeroOffset = this.actualNumSteps * this.minExponent;
  }

  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  private getValueInternal(): number {
    const k = Math.floor(this.position / this.actualNumSteps);
    let i =
      (10 * (this.position + this.numExcluded - k * this.actualNumSteps)) /
      this.numSteps;
    if (i === 0) {
      i = 1;
    }
    // Have to call pow10Math to fix computer math's weird number handling
    // where 6 * Math.pow(10, -1) =  0.6000000000000001 instead of 0.6 etc.
    return pow10Math.exactScientific(i, k);
  }

  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  getValue(): number {
    this.position = Math.abs(this.location) + this.zeroOffset;
    if (this.location > 0) {
      return this.getValueInternal();
    } else if (this.location < 0) {
      return -this.getValueInternal();
    }
    return 0;
  }

  /**
   * Advances one position and returns the new current value.
   * @return The new current value.
   */
  next(): number {
    this.location++;
    return this.getValue();
  }

  /**
   * Decreases the sequence's position by 1 and returns the new value.
   * @return The new current value.
   */
  previous(): number {
    this.location--;
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or less than the parameter
   * value and then returns this "floored" value corresponding to the
   * new position.
   * @param newValue The value to floor.
   * @return The new value of the sequence.
   */
  floor(newValue: number): number {
    let excludedOffset = this.numExcluded;
    let tmp = pow10Math.floorExponent(Math.abs(newValue));

    // Compare newValue with minimum value.
    if (Math.abs(newValue) <= Math.pow(10, this.minExponent)) {
      // Inside zero space.
      this.location = newValue < 0 ? -1 : 0;
      return this.getValue();
    } else if (newValue > 0) {
      // Above zero.
      this.location = this.actualNumSteps * tmp - this.zeroOffset;
    } else if (newValue < 0) {
      // Below zero.
      this.location = this.zeroOffset - this.actualNumSteps * tmp;
      excludedOffset = -excludedOffset;
    }

    if (this.getValue() !== newValue) {
      // Find the location between powers of 10.
      tmp = (this.numSteps * newValue) / pow10Math.ceil(Math.abs(newValue));
      this.location += Math.floor(tmp) - excludedOffset;
    }
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or greater than the parameter
   * value and then returns this "ceiled" value corresponding to the
   * new position.
   *
   * @param newValue The value to ceil.
   * @return The new value of the sequence.
   */
  ceil(newValue: number): number {
    let excludedOffset = this.numExcluded;
    let tmp = pow10Math.floorExponent(Math.abs(newValue));
    // Compare newValue with minimum value (Math.pow(10, minExponent)).
    if (Math.abs(newValue) <= Math.pow(10, this.minExponent)) {
      // Inside zero space.
      this.location = newValue > 0 ? 1 : 0;
      return this.getValue();
    } else if (newValue > 0) {
      // Above zero.
      this.location = this.actualNumSteps * tmp - this.zeroOffset;
    } else if (newValue < 0) {
      // Below zero.
      this.location = this.zeroOffset - this.actualNumSteps * tmp;
      excludedOffset = -excludedOffset;
    }
    if (this.getValue() !== newValue) {
      // Find the location between powers of 10.
      tmp = (this.numSteps * newValue) / pow10Math.ceil(Math.abs(newValue));
      this.location += Math.ceil(tmp) - excludedOffset;
    }
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
    let tmp = pow10Math.floorExponent(Math.abs(newValue));
    // Compare newValue with minimum value (Math.pow(10, minExponent)).
    if (Math.abs(newValue) <= Math.pow(10, this.minExponent)) {
      // Inside zero space. Just round anything to zero here.
      this.location = 0;
      return 0;
    } else if (newValue > 0) {
      // Above zero.
      this.location = this.actualNumSteps * tmp - this.zeroOffset;
      // Doing this to make round(2.9999) be 1 and not 5.
      if (this.next() > newValue) {
        if (newValue - this.getValue() >= this.previous() - newValue) {
          return this.next();
        }
        return this.getValue();
      } else {
        this.previous();
      }
    } else if (newValue < 0) {
      // Below zero.
      this.location = this.zeroOffset - this.actualNumSteps * tmp;
      // Doing this to make round(-2.9999) be -1 and not -5.
      if (this.previous() < newValue) {
        if (newValue - this.getValue() < this.next() - newValue) {
          return this.previous();
        }
        return this.getValue();
      } else {
        this.next();
      }
    }
    if (this.getValue() !== newValue) {
      // Find the location between powers of 10.
      tmp = (this.numSteps * newValue) / pow10Math.ceil(Math.abs(newValue));
      this.location += Math.round(tmp) - this.numExcluded;
    }
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
