/**
 * @fileoverview Linear mapper.
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
 * Maps between screen and data value ranges.
 * @final
 */
export class LinMapper implements Mapper {
  private readonly deltaQuotient: number;
  private readonly screenOffset: number;

  /**
   * @param dataMin The minimum data value.
   * @param dataMax The maximum data value.
   * @param screenMin The minimum screen value.
   * @param screenMax The maximum screen value.
   */
  constructor(
    private readonly dataMin: number,
    private readonly dataMax: number,
    private readonly screenMin: number,
    private readonly screenMax: number,
  ) {
    this.deltaQuotient =
      (this.screenMax - this.screenMin) / (this.dataMax - this.dataMin);

    this.screenOffset = this.deltaQuotient * this.dataMin - this.screenMin;
  }

  /**
   * Maps a screen value to a data value.
   * @param screenValue The screen value.
   * @return The corresponding data value.
   */
  getDataValue(screenValue: number): number {
    return (screenValue + this.screenOffset) / this.deltaQuotient;
  }

  /**
   * Maps a screen value to a data value.
   * @param dataValue The data value.
   * @return The corresponding screen value.
   */
  getScreenValue(dataValue: number): number {
    return dataValue * this.deltaQuotient - this.screenOffset;
  }

  /**
   * @return The first screen value.
   */
  getScreenStart(): number {
    return this.screenMin;
  }

  /**
   * @return The last screen value.
   */
  getScreenEnd(): number {
    return this.screenMax;
  }

  /**
   * @return The min data value.
   */
  getDataMin(): number {
    return this.dataMin;
  }

  /**
   * @return Maximum data value.
   */
  getDataMax(): number {
    return this.dataMax;
  }
}
