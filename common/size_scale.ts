/**
 * @fileoverview A utility for scaling values of size dimension.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import * as googMath from '@npm//@closure/math/math';
import {Range} from '@npm//@closure/math/range';

import * as numberScale from './number_scale_util';
import {Options} from './options';
import {getOverriddenRange} from './util';

/**
 * A converter that transforms a size value to a radius in pixels. The
 * conversion is done quadratically because the value should be proportional to
 * the area of the bubble, and not to its radius.
 * @unrestricted
 */
export class SizeScale {
  private readonly minArea: number;
  private readonly maxArea: number;
  private readonly valueRange: Range | null;
  private readonly rangeWidth: number | null;
  /**
   * @param minRadius The minimum radius to output.
   * @param maxRadius The maximum radius to output.
   * @param valueRange The range of values in the given data.
   * @param numberScale The scale by which to handle
   *     the values. Can be null only if valueRange is null.
   */
  constructor(
    minRadius: number,
    private readonly maxRadius: number,
    valueRange: Range | null,
    private readonly numberScale: numberScale.Converter | null,
  ) {
    /**
     * We want the given value to be proportional to the area of the bubble, and
     * not to its radius. The area is proportional to the square of the radius
     * so here we calculate the "area" which is not the exact area, but is
     * proportional to it.
     */
    this.minArea = Math.pow(minRadius, 2);

    this.maxArea = Math.pow(maxRadius, 2);

    /**
     * The range of the values. This is the same as the valueRange argument,
     * only after transformation done using the numberScale.
     */
    this.valueRange = valueRange
      ? new Range(
          numberScale!.transform(valueRange.start),
          numberScale!.transform(valueRange.end),
        )
      : null;

    this.rangeWidth = this.valueRange
      ? this.valueRange.end - this.valueRange.start
      : null;
  }

  /**
   * Returns the radius associated with the given value. The returned radius is
   * an interpolation between the min radius and max radius, such that the area
   * created by that radius is proportional to the value.
   * @param value The value to interpolate according to.
   * @return The radius associated with the value given.
   */
  getRadiusFor(value: number | null): number {
    // If the given value is less than the minimum value, return the minimum
    // radius.
    let area = null;
    if (value != null && this.numberScale != null) {
      value = this.numberScale.transform(value);
    }
    if (value != null && this.valueRange != null) {
      if (this.rangeWidth === 0 && value === this.valueRange.start) {
        area = (this.maxArea + this.minArea) / 2;
      } else if (value <= this.valueRange.start) {
        area = this.minArea;
      } else if (value >= this.valueRange.end) {
        area = this.maxArea;
      }
    } else if (!this.rangeWidth || /* null or zero */ value == null) {
      return this.maxRadius;
    }

    if (area == null) {
      asserts.assert(this.numberScale != null);
      value = googMath.clamp(
        value,
        this.valueRange!.start,
        this.valueRange!.end,
      );
      const relativeValue = (value - this.valueRange!.start) / this.rangeWidth!;
      area = googMath.lerp(this.minArea, this.maxArea, relativeValue);
    }
    // And now we find the square root of the calculated area, to get the
    // radius. A simple square root is enough, because when calculating the
    // area we just squared the radius.
    return Math.round(Math.sqrt(area));
  }

  /**
   * Creates a new SizeScale instance, based on the 'sizeAxis' path in the
   * options and the range of values in the data.
   * @param options The options.
   * @param valueRange The range of values in the given data.
   * @return The result SizeScale.
   */
  static create(options: Options, valueRange: Range | null): SizeScale {
    const optionsPath = 'sizeAxis.';

    // Reading the min/max radius of the bubbles.
    const minRadius = options.inferNonNegativeNumberValue(
      `${optionsPath}minSize`,
    );
    const maxRadius = options.inferNonNegativeNumberValue(
      `${optionsPath}maxSize`,
    );
    if (minRadius > maxRadius) {
      throw new Error(
        `${optionsPath}minSize (${minRadius}) must be at most ${optionsPath}maxSize (${maxRadius})`,
      );
    }

    // Reading the min/max values. This can override the values in the data
    // table.
    const userMinValue = options.inferOptionalNumberValue(
      `${optionsPath}minValue`,
    );
    const userMaxValue = options.inferOptionalNumberValue(
      `${optionsPath}maxValue`,
    );
    if (userMinValue != null && userMaxValue != null) {
      if (userMinValue > userMaxValue) {
        throw new Error(
          `${optionsPath}minValue (${userMinValue}) must be at most ${optionsPath}maxValue (${userMaxValue})`,
        );
      }
    }
    const newValueRange = getOverriddenRange(
      valueRange,
      userMinValue,
      userMaxValue,
    );

    const scaleType = numberScale.getScaleType(
      options,
      optionsPath + numberScale.LOG_SCALE_OPTIONS_KEY,
      optionsPath + numberScale.SCALE_TYPE_OPTIONS_KEY,
    );
    const numScale = numberScale.getScale(scaleType, 1);

    return new SizeScale(minRadius, maxRadius, newValueRange, numScale);
  }
}
