/**
 * @fileoverview Curve and Bezier utilities.
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
import { Vec2, XYPair, vec2Difference, vec2Sum } from './vector-utils';
import { nextNonNull } from './array-utils';

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
 * appearing before it and one after it in the Bezier sequence.
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
 */
export function calculateControlPoints(
  points: Array<Vec2 | null>,
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
    let nextIndex: number | null;
    let previousIndex: number | null;

    if (interpolateNulls) {
      nextIndex = nextNonNull(points, i, 1, isClosed);
      previousIndex = nextNonNull(points, i, -1, isClosed);
    } else {
      nextIndex = isClosed ? (i + 1) % points.length : i + 1;
      previousIndex = isClosed
        ? (points.length + i - 1) % points.length
        : i - 1;

      // Check bounds for non-circular case
      if (!isClosed) {
        if (nextIndex >= points.length) nextIndex = null;
        if (previousIndex < 0) previousIndex = null;
      }
    }

    if (
      nextIndex != null &&
      previousIndex != null &&
      points[i] != null &&
      points[previousIndex] != null &&
      points[nextIndex] != null
    ) {
      const currentPoint = points[i]!;
      const prevPoint = points[previousIndex]!;
      const nextPoint = points[nextIndex]!;

      const tangent = tangentCalculator(
        vec2Difference(currentPoint, prevPoint),
        vec2Difference(nextPoint, currentPoint),
        smoothingFactor,
      );

      // Convert XYPair to Vec2 if needed
      const tangentVec = tangent instanceof Vector2
        ? tangent
        : new Vector2(tangent.x, tangent.y);

      result.push([
        vec2Difference(currentPoint, tangentVec),
        vec2Sum(currentPoint, tangentVec),
      ]);
    } else if (points[i] != null) {
      // Point exists but no valid neighbors - use the point itself as both control points
      result.push([points[i]!.clone(), points[i]!.clone()]);
    } else {
      // Point is null
      result.push(null);
    }
  }
  return result;
}

/**
 * Evaluates a cubic Bezier curve at parameter t.
 * @param p0 Start point.
 * @param p1 First control point.
 * @param p2 Second control point.
 * @param p3 End point.
 * @param t Parameter (0 to 1).
 * @return Point on the curve at parameter t.
 */
export function evaluateCubicBezier(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number,
): Vec2 {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const oneMinusTCubed = oneMinusTSquared * oneMinusT;
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return new Vector2(
    oneMinusTCubed * p0.x +
    3 * oneMinusTSquared * t * p1.x +
    3 * oneMinusT * tSquared * p2.x +
    tCubed * p3.x,

    oneMinusTCubed * p0.y +
    3 * oneMinusTSquared * t * p1.y +
    3 * oneMinusT * tSquared * p2.y +
    tCubed * p3.y
  );
}

/**
 * Evaluates a quadratic Bezier curve at parameter t.
 * @param p0 Start point.
 * @param p1 Control point.
 * @param p2 End point.
 * @param t Parameter (0 to 1).
 * @return Point on the curve at parameter t.
 */
export function evaluateQuadraticBezier(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  t: number,
): Vec2 {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const tSquared = t * t;

  return new Vector2(
    oneMinusTSquared * p0.x + 2 * oneMinusT * t * p1.x + tSquared * p2.x,
    oneMinusTSquared * p0.y + 2 * oneMinusT * t * p1.y + tSquared * p2.y
  );
}

/**
 * Calculates the derivative (tangent vector) of a cubic Bezier curve at parameter t.
 * @param p0 Start point.
 * @param p1 First control point.
 * @param p2 Second control point.
 * @param p3 End point.
 * @param t Parameter (0 to 1).
 * @return Tangent vector at parameter t.
 */
export function cubicBezierDerivative(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number,
): Vec2 {
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const tSquared = t * t;

  return new Vector2(
    3 * oneMinusTSquared * (p1.x - p0.x) +
    6 * oneMinusT * t * (p2.x - p1.x) +
    3 * tSquared * (p3.x - p2.x),

    3 * oneMinusTSquared * (p1.y - p0.y) +
    6 * oneMinusT * t * (p2.y - p1.y) +
    3 * tSquared * (p3.y - p2.y)
  );
}

/**
 * Samples points along a cubic Bezier curve.
 * @param p0 Start point.
 * @param p1 First control point.
 * @param p2 Second control point.
 * @param p3 End point.
 * @param numSamples Number of samples to generate.
 * @return Array of points along the curve.
 */
export function sampleCubicBezier(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  numSamples: number,
): Vec2[] {
  const samples: Vec2[] = [];
  if (numSamples <= 0) return samples;
  if (numSamples === 1) {
    samples.push(p0.clone());
    return samples;
  }

  for (let i = 0; i < numSamples; i++) {
    const t = i / (numSamples - 1);
    samples.push(evaluateCubicBezier(p0, p1, p2, p3, t));
  }
  return samples;
}

/**
 * Converts a series of points with control points into a smooth path.
 * @param points The data points.
 * @param controlPoints Control points for each data point (from calculateControlPoints).
 * @param samplesPerSegment Number of samples per curve segment.
 * @return Array of points forming a smooth path.
 */
export function createSmoothPath(
  points: Array<Vec2 | null>,
  controlPoints: Array<Vec2[] | null>,
  samplesPerSegment = 10,
): Vec2[] {
  const path: Vec2[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const currentPoint = points[i];
    const nextPoint = points[i + 1];
    const currentControls = controlPoints[i];
    const nextControls = controlPoints[i + 1];

    if (
      currentPoint &&
      nextPoint &&
      currentControls &&
      nextControls &&
      currentControls.length >= 2 &&
      nextControls.length >= 2
    ) {
      // Create cubic Bezier segment
      const samples = sampleCubicBezier(
        currentPoint,
        currentControls[1], // Control point after current point
        nextControls[0],    // Control point before next point
        nextPoint,
        samplesPerSegment
      );

      // Add samples (skip the last one to avoid duplication)
      if (i === 0) {
        // For the first segment, add all samples
        path.push(...samples);
      } else {
        // For subsequent segments, skip the first sample to avoid duplication
        path.push(...samples.slice(1));
      }
    } else if (currentPoint && nextPoint) {
      // No control points available, create straight line
      if (i === 0) {
        path.push(currentPoint);
      }
      path.push(nextPoint);
    }
  }

  return path;
}

/**
 * Calculates the length of a cubic Bezier curve using numerical integration.
 * @param p0 Start point.
 * @param p1 First control point.
 * @param p2 Second control point.
 * @param p3 End point.
 * @param numSamples Number of samples for numerical integration.
 * @return Approximate length of the curve.
 */
export function cubicBezierLength(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  numSamples = 100,
): number {
  let length = 0;
  let prevPoint = p0;

  for (let i = 1; i <= numSamples; i++) {
    const t = i / numSamples;
    const currentPoint = evaluateCubicBezier(p0, p1, p2, p3, t);
    length += currentPoint.distanceTo(prevPoint);
    prevPoint = currentPoint;
  }

  return length;
}

/**
 * Finds the parameter t on a cubic Bezier curve that corresponds to a given arc length.
 * @param p0 Start point.
 * @param p1 First control point.
 * @param p2 Second control point.
 * @param p3 End point.
 * @param targetLength The target arc length from the start of the curve.
 * @param tolerance Tolerance for the search.
 * @return Parameter t (0 to 1) corresponding to the target length.
 */
export function cubicBezierParameterAtLength(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  targetLength: number,
  tolerance = 0.001,
): number {
  let low = 0;
  let high = 1;
  let mid = 0.5;

  while (high - low > tolerance) {
    mid = (low + high) / 2;
    const currentLength = cubicBezierLengthAtParameter(p0, p1, p2, p3, mid);

    if (currentLength < targetLength) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return mid;
}

/**
 * Calculates the length of a cubic Bezier curve from t=0 to t=parameter.
 * @param p0 Start point.
 * @param p1 First control point.
 * @param p2 Second control point.
 * @param p3 End point.
 * @param parameter The parameter (0 to 1) to calculate length up to.
 * @param numSamples Number of samples for numerical integration.
 * @return Length from start to the given parameter.
 */
function cubicBezierLengthAtParameter(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  parameter: number,
  numSamples = 50,
): number {
  let length = 0;
  let prevPoint = p0;

  for (let i = 1; i <= numSamples; i++) {
    const t = (i / numSamples) * parameter;
    const currentPoint = evaluateCubicBezier(p0, p1, p2, p3, t);
    length += currentPoint.distanceTo(prevPoint);
    prevPoint = currentPoint;
  }

  return length;
}
