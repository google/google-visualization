/**
 * @fileoverview A formatter that sets the background anf foreground colors
 * by the value range.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import * as googColor from '@npm//@closure/color/color';
import {AbstractDataTableInterface} from '../data/abstract_datatable_interface';
import {ColumnType, Value} from '../data/types';

/**
 * A color range entry.
 */
export class ColorRange {
  /**
   * The start of the range, null indicates any value.
   */
  private readonly from: Value | null;

  /**
   * The end of the range, null indicates any value.
   */
  private readonly to: Value | null;

  /**
   * The foreground color to use.
   */
  private readonly color: string | null;

  /**
   * The background color to use.
   */
  private readonly bgcolor: string;

  /**
   * A color range entry.
   *
   * @param from Range start.
   *     Null indicates any value (-infinity).
   * @param to Range end.
   *     Null indicates any value (infinity).
   * @param color Foreground color.
   * @param bgcolor Background color.
   *
   */
  constructor(
    from: Value | null,
    to: Value | null,
    color: string | null,
    bgcolor: string,
  ) {
    // Date and Datetime
    if (from != null && from instanceof Date) {
      from = from.getTime();
    }
    if (to != null && to instanceof Date) {
      to = to.getTime();
    }

    // Time of day
    if (from != null && Array.isArray(from)) {
      from = ColorFormat.getTimeOfDayMillis(from);
    }
    if (to != null && Array.isArray(to)) {
      to = ColorFormat.getTimeOfDayMillis(to);
    }

    this.from = from;
    this.to = to;
    this.color = color;
    this.bgcolor = bgcolor;
  }

  /**
   * Checks if a given value is in the range of this entry.
   * Null values are never contained in any range.
   * @param value The value to
   *     test.
   * @return True if the given value is within this range.
   */
  contains(value: Value | null): boolean {
    const from = this.from;
    const to = this.to;
    if (value == null) {
      // Null value is taken as contained, only if both from and to are nulls.
      return from == null && to == null;
    } else {
      asserts.assert(value != null);
      if (value instanceof Date) {
        // Date or Datetime
        value = value.getTime();
      } else {
        if (Array.isArray(value)) {
          // Time of day
          value = ColorFormat.getTimeOfDayMillis(value);
        }
      }
    }
    asserts.assert(value != null);
    return (from == null || value >= from) && (to == null || value < to);
  }

  /**
   * Returns the color of this entry.
   * @return The color of this entry.
   */
  getColor(): string | null {
    return this.color;
  }

  /**
   * Returns the background of this entry.
   * @param value The displayed
   *     value.
   * @return The color of this entry.
   */
  getBackgroundColor(value: Value | null): string {
    // Note that the value is not used here, but is used in the gradient
    // formatter that extends this class.
    value = value;
    return this.bgcolor;
  }

  /**
   * Returns the range start value.
   * @return The value for the range
   *     start.
   */
  protected getFrom(): Value | null {
    return this.from;
  }
}

/**
 * A gradient color range entry.
 */
export class GradientColorRange extends ColorRange {
  /**
   * The size of the range.
   */
  private readonly rangeSize: number = 0;

  /**
   * Background color for range start, in rgb format.
   */
  private readonly fromColor: number[];

  /**
   * Background color for range end, in rgb format.
   */
  private readonly toColor: number[];

  /**
   * @param from Range start. Null indicates any value (-infinity).
   * @param to Range end. Null indicates any value (infinity).
   * @param color Foreground color.
   * @param fromBgColor Background color for range start.
   * @param toBgColor Background color for range end.
   */
  constructor(
    from: Value | null,
    to: Value | null,
    color: string | null,
    fromBgColor: string,
    toBgColor: string,
  ) {
    super(from, to, color, '');

    if (typeof from === 'number' && typeof to === 'number') {
      this.rangeSize = to - from;
      if (this.rangeSize <= 0) {
        this.rangeSize = 1;
      }
    }
    this.fromColor = googColor.hexToRgb(googColor.parse(fromBgColor).hex);
    this.toColor = googColor.hexToRgb(googColor.parse(toBgColor).hex);
  }

  /**
   * Returns the background color of this entry.
   * @param value The displayed
   *     value.
   * @return The color of this entry.
   */
  override getBackgroundColor(value: Value): string {
    if (typeof value !== 'number') {
      return '';
    }
    const from = this.getFrom();
    const factor = 1 - (value - (from as number)) / this.rangeSize;
    const rgb = googColor.blend(this.fromColor, this.toColor, factor);
    return googColor.rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
}

/**
 * A formatter that can set the cell foreground and background colors
 * by the value range.
 */
export class ColorFormat {
  /**
   * The ranges.
   */
  ranges: ColorRange[] = [];

  /**
   * Adds a new range.
   * @param from Range start.
   *     Null indicates any value (-infinity).
   * @param to Range end.
   *     Null indicates any value (infinity).
   * @param color Foreground color.
   * @param bgcolor Background color.
   */
  addRange(
    from: number | string | Date | number[] | null,
    to: number | string | Date | number[] | null,
    color: string,
    bgcolor: string,
  ) {
    this.ranges.push(new ColorRange(from, to, color, bgcolor));
  }

  /**
   * Adds a new gradient range.
   * @param from Range start.
   * @param to Range end.
   * @param color Foreground color.
   * @param fromBgColor Background color for range start.
   * @param toBgColor Background color for range end.
   */
  addGradientRange(
    from: number | Date | number[],
    to: number | Date | number[],
    color: string | null,
    fromBgColor: string,
    toBgColor: string,
  ) {
    this.ranges.push(
      new GradientColorRange(from, to, color, fromBgColor, toBgColor),
    );
  }

  /**
   * Formats the data table.
   * @param dataTable The data table.
   * @param columnIndex The column to format.
   */
  format(dataTable: AbstractDataTableInterface, columnIndex: number) {
    const type = dataTable.getColumnType(columnIndex);
    if (this.getValueType(type) != null) {
      for (let row = 0; row < dataTable.getNumberOfRows(); row++) {
        const value = dataTable.getValue(row, columnIndex);
        let styles = '';
        for (let i = 0; i < this.ranges.length; i++) {
          const range = this.ranges[i];
          if (typeof value !== 'undefined' && range.contains(value)) {
            const color = range.getColor();
            const bgcolor = range.getBackgroundColor(value);
            if (color) {
              styles += 'color:' + color + ';';
            }
            if (bgcolor) {
              styles += 'background-color:' + bgcolor + ';';
            }
            break;
          }
        }
        dataTable.setProperty(row, columnIndex, 'style', styles);
      }
    }
  }

  getValueType(columnType: ColumnType | null): ColumnType | null {
    if (
      columnType !== ColumnType.DATE &&
      columnType !== ColumnType.DATETIME &&
      columnType !== ColumnType.TIMEOFDAY &&
      columnType !== ColumnType.NUMBER &&
      columnType !== ColumnType.STRING
    ) {
      return null;
    }
    return columnType;
  }

  /**
   * Returns the milliseconds value of a time of day array.
   * @param value The timeofday value to get its millies.
   * @return The milliseconds value of a time of day array.
   */
  static getTimeOfDayMillis(value: number[]): number {
    return (
      value[0] * 60 * 60 * 1000 +
      value[1] * 60 * 1000 +
      value[2] * 1000 +
      (value.length === 4 ? value[3] : 0)
    );
  }
}
