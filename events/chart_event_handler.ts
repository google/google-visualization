/**
 * @fileoverview ChartEventHandler listens to goog events on the chart canvas,
 * processes them and dispatches gviz InteractionEvents to a given target.
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

import MouseWheelHandler from 'goog:goog.events.MouseWheelHandler'; // from //third_party/javascript/closure/events:mousewheelhandler
import {assert} from '@npm//@closure/asserts/asserts';
import {Disposable} from '@npm//@closure/disposable/disposable';
import {dispose} from '@npm//@closure/disposable/dispose';
import {
  BrowserEvent,
  EventTarget,
  listen,
  MouseWheelEvent,
} from '@npm//@closure/events/events';
import {EventType} from '@npm//@closure/events/eventtype';
import {Coordinate} from '@npm//@closure/math/coordinate';
import {getClientPosition} from '@npm//@closure/style/style';
import {ChartType} from '../common/option_types';
import {numberOrNull} from '../common/util';
import {getDocument} from '../dom/dom';
import {BrowserRenderer} from '../graphics/browser_renderer';
import {Token, TOKEN_SEPARATOR} from '../visualization/corechart/id_utils';
import {GestureHandler} from './gesture_handler';
import * as interactionEvents from './interaction_events';
import {SUPPORT_TOUCH_EVENTS} from './interaction_events';

import {AbstractRenderer} from '../graphics/abstract_renderer';
import {DrawingGroup} from '../graphics/drawing_group';
import {OverlayArea} from '../graphics/overlay_area';

/**
 * ChartEventHandler listens to goog events on the chart canvas,
 * processes them and dispatches gviz InteractionEvents to a given target.
 * TODO(dlaliberte): Do not use the renderer for event handling. Use a
 * events.EventHandler directly instead.
 * TODO(dlaliberte): Do not classify detected target elements into groups. Leave
 * that to the InteractionEvents handler instead. Then, chartType will no longer
 * be necessary.
 */
export abstract class ChartEventHandler extends Disposable {
  /** The target for interaction events. */
  private interactionEventTarget: EventTarget | null;

  /**
   * The ID of the hovered element, or null if no element is hovered.
   * Needed to dispatch HOVER_IN and HOVER_OUT interaction events.
   */
  private hoveredElementID: string | null = null;

  /**
   * The class that takes in events and processes them to find out if a
   * gesture has occurred.
   */
  private readonly gestureHandler: GestureHandler | null;

  /** Keep track of this event target so we can dispose of it later. */
  private scrollHandler: MouseWheelHandler | null = null;

  /**
   * @param interactionEventTarget The target to dispatch interaction events to.
   * @param renderer Used for hanging events on chart elements and obtaining the
   *     cursor position. Cleared on dispose.
   * @param overlayArea Used for hanging events on the overlay area above the
   *     chart.  Cleared on dispose.
   * @param chartType The type of the chart.
   */
  constructor(
    interactionEventTarget: EventTarget,
    protected renderer: AbstractRenderer,
    protected overlayArea: OverlayArea,
    private readonly chartType: ChartType,
  ) {
    super();

    /** The target for interaction events. */
    this.interactionEventTarget = interactionEventTarget;

    /**
     * The class that takes in events and processes them to find out if a
     * gesture has occurred.
     */
    this.gestureHandler = new GestureHandler(interactionEventTarget);
    this.registerDisposable(this.gestureHandler);
  }

  override disposeInternal() {
    this.interactionEventTarget = null;
    dispose(this.scrollHandler);
    super.disposeInternal();
  }

  /**
   * Listens to all relevant events on the renderer's canvas. See the
   * listenToAllEvents function for more information.
   */
  listenToAllRendererEvents() {
    const canvas = this.renderer.getCanvas();
    assert(canvas != null);
    this.listenToAllEvents((eventType, listener) => {
      this.renderer.setEventHandler(
        canvas as DrawingGroup,
        eventType,
        listener,
      );
    });

    dispose(this.scrollHandler);
    this.scrollHandler = new MouseWheelHandler(this.renderer.getContainer());
    listen(
      this.scrollHandler,
      MouseWheelHandler.EventType.MOUSEWHEEL,
      this.handleScrollEvent.bind(this),
    );
  }

  /*
   * Listens to all relevant events on the overlay area. See the
   * listenToAllEvents function for more information.
   */
  listenToAllOverlayAreaEvents() {
    const container = this.overlayArea.getContainer();
    this.listenToAllEvents((eventType, listener) => {
      // AnyDuringAssistedMigration because:  Argument of type 'Function' is not
      // assignable to parameter of type 'HandlerType | null | undefined'.
      this.overlayArea.setEventHandler(
        container,
        eventType,
        listener as AnyDuringAssistedMigration,
      );
    });
  }

  /**
   * Listens to all relevant events on the overlay area. See the
   * listenToAllEvents function for more information.
   */
  listenToAllPageEvents() {
    const container = getDocument();
    this.listenToPageEvents((eventType, listener) => {
      // AnyDuringAssistedMigration because:  Argument of type 'Function' is not
      // assignable to parameter of type 'HandlerType | null | undefined'.
      this.overlayArea.setEventHandler(
        container,
        eventType,
        listener as AnyDuringAssistedMigration,
      );
    });
  }

  /**
   * Listens to all relevant events on the entire document. Only useful for
   * those events which are continuations of ones from within a chart, otherwise
   * we have no reason to be affecting a user's entire document.
   * @param setEventHandler A function that accepts an event type and a
   *     callback, and sets the appropriate event handler.
   */
  private listenToPageEvents(
    setEventHandler: (
      p1: EventType,
      p2: Function,
    ) => AnyDuringAssistedMigration,
  ) {
    setEventHandler(EventType.MOUSEMOVE, this.handlePageMouseMove.bind(this));

    setEventHandler(EventType.MOUSEUP, this.handlePageMouseUp.bind(this));
  }

  /**
   * Listens to all relevant events on some element (using the callback
   * argument). When an event occurs, its handlers detects the target element
   * (point, annotation, legend entry etc.), and dispatches a HOVER_IN,
   * HOVER_OUT, CLICK or RIGHT_CLICK InteractionEvent on it.
   * @param setEventHandler A function that accepts an event type and a
   *     callback, and sets the appropriate event handler.
   */
  private listenToAllEvents(
    setEventHandler: (
      p1: EventType,
      p2: Function,
    ) => AnyDuringAssistedMigration,
  ) {
    setEventHandler(
      EventType.MOUSEOVER,
      this.handleMouseoverAndMousemoveEvent.bind(this),
    );

    setEventHandler(EventType.MOUSEOUT, this.handleMouseoutEvent.bind(this));

    setEventHandler(
      EventType.MOUSEMOVE,
      this.handleMouseoverAndMousemoveEvent.bind(this),
    );

    setEventHandler(EventType.MOUSEUP, this.handleMouseUpEvent.bind(this));

    setEventHandler(EventType.MOUSEDOWN, this.handleMouseDownEvent.bind(this));

    setEventHandler(EventType.CLICK, this.handleClickEvent.bind(this));

    setEventHandler(
      EventType.CONTEXTMENU,
      this.handleRightClickEvent.bind(this),
    );

    setEventHandler(EventType.DBLCLICK, this.handleDblClickEvent.bind(this));

    if (SUPPORT_TOUCH_EVENTS) {
      // Need to handle "Page" events for ObjC (and Android?)
      // here otherwise we miss import drag events.
      setEventHandler(EventType.MOUSEMOVE, this.handlePageMouseMove.bind(this));

      setEventHandler(EventType.MOUSEUP, this.handlePageMouseUp.bind(this));

      // Fake events sent by the ObjC GViz Library.
      // TODO(dlaliberte): Update these names in ObjC first, then here.
      setEventHandler(
        'pinchbegan' as EventType,
        this.handlePinchStart.bind(this),
      );
      setEventHandler('pinchchanged' as EventType, this.handlePinch.bind(this));
      setEventHandler('pinchend' as EventType, this.handlePinchEnd.bind(this));
    }
  }

  /**
   * Handles a mousemove event anywhere on the entire page -- needed for
   * gestures that go outside the bounds of the chart.
   * @param event A mouse move event that occurred anywhere on the page.
   */
  private handlePageMouseMove(event: BrowserEvent) {
    // Event contains information about the location relative to the document,
    // set it so that it's relative to the chart.
    const positionInPage = getClientPosition(this.renderer.getContainer());
    const position = getClientPosition(event);
    position.x = position.x - positionInPage.x;
    position.y = position.y - positionInPage.y;
    this.gestureHandler!.handlePageMouseMove(position, event.shiftKey);
  }

  /**
   * Handles a mouseup event anywhere on the entire page -- needed for gestures
   * that go outside the bounds of the chart.
   * @param event A mouse up event that occurred anywhere on the page.
   */
  private handlePageMouseUp(event: BrowserEvent) {
    // Event contains information about the location relative to the document,
    // set it so that it's relative to the chart.
    const positionInPage = getClientPosition(this.renderer.getContainer());
    const position = getClientPosition(event);
    position.x = position.x - positionInPage.x;
    position.y = position.y - positionInPage.y;
    this.gestureHandler!.handlePageMouseUp(
      position,
      event.button,
      event.shiftKey,
    );
  }

  /**
   * Handles mouseover and mousemove events on the canvas by:
   * 1. Dispatching a general CHART_MOUSE_MOVE event (for mousemove only).
   * 2. Detecting whether the mouse has moved from one element to another. If
   * so: 2.1 Dispatch a general CHART_MOUSE_OUT event. 2.2 Dispatch a HOVER_OUT
   * event for the hovered out element. 2.3 Dispatch a general CHART_HOVER_IN
   * event. 2.4 Dispatch a HOVER_IN event for the hovered in element.
   * @param event A mouseover or mousemove event that occurred on the canvas.
   */
  private handleMouseoverAndMousemoveEvent(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);

    // NOTE(zinke): When switching to browser fullscreen in Firefox 33 on
    // Windows and Linux, Firefox fires events between the above line and the
    // next call to getCursorPosition which modify the dom invalidating this
    // event. See b/17996613
    try {
      this.getCursorPosition(event);
    } catch (e) {
      return;
    }

    // NOTE(dylandavidson): It's possible for a chart to be removed from the DOM
    // right before/as a mouse event is fired, in which case getCursorPosition
    // returns null and causes an exception. See b/37257738.
    if (!cursorPosition) {
      return;
    }

    const targetElementID = this.detectTargetElement(event);

    if (event.type === EventType.MOUSEMOVE) {
      // Dispatch a general CHART_MOUSE_MOVE event.
      this.dispatchEvent(interactionEvents.EventType.CHART_MOUSE_MOVE, {
        cursorPosition,
        targetID: targetElementID,
      });
    }

    if (targetElementID === this.hoveredElementID) {
      // Do not dispatch events when the target element has not changed.
      return;
    }

    // Note that the hovered element is null if the event follows a MOUSEOUT
    // event. In this case, out events have already been dispatched.
    if (this.hoveredElementID != null) {
      this.dispatchOutEvents(this.hoveredElementID);
    }

    this.dispatchInEvents(targetElementID, cursorPosition);

    this.hoveredElementID = targetElementID;
  }

  getCursorPosition(event: BrowserEvent): Coordinate | null {
    return (this.renderer as BrowserRenderer).getCursorPosition(event);
  }

  /**
   * Handles a mouseout event on the canvas by:
   * 1. Dispatching a general CHART_HOVER_OUT event.
   * 2. Detecting the hovered element and dispatching a HOVER_OUT event for it.
   * @param event A mouseout event that occurred on the chart canvas.
   */
  private handleMouseoutEvent(event: BrowserEvent) {
    const targetElementID = this.detectTargetElement(event);
    if (targetElementID !== this.hoveredElementID) {
      // MOUSEOUT was triggered on an element that is not the hovered one.
      return;
    }

    // Dispatch OUT events.
    this.dispatchOutEvents(targetElementID);

    this.hoveredElementID = null;
  }

  /**
   * Dispatches a general CHART_HOVER_OUT event, and a HOVER_OUT event specific
   * to the target element.
   * @param targetElementID The ID of the target element.
   */
  private dispatchOutEvents(targetElementID: string) {
    // Dispatch a general CHART_HOVER_OUT event.
    this.dispatchEvent(interactionEvents.EventType.CHART_HOVER_OUT, null);
    // Dispatch a HOVER_OUT event specific to the target element.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.HOVER_OUT,
      targetElementID,
    );
  }

  /**
   * Dispatches a general CHART_HOVER_IN event, and a HOVER_IN event specific to
   * the target element.
   * @param targetElementID The ID of the target element.
   * @param cursorPosition The cursor position.
   */
  private dispatchInEvents(
    targetElementID: string,
    cursorPosition: Coordinate,
  ) {
    // Dispatch a general CHART_HOVER_IN event.
    this.dispatchEvent(interactionEvents.EventType.CHART_HOVER_IN, {
      cursorPosition,
    });
    // Dispatch a HOVER_IN event specific to the target element.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.HOVER_IN,
      targetElementID,
    );
  }

  /**
   * Handles a mouseup event on the chart canvas by detecting the element and
   * dispatching:
   * 1. A general CHART_MOUSE_UP event.
   * 2. A specific <ELEMENT_CLASS>_MOUSE_UP event for it.
   * @param event A mouseup event that occurred on the chart canvas.
   */
  private handleMouseUpEvent(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);

    // NOTE(dylandavidson): It's possible for a chart to be removed from the DOM
    // right before/as a mouse event is fired, in which case getCursorPosition
    // returns null and causes an exception. See b/37257738.
    if (!cursorPosition) {
      return;
    }

    const targetElementID = this.detectTargetElement(event);
    // Dispatch a general CHART_MOUSE_UP event.
    this.dispatchEvent(interactionEvents.EventType.CHART_MOUSE_UP, {
      cursorPosition,
      targetID: targetElementID,
    });
    // Dispatch a specific <ELEMENT_CLASS>_MOUSE_UP event.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.MOUSE_UP,
      targetElementID,
    );
  }

  /**
   * Handles a mousedown event on the chart canvas by detecting the element and
   * dispatching:
   * 1. A general CHART_MOUSE_DOWN event.
   * 2. A specific <ELEMENT_CLASS>_MOUSE_DOWN event for it.
   * @param event A mousedown event that occurred on the chart canvas.
   */
  private handleMouseDownEvent(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);
    // Dispatch a general CHART_MOUSE_DOWN event. Passes in event so
    // preventDefault may be called if needed.
    this.dispatchEvent(interactionEvents.EventType.CHART_MOUSE_DOWN, {
      cursorPosition,
      targetID: targetElementID,
      preventDefault: event.preventDefault.bind(event),
      shiftKey: event.shiftKey,
    });
    // Dispatch a specific <ELEMENT_CLASS>_MOUSE_DOWN event.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.MOUSE_DOWN,
      targetElementID,
    );
    this.gestureHandler!.handleMouseDown(
      cursorPosition,
      targetElementID,
      event.button,
    );
  }

  /**
   * Handles a click event on the chart canvas by detecting the clicked element
   * and dispatching:
   * 1. A general CHART_CLICK event.
   * 2. A specific <ELEMENT_CLASS>_CLICK event for it.
   * @param event A click event that occurred on the chart canvas.
   */
  private handleClickEvent(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);
    // Dispatch a general CHART_CLICK event.
    this.dispatchEvent(interactionEvents.EventType.CHART_CLICK, {
      cursorPosition,
      targetID: targetElementID,
    });
    // Dispatch a specific <ELEMENT_CLASS>_CLICK event.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.CLICK,
      targetElementID,
    );
  }

  /**
   * Handles a right click event on the chart canvas by detecting the clicked
   * element and dispatching:
   * 1. A general CHART_RIGHT_CLICK event.
   * 2. A specific <ELEMENT_CLASS>_RIGHT_CLICK event for it.
   * Note: This handler also prevents the default handling of the browser, which
   *     is to open a context menu.
   * @param event A right click event that occurred on the chart canvas.
   */
  private handleRightClickEvent(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);
    // Dispatch a general CHART_RIGHT_CLICK event.
    this.dispatchEvent(interactionEvents.EventType.CHART_RIGHT_CLICK, {
      cursorPosition,
      targetID: targetElementID,
    });
    // Dispatch a specific <ELEMENT_CLASS>_RIGHT_CLICK event.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.RIGHT_CLICK,
      targetElementID,
    );

    // Prevent browser from opening a context menu.
    event.preventDefault();
  }

  /**
   * Handles a double click event on the chart canvas by detecting the clicked
   * element and dispatching:
   * 1. A general CHART_DBL_CLICK event.
   * 2. A specific <ELEMENT_CLASS>_DBL_CLICK event for it.
   * @param event A double click event that occurred on the chart canvas.
   */
  private handleDblClickEvent(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);
    // Dispatch a general CHART_DBL_CLICK event.
    this.dispatchEvent(interactionEvents.EventType.CHART_DBL_CLICK, {
      cursorPosition,
      targetID: targetElementID,
    });
    // Dispatch a specific <ELEMENT_CLASS>_DBL_CLICK event.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.DBL_CLICK,
      targetElementID,
    );
  }

  /**
   * Handles a scroll event on the chart canvas by detecting the scrolled
   * element and dispatching:
   * 1. A general CHART_SCROLL event.
   * 2. A specific <ELEMENT_CLASS>_SCROLL event for it.
   * @param event A scroll event that occurred on the chart canvas.
   */
  private handleScrollEvent(event: MouseWheelEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);
    const delta = event.deltaY; // using deltaY as suggested by mousewheelhandler.js
    // since e.detail is informally deprecated
    // Dispatch a general CHART_SCROLL event. Passes in preventDefault so that
    // it may be called if needed.
    this.dispatchEvent(interactionEvents.EventType.CHART_SCROLL, {
      cursorPosition,
      targetID: targetElementID,
      wheelDelta: delta,
      preventDefault: event.preventDefault.bind(event),
    });
    // Dispatch a specific <ELEMENT_CLASS>_SCROLL event.
    this.dispatchInteractionEvent(
      interactionEvents.OperationType.SCROLL,
      targetElementID,
    );
  }

  /**
   * Handles a synthetic pinch start event on the chart canvas.
   * Dispatches a CHART_PINCH_START method to be handled by Explorer code.
   *
   * @param event A synthetic event.
   */
  private handlePinchStart(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);

    this.dispatchEvent(interactionEvents.EventType.CHART_PINCH_START, {
      cursorPosition,
      targetID: targetElementID,
      gestureDetails: (event.getBrowserEvent() as AnyDuringAssistedMigration)[
        'gestureDetails'
      ],
    });

    if (targetElementID === this.hoveredElementID) {
      // Do not dispatch events when the target element has not changed.
      return;
    }
  }

  /**
   * Handles a synthetic pinch changed event on the chart canvas.
   * Dispatches a CHART_PINCH method to be handled by Explorer code.
   *
   * @param event A synthetic event.
   */
  private handlePinch(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);

    this.dispatchEvent(interactionEvents.EventType.CHART_PINCH, {
      cursorPosition,
      targetID: targetElementID,
      gestureDetails: (event.getBrowserEvent() as AnyDuringAssistedMigration)[
        'gestureDetails'
      ],
    });

    if (targetElementID === this.hoveredElementID) {
      // Do not dispatch events when the target element has not changed.
      return;
    }
  }

  /**
   * Handles a synthetic pinch end event on the chart canvas.
   * Dispatches a CHART_PINCH_END method to be handled by Explorer code.
   *
   * @param event A synthetic event.
   */
  private handlePinchEnd(event: BrowserEvent) {
    const cursorPosition = this.getCursorPosition(event);
    const targetElementID = this.detectTargetElement(event);

    this.dispatchEvent(interactionEvents.EventType.CHART_PINCH_END, {
      cursorPosition,
      targetID: targetElementID,
      gestureDetails: (event.getBrowserEvent() as AnyDuringAssistedMigration)[
        'gestureDetails'
      ],
    });

    if (targetElementID === this.hoveredElementID) {
      // Do not dispatch events when the target element has not changed.
      return;
    }
  }

  /**
   * If an event occurred on an element common to Axis and Pie charts, dispatch
   * an interaction event for it. Otherwise, delegate to the specific builder.
   * @param interactionEventOperationType The operation type: HOVER_IN,
   *     HOVER_OUT, CLICK or RIGHT_CLICK.
   * @param targetElementID The target element ID.
   */
  private dispatchInteractionEvent(
    interactionEventOperationType: interactionEvents.OperationType,
    targetElementID: string,
  ) {
    // Split the target element ID into tokens.
    // The first token is expected to be the type, and the rest indices.
    const targetElementTokens = targetElementID.split(TOKEN_SEPARATOR);
    const targetElementType = targetElementTokens[0];

    let interactionEventType;
    let interactionEventData;
    let legendEntryIndex;

    // Handle target elements common to both Axis and Pie charts here.
    // Delegate the handling of content elements to the specific builders.
    switch (targetElementType) {
      case Token.TOOLTIP:
        // If the serie is interactive, dispatch TOOLTIP event.
        let serieIndex = null;
        let datumIndex = null;
        let annotationIndex = null;
        if (this.chartType === ChartType.PIE) {
          serieIndex = numberOrNull(targetElementTokens[1]);
        } else if (targetElementTokens.length === 4) {
          // The serie index is null for category annotations.
          serieIndex = numberOrNull(targetElementTokens[1]);
          datumIndex = numberOrNull(targetElementTokens[2]);
          annotationIndex = numberOrNull(targetElementTokens[3]);
        } else if (targetElementTokens.length === 3) {
          serieIndex = numberOrNull(targetElementTokens[1]);
          datumIndex = numberOrNull(targetElementTokens[2]);
        } else {
          datumIndex = numberOrNull(targetElementTokens[1]);
        }
        interactionEventType = interactionEvents.generateEventType(
          interactionEvents.TargetType.TOOLTIP,
          interactionEventOperationType,
        );
        interactionEventData = {
          serieIndex,
          datumIndex,
          annotationIndex,
        };
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      case Token.ACTIONS_MENU_ENTRY:
        interactionEventType = interactionEvents.generateEventType(
          interactionEvents.TargetType.ACTIONS_MENU_ENTRY,
          interactionEventOperationType,
        );
        const entryID = targetElementTokens[1];
        interactionEventData = {entryID};
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      case Token.LEGEND_ENTRY:
        // If legend entry is interactive dispatch LEGEND_ENTRY event.
        legendEntryIndex = numberOrNull(targetElementTokens[1]);
        if (legendEntryIndex != null && legendEntryIndex < 0) {
          // Ignore bogus legend entries.
          break;
        }
        // Note this also takes care of labeled legend entries in Pie chart.
        interactionEventType = interactionEvents.generateEventType(
          interactionEvents.TargetType.LEGEND_ENTRY,
          interactionEventOperationType,
        );
        interactionEventData = {legendEntryIndex};
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      case Token.LEGEND_SCROLL_BUTTON:
        interactionEventType = interactionEvents.generateEventType(
          interactionEvents.TargetType.LEGEND_SCROLL_BUTTON,
          interactionEventOperationType,
        );
        const scrollStep = numberOrNull(targetElementTokens[1]);
        const currentPageIndex = numberOrNull(targetElementTokens[2]);
        const totalPages = numberOrNull(targetElementTokens[3]);
        interactionEventData = {
          scrollStep,
          currentPageIndex,
          totalPages,
        };
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      case Token.REMOVE_SERIE_BUTTON:
        interactionEventType = interactionEvents.generateEventType(
          interactionEvents.TargetType.REMOVE_SERIE_BUTTON,
          interactionEventOperationType,
        );
        legendEntryIndex = numberOrNull(targetElementTokens[1]);
        interactionEventData = {legendEntryIndex};
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      // Delegate the handling of unrecognized elements to the specific
      // builders.
      default:
        this.dispatchInteractionEventForContent(
          interactionEventOperationType,
          targetElementID,
        );
    }
  }

  /**
   * @param interactionEventOperationType The operation type: HOVER_IN,
   *     HOVER_OUT, CLICK or RIGHT_CLICK.
   * @param targetElementID The target element ID.
   */
  abstract dispatchInteractionEventForContent(
    interactionEventOperationType: interactionEvents.OperationType,
    targetElementID: string,
  ): void;

  /**
   * Dispatches an interaction event to the interaction events target.
   * @param type The event type.
   * @param data The event data.
   */
  protected dispatchEvent(
    type: interactionEvents.EventType,
    data: AnyDuringAssistedMigration | null,
  ) {
    if (this.interactionEventTarget) {
      this.interactionEventTarget.dispatchEvent({
        type,
        data,
      } as interactionEvents.Event);
    }
  }

  abstract detectTargetElement(event: BrowserEvent): string;

  /**
   * @return The ID of the hovered element, or null if no element is hovered.
   */
  protected getHoveredElementID(): string | null {
    return this.hoveredElementID;
  }
}
