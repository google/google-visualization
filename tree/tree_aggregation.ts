/**
 * @fileoverview Predefined aggregation functions that can be used with
 *     Node.calcAggregatedValue().
 *
 * @license
 * Copyright 2012 Google LLC
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

import {
  filter,
  forEach,
  reduce,
} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';

// tslint:disable:ban-types Migration

type Aggregator = (
  p1: AnyDuringMigration,
  p2: AnyDuringMigration[],
) => AnyDuringMigration;
export {type Aggregator};

/**
 * Sums the child values. If there are no children, use the node's value.
 * @param value The value of the node.
 * @param childValues The values of the node's children.
 * @return The sum.
 */
export function sumNoOverride(
  value: number | null,
  childValues: number[],
): number {
  assertNumberOrNullInput(value, childValues);
  if (childValues.length === 0) {
    return value === null ? 0 : value;
  } else {
    const sum = reduce(
      childValues,
      (sum: number, childValue: number) => sum + childValue,
      0,
    );
    return sum;
  }
}

/**
 * Calculates the average of the child values, ignoring null values.
 * If there are no children, use the node's value.
 * If all children are null, return null.
 * @param value The value of the node.
 * @param childValues The values of the node's children.
 * @return The average, or null if all children are null or there
 *     are no children and the node's value is null.
 */
export function averageNoOverride(
  value: number | null,
  childValues: Array<number | null>,
): number | null {
  assertNumberOrNullInput(value, childValues);
  if (childValues.length === 0) {
    return value;
  } else {
    // Filter out null values.
    const nonNullChilds = filter(childValues, (value) => value != null);
    // Do the average.
    return nonNullChilds.length === 0
      ? null
      : // AnyDuringMigration because:  Argument of type '(number | null)[]' is
        // not assignable to parameter of type 'number[]'.
        sumNoOverride(value, nonNullChilds as AnyDuringMigration) /
          nonNullChilds.length;
  }
}

/**
 * Asserts that a given value is either a number or null.
 * @param value The value to check.
 */
function assertNumberOrNull(value: AnyDuringMigration) {
  assert(value === null || typeof value === 'number');
}

/**
 * Asserts that a given input to an aggregator contains only numbers or nulls.
 * @param value The node value to check.
 * @param childValues The child values to check.
 */
function assertNumberOrNullInput(
  value: AnyDuringMigration,
  childValues: AnyDuringMigration[],
) {
  assertNumberOrNull(value);
  forEach(childValues, (childValue) => {
    assertNumberOrNull(childValue);
  });
}
