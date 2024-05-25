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

import {Control} from './control';

// tslint:disable:ban-types  Migration

/**
 * A Control that can transform its input DataTable freely and emit an output
 * DataTable unrelated to the input one. Example: A control that aggregates
 * datatable rows according to a GROUP BY operation.
 */
export class Operator extends Control {
  /** @param container The container where the control will be rendered. */
  constructor(container: Element | null) {
    super(container);
  }

  /**
   * Not used here, but must be overridden from Control.
   * @param data The dataTable or dataView.
   * @param options The control configuration options.
   * @param state The control state.
   */
  override prepareDraw(
    data: AbstractDataTable,
    options: Options,
    state: {[key: string]: AnyDuringMigration},
  ) {}

  /**
   * Returns a DataTable resulting from applying this Control transform logic on
   * its input DataTable.
   * TODO(dlaliberte): remove applyOperator
   * @return The output DataTable.
   */
  applyOperator(): AbstractDataTable {
    return this.apply();
  }

  /**
   * Returns a DataTable resulting from applying this Control transform logic on
   * its input DataTable.
   *
   * @return The output DataTable.
   */
  apply(): AbstractDataTable {
    if (!this.getDataTable()) {
      // getView() is being called before draw.
      throw new Error('No valid DataTable received from draw()');
    }
    return this.applyOperatorInternal(
      this.getDataTable(),
      this.getOptions(),
      this.getState(),
    );
  }

  /**
   * Applies this Control changes on its input DataTable.
   * Subclasses to override with their specific logic.
   *
   * @param data The Control input DataTable or DataView.
   * @param options The Control configuration options.
   * @param state The Control state.
   * @return The transformed DataTable.
   */
  protected applyOperatorInternal(
    data: AbstractDataTable,
    options: Options,
    state: {[key: string]: AnyDuringMigration} | null,
  ): AbstractDataTable {
    return data;
  }
}
