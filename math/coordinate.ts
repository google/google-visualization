/**
 * @fileoverview Math tools for gviz.
 *
 * Some of the closure math classes are not serializable. Duplicate just the
 * functionality we need.
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

export class Coordinate {
  /**
   * Creates a Coordinate with the supplied x, y values.
   * @param x The x coordinate or 0 if missing.
   * @param y The y coordinate or 0 if missing.
   */
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  /**
   * Clones the Coordinate.
   * @param c The coordinate to clone.
   * @return The cloned coordinate.
   */
  static clone(c: Coordinate): Coordinate {
    return new Coordinate(c.x, c.y);
  }

  /**
   * Clones this.
   * @return The cloned coordinate.
   */
  clone(): Coordinate {
    return Coordinate.clone(this);
  }
}
