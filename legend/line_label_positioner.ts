/**
 * @fileoverview Positions line labels vertically to be close to their lines.
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

import * as googMath from '@npm//@closure/math/math';

import {LineLabelDescriptor} from './line_label_descriptor';

/**
 * Creates a positioner.
 * @unrestricted
 */
export class LineLabelPositioner {
  /**
   * @param totalHeight Total height at disposal.
   * @param labelDescriptors The labels to place.
   */
  constructor(
    private readonly totalHeight: number,
    private readonly labelDescriptors: LineLabelDescriptor[],
  ) {
    for (let i = 0, len = labelDescriptors.length; i < len; i++) {
      labelDescriptors[i].index = i;
    }
  }

  /**
   * Adjusts the positions of the label descriptors.
   * Assumes all labels fit. Font size should be adjusted prior to running this.
   * The algorithm works by creating a description group (array) for each label
   * and then merging adjacent groups if they overlap until no groups overlap.
   * @throws Error If all labels doesn't fit.
   * @suppress {checkTypes}
   */
  adjustPositions() {
    let heightSum = 0;
    for (let i = 0, len = this.labelDescriptors.length; i < len; i++) {
      heightSum += this.labelDescriptors[i].getHeight();
    }
    if (heightSum > this.totalHeight) {
      throw new Error(
        `Not enough space for labels. Need: ${heightSum}; got: ${this.totalHeight}`,
      );
    }

    this.labelDescriptors.sort((a, b) => {
      const aPos = a.getDataYPos();
      const bPos = b.getDataYPos();
      if (aPos === bPos) {
        return a.index > b.index ? 1 : 0;
      }
      return aPos > bPos ? 1 : -1;
    });

    for (let i = 0, len = this.labelDescriptors.length; i < len; i++) {
      const descriptor = this.labelDescriptors[i];
      const pos = this.adjustToFitInRange(
        descriptor.getTop(),
        descriptor.getHeight(),
      );
      descriptor.setTop(pos);
    }

    const descriptorGroups = [];
    for (let j = 0, len = this.labelDescriptors.length; j < len; j++) {
      descriptorGroups.push([this.labelDescriptors[j]]);
    }

    while (this.adjustNextOverlap(descriptorGroups)) {}
  }

  /**
   * Tests if any adjacent groups collide and merges them if they do.
   * @param descriptorGroups The groups to test.
   * @return True if two groups collided and had to be merged.
   */
  private adjustNextOverlap(
    descriptorGroups: LineLabelDescriptor[][],
  ): boolean {
    for (let i = 0; i < descriptorGroups.length - 1; i++) {
      const thisGroup = descriptorGroups[i];
      const nextGroup = descriptorGroups[i + 1];
      if (this.overlaps(thisGroup, nextGroup)) {
        this.mergeGroups(thisGroup, nextGroup);
        descriptorGroups.splice(i + 1, 1); // remove [i + 1] element
        return true;
      }
    }
    return false;
  }

  /**
   * Tests if two groups overlaps.
   * @param thisGroup The first group.
   * @param nextGroup The second group.
   * @return True if they overlap.
   */
  private overlaps(
    thisGroup: LineLabelDescriptor[],
    nextGroup: LineLabelDescriptor[],
  ): boolean {
    const bottom = thisGroup[thisGroup.length - 1];
    return bottom.getBottom() > nextGroup[0].getTop();
  }

  /**
   * Merges two groups into the first and repositions according to the group
   * members' average position.
   * @param thisGroup The first group.
   * @param nextGroup The second group.
   */
  private mergeGroups(
    thisGroup: LineLabelDescriptor[],
    nextGroup: LineLabelDescriptor[],
  ) {
    for (let i = 0; i < nextGroup.length; i++) {
      thisGroup.push(nextGroup[i]);
    }

    let sumY = 0;
    let sumHeight = 0;
    for (let i = 0; i < thisGroup.length; i++) {
      sumY += thisGroup[i].getDataYPos();
      sumHeight += thisGroup[i].getHeight();
    }
    const avgY = sumY / thisGroup.length;
    let startPos = avgY - sumHeight / 2;

    startPos = this.adjustToFitInRange(startPos, sumHeight);

    for (let i = 0; i < thisGroup.length; i++) {
      const descriptor = thisGroup[i];
      descriptor.setTop(startPos);
      startPos += descriptor.getHeight();
    }
  }

  /**
   * Adjusts a top position with a given height so that it fits in
   * 0..totalHeight.
   * @param pos The position of the item (descriptor or group).
   * @param height The height of the item.
   * @return The possibly adjusted position.
   */
  private adjustToFitInRange(pos: number, height: number): number {
    return googMath.clamp(pos, 0, this.totalHeight - height);
  }
}
