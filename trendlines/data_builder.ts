/**
 * @fileoverview This file provides the data builder for trendlines.
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

import * as numberScale from '../common/number_scale_util';

/**
 * Given the parameters for a trendline, compiles data such that the data has
 * a reasonable density.
 * @unrestricted
 */
export class DataBuilder {
  private readonly data: number[][] = [];

  /**
   * @param maxgap The maximum gap size that should appear. Anything bigger than this number will be broken down.
   * @param yFunction The function that should be used to calculate the y values.
   * @param domainScale The scale to convert from data-space to screen-space and back.
   */
  constructor(
    private readonly maxgap: number,
    private readonly yFunction: Function,
    domainScale?: numberScale.Converter,
  ) {}

  /**
   * Given the domain value, calculates the data value and adds both to the
   * dataset.
   * @param x The domain value that should be added.
   */
  private addDataInternal(x: number) {
    this.data.push([x, this.yFunction(x)]);
  }

  /**
   * Given the domain value, calculates the data value and adds both to the
   * dataset. This will also break this datum into multiple points if the gap
   * between this datum and the last added datum is too big.
   * @param x The domain value.
   */
  addData(x: number) {
    if (this.data.length > 0) {
      const tlastData = this.data[this.data.length - 1][0];
      const gap = x - tlastData;
      if (gap > this.maxgap) {
        const insertCount = Math.round(gap / this.maxgap);
        if (insertCount > 1) {
          for (let i = 1; i < insertCount; i++) {
            this.addDataInternal(
              (x - tlastData) * (i / insertCount) + tlastData,
            );
          }
        }
      }
    }
    this.addDataInternal(x);
  }

  /**
   * Build the data array.
   * @return The data array.
   */
  build(): number[][] {
    return this.data;
  }
}
