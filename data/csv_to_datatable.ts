/**
 * @fileoverview GViz DataTable importer from CSV text.
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

import * as googCsv from '@npm//@closure/labs/format/csv';

import {DataTable} from './datatable';
import {ColumnTypeUnion} from './types';

declare interface CSVColumnSpec {
  label?: string; // Display name of the column
  type?: ColumnTypeUnion;
}

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Creates a CSV to data table importer.
 * @see SUPPORTED_TYPES.
 */
export class CsvToDataTable {
  private readonly hasHeader: boolean;
  private readonly types: ColumnTypeUnion[];

  /**
   * The data table columns. Each cell has an object with 2 properties: 'type'
   * and 'label'.
   */
  private columns: CSVColumnSpec[] = [];

  /**
   * TODO(dlaliberte): validate the csvText somehow?
   * @param csvText The CSV text.
   * @param colTypes The table column types.
   * @param colHeader Whether there is a header row.
   */
  constructor(
    private readonly csvText: string, //
    colTypes: string[], //
    colHeader?: boolean,
  ) {
    /**
     * Whether there is a header row.
     */
    this.hasHeader = colHeader != null ? colHeader : false;
    this.validateTypes(colTypes as ColumnTypeUnion[]);

    /**
     * The dataTable columns data types.
     */
    this.types = colTypes as ColumnTypeUnion[];
  }

  /**
   * Creates a data table from the CSV text.
   * @return The gviz dataTable.
   */
  createDataTable(): DataTable {
    // FYI: The googCsv.parse function looks like:
    // param text The entire CSV text to be parsed.
    // param ignoreErrors Whether to ignore parsing errors and
    //      instead try to recover and keep going.
    // param delimiter The delimiter to use. Defaults to ','
    // return The parsed CSV, as an array of arrays.
    const csvRows = googCsv.parse(this.csvText);

    const dataTable = new DataTable();
    if (csvRows && csvRows.length > 0) {
      this.createColumns(csvRows, dataTable);
      this.createRows(csvRows, dataTable);
    }
    return dataTable;
  }

  /**
   * Creates the dataTable columns.
   * @param csvRows The CSV rows.
   * @param dataTable The gviz data table.
   */
  private createColumns(csvRows: string[][], dataTable: DataTable) {
    // Bootstrap the data table columns.
    const cols: CSVColumnSpec[] = [];
    const types = this.types;
    for (let t = 0, len = types.length; t < len; t++) {
      cols.push({type: types[t]});
    }
    // Collect the column labels.
    if (this.hasHeader) {
      const r = 0;
      for (let c = 0, len = cols.length; c < len; c++) {
        cols[c].label = csvRows[r][c];
      }
    }
    // Create the dataTable columns.
    for (let i = 0, len = cols.length; i < len; i++) {
      const col = cols[i];
      dataTable.addColumn(col.type || 'string', col.label);
    }
    // Store the columns for creating the rows.
    this.columns = cols;
  }

  /**
   * Creates the data table rows and set the cell values.
   * @param csvRows The CSV rows.
   * @param dataTable The gviz data table.
   */
  private createRows(csvRows: string[][], dataTable: DataTable) {
    const cols = this.columns;
    const startRow = this.hasHeader ? 1 : 0;
    for (let r = startRow, numRows = csvRows.length; r < numRows; r++) {
      dataTable.addRow();
      for (let c = 0, len = cols.length; c < len; c++) {
        const value = csvRows[r][c];
        const type = cols[c].type || 'string';
        dataTable.setCell(r - startRow, c, this.getTypedValue(value, type));
      }
    }
  }

  /**
   * Validate the user specified data types are from the set of supported types.
   * @see SUPPORTED_TYPES
   * @param types A list of data types.
   */
  private validateTypes(types: ColumnTypeUnion[]) {
    for (let t = 0; t < types.length; t++) {
      const type = types[t];
      if (!SUPPORTED_TYPES[type]) {
        throw new Error(`Unsupported type: ${type}`);
      }
    }
  }

  /**
   * Get the typed value for a given string and type.
   * @param value The value.
   * @param type The type.
   * @return The typed value.
   */
  private getTypedValue(
    value: string,
    type: ColumnTypeUnion,
  ): string | number | boolean {
    return SUPPORTED_TYPES[type](value);
  }

  /**
   * Converts a string to a number. Throws error in case parsing fails.
   * @param val The value to convert.
   * @return The number result.
   */
  static convertToNumber(val: string): number {
    const num = Number(val);
    if (isNaN(num)) {
      throw new Error(`Not a number ${val}`);
    }
    return num;
  }
}

/**
 * The set of supported types mapped to functions to convert into each type.
 */
const SUPPORTED_TYPES: {
  [key: string]: (value: AnyDuringMigration) => AnyDuringMigration;
} = {
  'number': (value: AnyDuringMigration) =>
    CsvToDataTable.convertToNumber(value),
  'string': (value: AnyDuringMigration) => value,
  'boolean': (value: AnyDuringMigration) => value.toLowerCase() === 'true',
  'date': (value: AnyDuringMigration) => new Date(value),
  'datetime': (value: AnyDuringMigration) => new Date(value),
  'timeofday': (value: AnyDuringMigration) => value.split(','),
};
