/**
 * @fileoverview SelectionObject is used by the gviz.util.Selection class
 * to represent an element of the array of selections relative to the user's
 * data.
 *
 * @license
 * Copyright 2021 Google LLC
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

/**
 * Represents the type of a single selected cell.
 * The row and column are both optional, which when missing or null, represents
 * the entire row or column.
 */
export declare interface SelectionObject {
  row?: number | null;
  column?: number | null;
}

/**
 * Represents the type of a single selected cell.
 * The row and column are both required.
 * TODO(b/186535437): Integrate with gviz.canviz.CellRef.
 */
export declare interface CellRef {
  row: number;
  column: number;
}
