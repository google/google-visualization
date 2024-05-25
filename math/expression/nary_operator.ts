/**
 * @fileoverview This file provides the base class for N-ary operators.
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

import * as googArray from '@npm//@closure/array/array';

import {Expression} from './expression';
import {CloseParen} from './tokens/close_paren';
import {OpenParen} from './tokens/open_paren';
import {Token} from './tokens/token';

/** An N-ary operator. One that takes in any amount of arguments. */
export abstract class NaryOperator extends Expression {
  components: Expression[] = [];

  /**
   * @param components The component expressions that this operator should be
   *     applied to.
   */
  constructor(components: Expression[]) {
    super();
  }

  abstract override getPrecedence(): number;

  /**
   * Tokenizes all the components and joins them with the given token.
   * @param token The token to join with.
   * @return The joined list of tokens.
   */
  join(token: Token): Token[] {
    const joined: Token[] = [];
    this.components.forEach(function (
      this: NaryOperator,
      component: Expression,
      index: number,
    ) {
      if (index > 0) {
        joined.push(token);
      }
      let wrapWithParentheses = false;
      if (
        component instanceof NaryOperator &&
        component.getComponentCount() > 1 &&
        this.getPrecedence() > component.getPrecedence()
      ) {
        wrapWithParentheses = true;
      }
      if (wrapWithParentheses) {
        joined.push(new OpenParen());
      }
      googArray.extend(joined, component.compose());
      if (wrapWithParentheses) {
        joined.push(new CloseParen());
      }
    }, this);
    return joined;
  }

  override simplify(): Expression {
    if (this.components.length === 1) {
      return this.components[0];
    }
    const components: Expression[] = [];
    this.components.forEach((component: Expression) => {
      components.push(component.simplify());
    });
    this.components = components;
    return this;
  }

  /**
   * Gets the component expression at the given index.
   * @param index The index of the component to retrieve.
   * @return The component expression at the given index.
   */
  override getComponent(index = 0): Expression {
    return this.components[index];
  }

  /**
   * Gets the number of components in this expression.
   * @return The component expression at the given index.
   */
  override getComponentCount(): number {
    return this.components.length;
  }
}
