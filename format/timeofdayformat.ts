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

import * as timeutil from '../common/timeutil';
import {ColumnType} from '../data/types';
import {Format} from './format';

import {DateFormat} from './dateformat';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A formatter for timeofday types (and columns).
 */
export class TimeOfDayFormat extends Format {
  /**
   * The formatter that will do the heavy lifting.
   */
  private readonly formatter: DateFormat;

  /**
   * @param userOptions Formatting options.
   *   @see DateFormat
   */
  constructor(userOptions?: AnyDuringMigration | null) {
    super();

    let granularity = userOptions && userOptions['granularity'];
    if (granularity == null || typeof granularity !== 'number') {
      granularity = 1;
    }
    const defaults = {
      'pattern':
        granularity > 1
          ? 'HH:mm'
          : granularity === 1
            ? 'HH:mm:ss'
            : 'HH:mm:ss.SSS',
      ...(userOptions || {}),
    };
    this.formatter = new DateFormat(defaults);
  }

  getValueType(columnType: ColumnType | null): ColumnType | null {
    return columnType === ColumnType.TIMEOFDAY ? columnType : null;
  }

  /**
   * Formats a single value.
   * @param value The time of day value to format.
   * @return The formatter date.
   */
  formatValueInternal(value: AnyDuringMigration): string {
    const dateValue = timeutil.timeOfDayAsDate(value as number[]);
    return this.formatter.formatValue(dateValue);
  }
}
