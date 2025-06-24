/**
 * @fileoverview Global utilities for charting (singleton).
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

// This file is mostly obsolete, since it is replaced by several other *-utils.ts

// Looking at the remaining functions in `common/util.ts`,
// here are the ones that haven't been moved to other utility files yet:

// ## Search/Lookup Functions:
// - `closestValueTo`
// - `extrapolatedClosestValueTo`
// - `findClosestValue`

// ## Range/Box Functions:
// - `extendRangeToInclude`
// - `getOverriddenRange`
// - `calcBoundingBox`
// - `RangeCompat` class

// ## Array Merging:
// - `mergeArrays`

// ## Numeric/Math Functions:
// - `roughlyEquals`
// - `countRequiredDecimalPrecision`
// - `getExponent`
// - `roundToNumSignificantDigits`

// ## Algorithm Functions:
// - `calcEditDistance` and related helpers
// - `fillFirstNBuckets`
// - `fillCommunicatingVessels`
// - `distributeRealEstate`
// - `distributeRealEstateWithKeys`

// ## Utility Functions:
// - `rangeMap`
// - `getPieChartColorMapping`
// - `arrayMultiSlice`
// - `containsNoOtherProperties`
// - `concatSuffix`

// These could be organized into files like:
// - `common/search-utils.ts` (search/lookup functions)
// - `common/range-utils.ts` (range and box utilities)
// - `common/merge-utils.ts` (array merging)
// - `common/math-utils.ts` (numeric/precision functions)
// - `common/algorithm-utils.ts` (complex algorithms like edit distance, bucket filling)
// - `common/misc-utils.ts` (remaining utility functions)

// Which category would you like to tackle first?

import { assert, NonEmptyArray } from 'ts-essentials';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';
import { identity } from 'fp-ts/function';

// Vector math utilities from Three.js
import { Vector2, Vector3, Box2, Box3, Line3 } from 'three';

// tslint:disable:no-unnecessary-type-assertion Migration
// tslint:disable:restrict-plus-operands Migration
// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

// Like Coordinate
interface XYPair {
  readonly x: number;
  readonly y: number;
}


// More specific types for better type safety
type NumericArray = NonEmptyArray<number>;
type CompareFunction = <T>(p1: T, p2: T) => number;

// Replace Vec2 with Three.js Vector2, but keep compatibility
type Vec2 = Vector2;
type Coordinate = Vector2;
// type Range = { start: number; end: number };
type Box = Box2;
type Line = Line3;

// Compatibility adapters for math utilities
export class RangeCompat {
  constructor(public start: number, public end: number) {}

  static boundingRange(range1: RangeCompat, range2: RangeCompat): RangeCompat {
    return new RangeCompat(
      Math.min(range1.start, range2.start),
      Math.max(range1.end, range2.end)
    );
  }

  clone(): RangeCompat {
    return new RangeCompat(this.start, this.end);
  }
}

/**
 * String of zero digits used for number-to-string padding
 */
export const STRING_ZEROES = '0000000000000000';

/**
 * A very small number that numbers whose absolute value is smaller than are
 * considered zero when converted to string. Two numbers whose distance to each
 * other is less than this number are most likely to be converted to the same
 * string.
 */
export const PRECISION_THRESHOLD = 0.000000000000001;

/**
 * Converts the string to a number, or to null if it is an empty string or null.
 * @param str The string number to convert, or null.
 */
export function numberOrNull(str: string | null): number | null {
  return str == null || str === '' ? null : Number(str);
}

/**
 * Removes the first element of an array. A convenience function.
 * @param array The array.
 * @return A copy of the array without its first element.
 */
export function removeFirstElement<T>(array: NonEmptyArray<T>): T[] {
  return array.slice(1);
}

/**
 * Removes the last element of an array. A convenience function.
 * @param array The array.
 * @return The array without its last element.
 */
export function removeLastElement<T>(array: NonEmptyArray<T>): T[] {
  return array.slice(0, array.length - 1);
}

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
 * Returns true iff both arrays have the same length, and for each index, the
 * two elements in this index are at most 'tolerance' different from each other.
 * @param a1 An array.
 * @param a2 An array.
 * @param tolerance The maximum allowed difference.
 * @param diffFunc A function that
 *     takes two elements of the input objects and return the numeric "diff"
 *     between them. If not provided, defaults to absNumericDiff which assumes
 *     both elements are numbers and returns the absolute of the mathematical
 *     difference between them.
 * @return See above.
 */
export function arraysAlmostEqual<T>(
  a1: T[] | null,
  a2: T[] | null,
  tolerance: number,
  diffFunc?: CompareFunction,
): boolean {
  if (!a1 && !a2) {
    return true;
  }
  if (!a1 || !a2) {
    return false;
  }
  if (a1.length !== a2.length) {
    return false;
  }
  const diff = diffFunc || (absNumericDiff as CompareFunction);
  return a1.every((obj, i) => diff(a1[i], a2[i]) <= tolerance);
}

/**
 * Returns true iff for each key the exists in both objects, the two values for
 * this key are at most 'tolerance' different from each other.
 * @param obj1 An object.
 * @param obj2 An object.
 * @param tolerance The maximum allowed difference.
 * @param diffFunc A function that takes two elements of the input objects
 *     and return the numeric "diff" between them.
 *     If not provided, defaults to absNumericDiff which assumes
 *     both elements are numbers and returns the absolute of the mathematical
 *     difference between them.
 * @return See above.
 */
export function objectsAlmostEqual<T extends Record<string, any>>(
  obj1: T | null,
  obj2: T | null,
  tolerance: number,
  diffFunc?: CompareFunction,
): boolean {
  if (!obj1 || !obj2) {
    return true;
  }
  const diff = diffFunc || (absNumericDiff as CompareFunction);
  return Object.entries(obj1).every(([key, value1]) => {
    const value2 = obj2[key];
    return obj2[key] === undefined || diff(value1, value2) <= tolerance;
  });
}

/**
 * Returns object[key] after ensuring it's initialized (initializes it if not).
 * In other words, this function first checks if object[key] is initialized
 * (defined and not null) and if not, initializes to the given default value.
 * Then it returns the existing object[key].
 * @param object The object or array.
 * @param key The key.
 * @param defaultValue The value to initialize object[key] if not initialized.
 * @return The value of object[key] after ensuring it's initialized.
 */
export function getKeyEnsureDefault(
  object: AnyDuringMigration | AnyDuringMigration[],
  key: string | number,
  defaultValue: AnyDuringMigration,
): AnyDuringMigration {
  if (object[key] == null) {
    object[key] = defaultValue;
  }
  return object[key];
}

/**
 * A function calculating for every point, the fitted curve's tangent at that
 * point assuming the curve is a function. Returns a tangent whose slope is the
 * average of the two slopes and whose length is adjusted so its x value is one
 * third of the smaller x values of the two vectors times smoothing factor.
 * Is used internally by calculateControlPoints.
 * @see calculateControlPoints
 * @param vectorFromPrevious The vector leading from previous point to this one.
 * @param vectorToNext The vector leading from this point to next one.
 * @param smoothingFactor The smoothing factor (0 means straight lines,
 *     1 means smooth).
 * @return The calculated tangent.
 */
export function functionTangentCalculator(
  vectorFromPrevious: XYPair,
  vectorToNext: XYPair,
  smoothingFactor: number,
): XYPair {
  // Edge cases, value of tangent in these cases is the limit of normal cases,
  // when values in the denominator tend to zero.
  if (vectorFromPrevious.x === 0 || vectorToNext.x === 0) {
    let dy;
    if (vectorFromPrevious.x === 0 && vectorToNext.x === 0) {
      dy = 0;
    } else if (vectorFromPrevious.x === 0) {
      dy = vectorFromPrevious.y;
    } else {
      dy = vectorToNext.y;
    }
    return {x: 0, y: (dy * smoothingFactor) / 6};
  }
  // When smoothing factor is 1, dx is exactly one third of the smaller of
  // two vectors' x value. Slope is simply the average of the two slopes.
  const dx =
    (smoothingFactor / 3) *
    Math.min(Math.abs(vectorFromPrevious.x), Math.abs(vectorToNext.x));
  const slope =
    (vectorFromPrevious.y / vectorFromPrevious.x +
      vectorToNext.y / vectorToNext.x) /
    2;
  // Directionality can be deduced by any of the two vectors' x value.
  if (vectorFromPrevious.x > 0) {
    return {x: dx, y: dx * slope};
  } else {
    return {x: -dx, y: -dx * slope};
  }
}

/**
 * A function calculating for every point, the fitted curve's tangent at that
 * point assuming the curve is a phase graph. Returns a tangent laying on the
 * bisection of the rays on which the two vectors lay, its magnitude being the
 * geometric average of the two magnitudes.
 * Is used internally by calculateControlPoints.
 * @see calculateControlPoints
 * @param vectorFromPrevious The vector leading from previous point to this one.
 * @param vectorToNext The vector leading from this point to next one.
 * @param smoothingFactor The smoothing factor (0 means straight lines,
 *     1 means smooth).
 * @return The calculated tangent.
 */
export function phaseTangentCalculator(
  vectorFromPrevious: Vec2,
  vectorToNext: Vec2,
  smoothingFactor: number,
): Vec2 {
  const magnitudeFromPrevious = vectorFromPrevious.length();
  const magnitudeToNext = vectorToNext.length();
  if (magnitudeFromPrevious === 0 || magnitudeToNext === 0) {
    return new Vector2(0, 0);
  } else {
    // Tangent = (sf / 3) * sqrt(|v1| * |v2|) * (v1 / |v1| + v2 / |v2|) / 2
    // = (sf / 6) * (v1 * sqrt(|v2| / |v1|) + v2 * sqrt(|v1| / |v2|))
    // (where sf is smoothingFactor)
    const srqtRatio = Math.sqrt(magnitudeFromPrevious / magnitudeToNext);
    const vectorSum = vec2Sum(
      vectorFromPrevious.clone().multiplyScalar(1 / srqtRatio),
      vectorToNext.clone().multiplyScalar(srqtRatio),
    );
    vectorSum.multiplyScalar(smoothingFactor / 6);
    return vectorSum;
  }
}

/**
 * Compute the control points of a Bezier curve running through a given sequence
 * of points. Return for every point in the sequence, two control points - one
 * Appearing before it and one after it in the Bezier sequence.
 *
 * @param points Input sequence of points.
 * @param smoothingFactor a number between 0 and 1 describing how
 *     smooth the line should be. 0 means completely straight lines connecting
 *     the dots, 1 means pretty smooth (a more formal definition is beyond the
 *     scope of this comment).
 * @param isFunction A flag controlling whether the dots represent a
 *     function whose fitted curve must also represent a function. Points must
 *     be sorted by x value (ascending or descending) for this option to
 *     function properly.
 * @param isClosed A flag controlling whether the fitted curve should
 *     be a closed one. Naturally, cannot be used when isFunction is true.
 * @param interpolateNulls A flag controlling whether the fitted
 *     curve should 'jump' over null values as if they were not there and
 *     interpolate through them (default=false).
 * @return An array of pairs of
 *     control points (first is for section before point, second is for the one
 *     after).
 * @suppress {checkTypes}
 */
export function calculateControlPoints(
  points: Vec2[],
  smoothingFactor: number,
  isFunction: boolean,
  isClosed: boolean,
  interpolateNulls: boolean,
): Array<Vec2[] | null> {
  // A function calculating for every point, the fitted curve's tangent at that
  // point.
  const tangentCalculator = isFunction
    ? functionTangentCalculator
    : phaseTangentCalculator;
  // Iterate all points and calculate surrounding control points using the
  // above method to calculate the tangent at each point according to the
  // curve type.
  const result: Array<Vec2[] | null> = [];
  for (let i = 0; i < points.length; ++i) {
    let nextIndex;
    let previousIndex;
    if (interpolateNulls) {
      nextIndex = nextNonNull(points, i, 1, isClosed);
      previousIndex = nextNonNull(points, i, -1, isClosed);
    } else {
      nextIndex = isClosed ? (i + 1) % points.length : i + 1;
      previousIndex = isClosed
        ? (points.length + i - 1) % points.length
        : i - 1;
    }
    if (
      nextIndex != null &&
      previousIndex != null &&
      points[i] != null &&
      points[previousIndex] != null &&
      points[nextIndex] != null
    ) {
      const tangent = tangentCalculator(
        vec2Difference(points[i], points[previousIndex]),
        vec2Difference(points[nextIndex], points[i]),
        smoothingFactor,
      ) as Coordinate;
      result.push([
        vec2Difference(points[i], tangent),
        vec2Sum(points[i], tangent),
      ]);
    } else if (points[i] != null) {
      result.push([points[i].clone(), points[i].clone()]);
    } else {
      result.push(null);
    }
  }
  return result;
}

// Vector2 extensions for compatibility
export function createVec2(x: number, y: number): Vector2 {
  return new Vector2(x, y);
}

export function vec2Difference(v1: Vector2, v2: Vector2): Vector2 {
  return v1.clone().sub(v2);
}

export function vec2Sum(v1: Vector2, v2: Vector2): Vector2 {
  return v1.clone().add(v2);
}

/**
 * Iterate over an array, starting from a given index and in a given direction,
 * search for a the first non null value whose index is greater (or smaller,
 * depends on direction) than the given index. Also supports cyclic behaviour.
 * @param array The array.
 * @param index The index to start from.
 * @param direction The direction to traverse the array (+1 or -1).
 * @param isCircular If set to true the array is treated as circular.
 * @return The index found or null if none was found.
 */
export function nextNonNull(
  array: Vec2[],
  index: number,
  direction: number,
  isCircular: boolean,
): number | null {
  let result = index + direction;
  if (isCircular) {
    result = (result + array.length) % array.length;
  }
  while (result !== index && result >= 0 && result < array.length) {
    if (array[result] != null) {
      return result;
    }
    result = result + direction;
    if (isCircular) {
      result = (result + array.length) % array.length;
    }
  }
  return null;
}

/**
 * Scans a list of records, given some numeric target, for the record who's
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
  target: number, //
  table: number[][], //
  numOfRepeatingSubIntervals = 0, //
  index = 0,
): number[] {
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
 * Traverses a range of numbers (zero to some number exclusive) and calls a
 * given function for every number in the range and returns an array of the
 * ordered results.
 * Similar to goog.array.map over and array [0, 1, 2, ..., (length - 1)].
 * @see {goog.array.map}
 * @param length The number of elements to traverse.
 * @param f The function to be called for every index in
 *     the range. The function should expect the index as its sole argument.
 * @param obj The object to be used as the value of 'this' within f.
 * @return An array of the results of invoking f on the indices.
 */
export function rangeMap<T>(
  length: number,
  f: (p1: number) => T,
  obj?: AnyDuringMigration,
): T[] {
  const res: T[] = [];
  for (let i = 0; i < length; i++) {
    res[i] = f.call(obj, i);
  }
  return res;
}

/**
 * Extends a given color palatte to be large enough to color the slices of a pie
 * chart by reusing colors. If there are more than two colors in the palatte, it
 * guarantees no two subsequent slices share the same color, including the first
 * and the last slice, trying to keep colors ordered in the original ordering as
 * much as possible while doing so.
 *
 * The exact algorithm is:
 * <ul>
 *   <li> If there are less slices than colors, use original palette.
 *   <li> If there are less than three colors, simply wrap the given colors as
 *   needed.
 *   <li> Otherwise, Wrap color sequence around pie a whole number of times as
 *   long as possible.
 *   <li> The residue is then colored using a sequence of colors taken from
 *   the center of the palette, so the middle color of the residue is the middle
 *   color of the palette.
 *
 * @param numberOfColors Number of available colors.
 * @param numberOfSlices Number of slices in the pie chart.
 * @return A function mapping from slice index to color index.
 */
export function getPieChartColorMapping(
  numberOfColors: number,
  numberOfSlices: number,
): (p1: number) => number {
  if (numberOfColors >= numberOfSlices) {
    // The identity mapping is perfect when there are enough colors.
    return (sliceIndex) => sliceIndex;
  }
  if (numberOfColors <= 2) {
    // No index satisfies constraint, use trivial wrap around mapping
    return (sliceIndex) => sliceIndex % numberOfColors;
  }
  const residue = numberOfSlices % numberOfColors;
  const residueSequenceOffset = Math.floor((numberOfColors - residue) / 2);
  const firstSliceOfResidue = numberOfSlices - residue;
  return (sliceIndex) => {
    if (sliceIndex < firstSliceOfResidue) {
      return sliceIndex % numberOfColors;
    }
    return (sliceIndex + residueSequenceOffset) % numberOfColors;
  };
}

/**
 * A utility function that returns the 'max' field of an object if exists, and
 * returns the 'min' field if 'max' doesn't exist.
 * @param object The object.
 * @return As described above.
 */
function getMaxOrMin(object: AnyDuringMigration): number {
  return object.max != null ? object.max : object.min;
}

/**
 * Represents a set of buckets.
 *
 * 'num' is the number of buckets that were successfully filled,
 * either completely or partially.
 *
 * 'last' is the amount filled in the n'th (last) bucket - this
 * can be anything from that bucket's min to that bucket's max.
 *
 * 'remainder' is
 * the amount of 'total' that was not used.
 */
export interface NBuckets {
  num: number;
  last: number | null;
  remainder: number;
}

/**
 * Tries to fill an array of buckets with a given amount, according to the
 * array's order, and stops at the first bucket that can't be completely filled.
 *
 * @param buckets The array of the buckets, where each bucket
 *     has a 'min' size and 'max' size. The bucket must be filled with at least
 *     min quantity, and if possible, as much as max quantity, before moving on
 *     to the next bucket. If 'max' is not provided, it is assumed to be equal
 *     to 'min'. The last bucket that is filled can be partially filled (less
 *     than max but at least min), while all the buckets before it must be
 *     filled with exactly max.
 * @param total The amount that is used to fill the buckets.
 * @param dropPenalty An optional size to subtract from 'total',
 *     if it turns out that not all buckets are filled. Defaults to 0.
 * @param penaltyIndex The index of the first bucket whose success
 *     to 'get in' means there's no need to apply the dropPenalty. In other
 *     words, the minimum number of buckets that if 'make it', will cause
 *     cancellation of the dropPenalty. Defaults to buckets.length, meaning any
 *     dropped buckets triggers dropPenalty.
 *
 * @return  Returns NBuckets or null if some buckets were dropped,
 *     but dropPenalty could not be subtracted from total, because it's
 *     higher than it.
 */
export function fillFirstNBuckets(
  buckets: AnyDuringMigration[],
  total: number,
  dropPenalty?: number,
  penaltyIndex?: number,
): NBuckets | null {
  if (dropPenalty === undefined) {
    dropPenalty = 0;
  }
  if (penaltyIndex === undefined) {
    penaltyIndex = buckets.length;
  }

  const penaltyTotal = total - dropPenalty;
  let idx = 0;
  let resWithPenalty = penaltyTotal >= 0 ? 0 : null;
  let sum = 0;
  // The sum up to this bucket.
  let sumWithPenalty = 0;
  // The sum if penalty will be applied.
  let last = null;
  // The value of last bucket to be filled.
  let lastWithPenalty = null;
  // The last value if penalty will be applied.
  while (idx < buckets.length) {
    const bucketMin = buckets[idx].min;
    assert(
      bucketMin >= 0,
      'bucket.min size must be a non-negative number',
    );
    const bucketMax = getMaxOrMin(buckets[idx]);
    assert(
      bucketMax >= bucketMin,
      'bucket.max size must be larger than or equal to bucket.min',
    );
    const diff = bucketMax - bucketMin;
    sum += bucketMin;
    if (sum <= penaltyTotal) {
      // Adding this bucket didn't cause sum to grow beyond the total minus the
      // penalty, so even if the penalty is applied, this bucket is in.
      resWithPenalty = idx + 1;
      const cappedDiff = Math.min(penaltyTotal - sum, diff);
      sumWithPenalty = sum + cappedDiff;
      lastWithPenalty = bucketMin + cappedDiff;
    }
    if (sum > total) {
      // Sum is passed. Stop scanning as we're done. All that's left is to check
      // whether to apply the penalty.
      if (idx >= penaltyIndex) {
        // No need to apply penalty.
        return {num: idx, last, remainder: total - (sum - bucketMin)};
      }
      // Yes, apply penalty.
      return resWithPenalty == null
        ? null
        : {
            num: resWithPenalty,
            last: lastWithPenalty,
            remainder: penaltyTotal - sumWithPenalty,
          };
    }
    const cappedDiff = Math.min(total - sum, diff);
    sum += cappedDiff;
    last = bucketMin + cappedDiff;
    idx++;
  }
  return {num: idx, last, remainder: total - sum};
}

/**
 * Fills a set of communicating vessels buckets
 * (http://en.wikipedia.org/wiki/Communicating_vessels).
 *
 * @param buckets The array of the buckets, where the bucket size can be
 *     extracted from each item using the getSize function.
 * @param total The amount that is used to fill the buckets.
 * @param getSize A function that accepts a bucket from 'buckets'
 *     and returns the size of that bucket.  Defaults to identity.
 * @return Object with 'waterLevel' and 'remainder'
 *     The 'waterlevel' is the height of the bucket that was
 *     most filled. All other buckets are smaller or equal to that bucket,
 *     and so filled with smaller or equal amount of water.
 *     The 'remainder' is the amount of 'total' that was not used.
 */
export function fillCommunicatingVessels(
  buckets: AnyDuringMigration[],
  total: number,
  getSize?: (p1: AnyDuringMigration) => number,
): {waterLevel: number; remainder: number} {
  getSize = getSize || identity;
  const sizes = buckets.map(getSize);
  // Sort in ascending order.
  sizes.sort((a, b) => {
    return a > b ? 1 : a < b ? -1 : 0;
  });

  // Loop the items starting with the smallest one, and going up. For each,
  // check if 'total' can fill all items up to the level (size) of this item.
  // Since the order of sizes is ascending, we need to check only items from i
  // onwards, because items 0 to i-1 are already completely full. If the answer
  // is yes, do it, i.e, use 'total' to fill all items as described above. If
  // not, fill as much as possible - divide the total by the number of items
  // that needs filling (are not yet full), and give each its equal share.
  let waterLevel = 0;
  for (let i = 0; i < sizes.length; i++) {
    const step = sizes[i] - waterLevel;
    const numOfItemsForThisStep = sizes.length - i;
    const totalSizeForStep = step * numOfItemsForThisStep;
    if (totalSizeForStep <= total) {
      waterLevel = sizes[i];
      total -= totalSizeForStep;
    } else {
      waterLevel += total / numOfItemsForThisStep;
      total = 0;
      break;
    }
  }

  return {waterLevel, remainder: total};
}

/**
 * A RealEstateItem has a minimum size (below that, there's no reason to keep
 * this item at all), a maximum size (see below), and an array of extra
 * quantities, which it'd like to have, if possible.
 */
export interface RealEstateItem {
  min: number;
  max: number | null;
  extra: number[];
}

/**
 * Distributes a given quantity (real estate) among several items.
 *
 * If not all items can fit in their maximum sizes, keep only the first N items
 * that do, and possibly the next item, if it can fit in its minimum size at
 * least. This means the items are assumed to be sorted in descending priority
 * order - the last item has lowest priority and will be dropped first. In case
 * dropping of items is needed, an optional dropPenalty can be specified to be
 * subtracted from the given total (useful, e.g, when we want to fit several
 * text labels in a given width, but if unable to fit all in, put an ellipsis at
 * the end, and the width of that ellipsis is our dropPenalty).
 *
 * After dropping items, if needed, give each remaining item the minimum it
 * needs, and then try to distribute the remainder among them. This is done in
 * order of the 'extra' array. First, extra[0] of all items is filled, then
 * extra[1] of all items, and so on, until either all extras of all items have
 * been fulfilled, or all the given quantity is used, what ever comes first. If
 * the latter is the case, meaning there's not enough to fill extra[i] (for some
 * i), distribute whatever we have among all extra[i] of all items in an equal
 * manner, using a communicating vessels algorithm.
 *
 * @param items The items. Each item
 *     has a number 'min', a number 'max' and an Array.<number> 'extra'
 *     attributes, as described above. max can be omitted, and then it assumed
 *     to be equal to min. min, max and all extra should be non-negative,
 *     max >= min and extra[i] can be Infinity. The order of the items in the
 *     array should be descending order of priority.
 * @param total The total quantity, to distribute among items.
 * @param dropPenalty An optional size to subtract from 'total',
 *     if it turns out that some items need to be dropped.
 * @param penaltyIndex See fillFirstNBuckets for doc.
 * @return An array that contains the amount that each item
 *     eventually gets. The array can be of the same size as 'items', or
 *     shorter, which means only the first N items remained after dropping.
 *     Returns null if some items were dropped, but dropPenalty could not be
 *     subtracted from total, because it's higher than it.
 */
export function distributeRealEstate(
  items: RealEstateItem[],
  total: number,
  dropPenalty?: number,
  penaltyIndex?: number,
): Array<number | null> | null {
  const fillFirstNBucketsResult = fillFirstNBuckets(
    items,
    total,
    dropPenalty,
    penaltyIndex,
  );
  if (!fillFirstNBucketsResult) {
    return null;
  }
  const fitItemsCount = fillFirstNBucketsResult.num;

  // The total margin that we want to distribute among the items that fit.
  let totalMargin = fillFirstNBucketsResult.remainder;
  // An array with only the items that we can fit in 'total'.
  const fitItems = items.slice(0, fitItemsCount);
  // The max length of the extra array, among all items that made it.
  const largestLengthOfExtraArray = fitItems.reduce(
    (res, item) => Math.max(res, item.extra.length),
    0,
  );

  const result = fitItems.map(getMaxOrMin) as Array<number | null>;
  if (result.length > 0) {
    result[result.length - 1] = fillFirstNBucketsResult.last;
  }
  for (let i = 0; i < largestLengthOfExtraArray; i++) {
    const getIthExtra = (item: AnyDuringMigration) => item.extra[i] || 0;
    const fillCommunicatingVesselsResult = fillCommunicatingVessels(
      fitItems,
      totalMargin,
      getIthExtra,
    );

    totalMargin = fillCommunicatingVesselsResult.remainder;
    for (let j = 0; j < result.length; j++) {
      result[j]! += Math.min(
        fillCommunicatingVesselsResult.waterLevel,
        items[j].extra[i] || 0,
      );
    }
    if (totalMargin === 0) {
      break;
    }
  }
  return result;
}

/**
 * A wrapper around distributeRealEstate, that creates an interface of keys,
 * rather than indices. The difference between this and distributeRealEstate is
 * that each item in 'items' should have a 'key' field. Several items can have
 * the same key, and the result is an Object with fields corresponding to the
 * input keys. See below for more explanations.
 *
 * @param items See distributeRealEstate for doc, with an
 *     additional 'key' member for each item.
 * @param total See distributeRealEstate for doc.
 * @param dropPenalty See distributeRealEstate for doc.
 * @param penaltyIndex See distributeRealEstate for doc.
 * @return An Object with fields corresponding to the input keys,
 *     whose values are arrays of numbers, as returned by distributeRealEstate,
 *     that indicate the allocated space for each item with the relevant key.
 *     Each of these arrays is a concatenation of distributeRealEstate's results
 *     for the elements with this key. For example, if the input had 3 items
 *     with key 'K', the output would have a 'K' field, whose value is an array
 *     with at most 3 elements. It can be less than 3 because some of the items
 *     might get dropped by distributeRealEstate.
 */
export function distributeRealEstateWithKeys(
  items: AnyDuringMigration[],
  total: number,
  dropPenalty?: number,
  penaltyIndex?: number,
): AnyDuringMigration {
  const tempResult = distributeRealEstate(
    items,
    total,
    dropPenalty,
    penaltyIndex,
  );

  const result = {};
  if (tempResult != null) {
    for (const [i, item] of items.entries()) {
      const key = item.key;
      if ((result as AnyDuringMigration)[key] == null) {
        (result as AnyDuringMigration)[key] = [];
      }
      if (i < tempResult.length) {
        (result as AnyDuringMigration)[key].push(tempResult[i]);
      }
    }
  }
  return result;
}

/**
 * An extension of goog.array.slice, that can accept multiple slices, and
 * returns a concatenation of all slices.
 * @param arr The array.
 * @param sliceArgs The indices of all slices. There must be an even number of these
 *     arguments, as every two is a pair or args to slice(). An index can be
 *     past the edge of the array, and in that case it's changed to be the length.
 * @return A concatenation of all slices.
 */
export function arrayMultiSlice(
  arr: AnyDuringMigration[],
  ...sliceArgs: number[]
): AnyDuringMigration[] {
  assert(sliceArgs.length % 2 === 0);
  const result: AnyDuringMigration[] = [];
  for (let i = 0; i < sliceArgs.length; i += 2) {
    const beginIdx = Math.min(sliceArgs[i], arr.length);
    const endIdx = Math.min(sliceArgs[i + 1], arr.length);
    const slice = arr.slice(beginIdx, endIdx);
    result.push(...slice);
  }
  return result;
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
    'numSignificantDigits must be > 0',
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
 * Creates an options path from a set of possible roots and a given property.
 * @deprecated Replace with use of options view.
 *
 * @param rootPath The set of roots.
 * @param property The property to concat to every root.
 * @return All possible concatenations of values from rootPath and the property.
 */
export function concatSuffix(
  rootPath: string[] | string,
  property: string,
): string[] {
  if (typeof rootPath === 'string') {
    return [`${rootPath}.${property}`];
  }
  return rootPath.map((singleRootPath) => `${singleRootPath}.${property}`);
}

/**
 * A helper function for calcEditDistanceStep, used to retrieve an element from
 * a 2D array. Simply returns null if any of the indices is negative.
 * @param array2d A two dimensional array.
 * @param i1 1st index to array2d.
 * @param i2 2nd index to array2d.
 * @return The i1,i2 element of array2d.
 */
function getArray2dValue(
  array2d: AnyDuringMigration[],
  i1: number,
  i2: number,
): AnyDuringMigration {
  if (i1 < 0 || i2 < 0) {
    return null;
  }
  return array2d[i1][i2];
}

/**
 * A helper function for calcEditDistance, used to calculate a single step
 * @param array1 Array 1.
 * @param array2 Array 2.
 * @param array2d The 2D array used by the dynamic programming algorithm
 *     to store intermediate results.
 * @param i1 Index in array1, and 1st index to array2d.
 * @param i2 Index in array2, and 2nd index to array2d.
 * @param equals A function used to compare two elements in the arrays.
 * @return An object that represents a a combination of first-i1-elements prefix
 *     of array1 and first-i2-elements prefix of array2 - what is the
 *     minimum-score way to get from the array 1 prefix to the array2 prefix.
 *     pathLink is a pointer to an object of same structure - the previous step
 *     in that path (actually a linked-list). score is the total score for the
 *     path. key1 is the index of the element in array1 and value1 is the index
 *     of the corresponding element in array2. If key1 is null, this step has no
 *     corresponding element in array1. If value1 is null, this step has no
 *     corresponding element in array2. And similar for key2/value2.
 */
function calcEditDistanceStep(
  array1: AnyDuringMigration[],
  array2: AnyDuringMigration[],
  array2d: AnyDuringMigration[],
  i1: number,
  i2: number,
  equals: (p1: AnyDuringMigration, p2: AnyDuringMigration) => boolean,
): {
  pathLink: AnyDuringMigration;
  score: number;
  key1: number | null;
  value1: number | null;
  key2: number | null;
  value2: number | null;
} {

  const results: Array<{
    pathLink: AnyDuringMigration;
    score: number;
    key1: number | null;
    value1: number | null;
    key2: number | null;
    value2: number | null;
  }> = [];

  // Testing i1-1.
  const lower1 = getArray2dValue(array2d, i1 - 1, i2);
  if (lower1) {
    results.push({
      pathLink: lower1,
      score: lower1.score + 1,
      key1: i1 - 1,
      value1: null,
      key2: null,
      value2: null,
    });
  }

  // Testing i2-1.
  const lower2 = getArray2dValue(array2d, i1, i2 - 1);
  if (lower2) {
    results.push({
      pathLink: lower2,
      score: lower2.score + 1,
      key1: null,
      value1: null,
      key2: i2 - 1,
      value2: null,
    });
  }

  // Testing i1-1 and i2-1 combined.
  const lower12 = getArray2dValue(array2d, i1 - 1, i2 - 1);
  if (lower12) {
    if (equals(array1[i1 - 1], array2[i2 - 1])) {
      results.push({
        pathLink: lower12,
        score: lower12.score,
        key1: i1 - 1,
        value1: i2 - 1,
        key2: i2 - 1,
        value2: i1 - 1,
      });
    }
  }

  // Take the result with the lowest score.
  results.sort((r1, r2) => r1.score - r2.score);
  return results.length > 0
    ? results[0]
    : {
        pathLink: null,
        score: 0,
        key1: null,
        value1: null,
        key2: null,
        value2: null,
      };
}

/**
 * The minimum-score set of operations that are needed in order to
 * change one array array1 into another, array2.
 *
 * 'score' is the number of operations.
 *
 * 'map1' maps each index of array1 into the corresponding index in array2.
 *
 * 'map2' maps from array2 to array1.
 */
export interface MinimumScoreSet {
  score: number;
  map1: AnyDuringMigration;
  map2: AnyDuringMigration;
}

/**
 * Calculates an edit distance between two arrays
 * (http://en.wikipedia.org/wiki/Edit_distance). The only operations that are
 * considered are 'delete from array 1' and 'insert into array 2'.
 *
 * @param array1 Array 1.
 * @param array2 Array 2.
 * @param equals A function used to compare two elements in the arrays.
 *     The default is simply to call operator ==.
 * @return The MinimumScoreSet
 */
export function calcEditDistance(
  array1: AnyDuringMigration[],
  array2: AnyDuringMigration[],
  equals?: (p1: AnyDuringMigration, p2: AnyDuringMigration) => boolean,
): MinimumScoreSet {
  equals = equals || ((v1, v2) => v1 === v2);

  // Build a minimum-score path using dynamic programming.
  const array2d: AnyDuringMigration[] = [];
  const leni1 = array1.length;
  const leni2 = array2.length;
  for (let i1 = 0; i1 <= leni1; i1++) {
    array2d[i1] = array2d[i1] || [];
    for (let i2 = 0; i2 <= leni2; i2++) {
      array2d[i1][i2] = calcEditDistanceStep(
        array1,
        array2,
        array2d,
        i1,
        i2,
        equals,
      );
    }
  }

  // Now that we have a minimum-score path, construct the return value.
  const map1 = {};
  const map2 = {};
  let pathElement = array2d[leni1][leni2];
  assert(pathElement);
  const score = pathElement.score;
  while (pathElement) {
    if (pathElement.key1 != null) {
      (map1 as AnyDuringMigration)[pathElement.key1] = pathElement.value1;
    }
    if (pathElement.key2 != null) {
      (map2 as AnyDuringMigration)[pathElement.key2] = pathElement.value2;
    }
    pathElement = pathElement.pathLink;
  }
  return {score, map1, map2};
}

/**
 * Represents an array of merged values that come from array ar1 or ar2,
 * or both.  If the value is only in one array, then the
 * index for the other is for the closest value.
 */
interface MergedItems {
  value: number | null;
  ar1: number;
  ar2: number;
}

/**
 * Return an array of indexes that is a merging of ar1Array and ar2Array.
 * Values are numbers, but may also be null or undefined,
 * and values may be duplicated in each array.  If the arrays are not sorted,
 * screwy things will likely happen but it won't break.  If either array is
 * empty, null is returned.
 * The template is for the type of the array elements.
 * @param ar1Array One array.
 * @param ar2Array Another array.
 * @param getValue A function that accepts an element from the array
 *     and returns the value of that element.  Defaults to identity.
 * @return An array of MergedItems, or null.
 */
export function mergeArrays<T>(
  ar1Array: T[], //
  ar2Array: T[], //
  getValue?: (p1: T) => number,
): //
MergedItems[] | null {
  if (
    !ar1Array ||
    !ar2Array ||
    ar1Array.length === 0 ||
    ar2Array.length === 0
  ) {
    return null;
  }
  const merged: Array<Partial<MergedItems>> = [];
  if (!getValue) {
    getValue = identity as (p1: T) => number;
  }

  // First merge without filling in gaps.
  // indexes into ar1Array and ar2Array.
  let ar1 = 0;
  let ar2 = 0;

  // Values corresponding to ar1 and ar2.
  let ar1Value: number;
  let ar2Value: number;

  // Each loop bumps ar1 or ar2 or both forward one step.
  while (ar1 < ar1Array.length || ar2 < ar2Array.length) {
    if (ar1 < ar1Array.length) {
      ar1Value = getValue(ar1Array[ar1]);
    }
    if (ar2 < ar2Array.length) {
      ar2Value = getValue(ar2Array[ar2]);
    }
    if (
      ar1 < ar1Array.length &&
      ar2 < ar2Array.length &&
      ar1Value! === ar2Value!
    ) {
      // The two values are the same.
      merged.push({value: ar1Value, ar1, ar2});
      ar1++;
      ar2++;
    } else if (
      ar1 < ar1Array.length &&
      (ar1Value! == null ||
        ar2 === ar2Array.length ||
        // so ar2 < ar2Array.len
        ar1Value! < (ar2Value! as number))
    ) {
      // ar1Value is low, so bump ar1 forward.
      merged.push({value: ar1Value!, ar1, ar2: undefined});
      ar1++;
    } else if (
      ar2 < ar2Array.length &&
      (ar2Value! == null ||
        ar1 === ar1Array.length ||
        // so ar1 < ar1Array.len
        ar2Value! < (ar1Value! as number))
    ) {
      // ar2Value is low, so bump ar2 forward.
      merged.push({value: ar2Value!, ar1: undefined, ar2});
      ar2++;
    }
  }

  // Helper function to compare a value with two neighboring
  // array values (array[idx] and array[idx + 1]) and return the index
  // of the nearest one.  If idx is null, return 0.  If idx is at the
  // end of the array, or if the value is null, return idx.  If either
  // value in the array is null, return the index of the other one.
  const nearest = (
    value: AnyDuringMigration,
    array: AnyDuringMigration,
    idx: AnyDuringMigration,
  ) => {
    if (idx == null) {
      return 0;
    }
    if (idx === array.length - 1 || value == null) {
      return idx;
    }
    const v0 = getValue!(array[idx]);
    if (v0 == null) {
      return idx + 1;
    }
    const v1 = getValue!(array[idx + 1]);
    if (v1 == null) {
      return idx;
    }
    if (Math.abs(value - v0) <= Math.abs(value - v1)) {
      return idx;
    } else {
      return idx + 1;
    }
  };

  // Fill in the gaps between indices in the merged arrays with
  // the index of the closest value in the 'other' array.
  let previousAr1: AnyDuringMigration = null;
  let previousAr2: AnyDuringMigration = null;
  for (const item of merged) {
    if (item.ar1 == null) {
      item.ar1 = nearest(item.value, ar1Array, previousAr1);
    } else {
      previousAr1 = item.ar1;
    }
    if (item.ar2 == null) {
      item.ar2 = nearest(item.value, ar2Array, previousAr2);
    } else {
      previousAr2 = item.ar2;
    }
    // At this time, item.ar1 and item.ar2 must be non-null
  }
  return merged as MergedItems[];
}

/**
 * Returns whether a given object does not contain any property which is not
 * specified in a white list of permitted properties.
 *
 * @param obj The object.
 * @param permittedProperties The properties the object is
 *     permitted to have (it is not obliged to have all of them though).
 * @return Whether the object does not contain any property which
 *     is not specified in the list.
 */
export function containsNoOtherProperties(
  obj: AnyDuringMigration,
  permittedProperties: string[],
): boolean {
  for (const property in obj) {
    if (!permittedProperties.includes(property)) {
      return false;
    }
  }
  return true;
}

/**
 * Given a set of x,y coordinates and an x value, returns the interpolated y
 * value for the given x. The interpolation function is the piecewise linear
 * function going through the given coordinates.
 * Coordinates are allowed to be null, at which case their handling is
 * determined by an additional flag indicating whether they should be
 * interpolated or not.
 * If the given x value resides outside the range of the x values of the
 * coordinates, or between two disconnected coordinates (this happens when
 * there is a null coordinate between them and null coordinates are not
 * interpolated), then this function returns null.
 *
 * @param coordinates Through which the piecewise linear function goes.
 * @param x The value to interpolate. +/-Infinity are also supported.
 * @param interpolateNulls Whether to interpolate null coordinates.
 * @return The interpolated value if given value is within the range
 *     of the interpolation function, or null otherwise.
 */
export function piecewiseLinearInterpolation(
  coordinates: Coordinate[],
  x: number,
  interpolateNulls: boolean,
): number | null {
  // If null coordinates should be interpolated simply filter them out and
  // treat the remaining coordinates as forming a single piecewise linear
  // function.
  if (interpolateNulls) {
    return piecewiseLinearInterpolationInternal(
      coordinates.filter((x) => x != null),
      x,
    );
  }

  // Otherwise, split the coordinates at nulls to obtain a set of disjoint
  // connected components. Search for given x value in each of these
  // components, and if found return the interpolated value.
  let prevNull = -1;
  for (let i = 0; i < coordinates.length; i++) {
    const coordinate = coordinates[i];
    if (coordinate == null) {
      const component = coordinates.slice(prevNull + 1, i);
      const y = piecewiseLinearInterpolationInternal(component, x);
      if (y !== null) {
        return y;
      }
      prevNull = i;
    }
  }
  const lastComponent = coordinates.slice(prevNull + 1);
  return piecewiseLinearInterpolationInternal(lastComponent, x);
}

/**
 * Same as the public version, only does not accept null coordinates.
 * @param coordinates The coordinates through
 *     which the piecewise linear function goes.
 * @param x The value to interpolate. +/-Infinity are also supported.
 * @return The interpolated value if given value is within the range
 *     of the interpolation function, or null otherwise.
 */
function piecewiseLinearInterpolationInternal(
  coordinates: Coordinate[],
  x: number,
): number | null {
  const compareFn = (x: number, coordinate: Coordinate) =>
    // same as: goog.array.defaultCompare(x, coordinate.x);
    ((a, b) => (a > b ? 1 : a < b ? -1 : 0))(x, coordinate.x);
  const i = binarySearchCoordinates(coordinates, x, compareFn);

  // There is a coordinate at given x, no need to interpolate.
  if (i >= 0) {
    return coordinates[i].y;
  }
  // See documentation of goog.array.binarySearch
  const insertionIndex = -(i + 1);

  // Given x value is not within the range of values of the coordinates.
  if (insertionIndex === 0 || insertionIndex === coordinates.length) {
    return null;
  }
  const prev = coordinates[insertionIndex - 1];
  const next = coordinates[insertionIndex];

  // Simple linear interpolation since Three.js Line3 has different constructor
  const t = (x - prev.x) / (next.x - prev.x);
  return prev.y + t * (next.y - prev.y);
}

// Modified from http://jsfiddle.net/aryzhov/pkfst550/
// Also see:
// https://stackoverflow.com/questions/22697936/binary-search-in-javascript
/*
 * Binary search in JavaScript.
 * Returns the index of of the element in a sorted array or (-n-1)
 * where n is the insertion point for the new element.
 * Parameters:
 *     elements - A sorted array of some element type.
 *     t - A target value to search for.  Note that the target type is
 *       possibly not the same as the element type.
 *     compare_fn - A comparator function. The function takes two arguments:
 *       (a: TARGET, b: ELEMENT) and returns:
 *        a negative number  if a is less than b;
 *        0 if a is equal to b;
 *        a positive number of a is greater than b.
 * The array may contain duplicate elements. If there are more than one equal
 * element in the array, the returned value will be the lowest index.
 */
function binarySearch<ELEMENT, TARGET>(
  elements: ELEMENT[],
  t: TARGET,
  compareFn: (a: TARGET, b: ELEMENT) => number,
) {
  let lower = 0;
  let upper = elements.length - 1;
  while (lower <= upper) {
    let k = Math.floor((upper + lower) / 2);
    const cmp = compareFn(t, elements[k]);
    if (cmp > 0) {
      lower = k + 1;
    } else if (cmp < 0) {
      upper = k - 1;
    } else {
      // Linear search for lowest index.
      while (k > 0 && compareFn(t, elements[k - 1]) === 0) {
        k = k - 1;
      }
      return k;
    }
  }
  // Not found, so return insertion point.
  return -lower - 1;
}

/**
 * Binary search implementation to replace googArray.binarySearch
 */
export function binarySearchArray<T>(arr: T[], target: T, compareFn?: (a: T, b: T) => number): number {
  const compare = compareFn || ((a, b) => a < b ? -1 : a > b ? 1 : 0);
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const cmp = compare(target, arr[mid]);

    if (cmp === 0) return mid;
    if (cmp < 0) right = mid - 1;
    else left = mid + 1;
  }

  return -(left + 1); // Return insertion point as negative
}

/**
 * Get the last element of an array (replaces googArray.peek)
 */
export const peekArray = <T>(arr: T[]): T => {
  assert(arr.length > 0, 'Array cannot be empty');
  return arr[arr.length - 1];
};

// From jsapi/common/util.ts

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
 * Extends a given range to include a given value.
 * @param range The range to extend. Null means there's no
 *     range to extend, so a new range will be created, that includes only the
 *     given value.
 * @param value The value. If null, return the given range as-is.
 * @return The new range.
 */
export function extendRangeToInclude(
  range: RangeCompat | null,
  value: number | null,
): RangeCompat | null {
  if (value == null) {
    return range;
  }
  const valueRange = new RangeCompat(value, value);
  return range ? RangeCompat.boundingRange(range, valueRange) : valueRange;
}

/**
 * Returns the given range, after potentially override its boundaries with the
 * given values. If the given range is null, both min and max need to be
 * non-null to yield a non-null result (no one-sided ranges). If a range is
 * given, and out of min/max only one of them is given, and the one that is
 * given is outside the range, ignore the range and take that min-or-max value
 * as a single point range.
 * @param range The starting range.
 * @param min The new min value. If not null, overrides range.start.
 * @param max The new max value. If not null, overrides range.end.
 * @return The result range.
 */
export function getOverriddenRange(
  range: RangeCompat | null,
  min: number | null,
  max: number | null,
): RangeCompat | null {
  const newMin =
    min != null
      ? min
      : range && max != null && max < range.start
        ? max
        : range
          ? range.start
          : null;
  const newMax =
    max != null
      ? max
      : range && min != null && min > range.end
        ? min
        : range
          ? range.end
          : null;
  return newMin != null && newMax != null ? new RangeCompat(newMin, newMax) : null;
}

/**
 * Returns the bounding box of the union of all the given boxes, or null if
 * there are no boxes.
 * @param boxes The boxes.
 * @return The bounding box.
 */
export function calcBoundingBox(boxes: Box[]): Box | null {
  if (boxes.length === 0) {
    return null;
  }
  // Start from a copy of the first box, and expand to include all other boxes.
  const boundingBox = boxes[0].clone();
  for (let i = 1; i < boxes.length; i++) {
    boundingBox.union(boxes[i]);
  }
  return boundingBox;
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

  let i = binarySearchArray(arr, val);
  if (i >= 0) {
    // Target value is present in the array.
    return val;
  }
  // See documentation of goog.array.binarySearch
  i = -(i + 1);

  if (i === 0) {
    return arr[0];
  }
  if (i === arr.length) {
    return peekArray(arr);
  }

  // Target value is in range [a, b]. Return the closer of the two.
  const a = arr[i - 1];
  const b = arr[i];
  return Math.abs(val - a) <= Math.abs(val - b) ? a : b;
}


/**
 * Binary search for coordinates (specialized version)
 */
function binarySearchCoordinates(
  coordinates: Coordinate[],
  x: number,
  compareFn: (x: number, coordinate: Coordinate) => number
): number {
  let left = 0;
  let right = coordinates.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const cmp = compareFn(x, coordinates[mid]);

    if (cmp === 0) return mid;
    if (cmp < 0) right = mid - 1;
    else left = mid + 1;
  }

  return -(left + 1); // Return insertion point as negative
}
