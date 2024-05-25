/**
 * @fileoverview An abstract renderer that assumes it is being rendered in a
 * real browser.
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

import * as googArray from '@npm//@closure/array/array';
import {dispose} from '@npm//@closure/disposable/dispose';
import * as dom from '@npm//@closure/dom/dom';
import {NodeType} from '@npm//@closure/dom/nodetype';
import {TagName} from '@npm//@closure/dom/tagname';
import {BrowserEvent} from '@npm//@closure/events/browserevent';
import {EventHandler} from '@npm//@closure/events/eventhandler';
import * as events from '@npm//@closure/events/events';
import {EventType} from '@npm//@closure/events/eventtype';
import {Box} from '@npm//@closure/math/box';
import {Coordinate} from '@npm//@closure/math/coordinate';
import * as style from '@npm//@closure/style/style';
import {Tooltip} from '@npm//@closure/ui/tooltip';

import {AbstractRenderer} from './abstract_renderer';
import * as cursorposition from './cursor_position';
import {DrawingGroup} from './drawing_group';

// tslint:disable:ban-types  Migration

/**
 * An abstract renderer that assumes it is being rendered in a
 * real browser.
 */
export abstract class BrowserRenderer extends AbstractRenderer {
  /** The DomHelper that will be used for creating and adding elements. */
  protected domHelper: dom.DomHelper;

  /**
   * Document that the chart is created in.
   * The document we work in.
   */
  protected doc: Document;

  /**
   * An array of tooltip objects that were created by this renderer and will
   * be cleared when the canvas is cleared.
   */
  protected tooltips: Tooltip[] = [];

  /**
   * An event handler using which events are registered and later on cleared.
   */
  private eventHandler: EventHandler;

  /**
   * Construct a Browser Renderer.
   * @param container The renderer's container.
   * @param textMeasurementDiv A div used for measuring text size.
   */
  constructor(container: Element, textMeasurementDiv: Element) {
    super(container, textMeasurementDiv);

    this.domHelper = dom.getDomHelper(container);

    this.doc = this.domHelper.getDocument();

    this.eventHandler = new EventHandler();
  }

  addTooltip(
    element: Element,
    text: string,
    cssStyle: string | AnyDuringMigration,
  ): Tooltip {
    const tooltip = new Tooltip(element);
    const elementDiv = this.domHelper.createDom(TagName.DIV);
    const parts = text.split('\n');
    elementDiv.appendChild(this.domHelper.createTextNode(parts[0]));
    for (let i = 1; i < parts.length; ++i) {
      elementDiv.appendChild(this.domHelper.createDom(TagName.BR));
      elementDiv.appendChild(this.domHelper.createTextNode(parts[i]));
    }
    style.setStyle(elementDiv, cssStyle);
    tooltip.getElement()!.appendChild(elementDiv);
    tooltip.setShowDelayMs(100);
    tooltip.setHideDelayMs(100);
    this.tooltips.push(tooltip);
    return tooltip;
  }

  /** Remove all children of a given element. */
  removeChildrenFromElement(element: Element) {
    this.domHelper.removeChildren(element as Node);
  }

  /** @param element The element to remove. */
  removeElement(element: Element) {
    this.domHelper.removeNode(element as Node);
    events.removeAll(element);
  }

  override clear() {
    this.eventHandler.removeAll(); // To keep listener count accurate.
    dispose(this.eventHandler);
    this.eventHandler = new EventHandler();
    super.clear();
  }

  override clearInternal() {
    super.clearInternal();
    this.tooltips.forEach((tooltip) => {
      dispose(tooltip);
    });
    googArray.clear(this.tooltips);
    this.removeChildrenFromElement(this.container);
    this.eventHandler.removeAll(); // To keep listener count accurate.
    dispose(this.eventHandler);
  }

  getBoundingBox(element: Element): Box | null {
    const referencePoint = cursorposition.getReferencePoint(element);
    // referencePoint will be null for some legend items when the legend
    // is more than one page.
    if (referencePoint) {
      const relativePosition = style.getRelativePosition(
        element,
        referencePoint,
      );
      const size = style.getSize(element);
      return new Box(
        relativePosition.y,
        relativePosition.x + size.width,
        relativePosition.y + size.height,
        relativePosition.x,
      );
    }
    return null;
  }

  /**
   * Returns the cursor position given an event, relative to the reference point
   * of its target element.
   *
   * @param event The event.
   * @return The cursor position at this event.
   */
  getCursorPosition(event: BrowserEvent): Coordinate | null {
    // Crawl up the parent list until reaching a parentless element.
    let cur = event.target;
    while (cur!.parentNode) {
      cur = cur!.parentNode;
    }
    // If the parentless element is in the DOM, check it's cursor position.
    // Otherwise, return null.
    return cur!.nodeType === NodeType.DOCUMENT ||
      cur!.nodeType === NodeType.DOCUMENT_FRAGMENT
      ? cursorposition.getCursorPosition(event)
      : null;
  }

  /**
   * @param element A drawing object.
   * @param eventType The event type.
   * @param listener Callback function for when the event occurs.
   *     TODO: The listener type should match type of the listener
   *     argument for this.eventHandler.listen, which is:
   *     {handleEvent: (a?: AnyDuringMigration) => AnyDuringMigration;} |
   *     ((this: AnyDuringMigration, a: AnyDuringMigration) =>
   *     AnyDuringMigration) | null|undefined))
   */
  override setEventHandler(
    element: EventTarget | DrawingGroup,
    eventType: EventType,
    listener: Function,
  ) {
    if (element instanceof DrawingGroup) {
      element = element.getElement();
    }
    this.eventHandler.listen(
      element,
      eventType,
      listener as AnyDuringMigration,
    );
  }

  /**
   * @param parent The parent group.
   * @param newChild The element which will replace the old one.
   * @param oldChild The element to be replaced.
   */
  override replaceChild(
    parent: DrawingGroup,
    newChild: Element,
    oldChild: Element,
  ) {
    super.replaceChild(parent, newChild, oldChild);
    // Remove all events hanged on the old child to avoid a leak.
    // TODO(dlaliberte): Remove events recursively.
    events.removeAll(oldChild);
  }
}
