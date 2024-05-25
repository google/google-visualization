/**
 * @fileoverview Allows Dragging the chart to zoom in and out.
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
import {Vec2} from '@npm//@closure/math/vec2';
import {PubSub} from '@npm//@closure/pubsub/pubsub';

import {Options} from '../../common/options';
import {
  BoundingBox,
  ChartLayoutInterface,
} from '../../visualization/corechart/chart_layout_interface';
import {ChartEventType} from '../chart_event_types';
import {ChartState} from '../chart_state';
import {EventData} from '../interaction_events';

import {BaseExplorerType} from './base_explorer_type';
import * as common from './common';
import {EnabledAxes} from './enabled_axes';

/**
 * Allows Dragging the chart to zoom in and out.
 * @unrestricted
 */
export class DragToZoom extends BaseExplorerType {
  /** The starting position of a drag if one is in progress. */
  private startPosition: Vec2 | null = null;

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
      this.startPosition = new Vec2(event.x, event.y);
    }
  }

  /**
   * Handles a drag event.
   * @param event The drag event.
   */
  handleDrag(event: EventData) {
    if (this.startPosition) {
      const chartContainer = this.getLayout().getChartAreaBoundingBox();
      const enabledAxis = this.getEnabledAxes();

      this.pullToBounds(event, chartContainer);

      let left;
      let width;
      let top;
      let height;

      if (enabledAxis!.horizontal) {
        left = Math.min(this.startPosition.x, event.x);
        width = Math.abs(this.startPosition.x - event.x);
      } else {
        left = chartContainer.left;
        width = chartContainer.width;
      }
      if (enabledAxis!.vertical) {
        top = Math.min(this.startPosition.y, event.y);
        height = Math.abs(this.startPosition.y - event.y);
      } else {
        top = chartContainer.top;
        height = chartContainer.height;
      }

      this.getState().overlayBox = {
        left,
        top,
        width,
        height,
        color: common.DEFAULTS.OVERLAY_BOX_COLOR,
        opacity: common.DEFAULTS.OVERLAY_BOX_OPACITY,
      };
    }
  }

  /**
   * Handles a drag end event.
   * @param event The drag end event.
   */
  handleDragEnd(event: EventData) {
    if (this.startPosition) {
      this.updateBounds();
      this.startPosition = null;
      this.getState().overlayBox = null;
    }
  }

  /**
   * Handles a mousedown event.
   * @param event The mousedown event.
   * @param preventDefault Function to cancel an event.
   */
  handleMouseDown(event: EventData, preventDefault: () => void) {
    const chartBounds = this.getLayout().getChartAreaBoundingBox();
    if (common.isInChart(event, chartBounds)) {
      preventDefault();
    }
  }

  /** Calculates the necessary positions of the chart's next frame. */
  updateBounds() {
    const enabledAxes = this.getEnabledAxes();
    const viewport = this.getViewport();
    viewport!.setLayout(this.getLayout());
    const overlayBox = this.getState().overlayBox;
    const startX = viewport!.getHAxisValue(overlayBox!.left);
    const endX = viewport!.getHAxisValue(overlayBox!.left + overlayBox!.width);
    const startY = viewport!.getVAxisValue(overlayBox!.top);
    const endY = viewport!.getVAxisValue(overlayBox!.top + overlayBox!.height);

    // Edge case: user returns cursor to original x/y value.
    if (startX === endX || startY === endY) {
      return;
    }

    const minWidth = viewport!.origWidth * viewport!.maxZoomIn;
    let minx;
    let maxx;

    if (enabledAxes!.horizontal) {
      minx = Math.min(startX, endX);
      maxx = Math.max(startX, endX);

      // If the width the user desires to zoom to is smaller than the minimum
      // zoom, expand it from the center to fill entire width.
      if (maxx - minx < minWidth) {
        const center = (minx + maxx) / 2;
        minx = center - minWidth / 2;
        maxx = center + minWidth / 2;
      }
      viewport!.minX = minx;
      viewport!.maxX = maxx;
    }

    const minHeight = viewport!.origHeight * viewport!.maxZoomIn;
    let miny;
    let maxy;

    if (enabledAxes!.vertical) {
      miny = Math.min(startY, endY);
      maxy = Math.max(startY, endY);

      // If the height the user desires to zoom to is smaller than the minimum
      // zoom, expand it from the center to fill entire height.
      if (maxy - miny < minHeight) {
        const center = (miny + maxy) / 2;
        miny = center - minHeight / 2;
        maxy = center + minHeight / 2;
      }
      viewport!.minY = miny;
      viewport!.maxY = maxy;
    }

    this.updateOptions();
  }

  /**
   * If the mouse is dragging and goes outside of the bounds of the chart, this
   * keeps the box and zoom from going outside as well.
   * @param event The event data.
   * @param chartBounds The chart area bounding box.
   */
  pullToBounds(event: EventData, chartBounds: BoundingBox) {
    event.x = googMath.clamp(
      event.x,
      chartBounds.left,
      chartBounds.left + chartBounds.width,
    );
    event.y = googMath.clamp(
      event.y,
      chartBounds.top,
      chartBounds.top + chartBounds.height,
    );
  }

  /**
   * @param options The chart options.
   * @return Whether drag to zoom is enabled according to the options or
   *     defaults.
   */
  static isEnabled(options: Options): boolean {
    const actions = options.inferValue(
      common.Options.EXPLORER + '.' + common.Options.ACTIONS,
    );
    if (
      Array.isArray(actions) &&
      actions.includes(common.Options.DRAG_TO_ZOOM)
    ) {
      return true;
    }
    return false;
  }
}
