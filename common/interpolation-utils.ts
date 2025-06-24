/**
 * @fileoverview Interpolation and coordinate utilities.
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

import { Vector2 } from 'three';

// Type aliases for compatibility
type Coordinate = Vector2;

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
  coordinates: Array<Coordinate | null>,
  x: number,
  interpolateNulls: boolean,
): number | null {
  // If null coordinates should be interpolated simply filter them out and
  // treat the remaining coordinates as forming a single piecewise linear
  // function.
  if (interpolateNulls) {
    return piecewiseLinearInterpolationInternal(
      coordinates.filter((coord) => coord != null) as Coordinate[],
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
      const component = coordinates.slice(prevNull + 1, i).filter(coord => coord != null) as Coordinate[];
      const y = piecewiseLinearInterpolationInternal(component, x);
      if (y !== null) {
        return y;
      }
      prevNull = i;
    }
  }
  const lastComponent = coordinates.slice(prevNull + 1).filter(coord => coord != null) as Coordinate[];
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
  if (coordinates.length === 0) {
    return null;
  }

  const compareFn = (target: number, coordinate: Coordinate) =>
    target < coordinate.x ? -1 : target > coordinate.x ? 1 : 0;

  const i = binarySearch(coordinates, x, compareFn);

  // There is a coordinate at given x, no need to interpolate.
  if (i >= 0) {
    return coordinates[i].y;
  }

  // See documentation of binarySearch
  const insertionIndex = -(i + 1);

  // Given x value is not within the range of values of the coordinates.
  if (insertionIndex === 0 || insertionIndex === coordinates.length) {
    return null;
  }

  const prev = coordinates[insertionIndex - 1];
  const next = coordinates[insertionIndex];

  // Linear interpolation between the two points
  const t = (x - prev.x) / (next.x - prev.x);
  return prev.y + t * (next.y - prev.y);
}

/**
 * Binary search in JavaScript.
 * Returns the index of the element in a sorted array or (-n-1)
 * where n is the insertion point for the new element.
 *
 * @param elements A sorted array of some element type.
 * @param target A target value to search for. Note that the target type is
 *   possibly not the same as the element type.
 * @param compareFn A comparator function. The function takes two arguments:
 *   (target: TARGET, element: ELEMENT) and returns:
 *    - a negative number if target is less than element;
 *    - 0 if target is equal to element;
 *    - a positive number if target is greater than element.
 *
 * The array may contain duplicate elements. If there are more than one equal
 * element in the array, the returned value will be the lowest index.
 *
 * @return The index of the element if found, or (-insertion_point - 1) if not found.
 */
export function binarySearch<ELEMENT, TARGET>(
  elements: ELEMENT[],
  target: TARGET,
  compareFn: (target: TARGET, element: ELEMENT) => number,
): number {
  let lower = 0;
  let upper = elements.length - 1;

  while (lower <= upper) {
    let k = Math.floor((upper + lower) / 2);
    const cmp = compareFn(target, elements[k]);

    if (cmp > 0) {
      lower = k + 1;
    } else if (cmp < 0) {
      upper = k - 1;
    } else {
      // Linear search for lowest index when there are duplicates
      while (k > 0 && compareFn(target, elements[k - 1]) === 0) {
        k = k - 1;
      }
      return k;
    }
  }

  // Not found, so return insertion point as negative value
  return -lower - 1;
}

/**
 * Simplified binary search for arrays of the same type.
 * @param arr A sorted array.
 * @param target The target value to search for.
 * @param compareFn Optional comparison function. Defaults to standard comparison.
 * @return The index of the element if found, or (-insertion_point - 1) if not found.
 */
export function binarySearchArray<T>(
  arr: T[],
  target: T,
  compareFn?: (a: T, b: T) => number
): number {
  const compare = compareFn || ((a, b) => a < b ? -1 : a > b ? 1 : 0);
  return binarySearch(arr, target, (t, e) => compare(t, e));
}

/**
 * Linear interpolation between two values.
 * @param a Start value.
 * @param b End value.
 * @param t Interpolation parameter (0 to 1).
 * @return Interpolated value.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Inverse linear interpolation - finds the parameter t for a given value.
 * @param a Start value.
 * @param b End value.
 * @param value The value to find the parameter for.
 * @return The parameter t (0 to 1) that produces the given value.
 */
export function inverseLerp(a: number, b: number, value: number): number {
  if (a === b) {
    return 0; // Avoid division by zero
  }
  return (value - a) / (b - a);
}

/**
 * Clamps a value between min and max.
 * @param value The value to clamp.
 * @param min Minimum value.
 * @param max Maximum value.
 * @return The clamped value.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Smoothstep interpolation function.
 * @param edge0 Lower edge.
 * @param edge1 Upper edge.
 * @param x Input value.
 * @return Smoothly interpolated value between 0 and 1.
 */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/**
 * Bilinear interpolation.
 * @param x0 X coordinate of first point.
 * @param x1 X coordinate of second point.
 * @param y0 Y coordinate of first point.
 * @param y1 Y coordinate of second point.
 * @param q00 Value at (x0, y0).
 * @param q01 Value at (x0, y1).
 * @param q10 Value at (x1, y0).
 * @param q11 Value at (x1, y1).
 * @param x X coordinate to interpolate at.
 * @param y Y coordinate to interpolate at.
 * @return Interpolated value.
 */
export function bilinearInterpolation(
  x0: number, x1: number, y0: number, y1: number,
  q00: number, q01: number, q10: number, q11: number,
  x: number, y: number
): number {
  const tx = (x - x0) / (x1 - x0);
  const ty = (y - y0) / (y1 - y0);

  const a = lerp(q00, q10, tx);
  const b = lerp(q01, q11, tx);

  return lerp(a, b, ty);
}

/**
 * Cubic interpolation using Catmull-Rom splines.
 * @param p0 Point before start.
 * @param p1 Start point.
 * @param p2 End point.
 * @param p3 Point after end.
 * @param t Interpolation parameter (0 to 1).
 * @return Interpolated value.
 */
export function catmullRomInterpolation(
  p0: number, p1: number, p2: number, p3: number, t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;

  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Maps a value from one range to another.
 * @param value The input value.
 * @param fromMin Source range minimum.
 * @param fromMax Source range maximum.
 * @param toMin Target range minimum.
 * @param toMax Target range maximum.
 * @return The mapped value.
 */
export function mapRange(
  value: number,
  fromMin: number, fromMax: number,
  toMin: number, toMax: number
): number {
  const t = inverseLerp(fromMin, fromMax, value);
  return lerp(toMin, toMax, t);
}
