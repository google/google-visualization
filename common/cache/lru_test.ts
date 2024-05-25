/**
 * @fileoverview Tests of the memoize function.
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

import 'jasmine';

import {LRU} from './lru';

describe('LRU', () => {
  it('clears a non-empty cache resulting in empty cache', () => {
    const lru = new LRU(10);
    expect(lru.size()).toBe(0);

    lru.put('testing', 1);
    expect(lru.contains('testing')).toBe(true);
    expect(lru.size()).toBe(1);

    // Delete everything.
    lru.clear();
    expect(lru.contains('testing')).toBe(false);
    expect(lru.size()).toBe(0);
  });

  it('sets the capacity and reduces cache size if necessary', () => {
    const lru = new LRU(10);
    expect(lru.size()).toBe(0);

    lru.put('testing', 1);
    lru.put('second item', 2);
    expect(lru.size()).toBe(2);

    lru.setCapacity(2);
    expect(lru.size()).toBe(2);

    lru.setCapacity(1);
    // expire least recently used item 'testing'.
    expect(lru.contains('testing')).toBe(false);
    expect(lru.contains('second item')).toBe(true);
    expect(lru.size()).toBe(1);

    // Minimum capacity is 1.
    lru.setCapacity(0);
    expect(lru.contains('second item')).toBe(true);
    expect(lru.size()).toBe(1);
  });

  it('adds an item and deletes it resulting in empty cache', () => {
    const lru = new LRU(10);
    expect(lru.size()).toBe(0);

    lru.put('testing', 1);
    expect(lru.contains('testing')).toBe(true);
    expect(lru.size()).toBe(1);

    // Delete the item by setting to undefined.
    lru.put('testing', undefined);
    expect(lru.contains('testing')).toBe(false);
    expect(lru.size()).toBe(0);
  });

  it('throws an error if getting a key that is not in the cache', () => {
    const lru = new LRU(3);
    expect(() => {
      lru.get('test throw');
    }).toThrow();
  });

  it('updates of full cache with puts and gets leaves cache full', () => {
    const lru = new LRU(3);
    lru.put('a', 1);
    lru.put('b', 2);
    lru.put('c', 3);
    expect(lru.size()).toBe(3);

    expect(lru.get('a')).toBe(1);
    expect(lru.size()).toBe(3);
    expect(lru.put('a', 11)).toBe(11);
    expect(lru.size()).toBe(3);
  });

  it('deletes of the same item twice leaves the cache as is', () => {
    const lru = new LRU(3);
    lru.put('a', 1);
    lru.put('b', 2);
    lru.put('c', 3);
    expect(lru.size()).toBe(3);

    lru.put('a', undefined);
    expect(lru.size()).toBe(2);
    // Delete the same item again - no failure, but no difference.
    lru.put('a', undefined);
    expect(lru.size()).toBe(2);
  });

  it('expires the least recently used item when new item is added.', () => {
    const lru = new LRU(3);
    lru.put('a', 1);
    lru.put('b', 2);
    lru.put('c', 3);
    expect(lru.size()).toBe(3);

    // 'a' should be least recently used.
    // But we can only test that by expiring it.
    expect(lru.contains('a')).toBe(true);
    expect(lru.contains('b')).toBe(true);
    expect(lru.contains('c')).toBe(true);

    // Force 'a' to be expired by adding a new item.
    lru.put('d', 4);
    expect(lru.contains('a')).toBe(false);

    expect(lru.contains('b')).toBe(true);
    expect(lru.contains('c')).toBe(true);
    expect(lru.contains('d')).toBe(true);
  });

  it('updates of item with get make it most recently used.', () => {
    const lru = new LRU(3);
    lru.put('a', 1);
    lru.put('b', 2);
    lru.put('c', 3);
    expect(lru.size()).toBe(3);

    // 'a' should be least recently used.
    expect(lru.contains('a')).toBe(true);
    expect(lru.contains('b')).toBe(true);
    expect(lru.contains('c')).toBe(true);

    // Use 'a', with get, so 'b' becomes least recently used.
    lru.get('a');
    expect(lru.contains('a')).toBe(true);
    expect(lru.contains('b')).toBe(true);
    expect(lru.contains('c')).toBe(true);

    // Force 'b' to be expired by adding a new item.
    lru.put('d', 4);
    expect(lru.contains('b')).toBe(false);

    expect(lru.contains('a')).toBe(true);
    expect(lru.contains('c')).toBe(true);
    expect(lru.contains('d')).toBe(true);
  });

  it('updates of item with put make it most recently used.', () => {
    const lru = new LRU(3);
    lru.put('a', 1);
    lru.put('b', 2);
    lru.put('c', 3);
    expect(lru.size()).toBe(3);

    // 'a' should be least recently used.
    expect(lru.contains('a')).toBe(true);
    expect(lru.contains('b')).toBe(true);
    expect(lru.contains('c')).toBe(true);

    // Update 'a', with put, so 'b' becomes least recently used.
    lru.put('a', 11);
    expect(lru.contains('a')).toBe(true);
    expect(lru.contains('b')).toBe(true);
    expect(lru.contains('c')).toBe(true);

    // Force 'b' to be expired by adding a new item.
    lru.put('d', 4);
    expect(lru.contains('b')).toBe(false);

    expect(lru.contains('a')).toBe(true);
    expect(lru.contains('c')).toBe(true);
    expect(lru.contains('d')).toBe(true);
  });
});
