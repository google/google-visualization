/**
 * @fileoverview Mapper for log scale.
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

import {BoxCoxSignedMapper} from './box_cox_signed_mapper';
import {Mapper} from './mapper';
import {floor} from './pow_10_math';

/**
 * Creates a BoxCoxMapper, a log scale mapper.
 * Maps forth and back between screen values and data values. Values around
 * zero is treated specially to work around that Math.log(0) is -Infinity.
 */
export class BoxCoxMapper implements Mapper {
  /**
   * Values closer to zero than this are considered zero for log mapping to
   * work.
   */
  private readonly zeroThreshold: number;

  /**
   * The screen coordinate corresponding to the data value zero.
   */
  private readonly screenZero: number;

  private readonly mapper: BoxCoxSignedMapper | null;

  private readonly reversed: boolean;

  /**
   * @param dataMin Minimum data value.
   * @param dataMax Maximum data value.
   * @param screenStart Screen start value.
   * @param screenEnd Screen end value.
   * @param boxCoxLambda Boxcox lambda to use.
   * @param epsilonValue Closest distance to zero.
   */
  constructor(
    private readonly dataMin: number,
    private readonly dataMax: number,
    private readonly screenStart: number,
    private readonly screenEnd: number,
    readonly boxCoxLambda: number,
    private readonly epsilonValue?: number,
  ) {
    this.zeroThreshold = this.calculateZeroThreshold();

    let scrEnd: number;
    if (dataMin >= this.zeroThreshold) {
      // The entire datarange is above positive minDataValue.
      this.mapper = this.newMapper(dataMin, dataMax, screenStart, screenEnd);
      this.screenZero = Math.round(
        this.mapper.getScreenValue(this.zeroThreshold),
      );
    } else if (dataMax <= -this.zeroThreshold) {
      // The entire datarange is below negative minDataValue.
      // Create temporary mapper for finding screenZero.
      this.mapper = this.newMapper(-dataMax, -dataMin, screenEnd, screenStart);
      this.screenZero = Math.round(
        this.mapper.getScreenValue(this.zeroThreshold),
      );
      const scrStart = 2 * this.screenZero - screenEnd;
      scrEnd = 2 * this.screenZero - screenStart;
      this.mapper = this.newMapper(-dataMax, -dataMin, scrStart, scrEnd);
    } else {
      // The datarange stretches over zero.
      if (dataMin >= -this.zeroThreshold) {
        // Negative values will not be shown inside screen range.
        this.screenZero = Math.round(screenStart);
        this.mapper = this.newMapper(
          this.zeroThreshold,
          dataMax,
          this.screenZero,
          screenEnd,
        );
      } else if (dataMax <= this.zeroThreshold) {
        // Positive values will not be shown inside screen range.
        this.screenZero = Math.round(screenEnd);
        scrEnd = 2 * this.screenZero - screenStart;
        this.mapper = this.newMapper(
          this.zeroThreshold,
          -dataMin,
          this.screenZero,
          scrEnd,
        );
      } else {
        // The screenZero value will be inside screen range.
        // Create temporary mapper for ratio.
        this.mapper = this.newMapper(this.zeroThreshold, dataMax, 0, 1);
        const part = this.mapper.getScreenValue(-dataMin);
        const offset = (screenEnd - screenStart) * (part / (part + 1));
        this.screenZero = Math.round(screenStart + offset);
        if (dataMax >= -dataMin) {
          this.mapper = this.newMapper(
            this.zeroThreshold,
            dataMax,
            this.screenZero,
            screenEnd,
          );
        } else {
          scrEnd = 2 * this.screenZero - screenStart;
          this.mapper = this.newMapper(
            this.zeroThreshold,
            -dataMin,
            this.screenZero,
            scrEnd,
          );
        }
      }
    }
    this.reversed = screenEnd < screenStart;
  }

  /**
   * @return The min data value.
   */
  getDataMin(): number {
    return this.dataMin;
  }

  /**
   * @return The max data value.
   */
  getDataMax(): number {
    return this.dataMax;
  }

  /**
   * @return The first screen value.
   */
  getScreenStart(): number {
    return this.screenStart;
  }

  /**
   * @return The last screen value.
   */
  getScreenEnd(): number {
    return this.screenEnd;
  }

  /**
   * Since zero can't exist on a log scale by definition, we use a value close
   * enough for the current application and use anything within this distance to
   * zero as zero.
   * @return The value to treat as zero.
   * #visibleForTests
   */
  calculateZeroThreshold(): number {
    let zeroThreshold: number;

    if (this.dataMin === this.dataMax) {
      // No span - use single value.
      zeroThreshold = this.dataMin / 2;
      // AnyDuringMigration because:  Argument of type 'number | undefined' is
      // not assignable to parameter of type 'number'.
    } else if (!isNaN(this.epsilonValue!)) {
      zeroThreshold = this.epsilonValue! / 2;
    } else {
      // Fallback in case the epsilonValue is not provided.
      zeroThreshold = floor(this.dataMax - this.dataMin) / 1000;
    }
    return zeroThreshold;
  }

  /**
   * @param dataMin The minimum data value.
   * @param dataMax The maximum data value.
   * @param screenStart The screen start value.
   * @param screenEnd The screen end value.
   * @return A boxcox signed mapper.
   */
  private newMapper(
    dataMin: number,
    dataMax: number,
    screenStart: number,
    screenEnd: number,
  ): BoxCoxSignedMapper {
    return new BoxCoxSignedMapper(
      dataMin,
      dataMax,
      screenStart,
      screenEnd,
      this.boxCoxLambda,
    );
  }

  /**
   * Maps a screen value to a data value.
   * @param screenValue The screen value.
   * @return The corresponding data value.
   */
  getDataValue(screenValue: number): number {
    if (this.dataMin === this.dataMax) {
      return this.dataMin;
    }
    const sign = this.reversed ? -1 : 1;
    if (screenValue * sign > this.screenZero * sign) {
      return this.mapper!.getDataValue(screenValue);
    } else if (screenValue * sign < this.screenZero * sign) {
      return -this.mapper!.getDataValue(2 * this.screenZero - screenValue);
    } else {
      return 0;
    }
  }

  /**
   * Maps a data value to a screen value.
   * @param dataValue The data value.
   * @return The corresponding screen value.
   */
  getScreenValue(dataValue: number): number {
    if (this.dataMin === this.dataMax) {
      return Math.abs(this.screenStart - this.screenEnd) / 2;
    }
    if (dataValue > this.zeroThreshold) {
      return this.mapper!.getScreenValue(dataValue);
    } else if (dataValue < -this.zeroThreshold) {
      return 2 * this.screenZero - this.mapper!.getScreenValue(-dataValue);
    } else {
      return this.screenZero;
    }
  }
}
