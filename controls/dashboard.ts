/**
 * @fileoverview Public facade to assembe and manage a dashboard of
 * visualizations and controls.
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

import {assertIsElement} from '@npm//@closure/asserts/dom';
import {Disposable} from '@npm//@closure/disposable/disposable';
import {dispose} from '@npm//@closure/disposable/dispose';

import {AbstractDataTable} from '../data/abstract_datatable';
import {ControlEventType} from '../events/chart_event_types';
import {addListener, removeListener, trigger} from '../events/events';
import {ControlWrapper} from '../wrapper/control_wrapper';
import {Wrapper} from '../wrapper/wrapper';

import {Choreographer} from './choreographer';

const {ERROR, READY} = ControlEventType;

// tslint:disable:ban-types Migration

/**
 * A Dashboard of collaborating visualizations and controls, sharing the same
 * underlying data.
 *
 * A Dashboard is comprised of two aspects: logic and presentation.
 * The 'logic' aspect involves wiring between dashboard participants and event
 * dispatching. The dashboard delegates this aspect to
 * Choreographer instances.
 *
 * The 'presentation' aspect is about the physical layout, placement and shared
 * UI elements of the dashboard participants. This class does not deal with
 * presentation yet.
 */
export class Dashboard extends Disposable {
  /** The container passed to the dashboard. */
  private readonly container: Element;

  /**
   * Manages all the dashboard logic: participants wiring and dispatching data
   * and redraws in response to user and programmatic interactions with the
   * dashboard.
   */
  private readonly choreographer: Choreographer;

  /** Listens to 'ready' events fired by the Choreographer. */
  private readyListener: AnyDuringMigration;

  /** Listens to 'error' events fired by the Choreographer. */
  private errorListener: AnyDuringMigration;

  /**
   * @param container An html element to contain the dashboard.
   *     Currently this class does not provide any UI facilities, hence the
   * container will only hold Choreographer output and error messages.
   */
  constructor(container: Element | null) {
    super();

    try {
      assertIsElement(container);
    } catch (e) {
      // Catch and throw away this error for now.
      // TODO(dlaliberte): Make this a full error again.
      console.warn('container == null');
    }

    this.container = container as Element;

    this.choreographer = new Choreographer(this.container);
    this.bindEvents();
  }

  override disposeInternal() {
    this.clear();
    dispose(this.readyListener);
    dispose(this.errorListener);
    dispose(this.choreographer);
    super.disposeInternal();
  }

  /** Clear internals to initial state, so it can be disposed or reused. */
  clear() {
    removeListener(this.readyListener);
    removeListener(this.errorListener);
    this.choreographer.clear();
  }

  /**
   * Binds one or more Controls to one or more dashboard participants (either
   * visualizations or other controls), so that all of the latter are redrawn
   * whenever any of the former collects a programmatic or user interaction that
   * affects the data managed by the dashboard.
   *
   * The binding is exhaustive: all the controls are bound to all the
   * participants. This simplifies the assembly of basic dashboards (a set of
   * controls driving a set of visualizations) while leaving the one-by-one
   * binding option for more complex scenarios.
   *
   * Any invalid binding (such as a control binding to itself) will fire an
   * 'error' event, but the function will still continue in setting up the
   * remaining bindings.
   *
   * @param controls The list of controls to bind.
   * @param participants The list of participants to bind.
   * @return This object, for chaining.
   */
  bind(
    controls: ControlWrapper[] | ControlWrapper,
    participants: Wrapper[] | Wrapper,
  ): Dashboard {
    if (!Array.isArray(controls)) {
      controls = [controls];
    }
    if (!Array.isArray(participants)) {
      participants = [participants];
    }
    for (let c = 0; c < controls.length; c++) {
      for (let p = 0; p < participants.length; p++) {
        this.choreographer.bind(controls[c], participants[p]);
      }
    }

    // Builder pattern to allow chaining of multiple bind() calls terminated
    // with a draw() one.
    return this;
  }

  /**
   * Asynchronously draws the dashboard. A 'ready' or 'error' event is fired
   * when drawing completes.
   *
   * @param dataTable The data table. Since Dashboard relies on Choreographer,
   *     any format that the choreographer supports is equally accepted here,
   *     even though callers will normally provide
   *     google.visualization.DataTable instances.
   */
  draw(dataTable: AbstractDataTable | string | AnyDuringMigration[] | null) {
    this.choreographer.draw(dataTable);
  }

  /**
   * Returns the container. Used in Wrapper#sameContainer_() but otherwise
   * is currently used just for error handling.
   * @return The container passed to the constructor.
   */
  getContainer(): Element {
    return this.container;
  }

  /**
   * Returns the selection.
   * @return The selection.
   */
  getSelection(): AnyDuringMigration[] {
    return this.choreographer.getSelection();
  }

  /** Attach event listeners to the choreographer. */
  private bindEvents() {
    dispose(this.readyListener);
    this.readyListener = addListener(
      this.choreographer,
      READY,
      this.handleChoreographerEvent.bind(this, READY),
    );

    dispose(this.errorListener);
    this.errorListener = addListener(
      this.choreographer,
      ERROR,
      this.handleChoreographerEvent.bind(this, ERROR),
    );
  }

  /**
   * Re-triggers events received from the internal Choreographer.
   *
   * @param eventType The event type, 'ready' or 'error'.
   * @param payload The event payload, if any.
   */
  private handleChoreographerEvent(
    eventType: string,
    payload?: AnyDuringMigration,
  ) {
    trigger(this, eventType, payload || null);
  }
}
