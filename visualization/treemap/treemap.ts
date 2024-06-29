/**
 * @fileoverview An html table visualization.
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

import * as googArray from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import * as googColor from '@npm//@closure/color/color';
import {dispose} from '@npm//@closure/disposable/dispose';
import {getDomHelper} from '@npm//@closure/dom/dom';
import {TagName} from '@npm//@closure/dom/tagname';
import * as events from '@npm//@closure/events/events';
import {clamp} from '@npm//@closure/math/math';
import {Rect} from '@npm//@closure/math/rect';
import {Size} from '@npm//@closure/math/size';
import {clone} from '@npm//@closure/object/object';
import * as style from '@npm//@closure/style/style';
import {Tooltip} from '@npm//@closure/ui/tooltip';
import {
  createHtml,
  htmlEscape,
} from '@npm//@safevalues';
import {AnyCallbackWrapper} from '../../common/async_helper';
import {Options, UserOptions} from '../../common/options';
import {Selection} from '../../common/selection';
import {SelectionObject} from '../../common/selection_object';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {DataView} from '../../data/dataview';
import * as utilDom from '../../dom/dom';
import {ChartEventType} from '../../events/chart_event_types';
import * as gvizEvents from '../../events/events';
import {BrowserRenderer} from '../../graphics/browser_renderer';
import {Brush, Gradient} from '../../graphics/brush';
import {DrawingFrame} from '../../graphics/drawing_frame';
import {DrawingGroup} from '../../graphics/drawing_group';
import {PathSegments} from '../../graphics/path_segments';
import {getSafeHtml} from '../../loader/dynamic_loading';
import {TextAlign} from '../../text/text_align';
import {TextMeasureFunction} from '../../text/text_measure_function';
import {TextStyle} from '../../text/text_style';
import {calcTextLayout} from '../../text/text_utils';
import {DataNodeImpl} from '../../tree/data_node_impl';
import {DataTree} from '../../tree/data_tree';
import {NodeBase} from '../../tree/node_base';
import {NodeId} from '../../tree/nodeid';
import {NodeFactory, ProjectedTree} from '../../tree/projected_tree';
import {Tree} from '../../tree/tree';
import {averageNoOverride, sumNoOverride} from '../../tree/tree_aggregation';
import {AbstractVisualization} from '../abstract_visualization';

import {
  DRILL_DOWN,
  EventsConfig,
  HIGHLIGHT,
  MOUSEOUT,
  MOUSEOVER,
  ROLL_UP,
  TreeMapEventsHandler,
  UNHIGHLIGHT,
} from './treemap_events_handler';

const {SVG} = TagName;
const {MOUSE_OUT, MOUSE_OVER, READY, SELECT} = ChartEventType;

/**
 * The size of the triangle marker.
 */
const TRIANGLE_SIZE = 5;

// Tooltip function that works for TreeMap, though not all visualizations.
type TooltipFunc = (row: number, size: number, color: number | null) => string;

/**
 * Defines a TreeMap visualization.
 * Expected data format:
 *   Every row contains information about a single node.
 *   A node has:
 *    Column 0 {string}: a name,
 *    Column 1 {string}: a parent name (value of the name),
 *    Column 2 {number}: a primary size (any number) if a leaf.
 *    Column 3 {number}: a secondary color (any number) if a leaf.
 *  Columns 2 and 3 will be ignored for non-leaf nodes.
 * Supported options (See the draw() method):
 *   title {string}: The string to show as a title for the treemap.
 *   titleTextStyle {!TextStyle}: The text style to use
 *     for the title. Will default to values in the normal textStyle.
 *   textStyle {!TextStyle}: The text style to use
 *     for the text. Will default to using the old values as follows:
 *       textStyle.color = fontColor
 *       textStyle.fontName = fontFamily
 *       textStyle.fontSize = fontSize
 *   mouseOverTextStyle {!TextStyle}: The text style to use
 *     for the moused over text.
 *     Will default to using the old values as follows:
 *       mouseOverTextStyle.color = fontMouseOverColor
 *       mouseOverTextStyle.fontName = fontFamily or textStyle.fontFamily
 *       mouseOverTextStyle.fontSize = fontSize or textStyle.fontSize
 *   highlightOnMouseOver {boolean}: Deprecated. Please use enableHighlight.
 *     Whether or not we should highlight on mouse over.
 *   enableHighlight {boolean}: Whether or not we highlight nodes.
 *   borderOnMouseOver {boolean}: Whether or not we should show a border on
 *     mouse over.
 *   borderColor {string}: hex representation of the
 *     border color (ex: "#ffffff").
 *   borderMouseOverColor {string}: hex representation of the
 *     moused-over border color (ex: "#000000").
 *     This color is shown for borders on mouseover.
 *   borderMouseOverSizes {!Array<number>}: Size of blurring layers to apply.
 *   borderMouseOverOpacities {!Array<number>}: Opacities of blurring layers.
 *     The length of this array should be the same size as
 *     borderMouseOverSizes.
 *   showScale {boolean}: True to show the scale.
 *   scale.showText {boolean}: Whether to show labels on the color-bar scale.
 *   scale.textStyle {!gviz.graphics.TextStyle}: The text style to use for
 *     the labels on the color-bar scale (if enabled).
 *   maxDepth {number}: the maximum depth to show.
 *   maxPostDepth {number}: the maximum shadow depth to show after the maxDepth.
 *   hintOpacity {number}: the opacity to use when showing hinted nodes (those
 *     below the current depth that are shown due to maxPostDepth.)
 *   useWeightedAverageForAggregation {boolean}: True to use weighted averages
 *     instead of strict averages when generating color values for aggregate
 *     (non leaf) nodes.
 *   showTooltips {boolean}: True if you want the tooltips to be drawn.
 *   tooltipStyleString {string}: If set, will use the given string
 *     as the "style" string for the tooltip.
 *     (ex: 'background:infobackground; color: infotext;
 *           padding: 1px; border: 1px solid infotext;')
 *     Note: this will be superseded by the tooltipClass option if it
 *     is present.
 *   tooltipClass {string}: If set, will use the given string as the class
 *     attribute that the tooltip uses to render its div.
 *   generateTooltip {function({number}, {number}, {number)})}:
 *     Function to call when a generating tooltip html.
 *     The first argument is the row of the element to show the tooltip for.
 *     The second argument is a number representing the computed "size" value.
 *     The third argument is a number representing the computed "color" value.
 *     This value can be null if the color is undefined.
 *     This function should return a string representing the html to put into
 *     the tooltip.
 *   fontColor {string}: hex representation of the font color (ex: "#222222").
 *     This color is shown for text.
 *     DEPRECATED in favor of textStyle.
 *   fontMouseOverColor {string}: hex representation of the
 *     moused-over font color (ex: "#000000").
 *     This color is shown for text on mouseover.
 *     DEPRECATED in favor of textStyle.
 *   fontSize {number}: font size for the text to be shown.
 *     DEPRECATED in favor of textStyle.
 *   fontFamily {string}: font for the text to be shown (default=Arial).
 *     DEPRECATED in favor of textStyle.
 *   noColor {string}:
 *     hex representation of the "no" color (ex: "#000000").
 *     This is shown when the secondary value of a node is not defined and
 *     that node is a leaf (or contains only leaves).
 *   minColor {string}: hex representation of the minimum color (ex: "#ff0000").
 *     This color is shown when the secondary value is closer to 0.0. Ignored
 *     when rotatingHue is true.
 *   midColor {string}: hex representation of the median color (ex: "#ffff00").
 *     This color is shown when the secondary value is closer to 0.5. Ignored
 *     when rotatingHue is true.
 *   maxColor {string}: hex representation of the minimum color (ex: "#0000ff").
 *     This color is shown when the secondary value is closer to 1.0. Ignored
 *     when rotatingHue is true.
 *   rotatingHue {boolean}: If true, assign a different hue to each branch of
 *     the tree and use saturation and lightness to indicate the secondary
 *     value.
 *   hueStep {number}: The step (in degrees) in hue to use between each branch
 *     of the tree.
 *   minSaturation {number}: The saturation to use for minimum values with
 *     rotatingHue.
 *   midSaturation {number}: The saturation to use for middle values with
 *     rotatingHue.
 *   maxSaturation {number}: The saturation to use for maximum values with
 *     rotatingHue.
 *   headerSaturation {number}: The saturation to user for header values with
 *     rotatingHue.
 *   noSaturation {number}: The saturation value of the "no" color with
 *     rotatingHue.
 *   minLightness {number}: The lightness to use for minimum values with
 *     rotatingHue.
 *   midLightness {number}: The lightness to use for middle values with
 *     rotatingHue.
 *   maxLightness {number}: The lightness to use for maximum values with
 *     rotatingHue.
 *   noLightness {number}: The lightness of the "no" color with RotatingHue.
 *   headerColor {string}:
 *     hex representation of the header color.
 *   noHighlightColor {string}:
 *     hex representation of the highlighted "no" color.
 *     If empty, this value will be the value of noColor lightened by 35%.
 *   minHighlightColor {string}:
 *     hex representation of the highlighted minimum color.
 *     If empty, this value will be the value of minColor lightened by 35%.
 *   midHighlightColor {string}:
 *     hex representation of the highlighted median color.
 *     If empty, this value will be the value of midColor lightened by 35%.
 *   maxHighlightColor {string}:
 *     hex representation of the highlighted minimum color.
 *     If empty, this value will be the value of maxColor lightened by 35%.
 *   headerHighlightColor {string}:
 *     hex representation of the highlighted header color.
 *     If empty, this value will be the value of headerColor lightened by 35%.
 *   headerHeight {number}:
 *     The size of the headers (can be zero).
 *   minColorValue {number}:
 *     The minimum expected value.
 *     If not specified, will take the data's min value.
 *     If a node's secondary value is less than the minColorValue, then it will
 *     be clamped to the minColorValue.
 *   maxColorValue {number}:
 *     The maximum expected value.
 *     If not specified, will take the data's max value.
 *     If a node's secondary value is greater than the maxColorValue, then
 *     it will be clamped to the maxColorValue.
 *   residualNode {string}:
 *     If specified, the name of a node that will always be drawn in the lower-
 *     right corner of its parent box.
 *   eventsConfig {EventsConfig}: If specified, will configure the events
 *     to trigger treemap behaviors. See {@code EventsConfig}.
 */

export class TreeMap extends AbstractVisualization {
  /**
   * The selected row. The key is the selected row index, and
   * the value is just set to a truth value, i.e., 1.
   */
  selectedRow = new Selection();

  /**
   * A graphics object for drawing the squares.
   */
  renderer?: BrowserRenderer | null = null;

  canvas: DrawingGroup | null = null;

  /**
   * Representation of the current viewable treemap-object.
   */
  tree?: Tree | null = null;

  /**
   * Representation of the tree of the data objects.
   */
  dataTree?: DataTree | null = null;

  /**
   * Node in the tree that is currently displayed.
   */
  shown: TreeNode | null = null;

  /**
   * The title to show.
   */
  title = '';

  /**
   * The TextStyle to use for the title.
   */
  titleTextStyle: TextStyle | null = null;

  /**
   * The TextStyle to use for the text.
   */
  textStyle: TextStyle | null = null;

  /**
   * The TextStyle to use for the mouse over text.
   */
  mouseOverTextStyle: TextStyle | null = null;

  /**
   * Show the scale
   */
  showScale = false;

  /**
   * Show text labels on the color bar scale.
   */
  showScaleText = false;

  /**
   * The TextStyle to use for the text labels on the color bar scale (if
   * enabled).
   */
  scaleTextStyle: TextStyle | null = null;

  /**
   * Show the tooltips
   */
  showTooltips = true;

  /**
   * The object containing key:value pairs to use as the tooltip style.
   */
  tooltipStyleObj: {[key: string]: string} | null = null;

  /**
   * Represents the class name to use for the tooltip div.
   */
  tooltipClass = '';

  /**
   * Current depth shown.
   */
  maxDepth = 1;

  /**
   * Current depth shown.
   */
  maxPostDepth = 1;
  /**
   * Opacity used when drawing "hinted" nodes (those below the current depth
   * that are shown due to maxPostDepth.)
   */
  hintOpacity = 0.5;

  /**
   * Maximum depth of the current tree object.
   */
  maxPossibleDepth = 0;

  /**
   * Should we use weighted averages for aggregation?
   */
  useWeightedAverageForAggregation = false;

  /**
   * Size of the headers (folder elements) to display.
   */
  header = 0;

  /**
   * The color to display for the border.
   */
  borderColor = '';

  /**
   * The color to display for the border on mouseover.
   */
  borderMouseOverColor = '';

  /**
   * Size of blurring layers. These are additional pixels around an item.
   */
  borderMouseOverSizes: number[] | null = null;

  /**
   * Opacities of blurring layers. Note that the corresponding sizes may
   * be overlapping, ie; if the sizes are [4, 2] and the opacities are [0.2,
   * 0.4], the opacity of the second part of the border will have the first
   * part of the border blended in.
   */
  borderMouseOverOpacities: number[] | null = null;

  /**
   * The color to display for text.
   */
  fontColor = '';

  /**
   * The color to display for text on mouseover.
   */
  fontMouseOverColor = '';

  /**
   * The text font size.
   */
  fontSize = 0;

  /**
   * The text font family.
   */
  fontFamily = '';

  /**
   * The color to display for undefined values.
   */
  undefinedColor = '';

  /**
   * The color to display for minimum values.
   */
  minColor = '';

  /**
   * The color to display for middle values.
   */
  midColor = '';

  /**
   * The color to display for maximum values.
   */
  maxColor = '';

  /**
   * The color to display for headers.
   */
  headerColor = '';
  /**
   * The color to display for highlighted undefined values.
   * If empty this value will be the value of the undefinedColor lightened by
   * 35%.
   */
  undefinedHighlightColor = '';

  /**
   * The color to display for highlighted minimum values.
   * If empty this value will be the value of the minColor lightened by 35%.
   */
  minHighlightColor = '';

  /**
   * The color to display for highlighted middle values.
   * If empty this value will be the value of the midColor lightened by 35%.
   */
  midHighlightColor = '';

  /**
   * The color to display for highlighted maximum values.
   * If empty this value will be the value of the maxColor lightened by 35%.
   */
  maxHighlightColor = '';

  /**
   * The color to display for highlighted headers.
   * If empty this value will be the value of the headerColor lightened by
   * 35%.
   */
  headerHighlightColor = '';

  /**
   * If true, use rotating hue instead of specified color values for secondary
   * value.
   */
  rotatingHue = false;

  /**
   * The hue step between branches at the top level of the tree.
   * If empty this value will be 30 / phi (The golden ratio).
   * to minimize repetition of hues. Hues will cycle in the range [0, 360)
   */
  hueStep = 60 / (1 + Math.sqrt(5));

  /**
   * The saturation to use for minimum values with rotatingHue. Should be in
   * the range [-1, 1].
   */
  minSaturation = 0;

  /**
   * The saturation to use for middle values with rotatingHue. Should be in
   * the range [-1, 1].
   */
  midSaturation = 0.5;

  /**
   * The saturation to use for maximum values with rotatingHue. Should be in
   * the range [-1, 1].
   */
  maxSaturation = 1;

  /**
   * The saturation to use for header values with rotatingHue. Should be in
   * the range [-1, 1]. If this or headerLightness are unspecified, then the
   * average value of the branch under the header will be used.
   */
  headerSaturation: number | null = null;

  /**
   * The saturation to use for undefined values with rotatingHue. Should be in
   * the range [-1, 1]. If this or undefinedLightness are unspecified, then
   * undefindColor will be used instead.
   */
  undefinedSaturation: number | null = null;

  /**
   * The lightness to use for minimum values with rotatingHue. Should be in
   * the range [0, 1].
   */
  minLightness = 1;

  /**
   * The lightness to use for middle values with rotatingHue. Should be in the
   * range [0, 1].
   */
  midLightness = 0.75;

  /**
   * The lightness to use for maximum values with rotatingHue. Should be in
   * the range [0, 1].
   */
  maxLightness = 0.5;

  /**
   * The lightness to use for header values with rotatingHue. Should be in the
   * range [0, 1]. If this or headerSaturation are unspecified, then the
   * average value of the branch under the header will be used.
   */
  headerLightness: number | null = null;

  /**
   * The lightness to use for undefined values with rotatingHue. Should be in
   * the range [-1, 1]. If this or undefinedSaturation are unspecified, then
   * undefindColor will be used instead.
   */
  undefinedLightness: number | null = null;

  /**
   * Minimum expected value.
   */
  minColorValue: number | null = null;

  /**
   * Maximum expected value.
   */
  maxColorValue: number | null = null;

  /**
   * The maximum color value in the data.
   */
  maxDataValue = Number.MAX_VALUE * -1;

  /**
   * The minimum color value in the data.
   */
  minDataValue = Number.MAX_VALUE;

  /**
   * The datatable over which to draw this treemap.
   */
  dataTable: AbstractDataTable | null = null;

  /**
   * The options.
   */
  options: Options | null = null;

  /**
   * Our drawing frame creator.
   */
  drawingFrame?: DrawingFrame | null = null;

  /**
   * Our container width
   */
  width = 0;

  /**
   * Our container height
   */
  height = 0;

  /**
   * The last moused over node.
   */
  lastMousedOverNode: TreeNode | null = null;

  /**
   * A reference to the last border drawn.
   */
  lastBorderDrawingGroup: DrawingGroup | null = null;

  /**
   * Deprecated. Use enableHighlight.
   * If we should highlight the node on mouse over.
   */
  highlightOnMouseOver = true;

  /**
   * If we should highlight nodes.
   */
  enableHighlight = true;

  /**
   * If we should draw a border around the node on mouse over.
   */
  borderOnMouseOver = true;

  /**
   * The rectangular area used by the color bar.
   */
  colorBarRect: Rect | null = null;

  /**
   * The drawing group containing the color bar.
   */
  colorBarDrawingGroup: DrawingGroup | null = null;

  /**
   * The color bar marker.
   */
  colorBarMarker: Element | null = null;

  /**
   * The name of the node to draw in the lower-right of its parent box.
   */
  residualNode: string | null = null;

  /**
   * User-specified tooltip generator.
   */
  generateUserTooltip?: TooltipFunc;

  /**
   * User-specified events handler.
   */
  treeMapEventsHandler = new TreeMapEventsHandler();

  /**
   * Construct a new treemap. The treemap is a renderer (by the render method)
   * into a grid (table).
   * @param container The container in which the treemap should go.
   */
  constructor(container: Element | null) {
    super(container);
  }

  /**
   * Returns a copy of the currect interaction configuration.
   */
  getEventsConfig(): EventsConfig {
    // Return a copy so the internal data won't get accidentally changed.
    return {
      ...this.treeMapEventsHandler.getConfig(),
    } as EventsConfig;
  }

  /**
   * Destroys TreeMap.
   */
  override disposeInternal() {
    dispose(this.dataTree);
    delete this.dataTree;
    if (this.renderer !== null) {
      this.renderer?.clear();
      delete this.renderer;
    }
    dispose(this.tree);
    delete this.tree;
    dispose(this.drawingFrame);
    delete this.drawingFrame;
    super.disposeInternal();
  }

  /**
   * Clears the chart.
   * Remove any resources allocated for this chart.
   */
  override clearInternal() {}

  /**
   * Returns an array of objects where the row property of each
   *     object in the array contains the row number of a selected row.
   * @return An array of objects where the row property of
   *     each object in the array contains the row number of a selected row.
   *     There is only one element in this array.
   */
  getSelection(): SelectionObject[] {
    return this.selectedRow.getSelection();
  }

  /**
   * Sets the focus of the treemap to the given row.
   * @param selection An array of objects where the
   *     row property of each object in the array contains the row number
   *     of a selected row. Only the first element of the array will be used.
   */
  setSelection(selection: SelectionObject[]) {
    let selectedNode: TreeNode;
    if (!Array.isArray(selection) || 0 === selection.length) {
      // Remove selection:
      this.selectedRow.removeAllRows();
      selectedNode = this.tree!.getRootNodes()[0] as unknown as TreeNode;
    } else {
      // Set selection to argument:
      const selectedRow = selection[0].row as number;
      selectedNode = this.tree!.getNodeById(selectedRow) as unknown as TreeNode;
      if (selectedNode) {
        this.selectedRow.removeAllRows();
        this.selectedRow.addRow(selectedRow);
      }
    }
    if (selectedNode) {
      selectedNode.draw();
    }
  }

  /**
   * Returns an object containing the Color value and the HTML color of a given
   * row.
   * @param dataTableReference represents a location in the DataTable
   *     that will resolve to an element in the chart.
   *     {
   *       row: number - The index of the row.
   *     }
   * @return  An object containing the Color value and the HTML color
   *     of the given row or null if the data table reference does not resolve
   *     to a chart element.
   *     {
   *       value: number - The color of the node, normalized between 0 and 1.
   *       color: string - The HTML color of the node.
   *     }
   */
  getElementColor(dataTableReference: {
    row?: NodeId;
  }): {value: number | null; color: string} | null {
    if (dataTableReference == null) {
      return null;
    }
    const rowNumber =
      dataTableReference.row == null ? -1 : dataTableReference.row;
    const selectedNode = this.tree!.getNodeById(
      rowNumber,
    ) as unknown as TreeNode;
    if (selectedNode !== null) {
      return {
        'value': selectedNode.color,
        'color': selectedNode.getHtmlColor(false, false),
      };
    }
    return null;
  }

  /**
   */
  drawInternal(
    asyncWrapper: AnyCallbackWrapper,
    dataTable: AbstractDataTable,
    options?: UserOptions,
    state?: {},
  ) {
    this.options = new Options([options]);
    this.width = this.getWidth(this.options);
    this.height = this.getHeight(this.options);

    const dimensions = new Size(this.width, this.height);
    if (this.drawingFrame === null) {
      const forceIFrame = this.options.inferBooleanValue('forceIFrame');
      this.drawingFrame = new DrawingFrame(
        this.container,
        dimensions,
        asyncWrapper,
        forceIFrame,
      );
    } else {
      this.drawingFrame?.update(dimensions, asyncWrapper);
    }
    this.dataTable = dataTable;
    this.drawingFrame?.waitUntilReady(this.drawAsync.bind(this), asyncWrapper);
  }

  /**
   * Draws a treemap with the given renderer.
   */
  drawAsync() {
    const renderer = this.drawingFrame!.getRenderer();
    assert(renderer != null);
    this.renderer = renderer! as unknown as BrowserRenderer;
    // Ensure we ignore right click on our element.
    const container = renderer!.getContainer() as HTMLElement;
    container.oncontextmenu = () => false;
    // Parse all the data to populate this.dataTree.
    dispose(this.dataTree);
    this.dataTree = null as DataTree | null;
    dispose(this.tree);
    this.tree = null;

    this.parseOptions(this.options as Options);
    this.parseDataTable(this.dataTable as AbstractDataTable);

    this.minDataValue = Number.MAX_VALUE;
    this.maxDataValue = Number.MAX_VALUE * -1;
    this.tree = this.buildTree(this.dataTree as DataTree);
    // buildTree has redefined minDataValue and maxDataValue to
    // be the min and max of our data set. If {min|max}ColorValue is
    // defined, then overwrite the computed min/max with what the user wants.
    if (this.minColorValue !== null) {
      this.minDataValue = this.minColorValue;
    }
    if (this.maxColorValue !== null) {
      this.maxDataValue = this.maxColorValue;
    }

    const rootNode = this.tree.getRootNodes()[0] as unknown as TreeNode;
    if (rootNode) {
      rootNode.normalize(this.minDataValue, this.maxDataValue);
      if (this.colorBarMarker !== null) {
        this.colorBarMarker = null;
      }
    }
    // Clear the selection causing a draw of the root node.
    // This could make use of the `state` argument to draw but currently simply
    // replicates the behavior of other charts that reset selection on redraw.
    // TODO(dlaliberte): Make use of draw()'s `state` argument.
    this.setSelection([]);

    // Let the client know that we are done.
    gvizEvents.trigger(this, READY, {});
  }

  /**
   * Moves up in the tree by one and redraws the treemap if the current tree
   * has a parent.
   *
   * When moving up, the selection is changed to the newly displayed `parent`
   * layer. Navigation and selection entanglement may not be wise.
   * TODO(dlaliberte): Reconsider the entangling of navigation and selection.
   *
   * @return Returns true if we were able to roll up.
   */
  goUpAndDraw(): boolean {
    const node = this.shown;
    const parent = node!.getParent();
    if (!parent) {
      return false;
    }
    if (node!.tooltip !== null) {
      node!.tooltip?.detach();
    }
    this.setSelection([{'row': (parent as unknown as TreeNode).row}]);
    return true;
  }

  /**
   * Gets the maximum possible depth for the current view.
   * @return depth The maximum depth to show.
   */
  getMaxPossibleDepth(): number {
    return this.maxPossibleDepth;
  }

  /**
   * Sets the treemap based on the options passed in.
   * @param options The options.
   */
  parseOptions(options: Options) {
    this.title = options.inferStringValue('title');

    this.minColorValue = options.inferOptionalNumberValue('minColorValue');
    this.maxColorValue = options.inferOptionalNumberValue('maxColorValue');
    this.rotatingHue = options.inferBooleanValue('rotatingHue', false);

    if (this.rotatingHue) {
      this.hueStep = options.inferNumberValue(
        'hueStep',
        60 / (1 + Math.sqrt(5)),
      );
      this.minSaturation = options.inferNumberValue('minSaturation', 0);
      this.midSaturation = options.inferNumberValue('midSaturation', 0.5);
      this.maxSaturation = options.inferNumberValue('maxSaturation', 1);
      this.headerSaturation =
        options.inferOptionalNumberValue('headerSaturation');
      this.undefinedSaturation =
        options.inferOptionalNumberValue('noSaturation');
      this.minLightness = options.inferNumberValue('minLightness', 1);
      this.midLightness = options.inferNumberValue('midLightness', 0.75);
      this.maxLightness = options.inferNumberValue('maxLightness', 0.5);
      this.headerLightness =
        options.inferOptionalNumberValue('headerLightness');
      this.undefinedLightness = options.inferOptionalNumberValue('noLightness');
    }

    this.showScale = options.inferBooleanValue('showScale', false);
    this.showScaleText = options.inferBooleanValue('scale.showText', false);
    this.maxDepth = options.inferNonNegativeNumberValue('maxDepth', 1);
    this.maxPostDepth = options.inferNonNegativeNumberValue('maxPostDepth', 0);
    this.useWeightedAverageForAggregation = options.inferBooleanValue(
      'useWeightedAverageForAggregation',
      false,
    );
    this.hintOpacity = options.inferNonNegativeNumberValue('hintOpacity', 0.5);

    // Ensure the user gives us sane values.
    if (this.maxDepth < 1) {
      this.maxDepth = 1;
    }
    if (this.maxPostDepth < 0) {
      this.maxPostDepth = 0;
    }

    this.highlightOnMouseOver = options.inferBooleanValue(
      'highlightOnMouseOver',
      false,
    );
    this.enableHighlight = options.inferBooleanValue('enableHighlight', false);

    this.borderOnMouseOver = options.inferBooleanValue(
      'borderOnMouseOver',
      true,
    );

    this.showTooltips = options.inferBooleanValue('showTooltips', true);
    this.tooltipClass = options.inferStringValue('tooltipClass');

    const tooltipOption = options.inferValue('generateTooltip', null);
    if (tooltipOption) {
      this.generateUserTooltip = tooltipOption as TooltipFunc;
    }

    this.borderColor = options.inferColorValue('borderColor', '#ffffff');
    this.borderMouseOverColor = options.inferColorValue(
      'borderMouseOverColor',
      '#ffffff',
    );

    const defaultBorderMouseOverSizes = [5, 4, 3];
    const defaultBorderMouseOverOpacities = [0.2, 0.4, 0.6];
    this.borderMouseOverSizes = options.inferValue(
      'borderMouseOverSizes',
      defaultBorderMouseOverSizes,
    ) as number[];
    this.borderMouseOverOpacities = options.inferValue(
      'borderMouseOverOpacities',
      defaultBorderMouseOverOpacities,
    ) as number[];

    if (
      this.borderMouseOverSizes.length !== this.borderMouseOverOpacities.length
    ) {
      alert(
        "The arrays' lengths for border mouse over sizes and opacities " +
          'are not equal. We will use default borders.',
      );
      this.borderMouseOverSizes = defaultBorderMouseOverSizes;
      this.borderMouseOverOpacities = defaultBorderMouseOverOpacities;
    }

    for (let i = 0; i < this.borderMouseOverSizes.length; i++) {
      this.borderMouseOverSizes[i] = Number(this.borderMouseOverSizes[i]);
      this.borderMouseOverOpacities[i] = Number(
        this.borderMouseOverOpacities[i],
      );
    }

    this.fontSize = options.inferNonNegativeNumberValue('fontSize', 12);
    this.fontFamily = options.inferStringValue('fontFamily', 'Arial');
    this.fontColor = options.inferColorValue('fontColor', '#222222');
    this.fontMouseOverColor = options.inferColorValue(
      'fontMouseOverColor',
      '#000000',
    );

    if (this.fontFamily.indexOf('/') >= 0) {
      // Guard against injection of malicious code.
      alert('Bad font family! We will use Arial');
      this.fontFamily = 'Arial';
    }
    this.textStyle = options.inferTextStyleValue('textStyle', {
      color: this.fontColor,
      fontName: this.fontFamily,
      fontSize: this.fontSize,
    });
    const defaultMouseStyle = clone(this.textStyle) as TextStyle;
    defaultMouseStyle.color = this.fontMouseOverColor;
    this.mouseOverTextStyle = options.inferTextStyleValue(
      'mouseOverTextStyle',
      defaultMouseStyle,
    );
    const defaultTitleStyle = clone(this.textStyle) as TextStyle;
    defaultTitleStyle.bold = true;
    this.titleTextStyle = options.inferTextStyleValue(
      'titleTextStyle',
      defaultTitleStyle,
    );
    const defaultScaleTextStyle = clone(this.textStyle) as TextStyle;
    this.scaleTextStyle = options.inferTextStyleValue(
      'scale.textStyle',
      defaultScaleTextStyle,
    );

    const defaultStyleObj = {
      'background': 'infobackground',
      'color': 'infotext',
      'padding': '1px',
      'border': '1px solid infotext',
      'font-size': `${this.textStyle.fontSize}px; `,
      'font-family': this.textStyle.fontName,
    };
    const defaultStyleString = style.toStyleAttribute(defaultStyleObj);
    const tooltipStyleString = options.inferStringValue(
      'tooltipStyleString',
      defaultStyleString,
    );
    this.tooltipStyleObj = style.parseStyleAttribute(tooltipStyleString) as {
      [key: string]: string;
    };

    this.undefinedColor = options.inferColorValue('noColor', '#000000');
    this.minColor = options.inferColorValue('minColor', '#dc3912');
    this.midColor = options.inferColorValue('midColor', '#efe6dc');
    this.maxColor = options.inferColorValue('maxColor', '#109618');
    this.headerColor = options.inferColorValue('headerColor', '#cccccc');

    this.undefinedHighlightColor = options.inferColorValue(
      'noHighlightColor',
      '',
    );
    this.minHighlightColor = options.inferColorValue('minHighlightColor', '');
    this.midHighlightColor = options.inferColorValue('midHighlightColor', '');
    this.maxHighlightColor = options.inferColorValue('maxHighlightColor', '');
    this.headerHighlightColor = options.inferColorValue(
      'headerHighlightColor',
      '',
    );

    const maybeLightenColor = (highlight: string, color: string) => {
      // When '' is used as color option, 'none' is the resulting special
      // value. We replace these with computed colors.
      if (highlight === '' || highlight === 'none') {
        return googColor.rgbArrayToHex(
          googColor.lighten(
            googColor.hexToRgb(googColor.parse(color).hex),
            0.35,
          ),
        );
      }
      return highlight;
    };

    this.undefinedHighlightColor = maybeLightenColor(
      this.undefinedHighlightColor,
      this.undefinedColor,
    );
    this.minHighlightColor = maybeLightenColor(
      this.minHighlightColor,
      this.minColor,
    );
    this.maxHighlightColor = maybeLightenColor(
      this.maxHighlightColor,
      this.maxColor,
    );
    this.midHighlightColor = maybeLightenColor(
      this.midHighlightColor,
      this.midColor,
    );
    this.headerHighlightColor = maybeLightenColor(
      this.headerHighlightColor,
      this.headerColor,
    );

    this.header = options.inferNonNegativeNumberValue('headerHeight', 22);
    this.residualNode = options.inferOptionalStringValue('residualNode');

    this.treeMapEventsHandler.setConfig(
      options.inferObjectValue('eventsConfig', {}),
    );
  }

  /**
   * Parses out the data table and fills in the data trees.
   * @param dataTable The data table or data view.
   */
  parseDataTable(dataTable: AbstractDataTable) {
    if (dataTable.getNumberOfColumns() === 2) {
      // Create a DataView that uses unit (1) value for each node.
      const dataView = new DataView(dataTable);
      dataView.setColumns([
        0,
        1,
        {
          'type': 'number',
          calc() {
            return 1;
          },
        },
      ]);
      dataTable = dataView;
    }
    // Scan all input data and build up our nodes list.
    // The data may have children defined before parents, no order is assumed.
    dispose(this.dataTree);
    this.dataTree = new DataTree(dataTable);

    // Don't allow forests.
    if (this.dataTree.isForest()) {
      throw new Error(
        `Found ${this.dataTree.getTreeCount()} root nodes. ` +
          'Only a single root node is allowed.',
      );
    }
  }

  /**
   * Builds the treemap description to be used for display.
   *
   * @param dataTree The data tree.
   * @return The tree with the processed treemap data.
   */
  buildTree(dataTree: DataTree): Tree {
    let tree;
    // Create the processed data tree.
    const nodeFactory: NodeFactory =
      // ((node: DataTree, hue: number|null) => {
      //   const newNode = new TreeNode(this, (node as unknown as
      //   DataNodeImpl)); newNode.hue = hue; return newNode;
      // }) as unknown as NodeFactory;

      (node: DataNodeImpl, hue: number | null) => {
        const newNode = new TreeNode(this, node);
        newNode.hue = hue;
        return newNode;
      };
    if (this.rotatingHue) {
      tree = new ProjectedTree(
        dataTree,
        nodeFactory,
        undefined,
        0,
        this.hueStep,
      );
    } else {
      tree = new ProjectedTree(dataTree, nodeFactory);
    }
    this.maxPossibleDepth = tree.getHeight();
    // Calculate the area and color of the nodes.
    tree.calcAggregatedValue(
      (node) => {
        let primary = (node as TreeNode).primary;
        // primary can never be null. It is zero or positive.
        primary = typeof primary === 'number' && primary >= 0 ? primary : 0;
        // secondary is only defined if primary is > 0.
        const secondary = primary > 0 ? (node as TreeNode).secondary : null;
        return {
          'primary': primary,
          'secondary': secondary,
          'use_weighted_avg': (node as TreeNode).treemap
            .useWeightedAverageForAggregation,
        };
      },
      // We may need to calculate the weighted value for colors.
      (value, childValues) => {
        if (childValues.length === 0) {
          return value;
        }
        const primaries = [];
        const secondaries = [];
        for (let i = 0; i < childValues.length; i++) {
          primaries.push(childValues[i]['primary']);
          secondaries.push(childValues[i]['secondary']);
        }
        const totalarea = sumNoOverride(value['primary'], primaries);
        let colorvalue = null;
        if (!value['use_weighted_avg']) {
          colorvalue = averageNoOverride(value['secondary'], secondaries);
        } else {
          // This is a non-root node. We want the value to be
          // a weighted value of each secondary based on primary.
          colorvalue = 0;
          for (let i = 0; i < childValues.length; i++) {
            const childarea = childValues[i]['primary'];
            if (childarea === 0) {
              // We don't count this child.
              continue;
            }
            let childcolor = childValues[i]['secondary'];
            childcolor = childcolor === null ? 0 : childcolor;
            colorvalue += (childarea / totalarea) * childcolor;
          }
        }
        return {
          'primary': totalarea,
          'secondary': colorvalue,
        };
      },
      // Set the result in the node's color member.
      (node, value) => {
        (node as TreeNode).area = value['primary'];
        (node as TreeNode).color =
          (node as TreeNode).area > 0 ? value['secondary'] : null;
      },
    );
    // Update the min/max color values.
    tree.traverse((node) => {
      const color = (node as TreeNode).color;
      if (color !== null) {
        if (color < this.minDataValue) {
          this.minDataValue = color;
        }
        if (color > this.maxDataValue) {
          this.maxDataValue = color;
        }
      }
    });
    return tree;
  }

  /**
   * Generates and sets the tooltip string for a node.
   *
   * @param row The row index.
   * @param text The text to display in the tooltip.
   * @param tooltip The tooltip object to use.
   * @param size The node's "size" (area) value.
   * @param color The node's "color" value.
   */
  generateTooltip(
    row: number | null,
    text: string,
    tooltip: Tooltip,
    size: number,
    color: number | null,
  ) {
    if (row !== null && this.generateUserTooltip != null) {
      const userText = this.generateUserTooltip(row, size, color);
      tooltip.setSafeHtml(getSafeHtml(userText));
    } else {
      if (this.tooltipClass === '') {
        tooltip.setSafeHtml(
          createHtml(
            'div',
            {
              'style': Object.entries(this.tooltipStyleObj!)
                .map(([key, value]) => `${key}:${value};`)
                .join(''),
            },
            htmlEscape(text),
          ),
        );
      } else {
        tooltip.className = this.tooltipClass;
        tooltip.setText(text);
      }
    }
  }

  /**
   * Generates the colorbar for the treemap. This function should only
   * be called from the "head" node's draw. It is assumed that
   * this.canvas is valid and the renderer is clear.
   * @param hue The hue of the node to draw the color bar for.
   * @return Height of the text labels drawn on the color bar, if any.
   */
  drawColorBar(hue?: number): number {
    const rect = this.colorBarRect;
    this.deleteColorBar();
    this.colorBarDrawingGroup = this.renderer!.createGroup();
    assert(this.canvas != null);
    this.renderer!.appendChild(this.canvas!, this.colorBarDrawingGroup);

    // Stealing google.visualization.TRIANGLE_SIZE + 2 pixels
    // for the triangle + 2 for spacing.
    const triangleSpacing = TRIANGLE_SIZE + 2;
    const useTop = rect!.top + triangleSpacing;
    const useHeight = rect!.height - triangleSpacing;
    let minColor = this.minColor;
    let midColor = this.midColor;
    let maxColor = this.maxColor;

    if (this.rotatingHue && hue != null) {
      minColor = googColor.hslToHex(hue, this.minSaturation, this.minLightness);
      midColor = googColor.hslToHex(hue, this.midSaturation, this.midLightness);
      maxColor = googColor.hslToHex(hue, this.maxSaturation, this.maxLightness);
    }

    const midOffset = rect!.width / 2;
    const colorBarLeft = new Brush({
      gradient: {
        x1: rect!.left,
        y1: 0,
        x2: rect!.left + midOffset + 1,
        y2: 0,
        color1: minColor,
        color2: midColor,
      } as Gradient,
    });
    const colorBarRight = new Brush({
      gradient: {
        x1: rect!.left + midOffset,
        y1: 0,
        x2: rect!.left + rect!.width,
        y2: 0,
        color1: midColor,
        color2: maxColor,
      } as Gradient,
    });

    // Draw a border around the whole thing.
    this.renderer!.drawRect(
      rect!.left,
      useTop,
      rect!.width,
      useHeight,
      new Brush({stroke: '#999999', strokeWidth: 2}),
      this.colorBarDrawingGroup,
    );
    this.renderer!.drawRect(
      rect!.left,
      useTop,
      midOffset + 1,
      useHeight,
      colorBarLeft,
      this.colorBarDrawingGroup,
    );
    this.renderer!.drawRect(
      rect!.left + midOffset,
      useTop,
      rect!.width - midOffset,
      useHeight,
      colorBarRight,
      this.colorBarDrawingGroup,
    );

    // Draw the text labels on the scale, if requested.  The right label is
    // right-aligned, so that it doesn't go outside the drawing area.  The left
    // label is center-aligned on the left edge of the scale.
    if (!this.showScaleText) {
      return 0;
    }
    const chartTextPadding = 3;
    const textStyle = clone(this.scaleTextStyle) as TextStyle;
    let element = this.renderer!.drawText(
      this.minDataValue.toString(),
      rect!.left,
      rect!.top + rect!.height + chartTextPadding,
      0,
      TextAlign.CENTER,
      TextAlign.START,
      textStyle,
      this.colorBarDrawingGroup,
    ) as unknown as HTMLElement;
    let textHeight = element.offsetHeight;
    element = this.renderer!.drawText(
      this.maxDataValue.toString(),
      rect!.left + rect!.width,
      rect!.top + rect!.height + chartTextPadding,
      0,
      TextAlign.END,
      TextAlign.START,
      textStyle,
      this.colorBarDrawingGroup,
    ) as unknown as HTMLElement;
    textHeight = Math.max(textHeight, element.offsetHeight);

    return textHeight;
  }

  /**
   * Deletes the colorbar.
   */
  deleteColorBar() {
    if (this.colorBarDrawingGroup === null) {
      return;
    }
    const element = this.colorBarDrawingGroup.getElement();
    element.parentNode!.removeChild(element);
    this.colorBarDrawingGroup = null;
  }

  /**
   * Moves the colorbar marker.
   * @param value The color value to represent. Will be a value in
   *     [0,1].
   */
  moveColorBarMarker(value: number) {
    value = clamp(value, 0, 1);
    let xOffset = value * this.colorBarRect!.width;
    xOffset = xOffset + this.colorBarRect!.left;
    // Remove the old shown line and replace it.
    this.deleteColorBarMarker();
    const path = PathSegments.fromVertices([
      {
        x: xOffset - TRIANGLE_SIZE,
        y: this.colorBarRect!.top,
      },
      {
        x: xOffset,
        y: this.colorBarRect!.top + TRIANGLE_SIZE,
      },
      {
        x: xOffset + TRIANGLE_SIZE,
        y: this.colorBarRect!.top,
      },
    ]);
    assert(this.canvas != null);
    this.colorBarMarker = this.renderer!.drawPath(
      path,
      new Brush({fill: '#777777'}),
      this.canvas!,
    );
  }

  /**
   * Deletes the colorbar marker.
   */
  deleteColorBarMarker() {
    if (this.colorBarMarker === null) {
      return;
    }
    this.colorBarMarker.parentNode?.removeChild(this.colorBarMarker);
    this.colorBarMarker = null;
  }
}
enum TreeMapColumn {
  NAME,
  PARENT,
  PRIMARY,
  SECONDARY,
}

// Color bar functionality.
// TODO(dlaliberte): replace once new color bar library is implemented.
interface DrawTextArgs {
  text: string;
  textX: number;
  textY: number;
  width: number;
  height: number;
  header: boolean;
}

/**
 * Describes the tree structure of the displayable data!
 */
export class TreeNode extends NodeBase {
  row: number | null;
  readonly formattedName: string;
  tooltip?: Tooltip;
  primary: number;
  secondary: number | null;

  /**
   * The graphics element for the drawn text.
   */
  drawnText: Element | null = null;

  /**
   * Defines how to draw the text.
   */
  drawTextArgs: DrawTextArgs | null = null;

  /**
   * The graphics element for the data rectangle.
   */
  drawnRect: Element | null = null;

  /**
   * The graphics element for the header rectangle.
   */
  headerRect: Element | null = null;

  /**
   * The graphics element for the group.
   */
  drawingGroup: DrawingGroup | null = null;

  /**
   * Rectangular coordinates of the node.
   */
  coord?: Rect | null = null;

  /**
   * The color of the node, normalized between 0 and 1. If null, the color
   * is undefined.
   */
  color: number | null = null;

  /**
   * The hue of this node if using rotating hue.
   */
  hue: number | null = null;

  /**
   * The size of the node.
   */
  area = 0;

  /**
   * The opacity of the node (used for the post-max-depth rectangles).
   */
  opacity = 1;

  /**
   * Whether this node is a post max depth node or not.
   */
  post = false;

  /**
   * Defines if we should use our highlightColor or our nonHighlightColor.
   */
  highlight = false;

  /**
   * The highlight color fill object for this node.
   */
  highlightColor = '';

  /**
   * The non highlight color fill object for this node.
   */
  nonHighlightColor = '';

  /**
   * Whether the node is in "collapsed mode" (don't show children) or not.
   */
  collapsed = false;

  treeMapEventsHandler = new TreeMapEventsHandler();

  /**
   * @param treemap The treemap creating the node.
   * @param dataNode The raw data tree node.
   */
  constructor(
    readonly treemap: TreeMap,
    dataNode: DataNodeImpl,
  ) {
    super(dataNode.getId(), dataNode.getName());

    /**
     * The data table row this node relates to, or null if no such row exists.
     */
    this.row = dataNode.getRow();

    /**
     * The formatted name of the node.
     */
    this.formattedName = dataNode.getFormattedName();

    /**
     * A handle to the tooltip for the node. Note that at this point
     * treemap.renderer can be null only in tests.
     */
    this.tooltip = new Tooltip(
      null,
      null,
      // If there's a renderer, set its container's DOM helper as the
      // tooltip's DOM helper. This is important to get the position corrent,
      // if we're in an iframe.
      treemap.renderer ? getDomHelper(treemap.renderer.getContainer()) : null,
    );

    /**
     * The primary metric of the node. Must be positive.
     */
    this.primary = dataNode.getValue(TreeMapColumn.PRIMARY);

    /**
     * The secondary metric of the node.
     *
     * TODO(b/171706606): Remove this nulability assertion when fixed.
     */
    this.secondary =
      dataNode.getDataTable().getNumberOfColumns() >= 4
        ? dataNode.getValue(TreeMapColumn.SECONDARY)
        : this.primary;

    this.treeMapEventsHandler.reuseConfig(treemap.treeMapEventsHandler);
  }

  /**
   * Destroys TreeNode.
   */
  override disposeInternal() {
    delete this.coord;
    if (this.tooltip !== null) {
      dispose(this.tooltip);
      delete this.tooltip;
    }
    super.disposeInternal();
  }

  getChild(i: number): TreeNode {
    const child = this.getChildren()[i];
    return child as unknown as TreeNode;
  }

  /**
   * Normalize all the colors. All the values will be normalized to [0,1]
   * based on minValue and maxValue.
   * @param minValue the minimum value.
   * @param maxValue the maximum value.
   */
  normalize(minValue: number, maxValue: number) {
    if (this.color !== null) {
      const length = maxValue - minValue;
      if (length !== 0) {
        this.color = clamp(this.color, minValue, maxValue);
        // change it so the minimum value is now zero.
        this.color = this.color - minValue;
        // normalize between zero and one.
        this.color = this.color / length;
      } else {
        this.color = 0.5;
      }
    }
    for (let i = 0, length = this.getChildCount(); i < length; i++) {
      this.getChild(i).normalize(minValue, maxValue);
    }
    if (this.treemap.showTooltips && this.tooltip) {
      this.treemap.generateTooltip(
        this.row,
        this.formattedName,
        this.tooltip,
        this.area,
        this.color,
      );
    }
  }

  /**
   * Find the appropriate color for the given node.
   * @param header Whether or not we're drawing a "header" element.
   * @param highlight Whether we're in highlighted mode or not.
   * @return A color in the "rgb(r,g,b)" format.
   */
  getHtmlColor(header: boolean, highlight: boolean): string {
    let blend = null;
    let max = null;
    let min = null;
    let mid = null;
    let head = null;
    let undef = null;

    if (this.hue === null) {
      if (highlight) {
        max = googColor.hexToRgb(
          googColor.parse(this.treemap.maxHighlightColor).hex,
        );
        min = googColor.hexToRgb(
          googColor.parse(this.treemap.minHighlightColor).hex,
        );
        mid = googColor.hexToRgb(
          googColor.parse(this.treemap.midHighlightColor).hex,
        );
        head = googColor.hexToRgb(
          googColor.parse(this.treemap.headerHighlightColor).hex,
        );
        undef = googColor.hexToRgb(
          googColor.parse(this.treemap.undefinedHighlightColor).hex,
        );
      } else {
        max = googColor.hexToRgb(googColor.parse(this.treemap.maxColor).hex);
        min = googColor.hexToRgb(googColor.parse(this.treemap.minColor).hex);
        mid = googColor.hexToRgb(googColor.parse(this.treemap.midColor).hex);
        head = googColor.hexToRgb(
          googColor.parse(this.treemap.headerColor).hex,
        );
        undef = googColor.hexToRgb(
          googColor.parse(this.treemap.undefinedColor).hex,
        );
      }
    } else {
      max = googColor.hslToRgb(
        this.hue,
        this.treemap.maxSaturation,
        this.treemap.maxLightness,
      );
      min = googColor.hslToRgb(
        this.hue,
        this.treemap.minSaturation,
        this.treemap.minLightness,
      );
      mid = googColor.hslToRgb(
        this.hue,
        this.treemap.midSaturation,
        this.treemap.midLightness,
      );
      if (highlight) {
        max = googColor.lighten(max, 0.35);
        min = googColor.lighten(min, 0.35);
        mid = googColor.lighten(mid, 0.35);
      }
      if (
        this.treemap.headerSaturation !== null &&
        this.treemap.headerLightness !== null
      ) {
        head = googColor.hslToRgb(
          this.hue,
          this.treemap.headerSaturation,
          this.treemap.headerLightness,
        );
        if (highlight) {
          head = googColor.lighten(head, 0.35);
        }
      }
      if (
        this.treemap.undefinedSaturation !== null &&
        this.treemap.undefinedLightness !== null
      ) {
        undef = googColor.hslToRgb(
          this.hue,
          this.treemap.undefinedSaturation,
          this.treemap.undefinedLightness,
        );
        if (highlight) {
          undef = googColor.lighten(undef, 0.35);
        }
      } else {
        if (highlight) {
          undef = googColor.hexToRgb(
            googColor.parse(this.treemap.undefinedHighlightColor).hex,
          );
        } else {
          undef = googColor.hexToRgb(
            googColor.parse(this.treemap.undefinedColor).hex,
          );
        }
      }
    }

    if (header && head !== null) {
      blend = head;
    } else if (this.color === null) {
      blend = undef;
    } else {
      if (this.color < 0.5) {
        blend = googColor.blend(mid, min, this.color * 2);
      } else {
        blend = googColor.blend(max, mid, (this.color - 0.5) * 2);
      }
    }
    return googColor.rgbArrayToHex(blend);
  }

  /**
   * Resets all coordinates under this tree to null.
   */
  resetCoord() {
    delete this.coord;
    this.coord = null;
    for (let i = 0, length = this.getChildCount(); i < length; i++) {
      this.getChild(i).resetCoord();
    }
  }

  /**
   * Sets the text style of the node to a given style.
   * @param style The style to use for the text.
   */
  drawTextWithStyle(style: TextStyle) {
    if (this.drawnText !== null) {
      this.drawnText.parentNode?.removeChild(this.drawnText);
      this.drawnText = null;
    }
    if (!this.drawTextArgs) {
      // Nothing to draw.
      return;
    }
    const textStyle = clone(style) as TextStyle;
    textStyle.bold = textStyle.bold || this.drawTextArgs.header;
    const layout = calcTextLayout(
      this.treemap.renderer!.getTextSize.bind(
        this.treemap.renderer,
      ) as TextMeasureFunction,
      this.drawTextArgs.text,
      textStyle,
      this.drawTextArgs.width,
      1,
    );
    let text = '';
    if (layout.lines.length > 0) {
      text = layout.lines[0];
    }
    assert(this.drawingGroup != null);
    const drawnText = this.treemap.renderer!.drawText(
      text,
      // We want the center of the text in the center of the box.
      this.drawTextArgs.textX + this.drawTextArgs.width / 2,
      this.drawTextArgs.textY,
      this.drawTextArgs.width,
      TextAlign.CENTER,
      TextAlign.CENTER,
      textStyle,
      this.drawingGroup!,
    );
    this.drawnText = drawnText;
    // Delegate mouse event handling to the underlying element.
    this.drawnText.setAttribute('pointer-events', 'none');
  }

  /**
   * Callback to fire once we've moused out of the canvas.
   * @param event The event object.
   *
   */
  removeBorders(event: events.Event) {
    // If we've moused out of the canvas, remove the border and text effects.
    if (this.treemap.lastBorderDrawingGroup !== null) {
      // lastMousedOverNode is always set if the lastBorderDrawingGroup is
      // set!
      const oldNode = this.treemap.lastMousedOverNode;

      const dom = utilDom.getDomHelper();
      const parentElem = dom.getAncestorByTagNameAndClass(
        (event as unknown as MouseEvent).relatedTarget as Node,
        SVG,
      );

      // If we have an ancestor that is a SVG node, *and* that ancestor is not
      // null, then we can draw this text.
      assert(this.treemap.textStyle != null);
      if (parentElem && dom.getParentElement(parentElem)) {
        oldNode!.drawTextWithStyle(this.treemap.textStyle!);
      }

      // Remove the border element itself if it exists.
      if (this.treemap.lastBorderDrawingGroup.isElementCreated()) {
        const element = this.treemap.lastBorderDrawingGroup.getElement();
        element.parentNode!.removeChild(element);
      }
      this.treemap.lastBorderDrawingGroup = null;
      this.treemap.lastMousedOverNode = null;
    }
  }

  /**
   * Generates the coordinates and draws them into the container given
   * by the treemap.
   */
  draw() {
    assert(this.treemap.borderMouseOverSizes != null);
    const glowSize = Math.max.apply(Math, this.treemap.borderMouseOverSizes!);
    const width = this.treemap.width - glowSize * 2;
    const height = this.treemap.height;
    const header = this.treemap.header;
    this.resetCoord();
    let offset = 0;
    this.treemap.renderer!.clear();
    this.treemap.canvas = this.treemap.renderer!.createCanvas(width, height);
    assert(this.treemap.canvas != null);

    // Precalculate the goldenSize in case it is used (if a title or
    // scale is defined).
    const perimeter = 2 * (width + height);
    const em = Math.pow(perimeter, 1 / 3);
    const goldenSize = ((1 + Math.sqrt(5)) / 2) * em;
    const thirdWidth = width / 3;
    if (this.treemap.title !== '') {
      // Draw the line through the center of our "golden ratio" box.
      assert(this.treemap.titleTextStyle != null);
      this.treemap.renderer!.drawText(
        this.treemap.title,
        glowSize,
        goldenSize / 2,
        width - thirdWidth,
        TextAlign.START,
        TextAlign.CENTER,
        this.treemap.titleTextStyle!,
        this.treemap.canvas,
      );
      offset = goldenSize;
    }
    if (this.treemap.showScale) {
      // The height of the color bar itself should be em.
      // The total header space = goldenSize
      // Center the scale on the golden ratio box. The extra
      // space we want to add to the top is:
      const spacing = (goldenSize - em) / 2;
      const barTop = spacing;
      let barHeight = goldenSize - 2 * spacing;
      barHeight = clamp(barHeight, 0, goldenSize);
      this.treemap.colorBarRect = new Rect(
        width - thirdWidth - glowSize,
        barTop,
        thirdWidth,
        barHeight,
      );
      const colorBarTextHeight = this.treemap.drawColorBar();
      offset = goldenSize + colorBarTextHeight;
      if (this.treemap.rotatingHue) {
        // Only show the color bar when moused over a node.
        this.treemap.deleteColorBar();
      }
    }
    this.coord = new Rect(
      glowSize, // left
      header + offset, // top
      width - glowSize * 2, // width
      height - header - offset - glowSize, // height
    );

    this.generateLayout(header, 0);
    this.post = false;
    this.drawInternal(header, 0);
    this.treemap.shown = this;

    // Unset the border if we go out of the canvas.
    this.treemap.renderer!.setEventHandler(
      this.treemap.canvas,
      MOUSEOUT,
      this.mouseOutOfCanvas.bind(this),
    );
  }

  /**
   * Draw the main colored rectangle and the text rectangle.
   * @param x The left coordinate of the box.
   * @param y The top coordinate of the box.
   * @param width The width of the box.
   * @param height The height of the box.
   * @param text The text to display in the box.
   * @param header Whether or not this is a header box.
   * @return the drawn rectangle.
   */
  drawBoxes(
    x: number,
    y: number,
    width: number,
    height: number,
    text: string,
    header: boolean,
  ): Element | null {
    this.highlightColor = this.getHtmlColor(header, true);
    this.nonHighlightColor = this.getHtmlColor(header, false);
    if (height <= 0 || width <= 0 || (this.post && header)) {
      return null;
    }
    assert(this.treemap.canvas != null);
    if (this.drawingGroup === null) {
      this.drawingGroup = this.treemap.renderer!.createGroup();
      this.treemap.renderer!.appendChild(
        this.treemap.canvas!,
        this.drawingGroup,
      );
    }

    const brush = new Brush({
      fill: this.nonHighlightColor,
      fillOpacity: this.opacity,
    });
    if (!this.post) {
      brush.setStroke(this.treemap.borderColor, 1);
    }
    const rect = this.treemap.renderer!.drawRect(
      x,
      y,
      width,
      height,
      brush,
      this.drawingGroup,
    );
    if (!this.post) {
      this.drawTextArgs = {
        text,
        textX: x,
        textY: y + height / 2.0,
        width,
        height,
        header,
      };
      assert(this.treemap.textStyle != null);
      this.drawTextWithStyle(this.treemap.textStyle!);
    }
    return rect;
  }

  /**
   * Draw a full box describing the relative size of the node.
   */
  drawData() {
    this.drawnRect = this.drawBoxes(
      this.coord!.left,
      this.coord!.top,
      this.coord!.width,
      this.coord!.height,
      this.formattedName,
      false,
    );
  }

  /**
   * Draw a header box.
   * @param header The size of the header.
   */
  drawHeader(header: number) {
    this.headerRect = this.drawBoxes(
      this.coord!.left,
      this.coord!.top - header,
      this.coord!.width,
      header,
      this.formattedName,
      true,
    );
  }

  /**
   * Draw the node and all its children.
   * @param header The size of the header.
   * @param depth The current depth being drawn.
   */
  drawInternal(header: number, depth: number) {
    this.opacity = 1;
    this.highlight = false;
    const numChildren = this.getChildCount();
    // clear() has already been called. We can set all these to null.
    this.drawingGroup = null;
    this.drawnRect = null;
    this.headerRect = null;
    if (numChildren === 0) {
      this.drawData();
    } else {
      if (depth >= this.treemap.maxDepth || this.collapsed) {
        if (header !== 0 && this.coord!.height >= header && !this.collapsed) {
          if (depth < this.treemap.maxDepth) {
            this.drawHeader(header);
          }
        }
        if (!this.collapsed) {
          if (depth < this.treemap.maxDepth + this.treemap.maxPostDepth) {
            for (let i = 0; i < numChildren; i++) {
              const child = this.getChild(i);
              child.highlight = this.highlight;
              child.post = true;
              child.drawInternal(header, depth + 1);
            }
            const delta =
              this.treemap.maxDepth + this.treemap.maxPostDepth - depth;
            this.opacity =
              this.treemap.hintOpacity * (delta / this.treemap.maxPostDepth);
          }
        }
        this.drawData();
      } else {
        for (let i = 0; i < numChildren; i++) {
          const child = this.getChild(i);
          child.post = false;
          child.highlight = this.highlight;
          child.drawInternal(header, depth + 1);
        }
        if (header !== 0) {
          this.drawHeader(header);
        }
      }
    }
    this.makeEvents();
  }

  /**
   * Simple helper function to sort two TreeNodes by area.
   * @param a The first node.
   * @param b The second node.
   * @return less than zero if a is greater,
   *         greater than or equal to zero otherwise.
   *         On a tie, return a.data.row - b.data.row.
   */
  sortArea(a: TreeNode, b: TreeNode): number {
    if (a.treemap.residualNode !== null) {
      const residualNode = a.treemap.residualNode;
      if (b.getName() === residualNode) {
        return -1;
      }
      if (a.getName() === residualNode) {
        return 1;
      }
    }
    if (b.area === a.area) {
      return a.row! - b.row!;
    }
    return b.area - a.area;
  }

  /**
   * Generate the treemap coordinates.
   * From Space Monger.
   * http://www.sixty-five.cc/sm/treemaps.php
   * @param header The size of the header.
   * @param depth The depth in the tree of the node.
   *
   */
  generateLayout(header: number, depth: number) {
    if (depth >= this.treemap.maxDepth - 1) {
      header = 0;
    }
    this.collapsed = false;
    const children = googArray.clone(
      this.getChildren(),
    ) as unknown as TreeNode[];
    children.sort(this.sortArea);
    this.divideDisplayArea(
      children,
      clone(this.coord || null) as Rect,
      0,
      children.length,
      this.area,
    );
    for (let i = 0, length = children.length; i < length; i++) {
      const child = children[i];
      if (child.getChildCount()) {
        // TODO(dlaliberte): decrement header size
        if (child.coord!.height > 2 * header) {
          child.coord!.top += header;
          child.coord!.height -= header;
          child.generateLayout(header, depth + 1);
        } else {
          child.collapsed = true;
        }
      }
    }
  }

  /**
   * Helper function for generating the treemap coordinates.
   * Explanation in:
   * http://www.sixty-five.cc/sm/treemaps.php
   * @param children The children to layout.
   * @param parentCoord The rectangle coordinates
   *        of the parent.
   * @param firstChild The first child to work on.
   * @param numChildrenToLayout Number of children left to layout.
   * @param totalArea Total Area of the parent.
   */
  divideDisplayArea(
    children: TreeNode[],
    parentCoord: Rect,
    firstChild: number,
    numChildrenToLayout: number,
    totalArea: number,
  ) {
    if (numChildrenToLayout <= 0) {
      return;
    }
    if (numChildrenToLayout === 1) {
      children[firstChild].coord = new Rect(
        Number(parentCoord.left),
        Number(parentCoord.top),
        totalArea === 0 ? 0 : Number(parentCoord.width),
        totalArea === 0 ? 0 : Number(parentCoord.height),
      );
      return;
    }

    let areaA = children[firstChild].area;
    let areaB = 0;
    let numA = 1;
    let numB = 0;
    let child;
    // We want to balance areaA and areaB. Let's add items to
    // areaA (remember, our children are listed greatest area first!) until
    // it is roughly hallf the size of the total area.
    for (
      child = firstChild + 1;
      child < firstChild + numChildrenToLayout &&
      (areaA + children[child].area) * 2 < totalArea;
      child++
    ) {
      areaA += children[child].area;
      numA++;
    }
    // Then assign the rest of the children to area B.
    areaB = totalArea - areaA;
    numB = numChildrenToLayout - numA;

    // We can now divide up the available area into two
    // parts according to the lists' areas.
    const x = parentCoord.left;
    const y = parentCoord.top;
    const width = parentCoord.width;
    const height = parentCoord.height;
    let midpoint;
    let orientation;
    const HORIZONTAL = 0;
    const VERTICAL = 1;
    if (areaA + areaB <= 0) {
      // Degenerate case:  All area-zero entries.
      midpoint = 0;
      orientation = HORIZONTAL;
    } else {
      // If the available area is wider than it is tall,
      // split it vertically.  Otherwise, split it
      // horizontally.  The position of the split is
      // proportional to the areas of the two lists.
      if (width >= height) {
        midpoint = Math.ceil((areaA * width) / totalArea);
        orientation = HORIZONTAL;
      } else {
        midpoint = Math.ceil((areaA * height) / totalArea);
        orientation = VERTICAL;
      }
    }
    // Once we've split, we recurse to divide up the two
    // new areas further, and we keep recursing until
    // we're only trying to fit one entry into any
    // given area.  This way, even area-zero entries will
    // eventually be assigned a location somewhere in the
    // display.  The rectangles below are created in
    // (x, y, width, height) format.
    if (orientation === HORIZONTAL) {
      this.divideDisplayArea(
        children,
        new Rect(x, y, midpoint, height),
        firstChild,
        numA,
        areaA,
      );
      this.divideDisplayArea(
        children,
        new Rect(x + midpoint, y, width - midpoint, height),
        firstChild + numA,
        numB,
        areaB,
      );
    } else {
      this.divideDisplayArea(
        children,
        new Rect(x, y, width, midpoint),
        firstChild,
        numA,
        areaA,
      );
      this.divideDisplayArea(
        children,
        new Rect(x, y + midpoint, width, height - midpoint),
        firstChild + numA,
        numB,
        areaB,
      );
    }
  }

  /**
   * Walks through the tree and resets the fill values according to
   * the node's highlights.
   *
   */
  fillHighlight() {
    if (this.treemap.highlightOnMouseOver || this.treemap.enableHighlight) {
      let color = this.nonHighlightColor;
      if (this.highlight) {
        color = this.highlightColor;
      }
      const brush = new Brush({fill: color, fillOpacity: this.opacity});
      if (!this.post) {
        brush.setStroke(this.treemap.borderColor, 1);
      }
      if (this.drawnRect !== null) {
        // set the brush fill to color first.
        this.treemap.renderer!.setBrush(this.drawnRect, brush);
      }
      if (this.headerRect !== null) {
        // set the brush fill to color first.
        this.treemap.renderer!.setBrush(this.headerRect, brush);
      }
      for (let i = 0, length = this.getChildCount(); i < length; i++) {
        const child = this.getChild(i);
        child.highlight = this.highlight;
        child.fillHighlight();
      }
    }
  }

  /**
   * Draws a border around the selected node on mouseover and removes the old
   * border if it exists.
   * @param event The event object.
   *
   */
  updateBorders(event: events.Event) {
    if (!this.treemap.borderOnMouseOver) {
      return;
    }
    this.removeBorders(event);
    // Now add a border.
    let yOffset = 0;
    if (this.headerRect !== null) {
      yOffset = this.treemap.header;
    }

    // The border should stay within the original border.
    this.treemap.lastBorderDrawingGroup = this.treemap.renderer!.createGroup();
    assert(this.treemap.canvas != null);
    this.treemap.renderer!.appendChild(
      this.treemap.canvas!,
      this.treemap.lastBorderDrawingGroup,
    );

    // Manually implement a blur...
    const length = this.treemap.borderMouseOverSizes!.length;
    for (let i = 0; i < length; i++) {
      const stroke = this.treemap.borderMouseOverSizes![i];
      this.treemap.renderer!.drawRect(
        this.coord!.left - stroke / 2,
        this.coord!.top - yOffset - stroke / 2,
        this.coord!.width + stroke,
        this.coord!.height + yOffset + stroke,
        new Brush({
          stroke: this.treemap.borderMouseOverColor,
          strokeWidth: this.treemap.borderMouseOverSizes![i],
          strokeOpacity: this.treemap.borderMouseOverOpacities![i],
        }),
        this.treemap.lastBorderDrawingGroup,
      );
    }

    this.treemap.lastMousedOverNode = this;
    assert(this.treemap.mouseOverTextStyle != null);
    this.drawTextWithStyle(this.treemap.mouseOverTextStyle!);
  }

  /**
   * Event handler to drill down the tree.
   *
   * Triggers both a select event and a drilldown event.
   */
  drillDown(event?: events.BrowserEvent) {
    this.treemap.setSelection([{'row': this.row}]);
    gvizEvents.trigger(this.treemap, SELECT, null);
    gvizEvents.trigger(this.treemap, DRILL_DOWN, {'row': this.row});
  }

  /**
   * Event handler to roll up the tree.
   *
   * Triggers both a select event and a rollup event.
   */
  rollUp(event?: events.BrowserEvent) {
    if (this.treemap.goUpAndDraw()) {
      // The argument to rollup is where we are rolling up from.
      gvizEvents.trigger(this.treemap, ROLL_UP, {'row': this.row});
      // We should also fire a SELECT event since the selection is set to
      // the currently displayed node. Rolling up changes this.
      gvizEvents.trigger(this.treemap, SELECT, null);
    }
  }

  /**
   * Event handler to highlight (f.k.a mouseOver) a tree node.
   * We also update our "extremes" color bar with the value of the
   * node we're highlighting.
   * Triggers an onmouseover event for backward compatibility.
   * Also triggers a highlight event.
   * @param event The event object.
   *
   */
  highlightNode(event: events.BrowserEvent) {
    this.highlight = true;
    this.fillHighlight();
    this.updateBorders(event);
    if (this.treemap.mouseOverTextStyle) {
      this.drawTextWithStyle(this.treemap.mouseOverTextStyle);
    }

    // Update the "colorbar"
    if (this.treemap.showScale) {
      if (this.hue !== null) {
        if (typeof this.secondary === 'number') {
          this.treemap.drawColorBar(this.hue);
        } else {
          this.treemap.deleteColorBar();
        }
      }
      let value = 0;
      if (this.color !== null) {
        value = this.color;
      }
      if (typeof this.secondary === 'number') {
        this.treemap.moveColorBarMarker(value);
      } else {
        this.treemap.deleteColorBarMarker();
      }
    }

    gvizEvents.trigger(this.treemap, HIGHLIGHT, {'row': this.row});
  }

  /**
   * Event handler to unhighlight (f.k.a mouseOut) a tree node.
   * Also hide the shown line on the color selector, if it is being used.
   * Triggers an onmouseout event for backward compatibility.
   * Also triggers an unhighlight event.
   * @param event The event object.
   */
  unhighlightNode(event?: events.BrowserEvent) {
    // Move the colorbar to the "nothing selected" state.
    this.treemap.deleteColorBarMarker();
    if (this.hue !== null) {
      this.treemap.deleteColorBar();
    }
    this.highlight = false;
    this.fillHighlight();
    if (this.treemap.textStyle) {
      this.drawTextWithStyle(this.treemap.textStyle);
    }
    gvizEvents.trigger(this.treemap, UNHIGHLIGHT, {'row': this.row});
  }

  /**
   * Mouse out handler for the entire canvas.
   * Un-highlight the current node if we're moused out of a node.
   * Triggers an onmouseout event.
   * @param event The event object.
   *
   */
  mouseOutOfCanvas(event: events.BrowserEvent) {
    // If we're going from a child to a node not a descendant of the svg node,
    // then we want to call removeBorders here.
    const dom = utilDom.getDomHelper();
    const parentElem = dom.getAncestorByTagNameAndClass(
      event.relatedTarget,
      SVG,
    );
    parentElem && this.removeBorders(event);

    // Emit low level DOM triggered event onmouseout.
    gvizEvents.trigger(this.treemap, MOUSE_OUT, {'row': this.row});
    // Now process the mouseOut event for the node we're in.
    this.unhighlightNode(event);
  }

  /**
   * Attach events to all the elements associated with a TreeNode.
   * Attaches a click listener (click on an element to "go into" that
   * element if it is a parent-node).
   * Attaches a mouseover and mouseout listener to enable highlighting
   * directories.
   *
   */
  makeEvents() {
    if (this.tooltip !== null) {
      this.tooltip?.detach();
    }

    if (this.drawingGroup === null) {
      return;
    }

    if (this.post) {
      return;
    }

    const domElement = this.drawingGroup.getElement();
    if (this.tooltip !== null) {
      if (this.tooltip?.getHtml() !== '') {
        this.tooltip?.attach(domElement);
      }
    }
    if (!this.isLeaf()) {
      style.setStyle(domElement, 'cursor', 'pointer');
    } else {
      style.setStyle(domElement, 'cursor', 'default');
    }

    // Emit the low level DOM triggered event onmouseover.
    this.treemap.renderer!.setEventHandler(domElement, MOUSEOVER, () => {
      gvizEvents.trigger(this.treemap, MOUSE_OVER, {'row': this.row});
    });

    // Emit the low level DOM triggered event onmouseout.
    this.treemap.renderer!.setEventHandler(domElement, MOUSEOUT, () => {
      gvizEvents.trigger(this.treemap, MOUSE_OUT, {'row': this.row});
    });

    // Set high level treemap interaction handlers.
    this.treeMapEventsHandler.makeEvents(this.treemap.renderer!, domElement, {
      highlight: this.highlightNode.bind(this),
      unhighlight: this.unhighlightNode.bind(this),
      rollup: this.rollUp.bind(this),
      drilldown: this.drillDown.bind(this),
    });
  }
}
