/**
 * @fileoverview Types associated with chartDefinitionTypes.
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

import {Coordinate} from '@npm//@closure/math/coordinate';
import {Rect} from '@npm//@closure/math/rect';
import {Size} from '@npm//@closure/math/size';
import {Vec2} from '@npm//@closure/math/vec2';
import {
  CurveType,
  IntervalStyle,
  Orientation,
  SerieType,
} from '../../common/option_types';
import {CellRef} from '../../common/selection_object';
import {StandardColor} from '../../common/theme';
import {Value} from '../../data/types';
import {Brush} from '../../graphics/brush';
import {PathSegments} from '../../graphics/path_segments';
import {Expression} from '../../math/expression/expression';
import {TextBlock} from '../../text/text_block_object';
import {TextStyle} from '../../text/text_style';
import * as tooltipDefinition from '../../tooltip/tooltip_definition';

// tslint:disable:ban-types Migration

/**
 * ColorGroups
 */
export interface ColorGroups {
  [key: string]: {
    color: string;
    visibleInLegend: boolean;
    labelInLegend: string;
  };
}

/** Represents a reference to a single datum. */
export interface Datum {
  serie: number;
  category: number;
}

/** An enumeration of the supported stacking types. */
export enum StackingType {
  NONE = 'none',
  ABSOLUTE = 'absolute',
  RELATIVE = 'relative',
  PERCENT = 'percent',
}

/**
 * Datatable cell type.
 * Should probably be replaced by third_party/javascript/gviz/data/types Cell.
 */
export type CellType = AnyDuringMigration | {v: AnyDuringMigration; f: string};

/** An enumeration of all the supported point shape types. */
export enum PointShapeType {
  CIRCLE = 'circle',
  TRIANGLE = 'triangle',
  SQUARE = 'square',
  DIAMOND = 'diamond',
  POLYGON = 'polygon',
  STAR = 'star',
}

/** A simple shape with a name (circle, triangle, square, diamond). */
export interface NamedPointShape {
  type: PointShapeType;
  rotation: number | undefined;
}

/** A shape that has a configurable number of sides (polygon). */
export interface SidedPointShape {
  type: PointShapeType;
  rotation: number | undefined;
  sides: number;
}

/**
 * A shape that has a configurable number of sides as well as an inset amount
 * (star).
 */
export interface SidedPointShapeWithInset {
  type: PointShapeType;
  rotation: number | undefined;
  sides: number | undefined;
  inset: number;
}

/** Represents a point shape. */
export type PointShape =
  | NamedPointShape
  | SidedPointShape
  | SidedPointShapeWithInset;

/**
 * This structure defines the settings used for rendering columns with
 * role='interval'. See the description of getIntervalDefinitions_ in
 * axis-chart-definer.js for more details.
 */
export interface IntervalSettings {
  style: IntervalStyle;
  brush: Brush;
  barWidth: number;
  shortBarWidth: number;
  boxWidth: number;
  pointSize: number;
  interpolateNulls: boolean;
  curveType: CurveType;
  smoothingFactor: number;
}

/** IntervalPath */
export interface IntervalPath {
  columnIndex: number;
  brush: Brush;
  style: IntervalStyle;
  line: Array<{x: number; y: number}>;
  controlPoints: Array<Array<{x: number; y: number}>>;
  bottom: Array<{x: number; y: number}> | null;
  bottomControlPoints: Array<Array<{x: number; y: number}>> | null;
}

/**
 * This structure represents the intervals that are associated with a
 * chart definition.
 */
export interface Intervals {
  bars: number[];
  sticks: number[];
  boxes: number[];
  points: number[];
  areas: number[];
  lines: number[];
  settings: {[key: number]: IntervalSettings};
  paths: IntervalPath[] | null;
}

/** Defines a single legend entry. */
export interface LegendEntry {
  id: number | string;
  text: string | Expression;
  brush: Brush;
  index: number;
  isVisible: boolean;
}

/**
 * Defines the bar group division for one domain axis value.
 * A division is composed of a set of side-by-side subdivisions,
 * each of which is a bar and a gap between bars.
 * Included in this definition is the pixel offset of the bar group
 * relative to the coordinate of the data value on the axis.
 */
export interface DivisionDefinition {
  numSubdivisions: number;
  divisionWidth: number;
  divisionGap: number;
  subdivisionWidth: number;
  subdivisionGap: number;
  divisionOffsetFromTick: number;
  roundingFunction: (p1: number) => number;
  variableWidth?: boolean;
}

/**
 * Defines a datum.
 * Note: Order seems to matter; this must be before SerieDefinition
 */
export interface DatumDefinition {
  brush: Brush | null;
  barBrush: Brush;
  lineBrush: Brush;
  incomingAreaBrush: Brush | null;
  incomingLineBrush: Brush | null;
  id: string;
  isNull: boolean;
  shape: PointShape;
  leftControlPoint: ScaledDatumDefinition | null;
  nonScaled: NonScaledDatumDefinition;
  pointBrush: Brush;
  rightControlPoint: ScaledDatumDefinition | null;
  scaled: ScaledDatumDefinition | null;
  scope?: boolean;
  emphasis?: number;
  certainty?: number;
  text: string;
  textLength: number;
  textStyle: TextStyle | null;
  tooltip: tooltipDefinition.TooltipDefinition | null;
  tooltipText: TooltipText | null;
  isDiffForeground: boolean | undefined;
  annotation: Annotation | null;
  ring: undefined | RingDefinition;
  glow: undefined | GlowDefinition;
  crosshair: CrosshairDefinition | null;
  visible: undefined | boolean;
  radius: number | undefined;
  sensitivityAreaRadius: number | undefined;
}

/** See ringDatum_ in axis-chart-interactivity-definer. */
export interface RingDefinition {
  brush: Brush;
  radius: number;
  radiusX: number;
  radiusY: number;
  x: number;
  y: number;
  rect: Rect;
  path: PathSegments;
}

/**
 * See glowDatum_ in axis-chart-interactivity-definer.
 * Also, confusingly, includes props for PieChart glow, also known as a ring.
 */
export interface GlowDefinition {
  x: number;
  y: number;
  levels: Array<{
    brush: Brush;
    rect?: Rect;
    radius?: number;
    path?: PathSegments;
  }>;
  fromPixel: Coordinate;
  toPixel: Coordinate;
  drawInnerFrom: boolean;
  drawInnerTo: boolean;
  fromDegrees: number;
  toDegrees: number;
  brush: Brush;
  innerBrush: Brush;
  tip: Coordinate;
  isWholeCircle: boolean;
  radiusX: number;
  radiusY: number;
  side3D: PixelTransformation;
  radians: number;
  innerClose: Vec2;
  innerFar: Vec2;
}

/** See something in axis-chart-interactivity-definer. */
export interface CrosshairDefinition {
  brush: Brush;
  path: PathSegments;
  x: number;
  y: number;
}

/** A PixelTransformation type. */
export interface PixelTransformation {
  fromPixel: Coordinate;
  toPixel: Coordinate;
  innerToPixel: Vec2;
  innerFromPixel: Vec2;
  fromDegrees: number;
  toDegrees: number;
  brush: Brush;
  tip: Coordinate;
  radiusX: number;
  radiusY: number;
}

/**
 * Defines a serie.
 * Includes properties specifically for PieChart, starting with side3D.
 * extraPoints is for interpolation/animation.
 */
export interface SerieDefinition {
  brush: Brush | null;
  brushes: BrushesDefinition | null;
  areaBrush: Brush | null;
  lineBrush: Brush | null;
  candlestick: {risingBrush: Brush; fallingBrush: Brush} | null;
  boxplot: {boxColor: Brush} | null;
  columns: {[key: string]: number[]};
  color: StandardColor | null;
  colorOpacity: number | undefined;
  colorGroups: ColorGroups | undefined;
  orderedColorGroups: string[] | undefined;
  controlPoints: AnyDuringMigration[] | undefined;
  curveType: CurveType;
  data: AnyDuringMigration[] | undefined;
  dataTableIdx: number;
  dataType: string;
  domainIndex: number | null;
  drawInnerFrom: boolean;
  drawInnerTo: boolean;
  enableInteractivity: boolean;
  fromDegrees: number;
  grayAreaBrush: Brush;
  grayLineBrush: Brush;
  grayPointBrush: Brush;
  id: string;
  incomingAreaBrush: Brush;
  innerBrush: Brush;
  interpolateNulls: boolean;
  isClosed: boolean;
  isCurved: boolean | undefined;
  isWholeCircle: boolean;
  isVirtual: boolean | undefined;
  diff: {background: {pointBrush: Brush}} | null;
  labelInLegend: string;
  lineWidth: number;
  offset: {x: number; y: number};
  pointShape: PointShape;
  originalSeries: number | undefined;
  trendlineIndex: number | undefined;
  points: Array<DatumDefinition | null>;
  pointBrush: Brush;
  pointRadius: number;
  pointSensitivityAreaRadius: number;
  properties: AnyDuringMigration;
  showTooltip: boolean;
  smoothingFactor: number;
  sortBySize: boolean;
  targetAxisIndex: number;
  title: string | undefined;
  toDegrees: number;
  tooltip: tooltipDefinition.TooltipDefinition | null;
  tooltipText: TooltipText;
  type: SerieType;
  visibleInLegend: boolean;
  visiblePoints: boolean;
  zOrder: number;
  intervals: Intervals | null;
  glow: GlowDefinition | null;
  ring: RingDefinition | null;
  side3D: PixelTransformation | null;
  fromPixel: Vec2;
  toPixel: Vec2;
  innerRadiusX: number;
  innerRadiusY: number;
  innerToPixel: Vec2;
  innerFromPixel: Vec2;
  value: number;
  formattedValue: string;
  index: number;
  percentage: string;
  isVisible: boolean | undefined;
  isTextVisible: boolean;
  text: string;
  textBoxTopLeft: Vec2;
  textBoxSize: Size;
  textStyle: TextStyle;
  extraPoints: Array<DatumDefinition | null> | null;
  stepped: boolean;
}

/** Defines a category. */
export interface CategoryDefinition {
  data: Value;
  titles: string[];
  dataTableIdx: number;
  tooltip: tooltipDefinition.TooltipDefinition | null;
  tooltipText: TooltipText | null;
  annotation: Annotation | null;
}

/**
 * The text within a tooltip, structured as following:
 * hasHtmlContent: Whether tooltip text should be interpreted as HTML text or as
 *     plain text.
 * hasCustomContent: Whether custom tooltip text is specified in a tooltip
 *     column.
 * content: If custom content is specified in a tooltip column, this is the
 *     entire tooltip text (serieTitle and categoryTitle are undefined).
 *     Otherwise, it is the formatted data value.
 * categoryTitle: The title of the category. Only present if custom content is
 *     specified in a tooltip column.
 * serieTitle: The title of the serie. Only present if custom content is
 *     specified in a tooltip column.
 * title: A string used with lines.
 * lines: An array of objects with title and value strings.
 */
export interface TooltipText {
  hasHtmlContent: boolean | undefined;
  hasCustomContent: boolean;
  content: string | null;
  categoryTitle: string | undefined;
  serieTitle: string | undefined;
  title: string | undefined | null;
  lines: Array<{title: string; value: string}> | undefined | null;
  customCalcFunction?: (
    // Should be ChartDefinition, but that creates a circular dependency.
    chartDefinition: AnyDuringMigration,
    seriesIndex: number,
    categoryIndex: number,
  ) => string;
}

/**
 * The aggregate object which contains all the aggregated data that is ready to
 * be processed.
 * TODO(dlaliberte): Document the behavior of this data structure.
 */
export interface Aggregate {
  index: {[key: string]: Datum[]};
  order: string[];
  titles: {[key: string]: number | string};
}

/** Defines a nonscaled datum. */
export interface NonScaledDatumDefinition {
  bottomFromD: number;
  bottomFromT: number;
  bottomToD: number;
  bottomToT: number;
  color: string | number;
  continueFromD: number;
  continueFromT: number;
  continueToD: number;
  continueToT: number;
  d: number;
  dPrevious: number | null;
  division: number;
  from: number;
  intervalMarks: IntervalMark[];
  inverted: boolean;
  lineFrom: number;
  lineTo: number;
  previousTo?: number | null;
  rectFrom: number;
  rectTo: number;
  rectMiddleLine: number;
  size: number;
  subdivision: number;
  t: number;
  to: number;
  x: number;
  y: number;
  isDiffForeground?: boolean;
}

/** Defines a scaled datum. */
export interface ScaledDatumDefinition {
  bar: Rect;
  bottomFromX: number;
  bottomFromY: number;
  bottomToX: number;
  bottomToY: number;
  brush: Brush | null;
  continueFromX: number;
  continueFromY: number;
  continueToX: number;
  continueToY: number;
  height: number;
  left: number;
  outline: Array<{x: number; y: number}> | undefined;
  line: Rect | null;
  rect: Rect;
  bottomRect: Rect;
  topRect: Rect;
  top: number;
  width: number;
  x: number;
  y: number;
  intervalRects: Array<{rect: Rect; columnIndex: number}>;
  radius: number | undefined;
  sensitivityAreaRadius: number | undefined;
}

/** Defines an interval mark. */
export interface IntervalMark {
  columnIndex: number;
  lowT: number;
  highT: number;
  spanD: number;
  brush: Brush;
}

/**
 * Holds information relevant for pie charts.
 *     radiusX, radiusY: The radius of the circle (in 2D) or ellipse (in 3D).
 *     center: The center point of the circle/ellipse.
 *     pieHeight: The 3D height (or thickness) of the pie.
 *     layers: Array with layers of slices, each containing:
 *       radiusX, radiusY: The radius of the circle (in 2D) or ellipse (in 3D)
 *                         for this layer.
 *       otherSlice: The 'other' slice (same format as a normal slice in the
 *                 series array).
 */
export interface PieParams {
  radiusX: number;
  radiusY: number;
  center: Vec2;
  pieHeight: number;
  layers: Array<{
    radiusX: number;
    radiusY: number;
    otherSlice: SerieDefinition;
  }>;
}

/**
 * TODO(dlaliberte): tooltipText should be chartDefinitionTypes.TooltipText
 *     But a circular dependency would result, so we need to move all types
 *     to a new canviz-types file, and change all requires/imports accordingly.
 */
export interface Annotation {
  stem: {
    x: number;
    y: number;
    length: number;
    orientation: Orientation;
    color: string;
  };
  labels: TextBlock[];
  bundle: AnnotationBundle | null;
  tooltipText: TooltipText | null;
}

/** Defines an annotation bundle. */
export interface AnnotationBundle {
  isExpanded: boolean;
  label: TextBlock;
}

/** Defines a single brush. */
export interface BrushesDefinition {
  normal: Brush;
  dark: Brush;
  light: Brush;
}

export {type CellRef};
