/**
 * @fileoverview Vertical axis definition.
 * Calculates the measures needed to draw a vertical axis.
 * Inherits from AxisDefiner, including this.ticks.
 * Result returned by side effect on this.tickTextLayout.
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
} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {Box} from '@npm//@closure/math/box';
import {ColorBarDefiner} from '../colorbar/color_bar_definer';
import {GOLDEN_RATIO} from '../common/constants';
import {MSG_MISSING_TEXT_INDICATION} from '../common/messages';
import {
  AxisType,
  BoundUnboundPosition,
  Direction,
  HighLowPosition,
  InOutPosition,
  ViewWindowMode,
} from '../common/option_types';
import {OptionPath, Options} from '../common/options';
import {distributeRealEstateWithKeys} from '../common/util';
import {LegendDefiner} from '../legend/legend_definer';
import {Coordinate} from '../math/coordinate';
import {TextAlign} from '../text/text_align';
import {TextBlock, calcBoundingBox} from '../text/text_block_object';
import {calcTextLayout} from '../text/text_utils';
import {
  AxisDefinition,
  TextItem,
} from '../visualization/corechart/axis_definition';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {AxisDefiner} from './axis_definer';
import {Orientation} from './text_measurer';

// tslint:disable:strict-prop-init-fix
// tslint:disable:ban-types
// tslint:disable:ban-ts-suppressions

/**
 * Returns whether two boxes would intersect with additional padding.
 * Copied from closure/math/box.js
 *
 * @param  a A Box.
 * @param  b A second Box.
 * @param  padding The additional padding.
 * @return  Whether the boxes intersect.
 */
function intersectsWithPadding(a: Box, b: Box, padding: number): boolean {
  return (
    a.left <= b.right + padding &&
    b.left <= a.right + padding &&
    a.top <= b.bottom + padding &&
    b.top <= a.bottom + padding
  );
}

/**
 * Vertical axis definer.
 */
export class VerticalAxisDefiner extends AxisDefiner {
  // In case of a VALUE vertical axis, a +1 specified by the user (in
  // options.vAxis.direction) actually means going against the pixels
  // direction, while this.direction is relative to the pixels direction,
  // so we reverse that value.
  // Note that this.direction has been initialized by the parent, and
  // we reverse the direction, so it must only be done once.
  override direction: AnyDuringMigration;

  /** The maximum number of lines for each tick label. */
  // (b/109816955): remove '!', see go/strict-prop-init-fix.
  maxTextLines!: number;
  // Not enough space for ticks.
  override tickTextLayout: AnyDuringMigration;

  /**
   * Constructor for VerticalAxisDefiner.
   * @param chartDef The chart definition.
   * @param options The options.
   * @param optionPath For the axis options.
   * @param index The axis index within the vertical axes (default is 0).
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
      concat([`vAxes.${index}`, 'vAxis'], optionPath),
      index,
      defaultType,
      defaultViewWindowMode,
    );

    if (this.type === AxisType.VALUE) {
      // In case of a VALUE vertical axis, a +1 specified by the user (in
      // options.vAxis.direction) actually means going against the pixels
      // direction, while this.direction is relative to the pixels direction,
      // so we reverse that value.
      // Note that this.direction has been initialized by the parent, and
      // we reverse the direction, so it must only be done once.
      this.direction = -this.direction as Direction;
    }

    // Note, after this point, use this.options instead of the options arg
    // because the parent class constructs an options.view.
    this.processOptions();
  }

  /** Process the options, possibly more than one time. */
  processOptions() {
    const options = this.options;

    this.maxTextLines = options.inferNonNegativeNumberValue('maxTextLines', 3);
  }

  getAxisName() {
    return `vAxis#${this.index}`;
  }

  /**
   * Calculates the layout of the vertical axis ticks and title.
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
      chartArea.height,
      this.direction === 1 ? chartArea.top : chartArea.bottom,
      legendDefiner,
      colorBarDefiner,
    );
  }

  /**
   * Calculates the maximal tick text width for this axis.
   *
   * @return the maximal text width
   */
  getMaximalTickTextWidth(): number {
    const measureFunction = this.chartDef.textMeasureFunction;
    return this.ticks.reduce((prev, curr) => {
      return Math.max(
        prev,
        measureFunction(curr.text, this.tickTextStyle).width,
      );
    }, 0);
  }

  /**
   * Calculates the minimal tick text width for this axis.
   *
   * @return the minimal text width
   */
  getMinimalTickTextWidth(): number {
    const measureFunction = this.chartDef.textMeasureFunction;
    const maximalTickTextWidth = this.getMaximalTickTextWidth();
    // TODO(dlaliberte) Remove use of MISSING_TEXT_INDICATION.
    const missingItemsText = MSG_MISSING_TEXT_INDICATION;
    const missingItemsTextWidth = measureFunction(
      missingItemsText,
      this.tickTextStyle,
    ).width;
    // Don't provide the tick labels space that won't be enough for ellipsis,
    // unless all labels require less than that.
    return Math.min(missingItemsTextWidth, maximalTickTextWidth);
  }

  /** Sets this.tickTextLayout */
  calcOutsideTextLayout() {
    const measureFunction = this.chartDef.textMeasureFunction;
    const tickFontSize = this.tickTextStyle.fontSize;
    const titleFontSize = this.title.textStyle.fontSize;

    const titleText =
      this.chartDef.axisTitlesPosition === InOutPosition.OUTSIDE
        ? this.title.text
        : '';
    const optimisticTitleLayout = calcTextLayout(
      measureFunction,
      titleText,
      this.title.textStyle,
      this.chartDef.chartArea.height,
      Infinity,
    );

    const minGap = this.minGap;
    const maximalTickTextWidth = this.getMaximalTickTextWidth();
    const minimalTickTextWidth = this.getMinimalTickTextWidth();

    const items = [];
    // Right space (closest to the axis). This has highest priority.
    if (this.tickTextPosition === InOutPosition.OUTSIDE) {
      items.push({
        key: KEYS.RIGHT_SPACE,
        min: minGap,
        extra: [tickFontSize - minGap],
      });
    } else {
      items.push({key: KEYS.RIGHT_SPACE, min: 0, extra: [Infinity]});
    }
    // First line of title.
    if (optimisticTitleLayout.lines.length > 0) {
      items.push({
        key: KEYS.TITLE,
        min: titleFontSize + minGap,
        extra: [Infinity],
      });
    }
    // Ticks.
    if (this.tickTextPosition === InOutPosition.OUTSIDE) {
      items.push({
        key: KEYS.TICKS,
        min: minimalTickTextWidth + minGap,
        max: maximalTickTextWidth + minGap,
        extra: [Infinity],
      });
    }
    // Rest of title lines.
    for (let i = 1; i < optimisticTitleLayout.lines.length; i++) {
      items.push({
        key: KEYS.TITLE,
        min: titleFontSize + minGap,
        extra: [this.gapBetweenTitleLines - minGap],
      });
    }

    const chartArea = this.chartDef.chartArea;
    // Calling the real-estate algorithm.
    const allocatedWidths = distributeRealEstateWithKeys(
      items,
      this.index === 0 ? chartArea.left : this.chartDef.width - chartArea.right,
    );

    let x = this.index === 0 ? 0 : this.chartDef.width;

    // Calculate title layout.
    const actualTitleLines = allocatedWidths[KEYS.TITLE] || [];
    if (actualTitleLines.length > 0) {
      const layout = calcTextLayout(
        measureFunction,
        titleText,
        this.title.textStyle,
        chartArea.height,
        actualTitleLines.length,
      );
      if (this.index === 1) {
        // Reverse the lines on right side so they come out in order.
        layout.lines.reverse();
      }
      this.title.tooltip = layout.needTooltip ? titleText : '';
      this.title.lines = [];

      for (let i = 0; i < actualTitleLines.length; i++) {
        x += actualTitleLines[i] * (this.index === 0 ? 1 : -1);
        // The screen axis system grows Y values downwards, and I want the text
        // upwards, so I use minus 90 degrees.
        this.title.angle = -90;
        this.title.perpenAlign =
          this.index === 0 ? TextAlign.END : TextAlign.START;
        this.title.lines.push({
          x,
          y: chartArea.top + chartArea.height / 2,
          length: chartArea.height,
          text: layout.lines[i],
        });
      }
    }

    // Calculate this.tickTextLayout.
    if (this.tickTextPosition === InOutPosition.OUTSIDE) {
      const tickWidth = allocatedWidths[KEYS.TICKS][0] || 0;
      x += tickWidth * (this.index === 0 ? 1 : -1);
      // 'tickWidth' is now the space allocated for the ticks, plus the
      // whitespace to the left of it. The boxes that actually contain the text
      // (tickTextWidth) need not be as large if the maximalTickTextWidth fits
      // nicely within this space ("nicely" means with minGap whitespace to the
      // left). If maximalTickTextWidth doesn't fit nicely, use as much as
      // possible, which is all of it, excluding minGap whitespace to the left.
      const tickTextWidth = Math.min(maximalTickTextWidth, tickWidth - minGap);
      if (tickTextWidth < minimalTickTextWidth) {
        // Not enough space for ticks.
        this.tickTextLayout = [];
      } else {
        this.tickTextLayout = this.ticks.map((tick, tickIndex) => {
          const paralAlign = this.index === 0 ? TextAlign.END : TextAlign.START;

          let perpenAlign = TextAlign.CENTER;
          // If the text is bound inside the chart area, adjusts the vertical
          // alignment for the top-most and bottom-most labels.
          if (this.tickOutTextPosition === BoundUnboundPosition.BOUND) {
            if (tickIndex === 0) {
              perpenAlign =
                this.direction === 1 ? TextAlign.START : TextAlign.END;
            }
            if (tickIndex === this.ticks.length - 1) {
              perpenAlign =
                this.direction === 1 ? TextAlign.END : TextAlign.START;
            }
          }

          return this.getTickTextLayout(
            tick,
            x,
            tickTextWidth,
            paralAlign,
            perpenAlign,
            0,
          );
        });
      }
    }
  }

  /** Returns true if there are no collisions between ticks. */
  areTicksClearOfCollisions() {
    if (this.tickTextPosition === InOutPosition.NONE) {
      return true;
    }

    const textBlocks = this.tickTextLayout.map((tickText: TextItem) => {
      return tickText.textBlock;
    });

    // All ticks are optional if there are explicit ticks.
    const explicitTicks = this.options.inferValue('ticks', null);
    const allTicksOptional =
      explicitTicks != null && Array.isArray(explicitTicks);

    // Brute force check that every textBlock does not intersect any other.
    // Not ideal, but simple and not bad for a small number.
    const boundingBoxes: AnyDuringMigration[] = [];
    const optionalBoundingBoxes: AnyDuringMigration[] = [];
    return every(textBlocks, (textBlock, index) => {
      const boundingBox = calcBoundingBox(textBlock);
      // Same size margin as in axis-chart-definer.
      const margin = textBlock.textStyle.fontSize / 8;
      if (!boundingBox) {
        return true;
      }
      const testBox = (box: AnyDuringMigration) => {
        return intersectsWithPadding(boundingBox, box, margin);
      };
      if (find(boundingBoxes, testBox)) {
        // Intersection found
        if (allTicksOptional || this.tickTextLayout[index].optional) {
          // Make this tick invisible, and proceed.
          this.tickTextLayout[index].isVisible = false;
          // Don't add to boundingBoxes.
          return true;
        } else {
          return false;
        }
      }
      if (!allTicksOptional && !this.tickTextLayout[index].optional) {
        boundingBoxes.push(boundingBox);
      } else {
        // Check intersection with other optional ticks.
        if (
          find(optionalBoundingBoxes, (box) => {
            return intersectsWithPadding(boundingBox, box, margin);
          })
        ) {
          // Optional ticks must not intersect other optional ticks.
          // Except it is ok when there are no non-optional ticks.
          // But hide them anyway.
          this.tickTextLayout[index].isVisible = false;
          return boundingBoxes.length === 0;
        } else {
          optionalBoundingBoxes.push(boundingBox);
        }
      }
      return true;
    });
  }

  calcInsideTextLayout() {
    const measureFunction = this.chartDef.textMeasureFunction;
    const tickFontSize = this.tickTextStyle.fontSize;

    const minGap = this.minGap;
    const gapFromValueAxis = Math.max(
      this.minGap,
      Math.round(tickFontSize / (2 * GOLDEN_RATIO)),
    );
    const gapFromCategoryAxis = Math.max(
      this.minGap,
      Math.round(tickFontSize / GOLDEN_RATIO),
    );
    const horizontalOffset =
      this.type === AxisType.VALUE ? gapFromValueAxis : gapFromCategoryAxis;
    let perpenAlign: AnyDuringMigration;
    let verticalOffset: AnyDuringMigration;

    if (this.type === AxisType.VALUE) {
      if (this.tickInTextPosition === HighLowPosition.HIGH) {
        perpenAlign = TextAlign.END;
        verticalOffset = gapFromValueAxis;
      } else {
        perpenAlign = TextAlign.START;
        verticalOffset = -gapFromValueAxis;
      }
    } else {
      perpenAlign = TextAlign.CENTER;
      verticalOffset = 0;
    }
    const maximalTickTextWidth = this.ticks.reduce((prev, curr) => {
      return Math.max(
        prev,
        measureFunction(curr.text, this.tickTextStyle).width,
      );
    }, 0);
    const missingItemsText = MSG_MISSING_TEXT_INDICATION;
    const missingItemsTextWidth = measureFunction(
      missingItemsText,
      this.tickTextStyle,
    ).width;
    // Don't provide the tick labels space that won't be enough for ellipsis,
    // unless all labels require less than that.
    const minimalTickTextWidth = Math.min(
      missingItemsTextWidth,
      maximalTickTextWidth,
    );

    const items = [];
    // Right space (farthest from the axis). This has highest priority.
    items.push({key: KEYS.RIGHT_SPACE, min: minGap, extra: [Infinity]});
    // Ticks.
    if (this.tickTextPosition === InOutPosition.INSIDE) {
      items.push({
        key: KEYS.TICKS,
        min: minimalTickTextWidth + minGap,
        max: maximalTickTextWidth + horizontalOffset,
        extra: [],
      });
    }

    // Calling the real-estate algorithm.
    const allocatedWidths = distributeRealEstateWithKeys(
      items,
      this.chartDef.chartArea.width,
    ); // Allow 100% of width

    let x =
      this.index === 0
        ? this.chartDef.chartArea.left
        : this.chartDef.chartArea.right;

    // Calculate this.tickTextLayout.
    if (this.tickTextPosition === InOutPosition.INSIDE) {
      const tickWidth = allocatedWidths[KEYS.TICKS][0] || 0;
      const tickTextWidth = Math.min(maximalTickTextWidth, tickWidth - minGap);
      x += (tickWidth - tickTextWidth) * (this.index === 0 ? 1 : -1);
      this.tickTextLayout = this.ticks.map((tick) => {
        const paralAlign = this.index === 0 ? TextAlign.START : TextAlign.END;
        return this.getTickTextLayout(
          tick,
          x,
          tickTextWidth,
          paralAlign,
          perpenAlign,
          verticalOffset,
        );
      });
    }
  }

  /**
   * Get the text layout of a tick on the axis.
   *
   * @param tick The tick.
   * @param x The x coordinate of the tick text.
   * @param tickTextWidth The width of tick text.
   * @param paralAlign The parallel text alignment.
   * @param perpenAlign The perpendicular alignment.
   * @param verticalOffset Offset to the tick's y coordinate.
   * @return The tick text layout.
   */
  private getTickTextLayout(
    tick: TextItem,
    x: number,
    tickTextWidth: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    verticalOffset: number,
  ): TextItem {
    const layout = calcTextLayout(
      this.chartDef.textMeasureFunction,
      tick.text,
      this.tickTextStyle,
      tickTextWidth,
      this.maxTextLines,
    );
    const tickFontSize = this.tickTextStyle.fontSize;
    const gapBetweenTickLines = Math.max(
      2,
      Math.round(tickFontSize / (2 * GOLDEN_RATIO)),
    );
    const numLines = layout.lines.length;
    const lines = layout.lines.map((line, i) => {
      // For one tick line, yOffset should be 0.
      // For two lines, yOffset should be + and - 0.5 * (font size + gap).
      const yOffset =
        (tickFontSize + gapBetweenTickLines) * (i - (numLines - 1) / 2);
      return {x: 0, y: yOffset, length: tickTextWidth, text: line};
    });
    assert(tick.coordinate != null);
    // Suppressing errors for ts-migration.
    //   TS2739: Type '{ dataValue: Value; isVisible: boolean; optional: boolean | undefined; text: string; textBlock: TextBlock; }' is missing the following properties from type 'TextItem': coordinate, lineIdx, needTooltip, width, layou...
    // @ts-ignore
    return {
      dataValue: tick.dataValue,
      isVisible: tick.isVisible,
      optional: tick.optional,
      text: tick.text,
      textBlock: {
        text: tick.text,
        textStyle: this.tickTextStyle,
        boxStyle: null,
        lines,
        paralAlign,
        perpenAlign,
        tooltip: layout.needTooltip ? tick.text : '',
        anchor: new Coordinate(x, tick.coordinate! - verticalOffset),
        angle: 0,
      } as TextBlock,
    };
  }

  // Suppressing errors for ts-migration.
  //   TS2416: Property 'getAxisDirectionalityParameters' in type 'VerticalAxisDefiner' is not assignable to the same property in base type 'AxisDefiner'.
  // @ts-ignore
  getAxisDirectionalityParameters() {
    const res = {};
// Suppressing errors for ts-migration.
//   TS2339: Property 'reversed' does not exist on type '{}'.
// @ts-ignore
    res.reversed = this.direction === -1;
// Suppressing errors for ts-migration.
//   TS2339: Property 'screenStart' does not exist on type '{}'.
// @ts-ignore
    res.screenStart = this.chartDef.chartArea.top;
// Suppressing errors for ts-migration.
//   TS2339: Property 'screenEnd' does not exist on type '{}'.
// @ts-ignore
    res.screenEnd = this.chartDef.chartArea.bottom;
// Suppressing errors for ts-migration.
//   TS2339: Property 'orientation' does not exist on type '{}'.
// @ts-ignore
    res.orientation = this.getOrientation();
    return res;
  }

  getOrientation() {
    return Orientation.VERTICAL;
  }

  calcTicklinesOrigin() {
    return this.index === 0
      ? {coordinate: this.chartDef.chartArea.left, direction: 1}
      : {coordinate: this.chartDef.chartArea.right, direction: -1};
  }
}

enum KEYS {
  RIGHT_SPACE = 'right-space',
  TICKS = 'ticks',
  TITLE = 'title',
}
