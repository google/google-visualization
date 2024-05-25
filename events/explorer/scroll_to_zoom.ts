/**
 * @fileoverview Allows scrolling to zoom in and out of a chart.
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
import {ChartLayoutInterface} from '../../visualization/corechart/chart_layout_interface';
import {ChartEventType} from '../chart_event_types';
import {ChartState} from '../chart_state';
import {EventData} from '../interaction_events';

import {BaseExplorerType} from './base_explorer_type';
import * as common from './common';
import {EnabledAxes} from './enabled_axes';

/**
 * Allows scrolling to zoom in and out of a chart.
 * @unrestricted
 */
export class ScrollToZoom extends BaseExplorerType {
  /**
   * @param chartState The chart state.
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
    this.getPubSub().subscribe(
      ChartEventType.SCROLL,
      (event: EventData, preventDefault: () => void) => {
        this.handleScroll(event, preventDefault);
      },
    );
  }

  /**
   * Handles a scroll event.
   * @param event The scroll event.
   * @param preventDefault Function to cancel an event.
   */
  handleScroll(event: EventData, preventDefault: () => void) {
    const enabledAxes = this.getEnabledAxes();
    const chartBounds = this.getLayout().getChartAreaBoundingBox();
    if (common.isInChart(event, chartBounds)) {
      preventDefault();
      const viewport = this.getViewport();

      // Compute new scale and clamp it to the zoom range.
      // AnyDuringAssistedMigration because:  Property 'wheelDelta' does not
      // exist on type 'EventData'.
      let newScale =
        (event as AnyDuringAssistedMigration).wheelDelta < 0
          ? viewport!.scale * viewport!.zoomDelta
          : viewport!.scale / viewport!.zoomDelta;
      newScale = googMath.clamp(
        newScale,
        viewport!.maxZoomIn,
        viewport!.maxZoomOut,
      );
      if (newScale === viewport!.scale) {
        return;
      }
      viewport!.scale = newScale;

      // TODO(dlaliberte): zoom not at midpoint but at mouse position.
      if (enabledAxes!.horizontal) {
        const hMidpoint = (viewport!.maxX + viewport!.minX) / 2;
        const hDistFromMid = (viewport!.origWidth * viewport!.scale) / 2;
        viewport!.minX = hMidpoint - hDistFromMid;
        viewport!.maxX = hMidpoint + hDistFromMid;
      }

      if (enabledAxes!.vertical) {
        const vMidpoint = (viewport!.maxY + viewport!.minY) / 2;
        const vDistFromMid = (viewport!.origHeight * viewport!.scale) / 2;
        viewport!.minY = vMidpoint - vDistFromMid;
        viewport!.maxY = vMidpoint + vDistFromMid;
      }
      this.updateOptions();
    }
  }

  /**
   * @param options The chart options.
   * @return Whether scroll to zoom is enabled according to the options or
   *     defaults.  The default is true.
   */
  static isEnabled(options: Options): boolean {
    const actions = options.inferValue(
      common.Options.EXPLORER + '.' + common.Options.ACTIONS,
    );
    if (
      actions == null ||
      (Array.isArray(actions) &&
        actions.includes(common.Options.SCROLL_TO_ZOOM))
    ) {
      return true;
    }
    return false;
  }
}
