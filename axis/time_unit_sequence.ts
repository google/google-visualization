/**
 * @fileoverview
 * Steps through time units expressed as milliseconds. The values for any
 * time unit with the length of a month or longer are approximations since
 * these vary in length.
 *
 * <p>The core time units this class uses are second,
 * minute, hour, day, week, month, quarter and year. Beyond that you get
 * decade, century, 1000 years and so on. If you go below second you get
 * tenth of a second, hundredth of a second, millisecond and so on.
 *
 * TODO(dlaliberte): Consider breaking up and simplify this class.
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

import {CustomPowersOf10} from './custom_powers_of_10';
import {
  DAY,
  HOUR,
  MINUTE,
  MONTH,
  QUARTER,
  SECOND,
  WEEK,
  YEAR,
} from './milliseconds';
import {PowersOf10Sequence} from './powers_of_10_sequence';
import {Sequence} from './sequence';

enum Phase {
  BELOW = 1,
  SMALLEST = 2,
  LARGEST = 3,
  ABOVE = 4,
}

/**
 * Creates a time unit sequence.
 */
export class TimeUnitSequence extends Sequence {
  private readonly sequence: Sequence;

  /**
   * Ordered time units.
   */
  private readonly definedUnits: number[];
  private readonly minUnitValue: number;
  private readonly precedingValue: number;
  private readonly precedingCutoff: number;
  private readonly maxUnitValue: number;
  private readonly succeedingValue: number;
  private readonly succeedingCutoff: number;

  /**
   * Internal position of the sequence.
   */
  private position = 0;

  /**
   * The current multiplier of time unit, if using sequence.
   * For instance, 100 years.
   */
  private multiplier = 1;

  /**
   * True if in a mode where changing multiplier instead of time units.
   * For instance 10 -> 100 years instead of week -> month.
   */
  private usingSequence = false;

  /**
   * @param granular Using granular sequence if true.
   */
  constructor(granular?: boolean) {
    super();
    if (granular) {
      this.definedUnits = [
        SECOND,
        SECOND * 5,
        SECOND * 10,
        SECOND * 15,
        SECOND * 30,
        MINUTE,
        MINUTE * 5,
        MINUTE * 10,
        MINUTE * 15,
        MINUTE * 30,
        HOUR,
        HOUR * 3,
        HOUR * 6,
        HOUR * 12,
        DAY,
        WEEK,
        MONTH,
        QUARTER,
        YEAR,
      ];
      this.sequence = new CustomPowersOf10([1, 2, 5]);
    } else {
      this.definedUnits = [
        SECOND,
        MINUTE,
        HOUR,
        DAY,
        WEEK,
        MONTH,
        QUARTER,
        YEAR,
      ];
      this.sequence = new PowersOf10Sequence();
    }

    /**
     * The smallest defined time unit.
     */
    this.minUnitValue = this.sequence.round(this.definedUnits[0]);

    /**
     * The time unit before the defined time unit sequence starts.
     */
    this.precedingValue = this.sequence.previous();

    /**
     * Values below this are in the phase BELOW.
     */
    this.precedingCutoff =
      this.precedingValue + (this.minUnitValue - this.precedingValue) / 2;

    /**
     * The largest defined time unit.
     */
    this.maxUnitValue = this.definedUnits[this.definedUnits.length - 1];
    this.sequence.round(1);

    /**
     * The time unit after the defined time unit sequence ends.
     */
    this.succeedingValue = this.maxUnitValue * this.sequence.next();

    /**
     * Values above this are in the phase ABOVE.
     */
    this.succeedingCutoff =
      this.maxUnitValue + (this.succeedingValue - this.maxUnitValue) / 2;
    this.shiftPhase(Phase.SMALLEST);
  }

  /**
   * Shifts between using the sequence for unit values less than the
   * smallest defined unit or unit values greater than the largest defined
   * unit or using the units listed in the definedUnits array.
   * @param phase The phase.
   */
  private shiftPhase(phase: Phase) {
    this.usingSequence = phase === Phase.BELOW || phase === Phase.ABOVE;
    if (phase === Phase.SMALLEST) {
      this.position = 0;
    } else if (phase === Phase.LARGEST) {
      this.position = this.definedUnits.length - 1;
    } else if (phase === Phase.BELOW) {
      this.multiplier = 1;
    } else if (phase === Phase.ABOVE) {
      this.multiplier = this.maxUnitValue;
    }
  }

  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  getValue(): number {
    if (this.usingSequence) {
      return this.multiplier * this.sequence.getValue();
    }
    return this.definedUnits[this.position];
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
    if (newValue < this.minUnitValue) {
      this.shiftPhase(Phase.BELOW);
      return this.sequence.floor(newValue);
    } else if (newValue >= this.succeedingValue) {
      this.shiftPhase(Phase.ABOVE);
      return this.multiplier * this.sequence.floor(newValue / this.multiplier);
    } else {
      this.shiftPhase(Phase.SMALLEST);
      // Increase until newValue is equal or greater than a defined unit.
      while (newValue >= this.definedUnits[this.position]) {
        this.position++;
      }
      return this.definedUnits[--this.position];
    }
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
    if (newValue <= this.precedingValue) {
      this.shiftPhase(Phase.BELOW);
      return this.sequence.ceil(newValue);
    } else if (newValue > this.maxUnitValue) {
      this.shiftPhase(Phase.ABOVE);
      return this.multiplier * this.sequence.ceil(newValue / this.multiplier);
    } else {
      this.shiftPhase(Phase.LARGEST);
      // Decrease until newValue is equal or less than a defined unit.
      while (newValue <= this.definedUnits[this.position]) {
        this.position--;
      }
      return this.definedUnits[++this.position];
    }
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * closest possible to the parameter value and then returns this
   * "rounded" value corresponding to the new position.
   * @param newValue The value to round.
   * @return The new value of the sequence.
   */
  round(newValue: number): number {
    if (newValue < this.precedingCutoff) {
      this.shiftPhase(Phase.BELOW);
      return this.sequence.round(newValue);
    } else if (newValue >= this.succeedingCutoff) {
      this.shiftPhase(Phase.ABOVE);
      return this.multiplier * this.sequence.round(newValue / this.multiplier);
    } else {
      this.shiftPhase(Phase.LARGEST);
      // Decrease until newValue is equal or greater than a defined unit.
      while (this.position > 0 && newValue < this.definedUnits[this.position]) {
        this.position--;
      }
      // Adjust position according to deltas.
      if (
        this.definedUnits[this.position + 1] - newValue <=
        newValue - this.definedUnits[this.position]
      ) {
        this.position++;
      }
      return this.definedUnits[this.position];
    }
  }

  /**
   * Advances one position and returns the new current value.
   * @return The new current value.
   */
  next(): number {
    if (this.usingSequence) {
      this.sequence.next();
      if (
        this.multiplier === 1 &&
        this.sequence.getValue() === this.minUnitValue
      ) {
        this.shiftPhase(Phase.SMALLEST);
      }
    } else {
      this.position++;
      if (this.position === this.definedUnits.length) {
        this.shiftPhase(Phase.ABOVE);
        this.sequence.round(1);
        this.sequence.next();
      }
    }
    return this.getValue();
  }

  /**
   * Decreases the sequence's position by 1 and returns the new value.
   * @return The new current value.
   */
  previous(): number {
    if (this.usingSequence) {
      this.sequence.previous();
      if (
        this.multiplier === this.maxUnitValue &&
        this.sequence.getValue() === 1
      ) {
        this.shiftPhase(Phase.LARGEST);
      }
    } else {
      this.position--;
      if (this.position === -1) {
        this.shiftPhase(Phase.BELOW);
        this.sequence.round(this.minUnitValue);
        this.sequence.previous();
      }
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
