/**
 * @fileoverview A chart event is an event that is dispatched by the chart and
 * can be handled by the user. This file contains the chart events' names.
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

/**
 * Enumeration of all possible chart event types.
 * Event type.
 */
export enum ChartEventType {
  READY = 'ready',
  ANIMATION_FRAME_FINISH = 'animationframefinish',
  ANIMATION_FINISH = 'animationfinish',
  SELECT = 'select',
  CLICK = 'click',
  RIGHT_CLICK = 'rightclick',
  DBL_CLICK = 'dblclick',
  SCROLL = 'scroll',
  DRAG_START = 'dragstart',
  DRAG = 'drag',
  DRAG_END = 'dragend',
  MOUSE_UP = 'onmouseup',
  MOUSE_DOWN = 'onmousedown',
  MOUSE_OVER = 'onmouseover',
  MOUSE_OUT = 'onmouseout',
  MOUSE_MOVE = 'onmousemove',
  PINCH_START = 'pinchstart',
  PINCH = 'pinch',
  PINCH_END = 'pinchend',
  REMOVE_SERIE = 'removeserie',
  RANGE_CHANGE = 'rangechange',
  ROLL_UP = 'rollup',
  LEGEND_PAGINATION = 'legendpagination',
  DRILL_DOWN = 'drilldown',
  HIGHLIGHT = 'highlight',
  UNHIGHLIGHT = 'unhighlight',
}

/**
 * Enumeration of all possible control event types.
 * Event type.
 */
export enum ControlEventType {
  READY = 'ready',
  ERROR = 'error',
  UI_CHANGE = 'uichange',
  STATE_CHANGE = 'statechange',
}
