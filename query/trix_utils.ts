/**
 * @fileoverview General methods for working with trix urls and range entities.
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

import {assert} from '@npm//@closure/asserts/asserts';
import {Coordinate} from '@npm//@closure/math/coordinate';
import {Size} from '@npm//@closure/math/size';
import {
  getDomain,
  getParamValue,
  getPath,
  getPort,
  setParam,
} from '@npm//@closure/uri/utils';

/**
 * Regular expression that matches trix paths.
 * Note: all path regexps include the preceding slash and do not include the
 * trailing slash.
 */
const TRIX_PATH_REG = {
  PREFIX: new RegExp('/spreadsheet'),
  // Identifies all relevant trix servlet paths.
  SUFFIX: new RegExp('/(ccc|tq|pub)$'),
} as const;

/**
 * Regular expression that matches trix domain string.
 */
const TRIX_DOMAIN_REG = {
  OLD: new RegExp(/^spreadsheets?[0-9]?\.google\.com$/),
  NEW: new RegExp(/^docs\.google\.com*$/),
  TEST: new RegExp(
    /^(trix|spreadsheets|docs|webdrive)(-[a-z]+)?\.(corp|sandbox)\.google\.com/,
  ),
  LOCAL: new RegExp(/^(\w*\.){1,2}corp\.google\.com$/),
} as const;

/**
 * Regular expression that matches ritz paths.
 * Note: all path regexps include the preceding slash and do not include the
 * trailing slash.
 */
const RITZ_PATH_REG = {
  PREFIX: new RegExp('/spreadsheets(/d/[^/]+)?'),
  // Identifies all relevant ritz servlet paths.
  SUFFIX: new RegExp('/(edit|gviz/tq|)$'),
} as const;

/**
 * Regular expression that matches ritz domain string.
 */
const RITZ_DOMAIN_REG = {
  PROD: new RegExp(/^docs\.google\.com*$/),
  TEST: new RegExp(/^docs(-qa)?\.(corp|sandbox)\.google\.com*$/),
  LOCAL: new RegExp(/^(\w*\.){1,2}corp\.google\.com$/),
} as const;

/**
 * Regular expression that matches dasher domains.
 */
const DASHER_DOMAIN_REG = {
  // TODO(dlaliberte): Use a real domain regexp or uri parser.
  DASHER: new RegExp('^/a/([\\w-]+\\.)+\\w+'),
  OPT_DASHER: new RegExp('^(/a/([\\w-]+\\.)+\\w+)?'),
} as const;

/**
 * Parameter name for headers parameter in a datasource url.
 */
const HEADERS_PARAM_KEYWORD = 'headers';

/**
 * Parameter name for tq parameter in a datasource url.
 */
const QUERY_PARAM_KEYWORD = 'tq';

/**
 * A pattern for Trix range the matching string doesn't have to
 * start with the range (e.g. "range=A1:B100").
 */
const RANGE_PARAM_KEYWORD = 'range';

/**
 * A range regexp string, the string has to start with the range.
 */
const RANGE_MATCH_REG = new RegExp(/^[a-z]+\d+:[a-z]+\d+$/i);

/**
 * A pattern for a cell position (e.g. A1).
 */
const CELL_MATCH_REG = new RegExp(/^[a-z]+\d+$/i);

/**
 * TODO(dlaliberte): Handle columns > Z. @see TRIX_convertColumnToA1Notation
 * @param left The index of the leftmost column.
 * @param top The index of the top row.
 * @param width The number of columns.
 * @param height The number of rows.
 * @return A spreadsheet range string such as 'A1:B2'.
 */
export function generateA1String(
  left: number,
  top: number,
  width: number,
  height: number,
): string {
  const a = left;
  const one = top;
  const b = a + width - 1;
  const two = one + height - 1;

  // Check that the end column <= Z.
  assert(b <= 26, 'Columns > Z not supported.');

  const aStr = String.fromCharCode(64 + a);
  const bStr = String.fromCharCode(64 + b);
  return `${aStr}${one}:${bStr}${two}`;
}

/**
 * Returns true if the url is in a known Trix (spreadsheet) URL, otherwise
 * returns false.
 *
 * @param url The data source url.
 * @return  True if the url is in a known Trix (spreadsheet) URL,
 *    otherwise false.
 */
export function isTrixUrl(url: string): boolean {
  const domain = getDomain(url) || '';
  const domainReg = TRIX_DOMAIN_REG;

  const isOldDomain = domainReg.OLD.test(domain);
  const isTestDomain = domainReg.TEST.test(domain);
  const isLocalDomain = domainReg.LOCAL.test(domain);
  const isNewDomain = domainReg.NEW.test(domain);

  const path = getPath(url) || '';
  const pathReg = TRIX_PATH_REG;

  const oldPathReg = new RegExp(
    DASHER_DOMAIN_REG.OPT_DASHER.source + pathReg.SUFFIX.source,
  );

  const newPathReg = new RegExp(
    DASHER_DOMAIN_REG.OPT_DASHER.source +
      pathReg.PREFIX.source +
      pathReg.SUFFIX.source,
  );

  const isNewPath = newPathReg.test(path);
  const isMixedPath = isNewPath || oldPathReg.test(path);

  return (
    (isNewDomain && isNewPath) ||
    ((isTestDomain || isLocalDomain || isOldDomain) && isMixedPath)
  );
}

/**
 * Returns true if the url is in a known Ritz (spreadsheets) URL, otherwise
 * returns false.
 *
 * @param url The data source url.
 * @return  True if the url is in a known Ritz (spreadsheets) URL,
 *    otherwise false.
 */
export function isRitzUrl(url: string): boolean {
  const domain = getDomain(url) || '';
  const domainReg = RITZ_DOMAIN_REG;

  const isTestDomain = domainReg.TEST.test(domain);
  const isLocalDomain = domainReg.LOCAL.test(domain);
  const isProdDomain = domainReg.PROD.test(domain);

  const path = getPath(url) || '';
  const pathReg = RITZ_PATH_REG;

  const fullPathReg = new RegExp(
    DASHER_DOMAIN_REG.OPT_DASHER.source +
      pathReg.PREFIX.source +
      pathReg.SUFFIX.source,
  );

  const isRitzPath = fullPathReg.test(path);

  return (isProdDomain || isTestDomain || isLocalDomain) && isRitzPath;
}

/**
 * Returns true if the url is in a known Trix (spreadsheet) URL running from a
 * local machine, otherwise returns false.
 * Uses some heuristic to not identify internal test rigs
 * (e.g., http://trix-qa/).
 *
 * @param url The data source url.
 * @return  True if the url is in a known Trix (spreadsheet) URL,
 *     otherwise false.
 */
export function isTrixLocalMachineUrl(url: string): boolean {
  const domain = getDomain(url) || '';
  const hasPort = getPort(url) != null;

  const domainReg = TRIX_DOMAIN_REG;
  const isTestDomain = domainReg.TEST.test(domain);
  const isLocalDomain = domainReg.LOCAL.test(domain);

  return isLocalDomain && !isTestDomain && hasPort;
}

/**
 * Returns true if the url is in a known Ritz (spreadsheets) URL running from a
 * local machine, otherwise returns false.
 *
 * @param url The data source url.
 * @return  True if the url is in a known Ritz (spreadsheets) URL,
 *     otherwise false.
 */
export function isRitzLocalMachineUrl(url: string): boolean {
  const domain = getDomain(url) || '';
  const hasPort = getPort(url) !== null;

  const domainReg = RITZ_DOMAIN_REG;
  const isLocalDomain = domainReg.LOCAL.test(domain);

  return isLocalDomain && hasPort;
}

/**
 * @param url The data source url.
 * @return  True if the url is in a known Trix (spreadsheet) dasher
 *     URL, otherwise false.
 */
export function isTrixDasherUrl(url: string): boolean {
  const urlIsTrixUrl = isTrixUrl(url);
  const path = getPath(url) || '';
  const pathIsDasher = DASHER_DOMAIN_REG.DASHER.test(path);
  return urlIsTrixUrl && pathIsDasher;
}

/**
 * @param url The data source url.
 * @return  True if the url is in a known Ritz (spreadsheets) dasher
 *     URL, otherwise false.
 */
export function isRitzDasherUrl(url: string): boolean {
  const urlIsRitzUrl = isRitzUrl(url);
  const path = getPath(url) || '';
  const pathIsDasher = DASHER_DOMAIN_REG.DASHER.test(path);
  return urlIsRitzUrl && pathIsDasher;
}

/**
 * Returns the headers parameter of the url, or null if the headers
 * parameter doesn't exist.
 *
 * @param url The data source url.
 * @return The value of the headers parameter or null if the headers
 *    parameter does not appear in the url.
 */
export function getHeadersFromUrl(url: string): string | null {
  return getParamValue(url, HEADERS_PARAM_KEYWORD);
}

/**
 * Sets the headers parameter in the url.
 * @param url The data source url.
 * @param value The value of the headers parameter.
 * @return The updated url.
 */
export function setHeadersInUrl(url: string, value: string): string {
  return setParam(url, HEADERS_PARAM_KEYWORD, value);
}

/**
 * Returns the query parameter of the url, or null if the query
 * parameter doesn't exist.
 *
 * @param url The data source url.
 * @return The value for a tq parameter or null if the tq parameter
 *    does not appear in the url.
 */
export function getQueryFromUrl(url: string): string | null {
  return getParamValue(url, QUERY_PARAM_KEYWORD);
}

/**
 * Returns the range parameter for the url, or null if the range
 * parameter doesn't exist.
 *
 * @param url The data source url.
 * @return The range string.
 */
export function getRangeFromUrl(url: string): string | null {
  return getParamValue(url, RANGE_PARAM_KEYWORD);
}

/**
 * Returns a column index from a column string.
 * @param colString The value to parse.
 * @return The column index (1-based).
 */
function colStringToIndex(colString: string): number {
  let col = 0;
  let magnitude = 1;
  // traverse the col name and returns its numeric value in base 26.
  for (let i = colString.length - 1; i >= 0; i--) {
    const charCode = colString.charCodeAt(i);
    col += magnitude * (charCode - 64);
    magnitude = magnitude * 26;
  }
  return col;
}

/**
 * Given a cell position in a1 notation, returns the cell's coordinate location.
 * For example: C120 -> (3, 120)
 * @param a1CellStr The position (a1 notation) to parse.
 * @return The cell location. column is 1-based,
 *    Row is 1-based.
 */
function a1ToCellPos(a1CellStr: string): Coordinate | null {
  // validate
  if (!CELL_MATCH_REG.test(a1CellStr)) {
    return null;
  }
  a1CellStr = a1CellStr.toUpperCase();
  let rowString;

  // Since input passed validation colString will always be assigned in the
  // loop below.
  let colString = '';
  // split column letters from row numbers
  for (let i = 0; i < a1CellStr.length; i++) {
    const charCode = a1CellStr.charCodeAt(i);
    // a = charCode 65, Z = charCode 90
    if (charCode < 65 || charCode > 90) {
      colString = a1CellStr.substring(0, i);
      rowString = a1CellStr.substring(i);
      break;
    }
  }

  // column (1-based)
  const col = colStringToIndex(colString);
  // row (1-based)
  const row = Number(rowString);
  // validate
  if (isNaN(row) || row <= 0 || col < 0) {
    return null;
  }
  return new Coordinate(col, row);
}

/**
 * Converts a range specification from the type: A1:B2 into a rectangle
 * object. If the given range string isn't a full range, returns null.
 * @param rangeString The value to be parsed. Must be a full range
 *    (both of the cells that define the range are fully stated).
 * @return The parsed rectangle object or null if not valid.
 */
export function a1RangeToSize(rangeString: string): Size | null {
  // TODO(dlaliberte): Add support for multiple ranges
  if (!RANGE_MATCH_REG.test(rangeString)) {
    return null;
  }
  // parse
  rangeString = rangeString.toUpperCase();
  const splittedRange = rangeString.split(':');
  const rangeFirst = splittedRange[0];
  const rangeSecond = splittedRange[1];
  const firstCoor = a1ToCellPos(rangeFirst);
  const secondCoor = a1ToCellPos(rangeSecond);
  // return the rectangle size.
  return new Size(
    Math.abs(secondCoor!.x - firstCoor!.x) + 1,
    Math.abs(secondCoor!.y - firstCoor!.y) + 1,
  );
}
