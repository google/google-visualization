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
 * Test simple bar chart in VegaChart.
 */
export function barTest(vis: VegaChart) {
  const dataTable = new DataTable();
  dataTable.addColumn({type: 'string', 'id': 'category'});
  dataTable.addColumn({type: 'number', 'id': 'amount'});
  dataTable.addRows([
    ['A', 28],
    ['B', 55],
    ['C', 43],
    ['D', 91],
    ['E', 81],
    ['F', 53],
    ['G', 19],
    ['H', 87],
  ]);

  const options = {
    'vega': {
      '$schema': 'https://vega.github.io/schema/vega/v4.json',
      'width': 500,
      'height': 200,
      'padding': 25,

      'data': [{'name': 'table', 'source': 'datatable'}],

      'signals': [
        {
          'name': 'tooltip',
          'value': {},
          'on': [
            {'events': 'rect:mouseover', 'update': 'datum'},
            {'events': 'rect:mouseout', 'update': '{}'},
          ],
        },
      ],

      'scales': [
        {
          'name': 'xscale',
          'type': 'band',
          'domain': {'data': 'table', 'field': 'category'},
          'range': 'width',
          'padding': 0.05,
          'round': true,
        },
        {
          'name': 'yscale',
          'domain': {'data': 'table', 'field': 'amount'},
          'nice': true,
          'range': 'height',
        },
      ],

      'axes': [
        {'orient': 'bottom', 'scale': 'xscale'},
        {'orient': 'left', 'scale': 'yscale'},
      ],

      'marks': [
        {
          'type': 'rect',
          'from': {'data': 'table'},
          'encode': {
            'enter': {
              'x': {'scale': 'xscale', 'field': 'category'},
              'width': {'scale': 'xscale', 'band': 1},
              'y': {'scale': 'yscale', 'field': 'amount'},
              'y2': {'scale': 'yscale', 'value': 0},
            },
            'update': {'fill': {'value': 'steelblue'}},
            'hover': {'fill': {'value': 'red'}},
          },
        },
        {
          'type': 'text',
          'encode': {
            'enter': {
              'align': {'value': 'center'},
              'baseline': {'value': 'bottom'},
              'fill': {'value': '#333'},
            },
            'update': {
              'x': {
                'scale': 'xscale',
                'signal': 'tooltip.category',
                'band': 0.5,
              },
              'y': {
                'scale': 'yscale',
                'signal': 'tooltip.amount',
                'offset': -2,
              },
              'text': {'signal': 'tooltip.amount'},
              'fillOpacity': [
                {'test': 'datum === tooltip', 'value': 0},
                {'value': 1},
              ],
            },
          },
        },
      ],
    },
  };

  vis.draw(dataTable, options);
}
