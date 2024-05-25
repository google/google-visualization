/**
 * @fileoverview Manages a set of features which react to events on the current
 * chart.
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
import {Scheduler} from '../../common/scheduler';
import {ChartDefinition} from '../../visualization/corechart/chart_definition';
import {ChartLayoutInterface} from '../../visualization/corechart/chart_layout_interface';
import {ChartEventType} from '../chart_event_types';
import {ChartState} from '../chart_state';

import {Explorer} from './explorer';

/**
 * Manages a set of features which react to events on the current chart.
 * @unrestricted
 */
export class Features {
  /**
   * The time, in milliseconds that an action will require the scheduler to
   * update at.
   */
  static EVENT_COUNTDOWN_TIME: {[key: string]: number};

  /** A function to get the current layout of a chart. */
  private readonly getLayout: () => ChartLayoutInterface;

  /**
   * An array that contains all of the features that will be passed down
   * events every time they occur.
   */
  private readonly enabledFeatures: Explorer[] = [];

  /** The event scheduler. */
  private scheduler: Scheduler | null = null;

  /** The pubsub for all features. */
  private readonly pubsub: PubSub;

  /**
   * @param options The chart options.
   * @param state The chart state.
   * @param getLayout A function to get the current state of the chart.
   * @param chartDefinition The chart definition.
   */
  constructor(
    private readonly options: Options,
    private readonly state: ChartState,
    getLayout: () => ChartLayoutInterface,
    private readonly chartDefinition: ChartDefinition,
    shouldInit = true,
  ) {
    /** A function to get the current layout of a chart. */
    this.getLayout = getLayout;

    /** The pubsub for all features. */
    this.pubsub = new PubSub();

    if (shouldInit) {
      this.init();
    }
  }

  /** Initialize features that are enabled by the options. */
  init() {
    if (Explorer.isEnabled(this.options)) {
      this.enabledFeatures.push(
        new Explorer(
          this.state,
          this.getLayout,
          this.options,
          this.chartDefinition,
          this.pubsub,
        ),
      );
    }
  }

  /**
   * Sets the scheduler used to update the chart on state changes.
   * @param scheduler The scheduler.
   */
  setScheduler(scheduler: Scheduler) {
    this.scheduler = scheduler;
  }

  /**
   * Updates the countdown of the scheduler and publishes the given event.
   * @param action The name of the event that should be published.
   * param varArgs Any extra arguments that should be published.
   */
  publish(
    action: ChartEventType | string,
    data?: {targetID: string; x: number; y: number; shiftKey?: boolean},
    preventDefault?: boolean,
  ) {
    const countDownTime = Features.EVENT_COUNTDOWN_TIME[action];
    if (countDownTime && this.scheduler && !this.scheduler.isDisposed()) {
      this.scheduler.updateCountdown(countDownTime);
    }
    this.pubsub.publish.apply(this.pubsub, [action, data, preventDefault]);
  }

  getEnabledFeatures() {
    return this.enabledFeatures;
  }

  getPubsub() {
    return this.pubsub;
  }

  /**
   * Returns a key-value pair, usually will be used to trigger customized
   * callback actions.
   */
  getCustomRegisteredActions() {
    return {};
  }
}

/**
 * The time, in milliseconds that an action will require the scheduler to
 * update at.
 */
Features.EVENT_COUNTDOWN_TIME = {
  [ChartEventType.DRAG_START]: 15,
  [ChartEventType.DRAG]: 5,
  [ChartEventType.DRAG_END]: 5,
  [ChartEventType.SCROLL]: 5,
  [ChartEventType.RIGHT_CLICK]: 5,
  [ChartEventType.PINCH]: 5,
  [ChartEventType.PINCH_END]: 15,
};
