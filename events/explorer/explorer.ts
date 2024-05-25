/**
 * @fileoverview A tool to automate chart exploration.
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
import {ChartType, Orientation} from '../../common/option_types';
import {Options, UserOptions} from '../../common/options';
import {ChartDefinition} from '../../visualization/corechart/chart_definition';
import {ChartLayoutInterface} from '../../visualization/corechart/chart_layout_interface';
import {ChartEventType} from '../chart_event_types';
import {ChartState} from '../chart_state';
import {BaseExplorerType} from './base_explorer_type';
import * as common from './common';
import {DragToPan} from './drag_to_pan';
import {DragToZoom} from './drag_to_zoom';
import {EnabledAxes} from './enabled_axes';
import {PinchToZoom} from './pinch_to_zoom';
import {RightClickToReset} from './right_click_to_reset';
import {ScrollToZoom} from './scroll_to_zoom';
import {Viewport} from './viewport';

/**
 * A chart explorer.
 * @unrestricted
 */
export class Explorer {
  /** The current chart state. */
  private readonly chartState: ChartState;

  /** Function to get the current layout of the chart. */
  private readonly getLayout: () => ChartLayoutInterface;

  /** The chart options. */
  private readonly options: Options;

  /** The chart definition. */
  private readonly chartDefinition: ChartDefinition;

  /** The features pubsub. */
  private readonly pubsub: PubSub;

  /** The axes that are enabled. */
  private enabledAxes: EnabledAxes | null = null;

  /** The current viewport of the graph. */
  private viewport: Viewport | null = null;

  /** Holds the initialized explorer types. */
  private readonly enabledExplorerTypes: BaseExplorerType[] = [];

  /**
   * @param chartState The chart state.
   * @param getLayout A function to get the current layout of the graph.
   * @param options The chart options.
   * @param chartDefinition The chart definition.
   * @param pubsub The pubsub for all features.
   */
  constructor(
    chartState: ChartState,
    getLayout: () => ChartLayoutInterface,
    options: Options,
    chartDefinition: ChartDefinition,
    pubsub: PubSub,
    shouldInit = true,
  ) {
    this.checkValidChart(options, chartDefinition);

    /** The current chart state. */
    this.chartState = chartState;

    /** Function to get the current layout of the chart. */
    this.getLayout = getLayout;

    /** The chart options. */
    this.options = options;

    /** The chart definition. */
    this.chartDefinition = chartDefinition;

    /** The features pubsub. */
    this.pubsub = pubsub;

    if (shouldInit) {
      this.init();
    }
  }

  /**
   * Checks if there is any details of the chart that make it incapable of being
   * an explorer.
   * @param options The chart options.
   * @param chartDefinition The chart definition.
   */
  checkValidChart(options: Options, chartDefinition: ChartDefinition) {
    // Check if it is a pie chart which is not capable of viewWindow.
    if (options.inferValue('type') === ChartType.PIE) {
      throw new Error('Cannot use explorer with a pie chart');
    }
  }

  /**
   * Sets the initial viewport and ticks data needed to keep all types of
   * explorer synchronized.
   */
  handleReady() {
    let maxZoom = this.options.inferNumberValue(
      common.Options.EXPLORER + '.' + common.Options.MAX_ZOOM,
      common.DEFAULTS.MAX_ZOOM,
    );
    if (maxZoom < 1) {
      maxZoom = 1 / maxZoom;
    }
    let minZoom = this.options.inferNumberValue(
      common.Options.EXPLORER + '.' + common.Options.MIN_ZOOM,
      common.DEFAULTS.MIN_ZOOM,
    );
    if (minZoom > 1) {
      minZoom = 1 / minZoom;
    }
    const zoomDelta = this.options.inferNumberValue(
      common.Options.EXPLORER + '.' + common.Options.ZOOM_DELTA,
      common.DEFAULTS.ZOOM_DELTA,
    );
    const keepInBounds = this.options.inferBooleanValue(
      common.Options.EXPLORER + '.' + common.Options.KEEP_IN_BOUNDS,
      common.DEFAULTS.KEEP_IN_BOUNDS,
    );

    this.viewport = new Viewport(
      this.chartDefinition,
      this.getLayout(),
      maxZoom,
      minZoom,
      zoomDelta,
      keepInBounds,
    );

    // Pass these down to the enabled features.
    this.enabledExplorerTypes.forEach((explorerType) => {
      explorerType.setViewport(this.viewport as Viewport);
    });
  }

  /**
   * Initializes variables we can find (the axis settings) and the types of
   * explorer specified.
   */
  init() {
    // Enable explore mode for each orientation (horizontal and vertical)
    // only if there is just one axis, with a non-log value scale.
    // TODO(dlaliberte): Support multiple axes, either synchronizing scales
    // or with additional options, exploring only specific axes.
    const hAxisIndex = this.chartDefinition.hAxes[0] ? 0 : 1;
    const vAxisIndex = this.chartDefinition.vAxes[0] ? 0 : 1;
    const hAxis = this.chartDefinition.hAxes[hAxisIndex];
    const vAxis = this.chartDefinition.vAxes[vAxisIndex];
    // Check that the other axis (1 or 0) is undefined, for both h and v axes,
    // and that the type is value, and the logScale is false.
    let enableHorizontal =
      !this.chartDefinition.hAxes[1 - hAxisIndex] &&
      hAxis &&
      hAxis.type === 'value' &&
      !hAxis.logScale;
    let enableVertical =
      !this.chartDefinition.vAxes[1 - vAxisIndex] &&
      vAxis &&
      vAxis.type === 'value' &&
      !vAxis.logScale;

    // If the 'axis' option is explicitly 'horizontal'
    // then disable the 'vertical' mode, and vice versa.
    const settings: UserOptions =
      this.options.inferValue(common.Options.EXPLORER) || {};
    const axis = settings['axis'];

    if (axis === Orientation.HORIZONTAL) {
      enableVertical = false;
    } else if (axis === Orientation.VERTICAL) {
      enableHorizontal = false;
    }
    this.enabledAxes = new EnabledAxes(enableHorizontal, enableVertical);

    this.initExplorerTypes();

    this.pubsub.subscribe(ChartEventType.READY, () => {
      this.handleReady();
    });
  }

  /** Initializes all explorer types which are enabled by the options. */
  initExplorerTypes() {
    const enabledTypes = this.enabledExplorerTypes;
    if (DragToPan.isEnabled(this.options)) {
      enabledTypes.push(
        new DragToPan(
          this.chartState,
          this.getLayout,
          this.enabledAxes,
          this.pubsub,
        ),
      );
    }
    if (DragToZoom.isEnabled(this.options)) {
      enabledTypes.push(
        new DragToZoom(
          this.chartState,
          this.getLayout,
          this.enabledAxes,
          this.pubsub,
        ),
      );
    }
    if (RightClickToReset.isEnabled(this.options)) {
      enabledTypes.push(
        new RightClickToReset(
          this.chartState,
          this.getLayout,
          this.enabledAxes,
          this.pubsub,
        ),
      );
    }
    if (PinchToZoom.isEnabled(this.options)) {
      enabledTypes.push(
        new PinchToZoom(
          this.chartState,
          this.getLayout,
          this.enabledAxes,
          this.pubsub,
        ),
      );
    }
    if (ScrollToZoom.isEnabled(this.options)) {
      enabledTypes.push(
        new ScrollToZoom(
          this.chartState,
          this.getLayout,
          this.enabledAxes,
          this.pubsub,
        ),
      );
    }
  }

  /**
   * @param options The chart options.
   * @return If explorer is required in options.
   */
  static isEnabled(options: Options): boolean {
    if (options.inferValue('type') === ChartType.PIE) return false;
    const explorerOptions = options.inferValue(common.Options.EXPLORER);
    return explorerOptions != null && typeof explorerOptions === 'object';
  }

  getEnabledTypes() {
    return this.enabledExplorerTypes;
  }

  getEnabledAxes() {
    return this.enabledAxes;
  }
}
