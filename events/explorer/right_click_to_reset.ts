/**
 * @fileoverview A setting to reset the view of the chart by setting the
 * viewport back to the original position.
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
 * A setting to reset the view of the chart by setting the viewport back to the
 * original position.
 * @unrestricted
 */
export class RightClickToReset extends BaseExplorerType {
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
      ChartEventType.RIGHT_CLICK,
      (event: EventData) => {
        this.handleRightClick(event);
      },
    );
  }

  /** Handles a right click event. */
  handleRightClick(event: EventData) {
    const viewport = this.getViewport();
    viewport!.scale = 1;
    viewport!.minX = viewport!.origX;
    viewport!.maxX = viewport!.origX + viewport!.origWidth;
    viewport!.minY = viewport!.origY;
    viewport!.maxY = viewport!.origY + viewport!.origHeight;
    this.updateOptions();
  }

  /**
   * @param options The chart options.
   * @return Whether right click to reset is enabled according to the options or
   *     defaults.  The default is true.
   */
  static isEnabled(options: Options): boolean {
    const actions = options.inferValue(
      common.Options.EXPLORER + '.' + common.Options.ACTIONS,
    );
    if (
      actions == null ||
      (Array.isArray(actions) &&
        actions.includes(common.Options.RIGHT_CLICK_TO_RESET))
    ) {
      return true;
    }
    return false;
  }
}
