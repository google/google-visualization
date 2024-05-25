/**
 * @fileoverview Base class of different types of an explorer.
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
import {ViewWindowMode} from '../../common/option_types';
import {ChartLayoutInterface} from '../../visualization/corechart/chart_layout_interface';
import {ChartEventType} from '../chart_event_types';
import {ChartState} from '../chart_state';

import {EnabledAxes} from './enabled_axes';
import {Viewport} from './viewport';

/**
 * Base class of different types of an explorer.
 * @unrestricted
 */
export class BaseExplorerType {
  /** The current viewport of the graph. */
  private viewport: Viewport | null = null;

  /**
   * @param chartState The state of the chart. Used to pass in new state to
   *     redraw the chart or features of the chart.
   * @param getLayout A function to get the current layout of the chart.
   * @param enabledAxes If each axis should be enabled.
   * @param pubsub The pubsub for all features.
   */
  constructor(
    private readonly chartState: ChartState,
    /** The layout of the chart. */
    getLayout: () => ChartLayoutInterface,
    private readonly enabledAxes: EnabledAxes | null,
    private readonly pubsub: PubSub,
  ) {
    /** The layout of the chart. */
    this.getLayout = getLayout;
    this.pubsub.subscribe(ChartEventType.READY, () => {
      this.handleReady();
    });
  }

  /** @return The viewport. */
  getViewport(): Viewport | null {
    return this.viewport;
  }

  /**
   * Sets the viewport.
   * @param viewport The new viewport to be set.
   */
  setViewport(viewport: Viewport) {
    this.viewport = viewport;
  }

  /** @return The chart layout. */
  getLayout(): ChartLayoutInterface {
    return this.getLayout();
  }

  /** @return The enabled axes. */
  getEnabledAxes(): EnabledAxes | null {
    return this.enabledAxes;
  }

  /** @return The chart state. */
  getState(): ChartState {
    return this.chartState;
  }

  /** @return The pubsub object for gviz features. */
  getPubSub(): PubSub {
    return this.pubsub;
  }

  /** Handles a ready event. Usually will be used to subscribe to events. */
  handleReady() {}

  /**
   * Updates the newOptions state parameter based on entries from the viewport
   * and ticks data.
   */
  updateOptions() {
    const options = {
      'hAxis': {'viewWindowMode': ViewWindowMode.EXPLICIT, 'viewWindow': {}},
      'vAxis': {'viewWindowMode': ViewWindowMode.EXPLICIT, 'viewWindow': {}},
    };
    if (this.enabledAxes!.horizontal) {
      if (!isNaN(this.viewport!.minX)) {
        (options as AnyDuringAssistedMigration)['hAxis']['viewWindow'][
          'numericMin'
        ] = this.viewport!.minX;
      }
      if (!isNaN(this.viewport!.maxX)) {
        (options as AnyDuringAssistedMigration)['hAxis']['viewWindow'][
          'numericMax'
        ] = this.viewport!.maxX;
      }
    }
    if (this.enabledAxes!.vertical) {
      if (!isNaN(this.viewport!.minY)) {
        (options as AnyDuringAssistedMigration)['vAxis']['viewWindow'][
          'numericMin'
        ] = this.viewport!.minY;
      }
      if (!isNaN(this.viewport!.maxY)) {
        (options as AnyDuringAssistedMigration)['vAxis']['viewWindow'][
          'numericMax'
        ] = this.viewport!.maxY;
      }
    }
    this.chartState.nextFrameOptions = options;
  }
}
