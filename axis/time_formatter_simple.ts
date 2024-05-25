/**
 * Simple time formatter for testing
 *
 * @license
 * Copyright 2024 Google LLC
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

import {MONTH, QUARTER, YEAR} from './milliseconds';
import {TimeFormatter} from './time_formatter';
import {millisecondsToIsoStr} from './utils';

/** Simple time formatter for testing */
export class SimpleTimeFormatter extends TimeFormatter {
  /** The time resolution in milliseconds or multiples of Milliseconds. */
  private duration = 0;

  constructor() {
    super();
  }

  /**
   * Measures the width of a text field.
   * @param duration A time duration.
   */
  setTimeUnit(duration: number) {
    this.duration = duration;
  }

  /**
   * Formats a point in time to a string depending on the time unit.
   * @param time Point in time to format.
   * @return The formatted string.
   */
  format(time: number): string {
    if (isNaN(time)) {
      return 'notime';
    }
    const date = new Date(time);
    switch (this.duration) {
      case YEAR:
        return date.getUTCFullYear().toString(10);
      case QUARTER:
        const pos = Math.ceil(date.getUTCMonth() / 4);
        return quarters[pos];
      case MONTH:
        const monthName = monthNames[date.getUTCMonth()];
        return `${monthName} ` + date.getUTCFullYear().toString(10);
      default:
        return millisecondsToIsoStr(time);
    }
  }
}

/** Month names */
const monthNames: string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Quarter names */
const quarters: string[] = ['Q1', 'Q2', 'Q3', 'Q4'];
