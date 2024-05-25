/**
 * @fileoverview Outlines the generic structure that all controls share.
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

import {Options} from '../common/options';
import {AbstractDataTable} from '../data/abstract_datatable';
import {DataView as VisualizationDataView} from '../data/dataview';

import {Control} from './control';

// tslint:disable:ban-types Migration

/**
 * A Control that specializes in filtering the set of rows or columns of its
 * input DataTable according to user interaction. It won't affect its input
 * datatable but only identify a subset of rows or columns that match the filter
 * settings. Example: An UI slider to restrict a visualization to a defined date
 * interval.
 */
export abstract class Filter extends Control {
  /** @param container The container where the control will be rendered. */
  constructor(container: Element | null) {
    super(container);
  }

  /**
   * Returns a DataView resulting from applying this Control filtering criteria
   * on its input DataTable.
   * TODO(dlaliberte): remove applyFilter
   * @return The filtered DataView.
   */
  applyFilter(): VisualizationDataView {
    return this.apply();
  }

  /**
   * Returns a DataView resulting from applying this Control filtering criteria
   * on its input DataTable.
   * @return The filtered DataView.
   */
  apply(): VisualizationDataView {
    if (!this.getDataTable()) {
      // applyFilter() is being called before draw.
      throw new Error('No valid DataTable received from draw()');
    }
    return this.applyFilterInternal(
      this.getDataTable(),
      this.getOptions(),
      this.getState(),
    );
  }

  /**
   * Applies this Control filtering criteria on its input DataTable.
   * Subclasses to override with their specific logic.
   *
   * @param data The Control input DataTable or DataView.
   * @param options The Control configuration options.
   * @param state The Control state.
   * @return The filtered DataView.
   */
  protected applyFilterInternal(
    data: AbstractDataTable,
    options: Options,
    state: {[key: string]: AnyDuringMigration} | null,
  ): VisualizationDataView {
    return new VisualizationDataView(data);
  }
}
