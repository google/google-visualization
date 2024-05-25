/**
 * @fileoverview Global math functions.
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

/**
 * Implements the secant function.
 * @param x A number.
 * @return The secant of x.
 */
export function sec(x: number): number {
  return 1 / Math.cos(x);
}

/**
 * Implements the cotangent function.
 * @param x A number.
 * @return The cotangent of x.
 */
export function cot(x: number): number {
  return 1 / Math.tan(x);
}
