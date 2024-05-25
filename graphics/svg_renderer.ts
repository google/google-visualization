/**
 * @fileoverview SVG implementation of gviz.graphics AbstractRenderer.
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
import {NodeType} from '@npm//@closure/dom/nodetype';
import {
  getLogger,
  info,
  Logger,
  warning,
} from '@npm//@closure/log/log';
import {Box} from '@npm//@closure/math/box';
import {Line} from '@npm//@closure/math/line';
import * as googMath from '@npm//@closure/math/math';
import {Size} from '@npm//@closure/math/size';
import {Vec2} from '@npm//@closure/math/vec2';
import {format} from '@npm//@closure/string/stringformat';
import * as googStyle from '@npm//@closure/style/style';
import * as userAgent from '@npm//@closure/useragent/useragent';

import * as commonObject from '../common/object';

import {
  getAbsoluteCoordinates,
  getRelativeCoordinate,
  TextAlign,
} from '../text/text_align';
import {TextStyle} from '../text/text_style';
import {AbstractRenderer} from './abstract_renderer';
import {BrowserRenderer} from './browser_renderer';
import {Brush, Gradient, Shadow} from './brush';
import {DrawingGroup} from './drawing_group';
import {Pattern} from './pattern';
import {PatternStyle, StrokeDashStyle, StrokeDashStyleType} from './types';
import * as util from './util';

const getHash = commonObject.getHash;

// tslint:disable:ban-types  Migration

/**
 * Construct an SVG renderer.
 * We add 0.5 to the x/y position in the paths in order to workaround
 * FF 3.0/Safari bug.
 * @unrestricted
 */
export class SvgRenderer extends BrowserRenderer {
  private readonly logger: Logger | null;

  /** The minimum distance allowed between the endpoints in an SVG arc. */
  static ARC_MIN_DISTANCE = 0.1;

  /**
   * The element holding definitions for some chart aspects, such as
   * gradients, patterns and clipping paths.
   */
  private defs: Element | null = null;

  /**
   * Maps each pattern used in the chart to its definition element.
   * For each unique pattern (unique style and colors) in use, this object
   * holds a single property. The property name is a unique id of the pattern
   * (see this.calcPatternId_). The property value is the id of its SVG
   * definition element (a child of this.defs element). The id is actually
   * the id attribute of the element.
   */
  private patternDefsIds: AnyDuringMigration = {};

  /** A map from hash of previously defined gradients to their ids. */
  private gradientDefsIds: {[key: string]: string} = {};

  /** A map from hash of previously defined shadows to their ids. */
  private shadowDefsIds: {[key: string]: string} = {};

  /** Whether direction of ancestor of container is right-to-left */
  private readonly isRtl: boolean = false;

  override width: AnyDuringMigration;
  override height: AnyDuringMigration;
  override scrollBarSize: AnyDuringMigration;

  /**
   * @param container The renderer's container.
   * @param textMeasurementDiv A div used for measuring text size.
   */
  constructor(container: Element, textMeasurementDiv: Element) {
    super(container, textMeasurementDiv);

    this.logger = getLogger('google.visualization.graphics.SvgRenderer');

    // Workaround for bug in Chrome v31, which has been fixed.
    // https://code.google.com/p/chromium/issues/detail?id=322705
    this.getTextSizeInternal('-._.-*^*-._.-*^*-._.-', {
      fontSize: 8,
      fontName: 'Arial',
      bold: false,
      italic: false,
    } as TextStyle);

    // Crawl up the container hierarchy until we find an element with a dir
    // attr. Start two levels up from the renderer's container, which is above
    // where we add dir='ltr'.
    let ancestor = this.container.parentElement!.parentElement;
    while (ancestor) {
      if (ancestor.getAttribute('dir') != null) {
        this.isRtl = ancestor.getAttribute('dir') === 'rtl';
        break;
      }
      ancestor = ancestor.parentElement;
    }
  }

  /**
   * Reset the caches associated with this svg-renderer.
   * @param chartElement Where to append the defs.
   */
  private resetCaches(chartElement: Element) {
    this.defs = this.createSvgElement('defs');
    const id = AbstractRenderer.newUniqueId();
    this.defs.setAttribute('id', id);
    this.patternDefsIds = {};
    this.gradientDefsIds = {};
    this.shadowDefsIds = {};
    // SVG elements must always contain defs
    chartElement.appendChild(this.defs);
  }

  createCanvasInternal(width: AnyDuringMigration, height: AnyDuringMigration) {
    asserts.assert(!isNaN(width));
    asserts.assert(!isNaN(height));
    asserts.assert(isFinite(width));
    asserts.assert(isFinite(height));
    asserts.assert(width >= 0);
    asserts.assert(height >= 0);

    this.width = width;
    this.height = height;

    const chartElement = this.createSvgElement('svg') as SVGSVGElement;
    chartElement.setAttribute('width', width);
    chartElement.setAttribute('height', height);
    chartElement.style.overflow = 'hidden';

    // By setting a label on the SVG element, screen readers will not see all of
    // the clutter of the chart (unless they choose to).
    // TODO(dlaliberte): provide a way for users to set this label.
    chartElement.setAttribute('aria-label', MSG_A_CHART);

    this.container.appendChild(chartElement);
    this.resetCaches(chartElement);

    return new DrawingGroup(chartElement);
  }

  override getBoundingBox(element: Element) {
    if (
      element instanceof SVGGraphicsElement &&
      element.tagName.toLowerCase() !== 'path' &&
      element.tagName.toLowerCase() !== 'svg'
    ) {
      const bbox = element.getBBox();
      if (!(bbox.y | bbox.x | bbox.height | bbox.width)) {
        return super.getBoundingBox(element);
      }
      return new Box(bbox.y, bbox.x + bbox.width, bbox.y + bbox.height, bbox.x);
    } else {
      return super.getBoundingBox(element);
    }
  }

  deleteContentsInternal() {
    const chartCanvas = this.getCanvas();
    const parent = chartCanvas!.getElement();
    const children = parent.childNodes;
    let numberOfNodes = children.length;
    while (numberOfNodes > 1) {
      parent.removeChild(children[0]);
      numberOfNodes--;
    }
    this.resetCaches(parent);
  }

  /**
   * Returns the internal SVG representation of the renderer elements by
   * returning the inner HTML of the chart area div.
   * @return The inner SVG representation.
   */
  getInternalSvg(): string {
    return this.container.innerHTML;
  }

  /**
   * Round a value (coordinate) according to the rendering engine limits.
   * SVG can handle any number, but to make strings smaller, it is good enough
   * to keep just 2 decimal digits.
   *
   * @param n A coordinate value.
   *
   * @return The rounded value.
   */
  round(n: number): number {
    asserts.assert(!isNaN(n));
    asserts.assert(isFinite(n));

    return Math.round(100 * n) / 100;
  }

  createCircle(
    cx: AnyDuringMigration,
    cy: AnyDuringMigration,
    r: AnyDuringMigration,
    brush: AnyDuringMigration,
  ) {
    asserts.assert(!isNaN(cx));
    asserts.assert(!isNaN(cy));
    asserts.assert(!isNaN(r));
    asserts.assert(isFinite(cx));
    asserts.assert(isFinite(cy));
    asserts.assert(isFinite(r));
    asserts.assert(r >= 0);

    const element = this.createSvgElement('circle');
    element.setAttribute('cx', cx);
    element.setAttribute('cy', cy);
    element.setAttribute('r', r);
    this.setBrush(element, brush);
    return element;
  }

  createEllipse(
    cx: AnyDuringMigration,
    cy: AnyDuringMigration,
    rx: AnyDuringMigration,
    ry: AnyDuringMigration,
    brush: AnyDuringMigration,
  ) {
    asserts.assert(!isNaN(cx));
    asserts.assert(!isNaN(cy));
    asserts.assert(!isNaN(rx));
    asserts.assert(!isNaN(ry));
    asserts.assert(isFinite(cx));
    asserts.assert(isFinite(cy));
    asserts.assert(isFinite(rx));
    asserts.assert(isFinite(ry));
    asserts.assert(rx >= 0);
    asserts.assert(ry >= 0);

    const element = this.createSvgElement('ellipse');
    element.setAttribute('cx', cx);
    element.setAttribute('cy', cy);
    element.setAttribute('rx', rx);
    element.setAttribute('ry', ry);
    this.setBrush(element, brush);
    return element;
  }

  createRect(
    x: AnyDuringMigration,
    y: AnyDuringMigration,
    width: AnyDuringMigration,
    height: AnyDuringMigration,
    brush: AnyDuringMigration,
  ) {
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(!isNaN(width));
    asserts.assert(!isNaN(height));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));
    asserts.assert(isFinite(width));
    asserts.assert(isFinite(height));
    asserts.assert(width >= 0);
    asserts.assert(height >= 0);

    const element = this.createSvgElement('rect');
    element.setAttribute('x', x);
    element.setAttribute('y', y);
    element.setAttribute('width', width);
    element.setAttribute('height', height);
    this.setBrush(element, brush);
    return element;
  }

  /**
   * @suppress {strictMissingProperties} TODO(b/214874268): Remove
   * strictMissingProperties suppression after b/214427036 is fixed
   */
  makeElementScrollable(
    elems: AnyDuringMigration,
    viewWidth: AnyDuringMigration,
    viewHeight: AnyDuringMigration,
    scrollWidth: AnyDuringMigration,
    scrollHeight: AnyDuringMigration,
    scrollX: AnyDuringMigration,
    scrollY: AnyDuringMigration,
  ) {
    // TODO(dlaliberte): asserts!
    // In order to get part of the chart to scroll, part of the chart needs to
    // be put in a div. The div has to exist as a sibling of the chart's main
    // <svg> element because IE9 doesn't support <foreignObject>. So we create a
    // div and put a new <svg> element inside of it. Callers of this method need
    // to make sure they are attaching all events that are attached to the main
    // <svg> to this <svg> as well. The returned value here is the new <svg>.
    const overflowX = scrollX ? 'scroll' : 'hidden';
    const overflowY = scrollY ? 'scroll' : 'hidden';
    const divStyle =
      `height:${viewHeight}px;` +
      `overflow-x:${overflowX};` +
      `overflow-y:${overflowY};` +
      `width:${viewWidth}px;` +
      `position: absolute; top:0; left:0;`;
    const newCanvas = this.createCanvasInternal(scrollWidth, scrollHeight);
    if (goog.isArrayLike(elems)) {
      for (let i = 0, leni = elems.length; i < leni; i++) {
        this.appendChild(newCanvas, elems[i]);
      }
    } else {
      // TODO(dlaliberte): I think this cast can be replaced with some better
      // type checking.
      this.appendChild(newCanvas, elems as DrawingGroup);
    }
    const scrollDiv = document.createElement('div');
    scrollDiv.setAttribute('style', divStyle);
    scrollDiv.appendChild(newCanvas.getElement());
    this.container.appendChild(scrollDiv);
    return {append: [], events: [newCanvas.getElement()]};
  }

  createPathInternal(
    pathSegments: AnyDuringMigration,
    brush: AnyDuringMigration,
    relativeUrl?: boolean,
  ) {
    const element = this.createSvgElement('path');
    if (pathSegments.length > 0) {
      element.setAttribute('d', pathSegments.join(''));
    }
    this.setBrush(element, brush, relativeUrl);
    return element;
  }

  createText(
    text: string,
    x: number,
    y: number,
    width: number,
    horizAlign: TextAlign,
    vertAlign: TextAlign,
    textStyle: TextStyle,
    rtl?: boolean,
  ): Element {
    return this.createTextOnLineByAngle(
      text,
      x,
      y,
      width,
      0,
      horizAlign,
      vertAlign,
      textStyle,
      rtl,
    );
  }

  createTextOnLine(
    text: string,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    rtl?: boolean,
  ): Element {
    const x = getRelativeCoordinate(x1, x2, paralAlign, rtl);
    const y = getRelativeCoordinate(y1, y2, paralAlign, rtl);
    const line = new Line(x1, y1, x2, y2);
    const length = line.getSegmentLength();
    const angle = googMath.angle(x1, y1, x2, y2);
    return this.createTextOnLineByAngle(
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
  }

  createTextOnLineByAngle(
    text: string,
    x: number,
    y: number,
    length: number,
    angle: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    rtl?: boolean,
  ): Element {
    const opacity = textStyle.opacity !== undefined ? textStyle.opacity : 1;
    const brush = new Brush({fill: textStyle.color, fillOpacity: opacity});
    // If there's no auraColor, don't draw the aura, that's obvious. But also,
    // if there's no color, don't draw the aura - it doesn't make sense, but do
    // draw the text itself even if there's no color, it'll be transparent as
    // requested.
    if (
      textStyle.color &&
      textStyle.color !== util.NO_COLOR &&
      textStyle.auraColor &&
      textStyle.auraColor !== util.NO_COLOR
    ) {
      const auraWidth = textStyle.auraWidth;
      const brushWithAura = new Brush({
        fill: textStyle.color,
        fillOpacity: opacity,
        stroke: textStyle.auraColor,
        strokeOpacity: opacity,
        strokeWidth: auraWidth,
      });
      const textGroup = this.createGroup();

      const auraText = this.drawTextInternal(
        text,
        x,
        y,
        length,
        angle,
        paralAlign,
        perpenAlign,
        textStyle,
        brushWithAura,
        textGroup,
        rtl,
      );
      // Screen readers will read both text elements unless we hide one of them.
      auraText.setAttribute('aria-hidden', 'true');

      this.drawTextInternal(
        text,
        x,
        y,
        length,
        angle,
        paralAlign,
        perpenAlign,
        textStyle,
        brush,
        textGroup,
        rtl,
      );
      return textGroup.getElement();
    } else {
      return this.createTextInternal(
        text,
        x,
        y,
        length,
        angle,
        paralAlign,
        perpenAlign,
        textStyle,
        brush,
        rtl,
      );
    }
  }

  /**
   * The internal version of createTextOnLineByAngle, that accepts a brush
   * parameter.
   *
   * @param text The text to create.
   * @param x X coordinate of start of line.
   * @param y Y coordinate of start of line.
   * @param length Length of line.
   * @param angle Angle (degrees) of line.
   * @param paralAlign Line parallel alignment.
   * @param perpenAlign Line perpendicular alignment.
   * @param textStyle The text style.
   * @param brush The brush.
   * @param rtl Whether the text is right-to-left.
   * @return The newly created element.
   */
  private createTextInternal(
    text: string,
    x: number,
    y: number,
    length: number,
    angle: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    brush: Brush,
    rtl?: boolean,
  ): Element {
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(!isNaN(length));
    asserts.assert(!isNaN(angle));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));
    asserts.assert(isFinite(length));
    asserts.assert(isFinite(angle));

    const element = this.createSvgElement('text');

    // Change coordinates to take into account perpenAlign and SVG placement of
    // text. This could have been solved by using the 'alignment-baseline' and
    // 'baseline-shift' SVG properties, but at time this code is written, they
    // are only supported by Chrome, and not by FF/IE9. See CLs 22300716 and
    // 22325054.
    const perpenStartEnd = getAbsoluteCoordinates(
      0,
      textStyle.fontSize,
      perpenAlign,
    );
    // SVG puts the text on the baseline of the text and not the middle of it,
    // so change coordinates as if perpenAlign is END.
    perpenAlign = TextAlign.END;
    let perpenCenter = getRelativeCoordinate(
      perpenStartEnd.start,
      perpenStartEnd.end,
      perpenAlign,
    );
    // The SVG notion of baseline is the bottom of capital letters, so the
    // bottom part of, e.g., "q" is not included. Subtracting 15% solves this.
    // This is just a rough estimate, but do not have a better way.
    perpenCenter -= textStyle.fontSize * 0.15;
    const shiftVec = new Vec2(0, perpenCenter);
    shiftVec.rotate(googMath.toRadians(angle));
    // Now move the text line according to the shift vector.
    const p = new Vec2(x, y);
    p.add(shiftVec);
    x = p.x;
    y = p.y;

    element.appendChild(this.doc.createTextNode(text));
    switch (paralAlign) {
      case TextAlign.START:
        element.setAttribute('text-anchor', 'start');
        break;
      case TextAlign.CENTER:
        element.setAttribute('text-anchor', 'middle');
        break;
      case TextAlign.END:
        element.setAttribute('text-anchor', 'end');
        break;
      default:
        asserts.fail(`Invalid parallel alignment "${paralAlign}"`);
    }
    element.setAttribute('x', String(x));
    element.setAttribute('y', String(y));
    element.setAttribute('font-family', textStyle.fontName);
    element.setAttribute('font-size', String(textStyle.fontSize || 0));
    if (textStyle.bold) {
      element.setAttribute('font-weight', 'bold');
    }
    if (textStyle.italic) {
      element.setAttribute('font-style', 'italic');
    }
    if (textStyle.underline) {
      element.setAttribute('text-decoration', 'underline');
    }
    if (rtl) {
      element.setAttribute('direction', 'rtl');
    }
    if (angle !== 0) {
      element.setAttribute('transform', `rotate(${angle} ${x} ${y})`);
    }
    this.setBrush(element, brush);

    return element;
  }

  /**
   * The internal version of drawTextOnLine, that accepts a brush parameter.
   *
   * @param text The text to draw.
   * @param x X coordinate of start of line.
   * @param y Y coordinate of start of line.
   * @param length Length of line.
   * @param angle Angle (degrees) of line.
   * @param paralAlign Line parallel alignment.
   * @param perpenAlign Line perpendicular alignment.
   * @param textStyle The text style.
   * @param brush The brush.
   * @param group The group to draw into.
   * @param rtl Whether the text is right-to-left.
   * @return The newly created element.
   */
  private drawTextInternal(
    text: string,
    x: number,
    y: number,
    length: number,
    angle: number,
    paralAlign: TextAlign,
    perpenAlign: TextAlign,
    textStyle: TextStyle,
    brush: Brush,
    group: DrawingGroup,
    rtl?: boolean,
  ): Element {
    const textElement = this.createTextInternal(
      text,
      x,
      y,
      length,
      angle,
      paralAlign,
      perpenAlign,
      textStyle,
      brush,
      rtl,
    );
    this.appendChild(group, textElement);
    return textElement;
  }

  createGroupInternal() {
    return this.createSvgElement('g');
  }

  clipGroup(
    group: DrawingGroup,
    clipRect: googMath.Rect,
    ellipseClipping?: boolean,
  ): Element {
    const id = AbstractRenderer.newUniqueId();
    // Create the clipPath def entry.
    const clipPath = this.createSvgElement('clipPath');
    if (ellipseClipping) {
      const ellipse = this.createSvgElement('ellipse');
      ellipse.setAttribute('cx', String(clipRect.left + clipRect.width / 2));
      ellipse.setAttribute('cy', String(clipRect.top + clipRect.height / 2));
      ellipse.setAttribute('rx', String(clipRect.width / 2));
      ellipse.setAttribute('ry', String(clipRect.height / 2));
      clipPath.appendChild(ellipse);
    } else {
      const rect = this.createSvgElement('rect');
      rect.setAttribute('x', String(clipRect.left));
      rect.setAttribute('y', String(clipRect.top));
      rect.setAttribute('width', String(clipRect.width));
      rect.setAttribute('height', String(clipRect.height));
      clipPath.appendChild(rect);
    }
    clipPath.setAttribute('id', id);
    asserts.assert(this.defs != null);
    this.defs!.appendChild(clipPath);

    const element = group.getElement();
    // Link element to linearGradient definition.

    element.setAttribute('clip-path', this.makeCssUrl(id));

    // In SVG the clipped group and the clipping element are the same.
    return element;
  }

  /**
   * @param id The id to make a URL from
   * @param relativeUrl Whether use relative url for svg's fill attribute.
   */
  private makeCssUrl(id: string, relativeUrl?: boolean): string {
    let base = '';
    if (!relativeUrl && !(userAgent.IE && userAgent.VERSION === '9.0')) {
      // 1) when configured to use relative url, ignore the current
      // location.href and only rely on the id.
      // 2) Some browsers require full url. IE9 fails to use it correctly. First
      // remove any existing # from window's location.
      base = window.location.href.split('#')[0];
    }
    return 'url(' + base + '#' + id + ')';
  }

  addPathMove(path: string[], x: number, y: number) {
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));

    path.push(`M${x},${y}`);
  }

  addPathLine(path: string[], x: number, y: number) {
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));

    path.push(`L${x},${y}`);
  }

  /**
   * @param x1 The x coordinate of the curve's origin.
   * @param y1 The y coordinate of the curve's origin.
   * @param x2 The x coordinate of the curve's end point.
   * @param y2 The y coordinate of the curve's end point.
   */
  addPathCurve(
    path: string[],
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ) {
    asserts.assert(!isNaN(x1));
    asserts.assert(!isNaN(y1));
    asserts.assert(!isNaN(x2));
    asserts.assert(!isNaN(y2));
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(isFinite(x1));
    asserts.assert(isFinite(y1));
    asserts.assert(isFinite(x2));
    asserts.assert(isFinite(y2));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));

    path.push(`C${x1},${y1},${x2},${y2},${x},${y}`);
  }

  addPathClose(path: string[]) {
    path.push('Z');
  }

  /**
   * @param cx The x coordinate of the center.
   * @param cy The y coordinate of the center.
   * @param rx The radius of the x-axis.
   * @param ry The radius of the y-axis.
   */
  addPathArc(
    path: string[],
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    fromAngle: number,
    toAngle: number,
    isClockwise: boolean,
  ) {
    asserts.assert(!isNaN(cx));
    asserts.assert(!isNaN(cy));
    asserts.assert(!isNaN(rx));
    asserts.assert(!isNaN(ry));
    asserts.assert(!isNaN(fromAngle));
    asserts.assert(!isNaN(toAngle));
    asserts.assert(isFinite(cx));
    asserts.assert(isFinite(cy));
    asserts.assert(isFinite(rx));
    asserts.assert(isFinite(ry));
    asserts.assert(isFinite(fromAngle));
    asserts.assert(isFinite(toAngle));

    if (rx > 0 && ry > 0) {
      // When the start angle is too close to the end angle, SVG gets a bit
      // flaky, and will not draw the arc at all, so in order to correct this
      // behavior we need to determine when this will happen and avoid it. To do
      // this, we need to determine the angle difference and figure out how much
      // of the ellipse perimeter it is. If the circumference of the arc is less
      // than our threshold, then we need to increase it up to our threshold.
      let angleDiff = googMath.angleDifference(fromAngle, toAngle);
      // The circumference of an ellipse is fairly difficult and computationally
      // intensive to calculate, so we will just have to settle for calculating
      // the circle with r = min(rx, ry).
      const circumference = 2 * Math.PI * Math.min(rx, ry);
      const angleDistance = (angleDiff / 360) * circumference;
      if (Math.abs(angleDistance) < SvgRenderer.ARC_MIN_DISTANCE) {
        // Now that we have determined that the distance between the two ends of
        // the arc is less than our threshold, we need to figure out what our
        // desired angle difference is.
        const desiredMinAngle =
          (SvgRenderer.ARC_MIN_DISTANCE / circumference) * 360;
        angleDiff =
          ((desiredMinAngle - Math.abs(angleDiff)) * googMath.sign(angleDiff)) /
          2;
        fromAngle -= angleDiff;
        toAngle += angleDiff;
      }
    }
    fromAngle = googMath.standardAngle(fromAngle);
    toAngle = googMath.standardAngle(toAngle);

    // We need to offset the angle by 90 degrees since in our angles, 0 means
    // upwards (negative y axis) and in goog.math 0 means toward right (positive
    // x axis).
    const toAngleDx = googMath.angleDx(toAngle - 90, rx);
    const toAngleDy = googMath.angleDy(toAngle - 90, ry);
    let angleDiff = isClockwise ? toAngle - fromAngle : fromAngle - toAngle;
    if (angleDiff < 0) {
      angleDiff += 360;
    }
    const isLong = angleDiff > 180 ? 1 : 0;
    const endx = cx + toAngleDx;
    const endy = cy + toAngleDy;
    path.push(
      `A${rx},${ry},0,${isLong},${isClockwise ? 1 : 0},${endx},${endy}`,
    );
  }

  setOffset(
    element: AnyDuringMigration,
    dx: AnyDuringMigration,
    dy: AnyDuringMigration,
  ) {
    asserts.assert(!isNaN(dx));
    asserts.assert(!isNaN(dy));
    asserts.assert(isFinite(dx));
    asserts.assert(isFinite(dy));

    element.setAttribute('transform', `translate(${dx}, ${dy})`);
  }

  setWidth(element: AnyDuringMigration, width: AnyDuringMigration) {
    element.setAttribute('width', width);
  }

  setHeight(element: AnyDuringMigration, height: AnyDuringMigration) {
    element.setAttribute('height', height);
  }

  setLeftPosition(element: AnyDuringMigration, left: AnyDuringMigration) {
    element.setAttribute('x', left);
  }

  setTopPosition(element: AnyDuringMigration, top: AnyDuringMigration) {
    element.setAttribute('y', top);
  }

  /**
   * Change the stroke width of a drawing element
   *
   * @param element A drawing object (element).
   * @param color The color for the element. If null, color is not modified.
   * @param width The new stroke width.
   */
  setStroke(element: Element, color: string, width: number) {
    asserts.assert(!isNaN(width));
    asserts.assert(isFinite(width));

    element.setAttribute('stroke-width', String(width));
    if (color) {
      element.setAttribute('stroke', color);
    }
  }

  /**
   * In the future, the technique can be replaced by using the getBBBox()
   * method on SVG elements, if it becomes faster.
   * @param text The text to measure.
   * @param textStyle The text style.
   */
  getTextSizeInternal(
    text: string,
    textStyle: TextStyle,
    rotation?: number,
  ): Size {
    const textDiv = this.textMeasurementDiv;
    if (textDiv.firstChild!.nodeType === NodeType.TEXT) {
      (textDiv.firstChild as Text).data = text;
    } else {
      throw new Error(
        `Unexpected type of text node ${textDiv.firstChild!.nodeType}`,
      );
    }

    if (!document.contains(this.textMeasurementDiv)) {
      warning(this.logger, 'The text measurement div is missing.');
    }

    const style = (textDiv as HTMLElement).style;
    style.fontFamily = textStyle.fontName;
    style.fontSize = `${textStyle.fontSize}px`;
    style.fontWeight = textStyle.bold ? 'bold' : '';
    style.fontStyle = textStyle.italic ? 'italic' : '';
    style.display = 'block';
    if (rotation != null) {
      const rotateTransform = format('rotate(%ddeg)', rotation);
      style.transform = rotateTransform;
      style.transformOrigin = '0 0';
      // Webkit, Moz, O, and ms prefixes no longer allowed.
      // style.WebkitTransform = rotateTransform;
      // style.WebkitTransformOrigin = '0 0';
      // style.MozTransform = rotateTransform;
      // style.MozTransformOrigin = '0 0';
      // style.OTransform = rotateTransform;
      // style.OTransformOrigin = '0 0';
      // style.msTransform = rotateTransform;
      // style.msTransformOrigin = '0 0';
    }
    const width = textDiv.clientWidth;
    const height = textDiv.clientHeight;
    style.display = 'none';
    if (width === 0 && text.trim().length > 0) {
      warning(
        this.logger,
        'Unable to measure the text in the chart container. Most ' +
          'likely the chart container or one of its parents has style ' +
          'display:none.',
      );

      const bodyEl = document.getElementsByTagName('body')[0];
      if (this.textMeasurementDiv.parentElement !== bodyEl) {
        info(this.logger, 'Trying to measure text at the body element.');
        bodyEl.appendChild(this.textMeasurementDiv);
        return this.getTextSizeInternal(text, textStyle, rotation);
      } else {
        throw new Error(
          'Unable to measure the text bbox, even with div ' +
            'attached to the `body` element...',
        );
      }
    }
    return new Size(width, height);
  }

  getScrollbarSize() {
    if (this.scrollBarSize != null) {
      return this.scrollBarSize;
    }
    this.scrollBarSize = googStyle.getScrollbarWidth();
    return this.scrollBarSize;
  }

  /**
   * Create an SVG named node
   *
   * @param name (type) of node.
   *
   * @return A new DOM node.
   */
  private createSvgElement(name: string): SVGElement {
    return this.doc.createElementNS(SVG_NAMESPACE, name);
  }

  setBrush(
    element: AnyDuringMigration,
    brush: AnyDuringMigration,
    relativeUrl?: boolean,
  ) {
    // Note: we do not want to explicitly specify an attribute whose value
    // equals the default. This can have undesired behaviour, for example: When
    // setting stroke-dasharray="solid" on a text element in Chrome, the text is
    // sometimes rendered without the stroke (probably a bug in Chrome).
    //
    // Thus, when an attribute is changed from some value to the default, we
    // have to remove the attribute. In fact, we always remove the attribute if
    // its value is the default, since attempting to remove an attribute that is
    // not on the element doesn't raise an exception.

    // Set the stroke.
    if (brush.hasStroke()) {
      element.setAttribute('stroke', brush.getStroke());
      element.setAttribute('stroke-width', brush.getStrokeWidth());
      // Set stroke opacity (a number between 0 to 1).
      if (!brush.isStrokeOpaque()) {
        element.setAttribute('stroke-opacity', brush.getStrokeOpacity());
      } else {
        element.removeAttribute('stroke-opacity');
      }
      // Set stroke dash style.
      if (brush.strokeHasDashStyle()) {
        element.setAttribute(
          'stroke-dasharray',
          SvgRenderer.convertStrokeDashStyle(
            brush.getStrokeDashStyle(),
            brush.getStrokeWidth(),
          ),
        );
      } else {
        element.removeAttribute('stroke-dasharray');
      }
    } else {
      element.setAttribute('stroke', util.NO_COLOR);
      element.setAttribute('stroke-width', 0);
      // When stroke="none" browsers should ignore the stroke-opacity and
      // stroke-dasharray attributes. If this turns out not to be the case you
      // should call removeAttribute() for these attributes here.
    }

    // Set fill opacity (a number between 0 to 1).
    if (!brush.isFillOpaque()) {
      element.setAttribute('fill-opacity', brush.getFillOpacity());
    } else {
      element.removeAttribute('fill-opacity');
    }

    // Don't remove attributes when radius x or y is not in brush
    // because these are also used by ellipse.
    // TODO(dlaliberte): Fix this so we don't rely on brush radius being null,
    // and then we can remove the radius attributes when not used.
    const rx = brush.getRadiusX();
    if (typeof rx === 'number') {
      element.setAttribute('rx', rx);
    }
    const ry = brush.getRadiusY();
    if (typeof ry === 'number') {
      element.setAttribute('ry', ry);
    }

    const brushGradient = brush.getGradient();
    const brushPattern = brush.getPattern();
    let id;
    if (brushGradient) {
      // Fill shape with gradient
      id = this.getGradientDefinitionId(brushGradient);
      element.setAttribute('fill', this.makeCssUrl(id, relativeUrl));
    } else if (brushPattern) {
      // Fill shape with pattern
      id = this.getPatternDefinitionId(brushPattern);
      element.setAttribute('fill', this.makeCssUrl(id, relativeUrl));
    } else {
      element.setAttribute('fill', brush.getFill());
    }

    if (brush.hasShadow()) {
      const brushShadow = brush.getShadow();
      id = this.getShadowDefinitionId(brushShadow as Shadow);
      element.setAttribute('filter', this.makeCssUrl(id, relativeUrl));
    }
  }

  /**
   * Return the id of an SVG definition of a given shadow filter.
   * May create a new def if this shadow is new.
   *
   * @param shadow The shadow.
   * @return The id of the SVG gradient definition.
   */
  private getShadowDefinitionId(shadow: Shadow): string {
    // Look up shadow, in case already defined.
    const hash = getHash(shadow).toString();
    let id = this.shadowDefsIds[hash];
    if (id) {
      return id;
    }

    // Must create a new defs entry that element will refer to.
    id = AbstractRenderer.newUniqueId();
    this.shadowDefsIds[hash] = id;

    /*
     * Create a def that looks like this:
     * <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
     * <feOffset dy="1" />
     * <feComponentTransfer>
     *   <feFuncA type="linear" slope="0.4"/>
     * </feComponentTransfer>
     * <feMerge>
     *   <feMergeNode />
     *   <feMergeNode in="SourceGraphic" />
     * </feMerge>
     */
    const filterElement = this.createSvgElement('filter');
    filterElement.setAttribute('id', id);

    const gaussianBlurElement = this.createSvgElement('feGaussianBlur');
    gaussianBlurElement.setAttribute('in', 'SourceAlpha');
    gaussianBlurElement.setAttribute(
      'stdDeviation',
      String(shadow.radius || 0),
    );
    filterElement.appendChild(gaussianBlurElement);

    const offsetElement = this.createSvgElement('feOffset');
    offsetElement.setAttribute('dx', String(shadow.xOffset || 0));
    offsetElement.setAttribute('dy', String(shadow.yOffset || 0));
    filterElement.appendChild(offsetElement);

    if (shadow.opacity != null) {
      const componentTransferElement = this.createSvgElement(
        'feComponentTransfer',
      );
      const alphaFuncElement = this.createSvgElement('feFuncA');
      alphaFuncElement.setAttribute('type', 'linear');
      alphaFuncElement.setAttribute('slope', String(shadow.opacity));
      componentTransferElement.appendChild(alphaFuncElement);
      filterElement.appendChild(componentTransferElement);
    }

    const mergeElement = this.createSvgElement('feMerge');
    const mergeNode1 = this.createSvgElement('feMergeNode');
    mergeElement.appendChild(mergeNode1);
    const mergeNode2 = this.createSvgElement('feMergeNode');
    mergeNode2.setAttribute('in', 'SourceGraphic');
    mergeElement.appendChild(mergeNode2);
    filterElement.appendChild(mergeElement);

    asserts.assert(this.defs != null);
    this.defs!.appendChild(filterElement);

    return id;
  }

  /**
   * Return the id of an SVG definition of a given gradient.
   * May create a new def if this gradient is new.
   *
   * @param gradient The gradient.
   * @return The id of the SVG gradient definition.
   */
  private getGradientDefinitionId(gradient: Gradient): string {
    // Look up gradient, in case already defined.
    const hash = getHash(gradient).toString();
    let id = this.gradientDefsIds[hash];
    if (id) {
      return id;
    }

    // Must create a new defs entry that element will refer to.
    id = AbstractRenderer.newUniqueId();
    this.gradientDefsIds[hash] = id;

    // Create the gradient def entry (only linear gradient are supported)
    const gradientElement = this.createSvgElement('linearGradient');
    const x1 = gradient.x1;
    const x2 = gradient.x2;
    const y1 = gradient.y1;
    const y2 = gradient.y2;
    const color1 = gradient.color1;
    const color2 = gradient.color2;

    let opacity1 = 1;
    if (gradient.opacity1 === 0 || gradient.opacity1) {
      opacity1 = gradient.opacity1;
    }
    let opacity2 = 1;
    if (gradient.opacity2 === 0 || gradient.opacity2) {
      opacity2 = gradient.opacity2;
    }

    const gradientUnits = gradient.useObjectBoundingBoxUnits
      ? 'objectBoundingBox'
      : 'userSpaceOnUse';

    gradientElement.setAttribute('id', id);
    gradientElement.setAttribute('x1', String(x1));
    gradientElement.setAttribute('y1', String(y1));
    gradientElement.setAttribute('x2', String(x2));
    gradientElement.setAttribute('y2', String(y2));
    gradientElement.setAttribute('gradientUnits', gradientUnits);

    const stop1Style = `stop-color:${color1}; stop-opacity:${opacity1}`;
    const stop2Style = `stop-color:${color2}; stop-opacity:${opacity2}`;

    const stop1 = this.createSvgElement('stop');
    stop1.setAttribute('offset', '0%');
    stop1.style.cssText = stop1Style;
    gradientElement.appendChild(stop1);

    // Optionally adds middle stops to make a sharp transition from
    // color1 to color2.
    if (gradient.sharpTransition) {
      const stop1MidPoint = this.createSvgElement('stop');
      stop1MidPoint.setAttribute('offset', '49.99%');
      stop1MidPoint.style.cssText = stop1Style;
      gradientElement.appendChild(stop1MidPoint);

      const stop2MidPoint = this.createSvgElement('stop');
      stop2MidPoint.setAttribute('offset', '50%');
      stop2MidPoint.style.cssText = stop2Style;
      gradientElement.appendChild(stop2MidPoint);
    }

    const stop2 = this.createSvgElement('stop');
    stop2.setAttribute('offset', '100%');
    stop2.style.cssText = stop2Style;
    gradientElement.appendChild(stop2);

    asserts.assert(this.defs != null);
    this.defs!.appendChild(gradientElement);

    return id;
  }

  /**
   * Calculates a unique id for a given pattern.
   *
   * @param pattern The pattern.
   * @return A unique id for the pattern.
   */
  private static calcPatternId(pattern: Pattern): string {
    const id =
      pattern.getStyle() +
      '_' +
      pattern.getColor() +
      '_' +
      pattern.getBackgroundColor();
    return id;
  }

  /**
   * Gets id of the SVG definition of a given pattern, creating it if necessary.
   *
   * @param pattern The pattern.
   * @return The id of the SVG pattern definition.
   */
  private getPatternDefinitionId(pattern: Pattern): string {
    const patternId = SvgRenderer.calcPatternId(pattern);
    let patternElement: Element | null = null;

    // If the pattern definition doesn't exist - create it.
    if (!(patternId in this.patternDefsIds)) {
      const patternStyle = pattern.getStyle();
      switch (patternStyle) {
        case PatternStyle.PRIMARY_DIAGONAL_STRIPES:
          patternElement = this.createDiagonalStripesPatternDefinition(pattern);
          break;
        case PatternStyle.SECONDARY_DIAGONAL_STRIPES:
          patternElement =
            this.createSecondaryStripesPatternDefinition(pattern);
          break;
        default:
          asserts.assert(false, `Unsupported pattern style ${patternStyle}`);
      }

      const id = AbstractRenderer.newUniqueId();
      patternElement!.setAttribute('id', id);

      asserts.assert(this.defs != null);
      this.defs!.appendChild(patternElement!);
      this.patternDefsIds[patternId] = id;
    }

    // Return the id of the pattern definition.
    return this.patternDefsIds[patternId];
  }

  /**
   * Creates an SVG element that defines a given diagonal stripes pattern.
   *
   * A schematic view of the diagonal stripes pattern:
   *   . . X .
   *   . . . X
   *   X . . .
   *   . X . .
   *
   * The SVG element defining the pattern ('{' marks dynamic data):
   *   <pattern patternUnits="userSpaceOnUse" x="0" y="0" width="4" height="4"
   *       viewBox="0 0 4 4">
   *     <rect x="0" y="0" width="4" height="4" fill="{backgroundColor}"/>
   *     <g stroke="{color}" stroke-linecap="square">
   *       <line x1="2" y1="0" x2="4" y2="2" stroke-width="2"/>
   *       <line x1="0" y1="2" x2="2" y2="4" stroke-width="2"/>
   *     </g>
   *   </pattern>
   *
   * @param pattern The pattern.
   * @return The SVG element defining the pattern.
   */
  private createDiagonalStripesPatternDefinition(pattern: Pattern): Element {
    const patternElement = this.createSvgElement('pattern');

    patternElement.setAttribute('patternUnits', 'userSpaceOnUse');
    patternElement.setAttribute('x', '0');
    patternElement.setAttribute('y', '0');
    patternElement.setAttribute('width', '4');
    patternElement.setAttribute('height', '4');
    patternElement.setAttribute('viewBox', '0 0 4 4');

    // Define the background color of the pattern.
    const rectElement = this.createSvgElement('rect');
    rectElement.setAttribute('x', '0');
    rectElement.setAttribute('y', '0');
    rectElement.setAttribute('width', '4');
    rectElement.setAttribute('height', '4');
    rectElement.setAttribute('fill', pattern.getBackgroundColor());
    patternElement.appendChild(rectElement);

    // Define the diagonal stripes.
    const groupElement = this.createSvgElement('g');
    groupElement.setAttribute('stroke', pattern.getColor());
    groupElement.setAttribute('stroke-linecap', 'square');

    let lineElement = this.createSvgElement('line');
    lineElement.setAttribute('x1', '2');
    lineElement.setAttribute('y1', '0');
    lineElement.setAttribute('x2', '4');
    lineElement.setAttribute('y2', '2');
    lineElement.setAttribute('stroke-width', '2');
    groupElement.appendChild(lineElement);

    lineElement = this.createSvgElement('line');
    lineElement.setAttribute('x1', '0');
    lineElement.setAttribute('y1', '2');
    lineElement.setAttribute('x2', '2');
    lineElement.setAttribute('y2', '4');
    lineElement.setAttribute('stroke-width', '2');
    groupElement.appendChild(lineElement);

    patternElement.appendChild(groupElement);

    return patternElement;
  }

  /**
   * Similar to createDiagonalStripesPatternDefinition_ except:
   *   1) pattern has positive slope, and
   *   2) stripes are a little farther apart.
   * @param pattern The pattern.
   * @return The SVG element defining the pattern.
   */
  private createSecondaryStripesPatternDefinition(pattern: Pattern): Element {
    const patternElement = this.createSvgElement('pattern');

    patternElement.setAttribute('patternUnits', 'userSpaceOnUse');
    patternElement.setAttribute('x', '0');
    patternElement.setAttribute('y', '0');
    patternElement.setAttribute('width', '6');
    patternElement.setAttribute('height', '6');
    patternElement.setAttribute('viewBox', '0 0 4 4');

    // Define the background color of the pattern.
    const rectElement = this.createSvgElement('rect');
    rectElement.setAttribute('x', '0');
    rectElement.setAttribute('y', '0');
    rectElement.setAttribute('width', '4');
    rectElement.setAttribute('height', '4');
    rectElement.setAttribute('fill', pattern.getBackgroundColor());
    patternElement.appendChild(rectElement);

    // Define the diagonal stripes.
    const groupElement = this.createSvgElement('g');
    groupElement.setAttribute('stroke', pattern.getColor());
    groupElement.setAttribute('stroke-linecap', 'square');

    let lineElement = this.createSvgElement('line');
    lineElement.setAttribute('x1', '2');
    lineElement.setAttribute('y1', '0');
    lineElement.setAttribute('x2', '0');
    lineElement.setAttribute('y2', '2');
    lineElement.setAttribute('stroke-width', '2');
    groupElement.appendChild(lineElement);

    lineElement = this.createSvgElement('line');
    lineElement.setAttribute('x1', '4');
    lineElement.setAttribute('y1', '2');
    lineElement.setAttribute('x2', '2');
    lineElement.setAttribute('y2', '4');
    lineElement.setAttribute('stroke-width', '2');
    groupElement.appendChild(lineElement);

    patternElement.appendChild(groupElement);

    return patternElement;
  }

  /**
   * Converts a StrokeDashStyle to the equivalent SVG form.
   * @param strokeDashStyle The stroke dash style.
   * @param strokeWidth The stroke width. Dash length should be proportional to
   *     it.
   * @return The SVG equivalent in pattern of lengths of dashes and gaps form.
   *     Returns the SVG form of DEFAULT_STROKE_DASH_STYLE for bad input.
   * @see http://www.w3.org/TR/SVG/painting.html#StrokeProperties
   */
  private static convertStrokeDashStyle(
    strokeDashStyle: StrokeDashStyle,
    strokeWidth: number,
  ): string {
    if (Array.isArray(strokeDashStyle)) {
      return strokeDashStyle.join(',');
    }
    switch (strokeDashStyle) {
      case StrokeDashStyleType.SOLID:
        return '0';
      case StrokeDashStyleType.DASH:
        return String(4 * strokeWidth) + ',' + String(strokeWidth);
      default:
        // If this leads to an infinite loop it means that
        // DEFAULT_STROKE_DASH_STYLE is not a StrokeDashStyle, or that the
        // switch clause does not cover all cases. Hence, you should fix your
        // problem elsewhere rather than changing the behavior of this line.
        return SvgRenderer.convertStrokeDashStyle(
          Brush.DEFAULT_STROKE_DASH_STYLE,
          strokeWidth,
        );
    }
  }

  override createAccessibilityContainer(): Element | null {
    // We must hide the accessibility table differently in rtl containers.
    const offset = this.isRtl ? 10000 : -10000;
    const style =
      `position:absolute; overflow:hidden;` +
      `left:${offset}px; top:auto; width:1px; height:1px;`;
    const div = document.createElement('div');
    div.setAttribute('aria-label', MSG_TAB_REPRESENTATION);
    div.setAttribute('style', style);
    this.container.appendChild(div);

    // Set the aria tags so that the container has an aria-label but the SVG
    // data is hidden. (Now that we're adding data specifically for screen
    // readers, there is no need to leave the SVG content visible.)
    this.container.setAttribute('aria-label', MSG_A_CHART);

    return div;
  }
}

// const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

/** XML namespace for SVG elements. */
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** @desc Used as a very short description for screen readers. */
const MSG_A_CHART = goog.getMsg('A chart.');

/** @desc Description of a table containing the chart's data. */
const MSG_TAB_REPRESENTATION = goog.getMsg(
  'A tabular representation of the data in the chart.',
);
