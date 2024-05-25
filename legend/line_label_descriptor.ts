/**
 * @fileoverview A line label descriptor. Used by LineLabelPositioner to place
 * labels.
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

import {Entry} from './legend_definition';

/**
 * Creates a line label descriptor.
 * @unrestricted
 */
export class LineLabelDescriptor {
  /** Position of top of label. */
  private labelPos: number;

  /** An order index to keep sort stable. */
  index = 0;

  /**
   * @param dataYPos The Y position of the last data point.
   * @param height The height of the label in pixels.
   * @param labelEntry A label object.
   */
  constructor(
    private readonly dataYPos: number,
    private readonly height: number,
    private readonly labelEntry: Entry | null,
  ) {
    this.labelPos = dataYPos - height / 2;
  }

  /** @return top of assigned position. */
  getTop(): number {
    return this.labelPos;
  }

  /**
   * Sets the position.
   * @param top The new top position of label.
   */
  setTop(top: number) {
    this.labelPos = top;
  }

  /**
   * Get position of its center.
   * @return center of assigned position.
   */
  getCenter(): number {
    return this.labelPos + this.height / 2;
  }

  /** @return bottom of assigned position. */
  getBottom(): number {
    return this.labelPos + this.height;
  }

  /** @return The height. */
  getHeight(): number {
    return this.height;
  }

  /** @return data y position. */
  getDataYPos(): number {
    return this.dataYPos;
  }

  /** @return The label object. */
  getLabelEntry(): Entry | null {
    return this.labelEntry;
  }
}
