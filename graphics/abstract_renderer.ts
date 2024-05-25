/**
 * @fileoverview This file provides the AbstractRenderer class which contain all
 * the common functionality which all renderers share.
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
import * as dom from '@npm//@closure/dom/dom';
import {EventType} from '@npm//@closure/events/eventtype';
import {Box} from '@npm//@closure/math/box';
import * as googMath from '@npm//@closure/math/math';
import {Size} from '@npm//@closure/math/size';
import * as googObject from '@npm//@closure/object/object';
import {Tooltip} from '@npm//@closure/ui/tooltip';

import {
  ArcData,
  CurveData,
  PathSegments,
  PointData,
  Segment,
  SegmentType,
} from '../graphics/path_segments';

import {memoize} from '../common/cache/memoize';
import * as utilDom from '../dom/dom';

import {TextAlign} from '../text/text_align';
import {TextStyle} from '../text/text_style';
import {Brush} from './brush';
import {DrawingGroup} from './drawing_group';
import * as logicalname from './logicalname';

// tslint:disable:ban-types Migration

/**
 * AbstractRenderer class contain all
 * the common functionality which all renderers share.
 */
export abstract class AbstractRenderer extends Disposable {
  /**
   * Constant prefix for the renderers' ids.
   */
  static readonly ID_PREFIX: string = '_ABSTRACT_RENDERER_ID_';

  /**
   * The main canvas group under which everything is drawn.
   * .
   */
  protected mainCanvasGroup: DrawingGroup | null = null;
  getTextSize: (text: string, textStyle: TextStyle, rotation?: number) => Size;

  /**
   * The size of any present scroll bars, or null if it hasn't been
   * calculated.
   */
  protected scrollBarSize: number | null = null;

  /**
   * Width of the drawing area.
   */
  protected width = 0;

  /**
   * Height of the drawing area.
   */
  protected height = 0;

  /**
   * Constructs a new AbstractRenderer.
   * @param container The renderer's container.
   * @param textMeasurementDiv A div used for measuring text size.
   */
  constructor(
    protected container: Element,
    protected textMeasurementDiv: Element,
  ) {
    super();

    const memoizeOptions = {
      /*
       * We need to pass a different serialization function so that the
       * serialization of the textStyle would be done correctly. We may simply
       * use gviz.json.stringify over the function's unique id and the
       * arguments.
       */
      serializer(functionUid: AnyDuringMigration, args: AnyDuringMigration) {
        // Optimized code for creating a flat object signature.
        const signatureTokens = [functionUid, args[0]];
        googObject.forEach(args[1], (key, value) => {
          signatureTokens.push(key);
          signatureTokens.push(value);
        });
        signatureTokens.push(+args[2]);
        return 'getTextSize_' + signatureTokens.join('_');
      },
    };

    /**
     * A cached version of the getTextSizeInternal function.
     */
    this.getTextSize = memoize(
      (text: string, textStyle: TextStyle, rotation?: number) => {
        // AnyDuringMigration because:  Argument of type 'TArgs[2]' is
        // not assignable to parameter of type 'number | undefined'.
        return this.getTextSizeInternal(text, textStyle, rotation);
      },
      memoizeOptions,
    );
  }

  /**
   * Supplies a new unique id for a new element.
   * @return The id for the new element.
   */
  protected static newUniqueId(): string {
    const global = utilDom.getGlobal();
    global[ELEMENTS_COUNTER_NAME] = global[ELEMENTS_COUNTER_NAME] || 0;
    const id = `${AbstractRenderer.ID_PREFIX}${global[ELEMENTS_COUNTER_NAME]}`;
    global[ELEMENTS_COUNTER_NAME] = Number(global[ELEMENTS_COUNTER_NAME]) + 1;
    return id;
  }

  /**
   * Create the main rendering area by calling createCanvas_ of the implementing
   * class - this has to be called before drawing any element.
   * Once the group is returned, add a default logical name to it to avoid the
   * search for logical name to continue further.
   *
   * @param width Width in pixels of the chart.
   * @param height Height in pixels of the chart.
   *
   * @return The topmost created group.
   */
  createCanvas(width: number, height: number): DrawingGroup {
    const mainCanvasGroup = this.createCanvasInternal(width, height);
    mainCanvasGroup.setLogicalName(logicalname.DEFAULT_NAME);
    this.mainCanvasGroup = mainCanvasGroup;
    return mainCanvasGroup;
  }

  /**
   * If created, return the main canvas. Otherwise return null.
   * @return The topmost group.
   */
  getCanvas(): DrawingGroup | null {
    return this.mainCanvasGroup;
  }

  /**
   * Create the main rendering area (group).
   *
   * @param width Width in pixels of the chart.
   * @param height Height in pixels of the chart.
   *
   * @return The topmost created group.
   */
  abstract createCanvasInternal(width: number, height: number): DrawingGroup;

  /**
   * Removes all elements in the current canvas. Similar to clear() except it
   * does not delete the container itself. clear() presumes that we are going to
   * make a new container. Removing this assumption is useful for tasks like a
   * redraw where the container is needed to keep events attached.
   *
   * @param markForFlush Whether we're marking for flush (true) or
   *     deleting immediately.
   */
  deleteContents(markForFlush?: boolean) {
    this.deleteContentsInternal(markForFlush);
  }

  abstract deleteContentsInternal(markForFlush?: boolean): void;

  /**
   * Usually a no-op, but some platforms may need to perform a flush.
   * A flush will clear any elements / shapes cleared using
   * deleteContents(markForFlush=true).
   */
  flush() {}

  /**
   * Remove all drawing elements from document.
   */
  clear() {
    this.clearInternal();
  }

  /**
   * Remove all drawing elements from document.
   */
  protected clearInternal() {
    this.mainCanvasGroup = null;
  }

  override disposeInternal() {
    this.clearInternal();
    super.disposeInternal();
  }

  /**
   * Returns the container in which the renderer exists.
   * @return The container of this renderer.
   */
  getContainer(): Element {
    return this.container;
  }

  /**
   * Setting the logical name of an element or a drawing group.
   * @param elementOrGroup The element/group
   *     to add the logical name to.
   * @param name The logical name to add.
   */
  setLogicalName(elementOrGroup: Element | DrawingGroup, name: string) {
    if (!elementOrGroup) {
      return;
    }
    if (elementOrGroup instanceof DrawingGroup) {
      const group = elementOrGroup;
      group.setLogicalName(name);
    } else {
      const element = elementOrGroup;
      logicalname.setLogicalName(element, name);
    }
  }

  /**
   * Getting the logical name of an element.
   * See logicalname.getLogicalName for more details.
   * @param element The element to find the logical name for.
   * @return The matching logical name.
   */
  getLogicalName(element: Element): string {
    return logicalname.getLogicalName(element);
  }

  /**
   * Appends an element as the last child of a given parent.
   * If the element is a drawing group that is created lazily, it will not be
   * added unless it was used prior to the call to this method.
   *
   * @param parent The parent group.
   * @param child The new element to be
   *     appended to the parent.
   */
  appendChild(parent: DrawingGroup, child: Element | null | DrawingGroup) {
    if (!child) {
      return;
    }
    let childElement;
    if (child instanceof DrawingGroup) {
      const group = child;
      if (!group.isElementCreated()) {
        return;
      }
      childElement = group.getElement();
    } else {
      childElement = child;
    }
    const parentElement = parent.getElement();
    parentElement.appendChild(childElement);
    this.didAppendChild(
      (parentElement as AnyDuringMigration)['uid'],
      (childElement as AnyDuringMigration)['uid'],
    );
  }

  /**
   * Abstract method notifying the receiver that a child got appended to a
   * parent. The arguments are the native-assigned unique IDs of the elements.
   *
   * @param parentID The uid of the parent element.
   * @param childID The uid of the child element.
   */
  didAppendChild(parentID: string, childID: string): void {
    parentID = parentID;
    childID = childID;
  }

  /**
   * Removes an element from its parent, also removing all children
   * @param element The element to remove
   *
   */
  removeFromParent(element: Node | DrawingGroup) {
    // if we're passed a DrawingGroup, get the actual element instead.
    if (element instanceof DrawingGroup) {
      element = element.getElement();
    }
    while (element.firstChild) {
      this.removeFromParent(element.firstChild);
    }
    const parent = element.parentElement;
    const removedElement = parent!.removeChild(element);
    if (removedElement === element) {
      this.didRemove(
        (parent as AnyDuringMigration)['uid'],
        (element as AnyDuringMigration)['uid'],
      );
    }
  }

  /**
   * Abstract method notifying receiver that a child got removed from a parent.
   * The arguments are the native-assigned unique IDs of the elements.
   *
   * @param parentID The uid of the parent element.
   * @param childID The uid of the child element.
   */
  didRemove(parentID: string, childID: string): void {
    parentID = parentID;
    childID = childID;
  }

  /**
   * Replaces an element with a new one for a given parent.
   * The new element takes the same location as the old one, thus keeping the
   * order of children for this parent.
   * If the old element is not a child of the given parent, a DOM exception is
   * thrown (NOT_FOUND_ERR).
   *
   * @param parent The parent group.
   * @param newChild The element which will replace the old one.
   * @param oldChild The element to be replaced.
   */
  replaceChild(parent: DrawingGroup, newChild: Element, oldChild: Element) {
    const parentElement = parent.getElement();
    if (dom.getParentElement(oldChild) !== parentElement) {
      // This shouldn't happen, but work around it for now.  b/18337664
      this.removeFromParent(oldChild);
      parentElement.appendChild(newChild);
      asserts.fail('oldChild should be a child of parent.');
    } else {
      parentElement.replaceChild(newChild, oldChild);
      this.didReplaceChild(
        (parentElement as AnyDuringMigration)['uid'],
        (newChild as AnyDuringMigration)['uid'],
        (oldChild as AnyDuringMigration)['uid'],
      );
    }
  }

  /**
   * Abstract method notifying the receiver that one child replaced
   * another under the specified parent.
   * The arguments are the native-assigned unique IDs of the elements.
   *
   * @param parentID The uid of the parent element.
   * @param newChildID The uid of the new child element.
   * @param replacedChildID The uid of the child element being
   *     replaced.
   */
  didReplaceChild(
    parentID: string,
    newChildID: string,
    replacedChildID: string,
  ): void {
    parentID = parentID;
    newChildID = newChildID;
    replacedChildID = replacedChildID;
  }

  /**
   * Remove all children of a given element.
   */
  abstract removeChildrenFromElement(element: Element): void;

  /**
   * Remove all children of a given drawing group.
   *
   * @param group The drawing group whose children
   *     we remove.
   */
  removeChildren(group: DrawingGroup) {
    if (group.isElementCreated()) {
      this.removeChildrenFromElement(group.getElement());
      this.didRemoveChildren((group.getElement() as AnyDuringMigration)['uid']);
    }
  }

  /**
   * @param element The element to remove.
   */
  abstract removeElement(element: Element): void;

  /**
   * Abstract method notifying the receiver that all of a parent's elements
   * got deleted.
   * The arguments are the native-assigned unique IDs of the elements.
   *
   * @param parent The uid of the parent element.
   */
  didRemoveChildren(parent: string): void {
    parent = parent;
  }

  /**
   * Create an empty group of drawing elements.
   *
   * @param allowLazy If true, the drawing group will create the
   *     DOM group element only when elements are drawn into it (lazily).
   * Default is false.
   * @return The created group.
   */
  createGroup(allowLazy?: boolean): DrawingGroup {
    allowLazy = allowLazy != null ? allowLazy : false;
    const drawingGroup = new DrawingGroup(this.createGroupInternal.bind(this));
    if (!allowLazy) {
      // Calling getElement just to force the creation of the drawing group.
      drawingGroup.getElement();
    }
    return drawingGroup;
  }

  abstract createGroupInternal(): Element;

  /**
   * Describe the future clip area. This is only required for the canvas
   * renderer.
   *
   * @param rect The clipping rectangle. All drawing elements
   *     that will be added to the group will be clipped by this rectangle. That
   *     is, part overflowing from this rectangle will no be shown. Its
   *     coordinates are absolute with respect to the whole drawing frame.
   */
  describeClipRegion(rect: googMath.Rect | null): void {
    rect = rect;
  }

  /**
   * Get the clip region.
   *
   * @return rect The clipping rectangle. All drawing elements
   *     that will be added to the group will be clipped by this rectangle. That
   *     is, part overflowing from this rectangle will no be shown. Its
   *     coordinates are absolute with respect to the whole drawing frame.
   */
  clipRegion(): googMath.Rect | null {
    return null;
  }

  /**
   * Temporarily disable clipping.
   * @return rect The previous clipping rectangle.
   */
  disableClipping(): googMath.Rect | null {
    return null;
  }

  abstract clipGroup(
    group: DrawingGroup,
    clipRect: googMath.Rect,
    ellipseClipping?: boolean,
  ): Element;

  abstract setOffset(element: Element, dx: number, dy: number): void;

  abstract setWidth(element: Element, width: number): void;

  abstract setHeight(element: Element, height: number): void;

  abstract setLeftPosition(element: Element, left: number): void;

  abstract setTopPosition(element: Element, top: number): void;

  abstract addPathMove(path: string[], x: number, y: number): void;

  /**
   * @param y
   */
  abstract addPathLine(path: string[], x: number, y: number): void;

  /**
   * @param x1 The x coordinate of the curve's origin.
   * @param y1 The y coordinate of the curve's origin.
   * @param x2 The x coordinate of the curve's end point.
   * @param y2 The y coordinate of the curve's end point.
   */
  abstract addPathCurve(
    path: string[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): void;

  abstract addPathClose(path: string[]): void;

  /**
   * @param cx The x coordinate of the center.
   * @param cy The y coordinate of the center.
   * @param rx The radius of the x-axis.
   * @param ry The radius of the y-axis.
   */
  abstract addPathArc(
    path: string[],
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    fromAngle: number,
    toAngle: number,
    isClockwise: boolean,
  ): void;

  /**
   * Create a circle element.
   *
   * @param cx The x coordinate of the center.
   * @param cy The y coordinate of the center.
   * @param r The radius.
   * @param brush The brush.
   * @return The created element.
   */
  abstract createCircle(
    cx: number,
    cy: number,
    r: number,
    brush: Brush,
  ): Element;

  /**
   * Create an ellipse element.
   *
   * @param cx The x coordinate of the center.
   * @param cy The y coordinate of the center.
   * @param rx The radius of the x-axis.
   * @param ry The radius of the y-axis.
   * @param brush The brush.
   * @return The created element.
   */
  abstract createEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    brush: Brush,
  ): Element;

  /**
   * Create a rectangle element.
   *
   * @param x The x coordinate (left).
   * @param y The y coordinate (top).
   * @param width The width of rectangle.
   * @param height The height of rectangle.
   * @param brush The brush.
   * @return The created element.
   */
  abstract createRect(
    x: number,
    y: number,
    width: number,
    height: number,
    brush: Brush,
  ): Element;

  /**
   * Creates a scrollable area.
   *
   * @param elems The element or elements to put in the scrollable container.
   * @param viewWidth The width of view box.
   * @param viewHeight The height of view box.
   * @param scrollWidth The width of scroll area.
   * @param scrollHeight The height of scroll area.
   * @param scrollX Should the element scroll in the x direction?
   * @param scrollY Should the element scroll in the y direction?
   * @return An object
   *   describing what needs to be done now. Elements in the append property
   * will need to be put into the visualization by the caller; elements in the
   * events property will need to have events added to them, because the event
   * is not a child of the main canvas, but a sibling.
   */
  abstract makeElementScrollable(
    elems: DrawingGroup | DrawingGroup[],
    viewWidth: number,
    viewHeight: number,
    scrollWidth: number,
    scrollHeight: number,
    scrollX: boolean,
    scrollY: boolean,
  ): {append: Element[]; events: Element[]};

  /**
   * Creates a line element (which is actually a path).
   *
   * @param x1 The x coordinate of the line's origin.
   * @param y1 The y coordinate of the line's origin.
   * @param x2 The x coordinate of the line's end point.
   * @param y2 The y coordinate of the line's end point.
   * @param brush The brush.
   * @return The drawn element.
   */
  createLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    brush: Brush,
  ): Element {
    const pathSegments = new PathSegments();
    pathSegments.move(x1, y1);
    pathSegments.addLine(x2, y2);
    return this.createPath(pathSegments, brush);
  }

  abstract createPathInternal(
    pathSegments: string[],
    brush: Brush,
    relativeUrl?: boolean,
  ): Element;

  /**
   * Creates a path element from an object of path segments.
   * The path segments should be added to the path through calls to PathSegments
   * API.
   *
   * @param pathSegments The path segments.
   * @param brush The brush to use for the path.
   * @param relativeUrl Whether use relative url for svg's fill attribute.
   * @return The created element.
   */
  createPath(
    pathSegments: PathSegments,
    brush: Brush,
    relativeUrl?: boolean,
  ): Element {
    // Convert the path segments to a platform dependent path.
    const path = this.buildPath(pathSegments);

    // Create a DOM element for the specified path.
    return this.createPathInternal(path, brush, relativeUrl);
  }

  abstract createText(
    text: string,
    x: number,
    y: number,
    width: number,
    horizAlign: TextAlign,
    vertAlign: TextAlign,
    textStyle: TextStyle,
    rtl?: boolean,
  ): Element;

  /**
   * Create multiline text. Lines are broken up via newline characters in the
   * text parameter.
   * @param text The text to draw.
   * @param x X coordinate (left).
   * @param y Y coordinate (top).
   * @param width Width of rectangle.
   * @param horizAlign Horizontal alignment.
   * @param vertAlign Vertical alignment.
   * @param textStyle The text style.
   * @param spacing The distance between lines.
   * @param rtl Whether the text is right-to-left.
   * @return The created elements.
   */
  createMultilineText(
    text: string,
    x: number,
    y: number,
    width: number,
    horizAlign: TextAlign,
    vertAlign: TextAlign,
    textStyle: TextStyle,
    spacing: number,
    rtl?: boolean,
  ): Element[] {
    const parts = text.split('\n');
    const elems = [];
    for (let i = 0, leni = parts.length; i < leni; i++) {
      elems.push(
        this.createText(
          parts[i],
          x,
          y,
          width,
          horizAlign,
          vertAlign,
          textStyle,
          rtl,
        ),
      );
      y += spacing;
    }
    return elems;
  }

  /**
   * Create sloped multiline text. Lines are broken up via newline characters in
   * the text parameter and the angle is specified in degrees.
   * @param text The text to draw.
   * @param x X coordinate (left).
   * @param y Y coordinate (top).
   * @param width Width of the rectangle (where to horizontally align
   *     the text).
   * @param angle The angle of the text in degrees.
   * @param parallelAlign Parallel alignment.
   * @param perpendicularAlign Perpendicular alignment.
   * @param textStyle The text style.
   * @param spacing The line height.
   * @param rtl Whether the text is right-to-left.
   * @return The created elements
   */
  createMultilineTextOnLineByAngle(
    text: string,
    x: number,
    y: number,
    width: number,
    angle: number,
    parallelAlign: TextAlign,
    perpendicularAlign: TextAlign,
    textStyle: TextStyle,
    spacing: number,
    rtl?: boolean,
  ): Element[] {
    const parts = text.split('\n');
    const elems = [];
    const degAngle = angle;
    angle = googMath.toRadians(angle + 90);
    if (perpendicularAlign === TextAlign.CENTER) {
      x -= (Math.cos(angle) * spacing * parts.length) / 2;
      y -= (Math.sin(angle) * spacing * parts.length) / 2;
    } else if (perpendicularAlign === TextAlign.END) {
      x -= Math.cos(angle) * spacing * parts.length;
      y -= Math.sin(angle) * spacing * parts.length;
    }

    for (let i = 0, leni = parts.length; i < leni; i++) {
      elems.push(
        this.createTextOnLineByAngle(
          parts[i],
          x,
          y,
          width,
          degAngle,
          parallelAlign,
          TextAlign.START,
          textStyle,
          rtl,
        ),
      );
      x += Math.cos(angle) * spacing;
      y += Math.sin(angle) * spacing;
    }
    return elems;
  }

  abstract createTextOnLine(
    text: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    rtl?: boolean,
  ): Element;

  abstract createTextOnLineByAngle(
    text: string,
    x: number,
    y: number,
    length: number,
    angle: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    rtl?: boolean,
  ): Element;

  /**
   * Creates a circle element (see createCircle above) and puts it in a drawing
   * group.
   *
   * @param cx The x coordinate of the center.
   * @param cy The y coordinate of the center.
   * @param r The radius.
   * @param brush The brush.
   * @param group The group to draw into.
   * @return The drawn element.
   */
  drawCircle(
    cx: number,
    cy: number,
    r: number,
    brush: Brush,
    group: DrawingGroup,
  ): Element {
    const circle = this.createCircle(cx, cy, r, brush);
    this.appendChild(group, circle);
    return circle;
  }

  /**
   * Creates a ellipse element (see createEllipse above) and puts it in a
   * drawing group.
   *
   * @param cx The x coordinate of the center.
   * @param cy The y coordinate of the center.
   * @param rx The radius of the x-axis.
   * @param ry The radius of the y-axis.
   * @param brush The brush.
   * @param group The group to draw into.
   * @return The drawn element.
   */
  drawEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    brush: Brush,
    group: DrawingGroup,
  ): Element {
    const ellipse = this.createEllipse(cx, cy, rx, ry, brush);
    this.appendChild(group, ellipse);
    return ellipse;
  }

  /**
   * Creates a rectangle element (see createRect above) and puts it in a drawing
   * group.
   *
   * @param x The x coordinate (left).
   * @param y The y coordinate (top).
   * @param width The width of rectangle.
   * @param height The height of rectangle.
   * @param brush The brush.
   * @param group The group to draw into.
   * @return The drawn element.
   */
  drawRect(
    x: number,
    y: number,
    width: number,
    height: number,
    brush: Brush,
    group: DrawingGroup,
  ): Element {
    const rect = this.createRect(x, y, width, height, brush);
    this.appendChild(group, rect);
    return rect;
  }

  /**
   * Creates a line element (which is actually a path) and puts it in a drawing
   * group.
   *
   * @param x1 The x coordinate of the line's origin.
   * @param y1 The y coordinate of the line's origin.
   * @param x2 The x coordinate of the line's end point.
   * @param y2 The y coordinate of the line's end point.
   * @param brush The brush.
   * @param group The group to draw into.
   * @return The drawn element.
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    brush: Brush,
    group: DrawingGroup,
  ): Element {
    const line = this.createLine(x1, y1, x2, y2, brush);
    this.appendChild(group, line);
    return line;
  }

  /**
   * Creates a path element (see createPath above) and puts it in a drawing
   * group.
   *
   * @param pathSegments The path segments.
   * @param brush The brush to use for the path.
   * @param group The group to draw into.
   * @param relativeUrl Whether use relative url for svg's fill attribute.
   * @return The drawn element.
   */
  drawPath(
    pathSegments: PathSegments,
    brush: Brush,
    group: DrawingGroup,
    relativeUrl?: boolean,
  ): Element {
    const path = this.createPath(pathSegments, brush, relativeUrl);
    this.appendChild(group, path);
    return path;
  }

  /**
   * Creates a text element (see createText above) and puts it in a drawing
   * group.
   *
   * @param text The text to draw.
   * @param x The x coordinate (left).
   * @param y The y coordinate (top).
   * @param width The width of rectangle.
   * @param horizAlign Horizontal alignment.
   * @param vertAlign Vertical alignment.
   * @param textStyle The text style.
   * @param group The group to draw into.
   * @param rtl Whether the text is right-to-left.
   * @return The drawn element.
   */
  drawText(
    text: string,
    x: number,
    y: number,
    width: number,
    horizAlign: TextAlign,
    vertAlign: TextAlign,
    textStyle: TextStyle,
    group: DrawingGroup,
    rtl?: boolean,
  ): Element {
    const textElement = this.createText(
      text,
      x,
      y,
      width,
      horizAlign,
      vertAlign,
      textStyle,
      rtl,
    );
    this.appendChild(group, textElement);
    return textElement;
  }

  /**
   * Creates a text element (see createTextOnLine above) and puts it in a
   * drawing group.
   *
   * @param text The text to draw.
   * @param x1 X coordinate of start of line.
   * @param y1 Y coordinate of start of line.
   * @param x2 X coordinate of end of line.
   * @param y2 Y coordinate of end of line.
   * @param paralAlign Line parallel alignment.
   * @param perpenAlign Line perpendicular alignment.
   * @param textStyle The text style.
   * @param group The group to draw into.
   * @param rtl Whether the text is right-to-left.
   * @return The drawn element.
   */
  drawTextOnLine(
    text: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    group: DrawingGroup,
    rtl?: boolean,
  ): Element {
    const textElement = this.createTextOnLine(
      text,
      x1,
      y1,
      x2,
      y2,
      paralAlign,
      perpenAlign,
      textStyle,
      rtl,
    );
    this.appendChild(group, textElement);
    return textElement;
  }

  /**
   * Creates a text element (see createTextOnLineByAngle above) and puts it in a
   * drawing group.
   *
   * @param text The text to draw.
   * @param x X coordinate of start of line.
   * @param y Y coordinate of start of line.
   * @param length Length of line.
   * @param angle Angle (degrees) of line.
   * @param paralAlign Line parallel alignment.
   * @param perpenAlign Line perpendicular alignment.
   * @param textStyle The text style.
   * @param group The group to draw into.
   * @param rtl Whether the text is right-to-left.
   * @return The drawn element.
   */
  drawTextOnLineByAngle(
    text: string,
    x: number,
    y: number,
    length: number,
    angle: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    group: DrawingGroup,
    rtl?: boolean,
  ): Element {
    const textElement = this.createTextOnLineByAngle(
      text,
      x,
      y,
      length,
      angle,
      paralAlign,
      perpenAlign,
      textStyle,
      rtl,
    );
    this.appendChild(group, textElement);
    return textElement;
  }

  /**
   * Measure and return the width (in pixels) of a given text string.
   * @see getTextSize.
   *
   * @param text The text string to measure.
   * @param textStyle The text style.
   *
   * @return The width in pixels of the text strings.
   *
   */
  getTextWidth(text: string, textStyle: TextStyle): number {
    return this.getTextSize(text, textStyle).width;
  }

  /**
   * Measure and return the height (in pixels) of a given text string.
   * @see getTextSize.
   *
   * @param text The text string to measure.
   * @param textStyle The text style.
   *
   * @return The height in pixels of the text strings.
   *
   */
  getTextHeight(text: string, textStyle: TextStyle): number {
    return this.getTextSize(text, textStyle).height;
  }

  /**
   * @param text The text to measure.
   * @param textStyle The text style.
   */
  abstract getTextSizeInternal(
    text: string,
    textStyle: TextStyle,
    rotation?: number,
  ): Size;

  /**
   * Measures multiline text. Lines are broken up via newline characters in the
   * text parameter.
   * @param text The text to measure.
   * @param textStyle The text style.
   * @param spacing The spacing between lines. 0 by default.
   * @return The size of the multiline text.
   */
  getMultilineTextSize(
    text: string,
    textStyle: TextStyle,
    spacing?: number,
  ): Size {
    spacing = spacing || 0;
    const parts = text.split('\n');
    let width = 0;
    let height = 0;
    for (let i = 0, leni = parts.length; i < leni; i++) {
      const partSize = this.getTextSize(parts[i], textStyle);
      width = Math.max(width, partSize.width);
      height += partSize.height;
      if (i > 0) {
        height += spacing;
      }
    }
    return new Size(width, height);
  }

  /**
   * Measure and return the width (in pixels) of a given text string.
   * @see getTextSize.
   *
   * @param text The text string to measure.
   * @param textStyle The text style.
   * @param spacing The spacing between lines. 0 by default.
   *
   * @return The width in pixels of the text strings.
   *
   */
  getMultilineTextWidth(
    text: string,
    textStyle: TextStyle,
    spacing?: number,
  ): number {
    return this.getMultilineTextSize(text, textStyle, spacing).width;
  }

  /**
   * Measure and return the height (in pixels) of a given text string.
   * @see getTextSize.
   *
   * @param text The text string to measure.
   * @param textStyle The text style.
   * @param spacing The spacing between lines. 0 by default.
   *
   * @return The height in pixels of the text strings.
   *
   */
  getMultilineTextHeight(
    text: string,
    textStyle: TextStyle,
    spacing?: number,
  ): number {
    return this.getMultilineTextSize(text, textStyle, spacing).height;
  }

  abstract getScrollbarSize(): number;

  /**
   * Returns true iff the renderer is slow (i.e., uses VML for rendering).
   * Note: It is always better to draw the same on all renderers (and use the
   * abstraction provided by the rendering mechanism). Use this function only
   * when you really want to behave differently (e.g., due to performance issues
   * in VML).
   *
   * @return True iff the renderer is slow (i.e., uses VML).
   */
  isSlowRenderer(): boolean {
    return false;
  }

  /**
   * Adds a given segment to a given platform dependent path.
   *
   * @param path The path.
   * @param segment The segment to add.
   */
  private addSegmentToPath(path: string[], segment: Segment) {
    // Add the segment to the path according to the type of the segment.
    switch (segment.type) {
      case SegmentType.MOVE: {
        const pos = segment.data as PointData;
        this.addPathMove(path, pos.x, pos.y);
        break;
      }

      case SegmentType.LINE: {
        const pos = segment.data as PointData;
        this.addPathLine(path, pos.x, pos.y);
        break;
      }

      case SegmentType.CURVE:
        asserts.assert(segment.data != null);
        const curve = segment.data as unknown as CurveData;
        this.addPathCurve(
          path,
          curve.x1,
          curve.y1,
          curve.x2,
          curve.y2,
          curve.x,
          curve.y,
        );
        break;

      case SegmentType.ARC:
        asserts.assert(segment.data != null);
        const arc = segment.data as unknown as ArcData;
        this.addPathArc(
          path,
          arc.cx,
          arc.cy,
          arc.rx,
          arc.ry,
          arc.fromAngle,
          arc.toAngle,
          arc.isClockwise,
        );
        break;

      case SegmentType.CLOSE:
        this.addPathClose(path);
        break;

      default:
        throw new Error(`Unexpected segment.type ${segment.type}.`);
    }
  }

  /**
   * Builds a platform dependent path for given path segments.
   *
   * @param pathSegments The path segments.
   * @return The platform dependent path to draw.
   */
  private buildPath(pathSegments: PathSegments): string[] {
    const path: AnyDuringMigration[] = [];
    for (let i = 0; i < pathSegments.segments.length; i++) {
      const segment = pathSegments.segments[i];

      // Add the segment to the path.
      this.addSegmentToPath(path, segment);
    }

    return path;
  }

  abstract getBoundingBox(element: Element): Box | null;

  abstract addTooltip(
    element: Element,
    text: string,
    cssStyle: string | AnyDuringMigration,
  ): Tooltip;

  abstract setBrush(
    element: Element,
    brush: Brush,
    allowImplicitOutline?: boolean,
    relativeUrl?: boolean,
  ): void;

  /**
   * Attach an event handler function to an element. If an event handler was
   * previously set for this element and this event type, the previous event
   * handler will be replaced by this one. Only implemented on the browser
   * renderer.
   *
   * @param element A drawing object.
   * @param eventType The event type.
   * @param listener Callback function for when the event occurs.
   */
  setEventHandler(
    element: EventTarget | DrawingGroup,
    eventType: EventType,
    listener: Function,
  ): void {
    element = element;
    eventType = eventType;
    listener = listener;
  }

  /**
   * Flushes all rendering commands.
   *
   * Really only useful for the mobile renderer. To minimize the number of times
   * we cross the JS-native bridge, we queue up all rendering commands, and send
   * them in batch to the native code. This queue should be cleared when drawing
   * is complete.
   */
  flushRenderingCommands(): void {}

  /**
   * Return an Element which can contain an HTML Table with the data for
   * screen readers.  Return null if unsupported by the renderer.
   */
  createAccessibilityContainer(): Element | null {
    return null;
  }
}

/**
 * Counter for the elements' ids so we would not have the same id twice.
 * The counter is saved under global so that all renderer instances, even
 * across packages, will share it.
 */
const ELEMENTS_COUNTER_NAME =
  '__googleVisualizationAbstractRendererElementsCount__';
