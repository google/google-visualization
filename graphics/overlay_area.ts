/**
 * @fileoverview The overlay area is where HTML tooltips are drawn.
 * This class manages handling and clean-up of events for the overlay DOM
 * structure.
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

import {Disposable} from '@npm//@closure/disposable/disposable';
import {dispose} from '@npm//@closure/disposable/dispose';
import * as dom from '@npm//@closure/dom/dom';
import {EventHandler} from '@npm//@closure/events/eventhandler';
import {EventType} from '@npm//@closure/events/eventtype';

// tslint:disable:ban-types Migration

type HandlerType =
  | {
      handleEvent: (a?: AnyDuringMigration) => AnyDuringMigration;
    }
  | ((this: AnyDuringMigration, a: AnyDuringMigration) => AnyDuringMigration);

/**
 * Constructor for a overlay area.
 * @unrestricted
 */
export class OverlayArea extends Disposable {
  private eventHandler: EventHandler;
  /**
   * @param container The container.
   */
  constructor(private readonly container: Element) {
    super();

    /**
     * An event handler using which events are registered and later on cleared.
     */
    this.eventHandler = new EventHandler();
  }

  /**
   * Returns the container.
   * @return As described.
   */
  getContainer(): Element {
    return this.container;
  }

  /**
   * Removes all drawing elements from document, and prepares for additional
   * usage.
   */
  clear() {
    this.clearInternal();
    this.eventHandler = new EventHandler();
  }

  /**
   * Removes all drawing elements from document.
   */
  private clearInternal() {
    dom.removeChildren(this.container);
    this.eventHandler.removeAll();
    // To keep listener count accurate.
    dispose(this.eventHandler);
  }

  override disposeInternal() {
    this.clearInternal();
    super.disposeInternal();
  }

  /**
   * Attach an event handler function to an element.
   * If an event handler was previously set for this element and
   * this event type, the previous event handler will be replaced by this one.
   *
   * @param element A drawing object.
   * @param eventType The event type.
   * @param listener Callback function for when the event occurs.
   *
   */
  setEventHandler(
    element: EventTarget,
    eventType: EventType,
    listener: HandlerType | null | undefined,
  ) {
    this.eventHandler.listen(element, eventType, listener);
  }
}
