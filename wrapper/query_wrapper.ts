/**
 * @fileoverview GViz Query Wrapper.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import * as errors from '../common/errors';
import {DataTable} from '../data/datatable';
import {Query} from '../query/query';
import {QueryResponse} from '../query/queryresponse';
import {AbstractVisualization} from '../visualization/abstract_visualization';

// tslint:disable:ban-types Migration

/**
 * Declarative wrapper around Query, and a Visualization.
 * Also see ChartWrapper.
 */
export class QueryWrapper {
  /**
   * A default error handler for a query response. Returns false if the
   * response is erroneous and true otherwise. In case of error displays an
   * error message using the google.visualizations.errors API.
   *
   */
  private readonly defaultErrorHandler: Function | null = null;

  /**
   * A custom response handler. This is a function that takes a response and
   * handles it before the default response handler is invoked.
   *
   */
  private customResponseHandler: Function | null = null;

  /**
   * A custom post-response handler. This is a function that the caller can
   * optionally set to be called after the visualization is drawn. This handler
   * is called with the response object from the query.
   *
   */
  private customPostResponseHandler: Function | null = null;

  /**
   * The last data table returned by the query. Used by the draw() method to
   * redraw data without sending the query.
   */
  private dataTable: DataTable | null = null;
  private options: AnyDuringMigration;

  /**
   * The error handler. This is a function that takes a response, handles
   * display of error messages, and returns true if processing should continue
   * (generally means no error) and false otherwise.
   */
  private errorHandler: Function | null = null;

  /**
   * The visualization to draw.
   */
  visualization?: AbstractVisualization;

  /**
   * Constructs a new query wrapper with the given query, visualization, and
   * error message container. If you intend to use a custom error handler, you
   * may give null as the container, since the container is used only by the
   * default error handler. The visualization should support the
   * draw(dataTable, options) method.
   * @param query The query to send
   * @param abstractVisualization The visualization to draw.
   * @param options The options for the visualization.
   * @param container The container for error messages. Give null
   *     if you intend to use a custom error handler.
   */
  constructor(
    private readonly query: Query, //
    abstractVisualization: AbstractVisualization,
    options: AnyDuringMigration | null, //
    private readonly container: Element | null,
  ) {
    /**
     * The options for the visualization.
     */
    this.options = options || {};

    this.visualization = abstractVisualization;

    if (container) {
      this.defaultErrorHandler =
        QueryWrapper.getDefaultResponseValidator(container);
      this.errorHandler = this.defaultErrorHandler;
    }
    if (
      !abstractVisualization ||
      // TODO(dlaliberte): Find a better way to check for draw method.
      // tslint:disable-next-line:ban-unsafe-reflection
      !('draw' in abstractVisualization) ||
      // tslint:disable-next-line:no-dict-access-on-struct-type
      typeof abstractVisualization['draw'] !== 'function'
    ) {
      throw new Error('Visualization must have a draw method.');
    }
  }

  /**
   * Returns a default validator for a query response. The function validates
   * the response and if erroneous displays an error using the google
   * visualization errors API.
   * Additionally, the validator will clear the container before validation so
   * that only the up to date error is displayed if any, or otherwise, old
   * errors are cleared and the visualization will be displayed as intended
   * (with no errors around). Note: An error can still show up together with a
   * visualization if for instance a refreshable query is used and after a while
   * the data source state changes (e.g., breaks, auth credentials expire).
   *
   * Note: this method is not for visualizations but for core classes (e.g.,
   * querywrapper) that deal with queries.
   *
   * @param container The container for displaying errors.
   * @return A function
   *     that validates a query response.
   */
  static getDefaultResponseValidator(container: Element): Function {
    return (response: AnyDuringMigration) => {
      // Clear all error messages.
      errors.removeAll(container);
      const isError = response.isError();
      if (isError) {
        QueryResponse.addError(container, response);
      }
      return !isError;
    };
  }

  /**
   * Sets the visualization options.
   * @param options The visualization options.
   */
  setOptions(options: AnyDuringMigration | null) {
    this.options = options || {};
  }

  /**
   * Draws the last returned data table using the visualization. If no data has
   * returned, does nothing.
   */
  draw() {
    if (this.visualization) {
      asserts.assert(this.dataTable != null);
      this.visualization.draw(this.dataTable!, this.options);
    }
  }

  /**
   * Sets a custom error handler. If customErrorHandler is null, returns to the
   * default error handler that uses the container given at construction time.
   * @param customErrorHandler A custom error handler, i.e., a
   *     function that takes a response and returns true/false according to
   *     whether or not processing should continue, and also takes care of
   *     the error message.
   */
  setCustomErrorHandler(customErrorHandler: Function) {
    const container = this.container;
    if (customErrorHandler) {
      this.errorHandler = customErrorHandler;
    } else {
      if (container) {
        this.errorHandler = this.errorHandler = this.defaultErrorHandler;
      } else {
        this.errorHandler = null;
      }
    }
  }

  /**
   * Sends the query and upon its return draws the visualization on the
   * container. If the query is set to refresh then the visualization will be
   * drawn upon each refresh.
   */
  sendAndDraw() {
    if (!this.errorHandler) {
      throw new Error(
        'If no container was supplied, ' +
          'a custom error handler must be supplied instead.',
      );
    }
    const query = this.query;

    // TODO(dlaliberte): Change this to use goog.bind
    query.send((response: QueryResponse) => {
      const customResponseHandler = this.customResponseHandler;
      if (customResponseHandler) {
        customResponseHandler(response);
      }

      this.handleResponse(response);

      const customPostResponseHandler = this.customPostResponseHandler;
      if (customPostResponseHandler) {
        customPostResponseHandler(response);
      }
    });
  }

  /**
   * Handles the query response after a send, and draws the visualization.
   * @param response The query response.
   */
  private handleResponse(response: QueryResponse) {
    // Here we know errorHandler is not null, because of check in sendAndDraw.
    const nonNullErrorHandler = this.errorHandler as Function;
    if (nonNullErrorHandler(response) && this.visualization) {
      this.dataTable = response.getDataTable();
      asserts.assert(this.dataTable != null);
      this.visualization.draw(this.dataTable!, this.options);
    }
  }

  /**
   * Sets a custom responseHandler.
   * @param handler A custom response handler. A function that takes
   *      a response and handles it before the default handler is invoked.
   */
  setCustomResponseHandler(handler: Function | null) {
    if (handler == null) {
      this.customResponseHandler = null;
      return;
    }
    if (typeof handler !== 'function') {
      throw new Error('Custom response handler must be a function.');
    }
    this.customResponseHandler = handler;
  }

  /**
   * Sets a custom post-responseHandler.
   * @param handler A custom post response handler. A function to be
   *     invoked after the visualization is drawn.
   */
  setCustomPostResponseHandler(handler: Function | null) {
    if (handler == null) {
      return;
    }

    if (typeof handler !== 'function') {
      throw new Error('Custom post response handler must be a function.');
    }
    this.customPostResponseHandler = handler;
  }

  /**
   * Aborts the sending and drawing.
   */
  abort() {
    this.query.abort();
  }
}
