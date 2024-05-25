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
import * as datautils from './datautils';
import {ColumnType, SortColumnsObject} from './types';

const {compareValues} = datautils;

/**
 * Adds a column spec of source DataTable to the target DataTable.
 * @param targetDt The target DataTable.
 * @param sourceDt The source AbstractDataTable.
 * @param columnIndex The index of the column to be copied.
 * @return The index of the column in the resulting DataTable.
 */
function copyDataTableColumn(
  targetDt: DataTable,
  sourceDt: AbstractDataTable,
  columnIndex: number,
): number {
  const dataType = sourceDt.getColumnType(columnIndex);
  const colId = sourceDt.getColumnId(columnIndex);
  const colLabel = sourceDt.getColumnLabel(columnIndex);
  const colIdx = targetDt.addColumn(dataType, colLabel, colId);
  targetDt.setColumnProperties(
    colIdx,
    sourceDt.getColumnProperties(columnIndex),
  );
  return colIdx;
}

/**
 * Joins 2 DataTables using the given keys and fills in the columns data
 * from both tables. The result table includes nulls in places where there is
 * no match for both tables.
 * Duplicate keys are only allowed in the left DataTable, in which case they
 * will all be aligned with the same row on the right table that has the same
 * key.
 * The result is sorted by the dimensions, by the order given in the
 * dimensions parameter.
 * Column properties are always copied from the left table.
 * Formatted values and cell properties of key columns are copied from the left
 * table for inner and left joins. For right join these are copied from the
 * right table, to avoid inconsistencies. For full joins we avoid copying those
 * at all for the same reason.
 * Formatted values and cell properties of data columns are copied from the
 * source DataTable where the data column was taken from.
 *
 * Example usage:
 * DataTable = datautils.join(dt1, dt2, 'inner', [[0,0], [2,1]], [1], [4,5]);
 *
 * This call will join dt1 and dt2 using columns 0 from dt1 and column 0 from
 * dt2 as the first key and column 2 from dt1 and column 1 from dt2 as the
 * second key. The result table is an inner join that includes the key columns
 * as well as column 1 from dt1 and columns 4,5 from dt2.
 *
 * @param dt1 The first input DataTable.
 * @param dt2 The second input DataTable.
 * @param joinMethod One of 'inner', 'left', 'right', 'full'.
 *     'inner' - include only rows where there is a match.
 *     'left' - include all the rows of the left DataTable.
 *     'right' - include all the rows of the right DataTable.
 *     'full' - include all the rows from both DataTables.
 * @param keysInput An array of keys.
 *     Each element is an array of 2 numbers or strings that represent the key
 *     column indices or ids in the input DataTables.
 * @param dt1ColumnsInput The columns from dt1 to include in the result.
 * @param dt2ColumnsInput The columns from dt2 to include in the result.
 * @return A DataTable that represents the join of the input DataTables.
 */
export function join(
  dt1: AbstractDataTable,
  dt2: AbstractDataTable, //
  joinMethod: string, //
  keysInput: Array<Array<number | string>>, //
  dt1ColumnsInput: Array<number | string>, //
  dt2ColumnsInput: Array<number | string>,
): DataTable {
  // Check all keys and columns and map to indices.
  const keys = keysInput.map((key) => [
    dt1.getColumnIndex(key[0]),
    dt2.getColumnIndex(key[1]),
  ]);
  const dt1Columns: number[] = dt1ColumnsInput.map(
    dt1.getColumnIndex.bind(dt1),
  );
  const dt2Columns: number[] = dt2ColumnsInput.map(
    dt2.getColumnIndex.bind(dt2),
  );

  const includeLeft = joinMethod === 'left' || joinMethod === 'full';
  const includeRight = joinMethod === 'right' || joinMethod === 'full';

  // Add type to the keys.
  const resultDt = new DataTable();

  const types: ColumnType[] = keys.map((key) => {
    const type1 = dt1.getColumnType(key[0]);
    const type2 = dt2.getColumnType(key[1]);

    if (type1 !== type2) {
      throw new Error(`Key types do not match:${type1}, ${type2}`);
    }
    copyDataTableColumn(resultDt, dt1, key[0]);

    return type1;
  });

  // Sort input data-tables by keys.
  const sortColumns1: SortColumnsObject[] = [];
  const sortColumns2: SortColumnsObject[] = [];
  for (const key of keys) {
    sortColumns1.push({'column': key[0]});
    sortColumns2.push({'column': key[1]});
  }
  const sortedIndices1 = dt1.getSortedRows(sortColumns1);
  const sortedIndices2 = dt2.getSortedRows(sortColumns2);

  for (const index of dt1Columns) {
    copyDataTableColumn(resultDt, dt1, index);
  }

  for (const index of dt2Columns) {
    copyDataTableColumn(resultDt, dt2, index);
  }

  // Add the result data table rows.
  let isRightRowEmitted = false;
  let i = 0;
  let j = 0;
  let resultRowIdx = 0;
  while (i < sortedIndices1.length || j < sortedIndices2.length) {
    // Compare the keys.
    let compareKeysResult = 0;
    const rowIdx: number[] = [];
    if (j >= sortedIndices2.length) {
      // We finished going over dt2, continue with dt1 if necessary.
      if (includeLeft) {
        rowIdx[0] = sortedIndices1[i];
        compareKeysResult = -1;
      } else {
        break;
      }
    } else {
      if (i >= sortedIndices1.length) {
        if (includeRight) {
          // We finished going over dt1, continue with dt2 if necessary.
          rowIdx[1] = sortedIndices2[j];
          compareKeysResult = 1;
        } else {
          break;
        }
      } else {
        // Compare dt1 key to dt2 key.
        rowIdx[0] = sortedIndices1[i];
        rowIdx[1] = sortedIndices2[j];
        for (let keyIdx = 0; keyIdx < keys.length; keyIdx++) {
          const key1 = dt1.getValue(rowIdx[0], keys[keyIdx][0]);
          const key2 = dt2.getValue(rowIdx[1], keys[keyIdx][1]);
          compareKeysResult = compareValues(types[keyIdx], key1, key2);
          if (compareKeysResult !== 0) {
            break;
          }
        }
      }
    }

    if (isRightRowEmitted && compareKeysResult !== 0) {
      // The previous iteration was a match, but this one isn't. Advance the
      // right table pointer and continue to the next iteration.
      isRightRowEmitted = false;
      j++;
      continue;
    }

    if (
      (compareKeysResult === -1 && includeLeft) ||
      (compareKeysResult === 1 && includeRight) ||
      compareKeysResult === 0
    ) {
      // Add a row to the result and fill it with data.
      resultDt.addRow();

      // Add the keys.
      let sourceDt: AbstractDataTable;
      let dtIdx: number;
      if (
        (compareKeysResult === -1 && includeLeft) ||
        (compareKeysResult === 0 && joinMethod !== 'right')
      ) {
        sourceDt = dt1;
        dtIdx = 0;
      } else {
        sourceDt = dt2;
        dtIdx = 1;
      }
      let count = 0;
      for (const key of keys) {
        if (joinMethod === 'full') {
          resultDt.setValue(
            resultRowIdx,
            count,
            sourceDt.getValue(rowIdx[dtIdx], key[dtIdx]),
          );
        } else {
          resultDt.setCell(
            resultRowIdx,
            count,
            sourceDt.getValue(rowIdx[dtIdx], key[dtIdx]),
            sourceDt.getFormattedValue(rowIdx[dtIdx], key[dtIdx]),
            sourceDt.getProperties(rowIdx[dtIdx], key[dtIdx]),
          );
        }
        count++;
      }

      // Add data from dt1.
      if (
        (compareKeysResult === -1 && includeLeft) ||
        compareKeysResult === 0
      ) {
        const baseColIdx = keys.length;
        count = 0;
        for (const index of dt1Columns) {
          resultDt.setCell(
            resultRowIdx,
            count + baseColIdx,
            dt1.getValue(rowIdx[0], index),
            dt1.getFormattedValue(rowIdx[0], index),
            dt1.getProperties(rowIdx[0], index),
          );
          count++;
        }
      }

      // Add data from dt2.
      if (
        (compareKeysResult === 1 && includeRight) ||
        compareKeysResult === 0
      ) {
        const baseColIdx = dt1Columns.length + keys.length;
        count = 0;
        for (const index of dt2Columns) {
          resultDt.setCell(
            resultRowIdx,
            count + baseColIdx,
            dt2.getValue(rowIdx[1], index),
            dt2.getFormattedValue(rowIdx[1], index),
            dt2.getProperties(rowIdx[1], index),
          );
          count++;
        }
      }
      resultRowIdx++;
    }

    if (compareKeysResult === 1) {
      j++;
    } else {
      i++;
    }

    if (compareKeysResult === 0) {
      // If this iteration is a match, don't advance on the right table so that
      // duplicates on the left table are not omitted.
      isRightRowEmitted = true;
    }
  }

  return resultDt;
}
