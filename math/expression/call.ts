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
import {CloseParen} from './tokens/close_paren';
import {Identifier} from './tokens/identifier';
import {OpenParen} from './tokens/open_paren';
import {SeparatorComma} from './tokens/separator_comma';

/**
 * Provides the representation for arbitrary function calls.
 * @final
 */
export class Call extends NaryOperator {
  name: AnyDuringAssistedMigration;

  /**
   * @param name The name of the function that should be called.
   * @param args The arguments that should be passed into this function call.
   */
  constructor(name: string, args: Expression[]) {
    super(args);
    this.name = name;
  }

  override simplify() {
    return this;
  }

  compose() {
    const composed = [new Identifier(this.name), new OpenParen()];
    // ts-ignore was either removed or relocated below Fix code and remove this comment. Error:
    // TS2345: Argument of type 'Token' is not assignable to parameter of type
    // 'Identifier | OpenParen'.
    composed.push(...this.join(new SeparatorComma()), new CloseParen());
    return composed;
  }

  getPrecedence() {
    // The precedence of unary operators doesn't matter since there is no
    // choice, as there is with binary operators.
    return -1;
  }
}
