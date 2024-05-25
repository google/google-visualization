/**
 * @fileoverview Defines some time units in milliseconds.
 *
 * <p>Note that the constants for <code>MONTH</code>, <code>QUARTER</code>
 * and  <code>YEAR</code> are approximations since these units vary in
 * length.
 *
 * <p>It's somewhat unclear how the built-in <code>Date</code> class handles
 * milliseconds in huge time spans. The approximate constants are calculated
 * from a year average of the year range from 1000 years ago to 1000 years
 * into the future:
 *
 * <code>(Date.UTC(3008, 0) - Date.UTC(1008, 0)) / (DAY*2000)</code>
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

/**
 * Milliseconds in a millisecond.
 */
export const MILLISECOND = 1;

/**
 * Milliseconds in a second.
 */
export const SECOND = 1000;

/**
 * Milliseconds in a minute, 60000.
 */
export const MINUTE: number = SECOND * 60;

/**
 * Milliseconds in an hour, 3600000.
 */
export const HOUR: number = MINUTE * 60;

/**
 * Milliseconds in a day, 86400000.
 */
export const DAY: number = HOUR * 24;

/**
 * Milliseconds in a week, 604800000.
 */
export const WEEK: number = DAY * 7;

/**
 * Approximate milliseconds in a month, 2629746000.
 */
export const MONTH: number = DAY * 30.436875;

/**
 * Approximate milliseconds in a quarter, 7889238000.
 */
export const QUARTER: number = DAY * 91.310625;

/**
 * Approximate milliseconds in a year, 31556952000.
 */
export const YEAR: number = DAY * 365.2425;

/**
 * Internal ordered list of the constants
 */
export const TIME_UNITS: number[] = [
  MILLISECOND,
  SECOND,
  MINUTE,
  HOUR,
  DAY,
  WEEK,
  MONTH,
  QUARTER,
  YEAR,
];

/**
 * Time units.
 */
export enum TimeUnit {
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
 * Returns the finest of two time units.
 *
 * @param unitA A unit.
 * @param unitB Another unit.
 * @return The finest unit.
 */
export function getFinestUnit(unitA: TimeUnit, unitB: TimeUnit): TimeUnit {
  return millisecondsForName(unitA) > millisecondsForName(unitB)
    ? unitB
    : unitA;
}

/**
 * Returns the constant in this class closest to the given time period.
 *
 * @param time A time period in milliseconds.
 * @return Number of milliseconds for closest time unit.
 */
export function closestUnit(time: number): number {
  time = Math.abs(time);
  const timeUnits = TIME_UNITS;
  let i = timeUnits.length - 1;
  // Decrease i until time is equal or greater than TIME_UNITS[i].
  while (i > 0 && time < timeUnits[i]) {
    i--;
  }
  // Adjust i according to deltas.
  if (timeUnits[i + 1] - time <= time - timeUnits[i]) {
    i++;
  }
  return timeUnits[i];
}

/**
 * Returns a duration for a named duration.
 * @param name Name of a duration, for instance 'YEAR' or 'MONTH'.
 * @return The duration in milliseconds.
 */
export function millisecondsForName(name: string): number {
  switch (name) {
    case TimeUnit.MILLISECOND:
      return MILLISECOND;
    case TimeUnit.SECOND:
      return SECOND;
    case TimeUnit.MINUTE:
      return MINUTE;
    case TimeUnit.HOUR:
      return HOUR;
    case TimeUnit.DAY:
      return DAY;
    case TimeUnit.WEEK:
      return WEEK;
    case TimeUnit.MONTH:
      return MONTH;
    case TimeUnit.QUARTER:
      return QUARTER;
    case TimeUnit.YEAR:
      return YEAR;
    default:
      assert(false, `Unknown time duration: ${name}`);
  }
  return 0;
}
