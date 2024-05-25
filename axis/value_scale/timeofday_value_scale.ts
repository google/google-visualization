/**
 * @fileoverview An implementation of a scale for the time of day data type.
 *
 * Note: Deprecated. Use DateTickDefiner instead.
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

import {Options} from '../../common/options';
import * as timeutil from '../../common/timeutil';
import {Value} from '../../data/types';
import {DateFormat} from '../../format/dateformat';
import * as valueNumberConverter from '../value_number_converter';
import {ValueScale} from './value_scale';

// tslint:disable:ban-types

/**
 * A scale implementation for the time of day data type.
 * Overall strategy: Converts an object of the timeofday type to numeric by
 * calculating number of milliseconds since midnight. The time of day object is
 * an array of [hours, minutes, seconds, milliseconds].
 * Values are internally converted to milliseconds.
 * @unrestricted
 */
export class TimeofdayValueScale extends ValueScale {
  /** See timeutil.durationGranularity */
  private granularity = 1;

  tickSize = 0;

  // formatter: AnyDuringMigration;

  constructor() {
    super();
  }

  getDefaultBaseline(): AnyDuringMigration {
    return [0, 0, 0, 0];
  }

  inferValue(options: Options, path: string[] | string): AnyDuringMigration {
    // Note that it doesn't work to do options.inferOptionalTimeOfDayValue(path)
    // because the value might be the numericMin or numericMax.
    return options.inferValue(path);
  }

  /**
   * Compares two numeric values
   * @param value1 A numeric value.
   * @param value2 A numeric value.
   * @return -1, 0, or 1, usable by sort function.
   */
  override compareValues(value1: Value | null, value2: Value | null): number {
    const millis1 = valueNumberConverter.timeOfDayToNumber(value1);
    const millis2 = valueNumberConverter.timeOfDayToNumber(value2);
    return millis1 < millis2 ? -1 : millis1 > millis2 ? 1 : 0;
  }

  /**
   * @param value The value as the underlying data type.
   * @return The value as a number.
   */
  valueToNumberInternal(value: Value): number | null {
    return valueNumberConverter.timeOfDayToNumber(value);
  }

  numberToValueInternal(num: number): Value {
    return valueNumberConverter.timeOfDayFromNumber(num);
  }

  /**
   * @param shouldExpand Should the range expand past the min/max values or should it be constrained to those values.
   */
  override calibrateInternal(shouldExpand: boolean) {
    const numericMinValue = this.getNumericMinValue();
    const numericMaxValue = this.getNumericMaxValue();

    let numberOfSections = this.numberOfSections;
    if (numberOfSections === -1) {
      numberOfSections = 6;
    }
    const unroundedTickSize =
      (numericMaxValue - numericMinValue) / numberOfSections;

    // Round tick size to a divisor of a whole unit from the table,
    // zero indicating no repeating intervals.
    const unit = timeutil.roundMillisAccordingToTable(
      unroundedTickSize,
      niceDurationTable,
      0,
    );
    this.granularity = timeutil.durationGranularity(unit);
    const unitMillis = timeutil.durationAsMillis(unit);
    const tickSize =
      Math.max(1, Math.round(unroundedTickSize / unitMillis)) * unitMillis;
    this.tickSize = tickSize;

    // Use unit to round all values
    let minDuration = timeutil.millisAsDuration(numericMinValue);
    let maxDuration = timeutil.millisAsDuration(numericMaxValue);
    if (shouldExpand) {
      minDuration = timeutil.floorDuration(minDuration, unit);
      maxDuration = timeutil.ceilDuration(maxDuration, unit);
    }

    this.setNumericMinValue(
      this.valueToNumberInternal(timeutil.durationAsTimeOfDay(minDuration)),
    );
    this.setNumericMaxValue(
      this.valueToNumberInternal(timeutil.durationAsTimeOfDay(maxDuration)),
    );
  }

  generateTicks(shouldExpand: boolean) {
    const ticks: Value[] = [];
    let value = this.getNumericMinValue();
    const max = this.getNumericMaxValue();
    while (value < max) {
      ticks.push(value);
      value += this.tickSize;
    }
    ticks.push(value);

    this.setTicks(ticks as number[]);
  }

  /**
   * @param value The value to be converted to string.
   * @return the string representation.
   */
  valueToStringInternal(value: AnyDuringMigration): string {
    const formatter = this.getFormatter()!;

    // Format the value.
    return formatter.formatValue(value);
  }

  createFormatter() {
    // If the user specified a format in the options - use it. If not, select
    // the format according to the ticks granularity.
    const format =
      this.getDefaultFormat() ||
      (this.granularity > 1
        ? 'HH:mm'
        : this.granularity === 1
          ? 'HH:mm:ss'
          : 'HH:mm:ss.SSS');
    const dateFormatter = new DateFormat({'pattern': format, 'timeZone': 0});
    const formatter = {
      formatValue(value: AnyDuringMigration) {
        // Convert the value into a date (arbitrarily in UTC 1970-01-01)
        // so we can use the date formatter.
        const dateValue = timeutil.timeOfDayAsDate(value as timeutil.TimeOfDay);
        const formattedValue = dateFormatter.formatValue(dateValue);
        return formattedValue;
      },
    };
    this.formatter = formatter;
  }

  /**
   * Creator method used by scale repository for creating this class
   * @return The built scale.
   */
  static buildTimeofdayValueScale(): ValueScale {
    return new TimeofdayValueScale();
  }
}

/**
 * A table of 'round' units. Only on a whole divisor of one of these ticks
 * will be positioned. In this case no extrapolation is needed since the
 * size of durations is bounded.
 */
const niceDurationTable: number[][] = [
  [0, 1, 0, 0],
  [0, 2, 0, 0],
  [0, 5, 0, 0],
  [0, 10, 0, 0],
  [0, 20, 0, 0],
  [0, 30, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 5, 0],
  [0, 0, 10, 0],
  [0, 0, 15, 0],
  [0, 0, 30, 0],
  [0, 0, 0, 1],
  [0, 0, 0, 2],
  [0, 0, 0, 3],
  [0, 0, 0, 4],
  [0, 0, 0, 6],
  [0, 0, 0, 12],
];
