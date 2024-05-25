/**
 * @fileoverview Legend definition.
 *
 * This class includes all the properties and measures that are needed to
 * draw the legend.
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
import {Rect} from '@npm//@closure/math/rect';
import {LegendPosition} from '../common/option_types';
import {Brush} from '../graphics/brush';
import {TextBlock} from '../text/text_block_object';

/** LegendDefinition */
export interface LegendDefinition {
  position: LegendPosition;
  area: Box;
  pages: Page[] | null;
  currentPage: Page | null;
  currentPageIndex: number;
  scrollItems: ScrollItems | null;
}

/**
 * Drawing data for a single legend entry.
 */
export interface Entry {
  brush: Brush;
  id: string;
  textBlock: TextBlock;
  isVisible: boolean;
  square?: {brush: Brush; coordinates: Rect} | null;
  removeSerieButton: {
    isVisible: boolean;
    brush?: Brush;
    coordinates?: {x: number; y: number};
  } | null;
  index: number;
  text?: string;
}

/**
 * A page is an array of Entry
 */
export type Page = Entry[];

/**
 * Legend entries are grouped into pages.
 * Clicking a scroll button changes the displayed page.
 */
export interface ScrollItems {
  previousButton: ScrollButton;
  nextButton: ScrollButton;
  pageIndexTextBlock: TextBlock | null;
}

/** ScrollButton */
export interface ScrollButton {
  path: Array<{x: number; y: number}>;
  brushes: {active: Brush; inactive: Brush};
  brush: Brush;
  active: boolean;
}
