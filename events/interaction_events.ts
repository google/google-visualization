/**
 * @fileoverview Interaction events used by the canviz classes.
 * Tries to follow a structure similar to goog.events.
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

import {Coordinate} from '@npm//@closure/math/coordinate';

// tslint:disable:ban-types

/**
 * The data of an event sent from chart builder to chart with the following
 * fields:
 * <ul>
 *   <li>targetID: The string ID of the element the event fired on.
 *   <li>x: X location of the event.
 *   <li>y: Y location of the event.
 *   <li>mouseDelta: Distance scrolled in a scroll event.
 * </ul>
 */
export interface EventData {
  targetID: string;
  entryID: string | undefined;
  x: number;
  y: number;
  datumIndex: number | undefined;
  serieIndex: number | undefined;
  annotationIndex: number | undefined;
  legendEntryIndex: number | undefined;
  currentPageIndex: number | undefined;
  totalPages: number | undefined;
  scrollStep: number | undefined;
  mouseDelta: number | undefined;
  wheelDelta: number | undefined;
  gesture: AnyDuringMigration | null | undefined;
  gestureDetails: AnyDuringMigration | null | undefined;
  cursorPosition: Coordinate | undefined;
  preventDefault: boolean;
  shiftKey: boolean;
}

/**
 * Whether the browser supports touch events.
 */
export const SUPPORT_TOUCH_EVENTS =
  typeof document.documentElement !== 'undefined' &&
  document.documentElement.ontouchstart &&
  document.documentElement.ontouchend;

/**
 * The object that is passed from the chart builder to the chart with the
 * following fields:
 * <ul>
 *   <li>type: The event type. See EventType.
 *   <li>data: Any data associated with the event.
 * </ul>
 */
export interface Event {
  type: EventType;
  data: EventData;
}

// TODO(dlaliberte): Instead of using a single 'type' property on InteractionEvent,
// use two type properties: 'targetType' and 'operationType'.
// Then, this TargetType x OperationType cartesian product could be eliminated.
/**
 * Enumeration of all possible event types.
 * Event type.
 */
export enum EventType {
  CHART_HOVER_IN = 'chartHoverIn',
  CHART_HOVER_OUT = 'chartHoverOut',
  CHART_MOUSE_MOVE = 'chartMouseMove',
  CHART_MOUSE_UP = 'chartMouseUp',
  CHART_MOUSE_DOWN = 'chartMouseDown',
  CHART_CLICK = 'chartClick',
  CHART_RIGHT_CLICK = 'chartRightClick',
  CHART_DBL_CLICK = 'chartDblClick',
  CHART_SCROLL = 'chartScroll',
  CHART_DRAG_START = 'chartDragStart',
  CHART_DRAG = 'chartDrag',
  CHART_DRAG_END = 'chartDragEnd',
  CHART_PINCH_START = 'chartPinchStart',
  CHART_PINCH = 'chartPinch',
  CHART_PINCH_END = 'chartPinchEnd',
  LEGEND_HOVER_IN = 'legendHoverIn',
  LEGEND_HOVER_OUT = 'legendHoverOut',
  LEGEND_CLICK = 'legendClick',
  LEGEND_RIGHT_CLICK = 'legendRightClick',
  LEGEND_ENTRY_HOVER_IN = 'legendEntryHoverIn',
  LEGEND_ENTRY_HOVER_OUT = 'legendEntryHoverOut',
  LEGEND_ENTRY_CLICK = 'legendEntryClick',
  LEGEND_ENTRY_RIGHT_CLICK = 'legendEntryRightClick',
  LEGEND_SCROLL_BUTTON_HOVER_IN = 'legendScrollButtonHoverIn',
  LEGEND_SCROLL_BUTTON_HOVER_OUT = 'legendScrollButtonHoverOut',
  LEGEND_SCROLL_BUTTON_CLICK = 'legendScrollButtonClick',
  LEGEND_SCROLL_BUTTON_RIGHT_CLICK = 'legendScrollButtonRightClick',
  SERIE_HOVER_IN = 'serieHoverIn',
  SERIE_HOVER_OUT = 'serieHoverOut',
  SERIE_CLICK = 'serieClick',
  SERIE_RIGHT_CLICK = 'serieRightClick',
  CATEGORY_HOVER_IN = 'categoryHoverIn',
  CATEGORY_HOVER_OUT = 'categoryHoverOut',
  CATEGORY_CLICK = 'categoryClick',
  CATEGORY_RIGHT_CLICK = 'categoryRightClick',
  DATUM_HOVER_IN = 'datumHoverIn',
  DATUM_HOVER_OUT = 'datumHoverOut',
  DATUM_CLICK = 'datumClick',
  DATUM_RIGHT_CLICK = 'datumRightClick',
  ANNOTATION_HOVER_IN = 'annotationHoverIn',
  ANNOTATION_HOVER_OUT = 'annotationHoverOut',
  ANNOTATION_CLICK = 'annotationClick',
  ANNOTATION_RIGHT_CLICK = 'annotationRightClick',
  TOOLTIP_HOVER_IN = 'tooltipHoverIn',
  TOOLTIP_HOVER_OUT = 'tooltipHoverOut',
  TOOLTIP_CLICK = 'tooltipClick',
  TOOLTIP_RIGHT_CLICK = 'tooltipRightClick',
  ACTIONS_MENU_ENTRY_HOVER_IN = 'actionsMenuEntryHoverIn',
  ACTIONS_MENU_ENTRY_HOVER_OUT = 'actionsMenuEntryHoverOut',
  ACTIONS_MENU_ENTRY_CLICK = 'actionsMenuEntryClick',
  ACTIONS_MENU_ENTRY_RIGHT_CLICK = 'actionsMenuEntryRightClick',
  REMOVE_SERIE_BUTTON_HOVER_IN = 'removeSerieButtonHoverIn',
  REMOVE_SERIE_BUTTON_HOVER_OUT = 'removeSerieButtonHoverOut',
  REMOVE_SERIE_BUTTON_CLICK = 'removeSerieButtonClick',
  REMOVE_SERIE_BUTTON_RIGHT_CLICK = 'removeSerieButtonRightClick',
}

/**
 * Enumeration of all possible event target types.
 * Event target type.
 */
export enum TargetType {
  CHART = 'chart',
  LEGEND = 'legend',
  LEGEND_ENTRY = 'legendEntry',
  LEGEND_SCROLL_BUTTON = 'legendScrollButton',
  SERIE = 'serie',
  CATEGORY = 'category',
  DATUM = 'datum',
  ANNOTATION = 'annotation',
  TOOLTIP = 'tooltip',
  ACTIONS_MENU_ENTRY = 'actionsMenuEntry',
  REMOVE_SERIE_BUTTON = 'removeSerieButton',
}

/**
 * Enumeration of all possible event operation types.
 * Event operation type.
 */
export enum OperationType {
  // Note that we camel-case in such a way that makes it possible to concatenate
  // an OperationType to a TargetType and get a valid EventType.
  HOVER_IN = 'HoverIn',
  HOVER_OUT = 'HoverOut',
  MOUSE_UP = 'MouseUp',
  MOUSE_DOWN = 'MouseDown',
  CLICK = 'Click',
  RIGHT_CLICK = 'RightClick',
  DBL_CLICK = 'DblClick',
  SCROLL = 'Scroll',
  DRAG_START = 'DragStart',
  DRAG = 'Drag',
  DRAG_END = 'DragEnd',
}

/**
 * Generate an interaction event type from its target and operation components.
 * @param targetType The target type.
 * @param operationType The operation type.
 * @return The interaction event type.
 */
export function generateEventType(
  targetType: TargetType,
  operationType: OperationType,
): EventType {
  return (targetType + operationType) as EventType;
}
