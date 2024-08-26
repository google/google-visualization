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

import * as testUtils from '../common/test_utils';
import {TableSpec, Value} from '../data/types';

import {AbstractDataTable} from './abstract_datatable';
import {arrayToDataTable, DataTable} from './datatable';
import {
  findNonNullValueInColumn,
  parseCell,
  validateColumnSet,
  validateTypeMatch,
} from './datautils';
import {DataView} from './dataview';

const {
  assertArrayEquals,
  assertDateEquals,
  assertEquals,
  assertNotNull,
  assertNotThrows,
  assertNull,
  assertObjectEquals,
  assertThrows,
  assertThrowsWithMessage,
  assertTrue,
  isArrayEquals,
} = testUtils;

describe('DataUtils Test', () => {
  /**
   * Asserts that the given type is valid for the column and index.
   * @param dt The data to check against.
   * @param colIndex The index of the column.
   * @param val The value to check, which could be null or an object.
   */
  const assertCheckTypeMatchThrowsException = (
    dt: AbstractDataTable,
    colIndex: number,
    val: Value | null | {},
  ) => {
    assertThrows(() => {
      // 'col: ' + colIndex + ' val: ' + val,
      validateTypeMatch(dt, colIndex, val);
    });
  };

  it('Checks that data types match declaration', () => {
    const obj: TableSpec = {};
    obj.cols = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Boolean', 'type': 'boolean'},
      {'id': 'D', 'label': 'Date', 'type': 'date'},
      {'id': 'E', 'label': 'Timeofday', 'type': 'timeofday'},
      {'id': 'F', 'label': 'Datetime', 'type': 'datetime'},
    ];
    const dt = new DataTable(obj);

    // good cases:
    validateTypeMatch(dt, 0, 'foo');
    validateTypeMatch(dt, 0, null);
    validateTypeMatch(dt, 0, '');
    validateTypeMatch(dt, 1, 7);
    validateTypeMatch(dt, 1, null);
    validateTypeMatch(dt, 1, 8.3);
    validateTypeMatch(dt, 2, true);
    validateTypeMatch(dt, 2, false);
    validateTypeMatch(dt, 2, null);
    validateTypeMatch(dt, 3, new Date(2003, 8, 3));
    validateTypeMatch(dt, 3, null);
    validateTypeMatch(dt, 4, [16, 30, 70]);
    validateTypeMatch(dt, 4, [15, 30, 45]);
    validateTypeMatch(dt, 4, [15, 30, 45, 0]);
    validateTypeMatch(dt, 4, [15, 30, 45, 99]);
    validateTypeMatch(dt, 4, [15, 30, 45, 543543]);
    validateTypeMatch(dt, 4, [7, 15, 30, 45, 0]);
    validateTypeMatch(dt, 4, [12, 7, 15, 30, 45, 0]);
    validateTypeMatch(dt, 4, [2000, 12, 7, 15, 30, 45, 0]);
    validateTypeMatch(dt, 4, null);
    validateTypeMatch(dt, 5, new Date(2003, 8, 3, 15, 30, 45));

    // bad cases:
    assertCheckTypeMatchThrowsException(dt, 0, 3);
    assertCheckTypeMatchThrowsException(dt, 0, true);
    assertCheckTypeMatchThrowsException(dt, 0, {'a': 'b', 'c': 'd'});
    assertCheckTypeMatchThrowsException(dt, 0, [2, 3, 4]);
    assertCheckTypeMatchThrowsException(dt, 1, 'foo');
    assertCheckTypeMatchThrowsException(dt, 1, false);
    assertCheckTypeMatchThrowsException(dt, 2, 'bar');
    assertCheckTypeMatchThrowsException(dt, 2, 7);
    assertCheckTypeMatchThrowsException(dt, 3, 'bar');
    assertCheckTypeMatchThrowsException(dt, 3, 7);
    assertCheckTypeMatchThrowsException(dt, 4, 'baz');
    assertCheckTypeMatchThrowsException(dt, 4, 8);
    assertCheckTypeMatchThrowsException(dt, 4, {});
    assertCheckTypeMatchThrowsException(dt, 4, []);
    assertCheckTypeMatchThrowsException(
      dt,
      4,
      [100, 2000, 12, 7, 15, 30, 45, 0],
    );
    assertCheckTypeMatchThrowsException(dt, 5, 'chiko');
  });

  it('Gets sorted rows', () => {
    const obj: TableSpec = {};
    obj.cols = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Boolean', 'type': 'boolean'},
      {'id': 'D', 'label': 'Date', 'type': 'date'},
      {'id': 'E', 'label': 'Timeofday', 'type': 'timeofday'},
      {'id': 'F', 'label': 'Datetime', 'type': 'datetime'},
    ];
    obj.rows = [];

    // 0
    obj.rows.push({
      'c': [
        {'v': 'bbb'},
        {'v': null},
        {'v': null},
        {'v': new Date(2000, 5, 5)},
        {'v': [5, 20, 30, 5]},
        {'v': new Date(2000, 5, 5, 17, 20, 30)},
      ],
      'p': {},
    });

    // 1
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': null},
        {'v': true},
        {'v': new Date(2000, 11, 3)},
        {'v': null},
        {'v': null},
      ],
      'p': {},
    });

    // 2
    obj.rows.push({
      'c': [
        {'v': 'aab'},
        {'v': 7},
        {'v': true},
        {'v': null},
        {'v': [5, 20, 30]},
        {'v': new Date(2000, 11, 3, 4, 2, 4)},
      ],
      'p': {},
    });

    // 3
    obj.rows.push({
      'c': [
        {'v': 'aaa'},
        {'v': -4.5},
        {'v': null},
        {'v': null},
        {'v': [10, 30, 30]},
        {'v': null},
      ],
      'p': {},
    });

    // 4
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': 7},
        {'v': false},
        {'v': new Date(2005, 3, 4)},
        {'v': [23, 23, 23]},
        {'v': new Date(2005, 3, 4, 5, 6, 7)},
      ],
      'p': {},
    });

    const dt = new DataTable(obj);
    let res = dt.getSortedRows([{'column': 0}]);
    assertArrayEquals([1, 4, 3, 2, 0], res);
    res = dt.getSortedRows([{'column': 0, 'desc': false}]);
    assertArrayEquals([1, 4, 3, 2, 0], res);
    res = dt.getSortedRows([{'column': 0, 'desc': true}]);
    assertArrayEquals([0, 2, 3, 1, 4], res);
    res = dt.getSortedRows([{'column': 1}, {'column': 4, 'desc': true}]);
    assertArrayEquals([0, 1, 3, 4, 2], res);
    res = dt.getSortedRows([
      {'column': 2},
      {
        'column': 5,
        'compare': (v1, v2) => {
          if (v1 == null) return -1;
          if (v2 == null) return 1;
          return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
        },
      },
    ]);
    assertArrayEquals([3, 0, 4, 1, 2], res);
    res = dt.getSortedRows([
      {'column': 2, 'desc': true},
      {'column': 3, 'desc': true},
    ]);
    assertArrayEquals([1, 2, 4, 0, 3], res);
    res = dt.getSortedRows([
      {
        'column': 5,
        'compare': (v1, v2) => {
          if (v1 == null) return -1;
          if (v2 == null) return 1;
          return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
        },
      },
    ]);
    assertArrayEquals([1, 3, 0, 2, 4], res);
    res = dt.getSortedRows((i1, i2) => {
      const v1 = dt.getValue(i1, 0);
      const v2 = dt.getValue(i2, 0);
      if (v1 == null) {
        return v2 == null ? 0 : -1;
      } else {
        if (v2 == null) {
          return 1;
        } else {
          return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
        }
      }
    });
    assertArrayEquals([1, 4, 3, 2, 0], res);

    // Test getSortedRows in a DataView.
    const view = new DataView(dt);
    view.setColumns([3, 0]);
    assertThrows(() => {
      view.getSortedRows([{'column': 2}]);
    });
    res = view.getSortedRows([{'column': 1}]);
    assertArrayEquals([1, 4, 3, 2, 0], res);
    res = view.getSortedRows([
      {
        'column': 1,
        'desc': true,
        'compare': (v1, v2) => {
          if (v1 == null) return -1;
          if (v2 == null) return 1;
          return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
        },
      },
    ]);
    assertArrayEquals([0, 2, 3, 1, 4], res);

    // Test overloads
    res = dt.getSortedRows({'column': 1, 'desc': true});
    assertArrayEquals([2, 4, 3, 0, 1], res);
    res = dt.getSortedRows(1);
    assertArrayEquals([0, 1, 3, 2, 4], res);
    res = dt.getSortedRows([2, {'column': 1, 'desc': false}]);
    assertArrayEquals([0, 3, 4, 1, 2], res);
  });

  it('Gets sorted rows correctly', () => {
    const obj: TableSpec = {};
    obj.cols = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Boolean', 'type': 'boolean'},
      {'id': 'D', 'label': 'Date', 'type': 'date'},
      {'id': 'E', 'label': 'Timeofday', 'type': 'timeofday'},
      {'id': 'F', 'label': 'Datetime', 'type': 'datetime'},
    ];
    obj.rows = [];

    // 0
    obj.rows.push({
      'c': [
        {'v': 'bbb'},
        {'v': null},
        {'v': null},
        {'v': new Date(2000, 5, 5)},
        {'v': [5, 20, 30, 5]},
        {'v': new Date(2000, 5, 5, 17, 20, 30)},
      ],
      'p': {},
    });

    // 1
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': null},
        {'v': true},
        {'v': new Date(2000, 11, 3)},
        {'v': null},
        {'v': null},
      ],
      'p': {},
    });

    // 1
    obj.rows.push({
      'c': [
        {'v': 'aab'},
        {'v': 7},
        {'v': true},
        {'v': null},
        {'v': [5, 20, 30]},
        {'v': new Date(2000, 11, 3, 4, 2, 4)},
      ],
      'p': {},
    });

    // 2
    obj.rows.push({
      'c': [
        {'v': 'aaa'},
        {'v': -4.5},
        {'v': null},
        {'v': null},
        {'v': [10, 30, 30]},
        {'v': null},
      ],
      'p': {},
    });

    // 3
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': 7},
        {'v': false},
        {'v': new Date(2005, 3, 4)},
        {'v': [23, 23, 23]},
        {'v': new Date(2005, 3, 4, 5, 6, 7)},
      ],
      'p': {},
    });
    const dt = new DataTable(obj);
    assertEquals('aab', dt.getFormattedValue(2, 0));
    dt.sort([
      {
        'column': 0,
        'compare': (v1, v2) => {
          if (v1 == null) return -1;
          if (v2 == null) return 1;
          return v1 < v2 ? -1 : v1 > v2 ? 1 : 0;
        },
      },
    ]);
    assertEquals(null, dt.getValue(0, 0));
    assertEquals(null, dt.getValue(0, 1));
    assertEquals(null, dt.getValue(1, 0));
    assertEquals(7, dt.getValue(1, 1));
    assertEquals(-4.5, dt.getValue(2, 1));
    dt.sort([{'column': 1}, {'column': 4, 'desc': true}]);
    assertEquals('bbb', dt.getValue(0, 0));
    assertEquals(null, dt.getValue(0, 1));
    assertEquals(null, dt.getValue(1, 0));
    assertEquals(null, dt.getValue(1, 1));
    assertEquals('aaa', dt.getValue(2, 0));
    assertEquals(-4.5, dt.getValue(2, 1));
    assertEquals(null, dt.getValue(3, 0));
    assertEquals(7, dt.getValue(3, 1));
    assertEquals('aab', dt.getValue(4, 0));
    assertEquals(7, dt.getValue(4, 1));

    // Test caching invalidation of formatted value.
    assertEquals('aaa', dt.getFormattedValue(2, 0));

    // Test overloads:
    dt.sort({'column': 1, 'desc': true});
    assertEquals(7, dt.getValue(0, 1));
    assertEquals(7, dt.getValue(1, 1));
    assertEquals(-4.5, dt.getValue(2, 1));
    assertEquals(null, dt.getValue(3, 1));
    assertEquals(null, dt.getValue(4, 1));
    dt.sort(1);
    assertEquals(null, dt.getValue(0, 1));
    assertEquals(null, dt.getValue(1, 1));
    assertEquals(-4.5, dt.getValue(2, 1));
    assertEquals(7, dt.getValue(3, 1));
    assertEquals(7, dt.getValue(4, 1));
    dt.sort([2, 1]);
    assertEquals(null, dt.getValue(0, 2));
    assertEquals(null, dt.getValue(0, 1));
    assertEquals(null, dt.getValue(1, 2));
    assertEquals(-4.5, dt.getValue(1, 1));
    assertEquals(false, dt.getValue(2, 2));
    assertEquals(7, dt.getValue(2, 1));
    assertEquals(true, dt.getValue(3, 2));
    assertEquals(null, dt.getValue(3, 1));
    assertEquals(true, dt.getValue(4, 2));
    assertEquals(7, dt.getValue(4, 1));
  });

  it('Gets distinct values correctly', () => {
    const emptyDt = new DataTable({
      'cols': [{'id': 'A', 'label': 'Text', 'type': 'string'}],
      'rows': [],
    });
    let res = emptyDt.getDistinctValues(0);
    assertNotNull(res);
    assertEquals(0, res.length);
    const obj: TableSpec = {};
    obj.cols = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Boolean', 'type': 'boolean'},
      {'id': 'D', 'label': 'Date', 'type': 'date'},
      {'id': 'E', 'label': 'Timeofday', 'type': 'timeofday'},
      {'id': 'F', 'label': 'Datetime', 'type': 'datetime'},
      {'id': 'G', 'label': 'AllNulls', 'type': 'date'},
      {'id': 'I', 'label': 'NoNulls', 'type': 'number'},
      {'id': 'J', 'label': 'NoRepetitions', 'type': 'string'},
      {'id': 'H', 'label': 'NoNullsOrRepetitions', 'type': 'number'},
    ];
    obj.rows = [];
    obj.rows.push({
      'c': [
        {'v': 'bbb'},
        {'v': null},
        {'v': null},
        {'v': new Date(2000, 5, 5)},
        {'v': [5, 20, 30, 5]},
        {'v': new Date(2000, 5, 5, 17, 20, 30)},
        {'v': null},
        {'v': 6},
        {'v': 4},
        {'v': 4},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': null},
        {'v': true},
        {'v': new Date(2000, 11, 3)},
        {'v': null},
        {'v': null},
        {'v': null},
        {'v': 5},
        {'v': 3},
        {'v': 3},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': 'aab'},
        {'v': 7},
        {'v': true},
        {'v': null},
        {'v': [5, 20, 30]},
        {'v': new Date(2000, 5, 5, 4, 2, 4)},
        {'v': null},
        {'v': 6},
        {'v': null},
        {'v': 10},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': 'aaa'},
        {'v': -4.5},
        {'v': null},
        {'v': null},
        {'v': [10, 30, 30]},
        {'v': null},
        {'v': null},
        {'v': 5},
        {'v': 89},
        {'v': 98},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': 7},
        {'v': false},
        {'v': new Date(2000, 5, 5)},
        {'v': [10, 30, 30]},
        {'v': new Date(2000, 5, 5, 17, 20, 30)},
        {'v': null},
        {'v': 4},
        {'v': 120},
        {'v': 22},
      ],
      'p': {},
    });
    const dt = new DataTable(obj);
    res = dt.getDistinctValues(0);
    assertEquals(4, res.length);
    assertEquals(null, res[0]);
    assertEquals('aaa', res[1]);
    assertEquals('aab', res[2]);
    assertEquals('bbb', res[3]);
    res = dt.getDistinctValues(1);
    assertEquals(3, res.length);
    assertEquals(null, res[0]);
    assertEquals(-4.5, res[1]);
    assertEquals(7, res[2]);
    res = dt.getDistinctValues(2);
    assertEquals(3, res.length);
    assertEquals(null, res[0]);
    assertEquals(false, res[1]);
    assertEquals(true, res[2]);
    res = dt.getDistinctValues(3);
    assertEquals(3, res.length);
    assertEquals(null, res[0]);
    assertDateEquals(new Date(2000, 5, 5), res[1]);
    assertDateEquals(new Date(2000, 11, 3), res[2]);
    res = dt.getDistinctValues(4);
    assertEquals(4, res.length);
    assertEquals(null, res[0]);
    assertTrue(isArrayEquals([5, 20, 30], res[1]));
    assertTrue(isArrayEquals([5, 20, 30, 5], res[2]));
    assertTrue(isArrayEquals([10, 30, 30], res[3]));
    res = dt.getDistinctValues(5);
    assertEquals(3, res.length);
    assertEquals(null, res[0]);
    assertDateEquals(new Date(2000, 5, 5, 4, 2, 4), res[1]);
    assertDateEquals(new Date(2000, 5, 5, 17, 20, 30), res[2]);
    res = dt.getDistinctValues(6);
    assertEquals(1, res.length);
    assertEquals(null, res[0]);
    res = dt.getDistinctValues(7);
    assertEquals(3, res.length);
    assertEquals(4, res[0]);
    assertEquals(5, res[1]);
    assertEquals(6, res[2]);
    res = dt.getDistinctValues(8);
    assertEquals(5, res.length);
    assertEquals(null, res[0]);
    assertEquals(3, res[1]);
    assertEquals(4, res[2]);
    assertEquals(89, res[3]);
    assertEquals(120, res[4]);
    res = dt.getDistinctValues(9);
    assertEquals(5, res.length);
    assertEquals(3, res[0]);
    assertEquals(4, res[1]);
    assertEquals(10, res[2]);
    assertEquals(22, res[3]);
    assertEquals(98, res[4]);

    // Test getDistinctValues in a DataView.
    const view = new DataView(dt);
    view.setColumns([1, 4]);
    res = view.getDistinctValues(0);
    assertTrue(isArrayEquals([null, -4.5, 7], res));
  });

  it('Gets filtered rows correctly', () => {
    const obj: TableSpec = {};
    obj.cols = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Boolean', 'type': 'boolean'},
      {'id': 'D', 'label': 'Date', 'type': 'date'},
      {'id': 'E', 'label': 'Timeofday', 'type': 'timeofday'},
      {'id': 'F', 'label': 'Datetime', 'type': 'datetime'},
      {'id': 'G', 'label': 'AllNulls', 'type': 'date'},
      {'id': 'I', 'label': 'NoNulls', 'type': 'number'},
      {'id': 'J', 'label': 'NoRepetitions', 'type': 'string'},
      {'id': 'H', 'label': 'NoNullsOrRepetitions', 'type': 'number'},
    ];
    obj.rows = [];

    // 0
    obj.rows.push({
      'c': [
        {'v': 'bbb'},
        {'v': null},
        {'v': null},
        {'v': new Date(2000, 5, 5)},
        {'v': [5, 20, 30, 5]},
        {'v': new Date(2000, 5, 5, 17, 20, 30)},
        {'v': null},
        {'v': 6},
        {'v': 4},
        {'v': 4},
      ],
      'p': {},
    });

    // 1
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': null},
        {'v': true},
        {'v': new Date(2000, 11, 3)},
        {'v': null},
        {'v': null},
        {'v': null},
        {'v': 5},
        {'v': 3},
        {'v': 3},
      ],
      'p': {},
    });

    // 2
    obj.rows.push({
      'c': [
        {'v': 'aab'},
        {'v': 7},
        {'v': true},
        {'v': null},
        {'v': [5, 20, 30]},
        {'v': new Date(2000, 5, 5, 4, 2, 4)},
        {'v': null},
        {'v': 6},
        {'v': null},
        {'v': 10},
      ],
      'p': {},
    });

    // 3
    obj.rows.push({
      'c': [
        {'v': 'aaa'},
        {'v': -4.5},
        {'v': null},
        {'v': null},
        {'v': [10, 30, 30]},
        {'v': null},
        {'v': null},
        {'v': 5},
        {'v': 89},
        {'v': 98},
      ],
      'p': {},
    });

    // 4
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': 7},
        {'v': false},
        {'v': new Date(2000, 5, 5)},
        {'v': [10, 30, 30]},
        {'v': new Date(2000, 5, 5, 17, 20, 30)},
        {'v': null},
        {'v': 4},
        {'v': 120},
        {'v': 22},
      ],
      'p': {},
    });
    const dt = new DataTable(obj);
    assertArrayEquals([2], dt.getFilteredRows([{'column': 0, 'value': 'aab'}]));
    assertArrayEquals(
      [1, 3],
      dt.getFilteredRows([
        {'column': 6, 'value': null},
        {'column': 7, 'value': 5},
      ]),
    );
    assertArrayEquals(
      [2],
      dt.getFilteredRows([
        {'column': 1, 'value': 7},
        {'column': 9, 'value': 10},
      ]),
    );
    assertArrayEquals(
      [0, 4],
      dt.getFilteredRows([{'column': 3, 'value': new Date(2000, 5, 5)}]),
    );
    assertArrayEquals(
      [3],
      dt.getFilteredRows([
        {'column': 4, 'value': [10, 30, 30]},
        {'column': 2, 'value': null},
      ]),
    );
    assertArrayEquals(
      [4],
      dt.getFilteredRows([
        {'column': 4, 'value': [10, 30, 30]},
        {'column': 2, 'value': false},
      ]),
    );
    assertArrayEquals(
      [1, 3],
      dt.getFilteredRows([
        {
          'column': 8,
          'test': (value) => {
            if (typeof value !== 'number') return false;
            // true if not null and odd.
            return value !== null && 0 !== value % 2;
          },
        },
      ]),
    );
    assertArrayEquals(
      [0, 4],
      dt.getFilteredRows([
        {
          'column': 8,
          'minValue': 2,
          // excludes null
          'test': (value) => {
            if (typeof value !== 'number') return true;
            // true if null or even. (null % 2 == 0)
            return 0 === value % 2;
          },
        },
      ]),
    );
    assertArrayEquals(
      [0, 2, 4],
      dt.getFilteredRows((data, rowIndex) => {
        const value = data.getValue(rowIndex, 8);
        if (typeof value !== 'number') return true;
        // true if null or even.
        return 0 === value % 2;
      }),
    );

    // Test getFilteredRows in a DataView.
    const view = new DataView(dt);
    view.setColumns([4, 0]);
    assertThrows(() => {
      view.getFilteredRows([{'column': 2, 'value': 'aab'}]);
    });
    assertTrue(
      isArrayEquals([2], view.getFilteredRows([{'column': 1, 'value': 'aab'}])),
    );
  });

  it('Computes columnRange correctly', () => {
    const obj: TableSpec = {};
    obj.cols = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Boolean', 'type': 'boolean'},
      {'id': 'D', 'label': 'Date', 'type': 'date'},
      {'id': 'E', 'label': 'Timeofday', 'type': 'timeofday'},
      {'id': 'F', 'label': 'Datetime', 'type': 'datetime'},
      {'id': 'G', 'label': 'AllNulls', 'type': 'date'},
      {'id': 'H', 'label': 'AlmostAllNulls1', 'type': 'string'},
      {'id': 'I', 'label': 'AlmostAllNulls2', 'type': 'number'},
    ];
    obj.rows = [];
    obj.rows.push({
      'c': [
        {'v': 'bbb'},
        {'v': null},
        {'v': null},
        {'v': new Date(2000, 5, 5)},
        {'v': [5, 20, 30, 5]},
        {'v': new Date(2000, 5, 5, 17, 20, 30)},
        {'v': null},
        {'v': null},
        {'v': 8},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': null},
        {'v': true},
        {'v': new Date(2000, 11, 3)},
        {'v': null},
        {'v': null},
        {'v': null},
        {'v': null},
        {'v': null},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': 'aab'},
        {'v': 7},
        {'v': true},
        {'v': null},
        {'v': [5, 20, 30]},
        {'v': new Date(2000, 11, 3, 4, 2, 4)},
        {'v': null},
        {'v': 'foo'},
        {'v': null},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': 'aaa'},
        {'v': -4.5},
        {'v': null},
        {'v': null},
        {'v': [10, 30, 30]},
        {'v': null},
        {'v': null},
        {'v': null},
        {'v': null},
      ],
      'p': {},
    });
    obj.rows.push({
      'c': [
        {'v': null},
        {'v': 7},
        {'v': false},
        {'v': new Date(2005, 3, 4)},
        {'v': [23, 23, 23]},
        {'v': new Date(2005, 3, 4, 5, 6, 7)},
        {'v': null},
        {'v': null},
        {'v': null},
      ],
      'p': {},
    });
    const dt = new DataTable(obj);
    const rangeA = dt.getColumnRange(0);
    const rangeB = dt.getColumnRange(1);
    const rangeC = dt.getColumnRange(2);
    const rangeD = dt.getColumnRange(3);
    const rangeE = dt.getColumnRange(4);
    const rangeF = dt.getColumnRange(5);
    const rangeG = dt.getColumnRange(6);
    const rangeH = dt.getColumnRange(7);
    const rangeI = dt.getColumnRange(8);
    assertEquals('aaa', rangeA.min);
    assertEquals('bbb', rangeA.max);
    assertEquals(-4.5, rangeB.min);
    assertEquals(7, rangeB.max);
    assertEquals(false, rangeC.min);
    assertEquals(true, rangeC.max);
    assertEquals(
      new Date(2000, 5, 5).getTime(),
      (rangeD.min as Date).getTime(),
    );
    assertEquals(
      new Date(2005, 3, 4).getTime(),
      (rangeD.max as Date).getTime(),
    );
    const rangeEMin = rangeE.min as Array<number | null>;
    const rangeEMax = rangeE.max as Array<number | null>;
    assertEquals(5, rangeEMin[0]);
    assertEquals(20, rangeEMin[1]);
    assertEquals(30, rangeEMin[2]);
    assertEquals(23, rangeEMax[0]);
    assertEquals(23, rangeEMax[1]);
    assertEquals(23, rangeEMax[2]);
    assertEquals(
      new Date(2000, 5, 5, 17, 20, 30).getTime(),
      (rangeF.min as Date).getTime(),
    );
    assertEquals(
      new Date(2005, 3, 4, 5, 6, 7).getTime(),
      (rangeF.max as Date).getTime(),
    );
    assertEquals(null, rangeG.min);
    assertEquals(null, rangeG.max);
    assertEquals('foo', rangeH.min);
    assertEquals('foo', rangeH.max);
    assertEquals(8, rangeI.min);
    assertEquals(8, rangeI.max);

    // Test min-max in a DataView.
    {
      const view = new DataView(dt);
      view.setColumns([1, 2, 5]);
      const rangeB = view.getColumnRange(0);
      assertEquals(-4.5, rangeB.min);
      assertEquals(7, rangeB.max);
    }
  });

  describe('test parseCell', () => {
    // Test 'v', special cases
    it('works given undefined', () => {
      assertObjectEquals({'v': null}, parseCell(undefined));
    });
    it('works given null', () => {
      assertObjectEquals({'v': null}, parseCell(null));
    });
    it('works given 0', () => {
      assertObjectEquals({'v': 0}, parseCell(0));
    });
    it('works given false', () => {
      assertObjectEquals({'v': false}, parseCell(false));
    });
    it('works given empty string', () => {
      assertObjectEquals({'v': ''}, parseCell(''));
    });
    it('works given Infinity', () => {
      assertObjectEquals({'v': Infinity}, parseCell(Infinity));
    });
    it('works given NaN', () => {
      // Since we can't do assertObjectEquals(NaN, NaN), just test directly.
      const nanCell = parseCell(NaN);
      assertTrue(typeof nanCell.v === 'number' && isNaN(nanCell.v));
    });
    it('works given 123', () => {
      // Test 'v', normal values
      assertObjectEquals({'v': 123}, parseCell(123));
    });
    it('works given true', () => {
      assertObjectEquals({'v': true}, parseCell({'v': true}));
    });
    it('works given false', () => {
      assertObjectEquals({'v': false}, parseCell({'v': false}));
    });
    it('works given date', () => {
      assertObjectEquals(
        {'v': new Date(2012, 11, 12)},
        parseCell({'v': new Date(2012, 11, 12)}),
      );
    });
    it('works given timeofday', () => {
      assertObjectEquals({'v': [1, 2, 3, 4]}, parseCell({'v': [1, 2, 3, 4]}));
    });

    // Test 'f'
    it("tests formatted value ('f'), if specified, must be a string.", () => {
      assertThrows(goog.partial(parseCell, {'v': 123, 'f': 123}));
    });
    it("tests formatted value ('f'), with null, should be acceptable", () => {
      assertNotThrows(goog.partial(parseCell, {'v': 123, 'f': null}));
    });
    it('works given f: null', () => {
      assertObjectEquals({'v': 123}, parseCell({'v': 123, 'f': null}));
    });
    it("tests formatted value ('f'), with string, should be acceptable", () => {
      assertNotThrows(goog.partial(parseCell, {'v': 123, 'f': '123'}));
    });
    it('tests formatted value', () => {
      assertObjectEquals(
        {'v': 123, 'f': '123'},
        parseCell({'v': 123, 'f': '123'}),
      );
    });

    // Test 'p'
    it("tests formatted value ('p'), if specified, must be an object.", () => {
      assertThrows(goog.partial(parseCell, {'v': 123, 'p': 123}));
    });

    it("test formatted value ('p'), with null, should be acceptable.", () => {
      assertNotThrows(goog.partial(parseCell, {'v': 123, 'p': null}));
    });
    it('works given p: null', () => {
      assertObjectEquals({'v': 123}, parseCell({'v': 123, 'p': null}));
    });
    it("tests formatted value ('p'), with object, should be acceptable.", () => {
      assertNotThrows(goog.partial(parseCell, {'v': 123, 'p': {}}));
    });
    it('works given empty properties', () => {
      assertObjectEquals({'v': 123, 'p': {}}, parseCell({'v': 123, 'p': {}}));
    });
  });

  describe('test findNonNullValueInColumn', () => {
    const data = arrayToDataTable([
      ['node', 'parent', 'size', 'color', 'day', 'time'],
      [true, 'str1', null, null, null, null],
      [null, 'str2', null, null, new Date(2000, 1, 1), null],
      [null, null, 2, null, new Date(2000, 1, 2), null],
      [
        null,
        null,
        1,
        [15, 30, 10],
        new Date(2000, 1, 3),
        new Date(2000, 1, 3, 1),
      ],
    ]);

    it('should find the first value: true', () => {
      assertEquals(true, findNonNullValueInColumn(data, 3, 0, true));
    });
    it('should find the first value: str2', () => {
      assertEquals('str2', findNonNullValueInColumn(data, 3, 1, true));
    });
    it('should find the current value: str1', () => {
      assertEquals('str1', findNonNullValueInColumn(data, 0, 1, true));
    });
    it('should find the first numeric value: 2', () => {
      assertEquals(2, findNonNullValueInColumn(data, 0, 2, false));
    });
    it('should find the current numeric value: 1', () => {
      assertEquals(1, findNonNullValueInColumn(data, 3, 2, false));
    });
    it('should find the time value', () => {
      assertArrayEquals(
        [15, 30, 10],
        findNonNullValueInColumn(data, 1, 3, false),
      );
    });
    it('should find the converted date value', () => {
      assertEquals(
        Number(new Date(2000, 1, 1)),
        Number(findNonNullValueInColumn(data, 0, 4, false)),
      );
    });
    it('should find the converted datetime value', () => {
      assertEquals(
        Number(new Date(2000, 1, 3, 1)),
        Number(findNonNullValueInColumn(data, 2, 5, false)),
      );
    });
    it('should not find anything', () => {
      assertNull(findNonNullValueInColumn(data, 2, 5, true));
    });
  });

  describe('test fillCalculatedColumn', () => {
    const data = arrayToDataTable([
      ['node', 'parent', 'size', 'color', 'day', 'time'],
      [true, 'str1', null, null, null, null],
      [null, 'str2', null, null, null, null],
      [null, null, 2, null, null, null],
      [
        null,
        null,
        1,
        [15, 30, 10],
        new Date(2000, 1, 1),
        new Date(2000, 1, 1, 1),
      ],
    ]);
    const view = new DataView(data);
    view.setColumns([
      {'calc': 'fillFromTop', 'type': 'boolean', 'sourceColumn': 0},
      {'calc': 'fillFromTop', 'type': 'string', 'sourceColumn': 1},
      {'calc': 'fillFromBottom', 'type': 'number', 'sourceColumn': 2},
      {'calc': 'fillFromTop', 'type': 'timeofday', 'sourceColumn': 3},
      {'calc': 'fillFromTop', 'type': 'date', 'sourceColumn': 4},
      {'calc': 'fillFromTop', 'type': 'datetime', 'sourceColumn': 5},
    ]);

    it('view has 6 columns', () => {
      assertEquals(6, view.getNumberOfColumns());
    });
    it('view has 4 rows', () => {
      assertEquals(4, view.getNumberOfRows());
    });

    it('fills with boolean', () => {
      assertEquals(true, view.getValue(0, 0));
      assertEquals(true, view.getValue(1, 0));
      assertEquals(true, view.getValue(2, 0));
      assertEquals(true, view.getValue(3, 0));
    });

    it('fills with string', () => {
      assertEquals('str2', view.getValue(3, 1));
      assertEquals('str2', view.getValue(2, 1));
      assertEquals('str2', view.getValue(1, 1));
      assertEquals('str1', view.getValue(0, 1));
    });

    it('fills with number', () => {
      assertEquals(2, view.getValue(0, 2));
      assertEquals(2, view.getValue(1, 2));
      assertEquals(2, view.getValue(2, 2));
      assertEquals(1, view.getValue(3, 2));
    });

    it('fills with timeofday', () => {
      assertEquals(null, view.getValue(0, 3));
      assertEquals(null, view.getValue(1, 3));
      assertEquals(null, view.getValue(2, 3));
      assertArrayEquals([15, 30, 10], view.getValue(3, 3));
    });

    it('fills with date', () => {
      assertEquals(null, view.getValue(0, 4));
      assertEquals(null, view.getValue(1, 4));
      assertEquals(null, view.getValue(2, 4));
      assertEquals(Number(new Date(2000, 1, 1)), Number(view.getValue(3, 4)));
    });

    it('fills with datetime', () => {
      assertEquals(null, view.getValue(0, 5));
      assertEquals(null, view.getValue(1, 5));
      assertEquals(null, view.getValue(2, 5));
      assertEquals(
        Number(new Date(2000, 1, 1, 1)),
        Number(view.getValue(3, 5)),
      );
    });
  });

  describe('test fillCalculatedColumn with row filters', () => {
    const data = arrayToDataTable([
      [
        'node',
        'parent',
        {'id': 'size', 'label': 'size', 'type': 'number'},
        'color',
        'day',
        'time',
      ],
      [true, 'str1', null, null, null, null],
      [null, 'str2', null, null, new Date(2000, 1, 1), null],
      [null, null, 2, null, new Date(2000, 1, 2), null],
      [
        null,
        null,
        1,
        [15, 30, 10],
        new Date(2000, 1, 3),
        new Date(2000, 1, 3, 1),
      ],
    ]);
    const view = new DataView(data);
    view.setColumns([
      {'calc': 'fillFromTop', 'type': 'boolean', 'sourceColumn': 0},
      {'calc': 'fillFromTop', 'type': 'string', 'sourceColumn': 1},
      {'calc': 'fillFromBottom', 'type': 'number', 'sourceColumn': 'size'},
      {'calc': 'fillFromTop', 'type': 'timeofday', 'sourceColumn': 3},
      {'calc': 'fillFromTop', 'type': 'date', 'sourceColumn': 4},
      {'calc': 'fillFromTop', 'type': 'datetime', 'sourceColumn': 5},
    ]);
    // Only fill columns for row 2.
    view.setRows([2]);

    it('view has 6 columns', () => {
      assertEquals(6, view.getNumberOfColumns());
    });

    it('view has 1 row', () => {
      assertEquals(1, view.getNumberOfRows());
    });

    it('fills the one row given row filter', () => {
      assertEquals(true, view.getValue(0, 0));
      assertEquals('str2', view.getValue(0, 1));
      assertEquals(2, view.getValue(0, 2));
      assertEquals(null, view.getValue(0, 3));
      assertEquals(Number(new Date(2000, 1, 2)), Number(view.getValue(0, 4)));
      assertEquals(null, view.getValue(0, 5));
    });
  });

  describe('test validateColumnSet', () => {
    const data = arrayToDataTable([
      ['product', {'id': 'amount', 'label': 'Amount', 'type': 'number'}],
      ['apples', 100],
      ['oranges', 200],
    ]);
    const view = new DataView(data);

    it('Identified an invalid column set when it should instead be valid.', () => {
      assertNotThrows(
        goog.partial(validateColumnSet, view, null, [
          1,
          0,
          'amount',
          {calc() {}, 'type': 'string'},
        ]),
      );
    });
  });

  describe('test validateColumnSet InvalidColumnIndex', () => {
    const data = arrayToDataTable([
      ['product', 'number'],
      ['apples', 100],
      ['oranges', 200],
    ]);
    const view = new DataView(data);
    it('Marked as valid a column set with an invalid column index.', () => {
      assertThrowsWithMessage(
        goog.partial(validateColumnSet, view, null, [-1]),
        'Invalid column index -1.  Should be an integer in the range [0-1].',
      );
    });
    it('Marked as valid a column set with an invalid column index.', () => {
      assertThrows(goog.partial(validateColumnSet, view, null, [1, 0, 2]));
      // No column 2
    });
    it('Marked as valid a column set with an invalid column id.', () => {
      assertThrows(
        goog.partial(
          validateColumnSet,
          view,
          null, // No column 'foo'
          [1, 0, 'foo'],
        ),
      );
    });
  });

  describe('test validateColumnSet InvalidCalcColumn', () => {
    const data = arrayToDataTable([
      ['product', 'number'],
      ['apples', 100],
      ['oranges', 200],
    ]);
    const view = new DataView(data);
    const calcFunctions = ['calcfun', 'otherfun'];
    it('Marked as valid a column set with an invalid "calc" column', () => {
      assertThrowsWithMessage(
        goog.partial(validateColumnSet, view, calcFunctions, [false]),
        'Invalid column input, expected either a number, string, or an object.',
      );
    });
  });

  describe('test validateColumnSet InvalidPredefinedCalcColumn', () => {
    const data = arrayToDataTable([
      ['product', 'number'],
      ['apples', 100],
      ['oranges', 200],
    ]);
    const view = new DataView(data);
    const calcFunctions = ['calcfun', 'otherfun'];
    it('Marked as valid a column set with an unknown "calc" function', () => {
      assertThrowsWithMessage(
        goog.partial(validateColumnSet, view, calcFunctions, [
          {'calc': 'not_a_calc_function', 'type': 'number'},
        ]),
        'Unknown function "not_a_calc_function"',
      );
    });
    it(
      'Marked as valid a column set which specifies a predefined function ' +
        'name, even though no predefined functions are defined.',
      () => {
        assertThrowsWithMessage(
          goog.partial(validateColumnSet, view, null, [
            {'calc': 'not_a_calc_function', 'type': 'number'},
          ]),
          'Unknown function "not_a_calc_function"',
        );
      },
    );
  });

  describe('test validateColumnSet InvalidSourceColumn', () => {
    const data = arrayToDataTable([
      ['product', 'number'],
      ['apples', 100],
      ['oranges', 200],
    ]);
    const view = new DataView(data);
    const calcFunctions = ['calcfun', 'otherfun'];
    it('Marked as valid a column set with an invalid "sourceColumn" column, -3', () => {
      assertThrowsWithMessage(
        goog.partial(validateColumnSet, view, calcFunctions, [
          {'calc': 'calcfun', 'type': 'number', 'sourceColumn': -3},
        ]),
        'Invalid column index -3.  Should be an integer in the range [0-1].',
      );
    });
    it(
      'Marked as valid a column set with an invalid "sourceColumn" column, ' +
        '"foo"',
      () => {
        assertThrowsWithMessage(
          goog.partial(validateColumnSet, view, calcFunctions, [
            {'calc': 'calcfun', 'type': 'number', 'sourceColumn': 'foo'},
          ]),
          'Invalid column id "foo"',
        );
      },
    );
  });
});
