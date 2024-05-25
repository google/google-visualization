/**
 * @fileoverview This file provides the drawing group class that is a wrapper to
 * a SVG/VML group element. The wrapper allows to create the group element
 * lazily.
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

import * as logicalname from './logicalname';

/**
 * Constructor for a drawing group.
 * Does not actually create the DOM group.
 * @unrestricted
 */
export class DrawingGroup {
  private readonly createGroup: (() => Element) | null;
  private element: Element | null;

  /**
   * Logical name for this group or null.
   * If the group element was already created, it is possible its real logical
   * name may have been set directly. The method getLogicalName however will
   * anyway return the correct value.
   */
  private logicalName: string | null = null;

  /**
   * @param elementOrCreateGroupFunc An already created DOM group element
   *     or a function that creates an SVG/VML group.
   */
  constructor(elementOrCreateGroupFunc: Element | (() => Element)) {
    let createGroup = null;
    let element = null;
    if (typeof elementOrCreateGroupFunc === 'function') {
      createGroup = elementOrCreateGroupFunc;
    } else {
      element = elementOrCreateGroupFunc;
    }

    /**
     * A function that creates an SVG/VML group element.
     */
    this.createGroup = createGroup;

    /**
     * The wrapped DOM group element.
     */
    this.element = element;
  }

  /**
   * Sets the logical name. If the element was already created, we also update
   * the logical name on the element.
   * @param name The logical name to set.
   */
  setLogicalName(name: string) {
    this.logicalName = name;
    if (this.isElementCreated()) {
      logicalname.setLogicalName(this.element, name);
    }
  }

  /**
   * Returns the logical name for this group if exists.
   * If the group element was already created, we look there and otherwise look
   * locally in the object.
   * @return The logical name of this group.
   */
  getLogicalName(): string | null {
    if (this.isElementCreated()) {
      return logicalname.getLogicalName(this.element);
    }
    return this.logicalName;
  }

  /**
   * Returns the DOM group element.
   * If the drawing group is accessed for the first time, the DOM group will be
   * created.
   *
   * @return The DOM group element.
   */
  getElement(): Element {
    if (!this.element && this.createGroup) {
      this.element = this.createGroup();
      if (this.logicalName !== null) {
        logicalname.setLogicalName(this.element, this.logicalName);
      }
    }
    if (!this.element) {
      throw new Error('Failed to get element for DrawingGroup.');
    }
    return this.element;
  }

  /**
   * Returns if the DOM group element was created.
   *
   * @return True if the DOM group was already created, false
   *     otherwise.
   */
  isElementCreated(): boolean {
    return !!this.element;
  }
}
