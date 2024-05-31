/**
 * @fileoverview The base abstract ValueScale implementation from which value
 * scales inherit.
 *
 * Note: Deprecated. Use the *DecorationSupplier classes instead.
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
import * as numberScaleUtil from '../../common/number_scale_util';
import {Options} from '../../common/options';
import {Value} from '../../data/types';
import * as pow10Math from '../pow_10_math';

// tslint:disable:ban-types

/**
 * An abstract class from which all value scales inherit.
 *
 * DON'T USE THIS CLASS.  It is deprecated.
 *
 * Is generally responsible for converting values to numbers and calibrating
 * the scales according to min/max values and the underlying data types.
 * Sub classes of this implementation should implement all
 * methods marked with an Internal suffix. (valueToStringInternl is the only
 * such function which has a default implementation which calls toString).
 *
 * There are actually 3 layers of scales to be aware of:
 *
 * 1. Values (numbers, dates, strings) are converted to "unscaled" numbers.
 * This conversion process should be factored out into type converters,
 * though there is necessarily a scaling involved in such a conversion.
 *
 * 2. Unscaled numbers are converted to scaled numbers.  This is mostly for
 * the log scale (to compute the log of the numbers) but also for gaps.
 *
 * 3. Scaled numbers are converted to screen coordinates.  This is actually
 * done not by a ValueScale, but in the AxisDefiner.
 * @see AxisDefiner#calcPositionFromNumericValue
 *
 * In addition to mixing these multiple levels of scaling, the value-scales
 * also tries to handle a couple other things that should be factored out.
 *
 * * Axis tick generation, aka gridlines or sections
 * * Formatting of values, also related to type conversion.
 * * Default baseline value, also related to the type of value.
 */
export abstract class ValueScale {
  /**
   * The number of sections this axis should be divided into.
   * Generally one less than the number of ticks, or gridlines.
   * Special cases: 0, 1, or 2 means one section,
   * and -1 means automatic number, aka the "old algorithm".
   */

  numberOfSections!: number;
  // TODO(dlaliberte): remove '!'
  /** The values on the scale on which ticks are positioned. */
  ticks: number[] = [];

  /** The options object. */
  protected options!: Options;

  /** The formatter for values. */
  protected formatter: {
    formatValue: (p1: AnyDuringMigration) => string;
  } | null = null;

  /** Whether the value scale has been 'calibrated' yet. */
  // TODO(dlaliberte): remove '!'
  calibrated!: boolean;

  /**
   * The minimum numeric value of this ValueScale (only set after
   * calibration).
   */
  // TODO(dlaliberte): remove '!'
  private numericMinValue!: number;

  /**
   * The maximum numeric value of this ValueScale (only set after
   * calibration).
   */
  // TODO(dlaliberte): remove '!'
  private numericMaxValue!: number;

  /** The numeric value of the baseline for the axis with this scale. */
  // TODO(dlaliberte): remove '!'
  private numericBaseline!: number | null;

  /**
   * The ICU format to use for formatting values before displaying as text, or
   * null for the default format.
   * For information about ICU patterns:
   * http://icu-project.org/apiref/icu4c/classDecimalFormat.html#_details.
   */
  // TODO(dlaliberte): remove '!'
  private format!: string | null;

  /**
   * An optional user defined formatter for formatting values before
   * displaying as text. Default formatter depends on implementation
   * of valueToStringInternal.
   * User defined formatter should expect to receive two arguments:
   * the value to format and the default formatter's suggestion as a string
   * and is expected to return the formatted value. Default formatter always
   * returns suggestion and ignores the original value.
   *
   * @see ValueScale#valueToString
   */
  // TODO(dlaliberte): remove '!'
  private userDefinedValueFormatter!: (
    p1: AnyDuringMigration,
    p2: string,
  ) => string;

  /**
   * A private structure of two calculation functions to be performed on all
   * numeric representations of values in this scale (eg. log for log scale).
   * The transform function in the struct is called right after the
   * conversion of values to numerics is performed while the inverse is called
   * just before conversion back to the value is performed.
   */
  private numericPreCalculator!: numberScaleUtil.Converter | null;

  /**
   * Initializes the scale using user options.
   *
   * @param options Options object.
   * @param numberOfTicks The required number of ticks. If null, a default is used.
   */
  init(options: Options, numberOfTicks: number | null) {
    this.calibrated = false;

    this.options = options;

    this.numberOfSections =
      numberOfTicks === null || numberOfTicks < 0
        ? this.getDefaultNumberOfSections()
        : numberOfTicks > 2
          ? numberOfTicks - 1
          : 1;

    this.ticks = [];

    this.numericMinValue = Infinity;

    this.numericMaxValue = -Infinity;

    this.numericBaseline = null;

    this.format = options.inferOptionalStringValue('format');

    this.userDefinedValueFormatter = options.inferValue(
      'valueFormatter',
      (value: AnyDuringMigration, suggestion: string) => suggestion,
    ) as (p1: AnyDuringMigration, p2: string) => string;

    this.numericPreCalculator = null;

    this.formatter = null;
  }

  /**
   * Get the numeric min value.
   * @return The numeric min value.
   */
  getNumericMinValue(): number {
    return this.numericMinValue;
  }

  /**
   * Get the numeric max value.
   * @return The numeric max value.
   */
  getNumericMaxValue(): number {
    return this.numericMaxValue;
  }

  /**
   * Get the numeric baseline value.
   * @return the numeric baseline which may be null.
   */
  getNumericBaseline(): number | null {
    return this.numericBaseline;
  }

  /**
   * Set the numeric min value, if non-null.
   * @param num The numeric value.
   */
  setNumericMinValue(num: number | null) {
    if (num != null) {
      this.numericMinValue = num;
    }
  }

  /**
   * Set the numeric max value, if non-null.
   * @param num The numeric value.
   */
  setNumericMaxValue(num: number | null) {
    if (num != null) {
      this.numericMaxValue = num;
    }
  }

  /**
   * Set the numeric baseline value.
   * @param num The numeric value.
   */
  setNumericBaseline(num: number | null) {
    this.numericBaseline = num;
  }

  abstract getDefaultBaseline(): AnyDuringMigration;

  /**
   * Initializes the pre-calculator.
   * @param distanceToZero The closest distance to zero.
   * @param gaps The gaps to apply to the scale. No longer supported.
   */
  initPreCalculator(
    scaleType: numberScaleUtil.ScaleType,
    distanceToZero: number,
    gaps: AnyDuringMigration[],
  ) {
    if (
      gaps.length !== 0 &&
      scaleType !== numberScaleUtil.ScaleType.PIECEWISE_LINEAR
    ) {
      throw new Error('Non-linear scale with gaps is not supported.');
    }
    this.numericPreCalculator = numberScaleUtil.getScale(
      scaleType,
      pow10Math.floor(distanceToZero),
    );
  }

  /**
   * Returns the default number of sections.
   * -1 means the old algorithm,
   * 0 means dive's variable num-of-sections algorithm,
   * and anything >0 means the fixed num-of-sections algorithm.
   * TODO(dlaliberte): unify this with changes to gridlines.count
   * @return See above.
   */
  protected getDefaultNumberOfSections(): number {
    return -1;
  }

  /**
   * This function will be invoked in order to calibrate the ValueScale, meaning
   * setting all of the following properties:
   * <ul>
   *   <li>numericMinValue - the minimum numeric value of this ValueScale
   *   <li>numericMaxValue - the maximum numeric value of this ValueScale
   *   <li>numericBaseline - the numeric base line value of this ValueScale if
   *       such exists, null otherwise. Is usually 0.
   *   <li>ticks - numeric values for the ticks
   * </ul>
   * In practice, it performs a few adjustments on minValue and maxValue and
   * calls the protected calibrateInternal method. The calibrateInternal method
   * should be implemented by sub classes and is expected to set most properties
   * of 'this' to be used later by this method. In particular, calibrateInternal
   * is expected to set minValue, maxValue, ticks array and baseline.
   *
   * FYI: //apps/cereal is dependent on this method, and associated tick
   * generation, even though gviz is not using it.
   *
   * @param minValue The minValue, if present in options, null otherwise.
   * @param maxValue The maxValue, if present in options, null otherwise.
   * @param shouldExpand Should the range expand past the min/max values or should it be constrained to those values.
   */
  calibrate(
    minValue: Value | null,
    maxValue: Value | null,
    shouldExpand: boolean,
  ) {
    if (this.calibrated) {
      return;
    }

    if (shouldExpand) {
      this.extendRangeToIncludeValue(minValue);
      this.extendRangeToIncludeValue(maxValue);
    }

    this.calibrateMinMax();

    // Now create ticks.
    // TODO(dlaliberte): Take gaps into account when positioning the ticks.
    this.calibrateInternal(shouldExpand);

    this.generateTicks(shouldExpand);

    this.createFormatter();

    this.calibrated = true;
  }

  /**
   * Helper for calibrate to deal with the min and max values.
   * TODO(dlaliberte): This should be specific to each subclass.
   */
  calibrateMinMax() {
    // Take care of edge cases.
    if (
      this.numericMinValue === Infinity &&
      this.numericMaxValue === -Infinity
    ) {
      // No data at all.
      this.setNumericMinValue(0);
      this.setNumericMaxValue(1);
    }
    if (this.numericMinValue === Infinity) {
      this.setNumericMinValue(this.numericMaxValue);
    }
    if (this.numericMaxValue === -Infinity) {
      this.setNumericMaxValue(this.numericMinValue);
    }
    if (this.numericMinValue === this.numericMaxValue) {
      // min and max are defined, but the same, so make them different.
      // TODO(dlaliberte) Make this correction specific to value type.
      if (this.numericMinValue === 0) {
        this.setNumericMinValue(-1);
        this.setNumericMaxValue(1);
      } else if (this.numericMinValue > 0) {
        this.setNumericMinValue(this.numericMinValue / 2);
        this.setNumericMaxValue(this.numericMaxValue * 2);
      } else {
        this.setNumericMinValue(this.numericMinValue * 2);
        this.setNumericMaxValue(this.numericMaxValue / 2);
      }
    }

    asserts.assert(
      this.numericMinValue < Infinity,
      'numericMinValue is Infinity',
    );
    asserts.assert(
      this.numericMaxValue > -Infinity,
      'numericMaxValue is -Infinity',
    );
  }

  /**
   * Set minValue, maxValue, and ticks array on 'this'.
   *
   * @param shouldExpand Should the range expand past the min/max values or should it be constrained to those values.
   */
  calibrateInternal(shouldExpand: boolean) {}

  abstract generateTicks(shouldExpand: boolean): void;

  /** @param ticks The values on the scale on which ticks are positioned. */
  setTicks(ticks: number[]) {
    this.ticks = ticks;
  }

  /** Set the default format. */
  setDefaultFormat(defaultFormat: string) {
    if (!this.format) {
      this.format = defaultFormat;
    }
  }

  /**
   * Get the default format.
   * @return The default format
   */
  getDefaultFormat(): string | null {
    return this.format;
  }

  abstract createFormatter(): void;

  /**
   * Create a formatter for values in this scale.
   * TODO(dlaliberte): Reconcile with options for 'format' formatOptions
   *  'formatter' and 'valueFormatter'.
   */
  getFormatter(): {formatValue: (p1: AnyDuringMigration) => string} | null {
    if (!this.formatter) {
      this.createFormatter();
    }
    return this.formatter;
  }

  /**
   * Converts a value of the underlying data type to its string representation.
   * Uses valueToStringInternal in order to calculate a string representation of
   * a value (of the underlying data type, not its numeric representation). Can
   * be affected by calibrate. If a user defined formatter is present, it is
   * given the choice between the already calculated representation to its own
   * calculation. The decision of such user defined formatter is then returned.
   *
   * @see ValueScale#valueToStringInternal
   * @param value Value to be formatted.
   *
   * @return The value as a string.
   */
  valueToString(value: AnyDuringMigration): string {
    const suggestion = this.valueToStringInternal(value);
    // Notice the default user defined formatter is a do-nothing
    // identity function so we can call it anyway knowing
    // it will return the suggestion.
    return this.userDefinedValueFormatter(value, suggestion);
  }

  /**
   * An internal method to be overridden by implementors. Used by valueToString.
   * @see ValueScale#valueToString.
   *
   * @param value The value to be converted to string.
   * @return the string representation.
   */
  protected abstract valueToStringInternal(value: AnyDuringMigration): string;

  /**
   * Converts a value of the original data type to a scaled numeric value.
   * Internally, it invokes valueToNumberInternal via valueToUnscaledNumber for
   * conversion to unscaled numeric, followed by a numeric calculator (eg. log)
   * if one is present via scaleNumericValue.
   *
   * So this is really a way of combining multiple scalings in one, which
   * should be factored out and then combined more rigorously.
   *
   * @see ValueScale#valueToUnscaledNumber
   * @see ValueScale#scaleNumericValue
   *
   * @param value The value as the underlying data type.
   * @return The value as a number.
   */
  valueToNumber(value: Value | null): number | null {
    const num = this.valueToUnscaledNumber(value);
    if (num == null) {
      return null;
    }
    const result = this.scaleNumericValue(num);
    if (!isFinite(result)) {
      return null;
    }
    return result;
  }

  /**
   * Converts a value to an unscaled number.
   * @param value the value to be converted.
   * @return The converted value.
   */
  valueToUnscaledNumber(value: Value | null): number | null {
    return value == null ? null : this.valueToNumberInternal(value);
  }

  /**
   * Converts a scaled numeric value back to a value of the underlying data
   * type. This does the inverse of valueToNumber. First it unscales the number
   * with unscaleNumericValue, and then converts the unscaled number to value
   * with numberToValueInternal
   *
   * @see ValueScale#unscaleNumericValue.
   * @see ValueScale#numberToValueInternal.
   *
   * @param num The value to be converted.
   * @return The converted value.
   */
  numberToValue(num: number): Value {
    return this.numberToValueInternal(this.unscaleNumericValue(num));
  }

  /**
   * Converts a numeric value back to a value of the underlying data type.
   * Invokes numberToValueInternal To convert a numeric to the original data
   * type.
   * @see ValueScale#numberToValueInternal.
   *
   * @param num The unscaled number to be converted to value.
   * @return The converted value.
   */
  unscaledNumberToValue(num: number): AnyDuringMigration {
    return num == null ? null : this.numberToValueInternal(num);
  }

  /**
   * Converts an unscaled numeric value to its scaled form.
   * @param num An unscaled numeric.
   * @return The corresponding scaled number.
   */
  scaleNumericValue(num: number): number {
    asserts.assert(this.numericPreCalculator != null);
    return this.numericPreCalculator!.transform(num);
  }

  /**
   * Converts a numeric value back to its unscaled number.
   * @param num A scaled number.
   * @return The corresponding unscaled number.
   */
  unscaleNumericValue(num: number): number {
    asserts.assert(this.numericPreCalculator != null);
    return this.numericPreCalculator!.inverse(num);
  }

  /**
   * @param value The value as the underlying data type.
   * @return The value as a number.
   */
  abstract valueToNumberInternal(value: Value): number | null;

  abstract numberToValueInternal(num: number): Value;

  /**
   * Compares two numeric values
   * @param value1 A numeric value.
   * @param value2 A numeric value.
   * @return -1, 0, or 1, usable by sort function.
   */
  compareValues(value1: number, value2: number): number {
    return value1 < value2 ? -1 : value1 > value2 ? 1 : 0;
  }

  /**
   * Extends the min-max range of this scale to include a given scaled numeric
   * value by changing the minValue or the maxValue. If the range already
   * includes the numeric value, leave it as is.
   * @param num The given value.
   */
  extendRangeToIncludeNumber(num: number | null) {
    if (num != null) {
      if (num < this.getNumericMinValue()) {
        this.setNumericMinValue(num);
      }
      if (num > this.getNumericMaxValue()) {
        this.setNumericMaxValue(num);
      }
    }
  }

  /**
   * Extends the min-max range of this scale to include a given value by
   * converting it to a number an invoking extendRangeToIncludeNumber.
   * @param v The given value.
   */
  extendRangeToIncludeValue(v: Value | null) {
    this.extendRangeToIncludeNumber(this.valueToNumber(v));
  }

  abstract inferValue(
    options: Options,
    path: string[] | string,
  ): AnyDuringMigration;
}
