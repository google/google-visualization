/**
 * @fileoverview Simple example of using VegaChart in a ts file
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

import {DataTable} from '../../data/datatable';

import {Matrix} from './matrix';

function draw() {
  const container = document.getElementById('visualization');
  if (!container) return;
  const vis = new Matrix(container);

  const dataTable = new DataTable();
  dataTable.addColumn({type: 'number', 'id': 'X', 'p': {'discrete': true}});
  dataTable.addColumn({type: 'number', 'id': 'Y', 'p': {'discrete': true}});
  dataTable.addColumn({type: 'number', 'id': 'angle', 'role': 'angle'});
  dataTable.addColumn({type: 'number', 'id': 'size', 'role': 'size'});
  dataTable.addColumn({type: 'number', 'id': 'color', 'role': 'color'});
  dataTable.addColumn({
    'type': 'number',
    'id': 'count',
    'role': 'background',
    'p': {
      'aggregate': 'sum',
      'scale': {
        'type': 'bin-ordinal',
        'zero': true,
      },
    },
  });

  const rows = [];
  for (let i = 0; i < 10; i++) {
    for (let j = 0; j < 10; j++) {
      const angle = ((i + j) / 20) * 360;
      const row = [i, j, angle, i * 3, j, i + 10 - j];
      rows.push(row);
    }
  }
  dataTable.addRows(rows);

  vis.draw(dataTable, {
    'width': 800,
    'height': 800,
    'chartArea': {'left': 30, 'top': 30, 'width': 400, 'height': 400},
    'pointShape': 'wedge',
  });
}

// Must wait until document is ready.
window.setTimeout(() => {
  // Must add container element manually, since ts_devserver seems to ignore
  // everything in the html except for the loading of ts_scripts.js.
  const newdiv = document.createElement('div');
  newdiv.appendChild(document.createTextNode('some text'));
  newdiv.id = 'visualization';
  document.body.appendChild(newdiv);

  draw();
});
