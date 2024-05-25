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

import {assertIsElement} from '@npm//@closure/asserts/dom';
import {Disposable} from '@npm//@closure/disposable/disposable';
import {dispose} from '@npm//@closure/disposable/dispose';
import {removeChildren} from '@npm//@closure/dom/dom';
import {EventHandler} from '@npm//@closure/events/eventhandler';
import {EventTarget as GoogEventTarget} from '@npm//@closure/events/eventtarget';
import {UserOptions} from '../common/options';

// tslint:disable:ban-types Migration

/**
 * The class with a constructor used to instantiate an AbstractVisualization.
 */
export interface ControlUiConstructor {
  new (container: Element): ControlUi;
}

type EventCallback =
  | ((this: AnyDuringMigration, a: AnyDuringMigration) => AnyDuringMigration)
  | {
      handleEvent: (
        this: AnyDuringMigration,
        a?: AnyDuringMigration,
      ) => AnyDuringMigration;
    };

/**
 * Base class for Controls user interfaces. Controls' user interfaces behave
 * similarly to visualizations:
 * - They render within a specified container.
 *
 * - Their contents are defined by a State object (equivalent in role to what
 *   DataTable is for visualizations): a key-value map that enumerates the
 *   interface data. For example, a DatePicker user interface might hold the
 *   selected date in its State, while a two-thumbs slider might store the
 *   thumbs' locations in it.
 *
 * - Their behavior is customized via configuration options.
 *
 * - They communicate changes to external parties via events.
 *
 * Every user interface implementation declares specific requirements for its
 * state and allowed configuration options (just like visualizations expect
 * their input DataTable to conform to specific requirements), that callers
 * (typically gviz.controls.Control classes) must adhere to.
 *
 * User interfaces that have the same requirements can be seamlessly swapped
 * between each other.
 *
 * Controls' User interfaces follow this simple lifecycle:
 * - after instance creation, draw() is called passing the interface state and
 *   configuration options. The interface draws itself.
 * - Whenever the user interacts with it affecting its state, an 'uichange'
 *   event is fired. The event carries no payload.
 * - Listeners to 'uichange' events can query the user interface current state
 *   via its getState() method.
 * - When the user interface is no longer used, it should be disposed via its
 *   dispose() method.
 */
export abstract class ControlUi extends Disposable {
  private readonly container: Element;
  private readonly eventHandler: EventHandler;

  /**
   * @param container The container where the Control user interface
   *     will be rendered.
   */
  constructor(container: Element | null) {
    super();

    /**
     * The HTML container hosting the control UI.
     *
     */
    this.container = assertIsElement(container);

    /**
     * Event handler to manage all event listeners created and disposed by the
     * filter user interface.
     */
    this.eventHandler = new EventHandler(this);
  }

  override disposeInternal() {
    this.clear();
    super.disposeInternal();
  }

  /**
   * Clear internals to initial state, so it can be disposed or reused.
   */
  clear() {
    // Remove all previous listeners, since we are going to create new
    // ones on every redraw.
    this.eventHandler.removeAll();
    dispose(this.eventHandler);
    removeChildren(this.container);
  }

  /**
   * Returns the user interface container.
   * @return The container where the Control user interface is to
   *     be rendered into.
   */
  protected getContainer(): Element {
    return this.container;
  }

  /**
   * Adds a listener to an event on a DOM node within the user interface managed
   * by this class.
   *
   * @param src Event source.
   * @param type Event type to listen for or array of
   *     event types.
   * @param callback Callback function to be used as the listener.
   * @param capture Optional whether to use capture phase.
   * @param handler Object in whose scope to call the listener.
   */
  protected addEventListener(
    src: GoogEventTarget | EventTarget,
    type: string | string[],
    callback: EventCallback | null | undefined,
    capture?: boolean,
    handler?: {},
  ) {
    if (handler) {
      this.eventHandler.listenWithScope(src, type, callback, capture, handler);
    } else {
      this.eventHandler.listen(src, type, callback, capture);
    }
  }

  /**
   * Draws the user interface.
   * Subclasses to override.
   *
   * @param state The state to set the user interface to.
   * @param options User interface configuration options.
   */
  abstract draw(
    state: {[key: string]: AnyDuringMigration},
    options: UserOptions | null,
  ): void;

  /**
   * Returns the current user interface state.
   *
   * @return The user interface state.
   */
  getState(): {[key: string]: AnyDuringMigration} {
    return {};
  }
}
