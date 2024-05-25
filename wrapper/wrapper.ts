/**
 * @fileoverview A wrapper for either charts or controls defining all the
 * context needed to draw it.
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

import {forEach} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {assertIsElement} from '@npm//@closure/asserts/dom';
import {Disposable} from '@npm//@closure/disposable/disposable';
import {dispose} from '@npm//@closure/disposable/dispose';
import {Coordinate} from '@npm//@closure/math/coordinate';

import * as errors from '../common/errors';
import * as gvizJson from '../common/json';
import {unsafeClone} from '../common/object';
import {AbstractDataTable} from '../data/abstract_datatable';
import {DataTable} from '../data/datatable';
import {DataView} from '../data/dataview';
import {ColumnSpec} from '../data/types';
import * as gvizDom from '../dom/dom';
import * as events from '../events/events';
import * as patterns from '../format/patterns';
import {
  AbstractVisualizationConstructor,
  loadApi,
  resolveConstructor,
} from '../loader/loader';
import {getPackage, isCoreChart} from '../loader/packages';
import {Query} from '../query/query';
import {QueryResponse} from '../query/queryresponse';
import {AbstractVisualization} from '../visualization/abstract_visualization';

import {WrapperInterface} from './wrapper_interface';

const {addError, createProtectedCallback} = errors;
const {addListener, removeListener, trigger} = events;
const {deserialize, serialize} = gvizJson;

// tslint:disable:ban-types Migration

/**
 * Supported wrapper kinds.
 */
export const WRAPPER_KIND = {
  CHART: 'chart',
  CONTROL: 'control',
  DASHBOARD: 'dashboard',
} as const;

type ValuesOf<T> = T[keyof T];
type ValuesOfWrapperKind = ValuesOf<typeof WRAPPER_KIND>;

/**
 * A wrapper for different kinds of visualization objects (currently, either
 * chart or controls) and all the context needed to draw them.
 *
 * Here and onward 'visualization' will be used to refer generically to any
 * object that behaves in a visualization-like way, i.e. it supports
 * option-based configuration and a draw() method. Currently this applies either
 * to proper charts or to visualization controls.
 *
 * The wrapper provides complete encapsulation of a visualization, handling
 * configuration, drawing and serialization in the same way no matter what
 * visualization the wrapper is managing. The following lifecycle applies to
 * wrapped visualizations for common usage scenarios:
 *
 * - Drawing
 * draw()
 *    |_> can resolve the visualization constructor given its type?
 *        |
 *        |_(N)_> load the necessary packages via the loader.
 *        |                |
 *        |                V
 *        |_(Y)_> Does the wrapper have locally defined data (this.dataTable
 *                field), holding either a DataTable or DataView?
 *                |
 *                |_(N)_> Fire a query to dataSourceUrl to fetch the datatable
 *                |              |
 *                |              V
 *                |       Extract datatable from query response
 *                |              |
 *                |              V
 *                |_(Y)_> Being drawing (#drawFromdataTable() method)
 *                               |
 *                               V
 *                        Create a visualization instance from the constructor
 *                        if not locally defined yet (this.visualization).
 *                        Attach event listeners.
 *                               |
 *                               V
 *                        Store a reference (recentDataTable) to the data
 *                        used for this draw().
 *                               |
 *                               V
 *                        Apply any 'view' specification on the data.
 *                               |
 *                               V
 *                        Delegate drawing to the visualization.
 *
 * - Event raised by the visualization
 * Event occurs
 *    |_> 'ready'?
 *    |    |
 *    |    |_> Store a local reference to the visualization
 *    |    |   (this.visualization)
 *    |    |
 *    |    |_> If visualization supports states (like Controls do), extract
 *    |    |   the state from the visualization and save it in the wrapper.
 *    |    |   (for visualization that may alter their state based on the data
 *    |    |   they have been drawn with).
 *    |    |
 *    |    |_> re-fire the event from the wrapper.
 *    |
 *    |_> 'statechange' (for Controls changing their state)?
 *    |    |
 *    |    |_> If visualization supports states (like Controls do), extract
 *    |    |   the state from the visualization and save it in the wrapper.
 *    |    |
 *    |    |_> re-fire the event from the wrapper.
 *    |
 *    |_> other
 *         |
 *         |_> re-fire the event from the wrapper.
 *
 * - Snapshotting
 * getSnapshot()
 *    |_> Has the visualization been drawn yet?
 *        |
 *        |_(N)_> Is local data (this.dataTable) defined?
 *        |       |
 *        |       |_(N)_> JSON serialization will be data-less.
 *        |       |
 *        |       |_(Y)_> Use the local data in serialization.
 *        |                                   |
 *        |_(Y)_> Use the last data           |
 *                (this.recentDataTable)     |
 *                in serialization            |
 *                      |                     |
 *                      V                     V
 *                     Is the data a DataView instance?
 *                      |
 *                      |_(Y)_> Resolve the DataView (DataView.toDataTable())
 *                      |                     |
 *                      |                     V
 *                      |_(N)_> JSON serialization contains a serialized
 *                              DataTable.
 *
 * TODO(dlaliberte): support calling draw() before the document load.  This
 * will require support for encoding the container as an element ID
 * string, and it will require us to set the loader callback
 * and the body's on load callback, setting a flag to check that we're not
 * drawing twice.
 *
 * The specification object (or the corresponding json) should have the
 * following format:
 *   <kind>Type {string|!Function} The 'chartType' or 'controlType'.
 *       The class name of the visualization object or the constructor
 *       function, for instance, "PieChart" or google.visualization.PieChart.
 *       The 'kind' prefix is determined by the type of object
 *       this wrapper handles.  For ChartWrapper, it will be 'chartType'
 *       and for ControlWrapper, it will be 'controlType'.
 *
 *       If the visualization is provided by Google, the class name need not
 *       be fully qualified (in other words, both "chartType": "PieChart" and
 *       "chartType": "google.visualization.PieChart" will work).  If the
 *       visualization class has not been loaded, the function will attempt to
 *       load it by calling the loader.  The visualization packages loaded
 *       are either taken from the optional packages field of the specification
 *       object, or inferred from the visualization type.  When using gviz
 *       as a library, you can reference the class constructor function
 *       directly rather than use its string name.
 *
 *   name {string} The name of the visualization. The 'kind' prefix is
 *       determined  by the type of object this wrapper handles.
 *       For example: 'chartName'.
 *
 *   container {Element} The div in which to draw the visualization.
 *       If the opt_container parameter is provided to #draw(), that value is
 *       used instead.
 *
 *   containerId {string} The id of a div in which to draw the visualization.
 *       If there is a container property, or if the opt_container parameter
 *       is provided to #draw(), that value is used instead.
 *
 *   options {Object} The draw options.
 *
 *   state {Object} The visualization state.
 *
 *   dataSourceUrl {string} The URL of a gviz data source. If the dataSourceUrl
 *       is not provided, the visualization will be drawn according to the
 *       dataTable. If both dataSourceUrl and dataTable are provided, the
 *       latter will take precedence. If neither is provided, an error will be
 *       displayed.
 *
 *   dataTable {string|Data} A DataTable or DataView.
 *       If dataTable is provided, dataSourceUrl and query are ignored.
 *       The dataTable may be provided as an instance of
 *       DataTable, an instance
 *       of DataTable, a JSON string DataTable
 *       specification or an array of values to be converted to a DataTable
 *       with arrayToDataTable.
 *
 *   view {Object} specification for a DataView that is applied to the
 *       input dataTable, or an array of specifications. For the specification
 *       format, see DataView#fromJSON().
 *
 *   packages {!Array<string>|string|null} An array of GViz API packages. For
 *       each call to draw(), if the visualization class corresponding to the
 *       current type has not been loaded, the draw() function will
 *       attempt to load it by calling the loader.  The visualization
 *       packages loaded are either taken from the optional packages property,
 *       or, if the packages property has not been specified, inferred from the
 *       visualization type.
 *
 *   query {string} An optional query in the gviz query language to be
 *       evaluated against the data source.
 *
 *   refreshInterval {number} The automatic refresh interval in seconds for
 *       data from the data source. If not provided, the visualization will not
 *       automatically refresh.
 *
 * Following is an example specification JSON string for a 'chart' wrapper
 * (without the quotes and with newlines):
 * {
 *   "chartType": "ImagePieChart",
 *   "options": {"title": "Pecan Pie"},
 *   "dataSourceUrl": "http://www.blah.com"
 * }
 * @unrestricted
 */
export class Wrapper extends Disposable implements WrapperInterface {
  private container: Element | null;
  private containerId: string | null;

  /**
   * This is only used to remember the container that is resolved from
   * the containerId, to distinguish it from the explicit container.
   */
  private resolvedContainer: Element | null = null;
  private readonly wrapperKind: ValuesOfWrapperKind;
  private name: string;

  /**
   * The class used to construct an instance of AbstractVisualization.
   */
  private typeConstructor: AbstractVisualizationConstructor | null = null;

  /**
   * The visualization type.
   * Defaults to ''.
   *
   */
  private type = '';
  private packages: string[] | string | null;

  /**
   * The currently loading visualization. Null if the visualization has
   * already fired its ready event.
   *
   */
  protected loadingVisualization: AbstractVisualization | null = null;

  /**
   * The current drawn visualization. Null if no visualization is drawn.
   * This is an instance of this.typeConstructor.
   *
   */
  protected visualization: AbstractVisualization | null = null;

  /**
   * The visualization to use in the next draw.
   *
   */
  protected nextVisualization: AbstractVisualization | null = null;

  /**
   * Whether the visualization is the suggested default visualization.
   */
  private isSuggesteDefault: boolean;

  /**
   * The list of event listeners over the drawn visualization.
   * @see `#setupVisualizationEventHandlers`.
   */
  private visualizationEventListeners: Array<AnyDuringMigration | null> | null =
    null;
  private dataSourceUrl: string | null;
  private dataSourceChecksum: string | null;

  /**
   * The data to draw the visualization with.
   *
   */
  private dataTable: AbstractDataTable | null = null;
  private options: AnyDuringMigration;
  private state: AnyDuringMigration;
  private query: string | null;

  /**
   * A Query object, stored when used so we can reset/clear it when needed.
   */
  private queryObject: Query | null = null;
  private refreshInterval: number | null;
  private view: AnyDuringMigration[] | AnyDuringMigration | string | null;
  private readonly initialView:
    | AnyDuringMigration[]
    | AnyDuringMigration
    | string
    | null;

  /**
   * An optional request handler (to handle the data source request) instead
   *     of making a xhr request for the data source.
   * TODO: Should be:
   *   type {?function(function(!QueryResponse), string)}
   */
  private customRequestHandler:
    | ((
        p1: (p1: AnyDuringMigration | null) => AnyDuringMigration,
        p2: string,
      ) => AnyDuringMigration)
    | null = null;
  private readonly extensions: Function[];

  /**
   * The DataTable used to render the visualization in the most recent call to
   * #draw().
   *
   * Note that the wrapper tracks the Data by reference, so this table will
   * go out of sync with what was actually used in the last #draw() if the
   * Wrapper was initialized with a 'dataTable' specification and the
   * AbstractDataTable is actively mutated after #draw()
   * by an external party holding a reference to it.
   *
   */
  private recentDataTable: AbstractDataTable | null = null;

  /**
   * @param wrapperKind The kind of visualization object
   *     this wrapper handles, 'chart' or 'control'.
   * @param specification An object specifying the
   *     information needed to draw the visualization, or a JSON string.
   */
  constructor(
    wrapperKind: ValuesOfWrapperKind,
    specification?: string | AnyDuringMigration | null,
  ) {
    super();

    specification = specification || {};

    if (typeof specification === 'string') {
      specification = deserialize(specification);
    }

    /**
     * The div in which to draw the visualization.
     * May be specified here, set with #setContainer(),
     * or resolved from id in #draw().
     *
     */
    this.container = specification['container'] || null;

    /**
     * The id of a div in which to draw the visualization.
     * May be specified here or set with #setContainerId() or #setContainer(),
     * or provided to #draw().
     * When the containerId is resolved to a container, it is stored in
     * resolvedContainer.
     * Don't provide both the container and the containerId.
     *
     */
    this.containerId = specification['containerId'] || null;

    /**
     * The kind of visualization object this wrapper handles. For example
     * 'chart' or 'control'. Currently drives only some naming convention for
     * JSON properties.
     *
     */
    this.wrapperKind = wrapperKind;

    /**
     * The name of the type being wrapped.
     * Obsolete?
     *
     */
    this.name = specification[`${wrapperKind}Name`] || '';

    /**
     * Unfortunately, charteditor depends on the default type being == null.
     */
    const type = specification[wrapperKind + 'Type'] || null;
    this.setTypeOrConstructor(type);

    const packages = specification['packages'];

    /**
     * API packages to load. In most cases, this is not necessary.
     *
     */
    this.packages = packages !== undefined ? packages : null;

    /**
     * Whether this visualization used is the default for this data set
     * (as opposed to one manually selected by the user).
     * Assumes true if provided specification does not specify a value.
     *
     */
    this.isSuggesteDefault =
      specification['isDefaultVisualization'] ||
      specification['isDefaultVisualization'] === undefined;

    /**
     * The data source url for retrieving a DataTable.
     *
     */
    this.dataSourceUrl = specification['dataSourceUrl'] || null;

    /**
     * The data source checksum.
     *
     */
    this.dataSourceChecksum = specification['dataSourceChecksum'] || null;
    this.setDataTable(specification['dataTable']);

    /**
     * The draw options for the visualization.
     *
     */
    this.options = specification['options'] || {};

    /**
     * The visualization state.
     *
     */
    this.state = specification['state'] || {};

    /**
     * An optional select query to send to the data source.
     *
     */
    this.query = specification['query'] || null;

    /**
     * An optional refresh interval for the data source query.
     *
     */
    this.refreshInterval = specification['refreshInterval'] || null;

    /**
     * An optional specification for a DataView that is applied to the
     * DataTable, or an array of such specifications.
     *
     */
    this.view = specification['view'] || null;

    /**
     * An optional specification for a DataView supplied, e.g., via Maestro.
     * This allows Maestro users access to the full power of roles within GViz.
     * This is the initial data view for the chart and chart editor changes
     * are applied to it.
     *
     * TODO(dlaliberte): The current interactions between the ChartEditor,
     * ChartWrapper and ViewFinder are less than ideal and should be cleaned
     * up, see b/22758772. Part of the problem is that ViewFinder changes the
     * view for things like adding a domain, annotations, error bars, etc.
     * and assigns the modified view back into this class.
     *
     * Here are some comments from dlaliberte@:
     * 1. I don't like adding yet another property to the spec, this
     * initialView. It is redundant with the 'view' property, and what  happens
     * if both are specified?
     * 2. I really think this initial view handling ought to be the
     * responsibility of the ChartEditor, or something other than the
     * ChartWrapper.  The ChartWrapper shouldn't have to know anything about
     * what the ChartEditor is doing.  The ChartEditor should start with
     * whatever 'view' it finds in the ChartWrapper, then augment a copy of it
     * locally, and only set a new 'view' on a new ChartWrapper once the
     * ChartEditor dialog is closed.
     * 3. This [initialView] should be a short-term fix until we can apply the
     *    necessary refactoring to solve it "correctly".
     *
     */
    this.initialView = specification['initialView'] || null;

    /**
     * An array of arbitrary transformations to be applied to the Wrapper
     * delegate's data and options before draw.
     * Order matters!!
     * NOTE: Currently, the extensions are not part of the ChartWrapper API.
     * There is no setExtensions(), and users cannot specify extensions in
     * the JSON. Extensions are a self-contained framework that gives us
     * greater flexibility in the ChartWrapper implementation.
     * In a future version, we may consider surfacing the extensions in the
     * public API. If so, we will need to store extensions by their exported
     * name instead of by function pointers. Also, we may support passing
     * an options object with each extension.
     */
    this.extensions = [
      deserializeView,
      hackLabelsColumn,
      applyPatternOptions,
      applyTrendLineOption,
    ];
  }

  override disposeInternal() {
    this.clear();
    super.disposeInternal();
  }

  /**
   * Clear internals to initial state, so it can be disposed or reused.
   */
  clear() {
    this.disposeQuery();
    this.clearVisualization();
  }

  /**
   * Dispose of queryObject, if any.
   * Does not reset this.query.
   */
  private disposeQuery() {
    if (this.queryObject) {
      this.queryObject.clear();
      this.queryObject = null;
    }
  }

  /**
   * @return A clone of this Wrapper.
   */
  clone(): Wrapper {
    const pojo = this.toPOJO();
    const wrapper = this.createFromPOJO(pojo);

    // Copy the pertinent transient fields.
    wrapper.customRequestHandler = this.customRequestHandler;

    return wrapper;
  }

  /**
   * Creates a new instance of the same class given a pojo representation of the
   * spec.
   */
  createFromPOJO(pojo: {}): Wrapper {
    return new (this.constructor as {new (spec: {}): Wrapper})(pojo);
  }

  /**
   * Returns a serialization of this Wrapper including all the members
   * being set via the constructor, draw, or setter functions. The serialization
   * does not add any transient data collected by the wrapper in the drawing
   * phase, e.g. a remote data table returned from dataSourceUrl.
   *
   * Note however that in case the Data object used as the 'dataTable' is a
   * DataView it will be resolved to a DataTable object at
   * this stage and served during the JSON serialization process.
   *
   * @return A JSON string.
   */
  toJSON(): string {
    const pojo = this.internalToPOJO(this.getDataTable());
    // Remove properties that cannot be serialized.
    // Note that typeConstructor should not be in the pojo.
    // This means that a serialized wrapper will not be useful when later
    // deserialized unless the type name was provided.
    pojo['container'] = undefined;
    pojo['typeConstructor'] = undefined;
    return serialize(pojo);
  }

  /**
   * Returns a POJO data object which is a clone of the Wrapper's data
   * in a format that can be used as input to new gviz.Wrapper().
   * See comments with getSnapShot() regarding the DataTable.
   * Note: pojo cannot be serialized if an explicit 'container' was specified.
   * @return A clone of the data from this Wrapper.
   **/
  toPOJO(): AnyDuringMigration {
    return this.internalToPOJO(this.recentDataTable || this.getDataTable());
  }

  /**
   * Returns a new POJO representation of this Wrapper, given a DataTable.
   *
   * @param dataTable The dataTable to use.
   * @return A new POJO representing this Wrapper.
   */
  private internalToPOJO(
    dataTable: AbstractDataTable | null,
  ): AnyDuringMigration {
    const packages = this.getPackages();

    let dataTableObj = undefined;
    if (dataTable) {
      // The dataTable might really be a DataView. Make it a DataTable first.
      dataTable = dataTable.toDataTable();
      dataTableObj = (dataTable as DataTable).toPOJO();
    }

    const pojo = {
      'container': this.container || undefined, // explicit container, if any.
      'containerId': this.getContainerId() || undefined,
      'dataSourceChecksum': this.getDataSourceChecksum() || undefined,
      'dataSourceUrl': this.getDataSourceUrl() || undefined,
      'dataTable': dataTableObj,
      'initialView': this.getInitialView() || undefined,
      'options': this.getOptions() || undefined,
      'state': this.getState() || undefined,
      'packages': packages === null ? undefined : packages,
      'refreshInterval': this.getRefreshInterval() || undefined,
      'query': this.getQuery() || undefined,
      'view': this.getView() || undefined,
      'isDefaultVisualization': this.isDefaultVisualization(),
    };
    (pojo as AnyDuringMigration)[this.wrapperKind + 'Type'] =
      this.getType() || undefined;
    (pojo as AnyDuringMigration)[this.wrapperKind + 'Name'] =
      this.getName() || undefined;
    this.addToPojo(pojo);
    return pojo;
  }

  /**
   * Allow inheriting classes to add properties to the JSON serialization
   * of this class.
   * @param pojo The POJO to be added to
   */
  protected addToPojo(pojo: AnyDuringMigration | null) {
    pojo = pojo;
  }

  /**
   * Returns a new Wrapper of the same kind as this one with a given
   * DataTable.
   *
   * Which DataTable to set in the snapshot is decided according to this logic:
   * - If the visualization has not been drawn yet and the wrapper was
   *   initialized with local Data, this data is used.
   * - If the visualization has already been drawn, the Data used to render
   *   the visualization in the most recent call to #draw() are used (so what
   * you see is what you get, but see the comments for recentDataTable about
   *   mutations that might occur on shared data references),
   * - If the Data resulting from the above steps is a DataView, it will be
   *   resolved to a DataTable at this stage and served to
   *   the snapshot.
   *
   * Note that:
   * a) the snapshot will contain the most recent Data passed to draw,
   *    even if the visualization internal #draw() failed.
   * b) if the Data is fetched remotely, the remote loading must have
   *    succeeded for the most recent Data to be updated.
   *
   * @return A new DataTable-based Wrapper.
   */
  getSnapshot(): Wrapper {
    // In case there was no draw, #recentDataTable will be null.
    return this.createFromPOJO(this.toPOJO());
  }

  /**
   * Returns the name for this wrapper.
   * @return The name for this wrapper.
   */
  getName(): string {
    return this.name;
  }

  /**
   * Sets the name for this wrapper.
   * @param name The visualization name for this wrapper.
   */
  setName(name: string) {
    this.name = name;
  }

  // Methods involving type, typeConstructor, packages,
  // and api loading for chartType and controlType.

  /**
   * Returns the type name for this wrapper.
   * Note: The type might be null or undefined, as charteditor requires.
   * It might be simpler to fix the charteditor to avoid this assumption.
   *
   * @return The type for this wrapper.
   */
  getType(): string {
    return this.type;
  }

  /**
   * Sets the type name of visualization for this wrapper.
   * Also sets the type constructor to null, since it may no longer be valid.
   * Note: The type might be null or undefined, as charteditor requires.
   *
   */
  setType(type: string) {
    this.type = type;
    this.typeConstructor = null;
  }

  /**
   * Sets the type constructor of visualization for this wrapper.
   */
  setTypeConstructor(typeConstructor: AbstractVisualizationConstructor | null) {
    this.typeConstructor = typeConstructor;
  }

  /**
   * Gets the type constructor for this wrapper, or null if not found.
   * Throws error if neither typeConstructor nor type is 'defined'.
   */
  getTypeConstructor(): Function | null {
    if (!this.typeConstructor && (this.type == null || this.type === '')) {
      throw new Error(`The ${this.wrapperKind} type is not defined.`);
    }

    if (this.typeConstructor) {
      return this.typeConstructor;
    }
    const type = this.getType();
    return resolveConstructor(type);
  }

  /**
   * Sets up the type constructor for this wrapper.
   * Throws error if no type constructor can be found.
   * This is very similar to getTypeConstructor, which could maybe be used.
   */
  setupTypeConstructor(): AbstractVisualizationConstructor {
    const type = this.getType();
    const typeConstructor = this.typeConstructor || resolveConstructor(type);
    if (!typeConstructor) {
      const typeName = type || String(this.typeConstructor) || 'unknown';
      throw new Error(`Invalid ${this.wrapperKind} type: ${typeName}`);
    }
    this.setTypeConstructor(typeConstructor);
    return typeConstructor;
  }

  /**
   * Sets the type of visualization for this wrapper.
   * Depending on whether the type is string or Function,
   * sets the type or typeConstructor and resets the other.
   *
   */
  setTypeOrConstructor(type: string | AbstractVisualizationConstructor) {
    if (typeof type === 'function') {
      this.setType('');
      this.setTypeConstructor(type);
    } else if (typeof type === 'string' && type !== '') {
      this.setType(type);
      this.setTypeConstructor(null);
    } else if (type == null) {
      // Special case for charteditor
      this.setType(type);
      this.setTypeConstructor(null);
    }
  }

  /**
   * Loads the gviz api.
   *
   * @param onLoad A callback to execute when the API is loaded.
   */
  private loadApi(onLoad: () => AnyDuringMigration) {
    const packages = this.computePackages();
    const options = {'packages': packages, 'callback': onLoad};
    let version = goog.getObjectByName('google.visualization.Version');
    if (version === null) {
      version = 'current';
    }
    loadApi('visualization', version, options);
  }

  /**
   * Returns an array of gviz packages to load.
   *
   * @return An array of gviz packages to load.
   */
  private computePackages(): string[] {
    let result = this.getPackages();
    if (result == null) {
      let type = this.getType();
      // remove the prefixes 'google.visualization.' and 'google.charts.',
      // if necessary
      type = type.replace('google.visualization.', '');
      type = type.replace('google.charts.', '');
      result = getPackage(type);
      if (result == null) {
        throw new Error(`Invalid visualization type: ${type}`);
      }
    }
    if (typeof result === 'string') {
      result = [result];
    }
    return result;
  }

  /**
   * Returns the specified packages for this Wrapper.
   *
   * @return The specified packages.
   */
  getPackages(): string | string[] | null {
    return this.packages;
  }

  /**
   * Sets the packages to be loaded.
   * @param packages The packages to be loaded.
   */
  setPackages(packages: string[] | string | null) {
    this.packages = packages;
  }

  // Visualization methods.

  /**
   * Returns the current drawn visualization object.
   * Note: This reference is set/updated when the ready event is thrown.
   * @see #setVisualization
   * @return The current drawn visualization object.
   */
  getVisualization(): AbstractVisualization | null {
    return this.visualization;
  }

  /**
   * Sets the visualization to be used for drawing. The visualization will be
   * used in the *following* #draw() in case it matches the relevant wrapper
   * type, and it was constructed with the same container set in the wrapper
   * @see `#containerId`. Otherwise, a new visualization will be created.
   *
   * Note: use before and not while a draw() is in progress for the purpose of
   * reusing memory and support animations or other state sensitive flows.
   *
   * Note: the passed visualization (like any other wrapper properties) will be
   * applied only in the next call to `#draw`. So for example, if the
   * current chart is drawn the wrapper will relay its events, while it won't
   * for the passed visualization.
   *
   * @param visualization The visualization class.
   */
  setVisualization(visualization: AbstractVisualization | null) {
    if (visualization !== this.visualization) {
      this.nextVisualization = visualization;
    }
  }

  /**
   * Return whether or not this is the default suggested visualization for the
   * data.
   * @return Whether this is the default.
   */
  isDefaultVisualization(): boolean {
    return this.isSuggesteDefault;
  }

  /**
   * Set whether this visualization is the default suggested visualization.
   * @param isDefault Value to set.
   */
  setIsDefaultVisualization(isDefault: boolean) {
    this.isSuggesteDefault = isDefault;
  }

  /**
   * @param container The UI container to draw in.
   */
  setupVisualization(container: Element): AbstractVisualization {
    const typeConstructor = this.setupTypeConstructor();

    if (this.nextVisualization) {
      // A new visualization was passed. Clear the previous visualization
      // and use the new one if applicable.
      this.clearVisualization();
      this.visualization = this.nextVisualization;
      this.nextVisualization = null;
    }
    let visualization;
    if (
      !this.visualization ||
      this.visualization.constructor !== typeConstructor ||
      !this.samecontainer(container, this.visualization)
    ) {
      this.clearVisualization();
      visualization = new typeConstructor(container);
    } else {
      visualization = this.visualization;
    }
    if (
      this.loadingVisualization &&
      this.loadingVisualization !== visualization
    ) {
      if (typeof this.loadingVisualization.clearChart === 'function') {
        this.loadingVisualization.clearChart();
      }
    }
    this.loadingVisualization = visualization;
    // Clear previous handlers and setup the visualization event handlers.
    // Also sets this.visualization to this.loadingVisualization.
    this.setupVisualizationEventHandlers(visualization);

    return visualization;
  }

  /**
   * Listen to visualization events and dispatch them over the wrapper object.
   * Note: this method should be called on every draw to make sure the wrapper
   * is listening to the currently used visualization and not using any
   * previously assigned listeners.
   * @param visualization The
   *     visualization.
   */
  private setupVisualizationEventHandlers(
    visualization: AbstractVisualization,
  ) {
    // TODO(dlaliberte): enable querying a visualization for its supported events
    // or add this as an option.
    this.clearVisualizationEventListeners();
    const eventTypes = ['ready', 'select', 'error', 'statechange'];
    const eventListeners: AnyDuringMigration[] = [];
    forEach(eventTypes, (eventType) => {
      const listener = addListener(
        visualization,
        eventType,
        (value: AnyDuringMigration) => {
          if (eventType === 'ready') {
            this.loadingVisualization = null;
            this.visualization = visualization;
          }
          const anyViz = visualization as AnyDuringMigration;
          if (
            (eventType === 'ready' || eventType === 'statechange') &&
            typeof anyViz.getState === 'function'
          ) {
            // If the event may have involved a state change, and the
            // visualization can be queried for state (like Controls),
            // update the wrapper state.
            this.setState(anyViz.getState.call(visualization));
          }
          trigger(this, eventType, value);
        },
      );
      eventListeners.push(listener);
    });
    this.visualizationEventListeners = eventListeners;
  }

  /**
   * Clears the visualization the wrapper is using if applicable.
   */
  clearVisualization() {
    if (this.visualization) {
      if (typeof this.visualization.clearChart === 'function') {
        this.visualization.clearChart();
      }
    }
    this.clearVisualizationEventListeners();
    dispose(this.visualization);
    this.visualization = null;
  }

  /**
   * Clears all the visualization event listeners.
   * Note: each event is removed explicitly and not using removeAll as the
   * visualization might be listened to by other parties.
   */
  private clearVisualizationEventListeners() {
    if (Array.isArray(this.visualizationEventListeners)) {
      forEach(this.visualizationEventListeners, (listener) => {
        removeListener(listener);
      });
      this.visualizationEventListeners = null;
    }
  }

  // Container methods.

  /**
   * Returns the container element for this wrapper.
   * May be resolved from the containerId.
   * @return The container element for this wrapper.
   */
  getContainer(): Element | null {
    return this.container || this.resolvecontainer();
  }

  /**
   * Returns the container element id for this wrapper.
   * @return The container element id for this wrapper.
   */
  getContainerId(): string | null {
    return this.containerId;
  }

  /**
   * Sets the container element for this wrapper.
   * Also clears the containerId and previously resolvedContainer.
   * @param container The container element for this wrapper.
   */
  setContainer(container: Element | null | string) {
    this.container = null;
    this.containerId = null;
    this.resolvedContainer = null;
    if (typeof container === 'string') {
      this.containerId = container;
    } else {
      this.container = container;
    }
  }

  /**
   * Sets the container element id for this wrapper.
   * Also clears the container.
   * @param containerId The container element id for this wrapper.
   */
  setContainerId(containerId: string | null) {
    this.container = null;
    this.resolvedContainer = null;
    this.containerId = containerId;
  }

  /**
   * @param container The new container to draw in.
   * @param visualization The
   *     visualization we may want to reuse.
   * @return True if the visualization is clearly using the passed
   *     container.
   */
  private samecontainer(
    container: Element,
    visualization: AbstractVisualization,
  ): boolean {
    if (visualization && typeof visualization.getContainer === 'function') {
      return visualization.getContainer() === container;
    }
    return false;
  }

  /**
   * Returns the element resolved from the containerId, or null if none.
   * Saves this resolved container for later use.
   * @return The element resolved from the containerId.
   */
  private resolvecontainer(): Element | null {
    let element = this.resolvedContainer;
    if (element == null) {
      const id = this.getContainerId();
      if (id == null) {
        // Ignore null id
        return element;
      }

      const domHelper = gvizDom.getDomHelper();
      const container = domHelper.getElement(id);
      // TODO(dlaliberte): Merge with gvizDom.validateContainer.
      if (!domHelper.isNodeLike(container)) {
        throw new Error(`The container #${id} is not defined.`);
      }
      this.resolvedContainer = container;
      element = container;
    }
    return element;
  }

  // Data and View methods

  /**
   * Returns the data source url for this wrapper.
   * @return The data source url for this wrapper.
   */
  getDataSourceUrl(): string | null {
    return this.dataSourceUrl;
  }

  /**
   * Returns the data source url for this wrapper.
   * @param dataSourceUrl The data source url for this wrapper.
   */
  setDataSourceUrl(dataSourceUrl: string | null) {
    if (dataSourceUrl !== this.dataSourceUrl) {
      this.disposeQuery();
      // Invalidate the query response since the data source url has changed.
      // TODO(dlaliberte)
      // this.currentQueryResponse_ = null;
      this.dataSourceUrl = dataSourceUrl;
    }
  }

  /**
   * Returns the data source checksum.
   * @return The data source checksum for this wrapper.
   */
  getDataSourceChecksum(): string | null {
    return this.dataSourceChecksum;
  }

  /**
   * Sets the data source checksum for this wrapper.
   */
  setDataSourceChecksum(dataSourceChecksum: string | null) {
    this.dataSourceChecksum = dataSourceChecksum;
  }

  /**
   * Returns the DataTable for this Wrapper.
   *
   * @return The DataTable for this Wrapper.
   */
  getDataTable(): AbstractDataTable | null {
    return this.dataTable;
  }

  /**
   * Sets the DataTable for this wrapper.
   *
   * @param dataTable A DataTable object, a DataView object, a DataTable JSON
   *     string, or an array of values to be converted to a DataTable using
   *     arrayToDataTable. Or null.
   */
  setDataTable(
    dataTable: AbstractDataTable | null | string | AnyDuringMigration[],
  ) {
    this.dataTable = DataTable.normalizeDataTable(dataTable);
  }

  /**
   * Returns the view specification associated with this Wrapper.
   *
   * @return Specification for a DataView
   *     that is applied to the input dataTable, or an array of specifications.
   *     For the specification format, see DataView#fromJSON().
   */
  getView(): AnyDuringMigration[] | AnyDuringMigration | string | null {
    return this.view;
  }

  /**
   * Sets the view to be applied.
   *
   * @param view Specification for a
   *     DataView that is applied to the input dataTable, or an array of
   *     specifications. For the specification format, see DataView#fromJSON().
   */
  setView(view: AnyDuringMigration[] | AnyDuringMigration | string | null) {
    this.view = view;
  }

  /**
   * Returns the initial view associated with this Wrapper.  An initial view
   * is received from Maestro and defines the columns including their order
   * and roles.
   *
   * @return Specification for a DataView
   *     that is used as the initial data view before applying chart editor
   *     changes.
   */
  getInitialView(): AnyDuringMigration[] | AnyDuringMigration | string | null {
    return this.initialView;
  }

  /**
   * Pushes a serializable view specification onto the view stack. The new
   * view will be applied on top of any views that are currently on the stack.
   * @param view A serializable view specification object.
   */
  pushView(view: AnyDuringMigration) {
    if (Array.isArray(this.view)) {
      this.view.push(view);
    } else if (this.view === null) {
      this.view = [view];
    } else {
      this.view = [this.view, view];
    }
  }

  // Query methods

  /**
   * Returns the query string for this wrapper.
   * @return The query string for this wrapper.
   */
  getQuery(): string | null {
    return this.query;
  }

  /**
   * Sets the select query string for this wrapper.
   * @param query The select query string for this wrapper.
   */
  setQuery(query: string | null) {
    this.query = query;
    // Currently, we always create a new Query, so we just dispose the old one.
    this.disposeQuery();
  }

  /**
   * Sends this wrapper's query to the gviz data source. Similar to
   * Query#send(). By default, sends the query only once.
   * To send the query repeatedly at the wrapper's refresh interval, pass in
   * true for enableRefresh
   *
   * @param callback A callback
   *     to execute when the query returns.
   *     TODO(dlaliberte): callback arg should be !QueryResponse.
   * @param enableRefresh If true, the query is sent repeatedly
   *     at this wrapper's refresh interval. If the wrapper has no refresh
   *     interval, this parameter has no effect.
   */
  sendQuery(
    callback: (p1: QueryResponse | null) => AnyDuringMigration,
    enableRefresh = false,
  ) {
    // Create a new query, after disposing of any previous query.
    this.disposeQuery();
    const url = this.getDataSourceUrl() || '';
    const query = (this.queryObject = new Query(url));

    const refreshInterval = this.getRefreshInterval();
    if (refreshInterval && enableRefresh) {
      query.setRefreshInterval(refreshInterval);
    }

    const selectStatement = this.getQuery();
    if (selectStatement) {
      query.setQuery(selectStatement);
    }

    query.send(callback);
  }

  /**
   * Returns the refresh interval for this wrapper.
   * @return The refresh interval for this wrapper.
   */
  getRefreshInterval(): number | null {
    return this.refreshInterval;
  }

  /**
   * Sets the refreshInterval for this wrapper.
   * @param refreshInterval The refreshInterval for this wrapper.
   */
  setRefreshInterval(refreshInterval: number | null) {
    this.refreshInterval = refreshInterval;
    // Currently, we always create a new Query, so we just dispose the old one.
    this.disposeQuery();
  }

  /**
   * Returns the custom request handler or null.
   * @return The custom request handler
   *     or null.
   */
  getCustomRequestHandler():
    | ((
        p1: (p1: AnyDuringMigration | null) => AnyDuringMigration,
        p2: string,
      ) => AnyDuringMigration)
    | null {
    return this.customRequestHandler;
  }

  /**
   * Sets the custom request handler.  The request handler accepts a response
   * handler function and a data source url and has no return value.  The
   * response handler function is to be called with the gviz response object
   * (optionally asynchronously).
   * TODO(dlaliberte): requestHandler function's first arg should be:
   *   (!QueryResponse) => void
   * @param requestHandler The custom request handler or null.
   */
  setCustomRequestHandler(
    requestHandler:
      | ((
          p1: (p1: AnyDuringMigration | null) => AnyDuringMigration,
          p2: string,
        ) => AnyDuringMigration)
      | null,
  ) {
    this.customRequestHandler = requestHandler;
  }

  /**
   * Handles an error in a query response.
   * @see #handleError
   *
   * @param container The container to show the error in.
   * @param response A query response.
   */
  private handleQueryResponseError(
    container: Element,
    response: QueryResponse,
  ) {
    const message = response.getMessage();
    const detailedMessage = response.getDetailedMessage();
    const id = QueryResponse.addError(container, response);
    trigger(this, 'error', {
      'id': id,
      'message': message,
      'detailedMessage': detailedMessage,
    });
  }

  // Option methods.

  /**
   * Returns a visualization option for this wrapper. If the option value is
   * null or undefined return the default value (which is either the specified
   * value or null). Note: the key may be a qualified name, such as
   * 'hAxis.viewWindow.max'. In that case, the key is taken to refer to a nested
   * object, and getOption() looks up the nested object. If *any* of the nested
   * objects on the object path is null, getOption() returns null. For example,
   * if wrapper.getOption('hAxis.viewWindow') == null then
   * wrapper.getOption('hAxis.viewWindow.max') == null.
   *
   * @param key The name of the option.
   * @param defaultValue A default value to return if the option is null or
   *     undefined.
   * @return The value of the option.
   */
  getOption(
    key: string,
    defaultValue?: AnyDuringMigration,
  ): AnyDuringMigration {
    return Wrapper.staticGetOption(this.options, key, defaultValue);
  }

  /**
   * Returns a visualization option. If the option value is null or undefined
   * return the default value (which is either the specified value or null).
   * @param options The options.
   * @param key The name of the option.
   * @param defaultValue A default value to return if the option is null or
   *     undefined.
   * @return The value of the option.
   */
  private static staticGetOption(
    options: AnyDuringMigration,
    key: string,
    defaultValue?: AnyDuringMigration,
  ): AnyDuringMigration {
    // getObjectByName() should work even if there is no '.', but it makes me
    // nervous. Why take chances?
    let result =
      key.indexOf('.') === -1
        ? options[key]
        : goog.getObjectByName(key, options);
    defaultValue = defaultValue !== undefined ? defaultValue : null;
    result = result != null ? result : defaultValue;
    return result;
  }

  /**
   * Returns the visualization options for this wrapper.
   * @return The visualization options for this wrapper.
   */
  getOptions(): AnyDuringMigration {
    return this.options;
  }

  /**
   * Sets a visualization option for this wrapper. If the given value is null,
   * the option will be removed if it exists.
   * Note: the key may be a qualified name, such as 'vAxis.viewWindow.max'.
   * In such a case, the prefix of the key will be taken as the "path" to a
   * nested object. If any nested objects on the path are null or undefined,
   * setOption() will create new objects at the specified path, kind of like
   * mkdir -p.
   * @param key The name of the option.
   * @param value The value of the option.
   */
  setOption(key: string, value: AnyDuringMigration) {
    if (value == null) {
      Wrapper.deleteOption(this.options, key);
    } else {
      Wrapper.staticSetOption(this.options, key, value);
    }
  }

  /**
   * Sets a visualization option. Works similarly to {@link goog.exportSymbol}
   * except it will override any existing non-objects in the option path to set.
   * @param options The options.
   * @param key The name of the option.
   * @param value The value of the option.
   */
  static staticSetOption(
    options: AnyDuringMigration,
    key: string,
    value: AnyDuringMigration,
  ) {
    const parts = key.split('.');
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        // If we are on the last part, just set the option.
        options[part] = value;
      } else if (
        goog.isObject(options[part]) &&
        options[part] !== (Object.prototype as AnyDuringMigration)[part]
      ) {
        // Move into the nested option if it is a valid object.
        options = options[part];
      } else {
        // Otherwise make a new object for the relevant option.
        options[part] = {};
        options = options[part];
      }
    }
  }

  /**
   * Removes a visualization option.
   * @param options The options.
   * @param key The name of the option.
   */
  private static deleteOption(options: AnyDuringMigration, key: string) {
    if (Wrapper.staticGetOption(options, key) !== null) {
      const path = key.split('.');
      if (path.length > 1) {
        key = path.pop()!;
        const object = Wrapper.staticGetOption(options, path.join('.'));
        assert(goog.isObject(object));
        options = object;
      }
      delete options[key];
    }
  }

  /**
   * Sets the visualization options for this wrapper.
   * @param options The visualization options for this wrapper.
   */
  setOptions(options: AnyDuringMigration | null) {
    this.options = options || {};
  }

  // State methods.

  /**
   * Returns the visualization state for this wrapper.
   * @return The visualization state for this wrapper.
   */
  getState(): AnyDuringMigration {
    return this.state;
  }

  /**
   * Sets the visualization state for this wrapper.
   * @param state The visualization state for this wrapper.
   */
  setState(state: AnyDuringMigration) {
    this.state = state || {};
  }

  // Draw methods.

  /**
   * Draws the visualization once the visualization api has been loaded.
   *
   * @param container The UI container to draw in.
   */
  private drawAfterApiLoad(container: Element) {
    const dataTable = this.getDataTable();
    if (dataTable) {
      this.drawFromDataTable(container, dataTable);
    } else if (this.getDataSourceUrl() !== null) {
      // create callback for #sendQuery()
      const callbackDrawAfterQuery = this.drawFromQueryResponse.bind(
        this,
        container,
      );
      // wrap the callback in a try catch so that errors in handleQueryResponse
      // will be handled here and will not propagate to the caller
      const callbackAfterSend = createProtectedCallback(
        callbackDrawAfterQuery,
        this.handleDrawError.bind(this, container),
      );
      this.sendQuery(callbackAfterSend, true);
    } else {
      throw new Error('Cannot draw chart: no data specified.');
    }
  }

  /**
   * Handles a query response, if no error, draws a visualization.
   *
   * @param container The UI container to draw in.
   * @param response The QueryResponse
   *     from the gviz query.
   */
  private drawFromQueryResponse(container: Element, response: QueryResponse) {
    if (response.isError()) {
      this.handleQueryResponseError(container, response);
      return;
    }
    const dataTable = response.getDataTable();
    this.drawFromDataTable(container, dataTable);
  }

  /**
   * Draws a visualization given a DataTable. The given DataTable may be from a
   * query response or from this.getDataTable().
   *
   * @param container The UI container to draw in.
   * @param dataTable The data to visualize.
   */
  protected drawFromDataTable(
    container: Element,
    dataTable: AbstractDataTable | null,
  ) {
    const visualization = this.setupVisualization(container);
    this.recentDataTable = dataTable;

    // A shallow clone, populated with the properties necessary to apply the
    // extensions. The extensions can modify the data table and options.
    // IMPORTANT: We do NOT call draw on the delegate, or we'd get
    // an infinite loop.
    const clonedOptions = unsafeClone(this.getOptions());

    const delegate = new Wrapper(this.wrapperKind, {
      'chartType': this.getType(),
      'dataTable': dataTable,
      'options': clonedOptions,
      'view': this.getView(),
    });

    for (let i = 0; i < this.extensions.length; i++) {
      this.extensions[i](delegate);
    }

    visualization.draw(
      delegate.getDataTable(),
      delegate.getOptions(),
      this.getState(),
    );
  }

  /**
   * Draws the specified visualization in the given container.
   *
   * Note: to reuse the same visualization, pass the same container or
   * containerId to #draw(), or leave the container property the same.
   *
   * @param optContainer A DOM element to draw in, or the
   *     ID of such an element. If not provided, this.getContainerId() is used.
   */
  draw(optContainer?: Element | null | string) {
    if (optContainer) {
      this.setContainer(optContainer);
    }
    const container = assertIsElement(this.getContainer());

    try {
      // Wrap in a try catch so that errors in sendQuery or anything else
      // will be handled here and will not propagate to the caller.

      if (this.getTypeConstructor()) {
        this.drawAfterApiLoad(container);
      } else {
        // Create callback for when the gviz api is loaded
        const drawAfterLoad = this.drawAfterApiLoad.bind(this, container);
        const protectedDraw = createProtectedCallback(
          drawAfterLoad,
          this.handleDrawError.bind(this, container),
        );
        this.loadApi(protectedDraw);
      }
    } catch (x) {
      this.handleDrawError(container, x);
    }
  }

  /**
   * Handles an error by adding an error message and dispatching an 'error'
   * event.
   *
   * @param container The container to show the error in.
   * @param e An error.
   */
  private handleDrawError(container: Element, e: AnyDuringMigration | null) {
    const message = e && typeof e.message !== 'undefined' ? e.message : 'error';
    const id = addError(container, message);
    trigger(this, 'error', {'id': id, 'message': message});
  }

  /**
   * Return the map of property accessors for the Wrapper class or subclass.
   * @return A new DataTable-based Wrapper.
   */
  getAccessors(): {[key: string]: AnyDuringMigration} {
    return propertyAccessors;
  }

  /**
   * Sets a visualization property for this wrapper.
   * Note: the key may be a path, but the first component of the key
   * must be a top-level property of the wrapper,
   * e.g. 'options.vAxis.viewWindow.max'.
   * If any nested objects on the path are null or undefined,
   * setProperty() will create new objects at the specified path,
   * kind of like mkdir -p.
   * @param key The path of the property.
   * @param value The value of the property.
   */
  setProperty(key: string, value: AnyDuringMigration) {
    const path = key.split('.');
    if (path.length > 0) {
      const topKey = path.shift();
      if (typeof topKey !== 'string') {
        throw new Error(`Bad path component in "${path}"`);
      }
      const accessors = this.getAccessors();
      const accessor = accessors[topKey];
      if (!accessor) {
        // Not going to work.
        return;
      }
      if (path.length === 0) {
        // Set top level property.
        accessor['set'].apply(this, value);
        return;
      } else {
        // More components on path.  Look up obj and treat like options.
        const obj = accessor['get'].apply(this);
        assert(goog.isObject(obj)); // `Property does not exist: ${topKey}`
        Wrapper.staticSetOption(obj, path.join('.'), value);
      }
    }
  }
}

/**
 * A map of the Wrapper specification properties to
 * getter/setter methods.
 */
const propertyAccessors: {
  [key: string]: {
    get: () => AnyDuringMigration;
    set: (p1: AnyDuringMigration) => AnyDuringMigration;
  };
} = {
  'name': {
    'get': Wrapper.prototype.getName,
    'set': Wrapper.prototype.setName,
  },
  'type': {
    'get': Wrapper.prototype.getType,
    'set': Wrapper.prototype.setType,
  },
  'container': {
    'get': Wrapper.prototype.getContainer,
    'set': Wrapper.prototype.setContainer,
  },
  'containerId': {
    'get': Wrapper.prototype.getContainerId,
    'set': Wrapper.prototype.setContainerId,
  },
  'options': {
    'get': Wrapper.prototype.getOptions,
    'set': Wrapper.prototype.setOptions,
  },
  'state': {
    'get': Wrapper.prototype.getState,
    'set': Wrapper.prototype.setState,
  }, // The rest are mostly for ChartWrappers
  'dataSourceUrl': {
    'get': Wrapper.prototype.getDataSourceUrl,
    'set': Wrapper.prototype.setDataSourceUrl,
  },
  'dataTable': {
    'get': Wrapper.prototype.getDataTable,
    'set': Wrapper.prototype.setDataTable,
  },
  'refreshInterval': {
    'get': Wrapper.prototype.getRefreshInterval,
    'set': Wrapper.prototype.setRefreshInterval,
  },
  'query': {
    'get': Wrapper.prototype.getQuery,
    'set': Wrapper.prototype.setQuery,
  },
  'view': {
    'get': Wrapper.prototype.getView,
    'set': Wrapper.prototype.setView,
  },
};

/**
 * Was in extensions.js
 * Included here to avoid circular dependency
 *
 * fileoverview A couple preliminary ChartWrapper extensions.
 * Extensions allow arbitrary pre-draw transformations to be
 * passed to the ChartWrapper in a highly decoupled interface.
 * Each extension is a function that accepts a ChartWrapper and
 * mutates it. The ChartWrapper class uses extensions internally
 * by creating a delegate, applying the extensions, and drawing
 * a chart based on the end state of the delegate.
 */

// const {applyPatternOptions, applyTrendLineOption, deserializeView,
// hackLabelsColumn} = goog.require('gviz.extensions');

/**
 * Reads the column patterns from the data table and copies them to the
 * corechart axis format options. See patterns.
 * @param wrapper The chart wrapper.
 */
export function applyPatternOptions(wrapper: Wrapper) {
  const data = wrapper.getDataTable();
  if (!data) {
    return;
  }
  patterns.applyPatternOptions(wrapper.getType(), data, wrapper.getOptions());
}

/**
 * If the wrapper has a view, updates the wrapper's data table to reflect
 * the view, and nulls out the view. Otherwise does nothing.
 * @param wrapper The chart wrapper.
 */
export function deserializeView(wrapper: Wrapper) {
  let dataTable = wrapper.getDataTable();
  const view = wrapper.getView();
  if (Array.isArray(view)) {
    for (let i = 0; i < view.length; i++) {
      assert(dataTable != null);
      // TODO(dlaliberte): avoid this.
      dataTable = DataView.fromJSON(dataTable!, view[i]);
    }
  } else if (view !== null) {
    assert(dataTable != null);
    // TODO(dlaliberte): avoid this.
    dataTable = DataView.fromJSON(dataTable!, view);
  }

  // No other extensions should be accessing the view.
  wrapper.setView(null);

  assert(dataTable != null);
  // TODO(dlaliberte): avoid this.
  wrapper.setDataTable(dataTable);
}

/**
 * Adds an empty labels column or converts the first column to a labels column
 * if needed, according to the options.
 * @param wrapper The chart wrapper.
 */
function hackLabelsColumn(wrapper: Wrapper) {
  const type = wrapper.getType();
  if (!isCoreChart(type) || type === 'ScatterChart') {
    // hasLabelsColumn is supported only on core chart except for scatter chart.
    // We must ignore this option because we used to create charts with this
    // option assuming it will only be handled by core chart.
    return;
  }

  const data = wrapper.getDataTable();
  const hasLabelsColumn = wrapper.getOption('hasLabelsColumn');
  if (hasLabelsColumn == null) {
    return;
  }

  // If hasLabelsColumn == true, stringify the first column.
  // Otherwise, add an empty labels column.
  const viewColumns: Array<number | ColumnSpec> = [
    {
      'calc': hasLabelsColumn ? 'stringify' : 'emptyString',
      'sourceColumn': 0,
      'type': 'string',
    },
  ];
  const first = hasLabelsColumn ? 1 : 0;
  const numberOfColumns = data!.getNumberOfColumns();
  for (let i = first; i < numberOfColumns; i++) {
    viewColumns.push(i);
  }

  const view = new DataView(data!);
  view.setColumns(viewColumns);

  // Handled the hasLabelsColumn option - remove it so that the chart will not
  // invoke its internal logic for handling this option again.
  wrapper.setOption('hasLabelsColumn', null);

  wrapper.setDataTable(view);
}

/**
 * Was in trendlines.js
 *
 * fileoverview Implementation for the ChartWrapper trendlines extension.
 */

/**
 * Adds a simple trendline under certain conditions.
 * This feature is very experimental!
 * In the current version, the trendlines extension uses a fake option called
 * "addTrendLine". In the future, we may add a dedicated top-level wrapper
 * property for the trendlines, or we may open up the extensions to accept
 * their own options.
 * TODO(dlaliberte): Support advanced regression analysis, such as exponential
 * regression, logarithmic regression, etc. You know, like Excel.
 * @param wrapper The chart wrapper.
 */
export function applyTrendLineOption(wrapper: Wrapper) {
  if (wrapper.getOption('addTrendLine')) {
    const dataTable = wrapper.getDataTable();

    // TODO(dlaliberte): Handle charts with more than one series.
    // TODO(dlaliberte): Support BubbleChart?
    if (
      wrapper.getType() === 'ScatterChart' &&
      dataTable!.getNumberOfColumns() === 2
    ) {
      const view = createTrendView(dataTable!);
      wrapper.setDataTable(view);
      // TODO(dlaliberte): setOption('interpolateNulls', true)?
      wrapper.setOption('series.1.lineWidth', 2);
      wrapper.setOption('series.1.pointSize', 0);
      wrapper.setOption('series.1.visibleInLegend', false);
    }
    wrapper.setOption('addTrendLine', null);
  }
}

/**
 * Creates a DataView with a second data series that represents the linear
 * regression of the first (and only!) data series.
 * @param dataTable The data table.
 * @return The data view.
 */
function createTrendView(dataTable: AbstractDataTable): DataView {
  const trendline = computeSlopeAndIntercept(dataTable);

  // Create a view with a fake data series for the trend line.
  const view = new DataView(dataTable);
  const calcFunc = (data: AbstractDataTable, row: number) => {
    data = data;
    const coordinate = getCoordinate(dataTable, row);
    if (coordinate !== null) {
      return trendline.slope * coordinate.x + trendline.intercept;
    } else {
      return null;
    }
  };
  view.setColumns([
    0,
    1,
    {
      'type': 'number',
      'calc': calcFunc,
    },
  ]);

  return view;
}

/**
 * Computes the mean x value and the mean y value.
 * @param dataTable The data table.
 * @return The mean x value and the mean y value.
 */
function computeMean(dataTable: AbstractDataTable): Coordinate {
  const n = dataTable.getNumberOfRows();
  const sum = new Coordinate();

  // Compute the average x and y.
  for (let i = 0; i < n; i++) {
    const value = getCoordinate(dataTable, i);

    if (value !== null) {
      sum.x += value.x;
      sum.y += value.y;
    }
  }

  return new Coordinate(sum.x / n, sum.y / n);
}

/**
 * Computes the slope and intercept for the linear regression trend line.
 * @param dataTable The data table.
 * @return The slope and the intercept.
 */
function computeSlopeAndIntercept(dataTable: AbstractDataTable): {
  slope: number;
  intercept: number;
} {
  const mean = computeMean(dataTable);

  let numerator = 0;
  let denominator = 0;

  // Compute the slope.
  for (let i = 0; i < dataTable.getNumberOfRows(); i++) {
    const value = getCoordinate(dataTable, i);

    if (value !== null) {
      const diff = new Coordinate(value.x - mean.x, value.y - mean.y);
      numerator += diff.x * diff.y;
      denominator += diff.x * diff.x;
    }
  }

  const slope = numerator / denominator || 1;
  const result = {slope, intercept: mean.y - slope * mean.x};
  return result;
}

/**
 * Converts a row in a data table to a Coordinate object.
 * Implicitly uses the column 0 and 1 values.
 * If either value is null, the result is null.
 *
 * @param data The data table.
 * @param row The row number.
 * @return A coordinate.
 */
function getCoordinate(
  data: AbstractDataTable,
  row: number,
): Coordinate | null {
  const x = data.getValue(row, 0);
  const y = data.getValue(row, 1);
  if (x == null || y == null) {
    return null;
  } else {
    // TODO(dlaliberte): Should we make some guarantees about this?
    return new Coordinate(x as number, y as number);
  }
}
