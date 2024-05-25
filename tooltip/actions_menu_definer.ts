/**
 * @fileoverview Creates ActionsMenuDefinition objects.
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
  findIndex,
  forEach,
  indexOf,
} from '@npm//@closure/array/array';
import {unsafeClone} from '@npm//@closure/object/object';
import {Options} from '../common/options';
import {ActionsMenu} from '../events/chart_state';
import {Brush} from '../graphics/brush';
import {TextStyle} from '../text/text_style';
import {createBodyTextLineEntry} from './tooltip_definer_utils';
import {
  BodyEntry,
  BodyLine,
  HtmlTooltipDefinition,
  NativeTooltipDefinition,
  TooltipDefinition,
} from './tooltip_definition';

/**
 * A class for defining the actions menu and its entries.
 */
export class ActionsMenuDefiner {
  /** The glow color for actions menu entries. */
  static readonly ENTRY_GLOW_COLOR = '#DDD';

  /** The normal text style to use for actions. */
  // tslint:disable-next-line:strict-prop-init-fix
  private textStyle!: TextStyle;

  /** The text style to use for disabled actions. */
  // tslint:disable-next-line:strict-prop-init-fix//
  private disabledTextStyle!: TextStyle;

  /** A map of action ID to tooltip body entry. */
  private readonly entries: {[key: string]: BodyEntry} = {};

  /** A map of action ID to action definition. */
  private readonly actions: {[key: string]: ActionsMenuDefinition} = {};

  private readonly actionsMenu: string[] = [];

  /**
   * Parses the section of the options that configures the actions menu, and
   * processes it into a complete definition.
   * @param chartOptions The chart configuration options.
   * @param chartTextStyle Default text style used throughout the chart.
   */
  constructor(chartOptions: Options, chartTextStyle: TextStyle) {
    this.updateOptions(chartOptions, chartTextStyle);
  }

  /** Regenerates all the action menu entries. */
  private refreshActions() {
    forEach(
      this.actionsMenu,
      function (actionId) {
        this.setEntry(this.actions[actionId]);
      },
      this,
    );
  }

  /**
   * Parses the section of the options that configures the actions menu, and
   * updates the definition.
   * @param chartOptions The chart configuration options.
   * @param chartTextStyle Default text style used throughout the chart.
   */
  updateOptions(chartOptions: Options, chartTextStyle: TextStyle) {
    this.textStyle = chartOptions.inferTextStyleValue(
      'actionsMenu.textStyle',
      chartTextStyle,
    );

    this.disabledTextStyle = chartOptions.inferTextStyleValue(
      'actionsMenu.disabledTextStyle',
      chartTextStyle,
    );

    this.refreshActions();
  }

  /**
   * Creates a tooltip entry for an action definition.
   * @param action The action definition.
   * @param disabled Is this entry disabled?
   * @return The tooltip body entry.
   */
  private createEntry(
    action: ActionsMenuDefinition,
    disabled?: boolean,
  ): BodyEntry {
    return createBodyTextLineEntry(
      /* text */ action.text || '',
      /* style */ disabled ? this.disabledTextStyle : this.textStyle,
      /* opt_titleText, opt_titleStyle, */ null,
      null,
      /* opt_color, opt_opacity, */ null,
      null,
      /* opt_prefixText, */ null,
      /* opt_isHtml */ false,
      /* opt_id */ disabled ? null : action.id,
    );
  }

  /**
   * Get the entries that should be shown. Returned entries are deep copies so
   * that the caller cannot mutate them.
   * @return The actions menu entries.
   */
  getEntries(): BodyEntry[] {
    const entries = [];
    for (let i = 0, len = this.actionsMenu.length; i < len; i++) {
      const actionId = this.actionsMenu[i];
      const action = this.actions[actionId];
      if (action.visible == null || action.visible()) {
        const isDisabled = action.enabled && !action.enabled();
        let entry = null;
        if (isDisabled) {
          entry = this.createEntry(action, true);
        } else {
          entry = unsafeClone(this.entries[actionId]);
        }
        entries.push(entry);
      }
    }
    return entries;
  }

  /**
   * Adds or modifies the action with the given id.
   * @param action The action to add or modify.
   */
  setEntry(action: ActionsMenuDefinition) {
    if (!action.id) {
      throw new Error('Missing mandatory ID for action.');
    }
    let existingAction = null;
    if (this.actions[action.id]) {
      existingAction = this.actions[action.id];
    } else {
      existingAction = this.actions[action.id] = {
        id: action.id,
        text: undefined,
        visible: undefined,
        enabled: undefined,
        action: undefined,
      };
      this.actionsMenu.push(action.id);
    }

    // unroll: extend(existingAction, action);
    existingAction.text = action.text;
    existingAction.visible = action.visible;
    existingAction.enabled = action.enabled;
    existingAction.action = action.action;

    this.entries[action.id] = this.createEntry(existingAction);
  }

  /**
   * Gets the action with the specified ID.
   * @param action The action definition.
   * @return The action definition or undefined.
   */
  getAction(action: string): ActionsMenuDefinition | undefined {
    let actionDefinition = this.actions[action];
    if (actionDefinition) {
      actionDefinition = unsafeClone(actionDefinition);
    }
    return actionDefinition;
  }

  /**
   * Removes the action with the given id.
   * @param action The action ID to remove.
   */
  removeEntry(action: string) {
    if (action in this.entries) {
      delete this.entries[action];
    }
    if (action in this.actions) {
      delete this.actions[action];
    }
    const actionIndex = indexOf(this.actionsMenu, action);
    if (actionIndex >= 0) {
      this.actionsMenu.splice(actionIndex, 1);
    }
  }

  /**
   * Creates an actions menu entry object in the interactivity layer. Also
   * create the entire path of objects leading to this entry. Paths that already
   * exist are not recreated, and in particular if the entry already exists it
   * is simply retrieved.
   * @param interactivityLayer The interactivity layer of the tooltip definition.
   * @param entryIndex Index of the actions menu entry.
   * @return A reference to the entry object created in (or retrieved from) the interactivity layer.
   */
  private createInteractiveEntry(
    interactivityLayer: NativeTooltipDefinition,
    entryIndex: number,
  ): BodyEntry {
    interactivityLayer.bodyLayout = interactivityLayer.bodyLayout || {};

    const bodyLayout = interactivityLayer.bodyLayout;
    bodyLayout.entries = bodyLayout.entries || {};

    const entriesLayout = bodyLayout.entries;
    entriesLayout[entryIndex] = entriesLayout[entryIndex] || {};

    const entryLayout = entriesLayout[entryIndex];
    entryLayout.entry = entryLayout.entry || {};

    return entryLayout.entry;
  }

  /**
   * Extends a given interactivity layer of a tooltip definition based on the
   * current state of the actions menu.
   * TODO(dlaliberte): Split an ActionsMenuDefinition from the TooltipDefinition and
   * pass it instead of the TooltipDefinition.
   * @param tooltipDefinition The base layer of the tooltip definition.
   * @param actionsMenuState The state will induce which properties of the base layer should be overridden.
   * @param tooltipInteractivityLayer The interactivity layer of the tooltip definition.
   */
  extendInteractivityLayer(
    tooltipDefinition: TooltipDefinition,
    actionsMenuState: ActionsMenu,
    tooltipInteractivityLayer: TooltipDefinition,
  ) {
    if ((tooltipDefinition as HtmlTooltipDefinition).html) {
      // The tooltip is an html tooltip, no need to extend interactivity layer.
      return;
    }
    const nativeTooltipDefinition =
      tooltipDefinition as NativeTooltipDefinition;

    const entryID = actionsMenuState.focused.entryID;
    if (entryID == null) {
      return;
    }
    // Find the entry index by ID.
    const entryIndex = findIndex(
      nativeTooltipDefinition.bodyLayout.entries,
      (entryLayout) => (entryLayout.entry.data as BodyLine).id === entryID,
    );
    if (entryIndex === -1) {
      return;
    }

    const interactiveEntry = this.createInteractiveEntry(
      nativeTooltipDefinition,
      entryIndex,
    );

    interactiveEntry.data = interactiveEntry.data || {};
    const bodyLine = interactiveEntry.data as BodyLine;
    bodyLine.background = bodyLine.background || {brush: new Brush()};

    const background = bodyLine.background;

    // Override the default background color.
    background.brush = Brush.createFillBrush(
      ActionsMenuDefiner.ENTRY_GLOW_COLOR,
    );
  }
}

/**
 * The definition of an action.
 */
export interface ActionsMenuDefinition {
  id: string;
  text: string | undefined;
  visible?: () => boolean;
  enabled?: () => boolean;
  action?: () => void;
}
