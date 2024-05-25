/**
 * @fileoverview An implementation for a scale for Datetime and Date formats.
 * This file is obsolete anyway.  Might be simpler to delete it.
 *
 * Note: Deprecated. Use DateTickDefiner instead, for now.
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

import {
  find,
  map,
  repeat,
  zip,
} from '@npm//@closure/array/array';
import {dateFromNumber, dateToNumber} from '../../axis/value_number_converter';
import {Options} from '../../common/options';
import * as timeutil from '../../common/timeutil';
import {Value} from '../../data/types';
import {DateFormat} from '../../format/dateformat';
import {ValueScale} from './value_scale';

/**
 * A scale implementation for the Datetime and Date formats. General strategy
 * in converting a date or a datetime object to number using the standard
 * javascript Date.getTime() method, which generally converts a date to number
 * of milliseconds since Jan 1st 1970 midnight.
 * @see goog.i18n.DateTimeFormat).
 * @unrestricted
 */
export class DatetimeValueScale extends ValueScale {
  /** A list of possible date formats */
  private dateFormats: Array<string | AnyDuringAssistedMigration>;

  /**
   * The number of sections this axis should be divided into.
   * Generally one less than the number of ticks, or gridlines.
   * Special cases: 0, 1, or 2 means one section,
   * and -1 means automatic number, aka the "old algorithm".
   */
  override numberOfSections = 0;
  // TODO(dlaliberte): remove '!'
  private tickDuration!: timeutil.Duration;

  // TODO(dlaliberte): remove '!'
  private minDate!: Date;

  // TODO(dlaliberte): remove '!'
  private maxDate!: Date;
  override formatter: AnyDuringAssistedMigration;

  /**
   * @param roundDurationTable An array of duration objects on whole divisors on which ticks can be positioned.
   * @param durationTableRepeatingIntervals The number of repeating intervals at the end of the round duration table.
   * @param dateFormats A list of possible date formats indexed by granularity (
   */
  constructor(
    private readonly roundDurationTable: timeutil.Duration[],
    private readonly durationTableRepeatingIntervals: number,
    dateFormats: string[],
  ) {
    super();

    this.dateFormats = dateFormats;
  }

  getDefaultBaseline(): AnyDuringAssistedMigration {
    // There is no default baseline value for date and datetime.
    return null;
  }

  /**
   * @param options Options object.
   * @param numberOfTicks The required number of ticks. If null, a default is used.
   */
  override init(options: Options, numberOfTicks: number | null) {
    super.init(options, numberOfTicks);

    // Get the user date formats, one per granularity.
    const formatOptions = options.inferObjectValue('formatOptions');
    const userFormats = DatetimeValueScale.formatOptionsToArray(formatOptions);

    // Resolve the date formats
    const formatLayers = [
      // First try to use the granularity format defined in 'formatOptions'.
      userFormats, // Fallback #1: use the general 'format' option.
      repeat(this.getDefaultFormat(), userFormats.length), // Fallback #2: use the default granularity format.
      this.dateFormats,
    ];
    this.dateFormats = DatetimeValueScale.mergeArrays(formatLayers);
  }

  /** Returns the array of formats set up by the init method. */
  getDateFormats(): Array<string | AnyDuringAssistedMigration> {
    return this.dateFormats;
  }

  /**
   * Converts the format options from object representation as specified in the
   * options (string fields according to granularity level), to string array
   * representation (first string is the millisecond format, last one is the
   * year format).
   *
   * @param formatOptions Format options object.
   * @return The format options sorted in an array.
   */
  private static formatOptionsToArray(
    formatOptions: AnyDuringAssistedMigration,
  ): string[] {
    const formats = [];
    formats.push(formatOptions['millisecond']);
    formats.push(formatOptions['second']);
    formats.push(formatOptions['minute']);
    formats.push(formatOptions['hour']);
    formats.push(formatOptions['day']);
    formats.push(formatOptions['month']);
    formats.push(formatOptions['year']);
    return formats;
  }

  /**
   * Merges a list of arrays, ordered by priority.
   * For each index i, the merged array will contain the first valid value found
   * in index i of one of the input arrays, or null if not found.
   * A valid value is one that evaluates to boolean true.
   *
   * @param arrs Arrays ordered by priority.
   * @return The merged arrays.
   */
  private static mergeArrays(
    arrs: AnyDuringAssistedMigration[][],
  ): AnyDuringAssistedMigration[] {
    // Zip 'arrs', which contains n arrays ordered by priority, each with m
    // items, into zippedArrays, which then contains m arrays, each with n items
    // ordered by priority.
    const zippedArrays = zip.apply(null, arrs);

    // For each of the m arrays in zippedArrays, push into 'merged' the highest
    // priority valid item found in the array.
    const merged = map(zippedArrays, (arr) => find(arr, (val) => val));

    return merged;
  }

  inferValue(
    options: Options,
    path: string[] | string,
  ): AnyDuringAssistedMigration {
    // There is no easy cross platform conversion to the DateTime type (Date).
    // (The Date(string) constructor is using different time zones in different
    // browsers).
    // Use plain inferValue.
    return options.inferValue(path);
  }

  /**
   * @param value The value as the underlying data type.
   * @return The value as a number.
   */
  valueToNumberInternal(value: Value | null): number | null {
    return dateToNumber(value);
  }

  /**
   * @param num The value as the underlying data type.
   * @return The value as a number.
   */
  numberToValueInternal(num: number): Date {
    return dateFromNumber(num);
  }

  override calibrateInternal(shouldExpand: boolean) {
    const numericMinValue = this.getNumericMinValue();
    const numericMaxValue = this.getNumericMaxValue();

    let numberOfSections = this.numberOfSections;
    if (numberOfSections === -1) {
      numberOfSections = 6;
    }
    const unroundedTickSize =
      (numericMaxValue - numericMinValue) / numberOfSections;

    // Find ideal unit using round units provided (the unit found will be later
    // used to round all values to whole multiplications of it).
    const unit = timeutil.roundMillisAccordingToTable(
      unroundedTickSize,
      this.roundDurationTable,
      this.durationTableRepeatingIntervals,
    );

    // Use unit to round all values
    let minDate = new Date(numericMinValue);
    let maxDate = new Date(numericMaxValue);
    if (shouldExpand) {
      minDate = timeutil.floorDate(minDate, unit);
      maxDate = timeutil.ceilDate(maxDate, unit);
    } else {
      // Using ceilDate is buggy because it rounds up too much,
      // e.g. Jan 1, 1990 rounds to Jan 1, 1995, when the unit is 5 years.
      // So check if rounding down leaves the date the same.
      // TODO(dlaliberte) Consider skipping this whole else block.
      minDate = timeutil.floorDate(minDate, unit);
      if (this.valueToNumberInternal(minDate) !== numericMinValue) {
        minDate = timeutil.ceilDate(new Date(numericMinValue), unit);
      }
      maxDate = timeutil.floorDate(maxDate, unit);
    }

    // Round unrounded tick size to a unit-wise round value, while making sure
    // result is not zero (if it is, replace it with one unit)
    let tickDuration = timeutil.millisAsDuration(unroundedTickSize);
    tickDuration = timeutil.roundDuration(tickDuration, unit);
    tickDuration =
      timeutil.durationAsMillis(tickDuration) > 0 ? tickDuration : unit;
    this.tickDuration = tickDuration;

    this.minDate = minDate;

    this.maxDate = maxDate;

    if (shouldExpand) {
      this.setNumericMinValue(this.valueToNumberInternal(minDate));
      this.setNumericMaxValue(this.valueToNumberInternal(maxDate));
    }
  }

  generateTicks(shouldExpand: boolean) {
    const ticks: number[] = [];
    let tickDate = this.minDate;
    while (tickDate < this.maxDate) {
      ticks.push(this.valueToNumberInternal(tickDate)!);
      tickDate = timeutil.addDuration(tickDate, this.tickDuration);
    }
    if (shouldExpand || tickDate <= this.maxDate) {
      const tickNumber = this.valueToNumberInternal(tickDate)!;
      ticks.push(tickNumber);
      this.setNumericMaxValue(Math.max(this.getNumericMaxValue(), tickNumber));
    }
    this.setTicks(ticks);
  }

  valueToStringInternal(value: AnyDuringAssistedMigration) {
    const formatter = this.getFormatter();
    return formatter!.formatValue(value as Date);
  }

  /**
   * Gets the relevant date formatter based on the user options and tick
   * duration.
   *
   * @param tickDuration The duration between two consecutive ticks.
   * @return The formatter.
   */
  private getDateFormatter(tickDuration: timeutil.Duration): DateFormat {
    const granularity = timeutil.durationGranularity(tickDuration);
    const format = this.dateFormats[granularity];
    if (typeof format === 'object') {
      return new DateFormat(format);
    }
    return new DateFormat({'pattern': format});
  }

  createFormatter() {
    this.formatter = this.getDateFormatter(this.tickDuration);
  }

  /**
   * Creator method used by scale repository for creating a date value scale.
   * @return The built scale.
   */
  static buildDateValueScale(): ValueScale {
    return new DatetimeValueScale(
      dateRoundUnits,
      DATE_ROUND_UNITS_REPEATING_INTERVALS,
      dateFormatsPerGranularity,
    );
  }

  /**
   * Creator method used by scale repository for creating a datetime value
   * scale.
   * @return The built scale.
   */
  static buildDateTimeValueScale(): ValueScale {
    return new DatetimeValueScale(
      datetimeRoundUnits,
      DATETIME_ROUND_UNITS_REPEATING_INTERVALS,
      datetimeFormatsPerGranularity,
    );
  }
}
/**
 * A static table of round units to be used as tick sizes for dates.
 * Generally a tick size can be a whole multiplication of one of these units,
 * but it turns out it will most likely BE one of these units. Units are
 * durations arrays, in the format [millis, sec, min, hour, day, month, year] as
 * common in timeutils lib.
 */
const dateRoundUnits: timeutil.Duration[] = [
  [0, 0, 0, 0, 1],
  [0, 0, 0, 0, 2],
  [0, 0, 0, 0, 7],
  [0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 3],
  [0, 0, 0, 0, 0, 6],
  [0, 0, 0, 0, 0, 12],
  [0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 5],
  [0, 0, 0, 0, 0, 0, 10],
  [0, 0, 0, 0, 0, 0, 25],
  [0, 0, 0, 0, 0, 0, 50],
  [0, 0, 0, 0, 0, 0, 100],
];

/**
 * The number of intervals in the above table that should be repeated infinitely
 * Setting it to 3 yields: 10yrs, 25 yrs, 50yrs, 100yrs, 250yrs, 500yrs...
 */
const DATE_ROUND_UNITS_REPEATING_INTERVALS = 3;

/** Format of Date per granularity. */
const dateFormatsPerGranularity: string[] = [
  DateFormat.Format.MEDIUM_DATE,
  DateFormat.Format.MEDIUM_DATE,
  DateFormat.Format.MEDIUM_DATE,
  DateFormat.Format.MEDIUM_DATE,
  DateFormat.Format.MEDIUM_DATE,
  DateFormat.Patterns.YEAR_MONTH_ABBR,
  'y',
];

/**
 * Table of round units to be used as tick sizes for datetime. Generally a tick
 * size can be a whole multiplication of one of these units, but it turns out it
 * will most likely BE one of these units. Units are durations arrays, in the
 * format [millis, sec, min, hour, day, month, year] as common in timeutils lib.
 */
const datetimeRoundUnits: timeutil.Duration[] = [
  [1],
  [2],
  [5],
  [10],
  [20],
  [50],
  [100],
  [200],
  [500],
  [0, 1],
  [0, 2],
  [0, 5],
  [0, 10],
  [0, 15],
  [0, 30],
  [0, 0, 1],
  [0, 0, 2],
  [0, 0, 5],
  [0, 0, 10],
  [0, 0, 15],
  [0, 0, 30],
  [0, 0, 0, 1],
  [0, 0, 0, 2],
  [0, 0, 0, 3],
  [0, 0, 0, 4],
  [0, 0, 0, 6],
  [0, 0, 0, 12],
  [0, 0, 0, 0, 1],
  [0, 0, 0, 0, 2],
  [0, 0, 0, 0, 7],
  [0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 3],
  [0, 0, 0, 0, 0, 6],
  [0, 0, 0, 0, 0, 12],
  [0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 5],
  [0, 0, 0, 0, 0, 0, 10],
  [0, 0, 0, 0, 0, 0, 25],
  [0, 0, 0, 0, 0, 0, 50],
  [0, 0, 0, 0, 0, 0, 100],
];

/**
 * The number of intervals in the above table that should be repeated infinitely
 * Setting it to 3 yields: 10yrs, 25 yrs, 50yrs, 100yrs, 250yrs, 500yrs...
 */
const DATETIME_ROUND_UNITS_REPEATING_INTERVALS = 3;

/** Format of Datetime per granularity. */
const datetimeFormatsPerGranularity: string[] = [
  DateFormat.Format.MEDIUM_TIME,
  DateFormat.Format.MEDIUM_TIME,
  DateFormat.Format.SHORT_TIME, // Use a localized pattern, but pass a signal to clear the minutes on to the
  // formatter.
  {'pattern': DateFormat.Format.SHORT_TIME, 'clearMinutes': true},
  DateFormat.Format.MEDIUM_DATE,
  DateFormat.Patterns.YEAR_MONTH_ABBR,
  'y',
];
