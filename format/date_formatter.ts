/**
 * @fileoverview A singleton version of DateFormat that has caching.
 * @license
 * Copyright 2022 Google LLC
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

import {memoize} from '../common/cache/memoize';
import {DateFormat} from './dateformat';

// tslint:disable:ban-types Migration

// Trick for telling TS compiler that goog.addSingletonGetter adds the
// getInstance static method.
// tslint:disable-next-line:class-as-namespace
abstract class Singleton {
  /** @nocollapse */
  static getInstance(): DateFormatter {
    throw new Error('Must be overridden');
  }
}

let instance: DateFormatter;

/**
 * Like DateFormat, but with memoization.
 * @unrestricted
 */
export class DateFormatter extends Singleton {
  private readonly getDateFormatObjectMemoized: (p1: string) => DateFormat;
  format: Function;

  constructor() {
    super();

    /**
     * The memoized DateFormat object creator.
     */
    this.getDateFormatObjectMemoized = memoize(
      this.getDateFormatObject.bind(this) as (
        ...p1: AnyDuringMigration[]
      ) => AnyDuringMigration,
    ) as (p1: string) => DateFormat;

    /**
     * Easier access to formatting dates.
     */
    this.format = this.getFormattedDate.bind(this);
  }

  /**
   * Gets a formatted date in the form of the formatString.
   * @param formatString The string that formats the date.
   * @param date The date to format.
   * @return The formatted date.
   */
  getFormattedDate(formatString: string, date: Date): string {
    return this.getDateFormatObjectMemoized(formatString).formatValue(date);
  }

  /**
   * Creates a DateFormat object based on a formatString.
   * @param formatString The string to use to initialize the
   *     DateFormat.
   * @return The DateFormat object.
   */
  private getDateFormatObject(formatString: string): DateFormat {
    return new DateFormat({pattern: formatString, valueType: 'time'});
  }

  static override getInstance(): DateFormatter {
    return (instance ??= new DateFormatter());
  }
}
