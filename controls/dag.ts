/**
 * @fileoverview Datastructure: Directed Acyclic Graph.
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

import {map} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';

// tslint:disable:ban-types  Migration

/**
 * A general purpose Direct Acyclic Graph datastructure.
 *
 * Adding and removing edges is O(1). Isolated vertices are not allowed,
 * although forests of graphs are supported. The isValid() method exists
 * to check whether any cycles were introduced while adding edges.
 *
 * There can only be at most one edge connecting any 2 distinct nodes.
 *
 * Any object or primitive type can be used to represent a graph vertex (node).
 *
 * The graph is internally stored as a collection of nodes and a collection
 * of directed edges.
 *
 * A topologicalSort() method is offered to linearize the graph into a sorted
 * list that respects the node dependencies.
 *
 * The other methods signature loosely matches the conventions of structs
 * utility methods (getCount, getValues, ...).
 *
 * WARNING: Any Object that is added to DAG will be modified!
 * Because goog.getUid() is used to identify objects, every object in the dag
 * will be mutated by the addition of a property that uniquely identifies it
 * (@see goog.getUid).
 */
export class DAG {
  /**
   * Collects all the vertices (nodes) of the graph, keying them by their
   * unique key generated via getKey().
   *
   * // string to objects
   */
  private readonly nodes: Map<string, AnyDuringMigration>;

  /**
   * Collects all the graph edges (in their natural orientation, from parent
   * node to child node).
   *
   * The map contains only the node keys and map each parent node to the set
   * of its direct children keys.
   *
   * // string to Set of keys.
   */
  private readonly forwardEdges: Map<string, Set<string>>;

  /**
   * Collects all the graph edges (in their inverse orientation, from child
   * node to parent node).
   *
   * The map contains only the node keys and map each child node to the set
   * of its direct parents' keys.
   *
   * Simplifies the topological sort and other accessors.
   *
   * // string to Set of keys.
   */
  private readonly backwardEdges: Map<string, Set<string>>;

  /** The number of graph edges. */
  private edgeCount = 0;

  constructor() {
    this.nodes = new Map();

    this.forwardEdges = new Map();

    this.backwardEdges = new Map();
  }

  /**
   * Adds one edge to the graph. No-op if the edge already exists.
   *
   * @param parentNode The parent node. Can be a primitive or an object.
   * @param childNode The child node. Can be a primitive or an object.
   */
  addEdge(parentNode: AnyDuringMigration, childNode: AnyDuringMigration) {
    // Quit if the edge already exists.
    if (this.containsEdge(parentNode, childNode)) {
      return;
    }

    // Add nodes if needed.
    this.addNode(parentNode);
    this.addNode(childNode);

    // Register the new edge.
    this.addEdgeInternal(parentNode, childNode, this.forwardEdges);
    this.addEdgeInternal(childNode, parentNode, this.backwardEdges);
    this.edgeCount++;
  }

  /**
   * Removes one edge from the graph. No-op if the edge is not part of the
   * graph. If a node becomes isolated because of this change, it will be
   * removed as well, since the graph doesn't allow isolated nodes.
   *
   * @param parentNode The parent node. Can be a primitive or an object.
   * @param childNode The child node. Can be a primitive or an object.
   */
  removeEdge(parentNode: AnyDuringMigration, childNode: AnyDuringMigration) {
    // Quit if the edge does not exist.
    if (!this.containsEdge(parentNode, childNode)) {
      return;
    }

    // Remove the edge
    this.removeEdgeInternal(parentNode, childNode, this.forwardEdges);
    this.removeEdgeInternal(childNode, parentNode, this.backwardEdges);

    // Remove the nodes if they become isolated.
    if (this.isIsolated(parentNode)) {
      this.removeNode(parentNode);
    }

    if (this.isIsolated(childNode)) {
      this.removeNode(childNode);
    }

    this.edgeCount--;
  }

  /** Clears the graph, removing all nodes and edges. */
  clear() {
    this.nodes.clear();
    this.forwardEdges.clear();
    this.backwardEdges.clear();
    this.edgeCount = 0;
  }

  /** @return Whether the graph is empty. */
  isEmpty(): boolean {
    return this.nodes.size === 0;
  }

  /**
   * Checks whether the graph is valid, i.e. no cycles are present.
   * @return Whether the graph is valid.
   */
  isValid(): boolean {
    try {
      this.topologicalSort();
      return true;
    } catch (ex) {
      return false;
    }
  }

  /** @return The number of nodes (vertices) in the graph. */
  getCount(): number {
    return this.nodes.size;
  }

  /** @return The number of edges in the graph. */
  getEdgeCount(): number {
    return this.edgeCount;
  }

  /** @return All the graph nodes. */
  getValues(): AnyDuringMigration[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Checks whether the given node is part of the graph.
   *
   * @param node The node to check.
   * @return Whether the node is part of the graph.
   */
  contains(node: AnyDuringMigration): boolean {
    return this.nodes.has(this.getKey(node));
  }

  /**
   * Checks whether the graph contain the given edge.
   *
   * @param parentNode The parent node.
   * @param childNode The child node.
   * @return whether the graph contains the requested edge.
   */
  containsEdge(
    parentNode: AnyDuringMigration,
    childNode: AnyDuringMigration,
  ): boolean {
    const parentNodeKey = this.getKey(parentNode);
    return (
      this.forwardEdges.has(parentNodeKey) &&
      this.forwardEdges.get(parentNodeKey)!.has(this.getKey(childNode))
    );
  }

  /**
   * Returns whether the given node is a root node (it only contains outgoing
   * edges).
   *
   * @param node The node to inspect.
   * @return Whether the node is a root of the graph or not.
   */
  isRoot(node: AnyDuringMigration): boolean {
    if (!this.contains(node)) {
      return false;
    }
    return !this.backwardEdges.has(this.getKey(node));
  }

  /**
   * Returns all direct parents of the given node.
   *
   * @param node The node to inspect.
   * @return All direct parents of the given node. Returns null if the node does
   *     not have any.
   */
  getParents(node: AnyDuringMigration): AnyDuringMigration[] | null {
    if (!this.contains(node)) {
      return null;
    }
    const parentKeys = this.backwardEdges.get(
      this.getKey(node),
    ) as Set<AnyDuringMigration> | null;
    if (!parentKeys) {
      return null;
    }
    const result = [];
    for (const parentKey of parentKeys) {
      result.push(this.nodes.get(parentKey));
    }
    return result;
  }

  /**
   * Returns all direct children of the given node.
   *
   * @param node The node to inspect.
   * @return All direct children of the given node. Returns null if the node
   *     does not have any.
   */
  getChildren(node: AnyDuringMigration): AnyDuringMigration[] | null {
    if (!this.contains(node)) {
      return null;
    }
    const childKeys = this.forwardEdges.get(
      this.getKey(node),
    ) as Set<AnyDuringMigration> | null;
    if (!childKeys) {
      return null;
    }
    const result = [];
    for (const childKey of childKeys) {
      result.push(this.nodes.get(childKey));
    }
    return result;
  }

  /**
   * Returns all the graph roots.
   *
   * Raises an error if any immediate cycle is found (for example, when all
   * graph nodes are linked in a ring).
   * Note that a cycle might exist deeper in the graph, and thus not detected by
   * this method. In this case the graph roots will be identified and returned.
   *
   * @return An array containing all nodes which are graph roots.
   *     Will return an empty array if the graph is still empty.
   */
  getRoots(): AnyDuringMigration[] {
    if (this.isEmpty()) {
      return [];
    }
    const roots = [];
    for (const key of this.forwardEdges.keys()) {
      if (!this.backwardEdges.has(key)) {
        roots.push(this.nodes.get(key));
      }
    }

    if (roots.length === 0) {
      // Graph nodes are linked together in a cycle: there is no single node
      // that only has outgoing edges.
      throw new Error('Invalid state: DAG has not root node(s).');
    }
    return roots;
  }

  /**
   * Performs a topological sort and returns the graph nodes in sorted forward
   * dependency order (every element in the returned array depends only on
   * elements that precede it).
   * http://en.wikipedia.org/wiki/Topological_sorting).
   *
   * Raises an error if the sort cannot be performed because of graph cycles.
   *
   * A specific sort is not guaranteed to be chosen if multiple valid
   * topological sortings exist on the graph.
   *
   * @return An array of graph nodes sorted in topological order.
   */
  topologicalSort(): AnyDuringMigration[] {
    const backwardEdges = this.deepClone(this.backwardEdges);

    const topsort = [];
    let keysToProcess = map(
      this.getRoots(),
      function (root) {
        return this.getKey(root);
      },
      this,
    );

    while (keysToProcess.length > 0) {
      const newRoots = [];
      for (let i = 0; i < keysToProcess.length; i++) {
        const key = keysToProcess[i];
        topsort.push(this.nodes.get(key));

        const childrenKeys = this.forwardEdges.get(
          key,
        ) as Set<AnyDuringMigration> | null;
        if (!childrenKeys) {
          continue; // leaf node
        }
        for (const childKey of childrenKeys) {
          // Remove all edges pointing back to the node being processed, so
          // that new roots can be identified.
          backwardEdges.get(childKey).delete(key);
          if (backwardEdges.get(childKey).size === 0) {
            backwardEdges.delete(childKey);
            newRoots.push(childKey);
          }
        }
      }
      keysToProcess = newRoots;
    }
    if (topsort.length !== this.nodes.size) {
      throw new Error('cycle detected');
    }
    return topsort;
  }

  /**
   * Creates a shallow clone of this graph. The graph structure is cloned, but
   * not the graph nodes, which will still reference the same objects as in the
   * source graph.
   *
   * This method assumes that you have already checked the graph is valid, or
   * otherwise Bad Things Will Happen(tm).
   *
   * @return A shallow clone of this graph.
   */
  clone(): DAG {
    if (this.isEmpty()) {
      return new DAG();
    } else {
      return DAG.prototype.extractSubgraph.apply(this, this.getRoots());
    }
  }

  /**
   * Extracts a subgraph from the current one.
   * This method assumes that you have already checked the graph is valid, or
   * otherwise Bad Things Will Happen(tm).
   *
   * @param varArgs The list of nodes that will become the roots of the new
   *     graph.
   * @return The newly created subgraph.
   */
  extractSubgraph(...varArgs: AnyDuringMigration[]): DAG {
    const subgraph = new DAG();
    if (arguments.length === 0) {
      return subgraph;
    }
    for (let i = 0; i < arguments.length; i++) {
      const parentNode = arguments[i];
      this.recursivelyBuildSubgraph(parentNode, subgraph);
    }
    return subgraph;
  }

  /**
   * Recursively add edges to a graph by traversing nodes and their direct
   * children.
   *
   * @param node The node being traversed.
   * @param graph The graph being assembled.
   */
  private recursivelyBuildSubgraph(node: AnyDuringMigration, graph: DAG) {
    const children = this.getChildren(node);
    if (!children) {
      return;
    }
    for (const childNode of children) {
      graph.addEdge(node, childNode);
      this.recursivelyBuildSubgraph(childNode, graph);
    }
  }

  /**
   * Determines whether the given node is the root of a detachable subgraph.
   *
   * The subgraph is said to be detachable if the input node is the only
   * connecting point to the rest of the DAG. That is, when isolating the
   * subgraph from the DAG it belongs to, no edges are broken apart from the
   * ones connecting the subgraph root to its parents.
   *
   * Examples:
   * <pre>
   * 1) a   b   2) a   b
   *     \ /        \ /|
   *      c          c |
   *     / \        / \|
   *    d   e      d   e
   * </pre>
   * Node 'c' in case 1 identifies a detachable subgraph. Node 'c' in case 2
   * does not because of the additional edge connecting 'b' to 'e'.
   *
   * This method assumes that you have already checked the graph is valid.
   *
   * This method worst-case time complexity is O(2N), with N being the number
   * of nodes in the graph (linear in building the subgraph, linear in analyzing
   * the subgraph for broken edges).
   *
   * @param node The node to check.
   * @return Whether the node is the root of a detachable subgraph or not.
   */
  isSubgraphDetachable(node: AnyDuringMigration): boolean {
    const subgraph = this.extractSubgraph(node);
    const subgraphNodes = subgraph.getValues();
    for (let i = 0; i < subgraphNodes.length; i++) {
      const subgraphNode = subgraphNodes[i];
      if (subgraphNode === node) {
        continue;
      }

      if (
        subgraph.getParents(subgraphNode)!.length !==
        this.getParents(subgraphNode)!.length
      ) {
        return false;
      }
    }
    return true;
  }

  /**
   * Obtains a unique key for a graph node.  Primitives will yield the same key
   * if they have the same type and convert to the same string.  Object
   * references will yield the same key only if they refer to the same object.
   *
   * Derived from StructsSet equivalent function.
   *
   * @param val Object or primitive value to get a key for.
   * @return A unique key for this value/object.
   */
  private getKey(val: AnyDuringMigration): string {
    const type = typeof val;
    if ((type === 'object' && val) || type === 'function') {
      return `o${goog.getUid(val)}`;
    } else {
      return type.substring(0, 1) + (val as string);
    }
  }

  /** @param node The node to add. */
  private addNode(node: AnyDuringMigration) {
    this.nodes.set(this.getKey(node), node);
  }

  /** @param node The node to remove. */
  private removeNode(node: AnyDuringMigration) {
    this.nodes.delete(this.getKey(node));
  }

  /**
   * Adds an edge to the graph. Handles in a generic way both 'forward' and
   * 'backward' edges.
   *
   * @param startNode The node where the edge starts from.
   * @param endNode The node where the edge ends.
   * @param edgeMap A map of all known edges, all aligned in the same direction
   *     as the one being added.
   */
  private addEdgeInternal(
    startNode: AnyDuringMigration,
    endNode: AnyDuringMigration,
    edgeMap: Map<AnyDuringMigration, AnyDuringMigration>,
  ) {
    let edgesFromStartNode = edgeMap.get(this.getKey(startNode));
    if (!edgesFromStartNode) {
      edgesFromStartNode = new Set();
      edgeMap.set(this.getKey(startNode), edgesFromStartNode);
    }
    edgesFromStartNode.add(this.getKey(endNode));
  }

  /**
   * Removes an edge from the graph. Handles in a generic way both 'forward' and
   * 'backward' edges.
   *
   * @param startNode The node where the edge starts from.
   * @param endNode The node where the edge ends.
   * @param edgeMap A map of all known edges, all aligned in the same direction
   *     as the one being removed.
   */
  private removeEdgeInternal(
    startNode: AnyDuringMigration,
    endNode: AnyDuringMigration,
    edgeMap: Map<AnyDuringMigration, AnyDuringMigration>,
  ) {
    assert(edgeMap.has(this.getKey(startNode)));
    const edgesFromStartNode = edgeMap.get(this.getKey(startNode));
    edgesFromStartNode.delete(this.getKey(endNode));
    if (edgesFromStartNode.size === 0) {
      edgeMap.delete(this.getKey(startNode));
    }
  }

  /**
   * Detects whether a node is isolated from the graph, as a consequence of
   * removing some of its incoming/outgoing edges.
   * @param node The node to check.
   * @return Whether the node is isolated from the rest of the graph.
   */
  private isIsolated(node: AnyDuringMigration): boolean {
    return (
      !this.forwardEdges.has(this.getKey(node)) &&
      !this.backwardEdges.has(this.getKey(node))
    );
  }

  /**
   * Returns a deep clone of an edge map.
   * @param edgesMap A map of all known edges going in one particular direction.
   * @return The created clone.
   */
  private deepClone(
    edgesMap: Map<AnyDuringMigration, AnyDuringMigration>,
  ): Map<AnyDuringMigration, AnyDuringMigration> {
    const cloneMap = new Map();
    for (const [startNodekey, endNodeKeys] of edgesMap.entries()) {
      cloneMap.set(startNodekey, new Set(endNodeKeys));
    }
    return cloneMap;
  }
}
