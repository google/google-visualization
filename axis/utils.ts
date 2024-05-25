/**
 * @fileoverview Some utils.
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

import {assert} from '@npm//@closure/asserts/asserts';
import {Range} from '@npm//@closure/math/range';
import {countRequiredDecimalPrecision} from '../common/util';

import {LinearSequence} from './linear_sequence';
import {
  DAY,
  HOUR,
  MINUTE,
  MONTH,
  SECOND,
  TimeUnit,
  WEEK,
  YEAR,
} from './milliseconds';
import {MonthSequence} from './month_sequence';
import {exactScientific, floorExponent} from './pow_10_math';
import {Sequence} from './sequence';
import {TimeUnitSequence} from './time_unit_sequence';

/**
 * @param timeUnit The time unit in milliseconds. This value is
 *     rounded to one of the units in DetailedTimeUnitSequence.
 * @param firstDayOfWeek An unsigned integer specifying which day
 *     to use for the first day of the week (0 is Sunday, 1 is Monday and so
 *     on). Default is 1 (Monday).
 *
 * @return A time sequence.
 */
export function createTimeSequence(
  timeUnit: number,
  firstDayOfWeek = 1,
): Sequence {
  timeUnit = new TimeUnitSequence(true).round(timeUnit);

  if (timeUnit < MONTH) {
    if (timeUnit === WEEK) {
      // Adding 3 days to offset because Jan 1 1970 was a Thursday.
      const offset = DAY * (3 + firstDayOfWeek);
      return new LinearSequence(timeUnit, offset);
    } else {
      return new LinearSequence(timeUnit);
    }
  } else {
    return new MonthSequence(Math.round(timeUnit / MONTH));
  }
}

/**
 * Convert to ISO 8601 time format.
 * If the date is the first day of the year, it will be omitted if all time
 * fields are zero. If all time components are zero, they will be omitted.
 *
 * Example: 2008-06-19T14:18:12.000
 *
 * @param time The time to convert.
 * @return The resulting string.
 */
export function millisecondsToIsoStr(time: number): string {
  if (!isFinite(time)) {
    return 'notime';
  }
  const date = new Date();
  date.setTime(time);
  let res = '';
  res += zeroPad(date.getUTCFullYear().toString(), 4);

  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const showMonth = month !== 0;
  const showDay = day !== 1;

  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();
  const showTime =
    hours !== 0 || minutes !== 0 || seconds !== 0 || milliseconds !== 0;

  if (showMonth || showDay || showTime) {
    res += '-';
    res += zeroPad((month + 1).toString(), 2);
  }
  if (showDay || showTime) {
    res += '-';
    res += zeroPad(day.toString(), 2);
  }
  if (showTime) {
    res += 'T';
    res += zeroPad(hours.toString(), 2);
    res += ':';
    res += zeroPad(minutes.toString(), 2);
    res += ':';
    res += zeroPad(seconds.toString(), 2);
    res += '.';
    res += zeroPad(milliseconds.toString(), 3);
  }
  return res;
}

/**
 * Returns a string representing a time with a specified granularity.
 * Rounds down if necessary.
 *
 * Examples:
 * 2005 in DAY granularity -> 2005-01-01
 * 2005-02-03 in YEAR granularity -> 2005
 *
 * Note: only handels, YEAR, MONTH and DAY. For other granularities, full
 * precision will be used.
 *
 * @param time The time.
 * @param timeUnit The time unit.
 * @return The formatted string.
 */
export function timeToCustomIsoStr(time: number, timeUnit: TimeUnit): string {
  assert(isFinite(time), 'Time must be finite');

  const timeUnits = TimeUnit;
  let res = '';
  const date = new Date();
  date.setTime(time);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const milliseconds = date.getUTCMilliseconds();

  res += zeroPad(year.toString(), 4);
  if (timeUnit === timeUnits.YEAR) {
    return res;
  }

  res += '-';
  res += zeroPad((month + 1).toString(), 2);
  if (timeUnit === timeUnits.MONTH) {
    return res;
  }

  res += '-';
  res += zeroPad(day.toString(), 2);
  if (timeUnit === timeUnits.DAY) {
    return res;
  }

  res += 'T';
  res += zeroPad(hours.toString(), 2);
  res += ':';
  res += zeroPad(minutes.toString(), 2);
  res += ':';
  res += zeroPad(seconds.toString(), 2);
  res += '.';
  res += zeroPad(milliseconds.toString(), 3);

  return res;
}

/**
 * Adds '0' characters to the left of the string.
 *
 * @param str the string to pad.
 * @param toLength the resulting string's length. If str is already
 *     toLength characters long the string will be returned untouched.
 * @return Zero padded string.
 */
export function zeroPad(str: string, toLength: number): string {
  const fromLength = str.length;
  for (let i = fromLength; i < toLength; i++) {
    str = `0${str}`;
  }
  return str;
}

/**
 * Converts an ISO 8601 string to milliseconds since 1970.
 * @param str A date string.
 * @return Number of milliseconds since 1970.
 */
export function isoStrToMilliseconds(str: string | null): number {
  if (str === 'notime' || str === null || str === '') {
    return NaN;
  }
  let year = 0;
  let month = 0;
  let day = 1;
  let hour = 0;
  let minute = 0;
  let second = 0;
  let millisecond = 0;
  year = Number(str.substring(0, 4));
  if (str.length > 4) {
    month = Number(str.substring(5, 7)) - 1;
    if (str.length > 7) {
      day = Number(str.substring(8, 10));
      if (str.length > 10) {
        hour = Number(str.substring(11, 13));
        minute = Number(str.substring(14, 16));
        second = Number(str.substring(17, 19));
        millisecond = Number(str.substring(20, 23));
      }
    }
  }
  const value = Date.UTC(year, month, day, hour, minute, second, millisecond);
  return value;
}

/**
 * Returns the duration of the time period in English.
 *
 * @param length The time period in milliseconds.
 * @return the length of the time period expressed in years, days,
 *     hours, minutes and seconds.
 */
export function timeLengthStr(length: number): string {
  if (isNaN(length)) {
    return 'Time is NaN.';
  }
  let res = '';
  const years = Math.floor(length / YEAR);
  if (years > 0) {
    res += `${years} years, `;
    length = length - years * YEAR;
  }

  const days = Math.floor(length / DAY);
  if (days > 0) {
    res += `${days} days, `;
    length = length - days * DAY;
  }

  const hours = Math.floor(length / HOUR);
  if (hours > 0) {
    res += `${hours} h, `;
    length = length - hours * HOUR;
  }

  const minutes = Math.floor(length / MINUTE);
  if (minutes > 0) {
    res += `${minutes} m, `;
    length = length - minutes * MINUTE;
  }

  const seconds = Math.floor(length / SECOND);
  if (seconds > 0) {
    res += `${seconds} s`;
    length = length - seconds * SECOND;
  }
  return res;
}

/**
 * Rounds a number up and tries to find a value that ends in 5 or 10 if such
 *     number exists within a specified range.
 *
 * Examples: 39 -> 40, 140 -> 150,
 * @param value The value to round.
 * @param maxDiff Maximum change.
 * @return A nicer rounded value.
 */
export function roundToNextEvenValue(value: number, maxDiff: number): number {
  if (value < 0) {
    return -roundDown(-value, maxDiff);
  } else {
    return roundUp(value, maxDiff);
  }
}

/**
 * Rounds a number down and tries to find a number that ends in 5 or 10 if such
 *     number exists within a specified range.
 *
 * Examples: 32 -> 30, 147 -> 145,
 * @param value The value to round.
 * @param maxDiff Maximum change.
 * @return A nicer rounded value.
 */
export function roundToPrevEvenValue(value: number, maxDiff: number): number {
  if (value < 0) {
    return -roundUp(-value, maxDiff);
  } else {
    return roundDown(value, maxDiff);
  }
}

/**
 * Expands a range to include close nice numbers.
 * @param range The range to expand.
 * @param maxChange The max ratio to expand the range.
 *     0.1 means 10% of the range can be used in each direction.
 * @return The expanded range.
 */
export function expandRange(range: Range, maxChange: number): Range {
  if (range.start === range.end || maxChange === 0) {
    return range;
  }

  assert(isFinite(range.start) && isFinite(range.end), 'Range must be finite.');

  assert(range.start <= range.end, 'Range start must be less or equal to end.');

  const maxDiff = (range.end - range.start) * maxChange;
  return new Range(
    roundToPrevEvenValue(range.start, maxDiff),
    roundToNextEvenValue(range.end, maxDiff),
  );
}

/**
 * Rounds down to a nicer number, but not by more than maxDiff.
 * It goes through each power of ten in the number starting with the most
 * significant digit. If the current digit is larger then five, check if it can
 * be replaced with five, and the zero the rest of the digits and fit within the
 * given range.
 * If not, just try replace the remaining digits with zero and test if it fits.
 * Repeat with the next power of ten.
 * @param value The value to round.
 * @param maxDiff The maximum removed delta.
 * @return The rounded number.
 */
function roundDown(value: number, maxDiff: number): number {
  if (value === 0) {
    return 0;
  }
  function isDone(testVal: number) {
    return testVal <= value && testVal > value - maxDiff;
  }

  let remaining = value;
  let sum = 0;
  let result = NaN;
  let unRounded;
  while (remaining > 0) {
    const exponent = floorExponent(remaining);
    const power = exactScientific(1, exponent);
    const leadingDigit = getLeadingDigit(remaining);

    if (leadingDigit > 5) {
      unRounded = 5 * power + sum;
      result = roundToNumDecimals(unRounded, exponent);
      if (isDone(result)) {
        break;
      }
    }

    unRounded = leadingDigit * power + sum;
    result = roundToNumDecimals(unRounded, exponent);
    if (isDone(result)) {
      break;
    }

    const level = leadingDigit * power;
    sum = sum + level;
    remaining = remaining - level;
  }
  return result;
}

/**
 * Rounds up to a nicer number, but not by more than maxDiff.
 * The algorithm iterates through each power of ten, starting with the most
 * significant digit. If less than five, set to five and then set the remaining
 * digits to zero and see if it fits the criterion of fitting in the range.
 * If five or more, try setting the remaining digits to zero and see if fits.
 * If not, increase the digit, set the rest to zero and test again.
 * Repeat with the power of ten.
 * @param value The number to round.
 * @param maxDiff The maximum added delta.
 * @return The rounded number.
 */
function roundUp(value: number, maxDiff: number): number {
  if (value === 0) {
    return 0;
  }
  function isDone(testVal: number) {
    return testVal <= value + maxDiff && testVal >= value;
  }

  let remaining = value;
  let sum = 0;
  let result = NaN;
  let unRounded;
  while (remaining > 0) {
    const exponent = floorExponent(remaining);
    const power = exactScientific(1, exponent);
    const leadingDigit = getLeadingDigit(remaining);

    if (leadingDigit < 5) {
      unRounded = 5 * power + sum;
      result = roundToNumDecimals(unRounded, exponent);
      if (isDone(result)) {
        break;
      }
    }

    unRounded = leadingDigit * power + sum;
    result = roundToNumDecimals(unRounded, exponent);
    if (isDone(result)) {
      break;
    }

    unRounded = (leadingDigit + 1) * power + sum;
    result = roundToNumDecimals(unRounded, exponent);
    if (isDone(result)) {
      break;
    }

    const level = leadingDigit * power;
    sum = sum + level;

    remaining = remaining - level;
  }
  return result;
}

/**
 * Rounds a number to a certain number of decimals.
 * @param value The value to round.
 * @param numDecimals The number of decimals.
 * @return The rounded value.
 */
export function roundToNumDecimals(value: number, numDecimals: number): number {
  const rounder = exactScientific(1, Math.abs(numDecimals));
  const multipliedAndRounded = Math.round(value * rounder);
  return multipliedAndRounded / rounder;
}

/**
 * Get the leading digit of a number.
 * @param value The number to get the leading digit of.
 * @return The leading digit.
 */
export function getLeadingDigit(value: number): number {
  const exponent = floorExponent(value);
  const power = exactScientific(1, exponent);
  let normalized = value / power;
  const diff = Math.abs(Math.round(normalized) - normalized);
  if (diff !== 0 && diff < 0.0000000001) {
    normalized = Math.round(normalized);
  }
  return Math.floor(normalized);
}

/**
 * Returns the minimum
 */
export function calcMinimumFractionDigits(numbers: number[]): number {
  let minPrecision = 0;
  for (const n of numbers) {
    minPrecision = Math.max(minPrecision, countRequiredDecimalPrecision(n));
  }
  return minPrecision;
}
