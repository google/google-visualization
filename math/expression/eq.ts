/**
 * @fileoverview This file provides the representation for expressions that are
 *     equal to each other.
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
import {NaryOperator} from './nary_operator';
import {Equals} from './tokens/equals';

/**
 * Represents an Equal's expression of arbitrary length.
 * @final
 */
export class Eq extends NaryOperator {
  /**
   * @param components The array of expressions that are equal to each other.
   */
  constructor(components: Expression[]) {
    super(components);
  }

  getPrecedence() {
    return 0;
  }

  compose() {
    return this.join(new Equals());
  }
}
