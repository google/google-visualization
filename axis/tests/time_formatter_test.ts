/**
 * @fileoverview Tests for time time formatter.
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

import {assertEquals} from '@npm//@closure/testing/asserts';
import {testSuite} from '@npm//@closure/testing/testsuite';
import * as milliseconds from '../milliseconds';
import * as utils from '../utils';

import {SimpleTimeFormatter} from '../time_formatter_simple';

class SimpleTimeFormatterTest {
  /** @export */
  testYearFormat() {
    const formatter = new SimpleTimeFormatter();
    formatter.setTimeUnit(milliseconds.YEAR);
    assertEquals('1995', formatter.format(utils.isoStrToMilliseconds('1995')));
  }

  /** @export */
  testFormatQuarter() {
    const formatter = new SimpleTimeFormatter();
    formatter.setTimeUnit(milliseconds.QUARTER);
    assertEquals('Q1', formatter.format(utils.isoStrToMilliseconds('1995')));
    assertEquals(
      'Q2',
      formatter.format(utils.isoStrToMilliseconds('1995-04-01')),
    );
    assertEquals('Q3', formatter.format(utils.isoStrToMilliseconds('1995-7')));
    assertEquals('Q4', formatter.format(utils.isoStrToMilliseconds('1995-10')));
  }

  /** @export */
  testFormatMonth() {
    const formatter = new SimpleTimeFormatter();
    formatter.setTimeUnit(milliseconds.MONTH);
    assertEquals(
      'Jan 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-01')),
    );
    assertEquals(
      'Feb 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-02')),
    );
    assertEquals(
      'Mar 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-03')),
    );
    assertEquals(
      'Apr 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-04')),
    );
    assertEquals(
      'May 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-05')),
    );
    assertEquals(
      'Jun 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-06')),
    );
    assertEquals(
      'Jul 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-07')),
    );
    assertEquals(
      'Aug 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-08')),
    );
    assertEquals(
      'Sep 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-09')),
    );
    assertEquals(
      'Oct 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-10')),
    );
    assertEquals(
      'Nov 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-11')),
    );
    assertEquals(
      'Dec 1995',
      formatter.format(utils.isoStrToMilliseconds('1995-12')),
    );
  }

  /** @export */
  testFallBackOnDate() {
    const formatter = new SimpleTimeFormatter();
    assertEquals(
      '1995-10-12',
      formatter.format(utils.isoStrToMilliseconds('1995-10-12')),
    );
  }
}

testSuite(new SimpleTimeFormatterTest());
