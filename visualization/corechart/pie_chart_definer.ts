/**
 * @fileoverview A builder of ChartDefinition objects.
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

import {assert, fail} from 'google3/javascript/typescript/contrib/assert';
import {extend} from '@npm//@closure/array/array';
import {Box} from '@npm//@closure/math/box';
import * as googMath from '@npm//@closure/math/math';
import {Range} from '@npm//@closure/math/range';
import {Size} from '@npm//@closure/math/size';
import {Vec2} from '@npm//@closure/math/vec2';
import {isEmpty} from '@npm//@closure/object/object';
import {GOLDEN_RATIO} from '../../common/constants';
import * as defaults from '../../common/defaults';
import {MSG_OTHER} from '../../common/messages';
import {
  FocusTarget,
  LegendPosition,
  PieSliceText,
  PieValueText,
} from '../../common/option_types';
import {Options} from '../../common/options';
import {
  RelativeColor,
  StandardColor,
  toStandardColor,
} from '../../common/theme';
import {distributeRealEstate} from '../../common/util';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {Value} from '../../data/types';
import {NumberFormat} from '../../format/numberformat';
import {Brush} from '../../graphics/brush';
import * as chartarea from '../../graphics/chart_area';
import * as labeledLegendDefiner from '../../legend/labeled_legend_definer';
import {
  positionBoxInEllipticSlice,
  sumAll,
  vectorOnEllipse,
} from '../../math/vector_utils';
import {TextMeasureFunction} from '../../text/text_measure_function';
import {TextStyle} from '../../text/text_style';
import {
  BrushesDefinition,
  PixelTransformation,
  SerieDefinition,
  TooltipText,
} from '../../visualization/corechart/chart_definition_types';
import {ChartDefiner} from './chart_definer';
import {ColumnRole} from './serie_columns';

const {
  DEFAULT_DIFF_NEW_DATA_OPACITY,
  DEFAULT_DIFF_OLD_DATA_OPACITY,
  DEFAULT_DISCRETE_COLORS,
  DEFAULT_PIE_DIFF_INNER_BORDER_RATIO,
  DEFAULT_PIE_DIFF_INNER_OUTER_RADIUS_RATIO,
  DEFAULT_PIE_DIFF_IS_OLD_DATA_IN_CENTER,
} = defaults;

interface PieDiff {
  pie: {innerOuterRadiusRatio: number; isOldDataInCenter: boolean};
}

interface PieChartAreaLayout {
  pie: {
    center: Vec2;
    radiusX: number;
    radiusY: number;
    pieHeight: number;
    layers: Array<{radiusX: number; radiusY: number}>;
  };
  legend: Box | null;
}

interface LegendEntryInfo {
  preferredOrigin: number;
  originRange: Range;
  originYToVec: (radians: number) => googMath.Vec2;
  rightEntriesInfo: LegendEntryInfo[];
  leftEntriesInfo: LegendEntryInfo[];
  aboveText: string;
  belowText: string;
  importance: number;
  index: number;
}

// tslint:disable:ban-types
// tslint:disable:ban-ts-suppressions

/**
 * Fills the given chart definition with pie-specific stuff.
 * @unrestricted
 */
export class PieChartDefiner extends ChartDefiner {
  private readonly colors: Array<AnyDuringMigration | string> | null;

  private readonly startAngle: number;

  private readonly reverseDirection: boolean;

  private readonly reverseCategories: boolean;

  /**
   * The formatter for percent values. We show the percentages with 1 digit of
   * precision.
   */
  private readonly percentFormatter: NumberFormat;

  /** The formatter for values. */
  private readonly valueFormatter: NumberFormat;

  /**
   * @param dataTable The table whose data should be drawn.
   * @param options The options controlling how the chart will look and behave.
   * @param textMeasureFunction A function for measuring width and height of text objects.
   * @param width Chart's width.
   * @param height Chart's height.
   */
  constructor(
    dataTable: AbstractDataTable,
    options: Options,
    textMeasureFunction: TextMeasureFunction,
    width: number,
    height: number,
  ) {
    super(dataTable, options, textMeasureFunction, width, height);

    this.colors = options.inferValue('colors', DEFAULT_DISCRETE_COLORS);

    this.startAngle = options.inferNumberValue('pieStartAngle', 0);

    this.reverseDirection = options.inferNumberValue('direction', 1) < 0;

    this.reverseCategories = options.inferBooleanValue(
      'reverseCategories',
      false,
    );

    let percentFormatOptions = options.inferObjectValue(
      'pieSlicePercentFormat',
    );
    if (isEmpty(percentFormatOptions)) {
      percentFormatOptions = {'pattern': '#.#%'};
    }

    this.percentFormatter = new NumberFormat(percentFormatOptions);

    let valueFormatOptions = options.inferObjectValue('pieSliceValueFormat');
    if (isEmpty(valueFormatOptions)) {
      valueFormatOptions = {'pattern': 'decimal'};
    }
    this.valueFormatter = new NumberFormat(valueFormatOptions);
  }

  override initSteps() {
    // The pie chart focus is per slice (series).
    return [
      () => {
        this.chartDef.focusTarget = new Set([FocusTarget.SERIES]);

        // Infers if in diff mode and suppresses is3D flag when in that
        // mode.
        this.chartDef.isDiff = this.options.inferBooleanValue('isDiff');
        this.chartDef.is3D &&= !this.chartDef.isDiff;

        // Infers options specific for diff mode.
        if (this.chartDef.isDiff) {
          const pieDiff = (this.chartDef.diff || {}) as PieDiff;
          this.chartDef.diff = pieDiff;
          pieDiff.pie = {
            isOldDataInCenter: this.options.inferValue(
              'diff.oldData.inCenter',
              DEFAULT_PIE_DIFF_IS_OLD_DATA_IN_CENTER,
            ) as boolean,
            innerOuterRadiusRatio: this.options.inferValue(
              'diff.innerCircle.radiusFactor',
              DEFAULT_PIE_DIFF_INNER_OUTER_RADIUS_RATIO,
            ) as number,
          };
        }

        // Validate the data.
        for (let i = 0; i < this.dataView.getNumberOfRows(); i++) {
          const value = this.dataView.getValue(i, 1);
          if (typeof value === 'number' && value < 0) {
            throw new Error('Negative values are invalid for a pie chart.');
          }
        }
      },

      () => super.initSteps(),
    ];
  }

  /** @return See above. */
  getDefaultLegendPosition(): LegendPosition {
    return LegendPosition.RIGHT;
  }

  getDefaultColorBarPosition() {
    return null;
  }

  /** The public function of this class, that does all the work. */
  calcLayout() {
    return [
      () => {
        const chartDef = this.getChartDefinition();

        if (this.dataView.getColumnType(0) !== 'string') {
          throw new Error(
            'Pie chart should have a first column of type string',
          );
        }

        // Split area between pie and legend.
        const areaLayout = this.calcPieChartAreaLayout();
        // Calculate the pie itself.
        this.calcSeries(areaLayout);

        // Set the legend area.
        const legendPosition = this.legendDefiner!.getPosition();
        if (areaLayout.legend) {
          this.legendDefiner!.setArea(areaLayout.legend);
        } else if (legendPosition === LegendPosition.BOTTOM) {
          this.legendDefiner!.setArea(this.calcBottomLegendArea());
        } else if (legendPosition === LegendPosition.LABELED) {
          this.calcLabeledLegend(
            chartDef.chartArea,
            areaLayout,
            this.legendDefiner!.getTextStyle(),
          );
        }
      },
    ];
  }

  /**
   * Creates a set of brushes for the given chart type and colors (either via
   * index or explicitly specifying the colors).
   * The brush has 4 versions: normal, dark, light and legend.
   *
   * @param color The color object.
   * @param opacity Optional alpha channel value (0,1).
   * @return A set of brushes: 'normal', 'dark', 'light' and 'legend'.
   */
  private createBrushes(
    color: StandardColor,
    opacity?: number,
  ): BrushesDefinition {
    const chartDef = this.chartDef;

    const brushes: BrushesDefinition = {} as BrushesDefinition;
    const borderColor = this.options.inferColorValue('pieSliceBorderColor', '');
    const borderStrokeWidth = 1;
    const fill = color.color;
    const darkFill = color.dark;
    const lightFill = color.light;

    let stroke;
    let darkStroke;
    let lightStroke;
    if (chartDef.is3D) {
      stroke = fill;
      darkStroke = darkFill;
      lightStroke = lightFill;
    } else {
      stroke = borderColor;
      darkStroke = borderColor;
      lightStroke = borderColor;
    }

    brushes.normal = new Brush({
      stroke,
      strokeWidth: borderStrokeWidth,
      fill,
      fillOpacity: opacity != null ? opacity : 1,
    });
    brushes.dark = new Brush({
      stroke: darkStroke,
      strokeWidth: borderStrokeWidth,
      fill: darkFill,
      fillOpacity: opacity != null ? opacity : 1,
    });
    brushes.light = new Brush({
      stroke: lightStroke,
      strokeWidth: borderStrokeWidth,
      fill: lightFill,
      fillOpacity: opacity != null ? opacity : 1,
    });

    return brushes;
  }

  /**
   * Calculates the legend area in case of bottom legend.
   *
   * @return The legend area or null if there is no room for the legend.
   */
  private calcBottomLegendArea(): Box | null {
    const chartDef = this.chartDef;

    const availableHeight = chartDef.height - chartDef.chartArea.bottom;
    const legendFontSize = this.legendDefiner!.getTextStyle().fontSize;
    const minGap = 2; // No less than 2 pixels distance between items.

    const items = [];
    // Bottom space. This has highest priority.
    items.push({min: minGap, extra: [Infinity]});
    // Legend.
    const legendIdx = items.length;
    items.push({min: legendFontSize + minGap, extra: [Infinity]});

    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type '{ min: number; extra: number[]; }[]' is not assignable to parameter of type 'RealEstateItem[]'.
    // @ts-ignore
    const allocatedHeights = distributeRealEstate(items, availableHeight);

    if (allocatedHeights!.length > legendIdx) {
      const y = chartDef.chartArea.bottom + allocatedHeights![legendIdx]!;
      return new Box(
        y - legendFontSize,
        chartDef.chartArea.right,
        y,
        chartDef.chartArea.left,
      );
    }

    return null;
  }

  /**
   * A function for calculating the pie layout and also the legend layout (when
   * it is vertical). In the vertical legend case, the pie's bounding box would
   * be of width 1 / GR from the total chart area width and the legend will
   * occupy the rest except for a small margin of 1em * GR. In other cases
   * (horizontal or no legend), the pie's bounding box is the chart area.
   *
   * @return The layout of the chart area.
   */
  private calcPieChartAreaLayout(): PieChartAreaLayout {
    const chartDef = this.chartDef;

    const chartArea = chartDef.chartArea;
    const legendPosition = this.legendDefiner!.getPosition();
    let pieBoundingBox = null;
    let legend = null;

    // The legend's width and gap to the pie if it was vertical
    const gapBetweenLegendAndPie = Math.round(
      chartDef.defaultFontSize * GOLDEN_RATIO,
    );
    const legendWidth = Math.round(
      chartArea.width * (1 - 1 / GOLDEN_RATIO) - gapBetweenLegendAndPie,
    );

    // We now compute the pie and legend's bounding box.
    if (legendPosition === LegendPosition.LEFT) {
      legend = new Box(
        chartArea.top,
        chartArea.left + legendWidth,
        chartArea.bottom,
        chartArea.left,
      );
      pieBoundingBox = new Box(
        chartArea.top,
        chartArea.right,
        chartArea.bottom,
        legend.right + gapBetweenLegendAndPie,
      );
    } else if (legendPosition === LegendPosition.RIGHT) {
      legend = new Box(
        chartArea.top,
        chartArea.right,
        chartArea.bottom,
        chartArea.right - legendWidth,
      );
      pieBoundingBox = new Box(
        chartArea.top,
        legend.left - gapBetweenLegendAndPie,
        chartArea.bottom,
        chartArea.left,
      );
    } else if (legendPosition === LegendPosition.BOTTOM_VERT) {
      // We use the golden ratio between the size of the pie and legend.
      const height =
        (chartArea.bottom - chartArea.top - gapBetweenLegendAndPie) *
        (1 / GOLDEN_RATIO);
      pieBoundingBox = new Box(
        chartArea.top,
        chartArea.right,
        chartArea.top + height,
        chartArea.left,
      );
      legend = new Box(
        pieBoundingBox.bottom + gapBetweenLegendAndPie,
        chartArea.right,
        chartArea.bottom,
        chartArea.left,
      );
    } else {
      // In such a case, the legened's layout would be computed elsewhere.
      pieBoundingBox = new Box(
        chartArea.top,
        chartArea.right,
        chartArea.bottom,
        chartArea.left,
      );
    }

    // We compute the pie's center, radiuses and height given the bounding box
    // and whether the pie is 3D.
    let pieHeight = 0;
    const pieSideLength = Math.min(
      pieBoundingBox.right - pieBoundingBox.left,
      pieBoundingBox.bottom - pieBoundingBox.top,
    );
    const radiusX = Math.floor(pieSideLength / 2);
    let radiusY = radiusX;
    const centerX = Math.round(
      (pieBoundingBox.right + pieBoundingBox.left) / 2,
    );
    let centerY = Math.round((pieBoundingBox.bottom + pieBoundingBox.top) / 2);

    if (chartDef.is3D) {
      // TODO(amitw): Maybe allow the user to choose the pie height and angle in
      // which we see the pie.
      radiusY = radiusY * 0.8;
      pieHeight = radiusX / 5;
      centerY -= pieHeight / 2;
    }

    // Returns radius for diff layers, with old and new data.
    if (chartDef.isDiff) {
      const pieDiff = chartDef.diff as PieDiff;
      const innerRadii = {
        radiusX: radiusX * pieDiff.pie.innerOuterRadiusRatio,
        radiusY: radiusY * pieDiff.pie.innerOuterRadiusRatio,
      };
      const outerRadii = {radiusX, radiusY};
      return {
        pie: {
          center: new Vec2(centerX, centerY),
          radiusX: outerRadii.radiusX,
          radiusY: outerRadii.radiusY,
          pieHeight,
          layers: pieDiff.pie.isOldDataInCenter
            ? [innerRadii, outerRadii]
            : [outerRadii, innerRadii],
        },
        legend,
      };
    }

    // Pie with single layer of slices.
    return {
      pie: {
        center: new Vec2(centerX, centerY),
        radiusX,
        radiusY,
        pieHeight,
        layers: [{radiusX, radiusY}],
      },
      legend,
    };
  }

  /**
   * Calculates the layout of all pie series in the chart while extracting pie
   * related values from the data.
   * Adds a 'pie' property to chart definition and adds the following members to
   * it:
   * <ul>
   *   <li>center: The center of the pie (Vec2).
   *   <li>radiusX: The x radius of the pie.
   *   <li>radiusY: The y radius of the pie (same as radiusX in 2D pie).
   *   <li>pieHeight: The height of the chart in pixels (0 for 2D pie).
   *   <li>layers: Array of slices with the following members:
   *   <ul>
   *     <li>radiusX: The x radius of the layer.
   *     <li>radiusY: The y radius of the layer (same as radiusX in 2D pie).
   *     <li>otherSlice: The 'other' slice (same format as a normal slice in the
   *                     series array).
   *   </ul>
   * </ul>
   * In addition, initializes the 'series' property with a list of series
   * (slices in our case), each with the following members:
   * <ul>
   *   <li>isVisible: True only when this slice is visible (not too small).
   *       When False, some of the other fields may be missing.
   *   <li>isWholeCircle: A flag indicating this slice is the only slice, i.e. a
   *       whole circle.
   *   <li>fromDegrees: A number between 0 and 360 indicating where slice starts
   *       (counting clockwise starting from the vector pointing straight up)
   *   <li>toDegrees: A number between 0 and 360 indicating where slice ends
   *       (counting clockwise starting from the vector pointing straight up)
   *   <li>fromPixel: A Vector2D object specifying a pixel along the
   *       circumference of the pie at which the slice starts.
   *   <li>toPixel: A Vector2D object specifying a pixel along the
   *       circumference of the pie at which the slice ends.
   *   <li>side3D: An object with information on how to draw the side of the
   *       slice when it is 3D if needed. Has the fields fromDegrees, toDegrees,
   *       fromPixel and toPixel same as the slice's. These values may differ
   *       from the original values as we start at degree 90 and end at 270.
   *   <li>isTextVisible: A flag indicating this slice has text and text should
   *       be drawn on or beside the slice.
   *   <li>text: The text that should be written on or beside the slice.
   *   <li>textStyle: The slice's text style.
   *   <li>textBoxTopLeft: A Vec2 object specifying the top left
   *       corner of the text box size.
   *   <li>textBoxSize: A Size object specifying the size of the
   *       textBox.
   *   <li>title: The title of the series of this slice.
   *   <li>label: The label of the slice, format is: "name (value)".
   *   <li>index: The index of the slice.
   *   <li>dataTableIdx: The index of data table row corresponding to the slice.
   *   <li>value: The actual value of the slice (not in percentage).
   *   <li>formattedValue: The formatted value.
   *   <li>percentage: The percentages string of this slice, e.g. '15.3%'.
   *   <li>brushes: Brushes used for plotting this slice.
   *   <li>brush: Default brush used for plotting this slice in standard state.
   *   <li>offset: A Vec2 defining how much the slice if offset from
   *       its position due to selection.
   *   <li>drawInnerFrom Whether in 3D mode this slice should have its 'from'
   *       inner side drawn.
   *   <li>drawInnerTo Whether in 3D mode this slice should have its 'to'
   *       inner side drawn.
   * </ul>
   * And finally, initializes the legendEntries property of the chart definition
   * with the entries for the slices.
   * @param chartLayout The layout of the chart area.
   */
  private calcSeries(chartLayout: PieChartAreaLayout) {
    const chartDef = this.chartDef;
    const dataView = this.dataView;
    const center = chartLayout.pie.center;
    const pieHeight = chartLayout.pie.pieHeight;
    const rowsCount = dataView.getNumberOfRows();

    const residueColor = toStandardColor(
      this.options.inferColorValue('pieResidueSliceColor', ''),
    );
    const residueBrushes = this.createBrushes(residueColor, 1.0);
    const pieSliceTextStyle = this.options.inferTextStyleValue(
      'pieSliceTextStyle',
      {fontName: chartDef.defaultFontName, fontSize: chartDef.defaultFontSize},
    );
    // Never shows text in slice when in diff mode.
    const pieSliceTextOption = chartDef.isDiff
      ? PieSliceText.NONE
      : PieSliceText.PERCENTAGE;
    const pieSliceText = this.options.inferStringValue(
      'pieSliceText',
      pieSliceTextOption,
      PieSliceText,
    ) as PieSliceText;
    const tooltipText = this.options.inferStringValue(
      'tooltip.text',
      PieValueText.BOTH,
      PieValueText,
    ) as PieValueText;
    const sliceVisibilityThreshold = this.options.inferRatioNumberValue(
      'sliceVisibilityThreshold',
      1 / 720,
    );
    const displayTinySlicesInLegend = this.options.inferBooleanValue(
      'displayTinySlicesInLegend',
    );
    const pieResidueSliceLabel = this.options.inferStringValue(
      'pieResidueSliceLabel',
      MSG_OTHER,
    );
    const defaultHole = this.options.inferRatioNumberValue('pieHole', 0);

    chartDef.series = [];
    chartDef.legendEntries = [];

    let alpha: AnyDuringMigration;
    let holeAtLayer;
    let isLayerVisibleInLegend;

    if (!chartDef.isDiff) {
      holeAtLayer = [0];
      isLayerVisibleInLegend = [true];
      alpha = [1];
    } else {
      const pieDiff = chartDef.diff as PieDiff;
      // Handles two layers: old and new data columns.
      assert(dataView.getColumnRole(1) === ColumnRole.DIFF_OLD_DATA);
      const innerBorderRatio = this.options.inferValue(
        'diff.innerCircle.borderFactor',
        DEFAULT_PIE_DIFF_INNER_BORDER_RATIO,
      ) as number;
      const innerHole = 0;
      const outerHole =
        pieDiff.pie.innerOuterRadiusRatio * (1 + innerBorderRatio);
      // Old data, new data.
      holeAtLayer = pieDiff.pie.isOldDataInCenter
        ? [innerHole, outerHole]
        : [outerHole, innerHole];
      // Only the layer with new data appears in legend.
      isLayerVisibleInLegend = [false, true];
      alpha = [
        this.options.inferValue(
          'diff.oldData.opacity',
          DEFAULT_DIFF_OLD_DATA_OPACITY,
        ) as number,
        this.options.inferValue(
          'diff.newData.opacity',
          DEFAULT_DIFF_NEW_DATA_OPACITY,
        ) as number,
      ];
    }

    chartDef.pie = {
      center,
      pieHeight,
      radiusX: chartLayout.pie.radiusX,
      radiusY: chartLayout.pie.radiusY,
      layers: [],
    };

    // This should always be called with sliceIndex corresponding to a slice in
    // the last layer, so that the twin slice (from old data in diff mode) has
    // already been created and can be referenced here.
    const createSliceTooltip = (
      sliceIndex: AnyDuringMigration,
      layersCount: AnyDuringMigration,
      tooltipContent: AnyDuringMigration,
      isHtml: AnyDuringMigration,
    ) => {
      assert(layersCount === 1 || sliceIndex >= rowsCount);

      const newDataSlice = chartDef.series[sliceIndex];

      if (layersCount === 1) {
        // Single layer.
        if (tooltipContent != null) {
          // Suppressing errors for ts-migration.
          //   TS2739: Type '{ hasHtmlContent: boolean; hasCustomContent: true; content: any; }' is missing the following properties from type 'TooltipText': categoryTitle, serieTitle, title, lines
          // @ts-ignore
          newDataSlice.tooltipText = {
            hasHtmlContent: !!isHtml,
            hasCustomContent: true,
            content: tooltipContent,
          };
        } else {
          this.createSliceTooltip(newDataSlice, tooltipText, newDataSlice);
        }
      } else {
        // Two layers: create tooltips with info for old and new data.
        const oldDataSlice = chartDef.series[sliceIndex - rowsCount];

        this.createSliceTooltip(
          newDataSlice,
          tooltipText,
          newDataSlice,
          oldDataSlice,
        );
        this.createSliceTooltip(
          oldDataSlice,
          tooltipText,
          newDataSlice,
          oldDataSlice,
        );
      }
    };

    const createTooltipForOtherSlice = (layersCount: number) => {
      let newDataSlice = chartDef.pie.layers[layersCount - 1].otherSlice;
      let oldDataSlice = chartDef.pie.layers[0].otherSlice;

      if (layersCount === 1 && newDataSlice) {
        // Single layer: create tooltip when otherSlice exists.
        this.createSliceTooltip(newDataSlice, tooltipText, newDataSlice);
      } else if (layersCount > 1) {
        if (newDataSlice && oldDataSlice) {
          // otherSlice exists for both new and old data: create for both.
          this.createSliceTooltip(
            newDataSlice,
            tooltipText,
            newDataSlice,
            oldDataSlice,
          );
          this.createSliceTooltip(
            oldDataSlice,
            tooltipText,
            newDataSlice,
            oldDataSlice,
          );
        } else if (newDataSlice) {
          // otherSlice exists for new data: create tooltip only for new data,
          // with values 0 for old data.
          oldDataSlice = {
            percentage: '0',
            formattedValue: '0',
          } as SerieDefinition;
          this.createSliceTooltip(
            newDataSlice,
            tooltipText,
            newDataSlice,
            oldDataSlice,
          );
        } else if (oldDataSlice) {
          // otherSlice exists for old data: create tooltip only for old data,
          // with values 0 for new data.
          newDataSlice = {
            percentage: '0',
            formattedValue: '0',
          } as SerieDefinition;
          this.createSliceTooltip(
            oldDataSlice,
            tooltipText,
            newDataSlice,
            oldDataSlice,
          );
        }
      }
    };

    const createLegendEntry = (
      id: AnyDuringMigration,
      text: AnyDuringMigration,
      color: AnyDuringMigration,
      sliceIndex: AnyDuringMigration,
      visibleInLegend: boolean,
    ) => {
      if (chartDef.isDiff) {
        // Creates legend entry with a gradient for the colored box.
        chartDef.legendEntries.push({
          id,
          text,
          brush: new Brush({
            gradient: {
              color1: color,
              color2: color,
              opacity1: alpha[0],
              opacity2: alpha[1],
              x1: '100%',
              y1: '0%',
              x2: '0%',
              y2: '0%',
              useObjectBoundingBoxUnits: true,
              sharpTransition: true,
            },
          }),
          index: sliceIndex,
          isVisible: visibleInLegend,
        });
      } else {
        chartDef.legendEntries.push({
          id,
          text,
          brush: new Brush({fill: color}),
          index: sliceIndex,
          isVisible: visibleInLegend,
        });
      }
    };

    const pieLayers = chartDef.pie.layers;
    const layoutLayers = chartLayout.pie.layers;
    const layersCount = layoutLayers.length;
    let sliceIndex = 0;
    for (let layerIndex = 0; layerIndex < layersCount; ++layerIndex) {
      const isDiffNewData = layerIndex === 1;
      const layer = layoutLayers[layerIndex];
      let otherSlice = null;
      const radiusX = layer.radiusX;
      const radiusY = layer.radiusY;
      const layerHole = holeAtLayer[layerIndex];
      const isLayerInLegend = isLayerVisibleInLegend[layerIndex];
      let sumOfNonVisibleValues = 0;
      let partialSumOfVisibleValues = 0;

      // Sums up values so we can tell what size is each slice.
      let sumOfAllValues = 0;
      for (let rowIndex = 0; rowIndex < rowsCount; rowIndex++) {
        sumOfAllValues += Number(
          dataView.getValue(rowIndex, layerIndex + 1) || 0,
        );
      }

      // Creates slices.
      let layerSliceIndex = 0;
      for (; layerSliceIndex < rowsCount; ++layerSliceIndex) {
        const rowIndex = this.reverseCategories
          ? rowsCount - layerSliceIndex - 1
          : layerSliceIndex;
        const hasAssociatedTooltip =
          layersCount === 1 &&
          dataView.getNumberOfColumns() > layerIndex + 2 &&
          dataView.getColumnRole(layerIndex + 2) === 'tooltip' &&
          dataView.getColumnType(layerIndex + 2) === 'string';
        const doesTooltipHaveHtmlContent =
          chartDef.isHtmlTooltip &&
          hasAssociatedTooltip &&
          !!(
            dataView.getProperty(rowIndex, layerIndex + 2, 'html') ||
            dataView.getColumnProperty(layerIndex + 2, 'html')
          );
        const value = Number(dataView.getValue(rowIndex, layerIndex + 1) || 0);
        const formattedValue = dataView.getFormattedValue(
          rowIndex,
          layerIndex + 1,
          this.valueFormatter,
        );
        const id = dataView.getValue(rowIndex, 0);
        const title = dataView.getFormattedValue(rowIndex, 0);
        const from =
          sumOfAllValues === 0 ? 0 : partialSumOfVisibleValues / sumOfAllValues;
        const to = sumOfAllValues === 0 ? 0 : from + value / sumOfAllValues;
        const isVisible = to - from >= sliceVisibilityThreshold;
        const tooltipContent =
          (hasAssociatedTooltip &&
            dataView.getStringValue(rowIndex, layerIndex + 2)) ||
          null;
        if (isVisible) {
          partialSumOfVisibleValues += value;
        } else {
          sumOfNonVisibleValues += value;
        }
        const optionPath = `slices.${sliceIndex}`;
        const rawColor = this.options.inferValue(
          `${optionPath}.color`,
          this.colors![layerSliceIndex % this.colors!.length],
        ) as RelativeColor | string;
        const color = toStandardColor(rawColor);
        const sliceBrushes = this.createBrushes(color, alpha[layerIndex]);
        const offset = this.options.inferNumberValue(`${optionPath}.offset`, 0);
        const hole =
          this.options.inferRatioNumberValue(
            `${optionPath}.hole`,
            defaultHole,
          ) + layerHole;
        const sliceTextStyle = this.options.inferTextStyleValue(
          `${optionPath}.textStyle`,
          pieSliceTextStyle,
        );
        const sliceEnableInteractivity = this.options.inferBooleanValue(
          [`${optionPath}.enableInteractivity`, 'enableInteractivity'],
          true,
        );
        const slice = this.calcSliceLayout(
          sliceIndex,
          rowIndex,
          from,
          to,
          value,
          formattedValue,
          title,
          isVisible,
          center,
          radiusX,
          radiusY,
          hole,
          pieHeight,
          offset,
          pieSliceText,
          sliceTextStyle,
          color,
          sliceBrushes,
          isDiffNewData,
          sliceEnableInteractivity,
        );
        chartDef.series.push(slice);
        const visibleInLegend = this.options.inferBooleanValue(
          `${optionPath}.visibleInLegend`,
          isLayerInLegend && (isVisible || displayTinySlicesInLegend),
        );
        createLegendEntry(id, title, color.color, sliceIndex, visibleInLegend);

        // Creates tooltip when in last layer.
        if (layerIndex === layersCount - 1) {
          createSliceTooltip(
            sliceIndex,
            layersCount,
            tooltipContent,
            doesTooltipHaveHtmlContent,
          );
        }

        sliceIndex += 1;
      }
      // Add an additional 'other' slice for a bundle slice of all values
      // smaller than the visibility threshold. Only draw it if it is large
      // enough.
      if (sumOfNonVisibleValues > 0) {
        const from =
          1 -
          (sumOfAllValues === 0 ? 0 : sumOfNonVisibleValues / sumOfAllValues);
        const to = 1;
        const value = sumOfNonVisibleValues;
        const formattedValue = this.valueFormatter.formatValue(
          Number(sumOfNonVisibleValues),
        );
        const title = pieResidueSliceLabel;
        otherSlice = this.calcSliceLayout(
          -1,
          -1,
          from,
          to,
          value,
          formattedValue,
          title,
          true,
          center,
          radiusX,
          radiusY,
          defaultHole + layerHole,
          pieHeight,
          0,
          pieSliceText,
          pieSliceTextStyle,
          residueColor,
          residueBrushes,
          isDiffNewData,
          // Interactivity is always disabled for the 'Other' slice.
          false,
        );
        // Display the 'other' legend entry only if tiny values do not already
        // have their own legend entry.
        if (isLayerInLegend && !displayTinySlicesInLegend) {
          createLegendEntry('', title, residueColor.color, -1, true);
        }
      }

      // Stores current layer properties.
      pieLayers.push({
        radiusX,
        radiusY,
        // Suppressing errors for ts-migration.
        //   TS2322: Type 'SerieDefinition | null' is not assignable to type 'SerieDefinition'.
        // @ts-ignore
        otherSlice,
      });

      // (Possibly) creates tooltip for otherSlice when in last layer.
      if (layerIndex === layersCount - 1) {
        createTooltipForOtherSlice(layersCount);
      }
    }
  }

  /**
   * Calculates the text representing a slice value.
   * @param slice The slice object, containing both the value and the percentage, as strings.
   * @param valueTextType The value text selector.
   * @return The value text.
   */
  private static calcSliceValueText(
    slice: SerieDefinition,
    valueTextType: PieValueText,
  ): string {
    switch (valueTextType) {
      case PieValueText.NONE:
        return '';
      case PieValueText.PERCENTAGE:
        return slice.percentage;
      case PieValueText.VALUE:
        return slice.formattedValue;
      case PieValueText.BOTH:
        return slice.formattedValue + ' (' + slice.percentage + ')';
      default:
        fail(`Invalid PieValueText: ${valueTextType}`);
    }
  }

  /**
   * Calculates the layout of a single slice, given a structure describing it.
   * @param sliceIndex The index of the series this slice represents.
   *     The 'other' slice is represented by -1.
   * @param dataIndex The index of the data this slice represents (tipically row index in datatable). The 'other' slice is represented by -1.
   * @param from Where along the full circle the slice starts (a fraction between 0 and 1).
   * @param to Where along the full circle the slice ends (a fraction between 0 and 1).
   * @param value The slice's original value.
   * @param formattedValue The slice's formatted value.
   * @param title The title of the series this slice represents.
   * @param isVisible Whether this slice is visible.
   * @param center The center of the pie.
   * @param radiusX The x radius of the slice.
   * @param radiusY The y radius of the slice.
   * @param hole The ratio of the donut hole.
   * @param height The height of the pie (0 for 2D pie).
   * @param offset A factor by which to move the slice out of the pie.
   * @param pieSliceText An enum indicating what is the text that should appear on each slice.
   * @param textStyle The text style.
   * @param color The color of the slice.
   * @param brushes The brushes object describing the colors and strokes of this slice.
   * @param isDiffNewData Whether slice corresponds to new data in a diff chart.
   * @param enableInteractivity Whether interactivity should be enabled.
   * @return Returns the slice structure detailed above in the documentation of PieChartDefiner.calcSeries.
   *     @see {PieChartDefiner.calcSeries}
   */
  private calcSliceLayout(
    sliceIndex: number,
    dataIndex: number,
    from: number,
    to: number,
    value: Value,
    formattedValue: string,
    title: string,
    isVisible: boolean,
    center: Vec2,
    radiusX: number,
    radiusY: number,
    hole: number,
    height: number,
    offset: number,
    pieSliceText: PieSliceText,
    textStyle: TextStyle,
    color: StandardColor,
    brushes: BrushesDefinition,
    isDiffNewData: boolean,
    enableInteractivity: boolean,
  ): SerieDefinition {
    const chartDef = this.chartDef;

    if (chartDef.is3D || hole >= 1) {
      // TODO(dlaliberte): Add support for hole in 3D pie.
      hole = 0;
    }

    const result: SerieDefinition = {} as SerieDefinition;
    const relativeValue = to - from;
    result.value = value as number;
    result.formattedValue = formattedValue;
    result.color = color;
    result.brushes = brushes;
    result.brush = result.brushes.normal;
    result.title = title;
    result.index = sliceIndex;
    result.enableInteractivity = enableInteractivity;
    // If index is null we cannot convert it to a data table row, but this makes
    // sense because null indicates there is no need to interact with this
    // slice.
    // This exception is only for the pie chart, since it has been required.
    // Let's cast to number to avoid breaking existing charts.
    result.dataTableIdx = (
      dataIndex >= 0 ? this.dataView.getTableRowIndex(dataIndex) : null
    ) as number;
    result.isVisible = isVisible;
    const innerRadiusX = radiusX * hole;
    const innerRadiusY = radiusY * hole;
    result.innerRadiusX = innerRadiusX;
    result.innerRadiusY = innerRadiusY;
    result.fromDegrees = from * 360 + this.startAngle;
    result.toDegrees = to * 360 + this.startAngle;
    if (this.reverseDirection) {
      // If direction is reversed, negate from/to angle, and swap them, to
      // maintain from-angle smaller than to-angle.
      const fromDegrees = 360 - result.fromDegrees;
      const toDegrees = 360 - result.toDegrees;
      result.fromDegrees = toDegrees;
      result.toDegrees = fromDegrees;
    }
    const fromRadians = (Math.PI * (result.fromDegrees - 90)) / 180;
    const toRadians = (Math.PI * (result.toDegrees - 90)) / 180;
    result.percentage = this.percentFormatter.formatValue(relativeValue);

    // We now decide what the text on the slice should be.
    let text = '';
    switch (pieSliceText) {
      case PieSliceText.PERCENTAGE:
        text = result.percentage;
        break;
      case PieSliceText.LABEL:
        text = result.title;
        break;
      case PieSliceText.VALUE:
        text = formattedValue;
        break;
      case PieSliceText.VALUE_AND_PERCENTAGE:
        text = `${formattedValue} (${result.percentage})`;
        break;
      default:
        // NONE is ok
        break;
    }

    result.text = text;
    if (!isVisible) {
      return result;
    }

    result.textStyle = textStyle;
    const textWidth = this.textMeasureFunction(result.text, textStyle).width;
    const fontSize = textStyle.fontSize;
    result.textBoxSize = new Size(textWidth, fontSize);
    result.isWholeCircle = relativeValue === 1;
    if (result.text) {
      if (result.isWholeCircle) {
        // This slice is the only slice, thus a whole circle, text is therefore
        // in its center.
        result.textBoxTopLeft = Vec2.difference(
          center,
          new Vec2(textWidth / 2, fontSize / 2),
        );
        result.isTextVisible = true;
      } else {
        // Calculates text box center and makes sure there is enough space for
        // text in the expected position.

        // Ellipse to which text should be adjacent.
        const guideEllipseRadiusX = radiusX - fontSize;
        const guideEllipseRadiusY = radiusY - fontSize;

        // from and to are angles denoted in units between 0
        // and 1 indicating how much of a full cycle starting from a vector
        // pointing straight up from the pie center and counting clockwise
        // (in screen coordinates). Converting them to standard radians entails
        // subtracting one quarter of a cycle (0.25) since standard radians
        // start from the positive x axis and count towards the positive y axis.
        // No need to change directionality since counting clockwise in screen
        // coordinates also progresses from positive x axis towards positive y.
        const textBoxRelativePosition = positionBoxInEllipticSlice(
          guideEllipseRadiusX,
          guideEllipseRadiusY,
          fromRadians,
          toRadians,
          result.textBoxSize,
          2,
          0.4,
        );

        if (textBoxRelativePosition !== null) {
          // Positioning succeeded, so place text in slice.
          result.isTextVisible = true;
          result.textBoxTopLeft = sumAll(
            center,
            textBoxRelativePosition,
            new Vec2(
              -result.textBoxSize.width / 2,
              -result.textBoxSize.height / 2,
            ),
          );
        }
      }
    } else {
      result.isTextVisible = false;
    }

    result.offset = vectorOnEllipse(
      (fromRadians + toRadians) / 2,
      radiusX,
      radiusY,
    ).scale(offset);

    const fromDxDy = vectorOnEllipse(fromRadians, radiusX, radiusY);
    const toDxDy = vectorOnEllipse(toRadians, radiusX, radiusY);
    result.fromPixel = Vec2.sum(center, fromDxDy);
    result.toPixel = Vec2.sum(center, toDxDy);

    const innerFromDxDy = vectorOnEllipse(
      fromRadians,
      innerRadiusX,
      innerRadiusY,
    );
    const innerToDxDy = vectorOnEllipse(toRadians, innerRadiusX, innerRadiusY);
    result.innerFromPixel = Vec2.sum(center, innerFromDxDy);
    result.innerToPixel = Vec2.sum(center, innerToDxDy);

    if (chartDef.is3D && result.fromDegrees <= 270 && result.toDegrees >= 90) {
      // We need to add the side3D info only if the pie is 3D and this slice has
      // some area in the bottom half of the pie.
      // This condition is actually equivalent to asking that either the from or
      // to degrees are between 90 and 270 (but easier to write).
      const side3D: PixelTransformation = {} as PixelTransformation;

      if (result.fromDegrees < 90) {
        side3D.fromDegrees = 90;
        side3D.fromPixel = new Vec2(center.x + radiusX, center.y);
      } else {
        side3D.fromDegrees = result.fromDegrees;
        side3D.fromPixel = result.fromPixel;
      }
      if (result.toDegrees > 270) {
        side3D.toDegrees = 270;
        side3D.toPixel = new Vec2(center.x - radiusX, center.y);
      } else {
        side3D.toDegrees = result.toDegrees;
        side3D.toPixel = result.toPixel;
      }
      side3D.brush = result.brushes.dark;
      result.side3D = side3D;
    }
    result.drawInnerFrom = chartDef.is3D && from > 0.5;
    result.drawInnerTo = chartDef.is3D && to < 0.5;
    if (result.drawInnerFrom || result.drawInnerTo) {
      result.innerBrush = result.brushes.dark;
    }

    return result;
  }

  /**
   * Creates tooltip for a slice.
   * Modifies slice's 'tooltipText'.
   * @param slice slice structure detailed above in the documentation of
   *     PieChartDefiner.calcSeries. Its field 'tooltipText' is modified in this function.
   *     @see {PieChartDefiner.calcSeries}
   * @param pieTooltipText An enum indicating the tooltip text.
   * @param newDataSlice slice structure detailed above in the documentation of
   *     PieChartDefiner.calcSeries, corresponding to new data in the pie chart.
   *     In a simple chart newDataSlice==slice, but in diff mode slice is either
   *     equal to newDataSlice or oldDataSlice.
   *     @see {PieChartDefiner.calcSeries}
   * @param oldDataSlice slice structure detailed above in the documentation of
   *     PieChartDefiner.calcSeries, corresponding to old data in the pie chart.
   *     In a simple chart oldDataSlice==null, but in diff mode it is always
   *    defined and use to compose the tooltip text.
   *     @see {PieChartDefiner.calcSeries}
   */
  private createSliceTooltip(
    slice: SerieDefinition,
    pieTooltipText: PieValueText,
    newDataSlice: SerieDefinition,
    oldDataSlice?: SerieDefinition,
  ) {
    // oldDataSlice needs to be defined when in diff mode.
    assert(!this.chartDef.isDiff || oldDataSlice != null);

    // Decide what the text on the tooltip should be.
    let content = PieChartDefiner.calcSliceValueText(
      newDataSlice,
      pieTooltipText,
    );
    if (oldDataSlice) {
      content +=
        '\n' + PieChartDefiner.calcSliceValueText(oldDataSlice, pieTooltipText);
    }
    slice.tooltipText = {
      serieTitle: slice.title,
      content,
    } as TooltipText;
  }

  /**
   * Defines the labeledLegend portion of the chart definition.
   * @param chartArea The chart area.
   * @param areaLayout The layout of the chart area.
   * @param legendTextStyle The legend text style.
   */
  private calcLabeledLegend(
    chartArea: chartarea.ChartArea,
    areaLayout: PieChartAreaLayout,
    legendTextStyle: TextStyle,
  ) {
    const chartDef = this.chartDef;
    const radiusX = chartDef.pie.radiusX;
    const radiusY = chartDef.pie.radiusY;
    const center = areaLayout.pie.center;

    const valueTextType = this.options.inferStringValue(
      'legend.labeledValueText',
      PieValueText.PERCENTAGE,
      PieValueText,
    ) as PieValueText;

    // See approximation in http://en.wikipedia.org/wiki/Ellipse#Circumference
    const pieCircumference =
      Math.PI *
      (3 * (radiusX + radiusY) -
        Math.sqrt((3 * radiusX + radiusY) * (radiusX + 3 * radiusY)));

    // Building the items for the right and left legends.
    const rightEntriesInfo = [];
    const leftEntriesInfo = [];
    for (let i = 0; i < chartDef.legendEntries.length; ++i) {
      const legendEntry = chartDef.legendEntries[i];
      if (!legendEntry.isVisible) {
        continue;
      }
      let slice;
      if (legendEntry.index >= 0) {
        slice = chartDef.series[legendEntry.index];
      } else {
        const layers = chartDef.pie.layers;
        slice = layers[layers.length - 1].otherSlice;
      }

      // Calculating the origin point of the legend item - the point in which
      // the line is connected to the slice. The point has a preferred Y
      // location, and a range in which it's allowed to move. We also need a
      // function to convert from the Y coordinate, once that is decided, to the
      // full screen coordinate, including an X value.
      const originRadiusX = Math.max(
        (radiusX + slice.innerRadiusX) / 2,
        radiusX * 0.75,
      );
      const originRadiusY = Math.max(
        (radiusY + slice.innerRadiusY) / 2,
        radiusY * 0.75,
      );
      const middleDegrees = (slice.toDegrees + slice.fromDegrees) / 2;
      const standardMiddleDegrees = googMath.standardAngle(middleDegrees);

      // Calculating minOrigin/maxOrigin - the range of degrees the origin is
      // allowed to move within. The size of the range is the same as the
      // distance between the origin and the perimeter of the pie (along the
      // radius).
      const originDistanceFromPerimeter = googMath.average(
        radiusX - originRadiusX,
        radiusY - originRadiusY,
      );
      const originMarginFromSliceRadialEdge =
        (originDistanceFromPerimeter / pieCircumference) * 360;
      let minOrigin;
      let maxOrigin;
      if (
        2 * originMarginFromSliceRadialEdge <
        slice.toDegrees - slice.fromDegrees
      ) {
        minOrigin = slice.fromDegrees + originMarginFromSliceRadialEdge;
        maxOrigin = slice.toDegrees - originMarginFromSliceRadialEdge;
        if (standardMiddleDegrees < 180) {
          maxOrigin = Math.min(maxOrigin, 180);
        } else {
          minOrigin = Math.max(minOrigin, 180);
        }
      } else {
        minOrigin = middleDegrees;
        maxOrigin = middleDegrees;
      }

      // Converts an angle in radians to the location of an origin pixel, on
      // that angle.
      const radiansToOriginVec = (radians: number) => {
        const vecDxDy = vectorOnEllipse(radians, originRadiusX, originRadiusY);
        const vec = Vec2.sum(center, vecDxDy);
        return vec;
      };
      // Same as above, for degrees.
      const degreesToOriginVec = (degrees: number) => {
        const radians = googMath.toRadians(degrees - 90);
        return radiansToOriginVec(radians);
      };
      // These functions convert a Y coordinate to the location of an origin
      // pixel, on that Y coordinate, i.e., calculates the X coordinate. One
      // function for the right part of the pie and one for the left.
      const originYRightToRadians = (y: number) => {
        const sin = (y - center.y) / originRadiusY;
        // Using clamp to avoid numeric errors that can cause sin to be out of
        // the
        // [-1, 1] range.
        return Math.asin(googMath.clamp(sin, -1, 1));
      };
      const originYRightToVec = (y: number) =>
        radiansToOriginVec(originYRightToRadians(y));
      const originYLeftToVec = (y: number) =>
        radiansToOriginVec(Math.PI - originYRightToRadians(y));

      const entryInfo: LegendEntryInfo = {
        preferredOrigin: degreesToOriginVec(middleDegrees).y,
        originRange: new Range(
          degreesToOriginVec(minOrigin).y,
          degreesToOriginVec(maxOrigin).y,
        ),
        originYToVec: originYRightToVec,
        rightEntriesInfo: [],
        leftEntriesInfo: [],
        aboveText: legendEntry.text as string, // Expression??
        belowText: PieChartDefiner.calcSliceValueText(slice, valueTextType),
        importance: slice.value,
        index: slice.index,
      };

      if (standardMiddleDegrees < 180) {
        entryInfo.originYToVec = originYRightToVec;
        rightEntriesInfo.push(entryInfo);
      } else {
        entryInfo.originYToVec = originYLeftToVec;
        leftEntriesInfo.push(entryInfo);
      }
    }

    // Defining the legends.
    const legendWidth =
      chartArea.width / 2 - radiusX - legendTextStyle.fontSize;
    const alignment = labeledLegendDefiner.Alignment;
    const rightLegendArea = new Box(
      chartArea.top,
      chartArea.right,
      chartArea.bottom,
      chartArea.right - legendWidth,
    );
    const rightLabeledLegend = labeledLegendDefiner.define(
      rightLegendArea,
      this.textMeasureFunction,
      alignment.RIGHT,
      legendTextStyle,
      rightEntriesInfo,
    );
    const leftLegendArea = new Box(
      chartArea.top,
      chartArea.left + legendWidth,
      chartArea.bottom,
      chartArea.left,
    );
    const leftLabeledLegend = labeledLegendDefiner.define(
      leftLegendArea,
      this.textMeasureFunction,
      alignment.LEFT,
      legendTextStyle,
      leftEntriesInfo,
    );

    const labeledLegend: AnyDuringMigration[] = [];
    extend(labeledLegend, rightLabeledLegend, leftLabeledLegend);
    this.chartDef.labeledLegend = labeledLegend;
  }
}
