/**
 * @fileoverview This file provides the representation for exponent expressions.
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
import {Power} from './tokens/power';

/**
 * Represents the Power operator and used in the context of
 * gviz.math.expression.Expression's.
 * @final
 */
export class Pow extends NaryOperator {
  /**
   * @param components The array of expressions that are raised to each other.
   */
  constructor(components: Expression[]) {
    super(components);
  }

  getPrecedence() {
    return 3;
  }

  compose() {
    return this.join(new Power());
  }
}
