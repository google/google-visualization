/**
 * @fileoverview GViz DataTable API.
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

import {
  deserialize,
  clone as jsonClone,
  serialize,
  stringify,
} from '../common/json';
import {unsafeClone} from '../common/object';
import {ResponseVersion} from '../query/response_version';

import {AbstractDataTable} from './abstract_datatable';
import {FormatInterface} from './abstract_datatable_interface';
import * as datautils from './datautils';
import {
  Cell,
  ColumnRange,
  ColumnSpec,
  ColumnType,
  ColumnTypeUnion,
  DataRecords,
  DataTableInputRow,
  DataTableInputRows,
  FilterColumns,
  Properties,
  RowOfCells,
  SortColumns,
  TableSpec,
  Value,
  Values,
} from './types';

// tslint:disable:no-unnecessary-type-assertion Migration
// tslint:disable:no-dict-access-on-struct-type Migration
// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

interface DataTableCellCache {
  formattedValue?: string | undefined;
}

/**
 * A data table class.
 * This client is compliant to response version 0.6 and 0.5.
 */
export class DataTable extends AbstractDataTable {
  /**
   * Holds the user specification of all columns.
   */
  private readonly dataCols: ColumnSpec[] = [];

  /**
   * Holds the rows of the table as specfied by user.
   */
  private readonly dataRows: RowOfCells[] = [];

  /**
   * Table properties.
   */
  private tableProperties: Record<string, {} | null | undefined | void> | null =
    null;

  /**
   * Holds the cache for the table.
   * Each row holds an array of cache object, one per each cell.
   * Supported fields:
   * - formattedValue: Caches the default formatted value of the cell.
   */
  private cache: DataTableCellCache[][] = [];

  /**
   * The maximal number of rows that should be inserted at once. This constant
   * was determined by looking for the maximal number which will not cause stack
   * overflow when inserting a large number of rows.
   */
  private static readonly MAX_NUMBER_OF_ROWS_TO_INSERT_AT_ONCE = 10000;

  /**
   * The response version that this data table is in.
   */
  // tslint:disable:no-unused-variable
  version: string;

  /**
   * @param data A JavaScript object containing data used to
   *     initialize the table, or a JSON string representation of such an
   * object. Example and reference can be found at
   *     {@link
   * http://developers.google.com/apis/visualization/documentation/reference.html#DataTable}.
   * @param version The optional version of the data table.
   *     This is the same as the response version.
   */
  constructor(data?: TableSpec | string | null, version?: string | null) {
    super();

    if (typeof this.getTableProperties !== 'function') {
      throw new Error(
        'You called google.visualization.DataTable() without ' +
          'the "new" keyword',
      );
    }

    this.version =
      version === ResponseVersion.VERSION_0_5
        ? ResponseVersion.VERSION_0_5
        : ResponseVersion.VERSION_0_6;

    if (data != null) {
      if (typeof data === 'string') {
        data = deserialize(data) as TableSpec;
      } else {
        DataTable.normalizeDates(data);
      }
      const tableSpec = data;
      this.tableProperties = tableSpec.p || null;
      if (tableSpec['cols'] != null) {
        for (const column of tableSpec.cols) {
          this.addColumn(column);
        }
      }
      if (tableSpec.rows != null) {
        this.dataRows = tableSpec['rows'];
      }
    } else {
      this.dataCols = [];
      this.dataRows = [];
      this.tableProperties = null;
    }
    this.invalidateEntireCellCache();
  }

  /**
   * Walks the data object looking for date/datetime columns where the data is
   * stored as strings in the gviz json date format. If such a column is found,
   * the string values are converted to date values. This is mostly for the
   * jsonp/script injection use case, where the DataTable may be initialized
   * by a data object containing json-formatted dates.
   * Note that mixed mode tables are not supported. All dates in the table must
   * be in the legacy new Date() format, or all dates must be in JSON "Date()"
   * format.
   * @param data The "raw" data object.
   */
  // tslint:disable:no-unused-variable
  private static normalizeDates(data: TableSpec) {
    const columns = data.cols || [];
    const rows = data.rows || [];
    const numberOfColumns = columns.length;

    function instanceOfCell(obj: AnyDuringMigration): obj is Cell {
      return 'v' in obj;
    }

    for (let column = 0; column < numberOfColumns; column++) {
      const type = columns[column]['type'];
      if (type === ColumnType.DATE || type === ColumnType.DATETIME) {
        const numberOfRows = rows.length;
        for (let row = 0; row < numberOfRows; row++) {
          let cellOrValue = rows[row].c[column];
          if (cellOrValue == null) {
            continue;
          }
          // If cellOrValue is a Cell, then it may contain a value.
          if (instanceOfCell(cellOrValue)) {
            const value = cellOrValue.v;
            if (goog.isDateLike(value)) {
              // If the input data contains any Date objects at all, exit
              // early. We don't support "mixed mode" tables where some date
              // value are objects and some are formatted strings.
              return;
            } else if (typeof value === 'string') {
              // Laundering the cell instead of the value, because
              // gviz.json.serialize() only accepts Object.
              cellOrValue = serialize(cellOrValue);
              cellOrValue = deserialize(cellOrValue);
              rows[row].c[column] = cellOrValue;
            }
          }
        }
      }
    }
  }

  /**
   * Returns the number of rows in the data.
   * @return The number of rows in the data.
   */
  getNumberOfRows(): number {
    return this.dataRows.length;
  }

  /**
   * Returns the number of columns in the data.
   * @return The number of columns in the data.
   */
  getNumberOfColumns(): number {
    return this.dataCols.length;
  }

  /**
   * Returns a copy of the specifications of current columns.
   */
  getColumns(): ColumnSpec[] {
    return unsafeClone(this.dataCols);
  }

  /**
   * Returns the identifier of a given column index.
   * @param columnIndex The index of the requested column.
   * @return The identifier of the column at the given index.
   */
  getColumnId(columnIndex: number): string {
    datautils.validateColumnIndex(this, columnIndex);
    return this.dataCols[columnIndex]['id'] || '';
  }

  /**
   * Returns the label of the column with the given index.
   * @param columnIndex The index of the requested column.
   * @return The label of the column at the given index.
   */
  getColumnLabel(columnIndex: number): string {
    datautils.validateColumnIndex(this, columnIndex);
    return String(this.dataCols[columnIndex]['label'] || '');
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
    const pattern = this.dataCols[columnIndex]['pattern'];
    return typeof pattern !== 'undefined' ? pattern : null;
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
   * If undefined, 'string' is used.
   * @param columnIndex The index of the requested column.
   * @return The external column type of the column at the given index.
   */
  getColumnType(columnIndex: number): ColumnType {
    datautils.validateColumnIndex(this, columnIndex);
    const colType = this.dataCols[columnIndex]['type'];
    return typeof colType !== 'undefined'
      ? (colType as ColumnType)
      : ColumnType.STRING;
  }

  /**
   * Returns the internal value of a cell.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @return The cell's internal value.  Undefined is converted to null.
   */
  getValue(rowIndex: number, columnIndex: number): Value | null {
    datautils.validateRowIndex(this, rowIndex);
    datautils.validateColumnIndex(this, columnIndex);
    const cell = this.getCell(rowIndex, columnIndex);
    let result = null;
    if (cell) {
      result = cell['v'];
      result = typeof result !== 'undefined' ? result : null;
    }
    return result;
  }

  /**
   * Gets the cell at rowIndex, columnIndex.
   * May return undefined.
   * @param rowIndex The row index.
   * @param columnIndex The column index.
   * @return The cell at rowIndex, columnIndex.
   */
  getCell(rowIndex: number, columnIndex: number): Cell {
    return this.dataRows[rowIndex]['c'][columnIndex] as Cell;
  }

  /**
   * For backward compatibility.
   * @deprecated Please use getCell
   * @param rowIndex The row index.
   * @param columnIndex The column index.
   * @return The cell at rowIndex, columnIndex.
   */
  // tslint:disable:no-unused-variable
  // tslint:disable-next-line:enforce-name-casing Migration
  private getCell_(rowIndex: number, columnIndex: number): Cell {
    return this.getCell(rowIndex, columnIndex);
  }

  /**
   * Gets the cell cache object at rowIndex, columnIndex.
   * @param rowIndex The row index.
   * @param columnIndex The column index.
   * @return The cell cache object at rowIndex, columnIndex.
   */
  private getCellCache(
    rowIndex: number,
    columnIndex: number,
  ): DataTableCellCache {
    this.cache[rowIndex] = this.cache[rowIndex] || [];
    const rowCache = this.cache[rowIndex];
    const cellCache = rowCache[columnIndex] || {};
    rowCache[columnIndex] = cellCache;
    return cellCache;
  }

  /**
   * Invalidates the cell cache object at rowIndex, columnIndex.
   * @param rowIndex The row index.
   * @param columnIndex The column index.
   */
  invalidateCellCache(rowIndex: number, columnIndex: number) {
    const rowCache = this.cache[rowIndex];
    if (rowCache && rowCache[columnIndex]) {
      rowCache[columnIndex] = {};
    }
  }

  /**
   * Invalidates the entire cell cache object
   */
  private invalidateEntireCellCache() {
    this.cache = [];
  }

  /**
   * Returns the formatted value of a cell.
   * @param rowIndex The index of the requested row.
   * @param columnIndex The index of the requested column.
   * @param formatter An optional formatter.
   * @return The cell's formatted value.
   */
  getFormattedValue(
    rowIndex: number,
    columnIndex: number,
    formatter?: FormatInterface,
  ): string {
    datautils.validateRowIndex(this, rowIndex);
    datautils.validateColumnIndex(this, columnIndex);
    const cell = this.getCell(rowIndex, columnIndex);
    let formattedValue: string | null | undefined = '';
    if (cell) {
      // Formatted value, may legitimately be ''
      if (cell['f'] != null) {
        formattedValue = String(cell['f']);
      } else {
        const cellCache = this.getCellCache(rowIndex, columnIndex);
        if (typeof cellCache.formattedValue !== 'undefined') {
          formattedValue = cellCache.formattedValue;
        } else {
          const value = this.getValue(rowIndex, columnIndex);

          // Inner value, may legally be '' or 0
          if (value !== null) {
            formattedValue = datautils.getDefaultFormattedValue(
              value,
              this.getColumnType(columnIndex),
              formatter,
            );
            if (formattedValue == null) {
              formattedValue = undefined;
            }
          }
          cellCache.formattedValue = formattedValue;
        }
      }
    }
    return formattedValue == null ? '' : formattedValue.toString();
  }

  /**
   * Formats a data column.
   * (Moved from google.visualization.Format to avoid circular dependency)
   * @param columnIndex The column to format.
   * @param gvizFormat The Format to use.  Should probably be internal.
   */
  format(columnIndex: number, gvizFormat?: FormatInterface) {
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
    datautils.validateRowIndex(this, rowIndex);
    datautils.validateColumnIndex(this, columnIndex);
    const cell = this.getCell(rowIndex, columnIndex);
    const properties = cell && cell['p'];
    if (properties && property in properties) {
      return properties[property];
    } else {
      return null;
    }
  }

  /**
   * Returns the properties map (Object) of the specified cell. This object can
   * then be used to read/add/change properties directly.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @return The properties map.
   */
  getProperties(rowIndex: number, columnIndex: number): AnyDuringMigration {
    datautils.validateRowIndex(this, rowIndex);
    datautils.validateColumnIndex(this, columnIndex);
    let cell = this.getCell(rowIndex, columnIndex);
    if (!cell) {
      cell = {'v': null};
      this.dataRows[rowIndex]['c'][columnIndex] = cell;
    }
    if (!cell['p']) {
      // We want to create an object there so that if the user
      // uses the returned value to add properties, they will
      // affect the object.
      cell['p'] = {};
    }
    return cell['p'];
  }

  /**
   * Returns the properties map (Object) of the table. This object can
   * then be used to read/add/change properties directly.
   * @return The properties map.
   */
  getTableProperties(): AnyDuringMigration {
    return this.tableProperties;
  }

  /**
   * Returns the value of the specified table property,
   * or null if no such property was set on the table.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getTableProperty(property: string): AnyDuringMigration {
    const properties = this.tableProperties;
    if (properties && property in properties) {
      return properties[property];
    } else {
      return null;
    }
  }

  /**
   * Sets the entire properties map (Object) of the table. This replaces any
   * previous property values in the table.
   * @param properties The new properties map.
   */
  setTableProperties(properties: AnyDuringMigration) {
    this.tableProperties = properties || {};
  }

  /**
   * Sets a specific property of the table. This replaces any previous value
   * for that property in the table.
   * @param property The name of the property to set.
   * @param value The new value for the property.
   */
  setTableProperty(property: string, value: AnyDuringMigration) {
    if (this.tableProperties == null) {
      this.tableProperties = {};
    }
    this.tableProperties[property] = value;
  }

  /**
   * Sets the value in a given cell.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param value The new value.
   */
  setValue(rowIndex: number, columnIndex: number, value: Value | null) {
    this.setCell(rowIndex, columnIndex, value, undefined, undefined);
  }

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
  ) {
    this.setCell(rowIndex, columnIndex, undefined, formattedValue, undefined);
  }

  /**
   * Sets the entire properties map (Object) of a given cell. This replaces any
   * previous property values in that cell.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param properties The new properties map.
   */
  setProperties(
    rowIndex: number,
    columnIndex: number,
    properties: AnyDuringMigration | null,
  ) {
    this.setCell(rowIndex, columnIndex, undefined, undefined, properties);
  }

  /**
   * Sets a specific property of a given cell. This replaces any previous value
   * for that property in that cell.
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
    const properties = this.getProperties(rowIndex, columnIndex);
    properties[property] = value;
  }

  /**
   * Sets the value, formatted value, and properties map (Object) of a given
   * cell. If some parameters are omitted, no change is made to those parts of
   * the cell.
   * @param rowIndex The row index of the cell.
   * @param columnIndex The column index of the cell.
   * @param value The new value, or undefined to
   *     prevent changing the value.
   * @param formattedValue The new formatted value or undefined to
   *     prevent changing the formattedValue.
   * @param properties The properties map or undefined to prevent
   *     changing the properties.
   */
  // TODO(dlaliberte): use #parseCell to validate cell arguments.
  setCell(
    rowIndex: number,
    columnIndex: number,
    value?: Value | null | undefined,
    formattedValue?: string | null,
    properties?: AnyDuringMigration | null,
  ) {
    datautils.validateRowIndex(this, rowIndex);
    datautils.validateColumnIndex(this, columnIndex);
    this.invalidateCellCache(rowIndex, columnIndex);
    let cell = this.getCell(rowIndex, columnIndex);
    if (!cell) {
      cell = {};
      this.dataRows[rowIndex]['c'][columnIndex] = cell;
    }
    if (typeof value !== 'undefined') {
      // Special case allowing a setCell with a string on a numeric column.
      const colType = this.getColumnType(columnIndex);
      if (
        colType === ColumnType.NUMBER &&
        typeof value === 'string' &&
        !isNaN(value as unknown as number)
      ) {
        cell.v = Number(value);
      } else {
        datautils.validateTypeMatch(this, columnIndex, value);
        cell.v = value;
      }
    }
    if (typeof formattedValue !== 'undefined') {
      cell.f = formattedValue;
    }
    if (typeof properties !== 'undefined') {
      cell.p = isObject(properties) ? properties : {};
    }
  }

  /**
   * Sets the entire properties map (Object) of a given row.
   * This replaces any previous property values for that column.
   * @param rowIndex The row index.
   * @param properties The new properties map.
   */
  setRowProperties(rowIndex: number, properties: AnyDuringMigration | null) {
    datautils.validateRowIndex(this, rowIndex);
    const row = this.dataRows[rowIndex];
    row['p'] = properties;
  }

  /**
   * Sets a specific property of a given row.
   * This replaces any previous value for that property in that row.
   * @param rowIndex The row index.
   * @param property The name of the property to set.
   * @param value The new value for the property.
   */
  setRowProperty(
    rowIndex: number,
    property: string,
    value: AnyDuringMigration,
  ) {
    const properties = this.getRowProperties(rowIndex);
    properties[property] = value;
  }

  /**
   * Returns the value of the specified property for the specified row,
   * or null if no such property was set on the row.
   * @param rowIndex The row index.
   * @param property The name of requested property.
   * @return The value of the property or null if no such property was set.
   */
  getRowProperty(rowIndex: number, property: string): AnyDuringMigration {
    datautils.validateRowIndex(this, rowIndex);
    const row = this.dataRows[rowIndex];
    const properties = row && row['p'];
    if (properties && property in properties) {
      return properties[property];
    } else {
      return null;
    }
  }

  /**
   * Returns the properties map (Object) of the specified row.
   * This object can then be used to read/add/change properties directly.
   * @param rowIndex The column index.
   * @return The properties map.
   */
  getRowProperties(rowIndex: number): AnyDuringMigration {
    datautils.validateRowIndex(this, rowIndex);
    const row = this.dataRows[rowIndex];
    if (!row['p']) {
      // We want to create an object there so that if the user
      // uses the returned value to add properties, they will
      // affect the object.
      row['p'] = {};
    }
    return row['p'];
  }

  /**
   * Changes the label of a column at the given index.
   * @param columnIndex The Index of the column to change.
   * @param newLabel The new label for the column.
   */
  setColumnLabel(columnIndex: number, newLabel: string) {
    datautils.validateColumnIndex(this, columnIndex);
    const column = this.dataCols[columnIndex];
    column['label'] = newLabel;
  }

  /**
   * Sets the entire properties map (Object) of a given column. This replaces
   * any previous property values for that column.
   * @param columnIndex The column index.
   * @param properties The new properties map.
   */
  setColumnProperties(
    columnIndex: number,
    properties: AnyDuringMigration | null,
  ) {
    datautils.validateColumnIndex(this, columnIndex);
    const column = this.dataCols[columnIndex];
    column['p'] = properties;
  }

  /**
   * Sets a specific property of a given column. This replaces any previous
   * value for that property in that column.
   * @param columnIndex The column index.
   * @param property The name of the property to set.
   * @param value The new value for the property.
   */
  setColumnProperty(
    columnIndex: number,
    property: string,
    value: AnyDuringMigration,
  ) {
    const properties = this.getColumnProperties(columnIndex);
    properties[property] = value;
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
    const column = this.dataCols[columnIndex];
    const properties = column && column['p'];
    if (properties && property in properties) {
      return properties[property];
    } else {
      return null;
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
    const column = this.dataCols[columnIndex];
    if (!column['p']) {
      // We want to create an object there so that if the user
      // uses the returned value to add properties, they will
      // affect the object.
      column['p'] = {};
    }
    return column['p'];
  }

  /**
   * Inserts a new column to this table at the given index. The existing rows
   * are updated with null values in this new column's position.
   * @param atColIndex The index where to insert the new column.
   * @param specification The new column's specification.
   *     Can be a type string, such as 'boolean', 'number', 'string', 'date',
   *     'timeofday', 'datetime', or a column specification object. The value
   *     will be validated.
   * @param label The new column's label (optional).
   * @param id The new column's id (optional).
   */
  insertColumn(
    atColIndex: number,
    specification: string | ColumnSpec,
    label?: string,
    id?: string,
  ) {
    if (atColIndex !== this.dataCols.length) {
      this.invalidateEntireCellCache();
      datautils.validateColumnIndex(this, atColIndex);
    }
    let type;
    if (typeof specification === 'string') {
      // Specification must be a string, in particular, a ColumnType
      type = specification;
      // Create a specification object from the parameters.
      label = label || '';
      id = id || '';
      specification = {
        'id': id,
        'label': label,
        'pattern': '',
        'type': type,
      };
    }
    if (!isObject(specification)) {
      throw new Error(
        `Invalid column specification, ${specification}, for column "${atColIndex}".`,
      );
    }
    // Redundant type guards since above logic is too complex for compiler.
    if ('label' in specification) {
      label = specification['label'] as string;
    }
    if ('id' in specification) {
      id = specification['id'] as string;
    }

    const labelIdIndex = label || id || atColIndex;
    if (!('type' in specification)) {
      // TODO(dlaliberte): Can't throw error yet, since unknown column type
      // is used in many places.
      // throw new Error(`No type specified for column "${labelIdIndex}"`);
    } else {
      type = specification['type'];
    }
    if (type == null) {
      // Default to STRING.  Perhaps this is a bad idea.
      type = ColumnType.STRING;
    }
    // Would be nice to use a simpler test that type is a ColumnType:
    if (!Object.values(ColumnType).includes(type as ColumnType)) {
      throw new Error(`Invalid type, ${type}, for column "${labelIdIndex}".`);
    }

    // Create the columnSpec with validated column type.
    // Also, do shallow copy of the incoming specification, which
    // avoids side effects when we add new properties.  But we still
    // cause side effect when a 'role' is added to existing 'p' properties.
    const columnType = type;
    const columnSpec: ColumnSpec = {
      ...(specification as Object),
      'type': columnType,
    } as ColumnSpec;

    const role = columnSpec['role'];
    if (columnSpec['role']) {
      // Copy the role from the top level into the properties.
      const properties = columnSpec['p'] || {};
      if (properties['role'] == null) {
        properties['role'] = role;
        columnSpec['p'] = properties;
      }
    }
    this.dataCols.splice(atColIndex, 0, columnSpec);
    this.invalidateColumnRefMap();
    for (let i = 0; i < this.dataRows.length; i++) {
      this.dataRows[i]['c'].splice(atColIndex, 0, {'v': null});
    }
  }

  /**
   * Adds a new column to this table. The existing rows are updated with null
   * values in this new column's position.
   * @param specification The new column's specification.
   *     Can be a type string, such as 'boolean', 'number', 'string', 'date',
   *     'timeofday', 'datetime', or a column specification object with the
   *     following properties:
   *       type {string} A column type string.
   *       label {string} The new column's label (optional).
   *       id {string} The new column's id (optional).
   *       role {string} The new column's role (optional).
   *       pattern {string} A number (or date) format string (optional).
   * @param label The new column's label (optional).
   * @param id The new column's id (optional).
   * @return The index of the new column.
   */
  addColumn(
    specification: string | ColumnSpec,
    label?: string,
    id?: string,
  ): number {
    this.insertColumn(this.dataCols.length, specification, label, id);
    return this.dataCols.length - 1;
  }

  /**
   * Parses a cell that was passed as part of a row to
   * insertRows/addRows/addRow. The argument can be either an Object containing
   * optional 'v', 'f', and 'p' properties, or a single value (of a valid value
   * type). Returns a cell as should be in our dataRows_.
   * @param columnIndex The column index at which the cell will be inserted.
   * @param cell The cell as given by the user of our methods.
   * @return The cell as should be inside our dataRows_.
   */
  private parseCell(
    columnIndex: number,
    cell: Value | AnyDuringMigration,
  ): Cell {
    const result = datautils.parseCell(cell);
    datautils.validateTypeMatch(this, columnIndex, result['v']);
    return result;
  }

  /**
   * Inserts a number of new rows to this table.
   * @param atRowIndex The index where to insert the new rows.
   * @param numOrArray The number of new empty rows to
   *     insert or an array of rows (arrays of cells) to insert.
   *     See {@link DataTable.prototype.parseCell}
   *     for documentation on the expected form of the cells.
   *     Throws an error if wrong type or form.
   * @return The index of the last row inserted.
   */
  insertRows(
    atRowIndex: number,
    numOrArray: number | DataTableInputRows | null,
  ): number {
    if (atRowIndex !== this.dataRows.length) {
      this.invalidateEntireCellCache();
      datautils.validateRowIndex(this, atRowIndex);
    }
    let rowsToAdd: DataTableInputRows = [];
    if (Array.isArray(numOrArray)) {
      rowsToAdd = numOrArray;
    } else if (typeof numOrArray === 'number') {
      if (numOrArray !== Math.floor(numOrArray) || numOrArray < 0) {
        throw new Error(
          `Invalid value for numOrArray: ${numOrArray}.` +
            ' If numOrArray is a number it must be a nonnegative integer.',
        );
      }
      rowsToAdd = new Array(numOrArray).fill(null);
    } else {
      throw new Error(
        `Invalid value for numOrArray: ${numOrArray}.` +
          'Must be a non-negative number or an array of arrays of cells.',
      );
    }
    let newRows: RowOfCells[] = [];
    for (let i = 0; i < rowsToAdd!.length; i++) {
      let row = rowsToAdd[i];
      const newRowContent = [];
      if (row === null) {
        for (let col = 0; col < this.dataCols.length; col++) {
          newRowContent.push({'v': null});
        }
      } else if (Array.isArray(row)) {
        row = row as AnyDuringMigration[];
        if (row.length !== this.dataCols.length) {
          throw new Error(
            `Row ${i} given with size different than ` +
              `${this.dataCols.length}` +
              ' (the number of columns in the table).',
          );
        }
        for (let j = 0; j < row.length; j++) {
          newRowContent.push(this.parseCell(j, row[j]));
        }
      } else {
        throw new Error(`Row ${i} is not null or an array.`);
      }
      const newRow: RowOfCells = {'c': newRowContent};
      newRows.push(newRow);

      // insertArrayAt is not able to handle long arrays and fails on stack
      // overflow when inserting more than 10K rows. To overcome that, we insert
      // the rows in smaller bulks.
      if (newRows.length === DataTable.MAX_NUMBER_OF_ROWS_TO_INSERT_AT_ONCE) {
        // was: goog.array.insertArrayAt(this.dataRows, newRows, atRowIndex);
        this.dataRows.splice(atRowIndex, 0, ...newRows);
        atRowIndex += newRows.length;
        newRows = [];
      }
    }
    // Insert all the remaining newRows.
    // was: goog.array.insertArrayAt(this.dataRows, newRows, atRowIndex);
    this.dataRows.splice(atRowIndex, 0, ...newRows);
    return atRowIndex + newRows.length - 1;
  }

  /**
   * Adds a number of new empty rows to this table.
   * @param numOrArray The number of new rows to add
   *     or an array of rows (arrays of cells) to add. See
   *     {@link DataTable.prototype.parseCell}
   *     for documentation on the expected form of the cells.
   *     Throws an error if wrong type or form.
   * @return The index of the last row added.
   */
  addRows(numOrArray: number | DataTableInputRows | null): number {
    if (typeof numOrArray === 'number' || Array.isArray(numOrArray)) {
      return this.insertRows(this.dataRows.length, numOrArray);
    } else {
      throw new Error(
        'Argument given to addRows must be either a number or an ' + 'array',
      );
    }
  }

  /**
   * Adds a single empty row to this table.
   * @param
   *     cellArray An optional array of cells. See
   *     {@link DataTable.prototype.parseCell}
   *     for documentation on the expected form of the cells.
   * @return The index of the added row.
   */
  addRow(cellArray?: DataTableInputRow): number {
    // The compiler is "too good" in this case, so it warns that the last else
    // cannot happen. However, this is an external API, so we cannot trust the
    // type system. Thus, we loose the type.
    if (Array.isArray(cellArray)) {
      return this.addRows([cellArray as DataTableInputRow]);
    } else if (cellArray == null) {
      return this.addRows(1);
    } else {
      throw new Error(
        'If argument is given to addRow, it must be an array, or null',
      );
    }
  }

  /**
   * Returns the range, i.e., the minimum and maximum values for the column
   * at the given index.
   * See {@link datautils.getColumnRange} for details.
   * @param columnIndex The index of the column.
   * @return An object with two properties, min and max, containing
   *    the minimum and maximum values in the column, respectively.
   */
  getColumnRange(columnIndex: number): ColumnRange {
    return datautils.getColumnRange(this, columnIndex);
  }

  /**
   * Returns the sorted order of the row indices, according to the specified
   * sort columns.
   * See {@link datautils.getSortedRows} for more details.
   *     The columns by which to sort, and the corresponding sort orders.
   *     {@link datautils#standardizeSortColumns}
   *     for more details.
   * TODO(dlaliberte): Why not allow same sortColumns type as sort method?
   * @return The indices in the sorted order.
   */
  getSortedRows(sortColumns: SortColumns<number>): number[] {
    return datautils.getSortedRows(this, sortColumns);
  }

  /**
   * Sorts the rows, according to the specified sort columns. The structure of
   * sortColumns is defined in the documentation for
   * datautils.standardizeSortColumns.
   *     The columns by which to sort, and the corresponding sort orders.
   *     {@link datautils#standardizeSortColumns}
   *     for more details.
   */
  sort(sortColumns: SortColumns<RowOfCells>) {
    this.invalidateEntireCellCache();
    const getValue = (row: RowOfCells, colIndex: number) => {
      const cell = row['c'][colIndex];
      // TODO(dlaliberte): It seems the cell may *be* the value we want.
      const value =
        cell != null && typeof cell === 'object' && 'v' in cell
          ? cell['v']
          : null;
      return value as Value | null;
    };
    const comparisonFunction = datautils.standardizeSortColumns<RowOfCells>(
      this,
      getValue,
      sortColumns,
    );

    datautils.stableSort(this.dataRows, comparisonFunction);
  }

  /**
   * Returns the row index in the data table.
   * @param rowIndex A row index in the view.
   * @return The row index in the data table.
   */
  getTableRowIndex(rowIndex: number): number {
    return rowIndex;
  }

  /**
   * Returns the column index. This is the base-case for the recursive mapping
   * through multiple nested DataViews back to the original underlying
   * DataTable.
   *
   * @param columnIndex A column index in the data table.
   * @return The column index.
   */
  getUnderlyingTableColumnIndex(columnIndex: number): number {
    datautils.validateColumnIndex(this, columnIndex);
    return columnIndex;
  }

  /**
   * Returns the row index.  This is the base-case for the recursive mapping
   * through multiple nested DataViews back to the original underlying
   * DataTable.
   *
   * @param rowIndex A row index in the data table.
   * @return The row index.
   */
  getUnderlyingTableRowIndex(rowIndex: number): number {
    datautils.validateRowIndex(this, rowIndex);
    return rowIndex;
  }

  /**
   * Returns a clone of this DataTable.
   * This is the base case of the recursion to convert to a DataTable.
   *
   * @return A data table.
   */
  toDataTable(): DataTable {
    return this.clone();
  }

  /**
   * Returns a clone of this datatable. The result is a deep copy of the
   * datatable except for the properties, which are shallow-copied.
   * @return A clone of this DataTable.
   */
  clone(): DataTable {
    return new DataTable(this.toPOJO());
  }

  /**
   * Returns a POJO data object which is a clone of the DataTable's data
   * in a format that can be used as input to new DataTable().
   * The data is deep-copied except for the properties, which are
   * shallow-copied.  (Not precisely true.)
   * @return A clone of the data from this DataTable.
   */
  toPOJO(): TableSpec {
    const obj: TableSpec = {
      'cols': this.dataCols,
      'rows': this.dataRows,
    };
    if (this.tableProperties) {
      obj['p'] = this.tableProperties;
    }
    const data = jsonClone(obj) as TableSpec;
    return data;
  }

  /**
   * Returns a JSON representation of this DataTable.
   *
   * @return A JSON representation of this DataTable.
   */
  toJSON(): string {
    // Throw exception if any of the column data types is of function type.
    for (let col = 0; col < this.dataCols.length; col++) {
      if (this.getColumnType(col) === ColumnType.FUNCTION) {
        throw new Error(
          `Cannot get JSON representation of data table due to function data type at column ${col}`,
        );
      }
    }
    return stringify(this.toPOJO());
  }

  /**
   * Returns the unique values in a certain column, in ascending order.
   * See {@link datautils.getDistinctValues}.
   * @param column The index or id of the column.
   * @return The sorted unique values.
   */
  getDistinctValues(column: number | string): Values {
    return datautils.getDistinctValues(this, column);
  }

  /**
   * Returns the row indices for rows that match all of the given filters.
   * See {@link datautils.getFilteredRows} for more details.
   *    The column filters.
   * @return The indices of the rows that match the filters.
   */
  getFilteredRows(columnFilters: FilterColumns): number[] {
    return datautils.getFilteredRows(this, columnFilters);
  }

  /**
   * Removes a number of rows at the specified index.
   * @param fromRowIndex The index of the first row to remove.
   * @param numRows The number of rows to remove.
   */
  removeRows(fromRowIndex: number, numRows: number) {
    if (numRows <= 0) {
      return;
    }
    this.invalidateEntireCellCache();
    datautils.validateRowIndex(this, fromRowIndex);
    if (fromRowIndex + numRows > this.dataRows.length) {
      numRows = this.dataRows.length - fromRowIndex;
    }
    this.dataRows.splice(fromRowIndex, numRows);
  }

  /**
   * Removes a row at the specified index in the table.
   * @param rowIndex The row index.
   */
  removeRow(rowIndex: number) {
    this.removeRows(rowIndex, 1);
  }

  /**
   * Removes a number of columns at the specified index.
   * @param fromColIndex The index of the first column to remove.
   * @param numCols The number of columnss to remove.
   */
  removeColumns(fromColIndex: number, numCols: number) {
    if (numCols <= 0) {
      return;
    }
    this.invalidateEntireCellCache();
    datautils.validateColumnIndex(this, fromColIndex);
    if (fromColIndex + numCols > this.dataCols.length) {
      numCols = this.dataCols.length - fromColIndex;
    }
    this.dataCols.splice(fromColIndex, numCols);
    this.invalidateColumnRefMap();
    for (let i = 0; i < this.dataRows.length; i++) {
      this.dataRows[i]['c'].splice(fromColIndex, numCols);
    }
  }

  /**
   * Removes a column at the specified index.
   * @param colIndex The column index.
   */
  removeColumn(colIndex: number) {
    this.removeColumns(colIndex, 1);
  }

  /**
   * Normalize a DataTable-like thing by converting it into a DataTable.
   *
   * @param dataObj A
   *     DataTable object, a DataView object, a DataTable JSON string, or an
   *     array of arrays of values to be converted to a DataTable using
   *     google.visualization.arrayToDataTable. Or null.
   */
  static normalizeDataTable(
    dataObj:
      | AbstractDataTable
      | string
      | TableSpec
      | AnyDuringMigration[][]
      | null,
  ): AbstractDataTable | null {
    let data;
    if (dataObj == null) {
      data = null;
    } else if (dataObj instanceof AbstractDataTable) {
      data = dataObj;
    } else if (Array.isArray(dataObj)) {
      data = arrayToDataTable(dataObj);
    } else {
      data = new DataTable(dataObj as TableSpec | string | null);
    }
    return data;
  }

  /**
   * @param arrayOfRows A 2D array.
   * @param noHeaders If true, the returned DataTable will
   *     have no column labels, and the first row of the input array will be
   *     interpreted as the first row of the DataTable. The default is false.
   * @return A TableSpec representation of a DataTable.
   */
  static arrayToDataTableJSON(
    arrayOfRows: DataTableInputRows,
    noHeaders?: boolean,
  ): TableSpec {
    const hasHeaderRow = !noHeaders;
    if (arrayOfRows.length === 0) {
      throw new Error('Array of rows must be non-empty');
    }
    const firstRow = arrayOfRows[0];
    const columns = DataTable.firstRowToColumnSpecs(firstRow, hasHeaderRow);

    const rows = [];
    // Note: avoid use of array.entries() until IE11 polyfills do it correctly.
    // Skip the header row if present.
    let rowIndex = hasHeaderRow ? 1 : 0;
    for (; rowIndex < arrayOfRows.length; rowIndex++) {
      const rowArrayOrRowOfCells = arrayOfRows[rowIndex];
      const row = DataTable.getRowOfCells(
        rowArrayOrRowOfCells,
        rowIndex,
        columns,
      );
      rows.push(row);
    }

    // Convert any remaining 'date?' to 'date'.
    for (let index = 0; index < columns.length; index++) {
      const column = columns[index];
      if (column['type'] === 'date?') {
        column['type'] = 'date';
      }
      if (column['type'] == null) {
        // TODO(dlaliberte): Can't do this yet. Unknown type's must be allowed.
        // throw new Error(`Unknown type of column ${index}`);
      }
    }

    return {
      'cols': columns,
      'rows': rows,
    };
  }

  /**
   * Process the first row of array to column specs.
   * If the first row is a header row, it contains the column specs.
   * Otherwise we create an array of column specs with undefined types.
   */
  static firstRowToColumnSpecs(
    firstRow: RowOfCells | DataTableInputRow | null,
    isHeaderRow: boolean,
  ): Array<Partial<ColumnSpec>> {
    // Figure out the column spec.
    let columns: Array<Partial<ColumnSpec>>;
    if (isHeaderRow) {
      if (!Array.isArray(firstRow)) {
        throw new Error('Column header row must be an array.');
      }

      // Each element of the header row is either a string for
      // the column label or an object that describes the column.
      columns = (firstRow as Array<string | Partial<ColumnSpec>>).map(
        (colHeader) => {
          if (typeof colHeader === 'string') {
            return {'label': colHeader};
          } else if (isObject(colHeader)) {
            const headerObj = colHeader;
            return {...headerObj};
          } else {
            throw new Error(`Unknown type of column header: ${colHeader}`);
          }
        },
      );
    } else {
      // If we don't have a header row, we need to figure out how many columns
      // there are and set their types to undefined.
      columns = [];
      let nhColumnCount = 0;
      if (Array.isArray(firstRow)) {
        nhColumnCount = (firstRow as Array<Value | Cell | null>).length;
      } else if (
        isObject(firstRow) &&
        firstRow != null &&
        'c' in firstRow &&
        Array.isArray((firstRow as RowOfCells)['c'])
      ) {
        nhColumnCount = (firstRow as RowOfCells)['c'].length;
      }
      for (let i = 0; i < nhColumnCount; i++) {
        columns.push({'type': undefined});
      }
    }
    return columns;
  }

  /**
   * Convert an array of values or cells into a RowOfCells.
   * Also add types to the columns, as non-null values are discovered.
   */
  static getRowOfCells(
    rowOfValuesOrCells: DataTableInputRow | null,
    rowIndex: number,
    columns: Array<Partial<ColumnSpec>>,
  ): RowOfCells {
    let rowArray: Array<Value | Cell | null>;
    let rowProperties: Properties | null | undefined;
    if (Array.isArray(rowOfValuesOrCells)) {
      rowArray = rowOfValuesOrCells as Array<Value | Cell | null>;
    } else if (
      !isObject(rowOfValuesOrCells) ||
      !(rowOfValuesOrCells != null && 'c' in rowOfValuesOrCells)
    ) {
      throw new Error(`Invalid row #${rowIndex}`);
    } else {
      // Note: rowArray may contain undefined cells.
      rowArray = (rowOfValuesOrCells as RowOfCells)['c'] as Cell[];
      rowProperties = (rowOfValuesOrCells as RowOfCells)['p'];
    }

    if (rowArray.length !== columns.length) {
      throw new Error(
        `Row ${rowIndex} has ${rowArray.length} columns,` +
          ` but must have ${columns.length}`,
      );
    }
    const rowCells = Array.from(rowArray);

    const row = {
      'c': rowCells,
      'p': rowProperties,
    };

    // For each column, convert any simple Value into a Cell.
    // Also check the type of any column if we don't yet know its type.
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex++) {
      let value: Value | null;
      const valueOrCell = rowCells[columnIndex];

      // Check if the value is a complex object and if so, set it to the
      // contained value. If it's not, set the cell appropriately so that
      // it's handled correctly by the DataTable constructor.
      if (isObject(valueOrCell) && ('v' in valueOrCell || 'f' in valueOrCell)) {
        value = (valueOrCell as Cell)['v'] as Value; // might be undefined
      } else {
        value = valueOrCell as Value;
        // Replace the Value with a Cell.
        rowCells[columnIndex] = {'v': value};
      }

      // Skip the column if there is already a known type.
      // Except we keep checking every value if the type is 'date?'.
      if (
        columns[columnIndex]['type'] != null &&
        columns[columnIndex]['type'] !== 'date?'
      ) {
        // TODO(dlaliberte): maybe validate that every value has correct type.
      } else {
        let type = DataTable.inferTypeOfValue(value);
        // If we see a date as first non-null value, ...
        if (columns[columnIndex]['type'] == null && type === 'date') {
          // convert to questionable date, which may be converted to datetime.
          type = 'date?';
        }
        if (type != null) {
          columns[columnIndex]['type'] = type;
        }
      }
    }

    return row as RowOfCells;
  }

  static inferTypeOfValue(
    value: Value | null,
  ): ColumnTypeUnion | 'date?' | null {
    let type: ColumnTypeUnion | 'date?' | null = null;
    if (value == null) {
    } else if (typeof value === 'string') {
      type = 'string';
    } else if (typeof value === 'number') {
      type = 'number';
    } else if (Array.isArray(value)) {
      // TODO(dlaliberte): Should validate that the value is an array
      // of up to 7 numbers.
      type = 'timeofday';
    } else if (typeof value === 'boolean') {
      type = 'boolean';
    } else if (goog.isDateLike(value)) {
      // Infer whether it is a 'date' or 'datetime'
      const newValue = new Date(value.getTime());
      const offset =
        newValue.getHours() +
        newValue.getMinutes() +
        newValue.getSeconds() +
        newValue.getMilliseconds();
      if (offset !== 0) {
        type = 'datetime';
      } else {
        type = 'date';
      }
    } else {
      // TODO(dlaliberte): Should return unknown type.
      throw new Error(`Unknown type of value, ${value}`);
      // + ` in cell at (${rowIndex}, ${columnIndex}`);
    }
    return type;
  }
}

/**
 * Converts a 2D array to a DataTable.
 *
 * Compare to DataTable#addRows(). The following code:
 *
 * var data = google.visualization.arrayToDataTable([
 *   ['year', 'expenses'],
 *   ['2000', 100],
 *   ['2001', 200]
 * ]);
 *
 * Is equivalent to:
 *
 * var data = new google.visualization.DataTable();
 * data.addColumn('string', 'year');
 * data.addColumn('number', 'expenses');
 * data.addRows([
 *   ['2000', 100],
 *   ['2001', 200]
 * ]);
 *
 * @param arrayOfRows A 2D array.
 * @param noHeaders If true, the returned DataTable will
 *     have no column labels, and the first row of the input array will be
 *     interpreted as the first row of the DataTable. The default is false.
 * @return A DataTable.
 */
export function arrayToDataTable(
  arrayOfRows: DataTableInputRows | null,
  noHeaders?: boolean,
): DataTable {
  // Validate the aOfAs.
  if (!Array.isArray(arrayOfRows)) {
    throw new Error('Data for arrayToDataTable is not an array.');
  }
  // If the arrayOfRows is empty, we just create an empty DataTable.
  if (arrayOfRows.length === 0) {
    return new DataTable();
  }

  return new DataTable(DataTable.arrayToDataTableJSON(arrayOfRows, noHeaders));
}

/**
 * Converts array of objects to a DataTable.
 * For each property name found, a column is added, used as the id property.
 */
export function recordsToDataTable(records: DataRecords): DataTable {
  // Avoid using Object.entries because of IE11: conflicting polyfills.
  const entries = (obj: {[key: string]: AnyDuringMigration}) => {
    const ownProps = Object.keys(obj);
    let i = ownProps.length;
    const resArray = new Array(i); // preallocate the Array
    while (i--) {
      resArray[i] = [ownProps[i], obj[ownProps[i]]];
    }
    return resArray;
  };

  // First iterate through all records to get all unique columns.
  const columnMap: {[id: string]: ColumnSpec} = {};
  let colIndex = 0; // Incremented only for each new column found.
  for (const record of records) {
    for (const [id] of entries(record)) {
      if (!columnMap[id]) {
        columnMap[id] = {id, index: colIndex++};
      }
    }
  }

  // Add the columns as the first row
  const rows: DataTableInputRows = [];
  const columns: Array<Partial<ColumnSpec>> = [];
  for (const [id, column] of entries(columnMap)) {
    columns[column.index] = {'id': id}; // 'id' must be quoted here.
  }
  rows.unshift(columns);

  for (const record of records) {
    const row: DataTableInputRow = [];
    rows.push(row);
    for (const [id, value] of entries(record)) {
      const index = columnMap[id].index!;
      row[index] = value;
    }
  }

  return arrayToDataTable(rows);
}

/**
 * Returns any array of values converted to a DataTable.
 */
export function valuesToDataTable(values: Values): DataTable {
  const records = values.map((value) => ({'data': value}));
  return recordsToDataTable(records);
}
