/**
 * @fileoverview Interface definitions for Data* things.
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

import {Format} from '../format/format';

import {
  AbstractDataTableInterface,
  ColumnRefMap,
  FormatInterface,
} from './abstract_datatable_interface';
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

/**
 * Abstract class for DataTables and DataViews (virtual DataTables).
 *
 */
export abstract class AbstractDataTable implements AbstractDataTableInterface {
  /**
   * A cached map from column ids or labels to column indexes.
   */
  columnRefMap: ColumnRefMap | null = {};

  constructor() {
    this.invalidateColumnRefMap();
  }

  /**
   * Invalidates the column id map.
   */
  invalidateColumnRefMap() {
    this.columnRefMap = null;
  }

  /**
   * Rebuilds the column id map.
   */
  rebuildColumnRefMap() {
    this.columnRefMap = {};
    const numColumns = this.getNumberOfColumns();

    // Add the ids.
    for (let i = 0; i < numColumns; i++) {
      const columnId = this.getColumnId(i);
      if (
        columnId != null &&
        columnId !== '' &&
        !(columnId in this.columnRefMap)
      ) {
        this.columnRefMap[columnId] = i;
      }
    }

    // Add the labels.
    for (let i = 0; i < numColumns; i++) {
      const columnLabel = this.getColumnLabel(i);
      if (
        columnLabel != null &&
        columnLabel !== '' &&
        !(columnLabel in this.columnRefMap)
      ) {
        this.columnRefMap[columnLabel] = i;
      }
    }
  }

  /**
   * Returns the index of a column with a given index or identifier.
   * @param column The identifier of the requested column.
   * @return The index of the requested column. Returns -1 if no
   *     column has the requested Id, or if the column index is invalid.
   */
  getColumnIndex(column: number | string): number {
    if (typeof column === 'number') {
      const numColumns = this.getNumberOfColumns();
      if (column < 0 || column >= numColumns) {
        return -1;
      }
      return column;
    }

    // column must be a string.
    if (!this.columnRefMap) {
      this.rebuildColumnRefMap();
    }
    const columnIndex = (this.columnRefMap as ColumnRefMap)[column];
    if (columnIndex == null) {
      return -1;
    }

    // Found
    return columnIndex;
  }

  /**
   * Returns the internal value of a cell as long as the column's type is
   * 'string'. Throws an exception otherwise.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.
   */
  getStringValue(rowIndex: number, columnIndex: number): string | null {
    const columnType = this.getColumnType(columnIndex);
    if (columnType !== ColumnType.STRING) {
      throw new Error(
        `Column ${columnIndex} must be of type string,` +
          ` but is ${columnType}.`,
      );
    }
    return this.getValue(rowIndex, columnIndex) as string | null;
  }

  /**
   * Returns the internal value of a cell as long as the column's type is
   * 'date' or 'datetime'. Throws an exception otherwise.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.
   */
  getDateValue(rowIndex: number, columnIndex: number): Date | null {
    const columnType = this.getColumnType(columnIndex);
    if (columnType !== ColumnType.DATE && columnType !== ColumnType.DATETIME) {
      throw new Error(
        `Column ${columnIndex} must be of type date or datetime,` +
          ` but is ${columnType}.`,
      );
    }
    return this.getValue(rowIndex, columnIndex) as Date | null;
  }

  /**
   * Returns the unique values in a certain column, in ascending order.
   * See {@link google.visualization.datautils.getDistinctValues}.
   * @param column The index of the column for which the values are
   *     requested.
   * @return The sorted unique values.
   */
  abstract getDistinctValues(column: number | string): Values;

  /**
   * Returns the number of rows in the query result.
   * @return The number of rows in the query result.
   */
  abstract getNumberOfRows(): number;

  /**
   * Returns the number of columns in the query result.
   * @return The number of columns in the query result.
   */
  abstract getNumberOfColumns(): number;

  /**
   * Returns a copy of the specifications of current columns.
   */
  abstract getColumns(): AnyDuringMigration[];

  /**
   * Returns the identifier of a given column index.
   * @param columnIndex The index of the requested column.
   * @return The identifier of the column at the given index.
   */
  abstract getColumnId(columnIndex: number): string;

  /**
   * Returns the label of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The label of the column at the given index.
   */
  abstract getColumnLabel(columnIndex: number): string;

  /**
   * Returns the formatting pattern of the column with the given index. Returns
   * null if no formatting pattern is used for this column.
   * @param columnIndex The index of the requested column.
   * @return The formatting pattern of the column at the given index, or
   *     null if no formatting pattern is used.
   */
  abstract getColumnPattern(columnIndex: number): string | null;

  /**
   * Returns the role of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The role of the column at the given index, or '' if the
   *     column has no role.
   */
  abstract getColumnRole(columnIndex: number): string;

  /**
   * Returns the column type of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The external column type of the
   *     column at the given index.
   */
  abstract getColumnType(columnIndex: number): ColumnType;

  /**
   * Returns the internal value of a cell.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.
   */
  abstract getValue(rowIndex: number, columnIndex: number): Value | null;

  /**
   * Returns the gviz cell corresponding to the row and column index.
   * @param rowIndex The inner index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The gviz cell.
   */
  abstract getCell(rowIndex: number, columnIndex: number): Cell;

  /**
   * Returns the formatted value of the cell.
   * If one was not provided by the user,
   * it will calculate a value and store it in the cache.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @param formatter An optional formatter.
   * @return The cell's internal value.
   */
  abstract getFormattedValue(
    rowIndex: number,
    columnIndex: number,
    formatter?: Format,
  ): string;

  /**
   * Sets the formatted value in a given cell.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param formattedValue The new formatted value.
   */
  abstract setFormattedValue(
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
  abstract format(columnIndex: number, gvizFormat?: FormatInterface): void;

  /**
   * Returns the range, i.e., the minimum and maximum values for the column
   * at the given index. See {@link datautils.getColumnRange}
   * for details.
   * @param columnIndex The index of the column.
   * @return An object with two properties, min and max, containing
   *    the minimum and maximum values in the column, respectively.
   */
  abstract getColumnRange(columnIndex: number): ColumnRange;

  /**
   * Returns the value of the specified property for the specified cell,
   * or null if no such property was set on the cell.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  abstract getProperty(
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
  abstract setProperty(
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
  abstract getProperties(
    rowIndex: number,
    columnIndex: number,
  ): AnyDuringMigration;

  /**
   * Returns the value of the specified table property,
   * or null if no such property was set on the table.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  abstract getTableProperty(property: string): AnyDuringMigration;

  /**
   * Returns the properties map (Object) of the table. This object can
   * then be used to read/add/change properties directly.
   * @return The properties map.
   */
  abstract getTableProperties(): AnyDuringMigration;

  /**
   * Returns the value of the specified property for the specified row,
   * or null if no such property was set on the row.
   * @param rowIndex The row index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  abstract getRowProperty(
    rowIndex: number,
    property: string,
  ): AnyDuringMigration;

  /**
   * Returns the properties map (Object) of the specified row.
   * This object can then be used to read/add/change properties directly.
   * @param rowIndex The column index.
   * @return The properties map.
   */
  abstract getRowProperties(rowIndex: number): AnyDuringMigration;

  /**
   * Returns the value of the specified property for the specified column,
   * or null if no such property was set on the column.
   * @param columnIndex The column index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  abstract getColumnProperty(
    columnIndex: number,
    property: string,
  ): AnyDuringMigration;

  /**
   * Returns the properties map (Object) of the specified column. This object
   * can then be used to read/add/change properties directly.
   * @param columnIndex The column index.
   * @return The properties map.
   */
  abstract getColumnProperties(columnIndex: number): AnyDuringMigration;

  /**
   * Returns the sorted order of the row indices, according to the specified
   * sort columns. See {@link datautils.getSortedRows}
   * for more details.
   *     The columns by which to sort, and the corresponding sort orders.
   *     see {@link datautils#standardizeSortColumns}
   *     for more details.
   * @return The indices in the sorted order.
   */
  abstract getSortedRows(sortColumns: SortColumns<number>): number[];

  /**
   * Returns the row indices for rows that match all of the given filters.
   * See {@link datautils.getFilteredRows} for more details.
   *  The column filters.
   * @return The indices of the rows that match the filters.
   */
  abstract getFilteredRows(columnFilters: FilterColumns): number[];

  /**
   * Returns the row index in the data .
   * @param rowIndex A row index in the view.
   * @return The row index in the data table.
   */
  abstract getTableRowIndex(rowIndex: number): number;

  /**
   * Returns the column index.
   * @param columnIndex A column index in the data table.
   * @return The column index.
   */
  abstract getUnderlyingTableColumnIndex(columnIndex: number): number;

  /**
   * Returns the row index.
   * @param rowIndex A row index in the data table.
   * @return The row index.
   */
  abstract getUnderlyingTableRowIndex(rowIndex: number): number;

  /**
   * Returns this as a DataTable.
   *
   * @return A DataTable, not a DataView
   */
  abstract toDataTable(): AbstractDataTable;

  /**
   * @return A representation of the data that can be passed as input to
   *     the constructor.
   */
  abstract toPOJO(): TableSpec;

  /**
   * Returns a JSON representation of the data.
   * @return A JSON representation of the data.
   */
  abstract toJSON(): string;
}
