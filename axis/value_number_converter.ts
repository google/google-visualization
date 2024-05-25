/**
 * @fileoverview A utility for converting between values on a data scale and
 * values on a numeric scale.
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
import * as timeutil from '../common/timeutil';
import {Value} from '../data/types';

/** A value-to/from-number converter. */
export interface ValueNumberConverter {
  toNumber: (p1: Value | null) => number;
  fromNumber: (p1: number) => Value;
}

/**
 * Provides a value-to/from-number converter, based on the given type.
 * @param type The type to be converted.
 * @return See above.
 */
export function getByType(type: string): ValueNumberConverter {
  switch (type) {
    case 'date':
    case 'datetime':
      return {toNumber: dateToNumber, fromNumber: dateFromNumber};
    case 'timeofday':
      return {toNumber: timeOfDayToNumber, fromNumber: timeOfDayFromNumber};
    case 'number':
    case 'string':
      return {toNumber: numberToNumber, fromNumber: numberFromNumber};
    default:
      throw new Error(`Invalid type: "${type}"`);
  }
}

/**
 * Converts a number to number.
 * @param v A data table value, expected to be a number.
 * @return The value, converted to number.
 */
export function numberToNumber(v: Value | null): number {
  asserts.assert(
    typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v))),
  );
  return Number(v);
}

/**
 * Converts a number back to number.
 * @param n A numeric representation of a data table value.
 * @return The represented number value.
 */
export function numberFromNumber(n: number): number {
  return n;
}

/**
 * Converts a date to number.
 * @param v A data table value, expected to be a date.
 * @return The value, converted to number.
 */
export function dateToNumber(v: Value | null): number {
  asserts.assert(goog.isDateLike(v));
  return (v as Date).getTime();
}

/**
 * Converts a number back to date.
 * @param n A numeric representation of a data table value.
 * @return The represented date value.
 */
export function dateFromNumber(n: number): Date {
  return new Date(n);
}

/**
 * Converts a time-of-day to number.
 * @param v A data table value, expected to be a time-of-day.
 * @return The value, converted to number.
 */
export function timeOfDayToNumber(v: Value | null): number {
  asserts.assert(Array.isArray(v));
  return timeutil.timeOfDayAsMillis(v as timeutil.TimeOfDay);
}

/**
 * Converts a number back to time-of-day.
 * @param n A numeric representation of a data table value.
 * @return resulting time-of-day value.
 */
export function timeOfDayFromNumber(n: number): timeutil.TimeOfDay {
  return timeutil.millisAsTimeOfDay(n);
}
