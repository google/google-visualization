/**
 * @fileoverview Finds labels on logarithmic scales.
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

import {forEach, map} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {Options} from '../common/options';
import * as util from '../common/util';
import {AxisDecoration, Decorations} from './axis_decoration';
import {AxisTools} from './axis_tools';
import {CustomPowersOf10} from './custom_powers_of_10';
import {Mapper} from './mapper';
import {PacedPowersOf10Mirror} from './paced_powers_of_10_mirror';
import {ceil} from './pow_10_math';
import {Sequence} from './sequence';
import {Orientation, TextMeasurer} from './text_measurer';

import {NumberFormatterBuilder} from '../format/formatting';

/** Create an axis decoration supplier for logarithmic scales. */
export class LogAxisDecorationSupplier {
  // TODO(dlaliberte) Why are these never used?
  //     /**
  //      * @const {?TextMeasurer}
  //      * @private
  //      */
  //     this.textMeasurer_ = textMeasurer;

  //     /**
  //      * @const {!Orientation}
  //      * @private
  //      */
  //     this.orientation_ = orientation;

  /** Must be a positive number. */
  private readonly epsilon: number;

  /** Minimum distance between major gridlines. */
  private readonly minScreenDistance: number;

  /** Minimum distance between minor gridlines. */
  private readonly minMinorGridlinesSpacing: number;

  private readonly axisTools: AxisTools;

  private readonly tickLayoutTester:
    | ((p1: AnyDuringAssistedMigration[]) => boolean)
    | null;

  /** Sequence of subdivision sizes. */
  private readonly spacingSequence: Sequence;

  /**
   * Sequence of number of steps between powers of 10.
   * @see calcMaxSteppingValue
   */
  private readonly steppingSequence: Sequence;

  /** Map from major interval to minor interval. */
  private readonly subSpacingValuesMap: {[key: string]: number[]} = {};

  /**
   * An optional number that each gridline value must be a multiple of.
   * TODO(dlaliberte) Should probably add multiple to the intervals.
   */
  private readonly multiple: number | null;

  /**
   * An optional number that each minor gridline value must be a multiple of.
   */
  private readonly minorMultiple: number | null;

  /**
   * @param mapper The mapper used.
   * @param textMeasurer A text measurer.
   * @param orientation Axis orientation.
   * param gridlines.multiple and minorGridlines.multiple
   * @param epsilon Distance from zero to closest data value.
   */
  constructor(
    private readonly mapper: Mapper,
    formatterBuilder: NumberFormatterBuilder | null,
    textMeasurer: TextMeasurer | null,
    tickLayoutTester: ((p1: AnyDuringAssistedMigration[]) => boolean) | null,
    orientation: Orientation,
    private readonly options: Options,
    epsilon: number,
  ) {
    // TODO(dlaliberte) Why are these never used?
    //     /**
    //      * @const {?TextMeasurer}
    //      * @private
    //      */
    //     this.textMeasurer_ = textMeasurer;

    //     /**
    //      * @const {!Orientation}
    //      * @private
    //      */
    //     this.orientation_ = orientation;

    /** Must be a positive number. */
    this.epsilon = Math.abs(epsilon) || 1;

    /** Minimum distance between major gridlines. */
    this.minScreenDistance = this.options.inferNumberValue(
      'gridlines.minSpacing',
    );

    /** Minimum distance between minor gridlines. */
    this.minMinorGridlinesSpacing = this.options.inferNumberValue(
      'minorGridlines.minSpacing',
      this.minScreenDistance / 5,
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

    /** Sequence of subdivision sizes. */
    this.spacingSequence = new CustomPowersOf10(majorInterval);

    // Compute stepping interval from spacing interval, as the
    // multiplicative inverse times 10, then reduced to number less than 10.
    // The array is then sorted, as required by the sequence generator.
    // So [1, 2, 5] is transformed into [10/1, 10/2, 10/5] ->
    // [10, 5, 2] -> [1, 2, 5], which is coincidentally the same,
    // but it won't always be.
    const steppingInterval = map(majorInterval, (interval) => {
      let n = 10 / interval;
      while (n >= 10) {
        n /= 10;
      }
      return n;
    }).sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));

    /**
     * Sequence of number of steps between powers of 10.
     * @see calcMaxSteppingValue
     */
    this.steppingSequence = new CustomPowersOf10(steppingInterval);

    /* Generate the subSpacingValuesMap:
     * For each majorInteraval, map to each minorInterval that divides
     * evenly into 10 times the majorInterval.
     */
    forEach(majorInterval, (i) => {
      const subIntervals: AnyDuringAssistedMigration[] = [];
      assert(minorInterval != null && Array.isArray(minorInterval));
      forEach(minorInterval, (j) => {
        if (Number.isInteger((i * 10) / j)) {
          subIntervals.push(j);
        }
      });
      this.subSpacingValuesMap[i.toString()] = subIntervals;
    });

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
  }

  /**
   * Creates the axis decorations for log scale.
   * The spacing value is constrained by the range of min and max data values.
   * @return The created axis decorations.
   */
  getDecorations(min: number | null, max: number | null): Decorations {
    min = min ?? this.mapper.getDataMin();
    max = max ?? this.mapper.getDataMax();
    const maxSpacingValue = max - min;

    const epsilon = this.epsilon;

    const makeGridlines = (
      dataValues: AnyDuringAssistedMigration,
      spacingValue: AnyDuringAssistedMigration,
    ) => {
      assert(dataValues != null);
      dataValues = this.axisTools.removeCollisionsWithZero(dataValues);

      const majorGridlines = this.axisTools.makeLabels(dataValues);
      const minorGridlines = this.getSubDecorations(spacingValue);

      return {
        majorGridlines,
        minorGridlines,
      };
    };

    const tickLayoutTester = (dataValues: AnyDuringAssistedMigration) => {
      assert(min != null && max != null);
      if (
        dataValues.length > 0 &&
        (dataValues[0] > min || dataValues[dataValues.length - 1] < max)
      ) {
        // Either the min or max are excluded from the dataValues.
        return false;
      }

      if (
        !this.axisTools.checkSpacing(dataValues, this.minScreenDistance) ||
        !this.axisTools.allLabelsUnique(dataValues)
      ) {
        return false;
      }

      if (this.tickLayoutTester != null) {
        const majorGridlines = this.axisTools.makeLabels(dataValues);
        return this.tickLayoutTester(majorGridlines);
      } else {
        return this.axisTools.allLabelsFit(dataValues);
      }
    };

    // Calculate the largest possible number of steps,
    // which corresponds with the smallest possible spacing between steps.
    let steppingValue = this.calcMaxSteppingValue();

    const lineSequence = new PacedPowersOf10Mirror(steppingValue, epsilon);
    let dataValues = this.axisTools.makeDataValues(
      lineSequence,
      min,
      max, // Can't limit to multiple here, hence null.
      null,
      this.epsilon,
    );
    // Important: Don't let the spacingValue be larger than the maxSpacingValue.
    let spacingValue = Math.min(maxSpacingValue, 10 / steppingValue);

    // Save these in case that's all we get.
    const firstDataValues = dataValues;
    const firstSpacingValue = spacingValue;

    this.axisTools.buildFormatter();

    // Check special cases for initial steppingValue.
    if (dataValues.length < 2) {
      // Only one gridline fits at most?  Return it.
      // TODO(dlaliberte) Minor gridlines are still possible.
      return makeGridlines(dataValues, spacingValue);
    }
    // At least 2 gridlines are required for the remainder.

    // We need to keep looping until we find the first success.
    let foundOne = false;

    if (tickLayoutTester(dataValues)) {
      foundOne = true;
    } else {
      // Useful for debugging:
      // console.info('tried', spacingValue, steppingValue, dataValues);

      // Based on first 2 values, recompute largest possible number of steps.
      // Avoid 0 by using epsilon instead.
      let firstValue = dataValues[0] || epsilon;
      const secondValue = dataValues[1];

      if (firstValue === secondValue) {
        firstValue = firstValue / 10;
      }
      const firstPowerOfTen = ceil(Math.abs(firstValue));
      assert(!isNaN(firstPowerOfTen)); // 'firstPowerOfTen must be number'

      const largestPossibleNumSteps = Math.max(
        1,
        firstPowerOfTen / Math.abs(secondValue - firstValue),
      );
      assert(
        !isNaN(largestPossibleNumSteps) && largestPossibleNumSteps > 0,
        'largestPossibleNumSteps must be positive number. ' +
          `firstValue: ${firstValue} secondValue: ${secondValue} ` +
          `firstPowerOfTen: ${firstPowerOfTen}`,
      );

      // Start at the next larger step, which is the next smaller spacing.
      // This may end up regenerating the same firstDataValues,
      // but not doing it this way could skip a step.
      this.steppingSequence.ceil(largestPossibleNumSteps);
      // Convert from numsteps to spacing.
      // Maybe use .previous() or .next()?
      steppingValue = this.steppingSequence.getValue();
      spacingValue = 10 / steppingValue;

      // Synchronize the spacingSequence.
      // Use floor here because we used ceil with the steppingSequence,
      // and they go in opposite directions.
      this.spacingSequence.floor(spacingValue);
      spacingValue = this.spacingSequence.getValue();

      // Loop through spacingSequences in order, smallest to largest.
      // For each, we compute the number of steps so we can use the
      // PacedPowersOf10Mirror sequence.
      do {
        steppingValue = 10 / spacingValue;
        const attemptSequence = new PacedPowersOf10Mirror(
          steppingValue,
          epsilon,
        );
        dataValues = [];
        if (this.axisTools.isMultiple(spacingValue, this.minorMultiple)) {
          dataValues = this.axisTools.makeDataValues(
            attemptSequence,
            min,
            max,
            this.multiple,
            this.epsilon,
          );
        }
        // Useful for debugging:
        // console.info('checking', spacingValue, steppingValue, dataValues);

        if (tickLayoutTester(dataValues)) {
          // console.info('found one');
          foundOne = true;
          break;
        }

        // Go to next spacingValue
        spacingValue = this.spacingSequence.next();
      } while (spacingValue < maxSpacingValue);

      if (!foundOne) {
        // Fall back to the first data values
        dataValues = firstDataValues;
        spacingValue = firstSpacingValue;
      }
    }

    return makeGridlines(dataValues, spacingValue);
  }

  /**
   * Generate decorations for minor gridlines.  We start with the spacingValue
   * that was used for the major gridlines, and reduce that to a number
   * less than 10, and then we can simply look up the corresponding spacing
   * for minor gridlines.
   *
   * @param spacingValue Used for the major gridlines.
   */
  getSubDecorations(spacingValue: number): AxisDecoration[] {
    assert(spacingValue != null);

    const min = this.mapper.getDataMin();
    const max = this.mapper.getDataMax();
    let minorGridlines: AnyDuringAssistedMigration[] = [];

    const pow10 = Math.pow(10, Math.floor(Math.log10(spacingValue)));
    const NUM_ROUNDING_DIGITS = 15;
    const round = util.roundToNumSignificantDigits;
    let subSpacingValue = round(NUM_ROUNDING_DIGITS, spacingValue / pow10);
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
        const subSteppingValue = round(
          NUM_ROUNDING_DIGITS,
          10 / subSpacingValue,
        );
        const subSequence = new PacedPowersOf10Mirror(
          subSteppingValue,
          this.epsilon,
        );
        let dataValues: AnyDuringAssistedMigration[] = [];
        if (this.axisTools.isMultiple(subSpacingValue, this.minorMultiple)) {
          dataValues = this.axisTools.makeDataValues(
            subSequence,
            min,
            max,
            this.minorMultiple,
            this.epsilon,
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
   * Returns the largest number of steps that should be generated
   * between the data values' powers of 10 such that
   * the space between lines will be the smallest possible.
   * Note that the size of each step will vary.
   *
   * <ol>
   * <li>If the value is 1, no lines will be used between 1 and 10.
   * <li>If the value is 2, then 5 and 10 will be used.  That's 2 subdivisions.
   * <li>If the value is 5, then 2, 4, 6, 8 and 10 will be used. 5 subdivisions.
   * <li>If the value is 10, then 1, 2, 3, 4, 5, 6, 7, 8, 9 and 10 will be used.
   * <li>...and so on.
   * <li>But if the value is 0.5, odd powers of 10 will be skipped, leaving:
   * 0.01, 1, 100, 10,000, ...  Sometimes this is what we need.
   * </ol>
   *
   * TODO(dlaliberte) Why not compute normal spacing interval, and convert to
   * numsteps?  spacing = 10 / numsteps
   * But the first spacing after every power of 10 is one less,
   * since we start at the previous power of 10.  E.g. between 1 and 5,
   * spacing is 5 - 1 = 4, but between 5 to 10, spacing is 5.
   *
   * @return The recommended stepping value.
   */
  calcMaxSteppingValue(): number {
    // The screenvalue of the first power of ten above absolute value of data
    // closest to zero.
    const powTen = this.mapper.getScreenValue(this.epsilon * 10);
    // The screenvalue of the line closest below powTen.
    let belowPowTen;
    // The number of steps between the powers of 10 being considered.
    let numSteps;
    // Reset the numSteps sequence to 1.
    this.steppingSequence.floor(1);
    // TODO(martino): Since 1 is the lowest value the numSteps may have, this
    // finder will always end up with the power of 10 lines even if they
    // will be drawn closer to each other than the minScreenDistance.

    // Keep increasing the numSteps value as long as the screen span
    // right below a power of 10 is larger than minScreenDistance.
    do {
      numSteps = this.steppingSequence.next();
      belowPowTen = this.mapper.getScreenValue(
        (this.epsilon * 10 * (numSteps - 1)) / numSteps,
      );
    } while (Math.abs(powTen - belowPowTen) >= this.minScreenDistance);
    // The numSteps value is now too big so we must return a decreased value.
    numSteps = this.steppingSequence.previous();
    if (numSteps < 1) {
      // Oops, too small, back to next.
      numSteps = this.steppingSequence.next();
    }
    return numSteps;
  }
}

/** Default array of interval sizes, used to generate major gridlines. */
const DEFAULT_MAJOR_INTERVAL: number[] = [1, 2, 5];

/** Default array of interval sizes, used to generate minor gridlines. */
const DEFAULT_MINOR_INTERVAL: number[] = [1, 2, 5];
