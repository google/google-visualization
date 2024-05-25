/**
 * @fileoverview
 * Implements a numerical sequence with equally sized steps all the way.
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

import * as util from '../common/util';

import {Sequence} from './sequence';

/**
 * Creates a linear sequence of numbers.
 */
export class LinearSequence extends Sequence {
  /**
   * Current sequence position.
   */
  private position = 0;
  /**
   * @param spacing Distance between values.
   * @param offset Start value. Default is zero.
   */
  constructor(
    private readonly spacing: number,
    private readonly offset = 0,
  ) {
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
   * Returns the size of the next step minus the size of the current position.
   * @return The size of next step.
   */
  getNextSize(): number {
    return this.next() - this.previous();
  }

  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  getValue(): number {
    const result = this.position * this.spacing + this.offset;
    return util.roundToNumSignificantDigits(15, result);
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or less than the parameter value and then returns this "floored"
   * value corresponding to the new position.
   * @param newValue The value to floor.
   * @return The new value of the sequence.
   */
  floor(newValue: number): number {
    this.position = Math.floor((newValue - this.offset) / this.spacing);
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or greater than the parameter value and then returns this "ceiled"
   * value corresponding to the new position.
   * @param newValue The value to ceil.
   * @return The new value of the sequence.
   */
  ceil(newValue: number): number {
    this.position = Math.ceil((newValue - this.offset) / this.spacing);
    return this.getValue();
  }

  /**
   * Sets the sequence's position so that the sequence's value will be
   * closest possible to the parameter value and then returns this "rounded"
   * value corresponding to the new position.
   * @param newValue The value to round.
   * @return The new value of the sequence.
   */
  round(newValue: number): number {
    this.position = Math.round((newValue - this.offset) / this.spacing);
    return this.getValue();
  }
}
