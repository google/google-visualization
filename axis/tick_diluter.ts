/**
 * @fileoverview Ticks diluter.
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

import * as googArray from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {TextSkipMode} from '../common/option_types';
import {TextLayout} from '../text/text_utils';
import {CustomPowersOf10} from './custom_powers_of_10';

import {TextItem} from '../visualization/corechart/axis_definition';

/**
 * Calculates tick labels arrangement, and dilutes label visibility to achieve
 * best display. Lets take the following horizontal axis, of a chart that
 * displays some data for each month of the year.
 *
 *    |
 *    |
 *  --+----+----+----+----+----+----+----+----+----+----+----+----+---
 *        J... F... M... A... M... J... J... A... S... O... N... D...
 *
 * As you can see, the ticks are too close to each other, and there's not enough
 * space to show month name - only enough to show the first letter of each month
 * name (plus an ellipsis to indicate the text is truncated). A possible
 * solution is to use two lines, where each line shows alternating labels:
 *
 *    |
 *    |
 *  --+----+----+----+----+----+----+----+----+----+----+----+----+---
 *      January    March      May       July   September  November
 *           February   April     June      August   October   December
 *
 * This looks much better. In the terminology of this class, this is
 * alternation=2 (whereas the default layout has alternation=1). Now what if the
 * ticks were even closer, and even alternation=2 wasn't enough to show
 * reasonable tick labels? The easy answer is to increase the alternation to 3,
 * and so on, but a) we don't necessarily have more space for more lines, and b)
 * it might be not so aesthetically appealing. So the other weapon in our
 * arsenal is skipping. We can show only every Nth label, and so it'll have more
 * room. Example:
 *
 *    |
 *    |
 *  --+----+-+-+-+-+-+-+-+-+-+-+-+---
 *      January   May   September
 *           March    July  November
 *
 * This is alternation=2 plus skip=2. We show every 2nd label, on 2 alternating
 * lines.
 */

interface DesiredTickLines {
  numOfLines: number;
  needTooltip: boolean;
}

/**
 * Constructor for TickDiluter.
 * @unrestricted
 */
export class TickDiluter {
  /** The wrapper around the textutils.calcTextLayout function. */
  private readonly calcTextLayout: (
    p1: string,
    p2: number,
    p3: number,
  ) => TextLayout;

  /**
   * @param totalLength The total length of axis along which the ticks are
   *     positioned (see 'ticks' below).
   * @param ticks The ticks. Each tick has a coordinate field with the pixel
   *     coordinate of the tick and a text field with the label of the tick. The
   *     coordinates live within 'totalLength' (above) and therefore should be
   *     between 0 and totalLength. The difference between every two adjacent
   *     coordinates should be the same.
   * @param firstTickIdx The index of the first tick to display.
   * @param maxLines The maximum number of lines per tick label.
   * @param maxAltCount The maximum allowed alternation.
   * @param forceSkip The skip value to be used. Zero means automatically try to
   *     find best value.
   * @param skipMode See description of getFirstTickIdx().
   * @param minSpacing The minimum allowed spacing between tick labels.
   * @param allowContainerBoundaryCufoff Can or can't the text be cut off by the
   *     container boundaries.
   * @param calcTextLayout A function that accepts some text, width and number
   *     of lines (in this order), and returns the text layout, as
   *     gviz.canviz.textutils.calcTextLayout does. In fact, this function is a
   *     wrapper around textutils.calcTextLayout, except for testing purposes.
   */
  constructor(
    private readonly totalLength: number,
    private readonly ticks: TextItem[],
    private readonly firstTickIdx: number,
    private readonly maxLines: number,
    private readonly maxAltCount: number,
    private readonly forceSkip: number,
    private readonly skipMode: TextSkipMode,
    private readonly minSpacing: number,
    private readonly allowContainerBoundaryCufoff: boolean,
    calcTextLayout: (p1: string, p2: number, p3: number) => TextLayout,
  ) {
    /** The wrapper around the textutils.calcTextLayout function. */
    this.calcTextLayout = calcTextLayout;
  }

  /**
   * Calculates the first visible tick index taking into account the skip mode.
   * If skipping is to be attached to the start, there's nothing to do, and
   * return 'idx' as is. If it's to be attached to the end, return the start
   * index such that the last visible tick index will be 'idx' steps away from
   * the end. So if idx was 1, it means we want the one-before-last tick to be
   * visible, and the index of the first visible tick should be updated
   * accordingly.
   * @param idx The index of the first tick to display.
   * @param numOfTicks The number of ticks.
   * @param compositeSkip See getEffectiveInterval for doc.
   * @param skipMode See above.
   * @return See above.
   */
  static getFirstTickIdx(
    idx: number,
    numOfTicks: number,
    compositeSkip: number,
    skipMode: TextSkipMode,
  ): number {
    switch (skipMode) {
      case TextSkipMode.ATTACH_TO_END:
        return (numOfTicks - 1 - idx) % compositeSkip;
      case TextSkipMode.ATTACH_TO_START:
      default:
        return idx;
    }
  }

  /**
   * Calculates the width given to each tick label.
   * @param compositeSkip The chosen tick skip, for every alternation line
   *     separately. For example, if skip is 3, and alternation is 2, on the
   *     first alternation line ticks 0,6,... will be displayed and on the
   *     second alternation line ticks 3,9,... will be displayed. This makes the
   *     compositeSkip 6 (alternation * skip).
   * @return The width given to each tick label.
   */
  private getEffectiveInterval(compositeSkip: number): number {
    if (this.ticks.length <= 1) {
      return this.totalLength;
    }
    const tick0 = this.ticks[0].coordinate;
    const tick1 = this.ticks[1].coordinate;
    assert(tick0 != null && tick1 != null);
    const interval = Math.abs(tick1! - tick0!);
    return Math.max(0, interval * compositeSkip - this.minSpacing);
  }

  /**
   * Decides if the given alternation/skip combination is too large. This is
   * done by calculating the number of tick labels that are to be displayed in
   * the first alternation, and making sure there are at least 2 of them. If
   * there were less than 2 ticks to begin with, there's also no need to enlarge
   * the skip.
   * @param firstTickIdx The index of the first tick to display.
   * @param altCount The number of alternations.
   * @param skip The chosen skip.
   * @return Returns true if alt*skip is too large, false otherwise.
   */
  private altSkipTooLarge(
    firstTickIdx: number,
    altCount: number,
    skip: number,
  ): boolean {
    const numberOfDisplayedTicks = Math.ceil(
      (this.ticks.length - firstTickIdx) / (altCount * skip),
    );
    return this.ticks.length < 2 || numberOfDisplayedTicks < 2;
  }

  /**
   * Calculates information for displaying of tick labels, per a given
   * alternation. The information includes:
   *   dataValue {*}: The data value this tick identifies.
   *   coordinate {number}: the X coordinate of the tick label
   *   lineIdx {number}: the index of the line in which this tick is to be
   *                     displayed (for example, if it's to be displayed in the
   *                     third alternation, and the first two took 3 lines each,
   *                     this lineIdx is 6).
   *   text {string}: the text to display
   *   width {number} the width allocated for the text (around 'coordinate')
   *   layout {Object}: the text layout, as returned from
   *                    textutils.calcTextLayout.
   *   needTooltip {boolean}: if this tick needs a tooltip, we need to increase
   *                          skip/alternations.
   * @param firstTickIdx The index of the first tick to display.
   * @param lineIdx The line index of the first line of this tick label. See
   *     above for more explanation.
   * @param compositeSkip See getEffectiveInterval for doc.
   * @param numOfLines Number of lines given to this alternation, which is the
   *     number of lines given to each tick label.
   * @return See above.
   */
  private getTicksInfoForAlt(
    firstTickIdx: number,
    lineIdx: number,
    compositeSkip: number,
    numOfLines: number,
  ): TextItem[] {
    firstTickIdx = TickDiluter.getFirstTickIdx(
      firstTickIdx,
      this.ticks.length,
      compositeSkip,
      this.skipMode,
    );
    const interval = this.getEffectiveInterval(compositeSkip);
    const result = [];

    for (let i = firstTickIdx; i < this.ticks.length; i += compositeSkip) {
      const tick = this.ticks[i];
      // If the tick isn't visible we still want to calculate its layout, which
      // is used for animation, so we set the width to be the interval between
      // ticks. If the tick is visible it can or cannot exceed the boundaries of
      // the container, depending on the allowContainerBoundaryCufoff option.
      const width =
        tick.isVisible &&
        !this.allowContainerBoundaryCufoff &&
        tick.coordinate != null
          ? Math.min(
              // The interval between the ticks:
              interval, // The width as imposed by the left canvas edge:
              tick.coordinate * 2, // The right canvas edge edge:
              (this.totalLength - tick.coordinate) * 2,
            )
          : interval;
      const layout = this.calcTextLayout(tick.text, width, numOfLines);
      let needTooltip = layout.needTooltip;
      if (width < interval) {
        // The 'needTooltip' needs to be based on calcTextLayout that was
        // calculated for the interval between the ticks, and not for interval
        // after trimming to accommodate the canvas area. The reason for this is
        // that 'needTooltip' affects the transition to the alternation, skip
        // and slanted fall-backs. The problem is that if the trimming triggers
        // the need for tooltip, and that causes move to, say, skip, then next
        // iteration, with the skip, will again see 'needTooltip' equals true.
        // Skipping doesn't solve the canvas area problem, and so a canvas area
        // problem shouldn't trigger skipping.
        // 'width' is the interval after trimming, so if it's different than
        // 'interval', calculate again with 'interval', and take 'needTooltip'
        // from it.
        const needTooltipLayout = this.calcTextLayout(
          tick.text,
          interval,
          numOfLines,
        );
        needTooltip = needTooltipLayout.needTooltip;
      }
      result.push({
        dataValue: tick.dataValue,
        isVisible: tick.isVisible,
        optional: tick.optional,
        coordinate: tick.coordinate,
        lineIdx,
        text: tick.text,
        width: layout.maxLineWidth,
        layout,
        needTooltip,
      });
    }

    return result as TextItem[];
  }

  /**
   * Calculates information for displaying of tick labels, for all alternations.
   * See getTicksInfoForAlt as for doc on what this information includes.
   * @param altCount The number of alternations.
   * @param skip The chosen skip.
   * @param numOfLines Number of lines given to all alternations combined.
   * @return See getTicksInfoForAlt for doc.
   */
  private getTicksInfo(
    altCount: number,
    skip: number,
    numOfLines: number,
  ): TextItem[] {
    const compositeSkip = altCount * skip;

    // If altCount is larger than 1, use only a single line per alternation,
    // because more than that doesn't look good.
    const numOfLinesPerAlt = altCount > 1 ? 1 : numOfLines;

    const result: TextItem[] = [];
    for (let i = 0; i < altCount; i++) {
      const ticksInfo = this.getTicksInfoForAlt(
        this.firstTickIdx + i * skip,
        i * numOfLinesPerAlt,
        compositeSkip,
        numOfLinesPerAlt,
      );
      googArray.extend(result, ticksInfo);
    }
    // Ticks should be sorted for the animation to work.
    result.sort((a, b) => (a.coordinate || 0) - (b.coordinate || 0));
    return result;
  }

  /**
   * Calculates the total number of lines needed to show all tick labels, given
   * an alternation and skip. This is the optimistic number of lines, meaning
   * we ignore the fact that space is limited. Also returns whether a tooltip
   * would be necessary for any of the tick labels, given this optimistic number
   * of lines. A tooltip might be necessary because it's possible that even an
   * infinite number of lines won't be enough to show the full label, if the
   * width allocated for it is not enough to accommodate all words in all labels
   * (separately).
   * @param altCount The number of alternations.
   * @param skip The chosen skip.
   * @return, as described above.
   */
  private getDesiredTickLines(
    altCount: number,
    skip: number,
  ): DesiredTickLines {
    const ticksInfo = this.getTicksInfo(altCount, skip, this.maxLines).map(
      (textItem) => {
        return {
          numOfLines: 0,
          needTooltip: textItem.needTooltip || false,
          layoutLinesLength: textItem.layout!.lines.length,
        };
      },
    );
    const reducer = (
      res: DesiredTickLines,
      tickInfo: (typeof ticksInfo)[0],
    ) => {
      const numOfLines = Math.max(res.numOfLines, tickInfo.layoutLinesLength);
      const needTooltip = res.needTooltip || tickInfo.needTooltip;
      return {numOfLines, needTooltip};
    };
    return ticksInfo.reduce(reducer, {numOfLines: 0, needTooltip: false});
  }

  /**
   * Calculates the best possible tick label arrangement, while being
   * optimistic. "Optimistic" means that we ignore that space is limited and
   * assuming we can use as many lines as we want. This is what we'd want to get
   * if space was not an issue, and it's possible that in the end we'll have to
   * settle for less. The criteria for "best" is that all labels are shown
   * completely (no tooltip is needed for any of them). In order to achieve
   * this, we dilute the displayed labels by using alternations and skip, and by
   * that make more space for each label. The algorithm for this is as follows:
   * 1. We first try with no dilution (altCount = 1, skip = 1).
   * 2. If that doesn't work well (some labels need tooltip), we increase
   *    altCount and try again, repeatedly.
   * 3. If that doesn't work well, and we've reached the max allowed altCount,
   *    or there is only one label left on the first alternation, it means we've
   *    increased altCount too much. Stop and go back to the previous altCount
   *    if relevant, and start increasing skip and try again, repeatedly.
   * 4. If that doesn't work well, and we've diluted enough that there is only
   *    one label left, it means we've diluted too much. Go back to the skip
   *    where there were at least 2 labels and go with this, even though some
   *    labels need a tooltip.
   * @return Number of lines needed by all alternations combined.
   */
  calcOptimisticTickArrangement(): {
    altCount: number;
    skip: number;
    numOfLines: number;
  } {
    let altCount = 1;
    let skip = this.forceSkip || 1;

    // First try with both altCount and skip 1.
    let desiredLines = this.getDesiredTickLines(altCount, skip);

    // Then try with increasing altCount and keeping skip as 1.
    let safeAltCount = altCount;
    while (desiredLines.needTooltip && altCount < this.maxAltCount) {
      altCount++;
      if (this.altSkipTooLarge(0, altCount, skip)) {
        break;
      }
      safeAltCount = altCount;
      desiredLines = this.getDesiredTickLines(safeAltCount, skip);
    }

    // After altCount reached its max, try increasing skip.
    let safeSkip = skip;
    if (!this.forceSkip) {
      const totalLengthRequired =
        this.minSpacing * (this.ticks.length / safeAltCount);
      let initialSkip = totalLengthRequired / this.totalLength;
      if (isNaN(initialSkip) || !isFinite(initialSkip) || initialSkip < 1) {
        initialSkip = 1;
      }
      const skipSequence = new CustomPowersOf10(SKIP_INTERVALS);
      skipSequence.floor(initialSkip);
      skip = skipSequence.next();

      while (desiredLines.needTooltip && skip < this.ticks.length) {
        if (this.altSkipTooLarge(0, safeAltCount, skip)) {
          break;
        }
        safeSkip = skip;
        desiredLines = this.getDesiredTickLines(safeAltCount, safeSkip);
        skip = skipSequence.next();
      }
    }

    return {
      altCount: safeAltCount,
      skip: safeSkip,
      numOfLines: desiredLines.numOfLines * safeAltCount,
    };
  }

  /**
   * Calculates information for displaying of tick labels (see getTicksInfo for
   * what this includes) for a given alternation/skip, and also return an
   * 'acceptable' flag to specify whether this alternation/skip combination is
   * acceptable. The definition of "acceptable" can be a matter of taste, but
   * here the definition used is that at most maxAcceptableRatio of tick labels
   * are displayed with a tooltip. Note the difference between "best" which
   * means no tooltip at all, and "acceptable" which means some (according to
   * maxAcceptableRatio) and not none at all. The former is used to calculate
   * the optimistic (no space limitations) arrangement of labels, which the
   * latter is used to calculate the final (realistic) arrangement, when we know
   * how much space we have for the labels.
   * @param altCount The number of alternations.
   * @param skip The chosen skip.
   * @param numOfLines Number of lines given to all alternations combined.
   * @param maxAcceptableRatio The max ratio (in the range [0,1]) of tick labels
   *     that need tooltip, out of all of the tick labels, that is considered
   *     acceptable.
   * @return: whether this alternation/skip combination produced an acceptable
   * ticks info.
   */
  private getTicksInfoWithAcceptableFlag(
    altCount: number,
    skip: number,
    numOfLines: number,
    maxAcceptableRatio: number,
  ): {ticksInfo: TextItem[]; acceptable: boolean} {
    const ticksInfo = this.getTicksInfo(altCount, skip, numOfLines);
    const needTooltipCount = ticksInfo.reduce((count, tickInfo) => {
      const needTooltip = tickInfo.needTooltip ? 1 : 0;
      // tickInfo.needTooltip was needed here, but not needed by the users
      // of this class, so it's deleted.
      delete tickInfo.needTooltip;
      return count + needTooltip;
    }, 0);
    const acceptable =
      needTooltipCount <= ticksInfo.length * maxAcceptableRatio;
    return {ticksInfo, acceptable};
  }

  /**
   * Calculates the best possible tick label arrangement, while being realistic
   * about the space available. The algorithm here is very similar to
   * calcOptimisticTickArrangement_, only that we start with altCount and skip
   * equal to the values calculated for them by the optimistic algorithm, with
   * the constraint that we know how many lines we can actually use, which may
   * be smaller than the ideal number of lines we'd hoped for, so altCount and
   * skip might need to be made larger, in order to find an acceptable
   * arrangement. See getTicksInfoWithAcceptableFlag for what "acceptable"
   * means.
   * @param optimisticAltCount The optimistic number of alternations.
   * @param optimisticSkip The optimistic skip.
   * @param numOfLines Number of lines given to all alternations combined.
   * @param maxAcceptableRatio The max ratio (in the range [0,1]) of tick labels
   *     that need tooltip, out of all of the tick labels, that is considered
   *     acceptable.
   * @return: See getTicksInfo.
   */
  calcFinalTickArrangement(
    optimisticAltCount: number,
    optimisticSkip: number,
    numOfLines: number,
    maxAcceptableRatio: number,
  ): {altCount: number; skip: number; ticksInfo: TextItem[]} {
    const maxAltCount = Math.min(this.maxAltCount, numOfLines);
    let altCount = Math.min(optimisticAltCount, maxAltCount);
    let skip = this.forceSkip || optimisticSkip;

    // First try with both altCount and skip as preferable (optimistic).
    let ticksInfoAcceptable = this.getTicksInfoWithAcceptableFlag(
      altCount,
      skip,
      numOfLines,
      maxAcceptableRatio,
    );

    // Then try with increasing altCount and keeping skip as before.
    let safeAltCount = altCount;
    while (!ticksInfoAcceptable.acceptable && altCount < maxAltCount) {
      altCount++;
      if (this.altSkipTooLarge(0, altCount, skip)) {
        break;
      }
      safeAltCount = altCount;
      ticksInfoAcceptable = this.getTicksInfoWithAcceptableFlag(
        safeAltCount,
        skip,
        numOfLines,
        maxAcceptableRatio,
      );
    }

    // After altCount reached its max, try increasing skip.
    let safeSkip = skip;
    // largest known safe skip so far
    if (!this.forceSkip) {
      const totalLengthRequired =
        this.minSpacing * (this.ticks.length / safeAltCount);
      let initialSkip = totalLengthRequired / this.totalLength;
      if (isNaN(initialSkip) || !isFinite(initialSkip) || initialSkip < 1) {
        initialSkip = 1;
      }
      const skipSequence = new CustomPowersOf10(SKIP_INTERVALS);
      skipSequence.floor(initialSkip);
      skip = skipSequence.next();

      while (!ticksInfoAcceptable.acceptable && skip < this.ticks.length) {
        if (this.altSkipTooLarge(0, safeAltCount, skip)) {
          break;
        }
        safeSkip = skip;
        ticksInfoAcceptable = this.getTicksInfoWithAcceptableFlag(
          safeAltCount,
          safeSkip,
          numOfLines,
          maxAcceptableRatio,
        );
        skip = skipSequence.next();
      }
    }

    return {
      altCount: safeAltCount,
      skip: safeSkip,
      ticksInfo: ticksInfoAcceptable.ticksInfo,
    };
  }
}

/**
 * Array of numbers used in construction of a sequence of intervals
 * when skipping ticks.  e.g. [1, 2, 5] means use those skip numbers,
 * and powers of 10 times those numbers: 10, 20, 50, 100, 200, 500, etc.
 */
const SKIP_INTERVALS: number[] = [1, 2, 3, 4, 5];
