/**
 * @fileoverview GViz Parsed Query.
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

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A parsed query class.
 */

export class ParsedQuery {
  private readonly table: string | null;
  private readonly selection: Column[] | null;
  private readonly sort: AnyDuringMigration[] | null;
  private readonly filter: string | null;
  private readonly group: Column[] | null;
  private readonly pivot: Column[] | null;
  private readonly rowLimit: number;
  private readonly rowOffset: number;
  private readonly options: AnyDuringMigration | null;
  private readonly labels: AnyDuringMigration[] | null;
  private readonly format: AnyDuringMigration[] | null;

  /**
   * This class can be initialized with a JSON from the server containing
   * parsed query information, and can expose its data. The structure of the
   * JSON object is as follows:
   * {'table': tableName, 'selection': [col1, col2, ...],
   *  'sort': [{'column': col1}, {'column': col2, 'desc': true}]
   *  'filter': filterString,
   *  'group': [col1, col2, ...], 'pivot': [col1, col2, ...],
   *  'rowLimit': rowLimitInt, 'rowOffset': rowOffsetInt,
   *  'options': {'noValues': b1, 'noFormat': b2, 'packJson': b3},
   *  'labels': [{'column': col1, 'label': labelString}, ...]
   *  'format': [{'column': col1, 'format': formatString}, ...]
   * }
   * Notes:
   *  - 'desc', 'noValues, 'noFormat', 'packJson' are all optional booleans
   *    and default to false.
   *  - Every column can be given as an input to the constructor of
   *    gviz.ParsedQuery.Column.
   * @param parsedQueryObj The parsed query section of the query response
   *     object as returned by the datasource server.
   */
  constructor(parsedQueryObj: AnyDuringMigration) {
    /**
     * The table name (FROM clause).
     */
    this.table = parsedQueryObj['table'] || null;

    /**
     * The selected columns (SELECT clause).
     */
    this.selection = parsedQueryObj['selection'] || null;

    /**
     * The sort columns (ORDER BY clause). An array of objects each one
     * containing 'column' and an optional boolean 'desc'.
     */
    this.sort = parsedQueryObj['sort'] || null;

    /**
     * The filter (WHERE clause) as a string.
     */
    this.filter = parsedQueryObj['filter'] || null;

    /**
     * The grouping (GROUP BY clause), as an array of columns.
     */
    this.group = parsedQueryObj['group'] || null;

    /**
     * The pivoting (PIVOT clause), as an array of columns.
     */
    this.pivot = parsedQueryObj['pivot'] || null;

    /**
     * The row limit (LIMIT clause). -1 means no limit.
     */
    this.rowLimit = parsedQueryObj['rowLimit'] || -1;

    /**
     * The row offset (OFFSET clause), 0 means no offset.
     */
    this.rowOffset = parsedQueryObj['rowOffset'] || 0;

    /**
     * The options (OPTIONS clause). An object with three optional boolean
     * properties: 'noValues', 'noFormat' and 'packJson'.
     */
    this.options = parsedQueryObj['options'] || null;

    /**
     * The labels (LABELS clause). An array of objects, each one containing a
     * 'column' and a 'label' (string).
     */
    this.labels = parsedQueryObj['labels'] || null;

    /**
     * The format (FORMAT clause). An array of objects, each one containing a
     * 'column' and a 'format' (string).
     */
    this.format = parsedQueryObj['format'] || null;
  }

  /**
   * Returns the table name (FROM clause).
   * @return The table name.
   */
  getTable(): string | null {
    return this.table;
  }

  /**
   * Returns the selected columns (SELECT clause).
   * @return The selected columns.
   */
  getSelection(): Column[] | null {
    return this.selection;
  }

  /**
   * Returns the sort columns (ORDER BY clause). An array of objects each one
   * containing 'column' and an optional boolean 'desc'.
   * @return The sort columns.
   */
  getSort(): AnyDuringMigration[] | null {
    return this.sort;
  }

  /**
   * Returns the filter (WHERE clause) as a string.
   * @return The filter.
   */
  getFilter(): string | null {
    return this.filter;
  }

  /**
   * Returns the grouping (GROUP BY clause), as an array of columns.
   * @return The grouping.
   */
  getGroup(): Column[] | null {
    return this.group;
  }

  /**
   * Returns the pivoting (PIVOT clause), as an array of columns.
   * @return The pivoting.
   */
  getPivot(): Column[] | null {
    return this.pivot;
  }

  /**
   * Returns the row limit (LIMIT clause). -1 means no limit.
   * @return The row limit.
   */
  getRowLimit(): number {
    return this.rowLimit;
  }

  /**
   * The row offset (OFFSET clause), 0 means no offset.
   * @return The row offset.
   */
  getRowOffset(): number {
    return this.rowOffset;
  }

  /**
   * Returns the options (OPTIONS clause). An object with three optional boolean
   * properties: 'noValues', 'noFormat' and 'packJson'.
   * @return The options.
   */
  getOptions(): AnyDuringMigration | null {
    return this.options;
  }

  /**
   * Returns the labels (LABELS clause). An array of objects, each one
   * containing a 'column' and a 'label' (string).
   * @return The labels.
   */
  getLabels(): AnyDuringMigration[] | null {
    return this.labels;
  }

  /**
   * Returns the format (FORMAT clause). An array of objects, each one
   * containing a 'column' and a 'format' (string).
   * @return The format.
   */
  getFormat(): AnyDuringMigration[] | null {
    return this.format;
  }
}

/**
 * A parsed column class.
 */
export class Column {
  private readonly columnId: string;
  aggregationType: AggregationType | null;

  /**
   * Instances are initialized with a JSON describing a parsed column, that
   * was a part of the ParsedQuery.
   * The structure of the JSON object is as follows:
   * For simple columns: {'columnId': 'foo'}
   * For aggregation columns: {'columnId': 'foo', 'aggType': 'max'}
   * Calculated columns are not yet supported.
   * @param columnObj A column from the parsed query.
   */
  constructor(columnObj: AnyDuringMigration) {
    /**
     * The column id (if this is a simple column) or the aggregated column (if
     * this is an aggregation column).
     */
    this.columnId = columnObj['columnId'];

    /**
     * The aggregation type in case of an aggregation column, or null in case of
     * a simple column.
     */
    this.aggregationType = columnObj['aggType'] || null;
  }

  /**
   * Returns whether or not this is an aggregation column.
   * @return Whether or not this is an aggregation column.
   */
  isAggregationColumn(): boolean {
    return !!this.aggregationType;
  }

  /**
   * Returns the column id (in case this is a simple column) or the aggregated
   * column id (in case this is an aggregation column).
   * @return The column id.
   */
  getColumnId(): string {
    return this.columnId;
  }

  /**
   * Returns the aggregation type in case this is an aggregation column or null
   * otherwise.
   * @return The aggregation type.
   */
  getAggregationType(): AggregationType | null {
    return this.aggregationType;
  }
}

/**
 * Constants for the aggregation type.
 */
enum AggregationType {
  SUM = 'sum',
  COUNT = 'count',
  MIN = 'min',
  MAX = 'max',
  AVG = 'avg',
}
