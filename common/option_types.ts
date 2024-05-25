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

/**
 * Enumeration of all chart types.
 */
export enum ChartType {
  NONE = 'none',
  PIE = 'pie',
  FUNCTION = 'function',
  SCATTER = 'scatter',
  BUBBLE = 'bubble',
  HISTOGRAM = 'histogram',
}

/**
 * Enumeration of all serie types.
 */
export enum SerieType {
  NONE = 'none',
  LINE = 'line',
  AREA = 'area',
  STEPPED_AREA = 'steppedArea',
  BARS = 'bars',
  CANDLESTICKS = 'candlesticks',
  SCATTER = 'scatter',
  BUBBLES = 'bubbles',
  BOXPLOT = 'boxplot',
}

/**
 * Enumeration of interval rendering styles.
 */
export enum IntervalStyle {
  BARS = 'bars',
  STICKS = 'sticks',
  BOXES = 'boxes',
  POINTS = 'points',
  LINE = 'line',
  AREA = 'area',
  NONE = 'none',
}

/**
 * Enumeration of special color names, which are mapped to the color scheme
 * of the serie. The color supplied by a user, in fields that support
 * this enumeration, can be either one of its values or else a gviz color
 * specification.
 */
export enum SeriesRelativeColor {
  DARK = 'series-color-dark',
  LIGHT = 'series-color-light',
  COLOR = 'series-color',
}

/**
 * Enumeration of axis types.
 * VALUE axis is where there are lines across to designate key values,
 * and the value text is centered around the line. An example is a line chart,
 * where the values (left) axis is a VALUE axis.
 * CATEGORY axis is where there are a set of categories, and each category
 * gets a part of the axis (a range), and the category label is centered
 * within this range. An example is a columns chart, where the bottom axis is
 * a CATEGORY axis.
 * CATEGORY_POINT axis is where there are a set of categories, and each
 * category gets a single point on the axis, and the category label is
 * centered around this point. An example is an area chart, where the
 * bottom axis is a CATEGORY_POINT axis.
 *
 * Axis type options.
 */
export enum AxisType {
  CATEGORY = 'category', // Axis for categories (a set of labels)
  VALUE = 'value', // Axis of values (numbers)
  CATEGORY_POINT = 'categorypoint', // Category that has a single point width
}

/**
 * Enumeration of view window modes.
 * PRETTY view window sets it to match the ticks edges.
 * MAXIMIZED means set the view window to fit the range of the data.
 * EXPLICIT means that the min and max values for the low and high edges of the
 * view window are specified by another object given by the 'viewWindow' option.
 */
export enum ViewWindowMode {
  PRETTY = 'pretty',
  MAXIMIZED = 'maximized',
  EXPLICIT = 'explicit',
}

/**
 * Enumeration of all legend positions.
 */
export enum LegendPosition {
  NONE = 'none',
  RIGHT = 'right',
  LEFT = 'left',
  TOP = 'top',
  BOTTOM = 'bottom',
  INSIDE = 'in',
  LABELED = 'labeled',
  BOTTOM_VERT = 'bottom-vert',
}

/**
 * Enumeration of all color-bar positions.
 */
export enum ColorBarPosition {
  NONE = 'none',
  TOP = 'top',
  BOTTOM = 'bottom',
  INSIDE = 'in',
}

/**
 * Enumeration of possible orientations.
 */
export enum Orientation {
  VERTICAL = 'vertical',
  HORIZONTAL = 'horizontal',
}

/**
 * Enumeration of possible directions.
 */
export enum Direction {
  FORWARD = 1,
  BACKWARD = -1,
}

/**
 * Enumeration of possible alignments: start, center, and end.
 */
export enum Alignment {
  START = 'start',
  CENTER = 'center',
  END = 'end',
}

/**
 * Enumeration of in/out positions.
 */
export enum InOutPosition {
  NONE = 'none',
  INSIDE = 'in',
  OUTSIDE = 'out',
}

/**
 * Enumeration of bound/unbound positions.
 * Bound/unbound position.
 */
export enum BoundUnboundPosition {
  BOUND = 'bound',
  UNBOUND = 'unbound',
}

/**
 * Enumeration of high/low positions.
 */
export enum HighLowPosition {
  HIGH = 'high',
  LOW = 'low',
}

/**
 * Enumeration of the possible text content on the slices of a pie chart.
 */
export enum PieSliceText {
  NONE = 'none',
  LABEL = 'label',
  VALUE = 'value',
  PERCENTAGE = 'percentage',
  VALUE_AND_PERCENTAGE = 'value-and-percentage',
}

/**
 * Enumeration of the possible text content representing a value of a pie chart
 * slice.
 */
export enum PieValueText {
  NONE = 'none',
  BOTH = 'both',
  VALUE = 'value',
  PERCENTAGE = 'percentage',
}

/**
 * Enumeration of the possible selection modes.
 */
export enum SelectionMode {
  MULTIPLE = 'multiple',
  SINGLE = 'single',
}

/**
 * Enumeration of the possible tooltip triggers.
 */
export enum TooltipTrigger {
  NONE = 'none',
  FOCUS = 'focus',
  SELECTION = 'selection',
  BOTH = 'both',
}

/**
 * Enumeration of the possible crosshair triggers.
 */
export enum CrosshairTrigger {
  NONE = 'none',
  FOCUS = 'focus',
  SELECTION = 'selection',
  BOTH = 'both',
}

/**
 * Enumeration of the possible crosshair orientations.
 */
export enum CrosshairOrientation {
  HORIZONTAL = 'horizontal',
  VERTICAL = 'vertical',
  BOTH = 'both',
}

/**
 * Enumeration of the possible interactivity models.
 */
export enum InteractivityModel {
  DEFAULT = 'default',
  DIVE = 'dive',
}

/**
 * Enumeration of the possible focus targets.
 */
export enum FocusTarget {
  DATUM = 'datum',
  CATEGORY = 'category',
  SERIES = 'series',
}

/**
 * Enumeration of the possible aggregation targets.
 * Aggregation target.
 */
export enum AggregationTarget {
  AUTO = 'auto',
  CATEGORY = 'category',
  SERIES = 'series',
  NONE = 'none',
}

/**
 * Enumeration of curve types used for connecting the dots of line and scatter
 * charts.
 * NONE: No curve at, connect dots with straight lines.
 * FUNCTION: Connect the dots with an x-y style function line, used with line
 *     charts or scatter charts of function representing data. Eg. non uniform
 *     samples of a time dependent variable.
 * PHASE: Connect the dots with an x-y phase line, not necessarily representing
 *     functions. Eg. motion of a particle in an x-y space.
 * CLOSED_PHASE: Connect the dots with a closed x-y phase line, necessarily
 *     not representing functions. Eg. motion of an harmonic oscillator in the
 *     velocity acceleration phase space.
 */
export enum CurveType {
  NONE = 'none',
  FUNCTION = 'function',
  PHASE = 'phase',
  CLOSED_PHASE = 'closedPhase',
}

/**
 * Enumeration of the possible skipping modes types.
 */
export enum TextSkipMode {
  ATTACH_TO_START = 'attachToStart',
  ATTACH_TO_END = 'attachToEnd',
}

/**
 * Enumeration of the possible annotations styles.
 */
export enum AnnotationStyle {
  LETTER = 'letter', // deprecated - use POINT instead.
  POINT = 'point',
  LINE = 'line',
}
