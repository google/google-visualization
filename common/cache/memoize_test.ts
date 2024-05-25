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

import {memoize} from './memoize';

describe('memoize test', () => {
  it('computes result of memoized simple function the same', () => {
    /**
     * Calculates the fibonacci sequence using the recursive approach. Supports
     * negative fibonacci numbers for kicks. The number at 0 is hardcoded to be
     * 0, and the number at 1 is hardcoded to be 1. Here is the sequence along
     * with the number indices below it: -8  5 -3  2 -1  1 0 1 1 2 3 5 8 13 -6
     * -5 -4 -3 -2 -1 0 1 2 3 4 5 6  7
     */
    const fib = (n: number): number => {
      if (n === 0) {
        return 0;
      } else if (n === 1) {
        return 1;
      } else if (n > 1) {
        return fib(n - 1) + fib(n - 2);
      } else {
        return fib(n + 2) - fib(n + 1);
      }
    };
    const memoizedFib = memoize(fib);

    expect(memoizedFib(1)).toBe(fib(1));
    expect(memoizedFib(2)).toBe(fib(2));
    expect(memoizedFib(3)).toBe(fib(3));
  });

  it('memoizes function of different arg types', () => {
    const stringReps = (s: string, n: number): string => {
      if (n === 0) {
        return '';
      }
      return s + s.repeat(n - 1);
    };
    const memoizedStringReps = memoize(stringReps);

    expect(memoizedStringReps('abc', 0)).toBe('');
    expect(memoizedStringReps('abc', 3)).toBe('abcabcabc');
  });

  it('memoizes methods with zero args', () => {
    class MyDate {
      constructor(private readonly date: Date) {}

      getTime() {
        return this.date.getTime();
      }

      memoizedGetTime = memoize(this.getTime.bind(this));
    }
    const d = new Date();
    const myDate = new MyDate(d);

    expect(myDate.memoizedGetTime()).toBe(d.getTime());
  });

  it('memoizes methods with args', () => {
    class MyDate {
      constructor(private readonly date: Date) {}

      toLocaleTimeString(locale: string) {
        return this.date.toLocaleTimeString(locale);
      }

      memoizedToLocaleTimeString = memoize(this.toLocaleTimeString.bind(this));
    }
    const d = new Date();
    const myDate = new MyDate(d);

    expect(myDate.memoizedToLocaleTimeString('en-US')).toBe(
      d.toLocaleTimeString('en-US'),
    );
  });
});
