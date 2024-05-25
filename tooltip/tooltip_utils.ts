/**
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

import {Box} from '@npm//@closure/math/box';
import {Coordinate} from '@npm//@closure/math/coordinate';
import * as googMath from '@npm//@closure/math/math';
import {Range} from '@npm//@closure/math/range';
import * as googObject from '@npm//@closure/object/object';
import {Outline} from './tooltip_definition';

/**
 * Adjust the tooltip outline horizontally.
 * If the tooltip is too close to the chart edges try the following:
 * 1. Flip it horizontally in relation to a given pivot.
 * 2. Push the tooltip box horizontally.
 * 3. Flip it and then push the box horizontally.
 * 4. Give up. Tooltip will overflow from the right.
 * @param outline The tooltip outline (box and handle points).
 * @param boundaries The permitted tooltip boundaries.
 * @param pivot The pivot point.
 * @param margin The tooltip margin.
 * @param cornerRadius The radius of the rounded corners.
 */
export function adjustTooltipHorizontally(
  outline: Outline,
  boundaries: Box,
  pivot: Coordinate,
  margin: number,
  cornerRadius: number,
) {
  // Tighten the boundaries by removing the margins the tooltip may not enter.
  const leftBoundary = boundaries.left + margin;
  const rightBoundary = boundaries.right - margin;

  // If the tooltip is within the permitted boundaries leave it as is.
  if (outline.box.left >= leftBoundary && outline.box.right <= rightBoundary) {
    return;
  }

  // Otherwise, check whether we can fit it in the boundaries by flipping it.
  const flipped = googObject.unsafeClone(outline);
  flipTooltipHorizontally(flipped, pivot);
  if (flipped.box.left >= leftBoundary && flipped.box.right <= rightBoundary) {
    outline.box = flipped.box;
    outline.handlePoints = flipped.handlePoints;
    return;
  }

  // Alas, our flipping efforts are to no avail!
  // See if pushing the tooltip box can do the trick.
  if (outline.handlePoints) {
    const handleBoundaries = new Range(
      leftBoundary + cornerRadius,
      rightBoundary - cornerRadius,
    );
    const handleRange = new Range(
      outline.handlePoints[0].x,
      outline.handlePoints[2].x,
    );
    const flippedHandleRange = new Range(
      flipped.handlePoints![0].x,
      flipped.handlePoints![2].x,
    );

    // If the handle does not fit in the original tooltip but the flipped one
    // does, take the flipped one. Otherwise prefer the original one.
    if (
      !Range.contains(handleBoundaries, handleRange) &&
      Range.contains(handleBoundaries, flippedHandleRange)
    ) {
      outline.box = flipped.box;
      outline.handlePoints = flipped.handlePoints;
    }
  }
  // Note that we first push to the right, then to the left.
  // This is done to make sure the right side of the tooltip is the one which
  // exceeds the permitted boundaries. After all, most languages in the world
  // are left to right, and it's better to chop the end of the text.
  if (outline.box.right > rightBoundary) {
    outline.box.left -= outline.box.right - rightBoundary;
    outline.box.right = rightBoundary;
  }
  if (outline.box.left < leftBoundary) {
    outline.box.right += leftBoundary - outline.box.left;
    outline.box.left = leftBoundary;
  }
}

/**
 * Adjust the tooltip outline vertically.
 * If the tooltip is too close to the chart edges try the following:
 * 1. Flip it vertically in relation to a given pivot.
 * 2. Push the tooltip box vertically.
 * 3. Give up. Tooltip will overflow from the bottom.
 * Note that if the tooltip is pushed the handle is removed. This is because it
 * will be covered by the tooltip box, either partially or completely.
 * @param outline The tooltip outline (box and handle points).
 * @param boundaries The permitted tooltip boundaries.
 * @param pivot The pivot point.
 * @param margin The tooltip margin.
 */
export function adjustTooltipVertically(
  outline: Outline,
  boundaries: Box,
  pivot: Coordinate,
  margin: number,
) {
  // Tighten the boundaries by removing the margins the tooltip may not enter.
  const topBoundary = boundaries.top + margin;
  const bottomBoundary = boundaries.bottom - margin;

  // If the tooltip is within the permitted boundaries leave it as is.
  if (outline.box.top >= topBoundary && outline.box.bottom <= bottomBoundary) {
    return;
  }

  // Otherwise, check whether we can fit it in the boundaries by flipping it.
  const flipped = googObject.unsafeClone(outline);
  flipTooltipVertically(flipped, pivot);
  if (flipped.box.top >= topBoundary && flipped.box.bottom <= bottomBoundary) {
    outline.box = flipped.box;
    outline.handlePoints = flipped.handlePoints;
    return;
  }

  // Alas, our flipping efforts are to no avail!
  // See if pushing the tooltip box can do the trick.
  // Note that we first push to the bottom, then to the top.
  // This is done to make sure the bottom side of the tooltip is the one
  // which exceeds the permitted boundaries. After all, most languages in the
  // world are top to bottom, and it's better to chop the end of the text.
  if (outline.box.bottom > bottomBoundary) {
    outline.box.top -= outline.box.bottom - bottomBoundary;
    outline.box.bottom = bottomBoundary;
  }
  if (outline.box.top < topBoundary) {
    outline.box.bottom += topBoundary - outline.box.top;
    outline.box.top = topBoundary;
  }
  // Remove the handle if any.
  delete outline.handlePoints;
}

/**
 * Flip the tooltip horizontally in relation to a given pivot.
 * Vertical values of the tooltip outline are left intact.
 * @param outline The tooltip outline (box and handle points).
 * @param pivot The pivot point.
 */
export function flipTooltipHorizontally(outline: Outline, pivot: Coordinate) {
  const originalLeft = outline.box.left;
  outline.box.left = googMath.lerp(pivot.x, outline.box.right, -1);
  outline.box.right = googMath.lerp(pivot.x, originalLeft, -1);

  const handlePoints = outline.handlePoints;
  if (handlePoints) {
    // Swap the first and last handle points to keep the clockwise order.
    const tmp = handlePoints[0];
    handlePoints[0] = handlePoints[2];
    handlePoints[2] = tmp;
    // Flip the handle points horizontally.
    handlePoints[0].x = googMath.lerp(pivot.x, handlePoints[0].x, -1);
    handlePoints[1].x = googMath.lerp(pivot.x, handlePoints[1].x, -1);
    handlePoints[2].x = googMath.lerp(pivot.x, handlePoints[2].x, -1);
  }
}

/**
 * Flip the tooltip vertically in relation to a given pivot.
 * Horizontal values of the tooltip outline are left intact.
 * @param outline The tooltip outline (box and handle points).
 * @param pivot The pivot point.
 */
export function flipTooltipVertically(outline: Outline, pivot: Coordinate) {
  const originalTop = outline.box.top;
  outline.box.top = googMath.lerp(pivot.y, outline.box.bottom, -1);
  outline.box.bottom = googMath.lerp(pivot.y, originalTop, -1);

  const handlePoints = outline.handlePoints;
  if (handlePoints) {
    // Swap the first and last handle points to keep the clockwise order.
    const tmp = handlePoints[0];
    handlePoints[0] = handlePoints[2];
    handlePoints[2] = tmp;
    // Flip the handle points horizontally.
    handlePoints[0].y = googMath.lerp(pivot.y, handlePoints[0].y, -1);
    handlePoints[1].y = googMath.lerp(pivot.y, handlePoints[1].y, -1);
    handlePoints[2].y = googMath.lerp(pivot.y, handlePoints[2].y, -1);
  }
}
