/**
 * @fileoverview Mathematical utilities and numeric operations.
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

import { assert } from 'ts-essentials';
import { PRECISION_THRESHOLD } from './basic-utils';

/**
 * Returns an absolute of the mathematical difference of two numbers.
 * @param value1 A value.
 * @param value2 A value.
 * @return The difference.
 */
export function absNumericDiff(value1: number, value2: number): number {
  return Math.abs(value1 - value2);
}

/**
 * Returns whether two numbers are distanced no more than a given threshold.
 * Inspired by closure's assertRoughlyEquals().
 * @param a First number.
 * @param b Second number.
 * @param threshold The threshold. If unspecified, an arbitrary
 *     small value is used.
 * @return Whether the numbers are distanced no more than the given
 *     threshold from one another.
 */
export function roughlyEquals(
  a: number,
  b: number,
  threshold?: number | null,
): boolean {
  // The default has been chosen arbitrarily, and is safe to change if required.
  threshold = threshold != null ? threshold : 0.00001;
  assert(threshold >= 0, 'threshold must be non-negative');
  // The a == b part is there to handle Infinity and -Infinity.
  return a === b || Math.abs(a - b) <= threshold;
}

/**
 * Counts the decimal precision points required for displaying a number.
 * For example:
 *  0.0023 needs 4
 *  1000.1 needs 1
 *  7 needs 0
 *
 * @param num The given number.
 * @return The minimum between the actual number of significant digits
 *     and 16 (javascript does not support more than 16 decimal digits anyway).
 */
export function countRequiredDecimalPrecision(num: number): number {
  if (num === 0) {
    return 0;
  }
  let x = Math.abs(num);
  // TODO(dlaliberte): Avoid looping up to 16 times.
  for (let i = 0; i < 16; ++i) {
    if (Math.abs(x - Math.round(x)) < x * PRECISION_THRESHOLD) {
      return i;
    }
    x = x * 10;
  }
  return 16;
}

/**
 * For a number n, returns the exponent of the biggest power of 10 smaller
 * than n. For n = 0 -Infinity is returned, and for n < 0 NaN is returned.
 * @param value The number for which the exponent will be computed.
 * @return For an int n, returns the largest int m such that n >= 10^m.
 */
export function getExponent(value: number): number {
  return Math.floor(Math.log10(value));
}

/**
 * Rounds a number to a specified significant number of digits.
 * Example: 1200 is considered to have 2 significant digits, so does 1.2
 *     and 0.012.
 *
 * @param numSignificantDigits The number of significant digits to round to.
 * @param value The value to round.
 * @return The value rounded to the specified number of significant digits.
 */
export function roundToNumSignificantDigits(
  numSignificantDigits: number,
  value: number,
): number {
  if (value === 0 || Math.abs(value) < 1e-290) {
    return value;
  }
  assert(numSignificantDigits > 0, 'numSignificantDigits must be > 0');
  assert(
    isFinite(numSignificantDigits),
    'numSignificantDigits must be finite',
  );

  const valueExponent = getExponent(Math.abs(value)) + 1;
  if (valueExponent > numSignificantDigits) {
    const normalizer = Math.pow(10, valueExponent - numSignificantDigits);
    return Math.round(value / normalizer) * normalizer;
  }
  const normalizer = Math.pow(10, numSignificantDigits - valueExponent);
  return Math.round(value * normalizer) / normalizer;
}

/**
 * Scans a list of records, given some numeric target, for the record whose
 * 'compared' numeric value is closest to the target. The 'compared' value is
 * an entry in each record taken from a specific index. Rounds downwards when
 * value is the exact middle of two best options.
 *
 * @param num the number to scan for.
 * @param table The table of records.
 * @param index The index in each record where the compared value can be found.
 *
 * @return The index found.
 */
export function closestValueTo(
  num: number,
  table: number[][],
  index = 0,
): number {
  const i = table.findIndex((record) => record[index] > num);
  if (i === -1) {
    return table.length - 1;
  }
  if (i === 0) {
    return 0;
  }
  // Compare to which value 'number' is closer to, to the one smaller than it or
  // the one larger than it.
  return table[i][index] - num < num - table[i - 1][index] ? i : i - 1;
}

/**
 * Extends closestValueTo to cover to an infinite range. Does so by
 * extrapolating the table to the positive infinity, filling in sections
 * larger than table maximum with cyclic repeating ranges.
 * The ranges repeating themselves are simply the last few sub intervals
 * between the last few values of the original (finite) table.
 * Eg: [0, 10, 12, 20] can be extended to [0, 10, 12, 20, 22, 30, 32, 40...] by
 * specifying numOfSubIntervals = 2 (so [10, 12] and [12, 20] are repeated)
 * or [0, 10, 12] is extended to [0, 10, 12, 14, 16..] by specifying 1.
 * Does not extrapolate values towards the negative infinite, for values smaller
 * than table minimum, returns zero.
 *
 * @param target the number to scan for.
 * @param table The table of records in the infinite repetition.
 * @param numOfRepeatingSubIntervals number of intervals that will
 *     participate in the infinite repetitive cycle. Default is no repetition.
 * @param index The index in each record where the compared value can be found.
 * @return A tuple of two values, the first is the virtual
 *     index of the closest tick, the second is the value of that tick.
 * @see closestValueTo.
 */
export function extrapolatedClosestValueTo(
  target: number,
  table: number[][],
  numOfRepeatingSubIntervals = 0,
  index = 0,
): number[] {
  if (table.length === 0) {
    return [0, target]; // Return target as-is for empty table
  }

  if (table.length > 0) {
    // Get the last number of table. Use index of peek.
    const last = table[table.length - 1][index];
    if (target <= last) {
      const closest = closestValueTo(target, table, index);
      return [closest, table[closest][index]];
    }
  }

  // Value is from real table, do some calculations to compute extended table
  // Sketch of what's going on here (with, say length 5, and 2 repeating sub
  // intervals, A and B)
  // |<----Real table------>|<---Extended (with virtual indices)...
  // | :        :   |AAAA:BB|aaaa:bb|aaaa:bb|aaaa:bb| ...
  // 0 1        2   3    4  5    6  7    8  9    10 11...

  const firstParticipatingIndex = table.length - 1 - numOfRepeatingSubIntervals;
  const highestValueInTable = table[table.length - 1][index];
  const lowestValueInRepeatingInterval = table[firstParticipatingIndex][index];
  const totalRepeatingInterval =
    highestValueInTable - lowestValueInRepeatingInterval;
  const numberOfIntervalsToExtend = Math.floor(
    (target - highestValueInTable) / totalRepeatingInterval,
  );
  // Found number of intervals to extend, now find number of extra sub intervals
  // by looking at the residue of target from a tick of whole intervals
  const actualResidue =
    target -
    highestValueInTable -
    numberOfIntervalsToExtend * totalRepeatingInterval;
  const possibleResidueTable = table
    .slice(firstParticipatingIndex)
    .map((value) => [value[index] - lowestValueInRepeatingInterval]);
  const closestResidueIndex = closestValueTo(
    actualResidue,
    possibleResidueTable,
    0,
  );
  const indexInExtrapoledTableOfRoundedTarget =
    table.length -
    1 +
    numberOfIntervalsToExtend * numOfRepeatingSubIntervals +
    closestResidueIndex;
  const roundedTarget =
    highestValueInTable +
    numberOfIntervalsToExtend * totalRepeatingInterval +
    possibleResidueTable[closestResidueIndex][0];
  return [indexInExtrapoledTableOfRoundedTarget, roundedTarget];
}

/**
 * Given a sorted array of numeric values and a target value, returns the value
 * from the array that is closest to the target value.
 * Note that the array must be sorted in ascending order.
 * @param arr An array of numeric values.
 * @param val The target value.
 * @return The numeric value that is closest to the target value.
 */
export function findClosestValue(arr: number[], val: number): number {
  assert(arr.length > 0, 'Array cannot be empty');

  let i = binarySearchNumbers(arr, val);
  if (i >= 0) {
    // Target value is present in the array.
    return val;
  }
  // See documentation of binary search
  i = -(i + 1);

  if (i === 0) {
    return arr[0];
  }
  if (i === arr.length) {
    return arr[arr.length - 1];
  }

  // Target value is in range [a, b]. Return the closer of the two.
  const a = arr[i - 1];
  const b = arr[i];
  return Math.abs(val - a) <= Math.abs(val - b) ? a : b;
}

/**
 * Binary search for numbers (specialized version)
 */
function binarySearchNumbers(arr: number[], target: number): number {
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const midVal = arr[mid];

    if (midVal === target) return mid;
    if (target < midVal) right = mid - 1;
    else left = mid + 1;
  }

  return -(left + 1); // Return insertion point as negative
}


/**
 * Clamps a number between a minimum and maximum value.
 * @param value The value to clamp.
 * @param min The minimum value.
 * @param max The maximum value.
 * @return The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  assert(min <= max, 'min must be less than or equal to max');
  return Math.min(Math.max(value, min), max);
}

/**
 * Linearly interpolates between two values.
 * @param a The start value.
 * @param b The end value.
 * @param t The interpolation factor (0-1).
 * @return The interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Maps a value from one range to another.
 * @param value The value to map.
 * @param fromMin The minimum of the source range.
 * @param fromMax The maximum of the source range.
 * @param toMin The minimum of the target range.
 * @param toMax The maximum of the target range.
 * @return The mapped value.
 */
export function mapRange(
  value: number,
  fromMin: number,
  fromMax: number,
  toMin: number,
  toMax: number,
): number {
  const fromRange = fromMax - fromMin;
  const toRange = toMax - toMin;

  if (fromRange === 0) {
    return toMin;
  }

  return toMin + ((value - fromMin) * toRange) / fromRange;
}

/**
 * Checks if a number is within a specified range (inclusive).
 * @param value The value to check.
 * @param min The minimum value.
 * @param max The maximum value.
 * @return True if the value is within the range.
 */
export function inRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Converts degrees to radians.
 * @param degrees The angle in degrees.
 * @return The angle in radians.
 */
export function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Converts radians to degrees.
 * @param radians The angle in radians.
 * @return The angle in degrees.
 */
export function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
