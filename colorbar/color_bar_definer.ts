/**
 * @fileoverview ColorBar definer.
 * Calculates the measures needed to draw the color-bar.
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

import {Box} from '@npm//@closure/math/box';
import {ColorBarPosition} from '../common/option_types';
import {Options as GvizOptions} from '../common/options';
import {TextMeasureFunction} from '../text/text_measure_function';
import {TextStyle} from '../text/text_style';

import * as definer from './definer';
import {Scale} from './scale';
import {Orientation} from './types';

import {ColorBarDefinition} from './color_bar_definition';

/**
 * A color-bar definer constructor.
 * This class is responsible for calculating color-bar definition.
 * @unrestricted
 */
export class ColorBarDefiner {
  private readonly position: ColorBarPosition;

  private readonly textStyle: TextStyle;

  private readonly numberFormat: string | null;

  private area: Box | null = null;

  private scale: Scale | null = null;

  private readonly textMeasureFunction: TextMeasureFunction;

  /**
   * @param options The options.
   * @param defaultPosition The default
   *     color-bar position. If null, ignore user's request and always use NONE.
   * @param defaultFontName The default font name.
   * @param defaultFontSize The default font size.
   * @param insideLabelsAuraColor The inside labels aura color.
   * @param textMeasureFunction The text measure function.
   */
  constructor(
    options: GvizOptions,
    defaultPosition: ColorBarPosition | null,
    defaultFontName: string,
    defaultFontSize: number,
    insideLabelsAuraColor: string,
    textMeasureFunction: TextMeasureFunction,
  ) {
    const optionsPath = Scale.OPTIONS_PATH + '.legend.';

    this.position = defaultPosition
      ? (options.inferStringValue(
          `${optionsPath}position`,
          defaultPosition,
          ColorBarPosition,
        ) as ColorBarPosition)
      : ColorBarPosition.NONE;

    const defaultTextStyle = {
      fontName: defaultFontName,
      fontSize: defaultFontSize,
      auraColor:
        this.position === ColorBarPosition.INSIDE
          ? insideLabelsAuraColor
          : 'none',
    };

    this.textStyle = options.inferTextStyleValue(
      `${optionsPath}textStyle`,
      defaultTextStyle,
    );

    this.textMeasureFunction = textMeasureFunction;

    this.numberFormat = options.inferOptionalStringValue(
      `${optionsPath}numberFormat`,
    );
  }

  /**
   * Returns the color-bar position.
   * @return The color-bar position.
   */
  getPosition(): ColorBarPosition {
    return this.position;
  }

  /**
   * Returns the color-bar text style.
   * @return The color-bar text style.
   */
  getTextStyle(): TextStyle {
    return this.textStyle;
  }

  /**
   * Returns the color-bar height.
   * @return The color-bar height.
   */
  getHeight(): number {
    return this.textStyle.fontSize * 1.5;
  }

  /**
   * Returns the color-bar area.
   * @return The color-bar area.
   */
  getArea(): Box | null {
    return this.area;
  }

  /**
   * Sets the color-bar area. A reference to the given box object is stored
   * inside, so its content shouldn't be changed externally.
   * @param area The color-bar area.
   */
  setArea(area: Box) {
    this.area = area;
  }

  /**
   * Sets the color scale for the color-bar.
   * @param scale The color scale.
   */
  setScale(scale: Scale) {
    this.scale = scale;
  }

  /**
   * Calculates the color-bar definition.
   * @return The color-bar definition.
   */
  define(): ColorBarDefinition | null {
    if (!this.area || !this.scale) {
      return null;
    }

    const drawingOptions = {
      top: this.area.top,
      left: this.area.left,
      width: this.area.right - this.area.left,
      height: this.area.bottom - this.area.top,
      orientation: Orientation.HORIZONTAL,
      textStyle: this.textStyle,
      markerColor: 'black',
      numberFormat: this.numberFormat,
    };

    const definition = definer.define(
      this.scale,
      drawingOptions,
      [],
      this.textMeasureFunction,
    );
    if (definition == null) {
      return null;
    }

    return {
      position: this.position,
      scale: this.scale,
      drawingOptions,
      definition,
    };
  }
}
