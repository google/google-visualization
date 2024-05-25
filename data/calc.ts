/**
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

import {Values} from './types';

/**
 * Calculates the sum of the input array.
 * For use as an aggregation function with the group interface.
 * @param values An array of numbers.
 * @return The sum of the input array.
 */
export function sum(values: number[]): number {
  let res = 0;
  for (let i = 0; i < values.length; i++) {
    res += values[i];
  }
  return res;
}

/**
 * Calculates the number of items in the input array (including null values and
 * duplicates). The result is identical to the length of the array.
 * For use as an aggregation function with the group interface.
 * @param values An array.
 * @return The count of the items in the input array.
 */
export function count(values: Values): number {
  return values.length;
}

/**
 * Calculates the average of the input array.
 * For use as an aggregation function with the group interface.
 * @param values An array of numbers.
 * @return The average of the input array.
 */
export function avg(values: number[]): number {
  return sum(values) / values.length;
}

/**
 * Calculates the minimum value of the input array. Null values are ignored.
 * For use as an aggregation function with the group interface.
 * @param values An array of values.
 * @return The minimum value of the input array,
 *     or null if the array is empty.
 */
export function min(
  values: Array<number | string | Date>,
): number | string | Date | null {
  if (values.length === 0) {
    return null;
  }

  let min = values[0];
  for (let i = 1; i < values.length; i++) {
    const val = values[i];
    if (val != null && val < min) {
      min = val;
    }
  }

  return min;
}

/**
 * Calculates the maximum value of the input array. Null values are ignored.
 * For use as an aggregation function with the group interface.
 * @param values An array of values.
 * @return The maximum value of the input array,
 *     or null if the array is empty.
 */
export function max(
  values: Array<number | string | Date>,
): number | string | Date | null {
  if (values.length === 0) {
    return null;
  }

  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    const val = values[i];
    if (val != null && val > max) {
      max = val;
    }
  }

  return max;
}

/**
 * Returns the month number (1-12) of the input date.
 * For use as a modifier function with the group interface.
 * @param date A date.
 * @return The month number of the input date.
 */
export function month(date: Date): number {
  return date.getMonth() + 1;
}
