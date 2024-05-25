/**
 * @fileoverview This file provides utility functions for manipulating and
 * accessing a chart area.
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

import {assert} from '@npm//@closure/asserts/asserts';

import {GOLDEN_RATIO} from '../common/constants';

/**
 * This structure is used for describing the chart area; The area where we draw
 * the actual chart, not including title, legend (when it is not inside), ticks
 * (when they are not inside) and axis titles.  The area around the ChartArea
 * is defined by the padding, composed of the top, bottom, left, and right
 * areas.  But note that in this structure, these values are positions, not
 * sizes.  So top + height == bottom, and left + width == right.
 *
 */
export interface ChartArea {
  width: number;
  height: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Calculates a single (horizontal or vertical) dimension - before and after
 * coordinates - of the chart area. It uses the values specified by the user
 * for before and size, if exist, or calculates a default value if not. Makes
 * sure the values are within the boundary (totalSize).
 * @param beforeSize The value the user specified for the size of
 *     the area before the dimension (left for horizontal and top for
 *     vertical). Pass null if unspecified by the user.
 * @param afterSize The value the user specified for the size of the
 *     area after the dimension (right for horizontal and bottom for
 *     vertical). Pass null if unspecified by the user.
 * @param size The value the user specified for the dimension size
 *     (width for horizontal and height for vertical). Pass null if
 *     unspecified by the user.
 * @param totalSize The total dimension size, which before and after
 *     must be within.
 * @param defaultSize The size to use if all three of size,
 *     beforeSize, and afterSize are unspecified.
 * @return The final dimension
 *     values.
 */
function calcChartAreaDimension(
  beforeSize: number | null,
  afterSize: number | null,
  size: number | null,
  totalSize: number,
  defaultSize: number,
): {before: number; after: number; size: number} {
  if (beforeSize == null || afterSize == null) {
    // We must calculate either beforeSize or afterSize from size,
    // so size must be defined.
    if (size == null) {
      size = defaultSize;
    }

    // Default size outside of chartArea.
    const totalOutsideSize = Math.max(0, totalSize - size);

    if (beforeSize == null && afterSize == null) {
      // By default, 'size' is placed in the middle of 'totalSize'.
      // Don't round yet, for backward compatibility
      beforeSize = afterSize = totalOutsideSize / 2;
    } else if (beforeSize == null) {
      assert(afterSize != null);
      beforeSize = Math.max(0, totalOutsideSize - afterSize!);
    } else {
      assert(beforeSize != null);
      afterSize = Math.max(0, totalOutsideSize - beforeSize);
    }
  }
  assert(beforeSize != null && afterSize != null);
  // Adjust size to be the remainder of beforeSize + afterSize.
  size = Math.max(0, Math.round(totalSize - (beforeSize + afterSize!)));

  // Now the before is just beforeSize and after is the before + size.
  const before = Math.round(beforeSize);
  const after = Math.min(totalSize, before + size);
  size = after - before;

  return {before, after, size};
}

/**
 * Calculates the layout for the chart area.
 *
 * The preferred width and height of the chart is computed by assuming the
 * ratio is the golden ratio. However, since sometimes the input chart has
 * very different ratio, using this computation can look bad. In order to
 * solve it for these cases we use a weighted average with another
 * alternative.
 *
 * w1/h1 are the width/height if the ratio is the golden ratio.
 * w2/h2 are the width/height if the ratio is far from it.
 *
 * Since basically we prefer the chart to be big, if w1 (or h1) are bigger
 * than w2 (or h2) we simply use them. Otherwise, we extend it to be 2/3
 * toward the w2 (or h2).
 *
 * Note: For each of the sizes (width/height) the decision is done
 * separately, and only used if the user didn't specify all three of
 * the options (width, left, right) or (height, top, bottom).
 *
 * @param chartArea User-specified chartArea options, as numbers, not
 *     percentages. Also note that the property names are unquoted.  The values
 *     are sizes, not positions.
 * @return The computed ChartArea.  Note that the values of
 *     top, bottom, left, and right are positions, not sizes.
 */
export function calcChartAreaLayout(
  chartDefWidth: number,
  chartDefHeight: number,
  chartArea: {
    width: number | null;
    height: number | null;
    left: number | null;
    right: number | null;
    top: number | null;
    bottom: number | null;
  },
): ChartArea {
  const w1 = chartDefWidth / GOLDEN_RATIO;
  const w2 = chartDefWidth - chartDefHeight * (GOLDEN_RATIO - 1);
  const defaultWidth = Math.round(w1 > w2 ? w1 : (w1 + 2 * w2) / 3);
  const h1 = chartDefHeight / GOLDEN_RATIO;
  const h2 = chartDefHeight - chartDefWidth * (GOLDEN_RATIO - 1);
  const defaultHeight = Math.round(h1 > h2 ? h1 : (h1 + 2 * h2) / 3);

  const horizontalDimension = calcChartAreaDimension(
    chartArea.left,
    chartArea.right,
    chartArea.width,
    chartDefWidth,
    defaultWidth,
  );
  const left = horizontalDimension.before;
  const right = horizontalDimension.after;
  const width = horizontalDimension.size;

  const verticalDimension = calcChartAreaDimension(
    chartArea.top,
    chartArea.bottom,
    chartArea.height,
    chartDefHeight,
    defaultHeight,
  );
  const top = verticalDimension.before;
  const bottom = verticalDimension.after;
  const height = verticalDimension.size;

  return {
    left,
    right,
    width,
    top,
    bottom,
    height,
  };
}
