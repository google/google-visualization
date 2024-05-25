/**
 * @fileoverview A utility class to manage the state of a core chart.
 *
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

import * as googMath from '@npm//@closure/math/coordinate';
import {LayeredObject} from '../common/layered_object';
import * as gvizObject from '../common/object';
import {Selection} from '../common/selection';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Represents the interactive state of a chart.
 */
export class ChartState {
  selected: Selection;

  // The elements currently focused in the chart.
  focused: Focus = {serie: null, datum: null, category: null};

  // The annotations state.
  annotations: Annotations = {focused: null, expanded: null};

  // The legend state.
  legend: Legend = {
    focused: {entry: null},
    currentPageIndex: null,
    totalPages: null,
  };

  // The actions menu state.
  actionsMenu: ActionsMenu = {focused: {entryID: null}};

  // The cursor (mouse) state.
  cursor: Cursor = {position: null, positionAtLastClick: null};

  // Additional options that may be merged with original options.
  nextFrameOptions: AnyDuringMigration | null = null;

  /**
   * A box that overlays items for selection or focus.
   */
  overlayBox: OverlayBox | null = null;
  newOptions: AnyDuringMigration;

  /**
   * Constructs a new state object.
   * Properties not specified in the state initialization object receive null.
   * @param state An object from which the state is initialized.
   */
  constructor(state?: AnyDuringMigration) {
    /**
     * The elements currently selected in the chart.
     */
    this.selected = new Selection();

    // TODO(dlaliberte): Consider using Selection for focused.
    // Pro: Support for multi-focus.
    // Pro: Avoid complex types and cloning operations.
    // Pro: Similarity to selection (uses data table indices).
    // Pro: Generic (serie/category are irrelevant for GeoChart for instance).
    // Con: Does not support focus on elements not in the data table.

    // Initialize according to given state.
    // Note that the compact() method is used instead of simply cloning
    // state so that state can be partial.
    if (state) {
      this.selected.setSelection(state.selected);
      if (state.focused) {
        this.focused = ChartState.compact(this.focused, state.focused) as Focus;
      }
      if (state.annotations) {
        this.annotations = ChartState.compact(
          this.annotations,
          state.annotations,
        ) as Annotations;
      }
      if (state.legend) {
        this.legend = ChartState.compact(this.legend, state.legend) as Legend;
      }
      if (state.actionsMenu) {
        this.actionsMenu = ChartState.compact(
          this.actionsMenu,
          state.actionsMenu,
        ) as ActionsMenu;
      }
      if (state.nextFrameOptions) {
        this.nextFrameOptions = ChartState.compact(
          this.nextFrameOptions,
          state.nextFrameOptions,
        );
      }
      if (state.overlayBox) {
        this.newOptions = ChartState.compact(
          this.overlayBox,
          state.overlayBox,
        ) as OverlayBox;
      }
    }
  }

  /**
   * Clones this state, creating a new one.
   * @return The cloned chart state.
   */
  clone(): ChartState {
    const cloned = new ChartState();
    cloned.selected = this.selected.clone();
    // The chart state properties should not contain circular references, so it
    // is actually a safe clone.
    cloned.focused = gvizObject.unsafeClone(this.focused) as Focus;
    cloned.annotations = gvizObject.unsafeClone(
      this.annotations,
    ) as Annotations;
    cloned.legend = gvizObject.unsafeClone(this.legend) as Legend;
    cloned.actionsMenu = gvizObject.unsafeClone(
      this.actionsMenu,
    ) as ActionsMenu;
    cloned.cursor = gvizObject.unsafeClone(this.cursor) as Cursor;
    cloned.nextFrameOptions = gvizObject.unsafeClone(this.nextFrameOptions);
    cloned.overlayBox = gvizObject.unsafeClone(this.overlayBox) as OverlayBox;
    return cloned;
  }

  /**
   * Compares the chart state to another chart state object.
   * @param other The other chart state.
   * @param ignoreCursor Whether to ignore the cursor or not.
   *     If set to true then two states that differ only by their cursor
   * position are considered equal. False by default.
   * @return True if equal, false otherwise.
   */
  equals(other: ChartState, ignoreCursor = false): boolean {
    // ignoreCursor = ignoreCursor !== undefined ? ignoreCursor : false;
    return (
      this.selected.equals(other.selected) &&
      gvizObject.unsafeEquals(this.focused, other.focused) &&
      gvizObject.unsafeEquals(this.annotations, other.annotations) &&
      gvizObject.unsafeEquals(this.legend, other.legend) &&
      gvizObject.unsafeEquals(this.actionsMenu, other.actionsMenu) &&
      (ignoreCursor || gvizObject.unsafeEquals(this.cursor, other.cursor)) &&
      gvizObject.unsafeEquals(this.nextFrameOptions, other.nextFrameOptions) &&
      gvizObject.unsafeEquals(this.overlayBox, other.overlayBox)
    );
  }

  /**
   * Utility function to compact two objects together.
   * @param layer1 The object with the default values.
   * @param layer2 The object with the overriding values.
   * @return The compact form of the two objects.
   */
  private static compact(
    layer1: AnyDuringMigration,
    layer2: AnyDuringMigration,
  ): AnyDuringMigration {
    const layeredObj = new LayeredObject(2);
    layeredObj.setLayer(0, layer1);
    layeredObj.setLayer(1, layer2);
    return layeredObj.compact();
  }
}

/** chart_state.Focus */
export interface Focus {
  serie: number | null;
  datum: number | null;
  category: number | null;
}

/** chart_state.LegendFocus */
export interface LegendFocus {
  entry: number | null;
}

/** chart_state.Legend */
export interface Legend {
  focused: LegendFocus;
  currentPageIndex: number | null;
  totalPages: number | null;
}

/** chart_state.ActionsMenuFocus */
export interface ActionsMenuFocus {
  entryID: string | null;
  action?: AnyDuringMigration;
}

/** chart_state.ActionsMenu */
export interface ActionsMenu {
  focused: ActionsMenuFocus;
}

/** chart_state.AnnotationFocus */
export interface AnnotationFocus {
  row: number;
  column: number;
}

/** chart_state.Annotations */
export interface Annotations {
  focused: AnnotationFocus | null;
  expanded: {serieIndex?: number | null; datumOrCategoryIndex: number} | null;
}

/** chart_state.Cursor */
export interface Cursor {
  position: googMath.Coordinate | null;
  positionAtLastClick: googMath.Coordinate | null;
}

/** chart_state.FocusType */
export type FocusType = Focus | AnnotationFocus | LegendFocus;

/** chart_state.OverlayBox */
export interface OverlayBox {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
  opacity: number;
}
