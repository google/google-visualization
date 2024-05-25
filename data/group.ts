/**
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
import {DataTable} from './datatable';
import {compareValues} from './datautils';
import {DataView} from './dataview';
import {
  ColumnType,
  GroupAggregationColumnSpec,
  GroupKeyColumnSpec,
  SortColumnsObject,
  Value,
  Values,
} from './types';

// tslint:disable:no-dict-access-on-struct-type Migration
// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Performs grouping on a data table. Takes a DataTable, a set of key column
 * definitions and a set of data column definitions, sorts the datatable by the
 * keys, groups the rows by the keys and aggregates the data columns by the
 * specified aggregation functions. This function is similar to SQL group-by.
 * A modifier function can be specified for each key, in which case it will be
 * applied to the key before the actual grouping. This feature can be used to
 * group by quarter, for example, where the key in the original DataTable is
 * a date.
 *
 * Column labels for the result DataTable can be specified, but are copied from
 * the input DataTable if omitted.
 * Column IDs for the result DataTable can be specified too, but are left empty
 * if omitted.
 *
 * Example usage:
 * var result = gviz.util.data.group(dt, [0],
 *     [{'column': 3, 'aggregation': gviz.util.data.sum, 'type': 'number'}]);
 *
 * This call will execute grouping on dt, using column 0 as the grouping key
 * and sum aggregation of column 3 as the data.
 *
 * NOTE: This api can be extended to provide rollup, if we find it useful
 * in the future.
 *
 * @param dt The input DataTable or DataView.
 *
 * @param keys An array of key columns and possibly
 *     modifier functions for the keys. A modifier function is applied to the
 *     key before grouping.
 *
 *     Each element of the array is either a number representing the index of
 *     the key column in the input table, or an object with the following
 *     properties:
 *
 *     - column {number} - The key column.
 *     - modifier {Function} - A modifier function that accepts 1 argument and
 *         returns the type specified in the 'type' property.
 *     - type {string} - The return type of the modifier function.
 *     - label {string} - The label to use for this column in the result.
 *     - id {string} - The ID to use for this column in the result.
 *
 * @param columns An optional array of data columns and
 *     matching aggregation functions.
 *
 *     Each element of the array is an object with the following properties:
 *
 *     - column {number} - The key column.
 *     - aggregation {Function} - An aggregation function that accepts an array
 *         of values and returns an aggregated value of them.
 *     - type {string} - The return type of the aggregation function.
 *     - label {string} - The label to use for this column in the result.
 *     - id { string} - The ID to use for this column in the result.
 *
 * @return The grouping result.
 */
export function group(
  dt: AbstractDataTable, //
  keys: Array<number | GroupKeyColumnSpec>, //
  columns: GroupAggregationColumnSpec[] = [],
): DataTable {
  // A calculated column function for modifiers.
  // Used to translate modifiers to calculated columns in a DataView.
  const calc = (
    colIdx: number,
    modifier: (value: Value | null) => Value | null,
    dt: AbstractDataTable,
    rowIdx: number,
  ) => modifier(dt.getValue(rowIdx, colIdx));

  // Separate the key indices and the key modifiers to arrays.
  const keyIndices: number[] = [];
  const keyModifiers: AnyDuringMigration[] = [];
  for (const key of keys) {
    if (typeof key === 'number') {
      keyIndices.push(key);
    } else if (typeof key === 'object') {
      const keyIdx = dt.getColumnIndex(key['column']);
      if ('modifier' in key) {
        keyModifiers.push({
          calcCol: {
            'calc': (dt: AbstractDataTable, rowIdx: number) =>
              calc(keyIdx, key.modifier, dt, rowIdx),
            'type': key['type'],
            'label': key['label'],
            'id': key['id'],
          },
          // Save the index of this modifier.
          newCol: keyIndices.length,
        });
      }
      keyIndices.push(keyIdx);
    }
  }

  // If we have key modifiers, we create a view of the data with the key
  // modifiers as calculated columns and use it instead of the input
  // DataTable.
  if (keyModifiers.length > 0) {
    const view = new DataView(dt);
    const viewCols = view.getViewColumns();

    for (const keyModifier of keyModifiers) {
      // Add calculated column at the end of the dataView
      const colIndex = viewCols.length;
      viewCols[colIndex] = keyModifier.calcCol;

      // Edit the keyIndices to point to the new column
      keyIndices[keyModifier.newCol] = colIndex;
    }

    view.setColumns(viewCols);
    dt = view;
  }

  // Create the result key columns, cache the key columns types.
  const result = new DataTable();
  const types: ColumnType[] = [];
  for (let index = 0; index < keyIndices.length; index++) {
    const key = keys[index];
    const keyIdx = keyIndices[index];
    const type = dt.getColumnType(keyIdx);
    const label =
      typeof key === 'object' && key['label'] != null
        ? key['label']
        : dt.getColumnLabel(keyIdx);
    const id =
      typeof key === 'object' && key['id'] != null
        ? key['id']
        : dt.getColumnId(keyIdx);
    result.addColumn(type, label, id);
    types.push(type);
  }

  // Create the result aggregated data columns.
  for (const column of columns) {
    const colIdx = dt.getColumnIndex(column['column']);
    const label = column['label'] || dt.getColumnLabel(colIdx);
    const id = column['id'] != null ? column['id'] : dt.getColumnId(colIdx);
    result.addColumn(column['type'], label, id);
  }

  // Sort the input data by the keys.
  const sortColumns: SortColumnsObject[] = keyIndices.map((keyIdx) => ({
    'column': keyIdx,
  }));
  const sortedIndices = dt.getSortedRows(sortColumns);

  // Create a double dimension array for the aggregation.
  const columnValues: Values[] = [];
  for (let i = 0; i < columns.length; i++) {
    columnValues.push([]);
  }

  for (let i = 0; i < sortedIndices.length; i++) {
    // Cache the data to be aggregated.
    for (let index = 0; index < columns.length; index++) {
      const column = columns[index];
      columnValues[index].push(
        dt.getValue(sortedIndices[i], dt.getColumnIndex(column['column'])),
      );
    }

    // Check if the key in row i matches the key in row i+1.
    let nextKeyMatches = false;
    if (i < sortedIndices.length - 1) {
      nextKeyMatches = true;
      for (let j = 0; j < keyIndices.length; j++) {
        const key1 = dt.getValue(sortedIndices[i], keyIndices[j]);
        const key2 = dt.getValue(sortedIndices[i + 1], keyIndices[j]);
        if (compareValues(types[j], key1, key2) !== 0) {
          nextKeyMatches = false;
          break;
        }
      }
    }

    if (!nextKeyMatches) {
      const rowIdx = result.addRow();
      // Output the keys to the result.
      for (let colIdx = 0; colIdx < keyIndices.length; colIdx++) {
        const keyIdx = keyIndices[colIdx];
        result.setValue(rowIdx, colIdx, dt.getValue(sortedIndices[i], keyIdx));
      }

      // Output the data columns to the result.
      const baseColIdx = keys.length;
      for (let index = 0; index < columns.length; index++) {
        const column = columns[index];
        const aggregator = column['aggregation'];
        const value = aggregator(columnValues[index]);
        result.setValue(rowIdx, baseColIdx + index, value);
      }

      // Reset columnValues.
      for (let k = 0; k < columns.length; k++) {
        columnValues[k] = [];
      }
    }
  }

  return result;
}
