/**
 * @fileoverview Base class for tree data structures.
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
import * as asserts from '@npm//@closure/asserts/asserts';
import {Disposable} from '@npm//@closure/disposable/disposable';

import {Node} from './node';
import {NodeId} from './nodeid';
import {Tree} from './tree';
import {Aggregator} from './tree_aggregation';

// tslint:disable:ban-types Migration

/**
 * Base class for tree data structures.
 * Indexes the tree nodes by their ids.
 */
export class TreeBase extends Disposable implements Tree {
  /**
   * The root node of the tree.
   */
  private readonly rootNodes: Node[] = [];

  /**
   * Dictionary with a tree node for each id.
   */
  private readonly nodeById: {[key: string]: Node} = {};

  constructor() {
    super();
  }

  /**
   * Add a root node to the tree.
   * @param rootNode The root node.
   */
  protected addRootNode(rootNode: Node) {
    this.rootNodes.push(rootNode);
    this.registerDisposable(rootNode);
    this.addNode(rootNode);
  }

  /**
   * Adds a node to the tree, indexing it by its id.
   * If the id is null or not defined the node will not be indexed.
   * @param node The node to add.
   */
  protected addNode(node: Node) {
    const id = node.getId();

    if (id != null) {
      // Make sure the node id is unique.
      asserts.assert(this.nodeById[id] === undefined);

      // Add an entry to the id to node dictionary.
      this.nodeById[id] = node;
    }
  }

  /**
   * @return The root nodes of the tree.
   */
  getRootNodes(): Node[] {
    return this.rootNodes;
  }

  /**
   * @return The number of trees (root nodes) in the forest.
   */
  getTreeCount(): number {
    return this.rootNodes.length;
  }

  /**
   * @return Whether this tree is actually a forest containing more
   *     than one tree.
   */
  isForest(): boolean {
    return this.getTreeCount() > 1;
  }

  /**
   * Gets the node with a given id.
   * @param id The node id.
   * @return The node, or null if not found.
   */
  getNodeById(id: NodeId): Node {
    return this.nodeById[id] || null;
  }

  /**
   * @return The length of the longest downward path to a leaf from a
   *     root node, or -1 if there are no root nodes.
   */
  getHeight(): number {
    const rootNodes = this.getRootNodes();
    const height = rootNodes.reduce(
      (height, rootNode) => Math.max(height, rootNode.getHeight()),
      -1,
    );
    return height;
  }

  /**
   * @param f Callback function. It takes the node and its depth as arguments.
   *     The children of this node will be visited if the callback returns true
   *     or undefined, and will be skipped if the callback returns false.
   * @param thisObj An optional "this" context for the function.
   */
  traverse(
    f: (p1: Node, p2: number) => boolean | void,
    thisObj?: AnyDuringMigration,
  ) {
    const rootNodes = this.getRootNodes();
    for (let i = 0; i < rootNodes.length; i++) {
      const rootNode = rootNodes[i];
      rootNode.traverse(f, thisObj);
    }
  }

  /**
   * @param f A function that describes which nodes to look for. It takes a node
   *     as a single argument, and returns true iff this node should be returned
   *     by the 'find' function.
   * @param thisObj An optional "this" context for the function.
   * @return The nodes that satisfy the condition.
   */
  find(f: (p1: Node) => boolean, thisObj?: AnyDuringMigration): Node[] {
    const nodes: AnyDuringMigration[] = [];
    const rootNodes = this.getRootNodes();
    for (let i = 0; i < rootNodes.length; i++) {
      const rootNode = rootNodes[i];
      googArray.extend(nodes, rootNode.find(f, thisObj));
    }
    return nodes;
  }

  /**
   * @param getter A function that gets the value to aggregate for a specific
   *     node.
   * @param aggregator The aggregation function to use.
   * @param setter A function that sets the aggregated value for a specific
   *     node.
   * @param thisObj An optional "this" context for the getter, aggregation and
   *     setter functions.
   */
  calcAggregatedValue(
    getter: (p1: Node) => AnyDuringMigration,
    aggregator: Aggregator,
    setter: (p1: Node, p2: AnyDuringMigration) => AnyDuringMigration,
    thisObj?: AnyDuringMigration,
  ) {
    const rootNodes = this.getRootNodes();
    for (let i = 0; i < rootNodes.length; i++) {
      const rootNode = rootNodes[i];
      rootNode.calcAggregatedValue(getter, aggregator, setter, thisObj);
    }
  }
}
