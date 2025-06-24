/**
 * @fileoverview Array manipulation utilities.
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

import { assert, NonEmptyArray } from 'ts-essentials';
import { pipe } from 'fp-ts/function';
import { identity } from 'fp-ts/function';
import * as A from 'fp-ts/Array';
import * as O from 'fp-ts/Option';

// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

// More specific types for better type safety
type CompareFunction = (p1: any, p2: any) => number;

/**
 * Removes the first element of an array. A convenience function.
 * @param array The array.
 * @return A copy of the array without its first element.
 */
export function removeFirstElement<T>(array: T[]): T[] {
  if (array.length === 0) {
    throw new Error('Array cannot be empty');
  }
  return array.slice(1);
}

/**
 * Removes the last element of an array. A convenience function.
 * @param array The array.
 * @return The array without its last element.
 */
export function removeLastElement<T>(array: T[]): T[] {
  if (array.length === 0) {
    throw new Error('Array cannot be empty');
  }
  return array.slice(0, array.length - 1);
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
  const diff = diffFunc || ((a: T, b: T) => Math.abs((a as any) - (b as any)));
  return a1.every((obj, i) => diff(a1[i], a2[i]) <= tolerance);
}

/**
 * An extension of array.slice, that can accept multiple slices, and
 * returns a concatenation of all slices.
 * @param arr The array.
 * @param sliceArgs The indices of all slices. There must be an even number of these
 *     arguments, as every two is a pair or args to slice(). An index can be
 *     past the edge of the array, and in that case it's changed to be the length.
 * @return A concatenation of all slices.
 */
export function arrayMultiSlice<T>(
  arr: T[],
  ...sliceArgs: number[]
): T[] {
  if (sliceArgs.length % 2 !== 0) {
    throw new Error('sliceArgs must have even number of arguments');
  }
  const result: T[] = [];
  for (let i = 0; i < sliceArgs.length; i += 2) {
    const beginIdx = Math.min(sliceArgs[i], arr.length);
    const endIdx = Math.min(sliceArgs[i + 1], arr.length);
    const slice = arr.slice(beginIdx, endIdx);
    result.push(...slice);
  }
  return result;
}

/**
 * Binary search implementation to replace googArray.binarySearch
 */
export function binarySearchArray<T>(
  arr: T[],
  target: T,
  compareFn?: (a: T, b: T) => number
): number {
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
  if (arr.length === 0) {
    throw new Error('Array cannot be empty');
  }
  return arr[arr.length - 1];
};

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
  ar1Array: T[],
  ar2Array: T[],
  getValue?: (p1: T) => number,
): MergedItems[] | null {
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
    value: any,
    array: any,
    idx: any,
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
  let previousAr1: any = null;
  let previousAr2: any = null;
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
 * Traverses a range of numbers (zero to some number exclusive) and calls a
 * given function for every number in the range and returns an array of the
 * ordered results.
 * Similar to Array.from with a mapping function over [0, 1, 2, ..., (length - 1)].
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
 * Iterate over an array, starting from a given index and in a given direction,
 * search for the first non null value whose index is greater (or smaller,
 * depends on direction) than the given index. Also supports cyclic behaviour.
 * @param array The array.
 * @param index The index to start from.
 * @param direction The direction to traverse the array (+1 or -1).
 * @param isCircular If set to true the array is treated as circular.
 * @return The index found or null if none was found.
 */
export function nextNonNull<T>(
  array: T[],
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
