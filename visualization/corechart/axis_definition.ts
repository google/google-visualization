/**
 * @fileoverview Chart axis definition.
 * Holds the measures needed to draw an axis.
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

import * as optionTypes from '../../common/option_types';
import {Value} from '../../data/types';
import {Brush} from '../../graphics/brush';

import {TextBlock} from '../../text/text_block_object';

/** AxisDefinition */
export interface AxisDefinition {
  title: TextBlock;
  name: string;
  type: optionTypes.AxisType;
  dataType: string; // Should be data/ValueName
  logScale: boolean;
  dataDirection: number;
  startPos: number;
  endPos: number;
  number: ValueConversion;
  position: ValueConversion;
  ticklinesOrigin: TickLinesOrigin;
  baseline: TickLine | null;
  gridlines: TickLine[];
  text: TextItems;
  viewWindow: {min: number; max: number};
}

/**
 * This typedef contains conversion functions from and to values of the specific
 * axis type. It is used both for conversion to pixels and to general numeric
 * values.
 */
export interface ValueConversion {
  fromValue: (p1: Value | null) => number | null;
  toValue: (p1: number | null) => Value | null;
}

/**
 * The ticklines origin, which consists of a coordinate (an X coordinate
 * for vertical axis and Y coordinate for horizontal axis), and a direction (+1
 * indicates moving towards high coordinate values and -1 indicates moving
 * towards low coordinate values).
 * The 'length' property of AxisDefinition.TickLine is then added (or
 * subtracted) from this origin to calculate the end coordinate:
 * end-coordinate = start-coordinate + length * direction.
 * Don't confuse the 'coordinate' property of AxisDefinition.TickLine with the
 * 'coordinate' property here. For horizontal axis,
 * AxisDefinition.TickLinesOrigin.coordinate is a Y coordinate and
 * AxisDefinition.TickLine.coordnate is an X coordinate, and vice versa for
 * vertical axis. Together, they both form the (x, y) coordinate of the origin
 * of the tick line.
 */
export interface TickLinesOrigin {
  coordinate: number;
  direction: number;
}

/** TickLine */
export interface TickLine {
  dataValue: Value | null;
  formattedValue?: string | undefined; // A user-specified, formatted value.
  coordinate: number;
  isVisible: boolean;
  length: number | null;
  brush: Brush;
  isNotch: boolean | undefined;
}

/**
 * TextLayout
 * lines - The string for each line.
 * maxLineWidth - The maximum width.
 * needTooltip - True if tooltip is needed, i.e. the text did not
 *     fit entirely.
 */
export interface TextLayout {
  lines: string[];
  maxLineWidth: number;
  needTooltip: boolean;
}

/**
 * Used for multiple purposes, so most properties are optional.
 * lineIdx is the index of the line in which this tick is to be
 *   displayed (for example, if it's to be displayed in the
 *   third alternation, and the first two took 3 lines each,
 *   this lineIdx is 6).
 */
export interface TextItem {
  dataValue: Value;
  text: string;
  isVisible: boolean;
  coordinate: undefined | number;
  optional: undefined | boolean;
  textBlock: undefined | TextBlock;
  lineIdx: undefined | number;
  needTooltip: undefined | boolean;
  width: undefined | number;
  layout: undefined | TextLayout;
}

/**
 * Array of TextItems, used for ticks and tickTextLayout
 */
export type TextItems = TextItem[];
