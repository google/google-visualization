/**
 * @fileoverview A Table visualization page manager. This class provides the
 * information required in order to visualize the table in pages.
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

import {Range} from '@npm//@closure/math/range';

import {Options} from '../../common/options';
import {DataView} from '../../data/dataview';

import {TableRow} from './table_row';

/** Information about sorting of rows. */
export interface SortInfo {
  column: number;
  ascending: boolean;
  sortedIndexes: number[] | null;
}

/**
 * Constructs a PageManager.
 * @see google.visualization.
 * @unrestricted
 */
export class PageManager {
  private static readonly DEFAULT_PAGE_SIZE: number = 10;

  /**
   * The current page index. By default the first page is zero.
   */
  private currentPageIndex = 0;

  /**
   * A map from UI rows to DataTable rows based on the specific sorting (column
   * and order). The map is null when there is no sorting.
   */
  private sortedIndexes: number[] | null = null;

  /**
   * The index of the sort column. When no sort column is specified the value
   * is set to -1.
   */
  private sortColumnIndex: number = -1;

  /**
   * A flag to indicate if the sort is descending. Default is false.
   */
  private isSortDescending = false;

  /**
   * A map of all the rows in the current page by their data row index.
   * Namely, if the page holds data row indexes {20,24,18,19} then the map would
   * be {20:0, 24:1, 18:2, 19:3}.
   */
  private pageRowIndexByDataRowIndex: {[key: number]: number} | null = null;

  /**
   * Whether paging is enabled.
   * Paging is true if paging is not disabled
   * or pagingButtons or pageSize are specified.
   */
  private readonly pagingEnabled: boolean;

  /**
   * The configuration for the paging buttons.
   *       both - enable prev and next buttons
   *       prev - only prev button is enabled
   *       next - only next button is enabled
   *       auto - the buttons are enable according to the current page, on the
   *           first page only next, on the last page only prev and otherwise
   *           both are enabled.  (default=auto)
   *       number - the number of paging buttons to show.  Implies auto for the
   *           next and prev buttons.  This explicit number will override
   *           computed number from pageSize.
   */
  private readonly pagingButtons: string | number;

  /**
   * The size of pages to display. Default is all the rows in this.dataView .
   */
  private readonly pageSize: number;

  /** The actual number of pages in the data table. */
  private readonly numberOfPages: number;

  /**
   * The display number for the first row in the dataView. Set to 1 by
   * default.
   */
  private readonly firstRowDisplayNumber: number;

  /** A flag to indicate if the data should be sorted. Default is true. */
  private readonly enableLocalSort: boolean;

  /**
   * User specified number of page number buttons.
   * This number may be different from the actual number of pages.
   */
  private readonly numberOfPagingButtons: number | null = null;

  /**
   * @param dataView The data view which wraps the data table,
   *     for the purpose of managing sorting, for now.
   * @param options  The options used here are:
   *     pagingButtons {string|number} next/prev/both/[auto]
   *       (pagingButtonsConfiguration)
   *     page {string} enable/event/[disable]
   *     firstRowNumber {number}
   *     pageSize {number}
   * @param sort 'enable' if not defined
   */
  constructor(
    private readonly dataView: DataView,
    options: Options,
    sort: string,
  ) {
    const dataViewNumberOfRows = dataView.getNumberOfRows();

    // Start with non-deprecated option check:
    let pagingButtons: string | number | null =
      options.inferValue('pagingButtons');
    if (this.numberOfPagingButtons === null) {
      // Backward compatibility for old name.
      pagingButtons = options.inferValue('pagingButtonsConfiguration');
    }

    let numButtons: number | null = null;
    if (pagingButtons !== null) {
      numButtons = Number(pagingButtons) || 0;
    }

    /**
     * Number of rows per page may be user-specified or
     * computed from number of pages.
     */
    let pageSize: number | null = options.inferOptionalNumberValue('pageSize');
    if (pageSize === 0) {
      // Treat it like null for now.
      pageSize = null;
    }

    const paging = options.inferStringValue('page', 'disable');
    this.pagingEnabled =
      paging !== 'disable' || pagingButtons != null || pageSize != null;
    this.pagingButtons = pagingButtons || 'auto';
    this.numberOfPagingButtons = numButtons;

    // Page size may be user-specified or computed from number of paging
    // buttons.
    if (this.pagingEnabled) {
      // If no pageSize and no (or 0) pagingButtons, use default pageSize.
      if (pageSize == null && (numButtons == null || numButtons === 0)) {
        pageSize = PageManager.DEFAULT_PAGE_SIZE;
      }
      // Maybe compute numberOfPagingButtons from pageSize.
      if (
        typeof pageSize === 'number' &&
        (numButtons == null || numButtons === 0)
      ) {
        numButtons = Math.ceil(dataViewNumberOfRows / pageSize);
      }
      // Maybe compute pageSize from numberOfPagingButtons.
      if (pageSize == null && typeof numButtons === 'number') {
        pageSize = Math.ceil(dataViewNumberOfRows / numButtons);
      }
    }

    this.pageSize = pageSize || dataViewNumberOfRows;
    this.numberOfPages = Math.ceil(dataViewNumberOfRows / this.pageSize);
    this.firstRowDisplayNumber = options.inferNumberValue('firstRowNumber', 1);
    this.enableLocalSort = sort === 'enable';
  }

  /**
   * Returns whether paging is enabled.
   */
  getPagingEnabled(): boolean {
    return this.pagingEnabled;
  }

  /**
   * Sets the current page index, constrained to be between 0 and last page.
   *
   * @param pageIndex The page index to set.
   */
  setPageIndex(pageIndex: number) {
    this.currentPageIndex = Math.max(
      0,
      Math.min(this.numberOfPages - 1, pageIndex),
    );
  }

  /**
   * Returns the first page index.
   * @return The current page index.
   */
  getCurrentPageIndex(): number {
    return this.currentPageIndex;
  }

  /**
   * Returns the array of rows in the current page by calculating all the
   * relevant indexes. Moreover, creates the mapping of pageRowIndex to
   * dataRowIndex for each row in the page.
   * @return An array of all the rows in the page.
   */
  calculateTableRowsInCurrentPage(): TableRow[] {
    const range = this.calculatePageRangeInUIRowIndexes();
    const page = [];
    const pageIndexToDataIndex: {[key: number]: number} = {};
    for (let ind = range.start; ind <= range.end; ind++) {
      const tableRow = this.getTableRowByUIRowIndex(ind);
      pageIndexToDataIndex[tableRow.getDataRowIndex()] =
        tableRow.getPageRowIndex();
      page.push(tableRow);
    }
    this.pageRowIndexByDataRowIndex = pageIndexToDataIndex;
    return page;
  }

  /**
   * Returns an array of rows in the specified range. The range includes the
   * first and last rows.
   *
   * @param uiStartRowIndex The index of first ui row.
   * @param uiEndRowIndex The index of last ui row.
   * @return An array of rows in the specified
   *     range.
   */
  getTableRowsInRangeByUIRows(
    uiStartRowIndex: number,
    uiEndRowIndex: number,
  ): TableRow[] {
    const rows = [];
    for (let ind = uiStartRowIndex; ind <= uiEndRowIndex; ind++) {
      const tableRow = this.getTableRowByUIRowIndex(ind);
      rows.push(tableRow);
    }
    return rows;
  }

  /**
   * Sets the sort column index and order (asc/desc).
   * @param sortColumnIndex The index of the sort column.
   * @param isDescending The order of the sort.
   */
  setSort(sortColumnIndex: number, isDescending: boolean) {
    this.sortColumnIndex = sortColumnIndex;
    this.isSortDescending = isDescending;
    this.calculateSortedIndexes();
  }

  /**
   * Returns a sortInfo object with all the sort information.
   * @return A sort information object.
   */
  getSortInfo(): SortInfo {
    const info = {
      'column': this.getSortColumnIndex(),
      'ascending': this.getSortOrder(),
      'sortedIndexes': this.getSortedIndexes(),
    };
    return info;
  }

  /**
   * Returns the map of ui rows to dataTable rows for the current sort column
   * and sort order (@see this.sortedIndexes).
   *
   * @return The map of ui rows to dataTable rows for the
   *     current sort column and sort order (@see this.sortedIndexes). Null
   *     if there is no sorting.
   */
  getSortedIndexes(): number[] | null {
    return this.sortedIndexes;
  }

  /**
   * Returns the sort column.
   * @return The index of the sort column.
   */
  getSortColumnIndex(): number {
    return this.sortColumnIndex;
  }

  /**
   * Returns the order of the sort. True for ascending, false for descending.
   * @return True for descending, false for ascending.
   */
  getSortOrder(): boolean {
    return !this.isSortDescending;
  }

  /**
   * Returns the first table row in the current page.
   * @return The first table row in the current page.
   */
  getFirstTableRowInPage(): TableRow {
    return this.getTableRowByUIRowIndex(
      this.calculatePageRangeInUIRowIndexes().start,
    );
  }

  /**
   * Returns a page row index for a given data row index. If the specified
   * row is not in the page, returns -1.
   * @param dataRowIndex A data row index.
   * @return a page row index for a given data row index. If the
   *     specified row is not in the page, returns -1.
   */
  getPageRowIndexByDataRowIndex(dataRowIndex: number): number {
    // If get current page wasn't queried call it to initialize the mapping.
    if (!this.pageRowIndexByDataRowIndex) {
      this.calculateTableRowsInCurrentPage();
    }
    const pageIndex = this.pageRowIndexByDataRowIndex![dataRowIndex];
    if (pageIndex != null) {
      return pageIndex;
    } else {
      return -1;
    }
  }

  /**
   * Calculates the first and last UI row in the page.
   * @return The range of the UI rows in the current page.
   */
  private calculatePageRangeInUIRowIndexes(): Range {
    const first = this.pageSize * this.currentPageIndex;
    let last = first + this.pageSize - 1;
    last = Math.min(this.dataView.getNumberOfRows() - 1, last);
    return new Range(first, last);
  }

  /**
   * Returns a TableRow for the specified ui Row index.
   * @see TableRow
   * @param uiRowIndex The index of the row in the UI.
   * @return An object identifying a table visualization row.
   */
  private getTableRowByUIRowIndex(uiRowIndex: number): TableRow {
    const sortedIndexes = this.sortedIndexes;
    const firstRowDisplayNumber = this.firstRowDisplayNumber;
    const firstUIRowIndex = this.calculatePageRangeInUIRowIndexes().start;
    const rowDisplayNumber = uiRowIndex + firstRowDisplayNumber;
    const pageRowIndex = uiRowIndex - firstUIRowIndex;
    const dataRowIndex = sortedIndexes ? sortedIndexes[uiRowIndex] : uiRowIndex;
    return new TableRow(
      dataRowIndex,
      uiRowIndex,
      pageRowIndex,
      rowDisplayNumber,
    );
  }

  /**
   * Calculates the mapping of the UI row indexes to their original DataTable
   * location, or null, if there is no sorting.
   */
  private calculateSortedIndexes() {
    if (this.enableLocalSort && this.sortColumnIndex !== -1) {
      const sortedIndexes = this.dataView.getSortedRows([
        {'column': this.sortColumnIndex, 'desc': this.isSortDescending},
      ]);

      // Map the current rowIndices based on the sortedIndexes.
      const viewRows = this.dataView.getViewRows();
      const sortedViewRows = sortedIndexes.map((i) => {
        return viewRows[i];
      });
      // Make this sorted row order persistent in the DataView.
      this.dataView.setRows(sortedViewRows);

      // Compute inverse of sortedIndexes to get back to original DataTable
      if (!this.sortedIndexes) {
        this.sortedIndexes = sortedIndexes;
      } else {
        this.sortedIndexes = sortedIndexes.map((i) => {
          return this.sortedIndexes![i];
        });
      }
    } else {
      // No sorting yet.
      this.sortedIndexes = null;
    }
  }

  /**
   * Returns the number of pages.
   * @return The number of pages.
   */
  getNumberOfPages(): number {
    return this.numberOfPages;
  }

  /**
   * Returns the number of paging buttons.
   */
  getNumberOfPagingButtons(): number | null {
    return this.numberOfPagingButtons;
  }

  /**
   * If the next paging button should be enabled.
   */
  isNextButtonEnabled(): boolean {
    switch (this.pagingButtons) {
      case 'prev':
        // The next button is always disabled.
        return false;
      case 'next':
      case 'both':
        // The next button is always enabled.
        return true;
      default:
        // "auto"
        // The next button is enabled if we are not on the last page.
        const currentPage = this.getCurrentPageIndex();
        const onLastPage = currentPage === this.getNumberOfPages() - 1;
        return !onLastPage;
    }
  }

  /**
   * If the prev paging button should be enabled.
   */
  isPrevButtonEnabled(): boolean {
    switch (this.pagingButtons) {
      case 'next':
        // The prev button is always disabled.
        return false;
      case 'prev':
      case 'both':
        // The prev button is always enabled.
        return true;
      default:
        // "auto"
        // The prev button is enabled if we are not on the first page.
        const currentPage = this.getCurrentPageIndex();
        const onFirstPage = currentPage === 0;
        return !onFirstPage;
    }
  }
}
