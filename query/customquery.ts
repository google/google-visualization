/**
 * @fileoverview GViz Custom Query API.
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

import {AbstractQuery} from './abstractquery';
import {Query} from './query';
import {QueryResponse} from './queryresponse';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A Custom Query
 *   The flow is as follows:
 * 1) The caller instantiates this class with a request handler function.
 * 2) When send is called, the request handler is called (with a response
 *    handler function and the data source url).  The request handler has
 *    no return value.
 * 3) When the response is received(asynchronously), the response handler is
 *    invoked with the gviz response object.  This function also has no return
 *    value.
 */
export class CustomQuery implements AbstractQuery {
  // The function to handle the response.
  responseHandler?: (response: QueryResponse) => void;

  lastSignature: AnyDuringMigration;

  /**
   * Creates a new query.
   *
   * @param requestHandler The function to
   *     call to handle the data source request.
   * @param dataSourceUrl The data source url.
   */
  constructor(
    // The function to handle the data source request.
    private readonly requestHandler: (
      responseHandler: // Should be: (response: QueryResponse) => void
      // TODO: Fix callers to pass the right type.
      (obj: null | Object) => void,
      url: string,
    ) => void,
    private readonly dataSourceUrl: string,
  ) {}

  send(responseHandler: (response: QueryResponse) => void) {
    // Save the callback so that it can be called when the response arrives.

    this.responseHandler = responseHandler;
    this.sendQuery();
  }

  /**
   * Returns a modified url, with modifiers like selection, sort and filter.
   * @param url The base url without modifiers.
   * @return The modified url.
   */
  private addModifiersToUrl(url: string): string {
    const parametersToAdd: AnyDuringMigration = {};
    let additionalParameters;

    const signature = this.lastSignature;
    if (signature) {
      additionalParameters = `sig:${signature}`;
    }

    if (additionalParameters) {
      parametersToAdd['tqx'] = additionalParameters;
      url = Query.overrideUrlParameters(url, parametersToAdd);
    }

    return url;
  }

  /**
   * Calls the request handler with the data source request.  The response
   * handler will be invoked with the result.
   */
  private sendQuery() {
    const url = this.addModifiersToUrl(this.dataSourceUrl);
    this.requestHandler.call(
      this,
      (obj: null | Object) => {
        this.handleResponse(obj);
      },
      url,
    );
  }

  /**
   * Handle a query response that was returned by the data source.
   * @param responseObj The json query response object as returned by
   *     the datasource server.
   * The caller's response handler will be invoked with a QueryResponse,
   * referenced at
   * https://developers.google.com/chart/interactive/docs/reference#QueryResponse.
   */
  private handleResponse(responseObj: null | Object) {
    const queryResponse = new QueryResponse(responseObj);
    if (!queryResponse.containsReason('not_modified')) {
      // On error the last signature is cleared, on valid result it is updated,
      // and if the data was not modified, we don't get here (and leave the old
      // signature, which is correct.
      if (queryResponse.isError()) {
        this.lastSignature = null;
      } else {
        this.lastSignature = queryResponse.getDataSignature();
      }

      // Call the user's callback to handle the response.
      const responseHandler = this.responseHandler;
      if (!responseHandler) {
        throw new Error('Response handler undefined.');
      }
      responseHandler.call(responseHandler, queryResponse);
    }
  }
}
