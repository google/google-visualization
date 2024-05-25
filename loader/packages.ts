/**
 * @fileoverview A map from visualization class name to package name.
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
 * A map from visualization class name to package name.
 *
 */
export const CHART_TYPE_MAP = {
  // Nightingale Charts
  'Bar': 'bar',
  'Line': 'line',
  'Scatter': 'scatter',

  // Charts
  'AnnotatedTimeLine': 'annotatedtimeline',
  'AnnotationChart': 'annotationchart',
  'AreaChart': 'corechart',
  'BarChart': 'corechart',
  'BoxplotChart': 'corechart',
  'BubbleChart': 'corechart',
  'Calendar': 'calendar',
  'CandlestickChart': 'corechart',
  'ClusterChart': 'clusterchart',
  'ColumnChart': 'corechart',
  'ComboChart': 'corechart',
  'Gantt': 'gantt',
  'Gauge': 'gauge',
  'GeoChart': 'geochart',
  'GeoMap': 'geomap',
  'Histogram': 'corechart',
  'ImageAreaChart': 'imagechart',
  'ImageBarChart': 'imagechart',
  'ImageCandlestickChart': 'imagechart',
  'ImageChart': 'imagechart',
  'ImageLineChart': 'imagechart',
  'ImagePieChart': 'imagechart',
  'ImageSparkLine': 'imagechart',
  'LineChart': 'corechart',
  'Map': 'map',
  'MotionChart': 'motionchart',
  'OrgChart': 'orgchart',
  'PieChart': 'corechart',
  'RangeSelector': 'corechart',
  'Sankey': 'sankey',
  'ScatterChart': 'corechart',
  'SparklineChart': 'corechart',
  'SteppedAreaChart': 'corechart',
  'Table': 'table',
  'Timeline': 'timeline',
  'TreeMap': 'treemap',
  'VegaChart': 'vegachart',
  'WordTree': 'wordtree',
  // Controls
  'StringFilter': 'controls',
  'DateRangeFilter': 'controls',
  'NumberRangeFilter': 'controls',
  'CategoryFilter': 'controls',
  'ChartRangeFilter': 'controls',
  'NumberRangeSetter': 'controls',
  'ColumnSelector': 'controls',

  // Dashboard
  'Dashboard': 'controls',
};

type ChartTypeName = keyof typeof CHART_TYPE_MAP;

/**
 * @param type The visualization class name.
 * @return true if the visualization class is a corechart.
 */
export function isValidChartType(type: string): type is ChartTypeName {
  // tslint:disable-next-line:ban-unsafe-reflection
  return type in CHART_TYPE_MAP;
}

/**
 * @param type The visualization class name.
 * @return true if the visualization class is a corechart.
 */
export function isCoreChart(type: string): boolean {
  return getPackage(type) === 'corechart';
}

/**
 * @param type The visualization class name.
 * @return The package you need to load, or null if not a valid class name.
 */
export function getPackage(type: string): string | null {
  // tslint:disable-next-line:no-dict-access-on-struct-type
  return isValidChartType(type) ? CHART_TYPE_MAP[type] : null;
}
