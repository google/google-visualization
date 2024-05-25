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
export function donutTest(vis: VegaChart) {
  const dataTable = new DataTable();

  const options = {
    'vega': {
      '$schema': 'https://vega.github.io/schema/vega/v5.json',
      'description': 'A basic donut chart example.',
      'width': 200,
      'height': 200,
      'autosize': 'none',

      'signals': [
        {
          'name': 'startAngle',
          'value': 0,
          'bind': {'input': 'range', 'min': 0, 'max': 6.29, 'step': 0.01},
        },
        {
          'name': 'endAngle',
          'value': 6.29,
          'bind': {'input': 'range', 'min': 0, 'max': 6.29, 'step': 0.01},
        },
        {
          'name': 'padAngle',
          'value': 0,
          'bind': {'input': 'range', 'min': 0, 'max': 0.1},
        },
        {
          'name': 'innerRadius',
          'value': 60,
          'bind': {'input': 'range', 'min': 0, 'max': 90, 'step': 1},
        },
        {
          'name': 'cornerRadius',
          'value': 0,
          'bind': {'input': 'range', 'min': 0, 'max': 10, 'step': 0.5},
        },
        {'name': 'sort', 'value': false, 'bind': {'input': 'checkbox'}},
      ],

      'data': [
        {
          'name': 'table',
          'values': [
            {'id': 1, 'field': 4},
            {'id': 2, 'field': 6},
            {'id': 3, 'field': 10},
            {'id': 4, 'field': 3},
            {'id': 5, 'field': 7},
            {'id': 6, 'field': 8},
          ],
          'transform': [
            {
              'type': 'pie',
              'field': 'field',
              'startAngle': {'signal': 'startAngle'},
              'endAngle': {'signal': 'endAngle'},
              'sort': {'signal': 'sort'},
            },
          ],
        },
      ],

      'scales': [
        {
          'name': 'color',
          'type': 'ordinal',
          'domain': {'data': 'table', 'field': 'id'},
          'range': {'scheme': 'category20'},
        },
      ],

      'marks': [
        {
          'type': 'arc',
          'from': {'data': 'table'},
          'encode': {
            'enter': {
              'fill': {'scale': 'color', 'field': 'id'},
              'x': {'signal': 'width / 2'},
              'y': {'signal': 'height / 2'},
            },
            'update': {
              'startAngle': {'field': 'startAngle'},
              'endAngle': {'field': 'endAngle'},
              'padAngle': {'signal': 'padAngle'},
              'innerRadius': {'signal': 'innerRadius'},
              'outerRadius': {'signal': 'width / 2'},
              'cornerRadius': {'signal': 'cornerRadius'},
            },
          },
        },
      ],
    },
  };
  vis.draw(dataTable, options);
}
