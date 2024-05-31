/**
 * @fileoverview A collection of utility methods for objects.
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

import {memoize} from './cache/memoize';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Maximum value of getHash. 2^26 = 2^32 / 32 / 2.
 * Where 32 is rounding for the 31 multiplier.
 */
const HASHCODE_MAX = 0x4000000;

/**
 * Converted from closure/string/string.
 * String hash function similar to java.lang.String.hashCode().
 * The hash code for a string is computed as
 * s[0] * 31 ^ (n - 1) + s[1] * 31 ^ (n - 2) + ... + s[n - 1],
 * where s[i] is the ith character of the string and n is the length of
 * the string. We mod the result to make it between 0 (inclusive) and 2^32
 * (exclusive).
 * @param str A string.
 * @return Hash value for `str`, between 0 (inclusive) and 2^32
 *  (exclusive). The empty string returns 0.
 */
export function hashCode(str: string): number {
  let result = 0;
  for (let i = 0; i < str.length; ++i) {
    // Normalize to 4 byte range, 0 ... 2^32.
    result = (31 * result + str.charCodeAt(i)) >>> 0;
  }
  return result;
}

/**
 * A type guard, converted from goog.isObject.
 * @param value unknown: accepts any value
 * @return value is object:  This is a type predicate.
 *   If isObject(value) returns true, TypeScript infers that value is a non-null
 * object (specifically, Record<string, unknown>, a Record with string keys and
 * values of any type).
 * The value could also be a function, an Array, or a Date, RegExp, etc.
 */
export function isObject(value: unknown): value is object {
  return !!value && (typeof value === 'object' || typeof value === 'function');
}

/**
 * Converted from goog.isDateLike.
 * Returns true if the object looks like a Date. To qualify as Date-like the
 * value needs to be an object and have a getFullYear() function.
 */
export function isDateLike(val: AnyDuringMigration): boolean {
  return (
    isObject(val) && typeof (val as unknown as Date).getFullYear === 'function'
  );
}

/**
 * Performs a deep comparison of two objects.
 * Returns whether the objects have the exact same properties, the exact
 * same values, and the exact same type (@see goog.typeOf). The behavior of
 * this function is equivalent to that of the following expression:
 * gviz.json.serialize(obj1) == gviz.json.serialize(obj2)
 * Exceptions:
 * - Assigning the value "undefined" to a property is considered different
 *   from not having that property. So {a: undefined} and {} are considered
 *   not equal (whereas gviz.json ignores properties with 'undefined').
 * - The values "null" and "undefined" are considered different.
 * WARNING: Both objects are assumed not to include circular references.
 * @param obj1 First object.
 * @param obj2 Second object.
 * @return True iff the two objects are equal.
 */
export function unsafeEquals(
  obj1: AnyDuringMigration,
  obj2: AnyDuringMigration,
): boolean {
  // Null is equal to null and undefined is equal to undefined.
  // However, null is not equal to undefined (a difference from gviz.json).
  if (obj1 == null && obj2 == null) {
    return obj1 === obj2;
  }

  if (obj1 === obj2) {
    // Optimization: references to the same object.
    // Do not remove this optimization - since it is also required for the
    // primitive values to work correctly.
    return true;
  }
  const type1 = goog.typeOf(obj1);
  const type2 = goog.typeOf(obj2);
  if (type1 !== type2) {
    return false;
  }
  const obj1IsDateLike = isDateLike(obj1);
  const obj2IsDateLike = isDateLike(obj2);
  if (obj1IsDateLike !== obj2IsDateLike) {
    // This is required since the type comparison above will show Dates equal
    // to Objects.
    return false;
  }
  switch (type1) {
    case 'object':
      if (obj1IsDateLike && obj2IsDateLike) {
        // Dates need to be compared in milliseconds.
        return obj1.getTime() - obj2.getTime() === 0;
      }
      // Iterate over all obj1 properties and verify that they all exist in obj2
      // and have the same value as in obj1.
      for (const key1 in obj1) {
        // Do not replace "obj2.hasOwnProperty(key1)" with
        // !(key1 in obj2) because this usage of the in operator DOES look for
        // key1 also in obj2.prototype.
        if (obj1.hasOwnProperty(key1)) {
          // Avoiding the 'constructor' and any inherited and native keys.
          if (
            !obj2.hasOwnProperty(key1) ||
            !unsafeEquals(obj1[key1], obj2[key1])
          ) {
            return false;
          }
        }
      }
      // Verify that obj2 does not contain any additional properties.
      for (const key2 in obj2) {
        if (obj2.hasOwnProperty(key2) && !obj1.hasOwnProperty(key2)) {
          return false;
        }
      }
      return true;

    case 'array':
      // Comparing the arrays, element by element.
      // Ignore differences in properties.
      if (obj1.length !== obj2.length) {
        return false;
      }
      for (let i = 0; i < obj1.length; ++i) {
        if (!unsafeEquals(obj1[i], obj2[i])) {
          return false;
        }
      }
      return true;

    case 'function':
      return true; // We ignore functions.

    case 'string':
    case 'number':
    case 'boolean':
      // Primitives are compared without coercing; This is where '3' === '3'
      // succeeds but '3' === 3 fails.
      // obj1 !== obj2 due to the 'if' above (Optimization).
      return false;

    default:
      throw new Error(
        `Error while comparing ${obj1} and ${obj2}` +
          ': unexpected type of obj1 ' +
          type1,
      );
  }
}

/**
 * Same as goog.object.unsafeClone, but with support for Dates.
 * This is a recursive clone, so there better not be any loops.
 * @param obj The value to clone.
 * @return A clone of the input value.
 */
export function unsafeClone(obj: AnyDuringMigration): AnyDuringMigration {
  if (isDateLike(obj)) {
    const ret = new Date();
    ret.setTime(obj.valueOf() as number);
    return ret;
  }
  const type = goog.typeOf(obj);
  if (type === 'object' || type === 'array') {
    if (obj.clone) {
      return obj.clone();
    }
    const clone = type === 'array' ? [] : {};
    // The following for-in loop must NOT exclude cloning obj[key] even if
    // !obj.hasOwnProperty(key).  This is so that testDrawDangerousHtml
    // can pass, which uses 'options': {'__proto__': {'allowHtml': true}}
    // TODO(dlaliberte): Investigate further, add more tests.
    // tslint:disable-next-line:forin
    for (const key in obj) {
      (clone as AnyDuringMigration)[key] = unsafeClone(obj[key]);
    }
    return clone;
  }
  return obj;
}

/**
 * Returns a shallow clone of the object. Works for Date objects too.
 * @see goog.object.clone
 * @param obj Object to clone.
 * @return Clone of the input object.
 */
export function clone(obj: AnyDuringMigration): AnyDuringMigration {
  if (isDateLike(obj)) {
    const ret = new Date();
    ret.setTime(obj.valueOf() as number);
    return ret;
  }
  return {...obj};
}

/**
 * Searches an object recursively for all elements that satisfy the given
 * condition and returns them.
 * @param obj The object to search in.
 * @param f The function to call for
 *     every element. Takes 3 arguments (the value, the key, and the object) and
 *     should return a boolean.
 * @param thisObj An optional "this" context for the function.
 * @return The values of any element for which the function returns
 *     true or empty list if no such element is found.
 */
export function findValuesRecursive(
  obj: AnyDuringMigration,
  f: (p1: AnyDuringMigration, p2: string, p3: AnyDuringMigration) => boolean,
  thisObj?: AnyDuringMigration,
): AnyDuringMigration[] {
  // Use a helper to accumulate results since it's faster than merging.
  const helper = (
    obj: AnyDuringMigration,
    predicate: AnyDuringMigration,
    results: AnyDuringMigration,
  ) => {
    for (const property in obj) {
      if (obj.hasOwnProperty(property)) {
        if (typeof obj[property] === 'object') {
          helper(obj[property], predicate, results);
        } else {
          // TODO(dlaliberte): Use predicate instead of f?
          if (f.call(thisObj, obj[property], property, obj)) {
            results.push(obj[property]);
          }
        }
      }
    }
    return results;
  };
  return helper(obj, memoize(f), []);
}

/**
 * Returns an object based on its fully qualified external path.
 * Note that keys in paths can be numbers, which index into arrays.
 *
 * This is analogous to closure's goog.getObjectByName, with two differences:
 * 1. It can handle empty strings as keys.
 * For example, obj['a']['']['b'] is represented as "a..b"
 * and obj['a'][''] is represented as "a.".
 * TODO: Not clear what this is good for.
 *
 * 2. If the value of a property is an array of objects, and the corresponding
 * key is not a number, it is used to search through the array of objects to
 * find the first one where the 'name' property has a value that matches the
 * key. Then the remainder of the path is processed starting with the matching
 * object.
 * For example, obj = [{'name': 'foo', 'a': 1}, {'name': 'bar', 'b': 2}]
 * "foo.a" returns 1. and "bar.b" returns 2.
 *
 *
 * @param path The fully qualified path.
 * @param obj The object within which to look; default is
 *     goog.global but should be gviz.util.VisCommon.getGlobal()
 * @return The value (object or primitive) or, if not found, null.
 */
export function getObjectByName(
  path: string,
  obj?: AnyDuringMigration | null,
): AnyDuringMigration {
  const findName = (objs: AnyDuringMigration, key: AnyDuringMigration) => {
    for (let i = 0; i < objs.length; i++) {
      const obj = objs[i];
      if (obj['name'] && obj['name'] === key) {
        return obj;
      }
    }
    return null;
  };

  const keys = path.split('.');
  let value = obj || goog.global;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (Array.isArray(value) && !key.match(/[0-9]+/)) {
      value = findName(value, key);
    } else if (value[key] != null) {
      value = value[key];
    } else {
      return null;
    }
  }
  return value;
}

/**
 * Extends the object accessed by the sequence of keys down to the value.
 * Existing property value objects will be modified or new objects
 * will be added as needed, and the value will be deepExtended with the
 * last property.  The object will be returned.
 *
 * @param obj The object to extend.
 * @param keys The sequence of keys, either index
 *     number or property string.
 * @param value The value to extend the object with.
 */
export function extendByKeys(
  obj: {[key: string | number]: AnyDuringMigration},
  keys: Array<number | string>,
  value: AnyDuringMigration,
): AnyDuringMigration {
  // First create a new object from keys and value.
  const newObj = keys.reduceRight((acc, key) => {
    return {[key]: acc};
  }, value);
  // Then merge it into obj.
  deepExtend(obj, newObj);
  return obj;
}

/**
 * Returns the value as an object, but not Array, Function, or Date.
 * Returns null otherwise.
 *
 * Note that isObject() is true for Arrays, Functions, and Dates also,
 * but we typically don't want to allow any of those.  Also note that
 * type {!Object} includes those extra types. But goog.typeOf()
 * does all the browser-sensitive checking to ensure the value is just an
 * object and not an Array or Function.  It also checks for null or undefined.
 * But sadly, it does not check for Date, so we have to do that separately.
 *
 * But the jscompiler doesn't know any of this, so extra assertions or
 * casts would still be necessary anyway, so this simple utility is designed
 * to make all this easier.
 *
 */
export function asObjectOrNull(
  value: AnyDuringMigration,
): AnyDuringMigration | null {
  if (goog.typeOf(value) === 'object' && !isDateLike(value)) {
    assert(isObject(value));
    return value;
  }
  return null;
}

/**
 * Recursively extends an object's properties with other objects.
 * Property values that are objects will replace corresponding non-objects,
 * but not vice versa.  Null and undefined values will be replaced
 * by any non-null defined value, but not vice versa.
 *
 * @param target The object that should be extended. If this
 *   is not an object, or is null or undefined, a new empty object will be used.
 * @param varArgs The objects with which the target
 *   will be extended.  Arrays or non-objects will be ignored.
 * @return The target object, if it was specified, or the new extended
 *   object if one was not.
 */
export function deepExtend(
  target: undefined | AnyDuringMigration | null,
  ...varArgs: Array<undefined | AnyDuringMigration | null>
): AnyDuringMigration {
  target = asObjectOrNull(target) || {};
  if (arguments.length === 2) {
    // This is the base case. If there are two arguments, extend the first one
    // with the second one.
    const other = arguments[1];
    if (!asObjectOrNull(other)) {
      // But ignore non 'object'
      return target;
    }
    for (const p in other) {
      // TODO(dlaliberte): Check/test whether other.hasOwnProperty(p)?
      if (Array.isArray(other[p])) {
        // If this property on the other object is an array, clone it and set
        // it. We don't care what was in the target before this since we don't
        // have an intelligent way of extending arrays. But at the very least we
        // want a shallow clone of it.
        target[p] = Array.from(other[p]);
      } else if (asObjectOrNull(target[p])) {
        // If the type of this property on the target is an object, extend that
        // object.
        target[p] = deepExtend(target[p], other[p]);
      } else if (asObjectOrNull(other[p])) {
        // The property on the target is either not an object, or doesn't exist.
        // In either case, we're in this block because this property on the
        // other object is an object, so we should set the property on the
        // target to be an empty object extended by the value of this property
        // on the other object. This effectively clones the property of the
        // other object, which is exactly what we want, since we don't want to
        // mutate the other object accidentally when we modify the target.
        target[p] = deepExtend({}, other[p]);
      } else if (target[p] == null || other[p] != null) {
        // Either the type of the property is simple or it doesn't exist. In
        // either case, just set the property.
        target[p] = other[p];
      }
    }
  } else if (arguments.length > 2) {
    // When the user specified more than two arguments, we need to iterate over
    // every other object and extend the target object with them in sequence.
    for (let i = 1, leni = arguments.length; i < leni; i++) {
      target = deepExtend(target, arguments[i]);
    }
  }
  return target;
}

/**
 * Returns a hash function of an object or a primitive.
 * @param obj The object or primitive.
 * @return A hash function of the specified object.
 */
export function getHash(obj: AnyDuringMigration): number {
  return getHashInternal(obj, 1);
}

/**
 * Returns a number which is the hash function of an object or a primitive.
 * The function takes a seed as an argument. The seed is something that
 * interacts with, and affects, the result. It is used in rolling calculations
 * to combine hashes of multiple values. E.g., to hash two values together,
 * you can give the result of the hash of the first one, as the seed to the
 * hash function, when you hash the second one.
 * The hash differentiates the following types : date, object, array, function
 * and primitives.
 * A few examples:
 *                 // primitives
 *                 hash(1) != hash(2)
 *                 hash('true') != hash(true)
 *                 hash('null') != hash(null)
 *                 hash(null) != hash(undefined) != hash(false)
 *                 // Order in objects keys/values
 *                 hash({'a': 1, 'b': 2}) == hash({'b': 2, 'a': 1})
 *                 hash({'a': 1, 'b': 2}) != hash({'a': 2, 'b': 1})
 *                 // Order in arrays
 *                 hash([0, 1]) != hash([1, 0])
 *                 // Object vs Arrays
 *                 hash([null]) != hash({0: null}) != hash({0: ''})
 * @param objOrPrimitive The object or primitive.
 * @param seed The seed for the calculation (should be one).
 * @return A hash function of the specified object and the given seed.
 */
function getHashInternal(
  objOrPrimitive: AnyDuringMigration,
  seed: number,
): number {
  const HASH_MAX = HASHCODE_MAX;
  const type = goog.typeOf(objOrPrimitive);
  seed = (31 * seed + hashCode(type)) % HASH_MAX;
  switch (type) {
    case 'object':
      const obj = objOrPrimitive;
      if (obj.constructor === Date) {
        const date = obj;
        seed = (31 * seed + hashCode('date')) % HASH_MAX;
        seed = getHashInternal(date.getTime(), seed);
      } else {
        // TODO(dlaliberte): Maybe just use Object.keys(obj);
        const orderedSet = getOrderedKeySet(obj);
        for (const key in orderedSet) {
          if (orderedSet.hasOwnProperty(key)) {
            seed = getHashInternal(obj[key], getHashInternal(key, seed));
          }
        }
      }
      break;
    case 'array':
      const arr = objOrPrimitive as AnyDuringMigration[];
      for (let i = 0; i < arr.length; i++) {
        seed = getHashInternal(arr[i], getHashInternal(String(i), seed));
      }
      break;
    default:
      seed = (31 * seed + hashCode(String(objOrPrimitive))) % HASH_MAX;
  }
  return seed;
}

/**
 * Returns the ordered set of keys of the given object. The returned set is
 * an object with the same keys of the specified object in order with all
 * values set to true.
 * @param obj The object to get the ordered set of keys for.
 * @return An object with the ordered set of keys for the given object.
 */
export function getOrderedKeySet(obj: AnyDuringMigration): AnyDuringMigration {
  const arr = Object.keys(obj);
  arr.sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
  const rv: {[key: string]: boolean} = {};
  for (let i = 0; i < arr.length; i++) {
    rv[arr[i]] = true;
  }
  return rv;
}

// The following Set utilities are to replace goog.structs.Set methods
// They should be obsoleted as soon as feasible.

/**
 * Returns Array converted from Set, equivalent to Array.from(set).
 * Use this to avoid conflicting polyfills of Array.from,
 * e.g. MooTools prior to 1.6.0.
 */
export function arrayFromSet<T>(set: Set<T>): T[] {
  const arr: T[] = [];
  for (const v of set) {
    arr.push(v);
  }
  return arr;
}

/**
 * Returns true if a and b contain the same members.
 */
export function setEquals<T>(a: Set<T>, b: Set<T>): boolean {
  return (
    a.size === b.size && [...arrayFromSet(a)].every((value) => b.has(value))
  );
}

/**
 * Finds all values that are present in both Sets a and b.
 */
export function setIntersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set<T>();
  const values = arrayFromSet(b);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (a.has(value)) {
      result.add(value);
    }
  }

  return result;
}

/**
 * Finds all values that are present in Set a and not in Set b.
 */
export function setDifference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const result = new Set(a);
  const values = arrayFromSet(b);
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (a.has(value)) {
      result.delete(value);
    }
  }
  return result;
}
