/**
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

import 'jasmine';

import {Data} from './data';
import {DataTable} from './datatable';
import {DataView} from './dataview';

describe('Data test', () => {
  describe('Data can be constructed with no input', () => {
    const data = new Data();
    it('data is undefined', () => {
      const outputData = data.getData();
      expect(outputData).toBe(undefined);
    });

    it('primaryDataTable is empty', () => {
      const outputDt = data.getPrimaryDataTable();
      expect(outputDt.getNumberOfRows()).toBe(0);
      expect(outputDt.getNumberOfColumns()).toBe(0);
    });
  });

  it('Constructor uses a DataTable directly as primary datatable', () => {
    const dt = new DataTable();
    const data = new Data(dt);
    const outputDt = data.getPrimaryDataTable();
    expect(outputDt).toBe(dt);
  });

  it('Constructor uses a DataView directly as primary datatable', () => {
    const dt = new DataTable();
    const dv = new DataView(dt);
    const data = new Data(dv);
    const outputDt = data.getPrimaryDataTable();
    expect(outputDt).toBe(dv);
  });

  it('Constructor uses a Data directly as primary datatable', () => {
    const dt = new DataTable();
    const dv = new DataView(dt);
    const data1 = new Data(dv);
    const data = new Data(data1);
    const outputDt = data.getPrimaryDataTable();
    expect(outputDt).toBe(data1);
  });

  it('Constructor uses path for constructing primary datatable.', () => {
    const dataObjects = [
      {
        'name': 'arrayOfArrays',
        'values': [
          ['a', 'b', 'c'],
          [1, 2, 3],
        ],
      },
      {
        'name': 'arrayOfValues',
        'values': [1, 2, 3],
      },
      {
        'name': 'arrayOfRecord',
        'values': [{'one': 1, 'two': 2, 'three': 3}],
      },
    ];

    const data = new Data(dataObjects);
    data.setPrimaryDataTable('arrayOfArrays.values');
    // Also tests getData()
    expect(data.getData()).toEqual(dataObjects);

    let outputDt = data.getPrimaryDataTable();
    expect(outputDt.getNumberOfRows()).toBe(1);
    expect(outputDt.getNumberOfColumns()).toBe(3);

    // Also tests setPrimaryDataTable()
    // Also tests valuesToDataTable()
    data.setPrimaryDataTable('arrayOfValues.values');
    outputDt = data.getPrimaryDataTable();
    expect(outputDt.getNumberOfRows()).toBe(3);
    expect(outputDt.getNumberOfColumns()).toBe(1);

    // Also tests recordsToDataTable()
    data.setPrimaryDataTable('arrayOfRecord.values');
    outputDt = data.getPrimaryDataTable();
    expect(outputDt.getNumberOfRows()).toBe(1);
    expect(outputDt.getNumberOfColumns()).toBe(3);
  });
});
