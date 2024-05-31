/**
 * @fileoverview A 'matrix' visualization using VegaChart.
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

import {PositionDef} from '@npm//@vega_lite/types/channeldef';
import {AnyCallbackWrapper} from '../../common/async_helper';
import {Options as GvizOptions, UserOptions} from '../../common/options';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {DataView} from '../../data/dataview';
// tslint:disable-next-line:no-unused-variable Required for VegaChart
import * as vega from 'vega';
// tslint:disable-next-line:no-unused-variable Required for VegaChart
import * as vegaLite from 'vega-lite';

import {AbstractVisualization} from '../abstract_visualization';
import {VegaChart} from '../vegachart/vegachart';

// TODO(dlaliberte): Cleanup declared interfaces.
// tslint:disable:no-dict-access-on-struct-type

// Maybe need something like this to define each layer:
// const layerGroupSpecs = {
//   'background': {
//     'mark': {'type': 'rect'},
//   },
//   'glyph': {
//     'mark': {'type': 'point'},
//   },
//   'text': {
//     'mark': {'type': 'text'},
//   },
// };

interface ScaleSpec {
  domain?: [number, number];
  range?: [number, number];
}

interface MarkSpec {
  type: 'rect' | 'point' | 'text';
  shape?: string | null;
  filled?: boolean;
  strokeWidth?: number;
  tooltip?: boolean;
  size?: number;
}

interface EncodingSpec {
  color?: {};
  opacity?: {scale: ScaleSpec};
  stroke?: {};
  strokeWidth?: {size: {scale: ScaleSpec}} | {scale: ScaleSpec};
  size?: {scale: ScaleSpec};
  shape?: {};
  text?: {};
  angle?: {scale: ScaleSpec};
  [key: string]: unknown;
}

interface ColumnRoleSpec {
  layer: 'background' | 'glyph' | 'text';
  mark: MarkSpec;
  encoding: EncodingSpec;
}

// Specifications for each role, used in encoding.
const columnRoleSpecs: {[role: string]: ColumnRoleSpec} = {
  // Cell background.  Maybe 'cell', 'cellColor', or 'heatmap'?
  // Also need images, patterns, gradients?
  'background': {
    'layer': 'background',
    'mark': {'type': 'rect'},
    'encoding': {
      'color': {},
    },
  },
  'backgroundOpacity': {
    'layer': 'background',
    'mark': {'type': 'rect'},
    'encoding': {
      'opacity': {
        'scale': {'range': [0.2, 1]},
      },
    },
  },

  // For glyphs:
  'color': {
    'layer': 'glyph',
    'mark': {'type': 'point'},
    'encoding': {
      'color': {},
    },
  },
  'opacity': {
    'layer': 'glyph',
    'mark': {'type': 'point'},
    'encoding': {
      'opacity': {
        'scale': {'range': [0.2, 1]},
      },
    },
  },
  'stroke': {
    'layer': 'glyph',
    'mark': {'type': 'point'},
    'encoding': {
      'stroke': {},
    },
  },
  'strokeWidth': {
    'layer': 'glyph',
    'mark': {'type': 'point'},
    'encoding': {
      'strokeWidth': {
        'scale': {'range': [0, 15]}, // Should be 0 to half the sqrt of size/pi
      },
    },
  },
  'size': {
    'layer': 'glyph',
    'mark': {'type': 'point'},
    'encoding': {
      'size': {
        'scale': {
          'domain': [0, 30],
          'range': [5 * 5, 30 * 30], // size maps to area?
        },
      },
    },
  },
  'shape': {
    'layer': 'glyph',
    'mark': {'type': 'point'},
    'encoding': {'shape': {}},
  },

  // For wedge, with point shape:
  'angle': {
    'layer': 'glyph',
    'mark': {'type': 'point', 'shape': 'wedge'},
    'encoding': {
      'angle': {
        'scale': {
          'domain': [0, 360],
          'range': [180, 540], // rotate 180.
        },
      },
    },
  },

  // For foreground layer, just text for now.
  'text': {
    'layer': 'text',
    'mark': {'type': 'text'},
    'encoding': {'text': {}},
  },
};

/**
 * The matrix visualization
 */
export class Matrix extends AbstractVisualization {
  options?: GvizOptions;

  dataView?: DataView;

  internalVegaChart: VegaChart;

  /**
   * Creates a new instance of an AbstractVisualization
   * @param container The DOM element which will contain the visualization.
   */
  constructor(container: Element | null) {
    super(container);

    this.internalVegaChart = new VegaChart(container);
  }

  getDefaultOptions(): {} {
    return {};
  }

  // Defines a dimension, given the column index and options.
  // Returns the vega-lite encoding.
  defineDimension(
    columnIndex: number,
    fieldName: string,
    axisOptions: GvizOptions,
  ) {
    const columnType = this.dataView!.getColumnType(columnIndex);
    const label =
      this.dataView!.getColumnLabel(columnIndex) ||
      this.dataView!.getColumnId(columnIndex);

    const fieldType = columnType === 'string' ? 'nominal' : 'quantitative';

    let encoding: PositionDef<string> = {
      'field': fieldName,
      'type': fieldType,
      'title': label,
    };

    if (columnType !== 'string') {
      // For numbers, dates, and times, we do binning by default.
      // Treat as all numbers for now...
      // const distinctValues =
      //     this.dataView!.getDistinctValues(columnIndex) as number[];

      // Column properties, which we should make more convenient.
      // Should also allow default to be specified in options.
      const discrete =
        this.dataView!.getColumnProperty(columnIndex, 'discrete') || false;
      const ordered =
        this.dataView!.getColumnProperty(columnIndex, 'ordered') == null
          ? false
          : true;

      const encodingType = discrete
        ? ordered
          ? 'ordinal'
          : 'nominal'
        : 'quantitative';

      // const binSize = distinctValues[1] - distinctValues[0];
      // const maxBins =
      //     axisOptions.inferNumberValue('bins.maxbins',
      //                                  // Need one more bin than the number
      //                                  of
      //                                  // distinct values.
      //                                  distinctValues.length + 1);
      // const anchor =
      //     axisOptions.inferNumberValue('bins.anchor',
      //                                 distinctValues[0]);

      // const extent: [number, number] = [anchor,
      // distinctValues[distinctValues.length - 1] + binSize];
      // TODO(dlaliberte): anchor, base, divide, extent, nice, step, steps.

      // Get bin 'option' from data column.
      const binOption = this.dataView!.getColumnProperty(columnIndex, 'bin');

      // Is the data "binned" by default?
      const binned = encodingType === 'ordinal' || encodingType === 'nominal';
      // Is binning being done for this axis?
      const binning =
        binOption || (encodingType !== 'ordinal' && encodingType !== 'nominal');

      // this.xOrYIsBinning = this.xOrYIsBinning || binning;

      const encodingBin = binning
        ? {'bin': binOption || {'binned': binned}}
        : {};

      encoding = {
        ...encoding,
        'type': encodingType,

        ...encodingBin,
        // ...encodingAggregate,

        'axis': {
          'format': '.2', //
          'grid': true, //
          'gridDash': [0], //
          'gridWidth': 0.5, //
        },
      };
    }

    return encoding;
  }

  /**
   * Draws the chart. This is overridden by each visualization.
   * @param asyncWrapper A function that accepts a callback (and possibly a
   *     'this' context object) and wraps it for async execution.
   * @param data The data table.
   * @param userOptions The visualization options.
   * @param state The state of the chart.
   */
  drawInternal(
    asyncWrapper: AnyCallbackWrapper,
    data: AbstractDataTable,
    userOptions: UserOptions = {},
    state: {},
  ) {
    this.options = new GvizOptions([userOptions]);

    const numColumns = data.getNumberOfColumns();

    // Map the user data to an internal dataview with standardized column ids.
    // This is how the vega spec references the data columns.
    const dataView = new DataView(data);
    this.dataView = dataView;

    // Set up columns for dataView.
    // x and y are always the first two columns.
    // More columns are added by processColumn.
    const columns = [
      {
        'id': 'x',
        'sourceColumn': 0,
        'label': data.getColumnLabel(0) || data.getColumnId(0),
      },
      {
        'id': 'y',
        'sourceColumn': 1,
        'label': data.getColumnLabel(1) || data.getColumnId(1),
      },
    ];

    // Create vega specs for x and y.
    const xEncoding = this.defineDimension(
      0,
      'x',
      this.options.view('matrix.x'),
    );

    const yEncoding = this.defineDimension(
      1,
      'y',
      this.options.view('matrix.y'),
    );

    const encoding: {[key: string]: PositionDef<string>} = {
      'x': xEncoding,
      'y': yEncoding,
    };

    // Create legend spec to be used for each role.
    // Since offsetting of additional (more than 1) vertical legends in a
    // horizontal direction is not supported, and since custom legends
    // requires global screen positions which we don't have access to,
    // we just switch to horizontal direction of each legend,
    // which automatically (and correctly) offsets vertically.
    let legend = {
      'orient': 'right',
      'direction': 'vertical',
    };
    if (numColumns > 3) {
      legend = {
        'orient': 'right',
        'direction': 'horizontal',
      };
    }

    // Map from layer group name to list of specs for each layer.
    const layerGroups: {[key: string]: Array<{}>} = {
      'background': [],
      'glyph': [],
      'text': [],
    };

    const pointShape = this.options.inferOptionalStringValue('pointShape');

    const strokeWidth = this.options.inferNumberValue('strokeWidth', 1);

    // Need to compute default radius from available space.
    const pointRadius = this.options.inferNumberValue('pointRadius', 8);
    const pointArea = Math.PI * pointRadius * pointRadius;

    //================================
    // Appends to columns.
    // Modifies layerGroups
    const processColumn = (
      columnIndex: number,
      role: string,
      roleSpec: ColumnRoleSpec,
      layer: {mark?: MarkSpec; encoding?: EncodingSpec},
    ) => {
      const markSpec: MarkSpec = {...roleSpec['mark']};

      markSpec['filled'] = true;
      markSpec['strokeWidth'] = strokeWidth;
      markSpec['tooltip'] = true;

      // Only add 'size' if shape is not 'rect'.
      if (markSpec['type'] === 'point') {
        markSpec['size'] = pointArea;
        if (!markSpec['shape']) {
          markSpec['shape'] = pointShape;
        }
      }
      // Each layer has only one mark.
      layer['mark'] = markSpec;

      // TODO(dlaliberte): Implement selection layer.
      // const selectionSpec = roleSpec['selection'];
      // layer['selection'] = selectionSpec;

      const encodingChannels = roleSpec['encoding'];
      let channelName = '';
      for (const channel in encodingChannels) {
        if (!encodingChannels.hasOwnProperty(channel)) continue;
        channelName = channel;
      }
      // const channel = encodingChannels[channelName];

      const label =
        data.getColumnLabel(columnIndex) || data.getColumnId(columnIndex);
      const dataType = data.getColumnType(columnIndex);

      // Add a columnSpec for the DataView.
      const columnSpec = {
        'id': role,
        'sourceColumn': columnIndex,
        'label': label,
      };
      columns.push(columnSpec);

      const fieldType = dataType === 'number' ? 'quantitative' : 'nominal';

      const aggregateOption = this.dataView!.getColumnProperty(
        columnIndex,
        'aggregate',
      );
      const encodingAggregate = aggregateOption
        ? {'aggregate': aggregateOption || 'sum'}
        : {};

      const scaleOption = this.dataView!.getColumnProperty(
        columnIndex,
        'scale',
      );
      const encodingScale = scaleOption ? {'scale': scaleOption} : {};

      const roleEncoding = {
        'field': role,
        'type': fieldType,
        'title': label,
        'legend': legend,
        ...encodingAggregate,
        ...encodingScale,
      };
      if (layer.encoding) {
        layer.encoding[channelName] = roleEncoding;
      }
    };

    // Subsequent columns are all roles, so far.
    for (let columnIndex = 2; columnIndex < numColumns; columnIndex++) {
      const role = data.getColumnRole(columnIndex);
      const roleSpec = columnRoleSpecs[role];
      if (!roleSpec) {
        // Ignore any unsupported roles.
        continue;
      }

      const layerName = roleSpec['layer'] || 'glyph';
      let layerGroup = layerGroups[layerName];
      if (!layerGroup) {
        // Create a new layerGroup

        layerGroup = [];
        layerGroups[layerName] = layerGroup;
      }
      let layer = layerGroup[0]; // only one layer in each group for now.
      if (!layer) {
        layer = {
          'encoding': {},
        };
        layerGroup[0] = layer;
      }

      processColumn(columnIndex, role, roleSpec, layer);
    }
    dataView.setColumns(columns);

    // TODO(dlaliberte): Implement selection layer.
    // const selectionLayer = {
    //   // 'selection': {
    //   //   'highlight': {'type': 'single', 'empty': 'none', 'on':
    //   'mouseover', "resolve": "global"},
    //   // },
    //   'encoding': {
    //     'fillOpacity': {
    //       // "condition": {"selection": "highlight", "value": 1},
    //       'value': 0.3,
    //     },
    //   },
    // };

    // layerGroups['glyph'].push(selectionLayer);
    const layers = [
      ...layerGroups['background'],
      ...layerGroups['glyph'],
      ...layerGroups['text'],
    ];

    const vegaLiteSpec = {
      'vegaLite': {
        'data': {'name': 'datatable'},
        'encoding': encoding, // for x and y
        'layer': [...layers],
        'config': {
          'scale': {'bandPaddingInner': 0, 'bandPaddingOuter': 0},
          'view': {'step': 40},
          'range': {'ramp': {'scheme': 'yellowgreenblue'}},
          'axis': {'domain': false, 'zindex': 0},
        },
      },
    };

    let optionsJson = {
      ...vegaLiteSpec,
    };

    this.options.insertLayer(1, optionsJson);
    optionsJson = this.options.flattenLayers();

    this.internalVegaChart.draw(dataView, optionsJson);
  }
}
