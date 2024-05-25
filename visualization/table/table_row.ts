/**
 * @fileoverview A single row in the Table visualization.
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

/**
 * A TableRow holds all information about a row of a Table.
 * In particular it holds the following:
 * 1) dataRowIndex - The index of this row in the google.visualization.DataTable.
 * 2) uiRowIndex - The index of this row in the entire UI (including all pages).
 * 3) pageRowIndex - The index of the row in the current page.
 * 4) displayNumber - The row display number.
 *
 * Example: For the following table
 * 4 A              1 D            1 D
 * 3 B   ==sort==>  2 C  ==page==> 2 C
 * 2 C              3 B            ---
 * 1 D              4 A            3 B
 *                                 4 A
 *
 * Then the properties of the row with "A" would be:
 * dataRowIndex = 1
 * uiRowIndex = 4
 * pageRowIndex = 2
 * displayNumber = 4
 *
 * @unrestricted
 */
export class TableRow {
  /**
   * A flag indicating if this row is an even row.
   * By default this set according to the row index, but the user may disable
   * alternatingRowStyle and so all rows may become 'even'.
   * rows can become 'even'.
   */
  private even = true;

  /** A flag indicating if this row is selected. */
  private selected = false;

  constructor(
    /** The index of the row in the google.visualization.DataTable. */
    private readonly dataRowIndex: number,

    /** The index of this row in the entire UI (including all pages). */
    private readonly uiRowIndex: number,

    /** The index of the row in the current page. */
    private readonly pageRowIndex: number,

    /** The row display number. */
    private readonly displayNumber: number,
  ) {}

  /**
   * Sets the flag indicating if the row is selected or unselected.
   * @param selected True marks the row as selected, false otherwise.
   */
  setSelected(selected: boolean) {
    this.selected = selected;
  }

  /**
   * Sets the flag indicating if the row is even or not even.
   * @param isEven True marks the row as 'even', false otherwise.
   */
  setEven(isEven: boolean) {
    this.even = isEven;
  }

  /**
   * Returns true of the row is selected, false otherwise.
   * @return True if the row is selected, false otherwise.
   */
  isSelected(): boolean {
    return this.selected;
  }

  /**
   * Returns true if this is an 'even' row, false otherwise.
   * @return True if the row is 'even', false otherwise.
   */
  isEven(): boolean {
    return this.even;
  }

  /**
   * Returns the data row index.
   * @return The data row index.
   */
  getDataRowIndex(): number {
    return this.dataRowIndex;
  }

  /**
   * Returns the UI row index.
   * @return The data row index.
   */
  getUIRowIndex(): number {
    return this.uiRowIndex;
  }

  /**
   * Returns the page row index.
   * @return The data row index.
   */
  getPageRowIndex(): number {
    return this.pageRowIndex;
  }

  /**
   * Returns the row display number.
   * @return The row display number.
   */
  getDisplayNumber(): number {
    return this.displayNumber;
  }
}
