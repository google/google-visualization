/**
 * @fileoverview A date/datetime formatter.
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

import DateTimePatterns from 'goog:goog.i18n.DateTimePatterns'; // from //third_party/javascript/closure/i18n:datetimepatterns
import DateTimeSymbols from 'goog:goog.i18n.DateTimeSymbols'; // from //third_party/javascript/closure/i18n:datetimesymbols
import {DateTimeFormat} from '@npm//@closure/i18n/datetimeformat';
import {TimeZone} from '@npm//@closure/i18n/timezone';
import {Options} from '../common/options';
import {Formatter} from '../data/abstract_datatable_interface';
import {ColumnType, Value} from '../data/types';
import {Format} from './format';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Time units.
 * enum {string}
 */
enum TimeUnit {
  MILLISECOND = 'MILLISECOND',
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  QUARTER = 'QUARTER',
  YEAR = 'YEAR',
}

/**
 * A formatter for date and datetime types (and columns).
 */
export class DateFormat extends Format {
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
    DateFormat.formatValueInternalCallback = callback;
  }

  /**
   * Replicate goog.i18n.DateTimeFormat.Format.
   *
   * NOTE(dlaliberte): We need to replicate these here because of the UDS
   * Loader. The Loader only serves i18n-ized versions of the 'format' (this)
   * package. Other packages (corechart, table, etc.) are served with the
   * default (en) LOCALE. By providing a reference here, you get the correctly
   * internationalized Format and Patterns.
   */
  static readonly Format = DateTimeFormat.Format; // : {[key: string]: string|number} =

  /**
   * Replicate goog.i18n.DateTimePatterns.
   *
   * NOTE(dlaliberte): See note above.
   */
  static readonly Patterns = DateTimePatterns;

  /**
   * The pattern specified in the options, or null if not specified.
   */
  private pattern: string | number | null = null;

  /**
   * The internal formatter used to format single values (and not columns).
   * Initialized only when needed - in the first call to formatValue.
   * Will be a DateTimeFormat.
   */
  private formatter: Formatter | null = null;

  /**
   * The format type.
   */
  private formatType!: FormatType;

  /**
   * The column type of the data values being formatted.
   */
  private columnType!: ColumnType;

  /**
   * Whether to clear the minutes for a lower granularity format.
   */
  private clearMinutes!: boolean;

  /**
   * The time zone specified in the options, or null if not given.
   */
  private timeZone!: TimeZone | null;

  /**
   * A formatter for date and datetime types (and columns).
   *
   * @param userOptions Formatting options.
   *
   * Supported properties are:
   * * pattern {string|DateTimeFormat.Format} A format pattern.
   *     When specified, overrides other options such as formatType and
   *     valueType. Either a pattern string or a number representing
   *     DateTimeFormat.Format.
   * * formatType {google.visualization.FormatType} The level of
   *     details in the formatted date, out of 4 predefined levels
   *     (default=SHORT). This is ignored if a pattern is provided.
   * * valueType {google.visualization.ValueType} The type of
   *     values we will format when calling formatValue directly and not
   *     formatting a column (default=DATETIME).
   *     This defines which pattern we will use.
   *     This is ignored if a pattern is provided.
   * * timeZone {number} Time zone offset in hours. This parameter is
   *     optional, if not specified then the internal time zone of the
   *     formatted date is used.
   *
   * Pattern specification: (Refer to JDK/ICU/CLDR)
   * <pre>
   * Symbol   Meaning                 Presentation        Example
   * ------   -------                 ------------        -------
   * G        era designator          (Text)              AD
   * y#       year                    (Number)            1996
   * Y*       year (week of year)     (Number)            1997
   * u*       extended year           (Number)            4601
   * M        month in year           (Text & Number)     July & 07
   * d        day in month            (Number)            10
   * h        hour in am/pm (1~12)    (Number)            12
   * H        hour in day (0~23)      (Number)            0
   * m        minute in hour          (Number)            30
   * s        second in minute        (Number)            55
   * S        fractional second       (Number)            978
   * E        day of week             (Text)              Tuesday
   * e*       day of week (local 1~7) (Number)            2
   * D*       day in year             (Number)            189
   * F*       day of week in month    (Number)            2 (2nd Wed in July)
   * w*       week in year            (Number)            27
   * W*       week in month           (Number)            2
   * a        am/pm marker            (Text)              PM
   * k        hour in day (1~24)      (Number)            24
   * K        hour in am/pm (0~11)    (Number)            0
   * z        time zone               (Text)              Pacific Standard Time
   * Z        time zone (RFC 822)     (Number)            -0800
   * v        time zone (generic)     (Text)              Pacific Time
   * g*       Julian day              (Number)            2451334
   * A*       milliseconds in day     (Number)            69540000
   * '        escape for text         (Delimiter)         'Date='
   * ''       single quote            (Literal)           'o''clock'
   *
   * Item marked with '*' are not supported yet.
   * Item marked with '#' works different than java
   *
   * The count of pattern letters determine the format.
   * (Text): 4 or more, use full form, <4, use short or abbreviated form if it
   * exists. (e.g., "EEEE" produces "Monday", "EEE" produces "Mon")
   *
   * (Number): the minimum number of digits. Shorter numbers are zero-padded to
   * this amount (e.g. if "m" produces "6", "mm" produces "06"). Year is handled
   * specially; that is, if the count of 'y' is 2, the Year will be truncated to
   * 2 digits. (e.g., if "yyyy" produces "1997", "yy" produces "97".) Unlike
   * other fields, fractional seconds are padded on the right with zero.
   *
   * (Text & Number): 3 or over, use text, otherwise use number. (e.g., "M"
   * produces "1", "MM" produces "01", "MMM" produces "Jan", and "MMMM" produces
   * "January".)
   *
   * Any characters in the pattern that are not in the ranges of ['a'..'z'] and
   * ['A'..'Z'] will be treated as quoted text. For instance, characters like
   * ':',
   * '.', ' ', '#' and '@' will appear in the resulting time text even they are
   * not embraced within single quotes.
   * </pre>
   *
   */
  constructor(userOptions?: AnyDuringMigration | null) {
    super();

    this.init(userOptions);
  }

  /**
   * Initialization method given options.
   * @param userOptions Formatting options.
   */
  init(userOptions?: AnyDuringMigration | null) {
    const defaults = {
      'formatType': FormatType.SHORT,
      'valueType': ColumnType.DATETIME,
    };
    const options = new Options([userOptions || {}, defaults]);
    this.pattern = options.inferValue('pattern');
    this.formatter = null;
    this.formatType = options.inferOptionalStringValue(
      'formatType',
      Object.values(FormatType),
    ) as FormatType;
    this.columnType = options.inferOptionalStringValue(
      'valueType',
      Object.values(ColumnType),
    ) as ColumnType;
    this.clearMinutes = options.inferBooleanValue('clearMinutes', false);
    this.timeZone = null;
    const timeZone = options.inferOptionalNumberValue('timeZone');
    if (timeZone != null) {
      this.timeZone = TimeZone.createTimeZone(-timeZone * 60);
    }
  }

  /**
   * Prevents time formatter from using local digits if available. It's
   * specifically used to force western numerals in Arabic locale.
   *
   * The purpose of this function is to provide an interface to the underlying
   * DateTimeSymbols that is served by the UDS loader and therefore not
   * reachable from other modules.
   */
  static dontLocalizeDigits() {
    DateTimeSymbols.ZERODIGIT = undefined;
  }

  /**
   * Combines the value type and format type into a single pattern.
   * @param columnType The value type.
   * @param formatType Format type.
   * @return The combined pattern.
   */
  static combinePattern(
    columnType: ColumnType | null,
    formatType: FormatType,
  ): number {
    // TODO(dlaliberte): Not sure if this is the correct thing to return in the
    // default case, but we need something.
    const defaultFormat = DateTimeFormat.Format.FULL_DATETIME;
    switch (columnType) {
      case ColumnType.DATE:
        switch (formatType) {
          case FormatType.FULL:
            return DateTimeFormat.Format.FULL_DATE;
          case FormatType.LONG:
            return DateTimeFormat.Format.LONG_DATE;
          case FormatType.MEDIUM:
            return DateTimeFormat.Format.MEDIUM_DATE;
          case FormatType.SHORT:
            return DateTimeFormat.Format.SHORT_DATE;
          default:
            return defaultFormat;
        }
      case ColumnType.DATETIME:
        switch (formatType) {
          case FormatType.FULL:
            return DateTimeFormat.Format.FULL_DATETIME;
          case FormatType.LONG:
            return DateTimeFormat.Format.LONG_DATETIME;
          case FormatType.MEDIUM:
            return DateTimeFormat.Format.MEDIUM_DATETIME;
          case FormatType.SHORT:
            return DateTimeFormat.Format.SHORT_DATETIME;
          default:
            return defaultFormat;
        }
      case ColumnType.TIME:
        switch (formatType) {
          case FormatType.FULL:
            return DateTimeFormat.Format.FULL_TIME;
          case FormatType.LONG:
            return DateTimeFormat.Format.LONG_TIME;
          case FormatType.MEDIUM:
            return DateTimeFormat.Format.MEDIUM_TIME;
          case FormatType.SHORT:
            return DateTimeFormat.Format.SHORT_TIME;
          default:
            return defaultFormat;
        }
      default:
        return defaultFormat;
    }
  }

  /**
   * Sets the time unit to use when formatting dates.
   * Initialize date formatter given a time granularity.
   * NOTE: We only provide specific formatters for YEAR, QUARTER, MONTH,
   * and DAY at this point. All other granularities will be formatted using
   * the DateTimeFormat.Format.SHORT_DATETIME pattern.
   *
   * @param timeUnit The time granularity to get a formatter for.
   */
  setTimeUnit(timeUnit: TimeUnit) {
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
    this.init({'pattern': pattern, 'timeZone': 0});
  }

  /**
   * Formats a single value.
   * @param value Must be a Date to format.
   * @return The formatter date.
   */
  formatValueInternal(value: Value): string | null {
    if (DateFormat.formatValueInternalCallback) {
      return DateFormat.formatValueInternalCallback.call(
        this,
        value as Date,
        this.pattern,
      );
    }

    if (!this.formatter) {
      this.formatter = this.createFormatter(this.columnType);
    }
    return this.formatValueWithFormatter(this.formatter, value as Date);
  }

  /**
   * Returns an acceptable column type for this column type.
   * or null if not acceptable.
   *
   * @param columnType The column to format.
   */
  getValueType(columnType: ColumnType | null): ColumnType | null {
    const valueType = Options.convertToString(columnType, ColumnType);
    if (valueType !== ColumnType.DATE && valueType !== ColumnType.DATETIME) {
      return null;
    }
    return valueType;
  }

  /**
   * Creates an internal formatter that will be used for formatting values.
   * The formatter may depend on the column type
   * @param columnType The value type.
   * @return A formatter.
   */
  override createFormatter(columnType: ColumnType | null): Formatter {
    // If no pattern was given, we build a pattern according to the format type
    // and value type.
    let pattern = this.pattern;
    if (pattern == null) {
      pattern = DateFormat.combinePattern(columnType, this.formatType);
    }
    // DateLike is basically a Date.
    const dateTimeFormatter = new DateTimeFormat(pattern);
    const formatter = {
      format: (value: Value | null, options: AnyDuringMigration) => {
        // We should be able to check the typeof value:
        // Note, pass through the options, in case they are used.
        return dateTimeFormatter.format(value as Date, options);
      },
    };
    return formatter;
  }

  /**
   * Formats a single value internally, given a formatter.
   * @param formatter The formatter to use.  Must be applicable to value.
   * @param value The date to format.
   * @return The formatted value.
   */
  override formatValueWithFormatter(
    formatter: Formatter,
    value: Date | null,
  ): string | null {
    if (value === null) {
      return '';
    }

    // Getting the right timezone - from the options if was given, or otherwise
    // from the value itself.
    let timeZone = this.timeZone;
    if (timeZone == null) {
      timeZone = TimeZone.createTimeZone(value.getTimezoneOffset());
    }

    // Set the minutes to 00 in an i18n friendly way (i.e. preserve the
    // localized pattern.
    const date = new Date(value.getTime());
    if (this.clearMinutes) {
      date.setMinutes(0);
    }
    return formatter.format(date, timeZone);
  }
}

/**
 * Date formatting type.
 */
export enum FormatType {
  FULL = 'full',
  LONG = 'long',
  MEDIUM = 'medium',
  SHORT = 'short',
}
