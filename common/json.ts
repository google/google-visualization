/**
 * @fileoverview Serialize and deserialize javascript objects containing dates.
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
import * as googJson from '@npm//@closure/json/json';
import {isObject} from '../common/object';
import {isDateLike} from './object';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Use built-in JSON.
 * @param json A JSON string that may NOT contain dates.
 * @return The object represented by the JSON string.
 */
export const parse = JSON.parse as (p1: string) => AnyDuringMigration;

/**
 * Use built-in JSON if it exists, otherwise use goog.json.serialize(obj).
 * @param object The object to stringify.
 * @return The JSON string representing the object.
 */
export const stringify: (v: unknown) => string = //
  (goog.global['JSON'] && goog.global['JSON']['stringify']) || //
  googJson.serialize;

/**
 * Returns an object graph as a JSON string.
 * @see `#clone` for format details.
 *
 * @param obj An object to serialize.
 * @return A JSON string representation of the object.
 */
export function serialize(obj: unknown): string {
  return JSON.stringify(clone(obj));
}

/**
 * Evaluates a JSON string. The JSON format supports encoding of dates in
 * "date string" format. @see #serialize.
 * Note: throws an Error in case the input JSON is not valid JSON.
 * @param json A JSON string that may contain "Date(...)" strings.
 * @return The object represented by the JSON string.
 */
export function deserialize(json: string): AnyDuringMigration {
  // The following ensures that the input json is valid. However, the result
  // is not used since it lacks Date support implemented thereafter.
  // TODO(b/131926196): Assert as a type, declared interface, or `unknown`.
  // tslint:disable:no-any no-unnecessary-type-assertion
  return asserts.assertObject(fixDateStrings(JSON.parse(json) as any));
  // tslint:enable:no-any no-unnecessary-type-assertion
}

/**
 * Returns a clone of the object graph that supports
 * encoding of date values in the following "date constructor" format:
 * Date(year, month, day[,hour, minute, second[, millisecond]])
 *
 * For example:
 *
 * Date(2009, 7, 11)
 * Date(2009, 7, 11, 10, 16, 0)
 * Date(2009, 7, 11, 10, 16, 0, 500)
 *
 * @param obj An object to clone.
 * @return The clone of the object.
 */
export function clone(obj: unknown): AnyDuringMigration {
  const cloneObj = filteredClone(obj, serializeDate);
  return cloneObj;
}

/**
 * Clones an object recursively.  We can't use goog.cloneObject() because
 * it does not support filtering the result.
 *
 * @param src A value that may be an object graphs the references dates.
 * @param filter A function that pre-processes objects before
 *     they are cloned. It should take a single value as a parameter and return
 *     a "replacement" value to be cloned.  If there is no preprocessing to
 *     be done, the filter function should return the same value it received
 *     as a parameter.
 * @return An object where all references to Dates have been
 *     replaced by serializable objects.
 */
export function filteredClone(
  src: unknown, //
  filter: (p1: unknown) => unknown,
): AnyDuringMigration {
  src = filter(src);
  const type = goog.typeOf(src);
  let result;
  if (type === 'object' || type === 'array') {
    result = type === 'array' ? [] : {};
    const srcObj = src as AnyDuringMigration[] | Object;
    for (const key in srcObj) {
      if (key.indexOf('___clazz$') !== -1) {
        // Ignore GWT-defined properties which can have a circular structure.
        continue;
      }
      if (!srcObj.hasOwnProperty(key)) {
        continue;
      }
      const rawValue = (
        srcObj as {
          [key: string]: unknown;
        }
      )[key];
      const value = filteredClone(rawValue, filter);

      // Ignore keys with undefined values. googJson.serialize() handles this
      // incorrectly.
      if (value !== undefined) {
        (
          result as {
            [key: string]: unknown;
          }
        )[key] = value;
      }
    }
  } else {
    result = src;
  }
  return result;
}

/**
 * Recurses through any value and replaces string values that are
 * gviz date strings with new Date() values.
 * @param anything Any value within a JSON object.
 */
export function fixDateStrings(anything: unknown): AnyDuringMigration {
  if (typeof anything === 'string') {
    return deserializeDate(anything);
  } else {
    if (Array.isArray(anything)) {
      return anything.map(fixDateStrings);
    } else {
      if (isObject(anything)) {
        const obj = asserts.assertObject(anything) as {
          [key: string]: unknown;
        };
        for (const key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          const value = obj[key];
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            (
              obj as {
                [key: string]: unknown;
              }
            )[key] = fixDateStrings(value);
          }
        }
        return obj;
      } else {
        return anything;
      }
    }
  }
}

/**
 * If the string value is a gviz Date string, returns a new Date. Otherwise
 * returns the string value.
 */
export function deserializeDate(str: string): string | Date {
  const dateRegex = /^Date\(\s*([\d,\s]*)\)$/;
  const matches = str.match(dateRegex);
  if (matches) {
    const numbers = matches[1].split(/,\s*/);
    if (numbers.length === 1) {
      // The 1-argument constructor is used for unix epoch time.
      return new Date(Number(numbers[0]) || 0);
    } else {
      // Don't create a new Date() first and then set individual fields.
      // 1) That creates potential bugs dependent on the system time.
      // 2) setMonth() on a date that is on the 31st of the month does not work
      // sensibly if the month you set doesn't have 31 days.
      return new Date(
        Number(numbers[0]) || 0, // Year
        Number(numbers[1]) || 0, // Month
        Number(numbers[2]) || 1, // Day of month, starts at 1.
        Number(numbers[3]) || 0, // Hour
        Number(numbers[4]) || 0, // Minute
        Number(numbers[5]) || 0, // Second
        Number(numbers[6]) || 0,
      ); // Millisecond
    }
  } else {
    return str;
  }
}

/**
 * If the source value is a Date, returns a string representation. Otherwise
 * returns the source value.
 *
 * @param src A source value.
 * @return A string representation of a Date, or the source value.
 */
export function serializeDate(src: unknown): AnyDuringMigration {
  let result = src;
  if (isDateLike(result)) {
    const srcDate = src as Date;
    // Check for valid date.
    // Do we want to disallow Invalid Dates in general, or perhaps
    // there are valid reasons for an Invalid Date in some situations,
    // analogous to NaNs for numbers.  Deferring that decision for now.
    asserts.assert(!isNaN(srcDate.getTime()), 'Invalid Date');
    let arr = [];
    if (srcDate.getMilliseconds() !== 0) {
      // datetime with milliseconds
      arr = [
        srcDate.getFullYear(),
        srcDate.getMonth(),
        srcDate.getDate(),
        srcDate.getHours(),
        srcDate.getMinutes(),
        srcDate.getSeconds(),
        srcDate.getMilliseconds(),
      ];
    } else {
      const dateOnly =
        srcDate.getSeconds() === 0 &&
        srcDate.getMinutes() === 0 &&
        srcDate.getHours() === 0;
      if (!dateOnly) {
        // datetime with 0 milliseconds
        arr = [
          srcDate.getFullYear(),
          srcDate.getMonth(),
          srcDate.getDate(),
          srcDate.getHours(),
          srcDate.getMinutes(),
          srcDate.getSeconds(),
        ];
      } else {
        // date, no time
        arr = [srcDate.getFullYear(), srcDate.getMonth(), srcDate.getDate()];
      }
    }
    result = `Date(${arr.join(', ')})`;
  }
  return result;
}
