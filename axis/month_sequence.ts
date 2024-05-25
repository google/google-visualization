/**
 * Steps through time using UTC milliseconds since Jan 1 1970 but using
 * months as the unit to express space between steps and offset.
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

import {LinearSequence} from './linear_sequence';
import {Sequence} from './sequence';

/**
 * Implements a Month sequence
 */
export class MonthSequence extends Sequence {
  /**
   * The number of months between each step.
   */
  private readonly stepSize: number;

  /**
   * Used to floor the years if stepSize is 12 months or more.
   */
  private readonly yearSequence?: LinearSequence = undefined;
  private readonly fullOffset: number;
  private readonly monthStepper: Date;
  /**
   * @param monthsPerStep The number of months between each time
   *     value in this sequence. Must be >= 1 and defaults to 1.
   * @param monthOffset  The month offset within a year. This value
   *     must be an integer between -11 and 11. This class does not support
   *     offsets greater than a year. The idea is that if you want a year
   *     sequence you could just use a LinearSequence since year lengths are not
   *     as irregular as month lengths are. Defaults to 0.
   */
  constructor(monthsPerStep?: number, monthOffset = 0) {
    super();
    if (monthsPerStep != null) {
      assert(monthsPerStep >= 1);
      assert(monthsPerStep === Math.round(monthsPerStep));
      this.stepSize = monthsPerStep;
    } else {
      this.stepSize = 1;
    }

    if (this.stepSize > 12) {
      this.yearSequence = new LinearSequence(Math.floor(this.stepSize / 12));
    }

    assert(monthOffset === Math.round(monthOffset));
    assert(monthOffset >= -11 && monthOffset <= 11);

    /**
     * Offset in full months. May be integer values between -11 and 11
     */
    this.fullOffset = monthOffset;

    /**
     * Date instance used to store the internal time
     */
    this.monthStepper = new Date();
    this.floor(0);
  }

  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  getValue(): number {
    return this.monthStepper.getTime();
  }

  /**
   * Advances one position and returns the new current value.
   * @return The new current value.
   */
  next(): number {
    let month = this.monthStepper.getUTCMonth();
    month += this.stepSize;
    this.monthStepper.setUTCMonth(month);
    return this.getValue();
  }

  /**
   * Decreases the sequence's position by 1 and returns the new value.
   * @return The new current value.
   */
  previous(): number {
    this.monthStepper.setUTCMonth(
      this.monthStepper.getUTCMonth() - this.stepSize,
    );
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
   * Sets the sequence's position so that the sequence's value will be
   * equal or less than the parameter value and then returns this "floored"
   * value corresponding to the new position.
   * @param newValue The value to floor.
   * @return The new value of the sequence.
   */
  floor(newValue: number): number {
    this.monthStepper.setTime(newValue);
    if (this.stepSize > 1) {
      // Find the month delta to floored month.
      const monthDelta =
        ((this.monthStepper.getUTCMonth() + 12 - this.fullOffset) %
          this.stepSize) %
        12;
      this.monthStepper.setUTCMonth(
        this.monthStepper.getUTCMonth() - monthDelta,
      );
      if (this.stepSize > 12) {
        // Floor the year if stepSize is bigger than a year (12 months).
        const year = this.yearSequence!.floor(
          this.monthStepper.getUTCFullYear(),
        );

        this.monthStepper.setUTCFullYear(year);
      }
    }
    // Flatten out everything but months.
    this.monthStepper.setUTCDate(1);
    this.monthStepper.setUTCHours(0, 0, 0, 0);
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or greater than the parameter
   * value and then returns this "ceiled" value corresponding to the
   * new position.
   * @param newValue The value to ceil.
   * @return The new value of the sequence.
   */
  ceil(newValue: number): number {
    if (this.floor(newValue) < newValue) {
      return this.next();
    }
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * closest possible to the parameter value and then returns this
   * "rounded" value corresponding to the new position.
   * @param newValue The value to round.
   * @return The new value of the sequence.
   */
  round(newValue: number): number {
    if (this.floor(newValue) !== newValue) {
      // if the delta of the increased value is larger, decrease it.
      if (newValue - this.getValue() < this.next() - newValue) {
        return this.previous();
      }
    }
    return this.getValue();
  }
}
