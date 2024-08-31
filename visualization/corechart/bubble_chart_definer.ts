/**
 * @fileoverview Manages most aspects of defining a bubble chart.
 * Should perhaps be a subclass of AxisChartDefiner, but as currently
 * designed, this class is used to augment the AxisChartDefiner.
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
  contains,
  forEach,
} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {
  hexToRgb,
  highContrast,
  rgbArrayToHex,
} from '@npm//@closure/color/color';
import {Range} from '@npm//@closure/math/range';
import {clone} from '@npm//@closure/object/object';
import {AxisDefiner} from '../../axis/axis_definer';
import {ColorBarDefiner} from '../../colorbar/color_bar_definer';
import {Scale} from '../../colorbar/scale';
import {DEFAULT_DISCRETE_COLORS} from '../../common/defaults';
import {SerieType} from '../../common/option_types';
import {Options as GvizOptions} from '../../common/options';
import {SizeScale} from '../../common/size_scale';
import {toStandardColor} from '../../common/theme';
import {extendRangeToInclude} from '../../common/util';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {Brush} from '../../graphics/brush';
import {TextMeasureFunction} from '../../text/text_measure_function';
import {TextStyle} from '../../text/text_style';
import {ChartDefinition} from './chart_definition';
import * as chartDefinitionTypes from './chart_definition_types';
import {ColorGroups} from './chart_definition_types';

/**
 * Responsible for defining properties for a bubble chart.
 * @unrestricted
 */
export class BubbleChartDefiner {
  /**
   * Default bubble opacity.
   * TODO(dlaliberte): Make it configurable in the options.
   */
  static DEFAULT_BUBBLE_OPACITY = 0.8;

  /**
   * Default bubble stroke color.
   * TODO(dlaliberte): Make it configurable in the options.
   */
  static DEFAULT_BUBBLE_STROKE = '#ccc';

  private readonly textStyle: TextStyle;

  private readonly useHighContrast: boolean;

  private readonly stroke: string;

  private readonly opacity: number;

  /** The list of candidate text colors for high contrast mode. */
  private readonly candidateTextColors: number[][] = [
    /* White */ [255, 255, 255],
    /* Grey 700 */ [97, 97, 97],
  ];

  private readonly nameColumnIdx = 0;

  private readonly xColumnIdx = 1;

  private readonly yColumnIdx = 2;

  private colorColumnIdx: number | null = 3;

  private sizeColumnIdx: number | null = 4;

  private xColumnLabel = '';

  private yColumnLabel = '';

  private colorColumnLabel = '';

  private sizeColumnLabel = '';

  /** The data type of the color column in the data table. */
  private colorDataType = '';

  /**
   * Colors for bubbles only in "discrete colors" mode (color column is of
   * type 'string'), or "single color" mode (no color column at all) where
   * only the first color in the array is used.
   */
  private readonly discreteColors: string[];

  /** Used if in "single color" mode (there's no color column in the data). */
  private readonly defaultColor: string;

  /**
   * A map of color groups. The key is the group name (as appears in the color
   * column) and the value is information about this color group. Relevant
   * only in "discrete colors" mode.
   */
  private colorGroups: ColorGroups | undefined;

  /**
   * An array that specifies the ordering of the color groups. Each element is
   * a group name (as appears in the color column, and the key of
   * this.colorGroups above).
   */
  private orderedColorGroups: string[] | undefined;

  /** Range of color values for bubble chart. */
  private colorRange: Range | null = null;

  /** Range of size values for bubble chart. */
  private sizeRange: Range | null = null;

  private colorScale: Scale | null = null;

  private sizeScale: SizeScale | null = null;

  /**
   * @param dataView The DataView.
   * @param options The options.
   * @param textMeasureFunction A function for measuring widths of text objects.
   * @param chartDef The chart definition.
   */
  constructor(
    private readonly dataView: AbstractDataTable,
    private readonly options: GvizOptions,
    private readonly textMeasureFunction: TextMeasureFunction,
    private readonly chartDef: ChartDefinition,
  ) {
    const defaultTextStyle = {
      fontName: chartDef.defaultFontName,
      fontSize: chartDef.defaultFontSize,
      auraColor: chartDef.insideLabelsAuraColor,
    };

    this.textStyle = this.options.inferTextStyleValue(
      'bubble.textStyle',
      defaultTextStyle,
    );

    this.useHighContrast = this.options.inferBooleanValue(
      'bubble.highContrast',
      false,
    );

    this.stroke = this.options.inferColorValue(
      'bubble.stroke',
      BubbleChartDefiner.DEFAULT_BUBBLE_STROKE,
    );

    this.opacity = this.options.inferRatioNumberValue(
      'bubble.opacity',
      BubbleChartDefiner.DEFAULT_BUBBLE_OPACITY,
    );

    this.discreteColors = this.options.inferValue(
      'colors',
      DEFAULT_DISCRETE_COLORS,
    ) as string[];

    this.defaultColor = toStandardColor(this.discreteColors[0]).color;

    this.init();
  }

  /**
   * Initializes internal data members (data table columns) and some chart
   * definition properties.
   */
  private init() {
    const chartDef = this.chartDef;
    const dataView = this.dataView;

    // TODO(dlaliberte): Move data format code to the data format library.

    const numOfCols = dataView.getNumberOfColumns();
    if (numOfCols < 3) {
      throw new Error('Data table should have at least 3 columns');
    }

    const validateColumnType = (
      columnIndex: number,
      shouldEqual: boolean,
      expectedTypes: string[],
    ) => {
      if (dataView.getNumberOfColumns() <= columnIndex) {
        return '';
      }
      const actualType = dataView.getColumnType(columnIndex);
      if (shouldEqual && !contains(expectedTypes, actualType)) {
        throw new Error(
          `Column ${columnIndex} must be of type ${expectedTypes.join('/')}`,
        );
      }
      if (!shouldEqual && contains(expectedTypes, actualType)) {
        throw new Error(
          `Column ${columnIndex} cannot be of type ${expectedTypes.join('/')}`,
        );
      }
      return actualType;
    };

    validateColumnType(this.nameColumnIdx, true, ['string']);
    const xDataType = validateColumnType(this.xColumnIdx, false, ['string']);
    const yDataType = validateColumnType(this.yColumnIdx, false, ['string']);
    this.xColumnLabel = dataView.getColumnLabel(this.xColumnIdx);
    this.yColumnLabel = dataView.getColumnLabel(this.yColumnIdx);

    if (
      typeof this.colorColumnIdx === 'number' &&
      this.colorColumnIdx < numOfCols
    ) {
      this.colorDataType = validateColumnType(this.colorColumnIdx, true, [
        'number',
        'string',
      ]);
      if (this.colorDataType === 'string') {
        this.colorGroups = {};
        this.orderedColorGroups = [];
      }
      this.colorColumnLabel = dataView.getColumnLabel(this.colorColumnIdx);
    } else {
      this.colorColumnIdx = null;
    }

    let sortBySize = false;
    if (
      typeof this.sizeColumnIdx === 'number' &&
      this.sizeColumnIdx < numOfCols
    ) {
      validateColumnType(this.sizeColumnIdx, true, ['number']);
      this.sizeColumnLabel = dataView.getColumnLabel(this.sizeColumnIdx);
      sortBySize = this.options.inferBooleanValue('sortBubblesBySize', true);
    } else {
      this.sizeColumnIdx = null;
    }

    chartDef.categories = [];
    chartDef.dataTableToCategoryMap = {};
    for (let i = 0; i < dataView.getNumberOfRows(); i++) {
      const dataTableIdx = dataView.getTableRowIndex(i);
      chartDef.dataTableToCategoryMap[dataTableIdx] = i;
    }
    chartDef.series = [
      {
        type: SerieType.BUBBLES,
        enableInteractivity: this.options.inferBooleanValue(
          ['series.0.enableInteractivity', 'enableInteractivity'],
          true,
        ),
        visiblePoints: true,
        showTooltip: true,
        sortBySize,
        points: [], // Used for discrete colors:
        colorGroups: this.colorGroups,
        orderedColorGroups: this.orderedColorGroups,
      } as unknown as chartDefinitionTypes.SerieDefinition,
    ];
    chartDef.domainDataType = xDataType;
    chartDef.targetAxisToDataType = [yDataType];
    chartDef.serieTypeCount = {};
    chartDef.serieTypeCount[SerieType.BUBBLES] = 1;
    chartDef.legendEntries = []; // Inhibits legend creation.
  }

  /**
   * Returns whether the bubble chart is in continuous color mode - the color
   * column type is 'number'.
   * @return See above.
   */
  isContinuousColorMode(): boolean {
    return this.colorDataType === 'number';
  }

  /**
   * Find the values closest to zero for all value scales for bubble charts.
   * This is used to be able to map negative values on a log scale.
   * @param hAxis The horizontal axis definer.
   * @param vAxis The vertical axis definer.
   */
  findValuesClosestToZero(hAxis: AxisDefiner, vAxis: AxisDefiner) {
    const dataView = this.dataView;

    for (let i = 0; i < dataView.getNumberOfRows(); i++) {
      const xValue = dataView.getValue(i, this.xColumnIdx);
      const yValue = dataView.getValue(i, this.yColumnIdx);
      const xNumeric = hAxis.valueScale!.valueToUnscaledNumber(xValue);
      const yNumeric = vAxis.valueScale!.valueToUnscaledNumber(yValue);
      if (xNumeric != null) {
        hAxis.markClosestValueToZero(xNumeric);
      }
      if (yNumeric != null) {
        vAxis.markClosestValueToZero(yNumeric);
      }
      // TODO(dlaliberte): Size is not taken care of here.
    }
  }

  /**
   * Calculates the layout of all the bubbles in the chart.
   * @param hAxis The horizontal axis definer.
   * @param vAxis The vertical axis definer.
   * @param colorBarDefiner The color-bar definer.
   */
  calcBubblesLayout(
    hAxis: AxisDefiner,
    vAxis: AxisDefiner,
    colorBarDefiner: ColorBarDefiner | null,
  ) {
    for (let i = 0; i < this.dataView.getNumberOfRows(); i++) {
      const point = this.calcBubbleLayout(hAxis, vAxis, i);
      this.chartDef.series[0].points.push(point);
    }

    if (this.colorDataType === 'number') {
      this.colorScale = Scale.create(this.options, this.colorRange);
      colorBarDefiner!.setScale(this.colorScale);
    } else if (this.colorDataType === 'string') {
      for (let i = 0; i < this.orderedColorGroups!.length; i++) {
        const colorGroupName = this.orderedColorGroups![i];
        const colorGroup = this.colorGroups![colorGroupName];
        if (colorGroup.visibleInLegend) {
          this.chartDef.legendEntries.push({
            index: i,
            id: colorGroupName,
            text: colorGroup.labelInLegend,
            brush: new Brush({fill: colorGroup.color}),
            isVisible: true,
          });
        }
      }
    }

    this.sizeScale = SizeScale.create(this.options, this.sizeRange);

    // Now that we've set the scales, we can readjust the text style for high
    // contrast.
    if (this.useHighContrast) {
      forEach(
        this.chartDef.series[0].points,
        this.adjustDatumTextStyleForHighContrast,
        this,
      );
    }
  }

  /**
   * Adjusts the textStyle of a datum for High Contrast mode.
   * Must be called after (or at the end of) calcBubbleLayout (relies on scales
   * existing).
   */
  private adjustDatumTextStyleForHighContrast(
    datum: chartDefinitionTypes.DatumDefinition | null,
  ) {
    if (!datum) {
      return;
    }
    const realColorRgb = hexToRgb(this.getColorForPoint(datum.nonScaled));
    const textStyle = clone(datum.textStyle) as TextStyle;
    const candidateTextColor = rgbArrayToHex(
      highContrast(realColorRgb, this.candidateTextColors),
    );
    textStyle.color = candidateTextColor;
    datum.textStyle = textStyle;
  }

  /**
   * Calculates the layout of a single bubble in the chart.
   * @param hAxis The horizontal axis definer.
   * @param vAxis The vertical axis definer.
   * @param idx The data table row index of the bubble.
   * @return A non-scaled representation of the bubble. It can later be passed to scaleBubble for scaling.
   */
  private calcBubbleLayout(
    hAxis: AxisDefiner,
    vAxis: AxisDefiner,
    idx: number,
  ): chartDefinitionTypes.DatumDefinition | null {
    const dataView = this.dataView;

    // The 'id' is used for identity matching done by animation. The 'name' is
    // the displayed text.
    const id = dataView.getValue(idx, this.nameColumnIdx);
    const name = dataView.getFormattedValue(idx, this.nameColumnIdx);
    const xValue = dataView.getValue(idx, this.xColumnIdx);
    const yValue = dataView.getValue(idx, this.yColumnIdx);
    let color = null;
    if (this.colorColumnIdx !== null) {
      color = dataView.getValue(idx, this.colorColumnIdx);
      if (color == null) {
        return null;
      }
    }
    let size = null;
    if (this.sizeColumnIdx !== null) {
      size = dataView.getValue(idx, this.sizeColumnIdx) as number;
      if (size == null) {
        return null;
      }
    }

    const nameLength = this.textMeasureFunction(name, this.textStyle).width;

    if (this.colorDataType === 'number') {
      this.colorRange = extendRangeToInclude(this.colorRange, color as number);
    } else if (this.colorDataType === 'string') {
      // Rename and cast the color to a color group name.
      const colorGroupName = color as string;
      let colorGroup = this.colorGroups![colorGroupName];
      if (!colorGroup) {
        const index = this.orderedColorGroups!.length;
        const optionPrefix = `series.${colorGroupName}.`;
        const rawColor = this.options.inferColorValue(
          `${optionPrefix}color`,
          this.discreteColors[index % this.discreteColors.length],
        );
        const realColor = toStandardColor(rawColor);
        const visibleInLegend = this.options.inferBooleanValue(
          `${optionPrefix}visibleInLegend`,
          true,
        );
        const labelInLegend = this.options.inferStringValue(
          `${optionPrefix}labelInLegend`,
          colorGroupName,
        );
        colorGroup = {
          color: realColor.color,
          visibleInLegend,
          labelInLegend,
        };
        this.colorGroups![colorGroupName] = colorGroup;
        this.orderedColorGroups!.push(colorGroupName);
      }
    }
    this.sizeRange = extendRangeToInclude(this.sizeRange, size);

    const xNumeric = hAxis.valueScale!.valueToNumber(xValue);
    const yNumeric = vAxis.valueScale!.valueToNumber(yValue);
    if (xNumeric === null || yNumeric === null) {
      return null;
    }

    const shouldExtendAxesRange =
      hAxis.isValueInViewWindow(xNumeric) &&
      vAxis.isValueInViewWindow(yNumeric);
    if (shouldExtendAxesRange) {
      // Extend the X range to include the X value only if the Y value is within
      // the visible range limits (if there are such limits) of the Y axis. And
      // the opposite for extending the Y range.
      hAxis.extendRangeToIncludeNumber(xNumeric);
      vAxis.extendRangeToIncludeNumber(yNumeric);
    }

    const tooltipText = this.calcTooltipText(idx, name);

    // TODO(dlaliberte): Avoid this cast.
    const result: chartDefinitionTypes.DatumDefinition = {
      id,
      text: name,
      textLength: nameLength,
      textStyle: this.textStyle, // May be changed if useHighContrast is set.
      tooltipText,
      nonScaled: {x: xNumeric, y: yNumeric, color, size},
    } as chartDefinitionTypes.DatumDefinition;
    return result;
  }

  /**
   * Calculates the tooltip text for a given bubble.
   * @param idx The data table row index of the bubble.
   * @param name The bubble name.
   * @return A structure that contains the title and the text for the each line of the tooltip.
   */
  private calcTooltipText(
    idx: number,
    name: string,
  ): chartDefinitionTypes.TooltipText {
    const dataView = this.dataView;
    const labels = DEFAULT_COLUMN_LABELS;

    const x = dataView.getFormattedValue(idx, this.xColumnIdx);
    const y = dataView.getFormattedValue(idx, this.yColumnIdx);
    const lines = [
      {title: this.xColumnLabel || labels.MSG_X, value: x},
      {title: this.yColumnLabel || labels.MSG_Y, value: y},
    ];

    if (this.colorColumnIdx !== null) {
      const color = dataView.getFormattedValue(idx, this.colorColumnIdx);
      lines.push({
        title: this.colorColumnLabel || labels.MSG_COLOR,
        value: color,
      });
    }
    if (this.sizeColumnIdx !== null) {
      const size = dataView.getFormattedValue(idx, this.sizeColumnIdx);
      lines.push({
        title: this.sizeColumnLabel || labels.MSG_SIZE,
        value: size,
      });
    }

    return {title: name, lines} as chartDefinitionTypes.TooltipText;
  }

  /** Calculates the color for a point based on the type and scale. */
  private getColorForPoint(
    nonScaledPoint: chartDefinitionTypes.NonScaledDatumDefinition,
  ): string {
    let color;
    if (this.colorDataType === 'number') {
      assert(this.colorScale != null);
      color = this.colorScale!.getColorFor(nonScaledPoint.color as number);
    } else if (this.colorDataType === 'string') {
      color = this.colorGroups![nonScaledPoint.color as string].color;
    } else {
      color = this.defaultColor;
    }
    return color;
  }

  /**
   * Transforms a non scaled bubble to a properly scaled bubble. Must be called
   * only after calcBubblesLayout.
   * @param hAxis The horizontal axis definer.
   * @param vAxis The vertical axis definer.
   * @param nonScaledPoint The bubble to scale.
   * @return The scaled point.
   */
  scaleBubble(
    hAxis: AxisDefiner,
    vAxis: AxisDefiner,
    nonScaledPoint: chartDefinitionTypes.NonScaledDatumDefinition,
  ): chartDefinitionTypes.ScaledDatumDefinition {
    const x = hAxis.calcPositionForNumericValue(nonScaledPoint.x);
    const y = vAxis.calcPositionForNumericValue(nonScaledPoint.y);

    const color = this.getColorForPoint(nonScaledPoint);
    const brush = new Brush({
      fill: color,
      fillOpacity: this.opacity,
      stroke: this.stroke,
    });

    assert(this.sizeScale != null);
    const radius = this.sizeScale!.getRadiusFor(nonScaledPoint.size);

    return {
      x,
      y,
      brush,
      radius,
      sensitivityAreaRadius: radius,
    } as chartDefinitionTypes.ScaledDatumDefinition;
  }
}

/** Default bubble column labels.  Should be short. */

const DEFAULT_COLUMN_LABELS = {
  /** @desc Identifier */
  MSG_ID: goog.getMsg('ID'),
  /** @desc X coordinate */
  MSG_X: goog.getMsg('X'),
  /** @desc Y coordinate */
  MSG_Y: goog.getMsg('Y'),
  /** @desc Color value or name */
  MSG_COLOR: goog.getMsg('Color'),
  /** @desc Size value */
  MSG_SIZE: goog.getMsg('Size'),
};
