/**
 * @fileoverview Html tooltip snippet defining utilities.
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

import {assert} from '@npm//@closure/asserts/asserts';
import {Box} from '@npm//@closure/math/box';
import {Coordinate} from '@npm//@closure/math/coordinate';
import {SafeHtml, concatHtmls, createHtml, htmlEscape} from 'safevalues';
import {getSafeHtml} from '../loader/dynamic_loading';
import {TextMeasureFunction} from '../text/text_measure_function';
import {TextStyle} from '../text/text_style';
import {Token, generateId} from '../visualization/corechart/id_utils';
import {DEFAULT_MARGINS} from './defs';
import {
  Body,
  BodyEntry,
  BodyEntryType,
  BodyItem,
  BodyItemType,
  BodyLine,
  SquareItem,
  TextItem,
  TooltipDefinition,
} from './tooltip_definition';

/**
 * Creates a tooltip definition given body and an anchor. Same as
 * gviz.util.tooltip.definer.createTooltipDefinition but builds an html
 * version with the same parameters.
 * @see {createTooltipDefinition} for complete explanation of the parameters.
 * @param body The body (items inside the tooltip).
 * @param textMeasureFunction The function to use for measuring text width.
 * @param attachHandle Should the tooltip have a handle.
 * @param boundaries The permitted tooltip boundaries.
 * @param pivot The tooltip pivot.
 * @return The tooltip definition.
 */
export function createTooltipDefinition(
  body: Body,
  textMeasureFunction: TextMeasureFunction,
  attachHandle: boolean,
  boundaries: Box,
  anchor: Coordinate,
  pivot: Coordinate,
): TooltipDefinition {
  return {
    html: toHtml(body),
    customHtml: false,
    pivot,
    anchor,
    boundaries,
    spacing: SPACING,
    margin: DEFAULT_MARGINS,
  };
}

/**
 * Converts a tooltip definition to an html representation.
 * @param body The body.
 * @return The representation of the html.
 */
function toHtml(body: Body): SafeHtml {
  if (body.entries.length === 0) {
    return createHtml('div', {'class': 'google-visualization-tooltip'});
  }
  // Assert there is no more than one separator.
  assert(
    body.entries.filter(
      (entry: BodyEntry) => entry.type === BodyEntryType.SEPARATOR,
    ).length <= 1,
  );
  // And find its index.
  const separatorIndex = body.entries.findIndex(
    (entry: BodyEntry) => entry.type === BodyEntryType.SEPARATOR,
  );
  const entriesHtml: SafeHtml[] = [];
  if (separatorIndex === -1) {
    entriesHtml.push(tooltipEntriesToHtml(body.entries));
  } else {
    entriesHtml.push(
      tooltipEntriesToHtml(body.entries.slice(0, separatorIndex)),
    );
    entriesHtml.push(
      createHtml('div', {'class': 'google-visualization-tooltip-separator'}),
    );
    entriesHtml.push(
      actionsMenuEntriesToHtml(body.entries.slice(separatorIndex + 1)),
    );
  }

  return createHtml(
    'div',
    {'class': 'google-visualization-tooltip'},
    concatHtmls(entriesHtml),
  );
}

/**
 * Converts an array of entries representing the list into an html structure.
 * @param tooltipEntries The tooltip entries.
 * @return The representation of the html.
 */
function tooltipEntriesToHtml(tooltipEntries: BodyEntry[]): SafeHtml {
  const entries = tooltipEntries.map((entry) => {
    return createHtml(
      'li',
      {'class': 'google-visualization-tooltip-item'},
      concatHtmls(itemListToHtml(entry.data as BodyLine)),
    );
  });

  return createHtml(
    'ul',
    {'class': 'google-visualization-tooltip-item-list'},
    concatHtmls(entries),
  );
}

/**
 * Converts an array of entries representing the action into an html structure.
 * @param actionsMenuEntries The action menu entries.
 * @return The representation of the html.
 */
function actionsMenuEntriesToHtml(actionsMenuEntries: BodyEntry[]): SafeHtml {
  const entries = actionsMenuEntries.map((entry) => {
    const bodyLine = entry.data as BodyLine;
    return createHtml(
      'li',
      {
        'data-logicalname': generateId([
          Token.ACTIONS_MENU_ENTRY,
          bodyLine.id! as Token,
        ]),
        'class': 'google-visualization-tooltip-action',
      },
      concatHtmls(itemListToHtml(bodyLine)),
    );
  });

  return createHtml(
    'ul',
    {'class': 'google-visualization-tooltip-action-list'},
    concatHtmls(entries),
  );
}

/**
 * Converts a body line object into an html structure.
 * @param line The body line.
 * @return The resulting html.
 */
function itemListToHtml(line: BodyLine): SafeHtml[] {
  return line.items.map((item: BodyItem, j: number) => {
    switch (item.type) {
      case BodyItemType.TEXT:
        const textData = item.data as TextItem;
        const content = item.html
          ? getSafeHtml(textData.text)
          : htmlEscape(textData.text);
        return createHtml(
          'span',
          {
            'style': textStyleToHtmlStyle(textData.style),
          },
          concatHtmls([j === 0 ? '' : ' ', content]),
        );
      case BodyItemType.SQUARE:
        const squareData = item.data as SquareItem;
        return createHtml('div', {
          'class': 'google-visualization-tooltip-square',
          'style': `background-color:${
            squareData.brush && squareData.brush.getFill()
          };`,
        });
      default:
        throw new Error('Unknown item.type');
    }
  });
}

/**
 * Converts a TextStyle object to a css string declaration.
 * @param textStyle The given text style.
 * @return The css declaration.
 */
function textStyleToHtmlStyle(textStyle: TextStyle): string {
  const styleMap: Record<string, string | number> = {
    'font-family': textStyle.fontName,
    'font-size': `${textStyle.fontSize}px`,
    'color': textStyle.color,
    'opacity': textStyle.opacity,
    'margin': '0',
    'font-style': textStyle.italic ? 'italic' : 'none',
    'text-decoration': textStyle.underline ? 'underline' : 'none',
    'font-weight': textStyle.bold ? 'bold' : 'none',
  };

  if (textStyle.italic) {
    // Some browsers cut off a little bit from the right of italicized text.
    // To prevent this, we set the padding-right to be the bare minimum
    // (determined by experimentation) that we can in order to account for
    // that.
    styleMap['padding-right'] = '0.04em';
  }

  return Object.entries(styleMap)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
}

/** The default color of text in the tooltip. */
export const DEFAULT_TEXT_COLOR = '#333333';

/** The space between the point and the tooltip's closest corner. */
export const SPACING = 20;
