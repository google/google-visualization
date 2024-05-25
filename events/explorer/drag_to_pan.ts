/**
 * @fileoverview Allows Dragging the chart to pan it.
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

import {Vec2} from '@npm//@closure/math/vec2';
import {PubSub} from '@npm//@closure/pubsub/pubsub';

import {Options} from '../../common/options';
import {ChartLayoutInterface} from '../../visualization/corechart/chart_layout_interface';
import {ChartEventType} from '../chart_event_types';
import {ChartState} from '../chart_state';
import {EventData} from '../interaction_events';

import {BaseExplorerType} from './base_explorer_type';
import * as common from './common';
import {EnabledAxes} from './enabled_axes';

/**
 * Allows Dragging the chart to pan it.
 * @unrestricted
 */
export class DragToPan extends BaseExplorerType {
  /** The last position of a drag if one is in progress. */
  private lastPosition: Vec2 | null = null;

  /**
   * @param chartState The state of the chart.
   * @param getLayout A function to get the current layout of the chart.
   * @param enabledAxis If each axis should be enabled.
   * @param pubsub The pubsub for all features.
   */
  constructor(
    chartState: ChartState,
    getLayout: () => ChartLayoutInterface,
    enabledAxis: EnabledAxes | null,
    pubsub: PubSub,
  ) {
    super(chartState, getLayout, enabledAxis, pubsub);
  }

  override handleReady() {
    const pubsub = this.getPubSub();
    pubsub.subscribe(ChartEventType.DRAG_START, (event: EventData) => {
      this.handleDragStart(event);
    });
    pubsub.subscribe(ChartEventType.DRAG, (event: EventData) => {
      this.handleDrag(event);
    });
    pubsub.subscribe(ChartEventType.DRAG_END, (event: EventData) => {
      this.handleDragEnd(event);
    });
    pubsub.subscribe(
      ChartEventType.MOUSE_DOWN,
      (event: EventData, preventDefault: () => void) => {
        this.handleMouseDown(event, preventDefault);
      },
    );
  }

  /**
   * Handles a drag start event.
   * @param event The drag start event.
   */
  handleDragStart(event: EventData) {
    const chartBounds = this.getLayout().getChartAreaBoundingBox();
    if (common.isInChart(event, chartBounds)) {
      this.lastPosition = new Vec2(event.x, event.y);
    }
  }

  /**
   * Handles a drag event.
   * @param event The drag event.
   */
  handleDrag(event: EventData) {
    if (this.lastPosition) {
      this.updateBounds(event.x, event.y);
      this.lastPosition.x = event.x;
      this.lastPosition.y = event.y;
    }
  }

  /**
   * Handles a drag end event.
   * @param event The drag end event.
   */
  handleDragEnd(event: EventData) {
    this.lastPosition = null;
  }

  /**
   * Handles a mousedown event.
   * @param event The mousedown event.
   * @param preventDefault Function to prevent the default action taken by a
   *     mousedown.
   */
  handleMouseDown(event: EventData, preventDefault: () => void) {
    const chartBounds = this.getLayout().getChartAreaBoundingBox();
    if (common.isInChart(event, chartBounds)) {
      preventDefault();
    }
  }

  /**
   * Calculates the necessary positions of the chart's next frame.
   * @param nextX The x position of the mouse event.
   * @param nextY The y position of the mouse event.
   */
  updateBounds(nextX: number, nextY: number) {
    const viewport = this.getViewport();
    if (!viewport) {
      return;
    }
    // Update layout
    viewport.setLayout(this.getLayout());
    const enabledAxes = this.getEnabledAxes();

    if (enabledAxes!.horizontal) {
      // Calculate the new min and max value as if it were as simple as pushing
      // over by the amount of mouse delta.
      const dx =
        viewport.getHAxisValue(nextX) -
        viewport.getHAxisValue(this.lastPosition!.x);
      const minx = viewport.minX - dx;
      const maxx = viewport.maxX - dx;

      // If the keepInBounds option is specified to be false, if statement will
      // be true. Otherwise, we check if this delta moves the view out of
      // bounds.
      const minBound = Math.max(minx, viewport.origX);
      const maxBound = Math.min(maxx, viewport.origX + viewport.origWidth);
      if (
        (viewport.keepInBounds &&
          (minBound === minx || dx < 0) &&
          (maxBound === maxx || dx > 0)) ||
        !viewport.keepInBounds
      ) {
        // Set the new viewport area.
        viewport.minX = minx;
        viewport.maxX = maxx;
      }
    }

    if (enabledAxes!.vertical) {
      // Calculate the new min and max value as if it were as simple as pushing
      // over by the amount of mouse delta.
      const dy =
        viewport.getVAxisValue(nextY) -
        viewport.getVAxisValue(this.lastPosition!.y);
      const miny = viewport.minY - dy;
      const maxy = viewport.maxY - dy;

      // If the keepInBounds option is specified to be false, if statement will
      // be true. Otherwise, we check if this delta moves the view out of
      // bounds.
      const minBound = Math.max(miny, viewport.origY);
      const maxBound = Math.min(maxy, viewport.origY + viewport.origHeight);
      if (
        (viewport.keepInBounds &&
          (minBound === miny || dy < 0) &&
          (maxBound === maxy || dy > 0)) ||
        !viewport.keepInBounds
      ) {
        // Set the new viewport area.
        viewport.minY = miny;
        viewport.maxY = maxy;
      }
    }
    this.updateOptions();
  }

  /**
   * @param options The chart options.
   * @return Whether drag to pan is enabled according to the options or
   *     defaults. The actions == null check implies that the default is true.
   */
  static isEnabled(options: Options): boolean {
    const actions = options.inferValue(
      common.Options.EXPLORER + '.' + common.Options.ACTIONS,
    );
    if (
      actions == null ||
      (Array.isArray(actions) && actions.includes(common.Options.DRAG_TO_PAN))
    ) {
      return true;
    }
    return false;
  }
}
