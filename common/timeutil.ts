/**
 * @fileoverview Global time, date and duration utilities for charting.
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

import * as asserts from '@npm//@closure/asserts/asserts';

import * as util from './util';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Duration - length 1 to 7: [ms, s, m, h, d, M, y]
 * typedef {!Array<number>}
 */
export type Duration = number[];

/**
 * Time of day - length 1 to 7
 *   [h], [h, m], [h, m, s], [h, m, s, ms] or ... [y, M, d, h, m, s, ms]
 * typedef {!Array<number>}
 */
export type TimeOfDay = number[];

/**
 * Given a date and a duration unit, rounds a date downwards to the closest
 * whole multiplication of unit that is smaller or equal to
 * given date. Duration unit must be all zeros but one
 * entry, which must be bounded (eg 1 month but not 1 year and 1 month and not
 * 18 months) so only very specific values of duration will work. No validation
 * is performed however.
 *
 * @param date the date to be rounded.
 * @param unit the duration unit.
 * @return the rounded Date.
 */
export function floorDate(date: Date, unit: Duration): Date {
  return roundDateInternal(date, unit, 0);
}

/**
 * Given a date and a duration unit, rounds a date upwards to the closest
 * whole multiplication of unit that is larger of equal to
 * given date. @see #floorDate.
 *
 * @param date The date to be rounded.
 * @param unit The duration unit.
 * @return The rounded date.
 */
export function ceilDate(date: Date, unit: Duration): Date {
  return roundDateInternal(date, unit, 1);
}

/**
 * An internal private function implementing the required behavior for both
 * floorDate and ceilDate.
 * @param date The date to be rounded.
 * @param unit The duration unit.
 * @param direction Configuration parameter - 0 for downwards,
 *    1 for upwards.
 * @return The rounded date.
 */
function roundDateInternal(
  date: Date,
  unit: Duration,
  direction: number,
): Date {
  // Clone date and work on cloned copy
  // Firefox requires that single value for Date constructor is milliseconds.
  const newDate = new Date(date.getTime());
  // In the process of rounding up we iterate digits from least to most
  // significant. We must keep track of whether or not we've nullified some
  // less significant digits. An example from the decimal domain illustrates the
  // carry idea: Ceil(1.0001) is '2' (carry) but Ceil(1.00000) is '1' (no carry)
  let carry = false;
  const unitLength = unit.length;
  const roundingFunction = [Math.floor, Math.ceil][direction];
  // TODO(dlaliberte): Clean up this for loop. ... eyes burning.
  for (let i = 0; i < unitLength; ++i) {
    const getter = (date as AnyDuringMigration)['get' + dateMethodNames[i]];
    const setter = (date as AnyDuringMigration)['set' + dateMethodNames[i]];
    const dateDigit = getter.apply(date);
    const unitDigit = unit[i];
    // Zero of current digit (zero for all but days for which it is one)
    const zeroDigit = durationZeros[i];
    if (unitDigit === 0) {
      // Carry is used if and only if when direction is 1
      carry = carry || (dateDigit !== 0 && direction !== 0);
      setter.apply(newDate, [zeroDigit]);
      continue;
    }
    if (carry) {
      // If we have carry, meaning we are rounding upwards and we have
      // nullified less significant digits already, so ceil won't do. Flooring
      // and then adding one will do the trick.
      // For example:
      //   [1, 0, 10] -> [0, 0, 10] -> [0, 0, 10] Only ceil - incorrect.
      //   [1, 0, 10] -> [0, 0, 10] -> [0, 0, 11] Floor + 1 - correct.
      setter.apply(newDate, [
        zeroDigit +
          unitDigit * (1 + Math.floor((dateDigit - zeroDigit) / unitDigit)),
      ]);
    } else {
      setter.apply(newDate, [
        zeroDigit +
          unitDigit * roundingFunction((dateDigit - zeroDigit) / unitDigit),
      ]);
    }
    break;
  }
  return newDate;
}

/**
 * Rounds a duration value 'downwards' toward a whole multiplication of a given
 * 'unit' direction. Duration unit must be all zeros but
 * one entry, which must be bounded (eg. 1 month but not 1 year and 1 month and
 * not 18 months) so only very specific values of duration will work as units.
 * no validation is performed however.
 *
 * @param duration The duration to floor.
 * @param unit The unit duration.
 * @return The floored duration.
 */
export function floorDuration(duration: Duration, unit: Duration): Duration {
  return roundDurationInternal(duration, unit, Math.floor);
}

/**
 * Rounds a duration value 'upwards' toward a whole multiplication of a given
 * 'unit' direction. Duration unit must be all zeros but
 * one entry, which must be bounded (eg. 1 month but not 1 year and 1 month and
 * not 18 months) so only very specific values of duration will work as units.
 * no validation is performed however.
 *
 * @param duration The duration to ceil.
 * @param unit The unit duration.
 * @return The ceiling duration.
 */
export function ceilDuration(duration: Duration, unit: Duration): Duration {
  return roundDurationInternal(duration, unit, Math.ceil);
}

/**
 * Rounds a duration value toward the closest whole multiplication of a given
 * 'unit' direction. Duration unit must be all zeros but
 * one entry, which must be bounded (eg. 1 month but not 1 year and 1 month and
 * not 18 months) so only very specific values of duration will work as units.
 * no validation is performed however. The 15th at midnight is considerred as
 * beeing exactly one half of the month, And Such is the 7th month. <br> Eg. [0,
 * 0, 0, 0, 15, 1, 0] = 1.5 Month, <br> [0, 0, 0, 0, 0, 6, 6] = 6.5 Yr.
 *
 * @param duration The duration to round.
 * @param unit The unit duration.
 * @return The rounded duration.
 */
export function roundDuration(duration: Duration, unit: Duration): Duration {
  return roundDurationInternal(duration, unit, Math.round);
}

/**
 * Rounds a duration value according to a given rounding function
 * uses durationHalves as half range indicators
 * @param duration The duration to round.
 * @param unit The unit duration.
 * @param func The rounding function.
 * @return The rounded duration.
 */
function roundDurationInternal(
  duration: Duration,
  unit: Duration,
  func: (p1: number) => number,
): Duration {
  const newduration = Array.from(duration);
  let i;
  for (i = 0; i < newduration.length && unit[i] === 0; ++i) {
    newduration[i] = 0;
  }
  asserts.assert(i !== newduration.length);

  if (i === 0) {
    newduration[0] = func(duration[0] / unit[0]) * unit[0];
    return newduration;
  }
  let fraction = 0;
  // TODO(dlaliberte): document
  if (duration[i - 1] >= durationHalves[i - 1]) {
    fraction = 0.7;
  } else if (duration[i - 1] > 0) {
    fraction = 0.1;
  }
  newduration[i] = func((duration[i] + fraction) / unit[i]) * unit[i];
  return newduration;
}

/**
 * Floors a given date to be a Monday.
 *
 * @param date The date to floor.
 * @return The date after it was floored to Monday.
 */
export function floorDateToMonday(date: Date): Date {
  // We first floor to a day.
  date = floorDate(date, [0, 0, 0, 0, 1]);
  // We now reduce some days for it to be a Monday.
  const numDays = (7 + date.getDay() - 1) % 7;
  date = subtractDuration(date, [0, 0, 0, 0, numDays]);
  return date;
}

/**
 * Rounds milliseconds to closest duration from a given table. Table must be
 * sorted in ascending direction. Comparing which is closer is performed in the
 * logarithm domain. If numOfRepeatingSubIntervals is provided and
 * non zero, values that are higher than table max are calculated against a
 * simulated infinite extrapolation of the table, i.e. against a copy of the
 * original with the last few intervals repeating themselves infinitely
 * (again, in the logarithm domain). So for example the following table:
 * [1, 10, 100] is extended infinitely to all powers of 10.
 * [1, 2, 10] with numOfRepeatingSubIntervals = 2 is extended to
 * [1, 2, 10, 20, 100, 200, 1000, 2000...].
 *
 * @see util#extrapolatedClosestValueTo
 * @param millis The duration to round (in milliseconds).
 * @param durationTable Array of round durations.
 * @param numOfRepeatingSubIntervals Number of intervals from the
 *     end of the table to repeat infinitely. Defaults to 0 (meaning no infinite
 *     repetition).
 * @return The duration closest to the milliseconds given.
 * @suppress {checkTypes}
 */
export function roundMillisAccordingToTable(
  millis: number,
  durationTable: Duration[],
  numOfRepeatingSubIntervals?: number,
): Duration {
  const logTable = durationTable.map((v) => [Math.log(durationAsMillis(v))]);
  if (!numOfRepeatingSubIntervals) {
    // No repeating intervals, meaning there is no need for extrapolation
    const index = util.closestValueTo(Math.log(millis), logTable);
    return durationTable[index];
  }
  const roundIndexValueTuple = util.extrapolatedClosestValueTo(
    Math.log(millis),
    logTable,
    numOfRepeatingSubIntervals,
  );
  const index = roundIndexValueTuple[0];
  // If index points to an actual member of table, return it
  if (index <= logTable.length - 1) {
    return durationTable[index];
  }
  // Index is simulated
  // so we'll have to use the second return value
  // that is the actual log of the duration (in infinite table)
  // Running Math.exp can be a bit unacurate so we round it
  // using the largest unit that was handed to us
  const logMillis = roundIndexValueTuple[1];

  const largestUnitInTable = durationTable[durationTable.length - 1];

  return roundDuration(
    millisAsDuration(Math.exp(logMillis)),
    largestUnitInTable,
  );
}

/**
 * Adds a duration to a date. Uses javascript Date setters to add values to
 * every digit and relies on it performing correct carry.
 *
 * Warning: Adding one hour during the switch of daylight saving time may leave
 * the date at the same value. In such a case this function will throw an error.
 *
 * @param date the date.
 * @param duration Duration to add to the date.
 * @return The date as would be after a 'duration' has passed.
 */
export function addDuration(date: Date, duration: Duration): Date {
  return addDurationInternal(date, duration, 1);
}

/**
 * Subtracts a duration from a date. Uses javascript Date setters to subtract
 * values from every digit and relies on it performing correct carry.
 *
 * @param date the date.
 * @param duration Duration to subtract from the date.
 * @return The date as would be before a 'duration' has passed.
 */
export function subtractDuration(date: Date, duration: Duration): Date {
  return addDurationInternal(date, duration, -1);
}

/**
 * Adds or subtracts duration to a date. Uses javascript Date setters to add
 * values to every digit and relies on it performing correct carry.
 * Any of the duration components or the factor can be negative.
 * Warning: Adding one hour during the switch of daylight saving time may leave
 * the date at the same value.  No error will be thrown.
 * @param date the date.
 * @param duration Duration to add to the date.
 * @param factor A factor by which to multiply the added duration.
 *     (Can be set to 1/-1 for subtraction).
 * @return The date as would be after a 'duration' has passed.
 */
function addDurationInternal(
  date: Date,
  duration: Duration,
  factor: number,
): Date {
  // Due to a bug in IE, we cannot use the standard copy constructor as it does
  // not copy the milliseconds field.
  const newDate = new Date(date.getTime());
  if (isDurationZero(duration)) {
    return newDate;
  }
  for (let i = 0; i < duration.length; ++i) {
    if (duration[i] === 0) {
      continue;
    }
    const methodName = dateMethodNames[i];
    const setter = (newDate as AnyDuringMigration)[`set${methodName}`];
    const getter = (newDate as AnyDuringMigration)[`get${methodName}`];
    const value = getter.apply(newDate, []) as number;
    setter.apply(newDate, [value + factor * duration[i]]);
  }
  return newDate;
}

/**
 * An iterator over dates, starting at the first given date, in jumps
 * of duration (given as the unit index and value), up-to (and excluding) the
 * end date.
 * This function is more efficient than calling addDuration many times, and
 * also handles the daylight saving time issues which may result in an
 * infinite loops. For additional efficiency, we allow the duration to be of a
 * single unit type (i.e., only "5 minutes" and not "1 day and 5 minutes").
 */
export class DateRangeIter {
  private readonly startMs: number;
  private unitValue: number;
  private readonly setter: (p1: number) => AnyDuringMigration;
  private nextDate: Date;

  /**
   * @param startDate The start date.
   * @param endDate The end date.
   * @param unit The duration unit we want to modify.
   * @param quantity How much of the unit to add each time.
   */
  constructor(
    startDate: Date,
    private readonly endDate: Date,
    unit: number,
    private readonly quantity: number,
  ) {
    this.startMs = startDate.getTime();

    const getter = (startDate as AnyDuringMigration)[
      'get' + dateMethodNames[unit]
    ];

    this.unitValue = getter.apply(startDate, []);

    this.setter = (startDate as AnyDuringMigration)[
      'set' + dateMethodNames[unit]
    ];

    this.nextDate = new Date(this.startMs);
  }

  /**
   * Returns true if there is at least one more date in the range.
   * @return True if there is at least one more date in the range.
   */
  hasNext(): boolean {
    return this.nextDate <= this.endDate;
  }

  /**
   * Returns the next date in the range of dates.
   * Note: should be called only when hasNext() returns true.
   * @return The next date in the range of dates.
   */
  next(): Date {
    asserts.assert(this.hasNext());

    const ret = this.nextDate;
    this.nextDate = new Date(this.startMs);
    this.unitValue += this.quantity;
    this.setter.apply(this.nextDate, [this.unitValue]);
    return ret;
  }

  /**
   * Returns the next item (or null if there isn't any) without changing the
   * state of the iterator.
   * @return The next item.
   */
  peek(): Date | null {
    return this.hasNext() ? this.nextDate : null;
  }
}

/**
 * Determines whether a duration is zero.
 * @param duration The duration to test.
 * @return Whether the duration is zero or not.
 */
export function isDurationZero(duration: Duration): boolean {
  for (let i = 0; i < duration.length; ++i) {
    if (duration[i] !== 0) {
      return false;
    }
  }
  return true;
}

/**
 * Parses a duration of the @link http://en.wikipedia.org/wiki/ISO_8601
 * format. Returns null when parsing fails.
 * @param text Text to parse a duration out of.
 * @return The parsed duration or null if the string is not a
 *     legal duration string.
 */
export function parseDuration(text: string): Duration | null {
  const result = [0, 0, 0, 0, 0, 0, 0];
  if (text.match(durationRegularExpression) == null) {
    return null;
  }
  // Find all occurrences of [Number][Letter] then iterate all matches, setting
  // The correct digit referenced by letter (s for seconds, m for minutes etc).
  // While doing so, use symbol order table to make sure correct order of
  // symbols is used (eg. M means minutes after a T was encountered). Do so
  // using two iterators - one traversing matches in duration string, the other
  // keeping trakc of correct index in symbol table.
  const letters = text.match(/(\d+[YMDHS]|[PT])/g);
  if (letters == null) {
    return null;
  }
  const length = letters.length;

  // Index of position in dso table (starting with 0 which is years).
  let dsoIndex = 0;
  const dso = durationSymbolOrder;
  const dsoLength = dso.length;

  // Now traverse all matches, while keeping index of position in dso table
  // (using dsoIndex).
  let i = 0;
  for (; i < length; ++i) {
    // What letter
    const letterMatch = letters[i].match(/[YMDHSPT]/);
    if (letterMatch == null) {
      return null;
    }
    const letter = letterMatch[0];
    const numbLettersMatch = letters[i].match(/\d+/g);
    const numbLetters = (numbLettersMatch && numbLettersMatch[0]) || 0;
    // Nullify all digits that are not specified in string.
    // And update dsoIndex so it points to correct index in table.
    while (dso[dsoIndex][0] !== letter && dsoIndex < dsoLength) {
      // Ignore place holder letters
      if (dso[dsoIndex][0] !== 'P' && dso[dsoIndex][0] !== 'T') {
        result[dso[dsoIndex][2]] = 0;
      }
      dsoIndex = dsoIndex + 1;
    }
    // Set correct digit to number, use table to map letter to digit
    if (dsoIndex < dsoLength && numbLetters != null) {
      result[dso[dsoIndex][2]] = numbLetters ? Number(numbLetters) : 0;
      dsoIndex = dsoIndex + 1;
    } else {
      return null;
    }
  }
  if (i < length) {
    return null;
  }
  // Nullify remaining digits
  while (dsoIndex < dsoLength) {
    if (dso[dsoIndex][0] !== 'P' && dso[dsoIndex][0] !== 'T') {
      result[dso[dsoIndex][2]] = 0;
    }
    dsoIndex = dsoIndex + 1;
  }
  return result;
}

/**
 * Returns the index of the last element in the array where predicate is true,
 * and -1 otherwise.
 * @param array The source array to search in
 * @param predicate find calls predicate once for each element of the array, in
 *     descending order, until it finds one where predicate returns true. If
 *     such an element is found, findLastIndex immediately returns that element
 *     index. Otherwise, findLastIndex returns -1.
 */
export function findLastIndex<T>(
  array: T[],
  predicate: (value: T, index: number, obj: T[]) => boolean,
): number {
  let l = array.length;
  while (l--) {
    if (predicate(array[l], l, array)) return l;
  }
  return -1;
}

/**
 * Formats a duration according to the http://en.wikipedia.org/wiki/ISO_8601
 * format. Tries to keep it as compact as possible.
 * @param duration The duration to format.
 * @return The formatted duration string.
 */
export function formatDuration(duration: Array<string | number>): string {
  // Should there be a 'T' in the string? helps differentiate 1MT - one month
  // and T1M one minute. There should be a T if only one is present.
  const withT =
    !(duration[2] !== 0 && duration[5] !== 0) &&
    !(duration[2] === 0 && duration[5] === 0);
  // Initialize left and right pointers to point to left most and rightmost non
  // zero elements of array. (right starts from last member - years, left from
  // first).
  const l = duration.findIndex((v) => v !== 0);
  const r = findLastIndex(duration, (v) => v !== 0);
  // Zero duration
  if (r < l) {
    return '0';
  }
  const builtString = [];
  // Place a T in front of string if there are no years nor months nor days
  if (withT && r < 3) {
    builtString.push('T');
  }
  // Fill in the string, years first.
  for (let i = r; i >= l; --i) {
    if (withT && i === 3) {
      builtString.push('T');
    }
    if (duration[i] !== 0) {
      // Place number at current position
      builtString.push(duration[i]);
      // Use index string to place correct suffix char
      builtString.push('#SMHDMY'.charAt(i));
    }
  }
  // Might still be need of a suffix T, if no hours nor minutes nor seconds are
  // present.
  if (withT && l > 3) {
    builtString.push('T');
  }
  return builtString.join('');
}

/**
 * Return the 'granularity' of a given duration. That is the
 * index of the first non zero member (0 for ms, 1 for sec, 2 for mins...)
 * Returns 0 for an empty duration.
 *
 * @param duration The duration to test.
 * @return The granularity.
 */
export function durationGranularity(duration: Duration): number {
  const n = duration.findIndex((v) => v !== 0);
  return Math.max(0, n);
}

/**
 * Parses a duration object and then converts it to milliseconds.
 * @param durationString The duration as a string.
 * @return Milliseconds in the duration object represented by the
 *     given string or -1 if failed parsing string as duration.
 */
export function durationStringAsMillis(durationString: string): number {
  return durationAsMillis(parseDuration(durationString));
}

/**
 * Formats a duration representing a given number of milliseconds.
 * @param millis Milliseconds in the duration.
 * @return duration The duration as a string.
 * @suppress {checkTypes}
 */
export function millisAsDurationString(millis: number): string {
  return formatDuration(millisAsDuration(millis));
}

/**
 * Converts duration as an array to number of millis.
 * Is only an approximation as the exact number of millis depends on the
 * year/months around which the duration object lives.
 * Duration object is of the type:
 *     [milliseconds, seconds, minutes, hours, days, months, years]
 *
 * @param duration the duration object.
 * @return Number of milliseconds in duration or -1 if duration is
 *     null.
 */
export function durationAsMillis(duration: Duration | null): number {
  if (duration == null) {
    return -1;
  }
  let millis = 0;
  const l = duration.length;
  for (let i = 0; i < l; ++i) {
    millis += duration[i] * durationCoefficients[i];
  }
  return millis;
}

/**
 * Converts milliseconds to a duration object.
 * Is only an approximation as the exact number of millis depends on the
 * year/months around which the duration object lives.
 *
 * @param millis The number of milliseconds.
 * @return A duration object containing that number of millis.
 */
export function millisAsDuration(millis: number): Duration {
  const result = [];
  for (let i = durationCoefficients.length - 1; i >= 0; i--) {
    result[i] = Math.floor(millis / durationCoefficients[i]);
    millis -= result[i] * durationCoefficients[i];
  }
  return result;
}

/**
 * Function for calculating number of milliseconds in a timeofday object,
 * counting from midnight.
 *
 * @param timeofday timeofday object to be converted.
 * @return Number of milliseconds since midnight.
 */
export function timeOfDayAsMillis(timeofday: TimeOfDay): number {
  const duration = timeOfDayAsDuration(timeofday);
  return durationAsMillis(duration);
}

/**
 * Function for calculating a timeofday representing the time 'millis'
 * milliseconds from midnight
 *
 * @param millis Number of milliseconds since midnight.
 * @return timeofday timeofday object representing that number
 *     of milliseconds.
 */
export function millisAsTimeOfDay(millis: number): TimeOfDay {
  const duration = millisAsDuration(millis);
  const timeofday = duration.reverse();
  return timeofday;
}

/**
 * Function for calculating number of milliseconds in a timeofday object,
 * counting from midnight.
 *
 * @param timeofday timeofday object to be converted.
 * @return Number of milliseconds since midnight.
 */
export function timeOfDayAsDuration(timeofday: TimeOfDay): Duration {
  if (timeofday.length < 4) {
    timeofday = timeofday.concat(new Array(4 - timeofday.length).fill(0));
  } else {
    timeofday = Array.from(timeofday);
  }
  return timeofday.reverse();
}

/**
 * Function for calculating a timeofday representing a duration.
 *
 * @return timeofday timeofday object representing the duration.
 */
export function durationAsTimeOfDay(duration: Duration): TimeOfDay {
  const timeofday = duration.reverse();
  return timeofday;
}

/**
 * Return a date computed from a timeofday object, relative to 1/1/1970 00:00.
 *
 * @param timeofday the object to be converted.
 * @return The date.
 */
export function timeOfDayAsDate(timeofday: TimeOfDay): Date {
  const duration = timeOfDayAsDuration(timeofday);
  return durationAsDate(duration);
}

/**
 * Translates a date object into a "duration" array (since 1/1/1970 00:00).
 *
 * @param date The date.
 * @return The duration array.
 */
export function dateAsDuration(date: Date): Duration {
  return [
    date.getUTCMilliseconds(),
    date.getUTCSeconds(),
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate() - 1, // The Date object counts the days from 1.
    date.getUTCMonth(),
    date.getUTCFullYear() - 1970,
  ];
}

/**
 * Translates a "duration" array (since 1/1/1970 00:00) into a date object. The
 * duration array can contain values which are not in their proper range, which
 * the date will consider proper (for example, if the year was 2000 and 18
 * months, it would be in fact July 2001).
 *
 * @param duration The duration array (can be partial).
 * @return The date.
 */
export function durationAsDate(duration: Duration): Date {
  // Since the constructor of Date doesn't handle small years well (it can add
  // 1900 to them), we set the fields one by one.
  const date = new Date(Date.UTC(1970, 0, 1, 0, 0, 0, 0));
  date.setUTCFullYear((duration[6] || 0) + 1970);
  date.setUTCMonth(duration[5] || 0);
  date.setUTCDate((duration[4] || 0) + 1);
  // day of month is 1-based
  date.setUTCHours(duration[3] || 0);
  date.setUTCMinutes(duration[2] || 0);
  date.setUTCSeconds(duration[1] || 0);
  date.setUTCMilliseconds(duration[0] || 0);
  return date;
}

/**
 * Returns a timeofday value normalized to 7 parts, and such that all parts
 * are positive and all but the largest granularity will have values
 * less than the unit size.
 *
 * @param timeofday timeofday object to be converted.
 * @return Normalized timeofday.
 */
export function normalizeTimeOfDay(timeofday: TimeOfDay): TimeOfDay {
  const duration = timeOfDayAsDuration(timeofday);
  // Loop through from low to high to carry overflow to higher units.
  let carry = 0;
  for (let i = 0; i < duration.length; i++) {
    let part = duration[i];
    const sign = part < 0 ? -1 : 1;
    part = carry + Math.abs(part);
    carry = Math.floor(durationUnits[i] / part);
    part = durationUnits[i] % part;
    part *= sign;
    duration[i] = part;
  }

  return duration.reverse();
}

/**
 * Returns a unit which is smaller than the given one. Returns the same unit
 * for the minimal unit.
 * @param inputUnit The input unit.
 * @return a smaller unit.
 */
export function smallerUnit(inputUnit: Duration): Duration {
  // We cannot handle a given unit of 1 ms.
  if (inputUnit[0]) {
    return [1];
  }
  const unit = [];
  for (let i = 1; i < inputUnit.length; ++i) {
    if (inputUnit[i]) {
      unit.push(1);
      return unit;
    }
    unit.push(0);
  }
  // As a safety, we add 1 at the end.
  unit.push(1);
  return unit;
}

/**
 * Returns a duration which is a multiple of the given duration.
 * @param duration The duration to multiply with.
 * @param multiplier The factor.
 * @return The multiplied duration.
 */
export function multiplyDuration(
  duration: Duration,
  multiplier: number,
): Duration {
  return duration.map((x) => x * multiplier);
}

/**
 * Returns a timeofday which is a multiple of the given timeofday.
 * @param timeofday The timeofday to multiply with.
 * @param multiplier The factor.
 * @return The multiplied timeofday.
 */
export function multiplyTimeOfDay(
  timeofday: TimeOfDay,
  multiplier: number,
): TimeOfDay {
  return timeofday.map((x) => x * multiplier);
}

/**
 * Used for mapping duration array to Date method names
 */
const dateMethodNames: string[] = [
  'Milliseconds',
  'Seconds',
  'Minutes',
  'Hours',
  'Date',
  'Month',
  'FullYear',
];

/**
 * An enumeration of all the supported date units.
 */
export const TIME_UNIT = {
  MILLISECONDS: 'milliseconds',
  SECONDS: 'seconds',
  MINUTES: 'minutes',
  HOURS: 'hours',
  DAYS: 'days',
  MONTHS: 'months',
  YEARS: 'years',
};

/**
 * The order of the date units.  index -> unit
 * TODO(dlaliberte): Merge with milliseconds.js TIME_UNITS
 */
export const timeUnitOrder: string[] = [
  TIME_UNIT.MILLISECONDS,
  TIME_UNIT.SECONDS,
  TIME_UNIT.MINUTES,
  TIME_UNIT.HOURS,
  TIME_UNIT.DAYS,
  TIME_UNIT.MONTHS,
  TIME_UNIT.YEARS,
];

/**
 * The index of each of the time units.  unit -> index
 */
export const timeUnitIndex: {[key: string]: number} = {};

for (const [index, unit] of timeUnitOrder.entries()) {
  timeUnitIndex[unit] = index;
}

/**
 * The duration of each time unit.  index -> duration
 */
export const timeUnitDurations: Duration[] = [
  [1],
  [0, 1],
  [0, 0, 1],
  [0, 0, 0, 1],
  [0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 1],
];

/**
 * Used for knowing which Date methods are 1 based. i.e. months
 */
const durationZeros: Duration = [0, 0, 0, 0, 1, 0, 0];

/**
 * Used for rounding.
 */
const durationHalves: Duration = [500, 30, 30, 12, 15, 6, 0];

/**
 * Used for normalizing.
 */
const durationUnits: Duration = [1000, 60, 60, 24, 30, 12, 0];

/**
 * Counts milliseconds in every duration unit
 * Used for converting milliseconds <-> duration.
 */
const durationCoefficients: Duration = [
  1, 1000, 60000, 3600000, 86400000, 2629743830, 31556926000,
];

/**
 * Regular expression helping identify duration objects before trying to parse
 * them.
 */
const durationRegularExpression = new RegExp(
  '^P?(\\d+[YMDHMS])*T?(\\d+[YMDHMS])*$',
);

/**
 * Helper table for parsing durations
 */
const durationSymbolOrder: AnyDuringMigration[][] = [
  ['P', 'prefix', -1], //
  ['Y', 'years', 6], //
  ['M', 'months', 5], //
  ['D', 'days', 4], //
  ['T', 'delimiter', -1], //
  ['H', 'hours', 3], //
  ['M', 'minutes', 2], //
  ['S', 'seconds', 1], //
];

/**
 * @param date1 One date.
 * @param date2 Another date.
 */
export function maxDate(date1: Date, date2: Date): Date {
  return date1.getTime() > date2.getTime() ? date1 : date2;
}
