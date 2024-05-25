/**
 * @fileoverview This file provides functions to get the cursor position
 * relative to the container the user draws the chart in.
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
import * as dom from '@npm//@closure/dom/dom';
import {BrowserEvent} from '@npm//@closure/events/browserevent';
import {Coordinate} from '@npm//@closure/math/coordinate';
import * as style from '@npm//@closure/style/style';

// tslint:disable:ban-types  Migration

/**
 * The attribute we use to denote that the element is a reference point for
 * cursor position calculations.
 */
export const REFERENCE_POINT_ATTRIBUTE: symbol = Symbol('referencepoint');

/**
 * Mark an element as a reference point for cursor position calculations.
 * @param element The element to mark as a reference point.
 */
export function setReferencePoint(element: Element | null) {
  if (element) {
    (element as AnyDuringMigration)[REFERENCE_POINT_ATTRIBUTE] = true;
  }
}

/**
 * Returns the reference point of an element.
 * @param element The element whose reference point we want.
 * @return The reference point.
 */
export function getReferencePoint(
  element: Element | null | Node,
): Element | null {
  return dom.getAncestor(
    element,
    (element) => {
      return (element as AnyDuringMigration)[REFERENCE_POINT_ATTRIBUTE];
    },
    true,
  ) as Element;
}

/**
 * Returns the cursor position given an event, relative to the reference point
 * of its target element.
 *
 * @param event The event.
 * @return The cursor position at this event.
 */
export function getCursorPosition(event: BrowserEvent): Coordinate {
  const referencePoint = getReferencePoint(event.target);
  asserts.assert(referencePoint != null);
  return style.getRelativePosition(event, referencePoint);
}
