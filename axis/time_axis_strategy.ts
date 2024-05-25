/**
 * @fileoverview
 * Attempts to create a list of axis decorations for a horizontal time
 * axis.
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
import {Sequence} from './sequence';
import {Orientation, TextMeasurer} from './text_measurer';
import {createTimeSequence} from './utils';

import {TimeFormatter} from '../format/formatting';

// During migration
// tslint:disable:ban-types Migration

/** Creates a TimeAxisStrategy. */
export class TimeAxisStrategy {
  dataGranularity: AnyDuringMigration;
  labelGranularity: AnyDuringMigration;
  unitsPerLabel: AnyDuringMigration;
  textMeasurer: AnyDuringMigration;
  timeFormatter: AnyDuringMigration;
  mapper: AnyDuringMigration;
  minLabelDistance: AnyDuringMigration;
  orientation: AnyDuringMigration;
  includeLastTimePoint: AnyDuringMigration;

  /** The dataGranularity represented in milliseconds. */
  private readonly dataGranularityInMillis: number;

  /** The labelGranularity represented in milliseconds. */
  private readonly labelGranularityInMillis: number;

  /**
   * @param dataGranularity The time granularity in the data. Used for the last
   *     label on the axis.
   * @param labelGranularity The granularity used when formatting label values
   *     other than the last one.
   * @param unitsPerLabel Time units per label. For instance if there's a label
   *     for every 3 or 6 months, or 100 years.
   * @param textMeasurer A text measurer.
   * @param timeFormatter A time formatter.
   * @param mapper The mapper to use.
   * @param minLabelDistance Minimum distance between labels.
   * @param orientation Axis orientation.
   * @param includeLastTimePoint Whether to show last point in time, even if
   *     it's not aligned with the chosen labels.
   */
  constructor(
    dataGranularity: TimeUnit,
    labelGranularity: TimeUnit,
    unitsPerLabel: number,
    textMeasurer: TextMeasurer,
    timeFormatter: TimeFormatter,
    mapper: Mapper,
    minLabelDistance: number,
    orientation: Orientation,
    includeLastTimePoint: boolean,
  ) {
    this.dataGranularity = dataGranularity;
    this.labelGranularity = labelGranularity;
    this.unitsPerLabel = unitsPerLabel;
    this.textMeasurer = textMeasurer;
    this.timeFormatter = timeFormatter;
    this.mapper = mapper;
    this.minLabelDistance = minLabelDistance;
    this.orientation = orientation;
    this.includeLastTimePoint = includeLastTimePoint;

    this.dataGranularityInMillis = millisecondsForName(dataGranularity);

    this.labelGranularityInMillis = millisecondsForName(labelGranularity);

    this.timeFormatter.setTimeUnit(this.labelGranularity);
  }

  /**
   *
   * @return The label duration.
   */
  getLabelDuration(): number {
    return this.labelGranularityInMillis;
  }

  /**
   * Creates a single axis decoration when start time == end time.
   * @param value The single point in time.
   * @return Array with a single decoration.
   */
  singleLabel(value: number): AxisDecoration[] {
    return [
      AxisDecoration.makeLabel(
        value,
        Math.abs(this.mapper.getScreenStart() - this.mapper.getScreenEnd()) / 2,
        this.timeFormatter.format(value),
      ),
    ];
  }

  /**
   * Attempts to generate lines, ticks and labels without overlapping labels.
   * Returns null if labels do not fit.
   * @return The created decorations.
   */
  attempt(): AxisDecoration[] | null {
    const firstTime = this.mapper.getDataMin();
    const lastTime = this.mapper.getDataMax();

    this.timeFormatter.setTimeUnit(this.dataGranularity);
    if (firstTime === lastTime) {
      return this.singleLabel(firstTime);
    }
    const lastTimeDecoration =
      AxisDecoration.makeLeftAlignedLabelWithLineAndTick(
        lastTime,
        this.mapper.getScreenEnd(),
        this.timeFormatter.format(lastTime),
      );
    this.timeFormatter.setTimeUnit(this.labelGranularity);

    const labelIntervalsInsteadOfPoints =
      this.unitsPerLabel === 1 &&
      this.labelGranularityInMillis > this.dataGranularityInMillis;

    const lineSequence = createTimeSequence(
      this.labelGranularityInMillis * this.unitsPerLabel,
    );

    const tickSequence = createTimeSequence(this.labelGranularityInMillis);
    const decorations = [];
    let previousValue = NaN;
    let nextLineValue = lineSequence.ceil(firstTime);
    let value;
    for (
      value = tickSequence.ceil(firstTime);
      value <= lastTime;
      value = tickSequence.next()
    ) {
      const position = this.mapper.getScreenValue(value);
      if (value === nextLineValue) {
        nextLineValue = lineSequence.next();
        if (this.twoLabelsCollide(previousValue, value)) {
          return null;
        }
        if (labelIntervalsInsteadOfPoints) {
          if (!isNaN(previousValue)) {
            decorations.push(this.makeLabelBetween(previousValue, value));
          }
          decorations.push(
            AxisDecoration.makeLineWithHeavyTick(value, position),
          );
        } else {
          const line = AxisDecoration.makeLabeledLineWithHeavyTick(
            value,
            position,
            this.timeFormatter.format(value),
          );
          decorations.push(line);
        }
        previousValue = value;
      } else {
        decorations.push(AxisDecoration.makeTick(value, position));
      }
    }

    if (labelIntervalsInsteadOfPoints && lastTime < value) {
      this.addLabelForIncompleteInterval(decorations, tickSequence, lastTime);
    }

    if (this.includeLastTimePoint) {
      this.hideLastLabelIfOverlapsWithMax(
        lastTimeDecoration,
        decorations,
        this.textMeasurer,
      );
      decorations.push(lastTimeDecoration);
    }

    if (this.numberOfLabelsIn(decorations) < 2) {
      return this.alternativeForLessThanTwoLabels();
    }

    if (this.ticksCollide(decorations)) {
      return this.withoutTicks(decorations);
    }

    return decorations;
  }

  /**
   * If we are labeling yearly intervals, and the time range ends 2011-11,
   * the label '2011' will not be added by the code above since it's not
   * complete.
   *
   * This method adds it if there's room for it.
   *
   * @param decorations The decorations.
   * @param tickSequence The tick sequence.
   * @param max The maximum value on the time scale.
   */
  private addLabelForIncompleteInterval(
    decorations: AxisDecoration[],
    tickSequence: Sequence,
    max: number,
  ) {
    const label = this.timeFormatter.format(max);
    const width = this.textMeasurer.getSizeByOrientation(
      label,
      this.orientation,
    );
    const nextTime = tickSequence.getValue();
    const prevTime = tickSequence.previous();
    const prevPos = Number(this.mapper.getScreenValue(prevTime));
    const nextPos = Number(this.mapper.getScreenValue(nextTime));
    const endPos = this.mapper.getScreenValue(max);
    const middlePos = (prevPos + nextPos) / 2;
    if (endPos - middlePos > width / 2) {
      decorations.push(AxisDecoration.makeLabel(max, middlePos, label));
    }
  }

  /**
   * Removes the last label if it overlaps with the max label.
   * @param maxDecoration The max decoration.
   * @param decorations All decorations.
   * @param textMeasurer The text measurer.
   */
  private hideLastLabelIfOverlapsWithMax(
    maxDecoration: AxisDecoration,
    decorations: AxisDecoration[],
    textMeasurer: TextMeasurer,
  ) {
    const previous = this.findLastLabeledDecoration(decorations);
    if (previous != null) {
      const sizeOfPrevious = Number(
        this.textMeasurer.getSizeByOrientation(
          previous.getLabel(),
          this.orientation,
        ),
      );
      const sizeOfMaxDecoration = Number(
        this.textMeasurer.getSizeByOrientation(
          maxDecoration.getLabel(),
          this.orientation,
        ),
      );
      const midpointDistance = Math.abs(
        previous.getPosition() - maxDecoration.getPosition(),
      );

      const distance =
        midpointDistance - (sizeOfPrevious + sizeOfMaxDecoration) / 2;
      if (distance < this.minLabelDistance) {
        previous.setLabel(null);
      }
    }
  }

  /**
   * Returns the last labeled AxisDecoration in the list. Null if no labeled
   * decoration exists.
   * @param decorations The decorations.
   * @return The last labeled decoration.
   * #visibleForTesting
   */
  findLastLabeledDecoration(
    decorations: AxisDecoration[],
  ): AxisDecoration | null {
    for (let i = decorations.length - 1; i >= 0; i--) {
      if (decorations[i].getLabel() != null) {
        return decorations[i];
      }
    }
    return null;
  }

  /**
   * Alternate way to create a single label.
   * @return The created decorations.
   */
  private alternativeForLessThanTwoLabels(): AxisDecoration[] {
    const start = this.timeFormatter.format(this.mapper.getDataMin());
    const end = this.timeFormatter.format(this.mapper.getDataMax());
    const summaryLabel = `${start}-${end}`; // TODO(dlaliberte): i18n.
    const decorations = [];
    if (!this.tooWide(summaryLabel, this.mapper)) {
      const midpoint =
        Number(this.mapper.getScreenStart()) +
        Number(this.mapper.getScreenEnd() / 2);
      decorations.push(AxisDecoration.makeLabel(NaN, midpoint, summaryLabel));
    }
    return decorations;
  }

  /**
   * Checks if a label is too wide to fit the chart.
   * @param label The label.
   * @param mapper The mapper.
   * @return True if the label is too wide.
   */
  private tooWide(label: string, mapper: Mapper): boolean {
    const MARGIN = 20; // Extra space allowed outside chart.
    const chartWidth = Math.abs(
      this.mapper.getScreenStart() - this.mapper.getScreenEnd(),
    );
    return this.textMeasurer.getWidth(label) > chartWidth + MARGIN * 2;
  }

  /**
   * Counts the number of labels.
   * @param decorations The decorations.
   * @return The number of labels.
   */
  private numberOfLabelsIn(decorations: AxisDecoration[]): number {
    let count = 0;
    for (let i = 0; i < decorations.length; i++) {
      if (decorations[i].getLabel() != null) {
        count++;
      }
    }
    return count;
  }

  /**
   * Returns decorations without ticks.
   * @param listWithTicks Decorations.
   * @return Decorations without ticks.
   */
  private withoutTicks(listWithTicks: AxisDecoration[]): AxisDecoration[] {
    const listWithoutTicks = [];
    for (let i = 0; i < listWithTicks.length; i++) {
      const decoration = listWithTicks[i];
      if (!decoration.hasTick() || decoration.hasLine()) {
        listWithoutTicks.push(decoration);
      }
    }
    return listWithoutTicks;
  }

  /**
   * Checks if labels of two values would collide.
   * @param value1 The first value.
   * @param value2 The second value.
   * @return True if the labels collide.
   * #visibleForTesting
   */
  twoLabelsCollide(value1: number, value2: number): boolean {
    const size1 = Number(
      this.textMeasurer.getSizeByOrientation(
        this.timeFormatter.format(value1),
        this.orientation,
      ),
    );
    const size2 = Number(
      this.textMeasurer.getSizeByOrientation(
        this.timeFormatter.format(value2),
        this.orientation,
      ),
    );
    const midpointDistance = Math.abs(
      this.mapper.getScreenValue(value1) - this.mapper.getScreenValue(value2),
    );
    const distance = midpointDistance - (size1 + size2) / 2;
    return distance < this.minLabelDistance;
  }

  /**
   * Checks if there's space for all ticks.
   * @param decorations The ticks to check.
   * @return True if the ticks collide.
   * #visibleForTests
   */
  ticksCollide(decorations: AxisDecoration[]): boolean {
    const minTickSpacing = 5; // Minimum tick distance.

    if (decorations.length < 2) {
      return false;
    }

    let prevDecoration = decorations[0];
    for (let i = 1; i < decorations.length; i++) {
      const decoration = decorations[i];
      const distance = Math.abs(
        decoration.getPosition() - prevDecoration.getPosition(),
      );
      if (
        distance < minTickSpacing &&
        prevDecoration.getValue() !== decoration.getValue()
      ) {
        // This check is needed to be sure they're not about the same value.
        // TODO(dlaliberte): Consider approach to avoid this check.
        return true;
      }
      prevDecoration = decoration;
    }
    return false;
  }

  /**
   * Creates a new label between two values.
   * @param value1 First value.
   * @param value2 Second value.
   * @return The created axis decoration.
   */
  private makeLabelBetween(value1: number, value2: number): AxisDecoration {
    const pos1 = Number(this.mapper.getScreenValue(value1));
    const pos2 = Number(this.mapper.getScreenValue(value2));
    const labelPosition = (pos1 + pos2) / 2;
    const labelMarker = AxisDecoration.makeLabel(
      this.mapper.getDataValue(labelPosition),
      labelPosition,
      this.timeFormatter.format(value1),
    );
    return labelMarker;
  }
}
