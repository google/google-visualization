/**
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
import {Neg} from './neg';
import {Minus} from './tokens/minus';
import {Plus} from './tokens/plus';

/**
 * This class represents an array of mathematical expressions that should be
 * added/subtracted together.
 * @final
 */
export class Add extends NaryOperator {
  /**
   * @param components The array of expressions that should be added to each
   *     other.
   */
  constructor(components: Expression[]) {
    super(components);
  }

  getPrecedence() {
    return 1;
  }

  compose() {
    let composed: Array<Minus | Plus> = [];
    for (let i = 0; i < this.components.length; i++) {
      let component = this.components[i];
      if (composed.length > 0 && component.isNegative()) {
        composed.push(new Minus());
        component = new Neg(component).simplify();
      } else if (composed.length > 0) {
        composed.push(new Plus());
      }
      composed = composed.concat(component.compose());
    }
    return composed;
  }
}
