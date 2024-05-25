/**
 * @fileoverview Helper for assigning labels to axes.
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

import {every, map} from '@npm//@closure/array/array';
import {
  PRECISION_THRESHOLD,
  countRequiredDecimalPrecision,
  roundToNumSignificantDigits,
} from '../common/util';
import {AxisDecoration} from './axis_decoration';
import {Mapper} from './mapper';
import {Sequence} from './sequence';
import {Orientation, TextMeasurer} from './text_measurer';
import {calcMinimumFractionDigits} from './utils';

import {INumberFormatter, NumberFormatterBuilder} from '../format/formatting';

/** Tool used to generate axes. */
export class AxisTools {
  private formatter: INumberFormatter | null = null;

  /**
   * Cached value for testing whether calculated values are a multiple of
   * the 'multiple' parameter.  See use in isMultiple().
   */
  private multiCache: {
    multiple?: number;
    multiplier?: number;
    modBase?: number;
  } | null = null;

  /**
   * @param mapper The mapper used.
   * @param textMeasurer The textMeasurer used.
   * @param orientation The orientation of axis.
   * @param formatterBuilder The value formatter builder.
   */
  constructor(
    private readonly mapper: Mapper,
    private readonly textMeasurer: TextMeasurer | null,
    private readonly orientation: Orientation,
    private readonly formatterBuilder: NumberFormatterBuilder | null,
  ) {}

  /** Builds the formatter from formatterBuilder. */
  buildFormatter() {
    // Always set numSignificantDigits, though it won't always be used.
    // It is necessary for log scales, to avoid excess precision when we don't
    // specify the number of fraction digits.
    if (!this.formatterBuilder) {
      return;
    }
    this.formatterBuilder.setNumSignificantDigits(
      NumberFormatterBuilder.DEFAULT_MAX_NUM_DECIMALS,
    );
    this.formatter = this.formatterBuilder.build();
  }

  /**
   * Computes the min number of decimal digits required to uniquely represent
   * all the numbers uniquely, and sets the formatter accordingly.
   */
  calcMinimumFractionDigits(numbers: number[]) {
    if (!this.formatterBuilder) {
      return;
    }
    const min = calcMinimumFractionDigits(numbers);
    this.formatterBuilder.setMinNumDecimals(min);
    // Also set the max to the same as min, to avoid rounding errors,
    // since we cannot set numSignificantDigits when using minNumDecimals.
    this.formatterBuilder.setMaxNumDecimals(min);
  }

  /**
   * Checks that all dataValues are spaced minimally.
   * TODO(dlaliberte) Should have faster check for linear scales since
   * values are evenly spaced.
   * @param dataValues Data values to check.
   * @param minSpacing In screen coordinates.
   */
  checkSpacing(dataValues: number[], minSpacing: number): boolean {
    let previousValue: AnyDuringAssistedMigration;
    return every(dataValues, (dataValue, index) => {
      const ok =
        index === 0
          ? true
          : Math.abs(
              this.mapper.getScreenValue(dataValue) -
                this.mapper.getScreenValue(previousValue),
            ) >= minSpacing;
      previousValue = dataValue;
      return ok;
    });
  }

  /**
   * Checks if a value is a multiple of this.multiCache.
   * @return True if valid.
   */
  isMultiple(dataValue: number, multiple: number | null): boolean {
    if (multiple == null) {
      return true;
    }
    if (!this.multiCache || this.multiCache.multiple !== multiple) {
      // Cache this multiple value, since only one setting used per axis.
      // This is to avoid repeating the following computation of the multiplier.
      this.multiCache = {};
      this.multiCache.multiple = multiple;
      // Precompute the multiplier which converts the multiple into an integer.
      // This is because we must avoid doing mod of a fraction.
      this.multiCache.multiplier = Math.pow(
        10,
        countRequiredDecimalPrecision(multiple || 1),
      );
      this.multiCache.modBase = Math.round(
        multiple * this.multiCache.multiplier,
      );
    }

    return (
      Math.abs(
        roundToNumSignificantDigits(
          15,
          dataValue * this.multiCache.multiplier!,
        ) % this.multiCache.modBase!,
      ) < PRECISION_THRESHOLD
    );
  }

  /**
   * Checks if all labels of the given set of values would be unique.
   * @param dataValues Data values to test.
   * @return True if they would all be unique.
   */
  allLabelsUnique(dataValues: number[]): boolean {
    if (!this.formatter) {
      return true;
    }
    const labelsMap = {};
    return every(dataValues, (dataValue) => {
      const label = this.formatter!.formatValue(dataValue);
      const oldValue = (labelsMap as AnyDuringAssistedMigration)[label];
      if (oldValue == null) {
        (labelsMap as AnyDuringAssistedMigration)[label] = dataValue;
        return true;
      }

      // The same label was used for a (possibly) different value.
      return false;
    });
  }

  /**
   * Checks if all labels of the given set of values would fit.
   * @param dataValues Data values to try.
   * @return True if they would all fit.
   */
  allLabelsFit(dataValues: number[]): boolean {
    if (!this.formatter) {
      return true;
    }
    let i = dataValues.length;
    if (i > 0) {
      // First check the first two.
      if (this.detectLabelCollision(dataValues[0], dataValues[1])) {
        return false;
      }
      while (--i > 1) {
        if (this.detectLabelCollision(dataValues[i - 1], dataValues[i])) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Checks whether labels of two values would collide. Takes formatter and
   *     orientation into account.
   * @param value1 First value.
   * @param value2 Second value.
   * @return True if the labels would collide.
   */
  detectLabelCollision(value1: number, value2: number): boolean {
    const size1 = this.getLabelSize(value1);
    const size2 = this.getLabelSize(value2);
    const result =
      Math.abs(
        this.mapper.getScreenValue(value1) - this.mapper.getScreenValue(value2),
      ) <
      (size1 + size2) / 2;
    return result;
  }

  /**
   * Removes values whose labels would collide with the zeroth label.
   * @param dataValues An array of data values.
   * @return The values not colliding with the zero label.
   */
  removeCollisionsWithZero(dataValues: number[]): number[] {
    const result = [];
    const len = dataValues.length;
    const zeroCoord = this.mapper.getScreenValue(0);
    if (
      zeroCoord === this.mapper.getScreenValue(dataValues[0]) ||
      zeroCoord === this.mapper.getScreenValue(dataValues[len - 1])
    ) {
      // Zero on the end is ok.
      return dataValues;
    }
    for (let i = 0; i < len; i++) {
      if (
        dataValues[i] === 0 ||
        zeroCoord !== this.mapper.getScreenValue(dataValues[i])
      ) {
        result.push(dataValues[i]);
      }
    }
    return result;
  }

  /**
   * Returns the size of a label depending on its orientation.
   * @param value The value of the label.
   * @return The measured size.
   */
  getLabelSize(value: number): number {
    const str = this.formatter!.formatValue(value);

    return this.textMeasurer!.getSizeByOrientation(str, this.orientation);
  }

  /**
   * Gets the size of a data span from a screen span.
   * @param screenStart First screen position.
   * @param screenEnd Second screen position.
   * @return The size of the value span.
   */
  getDataSpanSize(screenStart: number, screenEnd: number): number {
    const dataStart = this.mapper.getDataValue(screenStart);
    const dataEnd = this.mapper.getDataValue(screenEnd);
    return Math.abs(dataEnd - dataStart);
  }

  /**
   * Creates labels for every data value using a formatter.
   * @param dataValues The data values.
   * @return The generated axis decorations.
   */
  makeLabels(dataValues: number[]): AxisDecoration[] {
    // Determine the minimum required precision to represent all values.
    const round = roundToNumSignificantDigits;
    const decorations = map(dataValues, (dataValue) => {
      dataValue = round(15, dataValue);
      return AxisDecoration.makeLabeledLineWithHeavyTick(
        dataValue,
        this.mapper.getScreenValue(dataValue),
        this.formatter ? this.formatter.formatValue(dataValue) : '',
      );
    });
    return decorations;
  }

  /**
   * Creates minor gridlines for every data value.
   * @param dataValues The data values.
   * @return The generated axis decorations.
   */
  makeSubLines(dataValues: number[]): AxisDecoration[] {
    const decorations = [];
    for (let i = 0; i < dataValues.length; i++) {
      const dataValue = dataValues[i];
      decorations.push(
        AxisDecoration.makeLineWithTick(
          dataValue,
          this.mapper.getScreenValue(dataValue),
        ),
      );
    }
    return decorations;
  }

  /**
   * Generates nice data values in a given range using a sequence.
   * Also skip any values that are not a multiple of the given multiple.
   *
   * @param lineSequence A sequence to generate numbers from.
   * @param dataMin Start data value.
   * @param dataMax End data value.
   * @param multiple If true, data values must be multiple of this.
   * @param epsilon Exclude values between 0 and epsilon.
   * @return The generated values.
   */
  makeDataValues(
    lineSequence: Sequence,
    dataMin: number,
    dataMax: number,
    multiple: number | null,
    epsilon: number | null = null,
  ): number[] {
    if (dataMin === dataMax) {
      return [dataMin];
    }
    if (!isFinite(dataMin)) {
      // Catch this odd case that would cause an infinite loop.
      return [dataMax];
    }

    const dataValues: AnyDuringAssistedMigration[] = [];
    const maybeAdd = (value: AnyDuringAssistedMigration) => {
      if (
        (multiple == null || this.isMultiple(value, multiple)) &&
        (value === 0 || epsilon == null || Math.abs(value) >= epsilon)
      ) {
        dataValues.push(value);
        lastAddedValue = value;
      }
    };

    // Start at or *before* the dataMin.
    // TODO(dlaliberte) Need to find first value that is definitely added.
    let value = lineSequence.floor(dataMin);
    let lastAddedValue = null;
    do {
      maybeAdd(value);
      value = lineSequence.next();
    } while (lastAddedValue == null || lastAddedValue < dataMax);
    // End at or *after* the dataMax.
    return dataValues;
  }
}
