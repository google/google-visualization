/**
 * @fileoverview An algorithm for defining gridlines. Works for date/datetime/
 * time horizontal axis.
 * Analysis doc: http://goo.gl/dkxFp
 * Design doc: http://goo.gl/e2GrX
 * Usage:
 * - Create a "Definer", either using the "Definer.build"
 *   (for default settings) or directly using the constructor of the Definer,
 *   for using custom settings.
 * - Run the algorithm by calling the "calc" method.
 *
 * TODO(dlaliberte): We should probably replace this with the TimeAxisDecorationSupplier.
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

import {
  concat,
  equals,
  findIndex,
  forEach,
  map,
} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {Range} from '@npm//@closure/math/range';
import {Options} from '../common/options';
import {
  DateRangeIter,
  Duration,
  TIME_UNIT,
  floorDate,
  floorDateToMonday,
  multiplyDuration,
  roundMillisAccordingToTable,
  timeUnitDurations,
  timeUnitIndex,
  timeUnitOrder,
} from '../common/timeutil';
import {DateFormat} from '../format/dateformat';
import {Brush} from '../graphics/brush';
import {TextAlign} from '../text/text_align';
import {TextBlock} from '../text/text_block_object';
import {TextMeasureFunction} from '../text/text_measure_function';
import {TextStyle} from '../text/text_style';
import {TextItem, TickLine} from '../visualization/corechart/axis_definition';

// tslint:disable:ban-types

/**
 * Definer for date ticks.
 */
export class Definer {
  static getTextBounds: AnyDuringMigration;
  static NOTCH_LENGTH: AnyDuringMigration;

  private readonly format: AnyDuringMigration | null;

  /** The minimum number of pixels between major gridlines. */
  private readonly minStrongLineDistance: number;

  /** The minimum number of pixels between minor gridlines. */
  private readonly minWeakLineDistance: number;

  private readonly minStrongToWeakLineDistance: number;

  private readonly minNotchDistance: number;

  private readonly minMajorTextDistance: number;

  private readonly minMinorTextDistance: number;

  private readonly unitThreshold: number;

  /** Whether minor gridlines should be drawn at all. */
  private readonly allowMinor: boolean;

  /** Whether the axis is oriented vertically. */
  private readonly isVertical: boolean;

  /**
   * How many milliseconds to add to times, used to correct for
   * time zone and daylight savings, for timeofday values.
   */
  private readonly timeOffset: number;

  /**
   * numericDateToPositionFunc A function
   *     mapping numeric value of date to their x position on screen.
   */
  private readonly numericDateToPositionFunc: (
    p1: number | null,
  ) => number | null;

  /**
   * A function for measuring the dimension of text objects.
   * measureFunction
   */
  private readonly measureFunction: TextMeasureFunction;

  majorGridlinesConfig: GridlinesConfig | null = null;

  minorGridlinesConfig: GridlinesConfig | null = null;

  /**
   * An algorithm for finding the best gridlines and tick text for dates.
   * @param roundDurationTable An array of duration objects which are considered round, and are allowed as difference between ticks. Note: Each duration should use exactly one unit (non zero value in the array).
   * @param durationTableRepeatingIntervals The number of repeating intervals at the end of the round duration table.
   * @param options The user options. Typically an Option.view that starts at the right prefix for the axis.
   * @param isVertical Whether the ticks are drawn on vertical axis.
   * @param timeOffset How much to offset date-time values, used for timeofday values which have no timezone or daylight savings.
   * @param numericDateToPositionFunc A function mapping numeric value of date to their x position on screen.
   * @param measureFunction A function for measuring the dimension of text objects.
   */
  constructor(
    private readonly roundDurationTable: number[][],
    private readonly durationTableRepeatingIntervals: number,
    private readonly options: Options,
    isVertical: boolean,
    timeOffset: number,
    numericDateToPositionFunc: (p1: number | null) => number | null,
    measureFunction: TextMeasureFunction,
  ) {
    // Should be string for a pattern, or object parameter for DateFormat.
    const formatOption = options.inferValue('format');

    this.format =
      formatOption == null
        ? null
        : typeof formatOption === 'string'
          ? {'pattern': formatOption} // Clone the formatOption, since we will set its pattern.
          : {
              'pattern': (formatOption as AnyDuringMigration)['pattern'],
              'formatType': (formatOption as AnyDuringMigration)['formatType'],
              'timeZone': (formatOption as AnyDuringMigration)['timeZone'],
            };

    this.minStrongLineDistance = options.inferNonNegativeNumberValue([
      'gridlines.minSpacing',
      'gridlines.minStrongLineDistance',
    ]);

    this.minWeakLineDistance = options.inferNonNegativeNumberValue([
      'minorGridlines.minSpacing',
      'gridlines.minWeakLineDistance',
    ]);

    this.minStrongToWeakLineDistance = options.inferNonNegativeNumberValue(
      'gridlines.minStrongToWeakLineDistance',
    );

    this.minNotchDistance = options.inferNonNegativeNumberValue(
      'gridlines.minNotchDistance',
    );

    this.minMajorTextDistance = options.inferNonNegativeNumberValue(
      'gridlines.minMajorTextDistance',
    );

    this.minMinorTextDistance = options.inferNonNegativeNumberValue(
      'gridlines.minMinorTextDistance',
    );

    this.unitThreshold = options.inferNonNegativeNumberValue(
      'gridlines.unitThreshold',
    );

    this.allowMinor = options.inferBooleanValue('gridlines.allowMinor');

    // Also look at the minorGridlines.count to override allowMinor if 0.
    const minorGridlinesCount = options.inferOptionalNumberValue(
      'minorGridlines.count',
    );
    if (minorGridlinesCount === 0) {
      this.allowMinor = false;
    }

    this.isVertical = isVertical;

    this.timeOffset = timeOffset;

    this.numericDateToPositionFunc = numericDateToPositionFunc;

    this.measureFunction = measureFunction;
  }

  /**
   * Constructs the tick definer with the default 'roundness' definitions.
   * @param options The options.
   * @param isVertical Whether the ticks are drawn on vertical axis.
   * @param timeOffset The amount to offset timeofday values.
   * @param numericDateToPositionFunc A function mapping numeric value of date to their x position on screen.
   * @param measureFunction A function for measuring the dimension of text objects.
   */
  static build(
    options: Options,
    isVertical: boolean,
    timeOffset: number,
    numericDateToPositionFunc: (p1: number | null) => number | null,
    measureFunction: TextMeasureFunction,
  ): Definer {
    return new Definer(
      defaultDatetimeRoundUnits,
      DATETIME_ROUND_UNITS_REPEATING_INTERVAL,
      options,
      isVertical,
      timeOffset,
      numericDateToPositionFunc,
      measureFunction,
    );
  }

  /**
   * Generates gridlines and tick text. This function takes care of all the
   * styling issues and finds the right gridlines to show (both for major,
   * minor, and notches), but does not check for tick layout overlaps.
   * @param minValue The lower end of the view window range.
   * @param maxValue The higher end of the view window range.
   * @param dataGranularity the minimal difference between data points in ms.
   * @param tickOptions Options for controlling the presentation of tick texts.
   */
  *generate(
    minValue: number,
    maxValue: number,
    dataGranularity: number,
    tickOptions: TickOptions,
  ): Iterator<{gridlines: TickLine[]; tickTextLayout: TextItem[]}> {
    // Obtaining a DataAnalysis (da) for our data and view window.
    const da = this.analyzeData(minValue, maxValue, dataGranularity);

    // TODO(dlaliberte) Replace use of inferObjectValue with
    // inferOptionalTypedObjectValue(...), which requires an 'array' type,
    // and then we can remove inferDateTicksUnitConfigValue
    const majorUnit = this.options.inferObjectValue(
      'gridlines.units.' + da.unit,
    ) as {format: string[]; interval: number[]};
    assert(majorUnit != null);

    const majorUnitIndex = timeUnitIndex[da.unit];
    const majorUnitDuration = timeUnitDurations[majorUnitIndex];

    const gridlinesToAvoid: TickLine[] = [];

    const majorGridlinesConfig: GridlinesConfig = {
      minValue: da.minValue,
      maxValue: da.maxValue,
      unitName: da.unit,
      unitIndex: majorUnitIndex,
      unitDuration: majorUnitDuration,
      unitFormats: majorUnit.format,
      unitMultiples: majorUnit.interval,
      minLineDistance: this.minStrongLineDistance,
      gridlineBrush: tickOptions.gridlineBrush,
      tickTextStyle: tickOptions.tickTextStyle,
      minTextDistance: this.minMajorTextDistance,
      gridlinesToAvoid,
      minCrossGridlinesDistance: 0,
    };
    // Preserve major gridlines in dateTicks instance, to be used
    // with explicit ticks option.
    this.majorGridlinesConfig = majorGridlinesConfig;

    const majorGGenerator = this.computeGridlines(majorGridlinesConfig);
    let majorG = null;

    while ((majorG = majorGGenerator.next().value)) {
      if (majorG.gridlines.length === 0) {
        // No major gridlines produced, so skip to the next alternative.
        continue;
      }

      const leftRightAlign = tickOptions.alignment;

      // We may use minor unit only if all the following holds:
      // a) We are allowed to show minor unit by the options.
      // b) The multiplication of the major unit was 1.
      // c) The major units are not the most refined ones.
      // If any of the conditions above fail, we will return with the major
      // gridlines. We may still include refined major gridlines (a.k.a
      // notches).
      if (
        !(
          this.allowMinor && // a
          majorG.multiple === 1 && // b
          majorUnitIndex > 0
        )
      ) {
        // We will place our texts below the gridline when we don't show a
        // gridline for every unit (multiple > 1) so the association between the
        // text and gridline will be clear. (preparing for possible notches)
        // We also place our texts below the gridline when we use the same
        // granularity as our data.
        // TODO(dlaliberte): Fix horizontal assumption; use this.isVertical
        const tickSpan =
          majorG.multiple !== 1 ? TickSpanType.BELOW : leftRightAlign;
        const tickTextLayout = this.getTickText(
          tickOptions.tickTextStyle,
          tickSpan,
          majorG.gridlines,
          majorG.texts,
        );

        // When we don't show a text for every repetition of a unit, we try to
        // refine with notches if possible.
        let gridlines;
        if (majorG.multiple > 1) {
          const refinedMajorGridlines = this.computeRefinedMajorGridlines(
            da,
            majorG,
            majorUnitDuration,
            tickOptions,
          );
          gridlines = concat(majorG.gridlines, refinedMajorGridlines);
        } else {
          gridlines = majorG.gridlines;
        }

        yield {gridlines, tickTextLayout};
      } else {
        const minorUnitIndex = majorUnitIndex - 1;
        const minorUnitName = timeUnitOrder[minorUnitIndex];

        const minorUnit = this.options.inferObjectValue(
          `minorGridlines.units.${minorUnitName}`,
        ) as {format: string[]; interval: number[]};
        assert(minorUnit != null);
        const minorUnitDuration = timeUnitDurations[minorUnitIndex];

        const minorGridlinesConfig: GridlinesConfig = {
          minValue: da.minValue,
          maxValue: da.maxValue,
          unitName: minorUnitName,
          unitIndex: minorUnitIndex,
          unitDuration: minorUnitDuration,
          unitFormats: minorUnit.format,
          unitMultiples: minorUnit.interval,
          minLineDistance: this.minWeakLineDistance,
          gridlineBrush: tickOptions.minorGridlineBrush,
          tickTextStyle: tickOptions.minorTickTextStyle,
          minTextDistance: this.minMinorTextDistance,
          gridlinesToAvoid: majorG.gridlines,
          minCrossGridlinesDistance: this.minStrongToWeakLineDistance,
        };
        this.minorGridlinesConfig = minorGridlinesConfig;

        const minorGGenerator = this.computeGridlines(minorGridlinesConfig);
        let minorG = null;
        let minorDone = false;

        while (!minorDone) {
          minorG = minorGGenerator.next().value;
          minorDone = minorG == null;
          if (minorG == null || !minorG.gridlines.length) {
            const majorTickTextLayout = this.getTickText(
              tickOptions.tickTextStyle,
              TickSpanType.SPAN_CENTER,
              majorG.gridlines,
              majorG.texts,
            );
            yield {
              gridlines: majorG.gridlines,
              tickTextLayout: majorTickTextLayout,
            };
          } else {
            const majorTickTextLayout = this.getTickText(
              tickOptions.tickTextStyle,
              leftRightAlign,
              majorG.gridlines,
              majorG.texts,
            );

            const minorTickTextLayout = this.getTickText(
              tickOptions.minorTickTextStyle,
              leftRightAlign,
              minorG.gridlines,
              minorG.texts,
            ); // Don't pass majorTickTextLayout
            // Make each minor tick optional, so if it conflicts with major
            // ticks, we can just drop it.
            forEach(minorTickTextLayout, (tickTL) => {
              tickTL.optional = true;
            });

            // We concat the gridlines, first the minor and then the major (so
            // major gridlines might overwrite minor gridlines)
            // TODO(dlaliberte) Probably need to deep clone majorG.gridlines,
            // and majorG.tickTextLayout since we yield shallow copies multiple
            // times, and we modify these objects once yielded.
            const gridlines = concat(minorG.gridlines, majorG.gridlines);
            // Concat the ticks, major then minor, not that it matters now.
            const tickTextLayout = concat(
              majorTickTextLayout,
              minorTickTextLayout,
            );

            yield {gridlines, tickTextLayout};
          }
        }
        // while minorG
      }
    }
    // while majorG

    // Failed to find any more.
    return {gridlines: [], tickTextLayout: []};
  }

  /**
   * Inspects the range and granularity of the data and decides on the units to
   * use, and more (see DataAnalysis). The minValue and maxValue are
   * numeric conversions of the viewWindow min and max. i.e. in milliseconds
   * @param minValue The minimal numeric date.
   * @param maxValue The maximal numeric date.
   * @param dataGranularity The minimal difference between data points in ms.
   * @return The analysis outcome.
   */
  private analyzeData(
    minValue: number,
    maxValue: number,
    dataGranularity: number,
  ): DataAnalysis {
    const rangeGranularity = roundMillisAccordingToTable(
      (maxValue - minValue) / this.unitThreshold,
      this.roundDurationTable,
      this.durationTableRepeatingIntervals,
    );
    // We extract the unit from the granularity.
    const majorUnitDuration = getUnit(rangeGranularity);
    const majorUnitIndex = findIndex(timeUnitDurations, (duration) =>
      equals(duration, majorUnitDuration),
    );
    const majorUnitName = timeUnitOrder[majorUnitIndex];

    return {minValue, maxValue, unit: majorUnitName};
  }

  /**
   * Computes the gridlines (used both for major and minor gridlines). The
   * strategy is to try and squeeze as much gridlines as possible (using the
   * minimum possible multiple), with the most elaborate text formatting as
   * possible. We always prefer better multiple over better formatting. We do
   * our best to prune choices early (e.g., checking if the gridlines are too
   * close before testing all text formatting). Since this function has to
   * take into account the text (and not just the gridlines), it actually makes
   * the decision about the text too.
   *
   * @param gridlinesConfig Configuration for the gridlines.
   * @return The decided gridlines.
   */
  private *computeGridlines(
    gridlinesConfig: GridlinesConfig,
  ): Iterator<GridlinesInfo> {
    // We now decide on the format of the gridlines. Specifically, we first
    // see if all of them can have a text, and if not, which multiple should we
    // use. Later we decide if they are even too dense to all have a full line.

    // We go over the potential multipliers to choose from.
    // Start with the smallest multiplier and find the first that fits.
    const numMultiples = gridlinesConfig.unitMultiples.length;
    for (let i = 0; i < numMultiples; ++i) {
      const multiple = gridlinesConfig.unitMultiples[i];

      // Used for efficiently scanning the gridlines to avoid.
      let nextGridlineToAvoidIdx = 0;

      // We start with the first date that is round w.r.t the multiple.
      const multipleUnitDuration = multiplyDuration(
        gridlinesConfig.unitDuration,
        multiple,
      );
      let firstValue = floorDate(
        new Date(gridlinesConfig.minValue + this.timeOffset),
        multipleUnitDuration,
      );
      if (gridlinesConfig.unitName === TIME_UNIT.DAYS) {
        // For days, we also floor to a Monday.
        firstValue = floorDateToMonday(firstValue);
      }

      const dateIter = new DateRangeIter(
        firstValue,
        new Date(gridlinesConfig.maxValue + this.timeOffset),
        gridlinesConfig.unitIndex,
        multiple,
      );

      // Check that all the gridlines are spaced far enough from each other.
      // Collect visible gridlines and their text while you are at it.
      let gridlines: TickLine[] = [];
      let gridlinesAreSpaced = true;
      let minPos = this.numericDateToPositionFunc(gridlinesConfig.minValue);
      let firstGridlineInView = -1;
      while (dateIter.hasNext()) {
        const d = dateIter.next();
        const pos = this.numericDateToPositionFunc(
          d.getTime() - this.timeOffset,
        )!;

        // Skip gridlines before the min
        assert(minPos != null);
        minPos = minPos!;
        if (pos < minPos) {
          continue;
        }

        if (firstGridlineInView === -1 && pos >= minPos) {
          firstGridlineInView = gridlines.length;
        }
        const nextD = dateIter.peek();
        if (nextD != null) {
          const nPos = this.numericDateToPositionFunc(
            nextD.getTime() - this.timeOffset,
          );

          // Next, we make sure gridlines are spaced enough.
          assert(nPos != null);
          if (Math.abs(nPos! - pos) < gridlinesConfig.minLineDistance) {
            gridlinesAreSpaced = false;
            break;
          }
        }

        // Eliminating gridlines which are too close to the gridlines we
        // were asked to avoid.
        let tooClose = false;
        while (
          nextGridlineToAvoidIdx < gridlinesConfig.gridlinesToAvoid.length
        ) {
          const nextGridlineToAvoid =
            gridlinesConfig.gridlinesToAvoid[nextGridlineToAvoidIdx];
          if (
            Math.abs(nextGridlineToAvoid.coordinate - pos) <
            gridlinesConfig.minCrossGridlinesDistance
          ) {
            tooClose = true;
            break;
          }
          if (nextGridlineToAvoid.coordinate > pos) {
            // Making sure that we don't miss (avoided) gridlines that may
            // collide with the next gridlines.
            nextGridlineToAvoidIdx = Math.max(0, nextGridlineToAvoidIdx - 1);
            break;
          }
          nextGridlineToAvoidIdx++;
        }
        if (tooClose) {
          // Note that we simply skip gridlines which are too close to the
          // gridlines we are trying to avoid (and not ditching the entire
          // multiple).
          continue;
        }

        // We are saving all visible gridlines (not sure that those will be used
        // as there are still texts to fit).
        gridlines.push({
          dataValue: d,
          coordinate: pos,
          isVisible: true,
          brush: gridlinesConfig.gridlineBrush,
          length: null,
          isNotch: false,
        });
      }
      // while dateIter
      if (!gridlinesAreSpaced) {
        continue; // Continue to the next multiple.
      }

      // Now that we established the set of gridlines that we want to present,
      // we are ready for searching for the formatting of the text for those
      // gridlines. Note that we may still fail (and fall back to a larger
      // multiple).

      // For each multiple, we generate all potential formats to find the most
      // elaborate which fits (if any).
      const formatGenerator = this.formatTicks(gridlines, gridlinesConfig);

      let tickTexts = null;
      while ((tickTexts = formatGenerator.next().value)) {
        if (tickTexts == null) {
          continue; // No formatter fits this multiple, try the next multiple.
        }

        // At this point we found a multiple and formatter for which the
        // gridlines and text might fit, hooray! Adding some auxiliary
        // information and wrapping up.

        // Computing the minimal space between visible gridlines.
        let minimumSpaceBetweenGridlines = Infinity;
        for (let j = 0; j < gridlines.length - 1; ++j) {
          minimumSpaceBetweenGridlines = Math.min(
            minimumSpaceBetweenGridlines,
            gridlines[j + 1].coordinate - gridlines[j].coordinate,
          );
        }

        yield {
          gridlines,
          texts: tickTexts,
          multiple,
          minimumSpaceBetweenGridlines,
        };
      }
      // Reinitialize gridlines, ready for the next loop.
      gridlines = [];
    }
    // for each multiple

    // Failed to find any (more).
    return {
      gridlines: [],
      texts: [],
      multiple: 1,
      minimumSpaceBetweenGridlines: Infinity,
    };
  }

  /**
   * Generate alternative formattings of the ticks for gridlines.
   * @param gridlinesConfig Configuration for the gridlines.
   */
  *formatTicks(
    gridlines: TickLine[],
    gridlinesConfig: GridlinesConfig,
  ): Iterator<Array<{text: string; size: number}>> {
    let formats: string | Array<string | number> = gridlinesConfig.unitFormats;
    if (!Array.isArray(formats)) {
      formats = [formats];
    }

    let formatters: DateFormat[] = [];

    if (this.format != null && this.format['pattern'] != null) {
      // Explicit format option overrides, but only if there is a pattern.
      // Otherwise we merge the other options with the unit patterns.
      formatters = [new DateFormat(this.format)];
    } else {
      const format = this.format || {};
      formatters = map(formats, (pattern) => {
        format['pattern'] = pattern;
        return new DateFormat(format);
      });
    }

    for (let f = 0; f < formatters.length; ++f) {
      const formatter = formatters[f];
      const texts: Array<{text: string; size: number}> = [];
      for (let j = 0; j < gridlines.length; ++j) {
        const gridline = gridlines[j];
        const text =
          gridline.formattedValue || formatter.formatValue(gridline.dataValue);
        const textSize = this.measureFunction(
          text,
          gridlinesConfig.tickTextStyle,
        );
        const size = this.isVertical ? textSize.height : textSize.width;

        texts.push({text, size});
      }

      yield texts;
    }
  }

  /**
   * Computes the refined major gridlines. When the multiple of the major
   * gridline is > 1, we try to squeeze in "refined" ticks every single
   * unit (with a notch).
   * @param da The results of the data analysis phase.
   * @param majorG The result of the major tick phase.
   * @param tickOptions Options for controlling the presentation of tick texts.
   * @return The added refined tick lines.
   */
  private computeRefinedMajorGridlines(
    da: DataAnalysis,
    majorG: GridlinesInfo,
    majorUnitDuration: Duration,
    tickOptions: TickOptions,
  ): TickLine[] {
    const approxMinSpaceBetweenGridlines =
      majorG.minimumSpaceBetweenGridlines / majorG.multiple;
    if (approxMinSpaceBetweenGridlines < this.minNotchDistance) {
      // There is no space for refined major ticks.
      return [];
    }

    const length = NOTCH_LENGTH;
    const brush = tickOptions.gridlineBrush;
    const gridlines: TickLine[] = [];
    const minDate = new Date(da.minValue + this.timeOffset);
    const maxDate = new Date(da.maxValue + this.timeOffset);
    const firstValue = floorDate(minDate, majorUnitDuration);
    const majorIndex = timeUnitIndex[da.unit];
    const majorDateIter = new DateRangeIter(firstValue, maxDate, majorIndex, 1);
    let modulo = 0;
    while (majorDateIter.hasNext()) {
      if (modulo % majorG.multiple === 0) {
        modulo++;
        continue;
      }
      const d = majorDateIter.next();
      const pos = this.numericDateToPositionFunc(d.getTime() - this.timeOffset);
      gridlines.push({
        dataValue: d,
        coordinate: pos!,
        isVisible: true,
        brush,
        length,
        isNotch: true,
      });
      modulo++;
    }
    return gridlines;
  }

  /**
   * Prepares the texts for gridlines as would be returned by the date ticks
   * definer (as defined in the ChartDefinition). Skips texts that collide with
   * (more important) texts.
   * @param textStyle The text style.
   * @param spanType Text span.
   * @param gridlines The set of gridlines for which to add text.
   * @param texts The text associated with the gridlines above. Should be 1-1 match with the gridlines param.
   * @param textsToAvoid A set of text layouts which should be avoided.
   * @return The text layout for the gridlines.
   */
  private getTickText(
    textStyle: TextStyle,
    spanType: TickSpanType,
    gridlines: TickLine[],
    texts: Array<{text: string; size: number}>,
    textsToAvoid?: TextItem[],
  ): TextItem[] {
    const regionsToAvoid = [];
    if (textsToAvoid != null) {
      for (let j = 0; j < textsToAvoid.length; ++j) {
        const textBlock = textsToAvoid[j].textBlock;
        const line = textBlock!.lines[0];
        regionsToAvoid.push(
          getTextBounds(
            line.x,
            line.length,
            textBlock!.paralAlign,
            this.minMinorTextDistance,
          ),
        );
      }
    }

    const paralTextAlign =
      spanType === TickSpanType.SPAN_LEFT
        ? TextAlign.START
        : spanType === TickSpanType.SPAN_RIGHT
          ? TextAlign.END
          : TextAlign.CENTER;

    let nextRegionToAvoidIdx = 0;
    const tickTextLayout: TextItem[] = [];
    const gridlineCoordDist =
      gridlines.length > 1
        ? gridlines[1].coordinate - gridlines[0].coordinate
        : 0;

    for (let i = 0; i < gridlines.length; ++i) {
      const gridline = gridlines[i];

      const coordinate = Math.round(
        spanType === TickSpanType.SPAN_CENTER
          ? gridlineCoordDist
          : gridline.coordinate,
      );

      // Size is width or height, depending on this.isVertical.
      const size = texts[i].size;
      const textRange = getTextBounds(coordinate, size, paralTextAlign);

      while (nextRegionToAvoidIdx < regionsToAvoid.length) {
        const nextRegionToAvoid = regionsToAvoid[nextRegionToAvoidIdx];
        if (nextRegionToAvoid.start > textRange.end) {
          // Making sure that we don't miss (avoided) text that may collide
          // with the next text too.
          nextRegionToAvoidIdx = Math.max(0, nextRegionToAvoidIdx - 1);
        }
        nextRegionToAvoidIdx++;
      }

      tickTextLayout.push({
        dataValue: gridline.dataValue!,
        isVisible: true,
        coordinate,
        textBlock: {
          text: texts[i].text,
          textStyle,
          lines: [{x: coordinate, y: 0, text: texts[i].text, length: size}],
          paralAlign: paralTextAlign,
          perpenAlign: TextAlign.END,
          tooltip1: texts[i].text,
          anchor: null,
          angle: 0,
        } as TextBlock,
      } as TextItem);
    }
    return tickTextLayout;
  }
}

/** Options for controlling the tick text. */
export interface TickOptions {
  tickTextStyle: TextStyle;
  alignment: TickSpanType;
  gridlineBrush: Brush;
  minorTickTextStyle: TextStyle;
  minorGridlineBrush: Brush;
}

/**
 * The input to the computeGridlines function. Non trivial fields:
 * - gridlinesToAvoid
 *     A set of gridlines to avoid (can be used, for example, when positioning
 *     minor gridlines, to avoid the major gridlines).
 * - minCrossGridlinesDistance
 *     The required distance between the gridlines to avoid and our newly
 *     created gridlines.
 */
interface GridlinesConfig {
  minValue: number;
  maxValue: number;
  unitName: string;
  unitIndex: number;
  unitDuration: Duration;
  unitFormats: Array<string | number>;
  unitMultiples: number[];
  minLineDistance: number;
  gridlineBrush: Brush;
  tickTextStyle: TextStyle;
  minTextDistance: number;
  gridlinesToAvoid: TickLine[];
  minCrossGridlinesDistance: number;
}

/** The outcome of the data analysis stage. */
interface DataAnalysis {
  minValue: number;
  maxValue: number;
  unit: string;
}

/**
 * The gridlines which were found appropriate (by the computeGridlines
 * function). We keep the chosen multiple and the minimum space between
 * gridlines in this structure as it might be required for computing
 * refining gridlines.
 */
interface GridlinesInfo {
  gridlines: TickLine[];
  texts: Array<{text: string; size: number}>;
  multiple: number;
  minimumSpaceBetweenGridlines: number;
}

/**
 * The span of the tick text.
 */
export enum TickSpanType {
  BELOW, // centered below the gridlines
  SPAN_LEFT, // left justified to the area between gridlines on the right
  SPAN_CENTER, // centered in the area between gridlines
  SPAN_RIGHT, // right justified to the area between gridlines on the left
}

/**
 * Gets the duration of the unit for a given duration. Assumes that the
 * duration given has exactly one non zero value (which is true for "round"
 * durations)
 * @param duration The duration to get the unit for.
 * @return The duration of the unit.
 */
export function getUnit(duration: number[]): number[] {
  const unit = map(duration, (value) => (value > 0 ? 1 : 0));
  return unit;
}

/**
 * Gets the beginning and ending position of the given text.
 * @param base The base coordinate.
 * @param length The text length.
 * @param align The text alignment.
 * @param padding A number by which to extend the region.
 * @return The range of the text.
 */
function getTextBounds(
  base: number,
  length: number,
  align: TextAlign,
  padding?: number,
): Range {
  padding = padding !== undefined ? padding : 0;
  let start;
  let end;
  if (align === TextAlign.START) {
    start = base;
    end = base + length;
  } else if (align === TextAlign.END) {
    start = base - length;
    end = base;
  } else {
    assert(align === TextAlign.CENTER);
    start = Math.round(base - length / 2);
    end = Math.round(base + length / 2);
  }
  return new Range(start - padding, end + padding);
}
Definer.getTextBounds = getTextBounds;
// For testing

/**
 * Table of round units to be used as tick sizes for datetime. Generally a tick
 * size can be a whole multiplication of one of these units, but it turns out it
 * will most likely BE one of these units. Units are durations arrays, in the
 * format [millis, sec, min, hour, day, month, year] as common in timeutils lib.
 * Note: Each duration should use exactly one unit (non zero value in the
 * array).
 */
const defaultDatetimeRoundUnits: number[][] = [
  [1],
  [2],
  [5],
  [10],
  [20],
  [50],
  [100],
  [200],
  [500],
  [0, 1],
  [0, 2],
  [0, 5],
  [0, 10],
  [0, 15],
  [0, 30],
  [0, 0, 1],
  [0, 0, 2],
  [0, 0, 5],
  [0, 0, 10],
  [0, 0, 15],
  [0, 0, 30],
  [0, 0, 0, 1],
  [0, 0, 0, 2],
  [0, 0, 0, 3],
  [0, 0, 0, 4],
  [0, 0, 0, 6],
  [0, 0, 0, 12],
  [0, 0, 0, 0, 1],
  [0, 0, 0, 0, 2],
  [0, 0, 0, 0, 7],
  [0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 3],
  [0, 0, 0, 0, 0, 6],
  [0, 0, 0, 0, 0, 0, 1],
  [0, 0, 0, 0, 0, 0, 10],
  [0, 0, 0, 0, 0, 0, 50],
  [0, 0, 0, 0, 0, 0, 100],
];

/**
 * The number of intervals in the above table that should be repeated infinitely
 * Setting it to 3 yields: 10yrs, 25yrs, 50yrs, 100yrs, 250yrs, 500yrs...
 */
const DATETIME_ROUND_UNITS_REPEATING_INTERVAL = 3;

/** The length of notches. */
const NOTCH_LENGTH = 5;
Definer.NOTCH_LENGTH = NOTCH_LENGTH;
// For testing.
