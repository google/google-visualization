/**
 * @fileoverview This file provides the representation for variables.
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
import {Identifier} from './tokens/identifier';

/**
 * Represents an arbitrary variable with a given name, used in the context of
 * gviz.math.expression.Expression's.
 * @final
 */
export class Variable extends Expression {
  /** @param name The name of the variable represented by this expression. */
  constructor(public name: string) {
    super();
  }

  compose() {
    return [new Identifier(this.name)];
  }

  override isVariable() {
    return true;
  }

  /**
   * Gets the name of the variable that this expression encapsulates.
   * @return The name of the variable represented by this expression.
   */
  override getName(): string {
    return this.name;
  }
}
