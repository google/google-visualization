/**
 * @fileoverview This file provides utility functions for path segments.
 *
 * @license
 * Copyright 2024 Google LLC
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

import * as asserts from '@npm//@closure/asserts/asserts';
import {Coordinate} from '@npm//@closure/math/coordinate';
import {Line} from '@npm//@closure/math/line';
import * as googMath from '@npm//@closure/math/math';
import {Range} from '@npm//@closure/math/range';
import * as googObject from '@npm//@closure/object/object';

import {roughlyEquals} from '../common/util';
import {
  CurveData,
  PathSegments,
  Segment,
  SegmentType,
} from '../graphics/path_segments';

/**
 * Calculates a path parallel to a given one at a given distance from it.
 * If the distance is positive, then the parallel path is always to the
 * right of the original path. If negative, it is always to its left.
 * Thus, if the points of your path are ordered clockwise, specify a
 * positive distance to get an internal parallel path, and a negative
 * distance get an external one. If your points are ordered anti-clockwise, the
 * exact opposite applies.
 * The algorithm works as following: for every two adjacent segments, we
 * calculate the parallel segments. If these intersect, we add them to the
 * parallel path with the intersection point as a new path vertex. Otherwise,
 * we add the parallel segments as is and connect them with an arc.
 * @param path The original path.
 * @param dist The requested distance between the original path and
 *     the parallel path.
 * @return The parallel path, or an empty path if
 *     the original one has less than 2 segments.
 */
export function calcParallelPath(
  path: PathSegments,
  dist: number,
): PathSegments {
  const parallelPath = new PathSegments();

  const segments = path.segments;
  if (segments.length === 0 || segments.length === 1) {
    // We need at least two coordinates to calculate a parallel path.
    return parallelPath;
  }

  // Extract just the coordinates of the path vertices.
  // Optimization: We put a null place-holder in the first and last cells.
  // These will be replaced by the padding points later on.
  const points: Array<Coordinate | null> = [null];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    // A CLOSE segment, for example, has no data. We wish to skip such segments.
    if (segment.data) {
      const point = segment.data as Coordinate;
      points.push(new Coordinate(point.x, point.y));
    }
  }
  points.push(null);
  // Add padding points needed for first and last parallel segments.
  const lastSegmentType = segments[segments.length - 1].type;
  const closed = lastSegmentType === SegmentType.CLOSE;
  addPaddingPoints(points as Coordinate[], closed);

  // See function Javadoc.
  const clockwise = dist < 0;

  let previousParallelLine = null;
  let previousPoint = null;
  let previousSegment: Segment | null = null;

  // Iterate over path points (not the padding points).
  const lastPathPointIndex = points.length - 2;
  for (let i = 0; i <= lastPathPointIndex; i++) {
    if (Coordinate.equals(points[i], points[i + 1])) {
      // No line if points are the same.
      continue;
    }
    // Calculate the line parallel to the one going through the current and next
    // points and distanced as requested to the right.
    const point1 = points[i] as Coordinate;
    const point2 = points[i + 1] as Coordinate;
    const parallelLine = calcParallelToTheRight(point1, point2, dist);
    if (!previousParallelLine) {
      // This is the first one found.
      previousParallelLine = parallelLine;
      previousPoint = points[i];
      // Make a new move segment.
      const segmentPoint = segments[i].data as Coordinate;
      previousSegment = PathSegments.createMoveSegment(
        segmentPoint.x,
        segmentPoint.y,
      );
      continue;
    }
    // Intersect it with the line parallel to the one going through the previous
    // and current points and distanced as requested to the right.
    const intersectionPoint = intersectLines(
      previousParallelLine,
      parallelLine,
    );
    // Whether the parallel segments intersect or not. They intersect if:
    // 1. The parallel lines intersect.
    // 2. The intersection point of these two lines resides inside the segments.
    let parallelSegmentsIntersect;
    if (goog.isObject(intersectionPoint)) {
      const v1 = intersectLines(
        calcPerpendicularLine(
          previousPoint as Coordinate,
          points[i] as Coordinate,
        ),
        previousParallelLine,
      ) as Coordinate;
      const v2 = intersectLines(
        calcPerpendicularLine(
          points[i] as Coordinate,
          previousPoint as Coordinate,
        ),
        previousParallelLine,
      ) as Coordinate;
      parallelSegmentsIntersect = segmentContainsPoint(
        v1,
        v2,
        intersectionPoint as Coordinate,
      );
    } else {
      parallelSegmentsIntersect = intersectionPoint === Infinity;
    }
    let parallelSegmentEndPoint;
    if (parallelSegmentsIntersect && intersectionPoint !== Infinity) {
      parallelSegmentEndPoint = intersectionPoint as Coordinate;
    } else {
      // The parallel segments do not intersect, or they are on the same line
      // and share a common vertex.
      // Instead, we will use the end point of the previous parallel segment.
      const previousPerpendicularLine = calcPerpendicularLine(
        points[i] as Coordinate,
        previousPoint as Coordinate,
      );
      parallelSegmentEndPoint = intersectLines(
        previousPerpendicularLine,
        previousParallelLine,
      ) as Coordinate;
    }
    // Add the parallel segment to the parallel path.
    asserts.assert(previousSegment !== null);
    parallelPath.addSegment(
      calcParallelSegment(previousSegment as Segment, parallelSegmentEndPoint),
    );
    if (!parallelSegmentsIntersect) {
      // We connect the two disconnected segments with an arc.

      // Calculate the angle from the current point to the end point of the
      // previous parallel segment.
      const fromRadians = Math.atan2(
        parallelSegmentEndPoint.x - points[i]!.x,
        parallelSegmentEndPoint.y - points[i]!.y,
      );
      const fromAngle = 180 - googMath.toDegrees(fromRadians);
      // Calculate the start point of the current parallel segment.
      const perpendicularLine = calcPerpendicularLine(
        points[i] as Coordinate,
        points[i + 1] as Coordinate,
      );
      const arcEndPoint = intersectLines(perpendicularLine, parallelLine);
      // Calculate the angle from the current point to the start point of the
      // current parallel segment.
      const toRadians = Math.atan2(
        (arcEndPoint as Coordinate).x - points[i]!.x,
        (arcEndPoint as Coordinate).y - points[i]!.y,
      );
      const toAngle = 180 - googMath.toDegrees(toRadians);

      asserts.assert(
        fromAngle !== toAngle,
        `Two adjacent input segments cannot be parallel, so their parallel
          segments cannot be either`,
      );
      parallelPath.addArc(
        points[i]!.x,
        points[i]!.y,
        Math.abs(dist),
        Math.abs(dist),
        fromAngle,
        toAngle,
        clockwise,
      );
    }
    previousParallelLine = parallelLine;
    previousPoint = points[i];
    previousSegment = segments[i];
  }

  if (closed) {
    parallelPath.close();
  }
  return parallelPath;
}

/**
 * Replaces the two place-holders with padding points for calcParallelPath().
 * The role of the padding points is to ensure the first and last segments in
 * the parallel path are indeed parallel to those of the original path.
 * @param points The path vertices are expected
 *     at indices [1,N-1]. Indices 0 and N are expected to hold place-holders.
 * @param closed Whether the path terminates with a CLOSE segment.
 */
function addPaddingPoints(points: Coordinate[], closed: boolean) {
  // We assume there are 2 null place-holders for the padding points, and at
  // least 2 points in the original path.
  asserts.assert(points.length >= 4);
  asserts.assert(points[0] === null);
  asserts.assert(points[points.length - 1] === null);
  const firstPoint = points[1].clone();
  const secondPoint = points[2].clone();
  const penultimatePoint = points[points.length - 3].clone();
  const lastPoint = points[points.length - 2].clone();
  if (closed) {
    // When calculating the first and last parallel points, assume that the
    // first point is preceded by the last one and the last one is succeeded by
    // the first one.
    points[0] = lastPoint;
    points[points.length - 1] = firstPoint;
  } else if (Coordinate.equals(firstPoint, lastPoint)) {
    // The path is implicitly closed - the last point equals the first one.
    // We do the same as when the path is explicitly closed, only we have to use
    // the second and penultimate points instead of the first and last.
    points[0] = penultimatePoint;
    points[points.length - 1] = secondPoint;
  } else {
    // Interpolate a point on the first line such that the first point is
    // between the second point and the interpolated one.
    const firstLine = new Line(
      firstPoint.x,
      firstPoint.y,
      secondPoint.x,
      secondPoint.y,
    );
    points[0] = firstLine.getInterpolatedPoint(-1);
    // Interpolate a point on the last line such that the last point is
    // between the penultimate point and the interpolated one.
    const lastLine = new Line(
      lastPoint.x,
      lastPoint.y,
      penultimatePoint.x,
      penultimatePoint.y,
    );
    points[points.length - 1] = lastLine.getInterpolatedPoint(-1);
  }
}

/**
 * Calculates a segment parallel to a given segment and ending at a given point.
 * @param segment The original segment.
 * @param point The end point of the parallel segment.
 * @return The parallel segment.
 */
function calcParallelSegment(segment: Segment, point: Coordinate): Segment {
  const parallelSegment = googObject.unsafeClone(segment);
  switch (segment.type) {
    // Handle the first (MOVE) segment, and any LINE segment.
    // Please note the point on the parallel path will be wrongly placed for any
    // MOVE segment that is not the first one (it will be on the parallel line,
    // but outside the parallel segment).
    // TODO(dlaliberte): Assert that there are no MOVE segments other than the
    // first one. Caller should  split the path into disconnected sub-paths,
    // pass each one separately to this function, then combine them together.
    case SegmentType.MOVE:
    case SegmentType.LINE:
      const segmentPoint = parallelSegment.data as Coordinate;
      segmentPoint.x = point.x;
      segmentPoint.y = point.y;
      break;

    case SegmentType.CURVE:
      const curvePoint = parallelSegment.data as CurveData;
      const offsetPoint = segment.data as Coordinate;
      curvePoint.x = point.x;
      curvePoint.y = point.y;
      // Shift the control points by the same offset as the point.
      const offsetX = point.x - offsetPoint.x;
      const offsetY = point.y - offsetPoint.y;
      curvePoint.x1 += offsetX;
      curvePoint.y1 += offsetY;
      curvePoint.x2 += offsetX;
      curvePoint.y2 += offsetY;
      break;

    case SegmentType.ARC:
      // TODO(dlaliberte): Handle arcs.
      asserts.fail('Calculating parallel arcs is not yet supported.');
      break;

    case SegmentType.CLOSE:
      // Nothing else to do.
      break;

    default:
      asserts.fail(`Unsupported segment type "${segment.type}"`);
  }
  return parallelSegment;
}

/**
 * Returns whether the segment from v1 to v2 contains a point p.
 * Note that p is assumed to be on the infinite line going through v1 and v2.
 * @param v1 First vertex of the segment.
 * @param v2 Second vertex of the segment.
 * @param p Point on the infinite line going through v1 and v2.
 * @return Whether the segment contains the point.
 */
export function segmentContainsPoint(
  v1: Coordinate,
  v2: Coordinate,
  p: Coordinate,
): boolean {
  return (
    Range.containsPoint(new Range(v1.x, v2.x), p.x) &&
    Range.containsPoint(new Range(v1.y, v2.y), p.y)
  );
}

/**
 * A line, represented as y = m*x + n (m is the slope, n is the intercept).
 * A vertical line is represented as {m: Infinity, n: x}.
 */
interface LineTypedef {
  m: number;
  n: number;
}

/**
 * Return the line going through two given points.
 * @param p1 The first point.
 * @param p2 The second point.
 * @return The line going through the points.
 */
export function calcLineFromTwoPoints(
  p1: Coordinate,
  p2: Coordinate,
): LineTypedef {
  asserts.assert(!Coordinate.equals(p1, p2));
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const m = dy / dx;
  if (!isFinite(m)) {
    // Vertical line.
    return {m: Infinity, n: p1.x};
  }
  const n = p1.y - m * p1.x;
  return {m, n};
}

/**
 * Return the line parallel to the one going through two given points at a given
 * distance from it. The parallel line will be to the right of the input line if
 * the distance is positive, and to its left if it is negative.
 * @param p1 The first point.
 * @param p2 The second point.
 * @param dist The requested distance.
 * @return The parallel line.
 */
export function calcParallelToTheRight(
  p1: Coordinate,
  p2: Coordinate,
  dist: number,
): LineTypedef {
  // Calculate m,n of the line going through the input points.
  // The parallel line has the same slope (m) but a different intercept (n).
  const line = calcLineFromTwoPoints(p1, p2);
  const m = line.m;
  const n = line.n;
  if (m === Infinity) {
    // Return a vertical line distanced 'dist' units from the original line.
    const dy = p2.y - p1.y;
    // Note that we assume a screen coordinate system, that is:
    //         |                Y
    //        -+-----> X        |
    // WE USE  |          NOT   |
    //         |               -+------> X
    //         Y                |
    // So in order to be to the right of the line we add 'dist' when dy < 0.
    return {m: Infinity, n: dy < 0 ? n + dist : n - dist};
  }
  // Calculate the vertical/horizontal distance between the parallel lines.
  const h = dist * Math.sqrt(1 + m * m);
  // Now we need to add the offset in the right direction to make sure the
  // parallel line comes out to the right of the original.
  const dx = p2.x - p1.x;
  // Add the vertical distance as the offset of the intercept.
  return {m, n: dx > 0 ? n + h : n - h};
}

/**
 * Return a line perpendicular to the line going through two given points, that
 * goes through the first point.
 * If the parallel line is vertical, its slope (m) will always be given as
 * Infinity (never -Infinity).
 * @param p1 The first point.
 * @param p2 The second point.
 * @return The perpendicular line.
 */
export function calcPerpendicularLine(
  p1: Coordinate,
  p2: Coordinate,
): LineTypedef {
  // Calculate slope of line going through p1 and p2: m = (y2 - y1) / (x2 - x1),
  // then calculate the inverted slope: m = -1 / m.
  let m = (p1.x - p2.x) / (p2.y - p1.y);
  let n;
  if (!isFinite(m)) {
    // Since Infinity and -Infinity mean the same in this context, always return
    // Infinity for simplicity.
    m = Infinity;
    n = p1.x;
  } else {
    n = p1.y - m * p1.x;
  }
  return {m, n};
}

/**
 * Return the intersection point of two lines.
 * Lines are represented as y = m*x + n (m is the slope, n is the intercept).
 * If the lines are parallel return null.
 * If the lines are the same return Infinity.
 * @param l1 The first line.
 * @param l2 The second line.
 * @return The intersection point, null or Infinity (see above).
 */
export function intersectLines(
  l1: LineTypedef,
  l2: LineTypedef,
): Coordinate | number | null {
  let m1 = l1.m;
  let m2 = l2.m;
  const n1 = l1.n;
  const n2 = l2.n;
  // m == Infinity and m == -Infinity mean the same.
  if (!isFinite(m1)) {
    m1 = Infinity;
  }
  if (!isFinite(m2)) {
    m2 = Infinity;
  }

  if (roughlyEquals(m1, m2)) {
    // Return Infinity for the same lines, or null for parallel lines.
    return roughlyEquals(n1, n2) ? Infinity : null;
  }
  if (m1 === Infinity) {
    // l1 is vertical, l2 is not.
    return new Coordinate(n1, m2 * n1 + n2);
  }
  if (m2 === Infinity) {
    // l2 is vertical, l1 is not.
    return new Coordinate(n2, m1 * n2 + n1);
  }
  // The lines are not vertical and have different slopes. Thus, they intersect.
  const dm = m2 - m1;
  const dn = n2 - n1;
  const n1m2 = n1 * m2;
  const m1n2 = m1 * n2;
  return new Coordinate(-dn / dm, (n1m2 - m1n2) / dm);
}

export {type LineTypedef as Line};
