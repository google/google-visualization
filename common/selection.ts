/**
 * @fileoverview A utility class to manage a set of selected row, column and
 * cell indexes.
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

import * as gvizObject from './object';
import {CellRef, SelectionObject} from './selection_object';

/**
 * Returns a set containing members that appear in the first given set but not
 * in the second.
 * @param firstSet The first set.
 * @param secondSet The second set.
 * @return A set with the indexes in the set difference of
 *     the two given sets.
 */
function setDifference(
  firstSet: Set<string>,
  secondSet: Set<string>,
): Set<string> {
  return new Set([...firstSet].filter((x) => !secondSet.has(x)));
}

/**
 * Returns true iff firstSet and secondSet are equal.
 * That is, every value in firstSet is in secondSet and vice versa.
 */
function setEquals(firstSet: Set<string>, secondSet: Set<string>): boolean {
  return (
    firstSet.size === secondSet.size &&
    [...firstSet].every((value) => secondSet.has(value))
  );
}

/**
 * Represents selection object in the internal form.
 */
export class Selection {
  private selectedRows: Set<string>;
  private selectedColumns: Set<string>;
  private selectedCells: Set<string>;
  /**
   * Constructs an empty selection.
   */
  constructor() {
    /**
     * The set of currently selected row indexes. A map with the key of the
     * index (as string) and value is 1.
     */
    this.selectedRows = new Set<string>();

    /**
     * The set of currently selected column indexes. A map with the key of the
     * index (as string) and value is 1.
     */
    this.selectedColumns = new Set<string>();

    /**
     * The set of currently selected cells. A map with the key of the
     * row and column indexes of the cell (as string) and value is 1.
     */
    this.selectedCells = new Set<string>();
  }

  /**
   * Clears all the selected indexes (rows, columns and cells).
   */
  clear() {
    this.selectedRows = new Set<string>();
    this.selectedColumns = new Set<string>();
    this.selectedCells = new Set<string>();
  }

  /**
   * Clones the selection object.
   * @return The cloned selection.
   */
  clone(): Selection {
    const cloned = new Selection();
    cloned.selectedRows = new Set(this.selectedRows);
    cloned.selectedColumns = new Set(
      gvizObject.arrayFromSet(this.selectedColumns),
    );
    cloned.selectedCells = new Set(gvizObject.arrayFromSet(this.selectedCells));
    return cloned;
  }

  /**
   * Returns whether the selection object is equal to another.
   * @param other The selection object to compare to.
   * @return True if they are equal, false otherwise.
   */
  equals(other: Selection): boolean {
    return (
      setEquals(this.selectedRows, other.selectedRows) &&
      setEquals(this.selectedColumns, other.selectedColumns) &&
      setEquals(this.selectedCells, other.selectedCells)
    );
  }

  /**
   * Returns an array of numbers of the selected property indexes. The given
   * property can be either 'row' or 'column'.
   * If nothing is selected, returns an empty array.
   * @param propertyName The given property
   *     name.
   * @return The selected property indexes.
   */
  private getIndexes(propertyName: SelectionProperty): number[] {
    const selectedProperties =
      propertyName === SelectionProperty.ROW
        ? this.selectedRows
        : this.selectedColumns;
    const properties = gvizObject.arrayFromSet(selectedProperties);
    const selection = properties.map((ind) => Number(ind));
    return selection;
  }

  /**
   * Returns an array of numbers of the selected row indexes.
   * If nothing is selected, returns an empty array.
   * @return The selected row indexes.
   */
  getRowIndexes(): number[] {
    return this.getIndexes(SelectionProperty.ROW);
  }

  /**
   * Returns an array of numbers of the selected column indexes.
   * If nothing is selected, returns an empty array.
   * @return The selected column indexes.
   */
  getColumnIndexes(): number[] {
    return this.getIndexes(SelectionProperty.COLUMN);
  }

  /**
   * Returns an array of objects of the selected cell references.
   * Each object has a property 'row' of the non-null row index and
   * a property 'column' with the non-null column index.
   * If nothing is selected, returns an empty array.
   * @return The selected cell references.
   */
  getCells(): CellRef[] {
    const cells = gvizObject.arrayFromSet(this.selectedCells);
    const selection = cells.map((ind) => {
      const indexes = ind.split(CELL_INDEXES_SEPARATOR);
      return {row: Number(indexes[0]), column: Number(indexes[1])};
    });
    return selection;
  }

  /**
   * Returns an array of objects, one per selected property. Each object has
   * either a property 'column' with the index of the selected column (as a
   * number), or a property 'row' with the index of the selected row (as a
   * number) or both (i.e., property cell). If nothing is selected, returns an
   * empty array.
   * @return The selection.
   */
  getSelection(): SelectionObject[] {
    const rowIndexes = this.getRowIndexes();
    const columnIndexes = this.getColumnIndexes();
    const cellIndexes = this.getCells();

    const selection = [
      ...rowIndexes.map((index) => ({
        [SelectionProperty.ROW]: index,
        [SelectionProperty.COLUMN]: null,
      })),
      ...columnIndexes.map((index) => ({
        [SelectionProperty.ROW]: null,
        [SelectionProperty.COLUMN]: index,
      })),
      ...cellIndexes.map((cell) => ({
        [SelectionProperty.ROW]: cell.row,
        [SelectionProperty.COLUMN]: cell.column,
      })),
    ];
    return selection;
  }

  /**
   * Checks if the given indexes are part of the selection of the given
   * property. If the given property is 'row' or 'column', only one index is
   * provided. Otherwise, the property is 'cell' and so 2 indexes are provided:
   * the row and column representing the cell to check.
   * @param propertyName The given property.
   * @param indexes The indexes to check if they are in the
   *     selection.
   * @return True if the indexes are part of the property selection.
   */
  private contains(propertyName: string, indexes: number[]): boolean {
    if (propertyName === SelectionProperty.ROW) {
      return this.containsRow(indexes[0]);
    }
    if (propertyName === SelectionProperty.COLUMN) {
      return this.containsColumn(indexes[0]);
    }
    return this.containsCell(indexes[0], indexes[1]);
  }

  /**
   * Checks if the given row index is part of the selection.
   * @param index The row index to check if it is in the selection.
   * @return True if the index is part of the row selection.
   */
  containsRow(index: number): boolean {
    return this.selectedRows.has(String(index));
  }

  /**
   * Checks if the given column index is part of the selection.
   * @param index The column index to check if it is in the selection.
   * @return True if the index is part of the column selection.
   */
  containsColumn(index: number): boolean {
    return this.selectedColumns.has(String(index));
  }

  /**
   * Checks if the given cell is a part of the cell selection.
   * @param rowIndex The row index of the cell.
   * @param colIndex The column index of the cell.
   * @return True if the cell is part of the cell selection.
   */
  containsCell(rowIndex: number, colIndex: number): boolean {
    return this.selectedCells.has(
      `${rowIndex}${CELL_INDEXES_SEPARATOR}${colIndex}`,
    );
  }

  /**
   * Adds the given indexes to the selection of the given property. If the given
   * property is 'row' or 'column', only one index is provided. Otherwise, the
   * property is 'cell' and so 2 indexes are provided: the row and column
   * representing the cell to add.
   * @param propertyName The property name.
   * @param indexes The indexes to add.
   * @return True if the indexes were added, false if they were
   *       already a part of the selection.
   */
  private add(propertyName: string, indexes: number[]): boolean {
    if (this.contains(propertyName, indexes)) {
      return false;
    }
    if (propertyName === SelectionProperty.ROW) {
      this.selectedRows.add(String(indexes[0]));
    } else if (propertyName === SelectionProperty.COLUMN) {
      this.selectedColumns.add(String(indexes[0]));
    } else {
      this.selectedCells.add(
        `${indexes[0]}${CELL_INDEXES_SEPARATOR}${indexes[1]}`,
      );
    }
    return true;
  }

  /**
   * Adds a row index to the selection.
   * @param index The index to add to the row selection.
   * @return True if the index was added, false if it was already
   * a part of the row selection.
   */
  addRow(index: number): boolean {
    return this.add(SelectionProperty.ROW, [index]);
  }

  /**
   * Adds a column index to the selection.
   * @param index The index to add to the column selection.
   * @return True if the index was added, false if it was already
   * a part of the column selection.
   */
  addColumn(index: number): boolean {
    return this.add(SelectionProperty.COLUMN, [index]);
  }

  /**
   * Adds cell indexes to the selection.
   * @param rowIndex The row index of the cell to add.
   * @param colIndex The column index of the cell to add.
   * @return True if the indexws were added, false if they were
   *     already
   * a part of the cell selection.
   */
  addCell(rowIndex: number, colIndex: number): boolean {
    return this.add('cell', [rowIndex, colIndex]);
  }

  /**
   * Toggles a row index into or out of the selection.
   * @param index The index to toggle.
   * @param isSingleSelect If set to true, all the rest of the
   *      selection (rows columns and cells) is cleared in addition to toggling
   *      the given row.
   * @return True if the index was added, false if it was removed.
   */
  toggleRow(index: number, isSingleSelect?: boolean): boolean {
    const contains = this.containsRow(index);
    if (isSingleSelect) {
      this.clear();
    }
    if (contains) {
      this.removeRow(index);
    } else {
      this.addRow(index);
    }
    return !contains;
  }

  /**
   * Toggles a column index into or out of the selection.
   * @param index The index to toggle.
   * @param isSingleSelect If set to true, all the rest of the
   *      selection (rows columns and cells) is cleared in addition to toggling
   *      the given column.
   * @return True if the index was added, false if it was removed.
   */
  toggleColumn(index: number, isSingleSelect?: boolean): boolean {
    const contains = this.containsColumn(index);
    if (isSingleSelect) {
      this.clear();
    }
    if (contains) {
      this.removeColumn(index);
    } else {
      this.addColumn(index);
    }
    return !contains;
  }

  /**
   * Toggles a cell into or out of the selection.
   * @param rowIndex The row index of the cell to toggle.
   * @param colIndex The column index of the cell to toggle.
   * @param isSingleSelect If set to true, all the rest of the
   *      selection (rows columns and cells) is cleared in addition to toggling
   *      the given cell.
   * @return True if the index was added, false if it was removed.
   */
  toggleCell(
    rowIndex: number,
    colIndex: number,
    isSingleSelect?: boolean,
  ): boolean {
    const contains = this.containsCell(rowIndex, colIndex);
    if (isSingleSelect) {
      this.clear();
    }
    if (contains) {
      this.removeCell(rowIndex, colIndex);
    } else {
      this.addCell(rowIndex, colIndex);
    }
    return !contains;
  }

  /**
   * Removes a row index from the selection.
   * @param index The index to remove from the rows selection.
   * @return True if the index was removed, false if it was not
   * a part of the row selection.
   */
  removeRow(index: number): boolean {
    if (!this.containsRow(index)) {
      return false;
    }
    this.selectedRows.delete(String(index));
    return true;
  }

  /**
   * Removes a column index from the selection.
   * @param index The index to remove from the columns selection.
   * @return True if the index was removed, false if it was not
   * a part of the column selection.
   */
  removeColumn(index: number): boolean {
    if (!this.containsColumn(index)) {
      return false;
    }
    this.selectedColumns.delete(String(index));
    return true;
  }

  /**
   * Removes a cell index from the selection.
   * @param rowIndex The row index of the cell to remove.
   * @param colIndex The column index of the cell to remove.
   * @return True if the cell was removed, false if it was not
   *     a part of the cells selection.
   */
  removeCell(rowIndex: number, colIndex: number): boolean {
    if (!this.containsCell(rowIndex, colIndex)) {
      return false;
    }
    this.selectedCells.delete(
      `${rowIndex}${CELL_INDEXES_SEPARATOR}${colIndex}`,
    );
    return true;
  }

  /**
   * Removes all cells from the selection.
   */
  removeAllCells() {
    this.selectedCells = new Set();
  }

  /**
   * Removes all rows from the selection.
   */
  removeAllRows() {
    this.selectedRows = new Set();
  }

  /**
   * Removes all columns from the selection.
   */
  removeAllColumns() {
    this.selectedColumns = new Set();
  }

  /**
   * Sets the selection to a new selection, and returns information on
   * what was changed: which indexes were added and which were removed from
   * the selection.
   * @param newSelection The new selection.
   *     An array of objects, each object has either a property 'row'
   *     with the index of the selected row (as a number), or a property
   * 'column' with the index of the selected column, or both (i.e., indexes for
   * a cell).
   * @return Information what was changed:
   *     which indexes were added and which were removed.
   */
  setSelection(newSelection: SelectionObject[] | null): SelectionChange {
    const newRowsSelectionSet = new Set<string>();
    const newColumnsSelectionSet = new Set<string>();
    const newCellsSelectionSet = new Set<string>();

    if (!newSelection) {
      newSelection = [];
    }

    // Build new sets for the selected rows, columns and cells out of the new
    // selection.
    for (let i = 0; i < newSelection.length; i++) {
      const item = newSelection[i];
      if (item.row != null && item.column != null) {
        newCellsSelectionSet.add(
          `${item.row}${CELL_INDEXES_SEPARATOR}${item.column}`,
        );
      } else if (item.row != null) {
        newRowsSelectionSet.add(String(item.row));
      } else if (item.column != null) {
        newColumnsSelectionSet.add(String(item.column));
      }
    }

    // Find what was added.
    const addedRowsSet = setDifference(newRowsSelectionSet, this.selectedRows);
    const addedColumnsSet = setDifference(
      newColumnsSelectionSet,
      this.selectedColumns,
    );
    const addedCellsSet = setDifference(
      newCellsSelectionSet,
      this.selectedCells,
    );

    // Find what was removed.
    const removedRowsSet = setDifference(
      this.selectedRows,
      newRowsSelectionSet,
    );
    const removedColumnsSet = setDifference(
      this.selectedColumns,
      newColumnsSelectionSet,
    );
    const removedCellsSet = setDifference(
      this.selectedCells,
      newCellsSelectionSet,
    );

    // Set the new selection and the return value.
    this.selectedRows = newRowsSelectionSet;
    this.selectedColumns = newColumnsSelectionSet;
    this.selectedCells = newCellsSelectionSet;

    const addedSelection = new Selection();
    addedSelection.selectedRows = addedRowsSet;
    addedSelection.selectedColumns = addedColumnsSet;
    addedSelection.selectedCells = addedCellsSet;

    const removedSelection = new Selection();
    removedSelection.selectedRows = removedRowsSet;
    removedSelection.selectedColumns = removedColumnsSet;
    removedSelection.selectedCells = removedCellsSet;

    return new SelectionChange(addedSelection, removedSelection);
  }
}

/**
 * The character that separates between the row index and the column index in
 * the string that represents the cell index.
 */
const CELL_INDEXES_SEPARATOR = ',';

/**
 * Property names of a cell selection.
 */
enum SelectionProperty {
  ROW = 'row',
  COLUMN = 'column',
}

/**
 * Constructs a new SelectionChange instance.
 * SelectionChange contains the indexes that were added and the indexes
 * that were removed between the previous selection to the new selection.
 */
class SelectionChange {
  /**
   * @param added The added properties set.
   * @param removed The removed properties set.
   */
  constructor(
    private readonly added: Selection,
    private readonly removed: Selection,
  ) {}

  /**
   * Returns the set of added indexes.
   * @return The set of added indexes.
   */
  getAdded(): Selection {
    return this.added;
  }

  /**
   * Returns the set of removed indexes.
   * @return The set of removed indexes.
   */
  getRemoved(): Selection {
    return this.removed;
  }
}
