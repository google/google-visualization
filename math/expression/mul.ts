/**
 * @fileoverview This file provides the representation for products.
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
import {Neg} from './neg';
import {GVizNumber} from './number';
import {Times} from './tokens/times';

// tslint:disable:ban-ts-suppressions

/**
 * Mul
 */
export class Mul extends NaryOperator {
  private readonly collapseTerms: boolean;

  /**
   * @param components The array of expressions that should be multiplied by
   *     each other.
   * @param collapseTerms Whether the terms can be collapsed.
   */
  constructor(components: Expression[], collapseTerms?: boolean) {
    super(components);

    this.collapseTerms = collapseTerms != null ? collapseTerms : false;
  }

  getPrecedence() {
    return 2;
  }

  override simplify() {
    super.simplify();
    let negCount = 0;
    const newComponents: Expression[] = [];
    let constant = 1;
    this.components.forEach((component) => {
      if (component.isNegative()) {
        component = new Neg(component).simplify();
        negCount++;
      }
      if (component.isNumber()) {
        const num = component as GVizNumber;
        constant *= num.getValue();
        // Suppressing errors for ts-migration.
        //   TS2322: Type 'null' is not assignable to type 'Expression'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        component = null;
      }
      if (component) {
        newComponents.push(component);
      }
    });
    if (constant !== 1) {
      newComponents.splice(0, 0, new GVizNumber(constant));
    }
    let r = new Mul(newComponents, this.collapseTerms);
    if (negCount % 2) {
      // Suppressing errors for ts-migration.
      //   TS2741: Property 'collapseTerms' is missing in type 'Neg' but
      //   required in type 'Mul'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      r = new Neg(r);
    }
    return r;
  }

  compose() {
    if (this.collapseTerms) {
      return Array.prototype.concat.apply(
        [],
        this.components.map((component) => component.compose()),
      );
    } else {
      return this.join(new Times());
    }
  }

  override isNegative() {
    let negCount = 0;
    this.components.forEach((component) => {
      if (component.isNegative()) {
        negCount++;
      }
    });
    return !!(negCount % 2);
  }
}
