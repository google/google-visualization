/**
 * @fileoverview AbstractDataTableInterface and FormatInterface.
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

import {
  Cell,
  ColumnRange,
  ColumnType,
  FilterColumns,
  SortColumns,
  TableSpec,
  Value,
  Values,
} from './types';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/** Map from column id to colum index. */
export declare interface ColumnRefMap {
  [key: string]: number;
}

/**
 * Interface for DataTables and DataViews (virtual DataTables).
 */
export interface AbstractDataTableInterface {
  columnRefMap: ColumnRefMap | null;

  /**
   * Invalidates the column id map.
   */
  invalidateColumnRefMap(): void;

  /**
   * Rebuilds the column id map.
   */
  rebuildColumnRefMap(): void;

  /**
   * Returns the index of a column with a given index or identifier.
   * @param column The identifier of the requested column.
   * @return The index of the requested column. Returns -1 if no
   *     column has the requested Id, or if the column index is invalid.
   */
  getColumnIndex(column: number | string): number;

  /**
   * Returns the internal value of a cell as long as the column's type is
   * 'string'. Throws an exception otherwise.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.
   */
  getStringValue(rowIndex: number, columnIndex: number): string | null;

  /**
   * Returns the internal value of a cell as long as the column's type is
   * 'date' or 'datetime'. Throws an exception otherwise.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.
   */
  getDateValue(rowIndex: number, columnIndex: number): Date | null;

  /**
   * Returns the unique values in a certain column, in ascending order.
   * See {@link google.visualization.datautils.getDistinctValues}.
   * @param column The index of the column for which the values are
   *     requested.
   * @return The sorted unique values.
   */
  getDistinctValues(column: number | string): Values;

  /**
   * Returns the number of rows in the query result.
   * @return The number of rows in the query result.
   */
  getNumberOfRows(): number;

  /**
   * Returns the number of columns in the query result.
   * @return The number of columns in the query result.
   */
  getNumberOfColumns(): number;

  /**
   * Returns a copy of the specifications of current columns.
   */
  getColumns(): AnyDuringMigration[];

  /**
   * Returns the identifier of a given column index.
   * @param columnIndex The index of the requested column.
   * @return The identifier of the column at the given index.
   */
  getColumnId(columnIndex: number): string;

  /**
   * Returns the label of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The label of the column at the given index.
   */
  getColumnLabel(columnIndex: number): string;

  /**
   * Returns the formatting pattern of the column with the given index. Returns
   * null if no formatting pattern is used for this column.
   * @param columnIndex The index of the requested column.
   * @return The formatting pattern of the column at the given index, or
   *     null if no formatting pattern is used.
   */
  getColumnPattern(columnIndex: number): string | null;

  /**
   * Returns the role of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The role of the column at the given index, or '' if the
   *     column has no role.
   */
  getColumnRole(columnIndex: number): string;

  /**
   * Returns the column type of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The external column type of the
   *     column at the given index.
   */
  getColumnType(columnIndex: number): ColumnType;

  /**
   * Returns the internal value of a cell.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.
   */
  getValue(rowIndex: number, columnIndex: number): Value | null;

  /**
   * Returns the gviz cell corresponding to the row and column index.
   * @param rowIndex The inner index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The gviz cell.
   */
  getCell(rowIndex: number, columnIndex: number): Cell;

  /**
   * Returns the formatted value of the cell.
   * If one was not provided by the user,
   * it will calculate a value and store it in the cache.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @param formatter An optional formatter.
   * @return The cell's internal value.
   */
  getFormattedValue(
    rowIndex: number,
    columnIndex: number,
    formatter?: FormatInterface,
  ): string;

  /**
   * Sets the formatted value in a given cell.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param formattedValue The new formatted value.
   */
  setFormattedValue(
    rowIndex: number,
    columnIndex: number,
    formattedValue: string | null,
  ): void;

  /**
   * Formats a data column.
   * (Moved from google.visualization.Format to avoid circular dependency)
   * @param columnIndex The column to format.
   * @param gvizFormat The Format to use.  Should probably be internal.
   */
  format(columnIndex: number, gvizFormat?: FormatInterface): void;

  /**
   * Returns the range, i.e., the minimum and maximum values for the column
   * at the given index. See {@link datautils.getColumnRange}
   * for details.
   * @param columnIndex The index of the column.
   * @return An object with two properties, min and max, containing
   *    the minimum and maximum values in the column, respectively.
   */
  getColumnRange(columnIndex: number): ColumnRange;

  /**
   * Returns the value of the specified property for the specified cell,
   * or null if no such property was set on the cell.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getProperty(
    rowIndex: number,
    columnIndex: number,
    property: string,
  ): AnyDuringMigration;

  /**
   * Sets a specific property of the table cell.
   * This replaces any previous value for that property.
   * Defined here to allow Format subclasses to call it, though for DataView
   * this call will be ignored, for now.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param property The name of the property to set.
   * @param value The new value for the property.
   */
  setProperty(
    rowIndex: number,
    columnIndex: number,
    property: string,
    value: AnyDuringMigration,
  ): void;

  /**
   * Returns the properties for the specified cell.
   *
   * Note: the reference returned is either the one stored in the dataTable or
   * in the dataView cache and will persist changes you make.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @return The properties of the cell.
   */
  getProperties(rowIndex: number, columnIndex: number): AnyDuringMigration;

  /**
   * Returns the value of the specified table property,
   * or null if no such property was set on the table.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getTableProperty(property: string): AnyDuringMigration;

  /**
   * Returns the properties map (Object) of the table. This object can
   * then be used to read/add/change properties directly.
   * @return The properties map.
   */
  getTableProperties(): AnyDuringMigration;

  /**
   * Returns the value of the specified property for the specified row,
   * or null if no such property was set on the row.
   * @param rowIndex The row index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getRowProperty(rowIndex: number, property: string): AnyDuringMigration;

  /**
   * Returns the properties map (Object) of the specified row.
   * This object can then be used to read/add/change properties directly.
   * @param rowIndex The column index.
   * @return The properties map.
   */
  getRowProperties(rowIndex: number): AnyDuringMigration;

  /**
   * Returns the value of the specified property for the specified column,
   * or null if no such property was set on the column.
   * @param columnIndex The column index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getColumnProperty(columnIndex: number, property: string): AnyDuringMigration;

  /**
   * Returns the properties map (Object) of the specified column. This object
   * can then be used to read/add/change properties directly.
   * @param columnIndex The column index.
   * @return The properties map.
   */
  getColumnProperties(columnIndex: number): AnyDuringMigration;

  /**
   * Returns the sorted order of the row indices, according to the specified
   * sort columns. See {@link datautils.getSortedRows}
   * for more details.
   *     The columns by which to sort, and the corresponding sort orders.
   *     see {@link datautils#standardizeSortColumns}
   *     for more details.
   * @return The indices in the sorted order.
   */
  getSortedRows(sortColumns: SortColumns<number>): number[];

  /**
   * Returns the row indices for rows that match all of the given filters.
   * See {@link datautils.getFilteredRows} for more details.
   *  The column filters.
   * @return The indices of the rows that match the filters.
   */
  getFilteredRows(columnFilters: FilterColumns): number[];

  /**
   * Returns the row index in the data .
   * @param rowIndex A row index in the view.
   * @return The row index in the data table.
   */
  getTableRowIndex(rowIndex: number): number;

  /**
   * Returns the column index.
   * @param columnIndex A column index in the data table.
   * @return The column index.
   */
  getUnderlyingTableColumnIndex(columnIndex: number): number;

  /**
   * Returns the row index.
   * @param rowIndex A row index in the data table.
   * @return The row index.
   */
  getUnderlyingTableRowIndex(rowIndex: number): number;

  /**
   * Returns this as a DataTable.
   *
   * @return A DataTable, not a DataView
   */
  toDataTable(): AbstractDataTableInterface;

  /**
   * @return A representation of the data that can be passed as input to
   *     the constructor.
   */
  toPOJO(): TableSpec;

  /**
   * Returns a JSON representation of the data.
   * @return A JSON representation of the data.
   */
  toJSON(): string;
}

// tslint:disable:ban-types Migration

/**
 * An object with a format function that maps values to strings.
 */
export interface Formatter {
  format: (value: Value | null, option?: AnyDuringMigration) => string | null;
}

/**
 * A formatter for values.
 */
export interface FormatInterface {
  /**
   * Formats a single value.
   * @param value The value to format.  Should be type Value
   * @return The formatted string value.   Might actually be null.
   */
  formatValue(value: AnyDuringMigration): string;

  /**
   * Formats a single value.
   * @param value The value to format.
   * @return The formatted value.
   */
  formatValueInternal(value: Value | null): string | null;

  /**
   * Formats a dataTable column.  // 306897611
   * (Moved from google.visualization.Format to avoid circular dependency)
   * @param dataTable The data table.
   * @param columnIndex The column to format.
   * @param gvizFormat The Format to use.  Should probably be internal.
   */
  format(
    dataTable: AbstractDataTableInterface,
    columnIndex: number,
    gvizFormat?: FormatInterface,
  ): void;

  /**
   * Returns columnType if it is a valid type for the formatter, else null.
   */
  getValueType(columnType: ColumnType | null): ColumnType | null;

  /**
   * Creates an internal formatter that will be used for formatting values.
   * The formatter may depend on the column type
   * @param valueType The value type.
   * @return A formatter.
   */
  createFormatter(valueType: ColumnType): Formatter;

  /**
   * Formats a single value internally, given a formatter.
   * @param formatter The formatter to use.
   * @param value The date to format.
   * @return The formatted value.
   */
  formatValueWithFormatter(
    formatter: Formatter,
    value: Value | null,
  ): string | null;
}
