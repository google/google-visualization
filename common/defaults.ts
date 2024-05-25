/**
 * @fileoverview Default values and enums used by the canviz options.
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

// Copyright 2009 Google Inc.
// All Rights Reserved

import {TrendlineType} from '../trendlines/trendlines';

/** @deprecated Please use option_types directly */
import {
  AggregationTarget,
  IntervalStyle,
  SeriesRelativeColor,
} from '../common/option_types';

import {DateFormat} from '../format/dateformat';

export * from './option_types';

/**
 * Default trendline type.
 */
export const DEFAULT_TRENDLINE_TYPE: TrendlineType = TrendlineType.LINEAR;

/**
 * Default colors for discrete legend.
 */
export const DEFAULT_DISCRETE_COLORS = [
  {'color': '#3366CC', 'lighter': '#45AFE2'},
  {'color': '#DC3912', 'lighter': '#FF3300'},
  {'color': '#FF9900', 'lighter': '#FFCC00'},
  {'color': '#109618', 'lighter': '#14C21D'},
  {'color': '#990099', 'lighter': '#DF51FD'},
  {'color': '#0099C6', 'lighter': '#15CBFF'},
  {'color': '#DD4477', 'lighter': '#FF97D2'},
  {'color': '#66AA00', 'lighter': '#97FB00'},
  {'color': '#B82E2E', 'lighter': '#DB6651'},
  {'color': '#316395', 'lighter': '#518BC6'},
  {'color': '#994499', 'lighter': '#BD6CBD'},
  {'color': '#22AA99', 'lighter': '#35D7C2'},
  {'color': '#AAAA11', 'lighter': '#E9E91F'},
  {'color': '#6633CC', 'lighter': '#9877DD'},
  {'color': '#E67300', 'lighter': '#FF8F20'},
  {'color': '#8B0707', 'lighter': '#D20B0B'},
  {'color': '#651067', 'lighter': '#B61DBA'},
  {'color': '#329262', 'lighter': '#40BD7E'},
  {'color': '#5574A6', 'lighter': '#6AA7C4'},
  {'color': '#3B3EAC', 'lighter': '#6D70CD'},
  {'color': '#B77322', 'lighter': '#DA9136'},
  {'color': '#16D620', 'lighter': '#2DEA36'},
  {'color': '#B91383', 'lighter': '#E81EA6'},
  {'color': '#F4359E', 'lighter': '#F558AE'},
  {'color': '#9C5935', 'lighter': '#C07145'},
  {'color': '#A9C413', 'lighter': '#D7EE53'},
  {'color': '#2A778D', 'lighter': '#3EA7C6'},
  {'color': '#668D1C', 'lighter': '#97D129'},
  {'color': '#BEA413', 'lighter': '#E9CA1D'},
  {'color': '#0C5922', 'lighter': '#149638'},
  {'color': '#743411', 'lighter': '#C5571D'},
];

/**
 * Default text to use as a prefix of new data values in tooltips of
 * diff charts.
 */
export const DEFAULT_DIFF_NEW_DATA_PREFIX_TEXT = 'Current: ';

/**
 * Default text to use as a prefix of old data values in tooltips of
 * diff charts.
 */
export const DEFAULT_DIFF_OLD_DATA_PREFIX_TEXT = 'Previous: ';

/**
 * Default text to use as a prefix of X value in tooltips in
 * scatter chart.
 */
export const DEFAULT_SCATTER_TOOLTIP_X_PREFIX_TEXT = 'X';

/**
 * Default text to use as a prefix of Y value in tooltips in
 * scatter chart.
 */
export const DEFAULT_SCATTER_TOOLTIP_Y_PREFIX_TEXT = 'Y';

/**
 * Default color for background series in a diff chart.
 */
export const DEFAULT_DIFF_SERIES_BACKGROUND_COLOR = {
  'color': '#EEEEEE',
  'lighter': '#FEFEFE',
};

/**
 * For diff mode: default opacity for series with old data.
 */
export const DEFAULT_DIFF_OLD_DATA_OPACITY = 0.5;

/**
 * For diff mode: default opacity for series with old data.
 */
export const DEFAULT_DIFF_NEW_DATA_OPACITY = 1;

/**
 * Default scale factor for width of bars with new data in a diff chart.
 */
export const DEFAULT_DIFF_NEW_DATA_WIDTH_FACTOR = 0.3;

/**
 * For diff mode: ratio between radii of inner and outer slices for old and
 * new data.
 */
export const DEFAULT_PIE_DIFF_INNER_OUTER_RADIUS_RATIO = 0.6;

/**
 * For diff mode: gap between slices for old and new data.
 */
export const DEFAULT_PIE_DIFF_INNER_BORDER_RATIO = 0.01;

/**
 * For diff mode: default for whether old data should appear in the center of
 * the pie diff chart.
 */
export const DEFAULT_PIE_DIFF_IS_OLD_DATA_IN_CENTER = true;

/**
 * For diff mode: default for scale factor of icon width in a legend entry: a
 * rectangle showing colors corresponding to the old and new data.
 */
export const DEFAULT_DIFF_LEGEND_ICON_WIDTH_SCALE_FACTOR = 2;

/**
 * Legends can have a colored square to identify a category,
 * whose width can be scaled by a scale factor (width is set
 * to be scalefactor * height). This is the minimum allowed
 * scale factor value.
 */
export const LEGEND_ICON_WIDTH_SCALE_FACTOR_MIN = 1;

/**
 * Legends can have a colored square to identify a category,
 * whose width can be scaled by a scale factor (width is set
 * to be scalefactor * height). This is the maximum allowed
 * scale factor value.
 */
export const LEGEND_ICON_WIDTH_SCALE_FACTOR_MAX = 4;

/**
 * Default line width in line/area/scatter charts. Zero means no lines.
 */
export const DEFAULT_LINE_WIDTH = 2;

/**
 * Default point size in scatter charts. Zero means no point.
 * This default assumes stroke size of 2 pixels, so the actual size is 9.
 */
export const DEFAULT_POINT_SIZE_FOR_SCATTER = 7;

/**
 * Default point size in line/area charts. Zero means no point.
 * This default assumes stroke size of 2 pixels, so the actual size is 8.
 */
export const DEFAULT_POINT_SIZE_FOR_LINE = 6;

/**
 * Default radius of a point's sensitivity area.
 */
export const DEFAULT_POINT_SENSITIVITY_AREA_RADIUS = 12;

/**
 * Default font size.
 */
export const DEFAULT_FONT_SIZE = 13;

/**
 * Alternative positions of minor gridlines (aka ticks).
 * Indexed by the number of minor gridlines.
 * Values are fractions of 10.
 */
export const DEFAULT_LOG_MINOR_TICK_ALTERNATIVES: number[][] = [
  [5],
  [2, 5],
  [2, 5],
  [2, 4, 6, 8],
  [2, 4, 6, 8],
  [2, 3, 4, 5, 6, 7],
  [2, 3, 4, 5, 6, 7, 8],
  [2, 3, 4, 5, 6, 7, 8, 9],
];

/**
 * A unit configuration for each date ticks unit.
 */
export const DEFAULT_DATE_TICKS_MAJOR = {
  'milliseconds': {
    'format': ['HH:mm:ss.SSS'], // No i18n for milliseconds.
    'interval': [1, 2, 5, 10, 20, 50, 100, 200, 500],
  },
  'seconds': {
    'format': [
      DateFormat.Format.LONG_TIME, // HH:mm:ss z
      DateFormat.Format.MEDIUM_TIME, // HH:mm:ss
    ],
    'interval': [1, 2, 5, 10, 15, 30],
  },
  'minutes': {
    'format': [
      DateFormat.Format.SHORT_TIME, // HH:mm
    ],
    'interval': [1, 2, 5, 10, 15, 30],
  },
  'hours': {
    'format': [
      DateFormat.Format.SHORT_TIME, // HH:mm
    ],
    'interval': [1, 2, 3, 4, 6, 12],
  },
  'days': {
    'format': [
      DateFormat.Format.LONG_DATE,
      DateFormat.Format.MEDIUM_DATE,
      DateFormat.Format.SHORT_DATE,
      DateFormat.Patterns.MONTH_DAY_YEAR_MEDIUM,
      DateFormat.Patterns.MONTH_DAY_FULL,
      DateFormat.Patterns.MONTH_DAY_MEDIUM,
      DateFormat.Patterns.MONTH_DAY_SHORT,
      DateFormat.Patterns.MONTH_DAY_ABBR,
      DateFormat.Patterns.DAY_ABBR,
    ],
    'interval': [1, 2, 7],
  },
  'months': {
    'format': [
      DateFormat.Patterns.YEAR_MONTH_FULL,
      DateFormat.Patterns.YEAR_MONTH_ABBR,
      'MMM',
    ],
    'interval': [1, 2, 3, 4, 6],
  },
  'years': {
    'format': [
      DateFormat.Patterns.YEAR_FULL, //'y'
    ],
    'interval': [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000],
  },
};

/**
 * A unit configuration for each timeofday ticks unit.
 */
export const DEFAULT_TIMEOFDAY_TICKS_MAJOR = {
  'milliseconds': {
    'format': ['ss.SSS', 'SSS'],
    'interval': [1, 2, 5, 10, 20, 50, 100, 200, 500],
  },
  'seconds': {
    'format': ['HH:mm:ss', 'ss.SSS'],
    'interval': [1, 2, 5, 10, 15, 30],
  },
  'minutes': {
    'format': ['HH:mm', 'mm'],
    'interval': [1, 2, 5, 10, 15, 30],
  },
  'hours': {
    'format': ['HH:mm', 'HH'],
    'interval': [1, 2, 3, 4, 6, 12],
  },
  'days': {
    'format': ['d'],
    'interval': [1, 2, 7],
  },
  'months': {
    'format': ['MM'],
    'interval': [1, 2, 3, 4, 6],
  },
  'years': {
    'format': ['y'],
    'interval': [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000],
  },
};

/**
 * A unit configuration for minor gridline date ticks.
 */
export const DEFAULT_DATE_TICKS_MINOR = {
  'milliseconds': {
    'format': ['.SSS'],
    'interval': [50, 100, 200, 250, 500],
  },
  'seconds': {
    'format': [':ss'],
    'interval': [5, 10, 15, 30],
  },
  'minutes': {
    'format': [':mm'],
    'interval': [5, 10, 15, 30],
  },
  'hours': {
    'format': [
      DateFormat.Format.SHORT_TIME, // HH:mm
    ],
    'interval': [1, 2, 3, 4, 6, 12],
  },
  'days': {
    'format': ['d'],
    'interval': [1, 2, 7],
  },
  'months': {
    'format': ['MMMMM', 'MMM', 'MM'],
    'interval': [1, 2, 3, 4, 6, 12],
  },
  'years': {
    'format': ['y'],
    'interval': [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000],
  },
};

/**
 * A unit configuration for minor gridline timeofday ticks.
 */
export const DEFAULT_TIMEOFDAY_TICKS_MINOR = {
  'milliseconds': {
    'format': ['.SSS'],
    'interval': [50, 100, 200, 500],
  },
  'seconds': {
    'format': [':ss'],
    'interval': [5, 10, 15, 30],
  },
  'minutes': {
    'format': [':mm'],
    'interval': [5, 10, 15, 30],
  },
  'hours': {
    'format': ['HH'],
    'interval': [1, 2, 3, 4, 6, 12],
  },
  'days': {
    'format': ['d'],
    'interval': [1, 2, 7],
  },
  'months': {
    'format': ['MM'],
    'interval': [1, 2, 3, 4, 6, 12],
  },
  'years': {
    'format': ['y'],
    'interval': [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000],
  },
};

/**
 * Holds the default axis options, shared by both hAxis and vAxis.
 */
export const DEFAULT_AXIS_OPTIONS = {
  'titleTextStyle': {'color': '#222222', 'italic': true},
  // maxPadding is only used for dates and times now.
  'viewWindow': {'maxPadding': '50%'},
  // TODO(dlaliberte): Tick text distances should be relative to font size.
  // @see HorizontalAxisDefiner.minTextSpacing
  'minTextSpacing': 10,
  'gridlines': {
    'baseline': 'auto',
    // Do NOT specify count or minSpacing here, so we can detect user options.
    // TODO(dlaliberte) Need a way to separate user options from defaults.
    // 'count': 5,
    // 'minSpacing': 40,
    'minorTextOpacity': 0.7,
    'minorGridlineOpacity': 0.4,
    // The following are only used for dates and times, at this time.
    'allowMinor': true,
    'minStrongLineDistance': 40,
    'minWeakLineDistance': 20,
    'minStrongToWeakLineDistance': 0,
    'minNotchDistance': 5,
    'minMajorTextDistance': 20,
    'minMinorTextDistance': 20,
    // Approximately the min number of major gridlines.
    // Less than 2 means we could end up with none, in rare cases.
    // Since we are rounding the units, we need somewhat more than 2.
    'unitThreshold': 2.2,
    'units': DEFAULT_DATE_TICKS_MAJOR,
  },
  'minorGridlines': {
    'count': 1,
    'units': DEFAULT_DATE_TICKS_MINOR,
  },
};

/**
 * Holds the default axis options for type category and categorypoint.
 */
export const DEFAULT_DISCRETE_AXIS_OPTIONS = {
  'type': 'category',
  'gridlines': {
    'color': 'none',
  },
  'baselineColor': 'none',
};

/**
 * A layer overriding DEFAULTS for specific chart types.
 */
export const CHART_SPECIFIC_DEFAULTS = {
  'histogram': {
    'bar': {'gap': 1, 'group': {'gap': 2}},
    'histogram': {
      'lastBucketPercentile': 0,
      'hideBucketItems': false,
      'bucketSize': null, // auto
      'numBucketsRule': 'rice',
      'minSpacing': 1,
    },
    'domainAxis': {
      //'viewWindowMode': 'maximized', // same as default
      // Using categorypoint doesn't work right yet due to default formatting.
      // 'type': 'categorypoint',
      'baselineColor': 'none',
      'gridlines': {'color': 'none'},
      'showTextEvery': 0, // auto
      'maxAlternation': 2,
    },
    'targetAxis': {
      'format': '#',
      'gridlines': {
        'multiple': 1,
      },
    },
  },
};

/**
 * Holds the default options.
 */
export const DEFAULTS = {
  'vAxis': DEFAULT_AXIS_OPTIONS,
  'hAxis': DEFAULT_AXIS_OPTIONS,
  'domainAxis': {
    // For the domain axis, we want a much smaller maxPadding,
    // especially for dates and times, but we can't distinguish data type yet.
    'maxPadding': '5%',
  },
  'sizeAxis': {'minSize': 5, 'maxSize': 30},
  'fontName': 'Arial',
  'titleTextStyle': {'color': '#000000', 'bold': true},
  'bubble': {'textStyle': {'color': '#000000'}},
  'candlestick': {
    'hollowIsRising': false,
  },
  'annotations': {
    'datum': {
      'textStyle': {'color': SeriesRelativeColor.COLOR},
      'stemColor': '#999999',
    },
    'domain': {
      'textStyle': {'color': '#222222'},
      'stemColor': '#999999',
    },
  },
  'majorAxisTextColor': '#222222',
  'minorAxisTextColor': '#444444',
  'backgroundColor': {'fill': '#fff', 'stroke': '#666666', 'strokeWidth': 0},
  'chartArea': {'backgroundColor': {'fill': 'none'}},
  'baselineColor': '#333333',
  'gridlineColor': '#cccccc',
  'pieSliceBorderColor': '#ffffff',
  'pieResidueSliceColor': '#cccccc',
  'pieSliceTextStyle': {'color': '#ffffff'},
  'areaOpacity': 0.3,
  'intervals': {
    'style': IntervalStyle.BARS,
    'color': SeriesRelativeColor.DARK,
    'lineWidth': DEFAULT_LINE_WIDTH / 2,
    'fillOpacity': 0.3,
    'barWidth': 0.25,
    'shortBarWidth': 0.1,
    'boxWidth': 0.25,
    'dataOpacity': 1.0,
    'pointSize': DEFAULT_POINT_SIZE_FOR_LINE,
  },
  'actionsMenu': {
    'textStyle': {'color': '#000000'},
    'disabledTextStyle': {'color': '#c0c0c0'},
  },
  'legend': {
    'newLegend': true,
    'textStyle': {'color': '#222222'},
    'pagingTextStyle': {'color': '#0011cc'},
    'scrollArrows': {
      'activeColor': '#0011cc',
      'inactiveColor': '#cccccc',
    },
  },
  'tooltip': {
    'textStyle': {'color': '#000000'},
    'boxStyle': {
      'stroke': '#cccccc',
      'strokeOpacity': 1,
      'strokeWidth': 1,
      'fill': 'white',
      'fillOpacity': 1,
      'shadow': {
        'radius': 2,
        'opacity': 0.1,
        'xOffset': 1,
        'yOffset': 1,
      },
    },
  },
  'aggregationTarget': AggregationTarget.AUTO,
  'colorAxis': {'legend': {'textStyle': {'color': '#000000'}}},
};
