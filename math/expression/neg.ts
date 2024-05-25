/**
 * @fileoverview This file provides the representation for negated expressions.
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
import {GVizNumber} from './number';
import {Negate} from './tokens/negate';
import {UnaryOperator} from './unary_operator';

/**
 * Represents the negation operator and used in the context of
 * gviz.math.expression.Expression's.
 * @final
 */
export class Neg extends UnaryOperator {
  /** @param component The expression that should be negated. */
  constructor(component: Expression) {
    super(component);
  }

  override simplify(): Expression {
    const r = this.getComponent().simplify();
    if (r.isNegative()) {
      if (r instanceof Neg) {
        return r.getComponent();
      } else if (r instanceof GVizNumber) {
        return new GVizNumber(-r.getValue());
      } else {
        throw new Error('Unknown type of negative.');
      }
    }
    return new Neg(r);
  }

  compose() {
    return [new Negate()].concat(this.getComponent().compose());
  }

  override isNegative() {
    const simplified = this.simplify();
    return simplified instanceof Neg;
  }

  getPrecedence() {
    // The precedence of unary operators doesn't matter since there is no
    // choice, as there is with binary operators.
    // Use a special weird value like -1, and add a check for precedence of -1,
    // and raise an error if it is used.
    return -1;
  }
}
