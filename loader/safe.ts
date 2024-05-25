/**
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

const allowedVisualizations = new Set([
  'google.charts.Bar',
  'google.charts.Line',
  'google.charts.Scatter',
  'google.visualization.AnnotatedTimeLine',
  'google.visualization.AnnotationChart',
  'google.visualization.AreaChart',
  'google.visualization.BarChart',
  'google.visualization.BoxplotChart',
  'google.visualization.BubbleChart',
  'google.visualization.Bubbles',
  'google.visualization.CandlestickChart',
  'google.visualization.CategoryFilter',
  'google.visualization.ChartRangeFilter',
  'google.visualization.ChartRangeFilterUi',
  'google.visualization.Circles',
  'google.visualization.ClusterChart',
  'google.visualization.ColumnChart',
  'google.visualization.ColumnSelector',
  'google.visualization.ComboChart',
  'google.visualization.CoreChart',
  'google.visualization.Dashboard',
  'google.visualization.DateRangeFilter',
  'google.visualization.DateRangeFilterUi',
  'google.visualization.Filter',
  'google.visualization.Gantt',
  'google.visualization.Gauge',
  'google.visualization.GeoChart',
  'google.visualization.GeoMap',
  'google.visualization.HeadlessUi',
  'google.visualization.HelloWorld',
  'google.visualization.Histogram',
  'google.visualization.ImageAreaChart',
  'google.visualization.ImageBarChart',
  'google.visualization.ImageCandlestickChart',
  'google.visualization.ImageChart',
  'google.visualization.ImageLineChart',
  'google.visualization.ImagePieChart',
  'google.visualization.ImageSparkLine',
  'google.visualization.LineChart',
  'google.visualization.Map',
  'google.visualization.Matrix',
  'google.visualization.MotionChart',
  'google.visualization.NumberRangeFilter',
  'google.visualization.NumberRangeSetter',
  'google.visualization.NumberRangeUi',
  'google.visualization.Operator',
  'google.visualization.OrgChart',
  'google.visualization.PieChart',
  'google.visualization.RangeSelector',
  'google.visualization.Sankey',
  'google.visualization.ScatterChart',
  'google.visualization.SelectorUi',
  'google.visualization.SparklineChart',
  'google.visualization.SteppedAreaChart',
  'google.visualization.Streamgraph',
  'google.visualization.StringFilter',
  'google.visualization.StringFilterUi',
  'google.visualization.Sunburst',
  'google.visualization.Table',
  'google.visualization.TableTextChart',
  'google.visualization.Timeline',
  'google.visualization.TreeMap',
  'google.visualization.VegaChart',
  'google.visualization.WordcloudChart',
  'google.visualization.WordTree',
]);

/**
 * Checks the given visualization type against the allowed names and returns
 * it if is allowed. The empty string is returned if the vizType is not allowed
 */
export function safenUpType(vizType: string): string {
  vizType = String(vizType);
  const variants = [
    `google.visualization.${vizType}`,
    `google.charts.${vizType}`,
    vizType,
  ];

  if (variants.some((variant) => allowedVisualizations.has(variant))) {
    return vizType;
  }

  return '';
}

/**
 * Allows a visualization to be resolved in a test.
 */
function allowVisualizationForTests(vizType: string) {
  allowedVisualizations.add(vizType);
}

export const TEST_ONLY = goog.DEBUG ? {allowVisualizationForTests} : {};
