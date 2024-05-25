/**
 * @fileoverview The super class of all format classes
 * This is useful for testing and dynamic loading since the namespaces are
 * not required but the code assumes they are present.
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

import {
  AbstractDataTableInterface,
  FormatInterface,
  Formatter,
} from '../data/abstract_datatable_interface';
import {ColumnType, Value} from '../data/types';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A formatter for values.
 */
export abstract class Format implements FormatInterface {
  /**
   * Formats a single value.
   * @param value The value to format.  Should be type Value.
   * @return The formatted value.
   */
  formatValue(value: AnyDuringMigration): string {
    const formattedValue = this.formatValueInternal(value as Value);
    return formattedValue || ''; // Always return a string?
  }

  /**
   * Formats a single value.
   * @param value The value to format.
   * @return The formatted value.
   */
  abstract formatValueInternal(value: Value): string | null;

  /**
   * Formats a dataTable column.
   * @param dataTable The data table.
   * @param columnIndex The column to format.
   * @param gvizFormat The Format to use.
   */
  format(
    dataTable: AbstractDataTableInterface,
    columnIndex: number,
    gvizFormat?: Format,
  ) {
    dataTable.format(columnIndex, gvizFormat || this);
  }

  abstract getValueType(columnType: ColumnType | null): ColumnType | null;

  /**
   * Creates an internal formatter that will be used for formatting values.
   * The formatter may depend on the column type
   * @param columnType The column type.
   * @return A formatter.
   */
  createFormatter(columnType: ColumnType | null): Formatter {
    columnType = columnType;
    const formatter = {
      format: (value: Value | null, option: AnyDuringMigration) => {
        option = option;
        return this.formatValue(value);
      },
    };
    return formatter;
  }

  /**
   * Formats a single value internally, given a formatter.
   * @param formatter The formatter to use.
   * @param value The date to format.
   * @return The formatted value.
   */
  formatValueWithFormatter(
    formatter: Formatter,
    value: Value | null,
  ): string | null {
    return formatter.format(value, null);
  }
}
