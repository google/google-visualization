/**
 * @fileoverview This file provides the base class for math expressions.
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

// tslint:disable:ban-types Migration

/** Represents an arbitrary formula expression. */
export abstract class Expression {
  abstract compose(): AnyDuringMigration[];

  /**
   * Simplifies this expression. This method might mutate this instance or
   * return a different instance.
   * @return The simplified version of this expression.
   */
  simplify(): Expression {
    return this;
  }

  /** @return Whether this expression is negative. */
  isNegative(): boolean {
    return false;
  }

  /** @return Whether this expression is a number. */
  isNumber(): boolean {
    return false;
  }

  /** @return Whether this expression is a variable. */
  isVariable(): boolean {
    return false;
  }

  /** Throws an error, unless overridden to get a component. */
  getComponent(index = 0): Expression {
    throw new Error('Only NaryOperator can return components');
  }

  /** Throws an error, unless overridden to get component count. */
  getComponentCount(): number {
    throw new Error('Only NaryOperator can return component count');
  }

  getPrecedence(): number {
    throw new Error('Only NaryOperator can return precedence');
  }

  getValue(): number {
    throw new Error('Only GVizNumber can return value');
  }

  getName(): string {
    throw new Error('Only Variable can return name');
  }
}
