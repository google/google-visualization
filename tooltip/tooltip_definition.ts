/**
 * @fileoverview Utilities for defining and drawing tooltips.
 *
 * A tooltip has an outline and a body.
 *
 * The outline is consisted of a bounding box and possibly a handle.
 *
 * The body is consisted of entries.
 * An entry can be a line of items (text or color codes), or a separator.
 * A line of items can have a background and an ID (if it is interactive).
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
import {Coordinate} from '@npm//@closure/math/coordinate';
import {Line} from '@npm//@closure/math/line';
import {SafeHtml} from 'safevalues';
import {ActionsMenu} from '../events/chart_state';
import {Brush} from '../graphics/brush';
import {TextStyle} from '../text/text_style';

// tslint:disable:ban-types Migration

/** The definition of a tooltip. */
export type TooltipDefinition = NativeTooltipDefinition | HtmlTooltipDefinition;

/** The definition of an HTML tooltip. */
export interface HtmlTooltipDefinition {
  html: SafeHtml;
  customHtml: boolean;
  pivot: Coordinate;
  anchor: Coordinate;
  boundaries: Box;
  spacing: number;
  margin: number;
}

/** The definition of a native tooltip. */
export interface NativeTooltipDefinition {
  boxStyle: Brush;
  outline: Outline;
  bodyLayout: BodyLayout;
}

/**
 * Type guard for HtmlTooltipDefinition.
 */
export function isHtmlTooltipDefinition(
  tooltip: TooltipDefinition,
): tooltip is HtmlTooltipDefinition {
  return (tooltip as HtmlTooltipDefinition).html != null;
}

/**
 * The outline of the tooltip, including the box without the handle, and
 * possibly 3 handle points in clockwise order.
 */
export interface Outline {
  box: Box;
  handlePoints?: Coordinate[] | null;
}

/** The layout of the tooltip body. */
export interface BodyLayout {
  entries: BodyEntryLayout[];
  rtl: boolean;
}

/**
 * The layout of an entry in the tooltip body.
 * Contains a reference to the original entry.
 */
export interface BodyEntryLayout {
  entry: BodyEntry;
  data: BodyLineLayout | BodySeparatorLayout;
}

/** The layout of a line in the tooltip body. */
export interface BodyLineLayout {
  items: BodyItemLayout[];
  background: BodyLineBackgroundLayout | undefined;
}

/**
 * The layout of a line separator in the tooltip body.
 * Contains the end points of the separator.
 */
export interface BodySeparatorLayout {
  line: Line;
}

/**
 * The layout of a background of a line in the tooltip body.
 * Contains the bounding box of the background.
 */
export interface BodyLineBackgroundLayout {
  box: Box;
}

/**
 * The layout of a single item in the tooltip body.
 * Contains the bounding box of the item.
 */
export interface BodyItemLayout {
  box: Box;
}

/**
 * The tooltip body: the items that will be shown in the tooltip.
 * The body is divided into entries which will be shown one beneath the other.
 */
export interface Body {
  entries: BodyEntry[];
}

/** An entry in the tooltip body. */
export interface BodyEntry {
  type: BodyEntryType;
  data: BodyLine | BodySeparator;
  alignColumns: boolean | undefined;
}

/**
 * Enumeration of entry types that are possible in the tooltip body.
 * Entry type.
 */
export enum BodyEntryType {
  LINE = 'line',
  SEPARATOR = 'separator',
  HTML = 'html',
}

/**
 * A line in the tooltip body.
 * The line is divided into items that will be shown left to right.
 */
export interface BodyLine {
  items: BodyItem[];
  background: BodyLineBackground | undefined;
  id: string | undefined;
}

/** A line separator in the tooltip body. */
export interface BodySeparator {
  brush: Brush;
}

/** A background of a line in the tooltip body. */
export interface BodyLineBackground {
  brush: Brush;
}

/**
 * An item in the tooltip body.
 * Currently, an item can be either text or square (e.g., serie indication).
 */
export interface BodyItem {
  type: BodyItemType;
  data: TextItem | SquareItem;
  html: boolean | undefined;
}

/**
 * Enumeration of item types that are possible in the tooltip body.
 * Item type.
 */
export enum BodyItemType {
  TEXT = 'text',
  SQUARE = 'square',
}

/** A text item in the tooltip body. */
export interface TextItem {
  text: string;
  style: TextStyle;
}

/**
 * A square item in the tooltip body.
 * This can be used for example as a serie indicator.
 */
export interface SquareItem {
  size: number;
  brush: Brush;
}

/**
 * Note that chartDefinition: !ChartDefinition  creates a circular def.
 * Same for interactivityLayer: !ChartDefinition
 * TODO(dlaliberte): Maybe move to chart_definition_types, but that still
 * requires a circular dep with ChartDefinition.
 */
export interface InteractionState {
  chartDefinition: AnyDuringMigration;
  actionsMenuEntries: BodyEntry[];
  interactivityLayer: AnyDuringMigration;
  actionsMenuState: ActionsMenu | null;
}
