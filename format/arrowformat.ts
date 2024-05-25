/**
 * @fileoverview A value formatter for arrows that indicate values.
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

import {AbstractDataTableInterface} from '../data/abstract_datatable_interface';
import {ColumnType} from '../data/types';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A formatter for arrow indicators.
 */
export class TableArrowFormat {
  /**
   * The options for this formatter. See constructor for list of valid options.
   */
  private readonly options: AnyDuringMigration;

  /**
   * A formatter for arrow indicators.
   *
   * @param userOptions Formatting options. All properties are
   *     optional. Supported properties are:
   *     base {number} Base value. Values above base get arrows going up,
   *         values below base get arrow pointing down (default=0).
   */
  constructor(userOptions?: AnyDuringMigration | null) {
    this.options = userOptions || {};
  }

  /**
   * Formats the data table.
   * @param dataTable The data table.
   * @param columnIndex The column to format.
   */
  format(dataTable: AbstractDataTableInterface, columnIndex: number) {
    if (dataTable.getColumnType(columnIndex) !== 'number') {
      return;
    }
    const options = this.options;
    const base = options['base'] || 0;
    for (let row = 0; row < dataTable.getNumberOfRows(); row++) {
      const value = dataTable.getValue(row, columnIndex);
      let className = null;
      if (value != null && value < base) {
        className = CSS_PREFIX + CSS_CLASS.DOWN_RED;
      } else {
        if (value != null && value > base) {
          className = CSS_PREFIX + CSS_CLASS.UP_GREEN;
        } else {
          className = CSS_PREFIX + CSS_CLASS.EMPTY_TRANSPARENT;
        }
      }
      dataTable.setProperty(row, columnIndex, 'className', className);
    }
  }

  getValueType(columnType: ColumnType | null): ColumnType | null {
    return columnType === ColumnType.NUMBER ? columnType : null;
  }
}

/**
 * CSS class name prefix for all arrow classes.
 */
const CSS_PREFIX = 'google-visualization-formatters-arrow-';

/**
 * The CSS classname suffix for each arrow type.
 */
const CSS_CLASS = {
  UP_GREEN: 'ug',
  DOWN_RED: 'dr',
  EMPTY_TRANSPARENT: 'empty',
};
