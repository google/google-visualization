/**
 * @fileoverview Mapper interface. A mapper maps forth and back between data
 * values and screen values. Implementors are linear and logarithmic mappers.
 *
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

/**
 * A mapper maps data values to screen values and vice versa.
 */
export interface Mapper {
  /**
   * Maps a data value to a screen position.
   * @param dataValue The data value to map.
   * @return The corresponding screen position.
   */
  getScreenValue(dataValue: number): number;

  /**
   * Maps screen positions to data values.
   * @param screenValue The screen position to map.
   * @return The corresponding data value.
   */
  getDataValue(screenValue: number): number;

  /**
   * @return The end screen position.
   */
  getScreenStart(): number;

  /**
   * @return The start screen position.
   */
  getScreenEnd(): number;

  /**
   * @return The minimum data value.
   */
  getDataMin(): number;

  /**
   * @return The maximum data value.
   */
  getDataMax(): number;
}
