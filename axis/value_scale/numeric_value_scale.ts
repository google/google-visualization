/**
 * @fileoverview An implementation of a value scale for the number data type.
 *
 * Note: Deprecated. Use the LinAxisDecorationSupplier or LogAxisDecorationSupplier instead.
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

import * as googObject from '@npm//@closure/object/object';
import {Options} from '../../common/options';
import * as util from '../../common/util';
import {Value} from '../../data/types';
import {NumberFormat} from '../../format/numberformat';
import * as tickutil from '../tick_utils';
import * as valueNumberConverter from '../value_number_converter';
import {ValueScale} from './value_scale';

// tslint:disable:ban-types
// xtslint:disable:ban-ts-suppressions

interface TickScoringWeights {
  tickTightness: number;
  includeBaseline: number;
  tickSizeRoundness: number;
  outerTickRoundness: number;
  innerTickRoundness: number;
}

/**
 * Default heuristics for tick generation.
 * TODO(dlaliberte) Happy day... most of this is going away soon!
 */
const DEFAULT_TICK_SCORING_WEIGHTS: TickScoringWeights = {
  // Weight of the tightness of the ticks (how much of the displayed
  // area consists of data rather than margins inside or outside the ticks).
  tickTightness: 10,

  // Weight for including the baseline in the view window.
  includeBaseline: 10,

  // Weight of the roundness of inner ticks.
  innerTickRoundness: 10,

  // Weight of the roundness of outer ticks.
  // Outer ticks are likely to need higher weights than inner ticks.
  outerTickRoundness: 10,

  // Weight of the roundness of the tick size.
  tickSizeRoundness: 10,
};

/**
 * The most common implementation of the ValueScale interface, Is used for
 * scales of an already numeric data type, so no conversion is needed.
 * Calibration makes sure ticks are on round numbers, meaning being a
 * multiplicand of a round unit. A round unit has only one non zero digit
 * that is either 1, 2 or 5. The round unit is chosen to be more or less of the
 * same magnitude as the min to max range.
 * @unrestricted
 */
export class NumericValueScale extends ValueScale {
  /**
   * The number of decimal point digits to use,
   * probably based on the precision of the tick values.
   */
  private decimalPoints = 0;

  /**
   * The internal formatter used to format numeric values.
   * Will be set in calibrateInternal.
   */
  // formatter: NumberFormat | null;

  /**
   * An optional number to divide by before formatting numbers along the axis.
   * @see {NumberFormat}
   */
  // TODO(dlaliberte): remove '!'
  private scaleFactor!: number;

  /**
   * An array of weights used for scoring tick positions. The array should
   * consist of four numeric entries controlling the weights of the following
   * quantities:
   * <ul><li>Tightness of the ticks (how much of the displayed area consists
   * of data rather than margins).</li> <li>Roundness of the every inner
   * tick.</li> <li>Roundness of the every outer tick.</li> <li>Roundness of
   * the tick size.</li>
   * </ul>
   * TODO(dlaliberte): Reduce bloatness of weight definition.
   * @see scoringFunction to see how they are used exactly.
   */
  // TODO(dlaliberte): remove '!'
  tickScoringWeights!: TickScoringWeights;

  // numberOfSections: AnyDuringMigration;

  constructor() {
    super();
  }

  getDefaultBaseline(): AnyDuringMigration {
    return 0;
  }

  /**
   * @param options Options object.
   * @param numberOfTicks The required number of ticks. If null, a default is used.
   */
  override init(options: Options, numberOfTicks: number | null) {
    super.init(options, numberOfTicks);

    this.formatter = null;

    this.scaleFactor = options.inferNumberValue('formatOptions.scaleFactor', 1);

    this.tickScoringWeights = googObject.clone(
      // tslint:disable-next-line:no-implicit-dictionary-conversion
      DEFAULT_TICK_SCORING_WEIGHTS,
    ) as TickScoringWeights;
  }

  generateTicks(shouldExpand: boolean) {
    let scoringFunction;
    let startInsideMargin;
    let startOutsideMargin;
    let endInsideMargin;
    let endOutsideMargin;

    let min = this.getNumericMinValue();
    let max = this.getNumericMaxValue();
    // Numeric scales usually have a baseline, but logScale might not.
    const baseline = this.getNumericBaseline();

    // Bind the scoringFunction with the min and max values now, since they
    // may be changed below.  We bind with all but the startPoint, endPoint,
    // and unit, which will be provided by the tick positioning function.
    scoringFunction = NumericValueScale.scoringFunction.bind(
      null,
      this.tickScoringWeights,
      this.numberOfSections,
      min,
      max,
      baseline,
    );

    if (shouldExpand) {
      // In case the min value is slightly smaller (probably less than a pixel)
      // than a round tick, a tiny inside margin would allow using the round
      // tick. For example, if the min value is -1 and the max value is 10000,
      // it is better to set the min tick at 0 and have the min value stick out
      // of the ticks range.
      startOutsideMargin = 1 / Math.max(Math.min(this.numberOfSections, 6), 3);
      startInsideMargin = -0.0001;
      endInsideMargin = startInsideMargin;
      endOutsideMargin = startOutsideMargin;

      if (baseline != null) {
        // Expand the range for ticks to include the baseline, if close enough.
        const range = max - min;
        if (baseline < min && min - range < baseline) {
          min = baseline;
        } else if (baseline > max && max + range > baseline) {
          max = baseline;
        }
      }
    } else {
      // The view window is set - look for good ticks inside the view window
      // while making sure the sections at the edges won't be bigger than the
      // tick size.
      startInsideMargin = -1 / Math.max(this.numberOfSections, 3);
      startOutsideMargin = 0;
      endInsideMargin = startInsideMargin;
      endOutsideMargin = startOutsideMargin;
      // Tightness is much *more* important.
      this.tickScoringWeights.tickTightness *= 2;
      // Prefer to exclude baseline, because it will be added for free.
      this.tickScoringWeights.includeBaseline *= -1;
    }

    const tickPositioning = tickutil.positionTicksAroundRange(
      min,
      max,
      startInsideMargin,
      startOutsideMargin,
      endInsideMargin,
      endOutsideMargin,
      this.numberOfSections,
      scoringFunction,
    );

    const tickSize =
      (tickPositioning.endPoint - tickPositioning.startPoint) /
      this.numberOfSections;

    const ticks: number[] = [];
    for (let i = 0; i <= this.numberOfSections; ++i) {
      ticks.push(tickPositioning.startPoint + tickSize * i);
    }

    // Maybe add ticks for the min and max.
    if (ticks[0] !== min && ticks[0] - tickSize === min) {
      ticks.unshift(min);
    }
    if (
      ticks[ticks.length - 1] !== max &&
      ticks[ticks.length - 1] + tickSize === max
    ) {
      ticks.push(max);
    }
    this.numberOfSections = ticks.length - 1;

    // Expand the min and max numeric values based on the ticks.
    this.setNumericMinValue(Math.min(ticks[0], this.getNumericMinValue()));
    this.setNumericMaxValue(
      Math.max(ticks[ticks.length - 1], this.getNumericMaxValue()),
    );

    this.setTicks(ticks);
  }

  /** @param ticks The values on the scale on which ticks are positioned. */
  override setTicks(ticks: number[]) {
    super.setTicks(ticks);

    // Determine the precision based on the tick values.
    let precision = 0;
    this.ticks.forEach(function (
      this: NumericValueScale,
      tick: AnyDuringMigration,
    ) {
      const value = this.numberToValue(tick) as number;
      precision = Math.max(
        precision,
        util.countRequiredDecimalPrecision(value / this.scaleFactor),
      );
    }, this);
    this.decimalPoints = precision;
  }

  /**
   *  We either create a formatter using the specified pattern, or
   *  given the number of digits after the decimal separator.
   *  setTicks() will compute the decimalPoints value.
   */
  createFormatter() {
    const defaultFormat = this.getDefaultFormat();
    const formatterOptions = {
      'pattern': defaultFormat,
      'fractionDigits': defaultFormat ? null : this.decimalPoints,
      'scaleFactor': this.scaleFactor,
      'prefix': this.options.inferOptionalStringValue('formatOptions.prefix'),
      'suffix': this.options.inferOptionalStringValue('formatOptions.suffix'),
      'significantDigits': this.options.inferOptionalNonNegativeNumberValue(
        'formatOptions.significantDigits',
      ),
    };
    this.formatter = new NumberFormat(formatterOptions);
  }

  /**
   * A function used for scoring tick positioning. Higher score is better.
   * The number of digits in every tick and the tick size all contribute
   * negatively to the score.
   * @param tickScoringWeights An object with weights used for scoring tick positionings.
   * @param numberOfSections The number of sections this axis is divided into.
   * @param minValue The minimum value of range for which ticks are chosen.
   * @param maxValue The maximum value of range for which ticks are chosen.
   * @param baseline The numeric baseline value.
   * @param startPoint An integer - the first tick (specified in units).
   * @param endPoint An integer - the last tick (specified in units).
   * @param unit The unit the start and end point are specified in.
   * @return the score.
   */
  private static scoringFunction(
    tickScoringWeights: TickScoringWeights,
    numberOfSections: number,
    minValue: number,
    maxValue: number,
    baseline: number | null,
    startPoint: number,
    endPoint: number,
    unit: number,
  ): number {
    const tickSize = (endPoint - startPoint) / numberOfSections;

    let minTick = startPoint * unit;
    let maxTick = endPoint * unit;

    /* Useful debugging info:
          'Scoring',
            'minValue', minValue,
            'maxValue', maxValue,
            'baseline', baseline,
            'minTick', minTick,
            'maxTick', maxTick,
            'unit', unit,
            'numberOfSections', numberOfSections,
            'tickSize', tickSize
        */

    let score = 0;

    // Note that the number scorer returns a higher score for worse numbers,
    // so it should count *against* the total score.
    const numberScorer = tickutil.scoreNumber;

    if (baseline != null) {
      // Score is better for including baseline within the range.
      // May not be one of the ticks, however, depending on how nice the value
      // is.
      const baselineIncluded = baseline >= minTick && baseline <= maxTick;
      score += (baselineIncluded ? 1 : -1) * tickScoringWeights.includeBaseline;

      // Score better for closer match between value range and tick range.
      if (baselineIncluded) {
        // Include the baseline as if it is a tick.
        minTick = Math.min(baseline, minTick);
        maxTick = Math.max(baseline, maxTick);
      }
    }
    const tightnessScore =
      Math.abs(1 - (maxValue - minValue) / (maxTick - minTick)) *
      tickScoringWeights.tickTightness;
    score -= tightnessScore;

    // Score for the tick size itself.
    const tickSizeScore =
      numberScorer(tickSize) * tickScoringWeights.tickSizeRoundness;
    score -= tickSizeScore;

    // Score for the outer ticks, start point and end point.
    // Additional benefit for ticks being a multiple of tickSize.
    score -=
      (numberScorer(startPoint) +
        numberScorer(endPoint) +
        numberScorer(startPoint / tickSize)) *
      tickScoringWeights.outerTickRoundness;

    if (numberOfSections > 1) {
      // Accumulator for the score of inner ticks.
      let ticksScore = 0;

      // Score inner ticks, excluding first and last.
      for (let i = 1; i < numberOfSections; i++) {
        ticksScore +=
          numberScorer(startPoint + i * tickSize) *
          tickScoringWeights.innerTickRoundness;
      }
      // We could divide the ticksScore by the number of sections so the score
      // is not too unfairly weighted by the number of ticks.  But we
      // probably want to effectively increase the weight with more ticks.
      // e.g. score -= ticksScore / (numberOfSections - 1);
    }

    /* Useful debugging info.
     * '  score', score,
     * 'tightness', tightnessScore,
     * 'baseline', baselineIncluded,
     * 'tickSizeScore', tickSizeScore,
     * 'ticksScore', ticksScore
     */

    return score;
  }

  inferValue(options: Options, path: string[] | string): AnyDuringMigration {
    return options.inferOptionalNumberValue(path);
  }

  /**
   * @param value The value to be converted to string.
   * @return the string representation.
   */
  valueToStringInternal(value: AnyDuringMigration): string {
    const formatter = this.getFormatter()!;
    return formatter.formatValue(value as number);
  }

  /**
   * @param value The value as the underlying data type.
   * @return The value as a number.
   */
  valueToNumberInternal(value: Value): number | null {
    return valueNumberConverter.numberToNumber(value);
  }

  numberToValueInternal(num: number): Value {
    return valueNumberConverter.numberFromNumber(num);
  }

  /**
   * Creator method used by scale repository for creating this class
   * @return The built scale.
   */
  static buildNumericValueScale(): ValueScale {
    return new NumericValueScale();
  }
}
