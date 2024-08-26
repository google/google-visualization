/**
 * @fileoverview A generic container for any data that may be needed charts.
 * Specifically supports Vega data.  Maybe this should be VegaData.
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

import * as gvizObject from '../common/object';

import {AbstractDataTable} from './abstract_datatable';
import {FormatInterface} from './abstract_datatable_interface';
import {
  arrayToDataTable,
  DataTable,
  recordsToDataTable,
  valuesToDataTable,
} from './datatable';
import {
  Cell,
  ColumnRange,
  ColumnType,
  DataObject,
  DataObjectValues,
  DataRecords,
  DataTableInputRows,
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
 * Any type of data that can be used by GViz charts.
 */
export type AnyData = DataObject[] | AbstractDataTable;

/**
 * A data class.
 */
export class Data extends AbstractDataTable {
  data?: DataObject[];

  // Extracted from the data and converted to an AbstractDataTable
  primaryDataTable: AbstractDataTable;

  /**
   * If a primaryDataPath is specified, a DataTable will be constructed
   * using the data found by that path.
   */
  constructor(data?: AnyData, primaryDataPath?: string) {
    super();

    if (data instanceof AbstractDataTable) {
      this.primaryDataTable = data;
      return;
    }
    if (data == null) {
      this.primaryDataTable = new DataTable();
      return;
    }
    // data must be a DataObject[]
    this.data = data;
    this.primaryDataTable = this.buildPrimaryDataTable(primaryDataPath);
  }

  setPrimaryDataTable(primaryDataPath?: string) {
    this.primaryDataTable = this.buildPrimaryDataTable(primaryDataPath);
  }

  buildPrimaryDataTable(primaryDataPath?: string): DataTable {
    if (primaryDataPath) {
      const primaryData = this.getDataAtPath(primaryDataPath);
      if (Array.isArray(primaryData)) {
        const firstElement = primaryData[0];
        if (Array.isArray(firstElement)) {
          // TODO(dlaliberte): Avoid casting here and below. TS should
          // infer the correct type based on guards.
          return arrayToDataTable(primaryData as DataTableInputRows);
        } else if (typeof firstElement === 'object') {
          return recordsToDataTable(primaryData as DataRecords);
        } else {
          // firstElement must be some other typeof Value
          // Ambiguous case: timeofday values are arrays.
          // Need a wrapper object for Duration.
          return valuesToDataTable(primaryData as Values);
        }
      }
    }
    return new DataTable();
  }

  getData(): DataObject[] | undefined {
    return this.data;
  }

  getDataAtPath(path?: string): DataObjectValues | undefined {
    if (!path) {
      return this.data;
    }
    return gvizObject.getObjectByName(path, this.data);
  }

  getPrimaryDataTable(): AbstractDataTable {
    return this.primaryDataTable;
  }

  /**
   * Returns the unique values in a certain column, in ascending order.
   * See {@link google.visualization.datautils.getDistinctValues}.
   * @param column The index of the column for which the values are
   *     requested.
   * @return The sorted unique values.
   */
  getDistinctValues(column: number): Values {
    return this.primaryDataTable.getDistinctValues(column);
  }

  /**
   * Returns the number of rows in primary DataTable.
   */
  getNumberOfRows(): number {
    return this.primaryDataTable.getNumberOfRows();
  }

  /**
   * Returns the number of columns in the query result.
   * @return The number of columns in the query result.
   */
  getNumberOfColumns(): number {
    return this.primaryDataTable.getNumberOfColumns();
  }

  /**
   * Returns the specifications of current columns.
   */
  getColumns(): AnyDuringMigration[] {
    return this.primaryDataTable.getColumns();
  }

  /**
   * Returns the identifier of a given column index.
   * @param columnIndex The index of the requested column.
   * @return The identifier of the column at the given index.
   */
  getColumnId(columnIndex: number): string {
    return this.primaryDataTable.getColumnId(columnIndex);
  }

  /**
   * Returns the label of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The label of the column at the given index.
   */
  getColumnLabel(columnIndex: number): string {
    return this.primaryDataTable.getColumnLabel(columnIndex);
  }

  /**
   * Returns the formatting pattern of the column with the given index. Returns
   * null if no formatting pattern is used for this column.
   * @param columnIndex The index of the requested column.
   * @return The formatting pattern of the column at the given index, or
   *     null if no formatting pattern is used.
   */
  getColumnPattern(columnIndex: number): string | null {
    return this.primaryDataTable.getColumnPattern(columnIndex);
  }

  /**
   * Returns the role of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The role of the column at the given index, or '' if the
   *     column has no role.
   */
  getColumnRole(columnIndex: number): string {
    return this.primaryDataTable.getColumnRole(columnIndex);
  }

  /**
   * Returns the column type of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The external column type of the
   *     column at the given index.
   */
  getColumnType(columnIndex: number): ColumnType {
    return this.primaryDataTable.getColumnType(columnIndex);
  }

  /**
   * Returns the internal value of a cell.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.
   */
  getValue(rowIndex: number, columnIndex: number): Value | null {
    return this.primaryDataTable.getValue(rowIndex, columnIndex);
  }

  /**
   * Returns the gviz cell corresponding to the row and column index.
   * @param rowIndex The inner index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The gviz cell.
   */
  getCell(rowIndex: number, columnIndex: number): Cell {
    return this.primaryDataTable.getCell(rowIndex, columnIndex);
  }

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
  ): string {
    return this.primaryDataTable.getFormattedValue(rowIndex, columnIndex);
  }

  /**
   * Sets the formatted value in a given cell.
   * Ignored for DataView, for now.  But getFormattedValue sets the same field.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param formattedValue The new formatted value.
   */
  setFormattedValue(
    rowIndex: number,
    columnIndex: number,
    formattedValue: string | null,
  ) {
    this.primaryDataTable.setFormattedValue(
      rowIndex,
      columnIndex,
      formattedValue,
    );
  }

  /**
   * Formats a data column.
   * If we can create a formatted value via getFormattedValue, why not
   * also via this format function?
   * @param columnIndex The column to format.
   * @param gvizFormat The Format to use.  Should probably be internal.
   */
  format(columnIndex: number, gvizFormat: FormatInterface) {
    this.primaryDataTable.format(columnIndex, gvizFormat);
  }

  /**
   * Returns the range, i.e., the minimum and maximum values for the column
   * at the given index. See {@link datautils.getColumnRange}
   * for details.
   * @param columnIndex The index of the column.
   * @return An object with two properties, min and max, containing
   *    the minimum and maximum values in the column, respectively.
   */
  getColumnRange(columnIndex: number): ColumnRange {
    return this.primaryDataTable.getColumnRange(columnIndex);
  }

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
  ): AnyDuringMigration {
    return this.primaryDataTable.getProperty(rowIndex, columnIndex, property);
  }

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
  ) {
    this.primaryDataTable.setProperty(rowIndex, columnIndex, property, value);
  }

  /**
   * Returns the properties for the specified cell.
   *
   * Note: the reference returned is either the one stored in the dataTable or
   * in the dataView cache and will persist changes you make.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @return The properties of the cell.
   */
  getProperties(rowIndex: number, columnIndex: number): AnyDuringMigration {
    return this.primaryDataTable.getProperties(rowIndex, columnIndex);
  }

  /**
   * Returns the value of the specified table property,
   * or null if no such property was set on the table.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getTableProperty(property: string): AnyDuringMigration {
    return this.primaryDataTable.getTableProperty(property);
  }

  /**
   * Returns the properties map (Object) of the table. This object can
   * then be used to read/add/change properties directly.
   * @return The properties map.
   */
  getTableProperties(): AnyDuringMigration {
    return this.primaryDataTable.getTableProperties();
  }

  /**
   * Returns the value of the specified property for the specified row,
   * or null if no such property was set on the row.
   * @param rowIndex The row index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getRowProperty(rowIndex: number, property: string): AnyDuringMigration {
    return this.primaryDataTable.getRowProperty(rowIndex, property);
  }

  /**
   * Returns the properties map (Object) of the specified row.
   * This object can then be used to read/add/change properties directly.
   * @param rowIndex The column index.
   * @return The properties map.
   */
  getRowProperties(rowIndex: number): AnyDuringMigration {
    return this.primaryDataTable.getRowProperties(rowIndex);
  }

  /**
   * Returns the value of the specified property for the specified column,
   * or null if no such property was set on the column.
   * @param columnIndex The column index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getColumnProperty(columnIndex: number, property: string): AnyDuringMigration {
    return this.primaryDataTable.getColumnProperty(columnIndex, property);
  }

  /**
   * Returns the properties map (Object) of the specified column. This object
   * can then be used to read/add/change properties directly.
   * @param columnIndex The column index.
   * @return The properties map.
   */
  getColumnProperties(columnIndex: number): AnyDuringMigration {
    return this.primaryDataTable.getColumnProperties(columnIndex);
  }

  /**
   * Returns the sorted order of the row indices, according to the specified
   * sort columns. See {@link datautils.getSortedRows}
   * for more details.
   *     The columns by which to sort, and the corresponding sort orders.
   *     see {@link datautils#standardizeSortColumns}
   *     for more details.
   * @return The indices in the sorted order.
   */
  getSortedRows(sortColumns: SortColumns<number>): number[] {
    return this.primaryDataTable.getSortedRows(sortColumns);
  }

  /**
   * Returns the row indices for rows that match all of the given filters.
   * See {@link datautils.getFilteredRows} for more details.
   *  The column filters.
   * @return The indices of the rows that match the filters.
   */
  getFilteredRows(columnFilters: FilterColumns): number[] {
    return this.primaryDataTable.getFilteredRows(columnFilters);
  }

  /**
   * Returns the row index in the data .
   * @param rowIndex A row index in the view.
   * @return The row index in the data table.
   */
  getTableRowIndex(rowIndex: number): number {
    return this.primaryDataTable.getTableRowIndex(rowIndex);
  }

  /**
   * Returns the column index.
   * @param columnIndex A column index in the data table.
   * @return The column index.
   */
  getUnderlyingTableColumnIndex(columnIndex: number): number {
    return this.primaryDataTable.getUnderlyingTableColumnIndex(columnIndex);
  }

  /**
   * Returns the row index.
   * @param rowIndex A row index in the data table.
   * @return The row index.
   */
  getUnderlyingTableRowIndex(rowIndex: number): number {
    return this.primaryDataTable.getUnderlyingTableRowIndex(rowIndex);
  }

  /**
   * Returns this as a DataTable.
   *
   * @return Always a DataTable, not a DataView
   */
  toDataTable(): AbstractDataTable {
    return this.primaryDataTable.toDataTable();
  }

  // The following need some work, not just here, but in DataTable and DataView
  // to decide whether the POJO and JSON representation should be for the
  // entire structure, or just the primary data table.

  /**
   * @return A pojo representation of the data table.
   * Maybe need: gvizObject.clone(this.data)
   */
  toPOJO(): TableSpec {
    return this.primaryDataTable.toPOJO();
  }

  /**
   * @return A JSON representation of the data table.
   * Maybe need JSON.stringify(this.data).
   */
  toJSON(): string {
    return this.primaryDataTable.toJSON();
  }
}
