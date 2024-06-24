/**
 * @fileoverview An interface for accessing a tree node.
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

import {NodeId} from './nodeid';
import {Aggregator} from './tree_aggregation';

// tslint:disable:ban-types Migration

/**
 * An interface for a read-only access to a tree node.
 * extends {IDisposable}
 */
export interface Node extends IDisposable {
  /**
   * Gets the id of this node.
   * @return The id of this node.
   */
  getId(): NodeId | null;

  /**
   * Gets the name of this node.
   * @return The name of this node.
   */
  getName(): string;

  /**
   * @return Parent node or null if it is a root node.
   */
  getParent(): Node | null;

  /**
   * @return Whether the node is a leaf node.
   */
  isLeaf(): boolean;

  /**
   * @return The child nodes.
   */
  getChildren(): Node[];

  /**
   * Gets the child node of this node at the given index.
   * @param index Child index.
   * @return The node at the given index or null if not found.
   */
  getChildAt(index: number): Node | null;

  /**
   * @return The number of children.
   */
  getChildCount(): number;

  /**
   * @return The number of ancestors of the node.
   */
  getDepth(): number;

  /**
   * @return The length of the longest downward path to a leaf from the
   *     node.
   */
  getHeight(): number;

  /**
   * @return All ancestor nodes in bottom-up order,
   *     not including the node itself.
   */
  getAncestors(): Node[];

  /**
   * @return The root of the tree structure, i.e. the
   *     farthest ancestor of the node or the node itself if it has no parents.
   */
  getRoot(): Node;

  /**
   * Tells whether this node is the ancestor of the given node.
   * @param node A node.
   * @return Whether this node is the ancestor of the given node.
   */
  contains(node: Node): boolean;

  /**
   * Traverses the subtree with the possibility to skip branches. Starts with
   * this node, and visits the descendant nodes depth-first, in preorder.
   * @param f Callback
   *     function. It takes the node and its depth as arguments. The children of
   *     this node will be visited if the callback returns true or undefined,
   * and will be skipped if the callback returns false.
   * @param thisObj An optional "this" context for the function.
   * @param depth The depth of the node to pass to f.
   */
  traverse(
    f: (p1: Node, p2: number) => boolean | void,
    thisObj?: AnyDuringMigration | null,
    depth?: number,
  ): void;

  /**
   * Searches the subtree for all the nodes that satisfy a given condition.
   * @param f A function that describes
   *     which nodes to look for. It takes a node as a single argument, and
   *     returns true iff this node should be returned by the 'find' function.
   * @param thisObj An optional "this" context for the function.
   * @return The nodes that satisfy the condition.
   */
  find(f: (p1: Node) => boolean, thisObj?: AnyDuringMigration | null): Node[];

  /**
   * Aggregates the value of some property on all of the node's subtree.
   * @param getter A function that gets the
   *     value to aggregate for a specific node.
   * @param aggregator The aggregation
   *     function to use.
   * @param setter An optional function
   *     that sets the aggregated value for a specific node.
   * @param thisObj An optional "this" context for the getter,
   *     aggregation and setter functions.
   * @return The aggregated value.
   */
  calcAggregatedValue(
    getter: (p1: Node) => AnyDuringMigration,
    aggregator: Aggregator,
    setter?: (p1: Node, p2: AnyDuringMigration) => AnyDuringMigration,
    thisObj?: AnyDuringMigration | null,
  ): AnyDuringMigration;
}
