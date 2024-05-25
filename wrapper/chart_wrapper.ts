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

import {UserOptions} from '../common/options';
import {AbstractVisualization} from '../visualization/abstract_visualization';
import {Wrapper, WRAPPER_KIND} from './wrapper';

/**
 * A wrapper for a simple chart application with a visualization
 * object and all the context needed to draw it.
 * Specializes the generic Wrapper for charts.
 * TODO(dlaliberte): At the moment this is limited to exporting the 'name' and
 * 'type' settings as 'chartType' and 'chartName' respectively, but
 * chart-specific logic should refactored in this class.
 * @unrestricted
 */
export class ChartWrapper extends Wrapper {
  /**
   * @param specification An object specifying the
   *     information needed to draw the chart.
   */
  constructor(specification?: string | UserOptions | null) {
    super(WRAPPER_KIND.CHART, specification);
  }

  /**
   * Returns the current drawn chart.
   * @return The current drawn chart.
   */
  getChart() {
    return this.getVisualization();
  }

  /**
   * Sets the chart object.
   * @param visualization The chart object to use.
   */
  setChart(visualization: AbstractVisualization | null) {
    this.setVisualization(visualization);
  }

  /**
   * Sets the chart type.
   * @param type The chart type.
   */
  setChartType(type: string) {
    this.setType(type);
  }

  /**
   * Returns the chart type.
   * @return The chart type.
   */
  getChartType() {
    return this.getType();
  }

  /**
   * Sets the chart name
   * @param name The chart name.
   */
  setChartName(name: string) {
    this.setName(name);
  }

  /**
   * Returns the chart name.
   * @return The chart name.
   */
  getChartName() {
    return this.getName();
  }
}
