/**
 * Defines methods for ascending sequences.
 *
 * <p>An ascending sequence could be described as an infinite list of ascending
 * numerical values. An ascending sequence has a current position or index but
 * this value is hidden in the internal implementation. What you can do is
 * step forward or backward using the next() or previous() methods. Or you
 * can go to an arbitrary position using the floor(), round() or ceil() methods.
 *
 * <p>To make sense, the implementations of this interface must provide
 * a numerical sequence that is increasing all the way.
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

/**
 * A numeric virtual sequence.
 */
export abstract class Sequence {
  /**
   * Returns the value of the current position of the sequence.
   * @return The current position of the sequence.
   */
  abstract getValue(): number;

  /**
   * Advances one position and returns the new current value.
   * @return The new current value.
   */
  abstract next(): number;

  /**
   * Decreases the sequence's position by 1 and returns the new value.
   * @return The new current value.
   */
  abstract previous(): number;

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or less than the parameter value and then returns this "floored"
   * value corresponding to the new position.
   * @param newValue The value to floor.
   * @return The new value of the sequence.
   */
  abstract floor(newValue: number): number;

  /**
   * Sets the sequence's position so that the sequence's value will be
   * equal or greater than the parameter value and then returns this "ceiled"
   * value corresponding to the new position.
   * @param newValue The value to ceil.
   * @return The new value of the sequence.
   */
  abstract ceil(newValue: number): number;

  /**
   * Sets the sequence's position so that the sequence's value will be
   * closest possible to the parameter value and then returns this "rounded"
   * value corresponding to the new position.
   * @param newValue The value to round.
   * @return The new value of the sequence.
   */
  abstract round(newValue: number): number;

  /**
   * Returns the size of the next step following the current position.
   * @return The size of next step.
   */
  abstract getNextSize(): number;
}
