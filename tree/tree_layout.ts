/**
 * @fileoverview An implementation of a top-down tree layout based on the
 * Reingold-Tilford algorithm.
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

import {Node} from './node';
import {NodeBase} from './node_base';
import {ProjectedTree} from './projected_tree';
import {Tree} from './tree';

/**
 * Construct a new tree layout where nodes are arranged in horizontal layers
 * with root nodes at the top, and subtrees placed next to each other as close
 * as possible subject to node non-overlapping constraints. The layout can be
 * used like this:
 *
 * const tree: Tree = myTree();
 * const layout = new TreeLayout(tree, (node) => 10, (node) => 10, 5, 5);
 * const someNode = tree.getRootNodes()[0];
 * myRenderNode(someNode, layout.getX(someNode), layout.getY(someNode));
 *
 * @unrestricted
 */
export class TreeLayout {
  /**
   * The final center x-coordinate of each node.
   */
  private readonly x = new Map<Node, number>();

  /**
   * The final center y-coordinate of each node.
   */
  private readonly y = new Map<Node, number>();

  /**
   * @param tree The tree to be laid out.
   * @param nodeWidth The node width function. Defaults to 0.
   * @param nodeHeight The node height function. Defaults to 0.
   * @param horizontalSpacing The minimum horizontal distance between nodes.
   * Defaults to 1.
   * @param verticalSpacing The minimum vertical distance between nodes.
   * Defaults to 1.
   */
  constructor(
    private readonly tree: Tree,
    private readonly nodeWidth: (node: Node) => number = (node) => 0,
    private readonly nodeHeight: (node: Node) => number = (node) => 0,
    private readonly horizontalSpacing: number = 1,
    private readonly verticalSpacing: number = 1,
  ) {
    this.layout();
  }

  /**
   * Returns the computed center x-coordinate of the given node.
   * @param node The context node.
   * @return The x-coordinate of the node.
   */
  getX(node: Node): number {
    return this.x.get(node) || 0;
  }

  /**
   * Returns the computed center y-coordinate of the given node.
   * @param node The context node.
   * @return The y-coordinate of the node.
   */
  getY(node: Node): number {
    return this.y.get(node) || 0;
  }

  /**
   * The main layout method.
   */
  private layout() {
    if (this.tree.getTreeCount() === 0) return;
    // Create a copy of the tree with additional layout data.
    const layoutTree = new ProjectedTree(
      this.tree,
      (node) => new LayoutNode(node),
    );
    // Assign y-coordinates first.
    this.assignY(layoutTree);
    // Calculate the x-coordinates. The x-coordinates of all but the root nodes
    // are relative to their parent nodes.
    this.layoutAndCompactTrees(layoutTree.getRootNodes() as LayoutNode[]);
    // Translate the relative coordinates to absolute coordinates and
    // store them in the map of final positions.
    layoutTree.traverse((node, depth) => {
      const layoutNode = node as LayoutNode;
      if (node.getParent()) {
        const parent = node.getParent() as LayoutNode;
        layoutNode.x += parent.x;
      }
    });
    this.storeFinalCoordinates(layoutTree);
  }

  /**
   * Calculates the y-coordinates for all nodes.
   */
  private assignY(layoutTree: Tree) {
    // Find the maximum height of a node in each level.
    const levelHeight: number[] = new Array(layoutTree.getHeight() + 1);
    for (let i = 0; i < levelHeight.length; i++) levelHeight[i] = 0;
    layoutTree.traverse((node, depth) => {
      const layoutNode = node as LayoutNode;
      levelHeight[depth] = Math.max(
        levelHeight[depth],
        this.nodeHeight(layoutNode.node),
      );
    });
    // Place the root nodes at coordinate 0 and each child node at least the
    // vertical spacing below its parent.
    layoutTree.traverse((node, depth) => {
      const layoutNode = node as LayoutNode;
      if (layoutNode.getParent() === null) {
        layoutNode.y = 0;
      } else {
        const parent = layoutNode.getParent() as LayoutNode;
        // Use the heights of the levels rather than individual nodes to
        // compute the distance. This ensures that nodes in each level are
        // center-aligned.
        const distance =
          (levelHeight[depth - 1] + levelHeight[depth]) / 2 +
          this.verticalSpacing;
        layoutNode.y = parent.y - distance;
      }
    });
  }

  /**
   * Layouts all subtrees rooted at the given nodes and places them next to
   * each other horizontally as close as possible without introducing node
   * overlaps.
   */
  private layoutAndCompactTrees(roots: LayoutNode[]) {
    this.layoutTree(roots[0]);
    for (let i = 1; i < roots.length; i++) {
      this.layoutTree(roots[i]);
      // To place the tree rooted at roots[i] to the right of the already
      // laid out trees, we need to follow the left and right contour of the
      // already laid out part. The leftmost and rightmost nodes at the top
      // level, i.e. roots[0] and roots[i - 1], respectively, are passed
      // as arguments.
      this.compactTree(roots[0], roots[i - 1], roots[i]);
    }
  }

  /**
   * Layouts the tree rooted at the given node.
   */
  private layoutTree(root: LayoutNode) {
    if (root.getChildCount() === 0) {
      // This is a leaf node. The base case.
      root.x = root.leftX = root.rightX = 0;
      root.nextLeftNode = root.nextRightNode = null;
      return;
    }
    // Layout all subtrees first and compact them horizontally.
    const children = root.getChildren() as LayoutNode[];
    this.layoutAndCompactTrees(children);
    // Place the root in the middle between the leftmost and rightmost child.
    const leftChild = children[0];
    const rightChild = children[root.getChildCount() - 1];
    root.x = root.leftX = root.rightX = (leftChild.x + rightChild.x) / 2;
    // Update the left and right contour pointers.
    root.nextLeftNode = leftChild;
    root.nextRightNode = rightChild;
    // Make the coordinates of the child nodes relative to the parent.
    for (let i = 0; i < children.length; i++) {
      children[i].x -= root.x;
    }
    leftChild.leftX -= root.x;
    rightChild.rightX -= root.x;
  }

  /**
   * Places the subtree rooted at root to the right of a sequence of already
   * laid out subtrees.
   * @param left The root of the leftmost tree of the laid out subtrees.
   * @param right The root of the rightmost tree of the laid out subtrees.
   * @param root The root of the tree that should be appended to the right.
   */
  private compactTree(left: LayoutNode, right: LayoutNode, root: LayoutNode) {
    // We are going to follow the left and right contours of both the already
    // compacted sequence of trees (let's call them old) and the new tree that
    // is to be placed at the right side. The parameters left and right are
    // reused to follow the contours of the old trees. The variables otherLeft
    // and otherRight represent the contour of the new tree.
    let otherLeft = root;
    let otherRight = root;
    // The absolute coordinates of the two pairs of left/right contours.
    let leftX = left.x;
    let rightX = right.x;
    let otherLeftX = root.x;
    let otherRightX = root.x;
    // This is the amount that we need to shift the new tree to the right to
    // ensure compact overlap-free layout. Can be negative, which means shifting
    // to the left side.
    let shift = Number.NEGATIVE_INFINITY;
    // We are going to follow down the left/right contours of the trees until
    // one of them ends.
    let keepGoing = true;
    while (keepGoing) {
      // The minimum distance between the rightmost old node and the leftmost
      // new node in the current level.
      const distance =
        (this.nodeWidth(right.node) + this.nodeWidth(otherLeft.node)) / 2 +
        this.horizontalSpacing;
      // The minimal valid overlap-free coordinate of the new node.
      const minX = rightX + distance;
      // Take the maximum shift necessary to avoid node overlaps.
      shift = Math.max(shift, minX - otherLeftX);
      if (right.nextRightNode === null || otherLeft.nextLeftNode === null) {
        // One of the contours ends, so we stop.
        keepGoing = false;
      } else {
        // Descend one level down following the contours.
        left = left.nextLeftNode!;
        right = right.nextRightNode;
        otherLeft = otherLeft.nextLeftNode;
        otherRight = otherRight.nextRightNode!;
        leftX += left.leftX;
        rightX += right.rightX;
        otherLeftX += otherLeft.leftX;
        otherRightX += otherRight.rightX;
      }
    }
    // Shift the new tree to avoid overlaps with the old trees.
    root.x += shift;
    root.rightX += shift;
    // Join the new tree by merging the left/right contours.
    if (right.nextRightNode != null) {
      const reconnectNode = right.nextRightNode;
      const reconnectNodeX = rightX + reconnectNode.rightX;
      otherRight.nextRightNode = reconnectNode;
      reconnectNode.rightX = reconnectNodeX - (otherRightX + shift);
    } else if (otherLeft.nextLeftNode != null) {
      const reconnectNode = otherLeft.nextLeftNode;
      const reconnectNodeX = otherLeftX + reconnectNode.leftX;
      left.nextLeftNode = reconnectNode;
      reconnectNode.leftX = reconnectNodeX + shift - leftX;
    }
  }

  /**
   * Stores the final coordinates. The drawing is shifted such that it lays
   * fully inside the first (positive) quadrant of the coordinate plane touching
   * the coordinate axes.
   */
  private storeFinalCoordinates(layoutTree: Tree) {
    // Calculate the amount of shifting necessary.
    let shiftX = Number.NEGATIVE_INFINITY;
    let shiftY = Number.NEGATIVE_INFINITY;
    layoutTree.traverse((node, depth) => {
      const layoutNode = node as LayoutNode;
      const minX = this.nodeWidth(layoutNode.node) / 2;
      const minY = this.nodeHeight(layoutNode.node) / 2;
      shiftX = Math.max(shiftX, minX - layoutNode.x);
      shiftY = Math.max(shiftY, minY - layoutNode.y);
    });
    // Store the final shifted coordinates.
    layoutTree.traverse((node, depth) => {
      const layoutNode = node as LayoutNode;
      this.x.set(layoutNode.node, layoutNode.x + shiftX);
      this.y.set(layoutNode.node, layoutNode.y + shiftY);
    });
  }
}

/**
 * Builds a layout node, which is a wrapper of a tree node with additional
 * layout data.
 * @unrestricted
 */
class LayoutNode extends NodeBase {
  /**
   * The x-coordinate of the node. Can be absolute or relative to the parent
   * depending on the context.
   */
  x: number;

  /**
   * The y-coordinate of the node.
   */
  y: number;

  /**
   * The x-coordinate of the node if it is part of an active left contour;
   * not used otherwise. The coordinate is relative to the previous node on this
   * left contour.
   */
  leftX: number;

  /**
   * The x-coordinate of the node if it is part of an active right contour;
   * not used otherwise. The coordinate is relative to the previous node on this
   * right contour.
   */
  rightX: number;

  /**
   * Points to the next contour node if this node is part of an active left
   * contour; not used otherwise.
   */
  nextLeftNode: LayoutNode | null;

  /**
   * Points to the next contour node if this node is part of an active right
   * contour; not used otherwise.
   */
  nextRightNode: LayoutNode | null;

  /**
   * @param node The wrappee tree node.
   */
  constructor(readonly node: Node) {
    super(node.getId(), node.getName());
    this.x = this.y = this.leftX = this.rightX = 0;
    this.nextLeftNode = this.nextRightNode = null;
  }
}
