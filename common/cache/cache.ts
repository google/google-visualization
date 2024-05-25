/**
 * @fileoverview A cache to be used by LRU.
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
 * A cache to be used by LRU.
 */
export interface Cache<VALUE> {
  /**
   * Clears the cache of all items.
   */
  clear(): void;

  /**
   * @param key The key to find.
   * @return true if the key is in the cache.
   */
  contains(key: string): boolean;

  /**
   * Gets the value for the given key. Throws an exception when the key does not
   * exist.
   *
   */
  get(key: string): VALUE;

  /**
   * Puts a new (key, value) pair into the cache.
   *
   * @param key The key to store.
   * @param value The value to store.
   */
  put(key: string, value: VALUE): void;

  /**
   * @return The current size of the cache.
   */
  size(): number;
}
