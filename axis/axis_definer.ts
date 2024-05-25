/**
 * @fileoverview Chart axis definition.
 * Calculates the measures needed to draw an axis.
 * Incidental change, to add to CL.
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
  clone,
  extend,
  forEach,
  forEachRight,
  map,
  peek,
  reduce,
  remove,
  slice,
  sort,
  stableSort,
} from '@npm//@closure/array/array';
import {
  assert,
  assertNumber,
} from '@npm//@closure/asserts/asserts';
import * as googObject from '@npm//@closure/object/object';
import {AxisDecoration, Decorations} from '../axis/axis_decoration';
import {ColorBarDefiner} from '../colorbar/color_bar_definer';
import {GOLDEN_RATIO} from '../common/constants';
import {
  DEFAULTS,
  DEFAULT_TIMEOFDAY_TICKS_MAJOR,
  DEFAULT_TIMEOFDAY_TICKS_MINOR,
} from '../common/defaults';
import * as numberScale from '../common/number_scale_util';
import {extendByKeys} from '../common/object';
import {
  AxisType,
  BoundUnboundPosition,
  ChartType,
  Direction,
  HighLowPosition,
  InOutPosition,
  SerieType,
  ViewWindowMode,
} from '../common/option_types';
import {OptionPath, Options} from '../common/options';
import {durationGranularity} from '../common/timeutil';
import * as util from '../common/util';
import {Value} from '../data/types';
import {DateFormat} from '../format/dateformat';
import {NumberFormatterBuilder} from '../format/formatting';
import {
  COMPACTS_DEFAULT_SIGNIFICANT_DIGITS,
  PRESET_FORMAT,
} from '../format/numberformat';
import {Brush} from '../graphics/brush';
import * as graphicsUtil from '../graphics/util';
import {DateTimeFormat, NumberFormat} from '../i18n/format';
import {TextAlign} from '../text/text_align';
import {TextBlock} from '../text/text_block_object';
import {TextStyle} from '../text/text_style';
import {
  AxisDefinition,
  TextItem,
  TextItems,
  TickLine,
} from '../visualization/corechart/axis_definition';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {AxisDecorationsCreator} from './axis_decorations_creator';
import * as dateTicks from './date_tick_definer';
import {Orientation} from './text_measurer';
import {Adapter as TextMeasurerAdapter} from './text_measurer_adapter';
import * as axisUtils from './utils';
import {calcMinimumFractionDigits} from './utils';
import {DatetimeValueScale} from './value_scale/datetime_value_scale';
import {ScaleRepository} from './value_scale/scale_repository';
import {TimeofdayValueScale} from './value_scale/timeofday_value_scale';
import {ValueScale} from './value_scale/value_scale';

import {LegendDefiner} from '../legend/legend_definer';
import {findMinimumSignificantDigits} from './tick_utils';
const {LOG_SCALE_OPTIONS_KEY, SCALE_TYPE_OPTIONS_KEY} = numberScale;
const {BELOW, SPAN_LEFT} = dateTicks.TickSpanType;
const {CENTER, START} = TextAlign;

// tslint:disable:ban-types
// tslint:disable:ban-ts-suppressions

/**
 * After construction, the axis is not yet ready to be drawn. Before drawing the
 * axis, the layout needs to be calculated by calling calcAxisLayout. It cannot
 * be done in the constructor because it relies on parameters set on the chart
 * definition, and setting them requires that the axis definer to be
 * constructed.
 */
export abstract class AxisDefiner {
  /** The most specific option path for this axis. */
  private readonly axisPath: string;

  /**
   * The options object, specific to the optionPath.
   * The options object.
   */
  options: Options;

  /** The type of the axis. */
  type: AxisType;

  /** The minimum value on the values scale. */
  minValue = null;

  /** The maximum value on the values scale. */
  maxValue = null;

  /**
   * All the values to be presented in this axis (required for computing the
   * data granularity).
   */
  private readonly allNumericValues: number[] = [];

  /**
   * The value where the baseline crosses. Null for no baseline.
   * Default depends on implementations, so is set initially to null if no
   * value is found in the options (cannot be defined in stacked charts to
   * something other than zero).  The userBaseline will be included in the
   * chart, unless the explicit viewWindow options say otherwise.
   */
  userBaseline = null;

  /**
   * The default value for the baseline, if userBaseline is not provided.
   * May be set, e.g. for area and bar charts, which *should* have a
   * baseline of 0, except we can't change existing charts now.
   * The defaultBaseline will not necessarily be included in the chart.
   */
  defaultBaseline = null;

  /**
   * A flag indicating the axis is allowed to truncate the data (is set to
   * true for charts containing bars series since bars have a minimal width).
   * TODO(badt): think of implications on mixed chart type.
   */
  allowDataTruncation: boolean;

  /**
   * The title layout parameters.
   * Holds all the information needed to draw the axis title.
   */
  title: TextBlock;

  /**
   * The axis ticks values: data value, position (x for horizontal, y for
   * vertical) in pixels, text label, and whether this tick is visible.
   */
  ticks: TextItems = [];

  /**
   * User-specified explicit tick values.
   * TODO(dlaliberte): Process the user tick array and standardize
   * to internal type of {?Array<!{v: *, f: string}>}
   */
  private tickValues: Array<
    AnyDuringMigration | {v: AnyDuringMigration; f: string}
  > | null = null;

  /**
   * The layout of the tick labels. Used by vertical and horizontal axis
   * definers to pass back results.
   */
  tickTextLayout: TextItems | null = null;

  /** The position of the axis text. */
  tickTextPosition: InOutPosition;

  /** The style object of the axis text */
  tickTextStyle: TextStyle;

  minorTickTextStyle: AnyDuringMigration;

  /**
   * The position of the axis text, if it is OUTSIDE. BOUND means that the
   * top-most and the bottom-most text labels are bound inside the chart area,
   * and UNBOUND means they are not.
   */
  tickOutTextPosition: BoundUnboundPosition;

  /**
   * The position of the axis text, if it's INSIDE. HIGH means that it's above
   * the tick lines (for the vertical axis) and to the right of the tick lines
   * (for the horizontal axis), and LOW means the opposite.
   */
  tickInTextPosition: HighLowPosition;

  /** The brush of the axis baseline */
  baselineBrush: Brush;

  /** The brush of the axis gridlines. */
  gridlineBrush: Brush;

  /**
   * The number of gridlines to try to draw. Used only as an approximation
   * for the spacing.
   */
  private gridlineCount: number | null;

  /** The minimum spacing between gridlines, in pixels. */
  private readonly gridlineSpacing: number | null;

  /**
   * The number of requested minor gridlines between every two gridlines.
   * Not really used now.  Only relevant values are null (meaning use
   * the default behavior), 0 meaning no minor gridlines, and any other
   * number meaning use automatic method.  For dates and times, the default
   * behavior is to show minor gridlines, and for numbers, no minor gridlines
   * are shown.
   */
  private readonly minorGridlinesCount: number | null;

  /**
   * The brush of the axis minor gridlines.
   * TODO(dlaliberte) Also stroke style (dash) opacity, width.
   */
  minorGridlineBrush: Brush;

  /** The minimal pixel distance between elements. */
  minGap = 2;

  /** The space between title lines. */
  gapBetweenTitleLines: number;

  /** The length in pixels of the axis. */
  axisLength = 0;

  /**
   * The direction of the axis in relation to the data. 1 means that the axis
   * direction is aligned with the data direction (as imposed by the
   * DataTable), i.e. first data item (category/value) is closest to the axis
   * start position and last data item is farthest. -1 means exactly the
   * opposite.
   */
  dataDirection: Direction;

  /**
   * The direction of the axis in relation to the screen coordinates. 1 means
   * that the axis direction is aligned with the screen coordinates, i.e. left
   * to right for horizontal and top-down for vertical. -1 means exactly the
   * opposite.
   */
  direction: Direction;

  /**
   * The start position (x-position for horizontal axis, y-position for
   * vertical axis).
   */
  startPos: number | null = null;

  /**
   * The end position (x-position for horizontal axis, y-position for
   * vertical axis).
   */
  endPos: number | null = null;

  /** The conversion factor between a value and a position on the screen. */
  numericValueToPixelsFactor = 0;

  /**
   * The value that is considered the 'zero' in the unscaled numeric domain
   * and mapped to the chart start position. In value scale is equal to
   * numeric minimum value, is always zero for category point and -0.5 for
   * category.
   */
  private valueAtStartPos = 0;

  /** The computed view window numeric values. */
  private viewWindow: {min: number; max: number} = {
    min: -Infinity,
    max: Infinity,
  };

  /**
   * The view window mode.
   * PRETTY means set the view window to include the data, and find the
   * prettiest ticks for the edges of the view window.
   * MAXIMIZED means set the view window to match the min/max data values.
   * EXPLICIT means use the explicit view window values given in the options.
   */
  viewWindowMode: ViewWindowMode | null;

  private readonly scaleType: numberScale.ScaleType;

  /** Whether the axis has a mirrorLog scale. */
  private readonly mirrorLog: boolean;

  /** Whether the axis has a log scale, or mirrorLog. */
  private readonly logScale: boolean;

  /** We also need to know whether the scale is log but not mirrorLog. */
  private readonly strictLog: boolean;

  /** The value scale helping this axis display values as numerics */
  valueScale: ValueScale | null = null;

  /**
   * The axis baseline data value and position (x for horizontal, y for
   * vertical) in pixels.
   */
  baseline: {
    dataValue: Value | null;
    coordinate: number;
    isVisible: boolean;
  } | null = null;

  /** Holds the distance to zero from the closest value on this axis. */
  private zeroToClosestValueDistance = Infinity;

  // We keep track of the last known working tick text layout and ticks
  // in case later attempts all fail.  But we also need to keep track of
  // the last attempt even if there were no prior successes, in case
  // nothing works.
  // TODO(dlaliberte) Figure out how to avoid this.

  lastWorkingTickTextLayout: TextItems | null = null;

  lastWorkingTicks: TextItems | null = null;

  // The view window for a value axis should be set only after the value
  // scale has been set (in 'initScale').

  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  legendDefiner!: LegendDefiner | null;

  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  colorBarDefiner!: ColorBarDefiner | null;

  /** The data type of the values, e.g. 'number' or 'string' */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  dataType!: string;

  /**
   * Constructor for an axis definer.
   * @param chartDef The chart definition.
   * @param options The options.
   * @param optionPath The options path/s for the axis options.
   * @param index The index of this axis within its category (first vAxis and hAxis is 0, next one of each is 1).
   * @param defaultType The default value for the axis type.
   * @param defaultViewWindowMode The default value for the viewWindowMode.
   */
  constructor(
    public chartDef: ChartDefinition,
    options: Options,
    optionPath: OptionPath,
    protected index: number,
    defaultType: AxisType,
    public defaultViewWindowMode: ViewWindowMode,
  ) {
    this.axisPath = optionPath[0];

    this.options = options.view(optionPath);

    this.type = this.options.inferStringValue(
      'type',
      defaultType,
      AxisType,
    ) as AxisType;
    assert(this.type != null, `Unspecified ${optionPath} type.`);

    this.allowDataTruncation = chartDef.serieTypeCount[SerieType.BARS] > 0;

    const titleText = this.options.inferStringValue('title');
    const axisTitlesPosition = chartDef.axisTitlesPosition;
    let auraColor =
      axisTitlesPosition === InOutPosition.INSIDE
        ? chartDef.insideLabelsAuraColor
        : 'none';

    const defaultTitleTextStyle = {
      fontName: chartDef.defaultFontName,
      fontSize: chartDef.defaultFontSize,
      auraColor,
    };
    const titleTextStyle = this.options.inferTextStyleValue(
      'titleTextStyle',
      defaultTitleTextStyle,
    );

    this.title = {
      text: titleText,
      textStyle: titleTextStyle,
      boxStyle: null,
      lines: [],
      // perpenAlign's value is a placeholder, it's overridden by derived classes
      paralAlign: CENTER,
      perpenAlign: START,
      tooltip: '',
      anchor: null,
      angle: 0,
    };

    this.tickTextPosition = this.options.inferStringValue(
      'textPosition',
      InOutPosition.OUTSIDE,
      InOutPosition,
    ) as InOutPosition;

    const defaultTickTextColor =
      this.type !== AxisType.VALUE || chartDef.chartType === ChartType.SCATTER
        ? this.options.inferColorValue(
            'majorAxisTextColor',
            DEFAULTS['majorAxisTextColor'],
          )
        : this.options.inferColorValue(
            'minorAxisTextColor',
            DEFAULTS['minorAxisTextColor'],
          );

    auraColor =
      this.tickTextPosition === InOutPosition.INSIDE
        ? chartDef.insideLabelsAuraColor
        : 'none';

    const defaultTickTextStyle = {
      color: defaultTickTextColor,
      fontName: chartDef.defaultFontName,
      fontSize: chartDef.defaultFontSize,
      auraColor,
    };

    this.tickTextStyle = this.options.inferTextStyleValue(
      'textStyle',
      defaultTickTextStyle,
    );

    const labelColorRatio = this.options.inferNonNegativeNumberValue(
      'gridlines.minorTextOpacity',
    );
    const minorLabelColor = graphicsUtil.blendHexColors(
      this.tickTextStyle.color,
      chartDef.actualChartAreaBackgoundColor || '#fff',
      labelColorRatio,
    );

    this.minorTickTextStyle = this.options.inferTextStyleValue(
      'textStyle',
      defaultTickTextStyle,
    );
    this.minorTickTextStyle.color = minorLabelColor;

    this.tickOutTextPosition = this.options.inferStringValue(
      'outTextPosition',
      BoundUnboundPosition.UNBOUND,
      BoundUnboundPosition,
    ) as BoundUnboundPosition;

    this.tickInTextPosition = this.options.inferStringValue(
      'inTextPosition',
      HighLowPosition.LOW,
      HighLowPosition,
    ) as HighLowPosition;

    const baselineColor = this.options.inferColorValue(
      'baselineColor',
      chartDef.baselineColor,
    );

    this.baselineBrush = new Brush({fill: baselineColor});

    const gridlineColor = this.options.inferColorValue(
      'gridlines.color',
      chartDef.gridlineColor,
    );

    this.gridlineBrush = new Brush({fill: gridlineColor});

    this.gridlineCount =
      this.options.inferOptionalNumberValue('gridlines.count');

    this.gridlineSpacing = this.options.inferOptionalNumberValue(
      'gridlines.minSpacing',
    );

    this.minorGridlinesCount = this.options.inferOptionalNumberValue(
      'minorGridlines.count',
    );

    const gridlineColorRatio = this.options.inferNonNegativeNumberValue(
      'gridlines.minorGridlineOpacity',
    );

    // The default color for the minor gridlines is a blend of the gridlines'
    // color and the actual background of the chart area.
    // But if gridlineColor is transparent, just use the same for minor
    // gridlines.
    const defaultMinorGridlineColor =
      gridlineColor === graphicsUtil.NO_COLOR
        ? graphicsUtil.NO_COLOR
        : graphicsUtil.blendHexColors(
            gridlineColor,
            chartDef.actualChartAreaBackgoundColor || '#fff',
            gridlineColorRatio,
          );
    const minorGridlineColor = this.options.inferColorValue(
      'minorGridlines.color',
      defaultMinorGridlineColor,
    );

    this.minorGridlineBrush = new Brush({fill: minorGridlineColor});

    this.gapBetweenTitleLines = Math.max(
      this.minGap,
      Math.round(this.title.textStyle.fontSize / (2 * GOLDEN_RATIO)),
    );

    this.dataDirection = this.options.inferNumberValue(
      'direction',
      Direction.FORWARD,
    ) as Direction;

    this.direction = this.dataDirection;

    this.viewWindowMode = this.defaultViewWindowMode;

    this.scaleType = numberScale.getScaleType(
      this.options,
      LOG_SCALE_OPTIONS_KEY,
      SCALE_TYPE_OPTIONS_KEY,
    );

    this.mirrorLog = this.scaleType === numberScale.ScaleType.MIRROR_LOG;
    this.logScale =
      this.mirrorLog || this.scaleType === numberScale.ScaleType.LOG;

    this.strictLog = this.logScale && !this.mirrorLog;

    if (this.type === AxisType.VALUE) {
    }
  }

  abstract getAxisName(): string;

  /**
   * Called for each value to be shown on this axis and keeps track of the
   * closest distance to zero. This is used for the log and mirrorLog modes.
   * Ignore 0 and NaN values.
   * Value is unscaled!
   * @param value The unscaled numeric data value to check.
   */
  markClosestValueToZero(value: number) {
    if (typeof value === 'number' && value !== 0 && !isNaN(value)) {
      value = Math.abs(value);
      // Subtract a fraction from this value, to avoid treating the actual
      // smallest value as if it were 0.
      value -= value / 10;
      this.zeroToClosestValueDistance = Math.min(
        value,
        this.zeroToClosestValueDistance,
      );
    }
  }

  /**
   * Initializes the pre-calculator of the numeric value scale.
   * This is only important for log and mirrorLog scales.
   *
   * Note that while the numeric_value_scale is set up, it is mostly not used
   * now, since the layout of gridlines and ticks is handled by the Dive
   * axis package,  via calcAxisLayoutForNumbers, that uses its own 'mapping'
   * mechanism to do the scaling of values.
   *
   * Therefore the log and mirrorLog scales must be set up the same way for both
   * the scale and the gridline/tick calculation.  And that means that for
   * log and mirrorLog scales, we must use the same "closest value to zero"
   * for both the scale and the gridline/tick calculation.  And this means that
   * if 0 is included in data, or if the min and max are on opposite sides of 0,
   * then we must use mirrorLog, and vice versa.
   *
   * But at the time initPreCalculator is called, which is when we
   * set up the precalculator for the scale, we don't yet know the
   * actual min and max, although we do know the zeroToClosestValueDistance.
   * Consequently we cannot determine whether mirrorLog might be required
   * some time later, which means we cannot initialize the scale properly.
   *
   * So instead, we have to enforce that, if log scale is used and mirrorLog
   * is not specified, then the min and max must both be positive.
   * The easiest way to enforce that is to never expand the range below 0 for
   * strict log scale.
   * @see extendRangeToIncludeNumber.
   *
   * TODO(dlaliberte) Refactor to remove the value_scale code entirely.
   */
  initPreCalculator() {
    // Iterate over explicit ticks to include closest value to zero.
    if (this.tickValues) {
      forEach(
        this.tickValues,
        function (tick) {
          const value = tick['v'];
          this.markClosestValueToZero(value);
        },
        this,
      );
    }

    this.valueScale!.initPreCalculator(
      this.scaleType,
      this.zeroToClosestValueDistance,
      [],
    );
  }

  /**
   * Sets the value scale for this axis.
   * @param dataType The data type of the values on this axis.
   */
  initScale(dataType: string) {
    let valueScale = ScaleRepository.instance().getScale(dataType);
    assert(valueScale != null, `Type ${dataType} is not a valid VALUE type`);
    valueScale = valueScale!;

    this.valueScale = valueScale;

    this.dataType = dataType;

    if (this.isDatetimeValueScale()) {
      // TODO(dlaliberte) Avoid the following hack of overriding some options
      // for date-time axis types by adding type-specific options.

      const datetimeOptions = {};

      // Disable alternating rows by default.
      extendByKeys(datetimeOptions, ['maxAlternation'], 1);

      // Disable slanted tick text by default, since we don't detect overflow
      // and clipping, and they aren't very readable in any event.
      extendByKeys(datetimeOptions, ['slantedText'], false);

      // Insert default options after user options.
      this.options.insertLayer(1, datetimeOptions);

      // Must process the options again to incorporate the above changes.
      this.processOptions();
    }

    // For use with ai.Explorer, check whether the axis is in explore mode.
    // TODO(dlaliberte): Refactor to move this test into the ai.Explorer code.
    const orientation = this.getOrientation();
    const exploreThisAxis =
      this.options.inferValue('explorer') &&
      (!this.options.inferValue('explorer.axis') ||
        this.options.inferOptionalStringValue(`explorer.axis.${orientation}`));

    // Use variable number of gridlines if explore mode is enabled or
    // log scale is used, or gridline.count is defined and negative.
    if (
      exploreThisAxis ||
      (this.gridlineCount != null && this.gridlineCount < 0)
    ) {
      this.gridlineCount = -1;
    }

    valueScale.init(this.options, this.gridlineCount);

    // The following depends on the valueScale having been initialized.
    // TODO(dlaliberte) Avoid using the value scale.  Type conversion and
    // the default baseline value based on the data type should be done separate
    // from scaling.

    // Suppressing errors for ts-migration.
    //   TS2322: Type 'unknown' is not assignable to type 'null'.
    // @ts-ignore
    this.minValue = valueScale.inferValue(this.options, 'minValue');
    // Suppressing errors for ts-migration.
    //   TS2322: Type 'unknown' is not assignable to type 'null'.
    // @ts-ignore
    this.maxValue = valueScale.inferValue(this.options, 'maxValue');
    this.userBaseline = this.options.inferValue(
      'baseline', // Get default from vertical axis.
      DEFAULTS['vAxis']['gridlines']['baseline'],
    );

    // Setup the defaultBaseline.
    let baselineValue = null;
    if (this.userBaseline !== undefined && this.userBaseline !== 'auto') {
      baselineValue = this.userBaseline;
    } else {
      // Get axis default baseline or valueScale's default baseline.
      baselineValue = this.defaultBaseline || valueScale.getDefaultBaseline();
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type 'unknown' is not assignable to type 'null'.
    // @ts-ignore
    this.defaultBaseline = baselineValue;

    this.initExplicitTicks();
  }

  /** Set up explicit ticks, standardizing the structure of ticks. */
  private initExplicitTicks() {
    // TODO(dlaliberte) Need more complex options inference.
    const explicitTicks = this.options.inferValue('ticks');
    if (Array.isArray(explicitTicks)) {
      this.tickValues = explicitTicks;
    }

    if (this.tickValues) {
      this.tickValues = map(this.tickValues, (tick) => {
        const newTick = {};
        if (tick['v'] !== undefined) {
          (newTick as AnyDuringMigration)['v'] = tick['v'];
        } else {
          (newTick as AnyDuringMigration)['v'] = tick;
        }
        // We can't format the values until the formatter is determined.
        if (typeof tick['f'] === 'string') {
          (newTick as AnyDuringMigration)['f'] = tick['f'];
        }
        return newTick;
      });

      if (this.tickValues.length > 0) {
        // Sort, mostly so we can get min and max.
        // This may be redundant with extendViewWindowForTicks.
        const tickValueComparison = (
          ticka: AnyDuringMigration,
          tickb: AnyDuringMigration,
        ) => {
          return this.valueScale!.compareValues(ticka['v'], tickb['v']);
        };
        // Set minValue and maxValue to min and max tickValues, to ensure they
        // are included.
        sort(this.tickValues, tickValueComparison);
        if (this.minValue == null) {
          this.minValue = this.tickValues[0]['v'];
        }
        if (this.maxValue == null) {
          this.maxValue = peek(this.tickValues)['v'];
        }
      }
    }
  }

  /** Initializes the view window. */
  initViewWindow() {
    this.viewWindowMode = this.options.inferStringValue(
      'viewWindowMode',
      this.viewWindowMode as string,
      ViewWindowMode,
    ) as ViewWindowMode;

    const valueScale = this.valueScale;

    if (this.type === AxisType.VALUE) {
      // Check for numeric values provided by explorer mode.
      let viewWindowMin = valueScale!.inferValue(
        this.options,
        'viewWindow.numericMin',
      );
      if (typeof viewWindowMin !== 'number') {
        viewWindowMin = valueScale!.valueToNumber(
          valueScale!.inferValue(this.options, 'viewWindow.min') as Value,
        );
      }
      let viewWindowMax = valueScale!.inferValue(
        this.options,
        'viewWindow.numericMax',
      );
      if (typeof viewWindowMax !== 'number') {
        viewWindowMax = valueScale!.valueToNumber(
          valueScale!.inferValue(this.options, 'viewWindow.max') as Value,
        );
      }
      if (viewWindowMin != null) {
        // Suppressing errors for ts-migration.
        //   TS2322: Type '{}' is not assignable to type 'number'.
        // @ts-ignore
        this.viewWindow.min = viewWindowMin;
      }
      if (viewWindowMax != null) {
        // Suppressing errors for ts-migration.
        //   TS2322: Type '{}' is not assignable to type 'number'.
        // @ts-ignore
        this.viewWindow.max = viewWindowMax;
      }
    } else {
      // The view window for category axis is given as a numeric index.
      this.viewWindow.min = this.options.inferNumberValue(
        'viewWindow.min',
        this.viewWindow.min,
      );
      this.viewWindow.max = this.options.inferNumberValue(
        'viewWindow.max',
        this.viewWindow.max,
      );
      // Currently, there must always be at least one category in viewWindow.
      this.viewWindow.max = Math.max(
        this.viewWindow.min + 1,
        this.viewWindow.max,
      );
    }

    if (this.viewWindow.min > this.viewWindow.max) {
      // Just swap them.
      const temp = this.viewWindow.min;
      this.viewWindow.min = this.viewWindow.max;
      this.viewWindow.max = temp;
    }

    // Set the value scale range accordingly.
    if (this.type === AxisType.VALUE) {
      if (this.viewWindow.min !== -Infinity) {
        valueScale!.setNumericMinValue(this.viewWindow.min);
      }
      if (this.viewWindow.max !== Infinity) {
        valueScale!.setNumericMaxValue(this.viewWindow.max);
      }
      this.setBaseline();
    }
  }

  /**
   * Validates that the valueScale was initialized, if this is a VALUE axis.
   * Throws an error if not.
   */
  validateHasScale() {
    if (this.type === AxisType.VALUE && !this.valueScale) {
      throw new Error('Axis type/data type mismatch for ' + this.axisPath);
    }
  }

  /**
   * Calculates the axis definition, based on the chart-definition, the axis
   * length, the start position and the other axis definer. For category axes
   * also initializes the ticks.
   * This method should be called only ONCE per instance.
   * @param axisLength The length of the axis in pixels.
   * @param startPos The start position (x-position for horizontal axis, y-position for vertical axis).
   * @param legendDefiner The legend definer.
   * @param colorBarDefiner The color-bar definer.
   * @return The resulting AxisDefinition, after doing all needed calculations.
   */
  protected calcCommonAxisDefinition(
    axisLength: number,
    startPos: number,
    legendDefiner: LegendDefiner | null,
    colorBarDefiner: ColorBarDefiner | null,
  ): AxisDefinition {
    // Each gridline is drawn by calculating its position on the axis and
    // placing it on the containing crisp pixel. For example, a gridline whose
    // calculated position is 3.14, will span from position 3 to 4 - meaning, it
    // will be on pixel 3. We subtract half a pixel from each edge of the axis
    // range so that the bottom gridline will be inside the axis chart area and
    // so that the position of the top and bottom gridlines' values will be
    // exactly on the middle of the gridlines. Assumes gridlines have width
    // of 1.
    this.startPos = startPos + (this.direction === 1 ? 0.5 : -0.5);
    this.axisLength = axisLength - 1;
    this.endPos = startPos + axisLength * this.direction;
    const ticklinesOrigin = this.calcTicklinesOrigin();

    // Legend and color bar definers are used during tick layout.
    this.legendDefiner = legendDefiner;
    this.colorBarDefiner = colorBarDefiner;

    const ticksAndLines = this.calcTicksAndLines();

    const axisDefinition = {
      title: this.title,
      name: this.getAxisName(),
      type: this.type,
      logScale: this.isLogScale(),
      dataType: this.dataType,
      dataDirection: this.dataDirection,
      startPos: this.startPos,
      endPos: this.endPos,
      number: {
        fromValue: this.numberFromValue.bind(this),
        toValue: this.numberToValue.bind(this),
      },
      position: {
        fromValue: this.calcPositionFromDataValue.bind(this),
        toValue: this.calcDataValueFromPosition.bind(this),
      },
      ticklinesOrigin,
      baseline: ticksAndLines.baseline,
      gridlines: ticksAndLines.gridlines,
      text: ticksAndLines.tickTextLayout,
      viewWindow: this.valueScale
        ? {
            // Note that the min and max are numeric
            // versions of the viewWindow min and max data values.
            min: this.valueScale.getNumericMinValue(),
            max: this.valueScale.getNumericMaxValue(),
          }
        : {min: this.viewWindow.min, max: this.viewWindow.max},
    };
    return axisDefinition as AxisDefinition;
  }

  /** Calculates ticks and gridlines for this axis of a chart. */
  private calcTicksAndLines(): TicksAndLines {
    let ticksAndLines;

    if (this.type !== AxisType.VALUE) {
      ticksAndLines = this.calcAxisLayoutForCategories(this.axisLength + 1);
      // Either CATEGORY or CATEGORY_POINT
      // ticksAndLines.tickTextLayout = this.calcTextLayout(ticks, null);
    } else {
      // Options.AxisType.VALUE, numbers, dates, and times.
      this.extendMinMaxProps();
      this.extendViewWindowForTicks();

      if (this.isDatetimeValueScale()) {
        ticksAndLines = this.calcAxisLayoutForDatesAndTimes();
      } else {
        ticksAndLines = this.calcAxisLayoutForNumbers();
      }
    }

    return ticksAndLines;
  }

  /**
   * Calculate axis tick values for discrete axes.
   * @param axisLength The length of the axis in pixels.
   */
  private calcAxisLayoutForCategories(axisLength: number): TicksAndLines {
    let numberOfAxisDivisions: number;
    const categories = this.chartDef.categories;

    // Complete the view window if needed.
    if (this.viewWindow.min === -Infinity) {
      // The default viewWindow.min should be smaller than viewWindow.max.
      this.viewWindow.min = Math.min(0, this.viewWindow.max - 1);
    }
    if (this.viewWindow.max === Infinity) {
      // The default viewWindow.max should be greater than viewWindow.min.
      this.viewWindow.max = Math.max(
        categories.length,
        this.viewWindow.min + 1,
      );
    }
    // There must always be at least one category in the viewWindow.
    this.viewWindow.max = Math.max(
      this.viewWindow.min + 1,
      this.viewWindow.max,
    );
    numberOfAxisDivisions = this.viewWindow.max - this.viewWindow.min;

    if (this.allowDataTruncation) {
      numberOfAxisDivisions = Math.min(
        numberOfAxisDivisions,
        Math.floor((axisLength + 1) / 2),
      );
    }
    if (this.type === AxisType.CATEGORY_POINT) {
      // There must be at least one division so that there will be a valid
      // ratio between the axis range and the axis width. That is necessary for
      // the animation interpolation.
      numberOfAxisDivisions = Math.max(1, numberOfAxisDivisions - 1);
    }
    // TODO(dlaliberte): figure out why this doesn't always apply.
    assert(numberOfAxisDivisions > 0);
    this.valueAtStartPos = this.getMinNumericValue();
    this.numericValueToPixelsFactor = this.axisLength / numberOfAxisDivisions;
    assert(this.numericValueToPixelsFactor !== 0);

    const formatter = this.getCategoryFormatter();
    const ticks = util.rangeMap(categories.length, (i) => {
      // Generate tick text using axis format, if specified.
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'string' is not assignable to parameter of type 'number'.
      // @ts-ignore
      const title = formatter.formatValue(categories[i].titles[0]);
      const tickIndex = i - this.valueAtStartPos;
      const tick = {
        dataValue: categories[i].data,
        coordinate: this.calcPositionForNumericValue(i),
        text: title,
        isVisible: tickIndex >= 0 && tickIndex <= numberOfAxisDivisions,
        // Make discrete ticks be optional, so they can be discarded
        // if they don't fit, after trying alternation, skipping,
        // and slanting on the horizontal axis. Vertical axis has no choice.
        optional: true,
      };
      return tick;
    });
    const ticksAndLines = {
      gridlines: [],
      baseline: null,
      tickTextLayout: this.calcTextLayout(ticks, null),
      ticks: [],
    };
    return ticksAndLines;
  }

  /* Returns a formatter based on the data Value type.
   * TODO(dlaliberte) Need to do this so we can format values for ticks
   * based on the data type (string, number, date) independent of the placement
   * of the ticks based on the AxisType: value, category, categorypoint.
   * This is particularly a problem for category and categorypoint since then
   * the formatter would only be the default formatter.
   * Treating numbers as categories, for example, is useful for histogram
   * buckets.
   */
  getCategoryFormatter() {
    if (!this.valueScale) {
      // Must be string data.  Just return formatter that returns values as is.
      return {formatValue: (str: AnyDuringMigration) => str};
    } else if (this.isDatetimeValueScale()) {
      const timeOffset = 0;
      const calcPos = (num: AnyDuringMigration) => {
        const pos = this.calcPositionForNumericValue(num);
        return pos;
      };
      const isVertical = false;
      // directionalityParams.orientation === Orientation.VERTICAL;

      const dateTicksDefiner = dateTicks.Definer.build(
        this.options,
        isVertical,
        timeOffset,
        calcPos,
        this.chartDef.textMeasureFunction,
      );
      this.tickDateValuesToTicks(dateTicksDefiner, 0);

      // Hack for now, just use full date time.
      const pattern = DateTimeFormat.Format.FULL_DATETIME;
      return new DateFormat({'pattern': pattern});
    } else {
      // Must be valueScale instanceof gviz.canviz.NumericValueScale;
      // Determine default formatter, if explicit formats not provided.
      const tickNumbers = map(this.tickValues, (tick) => {
        return tick['v'];
      });
      const numDigits = axisUtils.calcMinimumFractionDigits(tickNumbers);
      const formatterBuilder = this.createNumberFormatterBuilder();
      formatterBuilder.setMaxNumDecimals(numDigits);
      const formatter = formatterBuilder.build();
      return formatter;
    }
  }

  /**
   * Calculates the gridlines and ticks for dates and times.
   * TODO(dlaliberte) Split this up into smaller reusable chunks.
   *
   * @return The gridlines and baseline.
   */
  private calcAxisLayoutForDatesAndTimes(): TicksAndLines {
    const valueScale = this.valueScale;

    let explicitMin = true;
    let explicitMax = true;
    if (this.viewWindowMode !== ViewWindowMode.MAXIMIZED) {
      explicitMin = isFinite(this.viewWindow.min);
      explicitMax = isFinite(this.viewWindow.max);
    }

    // Must first compute viewWindow, and then maybe extend it.
    // No support for log scale with dates and times yet, though it is not
    // disallowed.  Errors may result.
    let numericMinMax = this.getMinMaxProps();

    // scaled numeric values.
    let {min, max} = numericMinMax;

    this.setViewWindow(numericMinMax);
    this.setBaseline();

    const originalMin = min;
    const originalMax = max;
    const range = Math.abs(max - min);

    const directionalityParams = this.getAxisDirectionalityParameters();

    const baselineValue = this.baseline!.dataValue;

    /** scaled */
    const numericBaseline: number | null =
      baselineValue == null ? null : valueScale!.valueToNumber(baselineValue);

    // Compute default max padding for non-explicit min or max.
    assert(this.startPos != null && this.endPos != null);
    const screenRange = Math.abs(this.endPos! - this.startPos!);
    const maxPadding =
      assertNumber(
        this.options.inferOptionalAbsOrPercentageValue(
          'viewWindow.maxPadding',
          screenRange,
        ),
      ) / screenRange;
    // Apply the screen range padding to the data range.
    const viewWindowMaxPadding = range * maxPadding;

    // Maybe expand min and max to include baseline or the viewWindow padding.
    if (!explicitMin) {
      if (
        numericBaseline != null &&
        numericBaseline <= min &&
        min - range < numericBaseline
      ) {
        min = numericBaseline;
      } else {
        min -= viewWindowMaxPadding;
      }
    }
    if (!explicitMax) {
      if (
        numericBaseline != null &&
        numericBaseline >= max &&
        max + range > numericBaseline
      ) {
        max = numericBaseline;
      } else {
        max += viewWindowMaxPadding;
      }
    }

    // Now reset the viewWindow based on the min and max we end up using.
    numericMinMax = {min, max};
    this.setViewWindow(numericMinMax);
    this.setBaseline();

    // Find gradularity of data, which is the smallest difference between
    // adjacent numeric values, ignoring dups.
    sort(this.allNumericValues);
    let dataGranularity = Infinity;
    for (let i = 1; i < this.allNumericValues.length; ++i) {
      const delta = Math.abs(
        this.allNumericValues[i] - this.allNumericValues[i - 1],
      );
      if (delta) {
        dataGranularity = Math.min(dataGranularity, delta);
      }
    }
    if (dataGranularity === Infinity) {
      // No data found, so assume finest granularity.
      dataGranularity = 0;
    }

    const isVertical =
      directionalityParams.orientation === Orientation.VERTICAL;

    let datetimeOptions = {};

    let timeOffset = 0;
    if (valueScale instanceof TimeofdayValueScale) {
      // For timeofday, since the values are relative times, we must
      // convert to local time, without timezone or daylight savings.
      // TODO(dlaliberte): Avoid this hack by changing the DateTickDefiner
      // to work with timeofday values as well.
      const d = new Date(1970, 0, 1);
      timeOffset = d.getTime();

      // Override the DATE default options with the TIMEOFDAY default options.
      datetimeOptions = {
        'gridlines': {'units': DEFAULT_TIMEOFDAY_TICKS_MAJOR},
        'minorGridlines': {'units': DEFAULT_TIMEOFDAY_TICKS_MINOR},
      };
    }

    // Default count is automatic for dates and times.
    const count =
      this.gridlineCount != null && this.gridlineCount >= 0
        ? this.gridlineCount
        : -1;
    assertNumber(count);

    let minSpacing = this.gridlineSpacing;
    if (count >= 0) {
      // Non-negative gridlines count was specified, so use old default options.
      // Override default minSpacing.
      minSpacing = screenRange / (count + 1);
    }

    if (minSpacing != null) {
      extendByKeys(
        datetimeOptions,
        ['gridlines', 'minStrongLineDistance'],
        minSpacing,
      );
    }

    // Insert default options after user options.
    this.options.insertLayer(1, datetimeOptions);

    const calcPos = (num: AnyDuringMigration) => {
      const pos = this.calcPositionForNumericValue(num);
      return pos;
    };

    const dateTicksDefiner = dateTicks.Definer.build(
      this.options,
      isVertical,
      timeOffset,
      calcPos,
      this.chartDef.textMeasureFunction,
    );

    const alignment = this.direction === Direction.FORWARD ? SPAN_LEFT : BELOW;

    const tickOptions = {
      tickTextStyle: this.tickTextStyle,
      gridlineBrush: this.gridlineBrush,
      minorTickTextStyle: this.minorTickTextStyle,
      minorGridlineBrush: this.minorGridlineBrush,
      alignment,
    };

    const actualDirection = this.direction;

    // Note that generator functions cannot be arrow functions.
    const self = this; // NOTYPO
    function* generateTicks(min: AnyDuringMigration, max: AnyDuringMigration) {
      const generator = dateTicksDefiner.generate(
        min,
        max,
        dataGranularity,
        tickOptions,
      );

      let result: AnyDuringMigration = null;
      const getNextResult = () => {
        // Hack to turn off the direction while calculating gridlines and ticks.
        self.direction = Direction.FORWARD;
        result = generator.next().value;
        return result;
      };

      while (getNextResult()) {
        // Clone arrays since we may modify them below.
        result.gridlines = clone(result.gridlines);
        result.tickTextLayout = clone(result.tickTextLayout);

        // Round computed coordinates to a couple decimal places, in case
        // numeric errors pushed the coordinates just outside the range.
        const roundCoord = (num: AnyDuringMigration) => {
          return Math.round(num * 100) / 100;
        };

        if (actualDirection === Direction.BACKWARD) {
          // Now we restore to actual direction by reversing all the
          // coordinates. Also need to flip text offset, so left aligned text
          // becomes right aligned.
          self.direction = actualDirection;

          forEach(result.gridlines, (gridline, index) => {
            gridline = googObject.clone(gridline);
            result.gridlines[index] = gridline;
            gridline.coordinate = roundCoord(
              self.calcReversePosition(gridline.coordinate),
            );
          });
          forEach(result.tickTextLayout, (tickTL, index) => {
            tickTL = googObject.clone(tickTL);
            result.tickTextLayout[index] = tickTL;
            tickTL.coordinate = roundCoord(
              self.calcReversePosition(tickTL.coordinate),
            );
            tickTL.textBlock = googObject.clone(tickTL.textBlock);
            // TODO(dlaliberte) Apply this to all lines. Only one needed now?
            tickTL.textBlock.lines[0] = googObject.clone(
              tickTL.textBlock.lines[0],
            );
            tickTL.textBlock.lines[0].x = roundCoord(
              self.calcReversePosition(tickTL.textBlock.lines[0].x),
            );
          });
        }

        // For ticks, we must convert dataValue dates to valueScale's value,
        // which might be date, datetime, or timeofday.
        // For vertical axis, we must swap x and y coordinates of tick lines.
        forEachRight(result.tickTextLayout, (tickTL) => {
          tickTL.dataValue = valueScale!.numberToValue(
            tickTL.dataValue.getTime(),
          );
          tickTL.textBlock = googObject.clone(tickTL.textBlock);
          const line = googObject.clone(tickTL.textBlock.lines[0]);
          tickTL.textBlock.lines[0] = line;
          if (isVertical) {
            // Swap x and y, for line 0 only.
            // Suppressing errors for ts-migration.
            //   TS4111: Property 'x' comes from an index signature, so it must be accessed with ['x'].
            //   TS4111: Property 'y' comes from an index signature, so it must be accessed with ['y'].
            //   TS4111: Property 'y' comes from an index signature, so it must be accessed with ['y'].
            //   TS4111: Property 'x' comes from an index signature, so it must be accessed with ['x'].
            // @ts-ignore
            [line.x, line.y] = [line.y, line.x];
          }
        });

        // Filter out invisible gridlines, which must be visible
        // within chartArea. Also clone each gridline,
        // to avoid side effect problems with generators.
        // result.gridlines = goog.array.clone(result.gridlines);
        forEachRight(result.gridlines, (gridline, index) => {
          gridline = googObject.clone(gridline);
          result.gridlines[index] = gridline;
          const invisible = !self.isPositionVisible(gridline.coordinate);
          if (invisible) {
            gridline.isVisible = false;
            remove(result.gridlines, gridline);
          } else {
            // Convert dates to the valueScale's value.
            gridline.dataValue = valueScale!.numberToValue(
              gridline.dataValue.getTime() - timeOffset,
            );
          }
        });
        // Sort gridlines, so we can get the first and last.
        // Use stable sort because major and minor gridlines can coincide.
        stableSort(result.gridlines, (v1, v2) =>
          valueScale!.compareValues(v1.dataValue, v2.dataValue),
        );

        yield result;
      }
    }

    let minMaxChanged = true;
    let gridlines = null;

    const convertToTicks = (tickTL: AnyDuringMigration) => {
      let ticks;
      if (this.tickValues) {
        // Use explicit ticks instead.
        ticks = this.tickDateValuesToTicks(dateTicksDefiner, timeOffset);
      } else {
        // Build up ticks array from tickTextLayout.
        tickTL = tickTL || [];
        ticks = map(tickTL, (ttl) => {
          // Need to compute tick coordinate from dataValue but this
          // is sometimes a Date.
          // TODO(dlaliberte) Figure out why timeofday values are
          // sometimes dates, rather than always dates or always arrays.
          const value = ttl.dataValue;
          const numericValue =
            (Array.isArray(value) // Timeofday
              ? valueScale!.valueToNumber(value)
              : value.getTime()) - timeOffset;
          if (numericValue == null) {
            return;
          }
          const coordinate = this.calcPositionForNumericValue(numericValue);
          if (coordinate == null || isNaN(coordinate)) {
            return;
          }

          const tick = {
            dataValue: ttl.dataValue,
            coordinate,
            text: ttl.textBlock.text,
            isVisible: ttl.isVisible,
            optional: ttl.optional,
          };
          return tick;
        });
      }
      return ticks;
    };

    // Test whether the major gridlines, mapped to ticks, can be laid out
    // in the available space with the options.
    const tickLayoutTester = (inputTickTL: AnyDuringMigration) => {
      const ticks = convertToTicks(inputTickTL);
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'TextItems | ({ dataValue: any; coordinate: number; text: any; isVisible: any; optional: any; } | undefined)[]' is not assignable to parameter of type 'TextItems'.
      // @ts-ignore
      const tickTL = this.calcTextLayout(ticks, null);

      if (tickTL == null) {
        return false;
      }

      // Filter out invisible ticks, again.
      // Loop from the right since we are removing ticks by side effect.
      // For vertical axis, we must swap x and y coordinates of tick lines.
      forEachRight(tickTL, (ttl) => {
        let pos = ttl.textBlock!.anchor!.x;
        if (isVertical) {
          pos = ttl.textBlock!.anchor!.y;
        }
        const invisible = !ttl.isVisible || !self.isPositionVisible(pos);
        if (invisible) {
          remove(tickTL, ttl);
        }
      });
      return tickTL;
    };

    let ticks;
    let tickTextLayout;

    while (minMaxChanged) {
      const lastMin = min;
      const lastMax = max;

      const generator = generateTicks(min, max) as Iterator<{
        gridlines: TickLine[];
        tickTextLayout: TextItem[];
      }>;
      let result = null;
      let foundOne = false;
      while (!foundOne && (result = generator.next().value)) {
        gridlines = result.gridlines;
        const tickTL = result.tickTextLayout;

        foundOne = tickLayoutTester(tickTL) !== false;
        if (foundOne) {
          tickTextLayout = this.lastWorkingTickTextLayout;
          ticks = this.lastWorkingTicks;
        }
      }

      if (foundOne && gridlines.length > 1) {
        // If generated ticks are outside the original min|max, expand
        // min|max to fit gridlines. Else revert to the original min|max.
        // Note, gridlines include notches, which we want to ignore here.
        if (!explicitMin) {
          // Find the largest gridline <= the original min.
          const firstValue = reduce(
            result.gridlines,
            (max, gridline) => {
              const value = valueScale!.valueToNumber(gridline.dataValue);
              assert(value != null);
              return gridline.isNotch || value! > originalMin
                ? max
                : // Suppressing errors for ts-migration.
                  //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
                  // @ts-ignore
                  Math.max(max, value);
            },
            -Infinity,
          );
          // min must always increase
          min = Math.max(min, firstValue);
        }
        if (!explicitMax) {
          // Find the smallest gridline >= the original max.
          const lastValue = reduce(
            result.gridlines,
            (min, gridline) => {
              const value = valueScale!.valueToNumber(gridline.dataValue);
              assert(value != null);
              return gridline.isNotch || value! < originalMax
                ? min
                : // Suppressing errors for ts-migration.
                  //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
                  // @ts-ignore
                  Math.min(min, value);
            },
            Infinity,
          );
          // max must always decrease
          max = Math.min(max, lastValue);
        }
      }
      minMaxChanged = min !== lastMin || max !== lastMax;

      numericMinMax = {min, max};
      this.setViewWindow(numericMinMax);
      this.setBaseline();
    }
    // Finally convert tickTextLayout to ticks again,
    // but ignore tickValues since they are already in the ticks.
    this.tickValues = null;
    tickTextLayout = tickTextLayout || [];
    ticks = convertToTicks(tickTextLayout);

    const baseline = this.prepareBaseline();
    return {
      gridlines,
      baseline,
      tickTextLayout,
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'TextItems | ({ dataValue: any; coordinate: number; text: any; isVisible: any; optional: any; } | undefined)[]' is not assignable to type 'TextItems | null'.
      // @ts-ignore
      ticks,
    };
  }

  /**
   * Compute ticks from this.tickValues, for date and time values
   * @param timeOffset How much to offset time for timeofday values.
   */
  private tickDateValuesToTicks(
    dateTicksDefiner: dateTicks.Definer,
    timeOffset: number,
  ): TextItems {
    const ticks: AnyDuringMigration[] = [];
    // Explicit ticks are provided, so use them instead.
    // But to format any unformatted values, we need a formatter.
    // Convert to the 'gridlines' struct used by dateTicksDefiner.formatTicks.
    const gridlines = map(this.tickValues, (tick) => {
      const numericValue = this.valueScale!.valueToNumber(tick['v']);
      // Need to offset timeofday values like gridlines were.
      const dateTimeValue = new Date(numericValue! + timeOffset);
      return {
        dataValue: dateTimeValue,
        formattedValue: tick['f'],
        brush: this.gridlineBrush,
      };
    });

    // Use the minor gridline config if available.  Otherwise major.
    // TODO(dlaliberte) Maybe need an option to specify which to use.
    const config =
      dateTicksDefiner.minorGridlinesConfig ||
      dateTicksDefiner.majorGridlinesConfig;
    assert(config != null);
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type '{ dataValue: Date; formattedValue: any; brush: Brush; }[]' is not assignable to parameter of type 'TickLine[]'.
    // @ts-ignore
    const tickTextsGenerator = dateTicksDefiner.formatTicks(gridlines, config);
    let tickTexts: AnyDuringMigration = null;
    if ((tickTexts = tickTextsGenerator.next().value)) {
      if (tickTexts == null || tickTexts.length === 0) {
        return []; // Nothing fits
      }
    }

    // Now convert the generated tick texts.
    forEach(gridlines, (gridline, index) => {
      const value = gridline.dataValue; // This is an offset Date.
      const numericValue = value.getTime() - timeOffset;
      if (numericValue == null) {
        return;
      }
      const coordinate = this.calcPositionForNumericValue(numericValue);
      if (coordinate == null || isNaN(coordinate)) {
        return;
      }

      // Suppressing errors for ts-migration.
      //   TS2339: Property 'coordinate' does not exist on type '{ dataValue: Date; formattedValue: any; brush: Brush; }'.
      // @ts-ignore
      gridline.coordinate = coordinate;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'isVisible' does not exist on type '{ dataValue: Date; formattedValue: any; brush: Brush; }'.
      // @ts-ignore
      gridline.isVisible = true;

      const text = tickTexts[index].text;
      assert(typeof text === 'string');
      ticks.push({
        dataValue: value,
        coordinate,
        text,
        isVisible: true,
      });
    });
    return ticks;
  }

  /**
   * Calculate axis layout for numbers by invoking the Dive axis package.
   * This is only for numeric values, not dates and times.
   * Supports normal scale, log scale, and mirror log.  Supports fixed number
   * of gridlines, though the number is only used as a rough approximation.
   * TODO(dlaliberte) Split this up into smaller reusable chunks.
   */
  private calcAxisLayoutForNumbers(): TicksAndLines {
    const valueScale = this.valueScale!;

    let explicitMin = true;
    let explicitMax = true;
    if (this.viewWindowMode !== ViewWindowMode.MAXIMIZED) {
      explicitMin = isFinite(this.viewWindow.min);
      explicitMax = isFinite(this.viewWindow.max);
    }

    // Must first compute viewWindow, and then maybe extend it. For log scale,
    // the numeric values are 'scaled' to log of the unscaled values. This is
    // so we can add a fixed padding in log space to either the min or max.
    let numericMinMax = this.getMinMaxProps();

    // scaled numeric values.
    let {min, max} = numericMinMax;

    this.setViewWindow(numericMinMax);
    this.setBaseline();

    const originalMin = min;
    const originalMax = max;
    let range = Math.abs(max - min);
    if (!isFinite(range)) {
      range = 1;
    }

    const baselineValue = this.baseline!.dataValue;
    /** *Scaled* baseline value. */
    const numericBaseline: number | null =
      baselineValue == null ? null : valueScale.valueToNumber(baselineValue);

    const directionalityParams = this.getAxisDirectionalityParameters();

    // Compute back to unscaled min and max values.
    const unscaledMinValue = valueScale.unscaleNumericValue(
      valueScale.getNumericMinValue(),
    );
    const unscaledMaxValue = valueScale.unscaleNumericValue(
      valueScale.getNumericMaxValue(),
    );

    this.markClosestValueToZero(unscaledMinValue);
    this.markClosestValueToZero(unscaledMaxValue);

    // Compute default max padding for non-explicit min or max.
    assert(this.startPos != null && this.endPos != null);
    const screenRange = Math.abs(this.endPos! - this.startPos!);

    // Set lambda according to the scale: lin = 1, log = 0.
    const lambda = this.isLogScale() ? 0 : 1;

    const textMeasurer = new TextMeasurerAdapter(
      this.chartDef.textMeasureFunction,
      this.tickTextStyle,
    );

    const defaultFormat = {'format': valueScale.getDefaultFormat()};
    this.options.insertLayer(1, defaultFormat);
    let formatterBuilder = this.createNumberFormatterBuilder();

    // Determine gridlines.count and .minSpacing.
    // Generally, they are computed from each other with
    //   minSpacing = screenRange / (count + 1).
    // But minSpacing needs to be somewhat smaller, so we divide by count + 1
    // Also, the user options for either one override defaults for both.

    // Default count is automatic for numbers.
    // Was: gviz.canviz.AxisDefiner.DEFAULT_NUM_GRIDLINES;
    let count = this.gridlineCount;
    if (count === -1) {
      count = null;
    }

    // Minimum spacing between gridlines, in pixels.
    // If defined, this will override the count.
    let minSpacing = this.gridlineSpacing;

    // Treat 0, 1, or 2 as auto.
    if (count != null && count > 2) {
      if (this.isLogScale()) {
        // For log scales, we seem to need to try for about 2 times the number
        // of gridlines, in order to end up with about the desired amount.
        count *= 2;
      }

      // If user count is non-null, override default minSpacing.
      minSpacing = screenRange / Math.max(1, count + 1);
    }

    // If user specified neither minSpacing nor count, then we can use
    // default minSpacing.
    if (minSpacing == null) {
      minSpacing = DEFAULT_MIN_SPACING;
      // Double it for the horizontal axis.
      // TODO(dlaliberte) Should factor in the font size.
      if (this.getOrientation() === Orientation.HORIZONTAL) {
        minSpacing *= 2;
      }
    }
    assertNumber(minSpacing);

    if (this.isLogScale()) {
      // For log scales, we seem to need to try for about 1/2 the spacing
      // between gridlines, in order to end up with about the desired amount.
      minSpacing /= 2;
    }

    // Maybe expand min and max to include baseline or the viewWindow padding.
    if (!explicitMin) {
      // Is the min value close enough to the baseline?
      if (
        numericBaseline != null &&
        numericBaseline <= min &&
        min - range < numericBaseline
      ) {
        min = numericBaseline;
        // Treat it like an explicit min
        explicitMin = true;
      }
      if (this.strictLog && min <= 0) {
        // For strict (non mirror) log, the min can be not be less than 0
        // since scaling should always result in a positive number.  So
        // Just use a fraction of the original min.
        min = originalMin * 0.1;
      }
    }
    if (!explicitMax) {
      // Is the max value close enough to the baseline?
      if (
        numericBaseline != null &&
        numericBaseline >= max &&
        max + range < numericBaseline
      ) {
        max = numericBaseline;
        // Treat it like an explicit max
        explicitMax = true;
      }
    }

    // Override user options for the minSpacing, since we are already using
    // that option if set, and adjusting as needed.
    this.options.insertLayer(0, {'gridlines': {'minSpacing': minSpacing}});

    // Convert the ticks in tickValues (from explicit 'ticks' option) or
    // use the generated decorations.
    // @return {!TextItems}
    const convertToTicks = (decorations: AnyDuringMigration) => {
      let ticks;
      if (this.tickValues) {
        // Explicit ticks are provided, so calculate ticks from them.
        ticks = this.tickNumbersToTicks(formatterBuilder);
      } else {
        // Calculate ticks for each major gridline in decorations.
        ticks = this.decorationsToTicks(decorations.majorGridlines);
      }
      return ticks;
    };

    // Test whether the major gridlines, mapped to ticks, can be laid out
    // in the available space with the options.
    const tickLayoutTester = (majorGridlines: AnyDuringMigration) => {
      // Set decorations, used by convertToTicks.
      const decorations = {majorGridlines};
      const ticks = convertToTicks(decorations);
      const tickTL = this.calcTextLayout(ticks, null);
      return tickTL;
    };

    /**
     * Helper to generate ticks for the range (min, max).
     * Assigns to decorations and majorGridlines.
     */
    const generateTicks = (min: number, max: number): Decorations => {
      // Convert min and max back to unscaled, which the decorator requires.
      // We also need to round the unscaled min and max a bit, so the decorator
      // doesn't cut off nice values.
      const roundUnscaled = (n: AnyDuringMigration) =>
        util.roundToNumSignificantDigits(13, valueScale.unscaleNumericValue(n));

      const unscaledMinValue = roundUnscaled(min);
      const unscaledMaxValue = roundUnscaled(max);
      const unscaledOriginalMin = explicitMin
        ? null
        : roundUnscaled(originalMin);
      const unscaledOriginalMax = explicitMax
        ? null
        : roundUnscaled(originalMax);

      if (isNaN(unscaledMinValue) || isNaN(unscaledMaxValue)) {
        // Forced to return no gridlines.
        return {majorGridlines: [], minorGridlines: [], min, max};
      }

      const mapperCallback = (mapper: AnyDuringMigration) => {
        // After finding the a set of decorations, use the corresponding mapper
        // to set the calc functions for mapping from unscaled numeric values
        // to screen positions and vice versa.
        this.calcPositionForNumericValue = (num) => {
          if (num == null) {
            return null;
          }
          num = roundUnscaled(assertNumber(num));
          return mapper.getScreenValue(num);
        };
        this.calcNumericValueFromPosition = (num) => {
          if (num == null) {
            return null;
          }
          num = mapper.getDataValue(num);
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          return valueScale.scaleNumericValue(num);
        };
      };

      // We add and subtract just 0.5 to the screen start and end,
      // respectively, since this avoids expanding by a whole pixel,
      // but allows min and max values to be in the chart area.
      const delta = 0.5;
      const screenStart = directionalityParams.screenStart + delta;
      let screenEnd = directionalityParams.screenEnd - delta;
      // LogScale needs a bit more fudging of the screenEnd.
      // TODO(dlaliberte) Figure out how to avoid this hack.  It would seem
      // wrong for either reversed or non-reversed screen direction.
      if (this.isLogScale()) {
        screenEnd = screenEnd - delta;
      }

      // Now get a decorations creator, for creating gridlines and ticks.
      const decorationsCreator = new AxisDecorationsCreator(
        unscaledMinValue,
        unscaledMaxValue,
        screenStart,
        screenEnd,
        directionalityParams.reversed,
        lambda,
        this.zeroToClosestValueDistance || 1, // must be non-zero
        directionalityParams.orientation,
        this.options,
        textMeasurer,
        formatterBuilder,
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '(majorGridlines: AnyDuringMigration) => TextItems | null' is not assignable to parameter of type '(p1: any[]) => boolean'.
        // @ts-ignore
        tickLayoutTester,
        mapperCallback,
      );

      const decorations = decorationsCreator.getBestNumberDecorations(
        unscaledMinValue,
        unscaledMaxValue,
        unscaledOriginalMin,
        unscaledOriginalMax,
      );

      return decorations;
    };

    let decorations = generateTicks(min, max);
    const formatOption = this.options.inferOptionalStringValue([
      'format',
      'format.pattern',
    ]);
    const isCompactPattern =
      // Suppressing errors for ts-migration.
      //   TS2538: Type 'null' cannot be used as an index type.
      // @ts-ignore
      PRESET_FORMAT[formatOption] === NumberFormat.Format.COMPACT_SHORT ||
// Suppressing errors for ts-migration.
//   TS2538: Type 'null' cannot be used as an index type.
// @ts-ignore
      PRESET_FORMAT[formatOption] === NumberFormat.Format.COMPACT_LONG;
    if (!this.lastWorkingTickTextLayout?.length) {
      // in case no label ticks were generated (this could happen when not all
      // labels are unique, e.g. same order of magnitude and same first 3
      // significant digits: 1.001K and 1.002K and 1.00345K; -0.0048 and -0.0043
      // and +0.004258 etc) for compact numbers, try to use a larger significant
      // digits value
      const significantDigitsOptions = this.options.inferOptionalNumberValue([
        'format.significantDigits',
      ]);
      let minSignificantDigits = significantDigitsOptions;

      // try to generate new label ticks when log scale and labels are not unique
      if (this.isLogScale() && decorations.majorGridlines.length > 2) {
        const {majorGridlines} = decorations;
        // Checking major gridline indexes with the highest potential
        // significant digits. In case max <= 1, 2nd major gridline (i.e. index
        // = 1) value could have highest significant digits (e.g. 0; 0.0001;
        // 0.001; 0.01)
        const majorGridlineIndexes = [0, 1, majorGridlines.length - 1];
        for (let i = 0; i < majorGridlineIndexes.length; i++) {
          const index = majorGridlineIndexes[i];
          minSignificantDigits = Math.max(
            // Suppressing errors for ts-migration.
            //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
            // @ts-ignore
            minSignificantDigits,
            findMinimumSignificantDigits(
              0,
              majorGridlines[index].value,
              isCompactPattern,
            ),
          );
        }
      } else {
        // calculate significant digits from min and max values
        minSignificantDigits = findMinimumSignificantDigits(
          min,
          max,
          isCompactPattern,
        );
      }
      // try to generate ticks with new significant digits if:
      // 1. user provided significant digits in config axis format options and
      // its value < significant digits calculated from min and max value
      // 2. user didn't provide significant digits, and default value <
      // significant digits calculated from min and max value
      if (
        minSignificantDigits !== null &&
        ((significantDigitsOptions === null &&
          minSignificantDigits > COMPACTS_DEFAULT_SIGNIFICANT_DIGITS) ||
          (typeof significantDigitsOptions === 'number' &&
            significantDigitsOptions < minSignificantDigits))
      ) {
        formatterBuilder = this.createNumberFormatterBuilder({
          significantDigits: minSignificantDigits,
        });
        decorations = generateTicks(min, max);
      }
    }

    assert(decorations.min != null && decorations.max != null);
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
    // @ts-ignore
    min = valueScale.scaleNumericValue(decorations.min);
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
    // @ts-ignore
    max = valueScale.scaleNumericValue(decorations.max);

    // Now reset the viewWindow based on the min and max we end up using.
    // Must do this after setting up calc functions with the mapper.
    numericMinMax = {min, max};
    this.setViewWindow(numericMinMax);
    this.setBaseline();

    // Get the lastWorkingTickTextLayout set by the calcTextLayout
    // via the tickLayoutTester that was passed to the AxisDecorationsCreator.
    const tickTextLayout = this.lastWorkingTickTextLayout || [];

    // Clip ticks that exceed count for a few special cases.
    // TODO(dlaliberte) Should keep the baseline.
    if (count === 0 || count === 1) {
      decorations.majorGridlines = slice(decorations.majorGridlines, 0, count);
    }
    if (count === 2) {
      // Only keep first and last.
      decorations.majorGridlines = [
        decorations.majorGridlines[0],
        decorations.majorGridlines[decorations.majorGridlines.length - 1],
      ];
    }

    const ticks = convertToTicks(decorations);

    const minorGridlineCoordinates: AnyDuringMigration[] = [];

    if (!this.tickValues) {
      // Record major gridline values, to eliminate colliding minor gridlines.
      const majorGridlinesMap = {};
      forEach(ticks, (tick) => {
        const coordinate = Math.round(tick.coordinate! * 10000) / 10000;
        (majorGridlinesMap as AnyDuringMigration)[coordinate.toString()] = true;
      });

      // Generate minor gridlines from decorations, but only if there are
      // at least two major gridline.
      if (this.minorGridlinesCount && (count == null || count >= 2)) {
        forEach(decorations.minorGridlines || [], (decoration) => {
          const numeric = decoration.getValue(); // unscaled numeric
          const scaled = valueScale.scaleNumericValue(numeric);
          let coordinate = this.calcPosForNumOrError(scaled);
          coordinate = Math.round(coordinate * 10000) / 10000;
          assert(
            coordinate != null && !isNaN(coordinate),
            'Bad tick value for minor gridline.',
          );
          // Ignore minorGridlines that collide with majorGridlines.
          if (
            !(majorGridlinesMap as AnyDuringMigration)[coordinate.toString()]
          ) {
            minorGridlineCoordinates.push(coordinate);
          }
        });
      }
    }

    // Prepare the major gridlines from ticks.
    const gridlines = map(
      ticks,
      function (tick) {
        const isVisible = this.isPositionVisible(assertNumber(tick.coordinate));
        return {
          tick, // remember the tick, so we can remove it if invisible.
          dataValue: tick.dataValue,
          coordinate: tick.coordinate,
          isVisible,
          length: null,
          brush: this.gridlineBrush,
        };
      },
      this,
    );

    // Add minor gridlines by mapping the minor gridline coordinates.
    if (minorGridlineCoordinates.length > 0) {
      const minorGridlines = map(
        minorGridlineCoordinates,
        function (c) {
          return {
            dataValue: this.calcDataValueFromPosition(c),
            coordinate: c,
            isVisible: true,
            length: null,
            brush: this.minorGridlineBrush,
          };
        },
        this,
      );
      extend(gridlines, minorGridlines);
    }

    const baseline = this.prepareBaseline();
    if (baseline) {
      // Only show the baseline if visible.
      baseline.isVisible = this.isPositionVisible(baseline.coordinate);
    }

    return {
      // Suppressing errors for ts-migration.
      //   TS2322: Type '{ tick: TextItem; dataValue: Value; coordinate: number | undefined; isVisible: boolean; length: null; brush: Brush; }[]' is not assignable to type 'TickLine[]'.
      // @ts-ignore
      gridlines, // major and minor
      baseline,
      tickTextLayout,
      ticks,
    };
  }

  /** Compute ticks from decorations. */
  private decorationsToTicks(decorations: AxisDecoration[]): TextItems {
    const ticks: AnyDuringMigration[] = [];
    forEach(decorations, (decoration) => {
      const label = decoration.getLabel();
      const numeric = decoration.getValue(); // unscaled numeric
      const value = this.valueScale!.unscaledNumberToValue(numeric);
      // TODO(dlaliberte) Using decoration.getPosition() should work.
      // const coordinate = decoration.getPosition();
      const scaled = this.valueScale!.scaleNumericValue(numeric);
      let coordinate = this.calcPositionForNumericValue(scaled);
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
      // @ts-ignore
      if (isNaN(coordinate)) {
        // This happens with no rows of data.
        return;
      }
      assert(
        coordinate != null && !isNaN(coordinate),
        'Bad tick value for major gridline.',
      );
      // Need to round coordinate a small amount.
      coordinate = Math.round(coordinate! * 10000) / 10000;
      const isVisible = this.isPositionVisible(coordinate);
      if (decoration.isTickHeavy() && isVisible) {
        // It's a major gridline
        ticks.push({
          dataValue: value,
          coordinate,
          text: label || '',
          isVisible,
        });
      }
    });
    return ticks;
  }

  /** Compute ticks from this.tickValues, for number values. */
  private tickNumbersToTicks(
    formatterBuilder: NumberFormatterBuilder,
  ): TextItems {
    // Determine default formatter, if explicit formats not provided.
    const tickNumbers = map(this.tickValues, (tick) => {
      return tick['v'];
    });
    const numDigits = calcMinimumFractionDigits(tickNumbers);
    formatterBuilder.setMaxNumDecimals(numDigits);
    const formatter = formatterBuilder.build();

    const ticks: AnyDuringMigration[] = [];
    forEach(this.tickValues, (tick) => {
      const value = tick['v'];
      const num = this.valueScale!.valueToNumber(value);
      if (num == null) {
        return;
      }
      const coordinate = this.calcPositionForNumericValue(num);
      if (coordinate == null || isNaN(coordinate)) {
        return;
      }
      const isVisible = this.isPositionVisible(coordinate);
      if (!isVisible) {
        return;
      }
      let text = tick['f'];
      if (typeof text !== 'string') {
        text = formatter.formatValue(value);
      }
      assert(typeof text === 'string');
      ticks.push({
        dataValue: value,
        coordinate,
        text,
        isVisible: true,
      });
    });
    return ticks;
  }

  /**
   * Creates a number formatter builder based on the formatting specs.
   * Supports options in 'format', 'formatOptions', and 'formatter'.
   * @return A formatter builder.
   */
  private createNumberFormatterBuilder(
    overrideOpts: AnyDuringMigration = {},
  ): NumberFormatterBuilder {
    const options = this.options;
    const builder = new NumberFormatterBuilder();

    // The formatterOptions are passed to NumberFormat.
    // Allow 'format' option to be either a pattern or an object with any of
    // the options.  Also, for backward compatibility, use options from
    // 'formatOptions' or 'formatter' if they were documented.
    const formatterOptions = {
      'pattern': options.inferOptionalStringValue(['format', 'format.pattern']),
      'fractionDigits': options.inferOptionalNumberValue([
        'format.fractionDigits',
        'formatOptions.fractionDigits',
      ]), // Also see 'numSignificantDigits' below.
      'significantDigits':
        overrideOpts.significantDigits ||
        options.inferOptionalNumberValue(['format.significantDigits']),
      'scaleFactor': options.inferOptionalNumberValue([
        'format.scaleFactor',
        'formatOptions.scaleFactor',
        'formatter.scaleFactor',
      ]),
      'prefix': options.inferOptionalStringValue([
        'format.prefix',
        'formatOptions.prefix',
        'formatter.prefix',
      ]),
      'suffix': options.inferOptionalStringValue([
        'format.suffix',
        'formatOptions.suffix',
        'formatter.suffix',
      ]),
      'decimalSymbol': options.inferOptionalStringValue([
        'format.decimalSymbol',
      ]),
      'groupingSymbol': options.inferOptionalStringValue([
        'format.groupingSymbol',
      ]), // Color is not used yet.
      'negativeColor': options.inferOptionalStringValue([
        'format.negativeColor',
      ]),
      'negativeParens': options.inferOptionalStringValue([
        'format.negativeParens',
      ]),
    };
    builder.useFormatterOptions(formatterOptions);

    // Special handling of other 'formatter' options.
    const numDecimals = options.inferOptionalNumberValue([
      'format.numDecimals',
      'formatter.numDecimals',
      'formatOptions.numDecimals',
    ]);
    if (typeof numDecimals === 'number') {
      builder.setMinNumDecimals(numDecimals);
      builder.setMaxNumDecimals(numDecimals);
    }

    const maxNumDecimals = options.inferOptionalNumberValue([
      'format.maxNumDecimals',
      'formatter.maxNumDecimals',
      'formatOptions.maxNumDecimals',
    ]);
    if (typeof maxNumDecimals === 'number') {
      builder.setMaxNumDecimals(maxNumDecimals);
    }

    const minNumDecimals = options.inferOptionalNumberValue([
      'format.minNumDecimals',
      'formatter.minNumDecimals',
      'formatOptions.minNumDecimals',
    ]);
    if (typeof minNumDecimals === 'number') {
      builder.setMinNumDecimals(minNumDecimals);
    }

    const numSignificantDigits = options.inferOptionalNumberValue([
      'format.numSignificantDigits',
      'formatter.numSignificantDigits',
      'formatOptions.numSignificantDigits',
    ]);
    if (typeof numSignificantDigits === 'number') {
      builder.setNumSignificantDigits(numSignificantDigits);
    }

    const unit = options.inferValue([
      'format.unit',
      'formatter.unit',
      'formatOptions.unit',
    ]);
    if (unit) {
      builder.setUnit({
        'symbol': (unit as AnyDuringMigration)['symbol'],
        'position': (unit as AnyDuringMigration)['position'],
        'usePadding': (unit as AnyDuringMigration)['usePadding'],
      });
    }

    const useMagnitudes = options.inferValue([
      'format.useMagnitudes',
      'formatter.useMagnitudes',
      'formatOptions.useMagnitudes',
    ]);

    if (useMagnitudes != null) {
      // Using short magnitude formatters for axes, by default.
      let magnitudinizer = builder.useShortI18nMagnitudes.bind(builder);
      if (useMagnitudes === 'long') {
        magnitudinizer = builder.useLongI18nMagnitudes.bind(builder);
      }
      // Need maxNumDecimals.  Use that option, if specified.
      // Otherwise, default to 5, which was used here previously.
      const numDecimals =
        typeof maxNumDecimals === 'number' ? maxNumDecimals : 5;
      magnitudinizer(numDecimals);
    }

    return builder;
  }

  /**
   * Create a baseline object.
   * @return The baseline info
   */
  private prepareBaseline(): TickLine | null {
    let baseline = null;
    if (this.type === AxisType.VALUE && this.baseline) {
      baseline = {
        dataValue: this.baseline.dataValue,
        coordinate: this.baseline.coordinate,
        isVisible: true,
        length: null,
        brush: this.baselineBrush,
      };
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type '{ dataValue: Value | null; coordinate: number; isVisible: boolean; length: null; brush: Brush; } | null' is not assignable to type 'TickLine | null'.
    // @ts-ignore
    return baseline;
  }

  /**
   * For all value axes, extend range to include minValue, maxValue,
   * and baseline.
   */
  private extendMinMaxProps() {
    if (this.userBaseline != null && this.userBaseline !== 'auto') {
      this.extendRangeToIncludeNumber(
        this.valueScale!.valueToNumber(this.userBaseline as Value),
      );
    }
    if (this.minValue != null) {
      this.extendRangeToIncludeNumber(
        this.valueScale!.valueToNumber(this.minValue as number | null),
      );
    }
    if (this.maxValue != null) {
      this.extendRangeToIncludeNumber(
        this.valueScale!.valueToNumber(this.maxValue as number | null),
      );
    }
  }

  /** Extend the viewWindow based on explicit ticks, if any. */
  private extendViewWindowForTicks() {
    if (this.tickValues) {
      // Extend viewWindow to include all the explicit tick values.
      // Also find min and max tick values.  We don't need to sort otherwise.
      let minTickValue = Infinity;
      let maxTickValue = -Infinity;
      forEach(
        this.tickValues,
        function (tick) {
          const value = this.valueScale!.valueToNumber(tick['v']);
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          minTickValue = Math.min(minTickValue, value);
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
          // @ts-ignore
          maxTickValue = Math.max(maxTickValue, value);
          this.extendRangeToIncludeNumber(value);
        },
        this,
      );
      // Limit viewWindow to explicit ticks, if outside the data range.
      // We do this by setting the viewWindow min or max, if not already set.
      // This only applies if there is more than one tick value.
      if (this.tickValues.length > 1) {
        const minDataValue = this.valueScale!.getNumericMinValue();
        const maxDataValue = this.valueScale!.getNumericMaxValue();
        if (minTickValue <= minDataValue && !isFinite(this.viewWindow.min)) {
          this.viewWindow.min = minTickValue;
        }
        if (maxTickValue >= maxDataValue && !isFinite(this.viewWindow.max)) {
          this.viewWindow.max = maxTickValue;
        }
      }
    }
  }

  /**
   * Gets the min and max props based on the value scale's numeric min and max
   * values and the viewWindow min and max.
   * This must be called after numericMinValue and numericMaxValue of the value
   * scale have been set.  Adjusts the returned values arbitrarily
   * if they are the same or still non-finite, which can happen if there
   * is only one data value or no data values.
   *
   * @return The numeric min and max.
   */
  private getMinMaxProps(): {min: number; max: number} {
    let numericMinValue = isFinite(this.viewWindow.min)
      ? this.viewWindow.min
      : this.valueScale!.getNumericMinValue();
    if (!isFinite(numericMinValue)) {
      numericMinValue = 0;
    }
    let numericMaxValue = isFinite(this.viewWindow.max)
      ? this.viewWindow.max
      : this.valueScale!.getNumericMaxValue();
    if (!isFinite(numericMaxValue)) {
      numericMaxValue = 1;
    }
    if (numericMinValue === numericMaxValue) {
      // min and max are defined, but the same, which must never happen.
      // Must be type-specific, and should try to determine the
      // significant digits, or granularity of the data value.
      const unit = this.getNumericUnit(numericMinValue);
      numericMinValue -= unit;
      numericMaxValue += unit;
    }
    if (numericMinValue > numericMaxValue) {
      // Swap them.
      [numericMinValue, numericMaxValue] = [numericMaxValue, numericMinValue];
    }
    return {min: numericMinValue, max: numericMaxValue};
  }

  /**
   * Returns a numeric value to expand value by, based on the type of
   * axis and the granularity of the value.
   */
  getNumericUnit(value: number): number {
    // TODO(dlaliberte) Fix this localized hack by distributing functionality
    // to whatever scales we end up with.  For large number and years,
    // we should look for large multiples of power of 10.
    let unit = 0;
    if (this.isDatetimeValueScale()) {
      const date = new Date(value);
      const datetimeDuration = [
        date.getMilliseconds(),
        date.getSeconds(),
        date.getMinutes(),
        date.getHours(),
        date.getDate() - 1, // We need 1st of month to be 0 here.
        date.getMonth(),
        date.getFullYear(),
      ];
      const granularityIndex = durationGranularity(datetimeDuration);
      const granularityMsUnits = [
        1, // ms
        1000, // seconds
        1000 * 60, // minutes
        1000 * 60 * 60, // hours
        1000 * 60 * 60 * 24, // days
        1000 * 60 * 60 * 24 * 31,
      ];
      // months
      if (granularityIndex < granularityMsUnits.length) {
        unit = granularityMsUnits[granularityIndex];
      } else {
        // Need 366 days to catch the previous and next year boundary.
        unit = 1000 * 60 * 60 * 24 * 366;
      }
    } else {
      // This is the old default for numeric values, but we should do better.
      unit = 1;
    }
    return unit;
  }

  /** Sets the view window and pixels factor. */
  private setViewWindow(numericMinMax: {min: number; max: number}) {
    assert(typeof numericMinMax.min === 'number');
    assert(typeof numericMinMax.max === 'number');
    // For empty data, we will have min: Infinity and max: -Infinity.
    // goog.asserts.assert(numericMinMax.min < numericMinMax.max);

    // Set valueScale and this.viewWindow to the same.
    this.valueScale!.setNumericMinValue(numericMinMax.min);
    this.valueScale!.setNumericMaxValue(numericMinMax.max);
    this.viewWindow = numericMinMax;

    // Must always have non-zero data range to compute PixelsFactor.
    const dataRange = Math.max(1, numericMinMax.max - numericMinMax.min);
    this.numericValueToPixelsFactor = this.axisLength / dataRange;
    assert(this.numericValueToPixelsFactor !== 0);

    if (numericMinMax.min !== Infinity) {
      this.valueAtStartPos = numericMinMax.min;
    }
  }

  /**
   * Sets this.baseline with an object representing the baseline.
   * Must be done after the viewWindow has been set up.
   */
  private setBaseline() {
    const numericBaseline: number | null =
      this.defaultBaseline == null
        ? null
        : this.valueScale!.valueToNumber(this.defaultBaseline as Value);
    // Note: For date and datetime, there is no default baseline,
    // and for timeofday, the value is [0, 0, 0, 0], converted to number as 0;

    assert(
      numericBaseline == null ||
        (typeof numericBaseline === 'number' && isFinite(numericBaseline)),
    );
    this.valueScale!.setNumericBaseline(numericBaseline);

    if (numericBaseline != null) {
      let coordinate = this.calcPositionForNumericValue(numericBaseline);
      // The coordinate must be a number, but NaN is problematic for testing,
      // since NaN != NaN, so using Infinity instead.
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'number | null' is not assignable to parameter of type 'number'.
      // @ts-ignore
      if (isNaN(coordinate)) {
        coordinate = Infinity;
      }
      this.baseline = {
        dataValue: this.valueScale!.numberToValue(numericBaseline),
        coordinate: coordinate as number,
        isVisible: true,
      };
    } else {
      // There is no baseline, but for convenience, we need a baseline object.
      this.baseline = {dataValue: null, coordinate: Infinity, isVisible: false};
    }
  }

  abstract getAxisDirectionalityParameters(): {
    reversed: boolean;
    screenStart: number;
    screenEnd: number;
    orientation: Orientation;
  };

  abstract getOrientation(): Orientation;

  /**
   * In case this axis is a value axis, extend its min/max range to include a
   * given *scaled* numeric value. Affects only axes of type value.
   * Proxies the call to valueScale.extendRangeToIncludeNumber.
   *
   * Note that for strict log scale, the range is never extended below 0. The
   * number is scaled, by the way, which means that numbers less than 1 would
   * otherwise be scaled to a negative number (e.g. log10 of 0.1 is -1), but
   * the log scaling further maps the values so the smallest known value ends
   * up at 0.
   *
   * @param num The number that must be included in range.
   */
  extendRangeToIncludeNumber(num: number | null) {
    // Update the range only if it is a value axis and the number is in the
    // explicit view window.
    if (this.type === AxisType.VALUE && num != null) {
      // Ignore negative numbers if strictLog applies.
      if (!this.strictLog || num >= 0) {
        this.valueScale!.extendRangeToIncludeNumber(num);
        // We temporarily hold all values in an array to find the granularity.
        this.allNumericValues.push(num);
      }
    }
  }

  /**
   * In case this axis is a value axis, expands its min/max range a little bit,
   * to avoid cases where the smallest visual element is of zero size. This is
   * bad in bar chart - we don't want zero sized columns. This is a hack just
   * for bars, with assumptions about the baseline being 0. It doesn't expand a
   * positive min below 0, or a negative max above 0.
   * TODO(dlaliberte) Probably better to avoid this hack another way entirely.
   */
  expandRangeABit() {
    if (this.type === AxisType.VALUE) {
      const scale = this.valueScale;
      const min = scale!.getNumericMinValue();
      const max = scale!.getNumericMaxValue();
      const expand = (max - min) * 0.01;
      // Don't extend if a view window is set.
      if (min > 0 && this.viewWindow.min === -Infinity) {
        scale!.setNumericMinValue(Math.max(min - expand, 0));
      }
      if (max < 0 && this.viewWindow.max === Infinity) {
        scale!.setNumericMaxValue(Math.min(max + expand, 0));
      }
    }
  }

  /**
   * Calculates the screen position of a scaled numeric value on the chart.
   * TODO(dlaliberte) We should use a scale for all this screen scaling.
   *
   * @param value The value we want to calculate position for.
   * @return The position on the axis for this value.
   */
  calcPositionForNumericValue(value: number | null): number | null {
    if (value == null) {
      return null;
    }
    if (this.numericValueToPixelsFactor === 0) {
      return null;
    }
    assert(!isNaN(this.numericValueToPixelsFactor));

    // No need to clamp values that are out of the axis' range - we allow
    // positioning values outside of the chart's area.
    assert(this.startPos != null);
    const result =
      this.startPos! +
      (value - this.valueAtStartPos) *
        this.direction *
        this.numericValueToPixelsFactor;
    assert(!isNaN(result));
    return result;
  }

  /**
   * Calculate the pixel position of a given value, which must be non-null.
   * @return The pixel position of the given value.
   */
  calcPosForNumOrError(value: number | null): number {
    const pos = this.calcPositionForNumericValue(value);
    if (pos == null) {
      throw new Error(`null position for value of '${value}'`);
    }
    return pos;
  }

  /**
   * Calculates the scaled numeric value to the pixel position on the axis.
   * @param position The position on the axis.
   * @return Numeric value on the chart.
   */
  calcNumericValueFromPosition(position: number | null): number | null {
    if (position == null) {
      return null;
    }
    if (this.numericValueToPixelsFactor === 0) {
      return null;
    }

    assert(this.startPos != null);
    const result =
      ((position - this.startPos!) * this.direction) /
        this.numericValueToPixelsFactor +
      this.valueAtStartPos;
    assert(!isNaN(result));
    return result;
  }

  /**
   * Converts physical position to data value by first converting the position
   * to numeric value and then, if not null, convert it to its equivalent data
   * value.
   * @param position Physical position in pixel.
   * @return The converted value.
   */
  calcDataValueFromPosition(position: number | null): AnyDuringMigration {
    const numericValue = this.calcNumericValueFromPosition(position);
    return numericValue == null ? null : this.numberToValue(numericValue);
  }

  /**
   * Converts data value to physical position by first converting the value
   * to its numeric equivalent and then translating that to physical location.
   * This conversion can be null if numeric value is outside the domain of the
   * conversion function (e.g. value == 0 on a logarithmic conversion). This
   * error can occur during interpolation between logarithmic graphs and
   * non-logarithmic graphs if you interrupt the interpolation (ex. non-log
   * graph => log grapth (interrupted before interpolation finished) => non-log
   * graph).
   *
   * @param value Actual data value.
   * @return The converted value.
   */
  calcPositionFromDataValue(value: Value | null): number | null {
    const numericValue = this.numberFromValue(value);
    return numericValue == null
      ? null
      : this.calcPositionForNumericValue(numericValue);
  }

  /**
   * Converts data value to physical position by first converting the value
   * to its numeric equivalent and then translating that to physical location.
   * @param value Actual data value.
   * @return The converted value.
   */
  calcPosFromDataOrError(value: Value | null): number {
    const pos = this.calcPositionFromDataValue(value);
    if (pos == null) {
      throw new Error(`null position for value of '${value}'`);
    }
    return pos;
  }

  /**
   * Calculates the reverse of the given position.
   * This is intended to be used when the actual direction is reversed,
   * and the position was computed without the reverse direction.
   *
   * @param position The position we want to reverse.
   * @return The position on the axis for this value.
   */
  calcReversePosition(position: number | null): number | null {
    assert(this.startPos != null);
    return position == null ? null : 2 * this.startPos! - position;
  }

  /**
   * Returns whether a given position is past the screen max position.
   * @param pos A position.
   * @return See above.
   */
  isPositionPastTheEnd(pos: number): boolean {
    if (isNaN(pos)) {
      return true;
    }
    assert(this.endPos != null);
    // Note that if direction = -1 "past the end" means "smaller than it".
    return pos * this.direction > this.endPos! * this.direction;
  }

  /**
   * Returns whether a given position is before the screen min position.
   * @param pos A position.
   * @return See above.
   */
  isPositionBeforeTheStart(pos: number): boolean {
    if (isNaN(pos)) {
      return true;
    }
    assert(this.startPos != null);
    // Note that if direction = -1 "before the start" means "greater than it".
    return pos * this.direction < this.startPos! * this.direction;
  }

  /**
   * Returns whether a given position is visible.
   * @param pos A position.
   * @return See above.
   */
  isPositionVisible(pos: number): boolean {
    return (
      !isNaN(pos) &&
      pos !== Infinity &&
      !this.isPositionBeforeTheStart(pos) &&
      !this.isPositionPastTheEnd(pos)
    );
  }

  /**
   * Translates data value into scaled numeric value.
   * For discrete axis this does nothing, but for continuous we apply the
   * valueScale.valueToNumber method.
   * @param value Actual data value.
   * @return The numeric equivalent value.
   */
  numberFromValue(value: Value | null): number | null {
    const numericValue = (
      this.type === AxisType.VALUE
        ? this.valueScale!.valueToNumber(value)
        : value
    ) as number | null;
    return numericValue;
  }

  /**
   * Translates a numeric value into a data value.
   * For discrete axis this does nothing, but for continuous we apply the
   * valueScale numberToValue method.
   * @param numericValue Numeric data value.
   * @return The equivalent data value.
   */
  numberToValue(numericValue: number | null): Value | null {
    if (numericValue == null) {
      return null;
    }
    const value =
      this.type === AxisType.VALUE
        ? this.valueScale!.numberToValue(numericValue)
        : numericValue;
    return value;
  }

  /**
   * Returns the numeric value of the minimum axis value.
   * @return The numeric value of the minimum axis value. If there is no viewWindow.min, return -Infinity.
   */
  getMinNumericValue(): number {
    switch (this.type) {
      case AxisType.VALUE:
      case AxisType.CATEGORY_POINT:
        return this.viewWindow.min;

      case AxisType.CATEGORY:
        return this.viewWindow.min - 0.5;

      default:
        throw new Error(`Invalid axis type "${this.type}"`);
    }
    // return this.viewWindow.min;  // Did we need this?
  }

  /**
   * Returns the numeric value of the maximum axis value.
   * @return The numeric value of the maximum axis value. If there is no viewWindow.max, return Infinity.
   */
  getMaxNumericValue(): number {
    switch (this.type) {
      case AxisType.VALUE:
        return this.viewWindow.max;

      case AxisType.CATEGORY_POINT:
        // The index of the last category is viewWindow.max - 1.
        return this.viewWindow.max - 1;

      case AxisType.CATEGORY:
        // The index of the last category is viewWindow.max - 1. We add 0.5 to
        // it.
        return this.viewWindow.max - 0.5;

      default:
        throw new Error(`Invalid axis type "${this.type}"`);
    }
    // return this.viewWindow.max; // Did we need this?
  }

  /**
   * Returns whether a given numeric data value falls within the visible view
   * window. This is relevant only for VALUE axes.
   * @param value A data value converted to number.
   * @return See above.
   */
  isValueInViewWindow(value: number | null): boolean {
    if (value == null) {
      // Null and undefined values are not considered to be "in the view
      // window".
      return false;
    } else if (this.type === AxisType.VALUE) {
      return value >= this.viewWindow.min && value <= this.viewWindow.max;
    } else {
      return (
        value >= Math.floor(this.viewWindow.min) &&
        value < Math.ceil(this.viewWindow.max)
      );
    }
  }

  /**
   * Returns true if the value scale is date / datetime / timeofday.
   * @return See above.
   */
  private isDatetimeValueScale(): boolean {
    return (
      this.valueScale != null &&
      (this.valueScale instanceof DatetimeValueScale ||
        this.valueScale instanceof TimeofdayValueScale)
    );
  }

  /** Returns true if the value scale uses a logScale. */
  isLogScale(): boolean {
    return this.logScale;
  }

  /**
   * Calculates position and layout of elements along the axis,
   * outside and inside of the chart area.  Also checks whether
   * there are any resulting collisions between ticks.
   * An empty array will be returned if the tickTextPosition is 'none'.
   * @param tickTextLayout Pass in null if we don't intend to use a pre-existing layout.
   */
  calcTextLayout(
    ticks: TextItems,
    tickTextLayout: TextItems | null,
  ): TextItems | null {
    this.ticks = ticks; // Used as input to the calc methods.
    this.tickTextLayout = tickTextLayout; // Used as input, if non-null

    const originalTickTextPosition = this.tickTextPosition;
    if (originalTickTextPosition === InOutPosition.NONE) {
      // Do the layout as if position were inside.
      this.tickTextPosition = InOutPosition.INSIDE;
    }
    // These two functions will set this.tickTextLayout as output.
    this.calcOutsideTextLayout();
    this.calcInsideTextLayout();

    let textItems = null;
    if (originalTickTextPosition === InOutPosition.NONE) {
      // Replace tick text layout with empty array.
      this.tickTextLayout = [];
    }
    if (this.tickTextLayout && this.areTicksClearOfCollisions()) {
      this.lastWorkingTickTextLayout = this.tickTextLayout;
      this.lastWorkingTicks = this.ticks;
      textItems = this.tickTextLayout;
    }

    this.tickTextPosition = originalTickTextPosition;
    return textItems;
  }

  abstract processOptions(): void;

  abstract calcOutsideTextLayout(): void;

  abstract calcInsideTextLayout(): void;

  abstract calcTicklinesOrigin(): {coordinate: number; direction: number};

  abstract areTicksClearOfCollisions(): boolean;
}

// TODO(dlaliberte) Move these to default options.
// But we need to distinguish between user options and default options.
/*
 * Default number (count) of gridlines.  If -1, this means 'auto'.
 * Obsolete now?
 * const {number}
 * const DEFAULT_NUM_GRIDLINES = 5;
 */

/** Default minSpacing of gridlines. */
const DEFAULT_MIN_SPACING = 40;

interface TicksAndLines {
  gridlines: TickLine[] | null;
  baseline: TickLine | null;
  tickTextLayout: TextItems | null;
  ticks: TextItems | null;
}
