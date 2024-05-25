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

import {parse as jsonParse} from '../common/json';
import * as testUtils from '../common/test_utils';
import {ResponseVersion} from '../query/response_version';

import {AbstractDataTable} from './abstract_datatable';
import {
  arrayToDataTable,
  DataTable,
  recordsToDataTable,
  valuesToDataTable,
} from './datatable';
import {TableSpec} from './types';

const {
  assertArrayEquals,
  assertDateEquals,
  assertEquals,
  assertNotNull,
  assertNull,
  assertObjectEquals,
  assertThrows,
  assertTrue,
} = testUtils;

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

describe('DataTable Tests', () => {
  /**
   * Asserts that a call to getValue for the given data, row and colum throws an
   * exception.
   * @param dt The data to check against.
   * @param rowIndex The index of the column.
   * @param colIndex The index of the row.
   */
  const assertGetValueThrowsException = (
    //
    dt: AbstractDataTable,
    rowIndex: number,
    colIndex: AnyDuringMigration,
  ) => {
    expect(() => {
      // `getValue with row: ${rowIndex} col: ${colIndex}`
      dt.getValue(rowIndex, colIndex);
    }).toThrow();
  };

  it('Adds rows to DataTable via addRows', () => {
    const testRowsAreAdded = (numberOfRows: number) => {
      const data = new DataTable();
      data.addColumn({type: 'number'});
      const rowData = [];
      for (let i = 0; i < numberOfRows; ++i) {
        rowData.push([i]);
      }
      data.addRows(rowData);
      expect(data.getNumberOfRows()).toBe(numberOfRows);
    };
    testRowsAreAdded(10);
    testRowsAreAdded(100000);
  });

  it('Adds column role via addColumn, get via getColumnRole', () => {
    const data = new DataTable();
    data.addColumn({'type': 'string', 'role': 'annotation'});
    expect(data.getColumnType(0)).toBe('string');
    expect(data.getColumnRole(0)).toBe('annotation');
    data.insertColumn(0, {'type': 'number', 'label': 'hello', 'role': 'data'});
    expect(data.getColumnType(0)).toBe('number');
    expect(data.getColumnRole(0)).toBe('data');
    expect(data.getColumnLabel(0)).toBe('hello');
    expect(data.getColumnType(1)).toBe('string');
    expect(data.getColumnRole(1)).toBe('annotation');
  });

  it('Gets a copy of the column specification', () => {
    const obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'AA', 'type': 'string'},
      {'id': 'B', 'label': 'BB', 'type': 'number'},
    ];
    const dt = new DataTable(obj);
    const cols = dt.getColumns();
    assertArrayEquals(obj['cols'], cols);
  });

  it('Generates DataTable from JSON cols and rows data', () => {
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
    assertEquals(2, dt.getNumberOfColumns());
    assertEquals(3, dt.getNumberOfRows());
    assertEquals('abar', dt.getValue(1, 0));
    assertEquals('abarbar', dt.getFormattedValue(1, 0));
    assertEquals('v1', dt.getRowProperty(0, 'k1'));
    assertEquals(null, dt.getRowProperty(1, 'k1'));
    assertEquals(null, dt.getRowProperty(2, 'k1'));
  });

  it('Generates DataTable from JSON Object', () => {
    const obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'AA', 'type': 'date'},
      {'id': 'B', 'label': 'BB', 'type': 'number'},
    ];
    obj['rows'] = [];
    obj['rows'].push({
      'c': [
        {'v': 'Date(2011,7,23)', 'f': 'afoofoo'},
        {'v': 1, 'f': 'bfoo'},
      ],
      'p': {'k1': 'v1', 'k2': 'v2'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'Date(2011,7,24)', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
      ],
      'p': {},
    });
    obj['rows'].push({
      'c': [
        {'v': 'Date(2011,7,25)', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
      ],
    });

    const dt = new DataTable(obj);
    assertEquals(2, dt.getNumberOfColumns());
    assertEquals(3, dt.getNumberOfRows());
    assertDateEquals(new Date(2011, 7, 23), dt.getValue(0, 0));
    assertDateEquals(new Date(2011, 7, 24), dt.getValue(1, 0));
    assertDateEquals(new Date(2011, 7, 25), dt.getValue(2, 0));
    assertEquals('abarbar', dt.getFormattedValue(1, 0));
    assertEquals('v1', dt.getRowProperty(0, 'k1'));
    assertEquals(null, dt.getRowProperty(1, 'k1'));
    assertEquals(null, dt.getRowProperty(2, 'k1'));
  });

  it('Generates DataTable from "true" JSON cols and rows data', () => {
    const dt = new DataTable( //
      '{' +
        '"cols": [' + //
        '  {"id": "A", "label": "AA", "type": "string"},' + //
        '  {"id": "B", "label": "BB", "type": "date"}' +
        '],' + //
        '"rows": [' + //
        '  {"c": [' + //
        '    {"v": "afoo", "f": "afoofoo"},' + //
        '    {"v": "Date(2009, 7, 1)",' +
        '"f": "bfoo"' +
        '}],' + //
        '   "p": {"k1": "v1", "k2": "v2"}},' + //
        '  {"c": [' + //
        '    {"v": "abar", "f": "abarbar"},' + //
        '{"v": null, "f": "bbar"}' +
        '], "p": {}}' +
        ']}',
    );
    assertEquals(2, dt.getNumberOfColumns());
    assertEquals(2, dt.getNumberOfRows());
    assertEquals('abar', dt.getValue(1, 0));
    assertEquals('abarbar', dt.getFormattedValue(1, 0));
    assertEquals('v1', dt.getRowProperty(0, 'k1'));
    assertEquals(null, dt.getRowProperty(1, 'k1'));
    assertDateEquals(new Date(2009, 7, 1), dt.getValue(0, 1));
    assertNull(dt.getValue(1, 1));
    expect(() => {
      // Add an invalid date value to the json string.
      const dt = new DataTable(
        '{' +
          '"cols": [' + //
          '  {"id": "A", "label": "AA", "type": "string"},' + //
          '  {"id": "B", "label": "BB", "type": "date"}' +
          '],' + //
          '"rows": [' + //
          '  {"c": [' + //
          '    {"v": "afoo", "f": "afoofoo"},' + //
          '    {"v": "Date(2009, 7, 1);window.alert("xbox")",' +
          '"f": "bfoo"' +
          '}],' +
          '   "p": {"k1": "v1", "k2": "v2"}},' + //
          '  {"c": [' + //
          '    {"v": "abar", "f": "abarbar"},' + //
          '{"v": null, "f": "bbar"}' +
          '], "p": {}}' +
          ']}',
      );
      dt.getNumberOfColumns();
    }).toThrow();
  });

  it('Generates DataTable with correct default formatted values', () => {
    const data = arrayToDataTable([
      ['year', 'A', 'B'],
      [2000, true, null],
      [2000, true, 12],
    ]);
    assertEquals('number', data.getColumnType(0));
    assertEquals('boolean', data.getColumnType(1));
    assertEquals('number', data.getColumnType(2));
    assertEquals('2,000', data.getFormattedValue(0, 0));
    assertEquals('true', data.getFormattedValue(0, 1));
    assertEquals('', data.getFormattedValue(0, 2));
  });

  it('Generates DataTable without mutating user data', () => {
    // We need to make sure that we don't mutate the user's array.
    let array = [
      ['labels', 'values'],
      ['a', 1],
      ['b', 2],
    ];
    arrayToDataTable(array);
    assertEquals('labels', array[0][0]);
    assertEquals('values', array[0][1]);
    assertEquals('a', array[1][0]);
    assertEquals(1, array[1][1]);
    assertEquals('b', array[2][0]);
    assertEquals(2, array[2][1]);
    array = array.slice(1);
    arrayToDataTable(array, true);
    assertEquals('a', array[0][0]);
    assertEquals(1, array[0][1]);
    assertEquals('b', array[1][0]);
    assertEquals(2, array[1][1]);
  });

  it('Generates a DataTable with undefined cells', () => {
    let obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
    ];
    obj['rows'] = [];
    obj['rows'].push({'c': [{'v': 'foo'}], 'p': {}});
    obj['rows'].push({'c': [undefined, {'v': 42}], 'p': {}});
    obj['rows'].push({'c': [undefined], 'p': {}});
    obj['rows'].push({'c': [undefined], 'p': {}});
    let dt = new DataTable(obj);

    // TODO(dlaliberte): Check that this really works and clones it properly

    // Check that this doesn't crash.
    dt.clone();
    assertNull(dt.getValue(0, 1));
    assertTrue('' === dt.getFormattedValue(0, 1));
    const columnRange = dt.getColumnRange(1);
    assertEquals(42, columnRange['min']);
    assertEquals(42, columnRange['max']);

    const distinctValues = dt.getDistinctValues(1);
    assertEquals(2, distinctValues.length);
    assertNull(distinctValues[0]);

    const filteredRows = dt.getFilteredRows([{'column': 1, 'value': null}]);
    assertArrayEquals([0, 2, 3], filteredRows);
    const p = dt.getProperties(0, 1);
    assertTrue(!!p);
    p['foo'] = 'bar';
    assertEquals('bar', dt.getProperty(0, 1, 'foo'));
    assertNull(dt.getProperty(2, 0, 'foo'));
    dt.setProperty(2, 0, 'foo', 'bar');
    assertEquals('bar', dt.getProperty(2, 0, 'foo'));
    dt.setValue(2, 1, 17);
    assertEquals(17, dt.getValue(2, 1));
    dt.setFormattedValue(3, 1, 'blah');
    assertNull(dt.getValue(3, 1));
    assertEquals('blah', dt.getFormattedValue(3, 1));
    obj = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
    ];
    obj['rows'] = [];
    obj['rows'].push({'c': [{'v': 'foo'}]});
    obj['rows'].push({'c': [undefined, {'v': 42}]});
    obj['rows'].push({'c': [undefined]});
    dt = new DataTable(obj);
    dt.sort(
      // Check that sorting doesn't crash.
      [{'column': 1}],
    );
  });

  // TODO(dlaliberte): Can't do this yet - many cases of unknown column types.
  // gviz.core.CoreTest.prototype.testArrayToDataTableThrows = () => {
  //   assertThrows(() => {
  //     const data = google.visualization.arrayToDataTable([
  //       ['Foo', 'Bar', 'Baz'],  //
  //       [123, true, null]       // No type can be inferred for column 2.
  //     ]);
  //     assertEquals(null, data.getColumnType(2));
  //   });
  // };

  it('Generates DataTable via arrayToDataTable', () => {
    let data = arrayToDataTable([
      ['year', 'expenses'],
      ['2000', 100],
      ['2001', 200],
    ]);
    assertEquals('string', data.getColumnType(0));
    assertEquals('number', data.getColumnType(1));
    assertEquals('year', data.getColumnLabel(0));
    assertEquals('expenses', data.getColumnLabel(1));
    assertEquals('2000', data.getValue(0, 0));
    assertEquals(100, data.getValue(0, 1));
    assertEquals('2001', data.getValue(1, 0));
    assertEquals(200, data.getValue(1, 1));

    {
      const array = [
        ['labels', 'values'],
        ['a', 1],
        ['b', 2],
        ['c', 3],
      ];
      data = arrayToDataTable(array);
      assertObjectEquals(
        {
          'cols': [
            {'label': 'labels', 'type': 'string'},
            {'label': 'values', 'type': 'number'},
          ],
          'rows': [
            {'c': [{'v': 'a'}, {'v': 1}]},
            {'c': [{'v': 'b'}, {'v': 2}]},
            {'c': [{'v': 'c'}, {'v': 3}]},
          ],
        },
        data.toPOJO(),
      );
    }
    {
      const array = [
        ['labels', 'values'],
        ['a', {v: 1}],
        ['b', 2],
        ['c', 3],
      ];
      data = arrayToDataTable(array);
      assertObjectEquals(
        {
          'cols': [
            {'label': 'labels', 'type': 'string'},
            {'label': 'values', 'type': 'number'},
          ],
          'rows': [
            {'c': [{'v': 'a'}, {'v': 1}]},
            {'c': [{'v': 'b'}, {'v': 2}]},
            {'c': [{'v': 'c'}, {'v': 3}]},
          ],
        },
        data.toPOJO(),
      );
    }
    {
      const array = [
        ['labels', 'values'],
        ['a', {f: '1'}],
        ['b', 2],
        ['c', 3],
      ];
      data = arrayToDataTable(array);
      assertObjectEquals(
        {
          'cols': [
            {'label': 'labels', 'type': 'string'},
            {'label': 'values', 'type': 'number'},
          ],
          'rows': [
            {'c': [{'v': 'a'}, {'f': '1'}]},
            {'c': [{'v': 'b'}, {'v': 2}]},
            {'c': [{'v': 'c'}, {'v': 3}]},
          ],
        },
        data.toPOJO(),
      );
    }
    {
      const array = [
        ['labels', {'label': 'values'}],
        ['a', {f: '1'}],
        ['b', 2],
        ['c', 3],
      ];
      data = arrayToDataTable(array);
      assertObjectEquals(
        {
          'cols': [
            {'label': 'labels', 'type': 'string'},
            {'label': 'values', 'type': 'number'},
          ],
          'rows': [
            {'c': [{'v': 'a'}, {'f': '1'}]},
            {'c': [{'v': 'b'}, {'v': 2}]},
            {'c': [{'v': 'c'}, {'v': 3}]},
          ],
        },
        data.toPOJO(),
      );
    }
    {
      const array = [
        ['labels', {'label': 'values', 'p': {'role': 'style'}}],
        ['a', {f: '1'}],
        ['b', 2],
        ['c', 3],
      ];
      data = arrayToDataTable(array);
      assertObjectEquals(
        {
          'cols': [
            {'label': 'labels', 'type': 'string'},
            {'label': 'values', 'type': 'number', 'p': {'role': 'style'}},
          ],
          'rows': [
            {'c': [{'v': 'a'}, {'f': '1'}]},
            {'c': [{'v': 'b'}, {'v': 2}]},
            {'c': [{'v': 'c'}, {'v': 3}]},
          ],
        },
        data.toPOJO(),
      );
    }
    {
      const array = [
        ['labels', {'label': 'values', 'role': 'style'}],
        ['a', {f: '1'}],
        ['b', 2],
        ['c', 3],
      ];
      data = arrayToDataTable(array);
      assertObjectEquals(
        {
          'cols': [
            {'label': 'labels', 'type': 'string'}, //
            {
              'label': 'values',
              'type': 'number',
              'role': 'style',
              'p': {'role': 'style'},
            },
          ],
          'rows': [
            {'c': [{'v': 'a'}, {'f': '1'}]},
            {'c': [{'v': 'b'}, {'v': 2}]},
            {'c': [{'v': 'c'}, {'v': 3}]},
          ],
        },
        data.toPOJO(),
      );
    }
    {
      const array = [
        ['labels', {'label': 'values', 'role': 'style', 'p': {'role': 'data'}}],
        ['a', {f: '1'}],
        ['b', 2],
        ['c', 3],
      ];
      data = arrayToDataTable(array);
      assertObjectEquals(
        {
          'cols': [
            {'label': 'labels', 'type': 'string'},
            {
              'label': 'values',
              'type': 'number',
              'role': 'style',
              'p': {'role': 'data'},
            },
          ],
          'rows': [
            {'c': [{'v': 'a'}, {'f': '1'}]},
            {'c': [{'v': 'b'}, {'v': 2}]},
            {'c': [{'v': 'c'}, {'v': 3}]},
          ],
        },
        data.toPOJO(),
      );
    }
    {
      const array = [
        ['labels', 'values'],
        ['a', {}],
        ['b', 2],
        ['c', 3],
      ];
      assertThrows(goog.partial(arrayToDataTable, array)); // 'Invalid value in 0,1',
    }
  });

  it('Generates DataTable via arrayToDataTable inferring date', () => {
    let data = arrayToDataTable([
      ['year', 'expenses'],
      ['2000', new Date(2000, 0, 1)],
      ['2001', null],
      ['2002', null],
      ['2003', new Date(2003, 0, 1)],
    ]);
    assertEquals('string', data.getColumnType(0));
    assertEquals('date', data.getColumnType(1));
    assertEquals('year', data.getColumnLabel(0));
    assertEquals('expenses', data.getColumnLabel(1));
    data = arrayToDataTable([
      ['year', 'expenses'],
      ['2000', new Date(2000, 0, 1, 12, 0, 0)],
      ['2001', null],
      ['2002', null],
      ['2003', new Date(2003, 0, 1, 12, 0, 0)],
    ]);
    assertEquals('string', data.getColumnType(0));
    assertEquals('datetime', data.getColumnType(1));
    assertEquals('year', data.getColumnLabel(0));
    assertEquals('expenses', data.getColumnLabel(1));
    data = arrayToDataTable([
      ['year', 'expenses'],
      ['2000', new Date(2000, 0, 1, 12, 0, 0)],
      ['2001', null],
      ['2002', null],
      ['2003', new Date(2003, 0, 1)],
    ]);
    assertEquals('string', data.getColumnType(0));
    assertEquals('datetime', data.getColumnType(1));
    assertEquals('year', data.getColumnLabel(0));
    assertEquals('expenses', data.getColumnLabel(1));
    data = arrayToDataTable([
      ['year', 'expenses'],
      ['2000', new Date(2000, 0, 1)],
      ['2001', null],
      ['2002', null],
      ['2003', new Date(2003, 0, 1, 12, 0, 0)],
    ]);
    assertEquals('string', data.getColumnType(0));
    assertEquals('datetime', data.getColumnType(1));
    assertEquals('year', data.getColumnLabel(0));
    assertEquals('expenses', data.getColumnLabel(1));
  });

  it('Generates DataTable via arrayToDataTable with literals', () => {
    // Test that user types take precedence.
    let data = arrayToDataTable([
      ['year', {'label': 'expenses', 'type': 'string'}],
      ['2000', 1],
      ['2001', 2],
      ['2002', 3],
      ['2003', 4],
    ]);
    assertEquals('string', data.getColumnType(0));
    assertEquals('string', data.getColumnType(1));
    assertEquals('year', data.getColumnLabel(0));
    assertEquals('expenses', data.getColumnLabel(1));

    // Test that cell formatted values are supported.
    data = arrayToDataTable([
      ['year', 'expenses'],
      ['2000', {'v': 4, 'f': 'four'}],
      ['2001', {'v': 3, 'f': null}],
      ['2002', {'v': 2, 'f': 20}],
      ['2003', {'f': 'one'}],
    ]);
    assertEquals(4, data.getValue(0, 1));
    assertEquals('four', data.getFormattedValue(0, 1));
    assertEquals(
      '3',
      // null means use default
      data.getFormattedValue(1, 1),
    );
    assertEquals(
      '20',
      // Number is stringified.
      data.getFormattedValue(2, 1),
    );
    assertEquals(null, data.getValue(3, 1));
    assertEquals('one', data.getFormattedValue(3, 1));

    // Test that the row 'literal' format is supported.
    data = arrayToDataTable([
      ['year', 'expenses'],
      {'c': ['2000', 4]},
      ['2001', 3],
      ['2002', 2],
      {'c': ['2003', {'f': 'one'}], 'p': {'prop': 1}},
    ]);
    assertEquals(4, data.getValue(0, 1));
    assertEquals(null, data.getValue(3, 1));
    assertEquals('one', data.getFormattedValue(3, 1));
    assertEquals(1, data.getRowProperty(3, 'prop'));

    // Test that empty objects in cells cause an error because they're
    // ambiguous.
    assertThrows(() => {
      return arrayToDataTable([
        ['year', 'expenses'],
        ['2000', {}],
        ['2001', 3],
        ['2002', 2],
        ['2003', {'f': 'one'}],
      ]);
    });
  });

  it('Generates DataTable via arrayToDataTable with string as number', () => {
    const data = arrayToDataTable([
      ['Year', 'Sales', 'Expenses'],
      ['2004', 1000, 400],
      ['2005', 1170, 460],
    ]);
    data.setCell(1, 1, '444');
    assertEquals(data.getValue(1, 1), 444);
    try {
      data.setCell(1, 1, 'test');
      assertTrue(false);
    } catch (err: unknown) {}
  });

  it('Generates DataTable via arrayToDataTable with no headers', () => {
    const noHeaders = true;
    const data = arrayToDataTable(
      [
        [[0, 0, 0], true],
        [[0, 0, 1, 100], false],
      ],
      noHeaders,
    );
    assertEquals('timeofday', data.getColumnType(0));
    assertEquals('boolean', data.getColumnType(1));
    assertEquals('', data.getColumnLabel(0));
    assertEquals('', data.getColumnLabel(1));
    assertEquals('00:00', data.getFormattedValue(0, 0));
    assertEquals(true, data.getValue(0, 1));
    assertEquals('00:00:01.100', data.getFormattedValue(1, 0));
    assertEquals(false, data.getValue(1, 1));
  });

  it('Generates DataTable via recordsToDataTable', () => {
    const records = [
      {'year': '2000', 'expenses': 100},
      {'year': '2001', 'expenses': 200},
    ];
    const data = recordsToDataTable(records);

    assertEquals('year', data.getColumnId(0));
    assertEquals('string', data.getColumnType(0));

    assertEquals('expenses', data.getColumnId(1));
    assertEquals('number', data.getColumnType(1));

    assertEquals('2000', data.getValue(0, 0));
    assertEquals(100, data.getValue(0, 1));

    assertEquals('2001', data.getValue(1, 0));
    assertEquals(200, data.getValue(1, 1));
  });

  it('Generates DataTable via valuesToDataTable', () => {
    const values = [100, 200];
    const data = valuesToDataTable(values);

    assertEquals('data', data.getColumnId(0));
    assertEquals('number', data.getColumnType(0));

    assertEquals(100, data.getValue(0, 0));
    assertEquals(200, data.getValue(1, 0));
  });

  it('Builds DataTable from null', () => {
    const dt = new DataTable(null);
    assertEquals(0, dt.getNumberOfColumns());
    assertEquals(0, dt.getNumberOfRows());
    assertEquals(0, dt.addRow());
    assertEquals(0, dt.addColumn('string', 'AA', 'A'));
    assertEquals(1, dt.getNumberOfColumns());
    assertEquals(1, dt.getNumberOfRows());
    dt.setValue(0, 0, 'foo');
    assertEquals('foo', dt.getValue(0, 0));
  });

  it('Generates DataTable via constructor', () => {
    const dt = new DataTable({
      cols: [
        {'label': 'Time', 'type': 'datetime'},
        {'label': 'All Shards', 'type': 'number'},
        {'label': 'Ignoring Duplicate Shards', 'type': 'number'},
      ],
    });
    assertEquals(0, dt.getNumberOfRows());
  });

  it('Generates JSON from DataTable', () => {
    const jsonString =
      '{' +
      '"cols":[' +
      '{"id":"A","label":"AA","type":"string"},' +
      '{"id":"B","label":"BB","type":"date"}' +
      ']' +
      ',"rows":[' +
      '{' +
      '"c":[' +
      '{"v":"afoo","f":"afoofoo"},' +
      '{"v":"Date(2009, 7, 1)"}' +
      '],' +
      '"p":{"k1":"v1","k2":"v2"}' +
      '},' +
      '{' +
      '"c":[' +
      '{"v":"abar","f":"abarbar"},' +
      '{"v":null}' +
      '],' +
      '"p":{}' +
      '},' +
      '{' +
      '"c":[' +
      '{"v":"abaz","f":"abazbaz"},' +
      '{"v":"Date(2009, 7, 1)"}' +
      '],' +
      '"p":{}' +
      '}' +
      '],' +
      '"p":{"style":"border: 1px solid green;"}' +
      '}';

    // construct DataTable from JSON string
    const dt = new DataTable(jsonString);

    // validate that the correct DataTable has been constructed
    assertEquals(2, dt.getNumberOfColumns());
    assertEquals(3, dt.getNumberOfRows());
    assertEquals('abar', dt.getValue(1, 0));
    assertEquals('abarbar', dt.getFormattedValue(1, 0));
    assertEquals('v1', dt.getRowProperty(0, 'k1'));
    assertEquals(null, dt.getRowProperty(1, 'k1'));
    assertEquals(null, dt.getRowProperty(2, 'k1'));
    assertEquals('border: 1px solid green;', dt.getTableProperty('style'));
    assertDateEquals(new Date(2009, 7, 1), dt.getValue(0, 1));
    assertNull(dt.getValue(1, 1));
    assertDateEquals(new Date(2009, 7, 1), dt.getValue(2, 1));
    const expectedFormattedDate = dt.getFormattedValue(0, 1);

    // validate that the correct JSON string is formed
    assertEquals(jsonString, dt.toJSON());

    // validate that the toJSON() method does not break formatted value for
    // dates
    assertEquals(expectedFormattedDate, dt.getFormattedValue(0, 1));
  });

  it('Generates correct JSON for a DataTable when parsed', () => {
    const obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Date', 'type': 'date'},
      {'id': 'D', 'label': 'Timeofday', 'type': 'timeofday'},
    ];
    obj['rows'] = [
      {
        'c': [
          {'v': 'foo'},
          {'v': 42},
          {'v': new Date(2012, 11, 12)},
          {'v': [1, 2, 3, 4]},
        ],
      },
      {'c': [{'v': ''}, {'v': 0}, {'v': 'Date(2012, 11, 12)'}, {'v': []}]},
      {'c': []}, //
      {'c': [undefined]}, //
      {'c': [null, null]}, //
      {'c': [{'v': undefined}, {'v': undefined}]},
      {'c': [{'v': null}, {'v': null}]},
    ];
    const expected: TableSpec = {};
    expected['cols'] = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Date', 'type': 'date'},
      {'id': 'D', 'label': 'Timeofday', 'type': 'timeofday'},
    ];
    expected['rows'] = [
      {
        'c': [
          {'v': 'foo'}, //
          {'v': 42}, //
          {'v': 'Date(2012, 11, 12)'}, //
          {'v': [1, 2, 3, 4]},
        ],
      },
      {
        'c': [
          {'v': ''}, //
          {'v': 0}, //
          {'v': 'Date(2012, 11, 12)'}, //
          {'v': []},
        ],
      },
      {'c': []}, //
      {'c': []}, //
      {'c': [null, null]}, //
      {'c': [{}, {}]}, //
      {'c': [{'v': null}, {'v': null}]},
    ];
    const dt = new DataTable(obj);
    const json = jsonParse(dt.toJSON());
    assertObjectEquals(expected, json);
  });

  it('Generates DataTable function type', () => {
    const dataTable = new DataTable();
    dataTable.addColumn({'type': 'number'});
    assertNotNull(dataTable.toJSON());
    dataTable.addColumn({'type': 'function'});
    assertThrows(() => {
      dataTable.toJSON();
    });
    // TODO(dlaliberte): Can we check the error that is thrown?
    // assertEquals(
    //     'Cannot get JSON representation of data table due to function ' +
    //         'data type at column 1',
    //     err.message);
  });

  it('Generates DataTable with cell properties', () => {
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
      'p': {'k1': 'v1'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abar', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
      ],
      'p': {'k2': 'v2'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abaz', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
      ],
      'p': {'k3': 'v3'},
    });
    const dt = new DataTable(obj);
    dt.setProperty(1, 0, 'myProperty', 7);
    dt.setProperties(1, 1, {'myProperty': 'foo', 'otherProperty': true});
    assertEquals(7, dt.getProperty(1, 0, 'myProperty'));
    assertEquals('foo', dt.getProperty(1, 1, 'myProperty'));
    assertEquals(true, dt.getProperty(1, 1, 'otherProperty'));
    let properties = dt.getProperties(1, 0);
    assertEquals(7, properties['myProperty']);
    properties['myProperty'] = 8;
    properties['newProperty'] = 'foo';
    assertEquals(8, dt.getProperty(1, 0, 'myProperty'));
    assertEquals('foo', dt.getProperty(1, 0, 'newProperty'));
    properties = dt.getProperties(1, 1);
    properties['myProperty'] = 1;
    properties['newProperty'] = null;
    assertEquals(1, dt.getProperty(1, 1, 'myProperty'));
    assertEquals(null, dt.getProperty(1, 1, 'newProperty'));
    properties = dt.getProperties(2, 0);
    properties['aProperty'] = 7;
    assertEquals(7, dt.getProperty(2, 0, 'aProperty'));

    // Store JSON to verify getters don't change the DataTable.
    const json = dt.toJSON();
    assertEquals(null, dt.getProperty(2, 0, 'nonExistingProperty'));
    assertEquals(json, dt.toJSON());
    assertEquals(null, dt.getProperty(2, 1, 'noPropertiesAtAll'));
    assertEquals(json, dt.toJSON());
  });

  it('Adds columns and rows', () => {
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
      'p': {'k1': 'v1'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abar', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
      ],
      'p': {'k2': 'v2'},
    });
    obj['rows'].push({
      'c': [
        {'v': 'abaz', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
      ],
      'p': {'k3': 'v3'},
    });

    let dt = new DataTable(obj);
    assertEquals(2, dt.addColumn('string', 'CC', 'C'));
    assertEquals(3, dt.getNumberOfColumns());
    assertEquals(null, dt.getValue(1, 2));
    dt.setValue(1, 2, 'foo');
    assertEquals('foo', dt.getValue(1, 2));
    dt.setProperty(1, 2, 'A_Name', 'A_Value');
    assertEquals('A_Value', dt.getProperty(1, 2, 'A_Name'));
    assertEquals(3, dt.addRow());
    assertEquals(4, dt.addRow());
    assertEquals(5, dt.getNumberOfRows());
    assertEquals(null, dt.getValue(4, 2));
    dt.setValue(4, 2, 'foo');
    assertEquals('foo', dt.getValue(4, 2));
    assertEquals(10, dt.addRows(6));
    assertEquals(null, dt.getValue(7, 1));

    dt = new DataTable();
    dt.addColumn('string', 'test');
    dt.addColumn({
      'p': {'fruit': 'orange'},
      'properties': {'fruit': 'apple'},
      'role': 'annotation',
      'type': 'string',
    });
    assertEquals('string', dt.getColumnType(1));
    assertEquals('annotation', dt.getColumnRole(1));
    assertEquals('orange', dt.getColumnProperty(1, 'fruit'));
    dt.addRows(2);
    dt.setCell(0, 0, 'test1');
    assertEquals('test1', dt.getValue(0, 0));
    dt.setProperty(0, 0, 'n', 'v');
    assertEquals('v', dt.getProperty(0, 0, 'n'));
    dt.setValue(1, 0, 'test2');
    dt.setProperty(1, 0, 'n2', 'v2');
    assertEquals('v2', dt.getProperty(1, 0, 'n2'));
  });

  it('Inserts columns and rows', () => {
    const dt = new DataTable(null);

    // Test inserting a column to an empty table.
    dt.insertColumn(0, 'string', 'A');
    assertEquals('A', dt.getColumnLabel(0));

    // Test inserting a column at the end.
    dt.insertColumn(1, 'boolean', 'C');
    assertEquals('C', dt.getColumnLabel(1));

    // Test inserting a column in the middle.
    dt.insertColumn(1, 'number', 'B');
    assertEquals('B', dt.getColumnLabel(1));
    assertEquals('C', dt.getColumnLabel(2));

    // Test inserting rows to an empty table.
    dt.insertRows(0, 8);
    dt.setValue(0, 0, 'bbb');
    dt.setValue(1, 0, 'ccc');
    dt.setValue(1, 2, true);
    dt.setValue(2, 0, 'aab');
    dt.setValue(2, 1, 7);
    dt.setValue(2, 2, true);
    dt.setValue(3, 0, 'aaa');
    dt.setValue(3, 1, -4.5);
    dt.setValue(4, 1, 7);
    dt.setValue(4, 2, false);
    dt.setValue(5, 0, 'ddd');
    dt.setValue(6, 0, 'eee');
    dt.setValue(7, 0, 'fff');

    // Test inserting rows in the middle.
    // Cache (2, 0) formatted value, and verify it is cleaned after the insert.
    assertEquals('aab', dt.getFormattedValue(2, 0));
    dt.insertRows(2, 2);
    assertEquals('aab', dt.getValue(4, 0));
    assertEquals('aab', dt.getFormattedValue(4, 0));
    assertEquals(null, dt.getValue(2, 0));
    assertEquals('', dt.getFormattedValue(2, 0));
    assertEquals(10, dt.getNumberOfRows());

    // Test inserting a column to a full table.
    // Cache (1, 2) formatted value, and verify it is cleaned after the insert.
    assertEquals(true, dt.getValue(1, 2));
    assertEquals('true', dt.getFormattedValue(1, 2));
    dt.insertColumn(2, 'string', 'D');
    assertEquals(null, dt.getValue(1, 2));
    assertEquals('', dt.getFormattedValue(1, 2));
    assertEquals(true, dt.getValue(1, 3));
    assertEquals('true', dt.getFormattedValue(1, 3));

    // Test inserting a bad type column.
    try {
      dt.insertColumn(2, 'str', 'E');
      fail('Should have thrown an error.');
    } catch (er: unknown) {
      assertTrue(typeof er === 'object' && er!.constructor === Error);
    }
  });

  it('Sets column label', () => {
    const dt = new DataTable(undefined);
    dt.addColumn('number', 'AA', 'A');
    assertEquals('AA', dt.getColumnLabel(0));
    dt.setColumnLabel(0, 'BB');
    assertEquals('BB', dt.getColumnLabel(0));
  });

  it('Rows and Columns check out', () => {
    const obj: TableSpec = {};
    obj['cols'] = [
      {'id': 'A', 'label': 'Text', 'type': 'string'},
      {'id': 'B', 'label': 'Number', 'type': 'number'},
      {'id': 'C', 'label': 'Boolean', 'type': 'boolean'},
      {'id': 'D', 'label': 'Date', 'type': 'date'},
      {'id': 'E', 'label': 'Timeofday', 'type': 'timeofday'},
      {'id': 'F', 'label': 'Datetime', 'type': 'datetime'},
    ];
    obj['rows'] = [];
    obj['rows'].push({
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
    obj['rows'].push({
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
    obj['rows'].push({
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
    obj['rows'].push({
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
    obj['rows'].push({
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
    assertGetValueThrowsException(dt, 6, 7);
    assertGetValueThrowsException(dt, 6, 1);
    assertGetValueThrowsException(dt, -1, 3);
    assertGetValueThrowsException(dt, 1, 8);
    assertGetValueThrowsException(dt, 1, 'foo');
  });

  it('Adds columns with missing parameters', () => {
    const dt = new DataTable(null);
    assertEquals(0, dt.addColumn('string', 'AA', 'A'));
    assertEquals(1, dt.addColumn('number', 'BB'));
    assertEquals(2, dt.addColumn('boolean'));
    assertEquals(3, dt.addColumn('datetime', '0', '0'));
    assertEquals(4, dt.getNumberOfColumns());
    assertEquals('string', dt.getColumnType(0));
    assertEquals('number', dt.getColumnType(1));
    assertEquals('boolean', dt.getColumnType(2));
    assertEquals('datetime', dt.getColumnType(3));
    assertEquals('AA', dt.getColumnLabel(0));
    assertEquals('BB', dt.getColumnLabel(1));
    assertEquals('', dt.getColumnLabel(2));
    assertEquals('0', dt.getColumnLabel(3));
    assertEquals('A', dt.getColumnId(0));
    assertEquals('', dt.getColumnId(1));
    assertEquals('', dt.getColumnId(2));
    assertEquals('0', dt.getColumnLabel(3));
  });

  it('Removes columns and rows', () => {
    const dt = new DataTable(null);
    dt.addColumn('string', 'A');
    dt.addColumn('number', 'B');
    dt.addColumn('boolean', 'C');
    dt.addColumn('string', 'D');
    dt.addRows(8);
    dt.setValue(0, 0, 'bbb');
    dt.setValue(1, 0, 'ccc');
    dt.setValue(1, 2, true);
    dt.setValue(2, 0, 'aab');
    dt.setValue(2, 1, 7);
    dt.setValue(2, 2, true);
    dt.setValue(3, 0, 'aaa');
    dt.setValue(3, 1, -4.5);
    dt.setValue(4, 1, 7);
    dt.setValue(4, 2, false);
    dt.setValue(5, 0, 'ddd');
    dt.setValue(6, 0, 'eee');
    dt.setValue(7, 0, 'fff');

    // Test removing a row from the middle. Test the returned value.
    // Cache (2, 0) formatted value, and verify it is cleaned after the remove.
    assertEquals('aab', dt.getFormattedValue(2, 0));
    dt.removeRow(2);
    assertEquals('aaa', dt.getValue(2, 0));
    assertEquals('aaa', dt.getFormattedValue(2, 0));
    assertEquals(dt.getNumberOfRows(), 7);

    // Test removing a row from the end of the table (pop).
    dt.removeRow(dt.getNumberOfRows() - 1);
    assertEquals('eee', dt.getValue(dt.getNumberOfRows() - 1, 0));
    assertEquals(dt.getNumberOfRows(), 6);

    // Test removing a row from the beginning of the table.
    dt.removeRow(0);
    assertEquals('ccc', dt.getValue(0, 0));
    assertEquals(dt.getNumberOfRows(), 5);

    // Test removing several rows.
    dt.removeRows(2, 3);
    assertEquals(dt.getNumberOfRows(), 2);

    // Test removing a column.
    // Cache (0, 2) formatted value, and verify it is cleaned after the remove.
    assertEquals(true, dt.getValue(0, 2));
    assertEquals('true', dt.getFormattedValue(0, 2));
    dt.removeColumn(2);
    assertEquals(null, dt.getValue(0, 2));
    assertEquals('', dt.getFormattedValue(0, 2));

    // Test removing the last column.
    dt.removeColumn(2);

    // Test removing the first column.
    assertEquals('A', dt.getColumnLabel(0));
    assertEquals('string', dt.getColumnType(0));
    dt.removeColumn(0);
    assertEquals('B', dt.getColumnLabel(0));
    assertEquals('number', dt.getColumnType(0));

    // Test removing all the rows and leaving an empty table.
    dt.removeRow(0);
    dt.removeRow(0);
    assertEquals(dt.getNumberOfRows(), 0);
  });

  it('Sets cell values and properties', () => {
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
    });
    obj['rows'].push({
      'c': [
        {'v': 'abar', 'f': 'abarbar'},
        {'v': 2, 'f': 'bbar'},
      ],
    });
    obj['rows'].push({
      'c': [
        {'v': 'abaz', 'f': 'abazbaz'},
        {'v': 3, 'f': 'bbaz'},
      ],
    });
    const dt = new DataTable(obj);
    dt.setProperty(1, 0, 'p1', 'v1');
    assertEquals('abar', dt.getValue(1, 0));
    assertEquals('abarbar', dt.getFormattedValue(1, 0));
    assertEquals('v1', dt.getProperty(1, 0, 'p1'));
    dt.setCell(1, 0, 'val', 'forval', {'p3': 'v3'});
    assertEquals('val', dt.getValue(1, 0));
    assertEquals('forval', dt.getFormattedValue(1, 0));
    assertEquals('v3', dt.getProperty(1, 0, 'p3'));
    assertEquals(null, dt.getProperty(1, 0, 'p1'));
    dt.setCell(1, 0, 'val2');
    assertEquals('val2', dt.getValue(1, 0));
    assertEquals('forval', dt.getFormattedValue(1, 0));
    assertEquals('v3', dt.getProperty(1, 0, 'p3'));
    dt.setCell(1, 0, 'val7', null);
    assertEquals('val7', dt.getValue(1, 0));
    assertEquals(
      'val7',
      // autocomputed
      dt.getFormattedValue(1, 0),
    );
    assertEquals('v3', dt.getProperty(1, 0, 'p3'));
    dt.setCell(1, 0, 'val2', 'forval2');
    assertEquals('val2', dt.getValue(1, 0));
    assertEquals('forval2', dt.getFormattedValue(1, 0));
    assertEquals('v3', dt.getProperty(1, 0, 'p3'));
    dt.setCell(1, 0, 'val3', null, null);
    assertEquals('val3', dt.getValue(1, 0));
    assertEquals(
      'val3',
      // autocomputed
      dt.getFormattedValue(1, 0),
    );
    assertEquals(null, dt.getProperty(1, 0, 'p3'));
    dt.setProperty(1, 0, 'p1', 'v1');
    dt.setCell(1, 0, 'val4', '', {});
    assertEquals('val4', dt.getValue(1, 0));
    assertEquals('', dt.getFormattedValue(1, 0));
    assertEquals(null, dt.getProperty(1, 0, 'p1'));
    dt.setCell(1, 0, 'val7', null, {'prop': 1});
    assertEquals('val7', dt.getValue(1, 0));
    assertEquals('val7', dt.getFormattedValue(1, 0));
    assertObjectEquals({'prop': 1}, dt.getProperties(1, 0));
    dt.setCell(1, 0, 'val7', null, undefined);
    assertEquals('val7', dt.getValue(1, 0));
    assertEquals('val7', dt.getFormattedValue(1, 0));
    assertObjectEquals({'prop': 1}, dt.getProperties(1, 0));
    dt.setCell(1, 0, 'val7', null, null);
    assertObjectEquals({}, dt.getProperties(1, 0));
    dt.setCell(1, 0, 'val7', null, null);
    assertObjectEquals({}, dt.getProperties(1, 0));
  });

  it('Clones a DataTable', () => {
    const dt = new DataTable(null);
    dt.addColumn('string', 'A', 'id1');
    dt.addColumn('number', 'B', 'id2');
    dt.addColumn('boolean', 'C', 'id3');
    dt.setColumnProperty(1, 'cp1', 'value');
    const someObject = {'a': 1};
    dt.setColumnProperty(1, 'cp2', someObject);
    dt.addRows(2);
    dt.setValue(0, 0, 'bbb');
    dt.setFormattedValue(0, 0, 'ccc');
    dt.setValue(1, 2, true);
    dt.setProperty(1, 2, 'p1', 'v1');
    dt.setProperty(1, 2, 'p2', 'v2');
    dt.setProperty(1, 2, 'p3', someObject);
    const cloneDT = dt.clone();
    assertEquals('bbb', cloneDT.getValue(0, 0));
    assertEquals('ccc', cloneDT.getFormattedValue(0, 0));
    assertEquals(true, cloneDT.getValue(1, 2));
    assertEquals('v1', cloneDT.getProperty(1, 2, 'p1'));
    assertEquals('v2', cloneDT.getProperty(1, 2, 'p2'));
    assertObjectEquals(someObject, cloneDT.getProperty(1, 2, 'p3'));
    assertEquals('value', cloneDT.getColumnProperty(1, 'cp1'));
    assertObjectEquals(someObject, cloneDT.getColumnProperty(1, 'cp2'));
    cloneDT.setValue(1, 2, false);
    cloneDT.setProperty(1, 2, 'p2', 'v3');
    cloneDT.setColumnProperty(1, 'cp1', 'changed value');
    assertEquals(false, cloneDT.getValue(1, 2));
    assertEquals(true, dt.getValue(1, 2));
    assertEquals('v3', cloneDT.getProperty(1, 2, 'p2'));
    assertEquals('v2', dt.getProperty(1, 2, 'p2'));
    assertEquals('changed value', cloneDT.getColumnProperty(1, 'cp1'));
    assertEquals('value', dt.getColumnProperty(1, 'cp1'));
  });

  it('Generates expected version of DataTable', () => {
    const pattern = '#0.###############';
    let dataTable = new DataTable({
      'cols': [
        {'id': 'A', 'label': '', 'type': 'string', 'pattern': ''},
        {'id': 'B', 'label': '', 'type': 'number', 'pattern': pattern},
        {'id': 'C', 'label': '', 'type': 'number', 'pattern': pattern},
      ],
      'rows': [
        {'c': [{'v': ''}, {'v': 2.0, 'f': '2'}, {'v': 5.0, 'f': '5'}]},
        {'c': [{'v': ''}, {'v': 7.0, 'f': '7'}, {'v': 3.0, 'f': '3'}]},
      ],
    });
    assertEquals('0.6', dataTable.version);
    assertEquals(5.0, dataTable.getValue(0, 2));
    dataTable = new DataTable(
      {
        'cols': [
          {'id': 'A', 'label': '', 'type': 'string', 'pattern': ''},
          {'id': 'B', 'label': '', 'type': 'number', 'pattern': pattern},
          {'id': 'C', 'label': '', 'type': 'number', 'pattern': pattern},
        ],
        'rows': [
          {'c': [{'v': ''}, {'v': 2.0, 'f': '2'}, {'v': 5.0, 'f': '5'}]},
          {'c': [{'v': ''}, {'v': 7.0, 'f': '7'}, {'v': 3.0, 'f': '3'}]},
        ],
      },
      ResponseVersion.VERSION_0_5,
    );
    assertEquals('0.5', dataTable.version);
    assertEquals(5.0, dataTable.getValue(0, 2));
  });

  it('Generates a clone of DataTable via constructor with properties', () => {
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
    const clone = dt.clone();

    // TODO(dlaliberte): Not used yet, but may be a good idea to test.
    // var view = new google.visualization.DataView(dt);

    assertNull(dt.getTableProperties());
    assertNull(dt.getTableProperty('sensi'));
    assertNull(dt.getTableProperty('dub'));
    assertNull(clone.getTableProperties());
    assertNull(clone.getTableProperty('sensi'));
    assertNull(clone.getTableProperty('dub'));
    clone.setTableProperty('ska', 'rokombine');
    assertObjectEquals({'ska': 'rokombine'}, clone.getTableProperties());
    assertEquals('rokombine', clone.getTableProperty('ska'));
  });

  it('Generates a DataTable via constructor, insertRows, and addRows', () => {
    {
      const obj: TableSpec = {};
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
      const dt = new DataTable(obj);
      dt.insertRows(1, [
        ['foo', 7],
        [
          {'v': 'bar', 'f': '$bar$', 'p': {'a': 'b'}},
          {'v': 17, 'f': '$17$', 'p': {'c': 'd'}},
        ],
      ]);
      dt.addRows([
        ['foo2', 72],
        [
          {'v': 'bar2', 'f': '$bar2$', 'p': {'a2': 'b2'}},
          {'v': 172, 'f': '$172$', 'p': {'c2': 'd2'}},
        ],
      ]);
      dt.addRow(['foo3', 73]);
      dt.addRow([
        {'v': 'bar3', 'f': '$bar3$', 'p': {'a3': 'b3'}},
        {'v': 173, 'f': '$173$', 'p': {'c3': 'd3'}},
      ]);
      assertEquals('afoo', dt.getValue(0, 0));
      assertEquals('abar', dt.getValue(3, 0));
      assertEquals('abaz', dt.getValue(4, 0));
      assertEquals('foo', dt.getValue(1, 0));
      assertEquals('foo', dt.getFormattedValue(1, 0));
      assertEquals(null, dt.getProperty(1, 0, 'a'));
      assertEquals(null, dt.getProperty(1, 0, 'c'));
      assertEquals(7, dt.getValue(1, 1));
      assertEquals('7', dt.getFormattedValue(1, 1));
      assertEquals(null, dt.getProperty(1, 1, 'a'));
      assertEquals(null, dt.getProperty(1, 1, 'c'));
      assertEquals('bar', dt.getValue(2, 0));
      assertEquals('$bar$', dt.getFormattedValue(2, 0));
      assertEquals('b', dt.getProperty(2, 0, 'a'));
      assertEquals(17, dt.getValue(2, 1));
      assertEquals('$17$', dt.getFormattedValue(2, 1));
      assertEquals('d', dt.getProperty(2, 1, 'c'));
      assertEquals('foo2', dt.getValue(5, 0));
      assertEquals('foo2', dt.getFormattedValue(5, 0));
      assertEquals(null, dt.getProperty(5, 0, 'a2'));
      assertEquals(null, dt.getProperty(5, 0, 'c2'));
      assertEquals(72, dt.getValue(5, 1));
      assertEquals('72', dt.getFormattedValue(5, 1));
      assertEquals(null, dt.getProperty(5, 1, 'a2'));
      assertEquals(null, dt.getProperty(5, 1, 'c2'));
      assertEquals('bar2', dt.getValue(6, 0));
      assertEquals('$bar2$', dt.getFormattedValue(6, 0));
      assertEquals('b2', dt.getProperty(6, 0, 'a2'));
      assertEquals(172, dt.getValue(6, 1));
      assertEquals('$172$', dt.getFormattedValue(6, 1));
      assertEquals('d2', dt.getProperty(6, 1, 'c2'));
      assertEquals('foo3', dt.getValue(7, 0));
      assertEquals('foo3', dt.getFormattedValue(7, 0));
      assertEquals(null, dt.getProperty(7, 0, 'a3'));
      assertEquals(null, dt.getProperty(7, 0, 'c3'));
      assertEquals(73, dt.getValue(7, 1));
      assertEquals('73', dt.getFormattedValue(7, 1));
      assertEquals(null, dt.getProperty(7, 1, 'a3'));
      assertEquals(null, dt.getProperty(7, 1, 'c3'));
      assertEquals('bar3', dt.getValue(8, 0));
      assertEquals('$bar3$', dt.getFormattedValue(8, 0));
      assertEquals('b3', dt.getProperty(8, 0, 'a3'));
      assertEquals(173, dt.getValue(8, 1));
      assertEquals('$173$', dt.getFormattedValue(8, 1));
      assertEquals('d3', dt.getProperty(8, 1, 'c3'));
    }

    {
      const obj: TableSpec = {};
      obj['cols'] = [
        {'id': 'A', 'label': 'AA', 'type': 'timeofday'},
        {'id': 'B', 'label': 'BB', 'type': 'datetime'},
      ];
      obj['rows'] = [];
      const dt = new DataTable(obj);
      dt.insertRows(0, [
        [[5, 6, 7, 30], new Date(2008, 5, 5, 5, 5, 5)],
        [
          {'v': [5, 6, 7], 'p': {'a': 'b'}},
          {'v': new Date(2008, 6, 6, 6, 6, 6, 6)},
        ],
      ]);
      assertArrayEquals([5, 6, 7, 30], dt.getValue(0, 0));
      assertEquals('05:06:07.030', dt.getFormattedValue(0, 0));
      assertDateEquals(new Date(2008, 5, 5, 5, 5, 5), dt.getValue(0, 1));
      assertArrayEquals([5, 6, 7], dt.getValue(1, 0));
      assertEquals('05:06:07', dt.getFormattedValue(1, 0));
      assertDateEquals(new Date(2008, 6, 6, 6, 6, 6, 6), dt.getValue(1, 1));
    }
  });

  it('Generates a DataTable via addRow edge cases', () => {
    let obj: TableSpec = {};
    obj['cols'] = [{'type': 'string'}, {'type': 'number'}, {'type': 'boolean'}];
    obj['rows'] = [];
    let data = new DataTable(obj);
    data.addRows([
      ['bob', , null],
      ['bob', {'v': null}, null],
      ['bob', undefined, undefined],
      ['bob', null, {'v': undefined}],
      [{'v': 'bob'}, undefined, undefined],
    ]);
    assertEquals(5, data.getNumberOfRows());
    assertEquals(3, data.getNumberOfColumns());
    for (let r = 0; r < 5; r++) {
      assertEquals('bob', data.getValue(r, 0));
      assertEquals(null, data.getValue(r, 1));
      assertEquals(null, data.getValue(r, 2));
      assertEquals('bob', data.getFormattedValue(r, 0));
      assertEquals('', data.getFormattedValue(r, 1));
      assertEquals('', data.getFormattedValue(r, 2));
    }

    // test add single row and first cell empty
    data.addRow([null, 12, true]);
    data.addRow([undefined, 12, true]);
    data.addRow([undefined, null, null]);
    assertEquals(8, data.getNumberOfRows());
    assertEquals(3, data.getNumberOfColumns());
    for (let r = 5; r < 7; r++) {
      assertEquals(null, data.getValue(r, 0));
      assertEquals(12, data.getValue(r, 1));
      assertEquals(true, data.getValue(r, 2));
    }
    assertEquals(null, data.getValue(7, 0));
    assertEquals(null, data.getValue(7, 1));
    assertEquals(null, data.getValue(7, 2));

    // date, datetime and timeofday
    obj = {};
    obj['cols'] = [
      {'type': 'date'},
      {'type': 'datetime'},
      {'type': 'timeofday'},
    ];
    obj['rows'] = [];
    data = new DataTable(obj);
    const date = new Date(2002, 1, 2);
    const datetime = new Date(2001, 1, 4, 12, 13, 11);
    const timeofday = [11, 13, 14, 134];
    data.addRows([
      [date, datetime, timeofday],
      [{'v': date}, {'v': datetime}, {'v': timeofday}],
      [{'v': date, 'f': 'm-date'}, {'v': datetime}, {'v': timeofday}],
      [null, undefined, timeofday],
    ]);
    assertEquals(4, data.getNumberOfRows());
    assertEquals(3, data.getNumberOfColumns());
    assertEquals(date, data.getValue(0, 0));
    assertEquals(datetime, data.getValue(0, 1));
    assertEquals(timeofday, data.getValue(0, 2));
    assertEquals(date, data.getValue(1, 0));
    assertEquals(datetime, data.getValue(1, 1));
    assertEquals(timeofday, data.getValue(1, 2));
    assertEquals(date, data.getValue(2, 0));
    assertEquals('m-date', data.getFormattedValue(2, 0));
    assertEquals(datetime, data.getValue(2, 1));
    assertEquals(timeofday, data.getValue(2, 2));
    assertEquals(null, data.getValue(3, 0));
    assertEquals(null, data.getValue(3, 1));
    assertEquals(timeofday, data.getValue(3, 2));
  });

  it('Generates JSON with empty data values', () => {
    const obj: TableSpec = {};
    obj['cols'] = [{'type': 'date'}, {'type': 'date'}, {'type': 'date'}];

    // TODO(dlaliberte): Is this really legal, where one of the 'c' arrays is
    // shorter than the 'cols' array?
    obj['rows'] = [
      {'c': [{'v': new Date(1, 1, 1)}, , {'v': new Date(1, 2, 1)}]},
    ];
    const data = new DataTable(obj);
    assertNotNull(data.toJSON());
  });
});
