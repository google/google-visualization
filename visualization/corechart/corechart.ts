/**
 * @fileoverview CoreChart class for the canviz charts.
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

import {
  clone,
  forEach,
  map,
  range,
  some,
} from '@npm//@closure/array/array';
import * as asserts from '@npm//@closure/asserts/asserts';
import {dispose} from '@npm//@closure/disposable/dispose';
import {getDomHelper} from '@npm//@closure/dom/dom';
import * as events from '@npm//@closure/events/events';
import {EventTarget} from '@npm//@closure/events/eventtarget';
import {
  Logger,
  getLogger,
  warning,
} from '@npm//@closure/log/log';
import {Size} from '@npm//@closure/math/size';
import * as googObject from '@npm//@closure/object/object';
import {Timer} from '@npm//@closure/timer/timer';
import {safeElement} from '@npm//@safevalues/dom';
import {EasingType, getProperties} from '../../common/animation';
import {AnyCallbackWrapper} from '../../common/async_helper';
import {CHART_SPECIFIC_DEFAULTS, DEFAULTS} from '../../common/defaults';
import * as errors from '../../common/errors';
import * as gvizJson from '../../common/json';
import {MSG_NOT_SUPPORTED} from '../../common/messages';
import {findValuesRecursive} from '../../common/object';
import * as optionTypes from '../../common/option_types';
import {Options, UserOptions} from '../../common/options';
import {Selection} from '../../common/selection';
import {SelectionObject} from '../../common/selection_object';
import {getTheme} from '../../common/theme';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {DataTable} from '../../data/datatable';
import {DataView} from '../../data/dataview';
import {ColumnTypeUnion} from '../../data/types';
import {AxisChartEventHandler} from '../../events/axis_chart_event_handler';
import {AxisChartInteractivityDefiner} from '../../events/axis_chart_interactivity_definer';
import {ChartEventDispatcher} from '../../events/chart_event_dispatcher';
import {ChartEventHandler} from '../../events/chart_event_handler';
import {ChartEventType} from '../../events/chart_event_types';
import {ChartInteractivityDefiner} from '../../events/chart_interactivity_definer';
import {ChartState} from '../../events/chart_state';
import {EventHandler} from '../../events/event_handler';
import {Features as ExplorerFeatures} from '../../events/explorer/features';
import {EventData} from '../../events/interaction_events';
import {AbstractRenderer} from '../../graphics/abstract_renderer';
import {CanvasRenderer} from '../../graphics/canvas_renderer';
import {DrawingFrame} from '../../graphics/drawing_frame';
import {OverlayArea} from '../../graphics/overlay_area';
import {SvgRenderer} from '../../graphics/svg_renderer';
import {WebFontLoader} from '../../loader/webfonts';
import {TextMeasureFunction} from '../../text/text_measure_function';
import {TextStyle} from '../../text/text_style';
import {
  ActionsMenuDefiner,
  ActionsMenuDefinition,
} from '../../tooltip/actions_menu_definer';
import * as a11y from '../a11y';
import {AbstractVisualization} from '../abstract_visualization';
import {AxisChartBuilder} from './axis_chart_builder';
import {AxisChartDefiner} from './axis_chart_definer';
import {ChartBuilder} from './chart_builder';
import {ChartDefiner} from './chart_definer';
import {ChartDefinition} from './chart_definition';
import {ChartDefinitionInterpolator} from './chart_definition_interpolator';
import * as chartdefinitionutil from './chart_definition_utils';
import {HistogramChartDefiner} from './histogram_chart_definer';
import {ColumnRole} from './serie_columns';

import {
  BoundingBox,
  ChartLayoutInterface,
} from '../../visualization/corechart/chart_layout_interface';

// tslint:disable:ban-types Migration

// TODO(b/171999381): Remove this cast when fixed.
const {animationFINISH, animationFRAME_FINISH, READY} =
  ChartEventType as AnyDuringMigration;
const {createHtmlTableRep} = a11y;
const {removeAll} = errors;
const {ANNOTATION, DATA, DIFF_OLD_DATA} = ColumnRole;
const {LINEAR} = EasingType;

/**
 * Constructs a new chart. The chart is rendered by the draw method.
 * Expected data format:
 *   Any number of columns. First column may be of type string and contains
 *   labels. All other columns are numbers.
 * Supported options:
 *   See
 *   https://spreadsheets.google.com/a/google.com/ccc?key=0An9nm791iFJmdHhlUVBhdEg1ODZVYWkyU0FpRDRDV2c&hl=en
 *   for details.
 * @unrestricted
 */
export class CoreChart extends AbstractVisualization {
  private readonly logger: Logger | null;

  /**
   * Enumeration of all old chart types.
   * Old chart type.
   */
  static OLD_CHART_TYPE = {
    LINE: 'line',
    AREA: 'area',
    COLUMNS: 'columns',
    BARS: 'bars',
    SCATTER: 'scatter',
    PIE: 'pie',
  };

  private chartType: optionTypes.ChartType | null = null;

  private orientation: optionTypes.Orientation;

  /**
   * The name of theme to use for the chart.
   */
  private theme: string | null = null;

  /**
   * Keeps reference to ChartDefinition of the chart currently drawn.
   * Can be used as the first layer of a LayeredObject (the second layer of
   * that object will provide the visual effects induced by the current chart
   * state).
   */
  private chartDefinition: ChartDefinition | null = null;

  /**
   * The chart builder.
   */
  private builder: ChartBuilder | null = null;

  /**
   * The chart interactivity definer.
   */
  private interactivityDefiner: ChartInteractivityDefiner | null = null;

  /**
   * The queue of actions that have yet to be added because the chart has not
   * yet initialized.
   */
  private actionsQueue: Array<AnyDuringMigration | string> = [];

  /**
   * The state of the chart. Usually the exact state of chart currently
   * plotted, but can sometime be a bit ahead as it accumulates effects of
   * interaction that have not yet been plotted (but will be plotted within a
   * few fractions of a second).
   */
  private chartState: ChartState | null = null;

  /**
   * The state of the chart that is currently drawn (not BEING drawn, but
   * rather ALREADY drawn). Needed by refresh() to detect whether the chart
   * state has indeed changed since the last draw/refresh operation.
   */
  private drawnchartState: ChartState | null = null;

  /**
   * Holds the frame and the renderer used for drawing.
   */
  private drawingFrame: DrawingFrame | null = null;

  /**
   * Holds information needed in animation mode. Time fields are in
   * milliseconds. Fields with 'prev' refer to the previously drawn frame.
   * Is null if not in animation mode.
   */
  private animation: {
    oldChartDef: ChartDefinition;
    newChartDef: ChartDefinition;
    interpolator: ChartDefinitionInterpolator;
    prevFrameChartDef: ChartDefinition;
    startTime: number;
    endTime: number;
    prevFrameTime: number;
    maxFramesPerSecond: number;
    timer: Timer;
    easingFunction: (p1: number) => number;
    done: boolean;
  } | null = null;

  private readonly interactionEventTarget: EventTarget;

  /**
   * The event handler.
   * Calls refresh() and dispatches events to user on interaction with the
   * chart.
   */
  private eventHandler: EventHandler | null = null;

  private readonly chartEventDispatcher: ChartEventDispatcher;

  /**
   * The event handler of the chart.
   */
  private charteventHandler: ChartEventHandler | null = null;

  /* We defer clearing the renderer until just before the next draw call,
   * to avoid flashing caused by an update of the display that
   * could occur before the next draw.
   */
  deferredClearRenderer: AbstractRenderer | null = null;

  private asyncWrapper?: AnyCallbackWrapper;

  defaultSerieType: AnyDuringMigration;

  firstValueCol: AnyDuringMigration;

  numberOfRows: AnyDuringMigration;

  private savedOptionsLayers?: AnyDuringMigration[];

  private width = 0;
  private height = 0;

  private dataTable?: AbstractDataTable;

  /**
   * Keeps reference to the options of the chart currently drawn.
   */
  private options: Options | null = null;

  /**
   * Keeps reference to features class (not instance).
   */
  private explorerFeatures: typeof ExplorerFeatures;

  /**
   * Customized explorer actions state - stores explorer actions' callbacks
   */
  customExplorerActionCallbacks: {[key: string]: (data?: EventData) => void};

  /**
   * @param container The html container to draw in.
   */
  constructor(container: Element | null) {
    super(container);

    this.logger = getLogger('google.visualization.CoreChart');

    /**
     * Whether the chart orientation is horizontal or vertical. E.g., column
     * chart is horizontal, bar chart is vertical.
     */
    this.orientation = optionTypes.Orientation.HORIZONTAL;

    /**
     * A target for interaction events.
     * The EventHandler listens on it and the ChartBuilder notifies it.
     */
    this.interactionEventTarget = new EventTarget();

    /**
     * Dispatcher of chart events.
     */
    this.chartEventDispatcher = new ChartEventDispatcher(this);

    // from goog.Disposable
    this.registerDisposable(this.chartEventDispatcher);

    this.explorerFeatures = ExplorerFeatures;

    this.customExplorerActionCallbacks = {};
  }

  /**
   */
  override disposeInternal() {
    this.clearInternal();
    dispose(this.interactionEventTarget);
    dispose(this.eventHandler);
    dispose(this.charteventHandler);
    dispose(this.deferredClearRenderer);
    super.disposeInternal();
  }

  /**
   * Initializes the chart definer.
   * @param chartDefiner To be initialized.
   * @param afterInit What to call
   *     after definer is initialized.
   */
  protected initChartDefiner(
    chartDefiner: ChartDefiner,
    afterInit?: (p1: ChartDefiner) => AnyDuringMigration,
  ) {
    asserts.assert(this.asyncWrapper != null);
    // this.asyncWrapper must be defined by this time.
    chartDefiner.init(this.asyncWrapper!, afterInit);
  }

  /**
   * Sets the asyncWrapper for this chart.
   * @param asyncWrapper From AbstractVisualization
   */
  protected setAsyncWrapper(asyncWrapper: AnyCallbackWrapper) {
    /**
     * The AsyncWrapper passed in from the AbstractVisualization.
     */
    this.asyncWrapper = asyncWrapper;
  }

  /**
   * Sets features class for this chart.
   */
  setExplorerFeatures(explorerFeatures: typeof ExplorerFeatures) {
    this.explorerFeatures = explorerFeatures;
  }

  /**
   * Gets features class of this chart.
   */
  getExplorerFeatures() {
    return this.explorerFeatures;
  }

  /**
   * Resets into the default Features class for this chart.
   */
  resetExplorerFeatures() {
    this.explorerFeatures = ExplorerFeatures;
  }

  private preConstructInteractivityDefiner(chartDef: ChartDefinition) {
    const chartDimensions = new Size(this.width, this.height);
    const chartTextStyle: TextStyle = {
      fontName: chartDef.defaultFontName,
      fontSize: chartDef.defaultFontSize,
    } as TextStyle;
    const interactivityModel = chartDef.interactivityModel;
    const focusTarget = chartDef.focusTarget;
    // Note that in Pie chart this would be the number of slices.
    const numberOfSeries = chartDef.series.length;

    const oldActionsMenuDefiner = this.interactivityDefiner
      ? this.interactivityDefiner.getActionsMenuDefiner()
      : undefined;

    asserts.assert(this.options != null);
    asserts.assert(interactivityModel != null);
    // this.options must be defined by now.
    this.interactivityDefiner = this.constructInteractivityDefiner(
      this.options!,
      chartDimensions,
      chartTextStyle,
      interactivityModel,
      focusTarget,
      numberOfSeries,
      oldActionsMenuDefiner,
    );
  }

  // TODO(dlaliberte): The following construct* methods should be abstract,
  // and then we can move the implementation to an abstract AxisChart,
  // which would be inherited by the axis charts.
  // PieChart is the exception, which overrides these methods.

  /**
   * Constructs and initializes the chart definer.
   *
   * @param data The data to be drawn.
   * @param options The options for the chart.
   * @param textMeasureFunction A function for
   *     measuring width and height of text objects.
   * @param width Chart's width.
   * @param height Chart's height.
   * @param afterInit Function to call after
   *     definer is initialized.
   */
  protected constructChartDefiner(
    data: AbstractDataTable,
    options: Options,
    textMeasureFunction: TextMeasureFunction,
    width: number,
    height: number,
    afterInit?: (p1: ChartDefiner) => AnyDuringMigration,
  ): ChartDefiner {
    asserts.assert(this.chartType !== optionTypes.ChartType.PIE);

    let chartDefiner;

    if (this.chartType === optionTypes.ChartType.HISTOGRAM) {
      chartDefiner = new HistogramChartDefiner(
        data,
        options,
        textMeasureFunction,
        width,
        height,
      );
    } else {
      chartDefiner = new AxisChartDefiner(
        data,
        options,
        textMeasureFunction,
        width,
        height,
      );
    }

    this.initChartDefiner(chartDefiner, afterInit);
    return chartDefiner;
  }

  /**
   * Construct the appropriate InteractivityDefiner.
   * @param options The chart configuration options.
   * @param chartDimensions Width and height of the chart.
   * @param chartTextStyle Default text style used
   *     throughout the chart.
   * @param interactivityModel The
   *     interactivity model.
   * @param focusTarget The focus target.
   * @param numberOfSeries The number of series inferred from the data.
   * @param actionsMenuDefiner An
   *     optional actions menu definer.
   */
  protected constructInteractivityDefiner(
    options: Options,
    chartDimensions: Size,
    chartTextStyle: TextStyle,
    interactivityModel: optionTypes.InteractivityModel,
    // Planning to migrate to es6 set, but not all at once.
    // tslint:disable-next-line:deprecation
    focusTarget: Set<optionTypes.FocusTarget>,
    numberOfSeries: number,
    actionsMenuDefiner?: ActionsMenuDefiner,
  ): ChartInteractivityDefiner {
    asserts.assert(this.chartType !== optionTypes.ChartType.PIE);
    return new AxisChartInteractivityDefiner(
      options,
      chartDimensions,
      chartTextStyle,
      interactivityModel,
      focusTarget,
      numberOfSeries,
      actionsMenuDefiner,
    );
  }

  /**
   * Construct the appropriate EventHandler.
   * @param interactionEventTarget The target to
   *     dispatch interaction events to.
   * @param renderer Used for hanging events
   *     on chart elements and obtaining the cursor position.
   * @param overlayArea Used for hanging events
   *     on the overlay area above the chart.
   * @param chartDef The chart definition.
   */
  protected constructEventHandler(
    interactionEventTarget: events.EventTarget,
    renderer: AbstractRenderer,
    overlayArea: OverlayArea,
    chartDef: ChartDefinition,
  ): ChartEventHandler {
    asserts.assert(this.chartType !== optionTypes.ChartType.PIE);
    return new AxisChartEventHandler(
      interactionEventTarget,
      renderer,
      overlayArea,
      chartDef,
    );
  }

  /**
   * Construct the appropriate Builder.
   * @param overlayArea An html element into which
   *     tooltips should be added.
   * @param renderer The drawing renderer.
   */
  protected constructBuilder(
    overlayArea: OverlayArea,
    renderer: AbstractRenderer,
  ): ChartBuilder {
    asserts.assert(this.chartType !== optionTypes.ChartType.PIE);
    return new AxisChartBuilder(overlayArea, renderer);
  }

  /**
   * Sets the chart type. Supports classes such as
   * google.visualization.AreaChart (for internal use only).
   * @param chartType The chart type.
   * @param defaultSerieType Default serie
   *     type.
   * @param orientation Horizontal or
   *     vertical.
   * @param theme The name of theme to use for the chart.
   *
   */
  protected setChartType(
    chartType: optionTypes.ChartType, //
    defaultSerieType?: optionTypes.SerieType,
    orientation?: optionTypes.Orientation, //
    theme?: string,
  ) {
    this.chartType = chartType;
    if (defaultSerieType != null) {
      this.defaultSerieType = defaultSerieType;
    }
    if (orientation != null) {
      this.orientation = orientation;
    }
    if (theme != null) {
      this.theme = theme;
    }
  }

  /**
   * Validates the options and throws an error for invalid options.
   * @param options The options to validate.
   */
  private static validateoptions(options: AnyDuringMigration) {
    // Stacked charts cannot have a non-zero baseline.
    if (
      options['isStacked'] &&
      options['vAxis'] &&
      options['vAxis']['baseline']
    ) {
      throw new Error('Cannot set a non-zero base-line for a stacked chart');
    }
  }

  /**
   */
  override draw(
    dataTable: AbstractDataTable | null, //
    options?: UserOptions, //
    state?: AnyDuringMigration,
  ) {
    // this.maybeMutateToPieChart(
    //     options != null && options!['type'] === 'pie');
    super.draw(dataTable, options, state);
  }

  /**
   */
  drawInternal(
    asyncWrapper: AnyCallbackWrapper, //
    dataTable: AbstractDataTable, //
    options: UserOptions = {},
    state?: AnyDuringMigration,
  ) {
    this.asyncWrapper = asyncWrapper;

    // We deep-clone the options since the convertOptions sometimes changes it.
    // TODO(dlaliberte): make this work: options = gviz.json.clone(options);
    //   or avoid side effects in convertOptions.
    options = gvizJson.deserialize(gvizJson.serialize(options));

    this.updatechartType(options);
    this.updatedefaultSerieType(options);
    options['orientation'] = options['orientation'] || this.orientation;
    options['theme'] = options['theme'] || this.theme;

    if (this.chartType !== optionTypes.ChartType.NONE) {
      CoreChart.convertBrowserchartoptions(options);
    }
    if (
      this.chartType !== optionTypes.ChartType.PIE &&
      Options.convertToBoolean(options['reverseCategories'])
    ) {
      const axisOption =
        options['orientation'] === optionTypes.Orientation.VERTICAL
          ? 'vAxis'
          : 'hAxis';
      options[axisOption] = options[axisOption] || {};
      options[axisOption]['direction'] = -1;
      delete options['reverseCategories'];
    }
    CoreChart.convertDeprecatedoptions(options);

    const container = this.getContainer();
    removeAll(container);
    if (!dataTable) {
      throw new Error('Data table is not defined');
    }

    // Handles drawing in diff mode.
    const isDiffData = some(
      range(dataTable.getNumberOfColumns()),
      (i) => dataTable.getColumnRole(i) === DIFF_OLD_DATA,
    );
    if (isDiffData) {
      options['isDiff'] = true;
    }

    const firstColIsLabels = dataTable.getColumnType(0) !== 'number';
    this.firstValueCol = firstColIsLabels ? 1 : 0;
    this.numberOfRows = dataTable.getNumberOfRows();

    this.clearInteractionEvents();

    const optionsLayers = this.getOptionsLayers(options);

    // Here's where things get tricky... now we have a layer of options, and we
    // should check all options layers for fonts.
    // TODO(dlaliberte): Make the Options object return all fonts?
    const fonts: AnyDuringMigration[] = [];
    const fontPredicate = WebFontLoader.fontPredicate('fontName');
    forEach(optionsLayers, (obj) => {
      fonts.push(...findValuesRecursive(obj, fontPredicate));
    });

    /**
     * Save the options layers, as modified up to this point.
     * This will be reused when refreshing.
     */
    this.savedOptionsLayers = optionsLayers;

    // Use a clone of the optionsLayers array so the layers may be modified.
    // Must recreate this.options from a clone each time a refresh occurs.
    this.options = new Options(clone(this.savedOptionsLayers));

    this.chartType = this.options.inferStringValue(
      'type',
      optionTypes.ChartType.NONE as AnyDuringMigration,
      // tslint:disable-next-line:no-enum-object-escape
      optionTypes.ChartType as AnyDuringMigration,
    ) as optionTypes.ChartType;

    /**
     * The width of the container.
     */
    this.width = this.getWidth(this.options);

    /**
     * The height of the container.
     */
    this.height = this.getHeight(this.options);

    // Creating the frame if it does not exist already (due to previous draw).
    const dimensions = new Size(this.width, this.height);
    const forceIFrame = this.options.inferBooleanValue('forceIFrame');
    if (!this.drawingFrame || this.drawingFrame.isDisposed()) {
      try {
        this.drawingFrame = new DrawingFrame(
          this.container,
          dimensions,
          asyncWrapper,
          forceIFrame,
        );
      } catch (e) {
        throw new Error(MSG_NOT_SUPPORTED);
      }
    } else {
      this.drawingFrame.update(dimensions, asyncWrapper);
    }

    this.chartState = new ChartState(state);

    /**
     * The AbstractDataTable being drawn.
     */
    this.dataTable = dataTable;

    if (fonts.length && this.fontWaitResolver) {
      this.fontWaitResolver.promise.then(() => {
        // Completes the draw once the renderer is ready and fonts are loaded.
        this.drawingFrame!.waitUntilReady(
          this.completeTheDraw.bind(this),
          asyncWrapper,
        );
      });
      this.setResolverReject((message) => {
        // warning(this.logger, message);  Something busted in type of message.
        warning(this.logger, 'Going to use fallback fonts.');
        // Completes the draw once the renderer is ready and uses fallback
        // fonts.
        this.drawingFrame!.waitUntilReady(
          this.completeTheDraw.bind(this),
          asyncWrapper,
        );
      });
      // Constructing a WebFontLoader has the side-effect of loading fonts.
      // tslint:disable-next-line:no-unused-expression
      new WebFontLoader(fonts, this.fontWaitResolver);
    } else {
      // If we don't have a resolver, we just draw with fallback fonts.
      // Completes the draw once the renderer is ready.
      this.drawingFrame.waitUntilReady(
        this.completeTheDraw.bind(this),
        asyncWrapper,
      );
    }
  }

  /**
   * Returns an array of options layers composed from themes, user options,
   * and default options based on the chart type, and general options.
   */
  private getOptionsLayers(userOptions: UserOptions): UserOptions[] {
    // TODO(dlaliberte): This should be a optionTypes.ChartType-specific
    // validation.
    CoreChart.validateoptions(userOptions);

    // The 'theme' option value can be an array of themes or a single theme.
    // Each theme can be either a string name of a theme, or a UserOptions.
    let themes = userOptions['theme'] || [];
    if (themes && !Array.isArray(themes)) {
      themes = [themes];
    }
    // The options in the early layers get precedence over the later ones.
    // So we start with user options, and push default options after that.
    const optionsLayers: UserOptions[] = [userOptions];
    for (let i = 0; i < themes.length; i++) {
      let theme = themes[i];
      if (typeof theme === 'string') {
        // Get theme options by name.
        theme = getTheme(theme);
      } else {
        if (goog.isObject(theme)) {
          // The theme value is already an object.
          // It might be a Options object or a generic user options object.
          if (theme instanceof Options) {
            // Must flatten into a single layer.
            theme = theme.flattenLayers();
          }
        } else {
          throw new Error('Theme must be a theme name or an options object.');
        }
      }
      if (theme) {
        optionsLayers.push(theme);
      }
    }

    // optionTypes.ChartType-specific options
    const chartType = userOptions['type'].toLowerCase();
    if ((CHART_SPECIFIC_DEFAULTS as AnyDuringMigration)[chartType]) {
      optionsLayers.push(
        (CHART_SPECIFIC_DEFAULTS as AnyDuringMigration)[chartType],
      );
    }

    // General options.
    // TODO(dlaliberte): switch gviz.canviz.Options to gviz.canviz.options. (i.e. as
    // a namespace).
    optionsLayers.push(DEFAULTS);

    return optionsLayers;
  }

  /**
   * Continue drawing the chart after it was initialized.
   *
   */
  private completeTheDraw() {
    const renderer = this.drawingFrame!.getRenderer();
    asserts.assert(renderer != null);
    const overlayArea = this.drawingFrame!.getOverlayArea();
    asserts.assert(overlayArea != null);

    const options = this.options as Options;

    const afterInit = (chartDefiner: AnyDuringMigration) => {
      this.clearRenderer();

      const newChartDef = chartDefiner.getChartDefinition();

      const explorerFeatures = new this.explorerFeatures(
        options,
        this.chartState as ChartState,
        this.getChartLayoutInterface.bind(this),
        newChartDef,
      );
      this.customExplorerActionCallbacks =
        explorerFeatures.getCustomRegisteredActions();

      dispose(this.eventHandler);
      this.eventHandler = new EventHandler(
        newChartDef,
        this.chartState as ChartState,
        this.interactionEventTarget,
        this.chartEventDispatcher,
        // In event-initiated refresh(), we always want to dispatch events.
        this.refresh.bind(this, true),
        explorerFeatures,
      );

      this.preConstructInteractivityDefiner(newChartDef);

      this.setupActionsMenu();

      // These should still be good.
      asserts.assert(overlayArea != null);
      asserts.assert(renderer != null);
      this.builder = this.constructBuilder(overlayArea!, renderer!);

      if (!this.setupanimation(newChartDef)) {
        // Not animating.
        this.chartDefinition = newChartDef;
        this.drawStateInducedchartDefinition();
        this.listenToChartEvents();
      }
      this.drawAccessibilityTable();

      // Corechart afterInit, about to dispatch ready event.
      this.chartEventDispatcher.dispatchEvent(READY);
      this.eventHandler.handleReady();
    };
    // end of afterInit

    this.constructChartDefiner(
      this.dataTable!,
      options,
      renderer!.getTextSize.bind(renderer),
      this.width,
      this.height,
      afterInit,
    );
  }

  /**
   * Returns customized explorer actions to be called as callbacks
   *
   */
  triggerExplorerAction(key: string, data?: EventData) {
    if (this.customExplorerActionCallbacks?.[key]) {
      this.customExplorerActionCallbacks[key]?.(data);
    }
  }

  /**
   * Draw accessibility table for this chart
   */
  private drawAccessibilityTable() {
    /* Defer until after chart rendering is done.
     *
     * There are actually three levels of drawing going on here.
     *
     * The lowest level is one draw() call without animation.  We don't
     * necessarily want the accessibility table after this point, depending
     * on what happens next.
     *
     * The second level is the sequence of animation draws, via
     * builder.drawChart(), and so the accessibility table will not be
     * generated by those draws, and only for the final state after animation.
     * However, the animation setup has finished before the animation itself
     * is finished (asynchronously via a Timer), so we can't detect that the
     * animation is done, unless we listen for a 'animationfinished' event.
     *
     * Finally, the user may be doing a sequence of animated draws,
     * each one triggered by a user event or a 'ready' event once the previous
     * animation is done.  Again, we don't really want the accessibility table
     * until all this is done.  But a chart might be continually updated, say
     * from a live stream, and then there would never be a time to generate the
     * accessibility table.
     *
     * Generally, we need more control and options regarding accessibility,
     * and sensitivity to end-user requirements.
     *
     * TODO(dlaliberte): Should at least defer until after animation is done.
     * Attaching a listener to the chart in the middle of a draw could be weird.
     */
    const renderer = this.drawingFrame!.getRenderer();
    setTimeout(() => {
      if (renderer && renderer.createAccessibilityContainer) {
        const aContainer = renderer.createAccessibilityContainer();
        if (aContainer && this.dataTable) {
          const safeHtml = createHtmlTableRep(this.dataTable);
          safeElement.setInnerHtml(aContainer, safeHtml);
        }
      }
    }, 0);
  }

  /**
   * Merges datatables, computing the diff of DataTables with old and new data.
   * Useful when drawing chart with diff of two datatables.
   *
   * @param oldDataTable The DataTable that has
   *     the old data for the chart.
   * @param newDataTable The DataTable that has
   *     the new data for the chart.
   * @return table with joined data.
   */
  computeDiff(oldDataTable: DataTable, newDataTable: DataTable): DataTable {
    if (this.chartType === optionTypes.ChartType.PIE) {
      // Manual override
      return this.computeDiffInternal(oldDataTable, newDataTable);
    } else {
      throw new Error('Cannot compute diff for this chart type.');
    }
  }

  /**
   * Merges datatables, computing the diff of DataTables with old and new data.
   * Useful when drawing chart with diff of two datatables.
   *
   * @param oldDataTable The DataTable that has the old data for the chart.
   * @param newDataTable The DataTable that has the new data for the chart.
   * @return table with joined data.
   */
  protected computeDiffInternal(
    oldDataTable: DataTable | null,
    newDataTable: DataTable | null,
  ): DataTable {
    if (!oldDataTable || !newDataTable) {
      throw new Error('Old and New DataTables must exist.');
    }
    // Creates diff datatable columns.
    // Assumes that there is a 1-to-1 match of columns
    // in oldDataTable and newDataTable.
    asserts.assert(
      oldDataTable.getColumnType(0) === newDataTable.getColumnType(0),
    );
    asserts.assert(
      oldDataTable.getNumberOfRows() === newDataTable.getNumberOfRows(),
    );
    asserts.assert(
      oldDataTable.getNumberOfColumns() === newDataTable.getNumberOfColumns(),
    );

    const oldData = oldDataTable;
    const newData = newDataTable;

    const diffDataTable = new DataTable();
    const rowsCount = newData.getNumberOfRows();
    const colsCount = newData.getNumberOfColumns();

    // Must add first column only once when it is not a number.
    const firstColIsLabels = oldData.getColumnType(0) !== 'number';
    if (firstColIsLabels) {
      diffDataTable.addColumn(
        oldData.getColumnType(0),
        oldData.getColumnLabel(0),
      );
    }
    const firstValueCol = firstColIsLabels ? 1 : 0;

    for (let colIndex = firstValueCol; colIndex < colsCount; ++colIndex) {
      // Adds old data column label.
      diffDataTable.addColumn({
        'type': oldData.getColumnType(colIndex) as ColumnTypeUnion,
        'label': oldData.getColumnLabel(colIndex),
        'role': DIFF_OLD_DATA,
      });
      // Adds new data column label.
      diffDataTable.addColumn({
        'type': newData.getColumnType(colIndex) as ColumnTypeUnion,
        'label': newData.getColumnLabel(colIndex),
        'role': DATA,
      });
    }

    // Creates diff datatable rows.
    diffDataTable.addRows(rowsCount);
    for (let rowIndex = 0; rowIndex < rowsCount; ++rowIndex) {
      // If first column is not number, it is shared among datatables.
      let label = null;
      if (firstColIsLabels) {
        label = newData.getValue(rowIndex, 0);
        diffDataTable.setCell(rowIndex, 0, label);
      }

      // Stores columns values.
      let rowLength = firstValueCol;
      for (let colIndex = firstValueCol; colIndex < colsCount; ++colIndex) {
        // Old data column.
        const oldValue = oldData.getValue(rowIndex, colIndex);
        diffDataTable.setCell(rowIndex, rowLength, oldValue);
        rowLength += 1;
        // New data column.
        const newValue = newData.getValue(rowIndex, colIndex);
        diffDataTable.setCell(rowIndex, rowLength, newValue);
        rowLength += 1;
      }
    }
    return diffDataTable;
  }

  /**
   * Ensures options['type'] is populated. Either it's already populated, or set
   * it from the class.
   *
   * @param options The options object.
   */
  private updatechartType(options: AnyDuringMigration) {
    // The idea behind the following switch is to support the old style
    // options['type']. It's used by GWT users, so we can't break it.
    switch (options['type']) {
      case CoreChart.OLD_CHART_TYPE.LINE:
        this.setChartType(
          optionTypes.ChartType.FUNCTION, //
          optionTypes.SerieType.LINE, //
          optionTypes.Orientation.HORIZONTAL,
        );
        options['type'] = null;
        break;
      case CoreChart.OLD_CHART_TYPE.AREA:
        this.setChartType(
          optionTypes.ChartType.FUNCTION, //
          optionTypes.SerieType.AREA, //
          optionTypes.Orientation.HORIZONTAL,
        );
        options['type'] = null;
        break;
      case CoreChart.OLD_CHART_TYPE.COLUMNS:
        this.setChartType(
          optionTypes.ChartType.FUNCTION, //
          optionTypes.SerieType.BARS, //
          optionTypes.Orientation.HORIZONTAL,
        );
        options['type'] = null;
        break;
      case CoreChart.OLD_CHART_TYPE.BARS:
        this.setChartType(
          optionTypes.ChartType.FUNCTION, //
          optionTypes.SerieType.BARS, //
          optionTypes.Orientation.VERTICAL,
        );
        options['type'] = null;
        break;
      case CoreChart.OLD_CHART_TYPE.SCATTER:
        this.setChartType(optionTypes.ChartType.SCATTER);
        options['type'] = null;
        break;
      case CoreChart.OLD_CHART_TYPE.PIE:
        this.setChartType(optionTypes.ChartType.PIE);
        options['type'] = null;
        break;
      default:
        break;
    }

    let chartTypeFromClass = this.chartType;
    if (chartTypeFromClass === optionTypes.ChartType.NONE) {
      chartTypeFromClass = null;
    }
    let chartTypeFromOptions = options['type'] || optionTypes.ChartType.NONE;
    if (chartTypeFromOptions === optionTypes.ChartType.NONE) {
      chartTypeFromOptions = null;
    }

    if (!chartTypeFromClass && !chartTypeFromOptions) {
      throw new Error('Unspecified chart type.');
    }
    if (
      chartTypeFromClass &&
      chartTypeFromOptions &&
      chartTypeFromClass !== chartTypeFromOptions
    ) {
      throw new Error('Incompatible chart types.');
    }
    // At this point, the two chart types are either both specified and the
    // same, or exactly one of them is specified.
    options['type'] = chartTypeFromClass || chartTypeFromOptions;
  }

  /**
   * Makes an effort to populate options['seriesType']. Either it's already
   * populated, or try to set it from the class.
   *
   * @param options The options object.
   */
  private updatedefaultSerieType(options: AnyDuringMigration) {
    if (options['type'] !== optionTypes.ChartType.FUNCTION) {
      return;
    }

    let defaultSerieTypeFromClass = this.defaultSerieType;
    if (defaultSerieTypeFromClass === optionTypes.SerieType.NONE) {
      defaultSerieTypeFromClass = null;
    }
    let defaultSerieTypeFromOptions =
      options['seriesType'] || optionTypes.SerieType.NONE;
    if (defaultSerieTypeFromOptions === optionTypes.SerieType.NONE) {
      defaultSerieTypeFromOptions = null;
    }

    if (
      defaultSerieTypeFromClass &&
      defaultSerieTypeFromOptions &&
      defaultSerieTypeFromClass !== defaultSerieTypeFromOptions
    ) {
      throw new Error('Incompatible default series types.');
    }
    // At this point, the two serie types are either both specified and the
    // same, or one of them is unspecified, or both are unspecified).
    options['seriesType'] =
      defaultSerieTypeFromClass || defaultSerieTypeFromOptions;
  }

  /**
   * Converts old style options to the new canviz charts options according to
   * the provided type. The changes are done in-place but we copy the options in
   * advance.
   *
   * @param options The options object.
   */
  private static convertBrowserchartoptions(options: AnyDuringMigration) {
    options['hAxis'] = options['hAxis'] || {};
    options['vAxis'] = options['vAxis'] || {};
    const hAxis = options['hAxis'];
    const vAxis = options['vAxis'];

    let targetAxis = null;
    switch (options['type']) {
      case optionTypes.ChartType.SCATTER:
        targetAxis = vAxis;
        break;
      case optionTypes.ChartType.FUNCTION:
        options['targetAxis'] = options['targetAxis'] || {};
        targetAxis = options['targetAxis'];
        break;
      default:
        break;
    }

    if (targetAxis) {
      CoreChart.convertOption(options, 'min', targetAxis, 'minValue');
      CoreChart.convertOption(options, 'max', targetAxis, 'maxValue');
      CoreChart.convertOption(options, 'logScale', targetAxis, 'logScale');
    }

    if (hAxis) {
      CoreChart.convertOption(options, 'logScaleX', hAxis, 'logScale');
      CoreChart.convertOption(options, 'titleX', hAxis, 'title');
    }
    if (vAxis) {
      CoreChart.convertOption(options, 'titleY', vAxis, 'title');
    }

    if (options['smoothLine'] && options['curveType'] === undefined) {
      options['curveType'] = 'function';
    }
    CoreChart.convertOption(options, 'lineSize', options, 'lineWidth');
    CoreChart.convertOption(
      options,
      'reverseAxis',
      options,
      'reverseCategories',
    );

    options['chartArea'] = options['chartArea'] || {};
    const chartArea = options['chartArea'];
    CoreChart.convertOption(
      options,
      'axisBackgroundColor',
      chartArea,
      'backgroundColor',
    );
  }

  /**
   * Converts canviz options that we decided to change, but keep backwards
   * compatibility. The changes are done in-place but we copy the options in
   * advance.
   * TODO(dlaliberte): Add tests of converting deprecated options.
   *
   * @param options The options object.
   */
  private static convertDeprecatedoptions(options: AnyDuringMigration) {
    CoreChart.convertTextStyleoptions(
      options,
      'titleColor',
      'titleFontSize',
      'titleTextStyle',
    );
    CoreChart.convertTextStyleoptions(
      options,
      'legendTextColor',
      'legendFontSize',
      'legendTextStyle',
    );
    CoreChart.convertDeprecatedAxisoptions(options['hAxis']);
    const hAxes = options['hAxes'] || {};
    for (const key in hAxes) {
      if (!hAxes.hasOwnProperty(key)) continue;
      CoreChart.convertDeprecatedAxisoptions(hAxes[key]);
    }
    const vAxes = options['vAxes'] || {};
    CoreChart.convertDeprecatedAxisoptions(options['vAxis']);
    for (const key in vAxes) {
      if (!vAxes.hasOwnProperty(key)) continue;
      CoreChart.convertDeprecatedAxisoptions(vAxes[key]);
    }
    CoreChart.convertDeprecatedTooltipoptions(options);
    CoreChart.convertDeprecatedLegendoptions(options);
    CoreChart.convertDeprecatedAnimationoptions(options);
  }

  /**
   * Converts canviz axis options that we decided to change, but keep backwards
   * compatibility.
   *
   * @param axisOptions The axis options object.
   */
  private static convertDeprecatedAxisoptions(axisOptions: AnyDuringMigration) {
    if (axisOptions == null) {
      return;
    }
    CoreChart.convertTextStyleoptions(
      axisOptions,
      'textColor',
      'textFontSize',
      'textStyle',
    );
    CoreChart.convertTextStyleoptions(
      axisOptions,
      'titleColor',
      'titleFontSize',
      'titleTextStyle',
    );
    CoreChart.convertDeprecatedGridlineoptions(axisOptions);
  }

  /**
   * Converts canviz tooltip options that we decided to change, but keep
   * backwards compatibility. 'tooltipTextColor' + 'tooltipFontSize' are now
   * 'tooltip.textStyle'. 'tooltipTextStyle' is now 'tooltip.textStyle'.
   * 'tooltipText' is now 'tooltip.text'.
   * 'tooltipTrigger' is now 'tooltip.trigger'.
   *
   * @param options The options object.
   */
  private static convertDeprecatedTooltipoptions(options: AnyDuringMigration) {
    let tooltipOptions = options['tooltip'];
    if (tooltipOptions == null) {
      tooltipOptions = {};
      options['tooltip'] = tooltipOptions;
    }

    // Temporarily convert 'tooltipTextColor' + 'tooltipFontSize' into
    // 'tooltipTextStyle'.
    CoreChart.convertTextStyleoptions(
      options,
      'tooltipTextColor',
      'tooltipFontSize',
      'tooltipTextStyle',
    );

    // 'tooltipTextStyle' is now 'tooltip.textStyle'.
    CoreChart.convertOption(
      options,
      'tooltipTextStyle',
      tooltipOptions,
      'textStyle',
    );

    // 'tooltipText' is now 'tooltip.text'.
    CoreChart.convertOption(options, 'tooltipText', tooltipOptions, 'text');

    // 'tooltipTrigger' is now 'tooltip.trigger'.
    CoreChart.convertOption(
      options,
      'tooltipTrigger',
      tooltipOptions,
      'trigger',
    );
    // 'hover' has been renamed 'focus'.
    if (tooltipOptions['trigger'] === 'hover') {
      tooltipOptions['trigger'] = 'focus';
    }
  }

  /**
   * Converts canviz legend options that we decided to change, but keep
   * backwards compatibility. 'legend' as string to indicate the legend position
   * is deprecated and is now an object. The legend position is defined at
   * 'legend.position'. 'legendTextStyle' is now 'legend.textStyle'.
   *
   * @param options The options object.
   */
  private static convertDeprecatedLegendoptions(options: AnyDuringMigration) {
    let legendOptions = options['legend'];
    if (legendOptions == null) {
      legendOptions = {};
      options['legend'] = legendOptions;
    } else if (typeof legendOptions === 'string') {
      const position = legendOptions;
      legendOptions = {};
      options['legend'] = legendOptions;
      legendOptions['position'] = position;
    }
    CoreChart.convertOption(
      options,
      'legendTextStyle',
      legendOptions,
      'textStyle',
    );
  }

  /**
   * Converts animation options that we decided to change, but keep backwards
   * compatibility.
   * 'animation' as number to indicate the animation duration is deprecated and
   * is now an object. The animation duration is defined at
   * 'animation.duration'. 'animationEasing' is now 'animation.easing'.
   *
   * @param options The options object.
   */
  private static convertDeprecatedAnimationoptions(
    options: AnyDuringMigration,
  ) {
    let animationOptions = options['animation'];
    if (animationOptions == null) {
      animationOptions = {};
      options['animation'] = animationOptions;
    } else if (typeof animationOptions === 'number') {
      const duration = animationOptions * 1000;
      // The old option was in seconds.
      animationOptions = {};
      options['animation'] = animationOptions;
      animationOptions['duration'] = duration;
    }
    CoreChart.convertOption(
      options,
      'animationEasing',
      animationOptions,
      'easing',
    );
  }

  /**
   * Converts gridline options that we decided to change, but keep backwards
   * compatibility.
   * 'numberOfSections' has been replaced by 'gridlines.count'.
   * 'gridlineColor' has been replaced by 'gridlines.color'.
   *
   * @param axisOptions The axis options object.
   */
  private static convertDeprecatedGridlineoptions(
    axisOptions: AnyDuringMigration,
  ) {
    axisOptions['gridlines'] = axisOptions['gridlines'] || {};
    const gridlineOptions = axisOptions['gridlines'];

    const numberOfSections = axisOptions['numberOfSections'];
    if (
      gridlineOptions['count'] === undefined &&
      numberOfSections !== undefined &&
      typeof numberOfSections === 'number'
    ) {
      gridlineOptions['count'] = numberOfSections + 1;
    }

    const gridlineColor = axisOptions['gridlineColor'];
    if (gridlineOptions['color'] === undefined && gridlineColor !== undefined) {
      gridlineOptions['color'] = gridlineColor;
    }
  }

  /**
   * Converts old (browserchart) text-style options to the new corechart
   * options. Specifically, the old options had separate option for color and
   * font size, and the new options have a text-style structure the holds both
   * (and other text-style related) options.
   *
   * @param options The options object.
   * @param oldColorOption The name of the old color option.
   * @param oldFontSizeOption The name of the old font size option.
   * @param newTextStyleOption The name of the new text-style option.
   */
  private static convertTextStyleoptions(
    options: AnyDuringMigration,
    oldColorOption: string,
    oldFontSizeOption: string,
    newTextStyleOption: string,
  ) {
    options[newTextStyleOption] = options[newTextStyleOption] || {};
    const textStyle = options[newTextStyleOption];
    CoreChart.convertOption(options, oldColorOption, textStyle, 'color');
    CoreChart.convertOption(options, oldFontSizeOption, textStyle, 'fontSize');
  }

  /**
   * Converts a single option from old style to new style. If old option is set
   * and new option is not set, copy from old to new. If new option is set, keep
   * as is and don't override it with the old option. The options object to
   * write to can be the same as the options object to read from, or can be
   * different.
   *
   * @param options The options object to read from.
   * @param oldOption The name of the old option.
   * @param targetOptions The name of the options object to write to.
   * @param newOption The name of the new option.
   */
  private static convertOption(
    options: AnyDuringMigration,
    oldOption: string,
    targetOptions: AnyDuringMigration,
    newOption: string,
  ) {
    if (
      options[oldOption] !== undefined &&
      targetOptions[newOption] === undefined
    ) {
      targetOptions[newOption] = options[oldOption];
    }
  }

  /**
   * Remove the chart's frame, and any memory allocated for this chart.
   */
  override clearInternal() {
    // The following allows re-drawing using the same chart instance.
    this.stopanimation();
    this.clearInteractionEvents();
    this.clearRenderer();
    dispose(this.drawingFrame);
    events.removeAll(this);
  }

  /**
   * Clears the interaction events and event handler.
   */
  private clearInteractionEvents() {
    if (this.eventHandler && !this.eventHandler.isDisposed()) {
      this.eventHandler.cancelPendingEvents();
    }
    dispose(this.eventHandler);

    if (this.drawingFrame && !this.drawingFrame.isDisposed()) {
      const renderer = this.drawingFrame.getRenderer();
      asserts.assert(renderer != null);
      const overlayArea = this.drawingFrame.getOverlayArea();
      asserts.assert(overlayArea != null);

      // Defer clearing the renderer until just before drawing
      // to avoid flashing caused by an update of the display that
      // can occur before then.
      // So don't call renderer.clear() here.
      // See clearRenderer();
      this.deferredClearRenderer = renderer;
      overlayArea!.clear();
    }

    dispose(this.charteventHandler);

    events.removeAll(this.interactionEventTarget);
  }

  /**
   * Really clears the render, even if the clear was deferred.
   *
   */
  private clearRenderer() {
    const renderer =
      this.deferredClearRenderer ||
      (this.drawingFrame && this.drawingFrame.getRenderer());
    this.deferredClearRenderer = null;
    if (renderer) {
      renderer.clear();
    }
  }

  /**
   * Adds or modifies an action with the specified ID.
   */
  private setupActionsMenu() {
    forEach(this.actionsQueue, (action) => {
      if (typeof action === 'string') {
        this.removeAction(action);
      } else {
        this.setAction(action as ActionsMenuDefinition);
      }
    });
    this.actionsQueue = [];
  }

  /**
   * Adds or modifies an action with the specified ID.
   * @param action The action definition.
   */
  setAction(action: ActionsMenuDefinition) {
    if (this.interactivityDefiner != null) {
      this.interactivityDefiner.setAction(action);
    } else {
      this.actionsQueue.push(action);
    }
  }

  /**
   * Validates the given selection.
   * @param selected An array that contains indices of the
   *     selected elements.
   * @return True if the selection is valid, otherwise - false.
   */
  private validateSelection(selected: AnyDuringMigration[] | null): boolean {
    const selection = new Selection();
    selection.setSelection(selected);

    // Validate selected cells.
    // TODO(dlaliberte): Implement selection validation also for rows and columns.
    const selectedCells = selection.getCells();
    let foundSelectedAnnotation = false;
    for (let i = 0; i < selectedCells.length; i++) {
      const selectedCell = selectedCells[i];
      const columnIndex = selectedCell.column;
      const rowIndex = selectedCell.row;
      const columnInfo =
        this.chartDefinition!.dataTableColumnRoleInfo &&
        this.chartDefinition!.dataTableColumnRoleInfo[columnIndex];
      if (!columnInfo) {
        // Illegal selection: column does not exist in the data table.
        return false;
      }
      const serieIndex = columnInfo.serieIndex;
      let category;
      let datum;

      if (serieIndex != null) {
        const serie = this.chartDefinition!.series[serieIndex];
        datum = serie.points[rowIndex];
      } else {
        category = this.chartDefinition!.categories[rowIndex];
      }
      if (!datum && !category) {
        // Illegal selection: selected row does not exist in the data table.
        return false;
      }
      if (columnInfo.role === ANNOTATION) {
        if (foundSelectedAnnotation) {
          // Illegal selection: cannot select multiple annotations.
          return false;
        }
        foundSelectedAnnotation = true;
        const datumOrCategory = (datum || category)!;
        const annotation = (datumOrCategory as AnyDuringMigration).annotation;
        if (!annotation) {
          // Illegal selection: cannot select null annotations.
          // TODO(dlaliberte): Our policy is not consistent, as we do allow
          // selection of null data values. Do we want to change this? Need to
          // re-think.
          return false;
        }
      }
    }

    // Passed all validations.
    return true;
  }

  /**
   * Sets the selection of the chart
   * @param selected An array that contains indices of the
   *     selected elements.
   */
  setSelection(selected: SelectionObject[] | null) {
    // Don't do anything if the selection is not valid.
    if (!this.validateSelection(selected)) {
      return;
    }

    // Axis charts: make sure that the selected annotation is visible, by
    // expanding its bundle.
    let selectedAnnotation = null;
    if (this.chartDefinition!.chartType !== optionTypes.ChartType.PIE) {
      const selection = new Selection();
      selection.setSelection(selected);
      const selectedCells = selection.getCells();
      for (let i = 0; i < selectedCells.length; i++) {
        const selectedCell = selectedCells[i];
        const selectedColumn = selectedCell.column;
        const selectedColumnInfo =
          this.chartDefinition!.dataTableColumnRoleInfo[selectedColumn];
        if (selectedColumnInfo.role === ANNOTATION) {
          const serieIndex = selectedColumnInfo.serieIndex;
          const selectedRow = selectedCell.row;
          selectedAnnotation = {
            serieIndex,
            datumOrCategoryIndex: selectedRow,
          };
          break;
        }
      }
    }

    // Flush any refresh() call awaiting execution on the next scheduler tick,
    // to dispatch the pending events to the user.
    this.refresh(true);

    // Update the chart state with the new selection.
    this.chartState!.selected.setSelection(selected);
    if (selectedAnnotation) {
      this.chartState!.annotations.expanded =
        selectedAnnotation as AnyDuringMigration;
    }

    // Refresh the drawn chart, yet avoid dispatching events based on changes
    // made to the chart state by this call to setSelection().
    this.refresh(false);
  }
  // Now if the scheduler ticks, refresh() will discover that the chart state
  // has not changed and return promptly.

  /**
   * Refresh the second layer of the chart definition (visual effects) according
   * to the updated chart state, and call the builder so it can redraw the chart
   * or parts of it.
   * @param dispatchEvents Whether to dispatch events to user.
   */
  private refresh(dispatchEvents: boolean) {
    asserts.assert(this.chartDefinition != null);
    asserts.assert(this.chartState != null);
    if (!this.drawnchartState) {
      return;
    }

    const previousChartState = this.drawnchartState;

    // If the sequence of the event handling operations done since the last
    // refresh/draw attempt resulted in the same state (as far as the
    // interactivity definer is concerned), then there is no need to refresh the
    // chart.
    if (
      !this.interactivityDefiner!.equalChartStates(
        this.chartState!,
        this.drawnchartState,
      )
    ) {
      const nextFrameOptions = this.chartState!.nextFrameOptions;
      let interactivityLayer;
      // TODO(dlaliberte): Refactor the following to move most of the
      // logic into the builder.  Also, it's very convoluted and fragile.
      if (!nextFrameOptions) {
        // NOTE(grabks): This needs to be done before the interactivity is
        // processed, because the interactivity might call user functions (e.g.
        // to determine if a tooltip action is visible), and the chart's state
        // must report the right selection.
        this.drawnchartState = this.chartState!.clone();
        interactivityLayer =
          this.interactivityDefiner!.generateInteractivityLayer(
            this.chartDefinition!,
            this.chartState!,
          );
        this.builder!.refreshChart(this.chartDefinition!, interactivityLayer);
      } else {
        // We must recreate this.options here from a clone of the saved
        // layers.  This is because the layers will be modified here and
        // by the chart definer.
        this.options = new Options(clone(this.savedOptionsLayers!));
        this.options.insertLayer(0, nextFrameOptions);

        const renderer = this.drawingFrame!.getRenderer();
        const newChartDef = this.constructChartDefiner(
          this.dataTable!,
          this.options,
          renderer!.getTextSize.bind(renderer),
          this.width,
          this.height,
        ).getChartDefinition();
        this.eventHandler!.setChartDefinition(newChartDef);
        if (this.deferredClearRenderer) {
          // Now we can clear the render since we are about to draw again.
          this.deferredClearRenderer.clear();
          this.deferredClearRenderer = null;
        }
        if (
          this.charteventHandler &&
          this.charteventHandler instanceof AxisChartEventHandler
        ) {
          this.charteventHandler.updateChartDefinition(newChartDef);
        }
        interactivityLayer =
          this.interactivityDefiner!.generateInteractivityLayer(
            newChartDef,
            this.chartState!,
          );
        this.chartDefinition = newChartDef;

        // Must revert previous interactivity layer before redrawing.
        this.builder!.revertChartContentChanges(this.chartDefinition);
        this.builder!.redrawChart(this.chartDefinition, interactivityLayer);
        this.chartState!.nextFrameOptions = null;
        this.drawnchartState = this.chartState!.clone();
      }
    }

    if (dispatchEvents) {
      // Event dispatching must be the last operation (drawn chart state must be
      // up to date in case the user accesses it from an event listener).
      this.chartEventDispatcher.dispatchByStateChange(
        previousChartState,
        this.drawnchartState,
        this.chartDefinition!.chartType,
        this.chartDefinition!.series as AnyDuringMigration[],
      );
    }
  }

  /**
   * Returns the selected properties as an array of objects each of which has a
   * property containing the index number of a selected property.
   * @return The selected properties.
   * TODO(b/186545060): Should return SelectionObject[], after bug is fixed.
   */
  getSelection(): AnyDuringMigration[] {
    // The event handlers update the state immediately (and not after a
    // scheduler tick), but we wish to give the user information which is
    // consistent with the chart that is currently drawn chart. Therefore, we
    // return the selection of the drawn state and not of the state which will
    // soon be applied.
    if (!this.drawnchartState) {
      return [];
    }
    return this.drawnchartState.selected.getSelection();
  }

  /**
   * Gets the action with the specified ID.
   * @param action The action definition.
   * @return The action definition or
   *     undefined.
   */
  getAction(action: string): ActionsMenuDefinition | null | undefined {
    if (!this.interactivityDefiner) {
      return undefined;
    }
    return this.interactivityDefiner.getAction(action);
  }

  /**
   * Removes the action with the given action ID.
   * @param action The action ID that should be removed.
   */
  removeAction(action: string) {
    if (this.interactivityDefiner != null) {
      this.interactivityDefiner.removeAction(action);
    } else {
      this.actionsQueue.push(action);
    }
  }

  /**
   * Returns the internal SVG representation of the current chart if the
   * renderer was indeed SVG renderer. Otherwise an empty string is returned.
   * @return The internal SVG representation.
   */
  dump(): string {
    const renderer = this.drawingFrame!.getRenderer();
    return renderer! instanceof SvgRenderer ? renderer.getInternalSvg() : '';
  }

  /**
   * Applies the visual effects induced by the chart state to the chart
   * definition, and draws the resulting chart.
   */
  private drawStateInducedchartDefinition() {
    asserts.assert(this.chartDefinition != null);
    asserts.assert(this.chartState != null);

    const interactivityLayer =
      this.interactivityDefiner!.generateInteractivityLayer(
        this.chartDefinition!,
        this.chartState!,
      );

    this.builder!.drawChart(this.chartDefinition!, interactivityLayer);
    this.drawnchartState = this.chartState!.clone();
  }

  /**
   * Listens to all events on the chart canvas and the area where HTML tooltips
   * are drawn.
   */
  private listenToChartEvents() {
    const renderer = this.drawingFrame!.getRenderer();
    asserts.assert(renderer != null);
    const overlayArea = this.drawingFrame!.getOverlayArea();
    asserts.assert(overlayArea != null);

    dispose(this.charteventHandler);
    asserts.assert(this.chartDefinition != null);
    this.charteventHandler = this.constructEventHandler(
      this.interactionEventTarget,
      renderer!,
      overlayArea!,
      this.chartDefinition!,
    );

    // Listen to all events on chart elements.
    this.charteventHandler.listenToAllRendererEvents();
    // Listen to all events on HTML tooltips drawn on top of the chart.
    this.charteventHandler.listenToAllOverlayAreaEvents();
    // Listen to all events on page for gestures that need to go outside bounds.
    this.charteventHandler.listenToAllPageEvents();
  }

  /**
   * Maybe draw with animation
   * @param newChartDef The new chart definition.
   */
  private setupanimation(newChartDef: ChartDefinition): boolean {
    asserts.assert(this.options != null);
    const animationProps = getProperties(this.options!, 0, 30, LINEAR);

    let oldChartDef;
    if (this.animation) {
      // Getting here means we are already in animation mode from a previous
      // draw, and since we are instructed to draw with animation now, it means
      // we need to animate from the intermediate chart definition of the
      // previous animation.  The oldChartDef is set to that intermediate state.
      // Also, remember that we were continuing an animation, so we can start
      // the next animation frame, if any, without having to disable events.
      oldChartDef = this.animation.prevFrameChartDef;
      this.stopanimation();
    } else {
      oldChartDef = this.chartDefinition;
    }

    // If the user specified non-null animation, and we have an existing
    // chart-definition (oldChartDef is non-null, so it is either the previous
    // animation frame or this.chartDefinition), and the old and new chart
    // definitions have the same type, and it is not a Histogram or PieChart,
    // then we can do the animation.
    const doAnimation =
      animationProps &&
      ((animationProps as AnyDuringMigration).startup ||
        (oldChartDef && oldChartDef.chartType === newChartDef.chartType)) &&
      newChartDef.chartType !== optionTypes.ChartType.HISTOGRAM &&
      newChartDef.chartType !== optionTypes.ChartType.PIE;
    if (!doAnimation) {
      return false;
    }

    asserts.assert(this.dataTable != null);

    if (!oldChartDef) {
      // If there is no oldChartDef, that means we create a startup chartdef.
      // Find all series and interval columns in newChartDef.
      const columns = range(this.dataTable!.getNumberOfColumns()) as Array<
        number | string | AnyDuringMigration
      >;
      // Get the column specs of the DataTable or DataView.
      const isDataTable = this.dataTable! instanceof DataView;
      let dataCols = this.dataTable!.getColumns();
      if (!isDataTable) {
        // Must be a DataView, so map its columns.
        const dataView: DataView = this.dataTable as DataView;
        dataCols = map(dataView.getColumns(), (column) => {
          if (typeof column === 'object') {
            return column;
          } else {
            // column is a number, or possibly an id.
            return {
              'sourceColumn': column,
              'properties': dataView.getColumnProperties(column),
            };
          }
        });
      }

      const serieses = newChartDef.series;
      let columnRoles = newChartDef.dataTableColumnRoleInfo;
      if (newChartDef.chartType === optionTypes.ChartType.BUBBLE) {
        // Weird beast that it is, BubbleChart doesn't use
        // dataTableColumnRoleInfo, so we have to roll our own roles.
        // Also, the serieses have no targetAxisIndex, and the chart has
        // no orientation, so we fake those too.
        columnRoles = [
          {role: ColumnRole.ID}, //
          {role: ColumnRole.DOMAIN}, //
          {role: ColumnRole.DATA, serieIndex: 0},
        ];
      }
      // The baselineValue is shared by each data column and following
      // intervals.
      let baselineValueFunc: AnyDuringMigration;
      let baselineValueType: AnyDuringMigration;
      forEach(columnRoles, (columnRole, columnIndex) => {
        if (columnRole.role !== 'data' && columnRole.role !== 'interval') {
          return;
        }
        // Skip non-data.
        const columnSpec = googObject.clone(dataCols[columnIndex]);
        if (columnRole.role === 'data') {
          asserts.assert(columnRole.serieIndex != null);
          const series = serieses[columnRole.serieIndex!];
          if (series.isVirtual) {
            return;
          }
          // Skip trendlines.
          const targetAxisIndex = series.targetAxisIndex || 0;
          if (targetAxisIndex != null) {
            const targetAxis =
              !newChartDef.orientation ||
              newChartDef.orientation === optionTypes.Orientation.HORIZONTAL
                ? newChartDef.vAxes[targetAxisIndex]
                : newChartDef.hAxes[targetAxisIndex];
            baselineValueFunc = () => targetAxis.baseline!.dataValue;
            // TODO(dlaliberte) Possible bug: dataType is not defined on
            //   targetAxis.  Maybe confused with AxisDefiner.
            baselineValueType = (targetAxis as AnyDuringMigration).dataType;
          }
        } else {
          // role === 'interval'
          columnSpec['role'] = 'interval';
        }
        columnSpec['calc'] = baselineValueFunc;
        columnSpec['type'] = baselineValueType;
        columns[columnIndex] = columnSpec;
      });
      const view = new DataView(this.dataTable!);
      view.setColumns(columns);

      // Set the viewWindow to be the same as for newChartDef.
      // For each haxis, set its viewWindow.
      const hAxesOption = {};
      let axes = newChartDef.hAxes;
      if (axes) {
        for (const index in axes) {
          if (typeof index !== 'number') {
            continue;
          }
          const axis = axes[index];
          if (axis.viewWindow) {
            (hAxesOption as AnyDuringMigration)[index] = {
              'viewWindow': {
                'numericMin': axis.viewWindow.min,
                'numericMax': axis.viewWindow.max,
              },
            };
          }
        }
      }
      // For each vaxis, set its viewWindow.
      const vAxesOption = {};
      axes = newChartDef.vAxes;
      if (axes) {
        for (const index in axes) {
          if (typeof index !== 'number') {
            continue;
          }
          const axis = axes[index];
          if (axis.viewWindow) {
            (vAxesOption as AnyDuringMigration)[index] = {
              'viewWindow': {
                'numericMin': axis.viewWindow.min,
                'numericMax': axis.viewWindow.max,
              },
            };
          }
        }
      }
      this.options!.insertLayer(0, {
        'hAxes': hAxesOption,
        'vAxes': vAxesOption,
      });

      const renderer = this.drawingFrame!.getRenderer();
      const startupChartDefiner = this.constructChartDefiner(
        view,
        this.options!,
        renderer!.getTextSize.bind(renderer),
        this.width,
        this.height,
      );
      oldChartDef = startupChartDefiner.getChartDefinition();
    }

    this.chartDefinition = null;
    const now = Date.now();
    // Continue previous animation timing, if any.
    const prevFrameTime = (this.animation && this.animation.prevFrameTime) || 0;
    this.stopanimation();
    this.animation = {
      oldChartDef,
      newChartDef,
      interpolator: new ChartDefinitionInterpolator(oldChartDef, newChartDef),
      prevFrameChartDef: oldChartDef,
      startTime: now,
      endTime: now + animationProps.duration,
      prevFrameTime,
      timer: new Timer(10),
      easingFunction: animationProps.easing,
      maxFramesPerSecond: animationProps.maxFramesPerSecond,
      done: false,
    };

    // Draw first frame of animation right away. This is important because
    // we need to draw the chart without interactivity, so there won't be
    // any events flying around during animation.  Not needed if we were
    // previously still animating, since events will still be disabled, but in
    // that case, the prevFrameTime will be non-zero so the next animation frame
    // will not be drawn until the time is right anyway.
    // Also, in the case a previous animation had not finished, we still
    // want to continue animating at about the same rate, and we must draw
    // at least once after having cleared the chart.  Reusing the previous
    // frame time should prevent missed or extra frames from occurring.
    this.handleanimation();

    // Then set a timer to trigger drawing of the next frames.
    events.listen(
      this.animation.timer,
      Timer.TICK,
      this.handleanimation.bind(this),
    );
    this.animation.timer.start();
    // Even while animating, leave the chartDefinition intact.
    this.chartDefinition = newChartDef;

    return true;
  }

  /**
   * Handles each step of the animation. Draws the current frame based on the
   * elapsed time since the animation started, and when it should stop.
   */
  private handleanimation() {
    const animation = this.animation;
    this.chartDefinition = null;
    // While in animation frame, set to null.

    // We have 3 cases in this function:
    // 1. During animation - without events.
    // 2. Last frame of the animation - without events.
    // 3. One post-animation frame (looks identical to case 2) - with events.
    // The reason we have case 2 is that case 3 takes longer to draw (because
    // it's with events), and so creates a non-smoothness in the animation. The
    // solution is to draw the last image twice. First time fast, without events
    // (case 2), and then again with events (case 3). Setting animation.done to
    // true is the way to signal the switch from case 2 to case 3.
    if (!animation!.done) {
      // Case 1 or 2 (see above).
      const now = Date.now();
      const nowInterval = now - animation!.startTime;
      const totalInterval = animation!.endTime - animation!.startTime;
      let progress = nowInterval / totalInterval;
      if (progress < 1) {
        // Case 1.
        const maxFramesPerSec = this.animation!.maxFramesPerSecond;
        if (now - animation!.prevFrameTime < 1000 / maxFramesPerSec) {
          // We don't want to render faster than maxFramesPerSec.
          return;
        }
      } else {
        // Case 2.
        progress = 1;
        animation!.done = true;
      }
      const interpolatedChartDef = animation!.interpolator.interpolate(
        animation!.easingFunction(progress),
      );
      animation!.prevFrameChartDef = interpolatedChartDef;
      animation!.prevFrameTime = now;
      // State is ignored during animation, so the interactivity layer is empty.
      this.builder!.drawChart(interpolatedChartDef, {} as ChartDefinition);
      this.chartEventDispatcher.dispatchEvent(animationFRAME_FINISH);
    } else {
      // Case 3.
      this.stopanimation();
      this.chartDefinition = animation!.newChartDef;
      this.drawStateInducedchartDefinition();
      this.listenToChartEvents();
      this.chartEventDispatcher.dispatchEvent(animationFINISH);
    }

    // Restore to outside state.
    this.chartDefinition = animation!.newChartDef;
  }

  /**
   * Stops the currently active animation.
   */
  private stopanimation() {
    if (this.animation) {
      dispose(this.animation.timer);
      this.animation = null;
    }
  }

  /**
   * Returns the bounding box of the chart area.
   * @return The bounding box of the chart area.
   */
  getChartAreaBoundingBox(): BoundingBox {
    const chartArea = this.chartDefinition!.chartArea;
    return {
      'left': chartArea.left,
      'top': chartArea.top,
      'width': chartArea.width,
      'height': chartArea.height,
    };
  }

  /**
   * Returns the bounding box of an element by its ID.
   * For example: 'chartarea', 'vAxis#0'.
   * @param elementId The element's ID.
   * @return The bounding box of the requested element.
   */
  getBoundingBox(elementId: string): BoundingBox | null {
    if (this.builder == null) {
      return null;
    }
    const box = this.builder.getBoundingBox(elementId);
    if (!box) {
      return null;
    }
    return {
      'left': box.left,
      'top': box.top,
      'width': box.right - box.left,
      'height': box.bottom - box.top,
    };
  }

  /**
   * Returns the chart layout interface which allows the user to convert between
   * logical and physical coordinates, and identify the location of some chart
   * elements.
   * @return The chart layout interface.
   */
  getChartLayoutInterface(): ChartLayoutInterface {
    const chartDef = this.chartDefinition;
    asserts.assert(chartDef != null);
    if (chartDef == null) {
      throw new Error('redundant error checking');
    }
    return {
      'getChartAreaBoundingBox': this.getChartAreaBoundingBox.bind(this),
      'getBoundingBox': this.getBoundingBox.bind(this),
      'getXLocation': chartdefinitionutil.getXLocation.bind(null, chartDef),
      'getYLocation': chartdefinitionutil.getYLocation.bind(null, chartDef),
      'getHAxisValue': chartdefinitionutil.getHAxisValue.bind(null, chartDef),
      'getVAxisValue': chartdefinitionutil.getVAxisValue.bind(null, chartDef),
      'getPointDatum': chartdefinitionutil.getPointDatum.bind(null, chartDef),
    };
  }

  /**
   * Temporary method to allow migration to getChartLayoutInterface.
   * @deprecated Use getChartLayoutInterface
   * @return The chart layout interface as an object with string keys.
   */
  getChartLayoutObject(): {[key: string]: AnyDuringMigration} {
    const chartLayoutInterface = this.getChartLayoutInterface();
    return chartLayoutInterface as {[key: string]: AnyDuringMigration};
  }

  /**
   * Returns the drawing frame of the chart.
   * @return Drawing frame of the chart.
   */
  getDrawingFrame(): DrawingFrame | null {
    return this.drawingFrame;
  }

  /**
   * Returns the chart definition.
   * @return Definition of the chart.
   */
  getChartDefinition(): ChartDefinition | null {
    return this.chartDefinition;
  }

  /**
   * Grabs an image representation of a chart.
   * @return The chart as an image URL.
   */
  override getImageURI(): string {
    if (!this.options || !this.chartDefinition || !this.chartState) {
      throw new Error('Chart has not finished drawing.');
    }

    // Creating the frame if it does not exist already (due to previous draw).
    const dimensions = new Size(this.width, this.height);
    const div = getDomHelper(this.container).createElement('div');
    const textDiv = DrawingFrame.createTextMeasurementDiv(div, dimensions);
    const renderer = new CanvasRenderer(div, textDiv);
    const overlayArea = new OverlayArea(div);
    const builder = this.constructBuilder(overlayArea, renderer);
    const interactivityLayer =
      this.interactivityDefiner!.generateInteractivityLayer(
        this.chartDefinition,
        this.chartState,
      );
    builder.drawChart(this.chartDefinition, interactivityLayer);
    const imageUrl = div.childNodes[0].toDataURL('image/png');
    return imageUrl;
  }
}

// The following are never used?
/**
 * A set of the selected properties (rows, cols or cells).
 * type {?Selection}
 * private
 */
// CoreChart.prototype.selection_ = null;

/**
 * The index of the first column in the data table from which data is taken to
 * draw the chart. It can be either 1 if the first column contains labels, or 0
 * if the first column is numeric.
 * type {number}
 * private
 */
// CoreChart.prototype.firstValueCol;

/**
 * Number Of Rows in the data table.
 * type {number}
 * private
 */
// CoreChart.prototype.numberOfRows;
