/**
 * @fileoverview Type definitions for Data* things.
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

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/** A bag of properties */
export type Properties = Record<string, AnyDuringMigration>;

/**
 * Type of a Cell value and other places that values may show up.
 * Note that undefined is not included here, though undefined and null
 * are both allowed values.
 */
export type Value = number | string | boolean | Date | number[];

/**
 * Just an Array of Value or null, for convenience.
 */
export type Values = Array<Value | null>;

/**
 * Cell of a table interface.
 * Like gvizCell.
 */
export declare interface Cell {
  v?: Value | null;
  f?: string | number | null; // Non-null value will be cast to string
  p?: Properties | null | undefined;
}

/**
 * Enum for constants of column types that are returned by getColumnType.
 * @see DataTable.getColumnType
 */
export enum ColumnType {
  BOOLEAN = 'boolean',
  NUMBER = 'number',
  STRING = 'string',
  DATE = 'date',
  DATEQ = 'date?',
  DATETIME = 'datetime',
  TIME = 'time', // Date that only uses hours, minutes, seconds, millis.
  TIMEOFDAY = 'timeofday', // Array of numbers
  FUNCTION = 'function',
}

/**
 * ColumnTypes returned by getColumnType.
 */
export type ColumnTypeUnion =
  | 'boolean'
  | 'number'
  | 'string'
  | 'date'
  | 'date?'
  | 'datetime'
  | 'timeofday'
  | 'function';

/**
 * Function to calculate value given AbstractDataTable and row index.
 */
export type CalcFunc = (
  dt: AnyDuringMigration,
  row: number,
) => Cell | Value | null;

/**
 * Column specification
 */
export declare interface ColumnSpec {
  id?: string; // The unique string for this column.
  index?: number; // The 0-based index of the column in a DataTable or DataView.
  label?: string; // Display name of the column
  type?: ColumnTypeUnion | string; // Should be a ColumnTypeUnion only.
  role?: string; // Should be a RoleTypeUnion.
  pattern?: string | null;
  calc?: string | CalcFunc; // For DataView. string is for predefined functions.
  sourceColumn?: string | number; // For DataView
  p?: Properties | null | undefined;
  properties?: Properties | null | undefined;
  // For predefined functions.
  magnitude?: number;
  errorType?: string;
  mapping?: Properties;
}

/**
 * Each row is an object containing at least:
 * c (cells), which is an array containing objects for each cell,
 * which must contain v (value, of type *),
 * can contain f (optional, formatted value, of type string)
 * and can contain p (optional properties, of type Object).
 *
 * A row can contain also 'p' (properties) which is a
 * map of property key to value.
 */
export declare interface RowOfCells {
  c: Array<Cell | Value | undefined | null>;
  p?: Properties | null | undefined;
}

/**
 * Specification of data table input as an object.
 */
export declare interface TableSpec {
  cols?: ColumnSpec[];
  rows?: RowOfCells[];
  p?: Properties | null | undefined;
}

/**
 * An input row is null or an array of values, cells, or partial column specs.
 */
export type DataTableInputRow =
  | Array<Partial<ColumnSpec> | Value | Cell | undefined | null>
  | RowOfCells;

/**
 * An array of arrays, used as input to arrayToDataTable.
 */
export type DataTableInputRows = Array<DataTableInputRow | null>;

/**
 * A Record is just an object with arbitrary string keys and Values.
 */
export declare interface DataRecord {
  [key: string]: Value | null;
}

/**
 * An array of Records, as used by VegaChart data tables.
 */
export type DataRecords = DataRecord[];

/**
 * Any of the possible types for values in a DataObject[]
 */
export type DataObjectValues =
  | DataTableInputRows
  | DataRecords
  | Values
  | DataObject[];

/**
 * An element of the array of data used as input for the Data class.
 */
export declare interface DataObject {
  name: string;
  values: DataObjectValues;
}

/**
 * Represents specification of how to filter a column.
 */
export declare interface FilterColumnsObject {
  column: number | string;
  value?: AnyDuringMigration;
  minValue?: AnyDuringMigration;
  maxValue?: AnyDuringMigration;
  test?: (
    cellValue: Value | null,
    rowIndex: number,
    columnIndex: number,
    // data must be AbstractDataTable
    data: AnyDuringMigration,
  ) => boolean;
}

/**
 * A function that filters a column of a data table.
 */
export type FilterColumnsFunction =
  // data must be AbstractDataTable
  (data: AnyDuringMigration, columnIndex: number) => AnyDuringMigration;

/** Filter Columns spec */
export type FilterColumns = FilterColumnsObject[] | FilterColumnsFunction;

/**
 * Compares two values of type T.
 */
export type SortColumnsCompareFunction<T> = (value1: T, value2: T) => number;

/**
 * Represents a sort column specification.
 */
export declare interface SortColumnsObject {
  column: number;
  desc?: boolean;
  compare?: (value1: Value, value2: Value) => number;
}

/** Sort Columns spec */
export type SortColumns<T> =
  | number
  | SortColumnsObject
  | Array<number | SortColumnsObject>
  | SortColumnsCompareFunction<T>;

/**
 * Allowed modifier functions.
 * Should be restricted to (values: Value) => Value
 */
export type Modifier = (value: AnyDuringMigration) => AnyDuringMigration;

/**
 * Type of column spec for keys arg of group method.
 */
export declare interface GroupKeyColumnSpec {
  column: number | string;
  modifier: Modifier;
  type: string;
  label?: string;
  id?: string;
}

/**
 * Allowed aggregation functions.
 * Should be restricted to (values: Values) => Value
 */
export type Aggregation = (values: AnyDuringMigration[]) => AnyDuringMigration;

/**
 * Type of column spec for columns arg of group method.
 */
export declare interface GroupAggregationColumnSpec {
  column: number | string;
  aggregation: Aggregation;
  type: string;
  label?: string;
  id?: string;
}

/**
 * Range of values of a data column.
 * Note that using interface doesn't work since JSC complains with, e.g.:
 *    dataTable.getColumnRange(2)['min']
 *      "Cannot do '[]' access on a struct"
 * Also, using Value | null for max and min doesn't work yet since
 * several clients assume the min and max values are numbers and
 * a few assume they are Date objects, and there is no way to tell whether
 * the values are numbers, Dates, or null.  Also, we need to allow indexed
 * access to the 'min' and 'max' properties, until all are fixed.
 */
export // tslint:disable-next-line:interface-over-type-literal See jsdoc.
declare type ColumnRange = {
  min: AnyDuringMigration;
  max: AnyDuringMigration;
};
