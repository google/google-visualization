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

import {assertObjectEquals} from '../common/test_utils';

import {DataTable} from './datatable';
import {DataView} from './dataview';
import {join} from './join';
import {TableSpec} from './types';

describe('join testing', () => {
  describe('tests inner, left and right join', () => {
    const obj1: TableSpec = {
      'cols': [
        {
          'id': 'country',
          'label': 'Country',
          'type': 'string',
          'p': {'leftKeyColProp': 'a'},
        },
        {
          'label': 'Population',
          'type': 'number',
          'p': {'leftDataColProp': 'b'},
        },
      ],
      'rows': [
        {
          'c': [
            {'v': 'Israel', 'f': 'ISRAEL'}, // force parallel layout
            {'v': 5000000, 'f': '5,000,000'},
          ],
        },
        {
          'c': [
            {'v': 'Malta'}, //
            {'v': 400000},
          ],
        },
        {
          'c': [
            {'v': 'Poland'}, //
            {'v': 40000000},
          ],
        },
        {
          'c': [
            {'v': 'Italy', 'f': 'ITALY'}, //
            {'v': 60000000, 'f': '60,000,000'},
          ],
        },
        {
          'c': [
            {'v': 'Russia'}, //
            {'v': 140000000},
          ],
        },
      ],
    };
    const dt1 = new DataTable(obj1);

    const obj2 = {
      'cols': [
        {'label': 'Country', 'type': 'string'},
        {
          'id': 'area',
          'label': 'Area',
          'type': 'number',
          'p': {'rightDataColProp': 'c'},
        },
      ],
      'rows': [
        {'c': [{'v': 'Latvia'}, {'v': 64000}]},
        {'c': [{'v': 'Sweden'}, {'v': 500000}]},
        {'c': [{'v': 'Italy', 'f': 'italy'}, {'v': 300000}]},
        {'c': [{'v': 'Poland'}, {'v': 310000}]},
        {
          'c': [
            {'v': 'Albania', 'f': 'albania'},
            {'v': 350000, 'f': '350,000'},
          ],
        },
      ],
    };
    const dt2 = new DataTable(obj2);

    const EXPECTED_INNER_JOIN_JSON: TableSpec = {
      'cols': [
        {
          'id': 'country',
          'pattern': '',
          'label': 'Country',
          'type': 'string',
          'p': {'leftKeyColProp': 'a'},
        },
        {
          'id': '',
          'pattern': '',
          'label': 'Population',
          'type': 'number',
          'p': {'leftDataColProp': 'b'},
        },
        {
          'id': 'area',
          'pattern': '',
          'label': 'Area',
          'type': 'number',
          'p': {'rightDataColProp': 'c'},
        },
      ],
      'rows': [
        {
          'c': [
            {'v': 'Italy', f: 'ITALY', p: {}},
            {'v': 60000000, 'f': '60,000,000', p: {}},
            {'v': 300000, 'f': '300,000', 'p': {}},
          ],
        },
        {
          'c': [
            {'v': 'Poland', f: 'Poland', p: {}},
            {'v': 40000000, 'f': '40,000,000', p: {}},
            {'v': 310000, 'f': '310,000', 'p': {}},
          ],
        },
      ],
    };

    const EXPECTED_LEFT_JOIN_JSON: TableSpec = {
      'cols': [
        {
          'id': 'country',
          'pattern': '',
          'label': 'Country',
          'type': 'string',
          'p': {'leftKeyColProp': 'a'},
        },
        {
          'id': '',
          'pattern': '',
          'label': 'Population',
          'type': 'number',
          'p': {'leftDataColProp': 'b'},
        },
        {
          'id': 'area',
          'pattern': '',
          'label': 'Area',
          'type': 'number',
          'p': {'rightDataColProp': 'c'},
        },
      ],
      'rows': [
        {
          'c': [
            {'v': 'Israel', 'f': 'ISRAEL', 'p': {}},
            {'v': 5000000, 'f': '5,000,000', 'p': {}},
            {'v': null},
          ],
        },
        {
          'c': [
            {'v': 'Italy', 'f': 'ITALY', 'p': {}},
            {'v': 60000000, 'f': '60,000,000', 'p': {}},
            {'v': 300000, 'f': '300,000', 'p': {}},
          ],
        },
        {
          'c': [
            {'v': 'Malta', 'f': 'Malta', 'p': {}},
            {'v': 400000, 'f': '400,000', 'p': {}},
            {'v': null},
          ],
        },
        {
          'c': [
            {'v': 'Poland', 'f': 'Poland', 'p': {}},
            {'v': 40000000, 'f': '40,000,000', 'p': {}},
            {'v': 310000, 'f': '310,000', 'p': {}},
          ],
        },
        {
          'c': [
            {'v': 'Russia', 'f': 'Russia', 'p': {}},
            {'v': 140000000, 'f': '140,000,000', 'p': {}},
            {'v': null},
          ],
        },
      ],
    };

    const EXPECTED_RIGHT_JOIN_JSON: TableSpec = {
      'cols': [
        {
          'id': 'country',
          'pattern': '',
          'label': 'Country',
          'type': 'string',
          'p': {'leftKeyColProp': 'a'},
        },
        {
          'id': '',
          'pattern': '',
          'label': 'Population',
          'type': 'number',
          'p': {'leftDataColProp': 'b'},
        },
        {
          'id': 'area',
          'pattern': '',
          'label': 'Area',
          'type': 'number',
          'p': {'rightDataColProp': 'c'},
        },
      ],
      'rows': [
        {
          'c': [
            {'v': 'Albania', 'f': 'albania', 'p': {}},
            {'v': null},
            {'v': 350000, 'f': '350,000', 'p': {}},
          ],
        },
        {
          'c': [
            {'v': 'Italy', 'f': 'italy', 'p': {}},
            {'v': 60000000, 'f': '60,000,000', 'p': {}},
            {'v': 300000, 'f': '300,000', 'p': {}},
          ],
        },
        {
          'c': [
            {'v': 'Latvia', 'f': 'Latvia', 'p': {}},
            {'v': null},
            {'v': 64000, 'f': '64,000', 'p': {}},
          ],
        },
        {
          'c': [
            {'v': 'Poland', 'f': 'Poland', 'p': {}},
            {'v': 40000000, 'f': '40,000,000', 'p': {}},
            {'v': 310000, 'f': '310,000', 'p': {}},
          ],
        },
        {
          'c': [
            {'v': 'Sweden', 'f': 'Sweden', 'p': {}},
            {'v': null},
            {'v': 500000, 'f': '500,000', 'p': {}},
          ],
        },
      ],
    };

    it('works with join 1', () => {
      const result = join(
        dt1,
        dt2,
        'inner',
        [['country', 0]],
        ['Population'],
        [1],
      );
      assertObjectEquals(EXPECTED_INNER_JOIN_JSON, result.toPOJO());
    });

    it('works with join 2', () => {
      const result = join(dt1, dt2, 'left', [[0, 0]], [1], [1]);
      assertObjectEquals(EXPECTED_LEFT_JOIN_JSON, result.toPOJO());
    });

    it('works with join 3', () => {
      const result = join(dt1, dt2, 'right', [[0, 0]], [1], [1]);
      assertObjectEquals(EXPECTED_RIGHT_JOIN_JSON, result.toPOJO());
    });

    it('works with join DataView', () => {
      const result = join(
        new DataView(dt1),
        new DataView(dt2),
        'inner',
        [[0, 0]],
        [1],
        [1],
      );
      assertObjectEquals(EXPECTED_INNER_JOIN_JSON, result.toPOJO());
    });
  });

  describe(
    'tests full join, multiple dimensions, multiple metrics, ' +
      'duplicate keys on the left table.',
    () => {
      const obj1 = {
        'cols': [
          {'id': 'artist', 'label': 'Artist', 'type': 'string'},
          {'id': 'album', 'label': 'Album', 'type': 'string'},
          {'id': 'track-number', 'label': 'Track Number', 'type': 'number'},
          {'id': 'popularity', 'label': 'Popularity', 'type': 'number'},
        ],
        'rows': [
          {'c': [{'v': 'Jimi Hendrix'}, {'v': 'Fire'}, {'v': 3}, {'v': 50}]},
          {'c': [{'v': 'Jimi Hendrix'}, {'v': 'Fire'}, {'v': 7}, {'v': 60}]},
          {'c': [{'v': 'Jimi Hendrix'}, {'v': 'Fire'}, {'v': 7}, {'v': 50}]},
          {'c': [{'v': 'Jimi Hendrix'}, {'v': 'Fire'}, {'v': 2}, {'v': 40}]},
          {
            'c': [
              {'v': 'Pat Metheny', 'f': 'PAT!'},
              {'v': 'Move to the Groove'},
              {'v': 1},
              {'v': 100, 'f': 'one hundred!'},
            ],
          },
          {
            'c': [
              {'v': 'Pat Metheny'},
              {'v': 'Move to the Groove'},
              {'v': 7},
              {'v': 20},
            ],
          },
          {
            'c': [
              {'v': 'Pat Metheny'},
              {'v': 'Move to the Groove'},
              {'v': 7},
              {'v': 30},
            ],
          },
          {'c': [{'v': 'Sonic Youth'}, {'v': 'Goo'}, {'v': 6}, {'v': 80}]},
        ],
      };

      const dt1 = new DataTable(obj1);

      const obj2 = {
        'cols': [
          {'id': 'index', 'label': 'Index', 'type': 'number'},
          {'id': 'ALBUM', 'label': 'Album', 'type': 'string'},
          {'id': 'duration', 'label': 'Duration', 'type': 'number'},
          {'id': 'ARTIST', 'label': 'Artist', 'type': 'string'},
          {
            'id': 'last-perf',
            'label': 'Last Performance Date',
            'type': 'date',
          },
          {'id': 'TRACK-NUMBER', 'label': 'Track Number', 'type': 'number'},
        ],
        'rows': [
          {
            'c': [
              {'v': '1'},
              {'v': 'Letter From Home'},
              {'v': 260},
              {'v': 'Pat Metheny'},
              {'v': new Date(1995, 10, 7)},
              {'v': 1},
            ],
          },
          {
            'c': [
              {'v': '2'},
              {'v': 'Fire'},
              {'v': 190},
              {'v': 'Jimi Hendrix'},
              {'v': new Date(2001, 3, 2)},
              {'v': 3},
            ],
          },
          {
            'c': [
              {'v': '3'},
              {'v': 'Letter From Home'},
              {'v': 300},
              {'v': 'Pat Metheny'},
              {'v': new Date(1999, 5, 7)},
              {'v': 6},
            ],
          },
          {
            'c': [
              {'v': '4'},
              {'v': 'Fire'},
              {'v': 81},
              {'v': 'Jimi Hendrix'},
              {'v': new Date(2002, 1, 2)},
              {'v': 7},
            ],
          },
          {
            'c': [
              {'v': '5'},
              {'v': 'Move to the Groove'},
              {'v': 230},
              {'v': 'Pat Metheny'},
              {'v': new Date(1995, 10, 7)},
              {'v': 1},
            ],
          },
          {
            'c': [
              {'v': '6'},
              {'v': 'Lucile'},
              {'v': 200},
              {'v': 'B. B. King'},
              {'v': new Date(1985, 10, 11)},
              {'v': 4},
            ],
          },
          {
            'c': [
              {'v': '7'},
              {'v': 'Fire'},
              {'v': 150},
              {'v': 'Jimi Hendrix'},
              {'v': new Date(2001, 5, 4)},
              {'v': 4},
            ],
          },
        ],
      };

      const dt2 = new DataTable(obj2);

      const EXPECTED_FULL_JOIN_JSON: TableSpec = {
        'cols': [
          {
            'id': 'artist',
            'pattern': '',
            'label': 'Artist',
            'type': 'string',
            'p': {},
          },
          {
            'id': 'album',
            'pattern': '',
            'label': 'Album',
            'type': 'string',
            'p': {},
          },
          {
            'id': 'track-number',
            'pattern': '',
            'label': 'Track Number',
            'type': 'number',
            'p': {},
          },
          {
            'id': 'popularity',
            'pattern': '',
            'label': 'Popularity',
            'type': 'number',
            'p': {},
          },
          {
            'id': 'duration',
            'pattern': '',
            'label': 'Duration',
            'type': 'number',
            'p': {},
          },
          {
            'id': 'last-perf',
            'pattern': '',
            'label': 'Last Performance Date',
            'type': 'date',
            'p': {},
          },
        ],
        'rows': [
          {
            'c': [
              {'v': 'B. B. King'},
              {'v': 'Lucile'},
              {'v': 4},
              {'v': null},
              {'v': 200, 'f': '200', 'p': {}},
              {'v': 'Date(1985, 10, 11)', 'f': 'Nov 11, 1985', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Jimi Hendrix'},
              {'v': 'Fire'},
              {'v': 2},
              {'v': 40, 'f': '40', 'p': {}},
              {'v': null},
              {'v': null},
            ],
          },
          {
            'c': [
              {'v': 'Jimi Hendrix'},
              {'v': 'Fire'},
              {'v': 3},
              {'v': 50, 'f': '50', 'p': {}},
              {'v': 190, 'f': '190', 'p': {}},
              {'v': 'Date(2001, 3, 2)', 'f': 'Apr 2, 2001', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Jimi Hendrix'},
              {'v': 'Fire'},
              {'v': 4},
              {'v': null},
              {'v': 150, 'f': '150', 'p': {}},
              {'v': 'Date(2001, 5, 4)', 'f': 'Jun 4, 2001', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Jimi Hendrix'},
              {'v': 'Fire'},
              {'v': 7},
              {'v': 60, 'f': '60', 'p': {}},
              {'v': 81, 'f': '81', 'p': {}},
              {'v': 'Date(2002, 1, 2)', 'f': 'Feb 2, 2002', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Jimi Hendrix'},
              {'v': 'Fire'},
              {'v': 7},
              {'v': 50, 'f': '50', 'p': {}},
              {'v': 81, 'f': '81', 'p': {}},
              {'v': 'Date(2002, 1, 2)', 'f': 'Feb 2, 2002', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Pat Metheny'},
              {'v': 'Letter From Home'},
              {'v': 1},
              {'v': null},
              {'v': 260, 'f': '260', 'p': {}},
              {'v': 'Date(1995, 10, 7)', 'f': 'Nov 7, 1995', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Pat Metheny'},
              {'v': 'Letter From Home'},
              {'v': 6},
              {'v': null},
              {'v': 300, 'f': '300', 'p': {}},
              {'v': 'Date(1999, 5, 7)', 'f': 'Jun 7, 1999', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Pat Metheny'},
              {'v': 'Move to the Groove'},
              {'v': 1},
              {'v': 100, 'f': 'one hundred!', 'p': {}},
              {'v': 230, 'f': '230', 'p': {}},
              {'v': 'Date(1995, 10, 7)', 'f': 'Nov 7, 1995', 'p': {}},
            ],
          },
          {
            'c': [
              {'v': 'Pat Metheny'},
              {'v': 'Move to the Groove'},
              {'v': 7},
              {'v': 20, 'f': '20', 'p': {}},
              {'v': null},
              {'v': null},
            ],
          },
          {
            'c': [
              {'v': 'Pat Metheny'},
              {'v': 'Move to the Groove'},
              {'v': 7},
              {'v': 30, 'f': '30', 'p': {}},
              {'v': null},
              {'v': null},
            ],
          },
          {
            'c': [
              {'v': 'Sonic Youth'},
              {'v': 'Goo'},
              {'v': 6},
              {'v': 80, 'f': '80', 'p': {}},
              {'v': null},
              {'v': null},
            ],
          },
        ],
      };

      it('works with join 5', () => {
        const result = join(
          dt1,
          dt2,
          'full',
          [
            [0, 3],
            [1, 1],
            [2, 5],
          ],
          [3],
          [2, 4],
        );
        assertObjectEquals(EXPECTED_FULL_JOIN_JSON, result.toPOJO());
      });
    },
  );
});
