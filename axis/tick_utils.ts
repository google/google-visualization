/**
 * @fileoverview This file provides utility functions for tick selection.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import * as util from '../common/util';

/**
 * Indicates how many magnitudes of 10 we are willing to go below the default
 * basic unit size in our search of tick positionings.
 */
const MAX_SEARCH_DEPTH = 5;

/**
 * Given a range of real numbers, finds a range within the given margins whose
 * boundaries are round numbers and can be divided by a given number in a way
 * that the division points are also round numbers. Tries to make the new range
 * as close as possible to the given range (minimize the margins).
 * Accepts a scoring function for scoring and comparing tick positionings.
 *
 * Tries to follow a list of constraints in the following order:
 * <ul><li>Chosen endpoints must be within the given margins.</li>
 *     <li>If zero is somewhere in the range - there must be a tick on it.</li>
 *     <li>If zero is not in the range then the whole range must be either
 *         positive or negative - cannot be mixed.</li>
 * </ul>
 * Does so by first calling searchForRoundTickPositioning with exact same
 * parameters. If that fails, returns the result of calling
 * robustFindTicksAroundRange with the start target, the end target and the
 * number of sections.
 *
 * We add a margin below the min value and above the max value and the input
 * contains 4 parameters which constrain the relative size of these two margins
 * (both from below and from above).
 * All such constraints are expected to be between -1 and 1. The lower bound
 * for each margin must be smaller or equal to the upper bound and the sum of
 * the two upper bounds must be strictly smaller than 1.
 *
 * The margins may thus be negative in which case the resulting range does not
 * completely cover the input range. Mainly to help deal with ranges ending at
 * numbers such as 100.0000001 for which we're ok with the range ending at 100.
 *
 * @param startTarget The first tick target point.
 * @param endTarget The last tick target point.
 * @param startInsideMargin The fraction of the final range allowed between the
 *     start target and the first tick when the tick is inside the target range.
 * @param startOutsideMargin The fraction of the final range allowed between the
 *     start target and the first tick when the tick is outside the target
 *     range.
 * @param endInsideMargin The fraction of the final range allowed between the
 *     end target and the last tick when the tick is inside the target range.
 * @param endOutsideMargin The fraction of the final range allowed between the
 *     end target and the last tick when the tick is outside the target range.
 * @param numberOfSections The number of sections the range would eventually be
 *     divided into. All suggested positionings would be such that divide nicely
 *     by this number.
 * @param scoringFunction The scoring function used for evaluating one
 *     positioning. Args are startPoint, endPoint, and unit. A higher score is
 *     better.
 *
 * @return The highest scoring tick positioning consisting of the starting point
 *     and the ending point.
 */
export function positionTicksAroundRange(
  startTarget: number,
  endTarget: number,
  startInsideMargin: number,
  startOutsideMargin: number,
  endInsideMargin: number,
  endOutsideMargin: number,
  numberOfSections: number,
  scoringFunction: (p1: number, p2: number, p3: number) => number,
): {startPoint: number; endPoint: number} {
  // Check pre conditions.
  const totalOutsideMargin = endOutsideMargin + startOutsideMargin;
  // TODO: remove the following assert and fix instead.
  asserts.assert(
    endTarget > startTarget,
    'End target must be strictly greater than start target',
  );
  asserts.assert(
    totalOutsideMargin < 1,
    'Total outside margin must be smaller than 1',
  );
  asserts.assert(
    startInsideMargin <= startOutsideMargin,
    'start inside margin must be smaller than start outside margin',
  );
  asserts.assert(
    endInsideMargin <= endOutsideMargin,
    'end inside margin must be smaller than end outside margin',
  );
  // Try scanning for round ranges and only if failed in doing so degrade to
  // robust version.
  return (
    searchForRoundTickPositioning(
      startTarget,
      endTarget,
      startInsideMargin,
      startOutsideMargin,
      endInsideMargin,
      endOutsideMargin,
      numberOfSections,
      scoringFunction,
    ) || robustFindTicksAroundRange(startTarget, endTarget, numberOfSections)
  );
}

/**
 * Scans many tick positionings to find one that scores best according to
 * function.
 * The general strategy is to use as tick sizes - whole multiples of a basic
 * unit that is 1 / 20 of the largest power of 10 that is smaller or equal to
 * the range size.
 * For each such tick size, many starting points are considered, for each the
 * endPoint is easily calculated and the (startPoint, endPoint) couple is scored
 * using the provided scoring function. The couple with the highest score is
 * returned.
 * Accepts same arguments as positionTicksAroundRange and is called by it only.
 * @see positionTicksAroundRange
 * @param startTarget The first tick target point.
 * @param endTarget The last tick target point.
 * @param startInsideMargin The fraction of the final range allowed between the
 *     start target and the first tick when the tick is inside the target range.
 * @param startOutsideMargin The fraction of the final range allowed between the
 *     start target and the first tick when the tick is outside the target
 *     range.
 * @param endInsideMargin The fraction of the final range allowed between the
 *     end target and the last tick when the tick is inside the target range.
 * @param endOutsideMargin The fraction of the final range allowed between the
 *     end target and the last tick when the tick is outside the target range.
 * @param numberOfSections The number of sections the range would eventually be
 *     divided into. All suggested positionings would be such that divide nicely
 *     by this number.
 * @param scoringFunction The scoring function used for evaluating one
 *     positioning. Args are startPoint, endPoint, and unit.  A higher score is
 *     better.
 * @return The highest scoring tick positioning consisting of the starting point
 *     and the ending point.
 */
export function searchForRoundTickPositioning(
  startTarget: number,
  endTarget: number,
  startInsideMargin: number,
  startOutsideMargin: number,
  endInsideMargin: number,
  endOutsideMargin: number,
  numberOfSections: number,
  scoringFunction: (p1: number, p2: number, p3: number) => number,
): {startPoint: number; endPoint: number} | null {
  const rangeSize = endTarget - startTarget;
  if (rangeSize <= 0) {
    return null;
  }
  const magnitude = Math.floor(Math.log(rangeSize) / Math.log(10));
  // Now find the largest power of 10 such that there exist tick positionings
  // that satisfy the constraints and that are multiples of 5 times that base.
  // Once such a base is found, all positionings that match that base and in
  // addition all positionings that match 1/10 of that base (it is important to
  // scan at least two bases, see comment below) are scored and the best scoring
  // one is chosen.
  const units = util.rangeMap(MAX_SEARCH_DEPTH, (i) => ({
    base: Math.pow(10, magnitude - i),
    coefficient: 5,
  }));
  let possiblePositionings: AnyDuringAssistedMigration[] = [];
  let foundSome = false;
  for (let i = 0; i < units.length; ++i) {
    const unit = units[i];
    // Convert all values to unit scale (divide by unit).
    const normalizedStartTarget = startTarget / (unit.base * unit.coefficient);
    const normalizedEndTarget = endTarget / (unit.base * unit.coefficient);
    // Now we can work with integers.
    // Generate some possible positionings.
    const unitPositionings = listIntegerPositionedTickPositionings(
      normalizedStartTarget,
      normalizedEndTarget,
      startInsideMargin,
      startOutsideMargin,
      endInsideMargin,
      endOutsideMargin,
      numberOfSections,
    );
    possiblePositionings = possiblePositionings.concat(
      unitPositionings.map((positioning) => ({unit, positioning})),
    );
    if (foundSome) {
      // Notice we check for the previous state of findSome and only update
      // foundSome after the 'if'. The idea is that possible positioning include
      // positioning specified in at least two units. That way we avoid cases
      // where a very bulky unit is chosen without considering a finer one. Eg:
      // [-10,5,0,5] instead of (-6,-3,0,3) for the range (-6,3) because the
      // former is specified in units of 5 and the latter in units of 0.5.
      break;
    }
    foundSome = unitPositionings.length !== 0;
  }
  // Scan all positionings and score them, finding the best scoring positioning.
  // Every member of possiblePositionings is actually a few possible
  // positionings since every sectionSize can have a few possible starting
  // points.
  let bestPositioning = {score: -Infinity, positioning: null};
  bestPositioning = possiblePositionings.reduce(
    (bestPositioningYet, candidate) => {
      const unit = candidate.unit;
      const positioning = candidate.positioning;
      let lastStartPoint = null;

      for (
        let normalizedStartPoint = Number(positioning.minStartPoint);
        normalizedStartPoint <= positioning.maxStartPoint &&
        lastStartPoint !== normalizedStartPoint;
        lastStartPoint = normalizedStartPoint,
          normalizedStartPoint += positioning.offsetStep
      ) {
        const startPoint = Math.round(unit.coefficient * normalizedStartPoint);
        const endPoint = Math.round(
          unit.coefficient *
            (normalizedStartPoint + numberOfSections * positioning.sectionSize),
        );
        // Note: tickSize = (endPoint - startPoint) / numberOfSections;
        const score = scoringFunction(startPoint, endPoint, unit.base);
        if (score > bestPositioningYet.score) {
          bestPositioningYet = {
            score,
            positioning: {
              startPoint: startPoint * unit.base,
              endPoint: endPoint * unit.base,
            },
          };
        }
      }
      return bestPositioningYet;
    },
    bestPositioning,
  );

  return bestPositioning.positioning;
}

/**
 * Same as searchForRoundTickPositioning  but instead of aiming for
 * roundness of boundaries, aims for robustness and never fails. This function
 * is used as a graceful degradation of the above. Therefore, it only requires
 * the start value, the end value and the number of sections.
 * @see searchForRoundTickPositioning
 * @param start The first tick target point.
 * @param end The last tick target point.
 * @param numberOfSections The number of sections the range would eventually be
 *     divided into. All suggested positionings would be such that divide nicely
 *     by this number.
 * @return The tick positioning consisting of the starting point and the ending
 *     point.
 */
export function robustFindTicksAroundRange(
  start: number,
  end: number,
  numberOfSections: number,
): {startPoint: number; endPoint: number} {
  if (start >= 0 || end <= 0 || numberOfSections === 1) {
    // In these cases we do not have to make sure 0 is a tick,
    // so we just divide the range into sections of equal size,
    // not taking roundness of tick values into account at all.
    return {startPoint: start, endPoint: end};
  }
  // In this case we have to make sure 0 is a tick
  //
  // n - number of sections
  // M - end value
  // m - abs(start value)
  // s - range size (s = M + m)
  //
  // n * (M/s) is a float value equal to the number of sections above the 0
  // in the theoretical case of non-integer number of sections.
  // We therefore round it to the nearest integer value, but make sure that
  // the number of sections is not 0 or n (n implies that the number of sections
  // below the 0 is 0).
  const sectionsAboveZero = Math.max(
    1,
    Math.min(
      numberOfSections - 1,
      Math.round(numberOfSections * (end / (end - start))),
    ),
  );
  const sectionsBelowZero = numberOfSections - sectionsAboveZero;
  // a - number of sections above the 0
  // b - number of sections below the 0
  // a + b = n
  //
  // We choose the section size to be max(M/a, m/b).
  // This way the section size divides either M or m, so 0 has to be a tick.
  // Choosing the max of the two means the entire [-m, M] range is covered.
  const sectionSize = Math.max(
    end / sectionsAboveZero,
    -start / sectionsBelowZero,
  );
  return {
    startPoint: -sectionsBelowZero * sectionSize,
    endPoint: sectionsAboveZero * sectionSize,
  };
}

/**
 * Lists all possible integer tick positionings around a given range with the
 * same constraints as searchForRoundTickPositioning.
 * @see searchForRoundTickPositioning.
 * @param startTarget The first tick target point.
 * @param endTarget The last tick target point.
 * @param startInsideMargin The fraction of the final range allowed between the
 *     start target and the first tick when the tick is inside the target range.
 * @param startOutsideMargin The fraction of the final range allowed between the
 *     start target and the first tick when the tick is outside the target
 *     range.
 * @param endInsideMargin The fraction of the final range allowed between the
 *     end target and the last tick when the tick is inside the target range.
 * @param endOutsideMargin The fraction of the final range allowed between the
 *     end target and the last tick when the tick is outside the target range.
 * @param numberOfSections Number of sections that all listed ranges should be
 *     able to be divided by without breaking the constraint that all section
 *     borders are integer values.
 * @return An array of possible integer tick sizes, each accompanied with a
 *     range of possible starting points denoted by minimal starting point,
 *     maximal starting point and offsetStep - the spacing between possible
 *     starting points.
 */
export function listIntegerPositionedTickPositionings(
  startTarget: number,
  endTarget: number,
  startInsideMargin: number,
  startOutsideMargin: number,
  endInsideMargin: number,
  endOutsideMargin: number,
  numberOfSections: number,
): Array<{
  sectionSize: number;
  minStartPoint: number;
  maxStartPoint: number;
  offsetStep: number;
}> {
  const possiblePositionings: AnyDuringAssistedMigration[] = [];
  if (numberOfSections < 1) {
    return possiblePositionings;
  }

  const targetRangeSize = endTarget - startTarget;
  const totalInsideMargin = startInsideMargin + endInsideMargin;
  const totalOutsideMargin = startOutsideMargin + endOutsideMargin;
  // Find lower bound and upper bound using the following general inequality:
  // (section * n) * (1 - outMargin) <= irSize <= (section * n) * (1 - inMargin)
  // where
  // * section is the integer section size we are trying to bound,
  // * n is number of sections,
  // * inMargin is totalInsideMargin,
  // * outMargin is totalOutsideMargin and
  // * irSize is targetRangeSize.
  const minSectionSize = Math.ceil(
    targetRangeSize / (1 - totalInsideMargin) / numberOfSections,
  );
  const maxSectionSize = Math.floor(
    targetRangeSize / (1 - totalOutsideMargin) / numberOfSections,
  );

  // Scan all possible sizes from smallest to largest.
  for (
    let sectionSize = minSectionSize;
    sectionSize < Infinity && sectionSize <= maxSectionSize;
    ++sectionSize
  ) {
    if (scoreNumber(sectionSize) > 4) {
      // Skip bad numbers.
      continue;
    }
    // The size of the whole range covered by sections.
    const resultRangeSize = sectionSize * numberOfSections;

    // For every tick sectionSize, find all possible starting points using the
    // following inequalities (where rSize is resultRangeSize):
    //
    // rSize * startInside <= startTarget - startPoint <= rSize * startOutside
    // rSize * endInside <= endPoint - endTarget =
    //   startPoint + rSize - endTarget <= rSize * endOutside
    let minStartPoint = Math.ceil(
      Math.max(
        startTarget - startOutsideMargin * resultRangeSize,
        endTarget - (1 - endInsideMargin) * resultRangeSize,
      ),
    );
    let maxStartPoint = Math.floor(
      Math.min(
        startTarget - startInsideMargin * resultRangeSize,
        endTarget - (1 - endOutsideMargin) * resultRangeSize,
      ),
    );
    // TODO: calculate in advance which of the following clauses is hit and
    // use a predefined function.
    let offsetStep = 1;
    if (endTarget > 0 && startTarget < 0) {
      if (numberOfSections > 1) {
        // Make sure zero is a tick (so start point must be a whole multiple of
        // sectionSize.
        // This constraint is not applicable when exactly 1 section is desired.
        minStartPoint = Math.ceil(minStartPoint / sectionSize) * sectionSize;
        maxStartPoint = Math.floor(maxStartPoint / sectionSize) * sectionSize;
        offsetStep = sectionSize;
      }
    } else if (startTarget >= 0) {
      // Make sure all range is above zero.
      minStartPoint = Math.max(0, minStartPoint);
    } else {
      // thus endTarget <= 0
      // Make sure all range is below zero.
      maxStartPoint = Math.min(-resultRangeSize, maxStartPoint);
    }
    if (maxStartPoint - minStartPoint >= 0) {
      possiblePositionings.push({
        sectionSize,
        offsetStep,
        minStartPoint,
        maxStartPoint,
      });
    }
  }
  return possiblePositionings;
}

/**
 * Scores an integer based on the number of digits in its decimal representation
 * ignoring trailing zeros, and whether leading digits are multiples of 2 and 5.
 * A lower score is better here.
 * @param num A number for scoring.
 * @return The score.
 */
export function scoreNumber(num: number): number {
  // Make sure num is an integer, just in case.
  if (Math.round(num) !== num) {
    // Keep a few digits and throw away the rest.
    const log10 = Math.floor(Math.log(num) / Math.log(10));
    if (log10 < 0) {
      num = num / Math.pow(10, log10);
    }
    num = Math.round(num * 10000);
  }

  if (num === 0) {
    return 0;
  }
  if (num < 0) {
    num = -num;
  }

  // Remove trailing zeros.
  while (Math.round(num % 10) === 0) {
    num = Math.round(num / 10);
  }

  // Special scores for 1 and 5.
  if (num === 1 || num === 5) {
    return 0.5;
  }

  // Compute score from the num of remaining digits.
  let score = 2 * Math.floor(Math.log(num) / Math.log(10));

  // Better (lower) score for multiples of 2 and 5.
  score += num % 2;
  score += num % 5 === 0 ? 0 : 2;

  return score;
}

/**
 * Finds the minimum number of significant digits for which min is
 * different than max, up to 6 significant digits for generating ticks (e.g
 * returns 4 for 0.0125 and 0.0156 because both share the first 3 significant
 * digits 0.01)
 */
export function findMinimumSignificantDigits(
  min: number,
  max: number,
  isCompactPattern: boolean,
) {
  // Limiting to 10 significant digits
  const MAX_SIGNIFICANT_DIGITS = 10;

  if (min >= max || !isCompactPattern) {
    return null;
  }

  let absMin = Math.abs(min);
  let absMax = Math.abs(max);
  if (absMin > absMax) {
    absMin = Math.abs(max);
    absMax = Math.abs(min);
  }

  const getFirstNonZeroDigitPosition = (num: number) => {
    if (num <= 0) return -1;

    let firstNonZeroPosition = 0;
    while (num < 1 && firstNonZeroPosition < MAX_SIGNIFICANT_DIGITS - 1) {
      num *= 10;
      firstNonZeroPosition++;
    }
    return firstNonZeroPosition;
  };

  // equal with opposite signs
  if (absMin === absMax) {
    // difference in sign should be suffice
    if (absMax >= 1) return 1;

    // get first non zero position, as -0.002 and +0.002 will have same
    // value (zero) for significant digits <= 3
    return getFirstNonZeroDigitPosition(absMax) + 1;
  }

  if (absMin === 0) {
    return getFirstNonZeroDigitPosition(absMax) + 1;
  }

  const diff = absMax - absMin;
  if (absMin < 1) {
    return getFirstNonZeroDigitPosition(diff) + 1;
  }

  // absMin >= 1
  // Calculate the number of digits in the larger number
  const digitsInNumber = Math.floor(Math.log10(absMax)) + 1;

  // Calculate the number of digits needed to capture the difference
  const digitsInDiff = Math.floor(Math.log10(diff)) + 1;

  // Calculate the significant Digits needed for this pair of numbers
  return Math.min(digitsInNumber - digitsInDiff + 1, MAX_SIGNIFICANT_DIGITS);
}
