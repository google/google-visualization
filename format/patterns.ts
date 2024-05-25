/**
 * @fileoverview Applies axis formats from the data table to the options.
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

import {
  filter,
  removeDuplicates,
} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {
  isEmptyOrWhitespace,
  makeSafe,
  repeat,
} from '@npm//@closure/string/string';

import {UserOptions} from '../common/options';
import {AbstractDataTable} from '../data/abstract_datatable';

/**
 * Gviz data tables support something called a "column pattern". In theory,
 * the column pattern is an ICU format string, but really it could be
 * anything.
 *
 * In general, the "column pattern" is useless. It does not affect the
 * chart labels, nor does it affect the formatted values of the data table
 * cells. It should be deprecated and thrown in the dustbin of history.
 *
 * Unfortunately, there is a data source that sets the "column pattern".
 * That data source is called Trix. Trix takes the ICU strings that it
 * uses to display values in its own UI and sets the column pattern in
 * the data table when responding to a gviz query.
 *
 * This class, patterns.js, was an attempt to take that information and
 * write it into the chart options, so that the corecharts would reflect the
 * pattern when rendering their axis labels.
 *
 * This created many problems. Some users of the jsapi did not want Trix's
 * patterns. Sometimes the patterns from Trix didn't make sense (for
 * instance, where the data was in whole numbers, but the axis labels
 * had decimal extensions). Corecharts have many kinds of axis references:
 * vAxis, vAxes.0, targetAxis, to name a few.  These axis references have
 * complex dependency relationships (for examples, properties of vAxis.0
 * can override properties of vAxis).  As time passed, the behavior of
 * applyPatternOptions() broke many times and became increasingly complex.
 *
 * I will try to sum up the current situation:
 *
 * If #canApplyPatterns(options) returns false, applyPatternOptions()
 * does nothing at all. See #canApplyPatterns().
 *
 * If #canApplyPatterns() returns true, applyPatternOptions() calls
 * #setAxisFormat(axis, patterns) for each axis object in the
 * options. Sometimes #setAxisFormat() sets the axis format,
 * sometimes it does nothing. See #setAxisFormat().
 *
 * @see normalizePattern.
 * @param type The chart type.
 * @param data The data table.
 * @param options The chart draw options.
 */
export function applyPatternOptions(
  type: string,
  data: AbstractDataTable,
  options: UserOptions,
) {
  if (!canApplyPatterns(options)) {
    return;
  }

  if (type === 'BubbleChart') {
    applyBubbleChartPatternOptions(data, options);
    return;
  }

  if (type === 'Histogram') {
    return;
  }

  const vAxes = options['vAxes'] || [{}, {}];
  const hAxis = options['hAxis'] || {};
  const vAxis = vAxes[0] || {};
  const rAxis = vAxes[1] || {};

  const vAxisPatterns = [];
  const rAxisPatterns = [];

  const cols = (data && data.getNumberOfColumns()) || 0;

  let pattern;

  // Populate the arrays.
  for (let c = 0; c < cols; c++) {
    if (data.getColumnType(c) === 'number') {
      pattern = data.getColumnPattern(c);
      const targetAxis = getTargetAxis(c, type, data, options);
      switch (targetAxis) {
        case null:
          // Do nothing.
          break;
        case 0:
          vAxisPatterns.push(pattern);
          break;
        case 1:
          rAxisPatterns.push(pattern);
          break;
        default:
          assert(false, 'targetAxisIndex should be 0, 1 or null');
      }
    }
  }

  if (type === 'BarChart') {
    // BarChart is flipped, so the X axis of a BarChart is kind of like
    // the Y axis of the other axis charts, except that there is no
    // support for "dual X".
    // Actually, we do support "multi X", but this is not to be
    // confused with "dual X".
    const hAxisPatterns = vAxisPatterns;
    setAxisFormat(hAxis, hAxisPatterns);
  } else {
    setAxisFormat(vAxis, vAxisPatterns);
    setAxisFormat(rAxis, rAxisPatterns);
  }

  if (cols > 0 && data.getColumnType(0) !== 'string') {
    const domainAxis = type === 'BarChart' ? vAxis : hAxis;
    // A non-string type in column 0 indicates a continuous domain
    // (ScatterChart always has a continuous domain).
    pattern = data.getColumnPattern(0);
    setAxisFormat(domainAxis, [pattern]);
  }

  vAxes[0] = vAxis;
  vAxes[1] = rAxis;
  options['vAxes'] = vAxes;
  options['hAxis'] = hAxis;
}

/**
 * Certain configurations of options cannot be handled by gviz.patterns.
 *
 * If options['useFormatFromData'] == false, the user has explicitly forbid
 * using any number format from the column patterns, so this function
 * returns false.
 *
 * gviz.patterns handles a subset of the axes handled by the corecharts.
 */
export function canApplyPatterns(options: UserOptions): boolean {
  const useFormatFromData = options['useFormatFromData'];
  if (typeof useFormatFromData === 'boolean' && !useFormatFromData) {
    // The caller asked not to use formatting from the underlying data.
    return false;
  }

  // Note that hAxis, vAxes.0 and vAxes.1 are NOT in the axisNames array.
  // That is because we handle them explicitly.
  // In fact, the set of axes handled by gviz.patterns and the set of axes
  // for which gviz.patterns returns early are disjoint sets.
  // That is in line with the predictions of Libicki's Law, which states
  // that the Hack Quotient of gviz.patterns doubles every quarter.
  const axisNames = [
    'vAxis',
    'targetAxis',
    'targetAxes.0',
    'targetAxes.1',
    'domainAxis',
  ];

  for (let i = 0; i < axisNames.length; i++) {
    if (goog.getObjectByName(axisNames[i] + '.format', options)) {
      // The caller passed in an axis format. Leave them all alone.
      return false;
    }
  }
  return true;
}

/**
 * If axis.useFormatFromData == false, does nothing. (Note that
 * useFormatFromData is true by default!)
 *
 * If axis.format is set AND non-empty, does nothing.
 *
 * If the patterns array has multiple distinct entries, does nothing.
 *
 * If the patterns array contains only empty strings, does nothing.
 *
 * Otherwise, sets the axis format!
 * @param axis The axis object.
 * @param patterns An array of patterns.
 */
export function setAxisFormat(
  axis: UserOptions,
  patterns: Array<string | null>,
) {
  const useFormatFromData = axis['useFormatFromData'];
  if (typeof useFormatFromData === 'boolean' && !useFormatFromData) {
    // The caller asked not to use formatting from the underlying data.
    return;
  }

  if (!isEmptyOrWhitespace(makeSafe(axis['format']))) {
    return;
  }

  // Remove the empty patterns.
  patterns = filter(
    patterns,
    (pattern) => !isEmptyOrWhitespace(makeSafe(pattern)),
  );

  // Remove duplicate patterns.
  removeDuplicates(patterns);

  if (patterns.length !== 1) {
    return;
  }

  const pattern = normalizePattern(patterns[0]);
  axis['format'] = pattern;
}

/**
 * BubbleChart is very special, so it needs its own function.
 * @param data The data table.
 * @param options The chart draw options.
 */
function applyBubbleChartPatternOptions(
  data: AbstractDataTable,
  options: UserOptions,
) {
  if (data.getNumberOfColumns() < 3) {
    // Not a valid BubbleChart.
    return;
  }

  const xPattern = data.getColumnPattern(1);
  const hAxis = options['hAxis'] || {};
  setAxisFormat(hAxis, [xPattern]);
  options['hAxis'] = hAxis;

  const yPattern = data.getColumnPattern(2);
  const vAxes = options['vAxes'] || {};
  const vAxis = vAxes[0] || {};
  setAxisFormat(vAxis, [yPattern]);
  vAxes[0] = vAxis;
  options['vAxes'] = vAxes;
}

/**
 * Returns the target Y axis for a given column, 0 for the left Y axis and
 * 1 for the right Y axis. If the given column is not plotted on any Y
 * axis, returns null.
 * @param i The column index.
 * @param chartType The chart type.
 * @param dataTable The data table.
 * @param drawOptions The options.
 * @return The target axis.
 */
function getTargetAxis(
  i: number,
  chartType: string,
  dataTable: AbstractDataTable,
  drawOptions: UserOptions,
): number | null {
  if (i === 0) {
    return null;
  }
  i--;
  const series = drawOptions['series'] || {};
  const serie = series[i] || {};
  return serie['targetAxisIndex'] || 0;
}

/**
 * Normalize the pattern used for numbers.
 * @param pattern The pattern.
 * @return The normalized pattern, or null, if the input is null.
 */
export function normalizePattern(pattern: string | null): string | null {
  if (!isEmptyOrWhitespace(makeSafe(pattern))) {
    // TODO(dlaliberte): remove this hack when ICU in closure supports rounding.
    pattern = pattern!.replace(/\d/g, '0');
    // Allow only 10 digits patterns.
    pattern = pattern.replace(/#{10,}/, repeat('#', 10));
  }
  return pattern;
}
