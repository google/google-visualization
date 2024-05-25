/**
 * @fileoverview Setter Control.
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

import {forEach} from '@npm//@closure/array/array';

import {Options} from '../common/options';
import {AbstractDataTable} from '../data/abstract_datatable';

import {Control} from './control';

// tslint:disable:ban-types  Migration

/**
 * A control that sets values.
 */
export abstract class Setter extends Control {
  /**
   * Array of setter rules, each rule being an input path into the Setter's
   * state, and an output path to a property of the participants.
   */
  private setters: Array<{input: string; output: string}> | null = [];

  /**
   * A Control that can set properties on other controls or charts.
   * @param container The container where the control will be rendered.
   */
  constructor(container: Element | null) {
    super(container);
  }

  /**
   * Set the setter rules of this Setter.
   * @param setters The setters.
   */
  setSetters(setters: Array<{input: string; output: string}> | null) {
    this.setters = setters;
  }

  override prepareDraw(
    data: AbstractDataTable,
    options: Options,
    state: {[key: string]: AnyDuringMigration},
  ) {
    this.clear();

    this.setters = (this.getOptions().inferValue('setters') || []) as Array<{
      input: string;
      output: string;
    }> | null;
  }

  /**
   * Returns a DataTable after applying this Setter on the target.
   *
   * @return The output DataTable.
   */
  apply(): AbstractDataTable {
    return this.applyInternal(
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
  protected applyInternal(
    data: AbstractDataTable,
    options: Options,
    state: {[key: string]: AnyDuringMigration} | null,
  ): AbstractDataTable {
    const participants = this.getDependencies();
    forEach(participants, (participant) => {
      forEach(this.setters, (setter) => {
        const key = setter.output;
        const value = state![setter.input];
        participant.setProperty(key, value);
      });
    });
    return data;
  }
}
