/**
 * @fileoverview A value formatter for financial formats.
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

import NumberFormatSymbols from 'goog:goog.i18n.NumberFormatSymbols'; // from //third_party/javascript/closure/i18n:numberformatsymbols
import * as asserts from '@npm//@closure/asserts/asserts';
import {NumberFormat as I18nNumberFormat} from '@npm//@closure/i18n/numberformat';
import {Options} from '../common/options';
import {
  AbstractDataTableInterface,
  Formatter,
} from '../data/abstract_datatable_interface';
import {ColumnType} from '../data/types';
import {Format} from './format';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 *  Specify 3 significant digits for 'short' format
 *  This way values like 12.5K (e.g. on the Y axis ticks) will
 *  actually be shown as such, and not rounded to 13K.
 */
export const COMPACTS_DEFAULT_SIGNIFICANT_DIGITS = 3;

/**
 * A formatter for numbers.
 */
export class NumberFormat extends Format {
  /**
   * Function to call to instead of formatValue.
   * Should be typed as:
   *   (value: Value, pattern: string|number|null) => string
   * but subclasses restrict value to a subset of Value.
   * TODO(dlaliberte): Make this a per-instance property, inherited from Format.
   */
  static formatValueInternalCallback?: (
    value: AnyDuringMigration,
    pattern: AnyDuringMigration,
  ) => string = undefined;

  /**
   * A hook for providing a function to do all formatting manually.
   * @param callback The function to call instead of calling formatValue.
   * Should be: callback: (value: Value, pattern: string|number|null) => string
   */
  static overrideFormatValue(
    callback: (
      value: AnyDuringMigration,
      pattern: AnyDuringMigration,
    ) => string,
  ) {
    NumberFormat.formatValueInternalCallback = callback;
  }

  /**
   * The decimal separator in the loaded locale.
   */
  static readonly DECIMAL_SEP = NumberFormatSymbols.DECIMAL_SEP;

  /**
   * The grouping separator in the loaded locale.
   */
  static readonly GROUP_SEP = NumberFormatSymbols.GROUP_SEP;

  /**
   * The default decimal pattern for formatting numbers.
   */
  static readonly DECIMAL_PATTERN = NumberFormatSymbols.DECIMAL_PATTERN;

  /**
   * The character used as decimal separator in ICU patterns.
   */
  static readonly ICU_PATTERN_DECIMAL_SEPARATOR = '.';

  /**
   * Indicates whether the user has explicitly overridden automatic choice
   *     between ascii and localized numerals.
   *
   */
  private static useNativeCharactersIfAvailableFlag = false;

  /**
   * A number specifying how many digits to display after the decimal.
   * The default is 2. If you specify more digits than the number contains,
   * it will display zeros for the smaller values.
   * Truncated values will be rounded (5 rounded up).
   * This is used as the minimum fraction or decimal digits.
   */
  private readonly fractionDigits: number;

  /**
   * A number specifying how many significant digits to display. This option
   * will override the fractionDigits option.
   */
  private readonly significantDigits: number | null;

  /**
   * A character to use as the decimal marker. The default is according to the
   * loaded locale, and for English this is a dot (.).
   */
  private readonly decimalSymbol: string;

  /**
   * A character to be used to group digits to the left of the decimal into sets
   * of three. Default is according to the loaded locale, and for English it is
   * comma (,).
   */
  private readonly groupingSymbol: string;

  /**
   * A string prefix for the value, for example "$".
   */
  private readonly prefix: string;

  /**
   * A string suffix for the value, for example "%".
   */
  private readonly suffix: string;

  /**
   * The text color for negative values. No default value. Values can be any
   * acceptable HTML color value, such as "red" or "#FF0000".
   */
  private readonly negativeColor: string | null;

  /**
   * A boolean, where true indicates that negative values should be surrounded
   * by parentheses. Default is true.
   */
  private readonly negativeParens: boolean;

  /**
   * An ICU pattern to use for formatting.
   * When provided all other options are ignored, except 'negativeColor'.
   * For information about ICU patterns:
   * http://icu-project.org/apiref/icu4c/classDecimalFormat.html#_details.
   */
  private readonly pattern: string | null | number | null;

  /**
   * A custom number to divide every number by before formatting
   * (default is 1).
   */
  private readonly scaleFactor: number;

  /**
   * Formatter set up by formatValueInternal(), used for parsing numbers.
   */
  private formatter: I18nNumberFormat | null = null;

  /**
   * @param userOptions Formatting options. All properties are optional.
   *
   * Supported properties are:
   * * decimalSymbol {string} The decimal point symbol (default='.').
   * * fractionDigits {number} The number of digits to display after the
   *         decimal separator (default=2).
   * * groupingSymbol {string} The grouping symbol (default=',').
   * * negativeColor {string} The color for negative values  (default=none).
   * * negativeParens {boolean} Indication if to show negative values
   *         in parentheses (default=false).
   * * prefix {string} The prefix to append, e.g. '$' (default=none).
   * * suffix {string} The suffix to append, e.g. '%' (default=none).
   * * scaleFactor {number} The number to divide by before formatting.
   * * pattern {string} An ICU pattern to use for formatting (default=none).
   *         When a pattern is specified, most other options are ignored
   *         except for the negativeColor and the scaleFactor.
   *         For information about ICU patterns:
   * http://icu-project.org/apiref/icu4c/classDecimalFormat.html#_details.
   */
  constructor(userOptions?: AnyDuringMigration | null) {
    super();

    const defaults = {
      'decimalSymbol': NumberFormat.DECIMAL_SEP,
      'groupingSymbol': NumberFormat.GROUP_SEP,
      'fractionDigits': 2,
      'significantDigits': null,
      'negativeParens': false,
      'prefix': '',
      'suffix': '',
      'scaleFactor': 1,
    };
    const options = new Options([userOptions || {}, defaults]);
    this.fractionDigits = options.inferNonNegativeNumberValue('fractionDigits');
    if (
      userOptions &&
      typeof userOptions['fractionDigits'] === 'number' &&
      isNaN(userOptions['fractionDigits'])
    ) {
      this.fractionDigits = NaN;
    }
    this.significantDigits =
      options.inferOptionalNonNegativeNumberValue('significantDigits');
    this.decimalSymbol = options.inferStringValue('decimalSymbol');
    this.groupingSymbol = options.inferStringValue('groupingSymbol');
    this.prefix = options.inferStringValue('prefix');
    this.suffix = options.inferStringValue('suffix');
    this.negativeColor = options.inferOptionalColorValue('negativeColor');
    this.negativeParens = options.inferBooleanValue('negativeParens');

    this.pattern = options.inferOptionalStringValue('pattern');
    const lcPattern = (this.pattern || '').toLowerCase();
    if (hasKey(PRESET_FORMAT, lcPattern)) {
      // tslint:disable-next-line:no-dict-access-on-struct-type
      this.pattern = PRESET_FORMAT[lcPattern];
    }

    this.scaleFactor = options.inferNumberValue('scaleFactor');
    if (this.scaleFactor <= 0) {
      throw new Error('Scale factor must be a positive number.');
    }
  }

  /**
   * @param flag If true, formatters will use native numerals when
   * available.
   */
  static useNativeCharactersIfAvailable(flag: boolean) {
    NumberFormat.useNativeCharactersIfAvailableFlag = flag;
  }

  /**
   * Formats the data table.
   * TODO(dlaliberte): Generalize this to use the Format.format.
   * @param dataTable The data table.
   * @param columnIndex The column to format.
   */
  override format(dataTable: AbstractDataTableInterface, columnIndex: number) {
    if (dataTable.getColumnType(columnIndex) !== 'number') {
      return;
    }

    for (let row = 0; row < dataTable.getNumberOfRows(); row++) {
      let value = dataTable.getValue(row, columnIndex);

      if (value != null) {
        value = value as number;
        const formattedValue = this.formatValue(value);
        dataTable.setFormattedValue(row, columnIndex, formattedValue);

        // Color formatting.
        if (value < 0) {
          const negativeColorStr = this.negativeColor || '';
          if (negativeColorStr !== '') {
            dataTable.setProperty(
              row,
              columnIndex,
              'style',
              `color:${negativeColorStr};`,
            );
          }
        }
      }
    }
  }

  getValueType(columnType: ColumnType | null): ColumnType | null {
    return columnType === ColumnType.NUMBER ? columnType : null;
  }

  /**
   * Creates an internal formatter that will be used for formatting values.
   * The formatter may depend on the column type
   * @param columnType The column type.
   * @return A formatter.
   */
  override createFormatter(columnType: ColumnType): Formatter {
    const formatter = {
      format: (value: number, pattern: null) => {
        if (value == null) {
          return null;
        } else {
          value = Number(value);
          const formattedValue = this.formatValue(value);
          return formattedValue;
        }
      },
    };
    return formatter as Formatter;
  }

  /**
   * Formats a single number into a string.
   * TODO(dlaliberte): Avoid all this while formatting every single value.
   * We could memoize for the particular set of formatting options.
   *
   * @param value Must be numeric value to format.
   * @return Formatted value.
   */
  formatValueInternal(value: AnyDuringMigration): string {
    if (NumberFormat.formatValueInternalCallback) {
      return this.applyPrefixAndSuffix(
        NumberFormat.formatValueInternalCallback.call(
          this,
          asserts.assertNumber(value) / this.scaleFactor,
          this.pattern,
        ),
      );
    }

    let formattedValue = null;
    const numberValue = value as number;
    const scaledValue = numberValue / this.scaleFactor;
    if (this.pattern !== null) {
      // Format using an ICU pattern.
      // TODO(dlaliberte): Do we want to allow the user to override the decimal
      // and grouping separators when using an ICU pattern?
      const prevEnforceAsciiDigits = I18nNumberFormat.isEnforceAsciiDigits();
      I18nNumberFormat.setEnforceAsciiDigits(
        !NumberFormat.useNativeCharactersIfAvailableFlag,
      );

      // We MUST create the NumberFormat instance only after calling
      // NumberFormat.setEnforceAsciiDigits().
      const numFormat = new I18nNumberFormat(this.pattern);
      if (
        this.pattern === I18nNumberFormat.Format.COMPACT_SHORT ||
        this.pattern === I18nNumberFormat.Format.COMPACT_LONG
      ) {
        numFormat.setSignificantDigits(COMPACTS_DEFAULT_SIGNIFICANT_DIGITS);
      }
      this.formatter = numFormat;

      // Store it for later use by parser.
      if (this.significantDigits != null) {
        numFormat.setSignificantDigits(this.significantDigits);

        // Also allow the same number of fraction digits,
        // even though it could be too many, because the default is only 3.
        numFormat.setMaximumFractionDigits(this.significantDigits);
      }
      formattedValue = this.applyPrefixAndSuffix(numFormat.format(scaledValue));
      I18nNumberFormat.setEnforceAsciiDigits(prevEnforceAsciiDigits);
    } else {
      if (isNaN(this.fractionDigits)) {
        return String(numberValue);
      }

      // Format using the available options.
      let valueToFormat = scaledValue;
      if (this.negativeParens) {
        valueToFormat = Math.abs(valueToFormat);
      }
      formattedValue = this.formatValueNonICU(valueToFormat);
      formattedValue = this.applyPrefixAndSuffix(formattedValue);
      if (this.negativeParens && numberValue < 0) {
        formattedValue = '(' + formattedValue + ')';
      }

      if (this.negativeColor) {
        formattedValue += ''; // Useless line just to use negativeColor.
      }
    }
    return formattedValue;
  }

  /**
   * Formats a decimal number into a string, non-ICU style.
   *
   * @param value Numeric value to format.
   * @return Formatted value.
   */
  private formatValueNonICU(value: number): string {
    if (this.fractionDigits === 0) {
      value = Math.round(value);
    }
    const formattedValue = [];
    if (value < 0) {
      value = -value;
      formattedValue.push('-');
    }
    const multiplier = Math.pow(10, this.fractionDigits);
    const intValue = Math.round(value * multiplier);
    let whole = String(Math.floor(intValue / multiplier));
    let decimal = String(intValue % multiplier);

    // Handle whole part
    if (whole.length > 3 && this.groupingSymbol) {
      const l = whole.length % 3;
      if (l > 0) {
        formattedValue.push(whole.substring(0, l), this.groupingSymbol);
        whole = whole.substring(l);
      }
      while (whole.length > 3) {
        formattedValue.push(whole.substring(0, 3), this.groupingSymbol);
        whole = whole.substring(3);
      }
      formattedValue.push(whole);
    } else {
      formattedValue.push(whole);
    }

    // Handle decimal part
    if (this.fractionDigits > 0) {
      formattedValue.push(this.decimalSymbol);
      if (decimal.length < this.fractionDigits) {
        decimal = '0000000000000000' + decimal;
      }
      formattedValue.push(
        decimal.substring(decimal.length - this.fractionDigits),
      );
    }
    return formattedValue.join('');
  }

  /**
   * Applies the prefix and suffix of the formatter to the given string.
   * @param value The value to apply the prefix and suffix to.
   * @return The resulting value.
   */
  applyPrefixAndSuffix(value: string): string {
    return this.prefix + value + this.suffix;
  }

  getNDP(min: number, max: number): string {
    return NumberFormat.getNumDecimalsPattern(min, max);
  }

  /**
   * Creates an ICU pattern for the specified min and max number of decimals.
   * The pattern is based on DECIMAL_PATTERN
   * and modifies only the decimal part of the pattern for the current locale.
   *
   * @param min The minimum number of decimals required.
   * @param max The maximum number of decimals allowed.
   * @return An ICU number formatting pattern for numbers.
   */
  static getNumDecimalsPattern(min: number, max: number): string {
    const decimalPattern = NumberFormat.DECIMAL_PATTERN;
    const decimalSeparatorIndex: number = decimalPattern.lastIndexOf(
      NumberFormat.ICU_PATTERN_DECIMAL_SEPARATOR,
    );
    if (min < 0 || max <= 0) {
      // NOTE: We're handling negative number of decimals by returning
      // a pattern without decimals or the decimal separator.
      return decimalPattern.substring(0, decimalSeparatorIndex);
    }
    if (min > max) {
      [min, max] = [max, min];
    }
    const integerDigitsPattern: string =
      // Including the separator.
      decimalPattern.substring(0, decimalSeparatorIndex + 1);
    const fractionDigitsPattern = '0'.repeat(min) + '#'.repeat(max - min);
    return integerDigitsPattern + fractionDigitsPattern;
  }

  /**
   * Parses a previously formatted number.
   * TODO(dlaliberte): Memoize this.
   *
   * @param str The formatted value.
   * @return The parsed value to format.
   */
  parse(str: string): number {
    if (this.formatter && this.formatter.parse) {
      // Must restore the same enforceAsciiDigits used for this instance.
      // But also, must preserve whatever the current setting is.
      const currentEnforceAsciiDigits = I18nNumberFormat.isEnforceAsciiDigits();
      I18nNumberFormat.setEnforceAsciiDigits(
        !NumberFormat.useNativeCharactersIfAvailableFlag,
      );
      const result = this.formatter.parse(str);
      I18nNumberFormat.setEnforceAsciiDigits(currentEnforceAsciiDigits);
      return result;
    } else {
      // TODO(dlaliberte): Other ways of formatting need to be supported here.
      throw new Error('Cannot parse without parser.');
    }
  }
}

/**
 * Presets mapping nice names to the goog.i18n.NumberFormat presets.
 *  {[key: string]: number};
 */
export const PRESET_FORMAT = {
  'decimal': I18nNumberFormat.Format.DECIMAL,
  'scientific': I18nNumberFormat.Format.SCIENTIFIC,
  'percent': I18nNumberFormat.Format.PERCENT,
  'currency': I18nNumberFormat.Format.CURRENCY,
  'short': I18nNumberFormat.Format.COMPACT_SHORT,
  'long': I18nNumberFormat.Format.COMPACT_LONG,
};

// `keyof any` is short for "string | number | symbol"
// since an object key can be any of those types, our key can too.
// In TS 3.0+, putting just "string" raises an error.
function hasKey<O>(obj: O, key: keyof AnyDuringMigration): key is keyof O {
  // tslint:disable-next-line:ban-ts-suppressions
  // @ts-ignore(go/ts49upgrade) Fix code and remove this comment. Error:
  // TS2322: Type 'O' is not assignable to type 'object'.
  // tslint:disable-next-line:ban-unsafe-reflection
  return key in obj;
}
