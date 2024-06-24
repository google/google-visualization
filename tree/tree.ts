/**
 * @fileoverview An interface of a tree data structure.
 * The tree can actually be a forest with multiple trees.
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

import {IDisposable} from '@npm//@closure/disposable/idisposable';

import {Node} from './node';
import {NodeId} from './nodeid';
import {Aggregator} from './tree_aggregation';

// tslint:disable:ban-types Migration

/**
 * An interface of a tree data structure.
 * The tree can actually be a forest with multiple trees.
 */
export interface Tree extends IDisposable {
  /**
   * @return The root nodes of the tree.
   */
  getRootNodes(): Node[];

  /**
   * @return The number of trees (root nodes) in the forest.
   */
  getTreeCount(): number;

  /**
   * @return Whether this tree is actually a forest containing more
   *     than one tree.
   */
  isForest(): boolean;

  /**
   * Gets the node with a given id.
   * @param id The node id.
   * @return The node, or null if not found.
   */
  getNodeById(id: NodeId): Node;

  /**
   * @return The length of the longest downward path to a leaf from a
   *     root node, or -1 if there are no root nodes.
   */
  getHeight(): number;

  /**
   * Traverses all the trees in the forest with the possibility to skip
   * branches. Starts with the first root node, and visits the descendant nodes
   * depth-first, in preorder. Then continues to the other root nodes.
   * @param f Callback function. It takes the node and its depth as arguments.
   *     The children of this node will be visited if the callback returns
   *     true or undefined, and will be skipped if it returns false.
   * @param thisObj An optional "this" context for the function.
   */
  traverse(
    f: (p1: Node, p2: number) => boolean | void,
    thisObj?: AnyDuringMigration,
  ): void;

  /**
   * Searches the forest for all the nodes that satisfy a given condition.
   * @param f A function that describes
   *     which nodes to look for. It takes a node as a single argument, and
   *     returns true iff this node should be returned by the 'find' function.
   * @param thisObj An optional "this" context for the function.
   * @return The nodes that satisfy the condition.
   */
  find(f: (p1: Node) => boolean, thisObj?: AnyDuringMigration): Node[];

  /**
   * Aggregates the value of some property on all of the nodes of the tree.
   * @param getter A function that gets the value to aggregate for a specific node.
   * @param aggregator The aggregation function to use.
   * @param setter A function that sets the aggregated value for a specific node.
   * @param thisObj An optional "this" context for the getter, aggregation
   *     and setter functions.
   */
  calcAggregatedValue(
    getter: (p1: Node) => AnyDuringMigration,
    aggregator: Aggregator,
    setter: (p1: Node, p2: AnyDuringMigration) => AnyDuringMigration,
    thisObj?: AnyDuringMigration,
  ): void;
}
