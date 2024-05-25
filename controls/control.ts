/**
 * @fileoverview Outlines the generic structure that all controls share.
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

import {assert} from '@npm//@closure/asserts/asserts';
import {dispose} from '@npm//@closure/disposable/dispose';
import {removeChildren} from '@npm//@closure/dom/dom';

import {AnyCallbackWrapper} from '../common/async_helper';
import * as gvizJson from '../common/json';
import {Options, UserOptions} from '../common/options';
import {AbstractDataTable} from '../data/abstract_datatable';
import {validateDataTable} from '../data/datautils';
import * as gvizDom from '../dom/dom';
import {ControlEventType} from '../events/chart_event_types';
import {addListener, removeListener, trigger} from '../events/events';
import {DynamicLoading} from '../loader/dynamic_loading';
import {AbstractVisualization} from '../visualization/abstract_visualization';
import {WrapperInterface} from '../wrapper/wrapper_interface';

import {ControlUi, ControlUiConstructor} from './control_ui';

const {READY, STATE_CHANGE, UI_CHANGE} = ControlEventType;
const {deserialize, serialize} = gvizJson;

// tslint:disable:ban-types Migration

/**
 * Base class for visualization Controls. Manages the shared infrastructure that
 * all controls rely upon and ensures isolation between Controls logic (the way
 * they interact with data) and user interface (the way a Control accepts
 * external input, typically in the form of user interaction).
 *
 * All Controls share the following traits:
 * - They have a container to host their UI and accept configuration options to
 *   characterize both their behavior and presentation.
 *
 * - They have a state. A Control state typically describes the input the user
 *   provided. In the simple case of a text input field Control, the state
 *   would be the input field value.
 *   A Control state is managed and persisted externally, typically by a
 *   google.visualization.ControlWrapper instance. When a redraw occurs, for
 *   example as a result of a change propagated by a
 *   google.visualization.Choreographer managing this Control, the Control will
 *   redraw its own UI. In doing so, it will use state information received on
 *   #draw() to re-set the UI in the same state it was before the redraw.
 *
 * - They can make their state externally available and can receive a new state
 *   programmatically, via #getState() and #draw() methods respectively.
 *   We expect controls to be placed in contexts with defined serialization and
 *   lifecycle requirements: this includes being part of forms and/or supporting
 *   freezing and restoring controls' state across page refreshes and user
 *   sessions. Therefore Controls provide ways to export to and receive state
 *   changes from the surrounding context.
 *
 * - They provide clear isolation between their logic (the way they interact
 *   with the DataTables they manage) and their user interface. Controls user
 *   interfaces are implemented by separate classes conforming to the
 *   google.visualization.ControlUi specification. In addition to separating
 *   logic from view, this allows different UI implementations to be plugged in
 *   to accommodate user requirements (a Controls user might provide its own UI
 *   library implementation) and interface coherency (for example, switching to
 *   GWT-based controls when deploying within a GWT application).
 *   Each Control defines its own specific format for the data it shares with
 *   its assigned Ui implementation class.
 *   A Control ships with a default UI implementation class, which can be
 *   replaced with custom alternatives that adhere to the same data
 *   interchange format.
 *
 * About Controls State
 * --------------------
 * Like some visualizations, Controls have an internal state. The purpose of
 * Controls' state is to hold the input the user provides when interacting with
 * the control.
 *
 * A Control state is expected to be a JSON-serializable object (with the
 * caveats defined in gviz/jsapi/packages/core/json.js for Date handling).
 *
 * State persistence across redraws is not managed by the Control itself, but
 * delegated to external components, typically a
 * google.visualization.ControlWrapper wrapping the Control. A Control exposes
 * its state via #getState() and receives the state to use via #draw().
 *
 * A Control state may be affected in multiple ways:
 * - When the user interacts with the Control UI, the internal state
 *   representation is updated accordingly, so that the UI contents are always
 *   semantically equivalent to the underlying Control state.
 *
 * - In addition to user input, a Control state may be affected
 *   programmatically. Controls collect user input that hosting applications may
 *   want to persist (for example, when the user leaves and then returns to a
 *   page hosting Controls, the webapplication may want to rebuild Controls in
 *   the same state they were left in) or propagate (such as sending Controls
 *   states over the wire via forms or ajax requests). For this reason a Control
 *   state is exposed to the external environment in read/write mode via the
 *   methods described above.
 *
 * - External entities can register their interest on state changes by listening
 *   to 'statechange' and/or 'ready' events fired by the Control. The former
 *   notifies an explicit state-changing user interaction with the Control UI.
 *   The latter notifies that draw() occurred, within which the Control may
 *   alter its state.
 *
 * - A Control state may be constrained depending on the contents of the
 *   DataTable that powers the control. For example, a slider range may have its
 *   extents limited depending on the data range of the underlying DataTable.
 *   It is up to specific control implementations to apply such constraints.
 *
 * Controls LifeCycle
 * ------------------
 * All Controls have the following draw() lifecycle (this handles both explicit
 * draw() calls as well as implicit ones triggered by a Choreographer managing
 * the control in response to user interaction on upstream controls driving
 * this one):
 * - prepareState(): If this is the first draw(), i.e. no pre-existent
 *   state exists, the initial state received in #draw() is stored. This is used
 *   to support reset functionality.
 *
 * - prepareOptions(): Externally-provided configuration options are merged
 *   with the Control defaults.
 *
 * - prepareDraw(): Any additional Control-specific changes to state and/or
 *   options take place (such as constraining the control state based on the
 *   DataTable contents).
 *
 * - drawUi(): The current Ui (if any) is disposed. A suitable Ui implementation
 *   for this control is located, instantiated and drawn (according to the
 *   control state).
 *
 * - The Control starts listening for 'uichange' events fired by the user
 *   interface.
 *
 * - The Control internal state is updated to match the current UI state.
 *
 * - The 'ready' event is fired.
 *
 * Whenever the user interacts with the Control:
 * - The Control picks up the 'uichange' event fired by the UI class.
 *
 * - The Control internal state is updated to match the current UI state.
 *
 * - The Control implementation subclass decides how to handle the event, most
 *   likely firing a 'statechange' event to notify external parties that the
 *   DataTable managed by the control has changed.
 *
 * Programmatic state changes are issued to the Control by calling its #draw()
 * method with a custom state parameter. When the Control is wrapped in a
 * google.visualization.ControlWrapper instance, this is achieved by calling the
 * wrapper #setState() method, followed by #draw().
 *
 * Whenever the user asks for an explicit Control reset (via its
 * resetControl() method):
 * - The Control internal state is emptied.
 *
 * - The Control Ui is reset to its initial value (similarly to the way HTML
 *   forms work, see http://www.w3.org/TR/html401/interact/forms.html#h-17.2).
 *   The initial value to reset to is derived from what was received in the
 *   first control draw.
 *
 * Controls Subclasses
 * -------------------
 * Subclasses extending this base class must implement the following:
 *
 * - getDefaultUiClass(): returns the name of the default Ui
 *   implementation class for the control, to be used whenever the Ui
 *   class is not overridden via configuration options.
 *
 * - getDefaultOptions() (Optional): returns the set of default options for the
 *   Control. This includes UI-related options. By default returns an empty
 *   object, for Controls that don't provide any default.
 *
 * - getUiOptions() (Optional): returns the subset of configuration options
 *   that are to be forwarded to Ui implementation classes. By default any
 *   configuration option stored in the 'ui' subobject is forwarded.
 *
 * - prepareDraw() (Optional): perform any manipulation on the Control options
 *   and/or state before actual drawing occurs.
 *
 * - handleUiChangeEvent() (Optional): reacts to 'uichange' events fired by the
 *   Ui implementation class. By default fires a 'statechange' event.
 *
 * TODO(dlaliberte): Just use 'apply'; it's simpler.
 * - applyFilter()/applyOperator(): as required by the Controls contract.
 *
 * Any subclass method can throw Javascript errors to signal anomalies. Errors
 * will automatically translate into Google Visualization 'error' events and
 * error messages in the UI when deployed in a production setting.
 *
 * Shared configuration options
 * ----------------------------
 * The Control class defines only one configuration option that all subclasses
 * inherit:
 *   ui.type {string} A string resolving into a constructor function that
 *       accepts a DOM element (container) and creates a
 *       google.visualization.ControlUi instance, that will act as the
 *       Control Ui implementation class.
 */
export class Control extends AbstractVisualization {
  /**
   * Array of dependencies that this control is bound to.
   * These are the downstream participants in the dashboard.
   */
  private dependencies: WrapperInterface[] = [];

  /**
   * The Datatable this control operates on.
   */
  private data: AbstractDataTable | null = null;

  /**
   * The configuration options as received by #draw().
   */
  private userOptions: AnyDuringMigration | null = null;

  /**
   * The configuration options, including the ones provided by the user and
   * the Control defaults.
   */
  private options: Options | null = null;

  /**
   * The UI implementation class for this control.
   */
  private ui: ControlUi | null = null;

  /**
   * The listener that will react to UI changes.
   */
  private uiListener: AnyDuringMigration | null = null;

  /**
   * The control state as received by #draw().
   */
  private userState: {[key: string]: AnyDuringMigration} | null = null;

  /**
   * The control state, modeled as a key-value map.
   * A Control state is expected to be a JSON-serializable object (with the
   * caveats defined in gviz/jsapi/packages/core/json.js for Date handling).
   *
   */
  private state: {[key: string]: AnyDuringMigration} | null = null;

  /**
   * The control initial state, i.e. the one received during the first draw().
   */
  private initialState: {[key: string]: AnyDuringMigration} | null = null;

  /**
   * @param container The DOM element container for the control.
   */
  constructor(container: Element | null) {
    super(container);
  }

  override disposeInternal() {
    this.clear();
    // This is possibly wrong.
    super.disposeInternal();
  }

  /**
   * Clear internals to initial state, so it can be disposed or reused.
   */
  clear() {
    this.clearInternal();
  }

  /**
   * Remove the control's UI.  Override if more is needed.
   */
  override clearInternal() {
    this.disposeUi();
  }

  /**
   * Returns the DataTable or DataView this Control operates on.
   *
   * @return The DataTable or DataView this control
   *     operates on.
   */
  protected getDataTable(): AbstractDataTable {
    return this.data as AbstractDataTable;
  }

  /**
   * Returns the Control configuration options, inclusive of both the Control
   * defaults and user provided overrides.
   * Subclasses should rely on these options to configure themselves.
   *
   * @return The Control configuration options.
   */
  getOptions(): Options {
    return this.options as Options;
  }

  /**
   * Returns the Control UI implementation class for this control.
   *
   * @return The UI implementation class for this
   *     control.
   */
  getUi(): ControlUi {
    return this.ui as ControlUi;
  }

  /**
   * Returns the default configuration options for this control.
   * Subclasses to override and provide their specific options.
   *
   * @return The default options.
   */
  protected getDefaultOptions(): {[key: string]: AnyDuringMigration} {
    return {};
  }

  /**
   * Returns the options to send to the Control UI implementation class to draw
   * itself.
   *
   * The default implementation returns all the options under the 'ui' option
   * key, if any. For example, given options {a: 'foo', ui: {'b': 'bar', 'c':
   * 'baz'}}, the UI implementation class would receive {'b': 'bar', 'c':
   * 'baz'}.
   *
   * Subclasses can override to provide their specific options. The returned
   * options will typically be the subset of the Control options that define ui
   * aspects, out of the entire set of Control options (driving both ui and
   * logic).
   *
   * @param data The dataTable or dataView.
   * @param options The control configuration options.
   * @return Options that will be passed to the UI
   *     implementation class to draw itself.
   */
  protected getUiOptions(
    data: AbstractDataTable,
    options: Options,
  ): {[key: string]: AnyDuringMigration} {
    return options.inferWholeObjectValue('ui', {}) as AnyDuringMigration;
  }

  /**
   * Returns the name or class of the default UI implementation class
   * for this control. Subclasses to override.
   * @return the name of the default UI implementation class
   *     for this control.
   */
  protected getDefaultUiClass(): string | Function {
    return '';
  }
  // unknown

  /**
   * @param dependencies The array of dependencies that
   * this control is wired to.  Replaces any current dependencies.
   */
  setDependencies(dependencies: WrapperInterface[]) {
    this.dependencies = dependencies;
  }

  /**
   * @return The array of dependencies.
   */
  getDependencies(): WrapperInterface[] {
    return this.dependencies;
  }

  /**
   * Subclasses to override to perform any custom operations that are required
   * before actual Control drawing occurs, such as validating the Control state,
   * constraining it based on the actual DataTable contents and/or enrich the
   * option set with additional ones.
   *
   * @param data The dataTable or dataView.
   * @param options The control configuration options.
   * @param state The control state.
   */
  prepareDraw(
    data: AbstractDataTable,
    options: Options,
    state: {[key: string]: AnyDuringMigration},
  ): void {}

  /**
   * Returns a deep copy of the Control state (supposed only to be read and not
   * written to).
   *
   * @return The Control state, or null if the Control state
   *     has not been built yet (draw() has not been called yet).
   */
  getState(): {[key: string]: AnyDuringMigration} | null {
    if (!this.state) {
      return null;
    }
    // TODO(dlaliberte): make this work: gviz.json.clone(this.state);
    return deserialize(serialize(this.state));
  }

  /**
   * Renders the control.
   * See constructor comment for an overview about draw() lifecycle. See
   * implementing subclasses for the list of supported options by each Control.
   *
   */
  override draw(
    dataTable: AbstractDataTable | null,
    options?: UserOptions,
    state?: {},
  ) {
    validateDataTable(dataTable);
    assert(dataTable != null);

    this.data = dataTable;
    this.userOptions = options || {};
    this.userState = state || {};
    this.errorHandler.safeExecute(this.drawControl, this);
  }

  /**
   * Not used here, but must be overridden from AbstractVisualization.
   * @param asyncWrapper A function that
   *     accepts a callback (and possibly a 'this' context object) and wraps
   *     it for async execution.
   * @param dataTable The data table.
   * @param options The visualization options.
   * @param state The state of the chart.
   */
  override drawInternal(
    asyncWrapper: AnyCallbackWrapper,
    dataTable: AbstractDataTable,
    options?: AnyDuringMigration | null,
    state?: AnyDuringMigration | null,
  ): void {}

  /**
   * Renders the control.
   */
  private drawControl() {
    if (!this.data) {
      return;
    }

    // Assemble the Control state if not already defined (initial draw).
    this.prepareState();

    // Compute visualization options.
    // Set default options if never done before, and merge user-provided options
    // over the defaults.
    this.prepareOptions();

    // Additional subclass-specific preparation.
    this.prepareDraw(
      this.data,
      this.options as Options,
      this.state as {[key: string]: AnyDuringMigration},
    );

    // Clear the current UI and redraw it.
    this.drawUi();
    trigger(this, READY, null);
  }

  /**
   * Merges the default options with the user-provided ones (which take
   * precedence over the default).
   *
   */
  private prepareOptions() {
    this.options = new Options([
      this.userOptions,
      this.getDefaultOptions() || {},
    ]);
  }

  /**
   * Assembles the Control state and sets the initial state if this is the first
   * draw.
   */
  private prepareState() {
    this.state = this.userState || {};
    if (!goog.isObject(this.state)) {
      throw new Error('Control state must be an object.');
    }
    this.initialState = this.initialState || this.state;
  }

  /**
   * Redraws the Control user interface.
   * Does not clear the previous UI, if any.
   * Subclasses are responsible for clearing before drawing if required.
   */
  private drawUi() {
    if (!this.ui) {
      // Create the implementation ui class instance.
      this.ui = this.createUiInstance();

      if (!this.ui) {
        throw new Error('Invalid UI instance.');
      }

      // Attach event listener.
      this.uiListener = addListener(
        this.ui,
        UI_CHANGE,
        this.uiChanged.bind(this),
      );
    }

    // Draw it.
    this.ui.draw(
      this.state as {[key: string]: AnyDuringMigration},
      this.getUiOptions(
        this.data as AbstractDataTable,
        this.options as Options,
      ),
    );

    // Update the internal state.
    this.state = this.ui.getState();
  }

  /**
   * Disposes the current user interface (if any) prior to a Control redraw.
   */
  private disposeUi() {
    if (this.uiListener) {
      removeListener(this.uiListener);
      dispose(this.uiListener);
      this.uiListener = null;
    }
    dispose(this.ui);
    this.ui = null;
    removeChildren(this.container);
  }

  /**
   * Creates an instance of the Control UI implementation class, either from
   * user-specified options or using a default fallback.
   *
   * @return An instance of the Control user
   *     interface.
   */
  private createUiInstance(): ControlUi | null {
    const ctorOrName = this.options!.inferValue(
      'ui.type',
      this.getDefaultUiClass(),
    );

    let ctorFunction: ControlUiConstructor | null;
    if (typeof ctorOrName === 'string') {
      ctorFunction = resolveConstructor(ctorOrName);
      if (typeof ctorFunction !== 'function') {
        throw new Error(`Unknown constructor for "${ctorOrName}"`);
      }
    } else {
      ctorFunction = ctorOrName as ControlUiConstructor;
    }

    if (ctorFunction) {
      return new ctorFunction(this.container);
    }
    return null;
  }

  /**
   * Callback invoked when the user interacted with the control UI.
   * @param event Event details that consists of a
   *     'inProgress' flag to distinguish between the range change event fired
   * by a mouse move
   *     ('inProgress': true) or by a mouse up ('inProgress': false).
   */
  private uiChanged(event: {[key: string]: AnyDuringMigration}) {
    // Pull updated state.
    this.state = this.ui!.getState();
    // Delegate to subclass, eventually firing the 'statechange' event.
    this.handleUiChangeEvent(this.state, event);
  }

  /**
   * Handler for subclasses to perform actions in response to user interactions
   * with the control UI. By default, a user interaction is assumed to drive
   * changes in the DataTable managed by this control, so we fire a
   * 'statechange' event immediately. Subclasses should override with their
   * custom logic if the assumption does not hold.
   *
   * @param state The Control state.
   * @param event Event details.
   */
  protected handleUiChangeEvent(
    state: {[key: string]: AnyDuringMigration} | null,
    event: {[key: string]: AnyDuringMigration},
  ) {
    trigger(this, STATE_CHANGE, event);
  }

  /**
   * Resets the control. 'Reset' here is to be intended with the same meaning as
   * resetting an HTML form: restores the Control state to its initial value
   * (updating the user interface if needed).
   */
  resetControl() {
    this.errorHandler.safeExecute(this.resetControlInternal, this);
  }

  /**
   * Internal handler for resetControl() that runs in a safeExecute trap. Since
   * resetControl() is a publicly available call point, we must protect the user
   * from errors that the implementation might raise.
   */
  private resetControlInternal() {
    if (this.initialState) {
      this.userState = this.initialState;
      this.drawControl();
    }
  }
}

/**
 * Resolves a constructor function given the name of the class to instantiate.
 * The name is first looked up in the google.visualization or gviz.controls.ui
 * namespace, and then if not found, in the goog.global namespace.
 *
 * @param userVizType The name of the class to instantiate.
 * @return The constructor for the named class, or null if the
 *     constructor is not found.
 */
function resolveConstructor(userVizType: string): ControlUiConstructor | null {
  if (typeof userVizType !== 'string') {
    throw new Error(
      `ControlUi type must be a string.  Found ${typeof userVizType}.`,
    );
  }
  const vizType = DynamicLoading.getSafeType(userVizType);
  const global = gvizDom.getGlobal();
  const paths = [
    `google.visualization.${vizType}`,
    `gviz.controls.ui.${vizType}`,
    vizType,
  ];

  for (const path of paths) {
    const obj = goog.getObjectByName(path, global);
    if (typeof obj === 'function') {
      return obj;
    }
  }

  if (!DynamicLoading.BUILT_FOR_DYNAMIC_LOADING) {
    throw new Error(`Unable to resolve constructor for "${userVizType}"`);
  }
  return null;
}
