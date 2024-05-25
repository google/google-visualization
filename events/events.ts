/**
 * @fileoverview Visualization events API.
 * The API is designed for listening and triggering custom events over
 * arbitrary objects (e.g., a 'select' event over a PieChart).
 *
 * Note: for normal browser events over DOM elements (e.g., 'click') use
 * goog.events.
 *
 * @license
 * Copyright 2021 Google LLC
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

import {dispose} from '@npm//@closure/disposable/dispose';
import {Event as googEvent} from '@npm//@closure/events/event';
import * as events from '@npm//@closure/events/events';
import {EventTarget} from '@npm//@closure/events/eventtarget';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

// TODO(dlaliberte): update docs (especially return values from methods).
/**
 * Adds an event listener.
 *
 * In particular, adds the given event handler function for the given event
 * name on the given event source object. Returns a listener object that can be
 * used with google.visualization.events.removeListener().
 *
 * Note: uses eventSource['__eventTarget'] to store an EventTarget object for
 * internally managing events with closure (@see EventTarget).
 * Note: a listener will be added every time this function is called, even if
 * the parameters are not changed.
 * @param eventSource Observed object.
 * @param eventName Observed event name.
 * @param eventHandler Function to handle events.
 * @return Resulting event listener object. (May be passed to
 *     google.visualization.events.removeListener() to stop listening to the
 *     event).
 */
export function addListener(
  eventSource: AnyDuringMigration,
  eventName: string,
  eventHandler: Function,
): AnyDuringMigration {
  const eventTarget = getEventTarget(eventSource);
  const key = events.listen(
    eventTarget,
    eventName,
    createEventHandler(eventHandler),
  );
  return new EventListener(key);
}

/**
 * Adds an event listener that is called only one time.
 * Otherwise the same as #addListener().
 * Note: If you call addOneTimeListener() again, a new one-time listener
 * will be added, even if the parameters are not changed.
 *
 * @param eventSource Observed object.
 * @param eventName Observed event name.
 * @param eventHandler Function to handle events.
 * @return Resulting event listener object. (May be passed to
 *     google.visualization.events.removeListener() to stop listening to the
 *     event).
 */
// TODO(dlaliberte): How should we merge this code with addListener()?
export function addOneTimeListener(
  eventSource: AnyDuringMigration,
  eventName: string,
  eventHandler: Function,
): AnyDuringMigration {
  const eventTarget = getEventTarget(eventSource);
  const listenFunction = events.listenOnce;
  const key = listenFunction(
    eventTarget,
    eventName,
    createEventHandler(eventHandler),
  );
  return new EventListener(key);
}

/**
 * Fires the given 'eventName' over the 'eventSource' object with
 * 'eventDetails' passed on to the listeners.
 *
 * Note: uses eventSource['__eventTarget'] to store an EventTarget object for
 * internally managing events with closure (@see EventTarget).
 *
 * @param eventSource Observed object.
 * @param eventName The name of the event to be fired.
 * @param eventDetails An object with information to pass to the
 *     event listeners.
 */
export function trigger(
  eventSource: AnyDuringMigration,
  eventName: string,
  eventDetails: AnyDuringMigration,
) {
  const eventTarget = getEventTarget(eventSource);
  const event = new GvizEvent(eventName, eventDetails);
  events.dispatchEvent(eventTarget, event);
}

/**
 * Removes the given listener. The 'listener' is a handle returned by
 * google.visualization.events.addListener above. Returns true if the listener
 * was successfully removed.
 *
 * @param listener Listener to be removed.
 * @return Indicating whether the listener was successfully removed.
 */
export function removeListener(listener: AnyDuringMigration): boolean {
  const key =
    listener && typeof listener.getKey === 'function' && listener.getKey();
  if (key) {
    return events.unlistenByKey(key);
  }
  return false;
}

/**
 * Removes all listeners on the specified 'eventSource'.
 *
 * @param eventSource Observed object.
 * @return Number of listeners removed.
 */
export function removeAllListeners(eventSource: AnyDuringMigration): number {
  const eventTarget = getEventTarget(eventSource);
  const numListners = events.removeAll(eventTarget);
  clearEventTarget(eventSource);
  return numListners;
}

/**
 * The object key for storing a `EventTarget`.
 */
export const GVIZ_EVENT_TARGET_KEY = '__eventTarget';

/**
 * Returns an EventTarget associated with the specified 'eventSource'.
 * If missing, creates an EventTarget and stores it in
 * eventSource['__eventTarget'].
 *
 * @param eventSource Observed object.
 * @return eventTarget The associated EventTarget.
 */
export function getEventTarget(eventSource: AnyDuringMigration): EventTarget {
  const eventTarget = eventSource[GVIZ_EVENT_TARGET_KEY];
  return eventTarget != null ? eventTarget : createEventTarget(eventSource);
}

/**
 * Returns an object of type `EventTarget` associated
 * with the given 'eventSource' object.
 * The EventTarget is added as a property to the 'eventSource' object and its
 * key is: '__eventTarget'.
 *
 * Note: a new eventTarget is added, preferably only call
 * `google.visualization.events.getEventTarget`.
 *
 * @param eventSource Observed object.
 * @return eventTarget The associated event target.
 */
export function createEventTarget(
  eventSource: AnyDuringMigration,
): EventTarget {
  const eventTarget = new EventTarget();
  eventSource[GVIZ_EVENT_TARGET_KEY] = eventTarget;
  return eventTarget;
}

/**
 * Clears the EventTarget defined in the EventSource.
 *
 * @param eventSource Observed object.
 */
export function clearEventTarget(eventSource: AnyDuringMigration) {
  dispose(eventSource[GVIZ_EVENT_TARGET_KEY]);
  eventSource[GVIZ_EVENT_TARGET_KEY] = undefined;
}

/**
 * Returns a handler function that invokes the given 'eventHandler' with
 * event properties extracted from the dispatched event 'e'.
 *
 * @param eventHandler Function to handle events.
 * @return Function to handle events.
 */
export function createEventHandler(
  eventHandler: Function,
): (this: AnyDuringMigration, event: AnyDuringMigration) => AnyDuringMigration {
  return (e: GvizEvent) => {
    // (@see google.visualization.events.trigger).
    if (e && e.getEventProperties) {
      eventHandler(e.getEventProperties());
    } else {
      eventHandler();
    }
  };
}

// HELPER CLASSES

/**
 * A very basic event listener class.
 */
export class EventListener {
  /**
   * @param key The listener key.
   */
  constructor(private readonly key: events.Key) {}

  /**
   * @return The listener key.
   */
  getKey(): events.Key {
    return this.key;
  }
}

/**
 * A gviz Event. An event with type and attached properties.
 */
export class GvizEvent extends googEvent {
  /**
   * @param type The event type.
   * @param properties The event properties.
   */
  constructor(
    type: string,
    private readonly properties: {},
  ) {
    super(type);
  }

  /**
   * Returns the event properties.
   * @return The event properties.
   */
  getEventProperties(): {} {
    return this.properties;
  }
}
