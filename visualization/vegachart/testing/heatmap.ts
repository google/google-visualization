/**
 * @fileoverview An example/test of VegaChart
 * @license
 * Copyright 2021 Google LLC
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

import {DataTable} from '../../../data/datatable';

import {VegaChart} from '../vegachart';

/**
 * Test donut chart in VegaChart.
 */
export function heatmapTest(vis: VegaChart) {
  const dataTable = new DataTable();

  const options = {
    'vegaLite': {
      '$schema': 'https://vega.github.io/schema/vega-lite/v4.json',
      'data': {
        'values': [
          {'actual': 'A', 'predicted': 'A', 'count': 13},
          {'actual': 'A', 'predicted': 'B', 'count': 0},
          {'actual': 'A', 'predicted': 'C', 'count': 0},
          {'actual': 'B', 'predicted': 'A', 'count': 0},
          {'actual': 'B', 'predicted': 'B', 'count': 10},
          {'actual': 'B', 'predicted': 'C', 'count': 6},
          {'actual': 'C', 'predicted': 'A', 'count': 0},
          {'actual': 'C', 'predicted': 'B', 'count': 0},
          {'actual': 'C', 'predicted': 'C', 'count': 9},
        ],
      },
      'width': 300,
      'height': 300,
      'selection': {'highlight': {'type': 'single'}},
      'mark': {'type': 'rect', 'strokeWidth': 2},
      'encoding': {
        'y': {'field': 'actual', 'type': 'nominal'},
        'x': {'field': 'predicted', 'type': 'nominal'},
        'fill': {'field': 'count', 'type': 'quantitative'},
        'stroke': {
          'condition': {
            'test': {
              'and': [
                {'selection': 'highlight'},
                'length(data("highlight_store"))',
              ],
            },
            'value': 'black',
          },
          'value': null,
        },
        'opacity': {
          'condition': {'selection': 'highlight', 'value': 1},
          'value': 0.5,
        },
        'order': {
          'condition': {'selection': 'highlight', 'value': 1},
          'value': 0,
        },
      },
      'config': {
        'scale': {'bandPaddingInner': 0, 'bandPaddingOuter': 0},
        'view': {'step': 40},
        'range': {'ramp': {'scheme': 'yellowgreenblue'}},
        'axis': {'domain': false},
      },
    },
  };
  vis.draw(dataTable, options);
}
