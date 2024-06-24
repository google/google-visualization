/**
 * @fileoverview A class representing a tree node based on a data table row.
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

import * as googArray from '@npm//@closure/array/array';
import {AbstractDataTable} from '../data/abstract_datatable';

import {DataNode} from './data_node';
import {NodeBase} from './node_base';

// tslint:disable:ban-types Migration

/**
 * A class representing a tree node based on a data table row.
 * @unrestricted
 */
export class DataNodeImpl extends NodeBase implements DataNode {
  /**
   * @param name The name of the node.
   * @param dataTable The data table or view this node is defined in.
   * @param rowIndex The data table row this node is defined in.
   */
  constructor(
    name: string,
    private readonly dataTable: AbstractDataTable,
    rowIndex: number | null,
  ) {
    super(rowIndex, name);
  }

  /**
   * Sets the data table row index this node is defined in.
   * @param rowIndex The row index.
   */
  setRow(rowIndex: number) {
    this.setId(rowIndex);
  }

  /**
   * Gets the data table row index this node is defined in.
   * @return The row index, or null if not defined.
   */
  getRow(): number | null {
    return this.getId() as number | null;
  }

  /**
   * Gets the data table this node is defined in.
   * @return The data table or view, or null if not defined.
   */
  getDataTable(): AbstractDataTable {
    return this.dataTable;
  }

  /**
   * Gets the formatted name of this node.
   * @return The formatted name of this node.
   */
  getFormattedName(): string {
    // Get the formatted name from the table, if possible.
    const formattedName = this.getFormattedValue(NAME_COLUMN);
    // Fallback when the node has no row.
    return formattedName || this.getName();
  }

  /**
   * Gets the value of the specified property for the row of this node,
   * or null if no such property was set on the row or the node has no row at
   * all.
   * @param property The name of requested property.
   * @return The value of the property.
   */
  getRowProperty(property: string): AnyDuringMigration {
    return this.getRowRelatedData(this.dataTable.getRowProperty, property);
  }

  /**
   * Gets the value of a cell in the row of this node.
   * @param columnIndex The index of the requested column.
   * @return The cell's value, or null if the node has no row.
   */
  getValue(columnIndex: number): AnyDuringMigration {
    return this.getRowRelatedData(this.dataTable.getValue, columnIndex);
  }

  /**
   * Gets the formatted value of a cell in the row of this node.
   * @param columnIndex The index of the requested column.
   * @return The cell's formatted value, or null if the node has no
   *     row.
   */
  getFormattedValue(columnIndex: number): string | null {
    return this.getRowRelatedData(
      this.dataTable.getFormattedValue,
      columnIndex,
    );
  }

  /**
   * Gets data related to the data table row of the node.
   * If this node is not associated with a data table row, return null.
   * @param getter The data table getter function to use.
   * @param varArgs The arguments to pass to the getter (except for
   *     row).
   * @return The data, or null if the node has no row.
   */
  private getRowRelatedData(
    getter: Function,
    ...varArgs: AnyDuringMigration[]
  ): AnyDuringMigration {
    const row = this.getRow();
    if (row != null) {
      const fullArgs = [row];
      googArray.extend(fullArgs, Array.prototype.slice.call(arguments, 1));
      return getter.apply(this.dataTable, fullArgs);
    } else {
      return null;
    }
  }
}

/**
 * Name column index.
 */
const NAME_COLUMN = 0;
