/**
 * A supplier of lines for an axis representing time.
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

import {AxisDecoration} from './axis_decoration';
import {Mapper} from './mapper';
import {millisecondsForName, TimeUnit} from './milliseconds';
import {Orientation, TextMeasurer} from './text_measurer';
import {TimeAxisStrategy} from './time_axis_strategy';

import {TimeFormatter} from '../format/formatting';

/** Creates a decoration supplier. */
export class TimeAxisDecorationSupplier {
  private readonly strategies: TimeAxisStrategy[];

  /**
   * @param mapper The mapper to use.
   * @param timeGranularity Minimum time unit.
   * @param textMeasurer Text field measurer.
   * @param timeFormatter Formatter for time.
   * @param minLabelDistance Minimum distance between labels.
   * @param orientation Axis orientation.
   * @param includeLastTimePoint Whether to include the last time point.
   */
  constructor(
    public mapper: Mapper,
    public timeGranularity: TimeUnit,
    public textMeasurer: TextMeasurer,
    private readonly timeFormatter: TimeFormatter,
    public minLabelDistance: number,
    public orientation: Orientation,
    public includeLastTimePoint: boolean,
  ) {
    this.strategies = this.getStrategies();
  }

  /**
   * Initializes strategies.
   * @return Set of strategies.
   */
  private getStrategies(): TimeAxisStrategy[] {
    // TODO(dlaliberte): Need a way to handle infinitely large/small ranges!
    return [
      this.newTimeAxisStrategy(TimeUnit.DAY, 1),
      this.newTimeAxisStrategy(TimeUnit.DAY, 7),
      this.newTimeAxisStrategy(TimeUnit.MONTH, 1),
      this.newTimeAxisStrategy(TimeUnit.MONTH, 2),
      this.newTimeAxisStrategy(TimeUnit.MONTH, 3),
      this.newTimeAxisStrategy(TimeUnit.QUARTER, 1),
      this.newTimeAxisStrategy(TimeUnit.MONTH, 6),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 1),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 2),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 5),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 10),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 20),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 50),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 100),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 1000),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 10000),
      this.newTimeAxisStrategy(TimeUnit.YEAR, 10000000),
    ];
  }

  /**
   *
   * @param labelDuration Time unit for labels.
   * @param unitsPerDuration Time unit multiplier.
   * @return The time decoration strategy.
   */
  private newTimeAxisStrategy(
    labelDuration: TimeUnit,
    unitsPerDuration: number,
  ): TimeAxisStrategy {
    return new TimeAxisStrategy(
      this.timeGranularity,
      labelDuration,
      unitsPerDuration,
      this.textMeasurer,
      this.timeFormatter,
      this.mapper,
      this.minLabelDistance,
      this.orientation,
      this.includeLastTimePoint,
    );
  }

  /**
   *
   * @return The decorations.
   */
  getDecorations(): AxisDecoration[] {
    const granularityInMillis = millisecondsForName(this.timeGranularity);
    for (let i = 0; i < this.strategies.length; i++) {
      const strategy = this.strategies[i];
      if (granularityInMillis <= strategy.getLabelDuration()) {
        const lines = strategy.attempt();
        if (lines != null) {
          // the lines fit
          return lines;
        }
      }
    }
    return [];
  }
}
