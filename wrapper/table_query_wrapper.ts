/**
 * @fileoverview A Table visualization wrapper based on a data source query.
 * In particular, a request is issued to fetch the data which is then
 * visualized with the Table visualization. Additionally, the Table
 * visualization sort and pagination is done by issuing another request with
 * appropriate query parameters (e.g., for getting the data sorted by column
 * 'A' the following query is attached to the request: 'tq=order by A').
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

import * as googObject from '@npm//@closure/object/object';
import {Uri} from '@npm//@closure/uri/uri';
import {DataTable} from '../data/datatable';
import * as events from '../events/events';
import {Query} from '../query/query';
import {QueryResponse} from '../query/queryresponse';
import {Table} from '../visualization/table/table_chart';

import {QueryWrapper} from './query_wrapper';

// tslint:disable:ban-types  Migration

/**
 * Constructs a new TableQueryWrapper with the given queryUrl, container and
 * options.
 * @unrestricted
 */
export class TableQueryWrapper {
  /** The default page size. */
  private static readonly DEFAULT_PAGE_SIZE = 10;

  /** The table visualization. */
  private readonly table: Table;

  /** The map of option for the table visualization. */
  private readonly tableOptions: AnyDuringMigration;

  /** A flag to indicate if paging is enabled. */
  private readonly enablePaging: boolean;

  pageSize: AnyDuringMigration;
  currentPageIndex = 0;

  /** The table visualization QueryWrapper. */
  private queryWrapper: QueryWrapper | null = null;

  /** The query object. */
  private query: Query | null = null;

  /** The current data table the visualization is displaying. */
  private currentDataTable: DataTable | null = null;

  /** The sort query clause. E.g., 'order by A desc'. */
  private sortQueryClause = '';

  /** The page query clause. E.g., 'limit 10 offset 100'. */
  private pageQueryClause = '';

  /** The query refresh interval. By default it is zero - no refresh. */
  private refreshInterval = 0;

  /**
   * Custom sendAndDraw method. Client can optionally set this to have their
   * custom method called before the internal default sendAndDraw method is
   * called. This is particularly useful when the caller wants to do custom
   * operations during sort/pagination operations on the table since the
   * sendAndDraw method is called automatically from within and without this
   * custom method no control will be given to the caller at that time.
   */
  private customSendAndDraw: Function | null = null;

  /**
   * Custom response handler. Client can use this to set a custom handler that
   * will be called before the default handler for the response is executed. The
   * function takes in an argument that provides the response of the query.
   */
  private customResponseHandler: Function | null = null;

  /**
   * Custom post-response handler. Client can use this to set a custom
   * post-response handler that will be called before the default post-response
   * handler is invoked. The function takes in an argument that provides the
   * response of the query.
   */
  private customPostResponseHandler: Function | null = null;

  /**
   * @param dataSourceUrl The data source url.
   * @param container The container in which to draw the visualization.
   * @param errorContainer The container to display errors in.
   * @param options The options for table visualization. The wrapper
   *     clones the object and may adjust some of properties so that they
   *     work with the wrapper infrastructure. In particular
   *         sort {string} would become event/disable.
   *         page {string} would become event/disable.
   *         pageSize {Number} If number <= 0 uses default=10.
   *         showRowNumber {boolean} set to true.
   */
  constructor(
    private readonly dataSourceUrl: string,
    container: Element | null,
    private readonly errorContainer: Element,
    options: AnyDuringMigration | null,
  ) {
    this.table = new Table(container);

    // TODO(dlaliberte): Add an enum for event types
    events.addListener(this.table, 'page', (properties: AnyDuringMigration) => {
      this.handlePage(properties);
    });
    events.addListener(this.table, 'sort', (properties: AnyDuringMigration) => {
      this.handleSort(properties);
    });

    const tableOptions = options !== undefined ? googObject.clone(options) : {};

    this.tableOptions = tableOptions;

    this.enablePaging = options['page'] === 'enable';

    tableOptions['showRowNumber'] = true;
    tableOptions['pagingButtonsConfiguration'] =
      options['pagingButtonsConfiguration'] || 'both';
    tableOptions['sort'] =
      options['sort'] == null || options['sort'] === 'enable'
        ? 'event'
        : 'disable';

    if (this.enablePaging) {
      tableOptions['page'] = 'event';
      const pageSize = options['pageSize'] || 0;
      this.pageSize =
        pageSize <= 0 ? TableQueryWrapper.DEFAULT_PAGE_SIZE : pageSize;
      tableOptions['pageSize'] = this.pageSize;
      this.setNewPageRequestParameters(0);
    }

    /** The table page size. -1 if paging is disabled. */
    this.pageSize = -1;

    /** The current page in the table. -1 if paging is disabled. */
    this.currentPageIndex = -1;
  }

  /**
   * Sends the query and upon its return draws the Table visualization in the
   * container. If the query refresh interval is set then the visualization will
   * be redrawn upon each refresh.
   */
  sendAndDraw() {
    if (this.customSendAndDraw) {
      this.customSendAndDraw();
    }

    const queryClause = this.createQuery();
    // Prepare the new query.
    this.query = new Query(this.dataSourceUrl);
    this.query.setQuery(queryClause);
    // Sets the query refresh interval.
    this.setRefreshInterval(this.refreshInterval);
    // Stop the previous query if there is one.
    this.abort();
    // Reset the table selection.
    this.table.setSelection([]);
    // TODO(dlaliberte): support row selection at wrapper level for persistence of
    // selection after paging.
    this.queryWrapper = new QueryWrapper(
      this.query,
      this.table,
      this.tableOptions,
      this.errorContainer,
    );
    this.queryWrapper.setCustomResponseHandler(
      (response: AnyDuringMigration) => {
        this.responseHandler(response);
      },
    );
    this.queryWrapper.setCustomPostResponseHandler(
      this.customPostResponseHandler,
    );
    this.queryWrapper.sendAndDraw();
  }

  /**
   * Aborts sending the query if refresh queries are set using
   * `#setRefreshInterval`.
   */
  abort() {
    if (this.queryWrapper) {
      this.queryWrapper.abort();
    }
  }

  /**
   * Handles a sort event.
   * @param properties The properties object for this sort event with two
   *     properties 'column' and 'ascending'.
   */
  private handleSort(properties: AnyDuringMigration) {
    // The event attributes.
    const colInd = properties['column'];
    const isAscending = properties['ascending'];
    this.tableOptions['sortColumn'] = colInd;
    this.tableOptions['sortAscending'] = isAscending;
    const dataTable = this.currentDataTable;
    // Prepare queryUrl with appended sort string.
    // TODO(dlaliberte): this won't work on calculated columns. Wait for query
    // object implementation to transform id:sum-A --> sql:sum(A)
    const columnId = `\`${dataTable!.getColumnId(colInd)}\``;
    this.sortQueryClause = `order by ${columnId}${!isAscending ? ' desc' : ''}`;
    if (this.enablePaging) {
      // Calls sendAndDrawTable internally.
      this.handlePage({'page': 0});
    } else {
      this.sendAndDraw();
    }
  }

  /**
   * Creates the query - a clause for the sort option and a clause for the page
   * option (if there are any).
   * @return The query clause.
   */
  private createQuery(): string {
    const uri = Uri.parse(this.dataSourceUrl);
    let tq = uri.getParameterValue('tq') || '';
    tq += ' ' + this.sortQueryClause + ' ' + this.pageQueryClause;
    // TODO(dlaliberte): Add support for adding the clauses when the query is not
    // empty.
    return tq;
  }

  /**
   * Sets the query refresh interval.
   * @param interval The refresh interval.
   */
  setRefreshInterval(interval: number) {
    this.refreshInterval = Math.max(0, interval);
    if (this.query) {
      this.query.setRefreshInterval(this.refreshInterval);
    }
  }

  /**
   * Handles a page event.
   * @param properties The properties object for this page event with a single
   *     'page' property. The 'page' value is the number of the requested next
   *     page to view.
   */
  private handlePage(properties: AnyDuringMigration) {
    const localTableNewPage = properties['page'];
    const currentPage = this.currentPageIndex;
    let newPage = 0;
    //  TODO(dlaliberte): This should be made more generic when local paging is
    //  enabled.
    //  TODO(dlaliberte): enable/disable local paging buttons according to the data
    // when last/first page are hit.
    switch (localTableNewPage) {
      case 0:
        newPage = 0;
        break;
      case 1:
        newPage = currentPage + 1;
        break;
      case -1:
        newPage = currentPage - 1;
        break;
      default:
        throw new Error(`unexpected page properties "${localTableNewPage}`);
    }
    this.setNewPageRequestParameters(newPage);
    this.sendAndDraw();
  }

  /**
   * Sets the parameters for a new page request - pageQueryClause and table
   * options.
   * @param newPage The index of a new page.
   */
  private setNewPageRequestParameters(newPage: number) {
    const currentPageIndex = this.currentPageIndex;
    const pageSize = this.pageSize;
    // Return if the not in the range [0, currentPageIndex + 1].
    if (newPage < 0 || newPage > currentPageIndex + 1) {
      return;
    }
    // If the requested page is the next page check that the previous query
    // returned more rows than the page size which indicates the next page
    // is not empty. (A request for a page always tries to fetch pageSize + 1
    // rows).
    if (
      newPage === currentPageIndex + 1 &&
      this.getNumberOfRowsInDataTable() <= pageSize
    ) {
      return;
    }
    this.currentPageIndex = newPage;

    // Set the new request and table parameters.
    const newStartRow = this.currentPageIndex * pageSize;
    // Get the pageSize + 1 so that we can know when the last page is reached.
    this.pageQueryClause = `limit ${
      Number(pageSize) + 1
    } offset ${newStartRow}`;
    // Note: row numbers are 1-based yet dataTable rows are 0-based.
    this.tableOptions['firstRowNumber'] = newStartRow + 1;
  }

  /**
   * The response handler for the QueryWrapper. The handler calls the custom
   * response handler if any set by the caller and additionally stores the
   * `DataTable` locally.
   * @param response The query response.
   */
  responseHandler(response: QueryResponse) {
    if (this.customResponseHandler) {
      this.customResponseHandler(response);
    }

    this.currentDataTable = response.isError() ? null : response.getDataTable();
  }

  /**
   * Sets the custom response handler. Typically used when the caller wants to
   * do custom handling of the response before rendering the visualization on
   * the client.
   * @param handler A custom response handler. A function that takes a response
   *     and handles it before the default handler is invoked.
   */
  setCustomResponseHandler(handler: Function | null) {
    if (handler == null) {
      return;
    }

    if (typeof handler !== 'function') {
      throw new Error('Custom response handler must be a function.');
    }

    this.customResponseHandler = handler;
  }

  /**
   * Sets the custom post-response handler. Typically used when the caller wants
   * to do custom handling of the response after the visualization is rendered.
   * @param handler A custom post-response handler. A function that takes a
   *     response and handles it before the default handler is invoked.
   */
  setCustomPostResponseHandler(handler: Function | null) {
    if (handler == null) {
      return;
    }

    if (typeof handler !== 'function') {
      throw new Error('Custom post-response handler must be a function.');
    }

    this.customPostResponseHandler = handler;
  }

  /**
   * Sets the customSendAndDraw method. Typically used when the caller wants
   * to do custom handling before the default internal `sendAndDraw` is
   * executed.
   * @param customSendAndDraw A custom sendAndDraw method.
   */
  setCustomSendAndDraw(customSendAndDraw: Function | null) {
    if (customSendAndDraw == null) {
      return;
    }

    if (typeof customSendAndDraw !== 'function') {
      throw new Error('Custom sendAndDraw must be a function.');
    }

    this.customSendAndDraw = customSendAndDraw;
  }

  /**
   * Returns the number of rows in the current DataTable. If null (e.g., error)
   * returns -1.
   * @return The number of rows in the DataTable, -1 if there are any errors.
   */
  private getNumberOfRowsInDataTable(): number {
    let res = -1;
    if (this.currentDataTable) {
      res = this.currentDataTable.getNumberOfRows();
    }
    return res;
  }
}
