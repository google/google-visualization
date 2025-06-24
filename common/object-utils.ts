/**
 * @fileoverview Object manipulation utilities.
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

import { absNumericDiff } from './math-utils';

// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

// More specific types for better type safety
type CompareFunction = (p1: AnyDuringMigration, p2: AnyDuringMigration) => number;

/**
 * Returns true iff for each key that exists in both objects, the two values for
 * this key are at most 'tolerance' different from each other.
 * @param obj1 An object.
 * @param obj2 An object.
 * @param tolerance The maximum allowed difference.
 * @param diffFunc A function that takes two elements of the input objects
 *     and return the numeric "diff" between them.
 *     If not provided, defaults to absNumericDiff which assumes
 *     both elements are numbers and returns the absolute of the mathematical
 *     difference between them.
 * @return See above.
 */
export function objectsAlmostEqual<T extends Record<string, AnyDuringMigration>>(
  obj1: T | null,
  obj2: T | null,
  tolerance: number,
  diffFunc?: CompareFunction,
): boolean {
  if (!obj1 || !obj2) {
    return true;
  }
  const diff = diffFunc || absNumericDiff;
  return Object.entries(obj1).every(([key, value1]) => {
    const value2 = obj2[key];
    return obj2[key] === undefined || diff(value1, value2) <= tolerance;
  });
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
export function getKeyEnsureDefault<T, K extends keyof T>(
  object: T,
  key: K,
  defaultValue: T[K],
): T[K] {
  if (object[key] == null) {
    object[key] = defaultValue;
  }
  return object[key];
}

/**
 * Returns whether a given object does not contain any property which is not
 * specified in a white list of permitted properties.
 *
 * @param obj The object.
 * @param permittedProperties The properties the object is
 *     permitted to have (it is not obliged to have all of them though).
 * @return Whether the object does not contain any property which
 *     is not specified in the list.
 */
export function containsNoOtherProperties(
  obj: Record<string, AnyDuringMigration>,
  permittedProperties: string[],
): boolean {
  for (const property in obj) {
    if (!permittedProperties.includes(property)) {
      return false;
    }
  }
  return true;
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

/**
 * Deep clone an object using JSON serialization.
 * Note: This method has limitations - it won't work with functions, undefined values,
 * symbols, or circular references.
 * @param obj The object to clone.
 * @return A deep copy of the object.
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Shallow clone an object.
 * @param obj The object to clone.
 * @return A shallow copy of the object.
 */
export function shallowClone<T extends Record<string, AnyDuringMigration>>(obj: T): T {
  return { ...obj };
}

/**
 * Check if an object is empty (has no own enumerable properties).
 * @param obj The object to check.
 * @return True if the object is empty.
 */
export function isEmpty(obj: Record<string, AnyDuringMigration>): boolean {
  return Object.keys(obj).length === 0;
}

/**
 * Get nested property value from an object using dot notation.
 * @param obj The object to get the value from.
 * @param path The dot-separated path to the property.
 * @param defaultValue The default value to return if the property doesn't exist.
 * @return The property value or the default value.
 */
export function getNestedProperty<T extends AnyDuringMigration = AnyDuringMigration>(
  obj: Record<string, AnyDuringMigration>,
  path: string,
  defaultValue?: T,
): T | undefined {
  const keys = path.split('.');
  let current: AnyDuringMigration = obj;

  for (const key of keys) {
    if (current == null || typeof current !== 'object') {
      return defaultValue;
    }
    current = current[key];
  }

  return current !== undefined ? current as T : defaultValue;
}

/**
 * Set nested property value in an object using dot notation.
 * @param obj The object to set the value in.
 * @param path The dot-separated path to the property.
 * @param value The value to set.
 */
export function setNestedProperty(
  obj: Record<string, AnyDuringMigration>,
  path: string,
  value: AnyDuringMigration,
): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (current[key] == null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
}

/**
 * Merge two objects deeply.
 * @param target The target object.
 * @param source The source object.
 * @return The merged object.
 */
export function deepMerge<T extends Record<string, AnyDuringMigration>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (
        sourceValue != null &&
        targetValue != null &&
        typeof sourceValue === 'object' &&
        typeof targetValue === 'object' &&
        !Array.isArray(sourceValue) &&
        !Array.isArray(targetValue)
      ) {
        result[key] = deepMerge(targetValue, sourceValue);
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * Pick specific properties from an object.
 * @param obj The source object.
 * @param keys The keys to pick.
 * @return A new object with only the specified keys.
 */
export function pick<T extends Record<string, AnyDuringMigration>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
}

/**
 * Omit specific properties from an object.
 * @param obj The source object.
 * @param keys The keys to omit.
 * @return A new object without the specified keys.
 */
export function omit<T extends Record<string, AnyDuringMigration>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}
