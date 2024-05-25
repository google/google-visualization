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

import {assertEquals, assertObjectEquals} from '../common/test_utils';

import {avg, count, max, min, month, sum} from './calc';
import {DataTable, arrayToDataTable} from './datatable';
import {group} from './group';

describe('group testing', () => {
  describe('tests group', () => {
    const obj = {
      'cols': [
        {'id': 'name', 'label': 'Name', 'type': 'string'},
        {'id': 'date', 'label': 'Date', 'type': 'date'},
        {'id': 'product', 'label': 'Product', 'type': 'string'},
        {'id': 'price', 'label': 'Price', 'type': 'number'},
      ],
      'rows': [
        {
          'c': [
            {'v': 'Chris'},
            {'v': new Date(2005, 3, 1)},
            {'v': 'camera'},
            {'v': 500},
          ],
        },
        {
          'c': [
            {'v': 'Adam'},
            {'v': new Date(2006, 5, 22)},
            {'v': 'TV'},
            {'v': 1000},
          ],
        },
        {
          'c': [
            {'v': 'Chris'},
            {'v': new Date(2004, 3, 15)},
            {'v': 'DVD'},
            {'v': 200},
          ],
        },
        {
          'c': [
            {'v': 'Jane'},
            {'v': new Date(2004, 5, 10)},
            {'v': 'camera'},
            {'v': 300},
          ],
        },
        {
          'c': [
            {'v': 'Tom'},
            {'v': new Date(2005, 5, 1)},
            {'v': 'TV'},
            {'v': 400},
          ],
        },
      ],
    };

    const EXPECTED_AGGREGATION1 = {
      'cols': [
        {'label': 'Name', 'id': 'name', 'pattern': '', 'type': 'string'},
        {'label': 'Price', 'id': 'price', 'pattern': '', 'type': 'number'},
      ],
      'rows': [
        {'c': [{'v': 'Adam'}, {'v': 1000}]},
        {'c': [{'v': 'Chris'}, {'v': 700}]},
        {'c': [{'v': 'Jane'}, {'v': 300}]},
        {'c': [{'v': 'Tom'}, {'v': 400}]},
      ],
    };

    const EXPECTED_AGGREGATION2 = {
      'cols': [
        {'label': 'Month', 'id': 'MonthID', 'pattern': '', 'type': 'number'},
        {
          'label': 'sum(Price)',
          'id': 'PriceSum',
          'type': 'number',
          'pattern': '',
        },
        {'label': 'Month', 'id': 'MonthID', 'pattern': '', 'type': 'number'},
      ],
      'rows': [
        {'c': [{'v': 4}, {'v': 700}, {'v': 2}]},
        {'c': [{'v': 6}, {'v': 1700}, {'v': 3}]},
      ],
    };

    const EXPECTED_AGGREGATION3 = {
      'cols': [
        {'label': '', 'id': '', 'pattern': '', 'type': 'number'},
        {'label': 'Product', 'id': 'product', 'type': 'string', 'pattern': ''},
        {'label': 'Price', 'id': 'price', 'pattern': '', 'type': 'number'},
      ],
      'rows': [
        {'c': [{'v': 4}, {'v': 'DVD'}, {'v': 200}]},
        {'c': [{'v': 4}, {'v': 'camera'}, {'v': 500}]},
        {'c': [{'v': 6}, {'v': 'TV'}, {'v': 1400}]},
        {'c': [{'v': 6}, {'v': 'camera'}, {'v': 300}]},
      ],
    };

    const dt = new DataTable(obj);

    it('tests simple group-by with key indices as numbers.', () => {
      const result = group(
        dt,
        [0],
        [{'column': 'price', 'aggregation': sum, 'type': 'number'}],
      );
      assertObjectEquals(EXPECTED_AGGREGATION1, result.toPOJO());
    });

    it('tests key modifiers, same column as both key and data.', () => {
      // Note we are specifying label and id.
      const result = group(
        dt,
        [
          {
            'column': 'date',
            'modifier': month,
            'type': 'number',
            'label': 'Month',
            'id': 'MonthID',
          },
        ],
        [
          {
            'column': 'price',
            'aggregation': sum,
            'type': 'number',
            'label': 'sum(Price)',
            'id': 'PriceSum',
          },
          {'column': 'MonthID', 'aggregation': count, 'type': 'number'},
        ],
      );

      assertObjectEquals(EXPECTED_AGGREGATION2, result.toPOJO());
    });

    it('tests multiple keys.', () => {
      const result = group(
        dt,
        [{'column': 1, 'modifier': month, 'type': 'number'}, 2],
        [{'column': 3, 'aggregation': sum, 'type': 'number'}],
      );
      assertObjectEquals(EXPECTED_AGGREGATION3, result.toPOJO());
    });

    // Test the avg,min,max functions.
    it('group avg', () => {
      assertEquals(4, avg([3, 4, 5]));
    });
    it('group max 1', () => {
      assertEquals(5, max([1, 5, 2]));
    });
    it('group max 2', () => {
      assertEquals(null, max([]));
    });
    it('group min 1', () => {
      assertEquals(5, min([7, 5, 6]));
    });
    it('group min 2', () => {
      assertEquals(null, min([]));
    });
  });

  describe('test GroupByBug', () => {
    // Test fix for b/4968785.
    const data = arrayToDataTable([
      ['Key', 'a', 'b', 'c', 'd'],
      ['x', 1, 1, 1, 1],
      ['x', 2, 2, 2, 2],
      ['y', 1, 1, 1, 1],
    ]);
    const groupCols = [0];
    const sumCols = [
      {'column': 1, 'aggregation': sum, 'type': 'number'},
      {'column': 2, 'aggregation': sum, 'type': 'number'},
      {'column': 3, 'aggregation': sum, 'type': 'number'},
      {'column': 4, 'aggregation': sum, 'type': 'number'},
    ];
    const groupData = group(data, groupCols, sumCols);
    it('catches bug', () => {
      assertEquals(groupData.getValue(1, 4), 1);
    });
  });

  describe('test GroupBySameColumnBug', () => {
    // Test fix for b/70384791
    const data = arrayToDataTable([
      ['a', 'b', 'c', 'd'],
      [1, 1, 1, 1],
      [2, 2, 2, 2],
      [-1, 3, 3, 3],
    ]);

    const EXPECTED_AGGREGATION1 = {
      'cols': [
        {'id': '', 'label': 'abs', 'pattern': '', 'type': 'number'},
        {'id': '', 'label': 'a', 'pattern': '', 'type': 'number'},
        {'id': '', 'label': 'b', 'pattern': '', 'type': 'number'},
        {'id': '', 'label': 'c', 'pattern': '', 'type': 'number'},
        {'id': '', 'label': 'd', 'pattern': '', 'type': 'number'},
      ],
      'rows': [
        {'c': [{'v': 1}, {'v': 0}, {'v': 4}, {'v': 4}, {'v': 4}]},
        {'c': [{'v': 2}, {'v': 2}, {'v': 2}, {'v': 2}, {'v': 2}]},
      ],
    };

    const groupCols = [
      {
        'column': 0,
        'modifier': (val: number) => Math.abs(val),
        'type': 'number',
        'label': 'abs',
      },
    ];
    const sumCols = [
      {
        'column': 0,
        'aggregation': sum,
        'type': 'number',
      },
      {
        'column': 1,
        'aggregation': sum,
        'type': 'number',
      },
      {
        'column': 2,
        'aggregation': sum,
        'type': 'number',
      },
      {
        'column': 3,
        'aggregation': sum,
        'type': 'number',
      },
    ];

    const groupData = group(data, groupCols, sumCols);

    it('works', () => {
      assertObjectEquals(EXPECTED_AGGREGATION1, groupData.toPOJO());
    });
  });
});
