/**
 * @fileoverview Allows pinching the chart to zoom in and out.
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
import {PubSub} from '@npm//@closure/pubsub/pubsub';
import {Options} from '../../common/options';
import {EventData, SUPPORT_TOUCH_EVENTS} from '../../events/interaction_events';
import {
  BoundingBox,
  ChartLayoutInterface,
} from '../../visualization/corechart/chart_layout_interface';

import {ChartEventType} from '../chart_event_types';
import {ChartState} from '../chart_state';
import {BaseExplorerType} from './base_explorer_type';
import * as common from './common';
import {EnabledAxes} from './enabled_axes';

/**
 * Allows Pinching the chart to zoom in and out.
 * @unrestricted
 */
export class PinchToZoom extends BaseExplorerType {
  /**
   * If we are in the middle of a pinch, this holds the current event data.
   */
  private event: {x: number; y: number; scale: number} | null = null;

  /**
   * @param chartState The state of the chart.
   * @param getLayout A function to get the current layout of the chart.
   * @param enabledAxis Booleans for each of the axis to be enabled or not.
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
    pubsub.subscribe(ChartEventType.PINCH_START, (event: EventData) => {
      this.handlePinchStart(event);
    });
    pubsub.subscribe(ChartEventType.PINCH, (event: EventData) => {
      this.handlePinch(event);
    });
    pubsub.subscribe(ChartEventType.PINCH_END, () => {
      this.handlePinchEnd();
    });
  }

  /**
   * Handles a pinch start event.
   * @param event The pinch start event.
   */
  handlePinchStart(event: EventData) {
    const chartBounds = this.getLayout().getChartAreaBoundingBox();
    if (common.isInChart(event, chartBounds)) {
      // AnyDuringAssistedMigration because:  Type '{ x: number; y: number;
      // scale: any; oldScale: number; }' is not assignable to type '{ x:
      // number; y: number; scale: number; }'.
      this.event = {
        x: event.x,
        y: event.y,
        scale: event.gesture['scale'],
        oldScale: 1.0,
      } as AnyDuringAssistedMigration;
    }
  }

  /**
   * Handles a pinch event.
   * @param event The pinch event.
   */
  handlePinch(event: EventData) {
    if (this.event) {
      const chartContainer = this.getLayout().getChartAreaBoundingBox();
      // const viewport = this.getViewport();
      // const enabledAxis = this.getEnabledAxes();

      this.pullToBounds(event, chartContainer);
      // AnyDuringAssistedMigration because:  Property 'oldScale' does not exist
      // on type '{ x: number; y: number; scale: number; }'.
      (this.event as AnyDuringAssistedMigration).oldScale = this.event.scale;
      this.event.scale = event.gesture['scale'];
      this.updateBounds();
    }
  }

  /** Handles a pinch end event. */
  handlePinchEnd() {
    if (this.event) {
      this.updateBounds();
      this.event = null;
    }
  }

  /** Calculates the necessary positions of the chart's next frame. */
  updateBounds() {
    // const enabledAxes = this.getEnabledAxes();
    const viewport = this.getViewport();
    viewport!.setLayout(this.getLayout());

    if (!viewport) {
      return;
    }
    // AnyDuringAssistedMigration because:  Property 'oldScale' does not exist
    // on type '{ x: number; y: number; scale: number; }'.
    const scale =
      1.0 -
      ((this.event as AnyDuringAssistedMigration).oldScale - this.event!.scale);
    const x = Number(viewport.getHAxisValue(this.event!.x));
    const minX = viewport.minX;
    const maxX = viewport.maxX;
    const dminX = x - minX;
    const dmaxX = maxX - x;
    viewport.minX = x - dminX / scale;
    viewport.maxX = x + dmaxX / scale;

    const y = Number(viewport.getVAxisValue(this.event!.y));
    const minY = viewport.minY;
    const maxY = viewport.maxY;
    const dminY = y - minY;
    const dmaxY = maxY - y;
    viewport.minY = y - dminY / scale;
    viewport.maxY = y + dmaxY / scale;

    this.updateOptions();
  }

  /**
   * If the user is pinching and goes outside of the bounds of the chart, this
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
   * @return Whether pinch to zoom is enabled according to the options or
   *     defaults.
   */
  static isEnabled(options: Options): boolean {
    const actions = options.inferValue(
      common.Options.EXPLORER + '.' + common.Options.ACTIONS,
    );
    if (
      Array.isArray(actions) &&
      actions.includes(common.Options.PINCH_TO_ZOOM)
    ) {
      if (SUPPORT_TOUCH_EVENTS) {
        return true;
      } else {
        return false;
      }
    }
    return false;
  }
}
