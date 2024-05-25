/**
 * @fileoverview Wiring logic that binds together all visualizations and
 * controls sharing a common underlying DataTable. See the README file
 * for this package for further info.
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
  forEach,
  slice,
} from '@npm//@closure/array/array';
import {
  assert,
  fail,
} from '@npm//@closure/asserts/asserts';
import {Disposable} from '@npm//@closure/disposable/disposable';
import {every} from '@npm//@closure/object/object';
import {Timer} from '@npm//@closure/timer/timer';

import {ErrorHandler} from '../common/error_handler';
import {createProtectedCallback} from '../common/errors';
import {setIntersection} from '../common/object';
import {Selection} from '../common/selection';
import {SelectionObject} from '../common/selection_object';
import {AbstractDataTable} from '../data/abstract_datatable';
import {DataTable} from '../data/datatable';
import {DataView} from '../data/dataview';
import {ControlEventType} from '../events/chart_event_types';
import {addListener, removeListener, trigger} from '../events/events';
import {ControlWrapper} from '../wrapper/control_wrapper';
import {Wrapper} from '../wrapper/wrapper';

import {DAG} from './dag';
import {Filter} from './filter';
import {Operator} from './operator';
import {Setter} from './setter';

const {ERROR, READY, STATE_CHANGE} = ControlEventType;

// tslint:disable:ban-types  Migration

/**
 * A Choreographer is responsible for managing the wiring between all the
 * participants (visualizations or controls) that share a common underlying
 * DataTable and dispatching DataViews between them in response to user and
 * programmatic interaction on controls.
 *
 * The expected interaction between participants and the choreographer follows
 * these lines:
 * - Dependencies between participants are established via bind().
 * - Once all dependencies are set up, the ensemble of participants is
 *   bootstrapped via choreographer.draw(dataTable), which draws every
 *   participant in the correct order.
 * - When a user interacts with a control, the Choreographer responds to
 *   'statechange' events fired by control and updates all the affected
 *   participants.
 * - When a programmatic change is issued to a control (calling its draw()
 *   method), the Choreographer responds to 'ready' events fired by the
 *   control, and updates all the affected participants (a programmatic draw()
 *   that results in an 'error' event will be silently discarded by the
 *   Choreographer, except when a draw iteration is in progress. See the details
 *   on DrawIteration).
 * - Whenever a choreographer completes a full or partial redraw of its managed
 *   participants, it will fire a 'ready' or 'error' event (depending on whether
 *   the redraw was successful or any of the affected participants failed).
 *
 * A choreographer as a whole is ready for interaction once the 'ready' event
 * fired. A choreographer that fails drawing (firing an 'error' event) should be
 * assumed to be in an inconsistent state and re-drawn entirely.
 *
 * A choreographer manages a single datatable. A choreographer can manage
 * disconnected islands of visualizations and controls as long as they share
 * the same underlying datatable.
 *
 * A choreographer relies on ControlWrapper and ChartWrapper for encapsulation
 * of all the relevant properties that describe each participant.
 *
 * A choreographer dispatches draw requests to the managed participants
 * asynchronously. As such, it depends on all the participants firing 'ready'
 * (or 'error') events upon completion of their draw() operations.
 *
 * As a side note, a choreographer itself adheres to the basic specs for a
 * visualization:
 * - accepts a container in the constructor,
 * - exposes a draw(datatable) method,
 * - fires 'ready' and 'error' events.
 * hence with minor enhancements a choreographer itself could be wrapped in a
 * ChartWrapper, opening the field for choreographers nesting and treating
 * choreographers as building blocks of more complex dashboard arrangements.
 * @suppress {invalidCasts} // TODO(b/237100957): fix and remove this
 * suppression
 */
export class Choreographer extends Disposable {
  /**
   * A DAG for all the controls and visualizations managed by the
   * choreographer.
   */
  readonly participantsGraph: DAG;

  /**
   * The choreographer's selection. Effectively a union of all the charts'
   * selections.
   */
  private readonly selection: Selection;

  /**
   * A map of chart Uid to that chart's selection object. Used to figure out
   * selection diffs and update the Choreographer's selection accordingly.
   */
  private readonly selections: {[key: string]: Selection} = {};

  /**
   * A map of each selected item (be it row, column, or cell) to a set of the
   * participants that have it selected.
   */
  private readonly chartsBySelection: {[key: string]: Set<AnyDuringMigration>} =
    {};

  /** The datatable or dataview that was last provided to the draw() method. */
  private incomingData: AbstractDataTable | null = null;

  /** Keeps track of all event listeners on controls for later disposal. */
  private listeners: AnyDuringMigration[] = [];

  /** Error handler for choreographer errors. */
  private readonly errorHandler: ErrorHandler;

  /**
   * A draw iteration currently in process, or null if the Choreographer is
   * idle and is not redrawing the participants' graph (or parts of it).
   *
   * A draw iteration manages a full or partial graph redraw asynchronously.
   */
  private drawIteration: DrawIteration | null = null;

  /**
   * @param container An html element where any UI output from the choreographer
   *     will be sent (at the moment, this includes only error notifications).
   */
  constructor(container: Element) {
    super();

    this.participantsGraph = new DAG();

    this.selection = new Selection();

    this.errorHandler = new ErrorHandler(this, container);
  }

  /**
   * Returns the selection of this choreographer. This is effectively the union
   * of all the charts' selections.
   */
  getSelection(): SelectionObject[] {
    return this.selection.getSelection();
  }

  /**
   * Discards all the bindings and registration that occurred so far, and
   * stops dispatching view changes between participants.
   *
   * It does NOT recursively dispose all the managed participants.
   */
  override disposeInternal() {
    this.clear();
    super.disposeInternal();
  }

  /** Clear internals to initial state, so it can be disposed or reused. */
  clear() {
    forEach(this.listeners, (listener) => {
      removeListener(listener);
    });
    this.listeners = [];
    this.drawIteration = null;

    // TODO(dlaliberte): Figure out whether we can do this safely.
    // Recursively clear all the participants (and controls)
    /*
        const allParticipants = this.participantsGraph.getValues();
        for (let i = 0; i < allParticipants.length; i++) {
          const participant = allParticipants[i];
          participant.clear();
        }
        */
    this.participantsGraph.clear();
  }

  /**
   * Notifies that an error occurred, either by raising a javascript Error or
   * using GViz standard 'error' events, depending on whether we are operating
   * in debug mode or not (via googDEBUG flag).
   *
   * @param message The error message to display.
   */
  private handleError(message: string) {
    if (goog.DEBUG) {
      throw new Error(message);
    } else {
      this.errorHandler.addError(message);
    }
  }

  /**
   * Makes `participant` dependent on `control` for any event that
   * affects the view of the DataTable that `participant` uses.
   * Whenever `control` fires a 'statechange' or 'ready' event
   * (respectively in response to user interactions or programmatic changes
   * issued to the control), `participant` will redraw with a recomputed
   * DataView to include the latest changes that caused the event in the first
   * place.
   *
   * @param control The control to bind.
   * @param participant Either a visualization or a control.
   */
  bind(control: ControlWrapper, participant: Wrapper) {
    if (!Choreographer.looksLikeControl(control)) {
      this.handleError(`${control} does not fit the Control specification.`);
      return;
    }
    if (!Choreographer.looksLikeParticipant(participant)) {
      this.handleError(
        `${participant} does not fit either the Control or Visualization specification.`,
      );
      return;
    }

    const controlUid = goog.getUid(control);
    const participantUid = goog.getUid(participant);

    if (participantUid === controlUid) {
      this.handleError('Cannot bind a control to itself.');
      return;
    }

    const newParticipants = [];
    if (!this.participantsGraph.contains(control)) {
      newParticipants.push(control);
    }
    if (!this.participantsGraph.contains(participant)) {
      newParticipants.push(participant);
    }

    this.participantsGraph.addEdge(control, participant);
    // Throws an Error in goog.DEBUG mode, fails with a user message and
    // rollback of the requested bind in production mode.
    if (!this.areBindingsValid()) {
      this.participantsGraph.removeEdge(control, participant);
      return;
    }

    // Start listening for events on any new participant that we are
    // encountering for the first time.
    for (let i = 0; i < newParticipants.length; i++) {
      const newParticipant = newParticipants[i];
      this.listeners.push(
        addListener(
          newParticipant,
          STATE_CHANGE,
          this.handleParticipantStateChange.bind(this, newParticipant),
        ),
      );
      this.listeners.push(
        addListener(
          newParticipant,
          READY,
          this.handleParticipantReady.bind(this, newParticipant),
        ),
      );
      this.listeners.push(
        addListener(
          newParticipant,
          ERROR,
          this.handleParticipantError.bind(this, newParticipant),
        ),
      );

      // If the participant is a chart, listen for its select event.
      if ((newParticipant as AnyDuringMigration)['getChart']) {
        this.listeners.push(
          addListener(
            newParticipant,
            'select',
            this.handleParticipantSelect.bind(this, newParticipant),
          ),
        );
        // TODO(dlaliberte): Figure out a way to update the choreographer's
        // selection when the chart's selection is programmatically set.
      }
    }
  }

  /**
   * Issues a draw() request on every single participant this Choreographer is
   * aware of. It enforces a top-down call sequence, with each participant
   * drawing itself a) only after all its predecessors and b) using a DataView
   * that includes any constraints that may have been imposed upstream.
   *
   * This method is especially useful to do a single-pass drawing of an entire
   * dashboard of visualizations, even in presence of controls that impose
   * visualization constraints.
   *
   * This method is implemented by drawing the set of known participants in
   * topological sort order: first the graph roots are drawn, then the
   * 'statechange'/'ready' propagation logic is recursively applied from all the
   * roots downward.
   *
   * Drawing is asynchronous. Callers should listen for events fired by the
   * Choreographer to be notified once drawing completes: a 'ready' event is
   * fired on successful completion, an 'error' event is fired if any of the
   * managed participants failed drawing.
   *
   * Callers should not invoke draw() again while a previous draw iteration is
   * already in progress. However, even if they do so, the Choreographer and
   * managed participants will remain in a consistent state: the previous draw
   * iteration will be discarded and a new iteration started. The new iteration
   * may do some extra unnecessary drawing of participants because of events
   * trickling from the previous (canceled) iteration. See the docs on
   * DrawIteration for further details about this scenario.
   *
   * Callers must pass in a datatable (or suitable equivalent) as parameter,
   * which the Choreographer will access by reference. As such, external code
   * that modifies the table should invoke this draw() method after the
   * modifications for the Choreographer to sync itself and all the managed
   * participants against the latest table data. If draw() is not invoked, the
   * graph of participants may go out of sync (with parts of the graph using
   * the new table data, and parts still reflecting the old data).
   *
   * Note: while this method is the recommended way of bootstrapping a set of
   * visualizations and controls, it is technically possible to draw the entire
   * dashboard (or parts of it) by calling draw() directly on selected
   * participants (in which case, the draw iteration will start from the ready
   * event triggered by the fist drawn participant).
   *
   * @param dataTable The data table.
   *     Since Choreographer relies on Wrapper instances for its operations any
   * data format they support is equally accepted here, even though callers will
   * normally provide DataTable instances.
   */
  draw(dataTable: AbstractDataTable | AnyDuringMigration[] | string | null) {
    if (!dataTable) {
      return;
    }
    if (this.participantsGraph.isEmpty()) {
      return;
    }

    this.incomingData = DataTable.normalizeDataTable(dataTable);

    // Discard any previous iteration that might have been running.
    this.drawIteration = new DrawIteration(this);

    // Prime all the graph roots with the input datatable.
    const rootParticipants = this.participantsGraph.getRoots();
    for (let i = 0; i < rootParticipants.length; i++) {
      rootParticipants[i].setDataTable(this.incomingData);
    }

    // Start the draw iteration from the graph roots.
    this.drawIteration.start(rootParticipants);
  }

  /**
   * Checks whether the set of bindings registered so far are valid (ie. they
   * do not introduce dependency cycles and other unallowed artifacts).
   *
   * @return Whether the bindings registered so far are valid.
   */
  private areBindingsValid(): boolean {
    if (!this.participantsGraph.isValid()) {
      this.handleError(
        'The requested control and participant cannot be bound ' +
          'together, as this would introduce a dependency cycle',
      );
      return false;
    }
    return true;
  }

  /**
   * Checks whether a given object behaves like a visualization Participant, ie.
   * it exposes draw() and setDataTable() methods (like ChartWrapper and
   * ControlWrapper do).
   *
   * @param wrapper The object to check.
   * @return Whether it quacks like a duck.
   */
  private static looksLikeParticipant(wrapper: AnyDuringMigration): boolean {
    // It would be better to check against actual types:
    // (wrapper instanceof ChartWrapper || wrapper instanceof ControlWrapper)
    return (
      goog.isObject(wrapper) && //
      typeof wrapper['draw'] === 'function' && //
      typeof wrapper['setDataTable'] === 'function'
    );
  }

  /**
   * Checks whether a given object behaves like a ControlWrapper, ie. it
   * exposes the following methods:
   * - draw(), setDataTable(), for drawing the Control,
   * - getControl(), to access the internal Control hold by the Wrapper.
   *
   * This is not enough to completely validate a ControlWrapper: we also
   * rely on specific methods being present on the instance returned by
   * getControl(). However, ControlWrapper lazily creates such instance on the
   * first draw(), hence we delay more detailed checks until the 'ready' event
   * subsequent to the draw() is captured.
   *
   * @param wrapper The object to check.
   * @return Whether it quacks like a duck.
   */
  private static looksLikeControl(wrapper: AnyDuringMigration): boolean {
    // It would be better to check against actual types:
    // wrapper instanceof ControlWrapper;
    return (
      Choreographer.looksLikeParticipant(wrapper) &&
      typeof wrapper.getControl === 'function'
    );
  }

  /**
   * Checks whether the object wrapped by a ControlWrapper
   * truly behaves like a Control.
   *
   * Here we perform a couple of checks:
   * 1) valid control - First, we identify whether the Control is a Filter or
   *    Operator, or Setter.
   *
   * 2) valid graph setup for Operators - For Operators, we check whether they
   *   define a detachable subgraph, as defined in `DAG`.
   *
   *   Since Operators are free to transform their DataTable in any way, we
   *   require for any descendant of an Operator 'Op' to be reachable from the
   *   graph roots only via 'Op', ie. there must not be alternate paths to
   *   reach a participant that does not pass through 'Op'. Otherwise computing
   *   the merged datatables to feed into descendants might not be possible.
   *
   * @param wrapper The wrapper to check.
   * @return Whether the control the wrapper holds appears to be valid.
   */
  private isValidControl(wrapper: ControlWrapper): boolean {
    const controlObj = wrapper.getControl();
    if (!goog.isObject(controlObj)) {
      return false;
    }

    // Should be if (controlObj instanceof Operator)
    if (typeof (controlObj as Operator).applyOperator === 'function') {
      return this.participantsGraph.isSubgraphDetachable(wrapper);
    } else if (typeof (controlObj as Filter | Setter).apply === 'function') {
      return true; // looks like a Filter or Setter
    }
    return false; // not any known kind of control
  }

  /**
   * Callback invoked when a participant fires a 'statechange' event
   * in response to an explicit user interaction.
   *
   * It is assumed that a participant will start firing 'statechange' events
   * only after being drawn (more precisely, after firing the 'ready' event at
   * least once).
   *
   * @param participant The participant that fired the event.
   */
  private handleParticipantStateChange(participant: Wrapper) {
    assert(this.participantsGraph.contains(participant));
    // Create a new draw iteration if not already in progress, and dispatch the
    // change to it.
    this.drawIteration = this.drawIteration || new DrawIteration(this);
    this.drawIteration.handleParticipantChanged(participant);
  }

  /**
   * Callback invoked when a participant fires a 'ready' event.
   * This happens either because of a programmatic change to the participant
   * (draw() was called from the outside) or as part of a draw iteration the
   * choreographer is handling (draw() was called within thisdrawIteration).
   *
   * @param participant The participant that fired the event.
   */
  private handleParticipantReady(participant: Wrapper) {
    assert(this.participantsGraph.contains(participant));

    // Since ControlWrapper lazily creates the wrapped Control instances during
    // draw(), only once its 'ready' event has fired we can check whether the
    // wrapped object truly behaves like a Control.
    if (
      Choreographer.looksLikeControl(participant) &&
      !this.isValidControl(participant as ControlWrapper)
    ) {
      this.handleError(
        `${participant} does not fit the Control specification while handling 'ready' event.`,
      );
      return;
    }

    // Create a new draw iteration if not already in progress, and dispatch the
    // change to it.
    this.drawIteration = this.drawIteration || new DrawIteration(this);
    this.drawIteration.handleParticipantChanged(participant);
  }

  /**
   * Returns a unique identifier for a selection object.
   * @param sel The selection object.
   */
  private getSelectionUid(sel: SelectionObject): string {
    return `${sel.row},${sel.column}`;
  }

  /**
   * Adds a selected row, column, or cell to the choreographer's selection.
   * @param sel The selection object.
   */
  private addToSelection(sel: SelectionObject) {
    const row = sel.row;
    const column = sel.column;
    if (row == null && column == null) {
      return;
    }
    if (row == null) {
      assert(column != null);
      this.selection.addColumn(column!);
    } else if (column == null) {
      assert(row != null);
      this.selection.addRow(row);
    } else {
      this.selection.addCell(row, column);
    }
  }

  /**
   * Removes a selected row, column, or cell from the choreographer's selection.
   * @param sel The selection object.
   */
  private removeFromSelection(sel: SelectionObject) {
    const row = sel.row;
    const column = sel.column;
    if (row == null && column == null) {
      return;
    }
    if (row == null) {
      assert(column != null);
      this.selection.removeColumn(column!);
    } else if (column == null) {
      assert(row != null);
      this.selection.removeRow(row);
    } else {
      this.selection.removeCell(row, column);
    }
  }

  /**
   * Callback invoked when a participant fires a 'select' event.
   * This happens when a user clicks on a chart and selects or deselects an
   * item. Note: This does not get fired when a user programmatically sets the
   * selection of a chart.
   *
   * @param participant The participant that fired the event.
   */
  private handleParticipantSelect(participant: Wrapper) {
    assert(this.participantsGraph.contains(participant));

    const participantUid = goog.getUid(participant);
    const participantChart = (participant as AnyDuringMigration).getChart();
    let participantCurrentSelection = participantChart.getSelection();
    if (!this.selections[participantUid]) {
      this.selections[participantUid] = new Selection();
    }
    // We now need to dereference all the participant's selections.
    /**
     * @suppress {strictPrimitiveOperators} Auto-added to unblock
     * check_level=STRICT
     */
    participantCurrentSelection = participantCurrentSelection
      .map((sel: SelectionObject) => {
        let data = participant.getDataTable();
        while (data !== this.incomingData) {
          const dataview = data as DataView;
          sel = {
            row:
              sel.row == null //
                ? null
                : dataview.getTableRowIndex(sel.row),
            column:
              sel.column == null ? null : dataview.getTableRowIndex(sel.column),
          };
          if (sel.row != null && sel.row < 0) {
            sel.row = null;
          }
          if (sel.column != null && sel.column < 0) {
            sel.column = null;
          }
          if (sel.row == null && sel.column == null) {
            return null;
          }
          // Must be a DataView
          data = (data! as DataView).getDataTable();
        }
        return sel;
      })
      .filter((x: SelectionObject | null) => x != null);
    const participantStoredSelection = this.selections[participantUid];
    const selectionDifference = participantStoredSelection.setSelection(
      participantCurrentSelection,
    );

    const addedSelection = selectionDifference.getAdded().getSelection();
    const removedSelection = selectionDifference.getRemoved().getSelection();

    forEach(addedSelection, (sel) => {
      const selectionUid = this.getSelectionUid(sel);
      if (!this.chartsBySelection[selectionUid]) {
        this.chartsBySelection[selectionUid] = new Set();
      }
      this.chartsBySelection[selectionUid].add(participantUid);
      this.addToSelection(sel);
    });

    forEach(removedSelection, (sel) => {
      const selectionUid = this.getSelectionUid(sel);
      if (!this.chartsBySelection[selectionUid]) {
        this.removeFromSelection(sel);
        return;
      }
      this.chartsBySelection[selectionUid].delete(participantUid);
      // Only remove from the dashboard's selection once there is no chart that
      // has this item selected.
      if (this.chartsBySelection[selectionUid].size === 0) {
        this.removeFromSelection(sel);
      }
    });
  }

  /**
   * Callback invoked when a participant fires an 'error' event. This happens
   * either because draw() was called from the outside on a participant (and the
   * participant failed the draw) or as part of a draw iteration that the
   * choreographer is handling.
   *
   * In the former case (a failed programmatic draw() when the Choreographer was
   * otherwise idle) we ignore the event since it does have any impact on the
   * Choreographer. In the latter case (a draw iteration is in progress) we have
   * to handle the event, since we may have to abort the draw() of any
   * participant that depends on the failed one.
   *
   * @param participant The participant that fired the event.
   */
  private handleParticipantError(participant: Wrapper) {
    assert(this.participantsGraph.contains(participant));
    if (this.drawIteration) {
      this.drawIteration.handleError(participant);
    }
  }

  /**
   * Callback invoked when a draw iteration completes.
   * @param success Whether the iteration completed successfully or any
   *     participant in it failed drawing.
   */
  drawIterationCompleted(success: boolean) {
    assert(this.drawIteration != null);
    if (success) {
      trigger(this, READY, null);
    } else {
      // also fires the 'error' event.
      this.handleError('One or more participants failed to draw()');
    }
    this.drawIteration = null;
  }

  /**
   * Merges a number of dataviews into a single one, both rowwise and
   * columnwise.
   *
   * Dataviews can perform various transformations with respect to the
   * underlying data they are built from: row (column) filtering, reordering,
   * duplication.
   *
   * The main usecase we expect is filtering, with multiple controls each one
   * applying a different set of constraints to a shared visualization.
   * In this case, it is clearly defined how to compose together multiple row
   * (column) filters into a single dataview that represent the intersection of
   * all the original ones.
   *
   * There is no obvious way to merge together different row (column)
   * reorderings or duplications, hence this method arbitrarily picks a dataview
   * (the first) as 'master' and ensures that the returned merged view will
   * retain any reorderings and duplications the master had (minus any filtering
   * that may have been applied as a result of other constraining dataviews).
   *
   * TODO(dlaliberte): Figure out whether it makes any sense to have
   * multiple row (column) reordering/duplicating controls insisting on the
   * same visualization (I'd say not) and, if so, find a way to deal with
   * merging.
   *
   * TODO(dlaliberte): Decide whether it's better to have the merged DataView
   * built on top of another DataView (saves the Choreographer from storing a
   * reference to the underlying DataTable) or to have the merged DataView
   * always be built from the underlying DataTable (forces the Choreographer to
   * keep a reference on it).
   *
   * @param dataviews The DataViews or DataTables to merge. Note that the
   *     Operator checking logic ensures that there is either only one DataTable
   *     or only DataViews in this input array.
   * @return A new dataview (or table) that represents the merging of all the
   *     input ones.
   */
  mergeDataViews(dataviews: AbstractDataTable[]): AbstractDataTable {
    assert(dataviews.length > 0);
    if (dataviews.length === 1) {
      return dataviews[0];
    }

    // Given that a) Operators emit DataTables (while Filters emit DataViews)
    // and b) it is not allowed for an Operator to have its output merged with
    // anything else (see the discussion about detachable subgraphs elsewhere in
    // this file), then if the array of Data to merge contains more than one
    // element, it can only be DataViews. So it's safe to cast to DataView from
    // here onward.

    const masterView = dataviews[0];
    const otherViews = slice(dataviews, 1);
    const rowIntersection = this.computeRowIntersection(
      masterView as DataView,
      otherViews as DataView[],
    );
    const columnIntersection = this.computeColumnIntersection(
      masterView as DataView,
      otherViews as DataView[],
    );

    const outputView = new DataView(masterView);
    outputView.setRows(rowIntersection);
    outputView.setColumns(columnIntersection);
    return outputView;
  }

  /**
   * Identifies all the rows that belong to the intersection of all the input
   * dataviews row ranges.
   *
   * @param masterDataview A dataview that, in addition to participating in the
   *     intersection, will also dictate the row ordering and duplication rules
   *     for the returned results.
   * @param dataviews All the other dataviews that participate in the
   *     intersection.
   * @return An array that will be populated with the row indexes that belong to
   *     the intersection of all the input dataviews' row ranges. The indexes
   *     are defined in respect to the master dataview (hence index '1' will
   *     refer to the 2nd row of the master dataview, which can map to a
   *     different row in the underlying datatable). The ordering and index
   *     duplication in the array matches what defined by the master dataview.
   */
  private computeRowIntersection(
    masterDataview: DataView,
    dataviews: DataView[],
  ): number[] {
    assert(dataviews.length > 0);

    // Compute the intersection of indexes over all dataviews.
    let rowSet = new Set(this.getIncomingTableRowIndexes(dataviews[0]));

    for (let i = 1; i < dataviews.length; i++) {
      rowSet = setIntersection(
        rowSet,
        new Set(this.getIncomingTableRowIndexes(dataviews[i])),
      );
      if (rowSet.size === 0) {
        break;
      }
    }

    // Retain only those rows that are present in all dataviews.
    // Use masterDataview as a blueprint to retain the same row ordering
    // (and possibly duplication).
    const rowIntersection = [];
    for (let r = 0; r < masterDataview.getNumberOfRows(); r++) {
      if (
        rowSet.has(this.getIncomingTableRowIndex(masterDataview, r) as number)
      ) {
        // Note that we are pushing 'r', the row position relative to
        // masterDataview, rather than absolute row in the incoming datatable
        // because we will build the merged dataview using masterDataview as a
        // blueprint.
        rowIntersection.push(r);
      }
    }
    return rowIntersection;
  }

  /**
   * Identifies all the columns that belong to the intersection of all the input
   * dataviews column ranges.  Column indexes are relative to the master
   * dataview.
   *
   * @param masterDataview A dataview that, in addition to participating in the
   *     intersection, will also dictate the column ordering and duplication
   *     rules for the returned results.
   * @param dataviews All the other dataviews that participate in the
   *     intersection.
   * @return An array that will be populated with the column indexes that belong
   *     to the intersection of all the input dataviews' column ranges. The same
   *     rules stated for `computerowIntersection_` apply.
   */
  private computeColumnIntersection(
    masterDataview: DataView,
    dataviews: DataView[],
  ): number[] {
    assert(dataviews.length > 0);
    let columnSet = new Set(this.getIncomingTableColumnIndexes(dataviews[0]));
    for (let i = 1; i < dataviews.length; i++) {
      columnSet = setIntersection(
        columnSet,
        new Set(this.getIncomingTableColumnIndexes(dataviews[i])),
      );
      if (columnSet.size === 0) {
        break;
      }
    }
    const columnIntersection = [];
    for (let c = 0; c < masterDataview.getNumberOfColumns(); c++) {
      if (
        columnSet.has(
          this.getIncomingTableColumnIndex(masterDataview, c) as number,
        )
      ) {
        columnIntersection.push(c);
      }
    }
    return columnIntersection;
  }

  /**
   * Returns an array containing the incoming table row index for each row in
   * the incoming data.
   *
   * @param dataview The dataview to parse.
   * @return An array containing the row indexes relative to the incoming data
   *     for each row in the parameter dataview.
   */
  private getIncomingTableRowIndexes(dataview: DataView): number[] {
    const indexes = [];
    for (let i = 0; i < dataview.getNumberOfRows(); i++) {
      const index = this.getIncomingTableRowIndex(dataview, i);
      if (index != null) {
        indexes.push(index);
      }
    }
    return indexes;
  }

  /**
   * Returns the row index in the incoming table, for row i.
   *
   * @param dataview The dataview to parse.
   * @param i The row index in the dataview.
   * @return An array containing the column indexes relative to the incoming
   *     data for each column in the parameter dataview.
   */
  private getIncomingTableRowIndex(
    dataview: DataView,
    i: number,
  ): number | null {
    let rowIndex = i;
    let dv: AbstractDataTable = dataview;
    while (dv !== this.incomingData) {
      rowIndex = (dv as DataView).getTableRowIndex(rowIndex);
      dv = (dv as DataView).getDataTable();
    }
    return rowIndex;
  }

  /**
   * Returns an array containing the incoming table column index for each
   * column in the incoming data.  Calculated columns are ignored.
   *
   * @param dataview The dataview to parse.
   * @return An array containing the column indexes relative to the incoming
   *     data for each column in the parameter dataview.
   */
  private getIncomingTableColumnIndexes(dataview: DataView): number[] {
    const indexes = [];
    for (let i = 0; i < dataview.getNumberOfColumns(); i++) {
      const index = this.getIncomingTableColumnIndex(dataview, i);
      if (index != null) {
        indexes.push(index);
      }
    }
    return indexes;
  }

  /**
   * Returns the column index in the incoming table, for column i.
   * Calculated column results in null response.
   *
   * @param dataview The dataview to parse.
   * @param i The column index in the dataview.
   * @return An array containing the column indexes relative to the incoming
   *     data for each column in the parameter dataview.
   */
  private getIncomingTableColumnIndex(
    dataview: DataView,
    i: number,
  ): number | null {
    let columnIndex: number | null = i;
    let dv: AbstractDataTable = dataview;
    while (dv !== this.incomingData && columnIndex !== -1) {
      columnIndex = (dv as DataView).getTableColumnIndex(columnIndex);
      dv = (dv as DataView).getDataTable();
    }
    if (columnIndex === -1) {
      // Skip calculated columns, for now.
      columnIndex = null;
    }
    return columnIndex;
  }
}

/**
 * A finite-state machine to track one asynchronous redraw of the graph of
 * controls and visualizations managed by the Choreographer.
 *
 * The key in reading this is the following:
 *
 * Every valid choreographer graph can always be linearized according to
 * topological sort. Therefore a draw iteration is equivalent to linearly
 * draw()-ing all the elements of the graph.
 *
 * Every participant draw() operation happens asynchronously: it starts with
 * the draw() invocation and terminates whenever the participant fires a
 * 'ready' or 'error' event at the end of the draw (in addition, all draw()s are
 * invoked in timeout functions for UI responsiveness reason, so this applies
 * also to participants that fire the 'ready' or 'error' event synchronously
 * during draw() ).
 *
 * Whenever a participant completes drawing, DrawIteration_ checks whether this
 * makes any of its dependencies ready for drawing and proceeds in drawing
 * them until all the participants have either been drawn or failed during
 * drawing. At which point the draw iteration terminates and the Choreographer
 * holding it is notified.
 *
 * The Choreographer will then fire a dashboard-wide 'ready' or 'error' event
 * describing the overall success in drawing the entire graph of participants.
 *
 * Considering the 4 supported states ([P]ending, [D]rawing, [R]eady, [E]rror),
 * a draw iteration of an *entire* graph of participants can be visualized as a
 * line of participants, all initially in the pending state:
 *
 * [P] [P] [P] [P] [P] [P] [P]
 * (each letter represents a participant, topological sort order).
 *
 * Drawing then start from the graph roots:
 *
 * [D] [D] [P] [P] [P] [P] [P]
 * (hypothetic case of 2 roots).
 *
 * Drawing proceeds downstream, processing a participant as soon as all the
 * participants it depends upon have completed.
 *
 * [R] [R] [R] [D] [D] [P] [P]
 *
 * The process terminates when all the participants have either completed draw()
 * successfully or failed during draw():
 *
 * [R] [R] [R] [R] [R] [R] [R] (all successful)
 * [R] [R] [R] [R] [E] [E] [E] (partial failure)
 * [E] [E] [E] [E] [E] [E] [E] (complete failure)
 *
 * A draw iteration of a *partial* graph of participants (as it would occur for
 * example when the user interacts with a control affecting only a subset of all
 * the visualizations the choreographer manages) behaves in the same way, with
 * the only caveat that all the participants in the unaffected region of the
 * graph are already in the 'ready' state at the beginning of the iteration:
 *
 * [R] [R] [R] [D] [P] [P] [P] (initial state for partial redraw)
 *              /\
 *          participant the user interacted with
 *
 * The above paragraph describes the simplest scenario with no external
 * interactions. Since the draw iteration proceeds asynchronously, additional
 * events requiring redraws of participants may occur while a draw iteration is
 * still in the progress. Some sample cases:
 * - A user playing with a control B, while the dashboard is still updating as a
 *   consequence of the user previous interaction with control A
 * - Programmatic call of a participant draw() method by external code while a
 *   draw iteration is in progress.
 *
 * For this reason, the iteration must tolerate participants changing (i.e.
 * being redrawn and firing 'statechange', 'ready' or 'error' events) out of
 * band. The most common case is a participant notifying itself having changed
 * before or after DrawIteration_ processed it.
 *
 * - Participant changes before DrawIteration_ processes it:
 *   The change is ignored, since DrawIteration_ will eventually get to redraw
 *   the participant anyway.
 *
 *         participant being drawn by DrawIteration_
 *                 \/
 *     [R] [R] [R] [D] [P] [P] [P]
 *                          /\
 *                      participant firing a 'ready' event
 *
 * - Participant changes after DrawIteration_ processes it.
 *
 *         participant being drawn by DrawIteration_
 *                 \/
 *     [R] [R] [R] [D] [P] [P] [P]
 *          /\
 *        participant firing a 'ready' event
 *
 *   All the downstream participants are reverted to pending. Drawing resumes
 *   from where the change originated:
 *
 *     [R] [R] [P] [P] [P] [P] [P]
 *              /\
 *            drawing resumes from here.
 *
 * Things can get a bit more hairy than what described here, so you really
 * should look at the sources below.
 *
 * Based on the above, the following applies:
 * - If all the participants part of a choreographer adhere fully to the GViz
 *   specs (i.e. they guarantee firing either a 'ready' or an 'error' event
 *   after draw()), a draw iteration is guaranteed to complete once started.
 *
 * - Therefore a Choreographer will always fire a 'ready' or 'error' event
 *   at the end of a full graph redraw (Choreographer.draw() calls) or partial
 *   graph redraw (programmatic or user interaction with a specific
 *   participant).
 *
 * - In presence of concurrent draws, e.g. user interaction happening while a
 *   draw iteration is in progress, the draw process may optimize or ignore
 *   part of the draw as described, collapsing the concurrent draw() requests
 *   within the same draw iteration. As a consequence multiple concurrent draw
 *   requests may result in only one 'ready' or 'error' event fired by the
 *   Choreographer at the end of the process (but _at least_ one event is
 *   guaranteed to fire).
 *
 * - Because of under-specified parts of the GViz specs (such as (a) how
 *   visualizations should handle a draw() invocation happening before a
 *   previous one terminates by firing its 'ready' or 'error' event, or
 *   (b) naked 'ready' events that make tracking the draw() operation they
 *   belong to impossible), some extra drawing may occur in presence of
 *   concurrent draw requests. Consider the following example:
 *   - controlA drives visualizationB
 *   - Choreographer.draw() invoked, controlA starts drawing
 *   - controlA.draw() invoked by external code
 *   - 'ready' event received from controlA
 *   - visualizationB starts drawing
 *   - visualizationB completes drawing. Drawing iteration completes.
 *   - second 'ready' event received from controlA. A new drawing iteration
 *     starts.
 *   - visualizationB is redrawn.
 *   As a consequence, visualizationB is drawn twice.
 *   We expect these situation to be marginal in real-life deployments.
 *
 * - Even in presence of participants occasionally failing GViz specs (e.g.
 *   someone doesn't fire a 'ready' event when it should), hence leaving
 *   hanging draw iterations, a subsequent redraw of the participants graph
 *   will clean the iteration state giving it the possibility of running to
 *   completion.
 *
 * - Participants that do not follow the GViz specs (e.g. they never fire a
 *   'ready' event) will always leave hanging draw iterations, causing the
 *   Choreographer to misbehave, including ignoring user interactions and
 *   never updating parts of the dashboards they manage.
 *
 * And last but not least, the whole thing works just because javascript is
 * single threaded. You just saved yourself from a whole ton of semaphores and
 * barriers.
 */
export class DrawIteration {
  /**
   * A clone of the DAG for all controls and visualizations managed by the
   * choreographer, frozen at the time this DrawIteration is instantiated.
   */
  private readonly participantsGraph: DAG;

  /** Maps each graph participant (by its uid) to its current drawing state. */
  private readonly stateMap: {[key: number]: State} = {};

  /** @param choreographer The Choreographer this draw iteration pertains to. */
  constructor(private readonly choreographer: Choreographer) {
    this.participantsGraph = choreographer.participantsGraph.clone();

    // Initializes the state for every participant.
    // We initialize to READY so that partial and full graph redraws can be
    // handled with the same logic.
    const allParticipants = this.participantsGraph.getValues();
    for (let i = 0; i < allParticipants.length; i++) {
      this.transition(allParticipants[i], State.READY);
    }
  }

  /**
   * Starts the draw iteration from the given roots.
   *
   * The participants passed as arguments will be the first ones drawn. Once
   * they complete, the participants that depend upon them will be drawn, and so
   * on until all the graph has been traversed.
   *
   * All the participants that are located upstream from the given ones in the
   * participant graph are assumed to be already in their 'ready' state and
   * won't be redrawn.
   *
   * @param roots The participants to start the draw iteration from.
   */
  start(roots: Wrapper[]) {
    DrawIteration.prototype.markAllDependenciesAsPending.apply(this, roots);
    for (let i = 0; i < roots.length; i++) {
      this.draw(roots[i]);
    }
  }

  /**
   * Callback invoked whenever a participant 'changed' during a draw iteration.
   * By 'change' we intend any of the following:
   * - If the participant is a control, the user has altered its state (hence
   *   this method being invoked as a consequence of the 'statechange' event
   * fired by the control),
   * - The participant has completed its draw() sequence, both in the case
   *   of draw() being called as part of the processing of this iteration and in
   *   the case of a programmatic draw() invocation from external code (hence
   *   this method being invoked as a consequence of the 'ready' event fired by
   *   the participant).
   *
   * Depending on the current state of the participant, the change will either
   * be ignored or trigger the redraw of other participants depending upon the
   * changed one.
   *
   * @param participant The participant that changed.
   */
  handleParticipantChanged(participant: Wrapper) {
    if (!this.participantsGraph.contains(participant)) {
      // Event fired by a participant that was added to the Choreographer after
      // the draw iteration started (at which time the iteration graph was
      // frozen)
      return;
    }
    switch (this.getState(participant)) {
      case State.PENDING:
        // The participant that changed is scheduled for redraw, but we haven't
        // got there yet. We can ignore the event as the participant will be
        // redrawn anyway shortly.
        break;
      case State.ERROR:
        // The participant that changed already failed previously during the
        // processing of this draw iteration (either directly or was indirectly
        // marked as failed because one of its upstream dependencies failed).
        // Ignore the event.
        break;
      case State.DRAWING:
        // The participant that changed was currently in the process of being
        // redrawn. The drawing has therefore completed. Scan all the children
        // of the participant that just completed and see whether any other
        // draws can be started.
        this.transition(participant, State.READY);
        this.drawDependencies(participant);
        break;
      case State.READY:
        // Either the iteration has just been created and we are bootstrapping
        // it in response to an external 'statechange' or 'ready' event, or the
        // participant that changed had already been redrawn and we are
        // currently processing other participants downstream.
        //
        // Either way, mark all downstream elements as pending and restart
        // drawing the subgraph.
        this.markAllDependenciesAsPending(participant);
        this.drawDependencies(participant);
        break;
      default:
        fail('Invalid participant state: ' + this.getState(participant));
    }

    // Check whether this last change completes the drawing iteration.
    this.checkIfIterationFinished();
  }

  /**
   * Callback invoked whenever a participant failed a draw().
   *
   * This is invoked both in the case of draw() called as part of the
   * processing of this iteration and in the case of a programmatic draw()
   * invocation from external code while this iteration was still in progress.
   *
   * @param participant The participant that failed drawing.
   */
  handleError(participant: Wrapper) {
    if (!this.participantsGraph.contains(participant)) {
      // Event fired by a participant that was added to the Choreographer after
      // the draw iteration started (at which time the iteration graph was
      // frozen)
      return;
    }
    switch (this.getState(participant)) {
      case State.PENDING:
      case State.READY:
      case State.ERROR:
        // Any error that occurs on participants that we have yet to process
        // ('pending'), already processed successfully ('ready') or already
        // failed ('error', both in the case of direct failure or indirect
        // because of a failure of an upstream dependency) is of external
        // origin, and irrelevant for the purpose of this iteration (either
        // because we are already beyond the source of the event or because we
        // are going to retry it soon).
        break;
      case State.DRAWING:
        // The participant that failed was currently in the process of being
        // redrawn. Mark both this participant _and_ all the ones that depend on
        // this as failed.
        this.transition(participant, State.ERROR);
        this.abortAllDependencies(participant);
        break;
      default:
        fail('Invalid participant state:' + this.getState(participant));
    }

    // Check whether this last change completes the drawing iteration.
    this.checkIfIterationFinished();
  }

  /**
   * Verify whether the draw iteration has completed (both successfully or not)
   * and notifies the choreographer if so.
   */
  private checkIfIterationFinished() {
    let errorParticipants = 0;
    const success = every(
      this.stateMap,
      (state, key, stateMap) => {
        if (state === State.ERROR) {
          errorParticipants++;
        } else if (state !== State.READY) {
          // Something is still pending or drawing. For sure we haven't finished
          // the iteration yet.
          return false;
        }
        return true;
      },
      this,
    );
    if (success) {
      this.choreographer.drawIterationCompleted(errorParticipants === 0);
    }
  }

  /**
   * Returns the drawing state of the given participant.
   * @param participant The participant to check.
   * @return The participant state.
   */
  private getState(participant: Wrapper): State {
    return this.stateMap[goog.getUid(participant)];
  }

  /**
   * Transitions the participant into the requested state.
   * @param participant The participant to transition.
   * @param state The target state.
   */
  private transition(participant: Wrapper, state: State) {
    this.stateMap[goog.getUid(participant)] = state;
  }

  /**
   * Mark all the participants that depend on the given ones (according to the
   * choreographer graph) as pending redraw.
   *
   * @param varArgs The participants whose dependencies are to be modified.
   */
  private markAllDependenciesAsPending(...varArgs: Wrapper[]) {
    const subgraph = this.participantsGraph.extractSubgraph(...varArgs);
    const subgraphParticipants = subgraph.getValues();
    for (let i = 0; i < subgraphParticipants.length; i++) {
      // Ensure we are not marking as pending the same nodes that triggered this
      // change.
      if (!subgraph.isRoot(subgraphParticipants[i])) {
        this.transition(subgraphParticipants[i], State.PENDING);
      }
    }
  }

  /**
   * Mark all the participants that depend on the given one (according to the
   * choreographer graph) as failed.
   *
   * @param participant The participant whose dependencies are to be modified.
   */
  private abortAllDependencies(participant: Wrapper) {
    const dependencies = this.participantsGraph
      .extractSubgraph(participant)
      .getValues();
    // The first element of 'dependencies' is the input participant itself.
    for (let i = 1; i < dependencies.length; i++) {
      this.transition(dependencies[i], State.ERROR);
    }
  }

  /**
   * Asks a participant to draw itself. The participant will be drawn out of
   * band in an async call to give the webpage UI a chance to remain responsive
   * (otherwise an entire dashboard could end up being drawn in a single sync
   * call, possibly blocking the webpage UI perceptibly).
   *
   * @param participant The participant to draw.
   */
  private draw(participant: Wrapper) {
    this.transition(participant, State.DRAWING);

    // Ensure that a catastrophic failure during draw(), such as an exception
    // being raised, is handled like an 'error' event would.
    const protectedDraw = createProtectedCallback(
      () => {
        participant.draw();
      },
      this.handleError.bind(this, participant),
    );
    Timer.callOnce(protectedDraw);
  }

  /**
   * Scan all the immediate dependencies of the given participant to find any
   * that is ready for drawing, ie. any participants whose parents are all in
   * the 'ready' state.
   *
   * Any matching participant will have its datatable updated and a draw request
   * will then be issued.
   *
   * @param participant The participant whose dependencies are to be checked.
   */
  private drawDependencies(participant: Wrapper) {
    const childParticipants = this.participantsGraph.getChildren(participant);
    if (!childParticipants) {
      return;
    }

    if (!(participant instanceof ControlWrapper)) {
      throw new Error('Dashboard participant is not a control.');
    }

    /**
     * suppress {invalidCasts} // TODO(b/237100957): fix and remove this
     * suppression
     */
    const controlWrapper = participant;

    /**
     * suppress {invalidCasts} // TODO(b/237100957): fix and remove this
     * suppression
     */
    const control = controlWrapper.getControl()!;

    // Custom controls might not have setDependencies.
    if (control.setDependencies) {
      control.setDependencies(childParticipants);
    }
    for (let i = 0; i < childParticipants.length; i++) {
      const child = childParticipants[i];
      if (this.allParentsAreReady(child)) {
        const mergedData = this.computeMergedView(child);
        child.setDataTable(mergedData);
        this.draw(child);
      }
    }
  }

  /**
   * Checks whether all parents of a given participant are in the 'ready' state.
   *
   * @param participant The participant to check.
   * @return Whether all the parents are in the 'ready' state.
   */
  private allParentsAreReady(participant: Wrapper): boolean {
    const parents = this.participantsGraph.getParents(participant);
    if (!parents) {
      return true;
    }
    for (let i = 0; i < parents.length; i++) {
      if (this.getState(parents[i]) !== State.READY) {
        return false;
      }
    }
    return true;
  }

  /**
   * Computes the input DataView that a participant should receive by merging
   * into a single one all the output DataViews (or DataTables) from other
   * participants directly affecting it (according to the choreographer graph).
   *
   * @param participant The participant whose input DataView needs to be
   *     recomputed.
   * @return A new dataview or datatable that represents the merging of all the
   *     ones emitted by participants affecting the input one.
   */
  private computeMergedView(participant: Wrapper): AbstractDataTable {
    // Collect a DataView from all controls that affect this participant.
    const affectingDataviews = this.participantsGraph
      .getParents(participant)!
      .map((parentParticipant) => {
        // No need for extra care here, since all the due sanity checks
        // for a Control to behave properly have already happened when the
        // 'ready' event is captured for all the participant's parents,
        // except when testing.
        const control = parentParticipant.getControl();
        // Should check (control instanceof Filter || control instanceof
        // Operator)
        if (typeof control['apply'] === 'function') {
          return control['apply'].call(control);
        } else {
          fail(`Invalid Control in draw iteration: ${control}`);
        }
      });

    // Merge the DataViews into a single one.
    return this.choreographer.mergeDataViews(affectingDataviews);
  }
}

/**
 * Enumeration of all the possible drawing states each participant can be in.
 * These states define a very simple finite-state machine, whose main flow is:
 *
 * pending -> drawing -> (ready|error)
 *
 * (other transitions which are not drawn here exist, such as states being
 * forcefully reset to 'pending').
 */
enum State {
  // The participant must be redrawn, but this hasn't occurred yet.
  PENDING = 'pending',
  // The participant is redrawing and we are waiting for the draw to complete
  // (signalled either via a 'ready' or 'error' event).
  DRAWING = 'drawing',
  // The participant is ready. Either it wasn't part of this draw iteration
  // (hence it was in the 'ready' state from the beginning) or has already
  // been drawn successfully.
  READY = 'ready',
  // The participant is in error state, either because it failed its draw()
  // operation or because some upstream participant it depends upon failed it.
  ERROR = 'error',
}
