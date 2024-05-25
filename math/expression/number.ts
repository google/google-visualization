/**
 * @fileoverview This file provides the representation for numbers.
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

import {Expression} from './expression';
import {Number as TokenNumber} from './tokens/number';

/**
 * Represents an arbitrary  number used in the context of
 * gviz.math.expression.Expression's.
 * @final
 */
export class GVizNumber extends Expression {
  /** @param value The value of the number represented by this expression. */
  constructor(readonly value: number) {
    super();
  }

  compose() {
    return [new TokenNumber(this.value)];
  }

  override isNegative() {
    return this.value < 0;
  }

  /**
   * Get the number that this expression encapsulates.
   * @return The number represented by this expression.
   */
  override getValue(): number {
    return this.value;
  }

  override isNumber() {
    return true;
  }
}
