/**
 * @fileoverview Provides a simple API to create axis decorations for various
 * axes.
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

import {Options} from '../common/options';
import {
  INumberFormatter,
  NumberFormatter,
  NumberFormatterBuilder,
  TimeFormatter,
} from '../format/formatting';
import {AxisDecoration, Decorations} from './axis_decoration';
import {BoxCoxMapper} from './box_cox_mapper';
import {LinAxisDecorationSupplier} from './lin_axis_decoration_supplier';
import {LinMapper} from './lin_mapper';
import {LogAxisDecorationSupplier} from './log_axis_decoration_supplier';
import {Mapper} from './mapper';
import * as milliseconds from './milliseconds';
import {Orientation, TextMeasurer} from './text_measurer';
import {TimeAxisDecorationSupplier} from './time_axis_decoration_supplier';

/** Creates axis decorations for an axis. */
export class AxisDecorationsCreator {
  dataMin: number;
  dataMax: number;
  screenStart: number;
  screenEnd: number;
  reversed: boolean;

  lambda: number;
  epsilon: number;
  orientation: Orientation;
  options: Options;

  textMeasurer: TextMeasurer | null;
  formatterBuilder: NumberFormatterBuilder | null;
  tickLayoutTester: AnyDuringAssistedMigration;

  mapperCallback: ((p1: Mapper) => void) | null;

  private mapper: Mapper;

  /**
   * @param dataMin Minimum data value.
   * @param dataMax Maximum data value.
   * @param screenStart Screen start position.
   * @param screenEnd Screen end position.
   * @param reversed True to reverse axis, typically Y is reversed.
   * @param lambda BoxCox scale, 1 = linear, 0 = logarithmic.
   * @param epsilon Distance from 0 to nearest data value, for log scale.
   * @param textMeasurer for labels
   * @param tickLayoutTester Function used to test the layout of a list of
   *     ticks.
   * @param mapperCallback The callback will be called each time the mapper is
   *     changed, used to change how values will be scaled outside of the
   *     decorator.
   */
  constructor(
    dataMin: number,
    dataMax: number,
    screenStart: number,
    screenEnd: number,
    reversed: boolean,
    lambda: number,
    epsilon: number,
    orientation: Orientation,
    options: Options,
    textMeasurer: TextMeasurer | null,
    formatterBuilder: NumberFormatterBuilder | null,
    tickLayoutTester: ((p1: AnyDuringAssistedMigration[]) => boolean) | null,
    mapperCallback: ((p1: Mapper) => void) | null,
  ) {
    if (reversed) {
      const tmp = screenStart;
      screenStart = screenEnd;
      screenEnd = tmp;
    }

    this.dataMin = dataMin;
    this.dataMax = dataMax;
    this.screenStart = screenStart;
    this.screenEnd = screenEnd;
    this.reversed = reversed;

    this.lambda = lambda;
    this.epsilon = epsilon;
    this.orientation = orientation;
    this.options = options;

    this.textMeasurer = textMeasurer;
    this.formatterBuilder = formatterBuilder;
    this.tickLayoutTester = tickLayoutTester;

    this.mapperCallback = mapperCallback;
    this.mapper = this.defMapper();
  }

  /**
   * Defines the mapper based on parameters.
   * @return The mapper set up by the constructor.
   */
  defMapper(): Mapper {
    if (this.lambda === 1) {
      this.mapper = new LinMapper(
        this.dataMin,
        this.dataMax,
        this.screenStart,
        this.screenEnd,
      );
    } else {
      this.mapper = new BoxCoxMapper(
        this.dataMin,
        this.dataMax,
        this.screenStart,
        this.screenEnd,
        this.lambda,
        this.epsilon,
      );
    }
    if (this.mapperCallback) {
      this.mapperCallback(this.mapper);
    }
    return this.mapper;
  }

  /**
   * Creates a set of axis decorations, the gridlines and ticks.
   * @return The created axis decorations.
   */
  getNumberDecorations(min: number | null, max: number | null): Decorations {
    if (this.dataMin === this.dataMax) {
      // Special case: just one label in middle of screen.
      // TODO(dlaliberte) Find a way to avoid this special case.
      const midScreenPosition =
        this.screenStart + (this.screenEnd - this.screenStart) / 2;
      let label = '';
      if (this.formatterBuilder) {
        const formatter = this.formatterBuilder.build();
        label = formatter.format(this.dataMin);
      }
      return {
        majorGridlines: [
          AxisDecoration.makeLabel(this.dataMin, midScreenPosition, label),
        ],
        minorGridlines: undefined,
      };
    }

    return AxisDecorationsCreator.createNumberDecorations(
      this.mapper,
      this.options,
      this.epsilon,
      this.lambda,
      this.orientation,
      this.textMeasurer,
      this.formatterBuilder,
      this.tickLayoutTester,
      min,
      max,
    );
  }

  /**
   * Creates the best set of axis decorations, the gridlines and ticks.
   * This is determined by merely repeated generation of a set of decorations,
   * and expanding the min and max, if allowed as determined from the
   * originalMin and originalMax, until no further change is made. For each
   * attempt, the mapper will be updated, so the last attempt, which is assumed
   * to be successful, will be used.  If not successful, we would have to set
   * the mapper back to whatever was used in the last successful attempt.
   * @return The created axis decorations.
   */
  getBestNumberDecorations(
    viewMin: number,
    viewMax: number,
    originalMin: number | null,
    originalMax: number | null,
  ): Decorations {
    let decorations: Decorations | undefined;

    // Loop until there are no more changes in the view min and max.
    // This is a bit risky since the view may be changed each time, hence the
    // gridlines may be changed, which affects the view the next time, etc.
    // But the 'spacingValue' for the linear and log decorations supplier
    // is constrained by the range of the view min and max.
    // Just in case, let's limit the number of attempts.
    let minMaxChanged = true;
    let numAttemptsLeft = 100;

    do {
      if (numAttemptsLeft-- < 0) {
        break;
      }

      // Update the mapper based on new data min and max.
      this.dataMin = viewMin;
      this.dataMax = viewMax;
      this.defMapper();

      const lastMin = viewMin;
      const lastMax = viewMax;

      decorations = this.getNumberDecorations(viewMin, viewMax);

      const majorGridlines = decorations.majorGridlines;
      if (majorGridlines.length > 1) {
        if (originalMin != null) {
          viewMin = majorGridlines[0].getValue();
        }
        if (originalMax != null) {
          viewMax = majorGridlines[majorGridlines.length - 1].getValue();
        }
      }

      // After finding out whether we could expand the range,
      // we may need to recalc ticks based on the new min and max.
      minMaxChanged = viewMin !== lastMin || viewMax !== lastMax;

      if (isNaN(viewMin) || isNaN(viewMax)) {
        // Special case, with no data rows.
        minMaxChanged = false;
        // Stop looping.

        viewMin = originalMin != null ? originalMin : viewMin;
        viewMax = originalMax != null ? originalMax : viewMax;
      }
    } while (minMaxChanged);

    if (!decorations) {
      throw new Error('Failed creating decorations');
    }
    decorations.min = viewMin;
    decorations.max = viewMax;
    // AnyDuringAssistedMigration because:  Type 'Decorations | undefined' is
    // not assignable to type 'Decorations'.
    return decorations;
  }

  /**
   * Creates axis decorations for an axis.
   * This is the old API, which Dive still depends on.
   * TODO(dlaliberte) Maybe change Dive to use the new API.
   *
   * @param dataMin Minimum data value.
   * @param dataMax Maximum data value.
   * @param screenStart Screen start position.
   * @param screenEnd Screen end position.
   * @param reversed True to reverse axis, typically Y is reversed.
   * @param lambda BoxCox scale, 1 = linear, 0 = logarithmic.
   * @param epsilon Distance from 0 to nearest data value.
   * @param orientation Axis orientation.
   * @param minLineSpacing Minimum distance between lines.
   * @param textMeasurer A text measurer for axis labels.
   * @param formatter A value formatter for axis labels.
   * @return The created axis decorations.
   */
  static getNumberDecorations(
    dataMin: number,
    dataMax: number,
    screenStart: number,
    screenEnd: number,
    reversed: boolean,
    lambda: number,
    epsilon: number,
    orientation: Orientation,
    minLineSpacing: number,
    textMeasurer: TextMeasurer,
    formatter: INumberFormatter,
  ): AxisDecoration[] {
    const formatterBuilder: NumberFormatterBuilder = {
      setMinNumDecimals(
        this: NumberFormatterBuilder,
        minNumDecimals: number,
      ): NumberFormatterBuilder {
        return this;
      },
      setMaxNumDecimals(
        this: NumberFormatterBuilder,
        maxNumDecimals: number,
      ): NumberFormatterBuilder {
        return this;
      },
      setNumSignificantDigits(
        this: NumberFormatterBuilder,
        numSigDecimals: number,
      ): NumberFormatterBuilder {
        return this;
      },
      build() {
        return formatter as NumberFormatter;
      },
    } as NumberFormatterBuilder;
    const tickLayoutTester = (dataValues: AnyDuringAssistedMigration) => {
      return true;
    };
    const options = new Options([
      {'gridlines': {'minSpacing': minLineSpacing}},
    ]);
    return new AxisDecorationsCreator(
      dataMin,
      dataMax,
      screenStart,
      screenEnd,
      reversed,
      lambda,
      epsilon,
      orientation,
      options,
      textMeasurer,
      formatterBuilder,
      tickLayoutTester,
      null,
    ).getNumberDecorations(dataMin, dataMax).majorGridlines;
  }

  /**
   * Gets number decorations with simplified arguments.
   * This is to be used only for generating the tick values regardless
   * of formatting or layout, which is what we need for the generation
   * of histogram buckets.
   *
   * @param dataMin Minimum data value.
   * @param dataMax Maximum data value.
   * @param screenStart Screen start position.
   * @param screenEnd Screen end position.
   */
  static getSimpleNumberDecorations(
    dataMin: number,
    dataMax: number,
    screenStart: number,
    screenEnd: number,
    options: Options,
  ): AxisDecoration[] {
    const originalMin = dataMin;
    const originalMax = dataMax;
    // TODO(dlaliberte) Arbitrary small margin factor is suspicious.
    const margin = (dataMax - dataMin) * 0.005;
    dataMax += margin;
    dataMin -= margin;

    return new AxisDecorationsCreator(
      dataMin,
      dataMax,
      screenStart,
      screenEnd,

      false, // not reversed
      1, // linear only, for now
      0, // epsilon only used for log scale

      Orientation.HORIZONTAL,
      options, // We don't need the textMeasurer, formatterBuilder,
      // tickLayoutTester, mapperCallback functions for this simple
      // application since no formatting or layout is expected.
      null,
      null,
      null,
      null,
    ).getBestNumberDecorations(originalMin, originalMax, null, null)
      .majorGridlines;
  }

  /**
   * Creates axis decorations for an axis.
   *
   * @param dataMin Minimum data value.
   * @param dataMax Maximum data value.
   * @param screenStart Screen start position.
   * @param screenEnd Screen end position.
   * @param reversed True to reverse axis, typically Y is reversed.
   * @param timeGranularity Time granularity.
   * @param orientation Axis orientation.
   * @param minLabelDistance Minimum distance between labels.
   * @param textMeasurer Text measurer for axis labels.
   * @param formatter A formatter for axis labels.
   * @param includeLastTimePoint Whether to include last time point, even if it
   *     doesn't align with the other labels.
   * @return The created axis decorations.
   */
  static getTimeDecorations(
    dataMin: number,
    dataMax: number,
    screenStart: number,
    screenEnd: number,
    reversed: boolean,
    timeGranularity: milliseconds.TimeUnit,
    orientation: Orientation,
    minLabelDistance: number,
    textMeasurer: TextMeasurer,
    formatter: TimeFormatter,
    includeLastTimePoint: boolean,
  ): AxisDecoration[] {
    if (reversed) {
      const tmp = screenStart;
      screenStart = screenEnd;
      screenEnd = tmp;
    }

    const mapper = new LinMapper(dataMin, dataMax, screenStart, screenEnd);

    const supplier = new TimeAxisDecorationSupplier(
      mapper,
      timeGranularity,
      textMeasurer,
      formatter,
      minLabelDistance,
      orientation,
      includeLastTimePoint,
    );
    return supplier.getDecorations();
  }

  /**
   * Uses either linear or log decorations supplier to generate the ticks
   * and gridlines.  The min and max parameters bound the actual data range,
   * and implicitly constrain the minSpacing.
   *
   * @param mapper Mapper to use.
   * @param epsilon The distance from zero to the closest data value.
   * @param orientation Axis orientation.
   * @param textMeasurer Text measurer for axis labels.
   * @return The created axis decorations.
   */
  static createNumberDecorations(
    mapper: Mapper,
    options: Options,
    epsilon: number,
    lambda: number,
    orientation: Orientation,
    textMeasurer: TextMeasurer | null,
    formatterBuilder: NumberFormatterBuilder | null,
    tickLayoutTester: ((p1: AnyDuringAssistedMigration[]) => boolean) | null,
    min: number | null,
    max: number | null,
  ): Decorations {
    // TODO(dlaliberte) Use lambda instead of computing the data density?
    const ratio = AxisDecorationsCreator.calculateDataDensityRatio(mapper);
    let axisDecorationSupplier;
    if (ratio > 0.65 && lambda > 0.5) {
      // The 0.65 happens to look OK. Only matters for between lin and log.
      // But log scale should be used anyway if lambda is non-zero.
      axisDecorationSupplier = new LinAxisDecorationSupplier(
        mapper,
        formatterBuilder,
        textMeasurer,
        tickLayoutTester,
        orientation,
        options,
      );
    } else {
      axisDecorationSupplier = new LogAxisDecorationSupplier(
        mapper,
        formatterBuilder,
        textMeasurer,
        tickLayoutTester,
        orientation,
        options,
        epsilon,
      );
    }
    return axisDecorationSupplier.getDecorations(min, max);
  }

  /**
   * Calculate the data density ratio for this axis screen range.
   *
   * Data density is the size of the data range mapped to a particular
   * pixel on screen. The data density ratio is the quotient of the
   * data density at the smallest <strong>absolute</strong> data value
   * divided by the data density at the largest <strong>absolute</strong>
   * data value in the data range.
   *
   * This implementation relies on the use of mirror mappers with even
   * change in data density. What this means for this method is that we
   * only look for data density boundary values at screen min, screen max
   * and around the screen value that represents the data value 0 (if the
   * data value 0 is included in the data range).
   *
   * @param mapper The mapper to use.
   * @return The density ratio.
   * #visibleForTesting
   */
  static calculateDataDensityRatio(mapper: Mapper): number {
    if (mapper.getDataMin() === mapper.getDataMax()) {
      return 1;
    }
    const screenMin = Math.min(mapper.getScreenStart(), mapper.getScreenEnd());
    const screenMax = Math.max(mapper.getScreenStart(), mapper.getScreenEnd());
    const screenZero = mapper.getScreenValue(0);

    // Find the largest absolute data value in the data span.
    const absEdgeValue1 = Math.abs(mapper.getDataValue(screenMin));
    const absEdgeValue2 = Math.abs(mapper.getDataValue(screenMax));
    const maxDataValue = Math.max(absEdgeValue1, absEdgeValue2);
    // Find the smallest absolute data in the data span.
    let minDataValue = 0;
    // Note: order of min and max might be reversed.
    // Maybe use: ((screenMin <= screenZero) !== (screenZero <= screenMax))
    if (screenMin > screenZero || screenZero > screenMax) {
      minDataValue = Math.min(absEdgeValue1, absEdgeValue2);
    }

    // Calculate the pixel representations and the ratio.
    const pixelAtAbsMin = mapper.getScreenValue(minDataValue);
    const pixelAtAbsMax = mapper.getScreenValue(maxDataValue);

    /**
     * Get the amount of data represented in a pixel on stage.
     * @param pixelPosition Pixel position to check.
     * @param mapper Mapper to use.
     * @return A data interval at the given screen position.
     */
    const getDataDensity = (pixelPosition: number, mapper: Mapper): number => {
      const PIXEL_SAMPLE_SIZE = 10;
      const dataStart = mapper.getDataValue(pixelPosition);
      const dataEnd = mapper.getDataValue(pixelPosition + PIXEL_SAMPLE_SIZE);
      return Math.abs(dataEnd - dataStart);
    };
    const ratio =
      getDataDensity(pixelAtAbsMin, mapper) /
      getDataDensity(pixelAtAbsMax, mapper);

    return ratio;
  }
}
