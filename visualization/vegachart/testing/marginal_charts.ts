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
 * Test marginalCharts chart in VegaChart.
 */
export function marginalChartsTest(vis: VegaChart) {
  const dataTable = new DataTable();

  const triples = [];
  for (let i = 0; i < 20; i++) {
    for (let j = 0; j < 20; j++) {
      const x = (i - 10) / 10;
      const y = (j - 10) / 10;
      const z = x * x * x + 3 * x * y;
      triples.push({x, y, z});
    }
  }

  const options = {
    'vegaLite': {
      '$schema': 'https://vega.github.io/schema/vega-lite/v4.json',
      'data': {
        'values': triples,
      },
      'spacing': 15,
      'bounds': 'flush',
      'vconcat': [
        {
          'mark': {
            'type': 'tick',
            'orient': 'horizontal',
          },
          'height': 20,
          'encoding': {
            'x': {'field': 'x', 'bin': false, 'axis': null},
            'y': {'field': 'z', 'bin': false, 'axis': null, 'title': ''},
            'color': {
              'field': 'z',
              'type': 'quantitative',
              'bin': false,
              'scale': {'domainMid': 0, 'range': 'diverging'},
            },
          },
        },
        {
          'spacing': 15,
          'bounds': 'flush',
          'hconcat': [
            {
              'mark': 'rect',
              'encoding': {
                'x': {'bin': false, 'field': 'x'},
                'y': {'bin': false, 'field': 'y'},
                'color': {
                  'field': 'z',
                  'type': 'quantitative',
                  'bin': false,
                  'scale': {'domainMid': 0, 'range': 'diverging'},
                },
              },
            },
            {
              'mark': {
                'type': 'tick',
              },
              'width': 20,
              'encoding': {
                'y': {'field': 'y', 'bin': false, 'axis': null},
                'x': {
                  'field': 'z',
                  'bin': false,
                  'axis': null,
                  'title': '',
                },
                'color': {
                  'field': 'z',
                  'type': 'quantitative',
                  'bin': false,
                  'scale': {'domainMid': 0, 'range': 'diverging'},
                },
              },
            },
          ],
        },
      ],
      'config': {'view': {'stroke': 'transparent'}},
    },
  };

  vis.draw(dataTable, options);
}
