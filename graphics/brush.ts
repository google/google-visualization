/**
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

import {isObject} from 'google3/javascript/common/asserts/guards';
import {assert} from '@npm//@closure/asserts/asserts';
import {clamp} from '@npm//@closure/math/math';

import * as gvizJson from '../common/json';
import {unsafeClone} from '../common/object';

import {Pattern} from './pattern';
import {PatternStyle, StrokeDashStyle, StrokeDashStyleType} from './types';
import {NO_COLOR, blendHexColors, grayOutColor, parseColor} from './util';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Brush contains all the attributes typically associated with drawing.
 * Fill and stroke color and opacity, and stroke width, stroke dash style,
 * fill pattern and gradient, box corner radius and box shadow.
 */
export class Brush {
  /**
   * Static transparent brush properties.
   * There must be a fill which is not 'none' here, because we want this brush
   * to have events attached to it, and without the fill there's nothing to
   * catch the events.
   */
  static readonly TRANSPARENT_BRUSH: Partial<BrushProperties> = {
    stroke: 'white',
    strokeOpacity: 0,
    fill: 'white',
    fillOpacity: 0,
  };

  /**
   * Default stroke width.
   */
  static readonly DEFAULT_STROKE_WIDTH: number = 1;

  /**
   * Default stroke opacity. One means not transparent at all - completely
   * solid.
   */
  static readonly DEFAULT_STROKE_OPACITY: number = 1;

  /**
   * Default stroke dash style.
   */
  static readonly DEFAULT_STROKE_DASH_STYLE: StrokeDashStyle =
    StrokeDashStyleType.SOLID;

  /**
   * Default fill opacity. One means not transparent at all - completely solid.
   */
  static readonly DEFAULT_FILL_OPACITY: number = 1;
  private fill: string;
  private fillOpacity: number;
  private stroke: string;
  private strokeWidth: number;
  private strokeOpacity: number;
  private strokeDashStyle: StrokeDashStyle;

  /**
   * The x radius of corners.
   * The null default value is relied upon by ellispse rendering.
   * TODO(dlaliberte): Fix ellipse rendering to not rely on null radius.
   */
  private radiusX: number | null = null;

  /**
   * The y radius of corners.
   */
  private radiusY: number | null = null;

  /**
   * The fill gradient of the brush.
   */
  private gradient: Gradient | null = null;

  /**
   * The fill pattern of the brush.
   */
  private pattern: Pattern | null = null;

  /**
   * The drop shadow of the brush.
   */
  private shadow: Shadow | null = null;
  /**
   * Constructor for a brush.
   * Some properties always have a non-null value, even if it is a 'zero' like
   * 'transparent' or 'none'.  The setters (e.g. setFill()) for these
   * do nothing with null or undefined, rather than set the property to null.
   * Some properties have no default value, and the setters for these (e.g.
   * setGradient()) will reset the value to null, given null or undefined.
   *
   * @param brushProps An object that is used to construct a Brush object from.
   *     If null or missing, or if any of the properties is null or missing,
   *     the corresponding default value will be used.
   */
  constructor(brushProps: Partial<BrushProperties> = {}) {
    /**
     * The color of the brush.
     */
    this.fill = NO_COLOR;

    /**
     * The fill opacity of the brush. A number in the range [0,1].
     */
    this.fillOpacity = Brush.DEFAULT_FILL_OPACITY;

    /**
     * The color of the stroke of the brush.
     */
    this.stroke = NO_COLOR;

    /**
     * The width of the stroke of the brush.
     * Must be non-negative
     */
    this.strokeWidth = Brush.DEFAULT_STROKE_WIDTH;

    /**
     * The stroke opacity of the brush. A number in the range [0,1].
     */
    this.strokeOpacity = Brush.DEFAULT_STROKE_OPACITY;

    /**
     * The stroke dash style of the brush.
     */
    this.strokeDashStyle = Brush.DEFAULT_STROKE_DASH_STYLE;

    this.setProperties(brushProps);
  }

  setProperties(brushProps: Partial<BrushProperties> | null = {}): Brush {
    if (!brushProps) {
      brushProps = {};
    }
    this.setFill(brushProps.fill);
    this.setFillOpacity(brushProps.fillOpacity);
    this.setStroke(brushProps.stroke);
    this.setStrokeWidth(brushProps.strokeWidth);
    this.setStrokeOpacity(brushProps.strokeOpacity);
    this.setStrokeDashStyle(brushProps.strokeDashStyle);
    this.setRadiusX(brushProps.rx);
    this.setRadiusY(brushProps.ry);
    this.setPattern(brushProps.pattern);
    this.setGradient(brushProps.gradient);
    this.setShadow(brushProps.shadow);

    return this;
  }

  /**
   * Returns a BrushProperties object representing the current
   * value of the brush.  This is basically a clone.
   */
  getProperties(): BrushProperties {
    const pattern = this.getPattern();
    let patternProps = null;
    if (pattern) {
      patternProps = {
        style: pattern.getStyle(),
        color: pattern.getColor(),
        bgcolor: pattern.getBackgroundColor(),
      };
    }
    return {
      fill: this.getFill(),
      fillOpacity: this.getFillOpacity(),
      stroke: this.getStroke(),
      strokeWidth: this.getStrokeWidth(),
      strokeOpacity: this.getStrokeOpacity(),
      strokeDashStyle: this.getStrokeDashStyle(),
      rx: this.getRadiusX(),
      ry: this.getRadiusY(),
      pattern: patternProps,
      // Note: unsafeClone of null is null.
      gradient: unsafeClone(this.getGradient()),
      shadow: unsafeClone(this.getShadow()),
    };
  }

  /**
   * Returns a JSON string that represents the brush.
   * @return a JSON encoded string.
   */
  toJSON(): string {
    let gradient = this.getGradient();
    if (gradient) {
      gradient = {
        'color1': gradient.color1,
        'color2': gradient.color2,
        'opacity1': gradient.opacity1,
        'opacity2': gradient.opacity2,
        'x1': gradient.x1,
        'y1': gradient.y1,
        'x2': gradient.x2,
        'y2': gradient.y2,
        'useObjectBoundingBoxUnits': gradient.useObjectBoundingBoxUnits,
        'sharpTransition': gradient.sharpTransition,
      };
    }
    const pattern = this.getPatternProperties();
    let shadow = this.getShadow();
    if (shadow) {
      shadow = {
        'radius': shadow.radius,
        'opacity': shadow.opacity,
        'xOffset': shadow.xOffset,
        'yOffset': shadow.yOffset,
      };
    }
    const properties = {
      'fill': this.getFill(),
      'fillOpacity': this.getFillOpacity(),
      'stroke': this.getStroke(),
      'strokeWidth': this.getStrokeWidth(),
      'strokeOpacity': this.getStrokeOpacity(),
      'strokeDashStyle': this.getStrokeDashStyle(),
      'rx': this.getRadiusX(),
      'ry': this.getRadiusY(),
      'gradient': gradient,
      'pattern': pattern,
      'shadow': shadow,
    };
    return gvizJson.stringify(properties);
  }

  /**
   * Creates a copy of the brush with the same properties.
   * @return A clone of this Brush.
   */
  clone(): Brush {
    return new Brush(this.getProperties());
  }

  /**
   * Returns a grayed-out copy of this brush.
   * @return A gray-out copy of this Brush.
   */
  grayOut(): Brush {
    const newBrush = this.clone();

    // We need to gray out the fill and stroke.
    newBrush.setFill(grayOutColor(this.fill));
    newBrush.setStroke(grayOutColor(this.stroke));

    // We need to separately take care of the gradient and pattern which also
    // have colors in them.
    const gradient = this.getGradient();
    if (gradient) {
      const newGradient: Gradient = {...gradient} as Gradient;
      newGradient.color1 = grayOutColor(gradient.color1);
      newGradient.color2 = grayOutColor(gradient.color2);
      newBrush.setGradient(newGradient as Gradient | null);
    }

    if (this.pattern) {
      newBrush.setPattern(this.pattern.grayOut());
    }

    return newBrush;
  }

  /**
   * Sets the fill color of the brush.
   * An empty string will be parsed as NO_COLOR.
   * @param fill The color to set.
   * @return This brush.
   */
  setFill(fill: string | null | undefined): Brush {
    if (fill != null) {
      this.fill = parseColor(fill, true);
    }
    return this;
  }

  /**
   * Returns the fill color of the brush.
   * @return The fill color of the brush.
   */
  getFill(): string {
    return this.fill;
  }

  /**
   * Sets the fill opacity of the brush.
   * Will be clamped to range [0,1].
   * @param fillOpacity The fill opacity.
   * @return This brush.
   */
  setFillOpacity(fillOpacity: number | null | undefined): Brush {
    if (fillOpacity != null) {
      this.fillOpacity = clamp(fillOpacity, 0, 1);
    }
    return this;
  }

  /**
   * Returns the fill opacity of the brush.
   * @return The fill opacity of the brush.
   */
  getFillOpacity(): number {
    return this.fillOpacity;
  }

  /**
   * Sets the stroke color of the brush.  Optionally, also set the stroke width.
   * An empty string for the color will be parsed as NO_COLOR.
   * @param stroke The color to set.
   * @param strokeWidth If given, sets also the stroke width.
   * @return This brush.
   */
  setStroke(stroke: string | null | undefined, strokeWidth?: number): Brush {
    if (stroke != null) {
      this.stroke = parseColor(stroke, true);
    }
    this.setStrokeWidth(strokeWidth);
    return this;
  }

  /**
   * Returns the stroke color of the brush.
   * @return The stroke color of the brush.
   */
  getStroke(): string {
    return this.stroke;
  }

  /**
   * Sets the width of the stroke of the brush.
   * Zero strokeWidth IS allowed.
   * @param strokeWidth The stroke width.
   * @return This brush.
   */
  setStrokeWidth(strokeWidth: string | null | number | undefined): Brush {
    if (strokeWidth != null) {
      if (typeof strokeWidth === 'string') {
        strokeWidth = Number(strokeWidth);
      }
      if (typeof strokeWidth === 'number' && !isNaN(strokeWidth)) {
        if (strokeWidth < 0) {
          throw new Error('Negative strokeWidth not allowed.');
        } else if (strokeWidth >= 0) {
          this.strokeWidth = strokeWidth;
        }
      }
    }
    return this;
  }

  /**
   * Returns the width of the stroke of the brush.
   * @return The width of the stroke of the brush.
   */
  getStrokeWidth(): number {
    return this.strokeWidth;
  }

  /**
   * Returns the visible width of the stroke of the brush, i.e. if this brush
   * doesn't have a stroke return 0 even if the width is set to another value.
   * @return The visible width of the stroke of the brush.
   */
  getVisibleStrokeWidth(): number {
    return this.hasStroke() ? this.getStrokeWidth() : 0;
  }

  /**
   * Sets the stroke opacity of the brush.
   * @param strokeOpacity The stroke opacity.
   *     Should be in range [0,1].
   * @return This brush.
   */
  setStrokeOpacity(strokeOpacity: string | null | number | undefined): Brush {
    if (strokeOpacity != null) {
      this.strokeOpacity = clamp(Number(strokeOpacity), 0, 1);
    }
    return this;
  }

  /**
   * Returns the stroke opacity of the brush.
   * @return The stroke opacity of the brush.
   */
  getStrokeOpacity(): number {
    return this.strokeOpacity;
  }

  /**
   * Sets the stroke dash style of the brush.
   * @return This brush.
   */
  setStrokeDashStyle(
    strokeDashStyle: StrokeDashStyle | null | undefined,
  ): Brush {
    if (strokeDashStyle != null) {
      this.strokeDashStyle = strokeDashStyle;
    }
    return this;
  }

  /**
   * Returns the stroke dash style of the brush.
   */
  getStrokeDashStyle(): StrokeDashStyle {
    return this.strokeDashStyle;
  }

  /**
   * Sets the x radius of the brush.
   * @param radiusX The x radius of the brush.
   * @return This brush.
   */
  setRadiusX(radiusX: number | null | undefined): Brush {
    if (radiusX != null) {
      this.radiusX = radiusX;
    }
    return this;
  }

  /**
   * Returns the x radius of the brush.
   * @return The x radius of the brush.
   */
  getRadiusX(): number | null {
    return this.radiusX;
  }

  /**
   * Sets the y radius of the brush.
   * @param radiusY The y radius of the brush.
   * @return This brush.
   */
  setRadiusY(radiusY: number | null | undefined): Brush {
    if (radiusY != null) {
      this.radiusY = radiusY;
    }
    return this;
  }

  /**
   * Returns the y radius of the brush.
   * @return The y radius of the brush.
   */
  getRadiusY(): number | null {
    return this.radiusY;
  }

  /**
   * Sets the gradient of the brush.
   * Empty strings for the colors will be parsed as NO_COLOR.
   * @return This brush.
   */
  setGradient(gradient: Gradient | null | undefined): Brush {
    if (this.gradient === null) {
      // Since the current gradient is null, then we can just overwrite with
      // a clone of the gradient argument.
      // Note: unsafeClone of undefined is undefined, but we want null.
      this.gradient = unsafeClone(gradient || null);
    } else if (gradient != null) {
      Object.assign(this.gradient, gradient);

      // Special case: replace falsey colors with NO_COLOR.
      gradient.color1 = parseColor(gradient.color1 || '', true);
      gradient.color2 = parseColor(gradient.color2 || '', true);

      // Delete some properties if null.
      // Not critical, but some tests still rely on this.
      // TODO(dlaliberte): Avoid doing this.
      if (gradient.opacity1 === null) {
        delete gradient.opacity1;
      }
      if (gradient.opacity2 === null) {
        delete gradient.opacity2;
      }

      if (gradient.useObjectBoundingBoxUnits === null) {
        delete gradient.useObjectBoundingBoxUnits;
      }
      if (gradient.sharpTransition === null) {
        delete gradient.sharpTransition;
      }
    }
    return this;
  }

  /**
   * Returns the gradient of the brush.
   * @return The gradient fill.
   */
  getGradient(): Gradient | null {
    return this.gradient;
  }

  /**
   * Sets the pattern of the brush.
   * @param pattern The fill pattern.
   * @return This brush.
   */
  setPattern(pattern?: Pattern | PatternProperties | null): Brush {
    if (pattern) {
      if (pattern instanceof Pattern) {
        this.pattern = pattern.clone();
      } else {
        this.pattern = new Pattern(
          pattern.style,
          pattern.color,
          pattern.bgcolor,
        );
      }
    }
    return this;
  }

  /**
   * Returns the pattern of the brush.
   * @return The fill pattern of the brush.
   */
  getPattern(): Pattern | null {
    return this.pattern;
  }

  getPatternProperties(): Partial<PatternProperties> {
    if (!this.pattern) {
      return {};
    }
    return {
      style: this.pattern.getStyle(),
      color: this.pattern.getColor(),
      bgcolor: this.pattern.getBackgroundColor(),
    };
  }

  /**
   * @return True if this brush has a shadow component.
   */
  hasShadow(): boolean {
    return this.shadow != null;
  }

  /**
   * Sets the shadow to a given object.
   * @param shadow Can be null to clear the shadow.
   * @return This brush.
   */
  setShadow(shadow: Shadow | null | undefined): Brush {
    this.shadow = shadow || null;
    return this;
  }

  /**
   * @return The shadow object stored in
   *     this brush, or null if none.
   */
  getShadow(): Shadow | null {
    return this.shadow;
  }

  /**
   * Checks if the brush has a fill of some kind.
   * Could be a non-transparent fill color, a gradient or a pattern.
   * Zero fill opacity means nothing visible, so no fill.
   * @return true if has fill, otherwise false.
   */
  hasFill(): boolean {
    return (
      this.fillOpacity > 0 &&
      (!Brush.isNoColor(this.fill) ||
        this.hasGradient() ||
        this.pattern != null)
    );
  }

  /**
   * Checks if the brush has a stroke.
   * Zero stroke width means no stroke.
   * @return true if has stroke, otherwise false.
   */
  hasStroke(): boolean {
    return (
      this.strokeWidth > 0 &&
      this.strokeOpacity > 0 &&
      !Brush.isNoColor(this.stroke)
    );
  }

  /**
   * Checks if the brush has a gradient.
   * @return true if has gradient, otherwise false.
   */
  hasGradient(): boolean {
    return this.gradient != null;
  }

  /**
   * Checks if the stroke has a non-solid dash style.
   * @return true if stroke has a dash style, otherwise false.
   */
  strokeHasDashStyle(): boolean {
    // Note that we want to check whether the dash style is solid regardless of
    // DEFAULT_STROKE_DASH_STYLE being SOLID or not.
    return this.strokeDashStyle !== StrokeDashStyleType.SOLID;
  }

  /**
   * Checks if a color value is transparent.
   * Undefined or null is considered as transparent.
   * This has nothing to do with opacity, yet.  The color must be the same
   * as NO_COLOR, or it must be null or undefined or an empty string, or
   * it may be an object with a color property that isNoColor.
   * @param color The color to check.
   * @return true if transparent, otherwise false.
   */
  private static isNoColor(
    color: AnyDuringMigration | null | string | undefined,
  ): boolean {
    return (
      color === null ||
      color === '' ||
      color === NO_COLOR ||
      (isObject(color) && Brush.isNoColor((color as AnyDuringMigration).color))
    );
  }

  /**
   * Checks if the brush is completely transparent - no fill and no stroke.
   * @return true if transparent, otherwise false.
   */
  isTransparent(): boolean {
    return !this.hasFill() && !this.hasStroke();
  }

  /**
   * Checks whether fill color has no transparency whatsoever.
   * No fill means it's not opaque.
   * @return true if opaque, otherwise false.
   */
  isFillOpaque(): boolean {
    return this.hasFill() && this.fillOpacity >= 1;
  }

  /**
   * Checks whether stroke color has no transparency whatsoever.
   * No stroke means it's not opaque.
   * @return true if opaque, otherwise false.
   */
  isStrokeOpaque(): boolean {
    return this.hasStroke() && this.strokeOpacity >= 1;
  }

  /**
   * Checks whether fill is opaque, and if a stroke is present whether it is
   * opaque as well.
   * @return true if opaque, otherwise false.
   */
  isOpaque(): boolean {
    return (
      this.isFillOpaque() && (this.hasStroke() ? this.isStrokeOpaque() : true)
    );
  }

  /**
   * Tests whether two given brushes are equal.
   * @param that The 2nd brush.
   * @return true if the two brushes are equal.
   */
  equals(that: Brush): boolean {
    // Both this and that must be non-null.
    return (
      this.fill === that.fill && //
      this.fillOpacity === that.fillOpacity && //
      this.stroke === that.stroke && //
      this.strokeWidth === that.strokeWidth &&
      this.strokeOpacity === that.strokeOpacity &&
      this.strokeDashStyle === that.strokeDashStyle &&
      this.radiusX === that.radiusX &&
      this.radiusY === that.radiusY && //
      Brush.gradientEquals(this.gradient, that.gradient) &&
      Pattern.equals(this.pattern || null, that.pattern || null)
    );
  }

  /**
   * Creates a brush for filling a shape.
   * The color can actually be an object, but it must have a color property.
   *
   * @param color The color of the fill.
   * @param opacity The opacity of the fill, 1 by default.
   *
   * @return The brush.
   */
  static createFillBrush(
    color: AnyDuringMigration | string,
    opacity: number | null = 1,
  ): Brush {
    assert(
      typeof color === 'string' ||
        (isObject(color) && (color as AnyDuringMigration).color != null),
    );
    return new Brush({
      stroke: 'none',
      // Pretend color is always a string for now.
      // TODO(dlaliberte): Fix this.
      fill: color as string,
      fillOpacity: opacity,
    });
  }

  /**
   * Creates a brush for drawing a line/stroke of a shape.
   *
   * @param color The color of the line.
   * @param width The width of the line.
   * @param whiteFill if true use a white fill, otherwise use
   *     no fill. Default is false.
   * @param opacity The stroke opacity.
   *
   * @return The stroke brush.
   */
  static createStrokeBrush(
    color: string, //
    width: number, //
    whiteFill?: boolean, //
    opacity?: number,
  ): Brush {
    whiteFill = whiteFill != null ? whiteFill : false;
    return new Brush({
      stroke: color,
      strokeWidth: width,
      strokeOpacity: opacity != null ? opacity : 1,
      fill: whiteFill ? '#fff' : 'none',
    });
  }

  /**
   * Blends the fill of a foreground and a background brush to obtain a new
   * opaque fill color. If neither the foreground nor the background are opaque,
   * return null (because we can't know the color behind the background which
   * must be taken into account).
   * @param foreBrush The foreground brush.
   * @param backBrush The background brush.
   * @return An RGB color string, or null.
   */
  static blendFills(foreBrush: Brush, backBrush: Brush): string | null {
    if (foreBrush.isFillOpaque()) {
      // The foreground brush is opaque, so the blend is simply its color.
      return foreBrush.getFill();
    }
    if (backBrush.isFillOpaque()) {
      if (!foreBrush.hasFill()) {
        // The background brush is opaque and the foreground brush is
        // transparent, so the blend is simply the background color.
        return backBrush.getFill();
      }
      // The background is opaque and the foreground can be seen through.
      return blendHexColors(
        foreBrush.getFill(),
        backBrush.getFill(),
        foreBrush.getFillOpacity(),
      );
    }
    // Both the foreground and the background brushes are fully or partially
    // transparent, so the color behind the background will show through.
    // We can't know what that color is, so we return null.
    return null;
  }

  /**
   * Tests whether two given brushes are equal.
   * @param a The 1st brush.
   * @param b The 2nd brush.
   * @return true if the two brushes are equal.
   */
  static equals(a: Brush | null, b: Brush | null): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null) {
      return false;
    }

    return a.equals(b);
  }

  /**
   * Tests whether two given gradients are equal.
   * @param a The 1st gradient.
   * @param b The 2nd gradient.
   * @return true if the two gradients are equal.
   */
  static gradientEquals(a: Gradient | null, b: Gradient | null): boolean {
    if (a === b) {
      return true;
    }

    if (a === null || b === null) {
      return false;
    }

    return (
      a.color1 === b.color1 &&
      a.color2 === b.color2 &&
      a.x1 === b.x1 &&
      a.y1 === b.y1 &&
      a.x2 === b.x2 &&
      a.y2 === b.y2 &&
      a.useObjectBoundingBoxUnits === b.useObjectBoundingBoxUnits &&
      a.sharpTransition === b.sharpTransition
    );
  }
}

/**
 * Calculates the radius in which to draw a point, given a brush and a desired
 * "visible" radius (including the stroke).
 *
 * @param brush The brush.
 * @param desiredRadius The desired visible radius.
 * @return the radius in which to draw the point.
 */
export function calcCompensatedPointRadius(
  brush: Brush,
  desiredRadius: number,
): number {
  // Calculate the radius needed in order to match the target visible radius.
  const radius = desiredRadius - brush.getVisibleStrokeWidth() / 2;
  return Math.max(radius, 0);
}

/**
 * Properties of a Brush option.
 */
export interface BrushProperties {
  fill: string | null | undefined;
  fillOpacity: number | null | undefined;
  stroke: string | null | undefined;
  strokeWidth: string | null | number | undefined;
  strokeOpacity: string | null | number | undefined;
  strokeDashStyle: StrokeDashStyle | null | undefined;
  rx: number | null | undefined;
  ry: number | null | undefined;
  pattern: Pattern | PatternProperties | null | undefined;
  gradient: Gradient | null | undefined;
  shadow: Shadow | null | undefined;
}

/**
 * Properties of a Pattern
 * TODO: move to pattern.ts
 */
export interface PatternProperties {
  style: PatternStyle;
  color: string;
  bgcolor: string;
}

/**
 * Properties of a Gradient option.
 */
export interface Gradient {
  color1: string;
  color2: string;
  opacity1: number | null | undefined;
  opacity2: number | null | undefined;
  x1: string | number;
  y1: string | number;
  x2: string | number;
  y2: string | number;
  useObjectBoundingBoxUnits: boolean | null | undefined;
  sharpTransition: boolean | null | undefined;
}

/**
 * Properties of a Shadow option.
 */
export interface Shadow {
  radius: number | null | undefined;
  opacity: number | null | undefined;
  xOffset: number | null | undefined;
  yOffset: number | null | undefined;
}
