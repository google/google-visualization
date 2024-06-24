/**
 * @fileoverview A tree class that is created from an existing tree.
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

import {DataNodeImpl} from './data_node_impl';
import {NodeBase} from './node_base';
import {Tree} from './tree';
import {TreeBase} from './tree_base';

// tslint:disable:ban-types Migration

/**
 * A tree structure class that is created from an existing tree.
 * The structure of the existing tree is projected into the new tree.
 * Each new node is constructed from the relevant existing node using a given
 * constructor.
 * @unrestricted
 */
export class ProjectedTree extends TreeBase implements Tree {
  /**
   * @param tree The tree to project.
   * @param nodeFactory The node factory.
   * @param thisObj An optional "this" context for nodeFactory.
   * @param baseHue Used by TreeMap when rotatingHue is true.
   */
  constructor(
    tree: Tree,
    nodeFactory: NodeFactory,
    thisObj?: AnyDuringMigration,
    baseHue?: number,
    hueStep?: number,
  ) {
    super();
    const rootNodes = tree.getRootNodes();
    for (let i = 0; i < rootNodes.length; i++) {
      const rootNode = rootNodes[i] as DataNodeImpl;
      const newRootNode = this.projectNode(
        rootNode,
        nodeFactory,
        thisObj,
        baseHue,
        hueStep,
      );
      this.addRootNode(newRootNode);
    }
  }

  /**
   * @param node The node to project.
   * @param nodeFactory The node factory.
   * @param thisObj An optional "this" context for nodeFactory.
   * @return The newly created node.
   */
  private projectNode(
    node: DataNodeImpl,
    nodeFactory: NodeFactory,
    thisObj?: AnyDuringMigration,
    baseHue?: number,
    hueStep?: number,
  ): NodeBase {
    let newNodeHue: number | null = null;
    let hue: number | undefined;
    const rotatingHue = baseHue != null && hueStep != null;
    baseHue = baseHue || 0;
    hueStep = hueStep || 0;
    if (rotatingHue) {
      // Compute the hue for the new node.
      newNodeHue = (baseHue + (hueStep / 2) * node.getChildCount()) % 360;
      hue = baseHue;
    }

    const newNode = nodeFactory.call(thisObj, node, newNodeHue);

    const children = node.getChildren() as DataNodeImpl[];
    let newChild;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (rotatingHue) {
        newChild = this.projectNode(
          child,
          nodeFactory,
          thisObj,
          hue,
          child.isLeaf() ? 0 : hueStep / child.getChildCount(),
        );
        hue = (hue! + hueStep) % 360;
      } else {
        newChild = this.projectNode(child, nodeFactory, thisObj);
      }

      this.addNode(newChild);
      newNode.addChild(newChild);
    }
    return newNode;
  }
}

/**
 * A function that creates a new node from an existing one.
 * The second arg is an optional hue, used with the rotatingHue feature.
 * was: typedef {function(!DataNodeImpl, ?number): !NodeBase}
 */
export type NodeFactory = (data: DataNodeImpl, hue: number | null) => NodeBase;
