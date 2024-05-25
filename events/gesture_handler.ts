/**
 * @fileoverview Contains the GestureHandler Class. More info below.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import {Disposable} from '@npm//@closure/disposable/disposable';
import {EventTarget} from '@npm//@closure/events/eventtarget';
import {Coordinate} from '@npm//@closure/math/coordinate';

import {Event, EventType} from './interaction_events';

interface DragInfo {
  targetID: string | null;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

/**
 * GestureHandler is a class that takes in events from ChartEventHandler and
 * stores data from past events to find gestures that form from them. These
 * gestures are then dispatched to the EventHandler class and are no different
 * than events at that point.
 * @unrestricted
 */
export class GestureHandler extends Disposable {
  /** The target for interaction events. */
  private interactionEventTarget: EventTarget | null;

  /** Boolean for each mouse button to be either up or down. */
  private readonly mouseButtonsDown: boolean[] = [];

  /** True if user is dragging, false otherwise. */
  private isDragging = false;

  /** Information about a drag. */
  private readonly dragInfo: DragInfo = {
    targetID: null,
    startX: 0,
    startY: 0,
    curX: 0,
    curY: 0,
  };

  /**
   * @param interactionEventTarget The target to dispatch interaction events to.
   */
  constructor(interactionEventTarget: EventTarget) {
    super();

    this.interactionEventTarget = interactionEventTarget;
  }

  /**
   * Handles gestures related to the mousedown event
   * @param position The current x and y location of the cursor.
   * @param targetID The object that the cursor is affecting.
   * @param button The number value of the button that is being pushed.
   */
  handleMouseDown(
    position: Coordinate | null,
    targetID: string,
    button: number,
  ) {
    this.mouseButtonsDown[button] = true;
    if (button === 0 && position) {
      this.dragInfo.targetID = targetID;
      this.dragInfo.startX = position.x;
      this.dragInfo.startY = position.y;
      this.dragInfo.curX = position.x;
      this.dragInfo.curY = position.y;
    }
  }

  /**
   * Handles gestures related to the mouseup event
   * @param position The current x and y location of the cursor relative to the
   *     page.
   * @param button The number value of the button that was being pushed.
   * @param shiftKey Indicates if a shift key was pressed.
   */
  handlePageMouseUp(
    position: Coordinate | null,
    button: number,
    shiftKey: boolean,
  ) {
    this.mouseButtonsDown[button] = false;
    if (button === 0 && position) {
      if (this.isDragging) {
        this.isDragging = false;
        this.dragInfo.curX = position.x;
        this.dragInfo.curY = position.y;
        this.dispatchEvent(EventType.CHART_DRAG_END, {
          targetID: this.dragInfo.targetID,
          cursorPosition: {x: this.dragInfo.curX, y: this.dragInfo.curY},
          shiftKey,
        });
      }
    }
  }

  /**
   * Handles gestures related to the mousemove event
   * @param position The current x and y location of the cursor relative to the
   *     page.
   * @param shiftKey Indicates if a shift key was pressed.
   */
  handlePageMouseMove(position: Coordinate | null, shiftKey: boolean) {
    if (this.mouseButtonsDown[0] && position) {
      this.dragInfo.curX = position.x;
      this.dragInfo.curY = position.y;
      if (!this.isDragging) {
        this.dispatchEvent(EventType.CHART_DRAG_START, {
          targetID: this.dragInfo.targetID,
          cursorPosition: {x: this.dragInfo.startX, y: this.dragInfo.startY},
          shiftKey,
        });
      }
      this.isDragging = true;
      this.dispatchEvent(EventType.CHART_DRAG, {
        targetID: this.dragInfo.targetID,
        cursorPosition: {x: this.dragInfo.curX, y: this.dragInfo.curY},
        shiftKey,
      });
    }
  }

  /**
   * Dispatches an interaction event to the interaction events target.
   * @param type The event type.
   * @param data The event data.
   */
  // tslint:disable-next-line:ban-types  Migration
  protected dispatchEvent(type: EventType, data: AnyDuringMigration | null) {
    asserts.assert(this.interactionEventTarget != null);
    this.interactionEventTarget!.dispatchEvent({type, data} as Event);
  }

  override disposeInternal() {
    this.interactionEventTarget = null;
    super.disposeInternal();
  }
}
