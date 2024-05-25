/**
 * @fileoverview HTML5 canvas implementation of BrowserRenderer.
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

import * as asserts from 'google3/javascript/typescript/contrib/assert';
import * as googColor from '@npm//@closure/color/color';
import * as dom from '@npm//@closure/dom/dom';
import {Box} from '@npm//@closure/math/box';
import {Line} from '@npm//@closure/math/line';
import * as googMath from '@npm//@closure/math/math';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import {Size} from '@npm//@closure/math/size';

import {getRelativeCoordinate, TextAlign} from '../text/text_align';
import {TextStyle} from '../text/text_style';
import {BrowserRenderer} from './browser_renderer';
import {Brush} from './brush';
import {DrawingGroup} from './drawing_group';
import {Pattern} from './pattern';
import {PatternStyle} from './types';

/**
 * A renderer that uses HTML5 canvas.
 *
 * @final
 */
export class CanvasRenderer extends BrowserRenderer {
  /** The canvas rendering context. */
  private ctx: CanvasRenderingContext2D | null = null;

  /**
   * The 2D Canvas Context Context used to measure text.
   * *
   */
  private readonly textCtx: CanvasRenderingContext2D;

  /** The current clip rect. */
  private clipRect: GoogRect | null = null;

  /** The size of the canvas. */
  private size: Size | null = null;

  /** The bounds of the currently-being-drawn path. */
  private pathBounds: Box | null = null;

  /** Whether a path has been created. */
  private pathCreated = false;

  /**
   * Construct a canvas renderer.
   * @param container The renderer's container.
   * @param textMeasurementDiv A div used for measuring text size.
   */
  constructor(container: Element, textMeasurementDiv: Element) {
    super(container, textMeasurementDiv);

    const canvas = dom
      .getDomHelper(textMeasurementDiv)
      .createElement('canvas') as HTMLCanvasElement;
    this.textMeasurementDiv.appendChild(canvas);

    this.textCtx = canvas.getContext('2d') as CanvasRenderingContext2D;
  }

  /** Creates a path if one hasn't been created. */
  private createCanvasPath() {
    const ctx = this.ctx!;
    if (this.pathCreated) {
      return;
    }
    ctx.beginPath();
    this.pathBounds = new Box(Infinity, -Infinity, -Infinity, Infinity);
    this.pathCreated = true;
  }

  /**
   * Updates the bounds of the path that is currently being drawn.
   * @param x The x coordinate.
   * @param y The y coordinate.
   */
  private updatePathBounds(x: number, y: number) {
    if (this.pathBounds) {
      this.pathBounds.left = Math.min(this.pathBounds.left, x);
      this.pathBounds.top = Math.min(this.pathBounds.top, y);
      this.pathBounds.right = Math.max(this.pathBounds.right, x);
      this.pathBounds.bottom = Math.max(this.pathBounds.bottom, y);
    }
  }

  /**
   * Create the main rendering area (group).
   *
   * @param width Width in pixels of the chart.
   * @param height Height in pixels of the chart.
   *
   * @return The topmost created group.
   */
  createCanvasInternal(width: number, height: number): DrawingGroup {
    asserts.assert(!isNaN(width));
    asserts.assert(!isNaN(height));
    asserts.assert(isFinite(width));
    asserts.assert(isFinite(height));
    asserts.assert(width >= 0);
    asserts.assert(height >= 0);

    const canvas = dom
      .getDomHelper(this.container)
      .createElement('canvas') as HTMLCanvasElement;
    canvas.setAttribute('width', `${width}`);
    canvas.setAttribute('height', `${height}`);
    this.size = new Size(width, height);
    this.container.appendChild(canvas);
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    return new DrawingGroup(canvas);
  }

  deleteContentsInternal() {
    const ctx = this.ctx!;
    const element = this.getCanvas()!.getElement() as HTMLCanvasElement;
    ctx.clearRect(0, 0, element.width, element.height);
  }

  /**
   * Creates an empty element to be returned to rest of GViz. This is a bit
   * hacky, but should work until we need interactivity.
   */
  private emptyElement(): Element {
    return dom.getDomHelper(this.container).createElement('empty');
  }

  /**
   * Parses a GViz color properly.
   * @param color The GViz color string to convert to canvas style.
   * @param opacity The GViz opacity value to convert to canvas style.
   * @return The RGBA command for a canvas stroke/fill color.
   */
  private rgbFromColorAndOpacity(
    color: string,
    opacity: number | string,
  ): string {
    if (color === 'none') {
      // return clear if no color.
      return 'rgba(0,0,0,0)';
    }
    if (opacity === 'none') {
      // default to no opacity.
      opacity = 1;
    }
    const rgb = googColor.hexToRgb(googColor.parse(color).hex);
    return `rgba(${rgb},${opacity})`;
  }

  /**
   * Draws the diagonal stripes pattern.
   * @param pattern The pattern we're putting into the canvas context.
   */
  private drawDiagonalStripesPattern(pattern: Pattern): HTMLCanvasElement {
    const canvas = this.doc.createElement('canvas');
    canvas.setAttribute('width', '4');
    // Suppressing errors for ts-migration.
    canvas.setAttribute('height', '4');
    const context = canvas.getContext('2d') as CanvasRenderingContext2D;
    context.fillStyle = pattern.getBackgroundColor();
    context.fillRect(0, 0, 4, 4);
    context.strokeStyle = pattern.getColor();
    context.beginPath();
    context.lineWidth = 2;
    context.lineCap = 'square';
    context.moveTo(2, 0);
    context.lineTo(4, 2);
    context.moveTo(0, 2);
    context.lineTo(2, 4);
    context.stroke();
    return canvas;
  }

  /**
   * Set the line dash on a context in a browser independent way.
   * @param context The context in which to set up the dash array.
   * @param dashArray The dash array.
   */
  private setLineDash(context: CanvasRenderingContext2D, dashArray: number[]) {
    if (typeof context.setLineDash !== 'undefined') {
      context.setLineDash(dashArray);
    }
  }

  /**
   * Processes a position on a gradient within a brush. This is necessary
   * because the gradient positions may be relative percentages, in which case
   * we need to either multiply them by the object size or the canvas size and
   * offset them properly.
   * @param value The value to scale.
   * @param useObjectBounds If true, the position will be scaled according to objectRect.  Otherwise, canvasSize will be used.
   * @param isVertical Should be true if the position is y1 or y2.
   * @param objectRect The bounding rectangle of the shape.
   * @return The scaled value.
   */
  private processGradientPosition(
    value: number | string,
    useObjectBounds: boolean,
    isVertical: boolean,
    objectRect: GoogRect,
  ): number {
    const percentRegexp = /^(\d+(\.\d*)?)\%$/;
    if (typeof value === 'string' && percentRegexp.test(value)) {
      value = Number(percentRegexp.exec(value)![1]) / 100;
      if (useObjectBounds && objectRect != null) {
        if (isVertical) {
          value = objectRect.height * value + objectRect.top;
        } else {
          value = objectRect.width * value + objectRect.left;
        }
      } else if (this.size != null) {
        if (isVertical) {
          value = this.size.height * value;
        } else {
          value = this.size.width * value;
        }
      }
    } else {
      value = +value;
    }
    return value;
  }

  /**
   * Set up the drawing context from a brush.
   * @param brush The brush we're setting to our context.
   * @param objectRect The rectangle of the rendered object.
   */
  private setCanvasBrush(brush: Brush, objectRect: GoogRect) {
    const ctx = this.ctx!;
    ctx.strokeStyle = this.rgbFromColorAndOpacity(
      brush.getStroke(),
      brush.getStrokeOpacity(),
    );
    ctx.fillStyle = this.rgbFromColorAndOpacity(
      brush.getFill(),
      brush.getFillOpacity(),
    );
    const dash = brush.getStrokeDashStyle();
    if (dash != null && dash === 'dash') {
      this.setLineDash(ctx, [8, 2]);
    } else if (Array.isArray(dash)) {
      this.setLineDash(ctx, dash);
    } else {
      this.setLineDash(ctx, []);
    }
    const pattern = brush.getPattern();
    const brushGradient = brush.getGradient();
    if (pattern != null) {
      // Render the pattern.
      switch (pattern.getStyle()) {
        case PatternStyle.PRIMARY_DIAGONAL_STRIPES:
          const canvas = this.drawDiagonalStripesPattern(pattern);
          ctx.fillStyle = ctx.createPattern(canvas, 'repeat')!;
          break;
        default:
          asserts.assert(
            false,
            `Unsupported pattern style ${pattern.getStyle()}`,
          );
      }
    } else if (brushGradient != null) {
      // Render the gradient.
      const useObjectBounds = brushGradient.useObjectBoundingBoxUnits || false;

      const x1 = this.processGradientPosition(
        brushGradient.x1,
        useObjectBounds,
        false,
        objectRect,
      );
      const y1 = this.processGradientPosition(
        brushGradient.y1,
        useObjectBounds,
        true,
        objectRect,
      );
      const x2 = this.processGradientPosition(
        brushGradient.x2,
        useObjectBounds,
        false,
        objectRect,
      );
      const y2 = this.processGradientPosition(
        brushGradient.y2,
        useObjectBounds,
        true,
        objectRect,
      );
      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, brushGradient.color1);
      gradient.addColorStop(1, brushGradient.color2);
      ctx.fillStyle = gradient;
    }
    ctx.lineWidth = brush.getStrokeWidth();
  }

  /**
   * Sets the canvas context for the proper font, etc. from a GViz font.
   * @param context The context in which to set up the font.
   * @param style The GViz font style.
   */
  private setTextFromStyle(
    context: CanvasRenderingContext2D,
    style: TextStyle,
  ) {
    // Set the colors.
    if (style.auraColor && style.auraColor !== 'none') {
      context.strokeStyle = style.auraColor;
      const auraWidth = 3;
      context.lineWidth = auraWidth;
    } else {
      context.strokeStyle = 'rgba(0,0,0,0)';
    }
    const opacity = style.opacity ? style.opacity : 1;
    context.fillStyle = this.rgbFromColorAndOpacity(style.color, opacity);
    this.setLineDash(context, []);

    // Set the font.
    let font = '';
    if (style.italic) {
      font = 'italic ';
    }
    if (style.bold) {
      font += 'bold ';
    }
    font += `${style.fontSize}px ${style.fontName}`;
    context.font = font;
  }

  /**
   * Create a circle element.
   *
   * @param cx The x coordinate of the center.
   * @param cy The y coordinate of the center.
   * @param r The radius.
   * @param brush The brush.
   * @return The created element.
   */
  createCircle(cx: number, cy: number, r: number, brush: Brush): Element {
    asserts.assert(!isNaN(cx));
    asserts.assert(!isNaN(cy));
    asserts.assert(!isNaN(r));
    asserts.assert(isFinite(cx));
    asserts.assert(isFinite(cy));
    asserts.assert(isFinite(r));
    asserts.assert(r >= 0);
    const ctx = this.ctx!;

    ctx.beginPath();
    this.setCanvasBrush(brush, new GoogRect(cx - r, cy - r, r * 2, r * 2));
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    return this.emptyElement();
  }

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
  createEllipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    brush: Brush,
  ): Element {
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
    const ctx = this.ctx!;

    // Draw the ellipse. We do this by translating the context to the center of
    // ellipse, and scaling the context such that a circle would draw as an
    // ellipse in the scaled context.
    ctx.save();
    this.setCanvasBrush(brush, new GoogRect(cx - rx, cy - ry, rx * 2, ry * 2));
    ctx.translate(cx, cy);
    let radius;
    if (rx > ry) {
      ctx.scale(1, ry / rx);
      radius = rx;
    } else {
      ctx.scale(rx / ry, 1);
      radius = ry;
    }
    ctx.arc(0, 0, radius, 0, 2 * Math.PI, false);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    return this.emptyElement();
  }

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
  createRect(
    x: number,
    y: number,
    width: number,
    height: number,
    brush: Brush,
  ): Element {
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
    const ctx = this.ctx!;

    this.setCanvasBrush(brush, new GoogRect(x, y, width, height));
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    return this.emptyElement();
  }

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
   * @return An object describing what needs to be done now. Elements in the append property will need to be put into the visualization by the caller; elements in the events property will need to have events added to them, because the event is not a child of the main canvas, but a sibling.
   */
  makeElementScrollable(
    elems: DrawingGroup | DrawingGroup[],
    viewWidth: number,
    viewHeight: number,
    scrollWidth: number,
    scrollHeight: number,
    scrollX: boolean,
    scrollY: boolean,
  ): {append: Element[]; events: Element[]} {
    // unimplemented.
    return {append: [], events: [this.emptyElement()]};
  }

  createPathInternal(pathSegments: string[], brush: Brush): Element {
    const ctx = this.ctx!;

    this.setCanvasBrush(brush, GoogRect.createFromBox(this.pathBounds));
    ctx.fill();
    ctx.stroke();
    this.pathCreated = false;
    this.pathBounds = null;
    return this.emptyElement();
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
    const x = getRelativeCoordinate(x1, x2, paralAlign);
    const y = getRelativeCoordinate(y1, y2, paralAlign);
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
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(!isNaN(length));
    asserts.assert(!isNaN(angle));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));
    asserts.assert(isFinite(length));
    asserts.assert(isFinite(angle));

    asserts.assert(this.ctx);
    const ctx = this.ctx!;

    this.setTextFromStyle(ctx, textStyle);

    ctx.save();

    // Rotate the coordinate system.
    angle = googMath.toRadians(angle);
    let y2 = x * Math.sin(-angle) + y * Math.cos(-angle);
    let x2 = x * Math.cos(-angle) - y * Math.sin(-angle);
    ctx.rotate(angle);

    // Adjust the vertical alignment. This constants were determined
    // empirically.
    if (perpenAlign === 'start') {
      y2 += (4 * textStyle.fontSize) / 5;
    } else if (perpenAlign === 'center') {
      y2 += textStyle.fontSize / 3;
    } else if (perpenAlign === 'end') {
      y2 -= textStyle.fontSize / 5;
    } else {
      asserts.fail(`Unknown perpenAlign: ${perpenAlign}`);
    }
    if (paralAlign === 'start') {
    } else if (paralAlign === 'center') {
      x2 -= this.getTextSizeInternal(text, textStyle).width / 2;
    } else if (paralAlign === 'end') {
      x2 -= this.getTextSizeInternal(text, textStyle).width;
    } else {
      asserts.fail(`Unknown paralAlign: ${paralAlign}`);
    }
    ctx.strokeText(text, x2, y2);
    ctx.fillText(text, x2, y2);

    // Canvas doesn't support underlining... sigh.
    if (textStyle.underline) {
      ctx.beginPath();
      const textSize = textStyle.fontSize;
      let lineWidth = textSize / 15; // magic constant determined empirically.
      y2 += lineWidth + 1;
      if (lineWidth < 1) {
        lineWidth = 1;
      }
      ctx.lineWidth = lineWidth;
      ctx.moveTo(x2, y2);
      ctx.lineTo(ctx.measureText(text).width + x2, y2);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.stroke();
    }

    ctx.restore();
    return this.emptyElement();
  }

  createGroupInternal(): Element {
    return this.emptyElement();
  }

  override describeClipRegion(rect: googMath.Rect | null) {
    if (rect === null) {
      return;
    }
    this.clipRect = rect;
    const ctx = this.ctx!;

    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.clip();
    return;
  }

  override disableClipping(): googMath.Rect | null {
    const ctx = this.ctx!;

    const oldClipRect = this.clipRect;
    if (this.clipRect) {
      this.clipRect = null;
      ctx.restore();
    }
    return oldClipRect;
  }

  override clipRegion(): googMath.Rect | null {
    return this.clipRect;
  }

  clipGroup(
    group: DrawingGroup,
    clipRect: googMath.Rect,
    ellipseClipping?: boolean,
  ): Element {
    return this.emptyElement();
  }

  addPathMove(path: string[], x: number, y: number) {
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));
    const ctx = this.ctx!;

    this.createCanvasPath();
    ctx.moveTo(x, y);
    this.updatePathBounds(x, y);
  }

  addPathLine(path: string[], x: number, y: number) {
    asserts.assert(!isNaN(x));
    asserts.assert(!isNaN(y));
    asserts.assert(isFinite(x));
    asserts.assert(isFinite(y));
    const ctx = this.ctx!;

    this.createCanvasPath();
    ctx.lineTo(x, y);
    this.updatePathBounds(x, y);
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
    const ctx = this.ctx!;

    this.createCanvasPath();
    ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
    // TODO(dlaliberte): This isn't entirely correct. It will overcompensate
    this.updatePathBounds(x1, y1);
    this.updatePathBounds(x2, y2);
    this.updatePathBounds(x, y);
  }

  addPathClose(path: string[]) {
    const ctx = this.ctx!;

    this.createCanvasPath();
    ctx.closePath();
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

    this.createCanvasPath();
    const ctx = this.ctx!;

    // GViz and Canvas' coordinate system only differ in that Canvas is measured
    // in radians and 0 on the unit circles differ by 90 degrees.
    fromAngle = googMath.toRadians(fromAngle - 90);
    toAngle = googMath.toRadians(toAngle - 90);
    const radius = Math.max(rx, ry);
    ctx.save();
    // TODO(dlaliberte): The bounding box should be updated here.
    ctx.translate(cx, cy);
    ctx.scale(rx / radius, ry / radius);
    // GViz's notion of clockwise is opposite what canvas expects, hence the
    // negation on the "isClockwise" parameter.
    ctx.arc(0, 0, radius, fromAngle, toAngle, !isClockwise);
    ctx.restore();
  }

  setOffset(element: Element, dx: number, dy: number) {} // unimplemented.

  setWidth(element: Element, width: number) {} // unimplemented.

  setHeight(element: Element, height: number) {} // unimplemented.

  setLeftPosition(element: Element, left: number) {} // unimplemented.

  setTopPosition(element: Element, top: number) {} // unimplemented.

  /**
   * Change the stroke width of a drawing element
   *
   * @param element A drawing object (element).
   * @param color The color for the element. If null, color is not modified.
   * @param width The new stroke width.
   */
  setStroke(element: Element, color: string, width: number) {} // unimplemented.

  /**
   * @param text The text to measure.
   * @param textStyle The text style.
   * In the future, the technique can be replaced by using the getBBBox() method on SVG elements, if it becomes faster.
   */
  getTextSizeInternal(
    text: string,
    textStyle: TextStyle,
    rotation?: number,
  ): Size {
    asserts.assert(this.textCtx != null);
    this.setTextFromStyle(this.textCtx, textStyle);
    const width = this.textCtx.measureText(text).width;
    // TODO(dlaliberte): Our height calculation is incorrect. It's not easy getting
    // text height from canvas. You have to create a dummy div, set the style,
    // and then move the text around within the div. Check here:
    // http://stackoverflow.com/questions/1134586/how-can-you-find-the-height-of-text-on-an-html-canvas
    return new Size(width, textStyle.fontSize);
  }

  getScrollbarSize(): number {
    // unimplemented.
    return 0;
  }

  setBrush(element: Element, brush: Brush, allowImplicitOutline?: boolean) {}
}
