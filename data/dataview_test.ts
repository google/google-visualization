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
import {TableSpec} from './types';

import {AbstractDataTable} from './abstract_datatable';
import {arrayToDataTable, DataTable} from './datatable';
import {DataView} from './dataview';

const {
  assertArrayEquals,
  assertEquals,
  assertNotThrows,
  assertNull,
  assertObjectEquals,
  assertThrows,
} = testUtils;

describe('DataView Tests', () => {
  it('Something about error bars', () => {
    const table = new DataTable();
    table.addColumn('string');
    table.addColumn('number');
    table.addRows([
      ['a', 10],
      ['b', 20],
    ]);
    const view = new DataView(table);
    view.setColumns([
      0,
      1,
      {
        'type': 'number',
        'calc': 'error',
        'sourceColumn': 1,
        'magnitude': -10,
        'errorType': 'percent',
        'role': 'interval',
      },
      {
        'type': 'number',
        'calc': 'error',
        'sourceColumn': 1,
        'magnitude': 10,
        'errorType': 'percent',
        'role': 'interval',
      },
    ]);
    assertEquals(9, view.getValue(0, 2));
    assertEquals(11, view.getValue(0, 3));
    assertEquals(18, view.getValue(1, 2));
    assertEquals(22, view.getValue(1, 3));
    view.setColumns([
      0,
      1,
      {
        'type': 'number',
        'calc': 'error',
        'sourceColumn': 1,
        'magnitude': -1,
        'errorType': 'constant',
        'role': 'interval',
      },
      {
        'type': 'number',
        'calc': 'error',
        'sourceColumn': 1,
        'magnitude': 1,
        'errorType': 'constant',
        'role': 'interval',
      },
    ]);
    assertEquals(9, view.getValue(0, 2));
    assertEquals(11, view.getValue(0, 3));
    assertEquals(19, view.getValue(1, 2));
    assertEquals(21, view.getValue(1, 3));
  });

  it('Generates DataView with sourceColumn', () => {
    const dataTable = new DataTable();
    dataTable.addColumn('string');
    dataTable.addColumn('string');
    dataTable.addColumn('string');
    const view1 = new DataView(dataTable);
    view1.setColumns([{'sourceColumn': 1}, {'sourceColumn': 2}]);
    const view2 = new DataView(view1);
    view2.setColumns([{'sourceColumn': 1}]);
    assertEquals(1, view2.getTableColumnIndex(0));
    assertEquals(2, view2.getUnderlyingTableColumnIndex(0));
    assertEquals(0, view2.getViewColumnIndex(1));
  });

  it('Gets property', () => {
    const data = arrayToDataTable([
      ['Foo', 'Bar', 'Baz'],
      ['a', 1, 2],
    ]);
    data.setProperty(0, 1, 'myProperty', 'bla');
    const calcFunc = (dt: AbstractDataTable, r: number) => {
      const v = dt.getValue(r, 1);
      const n = typeof v === 'number' ? v : 0;
      return {'v': n + 1, 'p': {'foo': 'goo'}};
    };
    const view = new DataView(data);
    view.setColumns([
      0,
      1,
      2,
      {'calc': 'stringify', 'sourceColumn': 1, 'type': 'string'},
      {'calc': calcFunc, 'type': 'number'},
    ]);
    assertObjectEquals({'myProperty': 'bla'}, data.getProperties(0, 1));
    assertObjectEquals({'myProperty': 'bla'}, view.getProperties(0, 1));

    // predefined calc function.
    // 'simple calc does not copy properties; properties is {}',
    assertObjectEquals({}, view.getProperties(0, 3));

    // Custom calc function
    assertObjectEquals({'foo': 'goo'}, view.getProperties(0, 4));
  });

  it('Gets property with default formatting', () => {
    const data = arrayToDataTable([
      ['Foo', 'Bar', 'Baz'],
      [123, true, ''],
    ]);
    const view = new DataView(data);
    assertEquals('123', view.getFormattedValue(0, 0));
    assertEquals('true', view.getFormattedValue(0, 1));
    assertEquals('', view.getFormattedValue(0, 2));
  });

  it('Gets property with persistent properties', () => {
    const data = arrayToDataTable([['Foo'], [123]]);
    const view = new DataView(data);
    view.setColumns([
      0,
      {'calc': 'stringify', 'sourceColumn': 0, type: 'string'},
    ]);
    view.getProperties(0, 0)['a'] = 'foo1';
    view.getProperties(0, 1)['a'] = 'foo1';
    assertObjectEquals({'a': 'foo1'}, view.getProperties(0, 0));
    assertObjectEquals({'a': 'foo1'}, view.getProperties(0, 1));
  });

  it('Generates a DataView', () => {
    const dt = new DataTable(null);
    dt.addColumn('string', 'A', 'id1');
    dt.addColumn('number', 'B', 'id2');
    dt.addColumn('boolean', 'C', 'id3');
    dt.addColumn('string', 'D', 'id4');
    dt.setColumnProperty(0, 'p', 'v1');
    dt.addRows(8);
    dt.setValue(0, 0, 'bbb');
    dt.setValue(1, 0, 'ccc');
    dt.setValue(1, 2, true);
    dt.setProperty(1, 2, 'p', 'v2');
    dt.setValue(2, 0, 'aab');
    dt.setFormattedValue(2, 0, 'formatted');
    dt.setValue(2, 1, 7);
    dt.setValue(2, 2, true);
    dt.setValue(3, 0, 'aaa');
    dt.setValue(3, 1, -4.5);
    dt.setValue(4, 1, 7);
    dt.setValue(4, 2, false);
    dt.setValue(5, 0, 'ddd');
    dt.setValue(6, 0, 'eee');
    dt.setValue(7, 0, 'fff');
    let view = new DataView(dt);
    assertThrows(() => {
      view.setColumns([2, 3, 4]);
    });
    view.setColumns([2, 3, 0]);
    assertEquals(3, view.getNumberOfColumns());
    assertEquals(8, view.getNumberOfRows());
    assertEquals('A', view.getColumnLabel(2));
    assertEquals('string', view.getColumnType(1));
    assertEquals('id4', view.getColumnId(1));
    assertEquals(2, view.getColumnIndex('id1'));
    assertEquals('v1', view.getColumnProperty(2, 'p'));
    assertEquals('string', view.getColumnType(2));
    assertEquals(false, view.getValue(4, 0));
    assertEquals('formatted', view.getFormattedValue(2, 2));
    assertEquals('v2', view.getProperty(1, 0, 'p'));
    assertObjectEquals({'p': 'v2'}, view.getProperties(1, 0));
    assertEquals(3, view.getTableColumnIndex(1));
    assertEquals(1, view.getViewColumnIndex(3));

    // Test hideColumns().
    view = new DataView(dt);
    view.hideColumns([1, 3]);
    assertEquals(2, view.getNumberOfColumns());
    assertEquals(8, view.getNumberOfRows());
    assertEquals('id1', view.getColumnId(0));
    assertEquals('id3', view.getColumnId(1));

    // Verify that hiding a column that does not appear in the view and or a
    // column that does not appear in the datatable does not have any effect.
    view.hideColumns([1, 6]);
    assertEquals(2, view.getNumberOfColumns());
    assertEquals(8, view.getNumberOfRows());
    assertEquals('id1', view.getColumnId(0));
    assertEquals('id3', view.getColumnId(1));
  });

  it('Generates a DataTable from a DataView', () => {
    let dt = new DataTable();
    dt.setTableProperty('p', 'table');
    dt.addColumn('number', 'label0', 'id0');
    dt.addColumn('number', 'label1', 'id1');
    dt.setColumnProperty(1, 'p', 'column');
    dt.addRows([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    dt.setRowProperty(2, 'p', 'row');
    dt.setProperty(2, 1, 'p', 'cell');
    const view = new DataView(dt);
    view.setColumns([1]);
    view.setRows([2, 0]);
    dt = view.toDataTable();
    assertEquals('table', dt.getTableProperty('p'));
    assertEquals('column', dt.getColumnProperty(0, 'p'));
    assertEquals('id1', dt.getColumnId(0));
    assertEquals('row', dt.getRowProperty(0, 'p'));
    assertEquals(6, dt.getValue(0, 0));
    assertEquals(2, dt.getValue(1, 0));
    assertEquals('cell', dt.getProperty(0, 0, 'p'));
  });

  it('Generates a DataTable from a DataView with all rows', () => {
    let dt = new DataTable();
    dt.addColumn('number', 'label0', 'id0');
    dt.addColumn('number', 'label1', 'id1');
    dt.addRows([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    const view = new DataView(dt);
    view.setColumns([0]);
    dt = view.toDataTable();
    assertEquals(1, dt.getValue(0, 0));
    assertEquals(3, dt.getValue(1, 0));
    assertEquals(5, dt.getValue(2, 0));
  });

  it('Generates a DataTable from a DataView with calculated columns', () => {
    let dt = new DataTable();
    dt.addColumn('number', 'label0', 'id0');
    dt.addRow([1]);
    const view = new DataView(dt);
    view.setColumns([
      {
        'calc': (dt2: AbstractDataTable, row: number) => {
          const v = dt2.getValue(row, 0);
          const n = typeof v === 'number' ? v : 0;
          return n + 1;
        }, //
        'type': 'number', //
        'label': 'revenue',
        id: 'c0',
      },
      0,
    ]);
    dt = view.toDataTable();

    // Check the calculated column.
    assertEquals('revenue', dt.getColumnLabel(0));
    assertEquals('c0', dt.getColumnId(0));
    assertEquals('number', dt.getColumnType(0));
    assertEquals(2, dt.getValue(0, 0));

    // Check the simple column.
    assertEquals('label0', dt.getColumnLabel(1));
    assertEquals('id0', dt.getColumnId(1));
    assertEquals('number', dt.getColumnType(1));
    assertEquals(1, dt.getValue(0, 1));
  });

  it('Generates a DataTable from a DataView with serializable functions', () => {
    // TODO(dlaliberte): Pending Daniel's fix of obfusaction of 'constant'
    // change back 'notest' to 'test'.
    const dt = new DataTable();
    dt.addColumn('number');
    dt.addRows([[1], [2], [3]]);
    let view = new DataView(dt);
    view.setColumns([
      {'calc': 'emptyString', 'type': 'string'},
      {'calc': 'stringify', 'type': 'string', 'sourceColumn': 0},
    ]);
    assertEquals('', view.getValue(0, 0));
    assertEquals('', view.getValue(1, 0));
    assertEquals('', view.getValue(2, 0));
    assertEquals('1', view.getValue(0, 1));
    assertEquals('2', view.getValue(1, 1));
    assertEquals('3', view.getValue(2, 1));
    view = DataView.fromJSON(dt, view.toJSON());
    assertEquals('', view.getValue(0, 0));
    assertEquals('', view.getValue(1, 0));
    assertEquals('', view.getValue(2, 0));
    assertEquals('1', view.getValue(0, 1));
    assertEquals('2', view.getValue(1, 1));
    assertEquals('3', view.getValue(2, 1));
    assertThrows(() => {
      view.setColumns([{'calc': 'evil', 'type': 'timeofday'}]);
    });
    assertThrows(() => {
      view.setColumns([{'calc': 'stringify', 'sourceColumn': 10}]);
    });
  });

  it('Generates a DataTable from a DataView with nested DataView', () => {
    let dt = new DataTable();
    dt.setTableProperty('p', 'table');
    dt.addColumn('number', 'label0', 'id0');
    dt.addColumn('number', 'label1', 'id1');
    dt.addColumn('number', 'label2', 'id2');
    dt.setColumnProperty(0, 'p', 'column');
    dt.addRows([[0, 1, 2]]);
    let view = new DataView(dt);
    view.setColumns([2, 0, 1]);
    let nested = new DataView(view);

    // [2,0,1]->[2,0,1] == [1,2,0]
    nested.setColumns([2, 0, 1]);
    dt = nested.toDataTable();
    assertEquals('table', dt.getTableProperty('p'));
    assertEquals(1, dt.getValue(0, 0));
    assertEquals(2, dt.getValue(0, 1));
    assertEquals(0, dt.getValue(0, 2));
    assertEquals('column', dt.getColumnProperty(2, 'p'));
    dt = new DataTable();
    dt.setTableProperty('p', 'table');
    dt.addColumn('number', 'label0', 'id0');
    dt.addRows([[0], [1], [2]]);
    dt.setRowProperty(0, 'p', 'row');
    view = new DataView(dt);
    view.setRows([2, 0, 1]);
    nested = new DataView(view);

    // [2,0,1]->[2,0,1] == [1,2,0]
    nested.setRows([2, 0, 1]);
    dt = nested.toDataTable();
    assertEquals('table', dt.getTableProperty('p'));
    assertEquals(1, dt.getValue(0, 0));
    assertEquals(2, dt.getValue(1, 0));
    assertEquals(0, dt.getValue(2, 0));
    assertEquals('row', dt.getRowProperty(2, 'p'));
  });

  it('Generates a DataTable from a deeply nested DataView', () => {
    const dt = new DataTable();
    dt.addColumn('number', 'label0', 'id0');
    dt.addColumn('number', 'label1', 'id1');
    dt.addColumn('number', 'label2', 'id2');
    dt.addRows([[0, 1, 2]]);
    let view = new DataView(dt);
    view.setColumns([2, 0, 1]);
    let nested = new DataView(view);

    // [2,0,1]->[2,0,1] == [1,2,0]
    nested.setColumns([2, 0, 1]);
    // Check whether underlying table columns indexes improperly resolved.
    assertArrayEquals(
      [1, 2, 0],
      [
        nested.getUnderlyingTableColumnIndex(0),
        nested.getUnderlyingTableColumnIndex(1),
        nested.getUnderlyingTableColumnIndex(2),
      ],
    );

    // Test again with the middle view not applying any filter
    view = new DataView(dt);
    nested = new DataView(view);
    nested.setColumns([2, 0, 1]);
    assertArrayEquals(
      [2, 0, 1],
      [
        nested.getUnderlyingTableColumnIndex(0),
        nested.getUnderlyingTableColumnIndex(1),
        nested.getUnderlyingTableColumnIndex(2),
      ],
    );

    // Test again with the end view not applying any filter
    view = new DataView(dt);
    view.setColumns([2, 0, 1]);
    nested = new DataView(view);
    assertArrayEquals(
      [2, 0, 1],
      [
        nested.getUnderlyingTableColumnIndex(0),
        nested.getUnderlyingTableColumnIndex(1),
        nested.getUnderlyingTableColumnIndex(2),
      ],
    );
  });

  it('Generates a DataTable from a nested DataView with calc columns', () => {
    const data = arrayToDataTable([
      ['Foo', 'Bar', 'Baz'],
      ['a', 1, 2],
    ]);
    const view = new DataView(data);
    view.setColumns([
      2,
      {
        'calc': (dt: AbstractDataTable, rowIdx: number) => {
          const v1 = dt.getValue(rowIdx, 1);
          const v2 = dt.getValue(rowIdx, 2);
          const n = Number(v1) + Number(v2);
          return n;
        },
        'type': 'number',
        'label': 'calc',
        'id': 'calcId',
      },
    ]);
    const nested = new DataView(view);

    // [1,0]->[2, 'calc'] == ['calc', 2]
    nested.setColumns([1, 0]);
    assertEquals(-1, nested.getUnderlyingTableColumnIndex(0));
    assertEquals(2, nested.getUnderlyingTableColumnIndex(1));
  });

  it('Generates a DataTable from a nested DataView with row indexing', () => {
    const dt = new DataTable();
    dt.addColumn('number', 'label0', 'id0');
    dt.addRows([[0], [1], [2], [3], [4], [5]]);
    let view = new DataView(dt);
    view.setRows([3, 1, 5]);
    let nested = new DataView(view);

    // [2,0,1]->[3,1,5] == [5,3,1]
    nested.setRows([2, 0, 1]);
    // 'Parent dataview row indexes improperly resolved.'
    assertArrayEquals(
      [2, 0, 1],
      [
        nested.getTableRowIndex(0),
        nested.getTableRowIndex(1),
        nested.getTableRowIndex(2),
      ],
    );
    // 'Underlying table row indexes improperly resolved.'
    assertArrayEquals(
      [5, 3, 1],
      [
        nested.getUnderlyingTableRowIndex(0),
        nested.getUnderlyingTableRowIndex(1),
        nested.getUnderlyingTableRowIndex(2),
      ],
    );

    // Test again with the middle view not applying any filter.
    view = new DataView(dt);
    nested = new DataView(view);
    nested.setRows([2, 0, 1]);
    // 'Underlying table row indexes improperly resolved.'
    assertArrayEquals(
      [2, 0, 1],
      [
        nested.getUnderlyingTableRowIndex(0),
        nested.getUnderlyingTableRowIndex(1),
        nested.getUnderlyingTableRowIndex(2),
      ],
    );

    // Test again with the end view not applying any filter.
    view = new DataView(dt);
    view.setRows([3, 1, 5]);
    nested = new DataView(view);
    // 'Underlying table row indexes improperly resolved.'
    assertArrayEquals(
      [3, 1, 5],
      [
        nested.getUnderlyingTableRowIndex(0),
        nested.getUnderlyingTableRowIndex(1),
        nested.getUnderlyingTableRowIndex(2),
      ],
    );
  });

  it('Generates a DataTable from a nested DataView with row indexing 2', () => {
    // With 4-deep chain of dataviews.
    const dt = new DataTable();
    dt.addColumn('number', 'label0', 'id0');
    dt.addRows([[0], [1], [2], [3], [4], [5]]);
    const grandgrandview = new DataView(dt);
    grandgrandview.setRows(
      // inverts row ordering.
      [5, 4, 3, 2, 1, 0],
    );
    const grandview = new DataView(grandgrandview);
    grandview.setRows(
      // swap pairs
      [1, 0, 3, 2, 5, 4],
    );
    const view = new DataView(grandview);
    view.setRows(
      // truncate to first 4
      [0, 1, 2, 3],
    );
    const childview = new DataView(view);
    childview.setRows(
      // reverts swapping and ordering.
      [2, 3, 0, 1],
    );

    // Expected result is the _last_ 4 rows of the original table.
    assertEquals(4, childview.getNumberOfRows());
    assertArrayEquals(
      [2, 3, 4, 5],
      [
        childview.getUnderlyingTableRowIndex(0),
        childview.getUnderlyingTableRowIndex(1),
        childview.getUnderlyingTableRowIndex(2),
        childview.getUnderlyingTableRowIndex(3),
      ],
    );
  });

  it('Generates DataTable and DataView with properties', () => {
    const obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'AA', 'type': 'string'},
      {'id': 'B', 'label': 'BB', 'type': 'number'},
    ];
    obj['rows'] = [];
    obj['rows'].push({
      'c': [
        {'v': 'afoo', 'f': 'afoofoo'},
        {'v': 1, 'f': 'bfoo'},
      ],
      'p': {'k1': 'v1', 'k2': 'v2'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abar', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
      ],
      'p': {},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abaz', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
      ],
    });
    obj['p'] = {'sensi': 'milia', 'dub': 'reggae'};

    const dt = new DataTable(obj);
    const view = new DataView(dt);

    assertObjectEquals(
      {'sensi': 'milia', 'dub': 'reggae'},
      dt.getTableProperties(),
    );
    assertEquals('milia', dt.getTableProperty('sensi'));
    assertEquals('reggae', dt.getTableProperty('dub'));
    assertObjectEquals(
      {'sensi': 'milia', 'dub': 'reggae'},
      view.getTableProperties(),
    );
    assertEquals('milia', view.getTableProperty('sensi'));
    assertEquals('reggae', view.getTableProperty('dub'));
    dt.setTableProperty('ska', 'rokombine');
    assertObjectEquals(
      {'sensi': 'milia', 'dub': 'reggae', 'ska': 'rokombine'},
      dt.getTableProperties(),
    );
    assertEquals('milia', dt.getTableProperty('sensi'));
    assertEquals('reggae', dt.getTableProperty('dub'));
    assertEquals('rokombine', dt.getTableProperty('ska'));
    assertObjectEquals(
      {'sensi': 'milia', 'dub': 'reggae', 'ska': 'rokombine'},
      view.getTableProperties(),
    );
    assertEquals('milia', view.getTableProperty('sensi'));
    assertEquals('reggae', view.getTableProperty('dub'));
    assertEquals('rokombine', view.getTableProperty('ska'));
  });

  it('Generates correct properties', () => {
    const obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'AA', 'type': 'string'},
      {'id': 'B', 'label': 'BB', 'type': 'number'},
    ];
    obj['rows'] = [];
    obj['rows'].push({
      'c': [
        {'v': 'afoo', 'f': 'afoofoo'},
        {'v': 1, 'f': 'bfoo'},
      ],
      'p': {'k1': 'v1', 'k2': 'v2'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abar', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
      ],
      'p': {},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abaz', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
      ],
    });
    const dt = new DataTable(obj);
    const view = new DataView(dt);

    // Store JSON to verify getters don't change the DataTable.
    const json = dt.toJSON();
    assertEquals('v1', dt.getRowProperty(0, 'k1'));
    assertEquals('v1', view.getRowProperty(0, 'k1'));
    assertObjectEquals({'k1': 'v1', 'k2': 'v2'}, dt.getRowProperties(0));
    assertObjectEquals({'k1': 'v1', 'k2': 'v2'}, view.getRowProperties(0));
    assertNull(dt.getRowProperty(1, 'nonExistingProperty'));
    assertNull(view.getRowProperty(1, 'nonExistingProperty'));
    assertEquals(json, dt.toJSON());
    assertNull(dt.getRowProperty(2, 'noPropertiesAtAll'));
    assertNull(view.getRowProperty(2, 'noPropertiesAtAll'));
    assertEquals(json, dt.toJSON());
    dt.setRowProperty(1, 'k7', 'bomba');
    dt.setRowProperty(0, 'k9', 'klat');
    assertEquals('bomba', dt.getRowProperty(1, 'k7'));
    assertEquals('bomba', view.getRowProperty(1, 'k7'));
    assertObjectEquals({'k7': 'bomba'}, dt.getRowProperties(1));
    assertObjectEquals({'k7': 'bomba'}, view.getRowProperties(1));
    assertObjectEquals(
      {'k1': 'v1', 'k2': 'v2', 'k9': 'klat'},
      dt.getRowProperties(0),
    );
    assertObjectEquals(
      {'k1': 'v1', 'k2': 'v2', 'k9': 'klat'},
      view.getRowProperties(0),
    );
  });

  it('Generates DataTable and DataView with empty column labels', () => {
    const dataTable = new DataTable();
    dataTable.addColumn({'type': 'number'});
    assertEquals('', dataTable.getColumnLabel(0));
    assertEquals('', dataTable.getColumnId(0));
    const dataView = new DataView(dataTable);
    dataView.setColumns([{'type': 'string', 'calc': 'emptyString'}, 0]);
    assertEquals('', dataView.getColumnLabel(0));
    assertEquals('', dataView.getColumnId(0));
  });

  it('Generates DataTable and DataView with column properties', () => {
    let obj: TableSpec = {};
    let dt = new DataTable(null);
    dt.addColumn('string', 'A');
    dt.addColumn('number', 'B');
    dt.addColumn('boolean', 'C');
    dt.setColumnProperty(0, 'myProperty', 7);
    assertEquals(7, dt.getColumnProperty(0, 'myProperty'));
    dt.setColumnProperty(0, 'myProperty', 8);
    assertEquals(8, dt.getColumnProperty(0, 'myProperty'));
    dt.setColumnProperties(1, {'myProperty': 'foo', 'otherProperty': true});
    assertEquals('foo', dt.getColumnProperty(1, 'myProperty'));
    const props = dt.getColumnProperties(1);
    assertEquals('foo', props['myProperty']);

    // Store JSON to verify getters don't change the DataTable.
    const json = dt.toJSON();
    assertEquals(true, dt.getColumnProperty(1, 'otherProperty'));
    assertEquals(json, dt.toJSON());
    assertNull(dt.getColumnProperty(0, 'nonExistingProperty'));
    assertEquals(json, dt.toJSON());
    assertNull(dt.getColumnProperty(2, 'noPropertiesAtAll'));
    assertEquals(json, dt.toJSON());
    obj = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'AA', 'type': 'string', 'p': {'lalala': 'gagaga'}},
      {'id': 'B', 'label': 'BB', 'type': 'number'},
    ];
    obj['rows'] = [];
    obj['rows'].push({
      'c': [
        {'v': 'afoo', 'f': 'afoofoo'},
        {'v': 1, 'f': 'bfoo'},
      ],
      'p': {'k1': 'v1', 'k2': 'v2'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abar', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
      ],
      'p': {},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abaz', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
      ],
    });

    dt = new DataTable(obj);
    const view = new DataView(dt);
    assertObjectEquals({'lalala': 'gagaga'}, dt.getColumnProperties(0));
    assertObjectEquals({'lalala': 'gagaga'}, view.getColumnProperties(0));
    assertEquals('gagaga', dt.getColumnProperty(0, 'lalala'));
    assertEquals('gagaga', view.getColumnProperty(0, 'lalala'));
    dt.setColumnProperty(1, 'k7', 'bomba');
    dt.setColumnProperties(0, {'k9': 'klat'});
    assertEquals('bomba', dt.getColumnProperty(1, 'k7'));
    assertEquals('bomba', view.getColumnProperty(1, 'k7'));
    assertObjectEquals({'k9': 'klat'}, dt.getColumnProperties(0));
    assertObjectEquals({'k9': 'klat'}, view.getColumnProperties(0));
  });

  it('Generates DataView, hiding and showing rows and columns', () => {
    let obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'AA', 'type': 'string', 'p': {'lalala': 'gagaga'}},
      {'id': 'B', 'label': 'BB', 'type': 'number'},
      {'id': 'C', 'type': 'string'},
      {'id': 'D', 'type': 'number'},
      {'id': 'E', 'type': 'string'},
    ];
    obj['rows'] = [];
    obj['rows'].push({
      'c': [
        {'v': 'afoo', 'f': 'afoofoo'},
        {'v': 1, 'f': 'bfoo'},
        {'v': 'a1'},
        {'v': 1},
        {'v': 'c1'},
      ],
      'p': {'k1': 'v1', 'k2': 'v2'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abar', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
        {'v': 'a2'},
        {'v': 2, 'f': 'chuku'},
        {'v': 'c2'},
      ],
      'p': {},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abaz', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
        {'v': 'a3'},
        {'v': 3},
        {'v': 'c3'},
      ],
    });
    let dt = new DataTable(obj);
    let dv = new DataView(dt);
    dv.setColumns([3, 3, 2, 4]);
    assertEquals(4, dv.getNumberOfColumns());
    assertEquals(3, dv.getTableColumnIndex(0));
    assertEquals(3, dv.getTableColumnIndex(1));
    assertEquals(2, dv.getTableColumnIndex(2));
    assertEquals(4, dv.getTableColumnIndex(3));
    assertEquals(0, dv.getViewColumnIndex(3));
    assertEquals(2, dv.getViewColumnIndex(2));
    assertEquals(3, dv.getViewColumnIndex(4));
    dv.hideColumns([2]);
    assertEquals(3, dv.getNumberOfColumns());
    assertEquals(3, dv.getTableColumnIndex(0));
    assertEquals(3, dv.getTableColumnIndex(1));
    assertEquals(4, dv.getTableColumnIndex(2));
    assertEquals(0, dv.getViewColumnIndex(3));
    assertEquals(2, dv.getViewColumnIndex(4));
    assertEquals(1, dv.getValue(0, 0));
    assertEquals(1, dv.getValue(0, 1));
    assertEquals('c1', dv.getValue(0, 2));
    assertEquals(2, dv.getValue(1, 0));
    assertEquals('chuku', dv.getFormattedValue(1, 1));
    assertEquals('c2', dv.getValue(1, 2));
    assertEquals(3, dv.getValue(2, 0));
    assertEquals(3, dv.getValue(2, 1));
    assertEquals('c3', dv.getValue(2, 2));
    dv.setRows([2, 2, 1, 0]);
    assertEquals(4, dv.getNumberOfRows());
    assertEquals(2, dv.getTableRowIndex(0));
    assertEquals(2, dv.getTableRowIndex(1));
    assertEquals(1, dv.getTableRowIndex(2));
    assertEquals(0, dv.getTableRowIndex(3));
    assertEquals(0, dv.getViewRowIndex(2));
    assertEquals(2, dv.getViewRowIndex(1));
    assertEquals(3, dv.getViewRowIndex(0));
    dv.hideRows([1]);
    assertEquals(3, dv.getNumberOfRows());
    assertEquals(2, dv.getTableRowIndex(0));
    assertEquals(2, dv.getTableRowIndex(1));
    assertEquals(0, dv.getTableRowIndex(2));
    assertEquals(0, dv.getViewRowIndex(2));
    assertEquals(2, dv.getViewRowIndex(0));

    // Columns now: 3 3 4
    // Rows: 2 2 0
    assertEquals(3, dv.getValue(0, 0));
    assertEquals(3, dv.getValue(0, 1));
    assertEquals('c3', dv.getValue(0, 2));
    assertEquals(3, dv.getValue(1, 0));
    assertEquals(3, dv.getValue(1, 1));
    assertEquals('c3', dv.getValue(1, 2));
    assertEquals(1, dv.getValue(2, 0));
    assertEquals(1, dv.getValue(2, 1));
    assertEquals('c1', dv.getValue(2, 2));
    let range = dv.getColumnRange(0);
    assertEquals(1, range['min']);
    assertEquals(3, range['max']);
    range = dv.getColumnRange(1);
    assertEquals(1, range['min']);
    assertEquals(3, range['max']);
    const distinctValues = dv.getDistinctValues(2);
    assertEquals('c1', distinctValues[0]);
    assertEquals('c3', distinctValues[1]);

    // Test convenience syntax & getters
    dv.setRows(0, 2);
    dv.setColumns([0, 2, 2]);
    assertArrayEquals([0, 1, 2], dv.getViewRows());
    assertArrayEquals([0, 2, 2], dv.getViewColumns());
    dv.hideRows(1, 1);
    assertArrayEquals([0, 2], dv.getViewRows());

    // Test view on view
    dv.setRows([2, 0, 1, 1, 2]);
    dv.setColumns([2, 0, 1, 2, 0]);
    const innerView = new DataView(dv);
    innerView.setRows([0, 2, 0, 1, 3]);
    innerView.setColumns([1, 3, 1, 2]);
    assertEquals(2, dt.getValue(1, 1));
    assertEquals(2, dv.getValue(3, 2));
    assertEquals(2, innerView.getValue(4, 3));
    dt.setValue(1, 1, 17);
    assertEquals(17, dt.getValue(1, 1));
    assertEquals(17, dv.getValue(3, 2));
    assertEquals(17, innerView.getValue(4, 3));

    // Test that by default, if you add rows to the underlying datatable
    // the view updates
    obj = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'AA', 'type': 'string', 'p': {'lalala': 'gagaga'}},
      {'id': 'B', 'label': 'BB', 'type': 'number'},
      {'id': 'C', 'type': 'string'},
      {'id': 'D', 'type': 'number'},
      {'id': 'E', 'type': 'string'},
    ];
    obj['rows'] = [];
    dt = new DataTable(obj);
    dv = new DataView(dt);
    dv.setColumns([4, 2]);
    assertEquals(0, dv.getNumberOfRows());
    dt.addRow(['blah', 3, {'v': 'blah', 'f': 'foo'}, 3, 'blah']);
    assertEquals(1, dv.getNumberOfRows());
    assertEquals('blah', dv.getValue(0, 1));
    assertEquals('foo', dv.getFormattedValue(0, 1));
    assertEquals(2, dv.getTableColumnIndex(1));
    assertEquals(0, dv.getViewColumnIndex(4));
    assertEquals(0, dv.getTableRowIndex(0));
    assertEquals(0, dv.getViewRowIndex(0));
    assertArrayEquals([4, 2], dv.getViewColumns());
    assertArrayEquals([0], dv.getViewRows());
  });

  it('Generates DataView with calculated columns', () => {
    const obj: TableSpec = {};
    obj['cols'] = [{'type': 'string'}, {'type': 'number'}, {'type': 'number'}];
    obj['rows'] = [];
    const data = new DataTable(obj);
    data.addRows([
      ['a', 1, 2],
      ['b', 3, 4],
      ['c', 3, 4],
      ['d', 5, 6],
    ]);
    let view = new DataView(data);
    view.setColumns([
      0,
      {
        'calc': (dt: AbstractDataTable, rowIdx: number) => {
          const v1 = dt.getValue(rowIdx, 1);
          const v2 = dt.getValue(rowIdx, 2);
          const n = Number(v1) + Number(v2);
          return n;
        },
        'type': 'number',
        'label': 'calc',
        'id': 'calcId',
      },
    ]);

    // Test view functionality.
    assertEquals(2, view.getNumberOfColumns());
    assertEquals(4, view.getNumberOfRows());
    assertEquals('calc', view.getColumnLabel(1));
    assertEquals('calcId', view.getColumnId(1));
    assertEquals(1, view.getColumnIndex('calcId'));
    assertEquals(0, view.getViewColumnIndex(0));
    assertEquals(0, view.getTableColumnIndex(0));
    assertEquals(-1, view.getTableColumnIndex(1));
    assertNull(view.getColumnProperty(1, 'a'));
    assertObjectEquals({}, view.getColumnProperties(1));
    assertEquals('a', view.getValue(0, 0));
    assertEquals(3, view.getValue(0, 1));
    assertEquals('3', view.getFormattedValue(0, 1));
    assertNull(view.getProperty(0, 1, 'a'));
    assertObjectEquals({}, view.getProperties(0, 1));
    assertObjectEquals({'min': 3, 'max': 11}, view.getColumnRange(1));
    assertArrayEquals([3, 7, 11], view.getDistinctValues(1));
    assertArrayEquals([0, 1, 2, 3], view.getSortedRows([1]));
    assertArrayEquals(
      [1, 2],
      view.getFilteredRows([{'column': 1, 'value': 7}]),
    );

    // Test hiding rows.
    view.hideRows(1, 2);
    assertEquals(2, view.getNumberOfRows());
    assertEquals('a', view.getValue(0, 0));
    assertEquals(3, view.getValue(0, 1));
    assertEquals('d', view.getValue(1, 0));
    assertEquals(11, view.getValue(1, 1));

    {
      // Verify that a calculated column with no type throws an error.
      view = new DataView(data);
      try {
        view.setColumns([
          0,
          {
            'calc': (dt: AbstractDataTable, rowIdx: number) => {
              const v1 = dt.getValue(rowIdx, 1);
              const v2 = dt.getValue(rowIdx, 2);
              const n = Number(v1) + Number(v2);
              return n;
            },
            'label': 'calc',
            'id': 'calcId',
          },
        ]);
      } catch (er: unknown) {
        // Expected behavior.
        return;
      }
      fail(
        'Creating a view with calculated column and no type should throw an' +
          ' error.',
      );
    }

    // Test calculated columns cache.
    view = new DataView(data);
    view.setColumns([
      0,
      {
        'calc': (dt: AbstractDataTable, rowIdx: number) => {
          const v1 = dt.getValue(rowIdx, 1);
          const v2 = dt.getValue(rowIdx, 2);
          const n = Number(v1) + Number(v2);
          return n;
        },
        'type': 'number',
        'label': 'calc',
        'id': 'calcId',
      },
    ]);
    // TODO(dlaliberte): calcColumnsCache is private... what to do?
    // assertArrayEquals(view.calcColumnsCache, []);
    assertEquals(7, view.getValue(2, 1));
    // assertEquals(7, view.calcColumnsCache[1][2]['v']);
    view.hideRows([2]);
    assertEquals(11, view.getValue(2, 1));
    // assertEquals(11, view.calcColumnsCache[1][3]['v']);
  });

  it('Generates DataView with correct calculated column type', () => {
    const obj: TableSpec = {'cols': [{'type': 'number'}]};
    const data = new DataTable(obj);
    data.addRows([[1], [2], [3], [4]]);
    const view = new DataView(data);
    view.setColumns([{'calc': 'emptyString', 'type': 'string'}]);
    // 'string is the correct type'
    assertNotThrows(() => view.getValue(0, 0));
    view.setColumns([{'calc': 'identity', 'sourceColumn': 0}]);
    // 'type "number" is copied over to the new column'
    assertNotThrows(() => view.getValue(0, 0));
    view.setColumns([{'calc': 'emptyString', 'type': 'number'}]);
    // 'number is the wrong type for "emptyString" calc function'
    assertThrows(() => view.getValue(0, 0));
  });

  it('Generates DataView with column properties', () => {
    const obj: TableSpec = {};
    obj['cols'] = [{'type': 'string'}, {'type': 'number'}, {'type': 'number'}];
    obj['rows'] = [];
    const data = new DataTable(obj);
    data.addRows([
      ['a', 1, 2],
      ['b', 3, 4],
      ['c', 3, 4],
      ['d', 5, 6],
    ]);
    const view = new DataView(data);
    view.setColumns([
      {
        'calc': 'identity',
        'type': 'string',
        'label': 'calc',
        'id': 'calcId',
        'properties': {'hello': 'world'},
        'sourceColumn': 0,
      },
    ]);
    assertEquals('a', view.getValue(0, 0));
    assertEquals('world', view.getColumnProperty(0, 'hello'));
    assertObjectEquals({'hello': 'world'}, view.getColumnProperties(0));
  });

  it('Generates DataTable from DataView with column properties set on DataView', () => {
    const obj: TableSpec = {};
    obj['cols'] = [{'type': 'string'}, {'type': 'number'}, {'type': 'number'}];
    obj['rows'] = [];
    const data = new DataTable(obj);
    data.addRows([
      ['a', 1, 2],
      ['b', 3, 4],
      ['c', 3, 4],
      ['d', 5, 6],
    ]);
    const view = new DataView(data);
    view.setColumns([
      {
        'calc': 'identity',
        'type': 'string',
        'label': 'calc',
        'id': 'calcId',
        'properties': {'hello': 'world'},
        'sourceColumn': 0,
      },
    ]);
    const newDT = view.toDataTable();
    assertEquals('a', newDT.getValue(0, 0));
    assertEquals('world', newDT.getColumnProperty(0, 'hello'));
    assertObjectEquals({'hello': 'world'}, newDT.getColumnProperties(0));
  });

  it('Generates DataView with column roles', () => {
    const obj: TableSpec = {};
    obj['cols'] = [{'type': 'string'}, {'type': 'number'}, {'type': 'number'}];
    obj['rows'] = [];
    const data = new DataTable(obj);
    data.addRows([
      ['a', 1, 2],
      ['b', 3, 4],
      ['c', 3, 4],
      ['d', 5, 6],
    ]);
    const view = new DataView(data);
    view.setColumns([{'role': 'tooltip', 'sourceColumn': 0}]);
    assertEquals('a', view.getValue(0, 0));
    assertEquals('tooltip', view.getColumnRole(0));
    assertEquals('string', view.getColumnType(0));
  });

  it('Generates DataView from JSON', () => {
    const obj: TableSpec = {};
    obj['cols'] = [{'type': 'string'}, {'type': 'number'}, {'type': 'number'}];
    obj['rows'] = [];
    const data = new DataTable(obj);
    data.addRows([
      ['a', 1, 2],
      ['b', 3, 4],
      ['c', 3, 4],
      ['d', 5, 6],
    ]);
    const view = new DataView(data);
    view.setColumns([0, 1]);
    view.setRows([1, 3]);
    assertObjectEquals(view, DataView.fromJSON(data, view.toJSON()));
  });

  it('Uses insertValuesInColumnForFillColumnFunction correctly', () => {
    const data = arrayToDataTable([
      ['A', 'B'],
      [12, 'str1'],
      [null, null],
      [14, 'str2'],
      [null, null],
    ]);
    const view = new DataView(data);
    view.setColumns([
      {'calc': 'fillFromTop', 'type': 'number', 'sourceColumn': 0},
      {'calc': 'fillFromBottom', 'type': 'string', 'sourceColumn': 1},
    ]);
    view.insertValuesInColumnForFillColumnFunction(0);
    // TODO(dlaliberte): view.calcCell is private
    // assertEquals(12, view.calcCell(0, 0)['v']);
    // assertEquals(12, view.calcCell(1, 0)['v']);
    // assertEquals(14, view.calcCell(2, 0)['v']);
    // assertEquals(14, view.calcCell(3, 0)['v']);
    view.insertValuesInColumnForFillColumnFunction(1);
    // assertEquals('str1', view.calcCell(0, 1)['v']);
    // assertEquals('str2', view.calcCell(1, 1)['v']);
    // assertEquals('str2', view.calcCell(2, 1)['v']);
    // assertNull(view.calcCell(3, 1)['v']);
  });

  it('Uses insertValuesInColumnForFillColumnFunction with row filter', () => {
    const data = arrayToDataTable([
      ['A', 'B'],
      [12, 'str1'],
      [null, null],
      [14, 'str2'],
      [null, null],
    ]);
    const view = new DataView(data);
    view.setColumns([
      {'calc': 'fillFromTop', 'type': 'number', 'sourceColumn': 0},
      {'calc': 'fillFromBottom', 'type': 'string', 'sourceColumn': 1},
    ]);
    view.setRows([3, 2]);
    view.insertValuesInColumnForFillColumnFunction(0);
    view.insertValuesInColumnForFillColumnFunction(1);
    assertEquals(14, view.getValue(0, 0));
    assertEquals(14, view.getValue(1, 0));
    assertNull(view.getValue(0, 1));
    assertEquals('str2', view.getValue(1, 1));
  });

  // TODO(dlaliberte): datautils.findNonNullValueInColumn is readonly.
  //   it('Uses insertValuesInColumnForFillColumnFunction with cached', () => {
  //     const data = arrayToDataTable([['A'], [12], [null], [null], [null]]);
  //     const view = new DataView(data);
  //     view.setColumns(
  //         [{'calc': 'fillFromTop', 'type': 'number', 'sourceColumn': 0}]);
  //
  //     // mock the find non null value function to check that it is not used.
  //     const origFunc = datautils.findNonNullValueInColumn;
  //     try {
  //       datautils.findNonNullValueInColumn =
  //           functions.error('Error: findNonNullValuesInColumn called');
  //       assertThrows(goog.bind(view.getValue, view, 3, 0));
  //       view.insertValuesInColumnForFillColumnFunction(0);
  //       view.getValue(3, 0);
  //       assertNotThrows(goog.bind(view.getValue, view, 3, 0));
  //     } finally {
  //       datautils.findNonNullValueInColumn = origFunc;
  //     }
  //   });
});
