/**
 * @fileoverview Global vector utilities for charting.
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

import * as googMath from '@npm//@closure/math/math';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import {Size} from '@npm//@closure/math/size';
import {Vec2} from '@npm//@closure/math/vec2';

/**
 * Rounds the coordinates of a vector.
 * @param vec A vector to be rounded.
 * @return The rounded vector.
 */
export function round(vec: Vec2): Vec2 {
  return new Vec2(Math.round(vec.x), Math.round(vec.y));
}

/**
 * Sums a variable number of vectors.
 * @param vectors Vectors to be summed.
 * @return The sum of all vectors.
 */
export function sumAll(...vectors: Vec2[]): Vec2 {
  let total = new Vec2(0, 0);
  for (const vec of vectors) {
    total = Vec2.sum(vec, total);
  }
  return total;
}

/**
 * Sums a variable number of sizes.
 * @param sizes Sizes to be summed.
 * @return The sum of all sizes.
 */
export function sumOfSizes(...sizes: Size[]): Size {
  let total = new Size(0, 0);
  for (const size of sizes) {
    total = new Size(size.width + total.width, size.height + total.height);
  }
  return total;
}

/**
 * Creates a vector of a given magnitude, pointing in a given direction.
 * @param angle The direction (in radians) to which the vector would point.
 * @param magnitude A positive number specifying the desired norm of the vector.
 * @return The created vector.
 */
export function vectorInDirection(angle: number, magnitude: number): Vec2 {
  return vectorOnEllipse(angle, magnitude, magnitude);
}

/**
 * Creates a vector on an ellipse given a specific angle.
 * @param angle The angle (in radians).
 * @param radiusX The x radius of the ellipse.
 * @param radiusY The y radius of the ellipse.
 * @return The created vector.
 */
export function vectorOnEllipse(
  angle: number,
  radiusX: number,
  radiusY: number,
): Vec2 {
  return new Vec2(Math.cos(angle) * radiusX, Math.sin(angle) * radiusY);
}

/**
 * Converts an [x,y] pair to a Vector2D object.
 * @param pair The [x,y] pair.
 * @return the constructed vector.
 */
export function pairToVector(pair: number[]): Vec2 {
  return new Vec2(pair[0], pair[1]);
}

/**
 * Converts an array of [x,y] pairs to an array of Vector2D objects.
 * @param pairs An array of [x,y] pairs.
 * @return The constructed array of vectors.
 */
export function pairsToVectors(pairs: number[][]): Vec2[] {
  return pairs.map(pairToVector);
}

/**
 * Calculates, given size of rectangle, a vector running along one of the
 * diagonals of a rectangle. Specifically, the one with positive x and y values.
 * @param rectangleSize The size of the rectangle.
 * @return The diagonal vector.
 */
export function rectangleDiagonal(rectangleSize: Size): Vec2 {
  return new Vec2(rectangleSize.width, rectangleSize.height);
}

/**
 * Returns, given a rectangle's center and its size, the coordinates of its four
 * corners starting from the one with smallest x and y values, then going around
 * rectangle in anti clockwise direction (when using normal geometry in which up
 * means higher values than down).
 * @param center The center of the rectangle.
 * @param size The size of the rectangle.
 * @return An array enumerating the 4 corners of the rectangle.
 */
export function cornersOfRectangle(center: Vec2, size: Size): Vec2[] {
  return pairsToVectors([
    [center.x - size.width / 2, center.y - size.height / 2],
    [center.x + size.width / 2, center.y - size.height / 2],
    [center.x + size.width / 2, center.y + size.height / 2],
    [center.x - size.width / 2, center.y + size.height / 2],
  ]);
}

/**
 * Calculates the point along a given ray where a rectangle should be positioned
 * in order for it be adjacent to a perpendicular crossing the ray at a given
 * point.
 * @param ray A vector along which the center of the rectangle should be
 *     positioned. Ray's length denotes the point on which the perpendicular
 *     crosses the ray.
 * @param rectangleSize The size of the rectangle.
 * @param isInside A flag that denotes on what side of the perpendicular the
 *     rectangle should be positioned. True means closer to the origin.
 * @return Center of the calculated rectangle.
 */
export function centerOfRectangleAdjacentToPerpendicular(
  ray: Vec2,
  rectangleSize: Size,
  isInside: boolean,
): Vec2 {
  // Square of magnitude.
  const squaredMagnitude = ray.squaredMagnitude();
  if (squaredMagnitude === 0) {
    return new Vec2(0, 0);
  }
  // The four corners of the rectangle whose center is on the intersection
  // of the ray and the perpendicular are all candidates for where the output
  // rectangle center should be. Depending on whether the rectangle should be
  // in or out of circle, the candidate with the highest or lowest dot product
  // should be chosen as it is the one farthest away from the perpendicular.
  const candidates = cornersOfRectangle(ray, rectangleSize);
  const scores = candidates.map((candidate) => Vec2.dot(candidate, ray));
  // Wrapped comparison function. Can't use min or max as they accept variable
  // number of arguments and thus incompatible with reduce, so we have to wrap
  // them.
  const f = (a: number, b: number) =>
    isInside ? Math.min(a, b) : Math.max(a, b);
  const winningScore = scores.reduce(f, isInside ? Infinity : -Infinity);
  // The winning score is actually the dot product of our winner and the ray.
  // It can thus be very easily used in order to calculate the winner's
  // projection on the ray, using the following formula for projecting a vector:
  // p(u) = v * <u,v> / (|v|^2)
  // (projection of u on v)
  ray = ray.clone();
  ray.scale(winningScore / squaredMagnitude);
  return ray;
}

/**
 * Creates a rectangle using two opposite corners as an input. Not necessarily
 * top left and bottom right. If, for example, the points given are (0, 1) and
 * (1, 0) the rectangle returned will have its top left corner at (0, 0) and its
 * width and height will be 1.
 * @param x1 The x coordinate of first corner.
 * @param y1 The y coordinate of first corner.
 * @param x2 The x coordinate of second corner.
 * @param y2 The y coordinate of second corner.
 * @return A rectangle containing both points.
 */
export function cornersToRectangle(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): GoogRect {
  return new GoogRect(
    Math.min(x1, x2),
    Math.min(y1, y2),
    Math.abs(x2 - x1),
    Math.abs(y2 - y1),
  );
}

/**
 * Positions a box of given size inside a slice of an ellipse. Positions the box
 * so it touches the ellipse edges and its center lays on a ray passing through
 * the elliptic slice and dividing it into two almost equal parts (almost
 * because it's an ellipse and not a circle, so to be more accurate - the ray
 * that points towards the middle of the slice arc in elliptic angles).
 * If the text box size cannot be positioned within the slice while conforming
 * to some given constraints, the function returns null.
 *
 * @param radiusX The ellipse radius on the x axis.
 * @param radiusY The ellipse radius on the y axis.
 * @param fromAngle The elliptic angle in radians the slice starts from
 *     (starting from positive x axis progressing toward positive y).
 * @param toAngle The elliptic angle in radians the slice ends at. The slice is
 *     considered the area starting at fromAnlge, counting upward till reaching
 *     toAngle modulo 2 pi. So fromAngle does not have to be numerically smaller
 *     than toAngle.
 * @param boxSize The box size.
 * @param paddingToSliceBoundaries Number of pixels from slice boundaries the
 *     box can be positioned at. Notice the box is positioned on slice arc, so
 *     this parameter only affects distance from slices' sides. Defaults to
 *     zero.
 * @param paddingToCenter Relative part of radius under which the center of the
 *     box must not be positioned, thus making sure the box is not too close to
 *     the center. Defaults to zero.
 * @return The center of the positioned box, or null if it could not be
 *     positioned while conforming to the above constraints.
 */
export function positionBoxInEllipticSlice(
  radiusX: number,
  radiusY: number,
  fromAngle: number,
  toAngle: number,
  boxSize: Size,
  paddingToSliceBoundaries?: number,
  paddingToCenter?: number,
): Vec2 | null {
  // Convert to unit circle domain, that is stretch the 2d space so our ellipse
  // becomes a circle of radius one and then perform all calculations in that
  // domain.
  const stretchedTextBoxSize = new Size(
    boxSize.width / radiusX,
    boxSize.height / radiusY,
  );
  const stretchedPadding = new Size(
    (paddingToSliceBoundaries || 0) / radiusX,
    (paddingToSliceBoundaries || 0) / radiusY,
  );
  // Calculate distance (in unit circle domain) from circle center to box
  // center.
  const stretchedTextBoxCenter = positionBoxInSliceOfAUnitCircle(
    fromAngle,
    toAngle,
    stretchedTextBoxSize,
    stretchedPadding,
    paddingToCenter || 0,
  );
  // Might have returned null if text does not fit, if so return null,
  // otherwise stretch result back to original coordinate space and return.
  return (
    stretchedTextBoxCenter &&
    new Vec2(
      stretchedTextBoxCenter.x * radiusX,
      stretchedTextBoxCenter.y * radiusY,
    )
  );
}

/**
 * Positions a box of given size inside a slice of a unit circle. Positions it
 * so it touches the slice arc and its center is positioned on ray connecting
 * circle center and center of arc.
 * @param fromAngle The angle in radians the slice starts from (starting from
 *     positive x axis progressing toward positive y).
 * @param toAngle The angle in radians the slice ends at.
 * @param boxSize The box size.
 * @param paddingToSliceBoundaries The size of the padding around the box not
 *     allowing the box to be positioned too close to slice straight boundaries.
 *     The padding width being the left and right padding, its height being the
 *     top and bottom padding.
 * @param paddingToCenter Relative part of radius under which the center of the
 *     box must not be positioned, thus making sure the box is not too close to
 *     the center. Defaults to zero.
 * @return The center of the positioned box, or null if it could not be
 *     positioned while conforming to the above constraints.
 */
function positionBoxInSliceOfAUnitCircle(
  fromAngle: number,
  toAngle: number,
  boxSize: Size,
  paddingToSliceBoundaries: Size,
  paddingToCenter: number,
): Vec2 | null {
  // Now the general strategy is to fix our box's center at zero, and calculate
  // the location where a circle should be centered for all the constraints to
  // hold.
  // Direction of circle center relative to text box center is exactly
  // opposite to the vector pointing from circle center to the middle of the
  // slice's arc.
  const bisectionInverseAngle = (fromAngle + toAngle) / 2 + Math.PI;
  const circleCenterDirection = vectorInDirection(bisectionInverseAngle, 1);
  const zeroCenteredBoxCorners = cornersOfRectangle(new Vec2(0, 0), boxSize);
  // So how far along that direction should the circle be centered for it to
  // touch the textbox in one corner and contain the rest?
  const distanceToCircleCenter = circleAdjacentToConvexShape(
    circleCenterDirection,
    zeroCenteredBoxCorners,
    false,
  );
  // Make sure we're not too close to center.
  if (distanceToCircleCenter == null) {
    return null;
  }
  if (paddingToCenter != null && distanceToCircleCenter < paddingToCenter) {
    return null;
  }
  // Calculates location of box center relative to circle center, whose length
  // is distanceToCircleCenter and direction is exactly opposite to
  // circleCenterDirection.
  const boxCenter = circleCenterDirection.clone();
  boxCenter.scale(-distanceToCircleCenter);

  // Add padding twice top-left and bottom-right.
  const sizeIncludingPadding = sumOfSizes(
    boxSize,
    paddingToSliceBoundaries,
    paddingToSliceBoundaries,
  );

  // Make sure corners + padding (and their convex hull) are inside slice. It's
  // already guaranteed (by circleAdjacentToConvexShape) that it is inside the
  // circle, so only need to make sure it's within the slice angle interval.
  const inSlice = isConvexShapeInInfiniteSlice(
    cornersOfRectangle(boxCenter, sizeIncludingPadding),
    fromAngle,
    toAngle,
  );

  return inSlice ? boxCenter : null;
}

/**
 * Position a unit circle along a given ray so that it is adjacent to a given
 * convex shape. Makes sure the circle's center is on the ray and in its
 * direction (the ray is considered uni-directional). The given convex shape
 * must contain zero in its interior and have all it's vertices magnitude
 * smaller than one, or otherwise it is not guaranteed that the circle chosen is
 * actually adjacent to the convex shape. The above precondition can be relaxed
 * if isConvexOutsideCircle is set to false (simply because in that case there
 * is no requirement for the circle to contain the convex shape).
 *
 * @param direction The direction of the ray pointing from zero to the center of
 *     the circle. Must be of length one.
 * @param vertices The points that define the convex shape.
 * @param isConvexOutsideCircle Should the chosen circle be outside the convex
 *     shape? defaults to false (only guaranteed to work under the preconditions
 *     described above).
 * @return The distance along the ray at which the center should be positioned,
 *     or null if no circle can be positioned under the above constraints.
 */
export function circleAdjacentToConvexShape(
  direction: Vec2,
  vertices: Vec2[],
  isConvexOutsideCircle: boolean,
): number | null {
  let distance = 1;
  const reducer = isConvexOutsideCircle ? Math.max : Math.min;
  for (let i = 0; i < vertices.length; ++i) {
    const points = pointsOnLineOfDistanceOneToPoint(direction, vertices[i]);
    // Points are sorted, so if higher one is smaller than zero, both are.
    if (points === null || points[1] < 0) {
      return null;
    }
    distance = reducer(distance, points[1]);
  }
  return distance;
}

/**
 * Calculates, given a ray and a point in 2d space, the two locations along the
 * ray whose distance to the given point is one. If no such exits, returns null,
 * If there is only one, both returned distances are identical.
 * @param ray The unit vector defining the ray. Its magnitude must be one, and
 *     the direction it points to defines the direction a positive value in the
 *     return value points to.
 * @param point The point to which the distance is measured.
 * @return A pair - the two points on the ray of distance one to given point, or
 *     null if no such points can be found. Given as a sorted array of distances
 *     along the given ray.
 */
export function pointsOnLineOfDistanceOneToPoint(
  ray: Vec2,
  point: Vec2,
): number[] | null {
  // Strategy: solve the quadratic equation |ar - p| = 1 (r is ray, p is point)
  // which drills down to: 0 = (a^2)|r|^2 - 2a<r, p> + (|p| - 1).
  // Solving and simplifying (remember |r| = 1) leads us to:
  //   a = <r, p> +- sqrt(<r, p> ^ 2  - |p| ^ 2 + 1).
  const squareNormP = point.squaredMagnitude();
  const rayDotPoint = Vec2.dot(ray, point);
  const dext = rayDotPoint * rayDotPoint + 1 - squareNormP;
  if (dext < 0) {
    return null;
  }
  const sqrtDext = Math.sqrt(dext);
  return [rayDotPoint - sqrtDext, rayDotPoint + sqrtDext];
}

/**
 * Checks whether a convex shape is contained within a given infinite slice.
 * Within means it does not include the origin, and does not touch the
 * boundaries (within the interior).
 * @param vertices The vertices defining the convex shape.
 * @param fromAngle The angle in radians from which the slice starts.
 * @param toAngle The angle in radians where the slice ends.
 * @return Whether the shape is fully contained in the slice.
 */
export function isConvexShapeInInfiniteSlice(
  vertices: Vec2[],
  fromAngle: number,
  toAngle: number,
): boolean {
  const range = googMath.modulo(toAngle - fromAngle, Math.PI * 2);
  // Calculate the maximal and minimal radial differences to fromAngle while
  // making sure none are larger than toAngle.
  let max = 0;
  let min = range;
  for (let i = 0; i < vertices.length; ++i) {
    const angle = Math.atan2(vertices[i].y, vertices[i].x);
    const angleMinusFrom = googMath.modulo(angle - fromAngle, Math.PI * 2);
    if (angleMinusFrom >= range || angleMinusFrom === 0) {
      return false;
    }
    min = Math.min(angleMinusFrom, min);
    max = Math.max(angleMinusFrom, max);
  }
  // One last check - if vertices' range of angles is more than half of the
  // whole circle, their convex hull cannot be contained within the slice unless
  // the slice is a whole circle which is not the case.
  return max - min < Math.PI;
}
