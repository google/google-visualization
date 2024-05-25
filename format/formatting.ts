/**
 * @fileoverview Formatting functionality.
 * Copyright 2010 Google Inc. All Rights Reserved
 *
 * The NumberFormatter supports all combinations of the following rounding and
 * formatting features:
 * - i18n support in terms of grouping characters and decimal symbols.
 * - Unit with the properties symbol, position and padding.
 * - Order of magnitude formatting: using localized magnitude strings
 *   such as Million, Billion, Trillion, etc.
 * - Rounding to specified number of decimals.
 * - Rounding to specified number of significant digits.
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

import DateTimePatterns from 'goog:goog.i18n.DateTimePatterns'; // from //third_party/javascript/closure/i18n:datetimepatterns
import {assert} from '@npm//@closure/asserts/asserts';
import {DateTimeFormat} from '@npm//@closure/i18n/datetimeformat';
import {clone} from '@npm//@closure/object/object';

import {TimeUnit} from '../axis/milliseconds';
import {UserOptions} from '../common/options';
import {roundToNumSignificantDigits} from '../common/util';

import {DateFormat} from './dateformat';
import {NumberFormat} from './numberformat';
import * as orderOfMagnitude from './order_of_magnitudes';

const {getLongI18NOOMFormatters, getShortI18NOOMFormatters} = orderOfMagnitude;

/** Interface for Formatters. */
// INumberFormatter is used by dive, which we can't change.
// tslint:disable-next-line:interface-name
export interface INumberFormatter {
  /**
   * Formats a number.
   * @param value Number to format.
   * @return The formatted number.
   */
  format(value: number): string;

  /**
   * Formats a number.
   * @param value Number to format.
   * @return The formatted number.
   */
  formatValue(value: number): string;
}

/** Interface for time formatters. */
export interface TimeFormatter {
  /**
   * Formats a time value expressed in milliseconds since 1970.
   *
   * @param time The time in milliseconds since 1970.
   * @return The formatted time.
   */
  format(time: number): string;

  /**
   * Sets the time unit to use when formatting dates.
   * @param timeUnit A time unit.
   */
  setTimeUnit(timeUnit: TimeUnit): void;
}

/**
 * Creates a TimeFormatter.
 * By default it will format dates to millisecond granularity.
 */
export class TimeFormatterImpl implements TimeFormatter {
  private readonly date: Date;

  private formatter: DateFormat | null = null;

  constructor() {
    /**
     * The date instance is used to convert from time expressed in milliseconds
     * to a date required by the i18n formatter.
     */
    this.date = new Date();

    this.setTimeUnit(TimeUnit.MILLISECOND);
  }

  /**
   * Sets the time unit to use when formatting dates.
   * @param timeUnit The time unit.
   */
  setTimeUnit(timeUnit: TimeUnit) {
    this.formatter = getDateFormatter(timeUnit);
  }

  /**
   * Formats a time value expressed in milliseconds since 1970.
   *
   * @param time The time in milliseconds since 1970.
   * @return The formatted time.
   */
  format(time: number): string {
    this.date.setTime(time);
    return this.formatter!.formatValue(this.date);
  }
}

/**
 * Returns an i18n date formatter given a time granularity.
 * NOTE: We only provide specific formatters for YEAR, QUARTER, MONTH,
 * and DAY at this point. All other granularities will be formatted using
 * the DateTimeFormat.SHORT_DATETIME pattern.
 * @param timeUnit The time granularity to get a formatter for.
 * @return A date formatter.
 */
function getDateFormatter(timeUnit: TimeUnit): DateFormat {
  let pattern;
  switch (timeUnit) {
    case TimeUnit.YEAR:
      pattern = DateTimePatterns.YEAR_FULL;
      break;
    case TimeUnit.QUARTER:
      pattern = 'Q yyyy';
      // TODO(dlaliberte): Get this pattern from TC.
      break;
    case TimeUnit.MONTH:
      pattern = DateTimePatterns.YEAR_MONTH_ABBR;
      break;
    case TimeUnit.DAY:
      pattern = DateTimeFormat.Format.SHORT_DATE;
      break;
    default:
      pattern = DateTimeFormat.Format.SHORT_DATETIME;
  }
  return new DateFormat({'pattern': pattern, 'timeZone': 0});
}

/**
 * Represents a unit such as 'kg', '%' or '$'.
 * Position must be 'left' or 'right'.
 */
export interface Unit {
  symbol: string;
  position: string;
  usePadding: boolean;
}

/**
 * NumberFormatterBuilder
 */
export class NumberFormatterBuilder {
  /**
   * The default maximum number of decimals digits allowed.
   * Note, with 15 significant digits, JS starts to get rounding errors. But
   * this is used for the number of decimal/fraction digits, and it is
   * possible to end up with more total (fraction + integer) digits than the max
   * num of significant digits.  In practice, noise starts to show up during
   * goog number formatting with anything more than 12 significant digits.
   */
  static DEFAULT_MAX_NUM_DECIMALS = 15;

  /**
   * The number of decimals required in non order of magnitude
   *     formatting.  Aka minimumFractionDigits.
   */
  private minNumDecimalsInternal: number | null = null;

  /**
   * The number of decimals allowed in non order of magnitude
   *     formatting.  Aka maximumFractionDigits.
   */
  private maxNumDecimalsInternal: number | null = null;

  /**
   * The list of order of magnitudes to use.
   */
  private orderOfMagnitudes: orderOfMagnitude.Formatter[] = [];

  /** The maximum number of significant digits to allow. */
  private numSignificantDigitsInternal: number | null = null;

  /** The unit. */
  private unitInternal: Unit | null = null;

  /** Options for a Number formatter, with custom pattern, etc. */
  private formatterOptions: UserOptions | null = null;

  /**
   * If true, use other options besides formatterOptions.
   * Calling useFormatterOptions() will turn this off, but
   * setting any of the other options after that will turn it back on.
   * This is weird behavior, but consistent with prior expectations
   * because there are some undesirable side-effects of combining
   * formatter options with other options, especially significantDigits.
   * TODO(dlaliberte): Figure out how to remove this hack.
   */
  private useOtherOptions = true;

  /**
   * Builds NumberFormatter instances.
   * Uses NumberFormat, orderOfMagnitude.Formatter, or NumberFormatter.format,
   * depending on the options.
   */

  /**
   * Makes the formatter use a custom ICU pattern, via NumberFormat.
   * Note that there may be conflicts with maxNumDecimals, useMagnitudes, and
   * a few other options.
   * @return The builder.
   */
  useFormatterOptions(formatterOptions: UserOptions): NumberFormatterBuilder {
    this.formatterOptions = formatterOptions;
    this.useOtherOptions = false;
    return this;
  }

  /**
   * Specifies min number of decimals to require when rounding numbers without
   * order of magnitude.
   *
   * @param minNumDecimals The minimum number of decimals to require.
   * @return The builder.
   */
  setMinNumDecimals(minNumDecimals: number): NumberFormatterBuilder {
    this.minNumDecimalsInternal = minNumDecimals;
    this.useOtherOptions = true;
    return this;
  }

  /**
   * @deprecated Use setMinNumDecimals.
   *
   * @param minNumDecimals The minimum number of decimals to require.
   * @return The builder.
   */
  minNumDecimals(minNumDecimals: number): NumberFormatterBuilder {
    return this.setMinNumDecimals(minNumDecimals);
  }

  /**
   * Specifies max number of decimals to allow when rounding numbers without
   * order of magnitude.
   *
   * @param maxNumDecimals The maximum number of decimals to preserve.
   * @return The builder.
   */
  setMaxNumDecimals(maxNumDecimals: number): NumberFormatterBuilder {
    this.maxNumDecimalsInternal = maxNumDecimals;
    this.useOtherOptions = true;
    return this;
  }

  /**
   * @deprecated Use setMaxNumDecimals.
   *
   * @param maxNumDecimals The maximum number of decimals to preserve.
   * @return The builder.
   */
  maxNumDecimals(maxNumDecimals: number): NumberFormatterBuilder {
    return this.setMaxNumDecimals(maxNumDecimals);
  }

  /**
   * Specifies how many significant digits to allow in the formatted number.
   *
   * @param numSignificantDigits Number of significant digits.
   * @return The builder.
   */
  setNumSignificantDigits(
    numSignificantDigits: number,
  ): NumberFormatterBuilder {
    this.numSignificantDigitsInternal = numSignificantDigits;
    this.useOtherOptions = true;
    return this;
  }

  /**
   * @deprecated Use setNumSignificantDigits.
   *
   * @param numSignificantDigits Number of significant digits.
   * @return The builder.
   */
  numSignificantDigits(numSignificantDigits: number): NumberFormatterBuilder {
    return this.setNumSignificantDigits(numSignificantDigits);
  }

  /**
   * Specifies the unit to use.
   *
   * @param unit The unit used for formatting.
   * @return The builder.
   */
  setUnit(unit: Unit): NumberFormatterBuilder {
    this.unitInternal = unit;
    this.useOtherOptions = true;
    return this;
  }

  /**
   * @deprecated Use setUnit.
   *
   * @param unit The unit used for formatting.
   * @return The builder.
   */
  unit(unit: Unit): NumberFormatterBuilder {
    return this.setUnit(unit);
  }

  /**
   * Turns on built in order of magnitude formatting with long magnitude names.
   *
   * @param maxNumDecimals The number of decimals to use for order of magnitude
   *     formatted values. Defaults to 3.
   *
   * @return The builder.
   * @suppress {checkTypes}
   */
  useLongI18nMagnitudes(maxNumDecimals?: number): NumberFormatterBuilder {
    maxNumDecimals =
      typeof maxNumDecimals === 'number'
        ? maxNumDecimals
        : DEFAULT_MAX_NUM_DECIMALS_FOR_MAGNITUDES;
    this.orderOfMagnitudes = getLongI18NOOMFormatters(maxNumDecimals);
    return this;
  }

  /**
   * Turns on built in order of magnitude formatting with short magnitude names.
   *
   * @param maxNumDecimals The number of decimals to use for order of magnitude
   *     formatted values. Defaults to 3.
   *
   * @return The builder.
   * @suppress {checkTypes}
   */
  useShortI18nMagnitudes(maxNumDecimals?: number): NumberFormatterBuilder {
    maxNumDecimals =
      typeof maxNumDecimals === 'number'
        ? maxNumDecimals
        : DEFAULT_MAX_NUM_DECIMALS_FOR_MAGNITUDES;
    this.orderOfMagnitudes = getShortI18NOOMFormatters(maxNumDecimals);
    return this;
  }

  /**
   * Specifies custom orderOfMagnitude formatters to use.
   *
   * @param customMagnitudes Descending list of OrderOfMagnitudes to use.
   * @return The builder.
   */
  useCustomMagnitudes(
    customMagnitudes: orderOfMagnitude.Type[],
  ): NumberFormatterBuilder {
    assert(
      this.orderOfMagnitudes.length === 0,
      'Order of magnitudes already specified.',
    );

    for (let i = 0; i < customMagnitudes.length; i++) {
      const magnitude = customMagnitudes[i];
      this.orderOfMagnitudes.push(
        new orderOfMagnitude.Formatter(
          magnitude.pattern,
          magnitude.value,
          magnitude.singularString,
          magnitude.pluralString,
        ),
      );
    }
    return this;
  }

  /**
   * Creates a formatter with the specified min and max number of decimals.
   * Obsolete
   *
   * @param min Positive number of decimals to require.
   * @param max Positive number of decimals to allow in the formatter. A
   *     negative number is interpreted as 0 decimals.
   * @return A number formatter.
   */
  static getNumDecimalsFormatter(min: number, max: number): NumberFormat {
    return new NumberFormat({
      'pattern': NumberFormat.getNumDecimalsPattern(min, max),
    });
  }

  /**
   * Creates a NumberFormatter.
   *
   * @return A Number formatter.
   * @suppress {checkTypes}
   */
  build(): NumberFormatter {
    const formatterOptions = clone(this.formatterOptions);

    if (this.useOtherOptions) {
      // If there is no pattern, build a pattern with other options.
      if (formatterOptions['pattern'] == null) {
        if (
          typeof this.minNumDecimalsInternal === 'number' ||
          typeof this.maxNumDecimalsInternal === 'number'
        ) {
          const minNumDecimals =
            typeof this.minNumDecimalsInternal === 'number'
              ? this.minNumDecimalsInternal
              : 0;
          const maxNumDecimals =
            typeof this.maxNumDecimalsInternal === 'number'
              ? this.maxNumDecimalsInternal // Assume max is just the same as min, if
              : // it was defined.
                // This works when formatting ticks with the same number of
                // decimal/fraction digits.
                typeof this.minNumDecimalsInternal === 'number'
                ? minNumDecimals
                : NumberFormatterBuilder.DEFAULT_MAX_NUM_DECIMALS;

          formatterOptions['pattern'] = NumberFormat.getNumDecimalsPattern(
            minNumDecimals,
            maxNumDecimals,
          );
        } else {
          // We still need to specify the number of significant digits, along
          // with the 'decimal' format, to avoid getting extra digits of
          // imprecision.
          formatterOptions['pattern'] = 'decimal';
          if (formatterOptions['significantDigits'] == null) {
            formatterOptions['significantDigits'] =
              this.numSignificantDigitsInternal;
          }
        }
      }
    }

    // const numSignificantDigits = formatterOptions['significantDigits'];

    // AnyDuringMigration because:  Argument of type 'Unit | null' is not
    // assignable to parameter of type 'Unit | undefined'.
    return new NumberFormatter(
      new NumberFormat(formatterOptions),
      this.orderOfMagnitudes,
      this.numSignificantDigitsInternal,
      this.unitInternal!,
    );
  }
}

/** Maximum number of decimals to use when formatting with OrderOfMagnitudes. */
const DEFAULT_MAX_NUM_DECIMALS_FOR_MAGNITUDES = 3;

/**
 *  Creates a NumberFormatter instance. For convenience, use
 *   NumberFormatterBuilder to create instances.
 */
export class NumberFormatter implements INumberFormatter {
  private readonly orderOfMagnitudes: orderOfMagnitude.Formatter[];
  private readonly numSignificantDigitsInternal: number | null;
  private readonly unitInternal: Unit | null;

  /**
   * @param defaultFormatter Formatter used for non orderOfMagnitude formatting.
   *     This is the formatter that is used to round to a specific number of
   *     decimals.
   * @param orderOfMagnitudes List of OrderOfMagnitude's instances sorted from
   *     largest to smallest.
   * @param numSignificantDigits The number of significant digits to allow. No
   *     restriction if not specified. Must be > 0 if passed.
   * @param unit Optional information about the unit such as '$', 'kg', etc.
   */
  constructor(
    private readonly defaultFormatter: NumberFormat,
    orderOfMagnitudes?: orderOfMagnitude.Formatter[] | null,
    numSignificantDigits?: number | null,
    unit?: Unit,
  ) {
    this.orderOfMagnitudes = orderOfMagnitudes || [];

    assert(
      NumberFormatter.isSorted(this.orderOfMagnitudes),
      'Magnitudes are not sorted in descending order.',
    );

    if (typeof numSignificantDigits === 'number') {
      assert(
        !isNaN(numSignificantDigits),
        "numSignificantDigits can't be NaN.",
      );
      assert(
        isFinite(numSignificantDigits),
        'numSignificantDigits must be finite.',
      );
      assert(
        numSignificantDigits > 0,
        'numSignificantDigits must be a positive number if passed in.',
      );
    }

    this.numSignificantDigitsInternal = numSignificantDigits || null;

    this.unitInternal = unit || null;
  }

  /**
   * Checks if order of magnitudes are sorted in descending order.
   *
   * @param magnitudes The magnitudes to check.
   *
   * @return True if sorted in descending order, otherwise false.
   */
  private static isSorted(magnitudes: orderOfMagnitude.Formatter[]): boolean {
    let lastSize = Infinity;
    for (let i = 0; i < magnitudes.length; i++) {
      const magnitude = magnitudes[i];
      if (lastSize < magnitude.getMagnitude()) {
        return false;
      }
      lastSize = magnitude.getMagnitude();
    }
    return true;
  }

  /**
   * Formats a number.
   * TODO(dlaliberte) Memoize this.
   *
   * @param value The value to format.
   * @return The formatted value.
   */
  format(value: number): string {
    const isNegative = value < 0;
    // The minus sign will be added later if negative.
    value = Math.abs(value);

    // Always use number of significant digits, to round out the imprecision.
    // But it is not enough to do this here since formatting itself might
    // also add imprecision.  But it helps if using orderOfMagnitude.Formatter.
    const numDigits =
      this.numSignificantDigitsInternal ||
      NumberFormatterBuilder.DEFAULT_MAX_NUM_DECIMALS;
    value = roundToNumSignificantDigits(numDigits, value);

    let formatted = null;
    // TODO(dlaliberte) Avoid this loop while formatting every single value.
    for (let i = 0; i < this.orderOfMagnitudes.length; i++) {
      const orderOfMagnitudeFormatter = this.orderOfMagnitudes[i];
      if (value >= orderOfMagnitudeFormatter.getMagnitude()) {
        formatted = orderOfMagnitudeFormatter.format(value);
        break;
      }
    }

    if (formatted == null) {
      formatted = this.defaultFormatter.formatValue(value);
    }

    formatted = this.addUnit(formatted);
    // TODO(dlaliberte) Merely prepending '-' is wrong for many locales.
    return isNegative ? `-${formatted}` : formatted;
  }

  /**
   * Formats a number.
   * Use this like google.visualization.NumberFormat#formatValue()
   * @param value Number to format.
   * @return The formatted number.
   */
  formatValue(value: number): string {
    return this.format(value);
  }

  /**
   * Adds a unit to the formatted value.
   *
   * @param formattedValue The string to augment with unit information.
   * @return The formatted value with additional unit information added.
   */
  private addUnit(formattedValue: string): string {
    if (!this.unitInternal) {
      return formattedValue;
    }
    const symbol = this.unitInternal.symbol;
    // The padding is a non breaking space.
    const padding = this.unitInternal.usePadding ? ' ' : '';
    return this.unitInternal.position === 'right'
      ? formattedValue + padding + symbol
      : symbol + padding + formattedValue;
  }

  /**
   * Parses a formatted number.
   * TODO(dlaliberte) Memoize this.
   *
   * @param str The formatted value.
   * @return The parsed value to format.
   */
  parse(str: string): number {
    return this.defaultFormatter.parse(str);
  }
}
