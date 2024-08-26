/**
 * @fileoverview GViz Data utilities, for use by both the DataTable and
 * DataView classes.
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

import {isObject} from '../common/object';

import {DateFormat} from '../format/dateformat';
import {Format} from '../format/format';
import {NumberFormat} from '../format/numberformat';
import {StringFormat} from '../format/stringformat';
import {TimeOfDayFormat} from '../format/timeofdayformat';

import {AbstractDataTable} from './abstract_datatable';
import {FormatInterface} from './abstract_datatable_interface';
import {
  Cell,
  ColumnRange,
  ColumnSpec,
  ColumnType,
  FilterColumns,
  FilterColumnsFunction,
  FilterColumnsObject,
  SortColumns,
  SortColumnsCompareFunction,
  SortColumnsObject,
  Value,
  Values,
} from './types';

// tslint:disable:no-unnecessary-type-assertion Migration
// tslint:disable:no-dict-access-on-struct-type Migration
// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Parses an argument passed for setting a Cell in a
 * AbstractDataTable object. It validates the object and
 * the returned Cell object holds the structure of a valid cell. E.g., 123
 * -> {'v': 123}
 * {'v': true} -> {'v': true}
 * undefined   -> {'v': null}
 *
 * @param cell The cell as given by the user of our methods.
 * @return A valid cell object that can be stored within a
 *     AbstractDataTable row structure (@see
 *     DataTable.dataRows_).
 */
export function parseCell(cell: Value | AnyDuringMigration): Cell {
  const result: Cell = {} as Cell;
  if (goog.typeOf(cell) === 'object' && !goog.isDateLike(cell)) {
    result['v'] = typeof cell['v'] === 'undefined' ? null : cell['v'];

    // Check 'f' property
    if (cell['f'] != null) {
      if (typeof cell['f'] === 'string') {
        result['f'] = cell['f'];
      } else {
        throw new Error(
          "Formatted value ('f'), if specified, must be a string.",
        );
      }
    }

    // Check 'p' property
    if (cell['p'] != null) {
      if (typeof cell['p'] === 'object') {
        result['p'] = cell['p'];
      } else {
        throw new Error("Properties ('p'), if specified, must be an object.");
      }
    }
  } else {
    result['v'] = cell != null ? cell : null;
  }
  // TODO(dlaliberte): I believe undefined or null should be OK.
  // if (typeof result['v'] === 'undefined') {
  //   throw new Error('Value of cell must be defined.');
  // }
  return result;
}

/**
 * Validates the columnFilters argument used by the {@link getFilteredRows}
 * method in DataTable and DataView. Throws an error if there are problems.
 * The columnFilters argument should be an array of objects, each object is
 * expected to have a numeric 'column' property, holding a column index, and at
 * least one of the following:
 * 'value' property holding a value suitable for the column type;
 * 'minValue' property holding the minimum value suitable for the column type:
 * 'maxValue' property holding the maximum value suitable for the column type.
 *
 * Throws an Error if the columnFilters is not valid.
 * @param data The data to check against.
 * @param columnFilters The
 *     columnFilters to check.
 */
export function validateColumnFilters(
  data: AbstractDataTable,
  columnFilters: FilterColumns,
) {
  if (typeof columnFilters === 'function') {
    return;
  }
  if (!Array.isArray(columnFilters) || columnFilters.length === 0) {
    throw new Error('columnFilters must be a non-empty array');
  }

  const indexMap = []; // To make sure there are no duplicates.
  let i = 0;
  for (const columnFilter of columnFilters as FilterColumnsObject[]) {
    if (typeof columnFilter !== 'object' || !('column' in columnFilter)) {
      if (
        !(
          'value' in columnFilter ||
          'minValue' in columnFilter ||
          'maxValue' in columnFilter
        )
      ) {
        throw new Error(
          `columnFilters[${i}]` +
            ' must have properties "column" and one of "value",' +
            ' "minValue" or "maxValue"',
        );
      } else if (
        'value' in columnFilter &&
        ('minValue' in columnFilter || 'maxValue' in columnFilter)
      ) {
        throw new Error(
          `columnFilters[${i}]` +
            ' must specify either "value" or range properties ("minValue"' +
            ' and/or "maxValue"',
        );
      }
    }
    const column = columnFilter['column'];
    validateColumnReference(data, column);
    const colIndex = data.getColumnIndex(column);
    if (indexMap[colIndex]) {
      throw new Error(`Column ${column} is duplicate in columnFilters.`);
    }
    validateTypeMatch(data, colIndex, columnFilter['value']);
    indexMap[colIndex] = true;
    i++;
  }
}

/**
 * Returns true if the row at the specified index matches the filter specified
 * by columnFilters. For description of columnFilters see {@link
 * getFilteredRows}.
 * @param data The data to process.
 *     The column filters.
 * @param rowIndex The index of the row to check.
 * @return True if the row matches the filter, false otherwise.
 */
export function isFilterMatch(
  data: AbstractDataTable,
  columnFilters: FilterColumns,
  rowIndex: number,
): boolean {
  if (typeof columnFilters === 'function') {
    return (columnFilters as FilterColumnsFunction)(data, rowIndex);
  }
  const columnFilterObjects = columnFilters as FilterColumnsObject[];
  for (let i = 0; i < columnFilterObjects.length; i++) {
    const columnFilter = columnFilterObjects[i];
    const columnIndex = data.getColumnIndex(columnFilter['column']);
    const cellValue = data.getValue(rowIndex, columnIndex);
    const columnType = data.getColumnType(columnIndex);
    if ('value' in columnFilter) {
      // Filtering by exact value, overrides range filtering.
      if (0 !== compareValues(columnType, cellValue, columnFilter['value'])) {
        return false;
      }
    } else if (
      columnFilter['minValue'] != null ||
      columnFilter['maxValue'] != null
    ) {
      // Filtering by range, if either minValue or maxValue are provided.
      // null values are excluded.
      if (cellValue == null) {
        return false;
      }

      // Checks the lower bound only if minValue is provided.
      if (
        columnFilter['minValue'] != null &&
        compareValues(columnType, cellValue, columnFilter['minValue']) < 0
      ) {
        return false;
      }

      // Checks the upper bound only if the maxValue is provided.
      if (
        columnFilter['maxValue'] != null &&
        compareValues(columnType, cellValue, columnFilter['maxValue']) > 0
      ) {
        return false;
      }
    }
    const testFunc = columnFilter['test'];
    if (testFunc != null && typeof testFunc === 'function') {
      // Filtering by test function, can be combined with value or range.
      if (!testFunc(cellValue, rowIndex, columnIndex, data)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Returns the row indices for rows that match all of the given filters.
 * The columnFilters argument is an array of objects. Each object must
 * have a numeric 'column' property, holding a column index.  An optional
 * 'value' property specifies a value suitable for the column type, and
 * the row is excluded from the result if the cell value for the column is not
 * the same. The 'value' property can be null to retrieve rows with null values.
 *
 * Two optional properties are available for range filtering, if the 'value'
 * property is undefined: the 'minValue' and 'maxValue' properties hold
 * the minimum and maximum permitted values inclusively.  These values
 * must be suitable for the column type.  A null cell value fails for range
 * filtering. However, a null or undefined value in 'minValue' or 'maxValue'
 * means that the lower or upper bound of the range, respectively,
 * will not be enforced.
 *
 * Another optional property can specify a 'test' function, and it can be
 * combined with value or range filtering.  The 'test' function is called with
 * the datatable, the row and column indices, and the cell value.  It should
 * return false if the row should be excluded from the result.
 *
 * The returned indices are the indices of all the rows, in ascending order,
 * for which the above conditions hold for each of the columnFilters.
 *
 * @param data The data to process.
 *     The column filters.
 * @return The indices of the rows that match the filters.
 */
export function getFilteredRows(
  data: AbstractDataTable,
  columnFilters: FilterColumns,
): number[] {
  // Check columnFilters structure.
  validateColumnFilters(data, columnFilters);
  const filteredIndices = [];
  const numRows = data.getNumberOfRows();
  for (let i = 0; i < numRows; i++) {
    if (isFilterMatch(data, columnFilters, i)) {
      filteredIndices.push(i);
    }
  }
  return filteredIndices;
}

/**
 * Validates the `columns` argument used by the `setColumns` method
 * in DataView. Throws an Error if the given columns are not valid.
 *
 * @param data The data to check against.
 * @param calcFunctionNames A list of predefined
 *     function names that can be used for calculated columns. Pass
 *     `null` if there are no predefined functions.
 * @param columns An array of column specs to check.  Each element is
 *     either a number representing the index of a column in the original
 *     DataTable, or a calculated column.
 */
export function validateColumnSet(
  data: AbstractDataTable,
  calcFunctionNames: string[],
  columns: Array<number | string | ColumnSpec>,
) {
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    if (typeof col === 'number' || typeof col === 'string') {
      validateColumnReference(data, col as number | string);
    } else if (!isObject(col)) {
      throw new Error(
        'Invalid column input, expected either a number, string, ' +
          'or an object.',
      );
    } else {
      // col must be an object.
      const calcSpec = col;
      const sourceColumn = calcSpec.sourceColumn;
      const calc = calcSpec.calc;
      if (typeof calc === 'string') {
        // The column is using a serializable predefined function,
        // so we need to validate it.
        if (
          !calcFunctionNames ||
          (calcFunctionNames && !calcFunctionNames.includes(calc))
        ) {
          throw new Error(`Unknown function "${calc}"`);
        }
        if (sourceColumn != null) {
          validateColumnReference(data, sourceColumn);
        }
      } else if (calc != null) {
        if (!calcSpec.type) {
          throw new Error('Calculated column must have a "type" property.');
        }
      }
    }
  }
}

/**
 * Validates a single sort columns object, i.e., a single object that should
 * contain an integer property 'column' denoting a valid column index, an
 * optional boolean property 'desc', and an optional function property
 * 'compare'.
 * Throws an Error if the object is not valid.
 * @param data The data to check against.
 * @param sortColumnsObject The object to validate.
 * @param title The title of the object, for error messages.
 */
function validateSingleSortColumnsObject(
  data: AbstractDataTable,
  sortColumnsObject: SortColumnsObject,
  title: string,
) {
  if (
    typeof sortColumnsObject !== 'object' ||
    !('column' in sortColumnsObject)
  ) {
    throw new Error(title + ' must be an object with a "column" property.');
  } else if (
    'desc' in sortColumnsObject &&
    typeof sortColumnsObject['desc'] !== 'boolean'
  ) {
    throw new Error('Property "desc" in ' + title + ' must be boolean.');
  } else if (
    sortColumnsObject['compare'] != null &&
    typeof sortColumnsObject['compare'] !== 'function'
  ) {
    throw new Error('Property "compare" in ' + title + ' must be a function.');
  }
  validateColumnReference(data, sortColumnsObject['column']);
}

/**
 * Validates the sortColumns argument used by the {@link getSortedRows} and
 * {@link sort} methods of DataTable and DataView, and returns it in standard
 * form. The standard form is a function that takes two arguments, the indices
 * of the two rows to compare.
 * The legal forms allowed for sortColumns are:
 * - A single number, the column to sort on.
 * - A single object, containing 'column' and (optionally) 'desc' properties.
 * - An array of mixed integers or objects.
 *   An integer specifies the column to sort on, and the order is assumed to be
 *   ascending.  Each object must contain an integer property 'column',
 *   and may have optional boolean property 'desc' (if it is missing, false is
 *   assumed), and an optional 'compare' function.  The 'compare' function, if
 *   provided, is called with each pair of values, and it should return -1, 0,
 *   or 1, the same as the JavaScript Array.sort() function expects.
 *   The 'compare' function won't be given null values, and the 'desc' property
 *   is handled afterwards.
 * - A function, used to compare two rows in the data, given their indexes.
 * Throws an error if the structure is not one of these valid forms.
 * @param data The data to check against.
 * @param getValue Function used by resulting comparison function
 *     that returns value at the cell for a specific column.
 *     The first argument is an element of the array being sorted.
 *     The second argument is the column index.
 * @param sortColumns The
 *     sortColumns to check.
 * @return The comparison function.
 */
export function standardizeSortColumns<T>(
  data: AbstractDataTable,
  getValue: (rowOrIndex: T, colIndex: number) => Value | null,
  sortColumns: SortColumns<T>,
): SortColumnsCompareFunction<T> {
  let sortColumnsObjects: SortColumnsObject[] = [];

  // comparisonFunction: SortColumnsCompareFunction<T>;
  let comparisonFunction = (i1: T, i2: T) => {
    for (let colIndex = 0; colIndex < sortColumnsObjects.length; colIndex++) {
      const sortColumn = sortColumnsObjects[colIndex];
      const col = sortColumn['column'];
      const v1 = getValue(i1, col);
      const v2 = getValue(i2, col);
      let comparison;
      const compareColumnFunc = sortColumn['compare'];
      if (compareColumnFunc != null) {
        // First check for nulls.
        if (v1 === null) {
          comparison = v2 === null ? 0 : -1;
        } else if (v2 === null) {
          comparison = 1;
        } else {
          comparison = compareColumnFunc(v1, v2);
        }
      } else {
        comparison = compareValues(data.getColumnType(col), v1, v2);
      }

      // Found a difference.
      if (comparison !== 0) {
        const order = sortColumn['desc'] ? -1 : 1;
        return comparison * order;
      }
    }
    return 0;
  };

  if (typeof sortColumns === 'function') {
    comparisonFunction = sortColumns as SortColumnsCompareFunction<T>;
  } else if (
    typeof sortColumns === 'number' ||
    typeof sortColumns === 'string'
  ) {
    // Single number or string.
    const sortColumn = sortColumns as number | string;
    validateColumnReference(data, sortColumn);
    const colIndex = data.getColumnIndex(sortColumn);
    sortColumnsObjects = [{'column': colIndex}];
  } else if (isObject(sortColumns)) {
    if (!Array.isArray(sortColumns)) {
      // Single object.
      const sortColumnObject = sortColumns as SortColumnsObject;
      validateSingleSortColumnsObject(data, sortColumnObject, 'sortColumns');
      sortColumnsObjects = [sortColumnObject];
    } else {
      const arrayOfNumbersOrObjects = sortColumns as Array<
        number | SortColumnsObject
      >;

      // Array of objects or numbers.
      if (arrayOfNumbersOrObjects.length === 0) {
        throw new Error(
          'sortColumns is an empty array. Must have at least ' + 'one element.',
        );
      }

      sortColumnsObjects = [];
      const indexMap = []; // To make sure there are no duplicates.
      let colIndex = 0;
      for (let i = 0; i < arrayOfNumbersOrObjects.length; i++) {
        const sortColumn = arrayOfNumbersOrObjects[i];
        if (typeof sortColumn === 'number' || typeof sortColumn === 'string') {
          validateColumnReference(data, sortColumn as number | string);
          colIndex = data.getColumnIndex(sortColumn as number | string);
          sortColumnsObjects.push({'column': colIndex});
        } else if (isObject(sortColumn)) {
          const sortColumnsObject = sortColumn as SortColumnsObject;
          validateSingleSortColumnsObject(
            data,
            sortColumnsObject,
            `sortColumns[${i}]`,
          );
          colIndex = sortColumnsObject['column'];
          colIndex = data.getColumnIndex(colIndex as number | string);
          sortColumnsObject['column'] = colIndex;
          sortColumnsObjects.push(sortColumnsObject);
        } else {
          throw new Error(
            'sortColumns is an array,' +
              ' but not composed of only objects or numbers.',
          );
        }
        if (colIndex in indexMap) {
          throw new Error(
            `Column index ${colIndex} is duplicated in sortColumns.`,
          );
        }
        indexMap[colIndex] = true;
      }
    }
  }

  return comparisonFunction;
}

/**
 * Compares val1 and val2, and returns 1 if val1 is greater, -1 if val2 is
 * greater and 0 if they are equal.
 * val1 and val2 are required to be of the same type, and that type
 * should correspond to the type argument (one of: boolean, number, string,
 * date, datetime, timeofday). All comparison are done based on javascript's
 * < operator, except for timeofday which is done manually.
 * Null values are considered smaller than non-null values, and equal
 * to other null values. Other undefined values are not handled.
 * @param type The type of val1 and val2. One of: boolean, number,
 *     string, date, datetime, timeofday.
 * @param val1 The first value.
 * @param val2 The second value.
 * @return 1 if val1 is "greater", -1 if val2 is "greater" and 0 if
 *     they are equal.
 */
export function compareValues(
  type: string,
  val1: Value | null,
  val2: Value | null,
): number {
  if (val1 == null) {
    return val2 == null ? 0 : -1;
  }
  if (val2 == null) {
    return 1;
  }

  if (type === ColumnType.TIMEOFDAY) {
    const val1ToD = val1 as number[];
    const val2ToD = val2 as number[];
    for (let i = 0; i < 3; i++) {
      if (val1ToD[i] < val2ToD[i]) {
        return -1;
      } else if (val2ToD[i] < val1ToD[i]) {
        return 1;
      }
    }
    const milli1 = val1ToD.length < 4 ? 0 : val1ToD[3];
    const milli2 = val2ToD.length < 4 ? 0 : val2ToD[3];
    return milli1 < milli2 ? -1 : milli2 < milli1 ? 1 : 0;
  } else {
    // Any other type
    return val1 < val2 ? -1 : val2 < val1 ? 1 : 0;
  }
}

/**
 * Returns the sorted order of the row indices, according to the specified
 * sort columns. The structure of sortColumns is defined in the documentation
 * for google.visualization.datautils.standardizeSortColumns.
 * @param data The data to process.
 * @param sortColumns The columns
 *     by which to sort, and the corresponding sort orders.
 *     {@link google.visualization.datautils#standardizeSortColumns}
 *     for more details.
 * @return The indices in the sorted order.
 */
export function getSortedRows(
  data: AbstractDataTable,
  sortColumns: SortColumns<number>,
): number[] {
  const getValue = (rowIndex: number, colIndex: number) => {
    return data.getValue(rowIndex, colIndex);
  };
  const comparisonFunction = standardizeSortColumns<number>(
    data,
    getValue,
    sortColumns,
  );

  // Holds the indices, will be sorted, and returned.
  const indicesArray = [];

  const numRows = data.getNumberOfRows();
  for (let i = 0; i < numRows; i++) {
    indicesArray.push(i);
  }
  stableSort(indicesArray, comparisonFunction);
  return indicesArray;
}

/**
 * Modified from goog.array.stableSort.
 * Comparison function is required.
 */
export function stableSort<T>(arr: T[], compareFn: (a: T, b: T) => number) {
  const compArr = new Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    compArr[i] = {index: i, value: arr[i]};
  }
  const stableCompareFn = (
    obj1: (typeof compArr)[number],
    obj2: (typeof compArr)[number],
  ) => {
    return compareFn(obj1.value, obj2.value) || obj1.index - obj2.index;
  };
  compArr.sort(stableCompareFn);
  for (let i = 0; i < arr.length; i++) {
    arr[i] = compArr[i].value;
  }
}

/**
 * Executes a function once for each cell of a data table.
 *
 * @param data A data table or data view.
 * @param handler A function that takes the column
 *     index and row index as parameters.
 */
export function forEachCell(
  data: AbstractDataTable,
  handler: (p1: number, p2: number) => AnyDuringMigration,
) {
  const rows = data.getNumberOfRows();
  forEachColumn(data, (column) => {
    for (let row = 0; row < rows; row++) {
      handler(row, column);
    }
  });
}

/**
 * Executes a function once for each column of a data table.
 *
 *     A data table or data view.
 * @param handler A function that takes the column index
 *     as a parameter.
 */
export function forEachColumn(
  data: AbstractDataTable,
  handler: (p1: number) => AnyDuringMigration,
) {
  const columns = data.getNumberOfColumns();
  for (let column = 0; column < columns; column++) {
    handler(column);
  }
}

/**
 * Throws an error if the given row index is anything but a valid integer in
 * the proper range.
 * @param data The data to check against.
 * @param rowIndex The row index to check.
 */
export function validateRowIndex(
  data: AbstractDataTable,
  rowIndex: AnyDuringMigration,
) {
  const numRows = data.getNumberOfRows();
  if (numRows > 0) {
    if (
      Math.floor(rowIndex) !== rowIndex ||
      rowIndex < 0 ||
      rowIndex >= numRows
    ) {
      throw new Error(
        `Invalid row index ${rowIndex}. ` +
          `Should be in the range [0-${numRows - 1}].`,
      );
    }
  } else {
    throw new Error('Table has no rows.');
  }
}

/**
 * Throws an error if the given column is anything but a valid reference
 * to a column in the data table or view.  A reference can be either an index
 * number or string for either the id or label.
 * @param data The data to check against.
 * @param columnReference The column reference to check.
 */
export function validateColumnReference(
  data: AbstractDataTable,
  columnReference: number | string,
) {
  if (typeof columnReference === 'number') {
    validateColumnIndex(data, columnReference as number);
  } else {
    if (typeof columnReference !== 'string') {
      throw new Error(
        `Column reference ${columnReference} must be a number or string`,
      );
    }
    validateColumnIdOrLabel(data, columnReference as string);
  }
}

/**
 * Throws an error if the given column is anything but a valid id
 * or label for a column in the data table or view.
 * @param data The data to check against.
 * @param columnId The column reference to check.
 */
export function validateColumnIdOrLabel(
  data: AbstractDataTable,
  columnId: string,
) {
  const columnIndex = data.getColumnIndex(columnId);
  if (columnIndex === -1) {
    throw new Error('Invalid column id "' + columnId + '"');
  }
}

/**
 * Throws an error if the given column index is anything but a valid integer in
 * the proper range.
 * @param data The data to check against.
 * @param columnIndex The column index to check.
 */
export function validateColumnIndex(
  data: AbstractDataTable,
  columnIndex: number,
) {
  const numCols = data.getNumberOfColumns();
  if (numCols > 0) {
    if (
      Math.floor(columnIndex) !== columnIndex ||
      columnIndex < 0 ||
      columnIndex >= numCols
    ) {
      throw new Error(
        `Invalid column index ${columnIndex}. ` +
          ` Should be an integer in the range [0-${numCols - 1}].`,
      );
    }
  } else {
    throw new Error('Table has no columns.');
  }
}

/**
 * Throws an error if value is not of the proper type for the column at the
 * given index. Note that null is always accepted.
 * @param data The data to check against.
 * @param columnIndex The index of the column.
 * @param value The value to check.
 */
export function validateTypeMatch(
  data: AbstractDataTable,
  columnIndex: number,
  value: AnyDuringMigration,
) {
  const columnType = data.getColumnType(columnIndex);
  const res = checkValueType(value, columnType);
  if (!res) {
    throw new Error(
      `Type mismatch. Value ${value} does not match type ${columnType}` +
        ` in column index ${columnIndex}`,
    );
  }
}

/**
 * @param value The value to check.
 * @param columnType The column type.
 * @return True iff the value matches the passed column type.
 */
export function checkValueType(
  value: AnyDuringMigration,
  columnType: string,
): boolean {
  if (value == null) {
    return true;
  }
  const valueType = typeof value;
  switch (columnType) {
    case ColumnType.NUMBER:
      if (valueType === 'number') {
        return true;
      }
      break;
    case ColumnType.STRING:
      if (valueType === 'string') {
        return true;
      }
      break;
    case ColumnType.BOOLEAN:
      if (valueType === 'boolean') {
        return true;
      }
      break;
    case ColumnType.FUNCTION:
      if (valueType === 'function') {
        return true;
      }
      break;
    case ColumnType.DATE:
    case ColumnType.DATETIME:
      if (goog.isDateLike(value)) {
        return true;
      }
      break;
    case ColumnType.TIMEOFDAY:
      if (Array.isArray(value) && value.length > 0 && value.length < 8) {
        let isGood = true;

        // Check that all are integers.
        for (let i = 0; i < value.length; i++) {
          const part = value[i];
          if (typeof part !== 'number' || part !== Math.floor(part)) {
            isGood = false;
            break;
          }
        }
        if (isGood) {
          return true;
        }
      }
      break;
    default:
      break;
  }
  return false;
}

/**
 * Returns the range, i.e., the minimum and maximum values for the column
 * at the given index. The return value is an object with properties
 * min and max. The type of min and max should be the same as the column
 * type. Null values are ignored. If the values in the column are only null
 * values, null is returned for both min and max.
 * @param data The data to process.
 * @param column The column.
 * @return An object with two properties, min and max, containing
 *    the minimum and maximum values in the column, respectively.
 */
export function getColumnRange(
  data: AbstractDataTable,
  column: number | string,
): ColumnRange {
  validateColumnReference(data, column);
  const columnIndex = data.getColumnIndex(column);
  const columnType = data.getColumnType(columnIndex);
  let min = null;
  let max = null;
  let rowIndex;
  const numRows = data.getNumberOfRows();
  for (rowIndex = 0; rowIndex < numRows; rowIndex++) {
    const val = data.getValue(rowIndex, columnIndex);
    if (val != null) {
      min = val;
      max = val;
      break;
    }
  }
  // If min wasn't changed, this means no non-null values were found.
  if (min == null) {
    return {'min': null, 'max': null};
  }

  for (rowIndex++; rowIndex < numRows; rowIndex++) {
    const val = data.getValue(rowIndex, columnIndex);
    if (val != null) {
      if (compareValues(columnType, val, min) < 0) {
        min = val;
      } else if (compareValues(columnType, max, val) < 0) {
        max = val;
      }
    }
  }
  return {min, max};
}

/**
 * Returns the unique values in a certain column, in ascending order.
 * @param data The data to process.
 * @param column The column.
 * @return The sorted unique values.
 */
export function getDistinctValues(
  data: AbstractDataTable,
  column: number | string,
): Values {
  validateColumnReference(data, column);
  const columnIndex = data.getColumnIndex(column);
  const nr = data.getNumberOfRows();
  if (nr === 0) {
    return [];
  }
  const values = [];
  for (let i = 0; i < nr; ++i) {
    values.push(data.getValue(i, columnIndex));
  }
  const columnType = data.getColumnType(columnIndex);
  stableSort(values, (val1, val2) => {
    return compareValues(columnType, val1, val2);
  });
  let prevVal = values[0];
  const result = [];
  result.push(prevVal);
  for (let i = 1; i < values.length; i++) {
    const curVal = values[i];
    if (compareValues(columnType, curVal, prevVal) !== 0) {
      result.push(curVal);
    }
    prevVal = curVal;
  }
  return result;
}

/**
 * Returns the default formatted value of a value.
 * @param value A value.
 * @param type The value type.  Should be type name of Value.
 * @param formatter An optional formatter.
 * @return The default formatted value for the input value.
 */
export function getDefaultFormattedValue(
  value: Value | null,
  type: string,
  formatter?: FormatInterface,
): string | null {
  if (value == null) {
    return '';
  }
  if (formatter) {
    return formatter.formatValue(value);
  }

  let formattedValue;
  // formatter = getDefaultFormatter(type);

  switch (type) {
    case ColumnType.TIMEOFDAY:
      if (!(value instanceof Array)) {
        throw new Error(`Type of value, ${value}, is not timeofday`);
      }

      // TODO(dlaliberte): This is wrong when value has more than 4 elements.
      // Maybe use: gviz.canviz.timeutil.timeOfDayAsDate(value);
      const dateValue = new Date(
        1970,
        0,
        1,
        value[0],
        value[1],
        value[2],
        value[3] || 0,
      );

      let pattern = 'HH:mm';

      // If there are non-zero seconds or milliseconds, show seconds.
      if (value[2] || value[3]) {
        pattern += ':ss';
      }

      // If there are non-zero milliseconds, show them.
      if (value[3]) {
        pattern += '.SSS';
      }
      formatter = new DateFormat({'pattern': pattern});
      formattedValue = formatter.formatValue(dateValue);
      break;
    case ColumnType.DATE:
      formatter = new DateFormat({'formatType': 'medium', 'valueType': 'date'});
      formattedValue = formatter.formatValue(value as Date | null);
      break;
    case ColumnType.DATETIME:
      formatter = new DateFormat({
        'formatType': 'medium',
        'valueType': 'datetime',
      });
      formattedValue = formatter.formatValue(value as Date | null);
      break;
    case ColumnType.NUMBER:
      formatter = new NumberFormat({'pattern': 'decimal'});
      formattedValue = formatter.formatValue(value as number);
      break;
    default:
      // Otherwise, use the javascript default formatting for the given type.
      formattedValue = value != null ? String(value) : '';
  }
  return formattedValue;
}

/**
 * TODO(dlaliberte): Could get the formatter knowing only the data type.
 * Returns the default formatter based on the type.
 * @param type The value type.  Should be type: name of Value.
 * @return Format
 */
export function getDefaultFormatter(type: string): FormatInterface {
  switch (type) {
    case ColumnType.TIMEOFDAY:
      return new TimeOfDayFormat();
    case ColumnType.DATE:
      return new DateFormat();
    case ColumnType.DATETIME:
      return new DateFormat({'formatType': 'medium', 'valueType': 'datetime'});
    case ColumnType.NUMBER:
      return new NumberFormat({'pattern': 'decimal'});
    default:
      return new StringFormat();
  }
}

/**
 * Formats a dataTable column.
 * (Moved from google.visualization.Format to avoid circular dependency)
 * @param dataTable The data table.
 * @param columnIndex The column to format.
 * @param gvizFormat The Format to use.
 */
export function format(
  dataTable: AbstractDataTable, //
  columnIndex: number, //
  gvizFormat?: Format,
) {
  // Create the specific needed formatter according to the value type.
  const columnType = dataTable.getColumnType(columnIndex);

  if (gvizFormat == null) {
    gvizFormat = getDefaultFormatter(columnType);
  } else {
    // Check that gvizFormat can be applied to the column based on its type.
    if (gvizFormat.getValueType(columnType) == null) {
      // TODO(dlaliberte): Decide whether/when we should throw an error.
      // console.warn(`Invalid formatter for column ${columnIndex}`);
      return;
    }
  }
  const valueType = gvizFormat.getValueType(columnType);
  const formatter = gvizFormat.createFormatter(valueType);

  // Format the column.
  const numberOfRows = dataTable.getNumberOfRows();
  for (let r = 0; r < numberOfRows; r++) {
    const value = dataTable.getValue(r, columnIndex);
    const formattedValue = gvizFormat.formatValueWithFormatter(
      formatter,
      value,
    );
    dataTable.setFormattedValue(r, columnIndex, formattedValue);
  }
}

/**
 * Creates a csv string from a data table or data view.
 * Special characters are escaped according to the rules at
 * http://en.wikipedia.org/wiki/Comma-separated_values#Basic_rules_and_examples
 * @param dataTable The data.
 * @return A csv string.
 */
export function dataTableToCsv(dataTable: AbstractDataTable): string {
  let result = '';
  for (let row = 0; row < dataTable.getNumberOfRows(); row++) {
    for (let column = 0; column < dataTable.getNumberOfColumns(); column++) {
      if (column > 0) {
        result += ',';
      }
      let value = dataTable.getFormattedValue(row, column);

      // Escape the value.
      value = value.replace(new RegExp('"', 'g'), '""');
      const hasComma = value.indexOf(',') !== -1;
      const hasNewline = value.indexOf('\n') !== -1;
      const hasQuote = value.indexOf('"') !== -1;
      if (hasComma || hasNewline || hasQuote) {
        value = '"' + value + '"';
      }
      result += value;
    }
    result += '\n';
  }
  return result;
}

/**
 * Returns the first non null value in the column above/below the specified
 * rowIndex. Runs in linear time in the number of rows in the data table.
 *
 * Note: If called from a data view may run in liner time for every distinct
 * rowIndex in the view. However, repeated calls to the same index will be
 * executed in O(1), relying on the data view cache.
 *
 * Note: operates on the dataTable and not on the view.
 *
 * //TODO(dlaliberte): consider creating a reverse mapping from the data to the
 * view and then updating every relevant row in the view when its data row
 * is accessed.
 *
 * @param data The data to process.
 * @param rowIndex The row index.
 * @param columnIndex The column index.
 * @param isAbove True to search above the specified rowIndex, false
 *     below.
 * @return The first non null value in the column above/below the
 *     specified rowIndex. Null if no such value is found.
 */
export function findNonNullValueInColumn(
  data: AbstractDataTable,
  rowIndex: number,
  columnIndex: number,
  isAbove: boolean,
): Value | null {
  let value = null;
  const numberOfRows = data.getNumberOfRows();
  let ind = rowIndex;
  while ((isAbove ? ind >= 0 : ind < numberOfRows) && value === null) {
    value = data.getValue(ind, columnIndex);
    ind += isAbove ? -1 : 1;
  }
  return value;
}

/**
 * Checks whether the dataTable looks like an actual DataTable or DataView.
 * @param dataTable The data table.
 */
export function validateDataTable(dataTable: AbstractDataTable | null) {
  // Validate that the datatable looks like one.
  if (!dataTable) {
    throw new Error('Data table is not defined.');
  }
  if (!(dataTable instanceof AbstractDataTable)) {
    let whatIsIt = 'the wrong type of data';
    if (Array.isArray(dataTable)) {
      whatIsIt = 'an Array';
    } else if (typeof dataTable === 'string') {
      whatIsIt = 'a String';
    }
    throw new Error(
      'You called the draw() method with ' +
        whatIsIt +
        ' rather than a DataTable or DataView',
    );
  }
}
