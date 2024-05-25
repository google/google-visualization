/**
 * @fileoverview Messages for the common package.
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

/**
 * @desc Separator for every 3 digits in large numbers.
 *
 */
export const MSG_THOUSAND_SEPARATOR = goog.getMsg(',');

/** @desc Decimal point between whole and fraction. */
export const MSG_DECIMAL_POINT = goog.getMsg('.');

/** @desc Indication that the text was cut due to lack of space (ellipsis). */
export const MSG_MISSING_TEXT_INDICATION = goog.getMsg('...');

/**
 * @desc When we draw a pie chart, there may be small slices that are too
 *   small to display individually, and we combine them all into a single
 *   slice with this label. In general, we do not know what kind of things
 *   are being represented in the chart.  There could be a gender
 *   (e.g. a pie chart of the number of woman who attended various colleges,
 *   with "Other" being for all colleges for which the number was less than
 *   the optional threshold.), or it might be about a number of things,
 *   or quantity of a substance.
 *   The term "other" is used like "leftovers":
 *   http://www.thesaurus.com/browse/leftovers or "odds and ends":
 *   http://www.thesaurus.com/browse/odds%20and%20ends
 */
export const MSG_OTHER = goog.getMsg('Other');

/**
 * @desc Message for browsers that do not support chart.  The user is using a
 *   browser that does not support features required to draw charts with Google
 * Charts.
 */
export const MSG_NOT_SUPPORTED = goog.getMsg(
  'Your browser does not support charts',
);

/** @desc Message when there is no data for drawing a chart. */
export const MSG_NO_DATA = goog.getMsg('No data');
