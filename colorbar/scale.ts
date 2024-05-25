/**
 * @fileoverview This class is a logical representation of a colors gradients
 * sequence that is associated with a numeric scale. The object saves two arrays
 * of the same length, one holds the numeric values that define the scale. The
 * other is an array of colors that define the color gradients associated with
 * the scale segments. As mentioned, this is only a logical representation for
 * holding the data, and making queries regarding value color transformations.
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

import * as googArray from '@npm//@closure/array/array';
import * as asserts from '@npm//@closure/asserts/asserts';
import * as googColor from '@npm//@closure/color/color';
import {Range} from '@npm//@closure/math/range';
import {Options} from '../common/options';
import {getOverriddenRange} from '../common/util';
import * as util from '../graphics/util';

/**
 * A logical representation of color gradients sequence associated with a
 * numeric scale.
 * @unrestricted
 */
export class Scale {
  static ONE_SIDED_DEFAULT_COLORS: string[];

  /** The path for the color scale options. */
  static readonly OPTIONS_PATH = 'colorAxis';

  /** Scale values to use */
  private readonly valuesScale: number[] | null;

  /** Colors to build gradients from, represented as RGB. */
  private readonly colorsScale: string[];

  /**
   * @param valuesScale The values defining the numeric scale.
   *     Each value is represented by a color, each segment between two values
   * is associated to the color gradient between the color that starts the
   * segment and the color that ends it. For example, the values -100, 0, 100
   * will be represented by two gradients (3 colors). Color1 to color2 gradient
   * will represent the -100 to 0 part of the scale. Color2 to color3 gradient
   * will represent the 0 to 100 part of the scale. The values must be sorted.
   * May be null for indicating no values, in which case exactly one color
   * should be provided in the colorsScale.
   * @param colorsScale The colors that compose the scale.
   *     Each color is associated with a value from the values scale. It is the
   * ending color of the gradient that is associated with the segment that ends
   * the value, and the starting color of he gradient associated with the
   * segment that starts with that value. For example, given the values -100, 0,
   * 100 and the colors 'red', 'white', 'green' the scale will be composed out
   * of two gradients red->white->green.
   */
  constructor(valuesScale: number[] | null, colorsScale: string[]) {
    if (valuesScale) {
      if (colorsScale.length !== valuesScale.length) {
        throw new Error(
          'colorsScale and valuesScale must be of the same length',
        );
      }
    } else if (colorsScale.length !== 1) {
      throw new Error(
        'colorsScale must contain exactly one element when no ' +
          'valueScale is provided',
      );
    }

    this.valuesScale = valuesScale;

    this.colorsScale = colorsScale.map((color) => googColor.parse(color).hex);
  }

  /**
   * Returns the scale values.
   * @return The scale values. May return null, if no values exists.
   */
  getValuesScale(): number[] | null {
    return this.valuesScale;
  }

  /**
   * Returns the colors array.
   * @return The colors array.
   * @suppress {checkTypes}
   */
  getColorsScale(): string[] {
    return this.colorsScale;
  }

  /**
   * Returns the color associated with the given value. The returned color is
   * an interpolation between the two colors that define the gradient the value
   * is in. The interpolated color is the color on the gradient that's
   * associated with the position of the value in the values scale. For example,
   * if 0-100 is a segment in the values scale associated with the color
   * gradient white->green, than given the value 50 the function will return the
   * color in the middle of the white->green gradient. If the given value is
   * outside of the values scale, the color at the end of the colors gradient is
   * returned.
   *
   * @param value The value to interpolate according to.
   * @return The color associated with the value given.
   */
  getColorFor(value: number): string {
    // If no values are provided, we return the one (and only) color.
    if (!this.valuesScale) {
      return this.colorsScale[0];
    }
    // If the value is greater than the max value of the color scale return
    // the last color.
    if (value >= this.valuesScale[this.valuesScale.length - 1]) {
      return this.colorsScale[this.colorsScale.length - 1];
    }
    // If the value is smaller than the min value of the color scale return
    // the first color.
    if (value <= this.valuesScale[0]) {
      return this.colorsScale[0];
    }
    // Find the position of the value in valuesScale
    const valuePos = googArray.binarySearch(this.valuesScale, value);
    if (valuePos >= 0) {
      return this.colorsScale[valuePos];
    }
    // Blend the two closest colors according to the value
    const lowColorIndex = -valuePos - 2;
    const highColorIndex = -valuePos - 1;
    const gradientRange =
      this.valuesScale[highColorIndex] - this.valuesScale[lowColorIndex];
    const gradientSpread =
      (value - this.valuesScale[lowColorIndex]) / gradientRange;
    const blendedColor = util.blendHexColors(
      this.colorsScale[highColorIndex],
      this.colorsScale[lowColorIndex],
      gradientSpread,
    );
    return blendedColor;
  }

  /**
   * An internal, testable (independent of Options) version of create() below.
   * @param values The values given by the user to match the colors. The array
   *     must be sorted in ascending order.
   * @param colors The colors.
   * @return The arguments for the colorbar.Scale constructor.
   */
  private static getCtorArgs(
    values: number[] | null,
    colors: string[] | null,
  ): {values: number[] | null; colors: string[]} {
    if (!colors || colors.length === 0) {
      // If no colors were specified, try to use the defaults.
      if (values && values.length === 3) {
        colors = TWO_SIDED_DEFAULT_COLORS;
      } else {
        colors = ONE_SIDED_DEFAULT_COLORS;
      }
    } else if (colors.length === 1) {
      // If only one color specified, use it together with the default base
      // color.
      colors = [ONE_SIDED_DEFAULT_COLORS[0], colors[0]];
    }

    asserts.assert(Array.isArray(colors));
    colors = colors;

    if (!values || values.length < 2) {
      // There's no value range, so take the last color as the only color. The
      // color bar can display this color visually, but it can't convert values
      // to colors.
      return {values: null, colors: [googArray.peek(colors)]};
    }

    const minValue = values[0];
    const maxValue = values[values.length - 1];
    const rangeWidth = maxValue - minValue;
    if (rangeWidth === 0) {
      // The low end of the value range is equal to the high end, so all values
      // are converted to a single color, which is the last color.
      return {values: [maxValue], colors: [googArray.peek(colors)]};
    }

    if (values.length !== 2) {
      // If the length is not 2, it must have come from the user, so there are
      // no nulls in the array.
      values = values;
    } else {
      // We allow the user to state only min/max values, and more than two
      // colors, in which case we interpolate the rest of the values linearly.
      values = [];
      const step = rangeWidth / (colors.length - 1);
      // TODO(dlaliberte): Use gviz.canviz.util.rangeMap. Move it to
      // gviz.common.util so it can be used here.
      for (let i = 0; i < colors.length; i++) {
        values.push(minValue + step * i);
      }
    }

    return {values, colors};
  }

  /**
   * Creates a new colorbar.Scale instance, based on the 'colors' and
   * 'colorAxis' paths in the options and the range of values in the data.
   * TODO (dlaliberte): Revisit call sites of this function to determine whether we
   *     actually need 'optionsPath'.
   * @param options The options.
   * @param valueRange The range of values in the given data, or null.
   * @param optionsPath The options path on which to base values.
   * @return The result color scale.
   */
  static create(
    options: Options | null,
    valueRange: Range | null,
    optionsPath?: string,
  ): Scale {
    if (!options) {
      options = new Options([]);
    }
    optionsPath = optionsPath || Scale.OPTIONS_PATH;
    const scaleOptions = options.view(optionsPath);
    let values = null;

    let userValues = scaleOptions.inferOptionalNumberArrayValue('values');
    if (userValues && userValues.length > 0) {
      // If colorAxis.values is specified, it takes precedence.
      if (userValues.length === 1) {
        userValues = [userValues[0], userValues[0]];
      }
      if (valueRange) {
        // If the first user-value is null, take it as the minimum of the data,
        // and similarly for the last user-value.
        if (userValues[0] == null) {
          userValues[0] = valueRange.start;
        }
        if (userValues[userValues.length - 1] == null) {
          userValues[userValues.length - 1] = valueRange.end;
        }
      }
      if (userValues[0] == null) {
        throw new Error(`${optionsPath}.values` + ' must not contain nulls');
      }
      for (let i = 1; i < userValues.length; i++) {
        if (userValues[i] == null) {
          throw new Error(`${optionsPath}.values` + ' must not contain nulls');
        }
        if (userValues[i] < userValues[i - 1]) {
          throw new Error(
            `${optionsPath}.values` +
              ' must be a monotonically increasing series',
          );
        }
      }
      values = userValues;
    } else {
      // If valuesOptionPath is not specified, read colorAxis.minValue/maxValue
      // and merge it with the data values, with precedence for the options.
      const userMinValue = scaleOptions.inferOptionalNumberValue('minValue');
      const userMaxValue = scaleOptions.inferOptionalNumberValue('maxValue');
      if (userMinValue != null && userMaxValue != null) {
        if (userMinValue > userMaxValue) {
          throw new Error(
            `${optionsPath}.minValue (${userMinValue}) must be at' +
              ' most ${optionsPath}.maxValue ('${userMaxValue})`,
          );
        }
      }

      // Take the value range from the data and override it with the options.
      const newValueRange = getOverriddenRange(
        valueRange,
        userMinValue,
        userMaxValue,
      );
      if (newValueRange) {
        values = [newValueRange.start, newValueRange.end];
      }
    }

    let colors = options.inferStringArrayValue('colors');
    colors = scaleOptions.inferStringArrayValue('colors', colors);

    const oneSided = scaleOptions.inferValue(
      'one-sided-colors',
      ONE_SIDED_DEFAULT_COLORS,
    ) as string[];
    const twoSided = scaleOptions.inferValue(
      'two-sided-colors',
      TWO_SIDED_DEFAULT_COLORS,
    ) as string[];

    if (!colors || colors.length === 0) {
      // If no colors were specified, try to use the defaults.
      if (values && values.length === 3) {
        colors = twoSided;
      } else {
        colors = oneSided;
      }
    } else if (colors.length === 1) {
      // If only one color specified, use it together with the default base
      // color.
      colors = [oneSided[0], colors[0]];
    }

    const colorScaleArgs = Scale.getCtorArgs(values, colors);
    return new Scale(colorScaleArgs.values, colorScaleArgs.colors);
  }
}

/**
 * Default colors for a one sided gradient. Used when a value scale of size 2 is
 * given without a matching color scale.
 */
const ONE_SIDED_DEFAULT_COLORS: string[] = ['#EFE6DC', '#109618'];

Scale.ONE_SIDED_DEFAULT_COLORS = ONE_SIDED_DEFAULT_COLORS;

/**
 * Default colors for a two sided gradient. Used when a value scale of size 3 is
 * given without a matching color scale.
 */
const TWO_SIDED_DEFAULT_COLORS: string[] = ['#DC3912', '#EFE6DC', '#109618'];
