/**
 * @fileoverview Vector and coordinate utilities using Three.js.
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

import { Vector2, Vector3 } from 'three';

// Type aliases for compatibility with existing code
export type Vec2 = Vector2;
export type Coordinate = Vector2;

/**
 * Simple interface for x,y coordinate pairs.
 * Like Coordinate but with a simpler interface.
 */
export interface XYPair {
  readonly x: number;
  readonly y: number;
}

/**
 * Creates a new Vector2 instance.
 * @param x The x coordinate.
 * @param y The y coordinate.
 * @return A new Vector2 instance.
 */
export function createVec2(x: number, y: number): Vector2 {
  return new Vector2(x, y);
}

/**
 * Creates a new Vector3 instance.
 * @param x The x coordinate.
 * @param y The y coordinate.
 * @param z The z coordinate.
 * @return A new Vector3 instance.
 */
export function createVec3(x: number, y: number, z: number): Vector3 {
  return new Vector3(x, y, z);
}

/**
 * Calculates the difference between two vectors (v1 - v2).
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @return A new vector representing the difference.
 */
export function vec2Difference(v1: Vector2, v2: Vector2): Vector2 {
  return v1.clone().sub(v2);
}

/**
 * Calculates the sum of two vectors (v1 + v2).
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @return A new vector representing the sum.
 */
export function vec2Sum(v1: Vector2, v2: Vector2): Vector2 {
  return v1.clone().add(v2);
}

/**
 * Calculates the difference between two 3D vectors (v1 - v2).
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @return A new vector representing the difference.
 */
export function vec3Difference(v1: Vector3, v2: Vector3): Vector3 {
  return v1.clone().sub(v2);
}

/**
 * Calculates the sum of two 3D vectors (v1 + v2).
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @return A new vector representing the sum.
 */
export function vec3Sum(v1: Vector3, v2: Vector3): Vector3 {
  return v1.clone().add(v2);
}

/**
 * Calculates the dot product of two 2D vectors.
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @return The dot product.
 */
export function vec2Dot(v1: Vector2, v2: Vector2): number {
  return v1.dot(v2);
}

/**
 * Calculates the cross product of two 2D vectors (returns scalar).
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @return The cross product (scalar for 2D vectors).
 */
export function vec2Cross(v1: Vector2, v2: Vector2): number {
  return v1.x * v2.y - v1.y * v2.x;
}

/**
 * Calculates the distance between two 2D points.
 * @param v1 The first point.
 * @param v2 The second point.
 * @return The distance between the points.
 */
export function vec2Distance(v1: Vector2, v2: Vector2): number {
  return v1.distanceTo(v2);
}

/**
 * Calculates the squared distance between two 2D points.
 * More efficient than distance when you only need to compare distances.
 * @param v1 The first point.
 * @param v2 The second point.
 * @return The squared distance between the points.
 */
export function vec2DistanceSquared(v1: Vector2, v2: Vector2): number {
  return v1.distanceToSquared(v2);
}

/**
 * Normalizes a 2D vector to unit length.
 * @param v The vector to normalize.
 * @return A new normalized vector.
 */
export function vec2Normalize(v: Vector2): Vector2 {
  return v.clone().normalize();
}

/**
 * Scales a 2D vector by a scalar value.
 * @param v The vector to scale.
 * @param scalar The scalar value.
 * @return A new scaled vector.
 */
export function vec2Scale(v: Vector2, scalar: number): Vector2 {
  return v.clone().multiplyScalar(scalar);
}

/**
 * Rotates a 2D vector by an angle in radians.
 * @param v The vector to rotate.
 * @param angle The angle in radians.
 * @return A new rotated vector.
 */
export function vec2Rotate(v: Vector2, angle: number): Vector2 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return new Vector2(
    v.x * cos - v.y * sin,
    v.x * sin + v.y * cos
  );
}

/**
 * Gets the angle of a 2D vector in radians.
 * @param v The vector.
 * @return The angle in radians.
 */
export function vec2Angle(v: Vector2): number {
  return Math.atan2(v.y, v.x);
}

/**
 * Gets the angle between two 2D vectors in radians.
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @return The angle between the vectors in radians.
 */
export function vec2AngleBetween(v1: Vector2, v2: Vector2): number {
  return v1.angleTo(v2);
}

/**
 * Linearly interpolates between two 2D vectors.
 * @param v1 The start vector.
 * @param v2 The end vector.
 * @param t The interpolation factor (0-1).
 * @return The interpolated vector.
 */
export function vec2Lerp(v1: Vector2, v2: Vector2, t: number): Vector2 {
  return v1.clone().lerp(v2, t);
}

/**
 * Reflects a vector across a normal vector.
 * @param v The vector to reflect.
 * @param normal The normal vector to reflect across.
 * @return The reflected vector.
 */
export function vec2Reflect(v: Vector2, normal: Vector2): Vector2 {
  const normalizedNormal = vec2Normalize(normal);
  const dotProduct = vec2Dot(v, normalizedNormal);
  return vec2Difference(v, vec2Scale(normalizedNormal, 2 * dotProduct));
}

/**
 * Projects vector v1 onto vector v2.
 * @param v1 The vector to project.
 * @param v2 The vector to project onto.
 * @return The projected vector.
 */
export function vec2Project(v1: Vector2, v2: Vector2): Vector2 {
  const dotProduct = vec2Dot(v1, v2);
  const v2LengthSquared = v2.lengthSq();
  if (v2LengthSquared === 0) {
    return new Vector2(0, 0);
  }
  return vec2Scale(v2, dotProduct / v2LengthSquared);
}

/**
 * Checks if two vectors are approximately equal within a tolerance.
 * @param v1 The first vector.
 * @param v2 The second vector.
 * @param tolerance The tolerance for comparison.
 * @return True if the vectors are approximately equal.
 */
export function vec2ApproximatelyEqual(
  v1: Vector2,
  v2: Vector2,
  tolerance = 0.00001
): boolean {
  return Math.abs(v1.x - v2.x) <= tolerance && Math.abs(v1.y - v2.y) <= tolerance;
}

/**
 * Converts an XYPair to a Vector2.
 * @param pair The XYPair to convert.
 * @return A new Vector2 instance.
 */
export function xyPairToVec2(pair: XYPair): Vector2 {
  return new Vector2(pair.x, pair.y);
}

/**
 * Converts a Vector2 to an XYPair.
 * @param v The Vector2 to convert.
 * @return An XYPair object.
 */
export function vec2ToXYPair(v: Vector2): XYPair {
  return { x: v.x, y: v.y };
}

/**
 * Creates a vector from polar coordinates.
 * @param radius The radius (distance from origin).
 * @param angle The angle in radians.
 * @return A new Vector2 instance.
 */
export function vec2FromPolar(radius: number, angle: number): Vector2 {
  return new Vector2(radius * Math.cos(angle), radius * Math.sin(angle));
}

/**
 * Converts a vector to polar coordinates.
 * @param v The vector to convert.
 * @return An object with radius and angle properties.
 */
export function vec2ToPolar(v: Vector2): { radius: number; angle: number } {
  return {
    radius: v.length(),
    angle: vec2Angle(v)
  };
}

/**
 * Clamps a vector's components to specified ranges.
 * @param v The vector to clamp.
 * @param minX The minimum x value.
 * @param maxX The maximum x value.
 * @param minY The minimum y value.
 * @param maxY The maximum y value.
 * @return A new clamped vector.
 */
export function vec2Clamp(
  v: Vector2,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number
): Vector2 {
  return new Vector2(
    Math.min(Math.max(v.x, minX), maxX),
    Math.min(Math.max(v.y, minY), maxY)
  );
}

/**
 * Gets the perpendicular vector (rotated 90 degrees counter-clockwise).
 * @param v The input vector.
 * @return The perpendicular vector.
 */
export function vec2Perpendicular(v: Vector2): Vector2 {
  return new Vector2(-v.y, v.x);
}
