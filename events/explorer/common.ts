/**
 * @fileoverview Common code throughout all of ai classes.
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

import * as googMath from '@npm//@closure/math/math';
import {EventData} from '../interaction_events';

/**
 * Enumeration of all ai options.
 * Ai option.
 */
export enum Options {
  EXPLORER = 'explorer',
  MAX_ZOOM = 'maxZoomOut',
  MIN_ZOOM = 'maxZoomIn',
  ZOOM_DELTA = 'zoomDelta',
  KEEP_IN_BOUNDS = 'keepInBounds',
  ACTIONS = 'actions',
  DRAG_TO_PAN = 'dragToPan',
  DRAG_TO_ZOOM = 'dragToZoom',
  PINCH_TO_ZOOM = 'pinchToZoom',
  RIGHT_CLICK_TO_RESET = 'rightClickToReset',
  SCROLL_TO_ZOOM = 'scrollToZoom',
}

/** Lists the defaults for each ai option. */
export const DEFAULTS = {
  MAX_ZOOM: 4,
  MIN_ZOOM: 0.25,
  ZOOM_DELTA: 1.5,
  KEEP_IN_BOUNDS: false,
  OVERLAY_BOX_COLOR: 'blue',
  OVERLAY_BOX_OPACITY: 0.2,
};

/**
 * Checks if the cursor is in the chart.
 * TODO(cuiffo?): Explore better types for params.
 * @param event The event data.
 * @param bounds The bounds of the chart.
 */
export function isInChart(
  event: EventData,
  bounds: {left: number; top: number; width: number; height: number},
): boolean {
  if (
    googMath.clamp(event.x, bounds.left, bounds.left + bounds.width) ===
      event.x &&
    googMath.clamp(event.y, bounds.top, bounds.top + bounds.height) === event.y
  ) {
    return true;
  }
  return false;
}
