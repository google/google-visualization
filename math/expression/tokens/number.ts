/**
 * @fileoverview This file provides a number token.
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

import {Symbol} from './symbols';
import {Token} from './token';

/** Represents a number token. */
export class Number implements Token {
  value: number;

  /** @param num The number that this token represents. */
  constructor(num: number) {
    asserts.assert(typeof num === 'number');
    this.value = num;
  }

  getSymbol() {
    return Symbol.NUMBER;
  }
}
