/**
 * @fileoverview A class for accessing hierarchical data in a data table.
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

import {LayeredObject} from '../common/layered_object';
import {AbstractDataTable} from '../data/abstract_datatable';
import {DataNode} from './data_node';
import {DataNodeImpl} from './data_node_impl';
import {Node} from './node';
import {Tree} from './tree';
import {TreeBase} from './tree_base';

// tslint:disable:ban-types Migration

/**
 * A class for accessing hierarchical data in a data table.
 */
export class DataTree extends TreeBase implements Tree {
  /**
   * @param dataTable The data containing the hierarchical
   *     data. The data table must have the following format:
   *     - Column 0 - The node ID. It should be unique among all nodes.
   *     - Column 1 - The ID of the parent node, or null for a root node.
   * @param userOptions Optional parameters. Possible items:
   *     {boolean} errorOnCycle If true (default), throw an error when a cyclic
   *         path is found. If false, cut the cycle.
   *     {boolean} errorOnDuplicateId If true (default), throw an error when a
   *         duplicate node ID is found. If false, ignore such nodes.
   *     {boolean} forceParentExists If true (default), throw an error when
   *         there is a parent ID that is not defined in any row. If false, add
   * a node for such a parent with a null row number.
   */
  constructor(dataTable: AbstractDataTable, userOptions?: AnyDuringMigration) {
    super();

    // Validate the data table format.
    if (dataTable.getNumberOfColumns() < 2) {
      throw new Error('Data table should have at least 2 columns');
    }
    if (dataTable.getColumnType(0) !== 'string') {
      throw new Error('Column 0 must be of type string');
    }
    if (dataTable.getColumnType(1) !== 'string') {
      throw new Error('Column 1 must be of type string');
    }

    // Parse the options.
    const options = this.parseOptions(userOptions);
    const errorOnCycle = options.errorOnCycle;
    const errorOnDuplicateId = options.errorOnDuplicateId;
    const forceParentExists = options.forceParentExists;

    // Scan all input data and build nodes tree.
    // The data may have childs defined before their parents, no order is
    // assumed.
    const nameToNode: {[name: string]: DataNodeImpl} = {};
    const nodes = [];
    for (let row = 0; row < dataTable.getNumberOfRows(); row++) {
      const name = dataTable.getValue(row, NAME_COLUMN) as string;
      if (name) {
        let node = nameToNode[name]; // Check if already encountered.
        if (!node) {
          nameToNode[name] = node = new DataNodeImpl(name, dataTable, row);
          nodes.push(node);
        } else {
          if (node.getRow() == null) {
            node.setRow(row); // Update for cases of son before parent.
          }
        }

        const parentName = node.getValue(PARENT_COLUMN);
        if (parentName) {
          let parentNode = nameToNode[parentName];
          if (!parentNode) {
            // Child is defined before the parent.
            nameToNode[parentName] = parentNode = new DataNodeImpl(
              parentName,
              dataTable,
              null,
            );
            nodes.push(parentNode);
          }

          // Check for non-unique ids.
          if (node.getParent()) {
            if (errorOnDuplicateId) {
              throw new Error(
                'More than one row with the same id (' + node.getName() + ').',
              );
            }
          } else {
            // Don't allow a cycle.
            if (node !== parentNode && !node.contains(parentNode)) {
              parentNode.addChild(node);
            } else if (errorOnCycle) {
              throw new Error(
                'Data contains a cycle: ' +
                  this.nodesToString(
                    googArray.concat(parentNode, parentNode.getAncestors()),
                  ) +
                  '.',
              );
            }
          }
        }
      }
    }

    // Add nodes to tree.
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (forceParentExists && node.getRow() === null) {
        throw new Error(`Failed to find row with id "${node.getName()}".`);
      }
      if (node.getParent()) {
        this.addNode(node);
      } else {
        // Add parent-less nodes as root nodes.
        this.addRootNode(node);
      }
    }
  }

  /**
   * Gets the node in a given data table row index.
   * @param rowIndex The row index.
   * @return The node, or null if not found.
   */
  getNodeByRow(rowIndex: number): DataNode {
    return this.getNodeById(rowIndex) as DataNode;
  }

  /**
   * Converts a list of nodes into a string with the names of the nodes.
   * @param nodes The list of nodes.
   * @return The string representation of the node list.
   */
  private nodesToString(nodes: Node[]): string {
    return nodes.map((node) => node.getName()).toString();
  }

  /**
   * Fill the default values in the DataTree constructor options.
   * @param userOptions The options.
   * @return The filled options.
   */
  private parseOptions(userOptions?: AnyDuringMigration): DataTreeOptions {
    const options = new LayeredObject(2);

    // Set the default options.
    options.setLayer(0, {
      errorOnCycle: true,
      errorOnDuplicateId: true,
      forceParentExists: true,
    });

    // Override with the user options.
    if (userOptions != null) {
      options.setLayer(1, userOptions);
    }

    return options.compact() as DataTreeOptions;
  }
}

/**
 * Name column index.
 */
const NAME_COLUMN = 0;

/**
 * Parent node column index.
 */
const PARENT_COLUMN = 1;

/**
 * Options used by the DataTree constructor.
 */
interface DataTreeOptions {
  errorOnCycle: boolean;
  errorOnDuplicateId: boolean;
  forceParentExists: boolean;
}
