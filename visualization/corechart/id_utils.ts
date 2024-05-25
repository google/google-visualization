/**
 * @fileoverview A namespace for generating unique IDs for chart definition
 * basic elements.
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

// TODO(dlaliberte): Replace this file with an interface for declaring the
// visual features of the visualization. There is no logic in a pie chart being
// familiar with gridlines. Also, precedence is only needed by axis charts.

// TODO(dlaliberte): Use POJOs instead of strings for IDs of visual features.
// Strings are far more cumbersome to handle (split by separator and such).
/**
 * Generates a unique ID for an element from an array of tokens.
 * @param tokens The tokens defining the element uniquely.
 * @return The generated ID.
 */
export function generateId(tokens: Array<Token | number | null>): string {
  return tokens.join(TOKEN_SEPARATOR);
}

/**
 * Enumeration of all tokens used in building element IDs.
 * Token.
 */
export enum Token {
  ACTIONS_MENU_ENTRY = 'action',
  // TODO(dlaliberte): Merge ANNOTATION_TEXT with ANNOTATION
  ANNOTATION = 'annotation',
  ANNOTATION_TEXT = 'annotationtext',
  AREA = 'area',
  AXIS_TICK = 'axistick',
  AXIS_TITLE = 'axistitle',
  BAR = 'bar',
  BASELINE = 'baseline',
  BOXPLOT = 'boxplot',
  BUBBLE = 'bubble',
  CANDLESTICK = 'candlestick',
  CATEGORY_SENSITIVITY_AREA = 'categorysensitivityarea',
  CHART = 'chart',
  CHART_AREA = 'chartarea',
  COLOR_BAR = 'colorbar',
  GRIDLINE = 'gridline',
  HISTOGRAM = 'histogram',
  INTERVAL = 'interval',
  LEGEND = 'legend',
  LEGEND_ENTRY = 'legendentry',
  LEGEND_SCROLL_BUTTON = 'legendscrollbutton',
  LINE = 'line',
  MINOR_GRIDLINE = 'minorgridline',
  OVERLAY_BOX = 'overlaybox',
  PATH_INTERVAL = 'pathinterval',
  POINT = 'point',
  POINT_SENSITIVITY_AREA = 'pointsensitivityarea',
  REMOVE_SERIE_BUTTON = 'removeseriebutton',
  SLICE = 'slice',
  // TODO(dlaliberte): Rename to STEP
  STEPPED_AREA_BAR = 'steppedareabar',
  TITLE = 'title',
  TOOLTIP = 'tooltip',
}

/** The string used for separating tokens within an ID. */
export const TOKEN_SEPARATOR = '#';

/**
 * The default precedence of elements from background to foreground.
 * When two overlapping elements have the same z-index (or no z-index), the
 * one with higher precedence will hide the element with the lower precedence.
 */
export const TOKEN_PRECEDENCE: Token[] = [
  Token.MINOR_GRIDLINE,
  Token.GRIDLINE,
  Token.AREA,
  Token.CATEGORY_SENSITIVITY_AREA,
  Token.STEPPED_AREA_BAR,
  Token.BAR,
  Token.PATH_INTERVAL,
  Token.BASELINE,
  Token.INTERVAL,
  Token.LINE,
  Token.CANDLESTICK,
  Token.BOXPLOT,
  Token.BUBBLE,
  Token.ANNOTATION,
  Token.POINT_SENSITIVITY_AREA,
  Token.POINT,
  Token.TITLE,
  Token.AXIS_TICK,
  Token.AXIS_TITLE,
  Token.ANNOTATION_TEXT,
  Token.LEGEND,
  Token.LEGEND_SCROLL_BUTTON,
  Token.LEGEND_ENTRY,
  Token.COLOR_BAR,
  Token.TOOLTIP,
  Token.ACTIONS_MENU_ENTRY,
];
