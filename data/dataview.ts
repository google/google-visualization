/**
 * @fileoverview GViz DataView API.
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

import {deserialize, serialize} from '../common/json';
import {unsafeClone} from '../common/object';
import {Format} from '../format/format';

import {AbstractDataTable} from './abstract_datatable';
import {DataTable} from './datatable';
import * as datautils from './datautils';
import * as predefined from './predefined';
import {
  Cell,
  ColumnRange,
  ColumnSpec,
  ColumnType,
  FilterColumns,
  SortColumns,
  TableSpec,
  Value,
} from './types';

// tslint:disable:no-unnecessary-type-assertion Migration
// tslint:disable:no-dict-access-on-struct-type Migration
// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A DataView class, used for rearranging data-table columns. For example,
 * you can rearrange the order of columns, hide columns, etc.
 * Initialized by default to include all of the underlying
 * DataTable's columns.
 */
export class DataView extends AbstractDataTable {
  /**
   * Holds the array of indices to columns of the dataTable or specification
   * of calculated columns.   Should be array of ColumnSpec.
   */
  private columns: Array<number | string | AnyDuringMigration> = [];

  /**
   * This is true as long as the row part of this view was not changed. As long
   * as this is true (the default), we do not indirect row indices through the
   * rowIndices array, but rather go directly to the underlying dataTable. When
   * the user calls setRows() or hideRows() this turns to false and from that
   * point on, we always use indirection.
   */
  private isAllRows = true;

  /**
   * Holds the indices in the datatable for the rows of this view. The order of
   * the indices is the order by which the rows should be viewed. This is null
   * as long as isAllRows is true.
   */
  private rowIndices: number[] | null = null;

  /**
   * A cache for calculated columns. Each value is calculated once on demand
   * and from then on returned from the cache until it is invalidated. The
   * cache holds an array of gviz cells for each calculated column, or
   * undefined.
   */
  private readonly calcColumnsCache: Array<Array<Cell | undefined>> = [];

  /**
   * A dirty flag for the cache.
   */
  private cacheIsDirty = true;

  /**
   * @param dataTable The data table to which we apply this view.
   */
  constructor(private readonly dataTable: AbstractDataTable) {
    super();

    // By default, initialize the view with all the columns.
    const colIndices = [];
    const numCols = dataTable.getNumberOfColumns();
    for (let c = 0; c < numCols; c++) {
      colIndices.push(c);
    }
    this.columns = colIndices;

    // By default, initialize the view with all the rows.
  }

  /**
   * Return the data table to which this view is applied.
   *
   */
  getDataTable(): AbstractDataTable {
    return this.dataTable;
  }

  /**
   * Normalizes and clones the column objects. Currently, it converts column ids
   * into indices, puts the 'role' in 'properties', renamed to 'p', and sets
   * the defaults for 'calc' and 'type' if applicable.
   * The source data table/view.
   * @param columns The data view columns specification.
   * @return !Array<(number | ColumnSpec}) The normalized columns.
   */
  private normalizeColumns(
    data: AbstractDataTable,
    columns: AnyDuringMigration[],
  ): Array<number | ColumnSpec> {
    return columns.map((column) => {
      if (typeof column === 'string') {
        column = this.getColumnIndex(column);
      } else if (isObject(column)) {
        column = unsafeClone(column);
        // Rename 'properties' to 'p'.
        const properties = column['properties'] || {};
        delete column['properties'];
        column['p'] = properties;

        // Move 'role' to properties.
        const role = column['role'];
        if (role) {
          properties['role'] = role;
        }

        let sourceColumn = column['sourceColumn'];
        if (typeof sourceColumn === 'string') {
          sourceColumn = column['sourceColumn'] =
            this.getColumnIndex(sourceColumn);
        }
        if (typeof sourceColumn === 'number') {
          datautils.validateColumnIndex(data, sourceColumn);
          column['calc'] = column['calc'] || 'identity';
          column['type'] = column['type'] || data.getColumnType(sourceColumn);
        }
      }
      return column;
    });
  }

  /**
   * Resets the calculated columns cache.
   */
  private resetCalcColumnsCache() {
    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];
      if (isObject(col)) {
        this.calcColumnsCache[i] = [];
      }
    }
    this.cacheIsDirty = false;
  }

  /**
   * Invalidates the calculated columns cache.
   */
  private invalidateCalcColumnsCache() {
    this.cacheIsDirty = true;
    this.invalidateColumnRefMap();
  }

  /**
   * Initializes the rowIndices variable to contain the indices of the
   * underlying table/view, while changing isAllRows to false.
   */
  private initRowIndices() {
    const rowIndices = [];
    const numRows = this.dataTable.getNumberOfRows();
    for (let r = 0; r < numRows; r++) {
      rowIndices.push(r);
    }
    this.rowIndices = rowIndices;
    this.invalidateCalcColumnsCache();
  }

  /**
   * Sets which columns of the data table should appear in this view and in
   * what order. Note that this can be used to duplicate columns.
   * @param columns An array of columns
   *     to show in the view. Each element is either a number representing the
   *     index of a column in the original DataTable, or a calculated column
   *     which is an object with the following properties:
   *     NOTE: The calculated column specification itself is passed to
   *     the predefined function. Some predefined functions require additional
   *     parameters, which must be passed by setting them in the
   *     calculated column object.
   *
   *     calc {Function|string} - A function that accepts a DataTable and a row
   *         number as arguments and outputs a calculated value, or the key of
   *         a serializable/predefined function in DataView.FUNCTIONS.
   *         If sourceColumn is defined, this defaults to 'identity'. Otherwise,
   *         it is required.
   *
   *     type {string} - The return type of calc, see
   *         gviz.dataTable.COLUMN_TYPES. If sourceColumn is defined, this
   *         defaults to the type of the source column. Otherwise, it is
   *         required.
   *
   *     label {string} - The label of the calculated column. Optional.
   *
   *     id {string} - The id of the calculated column. Optional.
   *
   *     sourceColumn {number|string} - The index or id of the column in the
   *         underlying data table containing the source value. Only applies if
   *         the calculated column is using a serializable/predefined function.
   *
   *     properties {Object} A properties map (in other words, any JavaScript
   *         object). @see DataTable#setColumnProperties().
   *
   *     role {string} The role of the column.
   */
  setColumns(columns: Array<number | string | AnyDuringMigration>) {
    datautils.validateColumnSet(
      this.dataTable,
      Object.keys(DataView.FUNCTIONS),
      columns,
    );
    this.columns = this.normalizeColumns(this.dataTable, columns);
    this.invalidateCalcColumnsCache();
  }

  /**
   * Returns a copy of the DataView columns, via getViewColumns.
   * TODO(dlaliberte): Should they be normalized, only ColumnSpec?
   */
  getColumns(): Array<number | string | AnyDuringMigration> {
    return this.getViewColumns();
  }

  /**
   * Standardize the two different syntaxes of row indices. The two possible
   * syntaxes are: one parameter which is an array of numbers (order matters,
   * duplicates are allowed), or two parameters which are min and max that
   * represent a single continuous range (sorted, no duplicates are allowed.
   * This function also validates the row indices.
   * @param arg0 The row indices to show in this view,
   *     by the order that we want to view them, or the minimum index in a range
   *     of indices to show.
   * @param arg1 The maximum index in a range of indices to show.
   * @return The standardized row indices array.
   */
  private standardizeRowIndices(
    arg0: number[] | number,
    arg1?: number,
  ): number[] {
    if (Array.isArray(arg0)) {
      if (arg1 !== undefined) {
        throw new Error(
          'If the first parameter is an array, no second ' +
            'parameter is expected',
        );
      }
      for (let i = 0; i < (arg0 as number[]).length; i++) {
        datautils.validateRowIndex(this.dataTable, (arg0 as number[])[i]);
      }
      return Array.from(arg0);
    } else if (typeof arg0 === 'number') {
      if (typeof arg1 !== 'number') {
        throw new Error(
          'If first parameter is a number, second parameter must be ' +
            'specified and be a number.',
        );
      }
      if ((arg0 as number) > (arg1 as number)) {
        throw new Error(
          'The first parameter (min) must be smaller than or equal ' +
            'to the second parameter (max).',
        );
      }
      datautils.validateRowIndex(this.dataTable, arg0);
      datautils.validateRowIndex(this.dataTable, arg1);
      const result = [];
      for (let i = arg0 as number; i <= (arg1 as number); i++) {
        result.push(i);
      }
      return result;
    } else {
      throw new Error('First parameter must be a number or an array.');
    }
  }

  /**
   * Sets which rows of the data table should appear in this view and in
   * what order. Note that this can be used to duplicate rows.
   * @param arg0 See {@link
   *     DataView.standardizeRowIndices}.
   * @param arg1 See
   *    {@link DataView.standardizeRowIndices}.
   */
  setRows(arg0: number[] | number, arg1?: number) {
    this.rowIndices = this.standardizeRowIndices(arg0, arg1);
    this.isAllRows = false;
    this.invalidateCalcColumnsCache();
  }

  /**
   * Returns the columns of the data table that appear in this view, in the
   * order that this view defines. Note that what's returned is a copy of the
   * stored data, so that you cannot change the returned value and hence affect
   * the view.  Calc functions will left as is.
   * @return The columns in this view.
   */
  getViewColumns(): Array<number | AnyDuringMigration> {
    return unsafeClone(this.columns);
  }

  /**
   * Returns the rows of the data table that appear in this view, in the order
   * that this view defines. Note that what's returned is a copy of the stored
   * data, so that you cannot change the returned value and hence affect the
   * view.
   * @return The row indices in this view.
   */
  getViewRows(): number[] {
    if (this.isAllRows) {
      const result = [];
      const numRows = this.dataTable.getNumberOfRows();
      for (let i = 0; i < numRows; i++) {
        result.push(i);
      }
      return result;
    }
    return Array.from(this.rowIndices || []);
  }

  /**
   * Removes certain columns from the current view.
   * @param colIndices The column indices to hide from this view.
   *     The specified indices refer to the datatable's indices rather than to
   * the view's. If an index is not present in the view for any reason, it is
   *     ignored.
   */
  hideColumns(colIndices: number[]) {
    this.setColumns(
      this.columns.filter((e) => {
        return !colIndices.includes(e);
      }),
    );
    this.invalidateCalcColumnsCache();
  }

  /**
   * Removes certain rows from the current view.
   * @param arg0 See {@link
   *     DataView.standardizeRowIndices}.
   *    See {@link DataView.standardizeRowIndices}.
   */
  hideRows(arg0: number[] | number, arg1?: number) {
    const rowIndices = this.standardizeRowIndices(arg0, arg1);
    if (this.isAllRows) {
      this.initRowIndices();
      this.isAllRows = false;
    }
    this.setRows(
      (this.rowIndices || []).filter((e) => {
        return !rowIndices.includes(e);
      }),
    );
    this.invalidateCalcColumnsCache();
  }

  /**
   * Returns the column index in the view for the given column index in the
   * underlying data table. If multiple indices in the view match, returns the
   * first one. If none match, returns -1.
   * Note that this method is "shallow", like getTableColumnIndex(). It only
   * introspects the source AbstractDataTable, even if the source
   * AbstractDataTable is itself a DataView.
   * @param tableColumnIndex A column index in the data table.
   * @return The column index in the view or -1 if this view does not
   *     contain tableColumnIndex.
   */
  getViewColumnIndex(tableColumnIndex: number): number {
    // TODO(dlaliberte): Replace this loop with a cached reverse index lookup.
    for (let i = 0; i < this.columns.length; i++) {
      const column = this.columns[i];
      if (column === tableColumnIndex) {
        return i;
      }
      if (isObject(column)) {
        const columnSpec = column as ColumnSpec;
        if (columnSpec.sourceColumn === tableColumnIndex) {
          return i;
        }
      }
    }
    return -1;
  }

  /**
   * Returns the row index in the view for the given row index in the
   * underlying data table. If multiple indices in the view match, returns the
   * first one. If none match, returns -1.
   * @param tableRowIndex A row index in the data table.
   * @return The row index in the view or -1 if this view does not
   *     contain tableRowIndex.
   */
  getViewRowIndex(tableRowIndex: number): number {
    if (this.isAllRows) {
      if (
        tableRowIndex < 0 ||
        tableRowIndex >= this.dataTable.getNumberOfRows()
      ) {
        return -1;
      }
      return tableRowIndex;
    }

    // TODO(dlaliberte): Replace this linear search with a cached reverse
    // index lookup.
    return (this.rowIndices || []).indexOf(tableRowIndex);
  }

  /**
   * Returns the column index in the data table for the given column index in
   * the view, or -1 if this is a calculated column.
   * @param viewColumnIndex A column index in the view.
   * @return The column index in the data table, or -1 if this is a
   * calculated column.
   */
  getTableColumnIndex(viewColumnIndex: number): number {
    datautils.validateColumnIndex(this, viewColumnIndex);
    const col = this.columns[viewColumnIndex];
    if (typeof col === 'number') {
      return col;
    } else if (isObject(col)) {
      const columnSpec = col as ColumnSpec;
      if (typeof columnSpec.sourceColumn === 'number') {
        return columnSpec.sourceColumn;
      }
    }
    return -1;
  }

  /**
   * Returns the column index in the original DataTable this
   * view is ultimately built upon for the given column index in the view, or
   * -1 if this column is the result of a calculation at any step in the
   * resolution chain.
   * TODO(dlaliberte): Decide whether this is obsolete.
   * @param viewColumnIndex A column index in the view.
   * @return The column index in the original
   *     DataTable this view is ultimately built upon, or -1
   *     if this column is the result of a calculation at any step in the
   *     resolution chain.
   */
  getUnderlyingTableColumnIndex(viewColumnIndex: number): number {
    let columnIndex = this.getTableColumnIndex(viewColumnIndex);
    if (columnIndex === -1) {
      return columnIndex;
    }
    columnIndex = this.dataTable.getUnderlyingTableColumnIndex(columnIndex);
    return columnIndex;
  }

  /**
   * Returns the row index in the data table for the given row index in the
   * view.
   * @param viewRowIndex A row index in the view.
   * @return The row index in the data table.
   */
  getTableRowIndex(viewRowIndex: number): number {
    datautils.validateRowIndex(this, viewRowIndex);
    return this.isAllRows
      ? viewRowIndex
      : (this.rowIndices as number[])[viewRowIndex];
  }

  /**
   * Returns the row index in the original DataTable this
   * view is ultimately built upon for the given row index in the view.
   *
   * Multiple DataViews will be traversed if nesting exists, until the original
   * DataTable is found.
   *
   * @param viewRowIndex A row index in the view.
   * @return The row index in the DataTable this
   *     view is ultimately built upon.
   */
  getUnderlyingTableRowIndex(viewRowIndex: number): number {
    let rowIndex = this.getTableRowIndex(viewRowIndex);
    rowIndex = this.dataTable.getUnderlyingTableRowIndex(rowIndex);
    return rowIndex;
  }

  /**
   * Returns the number of rows in the view.
   * @return The number of rows in the view.
   */
  getNumberOfRows(): number {
    return this.isAllRows
      ? this.dataTable.getNumberOfRows()
      : (this.rowIndices as number[]).length;
  }

  /**
   * Returns the number of columns in the view.
   * @return The number of columns in the view.
   */
  getNumberOfColumns(): number {
    return this.columns.length;
  }

  /**
   * Returns the identifier of a given column index.
   * @param columnIndex The index of the requested column.
   * @return The identifier of the column at the given index.
   */
  getColumnId(columnIndex: number): string {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    if (typeof col === 'number') {
      return this.dataTable.getColumnId(col);
    } else {
      // It must be a calculated column.
      return col['id'] || '';
    }
  }

  /**
   * Returns the label of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The label of the column at the given index.
   */
  getColumnLabel(columnIndex: number): string {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    if (typeof col === 'number') {
      return this.dataTable.getColumnLabel(col);
    } else {
      return col['label'] || '';
    }
  }

  /**
   * Returns the formatting pattern of the column with the given index. Returns
   * null if no formatting pattern is used for this column.
   * @param columnIndex The index of the requested column.
   * @return The formatting pattern of the column at the given index, or
   *     null if no formatting pattern is used.
   */
  getColumnPattern(columnIndex: number): string | null {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    if (typeof col === 'number') {
      return this.dataTable.getColumnPattern(col);
    } else {
      return null;
    }
  }

  /**
   * Returns the role of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The role of the column at the given index, or '' if the
   *     column has no role.
   */
  getColumnRole(columnIndex: number): string {
    let role = this.getColumnProperty(columnIndex, 'role');
    role = typeof role === 'string' ? role : '';
    return role;
  }

  /**
   * Returns the column type of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The external column type of the
   *     column at the given index.
   */
  getColumnType(columnIndex: number): ColumnType {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    if (typeof col === 'number') {
      return this.dataTable.getColumnType(col);
    } else {
      return col['type'];
    }
  }

  /**
   * Set all the values in the cache for a calculated column using the
   * fillFromBottom or fillFromTop Function. Does nothing for other columns.
   * @param columnIndex The index of the requested column.
   */
  insertValuesInColumnForFillColumnFunction(columnIndex: number) {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    if (typeof col !== 'number') {
      const calc = col['calc'];
      if (calc === 'fillFromTop' || calc === 'fillFromBottom') {
        const inversedRows = [];
        for (let i = 0; i < this.getNumberOfRows(); i++) {
          inversedRows[this.getTableRowIndex(i)] = i;
        }
        const desc = calc === 'fillFromTop';
        const data = this.dataTable;
        const numRows = data.getNumberOfRows();
        const first = desc ? 0 : numRows - 1;
        const last = desc ? numRows : -1;
        const inc = desc ? 1 : -1;

        // Do not use null since this value may be set directly in the cache.
        let valueToFill = undefined;
        const cells = [];
        for (let r = first; r !== last; r += inc) {
          const rowCell = data.getCell(r, columnIndex);
          valueToFill = rowCell['v'] != null ? rowCell : valueToFill;
          if (inversedRows[r] !== undefined) {
            cells[r] = valueToFill;
          }
        }

        // Reset the cache if necessary. The cache can now be used until the
        // view is changed, e.g., by calling setRows.
        if (this.cacheIsDirty) {
          this.resetCalcColumnsCache();
        }
        this.calcColumnsCache[columnIndex] = cells;
      }
    }
  }

  /**
   * Returns the cell from the cache if it exists in the cache. If not
   * calculates the cell, puts it in the cache and returns it.
   * @param innerRowIndex The inner index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The gviz cell.
   */
  // tslint:disable-next-line:enforce-name-casing Migration of publicly used
  // private names
  private calcCell(innerRowIndex: number, columnIndex: number): Cell {
    if (this.cacheIsDirty) {
      this.resetCalcColumnsCache();
    }
    const cachedCell = this.calcColumnsCache[columnIndex][innerRowIndex];
    if (cachedCell !== undefined) {
      return cachedCell as Cell;
    } else {
      let retCell = null;
      const col = this.columns[columnIndex];
      const calc = col['calc'];
      if (typeof calc === 'string') {
        // The column is using a serializable function.
        const calcFunc = DataView.FUNCTIONS[calc as string];
        if (typeof col !== 'object') {
          throw new Error(`Object expected for column ${col}`);
        }
        retCell = calcFunc(this.dataTable, innerRowIndex, col);
      } else if (typeof calc === 'function') {
        retCell = calc.call(null, this.dataTable, innerRowIndex);
      }

      // @see google.visualization.datautils.parseCell.
      retCell = datautils.parseCell(retCell);
      this.validateCellType(retCell, col['type']);
      this.calcColumnsCache[columnIndex][innerRowIndex] = retCell;
      return retCell;
    }
  }

  /**
   * Validates the type of the cell value according to the passed columnType.
   * @param cell The data cell.
   * @param columnType The column type.
   */
  // tslint:disable-next-line:enforce-name-casing Migration of public name.
  private validateCellType(cell: Cell, columnType: string) {
    const value = cell['v'];
    const columnTypeStr = columnType == null ? '' : String(columnType);
    if (columnTypeStr === '') {
      throw new Error('"type" must be specified');
    }
    if (!datautils.checkValueType(value, columnType)) {
      throw new Error(
        `Type mismatch. Value ${value} does not match type ${columnType}.`,
      );
    }
  }

  /**
   * Returns the gviz cell corresponding to the row and column index. In
   * case this is a calculated cell uses the cache otherwise fetches the cell
   * from the underlying AbstractDataTable.
   * Note: Validates the column index.
   * @param rowIndex The inner index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The gviz cell.
   */
  getCell(rowIndex: number, columnIndex: number): Cell {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    let cell = null;
    const innerRowIndex = this.getTableRowIndex(rowIndex);

    // Also validates.
    if (isObject(col)) {
      cell = this.calcCell(innerRowIndex, columnIndex);

      // In case properties is not returned from calcCell, set an empty object.
      cell.p = isObject(cell.p) ? cell.p : {};
    } else if (typeof col === 'number') {
      // Create the cell via the underlying data getters.
      cell = {v: this.dataTable.getValue(innerRowIndex, col)};
    } else {
      throw new Error(`Invalid column definition: ${cell}.`);
    }
    return cell;
  }

  /**
   * Returns the value of a cell.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's value.  Maybe undefined.
   */
  getValue(rowIndex: number, columnIndex: number): Value | null {
    return this.getCell(rowIndex, columnIndex)['v'] as Value;
  }

  /**
   * Returns the formatted value of a cell.
   * As a side effect, it stores this formatted value for later use.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @param formatter An optional formatter.
   * @return The cell's formatted value.
   */
  getFormattedValue(
    rowIndex: number,
    columnIndex: number,
    formatter?: Format,
  ): string {
    const cell = this.getCell(rowIndex, columnIndex);
    if (cell['f'] == null) {
      const col = this.columns[columnIndex];
      if (isObject(col)) {
        // Formatted value was not defined by the computed column - generate a
        // default formatted value.
        const type = this.getColumnType(columnIndex);
        cell['f'] =
          cell['v'] == null
            ? ''
            : datautils.getDefaultFormattedValue(cell['v'], type, formatter);
      } else if (typeof col === 'number') {
        // Simple column - get formatted value from underlying data table.
        const innerRowIndex = this.getTableRowIndex(rowIndex);
        cell['f'] = this.dataTable.getFormattedValue(
          innerRowIndex,
          col,
          formatter,
        );
      }
    }
    const formattedValue = cell['f'];
    return formattedValue == null ? '' : formattedValue.toString();
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
  ) {}

  /**
   * Formats a data column.
   * If we can create a formatted value via getFormattedValue, why not
   * also via this format function?
   * @param columnIndex The column to format.
   * @param gvizFormat The Format to use.  Should probably be internal.
   */
  format(columnIndex: number, gvizFormat: Format) {
    datautils.format(this, columnIndex, gvizFormat);
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
    const res = this.getProperties(rowIndex, columnIndex)[property];
    return res !== undefined ? res : null;
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
  getProperties(
    rowIndex: number,
    columnIndex: number,
  ): AnyDuringMigration | null {
    const cell = this.getCell(rowIndex, columnIndex);
    if (!cell['p']) {
      const innerRowIndex = this.getTableRowIndex(rowIndex);

      // Fails in the next line if there is no underlying column index.
      const innerColIndex = this.getTableColumnIndex(columnIndex);
      return this.dataTable.getProperties(innerRowIndex, innerColIndex);
    }
    return cell['p'];
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
    return;
  }

  /**
   * Returns the value of the specified property for the specified column,
   * or null if no such property was set on the column.
   * @param columnIndex The column index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getColumnProperty(columnIndex: number, property: string): AnyDuringMigration {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    if (typeof col === 'number') {
      return this.dataTable.getColumnProperty(col, property);
    } else {
      return this.getColumnProperties(columnIndex)[property] || null;
    }
  }

  /**
   * Returns the properties map (Object) of the specified column. This object
   * can then be used to read/add/change properties directly.
   * @param columnIndex The column index.
   * @return The properties map.
   */
  getColumnProperties(columnIndex: number): AnyDuringMigration {
    datautils.validateColumnIndex(this, columnIndex);
    const col = this.columns[columnIndex];
    if (typeof col === 'number') {
      return this.dataTable.getColumnProperties(col);
    } else {
      return col['p'] || {};
    }
  }

  /**
   * Returns the value of the specified property for the table,
   * or null if no such property was set on the table.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getTableProperty(property: string): AnyDuringMigration {
    return this.dataTable.getTableProperty(property);
  }

  /**
   * Returns the properties map (Object) of the table. This object can
   * then be used to read/add/change properties directly.
   * @return The properties map.
   */
  getTableProperties(): AnyDuringMigration | null {
    return this.dataTable.getTableProperties();
  }

  /**
   * Returns the value of the specified property for the specified row,
   * or null if no such property was set on the row.
   * @param rowIndex The row index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was
   *     set.
   */
  getRowProperty(rowIndex: number, property: string): AnyDuringMigration {
    const innerRowIndex = this.getTableRowIndex(rowIndex);

    // Also validates.
    return this.dataTable.getRowProperty(innerRowIndex, property);
  }

  /**
   * Returns the properties map (Object) of the specified row. This object can
   * then be used to read/add/change properties directly.
   * @param rowIndex The row index.
   * @return The properties map.
   */
  getRowProperties(rowIndex: number): AnyDuringMigration {
    datautils.validateRowIndex(this, rowIndex);
    const innerRowIndex = this.getTableRowIndex(rowIndex);

    // Also validates.
    return this.dataTable.getRowProperties(innerRowIndex);
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
    return datautils.getColumnRange(this, columnIndex);
  }

  /**
   * Returns the unique values in a certain column, in ascending order.
   * See {@link datautils.getDistinctValues}.
   * @param columnIndex The index of the column for which the values are
   *     requested.
   * @return The sorted unique values.
   */
  getDistinctValues(columnIndex: number): Array<Value | null> {
    return datautils.getDistinctValues(this, columnIndex);
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
    return datautils.getSortedRows(this, sortColumns);
  }

  /**
   * Returns the row indices for rows that match all of the given filters.
   * See {@link datautils.getFilteredRows} for more details.
   *  The column filters.
   * @return The indices of the rows that match the filters.
   */
  getFilteredRows(columnFilters: FilterColumns): number[] {
    return datautils.getFilteredRows(this, columnFilters);
  }

  /**
   * Returns a DataTable representing the data view.
   *
   * @return A data table.
   */
  toDataTable(): DataTable {
    // First ensure that we're working with a DataTable and not a DataView.
    let dataTable = this.dataTable;
    if (typeof dataTable.toDataTable === 'function') {
      dataTable = dataTable.toDataTable();
    }

    // Get the raw JS object representation of the data table
    // then remove/reorder columns/rows based on this view.
    // The table/row/column properties are copied when the table/row/column
    // is copied to the new data table object.
    const result: TableSpec = dataTable.toPOJO();
    const numberOfColumns = this.getNumberOfColumns();
    const numberOfRows = this.getNumberOfRows();
    let toColumnIndex;
    let toRowIndex;
    let viewColumn;
    const columns: ColumnSpec[] = [];
    const rows = [];
    for (toColumnIndex = 0; toColumnIndex < numberOfColumns; toColumnIndex++) {
      viewColumn = this.columns[toColumnIndex];
      let columnSpecification: ColumnSpec;
      if (isObject(viewColumn)) {
        // This is a calculated column. It has the same structure as the
        // DataTable's column specification except for the 'calc' and
        // 'sourceColumn' keys.
        columnSpecification = {...viewColumn} as ColumnSpec;
        delete columnSpecification['calc'];
        delete columnSpecification['sourceColumn'];
      } else if (typeof viewColumn === 'number') {
        const resultCols = result['cols'] || [];
        columnSpecification = resultCols[viewColumn];
      } else {
        throw new Error('Invalid DataView column type.');
      }
      columns.push(columnSpecification);
    }
    if (!this.isAllRows && this.rowIndices == null) {
      throw new Error('Unexpected state of rowIndices');
    }
    const resultRows = result['rows'] || [];
    for (toRowIndex = 0; toRowIndex < numberOfRows; toRowIndex++) {
      const fromRowIndex = this.isAllRows
        ? toRowIndex
        : (this.rowIndices as number[])[toRowIndex];
      const row = resultRows[fromRowIndex];
      const cells = [];
      for (
        toColumnIndex = 0;
        toColumnIndex < numberOfColumns;
        toColumnIndex++
      ) {
        viewColumn = this.columns[toColumnIndex];
        let cell;
        if (isObject(viewColumn)) {
          // This is a calculated column, so the value must be calculated here.
          // Calculated columns have only values, no formatted values or
          // properties.
          cell = {'v': this.getValue(toRowIndex, toColumnIndex)};
        } else if (typeof viewColumn === 'number') {
          cell = row['c'][viewColumn];
        } else {
          throw new Error('Invalid DataView column type.');
        }
        cells.push(cell);
      }
      row['c'] = cells;
      rows.push(row);
    }
    result['cols'] = columns;
    result['rows'] = rows;
    return new DataTable(result);
  }

  /**
   * Returns a clone of the DataView's data, not including the data table
   * and calculated columns.
   * @return A representation of the view.
   */
  toPOJO(): AnyDuringMigration {
    const ret: AnyDuringMigration = {};
    const cols = [];
    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];

      // Don't include calculated columns,
      // unless they are using serializable functions.
      if (!isObject(col) || typeof (col as ColumnSpec).calc === 'string') {
        cols.push(col);
      }
    }
    if (cols.length !== 0) {
      ret['columns'] = cols;
    }
    if (!this.isAllRows) {
      ret['rows'] = Array.from(this.rowIndices || []);
    }
    return ret;
  }

  /**
   * Returns a JSON representation of the data view, not including the data
   * table and calculated columns.
   * @return A JSON representation of the view.
   */
  toJSON(): string {
    return serialize(this.toPOJO());
  }

  /**
   * Takes a data table and a json representation of a view that was created
   * using DataView.toJson() and returns a view over the data table.
   *     A DataTable or DataView.
   * @param viewAsJson A json representation of the view that was
   *     created using DataView.toJson().
   * @return A view over the data table.
   */
  static fromJSON(
    data: AbstractDataTable,
    viewAsJson: string | AnyDuringMigration,
  ): DataView {
    if (typeof viewAsJson === 'string') {
      viewAsJson = deserialize(viewAsJson);
    }
    const view = new DataView(data);
    const columns = viewAsJson['columns'];
    const rows = viewAsJson['rows'];
    if (columns != null) {
      view.setColumns(columns);
    }
    if (rows != null) {
      view.setRows(rows);
    }
    return view;
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
   * TODO(dlaliberte): Export the functions in predefined and remove this
   * map?
   */
  static FUNCTIONS: {
    [key: string]: AnyDuringMigration;
  } = {
    'emptyString': predefined.emptyString,
    'error': predefined.error,
    'mapFromSource': predefined.mapFromSource,
    'stringify': predefined.stringify,
    'fillFromTop': predefined.fillFromTop,
    'fillFromBottom': predefined.fillFromBottom,
    'identity': predefined.identity,
  };
}
