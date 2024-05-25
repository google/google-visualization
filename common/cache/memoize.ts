/**
 * @fileoverview The memoize function.
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

import {memoize as googMemoize} from '@npm//@closure/memoize/memoize';

import {Cache} from './cache';
import {LRU} from './lru';

const {simpleSerializer} = googMemoize;

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

// The pattern for using the Fn type with TArgs and TResult come from:
// https://medium.com/@arionsprague/typescript-generic-function-splat-f632a89b924c

type Fn<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult;

// The type of a serializer function, but it doesn't 'work' yet.
// type SerializerFn<TArgs extends unknown[]> = (...args: TArgs) => string;

/**
 * Default maximum size of the cache.
 */
const DEFAULT_CACHE_SIZE = 1000;

/**
 * Wraps a function to cache its return values given the same argument values.
 *
 * You can just call like this, to use the default options: memoize(func)
 *
 * Unlike goog.memoize, here we manage the cache separate from 'this' or
 * the global context, and the cache defaults to a finite maximum size.
 * The function to be wrapped must be pure, and only depend on its arguments
 * and 'this' context.  There may be further restrictions on the arguments
 * depending on the capabilities of the serializer used.
 *
 * @param fn The function to be memoized.
 * @param options Options can include:
 *   serializer: (...args) => string, to serialize the arguments.
 *   cache: Cache to use instead of default
 *   size: number The max size of the cache.
 * @return The wrapped function.
 */
export function memoize<TArgs extends unknown[], TResult>(
  fn: Fn<TArgs, TResult>,
  options: {
    serializer?: (...args: TArgs) => string; // try: SerializerFn<TArgs>
    cache?: Cache<AnyDuringMigration>; // Any should be TResult?
    size?: number;
  } = {}, //
): Fn<TArgs, TResult> {
  const serializer = options.serializer || simpleSerializer;
  const size = options.size || DEFAULT_CACHE_SIZE;
  let cache = options.cache || new LRU(size);

  /**
   * The internal function that wraps the fn argument.
   */
  function internalMemoizedFunc(...args: TArgs): TResult {
    // Map the serialized list of args to the corresponding return value.
    const key = serializer(goog.getUid(fn), [...args]);
    return cache.contains(key) ? cache.get(key) : cache.put(key, fn(...args));
  }

  // Add utility functions to the internal memoized function.
  const memoizedFunc = Object.assign(internalMemoizedFunc, {
    clear: () => {
      cache.clear();
    },

    setCapacity: (size: number) => {
      // TODO(b/174599686): add setCapacity to Cache interface so we can call:
      // cache.setCapacity(size);
      cache.clear();
      cache = options.cache || new LRU(size);
    },
  });

  return memoizedFunc;
}
