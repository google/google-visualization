/**
 * @fileoverview Labeled legend definition.
 *
 * Used for conveying information from the labeled legend definer and builder.
 * A labeled legend is composed out of a circle at the start point, followed
 * by a line to the corner point (which is vertically aligned with the start
 * point), next the line moves vertically to a point vertically aligned with
 * the end point, and to the end point.
 * Along the last section of the line described above, we placed text above and
 * below the line.
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

import {Vec2} from '@npm//@closure/math/vec2';
import {Brush} from '../graphics/brush';
import {TextAlign} from '../text/text_align';
import {TextBlock} from '../text/text_block_object';
import {TextStyle} from '../text/text_style';

/**
 * LabeledLegendDefinition
 */
export type LabeledLegendDefinition = LabeledLegendDefinitionEntry[];

/**
 * A definition of a labeled legend entry.
 *   startPointRadius: The radius of the point placed at the start point.
 *   startPoint: The location from which the line start.
 *   cornerPointX: The location in which the line breaks.
 *   endPoint: The location where the line ends.
 *   startPointBrush: The brush used for the start point.
 *   lineBrush: The brush used for the line.
 *   verticalTextSpacing: The space we save around text.
 *   aboveText: Text to show above the line.
 *   aboveTextStyle: Style for text above.
 *   belowText: Text to show below the line.
 *   belowTextStyle: Style for text below.
 *   alignment: The alignment of the text.
 *   index: The row index.
 */
export interface LabeledLegendDefinitionEntry {
  startPointRadius: number;
  startPoint: Vec2;
  cornerPointX: number;
  endPoint: Vec2;
  startPointBrush: Brush;
  lineBrush: Brush;
  verticalTextSpacing: number;
  aboveText: TextBlock;
  aboveTextStyle: TextStyle;
  belowText: TextBlock;
  belowTextStyle: TextStyle;
  alignment: TextAlign;
  index: number;
}
