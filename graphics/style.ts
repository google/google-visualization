/**
 * @fileoverview Some utilities to facilitate parsing CSS style.
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

import {
  filter,
  forEach,
  map,
} from '@npm//@closure/array/array';
import {isValidColor} from '@npm//@closure/color/color';
import * as googObject from '@npm//@closure/object/object';
import {
  contains,
  trim,
} from '@npm//@closure/string/string';
import {parseStyleAttribute} from '@npm//@closure/style/style';

import * as gvizJson from '../common/json';
import {Options} from '../common/options';

import {TextStyle} from '../text/text_style';
import {Brush} from './brush';

// tslint:disable:ban-types Migration

/**
 * Parses CSS rules into an object, where each CSS selector is mapped to
 * a style object. The css input must be in the form:
 * "s1, s2 { a-b: c; } s3 { def: 456 }"
 *
 * The selectors themselves won't be processed in any way.
 * The css attributes will be parsed with parseStyleAttribute.
 * I.e. attribute names are camel cased, and values are always strings.
 *
 * The return value, for the above will be this object:
 * { s1: { aB: c }, s2: { aB: c }, s3: { def: '456' } } * Currently, the method
 * throws random errors for bad syntax.
 *
 * @param css The CSS rules that should be parsed.
 * @return The processed CSS style.
 */
export function parseStyle(css: string): {
  [key: string]: {[key: string]: AnyDuringMigration};
} {
  const ruleSets = filter(
    css.split('}'),
    (item) => item != null && trim(item) !== '',
  );
  const rules = {};
  for (let i = 0; i < ruleSets.length; i++) {
    const ruleSet = ruleSets[i].split('{');
    const selectors = map(ruleSet[0].split(','), trim);
    const style = parseStyleAttribute(trim(ruleSet[1]));
    if (selectors.length === 0) {
      Object.assign(rules, style);
    } else {
      forEach(selectors, (selector) => {
        (rules as AnyDuringMigration)[selector] =
          (rules as AnyDuringMigration)[selector] || {};
        Object.assign((rules as AnyDuringMigration)[selector], style);
      });
    }
  }
  return rules;
}

interface NormalizationRule {
  input: string;
  output: string[];
}

/**
 * An array of normalization rules for regular brushes. This structure is an
 * array because one input (for example 'fillColor') may override another input
 * (for example 'color'), and the override rules have to be clear.
 */
export const BRUSH_NORMALIZATION_RULES: NormalizationRule[] = [
  {input: 'color', output: ['fill.color', 'stroke.color']},
  {input: 'opacity', output: ['fill.opacity', 'stroke.opacity']},
  {input: 'fillColor', output: ['fill.color']},
  {input: 'fillOpacity', output: ['fill.opacity']},
  {input: 'strokeColor', output: ['stroke.color']},
  {input: 'strokeOpacity', output: ['stroke.opacity']},
  {input: 'strokeWidth', output: ['stroke.width']},
];

/**
 * An array of normalization rules for text styles. This structure is an array
 * because one input (for example 'fillColor') may override another input (for
 * example 'color'), and the override rules have to be clear.
 */
export const TEXT_NORMALIZATION_RULES: NormalizationRule[] = [
  {input: 'color', output: ['fill.color']},
  {input: 'opacity', output: ['fill.opacity']},
  {input: 'fillColor', output: ['fill.color']},
  {input: 'fillOpacity', output: ['fill.opacity']},
  {input: 'strokeColor', output: ['stroke.color']},
  {input: 'strokeOpacity', output: ['stroke.opacity']},
  {input: 'strokeWidth', output: ['stroke.width']},
  {input: 'fontSize', output: ['font.size']},
  {input: 'fontFamily', output: ['font.family']},
  {input: 'bold', output: ['font.bold']},
  {input: 'italic', output: ['font.italic']},
  {input: 'underline', output: ['font.underline']},
];

/**
 * Normalizes a style to be in the structure that we normally expect.
 * @param style The style object.
 * @param mapping The mapping of how to normalize the style.
 * @return The normalized style.
 */
export function normalizeStyle(
  style: AnyDuringMigration,
  mapping: NormalizationRule[],
): AnyDuringMigration {
  const output = {
    'fill': {},
    'stroke': {},
  };
  const styleOptions = new Options([style]);
  for (let i = 0; i < mapping.length; i++) {
    const styleMapping = mapping[i];
    const input = styleMapping.input;
    const outputPaths = styleMapping.output;
    const value = styleOptions.inferValue(input);
    if (value != null) {
      for (let j = 0; j < outputPaths.length; j++) {
        goog.exportSymbol(outputPaths[j], value, output);
      }
    }
  }
  // TODO(dlaliberte) Should we remove empty fill and stroke?
  return output;
}

/**
 * Normalizes a style to be in the structure that we normally expect.
 * @param input The input object
 * @return The normalized style.
 */
export function defaultNormalize(
  input: AnyDuringMigration,
): AnyDuringMigration {
  return normalizeStyle(input, BRUSH_NORMALIZATION_RULES);
}

/**
 * Normalizes a style with text properties to be in the structure that we
 * expect.
 * @param input The unnormalized style.
 * @return The normalized style.
 */
export function textNormalize(input: AnyDuringMigration): AnyDuringMigration {
  return normalizeStyle(input, TEXT_NORMALIZATION_RULES);
}

/**
 * Processes a style string into an Object. The style must be one of:
 *   - A simple color, in which case that color is assigned to the fill and
 *       stroke colors.
 *   - A strict JSON string representation of the style (braces required),
 *       in the following form:
 *     '{
 *       "fill": (string|{
 *         "color": string,
 *         "opacity": number
 *       }),
 *       "stroke": (string|{
 *         "color": string,
 *         "opacity": number,
 *         "width": number
 *       })
 *     }'
 *       It may also have the properties 'line', 'bar', or 'point', each with
 *       a nested object like the one outlined above.
 *   - A simple CSS style, which will be applied to any type of datum.
 *   - A complex CSS style, with which you can(/have to) specify exactly what
 *       series types each style applies to. Valid selectors are line, bar, and
 *       point.
 * The following properties are supported in CSS format:
 *   color, opacity, fill-color, fill-opacity, stroke-color, stroke-opacity,
 *   stroke-width
 *
 * @param style The style string.
 * @param normalize The normalization function.
 * @return The processed style object, or undefined if the
 *     style was invalid.
 */
export function processStyleString(
  style: string,
  normalize: (p1: AnyDuringMigration) => AnyDuringMigration = defaultNormalize,
): AnyDuringMigration | void {
  if (style == null) {
    return {};
  }
  let customStyle;
  style = trim(style);
  if (isValidColor(style)) {
    // The user has specified a color string.
    customStyle = normalize({'color': style});
  } else if (style.charAt(0) === '{') {
    // If the string starts with a brace, try parsing it as JSON.
    try {
      const customStylePOJO = gvizJson.parse(style);
      if (customStylePOJO != null) {
        customStyle = customStylePOJO;
      }
    } catch (e: unknown) {}
  }

  if (customStyle == null) {
    // Either the JSON parsing never started, or failed.
    // We still haven't succeeded in figuring out what the user gave us.
    // At this point, the only other thing they could have done is either
    // specified CSS attributes ("stroke-color: #f00; stroke-width: 3") or
    // specified CSS attributes with what they apply to.
    if (contains(style, '{')) {
      customStyle = googObject.map(parseStyle(style), normalize);
      // If the style contains the empty string as a key, that means that it
      // should be applied to everything.
      if (googObject.containsKey(customStyle, '')) {
        Object.assign(customStyle, customStyle['']);
        googObject.remove(customStyle, '');
      }
      if (googObject.containsKey(customStyle, '*')) {
        Object.assign(customStyle, customStyle['*']);
        googObject.remove(customStyle, '*');
      }
    } else {
      customStyle = normalize(parseStyleAttribute(style));
    }
  }
  return customStyle;
}

/**
 * Applies the given style to the brush.
 * @param style The style to apply.
 * @param brush The brush to modify.
 * @param subpath An optional subpath under which the style should
 *     be searched.
 * @param onlyFillOrStroke If this argument is 'fill', only the
 *     fill style will be applied, and if this argument is 'stroke', then only
 *     the stroke style will be applied. The value of this argument is ignored
 *     otherwise.
 */
export function applyToBrush(
  style: Options,
  brush: Brush,
  subpath = '',
  onlyFillOrStroke?: string,
) {
  if (onlyFillOrStroke !== 'stroke') {
    brush.setFill(
      style.inferColorValue(
        [`${subpath}fill.color`, `${subpath}fill`],
        brush.getFill(),
      ),
    );
    brush.setFillOpacity(
      style.inferRatioNumberValue(
        `${subpath}fill.opacity`,
        brush.getFillOpacity(),
      ),
    );
  }

  if (onlyFillOrStroke !== 'fill') {
    brush.setStroke(
      style.inferColorValue(
        [`${subpath}stroke.color`, `${subpath}stroke`],
        brush.getStroke(),
      ),
    );
    brush.setStrokeOpacity(
      style.inferRatioNumberValue(
        `${subpath}stroke.opacity`,
        brush.getStrokeOpacity(),
      ),
    );
    brush.setStrokeWidth(
      style.inferNumberValue(`${subpath}stroke.width`, brush.getStrokeWidth()),
    );
  }
}

/**
 * Applies the given style to the textStyle.
 * @param style The normalized style.
 * @param textStyle The text style,
 */
export function applyToTextStyle(style: Options, textStyle: TextStyle) {
  textStyle.color = style.inferStringValue('fill.color', textStyle.color);
  textStyle.opacity = style.inferNumberValue('fill.opacity', textStyle.opacity);
  textStyle.auraColor = style.inferStringValue(
    'stroke.color',
    textStyle.auraColor,
  );
  textStyle.fontName = style.inferStringValue(
    'font.family',
    textStyle.fontName,
  );
  textStyle.fontSize = style.inferNumberValue('font.size', textStyle.fontSize);
  textStyle.bold = style.inferBooleanValue('font.bold', textStyle.bold);
  textStyle.italic = style.inferBooleanValue('font.italic', textStyle.italic);
  textStyle.underline = style.inferBooleanValue(
    'font.underline',
    textStyle.underline,
  );
}
