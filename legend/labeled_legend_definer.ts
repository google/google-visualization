/**
 * @fileoverview Labeled legend definer.
 *
 * Calculates the measures needed to draw the labeled legend. A labeled legend
 * is composed out of entries. Each entry elaborates a specific location in the
 * chart, by stretching a straight line from that location into the legend area.
 * Inside the legend area, that line may be broken, and connected into the
 * relevant legend entry. The entry may show text above and below the line.
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
import {Box, clamp} from '@npm//@closure/math/math';
import {Range} from '@npm//@closure/math/range';
import {Vec2} from '@npm//@closure/math/vec2';
import {clone} from '@npm//@closure/object/object';
import {toNumber} from '@npm//@closure/string/string';

import {GOLDEN_RATIO} from '../common/constants';
import {objectsAlmostEqual} from '../common/util';
import {Brush} from '../graphics/brush';
import {Coordinate} from '../math/coordinate';
import {round} from '../math/vector_utils';
import {TextAlign} from '../text/text_align';
import {TextMeasureFunction} from '../text/text_measure_function';
import {TextStyle} from '../text/text_style';
import {calcTextLayout} from '../text/text_utils';
import {
  LabeledLegendDefinition,
  LabeledLegendDefinitionEntry,
} from './labeled_legend_definition';

// tslint:disable:ban-types  Migration

/**
 * The input for the definition process for each entry in the legend.
 * Origin is the Y coordinate of the location which we elaborate.
 *     preferredOrigin is the preferred Y coordinate.
 *     originRange is the range of allowed Y coordinate.
 *     originYToVec is a function that transforms a Y coordinate to a full
 *         vector, X and Y.
 * Above and Below text are placed above and below the line.
 * The "importance" field is used for defining which entry is more important,
 *     in case some of the entries do not fit in the legend area.
 * The "index" field is the index of the legend entry in the complete legend
 * entries list.
 */
export interface EntryInfo {
  preferredOrigin: number;
  originRange: Range;
  originYToVec: (p1: number) => Vec2;
  aboveText: string;
  belowText: string;
  importance: number;
  index: number;
}

/** The alignment of the legend. */
export enum Alignment {
  LEFT = 1,
  RIGHT,
}

/** The maximum number of consecutive attempts to add another label. */
export const MAX_CONSECUTIVE_FAILURES = 15;

/**
 * Defines a labeled legend (see more details in the file overview).
 * @param legendArea The area assigned for the legend.
 * @param textMeasureFunction A function for measuring widths of text objects.
 * @param alignment The alignment of the labels.
 * @param legendTextStyle The text style for the legend. Note that the text
 *     color is overridden.
 * @param entriesInfo The information for each entry in the legend.
 * @return The legend definition.
 */
export function define(
  legendArea: Box,
  textMeasureFunction: TextMeasureFunction,
  alignment: Alignment,
  legendTextStyle: TextStyle,
  entriesInfo: EntryInfo[],
): LabeledLegendDefinition {
  const textWidth = legendArea.right - legendArea.left;
  const aboveTextStyle = clone(legendTextStyle) as TextStyle;
  const belowTextStyle = clone(legendTextStyle) as TextStyle;
  belowTextStyle.color = BELOW_TEXT_COLOR;
  const verticalTextSpacing = legendTextStyle.fontSize / (GOLDEN_RATIO * 2);
  // Each line requires font-size and spacing.
  const aboveTextLineHeight = aboveTextStyle.fontSize + verticalTextSpacing;
  const belowTextLineHeight = belowTextStyle.fontSize + verticalTextSpacing;

  // Calculate vertical positions of labeled legend entries.
  // This includes filtering labels for which we don't have enough vertical
  // space.
  const layout = calcEntriesLayout(
    legendArea,
    textWidth,
    textMeasureFunction,
    aboveTextStyle,
    belowTextStyle,
    verticalTextSpacing,
    entriesInfo,
  );

  // Our definition is essentially an array in which each element describes
  // one entry in the legend.
  const labeledLegendDefinition = [];
  let endPointX;
  let cornerPointX;
  let textAlignment;
  if (alignment === Alignment.RIGHT) {
    endPointX = legendArea.right;
    cornerPointX = legendArea.left;
    textAlignment = TextAlign.END;
  } else {
    assert(alignment === Alignment.LEFT);
    endPointX = legendArea.left;
    cornerPointX = legendArea.right;
    textAlignment = TextAlign.START;
  }
  for (let i = 0; i < entriesInfo.length; ++i) {
    const entryInfo = entriesInfo[i];
    const entryLayout = layout[i];
    if (entryLayout != null) {
      // The entry has space.
      // TODO: Add options to configure startPointRadius, lineColor.

      const aboveTextLayout = calcTextLayout(
        textMeasureFunction,
        entryInfo.aboveText,
        aboveTextStyle,
        textWidth,
        entryLayout.aboveTextLines,
      );
      const belowTextLayout = calcTextLayout(
        textMeasureFunction,
        entryInfo.belowText,
        belowTextStyle,
        textWidth,
        entryLayout.belowTextLines,
      );

      const endPoint = round(new Vec2(endPointX, entryLayout.y));

      labeledLegendDefinition.push({
        startPointRadius: START_POINT_RADIUS,
        startPoint: round(
          entryInfo.originYToVec(
            clamp(
              entryLayout.y,
              entryInfo.originRange.start,
              entryInfo.originRange.end,
            ),
          ),
        ),
        cornerPointX,
        endPoint,
        startPointBrush: new Brush({
          fill: LINE_COLOR,
          fillOpacity: LINE_OPACITY,
        }),
        lineBrush: new Brush({
          stroke: LINE_COLOR,
          strokeWidth: LINE_WIDTH,
          strokeOpacity: LINE_OPACITY,
        }),
        verticalTextSpacing,
        aboveText: {
          text: entryInfo.aboveText,
          textStyle: aboveTextStyle,
          anchor: new Coordinate(endPoint.x, endPoint.y),
          lines: aboveTextLayout.lines.map((line, i) => ({
            x: 0,
            y: (i - aboveTextLayout.lines.length) * aboveTextLineHeight,
            length: aboveTextLayout.maxLineWidth,
            text: line,
          })),
          paralAlign: textAlignment,
          perpenAlign: TextAlign.START,
          tooltip: aboveTextLayout.needTooltip ? entryInfo.aboveText : '',
          angle: 0,
        },
        aboveTextStyle,
        belowText: {
          text: entryInfo.belowText,
          textStyle: belowTextStyle,
          anchor: new Coordinate(endPoint.x, endPoint.y),
          lines: belowTextLayout.lines.map((line, i) => ({
            x: 0,
            y: (i + 1) * belowTextLineHeight,
            length: belowTextLayout.maxLineWidth,
            text: line,
          })),
          paralAlign: textAlignment,
          perpenAlign: TextAlign.END,
          tooltip: belowTextLayout.needTooltip ? entryInfo.belowText : '',
          angle: 0,
        },
        belowTextStyle,
        alignment: textAlignment,
        index: entryInfo.index,
      });
    }
  }

  return labeledLegendDefinition as LabeledLegendDefinition;
}

/**
 * For each legend entry, calculates:
 * - whether it should be visible at all
 * - the Y coordinate of the end point
 * - the number of lines allocated for the above-text
 * - the number of lines allocated for the below-text
 * Performs several attempts to achieve this end. After each attempt, if not all
 * text lines for all entries could fit it, picks the lowest-importance entry of
 * those entries which didn't manage to get all their text lines in, and throws
 * one of its text lines. Then try again.
 * @param legendArea The area assigned for the legend.
 * @param textWidth The width allocated to the text.
 * @param textMeasureFunction A function for measuring widths of text objects.
 * @param aboveTextStyle The test style of the above-text.
 * @param belowTextStyle The test style of the below-text.
 * @param verticalTextSpacing The vertical space between text elements.
 * @param entriesInfo The information for each entry in the legend.
 * @return For each entry which is visible, the y value in which to locate this
 *     interval, and the number of lines allocated for the above/below texts.
 *     All these under a key that is the index of that entry in entriesInfo.
 */
function calcEntriesLayout(
  legendArea: Box,
  textWidth: number,
  textMeasureFunction: TextMeasureFunction,
  aboveTextStyle: TextStyle,
  belowTextStyle: TextStyle,
  verticalTextSpacing: number,
  entriesInfo: EntryInfo[],
): {
  [key: number]: {y: number; aboveTextLines: number; belowTextLines: number};
} {
  // Each line requires font-size and spacing.
  const aboveTextLineHeight = aboveTextStyle.fontSize + verticalTextSpacing;
  const belowTextLineHeight = belowTextStyle.fontSize + verticalTextSpacing;

  // Each interval accounts for the vertical space of an entry in the legend.
  const intervals = entriesInfo.map((entryInfo, idx) => {
    const aboveTextLayout = calcTextLayout(
      textMeasureFunction,
      entryInfo.aboveText,
      aboveTextStyle,
      textWidth,
      Infinity,
    );
    const belowTextLayout = calcTextLayout(
      textMeasureFunction,
      entryInfo.belowText,
      belowTextStyle,
      textWidth,
      Infinity,
    );
    return {
      entryId: idx,
      preferredAnchorPosition: entryInfo.preferredOrigin,
      anchorPosition: entryInfo.preferredOrigin,
      aboveTextLines: aboveTextLayout.lines.length,
      belowTextLines: belowTextLayout.lines.length,
      aboveSpacing: verticalTextSpacing,
      belowSpacing: verticalTextSpacing,
    };
  });

  // Sort the intervals by their anchor positions, to prepare for calling
  // calcEntriesLayoutAttempt_.
  intervals.sort((i1, i2) => i1.anchorPosition - i2.anchorPosition);

  // Start with empty list, adding the most important intervals first,
  // one at a time, until no more fit.

  // Index the intervals by the importance of the entries they elaborate, so if
  // not everything can fit, drop the lowest importance stuff first.
  const remainingIntervals = googArray.clone(intervals);
  remainingIntervals.sort((i1, i2) => {
    const entryInfo1 = entriesInfo[i1.entryId];
    const entryInfo2 = entriesInfo[i2.entryId];
    return entryInfo1.importance - entryInfo2.importance;
  });

  const workingIntervals = [];
  if (remainingIntervals.length > 0) {
    workingIntervals.push(remainingIntervals.pop());
  }

  let lastAddedInterval = null;
  let numFailures = 0;
  const maxFailures = MAX_CONSECUTIVE_FAILURES;
  let result;
  // The conditional assignment is a bit complex to refactor.
  // tslint:disable-next-line:no-conditional-assignment
  while (
    ((result = calcEntriesLayoutAttempt(
      legendArea,
      aboveTextLineHeight,
      belowTextLineHeight,
      entriesInfo,
      workingIntervals as IntervalTypedef[],
      false,
    )),
    !(
      remainingIntervals.length === 0 ||
      (result.unableToFitAllTextLines && numFailures > maxFailures)
    ))
  ) {
    if (result.unableToFitAllTextLines) {
      numFailures++;
      if (lastAddedInterval) {
        // Remove the last added interval that didn't work.
        googArray.remove(workingIntervals, lastAddedInterval);
      }
    } else {
      numFailures = 0;
    }

    // Try adding another interval.
    lastAddedInterval = remainingIntervals.pop();
    workingIntervals.push(lastAddedInterval);

    // Sort all the intervals by their anchor positions,
    // to prepare for calling calcEntriesLayoutAttempt_.

    workingIntervals.sort((i1, i2) => i1!.anchorPosition - i2!.anchorPosition);
  }

  if (result.unableToFitAllTextLines && lastAddedInterval) {
    // Remove the last added interval that didn't work.
    googArray.remove(workingIntervals, lastAddedInterval);
    // Need to layout again in case the final attempt below fails.
    result = calcEntriesLayoutAttempt(
      legendArea,
      aboveTextLineHeight,
      belowTextLineHeight,
      entriesInfo,
      workingIntervals as IntervalTypedef[],
      false,
    );
  }

  // After a solution was found, perform one last run of the algorithm, only to
  // fine tune the final position of the anchors, to make it as close to the
  // preferred origin point as possible. This constraint was neglected in the
  // previous runs due to other constraints having higher (yet not highest)
  // priority. In this last run we add this constraint, but make all other
  // constraints have high priority, to prevent it from messing up the results.
  const result2 = calcEntriesLayoutAttempt(
    legendArea,
    aboveTextLineHeight,
    belowTextLineHeight,
    entriesInfo,
    workingIntervals as IntervalTypedef[],
    true,
  );
  if (!result2.unableToFitAllTextLines) {
    // In theory, result2.unableToFitAllTextLines should always be false at this
    // point. We check anyway, because inherent inaccuracies of the algorithm,
    // and the "assume 90% of a line is considered a full line" stuff we do in
    // calcEntriesLayoutAttempt_.
    result = result2;
  }

  return result.layout;
}

/**
 * An intermediate data structure used by the layout algorithm. Each legend
 * entry that has not been dropped is represented by an interval.
 * entryId: the index of the corresponding entry in the entriesInfo array.
 * preferredAnchorPosition: the preferred Y coordinate of the entry's anchor.
 * anchorPosition: the starting Y coordinate of the entry's anchor.
 * aboveTextLines: number of text lines above the anchor.
 * belowTextLines: number of text lines below the anchor.
 * aboveSpacing: amount of spacing at the top of the interval (above all lines).
 *     Used to create some space between this interval and the interval above
 *     it, if there is such an interval.
 * belowSpacing: amount of spacing at the bottom of the interval (below all
 *     lines). Used to create some space between this interval and the interval
 *     below it, if there is such an interval.
 */
interface IntervalTypedef {
  entryId: number;
  preferredAnchorPosition: number;
  anchorPosition: number;
  anchorRange: Range;
  y: number;
  aboveTextLines: number;
  belowTextLines: number;
  aboveSpacing: number;
  belowSpacing: number;
  unableToFitAllTextLines: boolean;
}

/**
 * Performs a single attempt of calculating the layout of the legend entries, as
 * described in calcEntriesLayout.
 * @param legendArea The area assigned for the legend.
 * @param aboveTextLineHeight The height of a single line (including spacing) of
 *     the above-text.
 * @param belowTextLineHeight The height of a single line (including spacing) of
 *     the below-text.
 * @param entriesInfo The information for each entry in the legend.
 * @param intervals An array of intervals, one for each of the legend entries.
 *     The intervals should be sorted (ascending) by their anchor position.
 * @param striveForPreferredAnchorPosition Whether the algorithm should try to
 *     move the anchor positions back to their initial position. This effort
 *     should be weaker than all other efforts, so it's applied only after
 *     everything else is settled.
 * @return The result of this attempt. Contains a global failure flag
 *     (unableToFitAllTextLines) and an object with the actual results.
 */
function calcEntriesLayoutAttempt(
  legendArea: Box,
  aboveTextLineHeight: number,
  belowTextLineHeight: number,
  entriesInfo: EntryInfo[],
  intervals: IntervalTypedef[],
  striveForPreferredAnchorPosition: boolean,
): {
  layout: {
    [key: number]: {
      y: number;
      aboveTextLines: number;
      belowTextLines: number;
      unableToFitAllTextLines: boolean;
    };
  };
  unableToFitAllTextLines: boolean;
} {
  // Update the spacing of the first/last intervals - they have no adjacent
  // interval so they need no inter-interval spacing. It's possible that an
  // interval that was not an edge interval became an edge interval after its
  // adjacent interval was removed. Hence the need to update these values.
  if (intervals.length > 0) {
    intervals[0].aboveSpacing = 0;
    googArray.peek(intervals).belowSpacing = 0;
  }

  // Update the anchor position range of the intervals. An interval's anchor
  // range is calculated based on the interval's adjacent intervals, and if some
  // of those adjacent intervals were removed, this interval now has new
  // neighbors, and the range needs updating.
  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const prevInterval = intervals[i - 1];
    const anchorRangeStart = prevInterval
      ? entriesInfo[prevInterval.entryId].originRange.start +
        MIN_VERTICAL_LINE_SPACING
      : legendArea.top;
    const nextInterval = intervals[i + 1];
    const anchorRangeEnd = nextInterval
      ? entriesInfo[nextInterval.entryId].originRange.end -
        MIN_VERTICAL_LINE_SPACING
      : legendArea.bottom;
    // Note that after narrowing the range by twice MIN_VERTICAL_LINE_SPACING,
    // it's possible that the preferredAnchorPosition was left outside the range
    // (if the neighbor interval is small and MIN_VERTICAL_LINE_SPACING is
    // large), so enlarge the range to contain it.
    interval.anchorRange = new Range(
      Math.min(interval.preferredAnchorPosition, anchorRangeStart),
      Math.max(interval.preferredAnchorPosition, anchorRangeEnd),
    );
  }

  const positions = calcEntriesPosition(
    legendArea,
    aboveTextLineHeight,
    belowTextLineHeight,
    intervals,
    striveForPreferredAnchorPosition,
  );
  let someEntryUnableToFitAllTextLines = false;
  const layout: {[key: number]: IntervalTypedef} = {};
  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const position = positions[i];

    const abovePartAvailableForText =
      position.anchor - position.top - interval.aboveSpacing;
    const belowPartAvailableForText =
      position.bottom - position.anchor - interval.belowSpacing;
    let actualAboveTextLines = abovePartAvailableForText / aboveTextLineHeight;
    let actualBelowTextLines = belowPartAvailableForText / belowTextLineHeight;

    // The algorithm we use is not 100% accurate, so even if we request 2 text
    // lines, and there is enough room for it, the result might be 1.95 lines,
    // or something like that. Theoretically, 1.95 lines are not enough to draw
    // 2 lines, so only one line should be drawn (the Math.floor call). This
    // makes sense for cases where the result is substantially far than the next
    // integer, but for 1.95 it's silly, so to overcome this issue, anything
    // that is epsilon smaller than an integer is considered as that integer.
    const epsilon = 0.1;
    actualAboveTextLines = Math.floor(actualAboveTextLines + epsilon);
    actualBelowTextLines = Math.floor(actualBelowTextLines + epsilon);

    const unableToFitAllTextLines =
      actualAboveTextLines < interval.aboveTextLines ||
      actualBelowTextLines < interval.belowTextLines;
    someEntryUnableToFitAllTextLines =
      someEntryUnableToFitAllTextLines || unableToFitAllTextLines;

    layout[interval.entryId] = {
      y: position.anchor,
      aboveTextLines: actualAboveTextLines,
      belowTextLines: actualBelowTextLines,
      unableToFitAllTextLines,
    } as IntervalTypedef;
  }
  return {
    layout,
    unableToFitAllTextLines: someEntryUnableToFitAllTextLines,
  };
}

/**
 * Given a description of the different entries that should be fit in the legend
 * area (the intervals they occupy), calculates the final position of the
 * entries. It's a helper function for the calcEntriesLayoutAttempt function
 * above, that uses simulateForceSystem for implementation.
 * @param legendArea The area assigned for the legend.
 * @param aboveTextLineHeight The height of a single line (including spacing) of
 *     the above-text.
 * @param belowTextLineHeight The height of a single line (including spacing) of
 *     the below-text.
 * @param intervals See calcEntriesLayoutAttempt.
 * @param striveForPreferredAnchorPosition Whether the algorithm should try to
 *     move the anchor positions back to their initial position. If true, this
 *     force should be the only one that is relaxed over time.
 * @return An array of identical size to intervals, where each element is an
 *     object containing the final position and size of that legend entry
 *     (anchor, top, bottom).
 */
function calcEntriesPosition(
  legendArea: Box,
  aboveTextLineHeight: number,
  belowTextLineHeight: number,
  intervals: IntervalTypedef[],
  striveForPreferredAnchorPosition: boolean,
): Array<{anchor: number; top: number; bottom: number}> {
  const getAbovePart = (interval: IntervalTypedef) =>
    interval.aboveTextLines * aboveTextLineHeight +
    Number(interval.aboveSpacing);
  const getBelowPart = (interval: IntervalTypedef) =>
    interval.belowTextLines * belowTextLineHeight +
    Number(interval.belowSpacing);

  const initialState = intervals.map((interval) => ({
    anchor: interval.anchorPosition,
    top: interval.anchorPosition - getAbovePart(interval),
    bottom: interval.anchorPosition + getBelowPart(interval),
  }));

  const forceFuncs = [];

  // The force that pushes the TOP variables in order to avoid collision with
  // whatever is above it.
  forceFuncs.push(
    (
      state: AnyDuringMigration,
      idx: AnyDuringMigration,
      relaxationCoef: number,
    ) => {
      const topPos = state[idx].top;
      // tslint:disable-next-line:triple-equals  Must use == here.
      if (idx == 0) {
        const topExceed = Math.max(legendArea.top - topPos, 0);
        return {top: topExceed};
      } else {
        const neighborIdx = toNumber(idx) - 1;
        const bottomPosOfNeighbor = state[neighborIdx].bottom;
        const overlap = Math.max(bottomPosOfNeighbor - topPos, 0);
        return {top: overlap / 2};
      }
    },
  );

  // The force that pushes the BOTTOM variables in order to avoid collision with
  // whatever is below it.
  forceFuncs.push(
    (
      state: AnyDuringMigration,
      idx: AnyDuringMigration,
      relaxationCoef: number,
    ) => {
      const bottomPos = state[idx].bottom;
      // tslint:disable-next-line:triple-equals  Must use == here.
      if (idx == intervals.length - 1) {
        const bottomExceed = Math.min(legendArea.bottom - bottomPos, 0);
        return {bottom: bottomExceed};
      } else {
        const neighborIdx = toNumber(idx) + 1;
        const topPosOfNeighbor = state[neighborIdx].top;
        const overlap = Math.min(topPosOfNeighbor - bottomPos, 0);
        return {bottom: overlap / 2};
      }
    },
  );

  // The force that pushed the TOP and ANCHOR variables away from each other in
  // order to create a positive size above-part of the interval, preferably of
  // size large enough to accommodate its desired size.
  forceFuncs.push(
    (
      state: AnyDuringMigration,
      idx: AnyDuringMigration,
      relaxationCoef: number,
    ) => {
      const anchorPos = state[idx].anchor;
      const topPos = state[idx].top;
      const abovePart = anchorPos - topPos;
      const offsetToMakePositiveSize = Math.max(-abovePart, 0);
      const interval = intervals[idx];
      const offsetToMakeDesiredSize = Math.max(
        getAbovePart(interval) - Math.max(abovePart, 0),
        0,
      );
      const force =
        (offsetToMakePositiveSize +
          offsetToMakeDesiredSize *
            (striveForPreferredAnchorPosition ? 1 : relaxationCoef)) /
        2;
      return {anchor: force, top: -force};
    },
  );

  // The force that pushed the BOTTOM and ANCHOR variables away from each other
  // in order to create a positive size below-part of the interval, preferably
  // of size large enough to accommodate its desired size.
  forceFuncs.push(
    (
      state: AnyDuringMigration,
      idx: AnyDuringMigration,
      relaxationCoef: number,
    ) => {
      const anchorPos = state[idx].anchor;
      const bottomPos = state[idx].bottom;
      const belowPart = bottomPos - anchorPos;
      const offsetToMakePositiveSize = Math.max(-belowPart, 0);
      const interval = intervals[idx];
      const offsetToMakeDesiredSize = Math.max(
        getBelowPart(interval) - Math.max(belowPart, 0),
        0,
      );
      const force =
        (offsetToMakePositiveSize +
          offsetToMakeDesiredSize *
            (striveForPreferredAnchorPosition ? 1 : relaxationCoef)) /
        2;
      return {anchor: -force, bottom: force};
    },
  );

  // The force that keeps the ANCHOR variables within the limit of their range.
  forceFuncs.push(
    (
      state: AnyDuringMigration,
      idx: AnyDuringMigration,
      relaxationCoef: number,
    ) => {
      const anchorPos = state[idx].anchor;
      const interval = intervals[idx];
      const clampedAnchorPos = clamp(
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'anchorRange' does not exist on type
        //   'IntervalTypedef'. TS2339: Property 'anchorRange' does not
        //   exist on type 'IntervalTypedef'.
        // tslint:disable-next-line:ban-ts-suppressions
        // @ts-ignore
        anchorPos,
        interval.anchorRange.start,
        interval.anchorRange.end,
      );
      return {anchor: clampedAnchorPos - anchorPos};
    },
  );

  // The force that brings the ANCHOR variables back to their preferred
  // position.
  if (striveForPreferredAnchorPosition) {
    forceFuncs.push(
      (
        state: AnyDuringMigration,
        idx: AnyDuringMigration,
        relaxationCoef: number,
      ) => {
        const anchorPos = state[idx].anchor;
        const interval = intervals[idx];
        const offset = interval.preferredAnchorPosition - anchorPos;
        return {anchor: offset * relaxationCoef};
      },
    );
  }

  const applyForceFunc = (
    intervalState: AnyDuringMigration,
    force: AnyDuringMigration,
  ) => ({
    anchor: Number(intervalState.anchor) + Number(force.anchor || 0),
    top: Number(intervalState.top) + Number(force.top || 0),
    bottom: Number(intervalState.bottom) + Number(force.bottom || 0),
  });
  const diffFunc = (
    intervalState1: AnyDuringMigration,
    intervalState2: AnyDuringMigration,
  ) =>
    Math.max(
      Math.abs(intervalState1.anchor - intervalState2.anchor),
      Math.abs(intervalState1.top - intervalState2.top),
      Math.abs(intervalState1.bottom - intervalState2.bottom),
    );
  const diffLimit = 0.05;
  const relaxationCoefDecreaseFactor = 0.99;
  const maxIterationCount = 1000;
  const finalState = simulateForceSystem(
    initialState,
    forceFuncs,
    applyForceFunc,
    diffFunc,
    diffLimit,
    relaxationCoefDecreaseFactor,
    maxIterationCount,
  );

  return intervals.map((interval, idx) => {
    const intervalState = finalState[String(idx)];
    return {
      anchor: intervalState.anchor,
      top: intervalState.top,
      bottom: intervalState.bottom,
    };
  });
}

type SimulatedForceFunc = (
  p1: {[key: string]: AnyDuringMigration},
  p2: string,
  p3: number,
) => AnyDuringMigration;

/**
 * Simulates a physical system with elements, each positioned at some
 * location, and forces applied onto those elements, and cause them to move.
 * Calculates the final position of the elements, after iteratively applying
 * the forces.
 *
 * At each iteration a new state (the position of each element) is calculated
 * based on the previous state and the forces. The system iterates until it
 * converges into a steady state (a state that changes at a negligible amount
 * each iteration) or until a maximum number of iterations is performed (to
 * avoid infinite loop in case of non-converging systems). The forces are
 * provided in an array of functions. The functions are called with the
 * current state and the element that the force is to be applied onto, and
 * return the force, which is in the same scale as the coordinate dimension of
 * the system. At each iteration, for all elements, all force-functions are
 * called with that element, and summed using the add-function. There's also a
 * "relaxation" coefficient which is decreased at each iteration. It starts
 * with 1 and gradually decreases to zero. The force-calculating functions may
 * or may not take it into account.
 *
 * @param initialState The initial state to start
 *     with. A dictionary where each key is an element in the system, and the
 *     value associated with it is the position of that element.
 * @param getForceFuncs The
 *     collection of get-force functions. See documentation of
 *     gviz.canviz.util.SimulatedForceFunc.
 * @param applyForceFunc A function that accepts an
 *     element's position and a force, and applies that force onto that
 * element. Returns the new position of the element.
 * @param diffFunc A function that takes two elements'
 *     positions and return the numeric "diff" between them. Used for
 *     determining whether we have reaches a steady state where the state
 *     changes at a negligible amount each iteration.
 * @param diffLimit The maximum return value of diffFunc to be taken as
 *     "close enough".
 * @param relaxationCoefDecreaseFactor The factor by which the
 *     relaxationCoef decreases on each iteration. Should be in the range
 * [0,1].
 * @param maxIterationCount As a safety measure, don't allow more that
 *     maxIterationCount iterations. Roughly, this should be
 *     log(base=relaxationCoefDecreaseFactor) of
 *     (diffLimit /
 *     the-maximum-number-that-will-be-multiplied-by-relaxationCoef).
 * @return The final state of the system.
 */
function simulateForceSystem(
  initialState: {[key: string]: AnyDuringMigration},
  getForceFuncs: SimulatedForceFunc[],
  applyForceFunc: (
    p1: AnyDuringMigration,
    p2: AnyDuringMigration,
  ) => AnyDuringMigration,
  diffFunc: (p1: AnyDuringMigration, p2: AnyDuringMigration) => number,
  diffLimit: number,
  relaxationCoefDecreaseFactor: number,
  maxIterationCount: number,
): {[key: string]: AnyDuringMigration} {
  let state = initialState;
  let relaxationCoef = 1;
  for (let i = 0; i < maxIterationCount; i++) {
    const newState = calcForceSystemNewState(
      state,
      getForceFuncs,
      applyForceFunc,
      relaxationCoef,
    );
    const newStateWithZeroRelaxation = calcForceSystemNewState(
      state,
      getForceFuncs,
      applyForceFunc,
      0,
    );
    const newStateAlmostEqual = objectsAlmostEqual(
      state,
      newState,
      diffLimit,
      diffFunc,
    );
    const zeroRelaxStateAlmostEqual = objectsAlmostEqual(
      state,
      newStateWithZeroRelaxation,
      diffLimit,
      diffFunc,
    );
    if (newStateAlmostEqual && zeroRelaxStateAlmostEqual) {
      // The condition of this 'if' is compound of two conditions. The first
      // ('newState') checks if the new state is sufficiently close the
      // current state. The second ('newStateWithZeroRelaxation') does a
      // similar thing, but checks against an artificial new state, one that
      // was computed with relaxationCoef equals zero. That second condition
      // is needed in order to prevent a case where the
      // non-relaxationCoef-affected forces (the important contsraints) are
      // coincidentally cancelled by the relaxationCoef-affected forces (less
      // important contsraints). We require that the important forces are
      // sufficiently small by themselves, before adding in the less important
      // forces. Note that due to the short-circuit nature of the && opeartor,
      // the second condition won't be evaluated if the first one fails.
      break;
    }
    state = newState;
    relaxationCoef *= relaxationCoefDecreaseFactor;
  }
  return state;
}

/**
 * An internal function used by simulateForceSystem above. Performs a single
 * iteration of the simulation - calculates the next state based on the
 * current state, force-functions and relaxation coefficient.
 * @param state The current state.
 * @param getForceFuncs See simulateForceSystem above.
 * @param applyForceFunc See simulateForceSystem above.
 * @param relaxationCoef The relaxation coefficient.
 * @return The new state.
 */
function calcForceSystemNewState(
  state: {[key: string]: AnyDuringMigration},
  getForceFuncs: SimulatedForceFunc[],
  applyForceFunc: (
    p1: AnyDuringMigration,
    p2: AnyDuringMigration,
  ) => AnyDuringMigration,
  relaxationCoef: number,
): {[key: string]: AnyDuringMigration} {
  const newState = {};
  for (const [key, value] of Object.entries(state)) {
    let newValue = value;
    for (let i = 0; i < getForceFuncs.length; i++) {
      const getForceFunc = getForceFuncs[i];
      const force = getForceFunc(state, key, relaxationCoef);
      newValue = applyForceFunc(newValue, force);
    }
    (newState as AnyDuringMigration)[key] = newValue;
  }
  return newState;
}

/**
 * Returns the interactivity layer for focus over labeled legend entry.
 * @param legendDefinition The legend definition returned by the define()
 *     function.
 * @param focusedEntryIndex The index of the legend entry, as passed in
 *     entriesInfo[i].index to the define() function.
 * @return An override of the legend entry specified, with properties tweaked to
 *     create the desired visual effect for interactivity.
 */
export function generateInteractivityLayer(
  legendDefinition: LabeledLegendDefinition,
  focusedEntryIndex: number,
): {[key: number]: LabeledLegendDefinitionEntry} {
  const legendDefinitionIndex = legendDefinition.findIndex(
    (entry) => entry.index === focusedEntryIndex,
  );
  if (legendDefinitionIndex < 0) {
    return {};
  }
  const interactiveLegendDefinition = {};
  (interactiveLegendDefinition as AnyDuringMigration)[legendDefinitionIndex] = {
    startPointRadius: START_POINT_RADIUS_ON_FOCUS,
    lineBrush: new Brush({
      stroke: LINE_COLOR,
      strokeWidth: LINE_WIDTH_ON_FOCUS,
      strokeOpacity: LINE_OPACITY,
    }),
  };
  return interactiveLegendDefinition;
}

// TODO(dlaliberte): move to a proper location, one unified and reused in other
// charts.

/** Radius of the start point. */
export const START_POINT_RADIUS = 2;

/** Radius of the start point when the legend entry is focused. */
export const START_POINT_RADIUS_ON_FOCUS = 4;

/** Color for the lines. */
export const LINE_COLOR = '636363';

/** Width for the lines. */
export const LINE_WIDTH = 1;

/** Width for the lines when the legend entry is focused.. */
export const LINE_WIDTH_ON_FOCUS = 2;

/** Opacity of the lines (and start points). */
export const LINE_OPACITY = 0.7;

/** Color for the text above the line. */
export const ABOVE_TEXT_COLOR = '6c6c6c';

/** Color for the text below the line. */
export const BELOW_TEXT_COLOR = '9e9e9e';

/**
 * The minimum vertical spacing between the vertical lines of adjacent legend
 * entries. All vertical lines share the same X coordinate, so must not have the
 * same Y values (otherwise there will be an overlap), and more than that, they
 * must a minimum spacing between them, for aesthetic reasons.
 */
export const MIN_VERTICAL_LINE_SPACING = 5;
