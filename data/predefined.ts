/**
 * @fileoverview This file contains predefined functions for use in
 * serializable data views. Each function must take a
 * google.visualization.AbstractDataTable (data table or view), a row index,
 * and an options object. The options may differ between functions.
 *
 * @license
 * Copyright 2021 Google LLC
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

import {AbstractDataTable} from './abstract_datatable';
import * as datautils from './datautils';
import {ColumnSpec, Value} from './types';

// tslint:disable:no-dict-access-on-struct-type Migration
// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Always returns the empty string.
 * @param data A data table or data view.
 * @param row The row index.
 * @param options An object with no properties.
 * @return The empty string.
 */
export function emptyString(
  data: AbstractDataTable,
  row: number,
  options: AnyDuringMigration | null,
): string {
  return '';
}

/**
 * Returns a value at a fixed offset from the value in the
 * sourceColumn, either a constant or a percentage.
 * @param data A data table or data view.
 * @param row The row index.
 * @param options An object with the following properties:
 *     errorType {string} Either 'constant' or 'percent'. default='constant'
 *     magnitude {number} The magnitude of the error. Note that you can
 *         pass a negative number for a negative error.
 *         This "option" is required!!
 *     sourceColumn {number} The column containing the original value.
 *         Required!
 * @return An offset value, or null if something goes wrong.
 */
export function error(
  data: AbstractDataTable,
  row: number,
  options: ColumnSpec,
): number | null {
  const column = options['sourceColumn'];
  const error = options['magnitude'];
  if (typeof column !== 'number' || typeof error !== 'number') {
    return null;
  }
  const value = data.getValue(row, column) as number;
  if (typeof value !== 'number') {
    return null;
  }
  if (options['errorType'] === 'percent') {
    return value + value * (error / 100);
  } else {
    return value + error;
  }
}

/**
 * Returns the formatted version of the source value.
 * @param data A data table or data view.
 * @param row The row index.
 * @param options An object with the following properties:
 *     sourceColumn {number} The column containing the original value.
 *         Required!
 * @return A formatted value.
 */
export function stringify(
  data: AbstractDataTable,
  row: number,
  options: ColumnSpec,
): string {
  const column = options['sourceColumn'];
  if (typeof column !== 'number') {
    return '';
  }
  return data.getFormattedValue(row, column);
}

/**
 * Returns the output value from a map, using the value in the same row of the
 * source column as the key to it.
 * TODO(dlaliberte): Does this play nicely with roles? What about with data
 * being a dataview?
 * @param data A data table or data view.
 * @param row The row index.
 * @param options An object with the
 *     following properties:
 *       sourceColumn {number} The column we are mapping against.
 *       mapping {!Object} The mapping from value to corresponding value in the
 *         same row.
 * @return The mapped value or null if none can be found.
 */
export function mapFromSource(
  data: AbstractDataTable,
  row: number,
  options: ColumnSpec,
): AnyDuringMigration {
  const column = options['sourceColumn'];
  const mapping = options['mapping'];
  if (typeof column === 'number' && mapping) {
    const key = data.getValue(row, column);
    if (typeof key === 'string') {
      return key in mapping ? mapping[key] : null;
    }
  }
  return null;
}

/**
 * Returns the first non-null value for the given column, searching
 * from the current cell upwards.
 * @param data A data table or data view.
 * @param row The row index.
 * @param options An object with the following properties:
 *     sourceColumn {number} The column containing the original value.
 *         Required!
 * @return A non-null value, if one can be found.
 */
export function fillFromTop(
  data: AbstractDataTable,
  row: number,
  options: AnyDuringMigration,
): AnyDuringMigration {
  const column = options['sourceColumn'];
  if (typeof column !== 'number') {
    return null;
  }
  return datautils.findNonNullValueInColumn(
    data,
    row,
    column,
    /* isAbove: */ true,
  );
}

/**
 * Returns the first non-null value for the given column, searching
 * from the current cell downwards.
 * @param data A data table or data view.
 * @param row The row index.
 * @param options An object with the following properties:
 *     sourceColumn {number} The column containing the original value.
 *         Required!
 * @return A non-null value, if one can be found.
 */
export function fillFromBottom(
  data: AbstractDataTable,
  row: number,
  options: AnyDuringMigration,
): AnyDuringMigration {
  const column = options['sourceColumn'];
  if (typeof column !== 'number') {
    return null;
  }
  return datautils.findNonNullValueInColumn(
    data,
    row,
    column,
    /* isAbove: */ false,
  );
}

/**
 * Always returns the original value.
 * @param data A data table or data view.
 * @param row The row index.
 *     sourceColumn {number} The column containing the original value.
 *         Required!
 * @return The original value.
 */
export function identity(
  data: AbstractDataTable,
  row: number,
  options: AnyDuringMigration,
): AnyDuringMigration {
  const column = options['sourceColumn'];
  if (typeof column !== 'number') {
    return null;
  }
  return data.getValue(row, column);
}

/**
 * A map of predefined functions that can be used for calculated columns.
 * Each function takes the following parameters:
 *   data {!AbstractDataTable} The underlying data table.
 *   row {number} The row of the underlying data table that contains
 *       the source value.
 *   options {!Object} The options that allow the predefined function to find
 * or calculate the new value using the data and row. Requirements for this
 *       object vary by function.
 * The function returns a {Value} to be returned as the value of
 * DataView#getValue() for the column using the predefined function.
 */
export const PREDEFINED_FUNCTIONS: {
  [key: string]: (
    dt: AbstractDataTable,
    n: number,
    obj: AnyDuringMigration,
  ) => Value | null;
} = {
  'emptyString': emptyString,
  'error': error,
  'mapFromSource': mapFromSource,
  'stringify': stringify,
  'fillFromTop': fillFromTop,
  'fillFromBottom': fillFromBottom,
  'identity': identity,
};
