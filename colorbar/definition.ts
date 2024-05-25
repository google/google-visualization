/**
 * @fileoverview Typedefs for defining a color bar.
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

import {Rect as GoogRect} from '@npm//@closure/math/rect';
import {Brush} from '../graphics/brush';
import {TextStyle} from '../text/text_style';

/**
 * Definition for a color gradient rectangle.
 */
export interface ColorGradientRectangleDefinition {
  rectangle: GoogRect;
  brush: Brush;
}

/**
 * Definition for a marker.
 */
export interface MarkerDefinition {
  path: number[];
  brush: Brush;
}

/**
 * Definition for a text item.
 */
export interface TextItemDefinition {
  x: number;
  y: number;
  text: string;
  style: TextStyle;
}

/**
 * Definition for a color bar.
 */
export interface Definition {
  colorGradientRectanglesDefinitions: ColorGradientRectangleDefinition[];
  markersDefinitions: MarkerDefinition[];
  textItemsDefinitions: TextItemDefinition[];
}

/**
 * Text properties for a color bar.
 */
export interface TextProperties {
  minValue: {
    text: string;
    width: number;
    height: number;
  };
  maxValue: {
    text: string;
    width: number;
    height: number;
  };
}
