/**
 * @fileoverview An implementation of a Least Recently Used cache, via Map
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

import {Cache as BaseCache} from './cache';

/**
 * A Least-Recently-Used cache, implemented via built-in Map.
 * We leverage the fact that Map maintains the original insertion order of
 * all elements in the Map, so iterating through the cache visits
 * the least recently inserted elements first.
 * Note that the default maximum capacity is unlimited.
 */
export class LRU<VALUE> implements BaseCache<VALUE> {
  /**
   * The max capacity of this cache, which is a minimum of 1.
   */
  private maxCount: number;

  /**
   * The collection that contains the actual cache.
   */
  private readonly cache: Map<string, VALUE>;

  /**
   * @param capacity The maximum size of the cache, as measured by a count
   *     of the number of items in the cache, not the actual memory used.
   */
  constructor(capacity?: number) {
    this.maxCount = Math.max(1, capacity || Infinity);
    this.cache = new Map<string, VALUE>();
  }

  /**
   * Sets the maximum capacity of this cache.
   * Minimum capacity is 1, not 0.  Reducing the capacity immediately
   * expires least recently used items until the cache size is less than
   * or equal to the max capacity.
   *
   * @param newCapacity The new capacity.
   */
  setCapacity(newCapacity: number) {
    this.maxCount = Math.max(newCapacity, 1);
    if (this.maxCount != null) {
      this.truncate(this.maxCount);
    }
  }

  /**
   * Clears the cache of all items.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * @param key The key to find.
   * @return true if the key is in the cache.
   */
  contains(key: string) {
    return this.cache.has(key);
  }

  /**
   * Returns value for the key, if the key is in the cache.
   * Throws an error if it is not present.
   * Makes item most-recently-used.
   *
   * @param key The key to find.
   * @return value, if the key is in the cache.
   */
  get(key: string): VALUE {
    const value = this.cache.get(key);

    if (typeof value === 'undefined') {
      throw new Error('Cache does not contain key "' + key + '"');
    }

    // Make it most-recently-used.
    this.cache.delete(key);
    this.cache.set(key, value);

    return value;
  }

  /**
   * Puts a new (key, value) pair into the cache, if not already present.
   * Updates an existing item otherwise, and makes it most-recently-used.
   * Deletes item instead if value is undefined.
   *
   * @param key The key to store.
   * @param value The value to store.
   */
  put(key: string, value: VALUE) {
    // Delete any current item
    this.cache.delete(key);
    if (typeof value === 'undefined') {
      // Leave it deleted.
      return;
    }

    // Make it most-recently-used.
    this.cache.set(key, value);

    if (this.maxCount != null) {
      this.truncate(this.maxCount);
    }

    return value;
  }

  /**
   * @return The current size of the cache.
   */
  size() {
    return this.cache.size;
  }

  private truncate(count: number) {
    // Truncation relies on the fact that the Map in this.cache maintains
    // elements in the original insertion order, so iterating through the
    // cache visits the least recently inserted elements first.  Since the
    // get and put methods always reinsert elements, the iteration will
    // visit the least recently USED elements first.
    for (const [key] of this.cache) {
      if (this.cache.size <= count) return;
      this.cache.delete(key);
    }
  }
}
