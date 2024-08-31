/**
 * @fileoverview Horizontal axis definition.
 * Calculates the measures needed to draw a horizontal axis.
 * Inherits from AxisDefiner.
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
  every,
  find,
  forEach,
  map,
  peek,
  stableSort,
} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {Box} from '@npm//@closure/math/box';
import {
  modulo,
  toRadians,
} from '@npm//@closure/math/math';
import {clone} from '@npm//@closure/object/object';
import {ColorBarDefiner} from '../colorbar/color_bar_definer';
import {GOLDEN_RATIO} from '../common/constants';
import {MSG_MISSING_TEXT_INDICATION} from '../common/messages';
import {
  AxisType,
  ColorBarPosition,
  HighLowPosition,
  InOutPosition,
  LegendPosition,
  TextSkipMode,
  ViewWindowMode,
} from '../common/option_types';
import {OptionPath, Options} from '../common/options';
import {arrayMultiSlice, distributeRealEstateWithKeys} from '../common/util';
import {LegendDefiner} from '../legend/legend_definer';
import {Coordinate} from '../math/coordinate';
import {TextAlign} from '../text/text_align';
import {TextBlock, calcBoundingBox} from '../text/text_block_object';
import {TextMeasureFunction} from '../text/text_measure_function';
import * as textutils from '../text/text_utils';
import {
  AxisDefinition,
  TextItem,
} from '../visualization/corechart/axis_definition';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {AxisDefiner} from './axis_definer';
import {Orientation} from './text_measurer';
import {TickDiluter} from './tick_diluter';

const {CENTER, END, START} = TextAlign;

// tslint:disable:strict-prop-init-fix
// tslint:disable:ban-types
// tslint:disable:ban-ts-suppressions

interface OptimisticSlantedTicks {
  minHeight: number;
  maxHeight: number;
  skip: number;
}

/**
 * Horizontal axis definer.
 */
export class HorizontalAxisDefiner extends AxisDefiner {
  allowContainerBoundaryTextCutoff = false;

  /** Whether to use slanted tick labels. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  slantedTickText!: boolean | null;

  /** The angle of the slanted tick labels (in degrees), if used. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  slantedTickTextAngleDegrees!: number;

  /** The angle of the slanted tick labels (in radians), if used. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  slantedTickTextAngle!: number;

  /** The axis margin (or gap) between baseline and axis labels in pixels. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  axisMargin!: number;

  /** The index of the first visible tick text. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  firstTickIdx!: number;

  /** The maximum number of lines for each tick label. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  maxTextLines!: number;

  /** The max number of alternations of the tick labels. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  maxAlternation!: number;

  /**
   * The skip value of the tick labels. Zero means automatically try to find
   * best value.
   */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  forceSkip!: number;

  /**
   * If true, skipping will start from the last tick towards the beginning
   * (ensures the last tick is visible, the first doesn't have to be). If
   * false, skipping will start from the beginning.
   */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  skipMode!: TextSkipMode;

  /** The minimum allowed spacing between tick labels. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  minTextSpacing!: number;

  /** Can or can't the text be cut off by the container boundaries. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  allowContainerBoundaryTextCufoff!: boolean;
  private allocatedHeights: AnyDuringMigration;

  // Starting step 4 - processing information from step 3.
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  private heightOffset!: number;
  override tickTextLayout: AnyDuringMigration;

  /**
   * Constructor for HorizontalAxisDefiner.
   * @param chartDef The chart definition.
   * @param options The options.
   * @param optionPath The options paths for the axis options.
   * @param index The axis index within the horizontal axes (default is 0).
   * @param defaultType The default value for the axis type.
   * @param defaultViewWindowMode The default value for the viewWindowMode.
   */
  constructor(
    chartDef: ChartDefinition,
    options: Options,
    optionPath: OptionPath,
    index: number,
    defaultType: AxisType,
    defaultViewWindowMode: ViewWindowMode,
  ) {
    // Call the parent constructor.
    super(
      chartDef,
      options,
      concat([`hAxes.${index}`, 'hAxis'], optionPath),
      index,
      defaultType,
      defaultViewWindowMode,
    );

    // Note, after this point, use this.options instead of the options arg
    // because the parent class constructs an options.view.
    this.processOptions();
  }

  /** Process the options, possibly more than one time. */
  processOptions() {
    const options = this.options;

    this.slantedTickText = options.inferOptionalBooleanValue('slantedText');

    const defaultSlantedTickTextAngleDegrees = 30;
    let slantedTickTextAngleDegrees = options.inferNumberValue(
      'slantedTextAngle',
      defaultSlantedTickTextAngleDegrees,
    );
    slantedTickTextAngleDegrees = modulo(slantedTickTextAngleDegrees, 360);

    this.slantedTickTextAngleDegrees = slantedTickTextAngleDegrees;

    this.slantedTickTextAngle = toRadians(slantedTickTextAngleDegrees);

    this.axisMargin = options.inferNonNegativeNumberValue(
      'margin',
      0.5 * this.tickTextStyle.fontSize,
    );

    this.firstTickIdx = options.inferNonNegativeNumberValue('firstVisibleText');

    this.maxTextLines = options.inferNonNegativeNumberValue(
      'maxTextLines',
      Infinity,
    );

    this.maxAlternation = options.inferNonNegativeNumberValue(
      'maxAlternation',
      2,
    );

    this.forceSkip = options.inferNonNegativeNumberValue('showTextEvery', 0);

    this.skipMode = options.inferStringValue(
      'showTextEveryMode',
      TextSkipMode.ATTACH_TO_START,
      TextSkipMode,
    ) as TextSkipMode;

    this.minTextSpacing = options.inferNonNegativeNumberValue(
      'minTextSpacing',
      this.tickTextStyle.fontSize,
    );

    this.allowContainerBoundaryTextCufoff = options.inferBooleanValue(
      ['allowContainerBoundaryTextCutoff', 'allowContainerBoundaryTextCufoff'],
      false,
    );
  }

  getAxisName(): string {
    return `hAxis#${this.index}`;
  }

  /**
   * Calculates the layout of the horizontal axis ticks and title.
   * This method should be called only ONCE per instance.
   * Changes the members: ticks, tickTextPos.
   *
   * @param legendDefiner The legend definer.
   * @param colorBarDefiner The color-bar definer.
   * @return The resulting AxisDefinition, after doing all needed calculations.
   */
  calcAxisDefinition(
    legendDefiner: LegendDefiner | null,
    colorBarDefiner: ColorBarDefiner | null,
  ): AxisDefinition {
    const chartArea = this.chartDef.chartArea;
    return this.calcCommonAxisDefinition(
      chartArea.width,
      this.direction === 1 ? chartArea.left : chartArea.right,
      legendDefiner,
      colorBarDefiner,
    );
  }

  /**
   * Uses this.ticks.
   * Sets this.tickTextLayout, this.title, and others
   * @suppress {checkTypes}
   */
  calcOutsideTextLayout() {
    const predefinedTickTextLayout = this.tickTextLayout != null;

    if (this.index !== 0) {
      // TODO(dlaliberte): Implement this case.
      return;
    }
    const measureFunction = this.chartDef.textMeasureFunction;
    const tickFontSize = this.tickTextStyle.fontSize;
    const titleFontSize = this.title.textStyle.fontSize;

    const titleText =
      this.chartDef.axisTitlesPosition === InOutPosition.OUTSIDE
        ? this.title.text
        : '';

    // The algorithm below tries to fit as many lines of data (where data is
    // tick text, title, and legend) into the space below the horizontal axis.
    // It does that using the gviz.canviz.util.distributeRealEstate() function.
    // In general, the steps are as follow:
    // 1. Calculate the setup which the tick text would like to have - should it
    //    be slanted, and if not, what alternation/skip to use and how many
    //    lines are needed for that. This is done by calling TickDiluter.
    // 2. Call gviz.canviz.textutils.calcTextLayout for the title, with maxLines
    //    Infinity, so we have the maximum (optimistic) number of lines for the
    //    title.
    // 3. Now call gviz.canviz.util.distributeRealEstate with items with the
    //    following items, in descending order of priority:
    //    A. first line of ticks
    //    B. first line of title
    //    C. legend
    //    D. The rest of tick lines
    //    E. The rest of title lines
    // 4. Process information returned from distributeRealEstate and calculate
    //    layout for the ticks, title and legend. For the ticks, we use the
    //    TickDiluter again, now with the final number of lines allocated for
    //    the ticks, and it'll find the best alternation/skip combination for
    //    this number of lines.

    // Step 1 - optimistic tick text layout

    const calcTextLayout = (
      text: string,
      width: number,
      numOfLines: number,
    ): AnyDuringMigration => {
      return textutils.calcTextLayout(
        measureFunction,
        text,
        this.tickTextStyle,
        width,
        numOfLines,
      );
    };
    const tickDiluter = new TickDiluter(
      this.chartDef.width,
      this.ticks,
      this.firstTickIdx,
      this.maxTextLines,
      this.maxAlternation,
      this.forceSkip,
      this.skipMode,
      this.minTextSpacing,
      this.allowContainerBoundaryTextCutoff,
      calcTextLayout,
    );
    const skipThreshold = this.forceSkip || 1;
    let optimisticHorizontalTicks;
    let optimisticSlantedTicks: OptimisticSlantedTicks | null = null;
    if (this.tickTextPosition !== InOutPosition.OUTSIDE) {
      // Do nothing, keep optimisticHorizontalTicks and optimisticSlantedTicks
      // undefined so no ticks will be displayed.
    } else if (this.slantedTickText == null) {
      // Automatically decide horizontal or slanted tick labels. First run a
      // heuristic calculation to decide if optimistic calculation should at all
      // take place. If such calculation does take place, use its result only if
      // we can make it without skip. If fail, fall back to slanted.
      if (
        (this.ticks.length * tickFontSize) /
          (this.maxAlternation * skipThreshold) <=
        this.chartDef.width
      ) {
        // The above heuristic condition tries to guess if the optimistic tick
        // arrangement has a chance to succeed. If it is not satisfied, slanted
        // ticks are calculated (the else clause). The left hand side estimated
        // how much width would be needed for one char in every displayed tick
        // when the minimum number of ticks are displayed (max alternation times
        // skip threshold) and even this minimalistic target (one char per tick
        // and minimum number of ticks) still need more than the chart width
        // then there is no point is running the optimistic arrangement
        // algorithm.
        optimisticHorizontalTicks = tickDiluter.calcOptimisticTickArrangement();
        if (
          optimisticHorizontalTicks.skip > skipThreshold ||
          optimisticHorizontalTicks.numOfLines === 0
        ) {
          // Ok, optimistic tick arrangement was indeed calculated and failed,
          // so fall back to slanted ticks.
          optimisticSlantedTicks =
            this.calcOptimisticSlantedTicks(measureFunction);
          optimisticHorizontalTicks = null;
        }
      } else {
        // The heuristic calculation decided not to run the optimistic algorithm
        // so slanted ticks are calculated instead.
        optimisticSlantedTicks =
          this.calcOptimisticSlantedTicks(measureFunction);
      }
    } else if (this.slantedTickText) {
      // Calculate slanted tick labels.
      optimisticSlantedTicks = this.calcOptimisticSlantedTicks(measureFunction);
    } else {
      // Calculate horizontal tick labels.
      optimisticHorizontalTicks = tickDiluter.calcOptimisticTickArrangement();
    }

    // Step 2 - optimistic title layout

    const optimisticTitleLayout = textutils.calcTextLayout(
      measureFunction,
      titleText,
      this.title.textStyle,
      this.chartDef.chartArea.width,
      Infinity,
    );

    // TODO(dlaliberte): uncomment out when full chartDef.canvas object is ready.
    // this.chartDef.canvas.width, Infinity);

    // Some constants.
    const minGap = this.minGap;
    const gapAboveTicks = Math.max(
      minGap,
      Math.round(tickFontSize / GOLDEN_RATIO),
    );
    const gapBetweenTickLines = Math.max(
      minGap,
      Math.round(tickFontSize / (2 * GOLDEN_RATIO)),
    );

    // Preparation for step 3

    const getSlantedTicksItem = () => {
      if (optimisticSlantedTicks == null) {
        throw new Error('optimisticSlantedTicks is null');
      }
      return {
        key: KEYS.TICKS,
        min: optimisticSlantedTicks.minHeight + minGap,
        max: optimisticSlantedTicks.maxHeight + minGap,
        extra: [gapAboveTicks - minGap],
      };
    };

    let items = [];

    // Bottom space. This has highest priority.
    items.push({key: KEYS.BOTTOM_SPACE, min: minGap, extra: [Infinity]});
    // First line of title.
    if (optimisticTitleLayout.lines.length > 0) {
      items.push({
        key: KEYS.TITLE,
        min: titleFontSize + minGap,
        extra: [Infinity],
      });
    }
    // Legend.
    const legendFontSize = this.legendDefiner!.getTextStyle().fontSize;
    if (this.legendDefiner!.getPosition() === LegendPosition.BOTTOM) {
      items.push({
        key: KEYS.LEGEND,
        min: legendFontSize + this.minGap,
        extra: [Infinity],
      });
    }
    // Color-bar.
    if (this.colorBarDefiner!.getPosition() === ColorBarPosition.BOTTOM) {
      items.push({
        key: KEYS.COLOR_BAR,
        min: this.colorBarDefiner!.getHeight() + minGap,
        extra: [Infinity],
      });
    }
    // First line of ticks.
    const tickFirstLineIdx = items.length;
    // Even if tickTextLayout is defined, we don't assume all text items contain
    // only 1 line, nor do we assume no slanted text or alternation.
    if (optimisticHorizontalTicks && optimisticHorizontalTicks.numOfLines > 0) {
      items.push({
        key: KEYS.TICKS,
        min: tickFontSize + minGap,
        extra: [gapAboveTicks - minGap],
      });
    } else if (optimisticSlantedTicks) {
      items.push(getSlantedTicksItem());
    }
    // Rest of tick lines.
    const tickRestLinesBeginIdx = items.length;
    if (optimisticHorizontalTicks) {
      for (let i = 1; i < optimisticHorizontalTicks.numOfLines; i++) {
        items.push({
          key: KEYS.TICKS,
          min: tickFontSize + minGap,
          extra: [gapBetweenTickLines - minGap],
        });
      }
    }
    const tickRestLinesEndIdx = items.length;
    // Rest of title lines.
    for (let i = 1; i < optimisticTitleLayout.lines.length; i++) {
      items.push({
        key: KEYS.TITLE,
        min: titleFontSize + minGap,
        extra: [this.gapBetweenTitleLines - minGap],
      });
    }

    // Step 3 - calling the real-estate algorithm.
    let allocatedHeights = distributeRealEstateWithKeys(
      items,
      this.chartDef.height - this.chartDef.chartArea.bottom,
    );
    // Suppressing errors for ts-migration.
    //   TS2540: Cannot assign to 'allocatedHeights' because it is a read-only property.
    // @ts-ignore
    this.allocatedHeights = allocatedHeights;

    let actualTickLines: number[] = allocatedHeights[KEYS.TICKS] || [];
    let finalHorizontalTicks;
    if (optimisticHorizontalTicks) {
      finalHorizontalTicks = tickDiluter.calcFinalTickArrangement(
        optimisticHorizontalTicks.altCount,
        optimisticHorizontalTicks.skip,
        actualTickLines.length,
        0,
      );
      // If we tried horizontal without being forced to do it by the user, check
      // if the tick layout is acceptable, and if not, switch to slanted and
      // recalculate.
      if (
        this.slantedTickText == null &&
        finalHorizontalTicks.skip > skipThreshold
      ) {
        optimisticHorizontalTicks = null;
        finalHorizontalTicks = null;
        optimisticSlantedTicks =
          this.calcOptimisticSlantedTicks(measureFunction);
        items[tickFirstLineIdx] = getSlantedTicksItem();
        // The following line removes the tickRestLines items.
        items = arrayMultiSlice(
          items,
          0,
          tickRestLinesBeginIdx,
          tickRestLinesEndIdx,
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'undefined' is not assignable to parameter of type 'number'.
          // @ts-ignore
          undefined,
        );
        allocatedHeights = distributeRealEstateWithKeys(
          items,
          this.chartDef.height - this.chartDef.chartArea.bottom,
        );
      }
    }

    // Starting step 4 - processing information from step 3.
    this.heightOffset = this.chartDef.chartArea.bottom;

    // Calculate this.tickTextLayout.
    actualTickLines = allocatedHeights[KEYS.TICKS] || [];
    if (actualTickLines.length > 0) {
      // Make actualTickLines contain aggregated values.
      for (let i = 1; i < actualTickLines.length; i++) {
        actualTickLines[i] += actualTickLines[i - 1];
      }
      if (predefinedTickTextLayout && actualTickLines.length === 1) {
        const singleLineY = this.heightOffset + actualTickLines[0];
        for (let i = 0; i < this.tickTextLayout.length; i++) {
          const textBlock = this.tickTextLayout[i].textBlock;
          textBlock.anchor = textBlock.anchor || new Coordinate(0, 0);
          textBlock.anchor.y = singleLineY;
        }
      }
      if (optimisticHorizontalTicks) {
        if (finalHorizontalTicks == null) {
          throw new Error('finalHorizontalTicks is null');
        }
        this.tickTextLayout = map(
          finalHorizontalTicks.ticksInfo,
          (tickInfo, ti) => {
            const lines = map(tickInfo.layout!.lines, (line, i) => {
              return {
                x: 0,
                y: actualTickLines[tickInfo.lineIdx! + i],
                length: tickInfo.width,
                text: line,
              };
            });
            // Preserve any predefined alignment.
            const existingTextBlock =
              this.tickTextLayout &&
              this.tickTextLayout[ti] &&
              this.tickTextLayout[ti].textBlock;
            const paralAlign = existingTextBlock
              ? existingTextBlock.paralAlign
              : CENTER;
            const perpenAlign = existingTextBlock
              ? existingTextBlock.perpenAlign
              : END;
            return {
              dataValue: tickInfo.dataValue,
              isVisible: tickInfo.isVisible,
              optional: tickInfo.optional,
              textBlock: {
                text: tickInfo.text,
                textStyle: this.tickTextStyle,
                lines,
                paralAlign,
                perpenAlign,
                tooltip: tickInfo.layout!.needTooltip ? tickInfo.text : '',
                anchor: new Coordinate(tickInfo.coordinate, this.heightOffset),
                angle: 0,
              },
            };
          },
        );
      } else if (optimisticSlantedTicks) {
        const heightWithSpace = actualTickLines[0];
        const height = Math.min(
          heightWithSpace - minGap,
          optimisticSlantedTicks.maxHeight,
        );
        const top = this.heightOffset + heightWithSpace - height;
        this.tickTextLayout = this.calcFinalSlantedTicks(
          measureFunction,
          top,
          height,
          optimisticSlantedTicks.skip,
        );
      }
      this.heightOffset += peek(actualTickLines);
    }

    this.calcOtherLayout();
  }

  /**
   * Calculate other layout. This includes the axis title, legend, and colorbar.
   * TODO(dlaliberte) The legend and colorbar should be factored out of the axis
   * layout, and perhaps the axis title should be handled separately too.
   */
  calcOtherLayout() {
    this.calcTitleLayout();
    this.calcLegendLayout();
    this.calcColorBarLayout();
  }

  /** Calculate title layout. */
  private calcTitleLayout() {
    const measureFunction = this.chartDef.textMeasureFunction;
    const titleText =
      this.chartDef.axisTitlesPosition === InOutPosition.OUTSIDE
        ? this.title.text
        : '';

    const actualTitleLines = this.allocatedHeights[KEYS.TITLE] || [];
    if (actualTitleLines.length > 0) {
      const layout = textutils.calcTextLayout(
        measureFunction,
        titleText,
        this.title.textStyle,
        this.chartDef.chartArea.width,
        actualTitleLines.length,
      );
      this.title.tooltip = layout.needTooltip ? titleText : '';
      this.title.lines = [];

      for (let i = 0; i < actualTitleLines.length; i++) {
        this.heightOffset += actualTitleLines[i];
        this.title.perpenAlign = END;
        this.title.lines.push({
          x: this.chartDef.chartArea.left + this.chartDef.chartArea.width / 2,
          y: this.heightOffset,
          length: this.chartDef.chartArea.width,
          text: layout.lines[i],
        });
      }
    }
  }

  /** Calculate legend layout. */
  private calcLegendLayout() {
    // Calculate legend layout.
    const legendFontSize = this.legendDefiner!.getTextStyle().fontSize;
    const actualLegendLines = this.allocatedHeights[KEYS.LEGEND] || [];
    if (actualLegendLines.length > 0) {
      this.heightOffset += actualLegendLines[0];
      const legendArea = new Box(
        this.heightOffset - legendFontSize,
        this.chartDef.chartArea.right,
        this.heightOffset,
        this.chartDef.chartArea.left,
      );
      this.legendDefiner!.setArea(legendArea);
    }
  }

  /** Calculate color bar layout. */
  private calcColorBarLayout() {
    // Calculate color-bar layout.
    const actualColorBarLines = this.allocatedHeights[KEYS.COLOR_BAR] || [];
    if (actualColorBarLines.length > 0) {
      this.heightOffset += actualColorBarLines[0];
      const colorBarArea = new Box(
        this.heightOffset - this.colorBarDefiner!.getHeight(),
        this.chartDef.chartArea.right,
        this.heightOffset,
        this.chartDef.chartArea.left,
      );
      this.colorBarDefiner!.setArea(colorBarArea);
    }
  }

  /**
   * Calculates the optimistic (assuming space is unlimited) properties of
   * slanted tick labels.
   *
   * @param textMeasureFunction The function used for measuring text.
   * @return An object with the minimum number of vertical pixels needed to draw the tick labels, the maximum number of vertical pixels wanted, and the skip value - show every Nth label only.
   */
  private calcOptimisticSlantedTicks(
    textMeasureFunction: TextMeasureFunction,
  ): {minHeight: number; maxHeight: number; skip: number} {
    const tickTextStyle = this.tickTextStyle;
    const tickFontSize = tickTextStyle.fontSize;
    const sin = Math.sin(this.slantedTickTextAngle % Math.PI);
    const cos = Math.cos(this.slantedTickTextAngle % Math.PI);

    const getHeight = (tick: AnyDuringMigration) => {
      // This function computes the vertical space needed to draw the given
      // text, with the given angle and tickFontSize. This is the projection of
      // the text width on the Y axis, plus the projection of the text height
      // (fontSize) on the Y axis, because the text is bounded in a rotated
      // rectangle.
      const textWidth = textMeasureFunction(tick.text, tickTextStyle).width;
      const height = Math.abs(textWidth * sin) + Math.abs(tickFontSize * cos);
      return Math.ceil(height);
    };

    let skip = this.forceSkip;
    if (!skip) {
      // Automatically decides the best skip - the smallest possible without
      // tick labels overlapping each other. Only tickFontSize and the angle are
      // taken into account - the larger the angle, the smaller the chance that
      // the label overlaps with adjacent labels, and so smaller skip can be
      // used. The text content is ignored in this calculation, which means that
      // the calculated skip will work correctly on any text content, of any
      // width.
      if (this.ticks.length < 2) {
        skip = 1;
      } else {
        const tick0 = this.ticks[0].coordinate;
        const tick1 = this.ticks[1].coordinate;
        assert(tick0 != null && tick1 != null);
        const tickInterval = Math.abs(tick1! - tick0!);
        const minWidth = (tickFontSize + this.minGap) / sin;
        // The displayed tickInterval, which is skip * tickInterval, should be
        // larger than or equal to minWidth. Skip should be the minimal integer
        // that will cause the displayed tickInterval to fulfill the above
        // condition. Extracting skip from the formula yields the following
        // line.
        skip = Math.ceil(minWidth / tickInterval);
      }
    }
    let maxHeight = 0;
    for (let i = 0; i < this.ticks.length; i += skip) {
      maxHeight = Math.max(getHeight(this.ticks[i]), maxHeight);
    }
    const missingTextIndicatorHeight = getHeight({
      text: MSG_MISSING_TEXT_INDICATION,
    });
    // minHeight is the height needed by MISSING_TEXT_INDICATION, unless all
    // labels need even less than that, and so in this case the maximum of all
    // labels (which is smaller than missingTextIndicatorHeight) is used.
    const minHeight = Math.min(maxHeight, missingTextIndicatorHeight);

    return {minHeight, maxHeight, skip};
  }

  /**
   * Calculates the final (given the final allocated horizontal pixels) layout
   * of slanted tick labels.
   *
   * @param textMeasureFunction The function used for measuring text.
   * @param top The Y coordinate of the top edge of the area allocated for the slanted ticks.
   * @param height The Y size of the area allocated for the slanted ticks.
   * @param skip The skip value.
   * @return An array with the properties of each tick label.
   */
  private calcFinalSlantedTicks(
    textMeasureFunction: TextMeasureFunction,
    top: number,
    height: number,
    skip: number,
  ): TextItem[] {
    const tickFontSize = this.tickTextStyle.fontSize;
    const sin = Math.sin(this.slantedTickTextAngle % Math.PI);
    const cos = Math.cos(this.slantedTickTextAngle % Math.PI);

    const firstTickIdx = TickDiluter.getFirstTickIdx(
      0,
      this.ticks.length,
      skip,
      this.skipMode,
    );

    // The following computation is exactly the same as the getHeight inner
    // function inside the calcOptimisticSlantedTicks function above. The only
    // difference is that the Y axis projection is given (height) and we extract
    // the text width from the following formula.
    const textWidth = Math.floor((height - tickFontSize * cos) / sin);

    const result = [];
    // Shift down by axisMargin.
    top += this.axisMargin;
    for (let i = firstTickIdx; i < this.ticks.length; i += skip) {
      const tick = this.ticks[i];
      const textLayout = textutils.calcTextLayout(
        textMeasureFunction,
        tick.text,
        this.tickTextStyle,
        textWidth,
        1,
      );

      const switchAlign = this.slantedTickTextAngleDegrees > 180;
      const textBlock = {
        text: tick.text,
        textStyle: this.tickTextStyle,
        lines: [], // The angle is a negation of slantedTickTextAngleDegrees because the
        // option exposed to the user is measured counter-clockwise from the end
        // of the text, and needs to converted to clockwise degrees measured
        // from the beginning of the text.
        angle: -this.slantedTickTextAngleDegrees,
        paralAlign: switchAlign ? START : END,
        perpenAlign: CENTER,
        tooltip: textLayout.needTooltip ? tick.text : '',
        anchor: new Coordinate(tick.coordinate, top),
      };
      if (textLayout.lines.length > 0) {
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '{ x: number; y: number; length: number; text: string; }' is not assignable to parameter of type 'never'.
        // @ts-ignore
        textBlock.lines.push({
          x: 0,
          y: 0,
          length: textWidth,
          text: textLayout.lines[0],
        });
      }
      result.push({
        dataValue: tick.dataValue,
        isVisible: tick.isVisible,
        optional: tick.optional,
        textBlock,
      });
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type '{ dataValue: Value; isVisible: boolean; optional: boolean | undefined; textBlock: { text: string; textStyle: TextStyle; lines: never[]; angle: number; paralAlign: TextAlign; perpenAlign: TextAlign; tooltip: string;...
    // @ts-ignore
    return result;
  }

  calcInsideTextLayout() {
    if (this.index !== 0) {
      // TODO(dlaliberte): Implement this case.
      return;
    }
    const measureFunction = this.chartDef.textMeasureFunction;
    const tickFontSize = this.tickTextStyle.fontSize;

    // Optimistic tick text layout
    const tickDiluter = new TickDiluter(
      this.chartDef.width,
      this.ticks,
      this.firstTickIdx,
      this.maxTextLines,
      this.maxAlternation,
      this.forceSkip,
      this.skipMode,
      this.minTextSpacing,
      this.allowContainerBoundaryTextCutoff,
      (text, width, numOfLines) => {
        return textutils.calcTextLayout(
          measureFunction,
          text,
          this.tickTextStyle,
          width,
          numOfLines,
        );
      },
    );
    let optimisticHorizontalTicks;
    const tickInTextPosition = this.tickInTextPosition;
    if (this.tickTextPosition === InOutPosition.INSIDE) {
      optimisticHorizontalTicks = tickDiluter.calcOptimisticTickArrangement();
      // TODO(dlaliberte) Is this obsolete?
      // if (this.newTimeline) {
      //   // Force 'newTimeline' ticks to use text position 'high'.
      //   // TODO(dlaliberte): Fix 'low' position in date-tick-definer.
      //   tickInTextPosition = Options.HighLowPosition.HIGH;
      // }
    }

    // Some constants.
    const minGap = this.minGap;
    const gapFromValueAxis = Math.max(
      this.minGap,
      Math.round(tickFontSize / (2 * GOLDEN_RATIO)),
    );
    const gapFromCategoryAxis = Math.max(
      this.minGap,
      Math.round(tickFontSize / GOLDEN_RATIO),
    );
    const gapBelowTicks =
      this.type === AxisType.VALUE ? gapFromValueAxis : gapFromCategoryAxis;
    const gapBetweenTickLines = Math.max(
      minGap,
      Math.round(tickFontSize / (2 * GOLDEN_RATIO)),
    );
    let horizontalOffset: number;
    let paralAlign: AnyDuringMigration;

    if (this.type === AxisType.VALUE) {
      if (tickInTextPosition === HighLowPosition.HIGH) {
        paralAlign = START;
        horizontalOffset = gapFromValueAxis;
      } else {
        paralAlign = END;
        horizontalOffset = -gapFromValueAxis;
      }
    } else {
      paralAlign = CENTER;
      horizontalOffset = 0;
    }

    // Preparing the input for the real-estate algorithm.
    const items = [];
    // Top space. This ensures there's minimal space above the labels, so
    // they don't touch elements at the top of the chart area (titles/legend
    // in "labels inside" mode). This has highest priority.
    items.push({key: KEYS.TOP_SPACE, min: minGap, extra: [Infinity]});
    // Ticks.
    if (optimisticHorizontalTicks) {
      for (let i = 0; i < optimisticHorizontalTicks.numOfLines; i++) {
        const gap = i === 0 ? gapBelowTicks : gapBetweenTickLines;
        items.push({
          key: KEYS.TICKS,
          min: tickFontSize + minGap,
          extra: [gap - minGap],
        });
      }
    }

    // The space we allocate for the 'inside' axis ticks is half the height of
    // the chart area. The other half is allocated to the 'inside'
    // titles/legend.
    const availableRealEstate = Math.floor(this.chartDef.chartArea.height / 2);
    // Calling the real-estate algorithm.
    const allocatedHeights = distributeRealEstateWithKeys(
      items,
      availableRealEstate,
    );

    // Start processing the information.

    // Calculate this.tickTextLayout.
    const actualTickLines = allocatedHeights[KEYS.TICKS] || [];
    if (actualTickLines.length > 0 && optimisticHorizontalTicks != null) {
      // Make actualTickLines contain aggregated values.
      for (let i = 1; i < actualTickLines.length; i++) {
        actualTickLines[i] += actualTickLines[i - 1];
      }
      const finalHorizontalTicks = tickDiluter.calcFinalTickArrangement(
        optimisticHorizontalTicks.altCount,
        optimisticHorizontalTicks.skip,
        actualTickLines.length,
        0.5,
      );
      /* Note that 0.5 is more lenient than
                the 0 for outside ticks. This is because outside ticks have slanted
                text as fall-back where inside doesn't. */
      this.tickTextLayout = map(finalHorizontalTicks.ticksInfo, (tickInfo) => {
        const layoutLines = tickInfo.layout!.lines;
        // Start from the last line (which is closest to the axis).
        layoutLines.reverse();
        const lines = map(
          layoutLines,
          (line, i) => ({
            x: 0,
            y: -actualTickLines[tickInfo.lineIdx! + i],
            length: tickInfo.width,
            text: line,
          }),
          this,
        );
        return {
          dataValue: tickInfo.dataValue,
          isVisible: tickInfo.isVisible,
          optional: tickInfo.optional,
          textBlock: {
            text: tickInfo.text,
            textStyle: this.tickTextStyle,
            lines,
            paralAlign,
            perpenAlign: START,
            tooltip: tickInfo.layout!.needTooltip ? tickInfo.text : '',
            anchor: new Coordinate(
              horizontalOffset + tickInfo.coordinate!,
              this.chartDef.chartArea.bottom,
            ),
            angle: 0,
          },
        };
      });
    }
  }

  /** Returns true if there are no collisions between ticks. */
  areTicksClearOfCollisions(): boolean {
    if (this.tickTextPosition === InOutPosition.NONE) {
      return true;
    }

    // All ticks are optional if there are explicit ticks.
    const explicitTicks = this.options.inferValue('ticks', null);
    const allTicksOptional =
      explicitTicks != null && Array.isArray(explicitTicks);

    /** Rotate (pointX, pointY) around (originX, originY) by angle degrees. */
    const rotatePoint = (
      pointX: number,
      pointY: number,
      originX: number,
      originY: number,
      angle: number,
    ): {x: number; y: number} => {
      angle = (angle * Math.PI) / 180.0;
      pointX -= originX;
      pointY -= originY;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      return {
        x: cos * pointX - sin * pointY + originX,
        y: sin * pointX + cos * pointY + originY,
      };
    };

    /** Rotate all the textBlocks in place by the angle. */
    const rotateBlocks = (textBlocks: TextBlock[], angle: number) => {
      const firstBlockAnchor = textBlocks[0].anchor;
      forEach(textBlocks, (textBlock) => {
        const anchor = textBlock.anchor;
        const rotatedPoint = rotatePoint(
          anchor!.x,
          anchor!.y,
          firstBlockAnchor!.x,
          firstBlockAnchor!.y,
          angle,
        );
        textBlock.anchor = new Coordinate(rotatedPoint.x, rotatedPoint.y);
        textBlock.angle = 0;
      });
    };

    // Sort by non-optional first, so major ticks are added to bounding boxes.
    stableSort(this.tickTextLayout, (a, b) => {
      return a.optional && !b.optional ? 1 : b.optional && !a.optional ? -1 : 0;
    });

    // Clone the textBlocks, since we will be rotating them in-place.
    const textBlocks = map(this.tickTextLayout, (tickText) => {
      return clone(tickText.textBlock) as TextBlock;
    });

    // If ticks are angled, we need to rotate them to be parallel to hAxis
    // so we can test for intersections which only supports angle of 0.
    const angle = textBlocks.length > 0 ? textBlocks[0].angle : 0;
    if (angle) {
      if (angle > 0) {
        rotateBlocks(textBlocks, 360 - angle);
      } else {
        rotateBlocks(textBlocks, -angle);
      }
    }

    // Brute force check that every textBlock does not intersect any other.
    // Not ideal, but simple and not bad for a small number.
    const boundingBoxes: AnyDuringMigration[] = [];
    const optionalBoundingBoxes: AnyDuringMigration[] = [];
    return every(textBlocks, (textBlock, index) => {
      // Start with new bounding box of textBlock.
      const boundingBox = calcBoundingBox(textBlock);
      if (!boundingBox) {
        return true;
      }
      // The gap between tick lines is: Math.max(minGap,
      //   Math.round(tickFontSize / (2 * Constants.GOLDEN_RATIO)))
      // So we need to allow that at least, but 0 works well for now.
      const vMargin = 0;
      // For readability, we need a larger horizontal margin.
      const hMargin = Math.round(textBlock.textStyle.fontSize / 4);
      boundingBox.expand(new Box(vMargin, hMargin, vMargin, hMargin));
      const testBox = (box: AnyDuringMigration) => {
        return Box.intersects(boundingBox, box);
      };
      if (find(boundingBoxes, testBox)) {
        // Intersection found
        if (allTicksOptional || this.tickTextLayout[index].optional) {
          // Make this optional tick invisible, and proceed.
          this.tickTextLayout[index].isVisible = false;
          // Don't add intersecting optional ticks to boundingBoxes.
          return true;
        } else {
          // Non-optional collision = failure.
          return false;
        }
      }
      if (!allTicksOptional && !this.tickTextLayout[index].optional) {
        // Add non-intersecting non-optional ticks to bounding box.
        boundingBoxes.push(boundingBox);
      } else {
        // Check intersection of optional ticks with other optional ticks.
        if (find(optionalBoundingBoxes, testBox)) {
          // Optional ticks must not intersect other optional ticks.
          // Except it is ok when there are no non-optional ticks.
          // But hide them anyway.
          this.tickTextLayout[index].isVisible = false;
          return boundingBoxes.length === 0;
        } else {
          // Add non-intersecting optional ticks to optional bounding box.
          optionalBoundingBoxes.push(boundingBox);
        }
      }
      return true;
    });
  }

  getAxisDirectionalityParameters(): AxisDirectionalityParameters {
    const res = {
      reversed: this.direction === -1,
      screenStart: this.chartDef.chartArea.left,
      screenEnd: this.chartDef.chartArea.right,
      orientation: this.getOrientation(),
    };
    return res;
  }

  getOrientation(): Orientation {
    return Orientation.HORIZONTAL;
  }

  calcTicklinesOrigin(): {coordinate: number; direction: number} {
    return this.index === 0
      ? {coordinate: this.chartDef.chartArea.bottom, direction: -1}
      : {coordinate: this.chartDef.chartArea.top, direction: 1};
  }
}

interface AxisDirectionalityParameters {
  reversed: boolean;
  screenStart: number;
  screenEnd: number;
  orientation: Orientation;
}

enum KEYS {
  BOTTOM_SPACE = 'bottom-space',
  TOP_SPACE = 'top-space',
  TICKS = 'ticks',
  TITLE = 'title',
  LEGEND = 'legend',
  COLOR_BAR = 'colorBar',
}
