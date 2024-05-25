/**
 * @fileoverview A class that holds simple data about the viewport of a chart.
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

import * as valuenumberconverter from '../../axis/value_number_converter';
import {ChartDefinition} from '../../visualization/corechart/chart_definition';
import {ChartLayoutInterface} from '../../visualization/corechart/chart_layout_interface';

/**
 * Class that holds simple data about the viewport of a chart.
 * @unrestricted
 */
export class Viewport {
  /** We'll need to use latest layout after each change of scale. */
  private layout: ChartLayoutInterface | null;

  /**
   * Return the numeric value for an X axis value given a screen position.
   * @param value Screen position.
   * @return The X axis value converted to a number.
   */
  getHAxisValue: (value: number) => number;

  /**
   * Return the numeric value for a Y axis value given a screen position.
   * @param value Screen position.
   * @return The Y axis value converted to a number.
   */
  getVAxisValue: (value: number) => number;

  // All the min and max values are stored as numbers,
  // in case they are Dates, because use of these values assumes numbers.
  /** The lower bound of the horizontal axis. */
  minX: number;

  /** The lower bound of the vertical axis. */
  minY: number;

  /** The upper bound of the horizontal axis. */
  maxX: number;

  /** The upper bound of the vertical axis. */
  maxY: number;

  /**
   * The lower bound of the horizontal axis when first initiated. Will not
   * change after being initialized.
   */
  origX: number;

  /**
   * The lower bound of the vertical axis when first initiated. Will not
   * change after being initialized.
   */
  origY: number;

  /**
   * The width of the vertical axis when first initiated. Will not change
   * after being initialized.
   */
  origWidth: number;

  /**
   * The height of the vertical axis when first initiated. Will not change
   * after being initialized.
   */
  origHeight: number;

  /**
   * The current scale of the chart compared to its original scale. For
   * example, if the width was being affected, the current width divided by
   * the original width gives this value.
   */
  scale = 1;

  /**
   * @param chartDefinition The chart definition.
   * @param layout The layout object for the chart.
   * @param maxZoomOut The max that a viewport is allowed to zoom out.
   * @param maxZoomIn The min that a viewport is allowed to zoom in.
   * @param zoomDelta The amount of zoom for each zoom event.
   * @param keepInBounds Whether or not to keep the viewport inside of the
   *     bounds for all actions.
   */
  constructor(
    chartDefinition: ChartDefinition,
    layout: ChartLayoutInterface | null,
    public maxZoomOut: number,
    public maxZoomIn: number,
    public zoomDelta: number,
    public keepInBounds: boolean,
  ) {
    // Determine which axes to use.
    const hAxisIndex = chartDefinition.hAxes[0] ? 0 : 1;
    const vAxisIndex = chartDefinition.vAxes[0] ? 0 : 1;
    const hAxis = chartDefinition.hAxes[hAxisIndex];
    const vAxis = chartDefinition.vAxes[vAxisIndex];

    const valueToNumberX =
      hAxis && hAxis.dataType
        ? valuenumberconverter.getByType(hAxis.dataType).toNumber
        : null;
    const valueToNumberY =
      vAxis && vAxis.dataType
        ? valuenumberconverter.getByType(vAxis.dataType).toNumber
        : null;

    /** We'll need to use latest layout after each change of scale. */
    this.layout = layout;

    /**
     * Return the numeric value for an X axis value given a screen position.
     * @param value Screen position.
     * @return The X axis value converted to a number.
     */
    this.getHAxisValue = (value: number): number => {
      // If there is no converter, the result should never be used.
      if (!valueToNumberX) {
        return value;
      }
      const getHAxisValue = this.layout!.getHAxisValue;
      return valueToNumberX(getHAxisValue(value, hAxisIndex));
    };

    /**
     * Return the numeric value for a Y axis value given a screen position.
     * @param value Screen position.
     * @return The Y axis value converted to a number.
     */
    this.getVAxisValue = (value: number): number => {
      if (!valueToNumberY) {
        return value;
      }
      const getVAxisValue = this.layout!.getVAxisValue;
      return valueToNumberY(getVAxisValue(value, vAxisIndex));
    };

    const chartAreaBounds = this.layout!.getChartAreaBoundingBox();

    // All the min and max values are stored as numbers,
    // in case they are Dates, because use of these values assumes numbers.
    /** The lower bound of the horizontal axis. */
    this.minX = this.getHAxisValue(chartAreaBounds.left);

    /** The lower bound of the vertical axis. */
    this.minY = this.getVAxisValue(
      chartAreaBounds.top + chartAreaBounds.height,
    );

    /** The upper bound of the horizontal axis. */
    this.maxX = this.getHAxisValue(
      chartAreaBounds.left + chartAreaBounds.width,
    );

    /** The upper bound of the vertical axis. */
    this.maxY = this.getVAxisValue(chartAreaBounds.top);

    /**
     * The lower bound of the horizontal axis when first initiated. Will not
     * change after being initialized.
     */
    this.origX = this.minX;

    /**
     * The lower bound of the vertical axis when first initiated. Will not
     * change after being initialized.
     */
    this.origY = this.minY;

    /**
     * The width of the vertical axis when first initiated. Will not change
     * after being initialized.
     */
    this.origWidth = this.maxX - this.minX;

    /**
     * The height of the vertical axis when first initiated. Will not change
     * after being initialized.
     */
    this.origHeight = this.maxY - this.minY;
  }

  /**
   * Setter for the layout, used by value conversion.
   * @param layout The layout object for the chart.
   */
  setLayout(layout: ChartLayoutInterface) {
    this.layout = layout;
  }
}
