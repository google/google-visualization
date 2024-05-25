/**
 * @fileoverview A multi-column formatter that formats by pattern.
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

import {AbstractDataTableInterface} from '../data/abstract_datatable_interface';
import {ColumnType} from '../data/types';

/**
 * A pattern formatter. Used to create a pattern based string as a
 * function of the data table values at each row.
 * The result string can be placed as a cell formatted value or a custom
 * property.
 */
export class TablePatternFormat {
  /**
   * The pattern for this formatter. See the constructor comment for more
   * details on the pattern structure.
   */
  private readonly pattern: string;

  /**
   * @param pattern The pattern for the formatted value. The pattern is
   *     of the form:
   *     <text0>{0}<text1>{1}<text2>...
   *     Where the place-holders enclosed in {} mark the places that are later
   *     replaced by the values from the data-table columns.
   *     To escape '{' and '}' use '\{' and '\}', to escape '\' use '\\'.
   */
  constructor(pattern: string) {
    this.pattern = pattern || '';
  }

  /**
   * A replacer function for string.replace() method. See
   * <a
   * href="http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Objects:String:replace">string.replace()
   * documentation </a> for details. Used in format() function below to replace
   * place-holders in the pattern with actual values from the data-table.
   * @param rowIndex The row for which we make the replace. Used to
   *     get the source values.
   * @param dataTable The data table from which we extract the values that
   *     replace the place-holders.
   * @param srcColumnIndices The source columns from which we
   *     extract the values that replace the place-holders.
   * @param matchStr The matched string, which represents a place
   *     holder.
   * @param idxStr The column index specified by the place-holder.
   * @param offset The offset of the match.
   * @param pattern The entire match pattern.
   * @return The value that should replace the place-holder.
   */
  private static replacer(
    rowIndex: number,
    dataTable: AbstractDataTableInterface,
    srcColumnIndices: number[],
    matchStr: string,
    idxStr: string,
    offset: number,
    pattern: string,
  ): string {
    if (offset > 0 && pattern[offset - 1] === '\\') {
      return matchStr;
    } else {
      return dataTable.getFormattedValue(
        rowIndex,
        srcColumnIndices[Number(idxStr)],
      );
    }
  }

  /**
   * Format the data from the source columns using pattern. Put the result in
   * the destination column.
   * @param dataTable The data-table to format.
   * @param srcColumnIndices The source columns indices.
   *     The order of the source columns is used to match them with the
   *     place-holders in the pattern, so for example if the indices are [3, 0]
   *     then the value from column 3 will go in place-holder {0}, and the value
   *     of column 0 will go in place-holder {1}.
   * @param dstColumnIndex The destination column index. If it is
   *     not specified then srcColumnIndices[0] is set as the destination
   * column.
   * @param propertyName A custom property name.
   *     If specified and dstColumnIndex is specified, the name will be used
   *     to assign the result string to a custom property with the given name.
   */
  format(
    dataTable: AbstractDataTableInterface, //
    srcColumnIndices: number[], //
    dstColumnIndex?: number | null, //
    propertyName?: string | null,
  ) {
    let dstColumnIdx = srcColumnIndices[0];
    if (dstColumnIndex != null && typeof dstColumnIndex === 'number') {
      dstColumnIdx = dstColumnIndex;
    }
    propertyName = propertyName || null;

    // format each row
    for (let r = 0; r < dataTable.getNumberOfRows(); r++) {
      const replacer =
        (r: number) =>
        (matchStr: string, idxStr: string, offset: number, pattern: string) => {
          return TablePatternFormat.replacer(
            r,
            dataTable,
            srcColumnIndices,
            matchStr,
            idxStr,
            offset,
            pattern,
          );
        };
      // Replace each place-holder with the appropriate value.
      let formattedValue = this.pattern.replace(/{(\d+)}/g, replacer(r));

      // Handle escaped characters.
      formattedValue = formattedValue.replace(/\\(.)/g, '$1');
      if (propertyName) {
        dataTable.setProperty(r, dstColumnIdx, propertyName, formattedValue);
      } else {
        dataTable.setFormattedValue(r, dstColumnIdx, formattedValue);
      }
    }
  }

  /**
   * Assume anything is possible.
   */
  getValueType(columnType: ColumnType | null): ColumnType | null {
    return columnType;
  }
}
