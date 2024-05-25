/**
 * @fileoverview Signed mapper for signed values.
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
 * Performs mapping between data values and screen values using a boxcox
 * scale. The set of data values must be all positive or all negative. For
 * mapping a combination of positive and negative data values, use
 * <code>gviz.canviz.axis.BoxCoxMapper</code>.
 * <p>A boxcox scale varies continuously with the boxcox lambda value
 * where lambda 1 gives a linear scale and lambda 0 gives a logarithmic
 * scale.
 *
 * Note: This is not a real Mapper, but only a helper for BoxCoxMapper.
 */
export class BoxCoxSignedMapper {
  private readonly deltaQuotient: number;
  private readonly screenOffset: number;

  /**
   * @param dataMin The minimum data value.
   * @param dataMax The maximum data value.
   * @param screenStart The first screen value.
   * @param screenEnd The last screen value.
   * @param boxCoxLambda The boxcox lambda. 1 = lin, 0 = log.
   */
  constructor(
    dataMin: number,
    private readonly dataMax: number,
    screenStart: number,
    screenEnd: number,
    private readonly boxCoxLambda: number,
  ) {
    const boxCoxDataStart = this.boxCox(dataMin);
    const boxCoxDataDelta = this.boxCox(dataMax) - boxCoxDataStart;

    /**
     * Screen range per data range.
     */
    this.deltaQuotient = (screenEnd - screenStart) / boxCoxDataDelta;

    /**
     * Offset to add or subtract at mapping.
     */
    this.screenOffset = this.deltaQuotient * boxCoxDataStart - screenStart;
  }

  /**
   * Converts data value to screen value.
   * @param dataValue The data value.
   * @return The corresponding screen value.
   */
  getScreenValue(dataValue: number): number {
    return this.boxCox(dataValue) * this.deltaQuotient - this.screenOffset;
  }

  /**
   * Converts screen value to data value.
   * @param screenValue The screen value.
   * @return The corresponding data value.
   */
  getDataValue(screenValue: number): number {
    const dataValue = this.antiBoxCox(
      (screenValue + this.screenOffset) / this.deltaQuotient,
    );
    // Note: special case to avoid returning infinity.
    return isFinite(dataValue) ? dataValue : this.dataMax;
  }

  /**
   * Applies the box cox mapping to the value.
   * @param value The value.
   * @return The result.
   */
  private boxCox(value: number): number {
    switch (this.boxCoxLambda) {
      case 0:
        return Math.log(value);
      case 1:
        return value;
      default:
        return (Math.pow(value, this.boxCoxLambda) - 1) / this.boxCoxLambda;
    }
  }

  /**
   * Applies the reversed box cox mapping to the value.
   * @param value The value.
   * @return The result.
   */
  private antiBoxCox(value: number): number {
    switch (this.boxCoxLambda) {
      case 0:
        return Math.pow(Math.E, value);
      case 1:
        return value;
      default:
        return Math.pow(value * this.boxCoxLambda + 1, 1 / this.boxCoxLambda);
    }
  }
}
