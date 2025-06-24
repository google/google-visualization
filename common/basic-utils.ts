/**
 * @fileoverview Basic utilities and constants.
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

/**
 * String of zero digits used for number-to-string padding
 */
export const STRING_ZEROES = '0000000000000000';

/**
 * A very small number that numbers whose absolute value is smaller than are
 * considered zero when converted to string. Two numbers whose distance to each
 * other is less than this number are most likely to be converted to the same
 * string.
 */
export const PRECISION_THRESHOLD = 0.000000000000001;

/**
 * Converts the string to a number, or to null if it is an empty string or null.
 * @param str The string number to convert, or null.
 */
export function numberOrNull(str: string | null): number | null {
  return str == null || str === '' ? null : Number(str);
}

/**
 * Returns object[key] after ensuring it's initialized (initializes it if not).
 * In other words, this function first checks if object[key] is initialized
 * (defined and not null) and if not, initializes to the given default value.
 * Then it returns the existing object[key].
 * @param object The object or array.
 * @param key The key.
 * @param defaultValue The value to initialize object[key] if not initialized.
 * @return The value of object[key] after ensuring it's initialized.
 */
export function getKeyEnsureDefault<T>(
  object: Record<string | number, T> | T[],
  key: string | number,
  defaultValue: T,
): T {
  if ((object as any)[key] == null) {
    (object as any)[key] = defaultValue;
  }
  return (object as any)[key];
}

/**
 * Creates an options path from a set of possible roots and a given property.
 * @deprecated Replace with use of options view.
 *
 * @param rootPath The set of roots.
 * @param property The property to concat to every root.
 * @return All possible concatenations of values from rootPath and the property.
 */
export function concatSuffix(
  rootPath: string[] | string,
  property: string,
): string[] {
  if (typeof rootPath === 'string') {
    return [`${rootPath}.${property}`];
  }
  return rootPath.map((singleRootPath) => `${singleRootPath}.${property}`);
}
