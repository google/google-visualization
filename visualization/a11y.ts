/**
 * @fileoverview Utilities for making GViz more accessible.
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

import {concatHtmls, createHtml, SafeHtml} from 'safevalues';

import {AbstractDataTable} from '../data/abstract_datatable';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Returns a safe HTML string contaiing a table representation of the data.
 */
export function createHtmlTableRep(dataTable: AbstractDataTable): SafeHtml {
  // TODO(dlaliberte): look into using soy instead.
  const head = createHtml(
    'thead',
    {},
    makeTableRow(dataTable, addColumnHeader),
  );

  const rows = [];
  const numRows = dataTable.getNumberOfRows();
  for (let rowNum = 0; rowNum < numRows; ++rowNum) {
    rows.push(
      makeTableRow(dataTable, (d, c) => {
        return addDataCell(d, c, rowNum);
      }),
    );
  }
  const body = createHtml('tbody', {}, concatHtmls(rows));
  return createHtml('table', {}, concatHtmls([head, body]));
}

/**
 * Execute the callback for every column in the datatable, and returns a row.
 */
export function makeTableRow(
  dataTable: AbstractDataTable,
  cb: (p1: AbstractDataTable, p2: number) => AnyDuringMigration,
): SafeHtml {
  const cells = [];

  const cols = dataTable.getNumberOfColumns();
  for (let i = 0; i < cols; ++i) {
    // Skip all of the role columns.
    if (dataTable.getColumnRole(i) !== '') {
      continue;
    }
    cells.push(cb(dataTable, i));
  }
  const row = concatHtmls(cells);
  return createHtml('tr', {}, row);
}

/**
 * Returns a header cell for the specified column.
 */
export function addColumnHeader(
  dataTable: AbstractDataTable,
  colIndex: number,
): SafeHtml {
  const text =
    dataTable.getColumnLabel(colIndex) || dataTable.getColumnId(colIndex);
  return createHtml('th', {}, text);
}

/**
 * Returns a data cell for the specified row, column.
 */
export function addDataCell(
  dataTable: AbstractDataTable,
  colIndex: number,
  rowIndex: number,
): SafeHtml {
  const val = dataTable.getFormattedValue(rowIndex, colIndex);
  return createHtml('td', {}, val);
}
