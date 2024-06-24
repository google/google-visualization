/**
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

import 'jasmine';

import {NodeBase} from './node_base';
import {TreeBase} from './tree_base';
import {TreeLayout} from './tree_layout';

describe('Tree Layout Test', () => {
  it('Christmas Tree', () => {
    testUniformNodeSizeTree(
      [-1, 0, 0, 0, 2, 2, 2],
      [0, -15, 0, 15, -15, 0, 15],
      [0, -15, -15, -15, -30, -30, -30],
      10,
      10,
      5,
      5,
    );
  });
  it('Complete Binary Tree', () => {
    testUniformNodeSizeTree(
      [-1, 0, 0, 1, 1, 2, 2],
      [0, -15, 15, -22.5, -7.5, 7.5, 22.5],
      [0, -6, -6, -12, -12, -12, -12],
      10,
      5,
      5,
      1,
    );
  });
  it('Combine Left Contour', () => {
    testUniformNodeSizeTree(
      [-1, 0, 0, 1, 2, 2, 3, 3, 3, 5, 5],
      [0, -1, 1, -1, 0.5, 1.5, -2, -1, 0, 1, 2],
      [0, -1, -1, -2, -2, -2, -3, -3, -3, -3, -3],
      0,
      0,
      1,
      1,
    );
  });
  it('Tree and Its Mirror Image', () => {
    testUniformNodeSizeTree(
      [-1, -1, 0, 0, 1, 1, 3, 3, 4, 4, 7, 7, 8, 8],
      [0, 4, -0.5, 0.5, 3.5, 4.5, 0, 1, 3, 4, 0.5, 1.5, 2.5, 3.5],
      [0, 0, -1, -1, -1, -1, -2, -2, -2, -2, -3, -3, -3, -3],
      0,
      0,
      1,
      1,
    );
  });
  it('Five Isolated Nodes', () => {
    testUniformNodeSizeTree(
      [-1, -1, -1, -1, -1],
      [0, 1, 2, 3, 4],
      [0, 0, 0, 0, 0],
      0,
      0,
      1,
      1,
    );
  });
  it('Varying Node Size', () => {
    // Complete binary tree with three levels.
    const tree = new TestTree([-1, 0, 0, 1, 1, 2, 2]);
    // Let the height equal the id of the node and the width be twice as much.
    const layout = new TreeLayout(
      tree,
      (node) => (node.getId() as number) * 2,
      (node) => node.getId() as number,
      1,
      1,
    );
    const root = tree.getRootNodes()[0];
    const rootX = layout.getX(root);
    const rootY = layout.getY(root);

    const expectedX = [0, -10, 10, -14, -6, 4, 16];
    const expectedY = [0, -2, -2, -7, -7, -7, -7];

    for (let i = 0; i < 7; i++) {
      const node = tree.getNodeById(i);
      expect(layout.getX(node)).toBe(rootX + expectedX[i]);
      expect(layout.getY(node)).toBe(rootY + expectedY[i]);
    }
  });
});

function testUniformNodeSizeTree(
  parents: number[],
  expectedX: number[],
  expectedY: number[],
  nodeWidth: number,
  nodeHeight: number,
  horizontalSpacing: number,
  verticalSpacing: number,
) {
  const tree = new TestTree(parents);
  const layout = new TreeLayout(
    tree,
    (node) => nodeWidth,
    (node) => nodeHeight,
    horizontalSpacing,
    verticalSpacing,
  );
  const root = tree.getRootNodes()[0];
  const rootX = layout.getX(root);
  const rootY = layout.getY(root);

  for (let i = 0; i < parents.length; i++) {
    const node = tree.getNodeById(i);
    expect(layout.getX(node)).toBe(rootX + expectedX[i]);
    expect(layout.getY(node)).toBe(rootY + expectedY[i]);
  }

  // Verify that the lower left corner of the drawing is at (0,0);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  tree.traverse((node, depth) => {
    minX = Math.min(minX, layout.getX(node) - nodeWidth / 2);
    minY = Math.min(minY, layout.getY(node) - nodeHeight / 2);
  });
  expect(minX).toBe(0);
  expect(minY).toBe(0);
}

class TestTree extends TreeBase {
  constructor(parents: number[]) {
    super();
    const nodes = [];
    for (let i = 0; i < parents.length; i++) {
      nodes.push(new NodeBase(i, i.toString()));
      if (parents[i] !== -1) {
        this.addNode(nodes[i]);
        nodes[parents[i]].addChild(nodes[i]);
      } else {
        this.addRootNode(nodes[i]);
      }
    }
  }
}
