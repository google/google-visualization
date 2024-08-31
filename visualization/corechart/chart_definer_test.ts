/**
 * @fileoverview Unit tests for the ChartDefiner class.
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

import 'jasmine';

import {AxisChartDefiner} from './axis_chart_definer';
import {ChartDefiner} from './chart_definer';

import {
  forEach,
  map,
  reduce,
} from '@npm//@closure/array/array';
import {fail} from '@npm//@closure/asserts/asserts';
import {
  appendChild,
  createElement,
} from '@npm//@closure/dom/dom';
import {EventHandler} from '@npm//@closure/events/eventhandler';
import {identity} from '@npm//@closure/functions/functions';
import {Size} from '@npm//@closure/math/size';
import {getKeys} from '@npm//@closure/object/object';
import {setStyle} from '@npm//@closure/style/style';
import {AnyCallbackWrapper, AsyncHelper} from '../../common/async_helper';
import {
  DEFAULTS,
  DEFAULT_DISCRETE_COLORS,
  DEFAULT_LINE_WIDTH,
  DEFAULT_POINT_SENSITIVITY_AREA_RADIUS,
  DEFAULT_POINT_SIZE_FOR_LINE,
} from '../../common/defaults';
import {ErrorHandler} from '../../common/error_handler';
import * as optionTypes from '../../common/option_types';
import {Orientation} from '../../common/option_types';
import {Options as GvizOptions} from '../../common/options';
import * as testUtils from '../../common/test_utils';
import {DataTable, arrayToDataTable} from '../../data/datatable';
import * as gvizEvents from '../../events/events';
import {Brush} from '../../graphics/brush';
import {Pattern} from '../../graphics/pattern';
import {PatternStyle, StrokeDashStyleType} from '../../graphics/types';
import {grayOutColor} from '../../graphics/util';
import {Coordinate} from '../../math/coordinate';
import {TextAlign} from '../../text/text_align';
import {TextStyle} from '../../text/text_style';
import {ChartDefinition} from './chart_definition';
import {ColumnRole} from './serie_columns';

import {BarChart, ComboChart, ScatterChart} from './corecharts';

const {CENTER, END, START} = TextAlign;

const {
  assertEqualsWithContext,
  floatEquality,
  assertFalse,
  assertNotNullNorUndefined,
  assertNotUndefined,
  assertUndefined,
  assertEquals,
  assertNotEquals,
  assertNotNull,
  assertNull,
  assertObjectEquals,
  assertTrue,
} = testUtils;

const {
  AxisType,
  ChartType,
  CurveType,
  FocusTarget,
  InOutPosition,
  InteractivityModel,
  IntervalStyle,
  SelectionMode,
  SerieType,
  SeriesRelativeColor,
} = optionTypes;

const {ANNOTATION, CERTAINTY, DOMAIN, EMPHASIS, SCOPE} = ColumnRole;

// tslint:disable:ban-types Migration
// tslint:disable:no-unnecessary-type-assertion
// tslint:disable:no-dict-access-on-struct-type
//

// Use empty options container to infer values from the default options, when
// direct access is not enough (e.g. inferring a Brush object).
const options = new GvizOptions([DEFAULTS]);

// A value that tells the tester to not compare a certain field with the result.
const DONT_COMPARE = '__DONT_COMPARE__';

/**
 * Used to indicate that a field should contain an array of a given size and
 */
function compareOnlyArraySize(size: number): string[] {
  return new Array(size).fill(DONT_COMPARE);
}

/**
 * Test cases for the ChartDefiner class.
 * To add additional test cases:
 *   1. Create another function to return a test case, with empty result.
 *   2. Add the function to the array in 'getChartDefinerTestCases'.
 *   3. Run the test to see what the result should be and update the result stub
 *      to match it until the test passes.
 *
 * ignoreUnexpectedFields: Set this field to 'true' in order to tell the tester
 *     to ignore fields that were not specified in the expected results.
 *     Defaults to 'false'.
 *
 */
interface ChartDefinerTestCase {
  name: string;
  data: AnyDuringMigration[] | DataTable;
  options: AnyDuringMigration;
  width: number;
  height: number;
  ignoreUnexpectedFields?: boolean;
  result?: AnyDuringMigration;
}

/**
 * Runs a testCase.
 */
function runChartDefinerTestCase(testCase: ChartDefinerTestCase) {
  const msg = 'On test case "' + testCase.name + '":';

  let data: DataTable | undefined;
  let options;
  let chartDef;

  const makeDefiner = () => {
    if (testCase.data instanceof DataTable) {
      data = testCase.data;
    } else {
      data = createDataTable(testCase.data[0], testCase.data[1]);
    }
    options = new GvizOptions([testCase.options, DEFAULTS]);
    chartDef = createChartDefiner(
      data,
      options,
      testCase.width,
      testCase.height,
    ).getChartDefinition();
  };
  expect(makeDefiner).withContext(msg).not.toThrow();

  // Add custom equality tester for numbers.
  jasmine.addCustomEqualityTester(floatEquality);

  const expectedResult = testCase.result;
  if (expectedResult !== DONT_COMPARE) {
    copyUntestedValues(
      expectedResult,
      chartDef,
      testCase.ignoreUnexpectedFields || false,
    );

    expect(chartDef).withContext(msg).toEqual(expectedResult);
  }

  // Create div in the defined dimensions.
  const container = createElement('div');
  setStyle(container, 'width', `${testCase.width}px`);
  setStyle(container, 'height', `${testCase.height}px`);
  appendChild(document.body, container);

  // Draw the chart.
  const chart = new ComboChart(container);
  assertNotNull(data!);
  chart.draw(data!, testCase.options);
}

/**
 * Create a data table from column headers and an array of data rows.
 *
 * @param columnHeaders A list of column type and name.
 * @param dataRows A list of data rows.
 *
 * @return The created table.
 */
function createDataTable(
  columnHeaders: string[][],
  dataRows: AnyDuringMigration[][],
): DataTable {
  const data = new DataTable();
  forEach(columnHeaders, (header, columnIndex) => {
    data.addColumn(header[0], header[1], header[2]);
    if (header[2] === 'certainty') {
      data.setColumnProperty(columnIndex, 'role', CERTAINTY);
    } else if (header[2] === 'domain') {
      data.setColumnProperty(columnIndex, 'role', DOMAIN);
    } else if (header[2] === 'scope') {
      data.setColumnProperty(columnIndex, 'role', SCOPE);
    } else if (header[2] === 'emphasis') {
      data.setColumnProperty(columnIndex, 'role', EMPHASIS);
    } else if (header[2] === 'annotation') {
      data.setColumnProperty(columnIndex, 'role', ANNOTATION);
    }
  });
  data.addRows(dataRows);
  return data;
}

/**
 * Creates a chart definer with the given parameters.
 * @param data The data table.
 * @param options Extra chart options.
 * @param width Chart width.
 * @param height Chart height.
 * @param asyncWrapper From AsyncHelper.
 * @param afterInit Function
 * @return The chart definer.
 */
function createChartDefiner(
  data: DataTable,
  options: GvizOptions,
  width: number,
  height: number,
  asyncWrapper?: AnyCallbackWrapper | null,
  afterInit?: (p1: ChartDefiner) => AnyDuringMigration,
): ChartDefiner {
  const textHeightEstimationFactor = 1.192;
  const textWidthEstimationFactor = 0.444;
  const textMeasureFunction = (
    text: AnyDuringMigration,
    textStyle: AnyDuringMigration,
  ) => {
    const width = Math.round(
      textWidthEstimationFactor * text.length * textStyle.fontSize,
    );
    const height = Math.round(textHeightEstimationFactor * textStyle.fontSize);
    return new Size(width, height);
  };
  const chartDefiner = new AxisChartDefiner(
    data,
    options,
    textMeasureFunction,
    width,
    height,
  );
  chartDefiner.init(asyncWrapper || identity, afterInit);
  return chartDefiner;
}

/**
 * Copies unnested values from one object to another.
 * @param expectedResult The expected result.
 * @param result The object to copy.
 * @param ignoreUnexpectedFields Whether to ignore extra fields.
 */
function copyUntestedValues(
  expectedResult: AnyDuringMigration,
  result: AnyDuringMigration,
  ignoreUnexpectedFields: boolean,
) {
  let expected = null;
  let received = null;

  if (Array.isArray(result) && result.length !== expectedResult.length) {
    // The result is an array that does not match the expected result. Leave
    // it to fail the test. This extra check is needed because when ignoring
    // unexpected fields, if the expected array is shorter than the result
    // array, the for loop ahead will copy all the missing elements from the
    // result to the expected result and the error will be silenced.
    return;
  }
  for (const key in result) {
    if (!result.hasOwnProperty(key)) continue;
    expected = expectedResult[key];
    received = result[key];
    if (
      expected === DONT_COMPARE ||
      (expected === undefined && ignoreUnexpectedFields)
    ) {
      // Copy untested value.
      expectedResult[key] = received;
    } else if (
      typeof received !== 'function' &&
      goog.isObject(received) &&
      goog.isObject(expected)
    ) {
      copyUntestedValues(expected, received, ignoreUnexpectedFields);
    }
  }
}

/**
 * Tests the geometry of bars for a given data size. Verifies that:
 * 1. The width (height) of all the bars is consistent.
 * 2. The horizontal (vertical) position and width (height) of all bars is not
 * fractional.
 * @param rows The number of rows in the data.
 * @param cols The number of columns in the data.
 * @param orientation The orientation of the bars.
 */
function performSpecificBarsGeometryTest(
  rows: number,
  cols: number,
  orientation: Orientation,
) {
  const chartDef = createChartDefiner(
    prepareSinData(rows, cols),
    new GvizOptions([
      {
        'type': 'function',
        'seriesType': 'bars',
        'orientation': orientation,
      },
      DEFAULTS,
    ]),
    400,
    200,
  ).getChartDefinition();

  let barSize;
  for (let i = 0; i < cols; ++i) {
    for (let j = 0; j < rows; ++j) {
      const point = chartDef.series![i].points[j];
      if (!point) {
        continue;
      }
      const scaled = point.scaled;
      if (scaled) {
        // Get size and position of bar (depending on orientation).
        let size;
        let pos;
        switch (orientation) {
          case Orientation.HORIZONTAL:
            size = scaled.width;
            pos = scaled.left;
            break;
          case Orientation.VERTICAL:
            size = scaled.height;
            pos = scaled.top;
            break;
          default:
            throw new Error('impossible orientation');
        }
        // Set initial bar size value.
        if (barSize === undefined) {
          barSize = size;
        }
        // Verify that this bar has the same size as other bars,
        // plus or minus one, since we allow larger bars to vary.
        expect(Math.abs(barSize - size) <= 1)
          .withContext('sizes differ by more than one')
          .toBe(true);

        // Verify that the geometry of this bar is not fractional,
        // other than half-pixels.
        assertInteger(size * 2);
        assertInteger(pos * 2);
      }
    }
  }
}

/**
 * Verifies that x is non fractional.
 * @param x The number to test.
 */
function assertInteger(x: number) {
  assertEquals(Math.round(x), x);
}

/**
 * Prepares sinus based data for testing.
 * @param rows The number of rows in the data.
 * @param cols The number of columns in the data.
 * @return the data.
 */
function prepareSinData(rows: number, cols: number): DataTable {
  const data = new DataTable();
  data.addColumn('string', 'Name');

  for (let i = 0; i < cols; ++i) {
    data.addColumn('number', `A${i}`);
  }
  for (let j = 0; j < rows; ++j) {
    const row: AnyDuringMigration[] = [`B${j}`];
    for (let i = 0; i < cols; ++i) {
      row.push(Math.sin(Math.E * i + j));
    }
    data.addRow(row);
  }
  return data;
}

/**
 * Create a ChartDefinition and set the properties using obj.
 * @param obj The object
 * @return The same instance.
 */
function createAndSetChartDefinition(obj: AnyDuringMigration): ChartDefinition {
  const chartDefinition = new ChartDefinition();
  Object.assign(chartDefinition, obj);
  return chartDefinition;
}

/**
 * Check a specific case of the intervals options chain.
 * @param options The options to use to create a test chart.
 * @param expects expected values of the interval settings.
 */
function checkChartDefinerIntervalsOptionsChain(
  options: AnyDuringMigration,
  expects: AnyDuringMigration[],
) {
  const data = createDataTable(
    [
      ['string', 'key'],
      ['number', 'serie-A'],
      ['number', 'interval-x'],
      ['number', 'interval-y'],
      ['number', 'serie-B'],
      ['number', 'interval-x'],
      ['number', 'interval-z'],
    ],
    [['row', 1, 2, 3, 4, 5, 6]],
  );
  data.setColumnProperty(0, 'role', 'domain');
  data.setColumnProperty(1, 'role', 'data');
  data.setColumnProperty(2, 'role', 'interval');
  data.setColumnProperty(3, 'role', 'interval');
  data.setColumnProperty(4, 'role', 'data');
  data.setColumnProperty(5, 'role', 'interval');
  data.setColumnProperty(6, 'role', 'interval');

  const chartOptions = new GvizOptions([
    options,
    {
      'type': 'function',
      'seriesType': 'line',
      'orientation': Orientation.VERTICAL,
      'intervals': {'style': IntervalStyle.POINTS},
    },
    DEFAULTS,
  ]);
  const chartDef = createChartDefiner(
    data,
    chartOptions,
    400,
    200,
  ).getChartDefinition();

  for (
    let serieIndex = 0, serie;
    (serie = chartDef.series![serieIndex]);
    ++serieIndex
  ) {
    for (
      let intervalIndex = 0, point;
      (point = serie.points[intervalIndex]);
      ++intervalIndex
    ) {
      const columnIndex = point.scaled!.intervalRects[0].columnIndex;
      const actual = serie.intervals!.settings[columnIndex];
      const expect = expects[serieIndex * 2 + intervalIndex];
      assertNotNullNorUndefined(expect);

      const actualColor = actual.brush.getFill().toLowerCase();
      const expectedColor: {dark: string; light: string; color: string} =
        serie.color! as AnyDuringMigration;
      switch (expect['color']) {
        case SeriesRelativeColor.DARK:
          assertEquals(expectedColor.dark.toLowerCase(), actualColor);
          break;
        case SeriesRelativeColor.LIGHT:
          assertEquals(expectedColor.light.toLowerCase(), actualColor);
          break;
        case SeriesRelativeColor.COLOR:
          assertEquals(expectedColor.color.toLowerCase(), actualColor);
          break;
        default:
          assertEquals(expect['color'].toLowerCase(), actualColor);
          break;
      }

      assertEquals(expect['fillOpacity'], actual.brush.getFillOpacity());
      assertEquals(expect['lineWidth'], actual.brush.getStrokeWidth());
      assertEquals(expect['barWidth'], actual.barWidth);
      assertEquals(expect['shortBarWidth'], actual.shortBarWidth);
      assertEquals(expect['boxWidth'], actual.boxWidth);
      assertEquals(expect['pointSize'], actual.pointSize);
      assertEquals(expect['curveType'], actual.curveType);
      assertEquals(expect['smoothingFactor'], actual.smoothingFactor);
      assertEquals(expect['interpolateNulls'], actual.interpolateNulls);
    }
  }
}

describe('ChartDefiner', () => {
  /**
   *     for Default test case.
   */
  it('Default  test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Default',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Basketball score', 'basketball'],
        ],
        [
          ['Danny', 3.7, 3.0],
          ['Betty', 4.1, 1.1],
          ['Milo', 4.8, 0.8],
        ],
      ],
      options: {
        'title': 'Default test case',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'series': {
          1: {
            'dataOpacity': 0.5,
          },
        },
      },
      width: 400,
      height: 200,
    };
    testcase.result = createAndSetChartDefinition({
      width: 400,
      height: 200,
      chartType: ChartType.FUNCTION,
      chartArea: {
        width: 267,
        height: 124,
        top: 38,
        bottom: 162,
        left: 67,
        right: 334,
      },
      useNewLegend: true,
      defaultFontName: (DEFAULTS as AnyDuringMigration)['fontName'],
      defaultFontSize: 11,
      defaultSerieType: SerieType.BARS,
      enableInteractivity: true,
      focusTarget: new Set([FocusTarget.DATUM]),
      selectionMode: SelectionMode.SINGLE,
      showRemoveSerieButton: false,
      interactivityModel: InteractivityModel.DEFAULT,
      backgroundBrush: options.inferBrushValue('backgroundColor'),
      chartAreaBackgroundBrush: new Brush(Brush.TRANSPARENT_BRUSH),
      actualChartAreaBackgoundColor: '#ffffff',
      baselineColor: (DEFAULTS as AnyDuringMigration)['baselineColor'],
      gridlineColor: (DEFAULTS as AnyDuringMigration)['gridlineColor'],
      insideLabelsAuraColor: '#ffffff',
      title: {
        tooltip: '',
        text: 'Default test case',
        textStyle: new TextStyle({
          fontName: (DEFAULTS as AnyDuringMigration)['fontName'],
          fontSize: 11,
          color: (DEFAULTS as AnyDuringMigration)['titleTextStyle']['color'],
          bold: (DEFAULTS as AnyDuringMigration)['titleTextStyle']['bold'],
          auraColor: 'none',
        }),
        boxStyle: null,
        lines: [{text: 'Default test case', x: 67, y: 24.5, length: 267}],
        paralAlign: START,
        perpenAlign: END,
        anchor: null,
        angle: 0,
      },
      targetAxisToDataType: {0: 'number'},
      titlePosition: InOutPosition.OUTSIDE,
      tooltipBoxStyle: new Brush(
        (DEFAULTS as AnyDuringMigration)['tooltip']['boxStyle'],
      ),
      axisTitlesPosition: InOutPosition.OUTSIDE,
      is3D: false,
      isRtl: false,
      shouldHighlightSelection: true,
      stackingType: 'none',
      isHtmlTooltip: false,
      interpolateNulls: false,
      categories: [
        {data: 'Danny', titles: ['Danny'], dataTableIdx: 0},
        {data: 'Betty', titles: ['Betty'], dataTableIdx: 1},
        {data: 'Milo', titles: ['Milo'], dataTableIdx: 2},
      ],
      dataTableToCategoryMap: {0: 0, 1: 1, 2: 2},
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      domainDataType: 'string',
      series: [
        {
          id: 'football',
          title: 'Football score',
          isVisible: true,
          dataTableIdx: 1,
          domainIndex: 0,
          columns: {'data': [1]},
          candlestick: null,
          boxplot: null,
          intervals: null,
          color: {
            color: DEFAULT_DISCRETE_COLORS[0]['color'],
            dark: '#264d99',
            light: DEFAULT_DISCRETE_COLORS[0]['lighter'],
          },
          colorOpacity: 1.0,
          enableInteractivity: true,
          pointShape: null,
          pointBrush: new Brush({fill: DEFAULT_DISCRETE_COLORS[0]['color']}),
          lineBrush: new Brush({
            stroke: DEFAULT_DISCRETE_COLORS[0]['color'],
            strokeWidth: DEFAULT_LINE_WIDTH,
          }),
          areaBrush: null,
          type: SerieType.BARS,
          dataType: 'number',
          zOrder: 0,
          lineWidth: DEFAULT_LINE_WIDTH,
          pointRadius: DEFAULT_POINT_SIZE_FOR_LINE / 2 + 1,
          pointSensitivityAreaRadius: DEFAULT_POINT_SENSITIVITY_AREA_RADIUS,
          curveType: CurveType.NONE,
          smoothingFactor: 1,
          visiblePoints: true,
          showTooltip: true,
          points: [
            {
              tooltipText: {
                categoryTitle: 'Danny',
                serieTitle: 'Football score',
                content: '3.7',
                hasCustomContent: false,
                hasHtmlContent: false,
              },
              scaled: {
                left: 84,
                top: 86,
                width: 27,
                height: 75,
                intervalRects: [],
              },
              nonScaled: {
                from: null,
                to: 3.7,
                division: 0,
                subdivision: 0,
                intervalMarks: null,
                d: 0,
                dPrevious: null,
              },
            },
            {
              tooltipText: {
                categoryTitle: 'Betty',
                serieTitle: 'Football score',
                content: '4.1',
                hasCustomContent: false,
                hasHtmlContent: false,
              },
              scaled: {
                left: 173,
                top: 78,
                width: 27,
                height: 83,
                intervalRects: [],
              },
              nonScaled: {
                from: null,
                to: 4.1,
                division: 1,
                subdivision: 0,
                intervalMarks: null,
                d: 1,
                dPrevious: 0,
              },
            },
            {
              tooltipText: {
                categoryTitle: 'Milo',
                serieTitle: 'Football score',
                content: '4.8',
                hasCustomContent: false,
                hasHtmlContent: false,
              },
              scaled: {
                left: 262,
                top: 64,
                width: 27,
                height: 97,
                intervalRects: [],
              },
              nonScaled: {
                from: null,
                to: 4.8,
                division: 2,
                subdivision: 0,
                intervalMarks: null,
                d: 2,
                dPrevious: 1,
              },
            },
          ],
          controlPoints: [],
          targetAxisIndex: 0,
          visibleInLegend: true,
          labelInLegend: 'Football score',
          diff: undefined,
          stepped: false,
        },
        {
          id: 'basketball',
          title: 'Basketball score',
          isVisible: true,
          dataTableIdx: 2,
          domainIndex: 0,
          columns: {'data': [2]},
          intervals: null,
          candlestick: null,
          boxplot: null,
          color: {
            color: DEFAULT_DISCRETE_COLORS[1]['color'],
            dark: '#a52b0e',
            light: DEFAULT_DISCRETE_COLORS[1]['lighter'],
          },
          colorOpacity: 0.5,
          showTooltip: true,
          enableInteractivity: true,
          pointShape: null,
          pointBrush: new Brush({
            fill: DEFAULT_DISCRETE_COLORS[1]['color'],
            fillOpacity: 0.5,
          }),
          lineBrush: new Brush({
            stroke: DEFAULT_DISCRETE_COLORS[1]['color'],
            strokeWidth: DEFAULT_LINE_WIDTH,
          }),
          areaBrush: null,
          type: SerieType.BARS,
          dataType: 'number',
          zOrder: 0,
          lineWidth: DEFAULT_LINE_WIDTH,
          pointRadius: DEFAULT_POINT_SIZE_FOR_LINE / 2 + 1,
          pointSensitivityAreaRadius: DEFAULT_POINT_SENSITIVITY_AREA_RADIUS,
          curveType: CurveType.NONE,
          smoothingFactor: 1,
          visiblePoints: true,
          points: [
            {
              tooltipText: {
                categoryTitle: 'Danny',
                serieTitle: 'Basketball score',
                content: '3',
                hasCustomContent: false,
                hasHtmlContent: false,
              },
              scaled: {
                left: 112,
                top: 101,
                width: 27,
                height: 60,
                intervalRects: [],
              },
              nonScaled: {
                from: null,
                to: 3,
                division: 0,
                subdivision: 1,
                intervalMarks: null,
                d: 0,
                dPrevious: null,
              },
            },
            {
              tooltipText: {
                categoryTitle: 'Betty',
                serieTitle: 'Basketball score',
                content: '1.1',
                hasCustomContent: false,
                hasHtmlContent: false,
              },
              scaled: {
                left: 201,
                top: 139,
                width: 27,
                height: 22,
                intervalRects: [],
              },
              nonScaled: {
                from: null,
                to: 1.1,
                division: 1,
                subdivision: 1,
                intervalMarks: null,
                d: 1,
                dPrevious: 0,
              },
            },
            {
              tooltipText: {
                categoryTitle: 'Milo',
                serieTitle: 'Basketball score',
                content: '0.8',
                hasCustomContent: false,
                hasHtmlContent: false,
              },
              scaled: {
                left: 290,
                top: 146,
                width: 27,
                height: 15,
                intervalRects: [],
              },
              nonScaled: {
                from: null,
                to: 0.8,
                division: 2,
                subdivision: 1,
                intervalMarks: null,
                d: 2,
                dPrevious: 1,
              },
            },
          ],
          controlPoints: [],
          targetAxisIndex: 0,
          visibleInLegend: true,
          labelInLegend: 'Basketball score',
          diff: undefined,
          stepped: false,
        },
      ],
      dataTableColumnRoleInfo: [
        {serieIndex: null, domainIndex: 0, role: 'domain', roleIndex: 0},
        {serieIndex: 0, domainIndex: null, role: 'data', roleIndex: 0},
        {serieIndex: 1, domainIndex: null, role: 'data', roleIndex: 0},
      ],
      legendEntries: [
        {
          id: 'football',
          text: 'Football score',
          brush: new Brush({
            fill: DEFAULT_DISCRETE_COLORS[0]['color'],
            strokeWidth: 1,
          }),
          index: 0,
          isVisible: true,
        },
        {
          id: 'basketball',
          text: 'Basketball score',
          brush: new Brush({
            fill: DEFAULT_DISCRETE_COLORS[1]['color'],
            fillOpacity: 0.5,
            strokeWidth: 1,
          }),
          index: 1,
          isVisible: true,
        },
      ],
      serieTypeCount: {'bars': 2},
      textMeasureFunction: DONT_COMPARE,
      legend: DONT_COMPARE,
      colorBar: DONT_COMPARE,
      hAxes: {
        0: {
          name: 'hAxis#0',
          dataType: undefined,
          title: {
            text: '',
            textStyle: new TextStyle({
              fontName: (DEFAULTS as AnyDuringMigration)['fontName'],
              fontSize: 11,
              color: (DEFAULTS as AnyDuringMigration)['hAxis'][
                'titleTextStyle'
              ]['color'],
              italic: (DEFAULTS as AnyDuringMigration)['hAxis'][
                'titleTextStyle'
              ]['italic'],
              auraColor: 'none',
            }),
            boxStyle: null,
            lines: [],
            paralAlign: CENTER,
            perpenAlign: START,
            tooltip: '',
            anchor: null,
            angle: 0,
          },
          type: AxisType.CATEGORY,
          logScale: false,
          ticklinesOrigin: {coordinate: 162, direction: -1},
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          number: DONT_COMPARE,
          position: DONT_COMPARE,
          gridlines: [],
          viewWindow: {min: 0, max: 3},
          text: [
            {
              dataValue: 'Danny',
              isVisible: true,
              optional: true,
              textBlock: {
                text: 'Danny',
                textStyle: new TextStyle({
                  fontName: (DEFAULTS as AnyDuringMigration)['fontName'],
                  fontSize: 11,
                  color: (DEFAULTS as AnyDuringMigration)['majorAxisTextColor'],
                  auraColor: 'none',
                }),
                lines: [{x: 0, y: 18, length: 24, text: 'Danny'}],
                paralAlign: CENTER,
                perpenAlign: END,
                tooltip: '',
                anchor: new Coordinate(111.83333333333334, 162),
                angle: 0,
              },
            },
            {
              dataValue: 'Betty',
              isVisible: true,
              optional: true,
              textBlock: {
                text: 'Betty',
                textStyle: new TextStyle({
                  fontName: (DEFAULTS as AnyDuringMigration)['fontName'],
                  fontSize: 11,
                  color: (DEFAULTS as AnyDuringMigration)['majorAxisTextColor'],
                  auraColor: 'none',
                }),
                lines: [{x: 0, y: 18, length: 24, text: 'Betty'}],
                paralAlign: CENTER,
                perpenAlign: END,
                tooltip: '',
                anchor: new Coordinate(200.5, 162),
                angle: 0,
              },
            },
            {
              dataValue: 'Milo',
              isVisible: true,
              optional: true,
              textBlock: {
                text: 'Milo',
                textStyle: new TextStyle({
                  fontName: (DEFAULTS as AnyDuringMigration)['fontName'],
                  fontSize: 11,
                  color: (DEFAULTS as AnyDuringMigration)['majorAxisTextColor'],
                  auraColor: 'none',
                }),
                lines: [{x: 0, y: 18, length: 20, text: 'Milo'}],
                paralAlign: CENTER,
                perpenAlign: END,
                tooltip: '',
                anchor: new Coordinate(289.1666666666667, 162),
                angle: 0,
              },
            },
          ],
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          dataType: 'number',
          title: {
            text: '',
            textStyle: new TextStyle({
              fontName: (DEFAULTS as AnyDuringMigration)['fontName'],
              fontSize: 11,
              color: (DEFAULTS as AnyDuringMigration)['vAxis'][
                'titleTextStyle'
              ]['color'],
              italic: (DEFAULTS as AnyDuringMigration)['vAxis'][
                'titleTextStyle'
              ]['italic'],
              auraColor: 'none',
            }),
            boxStyle: null,
            lines: [],
            paralAlign: CENTER,
            perpenAlign: START,
            tooltip: '',
            anchor: null,
            angle: 0,
          },
          type: AxisType.VALUE,
          logScale: false,
          ticklinesOrigin: {coordinate: 67, direction: 1},
          baseline: {
            dataValue: 0,
            coordinate: 161.5,
            isVisible: true,
            length: null,
            brush: new Brush({
              fill: (DEFAULTS as AnyDuringMigration)['baselineColor'],
            }),
          },
          dataDirection: 1,
          startPos: 161.5,
          endPos: 38,
          number: DONT_COMPARE,
          position: DONT_COMPARE,
          gridlines: compareOnlyArraySize(7),
          viewWindow: {min: 0, max: 6},
          text: compareOnlyArraySize(4),
        },
      },
      orientation: Orientation.HORIZONTAL,
      isDiff: false,
    });

    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Stacked bar chart.
   */
  it('StackedBar test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Stacked bar chart',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Basketball score', 'basketball'],
        ],
        [
          ['Danny', 3.7, 3.0],
          ['Betty', 4.1, 1.1],
          ['Milo', 4.8, 0.8],
        ],
      ],
      options: {
        'title': 'Stacked bars',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'isStacked': 'true',
      },
      width: 400,
      height: 200,
    };
    // TODO(dlaliberte): define expected results from test case #1. Currently we
    // only run the visual test.
    testcase.result = DONT_COMPARE;
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for 100% Stacked bar chart.
   */
  it('100PercentStackedBar test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Percent Stacked Bar chart',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Basketball score', 'basketball'],
        ],
        [
          ['Danny', 3.7, 3.0],
          ['Betty', 4.1, 1.1],
          ['Milo', 4.8, 0.8],
        ],
      ],
      options: {
        'title': 'Percent Stacked Bar',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'isStacked': 'percent',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };

    testcase.result = createAndSetChartDefinition({
      series: [
        {
          points: [
            {scaled: {width: 55, left: 84}},
            {scaled: {width: 55, left: 173}},
            {scaled: {width: 55, left: 262}},
          ],
        },
        {
          points: [
            {scaled: {width: 55, left: 84}},
            {scaled: {width: 55, left: 173}},
            {scaled: {width: 55, left: 262}},
          ],
        },
      ],
    });

    runChartDefinerTestCase(testcase);
  });

  /**
   *     for 100% Stacked area chart.
   */
  it('100PercentStackedArea test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Percent Stacked Area chart',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Basketball score', 'basketball'],
        ],
        [
          ['Danny', 3.7, 3.0],
          ['Betty', 4.1, 1.1],
          ['Milo', 4.8, 0.8],
        ],
      ],
      options: {
        'title': 'Percent Stacked Area',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
        'isStacked': 'relative',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };

    testcase.result = createAndSetChartDefinition({
      series: [
        {
          points: [
            {nonScaled: {t: 0.5522388059701493}},
            {nonScaled: {t: 0.7884615384615385}},
            {nonScaled: {t: 0.8571428571428572}},
          ],
        },
        {
          points: [
            {nonScaled: {t: 1}},
            {nonScaled: {t: 1}},
            {nonScaled: {t: 1}},
          ],
        },
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Uncertainty.
   */
  it('Uncertainty test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Uncertainty',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Football score certainty', 'certainty'],
          ['number', 'Basketball score', 'basketball'],
          ['boolean', 'Basketball score certainty', 'certainty'],
        ],
        [
          ['Danny', 3.7, 0, 3.0, true],
          ['Betty', 4.1, 1, 1.1, false],
          ['Milo', 4.8, 0.5, null, true],
        ],
      ],
      options: {
        'title': 'Uncertainty',
        'type': 'function',
        'orientation': 'horizontal',
        'pointSize': 7,
        'series': {0: {'type': 'bars'}, 1: {'type': 'line'}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    // compare only what's relevant for uncertainty.
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          columns: {'data': [1], 'certainty': [2]},
          points: [
            {
              certainty: 0,
              brush: new Brush({
                fill: DEFAULT_DISCRETE_COLORS[0]['color'],
                pattern: new Pattern(
                  PatternStyle.PRIMARY_DIAGONAL_STRIPES,
                  DEFAULT_DISCRETE_COLORS[0]['color'],
                ),
              }),
              incomingLineBrush: new Brush({
                stroke: DEFAULT_DISCRETE_COLORS[0]['color'],
                strokeWidth: 2,
                strokeDashStyle: StrokeDashStyleType.DASH,
              }),
            },
            {},
            {
              certainty: 0.5,
              brush: new Brush({
                fill: DEFAULT_DISCRETE_COLORS[0]['color'],
                pattern: new Pattern(
                  PatternStyle.PRIMARY_DIAGONAL_STRIPES,
                  DEFAULT_DISCRETE_COLORS[0]['color'],
                ),
              }),
              incomingLineBrush: new Brush({
                stroke: DEFAULT_DISCRETE_COLORS[0]['color'],
                strokeWidth: 2,
                strokeDashStyle: StrokeDashStyleType.DASH,
              }),
            },
          ],
        },
        {
          columns: {'data': [3], 'certainty': [4]},
          points: [
            {},
            {
              certainty: 0,
              brush: new Brush({
                stroke: DEFAULT_DISCRETE_COLORS[1]['color'],
                strokeWidth: 1,
                fill: DEFAULT_DISCRETE_COLORS[1]['color'],
                pattern: new Pattern(
                  PatternStyle.PRIMARY_DIAGONAL_STRIPES,
                  DEFAULT_DISCRETE_COLORS[1]['color'],
                ),
              }),
              incomingLineBrush: new Brush({
                stroke: DEFAULT_DISCRETE_COLORS[1]['color'],
                strokeWidth: 2,
                strokeDashStyle: StrokeDashStyleType.DASH,
              }),
            },
            {},
          ],
        },
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * Scope & Emphasis.
   */
  it('ScopeEmphasis test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Scope & Emphasis',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['boolean', 'Football score scope', 'scope'],
          ['number', 'Football score emphasis', 'emphasis'],
          ['number', 'Basketball score', 'basketball'],
          ['boolean', 'Basketball score emphasis', 'emphasis'],
        ],
        [
          ['Danny', 3.7, true, 1, 3.0, true],
          ['Betty', 4.1, false, 3, 1.1, true],
          ['Milo', 4.8, false, 3, 3, false],
        ],
      ],
      options: {
        'title': 'Scope',
        'type': 'function',
        'orientation': 'horizontal',
        'pointSize': 7,
        'series': {0: {'type': 'area'}, 1: {'type': 'line'}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    // Scope & Emphasis test: compare only what's relevant for these.
    const grayedOutColor = grayOutColor(DEFAULT_DISCRETE_COLORS[0]['color']);
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          columns: {'data': [1], 'scope': [2], 'emphasis': [3]},
          points: [
            {},
            {
              emphasis: 3,
              scope: false,
              radius: 7.8, // The rounding of 4.5 * sqrt(3) with 1 digit.
              brush: new Brush({fill: grayedOutColor}),
            },
            {
              emphasis: 3,
              scope: false,
              radius: 7.8,
              brush: new Brush({fill: grayedOutColor}),
              incomingLineBrush: new Brush({
                stroke: grayedOutColor,
                strokeWidth: 6,
              }),
              incomingAreaBrush: new Brush({
                fill: grayedOutColor,
                fillOpacity: 0.3,
              }),
            },
          ],
        },
        {
          columns: {'data': [4], 'emphasis': [5]},
          points: [
            {
              emphasis: 2,
              radius: 6.4,
            }, // The rounding of 4.5 * sqrt(2) with 1 digit.
            {
              emphasis: 2,
              radius: 6.4,
              incomingLineBrush: new Brush({
                stroke: DEFAULT_DISCRETE_COLORS[1]['color'],
                strokeWidth: 8,
              }),
            },
            {},
          ],
        },
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * Single point line chart.
   */
  it('SinglePointLine test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Single point line chart',
      data: [
        [
          ['string', 'Name'],
          ['number', 'Value'],
        ],
        [['a1', 1]],
      ],
      options: {
        'title': 'Single point line chart',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
      },
      width: 250,
      height: 150,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY,
          baseline: null,
          dataDirection: 1,
          gridlines: compareOnlyArraySize(0),
          text: [{textBlock: {text: 'a1'}}],
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            isVisible: true,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(5),
          text: compareOnlyArraySize(3),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * The single-point/no-points tests only verify that no assertions are
   * thrown.
   */
  it('SinglePointArea test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Single point area chart',
      data: [
        [
          ['string', 'Name'],
          ['number', 'Value'],
        ],
        [['a1', 1]],
      ],
      options: {
        'title': 'Single point area chart',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
      },
      width: 250,
      height: 150,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY,
          baseline: null,
          dataDirection: 1,
          gridlines: compareOnlyArraySize(0),
          text: [{textBlock: {text: 'a1'}}],
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            isVisible: true,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(5),
          text: compareOnlyArraySize(3),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * No points line chart.
   */
  it('NoPointsLine test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'No points line chart',
      data: [
        [
          ['string', 'Name'],
          ['number', 'Value'],
        ],
        [],
      ],
      options: {
        'title': 'No points line chart',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
      },
      width: 250,
      height: 150,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY,
          baseline: null,
          dataDirection: 1,
          gridlines: compareOnlyArraySize(0),
          text: [],
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            isVisible: true,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(5),
          text: compareOnlyArraySize(3),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * Single datetime point line chart.
   */
  it('SingleDateTimePointLine test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Single datetime point line chart',
      data: [
        [
          ['string', 'Name'],
          ['datetime', 'Value'],
        ],
        [['a1', new Date(2000, 0, 1)]],
      ],
      options: {
        'title': 'Single datetime point line chart',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
      },
      width: 250,
      height: 150,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY,
          baseline: null,
          dataDirection: 1,
          gridlines: compareOnlyArraySize(0),
          text: [{textBlock: {text: 'a1'}}],
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: null,
            isVisible: true,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(8),
          text: compareOnlyArraySize(3),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Multi x axis test. Compares only what's relevant.
   */
  it('MultiXAxis test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Multi x axis',
      data: [
        [
          ['string', 'd1', ''],
          ['number', 'd1v1', ''],
          ['number', 'd1v2', ''],
          ['string', 'd2', 'domain'],
          ['number', 'd2v1', ''],
          ['string', 'd3', 'domain'],
          ['number', 'd3v1', ''],
        ],
        [['c1', 0, 1, 'c2', 2, 'c3', 3]],
      ],
      options: {
        'title': 'Multi x axis',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          domainIndex: 0,
        },
        {
          domainIndex: 0,
        },
        {
          domainIndex: 1,
        },
        {
          domainIndex: 2,
        },
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Date-number scatter.
   */
  it('DateNumberScatter test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Date-number scatter',
      data: [
        [
          ['date', 'Date'],
          ['number', 'Excitement'],
        ],
        [
          [new Date(2011, 7, 14), 0.5],
          [new Date(2011, 7, 31), 0.92],
          [new Date(2011, 8, 11), 0.71],
        ],
      ],
      options: {
        'title': 'Date-number scatter',
        'type': 'scatter',
        'hAxis': {'formatOptions': {'day': 'MMM d', 'month': 'MMM d'}},
      },
      width: 400,
      height: 400,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      chartType: ChartType.FUNCTION,
      targetAxisToDataType: {0: 'number'},
      categories: compareOnlyArraySize(3),
      dataTableToCategoryMap: {0: 0, 1: 1, 2: 2},
      domainsColumnStructure: [{columns: {'domain': [0]}, 'dataType': 'date'}],
      domainDataType: 'date',
      series: compareOnlyArraySize(1),
      dataTableColumnRoleInfo: compareOnlyArraySize(2),
      legendEntries: compareOnlyArraySize(1),
      serieTypeCount: {'line': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: null,
            coordinate: Infinity,
            isVisible: true,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(7),
          text: [
            {textBlock: {text: 'September 2011'}},
            {textBlock: {text: '8'}},
            {textBlock: {text: '15'}},
            {textBlock: {text: '22'}},
            {textBlock: {text: '12'}},
          ],
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            isVisible: false,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(11),
          text: compareOnlyArraySize(6),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Number-number line.
   */
  it('NumberNumberLine test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Number-number line',
      data: [
        [
          ['number', 'Label'],
          ['number', 'Excitement'],
        ],
        [
          [1, 3],
          [2.5, 7.5],
          [6.33, 19],
        ],
      ],
      options: {
        'title': 'Number-number line',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      width: 400,
      height: 200,
      targetAxisToDataType: {0: 'number'},
      categories: compareOnlyArraySize(3),
      dataTableToCategoryMap: {0: 0, 1: 1, 2: 2},
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'number'},
      ],
      domainDataType: 'number',
      series: compareOnlyArraySize(1),
      dataTableColumnRoleInfo: compareOnlyArraySize(2),
      legendEntries: compareOnlyArraySize(1),
      serieTypeCount: {'line': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            coordinate: 17.593808630393994,
            isVisible: false,
          },
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: compareOnlyArraySize(7),
          text: compareOnlyArraySize(3),
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            coordinate: 161.5,
            isVisible: true,
          },
          dataDirection: 1,
          startPos: 161.5,
          endPos: 38,
          gridlines: compareOnlyArraySize(5),
          text: compareOnlyArraySize(3),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for empty data, no data rows.
   *     Motivation: infinite loop might occur with no data rows.
   */
  it('EmptyData test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Empty data',
      data: [
        [
          ['number', 'Label'],
          ['number', 'Excitement'],
        ],
        [],
      ],
      options: {
        'title': 'Empty data',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
        'vAxis': {'gridlines': {'count': -1}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      width: 400,
      height: 200,
      targetAxisToDataType: {0: 'number'},
      categories: compareOnlyArraySize(0),
      dataTableToCategoryMap: {},
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'number'},
      ],
      domainDataType: 'number',
      series: compareOnlyArraySize(1),
      dataTableColumnRoleInfo: compareOnlyArraySize(2),
      legendEntries: compareOnlyArraySize(1),
      serieTypeCount: {'line': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            coordinate: 67.5,
            isVisible: true,
          },
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: compareOnlyArraySize(5),
          text: compareOnlyArraySize(3),
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            coordinate: 161.5,
            isVisible: true,
          },
          dataDirection: 1,
          startPos: 161.5,
          endPos: 38,
          gridlines: compareOnlyArraySize(5),
          text: compareOnlyArraySize(3),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for all null target data values.
   *     Motivation: infinite loop might occur with null data,
   *     perhaps with multiple columns.
   */
  it('NullData test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Null data',
      data: [
        [
          ['string', 'Label'],
          ['number', 'Calories'],
          ['number', 'Sugar'],
          ['number', 'Fiber'],
        ],
        [
          ['Apple', null, null, null],
          ['Banana', null, null, null],
          ['Carrot', null, null, null],
        ],
      ],
      options: {
        'title': 'Null data',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
      },
      // TODO(dlaliberte): log and mirror log are failing badly with no data.
      // 'vAxis': { 'scaleType': 'mirrorLog' }
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      width: 400,
      height: 200,
      targetAxisToDataType: {0: 'number'},
      categories: compareOnlyArraySize(3),
      dataTableToCategoryMap: {},
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      domainDataType: 'string',
      series: compareOnlyArraySize(3),
      dataTableColumnRoleInfo: compareOnlyArraySize(4),
      legendEntries: compareOnlyArraySize(3),
      serieTypeCount: {'line': 3},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY,
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: [],
          text: compareOnlyArraySize(3),
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: 0,
            coordinate: 161.5,
            isVisible: true,
          },
          dataDirection: 1,
          startPos: 161.5,
          endPos: 38,
          gridlines: compareOnlyArraySize(5),
          text: compareOnlyArraySize(3),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Date-date line.
   */
  it('DateDateLine test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Date-date line',
      data: [
        [
          ['date', 'Date1'],
          ['date', 'Date2'],
        ],
        [
          [new Date(2011, 7, 14), new Date(2011, 8, 14)],
          [new Date(2011, 7, 31), new Date(2011, 8, 31)],
          [new Date(2011, 8, 11), new Date(2011, 9, 11)],
        ],
      ],
      options: {
        'title': 'Date-date line',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
        'gridlines': {'count': 5},
      },
      width: 400,
      height: 400,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      width: 400,
      height: 400,
      targetAxisToDataType: {0: 'date'},
      categories: compareOnlyArraySize(3),
      dataTableToCategoryMap: {0: 0, 1: 1, 2: 2},
      domainsColumnStructure: [{columns: {'domain': [0]}, 'dataType': 'date'}],
      domainDataType: 'date',
      series: compareOnlyArraySize(1),
      dataTableColumnRoleInfo: compareOnlyArraySize(2),
      legendEntries: compareOnlyArraySize(1),
      serieTypeCount: {'line': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: null,
            coordinate: Infinity,
            isVisible: true,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(33),
          text: compareOnlyArraySize(4),
        },
      },
      vAxes: {
        0: {
          name: 'vAxis#0',
          type: AxisType.VALUE,
          baseline: {
            dataValue: null,
            coordinate: Infinity,
            isVisible: true,
          },
          dataDirection: 1,
          gridlines: compareOnlyArraySize(7),
          text: compareOnlyArraySize(7),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Half-strict view window (min) - category-point.
   */
  it('MinCategoryPoint test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Half-strict view window (min) - category-point',
      data: [
        [
          ['string', 'Category'],
          ['number', 'Excitement'],
        ],
        [
          ['A', 0.5],
          ['B', 0.92],
          ['C', 0.71],
          ['D', 0.98],
        ],
      ],
      options: {
        'title': 'Half-strict view window (min) - category-point',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
        'hAxis': {'viewWindow': {'min': 1}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      categories: compareOnlyArraySize(4),
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      serieTypeCount: {'area': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY_POINT,
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: [],
          text: [
            {
              dataValue: 'A',
              textBlock: {anchor: new Coordinate(-65.5, 162)},
            },
            {
              dataValue: 'B',
              textBlock: {anchor: new Coordinate(67.5, 162)},
            },
            {
              dataValue: 'C',
              textBlock: {anchor: new Coordinate(200.5, 162)},
            },
            {
              dataValue: 'D',
              textBlock: {anchor: new Coordinate(333.5, 162)},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Half-strict view window (max) - category-point.
   */
  it('MaxCategoryPoint test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Half-strict view window (max) - category-point',
      data: [
        [
          ['string', 'Category'],
          ['number', 'Excitement'],
        ],
        [
          ['A', 0.5],
          ['B', 0.92],
          ['C', 0.71],
          ['D', 0.98],
        ],
      ],
      options: {
        'title': 'Half-strict view window (max) - category-point',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
        'hAxis': {'viewWindow': {'max': 3}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      categories: compareOnlyArraySize(4),
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      serieTypeCount: {'area': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY_POINT,
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: [],
          text: [
            {
              dataValue: 'A',
              textBlock: {anchor: new Coordinate(67.5, 162)},
            },
            {
              dataValue: 'B',
              textBlock: {anchor: new Coordinate(200.5, 162)},
            },
            {
              dataValue: 'C',
              textBlock: {anchor: new Coordinate(333.5, 162)},
            },
            {
              dataValue: 'D',
              textBlock: {anchor: new Coordinate(466.5, 162)},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Half-strict external view window (min) - category-point.
   */
  it('ExternalMinCategoryPoint test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Half-strict external view window (min) - category-point',
      data: [
        [
          ['string', 'Category'],
          ['number', 'Excitement'],
        ],
        [
          ['A', 0.5],
          ['B', 0.92],
          ['C', 0.71],
          ['D', 0.98],
        ],
      ],
      options: {
        'title': 'Half-strict external view window (min) - category-point',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
        'hAxis': {'viewWindow': {'min': -1}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      categories: compareOnlyArraySize(4),
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      serieTypeCount: {'area': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY_POINT,
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: [],
          text: [
            {
              dataValue: 'A',
              textBlock: {anchor: new Coordinate(134, 162)},
            },
            {
              dataValue: 'B',
              textBlock: {anchor: new Coordinate(200.5, 162)},
            },
            {
              dataValue: 'C',
              textBlock: {anchor: new Coordinate(267, 162)},
            },
            {
              dataValue: 'D',
              textBlock: {anchor: new Coordinate(333.5, 162)},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Half-strict external view window (max) - category-point.
   */
  it('ExternalMaxCategoryPoint test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Half-strict external view window (max) - category-point',
      data: [
        [
          ['string', 'Category'],
          ['number', 'Excitement'],
        ],
        [
          ['A', 0.5],
          ['B', 0.92],
          ['C', 0.71],
          ['D', 0.98],
        ],
      ],
      options: {
        'title': 'Half-strict external view window (max) - category-point',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
        'hAxis': {'viewWindow': {'max': 5}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      categories: compareOnlyArraySize(4),
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      serieTypeCount: {'area': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY_POINT,
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: [],
          text: [
            {
              dataValue: 'A',
              textBlock: {anchor: new Coordinate(67.5, 162)},
            },
            {
              dataValue: 'B',
              textBlock: {anchor: new Coordinate(134, 162)},
            },
            {
              dataValue: 'C',
              textBlock: {anchor: new Coordinate(200.5, 162)},
            },
            {
              dataValue: 'D',
              textBlock: {anchor: new Coordinate(267, 162)},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Half-strict empty view window (min) - category-point.
   */
  it('EmptyMinCategoryPoint test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Half-strict empty view window (min) - category-point',
      data: [
        [
          ['string', 'Category'],
          ['number', 'Excitement'],
        ],
        [
          ['A', 0.5],
          ['B', 0.92],
          ['C', 0.71],
          ['D', 0.98],
        ],
      ],
      options: {
        'title': 'Half-strict empty view window (min) - category-point',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
        'hAxis': {'viewWindow': {'min': 5}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      categories: compareOnlyArraySize(4),
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      serieTypeCount: {'area': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY_POINT,
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: [],
          // Just make sure the categories exist - their anchor should be
          // outside the chart area (negative).
          text: [
            {
              dataValue: 'A',
              textBlock: {anchor: new Coordinate(-1262.5, 162)},
            },
            {
              dataValue: 'B',
              textBlock: {anchor: new Coordinate(-996.5, 162)},
            },
            {
              dataValue: 'C',
              textBlock: {anchor: new Coordinate(-730.5, 162)},
            },
            {
              dataValue: 'D',
              textBlock: {anchor: new Coordinate(-464.5, 162)},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Half-strict empty view window (max) - category-point.
   */
  it('EmptyMaxCategoryPoint test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Half-strict empty view window (max) - category-point',
      data: [
        [
          ['string', 'Category'],
          ['number', 'Excitement'],
        ],
        [
          ['A', 0.5],
          ['B', 0.92],
          ['C', 0.71],
          ['D', 0.98],
        ],
      ],
      options: {
        'title': 'Half-strict empty view window (max) - category-point',
        'type': 'function',
        'seriesType': 'area',
        'orientation': 'horizontal',
        'hAxis': {'viewWindow': {'max': -1}},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      categories: compareOnlyArraySize(4),
      domainsColumnStructure: [
        {columns: {'domain': [0]}, 'dataType': 'string'},
      ],
      serieTypeCount: {'area': 1},
      hAxes: {
        0: {
          name: 'hAxis#0',
          type: AxisType.CATEGORY_POINT,
          baseline: null,
          dataDirection: 1,
          startPos: 67.5,
          endPos: 334,
          gridlines: [],
          // Just make sure the categories exist - their anchor should be
          // outside the chart area (positive).
          text: [
            {
              dataValue: 'A',
              textBlock: {anchor: new Coordinate(599.5, 162)},
            },
            {
              dataValue: 'B',
              textBlock: {anchor: new Coordinate(865.5, 162)},
            },
            {
              dataValue: 'C',
              textBlock: {anchor: new Coordinate(1131.5, 162)},
            },
            {
              dataValue: 'D',
              textBlock: {anchor: new Coordinate(1397.5, 162)},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for TimeOfDay stuff.
   */
  it('TimeOfDay test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'TimeOfDay stuff',
      data: [
        [
          ['string', 'Label'],
          ['timeofday', 'Time'],
        ],
        [
          ['A', [1, 2, 3, 4]],
          ['B', [32, 3, 4, 5]],
        ],
      ],
      options: {
        'title': 'TimeOfDay stuff',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
        'vAxis': {
          'direction': -1,
        },
      },
      width: 400,
      height: 400,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      vAxes: {
        0: {
          text: [
            {
              textBlock: {text: '00:00'},
            },
            {
              textBlock: {text: '06:00'},
            },
            {
              textBlock: {text: '12:00'},
            },
            {
              textBlock: {text: '18:00'},
            },
            {
              textBlock: {text: '00:00'},
            },
            {
              textBlock: {text: '06:00'},
            },
            {
              textBlock: {text: '12:00'},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Undefined titles inside chart area.
   */
  it('UndefinedTitles test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Undefined titles inside chart area',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Look mama no titles!', 'notitle'],
        ],
        [['Danny', 3.7]],
      ],
      options: {
        'title': 'Undefined titles inside chart area',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
        'titlePosition': 'in',
        'axisTitlesPosition': 'in',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = DONT_COMPARE;
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Maximized bar chart w/o v-axis labels.
   */
  it('MaximizedBarChart test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Maximized bar chart w/o v-axis labels',
      data: [
        [
          ['string', 'Name'],
          ['number', 'Value'],
        ],
        [
          ['', 3.7],
          ['', 4.1],
          ['', 4.8],
        ],
      ],
      options: {
        'title': 'Maximized bar chart w/o v-axis labels',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'vertical',
        'theme': 'maximized',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = DONT_COMPARE;
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Minor gridlines.
   */
  it('MinorGridlines test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Minor gridlines',
      ignoreUnexpectedFields: true,
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Basketball score', 'basketball'],
        ],
        [
          ['Danny', 3.7, 3.0],
          ['Betty', 4.1, 1.1],
          ['Milo', 4.8, 0.8],
        ],
      ],
      options: {
        'title': 'Minor gridlines',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'vAxis': {
          'gridlines': {'count': 7, 'minSpacing': 20},
          'minorGridlines': {'count': 1},
        },
      },
      width: 400,
      height: 200,
    };
    testcase.result = createAndSetChartDefinition({
      vAxes: {
        0: {
          gridlines: compareOnlyArraySize(11),
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Explicit tick values.
   */
  it('ExplicitTicks test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Explicit Ticks',
      data: [
        [
          ['number', 'Achievement', 'score'],
          ['date', 'First achieved', 'date'],
          ['timeofday', 'Time', 'time'],
        ],
        [
          [3.7, new Date(1990, 1, 23), [14, 30, 23]],
          [4.1, new Date(1991, 11, 14), [10, 23, 14, 555]],
          [40.8, new Date(2001, 9, 11), [8, 46, 0]],
          [400.8, new Date(1993, 2, 26), [12, 0, 0]],
        ],
      ],
      options: {
        'title': 'Explicit ticks',
        'type': 'function',
        'seriesType': 'lines',
        'orientation': 'horizontal',
        'hAxis': {
          'logScale': true,
          'direction': -1,
          'ticks': [2, 20, 200, {v: 2000, f: '2K'}],
          'minorGridlines': {'count': 2},
        },
        'series': [{'targetAxisIndex': 0}, {'targetAxisIndex': 1}],
        vAxes: {
          0: {
            'direction': -1,
            'ticks': [
              new Date(1990, 1, 1),
              {v: new Date(2000, 1, 1), f: 'Y2K'},
              new Date(1995, 1, 1), // Out of order is ok
              new Date(2005, 1, 1),
              new Date(2010, 1, 1),
            ],
            'minValue': new Date(1984, 1, 1),
            'viewWindow': {max: new Date(2008, 1, 1)},
            'minorGridlines': {'count': 4},
          },
          1: {
            'direction': 1,
            'ticks': [
              [0, 0, 0],
              [18, 0, 0],
              [6, 0, 0], // Out of order is ok
              {v: [12, 0, 0], f: 'noon'},
              {v: [24, 0, 0], f: 'midnight'},
            ],
          },
        },
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      hAxes: {
        0: {
          gridlines: compareOnlyArraySize(4),
          text: [
            {
              textBlock: {text: '2K'},
            },
            {
              textBlock: {text: '200'},
            },
            {
              textBlock: {text: '20'},
            },
            {
              textBlock: {text: '2'},
            },
          ],
        },
      },
      vAxes: {
        0: {
          gridlines: compareOnlyArraySize(3),
          text: [
            {
              textBlock: {text: '1990'},
            },
            {
              textBlock: {text: '1995'},
            },
            {
              textBlock: {text: 'Y2K'},
            },
            {
              textBlock: {text: '2005'},
            },
          ],
        },
        1: {
          gridlines: compareOnlyArraySize(28),
          text: [
            {
              textBlock: {text: '00:00'},
            },
            {
              textBlock: {text: '06:00'},
            },
            {
              textBlock: {text: 'noon'},
            },
            {
              textBlock: {text: '18:00'},
            },
            {
              textBlock: {text: 'midnight'},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for minValue, maxValue, and baseline value tests.
   */
  it('MinMaxBaseline test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Min/Max/Baseline value',
      data: [
        [
          ['number', 'Achievement', 'score'],
          ['date', 'First achieved', 'date'],
          ['timeofday', 'Time', 'time'],
        ],
        [
          [3.7, new Date(1990, 1, 23), [14, 30, 23]],
          [4.1, new Date(1991, 11, 14), [10, 23, 14, 555]],
          [40.8, new Date(2001, 9, 11), [8, 46, 0]],
          [400.8, new Date(1993, 2, 26), [12, 0, 0]],
        ],
      ],
      options: {
        'title': 'Test minValue, maxValue, baseline',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'hAxis': {
          'direction': -1,
        },
        'series': [{'targetAxisIndex': 0}, {'targetAxisIndex': 1}],
        vAxes: {
          0: {
            'direction': -1,
            'baseline': new Date(1988, 1, 1),
            'minValue': new Date(1984, 1, 1),
            'maxValue': new Date(2013, 1, 1),
            'viewWindow': {max: new Date(2008, 1, 1)},
          },
          1: {
            'direction': -1,
            'baseline': [0, 0, 0],
            'minValue': [0, 0, 0],
            'maxValue': [15, 0, 0],
          },
        },
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      hAxes: {
        0: {
          gridlines: compareOnlyArraySize(6),
        },
      },
      vAxes: {
        0: {
          gridlines: compareOnlyArraySize(3),
          text: [
            {
              textBlock: {text: '1980'},
            },
            {
              textBlock: {text: '1990'},
            },
            {
              textBlock: {text: '2000'},
            },
          ],
        },
        1: {
          gridlines: compareOnlyArraySize(25),
          text: [
            {
              textBlock: {text: '00:00'},
            },
            {
              textBlock: {text: '12:00'},
            },
          ],
        },
      },
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Empty (and whitespace only) annotations.
   */
  it('EmptyAnnotations test', () => {
    const testcase: ChartDefinerTestCase = {
      // b/6037138
      name: 'Empty and whitespace only annotations',
      ignoreUnexpectedFields: true,
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['string', 'Comment', 'annotation'],
        ],
        [
          ['', 1, ''],
          [' ', 2, ' '],
          ['\t', 3, '\t'],
          ['\n', 4, '\n'],
        ],
      ],
      options: {
        'title': 'Empty and whitespace only annotations',
        'type': 'function',
        'seriesType': 'line',
        'orientation': 'horizontal',
      },
      width: 400,
      height: 200,
    };
    testcase.result = DONT_COMPARE;
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Bar dropping.  We no longer drop bars if they can be squeezed in.
   */
  it('BarDropping test', () => {
    const testcase: ChartDefinerTestCase = {
      // b/6294011
      name: 'Bar dropping',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Basketball score', 'basketball'],
        ],
        [
          ['Danny', 3.7, 3.0],
          ['Betty', 4.1, 1.1],
          ['Milo', 4.8, 0.8],
        ],
      ],
      options: {
        'title': 'Bar dropping',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'vertical',
        'chartArea': {'height': 10},
      },
      width: 400,
      height: 50,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          points: [
            {scaled: {height: 0.5}},
            {scaled: {height: 0.5}},
            {scaled: {height: 0.5}},
          ],
        },
        {
          points: [{scaled: {}}, {scaled: {}}, {scaled: {}}],
        },
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * @return The data opacity test case.
   */
  it('DataOpacity test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Point opacity',
      data: [
        [
          ['number', 'X'],
          ['number', 'Y'],
        ],
        [
          [1, 3],
          [4, 5],
          [7, 9],
        ],
      ],
      options: {
        'title': 'Point opacity',
        'type': 'scatter',
        'dataOpacity': 0.5,
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          pointBrush: new Brush({
            fill: DEFAULT_DISCRETE_COLORS[0]['color'],
            fillOpacity: 0.5,
          }),
        },
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Number-number bars.
   */
  it('NumberNumberBars test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Number-number bars',
      data: [
        [
          ['number', 'Label'],
          ['number', 'Serie #1'],
          ['number', 'Serie #2'],
        ],
        [
          [1, 3, 10],
          [2.5, 7.5, 2],
          [6.33, 19, 11.5],
        ],
      ],
      options: {
        'title': 'Number-number bars',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'hAxis': {'ticks': [1, 2.5, 6.33]},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          points: [
            {scaled: {width: 17, left: 79}, nonScaled: {d: 1}},
            {scaled: {width: 18, left: 137}, nonScaled: {d: 2.5}},
            {scaled: {width: 18, left: 286}, nonScaled: {d: 6.33}},
          ],
        },
        {},
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for variable-width bars.
   */
  it('VariableWidthBars test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Variable-width bars',
      data: [
        [
          ['number', 'Label'],
          ['number', 'Serie #1'],
          ['number', 'Serie #2'],
        ],
        [
          [1, 3, 10],
          [2.5, 7.5, 2],
          [6.33, 19, 11.5],
        ],
      ],
      options: {
        'title': 'Variable-width bars',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'bar': {'variableWidth': true},
        'isStacked': true,
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          points: [
            {scaled: {width: 42, left: 67}, nonScaled: {d: 1}},
            {scaled: {width: 63, left: 109}, nonScaled: {d: 2.5}},
            {scaled: {width: 161, left: 172}, nonScaled: {d: 6.33}},
          ],
        },
        {},
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for a bar chart with one row of data.
   */
  it('OneRowBars test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'One Row bars',
      data: [
        [
          ['number', 'Label'],
          ['number', 'Serie #1'],
          ['number', 'Serie #2'],
        ],
        [[1, 3, 10]],
      ],
      options: {
        'title': 'One row of data bars',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'hAxis': {
          gridlines: {'count': -1},
        },
        'vAxis': {
          gridlines: {'count': 1},
        },
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          points: [{scaled: {width: 82, left: 118}, nonScaled: {d: 1}}],
        },
        {},
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   *     for Right-to-left discrete columns.
   */
  it('RightToLeftDiscreteColumns test', () => {
    const testcase: ChartDefinerTestCase = {
      name: 'Right-to-left discrete columns',
      data: [
        [
          ['string', 'Name', 'name'],
          ['number', 'Football score', 'football'],
          ['number', 'Basketball score', 'basketball'],
        ],
        [
          ['Danny', 3.7, 3.0],
          ['Betty', 4.1, 1.1],
          ['Milo', 4.8, 0.8],
        ],
      ],
      options: {
        'title': 'Right-to-left discrete columns',
        'type': 'function',
        'seriesType': 'bars',
        'orientation': 'horizontal',
        'hAxis': {'direction': -1},
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          points: [
            {scaled: {width: 27, left: 262}},
            {scaled: {width: 27, left: 173}},
            {scaled: {width: 27, left: 84}},
          ],
        },
        {},
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * for diff bars
   */
  it('DiffBars', () => {
    const oldData = arrayToDataTable([
      ['Name', 'Popularity'],
      ['Cesar', 250],
      ['Rachel', 4200],
      ['Patrick', 2900],
      ['Eric', 8200],
    ]);

    const newData = arrayToDataTable([
      ['Name', 'Popularity'],
      ['Cesar', 370],
      ['Rachel', 600],
      ['Patrick', 700],
      ['Eric', 1500],
    ]);

    const diffData = BarChart.prototype.computeDiff(oldData, newData);

    const testcase: ChartDefinerTestCase = {
      name: 'Diff chart for bars',
      data: diffData,
      options: {
        title: 'Diff chart for bars',
        type: 'function',
        seriesType: 'bars',
        orientation: 'horizontal',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          columns: Object({data: [2]}),
          type: 'bars',
          labelInLegend: 'Popularity',
        },
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  /**
   * for diff scatter
   */
  it('DiffScatter', () => {
    const oldData = arrayToDataTable([
      ['Age', 'Weight', 'Height'],
      [8, 48, 48],
      [4, 30, 39],
      [11, 70, 52],
      [3, 26, 36],
      [6, 40, 44],
    ]);

    const newData = arrayToDataTable([
      ['Age', 'Weight', 'Height'],
      [8, 66, 52],
      [4, 42, 41],
      [11, 79, 54],
      [3, 36, 38],
      [6, 52, 46],
    ]);

    const diffData = ScatterChart.prototype.computeDiff(oldData, newData);

    const testcase: ChartDefinerTestCase = {
      name: 'Diff chart for scatter',
      data: diffData,
      options: {
        title: 'Diff chart for scatter',
        type: 'scatter',
        seriesType: 'scatter',
        isDiff: true,
        orientation: 'horizontal',
      },
      width: 400,
      height: 200,
      ignoreUnexpectedFields: true,
    };
    testcase.result = createAndSetChartDefinition({
      series: [
        {
          columns: {'old-data': [2]},
          type: 'scatter',
          pointShape: {type: 'circle'},
        },
        {},
        {},
        {},
      ],
    });
    runChartDefinerTestCase(testcase);
  });

  // Should be moved to chart-definition-interpolator_test
  // tslint:disable-next-line:ban
  xdescribe('test ChartDefinitionInterpolation', () => {
    const linearChartOptions = {
      'title': 'Interpolated Chart (Linear)',
      'animation': {duration: 1000},
      'type': ChartType.FUNCTION,
      'orientation': 'horizontal',
      'vAxis': {baseline: 0},
    };

    const logChartOptions = {
      'title': 'Interpolated Chart (Log)',
      'animation': {duration: 1000},
      'type': ChartType.FUNCTION,
      'orientation': 'horizontal',
      'vAxis': {logScale: true, baseline: Infinity},
    };

    const container = createElement('div');
    setStyle(container, 'width', `${200}px`);
    setStyle(container, 'height', `${200}px`);
    appendChild(document.body, container);

    // Test interpolation between a linear chart and a log chart and then
    // interpolating back to a linear chart before the first
    // interpolation is finished. There should be no errors or asserts
    // during this interpolation process.
    let callback: Function;
    const chart = new ComboChart(container);
    gvizEvents.addListener(chart, 'animationfinish', () => {
      if (callback) callback();
    });
    const dt = createDataTable(
      [
        ['number', 'x'],
        ['number', 'y'],
      ],
      [[100, 100]],
    );

    it('first draw', (done) => {
      callback = done;
      chart.draw(dt, linearChartOptions);
    });

    it('change to log chart', (done) => {
      callback = done;
      chart.draw(dt, logChartOptions);
    });

    it('change back to linear chart', (done) => {
      callback = done;
      chart.draw(dt, linearChartOptions);
    });

    it('verify', (done) => {
      const finalChartDef = chart.getChartDefinition();
      assertNotEquals(finalChartDef!.vAxes![0]!.baseline!.coordinate, Infinity);
    });
  });

  it('ChartDefinerInitWithoutInterrupt', () => {
    return new Promise<void>((resolve) => {
      const afterInit = () => {
        resolve();
      };
      const makeChartDefiner = () =>
        createChartDefiner(
          createDataTable(
            [
              ['string', 'S'],
              ['number', 'N'],
            ],
            [
              ['A', 3],
              ['B', null],
              ['C', 5],
            ],
          ),
          new GvizOptions([
            {
              'async': 0, // Force async
              'type': 'function',
              'seriesType': 'area',
              'orientation': 'horizontal',
            },
            DEFAULTS,
          ]),
          400,
          200,
          null,
          afterInit,
        );
      expect(makeChartDefiner).not.toThrow();
    });
  });

  it('ChartDefinerInitWithInterrupt', () => {
    // getActiveTestCase().promiseTimeout = 15000;
    return new Promise<void>((resolve, reject) => {
      // Create div to contain the error message.
      const container = createElement('div');
      appendChild(document.body, container);
      const eventHandler = new EventHandler();

      let errorHandlerCalled = false;
      gvizEvents.addListener(eventHandler, 'error', () => {
        errorHandlerCalled = true;
      });

      // Create asyncWrapper, and everything it requires.
      const errorHandler = new ErrorHandler(eventHandler, container);
      const asyncHelper = new AsyncHelper(errorHandler);
      const asyncWrapper = asyncHelper.wrapCallback.bind(asyncHelper);

      let afterInitCalled = false;
      const afterInit = (chartDef: AnyDuringMigration) => {
        afterInitCalled = true;
      };
      createChartDefiner(
        createDataTable(
          [
            ['string', 'S'],
            ['number', 'N'],
          ],
          [
            ['A', 3],
            ['B', null],
            ['C', 5],
          ],
        ),
        new GvizOptions([
          {
            'async': 0, // Force async
            'type': 'function',
            'seriesType': 'area',
            'orientation': 'horizontal',
          },
          DEFAULTS,
        ]),
        400,
        200,
        asyncWrapper,
        afterInit,
      );

      // Cause the interrupt
      asyncHelper.cancelPendingCallbacks();

      // Wait enough time to complete, if it is not interrupted first.
      // TODO(dlaliberte): This is not reliable.  Maybe use callback instead.
      setTimeout(() => {
        assertFalse(
          // afterInit should not have been called
          // in testChartDefinerInitWithInterrupt
          afterInitCalled,
        );
        assertFalse(
          // 'Error handler should not have been called',
          errorHandlerCalled,
        );
        resolve();
      }, 2000);
    });
  }, 10000);

  // This migrated code needs more testing before it can be used.
  // tslint:disable-next-line:ban
  xdescribe('ChartDefiner throws errors', () => {
    /**
     * Catch errors via error event handler on the chart container.
     */
    it('calls the error event handler', () => {
      // Create div to contain the error message.
      const container = createElement('div');
      appendChild(document.body, container);

      // Create asyncWrapper, and everything it requires.
      const eventHandler = new EventHandler();
      const errorHandler = new ErrorHandler(eventHandler, container);
      const asyncHelper = new AsyncHelper(errorHandler);
      const asyncWrapper = asyncHelper.wrapCallback.bind(asyncHelper);

      const makeChartDefiner = (
        afterInit: (chartDef: AnyDuringMigration) => void,
      ) => {
        createChartDefiner(
          createDataTable(
            // String for column 1 will cause error.
            [
              ['number', 'S'],
              ['string', 'N'],
            ],
            [
              [1, '3'],
              [2, null],
              [3, '5'],
            ],
          ),
          new GvizOptions([
            {
              'async': Infinity, // Force synchronous
              'type': 'function',
              'seriesType': 'steppedArea',
              'orientation': 'horizontal',
            },
            DEFAULTS,
          ]),
          400,
          200,
          asyncWrapper,
          afterInit,
        );
      };

      return new Promise<void>((resolve) => {
        gvizEvents.addOneTimeListener(eventHandler, 'error', resolve);

        const afterInit = (chartDef: AnyDuringMigration) => {
          fail('afterInit should not have been called');
        };

        makeChartDefiner(afterInit);
      });
    });

    /**
     * Catch errors via window.onerror.
     */
    it('calls the window.onerror event handler', () => {
      // Create div to contain the error message.
      const container = createElement('div');
      appendChild(document.body, container);

      // Create asyncWrapper, and everything it requires.
      const eventHandler = new EventHandler();
      const errorHandler = new ErrorHandler(eventHandler, container);
      const asyncHelper = new AsyncHelper(errorHandler);
      const asyncWrapper = asyncHelper.wrapCallback.bind(asyncHelper);

      const makeChartDefiner = (
        afterInit: (chartDef: AnyDuringMigration) => void,
      ) => {
        createChartDefiner(
          createDataTable(
            // String for column 1 will cause error.
            [
              ['number', 'S'],
              ['string', 'N'],
            ],
            [
              [1, '3'],
              [2, null],
              [3, '5'],
            ],
          ),
          new GvizOptions([
            {
              'async': 0, // Force asynchronous
              'type': 'function',
              'seriesType': 'steppedArea',
              'orientation': 'horizontal',
            },
            DEFAULTS,
          ]),
          400,
          200,
          asyncWrapper,
          afterInit,
        );
      };

      return new Promise<void>((resolve) => {
        const oldOnError = window.onerror;

        window.onerror = (message, source, lineno, colno, error) => {
          window.onerror = oldOnError;
          // console.info('Error caught by window.onerror', message);
          resolve();
        };

        const afterInit = (chartDef: AnyDuringMigration) => {
          fail('afterInit should not have been called');
        };

        makeChartDefiner(afterInit);
      });
    });

    /**
     * Catch errors via try-catch.
     */
    it('catches the error that was thrown', () => {
      // Create div to contain the error message.
      const container = createElement('div');
      appendChild(document.body, container);

      // Create asyncWrapper, and everything it requires.
      const eventHandler = new EventHandler();
      const errorHandler = new ErrorHandler(eventHandler, container);
      const asyncHelper = new AsyncHelper(errorHandler);
      const asyncWrapper = asyncHelper.wrapCallback.bind(asyncHelper);

      const makeChartDefiner = (
        afterInit: (chartDef: AnyDuringMigration) => void,
      ) => {
        createChartDefiner(
          createDataTable(
            // String for column 1 will cause error.
            [
              ['number', 'S'],
              ['string', 'N'],
            ],
            [
              [1, '3'],
              [2, null],
              [3, '5'],
            ],
          ),
          new GvizOptions([
            {
              'async': Infinity, // Force synchronous
              'type': 'function',
              'seriesType': 'steppedArea',
              'orientation': 'horizontal',
            },
            DEFAULTS,
          ]),
          400,
          200,
          asyncWrapper,
          afterInit,
        );
      };

      return new Promise<void>((resolve) => {
        const afterInit = (chartDef: AnyDuringMigration) => {
          fail('afterInit should not have been called');
        };

        // Must turn *on* DEBUG mode to catch errors "normally".
        // See google.visualization.errors.createProtectedCallback
        const oldDEBUG = goog.DEBUG;
        goog.DEBUG = true;

        try {
          expect(() => {
            makeChartDefiner(afterInit);
          }).toThrow();
        } catch (err: unknown) {
          goog.DEBUG = oldDEBUG;

          // This path is supposed to be used since the error is supposed to
          // occur and be caught here.
          // console.info('Error caught by try-catch', err);
          resolve();
        }
      });
    });
  });

  it('ChartDefinerDualY', () => {
    const chartDef = createChartDefiner(
      createDataTable(
        [
          ['string', 'Name'],
          ['number', 'Height (Meters)'],
          ['number', 'Width (Centimeters)'],
        ],
        [
          ['A', 3, 500],
          ['B', 4, 400],
          ['C', 5, 300],
        ],
      ),
      new GvizOptions([
        {
          'title': 'Workshop chart',
          'type': 'function',
          'seriesType': 'bars',
          'orientation': 'horizontal',
          'series': [{'targetAxisIndex': 0}, {'targetAxisIndex': 1}],
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();
    assertObjectEquals(getKeys({0: null, 1: null}), getKeys(chartDef.vAxes));
    assertObjectEquals(0, chartDef.series![0].targetAxisIndex);
    assertObjectEquals(1, chartDef.series![1].targetAxisIndex);

    // Now test positioning. Make sure the data points are interleaved and not
    // divided to very large ones (the hundreds) and very small ones (the tens)
    const stats = map(chartDef.series, (serie) =>
      reduce(
        serie.points,
        (stats, point) => [
          Math.min(stats[0], point!.scaled!.top),
          Math.max(stats[1], point!.scaled!.top),
        ],
        [Infinity, -Infinity],
      ),
    );

    // Ranges should be interleaved so first min is smaller than second max and
    // second min is smaller than first max.
    assertTrue(stats[0][0] < stats[1][1]);
    assertTrue(stats[1][0] < stats[0][1]);
  });

  it('ChartDefinerScatterCurve', () => {
    const chartDef = createChartDefiner(
      createDataTable(
        [
          ['number', 'Football score'],
          ['number', 'Basketball score'],
        ],
        [
          [10, 0],
          [0, 10],
          [-10, 0],
          [-10, 0],
        ],
      ),
      new GvizOptions([
        {
          'width': 600,
          'height': 400,
          'type': ChartType.SCATTER,
          'curveType': CurveType.CLOSED_PHASE,
          'hAxis': {'type': AxisType.VALUE},
          'vAxis': {'type': AxisType.VALUE},
          'lineWidth': 1,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();
    assertEquals(4, chartDef.series![0].points.length);
    forEach(chartDef.series![0].points, (point) => {
      assertTrue(point!.leftControlPoint != null);
      assertTrue(point!.rightControlPoint != null);
    });
  });

  it('ChartDefinerNullsInAreaDoesNotCrash', () => {
    const chartDef = createChartDefiner(
      createDataTable(
        [
          ['string', 'S'],
          ['number', 'N'],
        ],
        [
          ['A', 3],
          ['B', null],
          ['C', 5],
        ],
      ),
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'area',
          'orientation': 'horizontal',
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();
    assertNotNull(chartDef);
  });

  /**
   * Tests the geometry of bars. See performSpecificBarsGeometryTest() for
   * details.
   */
  it('ChartDefinerBarsGeometry', () => {
    // Test the geometry on a variety of data sizes and orientations.
    performSpecificBarsGeometryTest(0, 1, Orientation.HORIZONTAL);
    for (let rows = 1; rows <= 100; rows *= 10) {
      for (let cols = 1; cols <= 100; cols *= 10) {
        performSpecificBarsGeometryTest(rows, cols, Orientation.HORIZONTAL);
        performSpecificBarsGeometryTest(rows, cols, Orientation.VERTICAL);
      }
    }
  });

  /**
   * TODO(dlaliberte): test that when a custom tooltip function is given to a
   * datatable column, the tooltip HTML content creation for table cells is
   * deferred until tooltip triggering events. CL/239453648.
   */
  it('CustomTooltipFunc', () => {
    expect('yrsun').toBe('yrsun');
  });

  /**
   * Tests the extraction of columns with the "interval" role with
   * interval-options and the propagation of the values to scaled point
   * values for the various chart types.
   */
  it('ChartDefinerIntervals', () => {
    const data = createDataTable(
      [
        ['string', 'key'],
        ['number', 'value'],
        ['number', 'min'],
        ['number', 'mid'],
        ['number', 'max'],
      ],
      [['row', 5, 4, 6, 7]],
    );
    data.setColumnProperty(0, 'role', 'domain');
    data.setColumnProperty(1, 'role', 'data');
    data.setColumnProperty(2, 'role', 'interval');
    data.setColumnProperty(3, 'role', 'interval');
    data.setColumnProperty(4, 'role', 'interval');

    let chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'intervals': {'barWidth': 1, 'shortBarWidth': 0.5},
          'interval': {'max': {'barWidth': 0.2}},
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();

    assertNotUndefined(chartDef.series!);
    let series0 = chartDef.series![0];
    assertNotUndefined(series0);
    let intervals = series0.intervals!;
    assertNotUndefined(intervals);

    assertObjectEquals([2, 3, 4], intervals.bars);
    assertObjectEquals([2, 4], intervals.sticks);
    assertObjectEquals([], intervals.boxes);
    assertObjectEquals([], intervals.points);

    assertObjectEquals(
      [
        {
          lowT: 4,
          highT: 7,
          spanD: 0,
          columnIndex: 2,
          brush: intervals.settings[2].brush,
        },
        {
          lowT: 4,
          highT: 4,
          spanD: 1,
          columnIndex: 2,
          brush: intervals.settings[2].brush,
        },
        {
          lowT: 6,
          highT: 6,
          spanD: 0.5,
          columnIndex: 3,
          brush: intervals.settings[3].brush,
        },
        {
          lowT: 7,
          highT: 7,
          spanD: 0.2,
          columnIndex: 4,
          brush: intervals.settings[4].brush,
        },
      ],
      series0.points[0]!.nonScaled.intervalMarks,
    );

    chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'bar',
          'intervals': {'style': 'boxes', 'boxWidth': 0.7},
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();

    assertNotUndefined(chartDef.series!);
    series0 = chartDef.series![0];
    assertNotUndefined(series0);
    intervals = series0.intervals!;
    assertNotUndefined(intervals);

    assertObjectEquals([], intervals.bars);
    assertObjectEquals([], intervals.sticks);
    assertObjectEquals([2, 3, 4], intervals.boxes);
    assertObjectEquals([], intervals.points);

    assertObjectEquals(
      [
        {
          lowT: 4,
          highT: 7,
          spanD: 0.7,
          columnIndex: 2,
          brush: intervals.settings[2].brush,
        },
        {
          lowT: 6,
          highT: 6,
          spanD: 0.7,
          columnIndex: 3,
          brush: intervals.settings[3].brush,
        },
      ],
      series0.points[0]!.nonScaled.intervalMarks,
    );

    const scaledInnerBox = series0.points[0]!.scaled!.intervalRects[1].rect;
    const scaledOuterBox = series0.points[0]!.scaled!.intervalRects[0].rect;
    assertEquals(scaledInnerBox.width, scaledOuterBox.width);
    assertTrue(scaledInnerBox.width > 0);
    assertEquals(0, scaledInnerBox.height);
    assertTrue(scaledOuterBox.top < scaledInnerBox.top);
    assertTrue(scaledInnerBox.top < scaledOuterBox.top + scaledOuterBox.height);

    chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'area',
          'series': [
            {
              'intervals': {'style': 'bars', 'barWidth': 0.8},
              'interval': {'mid': {'style': 'points'}},
            },
          ],
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();

    assertNotUndefined(chartDef.series!);
    series0 = chartDef.series![0];
    assertNotUndefined(series0);
    intervals = series0.intervals!;
    assertNotUndefined(intervals);

    assertObjectEquals([2, 4], intervals.bars);
    assertObjectEquals([2, 4], intervals.sticks);
    assertObjectEquals([], intervals.boxes);
    assertObjectEquals([3], intervals.points);

    assertObjectEquals(
      [
        {
          lowT: 4,
          highT: 7,
          spanD: 0,
          columnIndex: 2,
          brush: intervals.settings[2].brush,
        },
        {
          lowT: 6,
          highT: 6,
          spanD: 0,
          columnIndex: 3,
          brush: intervals.settings[3].brush,
        },
        {
          lowT: 4,
          highT: 4,
          spanD: 0.8,
          columnIndex: 2,
          brush: intervals.settings[2].brush,
        },
        {
          lowT: 7,
          highT: 7,
          spanD: 0.8,
          columnIndex: 4,
          brush: intervals.settings[4].brush,
        },
      ],
      series0.points[0]!.nonScaled.intervalMarks,
    );

    assertEquals(4, series0.points[0]!.scaled!.intervalRects.length);

    const scaledStick = series0.points[0]!.scaled!.intervalRects[0].rect;
    assertEquals(0, scaledStick.width);
    assertTrue(scaledStick.height > 0);

    const scaledPoint = series0.points[0]!.scaled!.intervalRects[1].rect;
    assertEquals(0, scaledPoint.width);
    assertEquals(0, scaledPoint.height);

    assertTrue(scaledStick.top < scaledPoint.top);
    assertTrue(scaledStick.top + scaledStick.height > scaledPoint.top);
    assertTrue(scaledStick.left === scaledPoint.left);

    const scaledBarBottom = series0.points[0]!.scaled!.intervalRects[2].rect;
    const scaledBarTop = series0.points[0]!.scaled!.intervalRects[3].rect;
    assertEquals(scaledBarBottom.width, scaledBarTop.width);
    assertTrue(scaledBarBottom.width > 0);
    assertEquals(0, scaledBarBottom.height);
    assertEquals(0, scaledBarTop.height);

    assertTrue(scaledBarTop.top < scaledBarBottom.top);

    // TODO(dlaliberte): Intervals are being scaled as crisp rectangles, which
    // does not make sense and causes the top bar to sometimes be separated from
    // the stick by less than half a pixel. This whole intervals scaling will be
    // fixed in another CL soon.
  });

  /**
   * Tests the extraction of columns with the "interval" role with
   * interval-options of 'area' and the propagation of the values to scaled
   * point values for the various chart types.
   */
  it('ChartDefinerIntervalAreas', () => {
    const data = createDataTable(
      [
        ['string', 'key'],
        ['number', 'value'],
        ['number', 'area'],
        ['number', 'line'],
        ['number', 'area'],
      ],
      [['row-a', 0, 1, 2, 3]],
    );
    data.setColumnProperty(0, 'role', 'domain');
    data.setColumnProperty(1, 'role', 'data');
    data.setColumnProperty(2, 'role', 'interval');
    data.setColumnProperty(3, 'role', 'interval');
    data.setColumnProperty(4, 'role', 'interval');

    const options = new GvizOptions([
      {
        'type': 'function',
        'seriesType': 'line',
        'interval': {'area': {'style': 'area'}, 'line': {'style': 'line'}},
        'orientation': Orientation.HORIZONTAL,
      },
      DEFAULTS,
    ]);

    let chartDef = createChartDefiner(
      data,
      options,
      400,
      200,
    ).getChartDefinition();

    let series0 = chartDef.series![0];
    let intervals = series0.intervals!;
    assertNotUndefined(intervals);

    assertObjectEquals([2, 4], intervals.areas);
    assertObjectEquals([3], intervals.lines);

    assertNotUndefined(intervals.paths);
    let paths = intervals.paths!;

    assertEquals(0, paths.length);

    data.addRow(['row-b', 4, 5, 6, 7]);
    chartDef = createChartDefiner(data, options, 400, 200).getChartDefinition();

    series0 = chartDef.series![0];
    intervals = series0.intervals!;
    assertNotUndefined(intervals.paths);
    paths = intervals.paths!;

    assertEquals(2, paths.length);
    const area = paths[0];
    const line = paths[1];

    assertNotUndefined(area.line);
    assertNotUndefined(area.bottom);
    const areaBottom = area.bottom!;

    assertNotUndefined(line.line);
    assertUndefined(line.bottom);

    assertEqualsWithContext('line fillOpacity', 0, line.brush.getFillOpacity());
    assertEqualsWithContext(
      'line strokeWidth',
      DEFAULT_LINE_WIDTH / 2,
      line.brush.getStrokeWidth(),
    );
    assertEqualsWithContext('area strokeWidth', 0, area.brush.getStrokeWidth());
    assertEqualsWithContext(
      'area fillOpacity',
      0.3,
      area.brush.getFillOpacity(),
    );

    assertTrue(line.line[0].x < line.line[1].x);
    assertTrue(area.line[0].x < area.line[1].x);
    assertTrue(areaBottom[0].x > areaBottom[1].x);
    assertEquals(area.line[0].x, areaBottom[1].x);
    assertEquals(area.line[1].x, areaBottom[0].x);

    assertTrue(line.line[0].y > area.line[0].y);
    assertTrue(line.line[0].y < areaBottom[1].y);
    assertTrue(line.line[1].y > area.line[1].y);
    assertTrue(line.line[1].y < areaBottom[0].y);
  });

  /**
   * Tests that intervals on top of stacked series are correctly adjusted.
   */
  it('ChartDefinerIntervalsStacked', () => {
    const data = createDataTable(
      [
        ['string', 'key'],
        ['number', 'value0'],
        ['number', 'interval0'],
        ['number', 'value1'],
        ['number', 'interval1'],
      ],
      [['row', 5, 4, 6, 7]],
    );
    data.setColumnProperty(0, 'role', 'domain');
    data.setColumnProperty(1, 'role', 'data');
    data.setColumnProperty(2, 'role', 'interval');
    data.setColumnProperty(3, 'role', 'data');
    data.setColumnProperty(4, 'role', 'interval');

    const chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'bars',
          'intervals': {'style': 'points'},
          'isStacked': true,
          'orientation': Orientation.VERTICAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();

    assertObjectEquals(
      [
        {
          lowT: 4,
          highT: 4,
          spanD: 0,
          columnIndex: 2,
          brush: chartDef.series![0].intervals!.settings[2].brush,
        },
      ],
      chartDef.series![0].points[0]!.nonScaled.intervalMarks,
    );

    assertObjectEquals(
      [
        {
          lowT: 12,
          highT: 12,
          spanD: 0,
          columnIndex: 4,
          brush: chartDef.series![1].intervals!.settings[4].brush,
        },
      ],
      chartDef.series![1].points[0]!.nonScaled.intervalMarks,
    );

    const scaledPoint0 =
      chartDef.series![0].points[0]!.scaled!.intervalRects[0].rect;
    const scaledPoint1 =
      chartDef.series![1].points[0]!.scaled!.intervalRects[0].rect;

    assertEquals(scaledPoint0.top, scaledPoint1.top);
    assertTrue(scaledPoint0.left < scaledPoint1.left);
  });

  /**
   * Tests the interval options chain of DEFAULTS.
   */
  it('ChartDefinerIntervalsOptionsChain', () => {
    const options = {};
    const expectDefault = {
      'color': SeriesRelativeColor.DARK,
      'fillOpacity': 0.3,
      'lineWidth': DEFAULT_LINE_WIDTH / 2,
      'barWidth': 0.25,
      'shortBarWidth': 0.1,
      'boxWidth': 0.25,
      'pointSize': DEFAULT_POINT_SIZE_FOR_LINE,
      'curveType': 'none',
      'smoothingFactor': 1,
      'interpolateNulls': false,
    };
    let expected = [];
    for (let i = 0; i < 4; ++i) {
      expected.push(expectDefault);
    }
    checkChartDefinerIntervalsOptionsChain(options, expected);

    (options as AnyDuringMigration)['smoothingFactor'] = 2;
    expectDefault.smoothingFactor = 2;
    checkChartDefinerIntervalsOptionsChain(options, expected);

    (options as AnyDuringMigration)['series'] = [];
    (options as AnyDuringMigration)['series'][0] = {'smoothingFactor': 3};
    expected[0] = {};
    for (const key in expectDefault) {
      // tslint:disable-next-line:ban-unsafe-reflection
      if (!expectDefault.hasOwnProperty(key)) continue;
      (expected as AnyDuringMigration)[0][key] = (
        expectDefault as AnyDuringMigration
      )[key];
    }
    (expected as AnyDuringMigration)[0]['smoothingFactor'] = 3;
    expected[1] = expected[0];
    checkChartDefinerIntervalsOptionsChain(options, expected);

    (options as AnyDuringMigration)['series'][0] = {
      'intervals': {
        'color': SeriesRelativeColor.LIGHT,
        'fillOpacity': 0.5,
        'lineWidth': 5,
        'barWidth': 0.7,
        'shortBarWidth': 0.5,
        'boxWidth': 0.2,
        'curveType': 'function',
        'smoothingFactor': 4,
        'interpolateNulls': true,
        'pointSize': 6,
      },
    };
    (options as AnyDuringMigration)['interval'] = {};
    (options as AnyDuringMigration)['interval']['interval-x'] = {
      'color': SeriesRelativeColor.COLOR,
      'fillOpacity': 0.4,
      'lineWidth': 6,
      'barWidth': 0.4,
      'shortBarWidth': 0.3,
      'boxWidth': 0.8,
      'curveType': 'none',
      'smoothingFactor': 5,
      'interpolateNulls': false,
      'pointSize': 3,
    };
    (options as AnyDuringMigration)['intervals'] = {
      'color': '#04fea3',
      'fillOpacity': 0.2,
      'lineWidth': 3,
      'barWidth': 0.2,
      'shortBarWidth': 0.6,
      'boxWidth': 0.9,
      'curveType': 'function',
      'smoothingFactor': 6,
      'interpolateNulls': true,
      'pointSize': 8,
    };
    expected = [
      (options as AnyDuringMigration)['series'][0]['intervals'],
      (options as AnyDuringMigration)['series'][0]['intervals'],
      (options as AnyDuringMigration)['interval']['interval-x'],
      (options as AnyDuringMigration)['intervals'],
    ];
    checkChartDefinerIntervalsOptionsChain(options, expected);

    (options as AnyDuringMigration)['series'][0]['interval'] = {};
    (options as AnyDuringMigration)['series'][0]['interval']['interval-x'] = {
      'color': '#1fed54',
      'fillOpacity': 0.7,
      'lineWidth': 9,
      'barWidth': 0.6,
      'shortBarWidth': 0.8,
      'boxWidth': 0.4,
      'curveType': 'function',
      'smoothingFactor': 7,
      'interpolateNulls': false,
      'pointSize': 5,
    };
    expected[0] = (options as AnyDuringMigration)['series'][0]['interval'][
      'interval-x'
    ];
    checkChartDefinerIntervalsOptionsChain(options, expected);

    (options as AnyDuringMigration)['series'][1] = {};
    (options as AnyDuringMigration)['series'][1]['interval'] = {};
    (options as AnyDuringMigration)['series'][1]['interval']['interval-z'] = {
      'color': '#ba34d2',
      'fillOpacity': 0.1,
      'lineWidth': 5,
      'barWidth': 0.8,
      'shortBarWidth': 0.3,
      'boxWidth': 0.7,
      'curveType': 'none',
      'smoothingFactor': 8,
      'interpolateNulls': true,
      'pointSize': 1,
    };
    expected[3] = (options as AnyDuringMigration)['series'][1]['interval'][
      'interval-z'
    ];
    checkChartDefinerIntervalsOptionsChain(options, expected);
  });

  /**
   * Test that null-valued intervals do not get shown.
   */
  it('ChartDefinerIntervalsWithNullValues', () => {
    const data = createDataTable(
      [
        ['string', 'key'],
        ['number', 'value'],
        ['number', 'interval'],
        ['number', 'interval'],
      ],
      [
        ['a', 0, 1, 2],
        ['b', null, 3, 4],
        ['c', 5, null, 6],
        ['d', 7, 8, null],
        ['e', 9, null, null],
      ],
    );
    data.setColumnProperty(0, 'role', 'domain');
    data.setColumnProperty(1, 'role', 'data');
    data.setColumnProperty(2, 'role', 'interval');
    data.setColumnProperty(3, 'role', 'interval');

    const chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'bars',
          'intervals': {'style': 'bars'},
          'isStacked': true,
          'orientation': Orientation.VERTICAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();

    const points = chartDef.series![0].points;
    const intervalsA = points[0]!.nonScaled.intervalMarks;
    assertTrue(points[1]!.isNull);
    // Point is null, so no intervals.
    const intervalsC = points[2]!.nonScaled.intervalMarks;
    const intervalsD = points[3]!.nonScaled.intervalMarks;
    const intervalsE = points[4]!.nonScaled.intervalMarks;

    // No nulls, so the interval is two bars plus the stick.
    assertEquals(3, intervalsA!.length);

    // Lower-bar is null, so only upper bar is shown (and no stick).
    assertEquals(1, intervalsC!.length);
    assertEquals(3, intervalsC![0].columnIndex);

    // Upper-bar is null, so only lower bar is shown (and no stick).
    assertEquals(1, intervalsD!.length);
    assertEquals(2, intervalsD![0].columnIndex);

    // Both bars are null, so no interval marks.
    assertNull(intervalsE);
  });

  /**
   * Tests that error-intervals have a sane rendering when the domain-axis
   * is continuously valued.
   */
  it('SerieIntervalsWithContinuousValuedDomainAxis', () => {
    const data = createDataTable(
      [
        ['number', 'key'],
        ['number', 'value'],
        ['number', 'interval'],
        ['number', 'interval'],
      ],
      [
        [1, 0, 1, 2],
        [2.5, 3, 2, 4],
      ],
    );
    data.setColumnProperty(0, 'role', 'domain');
    data.setColumnProperty(1, 'role', 'data');
    data.setColumnProperty(2, 'role', 'interval');
    data.setColumnProperty(3, 'role', 'interval');

    const chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'intervals': {'style': 'boxes'},
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      100,
      100,
    ).getChartDefinition();

    const points = chartDef.series![0].points;
    assertEquals(2, points.length);

    const scaledA = points[0]!.scaled!.intervalRects[0].rect;
    const scaledB = points[1]!.scaled!.intervalRects[0].rect;

    // The important thing is that these aren't NaN or zero.
    assertTrue(scaledA.width > 2);
    assertTrue(scaledA.height > 10);
    assertTrue(scaledB.width > 2);
    assertTrue(scaledB.height > 20);

    assertTrue(scaledA.width < 20);
    assertTrue(scaledA.height < 20);
    assertTrue(scaledB.width < 20);
    assertTrue(scaledB.height < 40);

    assertEquals(scaledA.width, scaledB.width);
    // assertObjectRoughlyEquals(2, scaledB.height / scaledA.height, 0.00001);
    expect(scaledB.height / scaledA.height).toBeCloseTo(2); // , 0.00001);
  });

  /**
   * Tests correct inference of annotations color for series annotations.
   */
  it('SerieAnnotationColor', () => {
    const data = createDataTable(
      [
        ['string', 'D'],
        ['number', 'T'],
        ['string', 'Annotation'],
      ],
      [['a', 0, 'a']],
    );
    data.setColumnProperty(2, 'role', 'annotation');

    let chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();

    let annotation = chartDef.series![0].points[0]!.annotation;
    assertEquals(
      (chartDef.series![0].color! as AnyDuringMigration).color,
      annotation!.labels![0]!.textStyle.color,
    );

    chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'annotations': {
            'textStyle': {
              'color': '#000000',
              'opacity': 0.8,
            },
          },
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();

    annotation = chartDef.series![0].points[0]!.annotation;
    assertEquals('#000000', annotation!.labels![0]!.textStyle.color);
    assertEquals(0.8, annotation!.labels![0]!.textStyle.opacity);
  });

  /**
   * Tests correct inference of annotations color for domain annotations.
   */
  it('DomainAnnotationColor', () => {
    const data = createDataTable(
      [
        ['string', 'D'],
        ['string', 'Annotation'],
        ['number', 'T'],
      ],
      [['a', 'a', 0]],
    );
    data.setColumnProperty(1, 'role', 'annotation');

    let chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();
    let annotation = (chartDef.categories![0] as AnyDuringMigration).annotation;
    assertEquals('#222222', annotation.labels[0].textStyle.color);

    chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'annotations': {'domain': {'textStyle': {'color': 'green'}}},
          'orientation': Orientation.HORIZONTAL,
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();
    annotation = (chartDef.categories![0] as AnyDuringMigration).annotation;
    assertEquals('#008000', annotation.labels[0].textStyle.color);
  });

  /**
   * Tests stepped line series setter
   */
  it('SteppedLineSeriesSetter', () => {
    const data = createDataTable(
      [
        ['string', 'D'],
        ['string', 'Annotation'],
        ['number', 'T'],
      ],
      [['a', 'a', 0]],
    );
    data.setColumnProperty(1, 'role', 'annotation');

    const chartDef = createChartDefiner(
      data,
      new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'orientation': Orientation.HORIZONTAL,
          'series': [
            {
              'type': 'function',
              'seriesType': 'line',
              'orientation': Orientation.HORIZONTAL,
              'stepped': true,
            },
          ],
        },
        DEFAULTS,
      ]),
      400,
      200,
    ).getChartDefinition();
    assertTrue(chartDef.series[0].stepped);
  });

  /**
   * Tests the chartArea options are used as expected.
   */
  it('CalcChartAreaLayout', () => {
    const data = createDataTable(
      [
        ['number', 'key'],
        ['number', 'value'],
        ['number', 'interval'],
        ['number', 'interval'],
      ],
      [
        [1, 0, 1, 2],
        [2.5, 3, 2, 4],
      ],
    );

    const testChartArea = (
      name: string,
      chartAreaOption: AnyDuringMigration,
      expectedValue: AnyDuringMigration,
    ) => {
      const chartOptions = new GvizOptions([
        {
          'type': 'function',
          'seriesType': 'line',
          'orientation': Orientation.HORIZONTAL,
          'chartArea': chartAreaOption,
        },
        DEFAULTS,
      ]);
      const chartDefiner = createChartDefiner(data, chartOptions, 400, 200);
      const chartDef = chartDefiner.getChartDefinition();
      const actual = chartDef.chartArea;
      expect(actual)
        .withContext('test ' + name)
        .toEqual(expectedValue);
    };

    testChartArea(
      'default',
      {},
      {
        width: 267,
        height: 124,
        top: 38,
        bottom: 162,
        left: 67,
        right: 334,
      },
    );

    testChartArea(
      '100%',
      {
        'height': '100%',
        'width': '100%',
      },
      {
        width: 400,
        height: 200,
        top: 0,
        bottom: 200,
        left: 0,
        right: 400,
      },
    );

    testChartArea(
      '0 padding',
      {
        'left': 0,
        'right': 0,
        'top': 0,
        'bottom': 0,
      },
      {
        width: 400,
        height: 200,
        top: 0,
        bottom: 200,
        left: 0,
        right: 400,
      },
    );

    testChartArea(
      '0 chart',
      {
        'width': 0,
        'height': 0,
      },
      {
        width: 0,
        height: 0,
        top: 100,
        bottom: 100,
        left: 200,
        right: 200,
      },
    );

    testChartArea(
      '0 top-left',
      {
        'left': 0,
        'top': 0,
      },
      {
        width: 267,
        height: 124,
        top: 0,
        bottom: 124,
        left: 0,
        right: 267,
      },
    );

    testChartArea(
      '0 bottom-right',
      {
        'bottom': 0,
        'right': 0,
      },
      {
        width: 267,
        height: 124,
        top: 76,
        bottom: 200,
        left: 133,
        right: 400,
      },
    );

    testChartArea(
      '10% padding',
      {
        'left': '10%',
        'right': '10%',
        'top': '10%',
        'bottom': '10%',
      },
      {
        width: 320,
        height: 160,
        top: 20,
        bottom: 180,
        left: 40,
        right: 360,
      },
    );

    testChartArea(
      '50% padding',
      {
        'left': '50%',
        'right': '50%',
        'top': '50%',
        'bottom': '50%',
      },
      {
        width: 0,
        height: 0,
        top: 100,
        bottom: 100,
        left: 200,
        right: 200,
      },
    );

    testChartArea(
      '100% padding',
      {
        'left': '100%',
        'right': '100%',
        'top': '100%',
        'bottom': '100%',
      },
      {
        width: 0,
        height: 0,
        top: 200,
        bottom: 200,
        left: 400,
        right: 400,
      },
    );

    testChartArea(
      'overconstrained',
      {
        'width': '50%',
        'height': '50%',
        'left': '50%',
        'right': '50%',
        'top': '50%',
        'bottom': '50%',
      },
      {
        width: 0,
        height: 0,
        top: 100,
        bottom: 100,
        left: 200,
        right: 200,
      },
    );

    testChartArea(
      'too big top-left',
      {
        'top': 300,
        'left': 500,
      },
      {
        width: 0,
        height: 0,
        top: 200,
        bottom: 200,
        left: 400,
        right: 400,
      },
    );

    testChartArea(
      'too big bottom-right',
      {
        'bottom': 300,
        'right': 500,
      },
      {
        width: 0,
        height: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
      },
    );
  });
});
