/**
 * @fileoverview Creates axis decorations on linear or close to linear scales.
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

import {forEach} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {Options} from '../common/options';
import * as util from '../common/util';
import {AxisDecoration, Decorations} from './axis_decoration';
import {AxisTools} from './axis_tools';
import {CustomPowersOf10} from './custom_powers_of_10';
import {LinearSequence} from './linear_sequence';
import {Mapper} from './mapper';
import {Sequence} from './sequence';
import {Orientation, TextMeasurer} from './text_measurer';

import {NumberFormatterBuilder} from '../format/formatting';

/** Creates an axis decorations supplier for linear scales. */
export class LinAxisDecorationSupplier {
  /** Minimum distance between major gridlines. */
  private readonly minScreenDistance: number;

  /** Minimum distance between minor gridlines. */
  private readonly minMinorGridlinesSpacing: number;

  private readonly axisTools: AxisTools;

  private readonly tickLayoutTester:
    | ((p1: AnyDuringAssistedMigration[]) => boolean)
    | null;

  /**
   * An optional number that each gridline value must be a multiple of.
   * TODO(dlaliberte) Should probably add multiple to the intervals.
   */
  private readonly multiple: number | null;

  /**
   * An optional number that each minor gridline value must be a multiple of.
   */
  private readonly minorMultiple: number | null;

  /** Sequence of subdivision sizes. */
  private readonly spacingSequence: Sequence;

  /** Map from major interval to minor interval. */
  private readonly subSpacingValuesMap: {[key: string]: number[]} = {};

  /**
   * @param mapper The mapper to use.
   * @param textMeasurer The textMeasurer to use.
   * @param orientation Axis orientation.
   * param gridlines.multiple and minorGridlines.multiple
   */
  constructor(
    private readonly mapper: Mapper,
    formatterBuilder: NumberFormatterBuilder | null,
    textMeasurer: TextMeasurer | null,
    tickLayoutTester: ((p1: AnyDuringAssistedMigration[]) => boolean) | null,
    orientation: Orientation,
    private readonly options: Options,
  ) {
    /** Minimum distance between major gridlines. */
    this.minScreenDistance = this.options.inferNumberValue(
      'gridlines.minSpacing',
    );

    /** Minimum distance between minor gridlines. */
    this.minMinorGridlinesSpacing = this.options.inferNumberValue(
      'minorGridlines.minSpacing',
      this.minScreenDistance / 2,
    );

    this.axisTools = new AxisTools(
      mapper,
      textMeasurer,
      orientation,
      formatterBuilder,
    );

    this.tickLayoutTester = tickLayoutTester;

    const rawMajorInterval = this.options.inferValue(
      'gridlines.interval',
      DEFAULT_MAJOR_INTERVAL,
    );
    const majorInterval: number[] =
      typeof rawMajorInterval === 'number'
        ? [rawMajorInterval]
        : Array.isArray(rawMajorInterval)
          ? rawMajorInterval
          : [];

    const rawMinorInterval = this.options.inferValue(
      'minorGridlines.interval',
      DEFAULT_MINOR_INTERVAL,
    );
    const minorInterval: number[] =
      typeof rawMinorInterval === 'number'
        ? [rawMinorInterval]
        : Array.isArray(rawMinorInterval)
          ? rawMinorInterval
          : [];

    /**
     * An optional number that each gridline value must be a multiple of.
     * TODO(dlaliberte) Should probably add multiple to the intervals.
     */
    this.multiple = this.options.inferOptionalNumberValue('gridlines.multiple');

    /**
     * An optional number that each minor gridline value must be a multiple of.
     */
    this.minorMultiple = this.options.inferOptionalNumberValue(
      'minorGridlines.multiple',
    );

    /** Sequence of subdivision sizes. */
    this.spacingSequence = new CustomPowersOf10(majorInterval);

    /* Generate the subSpacingValuesMap:
     * For each majorInteraval, map to each minorInterval that divides
     * evenly into 10 times the majorInterval.
     */
    forEach(majorInterval, (i) => {
      const subIntervals: AnyDuringAssistedMigration[] = [];
      // Assert needed here for compiler.
      assert(minorInterval != null && Array.isArray(minorInterval));
      forEach(minorInterval, (j) => {
        if (Number.isInteger((i * 10) / j)) {
          subIntervals.push(j);
        }
      });
      this.subSpacingValuesMap[i.toString()] = subIntervals;
    });
  }

  /**
   * Creates axis decorations.
   * The spacing value is constrained by the range of min and max data values.
   * @return The created axis decorations.
   */
  getDecorations(
    min: number | null = null,
    max: number | null = null,
  ): Decorations {
    min = min != null ? min : this.mapper.getDataMin();
    max = max != null ? max : this.mapper.getDataMax();
    const maxSpacingValue = max - min;
    // Important: Don't let the spacingValue be larger than the maxSpacingValue.
    let spacingValue = Math.min(maxSpacingValue, this.calcMinSpacingValue());
    if (spacingValue === 0) {
      return {
        majorGridlines: [],
        minorGridlines: [],
      };
    }

    this.spacingSequence.floor(spacingValue);
    // Back up one.

    // Since we would otherwise stop looping after the first failure,
    // we need to first keep looping until we find at least one success.
    let foundOne = false;

    let dataValues: AnyDuringAssistedMigration = null;
    let bestDataValues: AnyDuringAssistedMigration = null;
    let bestSpacingValue: AnyDuringAssistedMigration = null;

    const makeGridlines = () => {
      if (!bestDataValues) {
        // Use last one anyway.
        bestDataValues = dataValues;
        bestSpacingValue = spacingValue;
      }
      const majorGridlines = this.axisTools.makeLabels(bestDataValues);
      const minorGridlines = this.getSubDecorations(bestSpacingValue);

      return {
        majorGridlines,
        minorGridlines,
      };
    };

    const tickLayoutTester = (dataValues: AnyDuringAssistedMigration) => {
      if (this.tickLayoutTester != null) {
        const majorGridlines = this.axisTools.makeLabels(dataValues);
        return this.tickLayoutTester(majorGridlines);
      } else {
        return this.axisTools.allLabelsFit(dataValues);
      }
    };

    do {
      const attemptSequence = new LinearSequence(spacingValue);
      dataValues = [];
      if (this.axisTools.isMultiple(spacingValue, this.multiple)) {
        dataValues = this.axisTools.makeDataValues(
          attemptSequence,
          min,
          max,
          this.multiple,
          null,
        );
      }
      if (dataValues.length) {
        this.axisTools.calcMinimumFractionDigits(dataValues);
        this.axisTools.buildFormatter();

        if (
          this.axisTools.checkSpacing(dataValues, this.minScreenDistance) &&
          this.axisTools.allLabelsUnique(dataValues) &&
          tickLayoutTester(dataValues)
        ) {
          foundOne = true;
          // Take the first one anyway.  This provides a more consistent
          // experience with the explorer mode since it avoids finding
          // occasional better matches with larger spacing.
          break;
        } else {
          // No match.  If we have previously found one, then we are done.
          if (foundOne) {
            break;
          }
        }
      }
      // Go to next spacingValue
      spacingValue = this.spacingSequence.next();
    } while (spacingValue <= maxSpacingValue);

    return makeGridlines();
  }

  /**
   * Generates decorations for minor gridlines.  We start with the spacingValue
   * that was used for the major gridlines, and reduce that to a number
   * less than 10. Then we can look up the corresponding spacings
   * for minor gridlines, and try each until we find one that is large enough.
   *
   * @param spacingValue Used for the major gridlines.
   */
  getSubDecorations(spacingValue: number): AxisDecoration[] {
    const min = this.mapper.getDataMin();
    const max = this.mapper.getDataMax();
    let minorGridlines: AnyDuringAssistedMigration[] = [];

    const pow10 = Math.pow(10, Math.floor(Math.log10(spacingValue)));
    const round = util.roundToNumSignificantDigits;
    let subSpacingValue = round(15, spacingValue / pow10);
    const subSpacings =
      this.subSpacingValuesMap[subSpacingValue.toString()] || [];
    if (subSpacings.length === 0) {
      return minorGridlines;
    }

    const subSpacingSequence = new CustomPowersOf10(subSpacings);
    // Start at a fraction of the spacingValue.
    subSpacingSequence.floor(spacingValue / 20);
    subSpacingValue = subSpacingSequence.getValue();

    // Find the smallest subSpacingValue that is greater than min required.
    do {
      // Skip subSpacingValues that don't divide evenly into the spacingValue
      if (Number.isInteger(spacingValue / subSpacingValue)) {
        const subSequence = new LinearSequence(subSpacingValue);
        let dataValues: AnyDuringAssistedMigration[] = [];
        if (this.axisTools.isMultiple(subSpacingValue, this.minorMultiple)) {
          dataValues = this.axisTools.makeDataValues(
            subSequence,
            min,
            max,
            this.minorMultiple,
            null,
          );
        }
        if (dataValues.length) {
          if (
            this.axisTools.checkSpacing(
              dataValues,
              this.minMinorGridlinesSpacing,
            )
          ) {
            minorGridlines = this.axisTools.makeSubLines(dataValues);
            break;
          }
        }
      }
      // Go to next subSpacingValue
      subSpacingValue = subSpacingSequence.next();
    } while (subSpacingValue < spacingValue);
    return minorGridlines;
  }

  /**
   * Returns the min data spacing to use between the lines.
   *
   * <p>Since the scale might not be entirely linear (when lambda is not
   * precisely 1) we measure the data spacing at different parts of the data
   * range, and then return the largest of these values.
   * If a mirror log scale is being used, we know the extreme cases are to
   * be found at the borders of the range or around the zero data value
   * (if the zero data value is present in the range).
   * @return The spacing to use.
   * #visibleForTesting
   */
  calcMinSpacingValue(): number {
    const screenMin = this.mapper.getScreenStart();
    const screenMax = this.mapper.getScreenEnd();

    const spacingCloseToMax = this.axisTools.getDataSpanSize(
      screenMax,
      screenMax - this.minScreenDistance,
    );
    const spacingCloseToMin = this.axisTools.getDataSpanSize(
      screenMin,
      screenMin + this.minScreenDistance,
    );

    let largestSpacing = Math.max(spacingCloseToMin, spacingCloseToMax);

    const screenZero = this.mapper.getScreenValue(0);
    // Only use screenZero if it is between the screenMin and screenMax.
    // Note: order might be reversed.
    if (screenMin <= screenZero === screenZero <= screenMax) {
      const spacingCloseToZero = this.mapper.getDataValue(
        screenZero + this.minScreenDistance,
      );

      largestSpacing = Math.max(largestSpacing, spacingCloseToZero);
    }

    return largestSpacing === 0 ? 0 : this.spacingSequence.ceil(largestSpacing);
  }
}

/** Default array of interval sizes, used to generate major gridlines. */
const DEFAULT_MAJOR_INTERVAL: number[] = [1, 2, 2.5, 5];

/** Default array of interval sizes, used to generate minor gridlines. */
const DEFAULT_MINOR_INTERVAL: number[] = [1, 1.5, 2, 2.5, 5];
