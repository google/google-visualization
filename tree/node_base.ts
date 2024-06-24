/**
 * @fileoverview A class that implements the basic functionality of a tree node.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import {Disposable} from '@npm//@closure/disposable/disposable';

import {Node} from './node';
import {NodeId} from './nodeid';
import {Aggregator} from './tree_aggregation';

// tslint:disable:ban-types Migration

/**
 * A class that implements the basic functionality of a tree node.
 */
export class NodeBase extends Disposable implements Node {
  /**
   * Reference to the parent node or null if it has no parent.
   */
  private parent: NodeBase | null = null;
  /**
   * Child nodes or null in case of leaf node.
   */
  private children: NodeBase[] | null = null;
  /**
   * @param id The id of the node.
   * @param name The name of the node.
   */
  constructor(
    private id: NodeId | null,
    private readonly name: string,
  ) {
    super();
  }

  /**
   * Sets the id of the node.
   * @param id The id of the node.
   */
  setId(id: NodeId | null) {
    this.id = id;
  }

  /**
   * Gets the id of this node.
   * @return The id of this node.
   */
  getId(): NodeId | null {
    return this.id;
  }

  /**
   * Gets the name of this node.
   * @return The name of this node.
   */
  getName(): string {
    return this.name;
  }

  /**
   * @return Parent node or null if it is a root node.
   */
  getParent(): Node | null {
    return this.parent;
  }

  /**
   * @return Whether the node is a leaf node.
   */
  isLeaf(): boolean {
    return !this.getChildCount();
  }

  /**
   * @return The child nodes.
   */
  getChildren(): Node[] {
    return this.children || [];
  }

  /**
   * Gets the child node of this node at the given index.
   * @param index Child index.
   * @return The node at the given index or null if not found.
   */
  getChildAt(index: number): Node | null {
    return this.getChildren()[index] || null;
  }

  /**
   * @return The number of children.
   */
  getChildCount(): number {
    return this.getChildren().length;
  }

  /**
   * @return The number of ancestors of the node.
   */
  getDepth(): number {
    let depth = 0;
    let node: Node = this;
    while (node.getParent()) {
      depth++;
      node = node.getParent()!;
    }
    return depth;
  }

  /**
   * @return The length of the longest downward path to a leaf from the
   *     node.
   */
  getHeight(): number {
    const childs = this.getChildren();
    const maxChildHeight = Number(
      childs.reduce((height, child) => Math.max(height, child.getHeight()), -1),
    );
    return maxChildHeight + 1;
  }

  /**
   * @return All ancestor nodes in bottom-up order,
   *     not including the node itself.
   */
  getAncestors(): Node[] {
    const ancestors = [];
    let node = this.getParent();
    while (node) {
      ancestors.push(node);
      node = node.getParent();
    }
    return ancestors;
  }

  /**
   * @return The root of the tree structure, i.e. the
   *     farthest ancestor of the node or the node itself if it has no parents.
   */
  getRoot(): Node {
    let root: Node = this;
    while (root.getParent()) {
      root = root.getParent()!;
    }
    return root;
  }

  /**
   * Tells whether this node is the ancestor of the given node.
   * @param node A node.
   * @return Whether this node is the ancestor of the given node.
   */
  contains(node: Node): boolean {
    let current: Node | null = node;
    do {
      current = current.getParent();
    } while (current && current !== this);
    return Boolean(current);
  }

  /**
   * Finds the deepest common ancestor of the given nodes. The concept of
   * ancestor is not strict in this case, it includes the node itself.
   * @param varArgs The nodes.
   * @return The common ancestor of the nodes or null if
   *     they are from different trees.
   */
  static findCommonAncestor(...varArgs: Node[]): Node | null {
    if (arguments.length === 0) {
      return null;
    }

    let ret = arguments[0];
    let retDepth = ret.getDepth();
    for (let i = 1; i < arguments.length; i++) {
      let node = arguments[i];
      let depth = node.getDepth();
      while (node !== ret) {
        if (depth <= retDepth) {
          ret = ret.getParent();
          retDepth--;
        }
        if (depth > retDepth) {
          node = node.getParent();
          depth--;
        }
      }
    }

    return ret;
  }

  /**
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
    depth = 0,
  ) {
    const innerTraverse = (node: NodeBase, depth: number) => {
      if (f.call(thisObj, node, depth) !== false) {
        const children = node.getChildren() as NodeBase[];
        for (const child of children) {
          innerTraverse(child, depth + 1);
        }
      }
    };
    innerTraverse(this, depth);
  }

  /**
   * @param f A function that describes
   *     which nodes to look for. It takes a node as a single argument, and
   *     returns true iff this node should be returned by the 'find' function.
   * @param thisObj An optional "this" context for the function.
   * @return The nodes that satisfy the condition.
   */
  find(f: (p1: Node) => boolean, thisObj?: AnyDuringMigration | null): Node[] {
    const nodes: AnyDuringMigration[] = [];
    this.traverse((node) => {
      if (f.call(thisObj, node)) {
        nodes.push(node);
      }
    });
    return nodes;
  }

  /**
   * @param getter A function that gets the value to aggregate for a specific node.
   * @param aggregator The aggregation function to use.
   * @param setter An optional function that sets the aggregated value for a specific node.
   * @param thisObj An optional "this" context for the getter, aggregation and setter functions.
   * @return The aggregated value.
   */
  calcAggregatedValue(
    getter: (p1: Node) => AnyDuringMigration,
    aggregator: Aggregator,
    setter?: (p1: Node, p2: AnyDuringMigration) => AnyDuringMigration,
    thisObj?: AnyDuringMigration | null,
  ): AnyDuringMigration {
    // Get the node's value using the getter function.
    const nodeValue = getter.call(thisObj, this);

    // Aggregate the value of the children recursively.
    const aggregatedChilds = [];
    const childs = this.getChildren();
    for (let i = 0; i < childs.length; i++) {
      const child = childs[i];
      const aggregatedChild = child.calcAggregatedValue(
        getter,
        aggregator,
        setter,
        thisObj,
      );
      aggregatedChilds.push(aggregatedChild);
    }
    const aggregatedValue = aggregator.call(
      thisObj,
      nodeValue,
      aggregatedChilds,
    );

    // Set the aggregated value using the setter function.
    if (setter) {
      setter.call(thisObj, this, aggregatedValue);
    }
    return aggregatedValue;
  }

  /**
   * Sets the parent node of this node. The callers must ensure that the parent
   * node and only that has this node among its children.
   * @param parent The parent to set. If null, the node
   *     will be detached from the tree.
   */
  private setParent(parent: NodeBase) {
    this.parent = parent;
  }

  /**
   * Appends a child node to this node.
   * @param child Orphan child node.
   */
  addChild(child: NodeBase) {
    asserts.assert(!child.getParent());

    child.setParent(this);
    this.children = this.children || [];
    this.children.push(child);
    this.registerDisposable(child);
  }
}
