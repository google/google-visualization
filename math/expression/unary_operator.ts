/**
 * @fileoverview This file provides the base class for unary operators.
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

/**
 * An abstract class that represents an operator that takes only one component
 * or argument.
 */
export abstract class UnaryOperator extends NaryOperator {
  /**
   * @param component The component expression that this operator should be
   *     applied to.
   */
  constructor(component: Expression) {
    super([component]);
  }
}
