/**
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

import {ColumnType} from '../data/types';
import {Format} from './format';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A simple, stringifying formatter.
 */
export class StringFormat extends Format {
  /**
   * @param userOptions Options. These are ignored.
   */
  constructor(userOptions?: AnyDuringMigration | null) {
    super();
  }

  getValueType(columnType: ColumnType | null): ColumnType | null {
    return columnType === ColumnType.STRING ? columnType : null;
  }

  /**
   * Formats a single value into a string.
   * Note, this is used also for boolean values.
   *
   * @param value Value to format.
   * @return Formatted value.
   */
  formatValueInternal(value: AnyDuringMigration): string {
    return String(value);
  }
}
