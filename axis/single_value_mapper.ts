/**
 * @fileoverview Mapper for the special case where there's only one data value.
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

import {Mapper} from './mapper';

/**
 * Creates a single value mapper that maps the single value to the middle of
 * the given screen range.
 */
export class SingleValueMapper implements Mapper {
  /**
   * @param dataValue The data value.
   * @param screenStart Screen start value.
   * @param screenEnd Screen end value.
   */
  constructor(
    public dataValue: number,
    public screenStart: number,
    public screenEnd: number,
  ) {}

  /**
   * Maps a data value to a screen position.
   * @param dataValue The data value to map.
   * @return The corresponding screen position.
   */
  getScreenValue(dataValue: number): number {
    return (this.screenEnd - this.screenStart) / 2 + this.screenStart;
  }

  /**
   * Maps screen positions to data values.
   * @param screenValue The screen position to map.
   * @return The corresponding data value.
   */
  getDataValue(screenValue: number): number {
    return this.dataValue;
  }

  /**
   * @return The end screen position.
   */
  getScreenStart(): number {
    return this.screenStart;
  }

  /**
   * @return The start screen position.
   */
  getScreenEnd(): number {
    return this.screenEnd;
  }

  /**
   * @return The minimum data value.
   */
  getDataMin(): number {
    return this.dataValue;
  }

  /**
   * @return The maximum data value.
   */
  getDataMax(): number {
    return this.dataValue;
  }
}
