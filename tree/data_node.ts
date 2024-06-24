/**
 * @fileoverview An interface for accessing a data tree node.
 *
 * @license
 * Copyright 2012 Google LLC
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

import {AbstractDataTable} from '../data/abstract_datatable';

import {Node} from './node';

// tslint:disable:ban-types Migration

/**
 * An interface for a read-only access to a data tree node.
 */
export interface DataNode extends Node {
  /**
   * Gets the data table row index this node is defined in.
   * @return The row index, or null if not defined.
   */
  getRow(): number | null;

  /**
   * Gets the data table this node is defined in.
   * @return The data table or view, or null if not defined.
   */
  getDataTable(): AbstractDataTable;

  /**
   * Gets the formatted name of this node.
   * @return The formatted name of this node.
   */
  getFormattedName(): string;

  /**
   * Gets the value of the specified property for the row of this node,
   * or null if no such property was set on the row or the node has no row at
   * all.
   * @param property The name of requested property.
   * @return The value of the property.
   */
  getRowProperty(property: string): AnyDuringMigration;

  /**
   * Gets the value of a cell in the row of this node.
   * @param columnIndex The index of the requested column.
   * @return The cell's value, or null if the node has no row.
   */
  getValue(columnIndex: number): AnyDuringMigration;

  /**
   * Gets the formatted value of a cell in the row of this node.
   * @param columnIndex The index of the requested column.
   * @return The cell's formatted value, or null if the node has no
   *     row.
   */
  getFormattedValue(columnIndex: number): string | null;
}
