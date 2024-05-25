/**
 * @fileoverview A value formatter for inline bar charts.
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
 * A formatter for inline bars.
 */
export class BarFormat {
  /**
   * The options for this formatter. See constructor for list of valid options.
   */
  private readonly options: AnyDuringMigration;

  /**
   * A formatter for inline bars.
   *
   * @param options Formatting options. All properties are
   *     optional. Supported properties are:
   *     base {number} Base value (bars for values below base are drawn as
   *         "negative" - going left to right (default=0).
   *     max {number} Maximal value of bar range (default is actual maximal
   * value in data table). min {number} Minimal value of bar range (default is
   * actual minimal value in data table). showValue {boolean} If set to true,
   * adds the value by the bar (default=true). width {number} The width of bars
   * in pixels (default=100). colorPositive {string} Color for positive values
   * (default='blue'). Possible values: red, green, blue. colorNegative {string}
   * Color for negative values (default='red'). Possible values: red, green,
   * blue. drawZeroLine {boolean}  If set to true, draw a 1-pixel dark line if
   *         negative values are present.  The dark line is there to
   *         enhance visual scanning of the bars.  (default=false).
   *
   */
  constructor(options?: AnyDuringMigration | null) {
    this.options = options || {};
  }

  /**
   * Adds a bar with the specified type and width to the given html.
   * The type defines the color of the bar.
   * @param type The bar type.
   * @param width The bar's width in pixels.
   * @param html The generated HTML to append the output to.
   */
  private static addBar(type: ImageType, width: number, html: string[]) {
    if (width > 0) {
      const className = 'google-charts-bar-' + (type || 'w');
      html.push(`<span class="${className}" style="width:${width}px;"></span>`);
    }
  }

  /**
   * Formats the data table.
   * @param dataTable The data table.
   * @param columnIndex The column to format.
   */
  format(dataTable: AbstractDataTableInterface, columnIndex: number) {
    const type = dataTable.getColumnType(columnIndex);
    if (this.getValueType(type) == null) {
      return;
    }
    const options = this.options;

    // Compute min/max values and set range.
    let min = options['min'];
    let max = options['max'];
    let range = null;
    if (min == null || max == null) {
      range = dataTable.getColumnRange(columnIndex);
      if (max == null) {
        max = range['max'];
      }
      if (min == null) {
        min = Math.min(
          0,
          // Zero if all positive, or actual min.
          range['min'],
        );
      }
    }
    if (min >= max) {
      // Ignore min and max and use actual values
      range = range || dataTable.getColumnRange(columnIndex);
      max = range['max'];
      min = range['min'];
    }
    if (min === max) {
      // Make all bars empty
      if (min === 0) {
        max = 1;
      } else {
        // Make all bars full
        if (min > 0) {
          min = 0;
        } else {
          max = 0;
        }
      }
    }

    // Make all bars full on the negative side
    range = max - min;

    // Can not be zero here

    // Set base. Values below base are "negative" and go to the left,
    // while bars above base go to the right.
    let base = options['base'] || 0;
    base = Math.max(
      min,
      // Clip base to range
      Math.min(max, base),
    );
    const width = options['width'] || DEFAULT_BAR_WIDTH;
    let showValue = options['showValue'];
    if (showValue == null) {
      showValue = true;
    }

    // Split the width to the positive area and the negative area.
    const negativeWidth = Math.round(((base - min) / range) * width);
    const positiveWidth = width - negativeWidth;
    for (let row = 0; row < dataTable.getNumberOfRows(); row++) {
      const value = Number(dataTable.getValue(row, columnIndex));
      const html = [];

      // Clip value into range
      const clippedValue = Math.max(min, Math.min(max, value));

      // Find offset point of value
      const offset = Math.ceil(((clippedValue - min) / range) * width);

      // Numbers are right aligned, make bars left-aligned.
      html.push('<span class="google-visualization-formatters-bars">');

      // Add left border
      BarFormat.addBar(ImageType.BORDER, 1, html);
      const imageTypePositive = BarFormat.getTypeByColor(
        options['colorPositive'],
        ImageType.BLUE,
      );
      const imageTypeNegative = BarFormat.getTypeByColor(
        options['colorNegative'],
        ImageType.RED,
      );

      // Draws a line of one pixel if drawZeroLine is set to be true.
      const zeroLineWidth = !!options['drawZeroLine'] ? 1 : 0;

      // Draw the bars
      if (negativeWidth > 0) {
        if (clippedValue < base) {
          // Negative value (below base)
          BarFormat.addBar(ImageType.WHITE, offset, html);
          BarFormat.addBar(imageTypeNegative, negativeWidth - offset, html);

          // Draws the zero line if required.
          if (zeroLineWidth > 0) {
            BarFormat.addBar(ImageType.ZERO, zeroLineWidth, html);
          }
          BarFormat.addBar(ImageType.WHITE, positiveWidth, html);
        } else {
          // Positive value (above base)
          BarFormat.addBar(ImageType.WHITE, negativeWidth, html);

          // Draws the zero line if required.
          if (zeroLineWidth > 0) {
            BarFormat.addBar(ImageType.ZERO, zeroLineWidth, html);
          }
          BarFormat.addBar(imageTypePositive, offset - negativeWidth, html);
          BarFormat.addBar(ImageType.WHITE, width - offset, html);
        }
      } else {
        // No negative values in this chart
        BarFormat.addBar(imageTypePositive, offset, html);
        BarFormat.addBar(ImageType.WHITE, width - offset, html);
      }

      // Add right border
      BarFormat.addBar(ImageType.BORDER, 1, html);
      let originalFormattedValue = dataTable.getProperty(
        row,
        columnIndex,
        CUSTOM_PROPERTY_KEY,
      );
      if (originalFormattedValue == null) {
        originalFormattedValue = dataTable.getFormattedValue(row, columnIndex);
        dataTable.setProperty(
          row,
          columnIndex,
          CUSTOM_PROPERTY_KEY,
          originalFormattedValue,
        );
      }
      if (showValue) {
        // add the value.
        html.push('\u00a0');
        html.push(originalFormattedValue);
      }
      html.push('</span>\u00a0');
      dataTable.setFormattedValue(row, columnIndex, html.join(''));
    }
  }

  getValueType(columnType: ColumnType | null): ColumnType | null {
    return columnType === ColumnType.NUMBER ? columnType : null;
  }

  /**
   * Returns the image type by the specified color name.
   * @param color Name of color (e.g. 'red').
   * @param defaultType The default type to use if no valid color name is
   *     specified.
   * @return The image type
   *     that matches the color.
   */
  private static getTypeByColor(
    color: string | null | undefined,
    defaultType: ImageType,
  ): ImageType {
    color = (color || '').toLowerCase();
    return colorTypeByName[color] || defaultType;
  }
}

/**
 * The default bar width.
 */
const DEFAULT_BAR_WIDTH = 100;

/**
 * Custom property key to keep the original formatted value, so if we apply
 * this formatter more than once, and we want to include the value, we take
 * the original formatted value, and not the output of the formatter itself.
 */
const CUSTOM_PROPERTY_KEY = '_bar_format_old_value';

/**
 * The type of the image, with the value of the image file name.
 * For example. the name GREEN has value 'g' which means that the
 * green background image file name is bar_g.png.
 */
enum ImageType {
  BORDER = 's',
  GREEN = 'g',
  BLUE = 'b',
  RED = 'r',
  WHITE = 'w',
  ZERO = 'z',
}

/**
 * Maps an external color name into the image type.
 */
const colorTypeByName: Record<string, ImageType> = {
  'red': ImageType.RED,
  'blue': ImageType.BLUE,
  'green': ImageType.GREEN,
};
