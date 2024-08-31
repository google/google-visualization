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

import * as events from '@npm//@closure/events/events';
import {EventType} from '@npm//@closure/events/eventtype';
import {merge, partition, Subject} from 'rxjs';
import {debounceTime} from 'rxjs/operators';
import {ChartEventType} from '../../events/chart_event_types';
import {BrowserRenderer} from '../../graphics/browser_renderer';

/** Treemap human interactions. */
export const {DRILL_DOWN, HIGHLIGHT, ROLL_UP, UNHIGHLIGHT} = ChartEventType;
/** Treemap mouse events. */
export const {CLICK, CONTEXTMENU, DBLCLICK, MOUSEOUT, MOUSEOVER} = EventType;
/** 2 clicks happen within this interval will be considered a double-click. */
export const DOUBLE_CLICK_INTERVAL_MS = 250; // millisecond

/**
 * Callback functions for supported treemap human interactions.
 *
 * Need the keyword "declare" to turn JSCompiler field renaming off.
 */
export declare interface InteractionConfig {
  highlight: Function;
  unhighlight: Function;
  rollup: Function;
  drilldown: Function;
}

/**
 * User facing event configuration to trigger tree map interactions.
 *
 * Supported interactions: {@code supportedInteractions}.
 * Supported mouse events: {@code supportedMouseEvents}.
 * Supported mouse event modifier keys: {@code supportedKeyEvents}.
 *
 * Config semantics:
 * <ul>
 *   <li> an empty array []: disable the interaction.
 *   <li> undefined: use the default.
 *   <li> mouse not in {@code supportedMouseEvents}: use the default.
 *   <li> key not in {@code supportedKeyEvents}: use the default.
 *   <li> [mouse_event, opt_key1, opt_key2, opt_key3, opt_key4]: valid config.
 * </ul>
 * Need the keyword "declare" to turn JSCompiler field renaming off.
 */
export declare interface EventsConfig {
  highlight?: string[];
  unhighlight?: string[];
  rollup?: string[];
  drilldown?: string[];
}

/**
 * Event combined by 1 mouse event and 0 or more key events.
 *
 * Supported mouse events: {@code supportedMouseEvents}.
 * Supported mouse event modifier keys: {@code supportedKeyEvents}.
 *
 * Need the keyword "declare" to turn JSCompiler field renaming off.
 */
declare interface MouseKeyEvent {
  enabled: boolean; // whether the associated interaction is enabled.
  mouse: string;
  keys: {[key: string]: boolean};
}

/**
 * Internal mouse + key(s) configuration.
 *
 * Need the keyword "declare" to turn JSCompiler field renaming off.
 */
declare interface MouseKeyConfig {
  highlight: MouseKeyEvent;
  unhighlight: MouseKeyEvent;
  rollup: MouseKeyEvent;
  drilldown: MouseKeyEvent;
}

/**
 * Key modifiers during mouse events. See DOM MouseEvent Properties:
 * mdn/API/MouseEvent
 */
const [ALTKEY, CTRLKEY, METAKEY, SHIFTKEY] = [
  'altKey',
  'ctrlKey',
  'metaKey',
  'shiftKey',
];
const supportedInteractions: string[] = [
  DRILL_DOWN,
  HIGHLIGHT,
  ROLL_UP,
  UNHIGHLIGHT,
];
const supportedKeyEvents: string[] = [ALTKEY, CTRLKEY, METAKEY, SHIFTKEY];
const supportedMouseEvents: string[] = [
  CLICK,
  CONTEXTMENU,
  DBLCLICK,
  MOUSEOUT,
  MOUSEOVER,
];
type MouseEventType =
  | 'click'
  | 'contextmenu'
  | 'dblclick'
  | 'mouseout'
  | 'mouseover';
type BrowserEvent = events.BrowserEvent;

/**
 * Event handling class for Treemap.
 */
export class TreeMapEventsHandler {
  mouseKeyConfig: MouseKeyConfig = {
    highlight: this.parseMouseKeyEvent([MOUSEOVER])!,
    unhighlight: this.parseMouseKeyEvent([MOUSEOUT])!,
    rollup: this.parseMouseKeyEvent([CONTEXTMENU])!,
    drilldown: this.parseMouseKeyEvent([CLICK])!,
  };

  interactionConfig: InteractionConfig = {
    highlight: () => {},
    unhighlight: () => {},
    rollup: () => {},
    drilldown: () => {},
  } as InteractionConfig;

  mouseEvents = new Subject<BrowserEvent>();

  constructor() {
    const [leftMouseEvents, otherMouseEvents] = partition(
      this.mouseEvents,
      (e: BrowserEvent) => [CLICK as string, DBLCLICK].includes(e.type),
    );

    // DOM fires 3 events when the user double-clicks: click, click, dblclick.
    // We debounce to keep only the last one if those events happen within
    // {@code DOUBLE_CLICK_INTERVAL_MS}.
    // TODO(b/173169785): make multi-click handling generic in gviz.
    const debouncedLeftMouseEvents = leftMouseEvents.pipe(
      debounceTime(DOUBLE_CLICK_INTERVAL_MS),
    );

    merge(debouncedLeftMouseEvents, otherMouseEvents).subscribe((event) => {
      for (const action of supportedInteractions) {
        if (
          this.eventsEqual(
            event,
            // tslint:disable-next-line:no-dict-access-on-struct-type
            this.mouseKeyConfig[action as keyof MouseKeyConfig],
          )
        ) {
          // tslint:disable-next-line:no-dict-access-on-struct-type
          this.interactionConfig[action as keyof InteractionConfig](event);
        }
      }
    });
  }

  /** Reuse the {@code mouseKeyConfig} from another instance. */
  reuseConfig(treeMapEventsHandler: TreeMapEventsHandler) {
    this.mouseKeyConfig = treeMapEventsHandler.mouseKeyConfig;
  }

  /**
   * Configure mouse and key events to trigger tree map interactions.
   */
  setConfig(eventsConfig: EventsConfig) {
    for (const key of Object.keys(this.mouseKeyConfig)) {
      const mouseKeyEvent = this.parseMouseKeyEvent(
        // tslint:disable-next-line:no-dict-access-on-struct-type
        eventsConfig[key as keyof EventsConfig],
      );
      // Skip invalid config and use the default.
      if (mouseKeyEvent) {
        // tslint:disable-next-line:no-dict-access-on-struct-type
        this.mouseKeyConfig[key as keyof MouseKeyConfig] = mouseKeyEvent;
      }
    }
  }

  /**
   * Get current mouse and key events configuration for tree map interactions.
   */
  getConfig(): EventsConfig {
    const eventsConfig: EventsConfig = {} as EventsConfig;
    for (const [key, value] of Object.entries(this.mouseKeyConfig)) {
      // tslint:disable-next-line:no-dict-access-on-struct-type
      eventsConfig[key as keyof EventsConfig] =
        this.convertMouseKeyEvent(value);
    }
    return eventsConfig;
  }

  /**
   * Attach treemap interaction functions to all supported mouse events.
   */
  makeEvents(
    browserRenderer: BrowserRenderer,
    element: Element,
    interactionConfig: InteractionConfig,
  ) {
    for (const mouseEvent of supportedMouseEvents) {
      browserRenderer.setEventHandler(
        element,
        mouseEvent as MouseEventType,
        (event: BrowserEvent) => {
          this.mouseEvents.next(event);
        },
      );
    }
    this.interactionConfig = interactionConfig;
  }

  /**
   * Parse a {@code MouseKeyEvent} from a mouse+keys string array.
   * See {@code EventsConfig} for the {@param eventsConfigArray} semantics.
   */
  private parseMouseKeyEvent(
    eventsConfigArray?: string[],
  ): MouseKeyEvent | null {
    if (!eventsConfigArray) {
      return null; // invalid config
    }

    const mouseKeyEvent: MouseKeyEvent = {
      enabled: false,
      mouse: '',
      keys: {},
    };

    if (eventsConfigArray.length === 0) {
      return mouseKeyEvent; // disable the associated interaction.
    }

    const mouseKeyArray = [...eventsConfigArray]; // make a copy for mutations.
    const mouse = mouseKeyArray.shift() || '';
    if (
      !supportedMouseEvents.includes(mouse) ||
      !mouseKeyArray.every((c) => supportedKeyEvents.includes(c))
    ) {
      return null; // invalid config
    }

    mouseKeyEvent.enabled = true;
    mouseKeyEvent.mouse = mouse;
    for (const key of supportedKeyEvents) {
      mouseKeyEvent.keys[key as keyof MouseKeyEvent] = false;
    }
    for (const key of eventsConfigArray) {
      mouseKeyEvent.keys[key as keyof MouseKeyEvent] = true;
    }
    return mouseKeyEvent;
  }

  // Convert {@param mouseKeyEvent} to a mouse+keys string array.
  // See {@code EventsConfig} for the format of the mouse+keys string array.
  private convertMouseKeyEvent(mouseKeyEvent: MouseKeyEvent): string[] {
    if (!mouseKeyEvent.enabled) {
      return []; // Empty array means the associated interaction is disabled
    }
    const eventConfig = [mouseKeyEvent.mouse];
    for (const key of supportedKeyEvents) {
      if (mouseKeyEvent.keys[key]) {
        eventConfig.push(key);
      }
    }
    return eventConfig;
  }

  // Return whether the mouse+key settings are symantecally equal in
  // {@param browserEvent} and {@param mouseKeyEvent}.
  private eventsEqual(
    browserEvent: BrowserEvent,
    mouseKeyEvent: MouseKeyEvent,
  ): boolean {
    if (!mouseKeyEvent.enabled) {
      return false;
    }

    if (mouseKeyEvent.mouse !== browserEvent.type) {
      return false;
    }
    for (const key of supportedKeyEvents) {
      if (
        // tslint:disable-next-line:no-dict-access-on-struct-type
        mouseKeyEvent.keys[key] !== !!browserEvent[key as keyof BrowserEvent]
      ) {
        return false;
      }
    }
    return true;
  }
}
