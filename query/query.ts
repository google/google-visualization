/**
 * @fileoverview GViz Query API.
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

import {TagName} from '@npm//@closure/dom/tagname';
import {Event} from '@npm//@closure/events/event';
import * as xhr from '@npm//@closure/labs/net/xhr';
import {XhrIo} from '@npm//@closure/net/xhrio';
import {Uri} from '@npm//@closure/uri/uri';
import * as utils from '@npm//@closure/uri/utils';
import * as userAgent from '@npm//@closure/useragent/useragent';

import * as gvizJson from '../common/json';
import {CsvToDataTable} from '../data/csv_to_datatable';
import {DataTable} from '../data/datatable';
import {getDomHelper} from '../dom/dom';

import {AbstractQuery} from './abstractquery';
import {QueryResponse} from './queryresponse';
import {ResponseVersion} from './response_version';
import * as trixUtils from './trix_utils';

const JsonpSandbox = () => {};

// To exclude the JSONP Sandbox from the external repo, we use a constant that
// is set to true in the internal repo, and false in the external repo.
const JSONP_SANDBOX_SUPPORTED = false;

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * @define Whether to support JSONP. This must remain disabled for internal
 * usage due to security concerns.
 */
const SUPPORT_UNSAFE_JSONP = goog.define('SUPPORT_UNSAFE_JSONP', false);

/**
 * Enum of send methods available for the Query.
 */
const SEND_METHOD = {
  XHR: 'xhr',
  XHRPOST: 'xhrpost',
  SCRIPT_INJECTION: 'scriptInjection',
  MAKE_REQUEST: 'makeRequest',
  AUTO: 'auto',
};

const SEND_METHOD_VALUES = Object.values(SEND_METHOD);

/**
 * A header map, used for sending a query with XHR.
 */
const AUTH_HEADER_MAP = {
  'X-DataSource-Auth': 'a',
};

/**
 * The name of the parameter to add to trix requests to enable the require
 * gaia authentication mode.
 */
const REQUIRE_GAIA_PARAM = 'requireauth';

/**
 * A Query
 */
export class Query implements AbstractQuery {
  /**
   * Static id of the next request. Used to generate unique identifiers for
   * each request, so that a response message could be matched to the request.
   */
  private static nextId = 0;

  /**
   * Static map of all pending queries. The key is the requestId, and the value
   * is the query object.
   */
  private static readonly pendingRequests: AnyDuringMigration = {};

  /**
   * Timeout in seconds (how many seconds to wait before activating an
   * error handler with TIMEOUT error).
   */
  private timeoutSeconds = 30;

  /**
   * An array of all of the queries that were created.
   */
  private static readonly allQueries: Query[] = [];

  /**
   * User supplied callback function to call when query data arrives.
   */
  protected responseHandler: Function | null = null;

  /**
   * Timeout timer id. Used to detect timeouts in waiting for the query to
   * return.
   */
  private timeoutTimerId: number | null = null;

  /**
   * The query to pass to the server. This is in sql-like format and goes into
   * the tq parameter.
   */
  private query: string | null = null;

  /**
   * The type of the handler. Its value should be null, unless a
   * specific server decorator (like the table) sets it to be otherwise.
   */
  private handlerType: string | null = null;

  /**
   * The handler parameters. This is used by special server decorators (like the
   * table) to store their extra parameters. It is stored as a map of
   * name->value, both are strings.
   */
  private handlerParameters: AnyDuringMigration | null = null;

  /**
   * An indication if this query should be called again when all queries are
   * being refreshed.
   * The default is true, and so all queries will be refreshed.
   */
  private refreshable = true;

  /**
   * The refresh interval in seconds.
   */
  private refreshInterval = 0;

  /**
   * Whether we need to update the refresh interval on the next query.
   */
  private refreshIntervalChanged = false;

  /**
   * Automatic refresh interval id.
   */
  private refreshIntervalId: number | null = null;

  /**
   * The signature of the response of the last execution of this query.
   * It is sent to the server to let it return with "not modified" response when
   * the data has not been changed since the last execution.
   */
  private lastSignature: string | null = null;

  /**
   * Denotes whether the query is currently active, i.e., sending itself.
   */
  protected isActive = false;

  private readonly parseCsv: boolean;

  /**
   * Whether send response data is strict JSON format.
   */
  private readonly strictJSON: boolean;

  private readonly columnSpec: string[];
  private readonly hasHeader: boolean;
  private sendMethod: string;
  private readonly xhrWithCredentials: boolean;

  private makeRequestParams: AnyDuringMigration;

  private isDasherUrl = false;

  protected requestId: number;

  dataSourceUrl = '';

  /**
   * Creates a new query.
   * @param paramDataSourceUrl Url of a gviz data source.
   * @param options A map of sending options. The following
   *     parameters are supported:
   *     sendMethod {string} 'xhr' / 'xhrpost' / 'scriptInjection'
   *           / 'makeRequest' / 'auto' - The method to use for sending
   *         the request. 'auto' means that the send method is taken from
   *         the tqrt url parameter. If tqrt does not exist,
   *         the query is sent using xhr for same-domain or script injection
   *         otherwise. (default='auto').
   *     makeRequestParams {!Object} A map of parameters for makeRequest.
   *     xhrWithCredentials {boolean} Whether or not to include
   *         credentials (eg, cookies) with requests made using
   *         sendMethods xhr / xhrpost. (default=true).
   *     csvColumns {!Array<string>} List of column types. If set, interpret
   * CSV. csvHasHeader {boolean} Whether the CSV has a header row.
   */
  constructor(paramDataSourceUrl: string, options?: AnyDuringMigration) {
    options = options || {};

    /**
     * Whether to parse the query response as CSV.
     */
    this.parseCsv = options['csvColumns'] !== undefined;

    /**
     * Whether to parse the query response as strict JSON.
     * Default is true.
     * annotation
     */
    this.strictJSON =
      options['strictJSON'] != null ? !!options['strictJSON'] : true;

    /**
     * List of column types for interpreting CSV.
     *
     * See CsvToDataTable.SupportedTypes_.
     */
    this.columnSpec = options['csvColumns'];

    /**
     * Whether or not the CSV has a header row.
     */
    this.hasHeader = !!options['csvHasHeader'];

    /**
     * The send method.
     */
    this.sendMethod = options['sendMethod'] || SEND_METHOD.AUTO;

    /**
     * Whether to send credentials with XHR.
     */
    this.xhrWithCredentials = !!options['xhrWithCredentials'];

    if (!SEND_METHOD_VALUES.includes(this.sendMethod)) {
      throw new Error('Send method not supported: ' + this.sendMethod);
    }
    /**
     * The makeRequest parameters. Only relevant if sendMethod == 'makeRequest'.
     */
    this.makeRequestParams = options['makeRequestParams'] || {};

    this.setDataSourceUrl(paramDataSourceUrl);

    /**
     * The unique identifier of this query.
     */
    this.requestId = Query.nextId++;

    // Add this query to the static list of all of the queries.
    Query.allQueries.push(this);
  }

  setDataSourceUrl(paramDataSourceUrl: string) {
    if (trixUtils.isRitzUrl(paramDataSourceUrl)) {
      paramDataSourceUrl = this.normalizeRitzUrl(paramDataSourceUrl);
    } else {
      if (trixUtils.isTrixUrl(paramDataSourceUrl)) {
        paramDataSourceUrl = this.normalizeTrixUrl(paramDataSourceUrl);
      }
    }
    /**
     * A flag to identify if this is request for a dasher domain spreadsheet.
     */
    this.isDasherUrl =
      trixUtils.isTrixDasherUrl(paramDataSourceUrl) ||
      trixUtils.isRitzDasherUrl(paramDataSourceUrl);

    this.dataSourceUrl = paramDataSourceUrl;
  }

  /**
   * A static method that is called when all queries should be refreshed.
   * In such cases we send again all of the queries, except the ones that were
   * explicitly marked as not refreshable.
   */
  static refreshAllQueries() {
    for (let i = 0; i < Query.allQueries.length; i++) {
      const q = Query.allQueries[i];
      if (q.refreshable) {
        q.sendQuery();
      }
    }
  }

  /**
   * Normalize the data source url by:
   * - removing IE SSL port
   * - replacing common trix paths to '/tq'
   * - setting the scheme to https
   *
   * @param url The url to fix.
   * @return The normalized url.
   */
  private normalizeTrixUrl(url: string): string {
    const uri = new Uri(url);

    // Remove trix SSL port: 433.
    if (uri.getPort() === 433) {
      uri.setPort(null);
    }

    // Replace common trix url path mistakes.
    let path = uri.getPath();
    path = path.replace(/\/ccc$/, '/tq');
    if (/\/pub$/.test(path)) {
      path = path.replace(/\/pub$/, '/tq');
      uri.setParameterValue('pub', '1');
    }
    uri.setPath(path);

    const isLocalMachineTrix = trixUtils.isTrixLocalMachineUrl(url);
    // set the scheme explicit to https for all trix url (leave local trix
    // urls).
    uri.setScheme(isLocalMachineTrix ? 'http' : 'https');
    return uri.toString();
  }

  /**
   * Replace common trix url '/edit' path to '/gviz/tq'
   *
   * @param path The input common path
   * @return The corrected path
   */
  static replaceCommonTrixUrlPath(path: string) {
    return path.replace(/\/edit/, '/gviz/tq');
  }

  /**
   * Normalize the data source url by:
   * - removing IE SSL port
   * - replacing common ritz paths to 'gviz/tq'
   * - setting the scheme to https
   *
   * @param url The url to fix.
   * @return The normalized url.
   */
  private normalizeRitzUrl(url: string): string {
    const uri = new Uri(url);

    // Remove trix SSL port: 433.
    if (uri.getPort() === 433) {
      uri.setPort(null);
    }

    // Replace common trix url path mistakes.
    let path = uri.getPath();
    path = Query.replaceCommonTrixUrlPath(path);
    uri.setPath(path);

    const isLocalMachineRitz = trixUtils.isRitzLocalMachineUrl(url);
    // set the scheme explicit to https for all trix url (leave local trix
    // urls).
    uri.setScheme(isLocalMachineRitz ? 'http' : 'https');
    return uri.toString();
  }

  /**
   * Stores the query of a pending request.
   * @param reqId The request id.
   * @param query The query to store.
   */
  protected static storePendingRequest(reqId: string, query: Query) {
    Query.pendingRequests[reqId] = query;
  }

  /**
   * Static method to return a modified url. The parameterValues are added to
   * the url, and if they already exist they are overridden. The parameterValues
   * argument is represented by an array of objects. Each object has a 'name'
   * property and a 'value' property.
   * @param url The url to modify.
   * @param newParameters Map (name to value) of new parameters.
   * @return The modified url.
   */
  static overrideUrlParameters(
    url: string,
    newParameters: AnyDuringMigration,
  ): string {
    // Delete part after '#', including '#' itself.
    const hashSignIndex = url.indexOf('#');
    if (hashSignIndex !== -1) {
      url = url.substring(0, hashSignIndex);
    }

    const questionMarkIndex = url.indexOf('?');
    let urlPrefix = '';
    let urlParams = '';
    let originalParameters: string[] = [];
    if (questionMarkIndex === -1) {
      urlPrefix = url;
    } else {
      urlPrefix = url.substring(0, questionMarkIndex);
      urlParams = url.substring(questionMarkIndex + 1);
      originalParameters = urlParams.split('&');
    }

    let i;
    const parameterList = [];
    for (i = 0; i < originalParameters.length; i++) {
      const nameAndValuePair = originalParameters[i].split('=');
      const param: AnyDuringMigration = {};
      param.name = nameAndValuePair[0];
      param.originalParamText = originalParameters[i];
      parameterList.push(param);
    }

    // Add the new ones (or override).
    for (const name in newParameters) {
      if (!newParameters.hasOwnProperty(name)) {
        continue;
      }

      const value = newParameters[name];

      // Look for name.
      let found = false;
      for (i = 0; i < parameterList.length; i++) {
        if (parameterList[i].name === name) {
          parameterList[i].originalParamText =
            name + '=' + encodeURIComponent(value);
          found = true;
          break;
        }
      }
      if (!found) {
        const newParam: AnyDuringMigration = {};
        newParam.name = name;
        newParam.originalParamText = name + '=' + encodeURIComponent(value);
        parameterList.push(newParam);
      }
    }

    // Recreate the url.
    let newUrl = urlPrefix;
    if (parameterList.length > 0) {
      newUrl += '?';
      const paramStringsArray = [];
      for (i = 0; i < parameterList.length; i++) {
        paramStringsArray.push(parameterList[i].originalParamText);
      }
      newUrl += paramStringsArray.join('&');
    }

    return newUrl;
  }

  /**
   * Create a DataTable from the csv text.
   *
   * @param responseText The CSV text from a query.
   * @return The DataTable.
   */
  private interpretCsv(responseText: string): DataTable {
    const converter = new CsvToDataTable(
      responseText,
      this.columnSpec,
      this.hasHeader,
    );
    return converter.createDataTable();
  }

  /**
   * Static callback function for XHR calls.
   * The response could return in three supported formats.
   * 1) A json object (identified by an opening and closing bracket {})
   * 2) A csv file (if 'csvCols' is set).
   * 2) Anything else, usually a function call (default).
   *
   * @param requestId The request ID.
   * @param e The complete event returned by the XHR call.
   */
  setXhrResponse(requestId: number, e: Event) {
    const xhrIo = e.target as XhrIo;
    if (xhrIo.isSuccess()) {
      const responseText = xhrIo.getResponseText().trim();
      if (this.parseCsv) {
        // The response should be interpreted as CSV.
        const table = this.interpretCsv(responseText);
        const responseObj: AnyDuringMigration = {};
        responseObj['table'] = table.toJSON();
        responseObj['version'] =
          QueryResponse.getVersionFromResponse(responseObj);
        responseObj['reqId'] = requestId;
        Query.setResponse(responseObj);
      } else {
        if (responseText.match(/^({.*})$/)) {
          // The response is strict JSON, so we parse it with JSON.
          // But we convert "Date(...)" strings to JS Dates.
          Query.setResponse(gvizJson.deserialize(responseText));
        } else {
          // The response is in jsonp format, so we simply evaluate it.
          if (SUPPORT_UNSAFE_JSONP) {
            // Should be disabled since JSONP is not safe.
            // tslint:disable-next-line:ban-eval-calls
            // safeGlobal.globalEval(
            //   window,
            //   // FIXME:
            //   // Construct from literals instead of `${responseText}`,
            //   // see the corresponding entries in go/ts-dom-sink.
            //   safeScript`${responseText}`,
            // );
            throw new Error(
              'google.visualization.Query: JSONP is no longer supported.',
            );
          } else {
            throw new Error(
              'google.visualization.Query: JSONP is not supported.',
            );
          }
        }
      }
    } else {
      if (this.responseHandler) {
        this.setErrorResponse(
          'google.visualization.Query',
          xhrIo.getLastError(),
        );
      } else {
        throw new Error('google.visualization.Query: ' + xhrIo.getLastError());
      }
    }
  }

  /**
   * Static callback function that is called by the javascript generated by
   * the query response.
   * This is the function that is called by default by the data source's
   * response.
   * @param response The query response object as returned by
   *     the datasource server.
   */
  static setResponse(response: AnyDuringMigration) {
    // Get the request id.
    const requestId = response['reqId'];

    const query = Query.pendingRequests[requestId];
    if (query) {
      Query.pendingRequests[requestId] = null;
      query.handleResponse(response);
    } else {
      throw new Error(`Missing query for request id: ${requestId}`);
    }
  }

  /**
   * Sets an error response (clears the timeout object for this query).
   * @param reason The error reason.
   * @param errorMessage The error message.
   * @param detailedMessage The detailed error message.
   */
  protected setErrorResponse(
    reason: string,
    errorMessage: string,
    detailedMessage?: string,
  ) {
    const response = {
      'version': ResponseVersion.VERSION_0_6,
      'status': QueryResponse.ExecutionStatus.ERROR,
      // TODO(dlaliberte): i18n
      'errors': [
        {
          'reason': reason,
          'message': errorMessage,
          'detailed_message': detailedMessage,
        },
      ],
    };
    this.handleResponse(response);
  }

  /**
   * Returns a modified url, with modifiers like selection, sort and filter.
   * @param url The base url without modifiers.
   * @return The modified url.
   */
  protected addModifiersToUrl(url: string): string {
    const parametersToAdd: AnyDuringMigration = {};

    if (this.query) {
      parametersToAdd['tq'] = String(this.query);
    }

    let additionalParameters = 'reqId:' + String(this.requestId);

    //  // Version specific code:
    //  // Need to uncomment it AFTER ALL servers can handle it.
    //  // This might take a long time though,
    //  // and this is why we declare version to be optional.
    //  // Sending the request version.
    //  var additionalParameters = 'version:0.6';
    //  additionalParameters += ';reqId:' + String(this.requestId);

    const signature = this.lastSignature;
    if (signature) {
      additionalParameters += ';sig:' + signature;
    }
    if (this.handlerType) {
      // TODO(dlaliberte): this code should be deprecated and the type:table
      // move into the tqh.
      additionalParameters += ';type:' + this.handlerType;
    }
    parametersToAdd['tqx'] = additionalParameters;

    // Build the tqh parameter with the handler parameters
    if (this.handlerParameters) {
      const paramStringsArray = [];
      for (const p in this.handlerParameters) {
        if (this.handlerParameters.hasOwnProperty(p)) {
          paramStringsArray.push(`${p}:${this.handlerParameters[p]}`);
        }
      }
      parametersToAdd['tqh'] = paramStringsArray.join(';');
    }

    url = Query.overrideUrlParameters(url, parametersToAdd);

    if (this.refreshInterval) {
      // If the query has auto refresh, the appended script must be unique
      // so that the browser actually requests it from the server.
      // TODO(dlaliberte): Rewrite this entire function to use Uri
      const uri = new Uri(url);
      // TODO(dlaliberte): Remove zx completely once http://crbug.com/86695 is
      // resolved.
      if (userAgent.WEBKIT) {
        uri.makeUnique();
      }
      url = uri.toString();
    }

    return url;
  }

  /**
   * Sends the query.
   */
  private sendQuery() {
    // Create the full url for the query
    const url = this.addModifiersToUrl(this.dataSourceUrl);
    const dom = getDomHelper();

    // send method options set by the URL.
    let sendMethodOptions: AnyDuringMigration = {};

    // Register the query so that results can be matched to queries.
    Query.pendingRequests[String(this.requestId)] = this;

    let sendMethod = this.sendMethod;
    let xhrHttpMethod = 'GET';
    if (sendMethod === 'xhrpost') {
      sendMethod = 'xhr';
      xhrHttpMethod = 'POST';
    }
    if (sendMethod === 'auto') {
      // In auto mode we try to extract the send method and options
      // from the url first.
      const sendMethodAndOpts = Query.extractSendMethodAndOptsFromUrl(url);
      sendMethod = sendMethodAndOpts['sendMethod'];
      sendMethodOptions = sendMethodAndOpts['options'];
    }

    if (sendMethod === 'makeRequest') {
      if (Query.isMakeRequestDefined()) {
        this.sendMakeRequestQuery(url, this.makeRequestParams);
      } else {
        throw new Error('gadgets.io.makeRequest is not defined.');
      }
    } else {
      if (
        sendMethod === 'xhr' ||
        (sendMethod === 'auto' &&
          Query.isSameDomainUrl(dom.getWindow().location.href, url))
      ) {
        // In case of POST - move parameters to post content
        let postContent = undefined;
        let httpUrl = url;
        if (xhrHttpMethod === 'POST') {
          const a = url.split('?');
          if (a.length >= 1) {
            httpUrl = a[0];
          }
          if (a.length >= 2) {
            postContent = a[1];
          }
        }
        // Use xhr for either GET or POST.
        XhrIo.send(
          httpUrl,
          (event) => {
            this.setXhrResponse(this.requestId, event);
          },
          xhrHttpMethod,
          postContent,
          AUTH_HEADER_MAP,
          undefined,
          this.xhrWithCredentials || !!sendMethodOptions['xhrWithCredentials'],
        );
      } else {
        // The default is script-injection.
        if (this.parseCsv) {
          throw new Error(
            'CSV files on other domains are not supported. ' +
              "Please use sendMethod: 'xhr' or 'auto' and serve your .csv " +
              'file from the same domain as this page.',
          );
        }

        // For the specific case of trix dasher public requests.
        // Add a preliminary image tag request to the same url appended with
        // &requireauth=1 to redirect to gaia for credentials.
        // If gaia credentials exist without login, they would be added in
        // cookies to the browser and used in the next request. The script
        // request is issued thereafter in both cases (success and failure). Its
        // outcome is either the data, or an appropriate error message. Note:
        // the script request is not redirected and relies on cookie
        // authentication.
        // Note: the img is added only on the first time or after query failed,
        // this behavior is detected by sniffing this.lastSignature
        // TODO(dlaliberte): Once trix stops supporting script injection and
        // uses other transport mechanism (for dasher auth) remove this extra
        // img.
        const body = dom.getElementsByTagNameAndClass('body')[0];
        const isFreshQuery = this.lastSignature === null;
        if (this.isDasherUrl && isFreshQuery) {
          const img = dom.createElement(TagName.IMG);
          this.prepareAuthImg(img, url);
          dom.appendChild(body, img);
          return;
        }
        this.downloadJsonp(url);
      }
    }
    // TODO(b/186345209): Maybe only call checkRefreshInterval in refresh loop.
    this.checkRefreshInterval();
  }

  /**
   * Prepares img used to fetch c18n cookies from trix.
   * Used for testing.
   * @param img The image.
   * @param url The url.
   */
  prepareAuthImg(img: HTMLImageElement, url: string) {
    // The img is used to fetch c18n cookies from gaia and it may succeed or
    // fail. In both cases, after the img is set, issue the script request.
    // The script request may either returns the data or an error message
    // (depending if the cookies were retrieved or not).
    img.onerror = () => {
      this.downloadJsonp(url);
    };
    img.onload = () => {
      this.downloadJsonp(url);
    };
    img.style.display = 'none';
    // The url with the requireauth flag which forces redirection.
    const imgUrl = `${url}&${REQUIRE_GAIA_PARAM}=1&${new Date().getTime()}`;
    img.src = imgUrl;
  }

  /**
   * Extract the send method and options from the url.
   *
   * @param url The url.
   * @return An object containing the sendMethod and options
   *     extracted from the url.
   */
  private static extractSendMethodAndOptsFromUrl(
    url: string,
  ): AnyDuringMigration {
    // alt=gviz is the first argument that we check, and it sets the send
    // method to makeRequest.
    let userSendMethod;
    const options: AnyDuringMigration = {};
    if (/[?&]alt=gviz(&[^&]*)*$/.test(url)) {
      userSendMethod = SEND_METHOD.MAKE_REQUEST;
    } else {
      const userSendMethodAndOptsStr =
        utils.getParamValue(url, 'tqrt') || SEND_METHOD.AUTO;
      const userSendMethodAndOpts = userSendMethodAndOptsStr.split(':');
      userSendMethod = userSendMethodAndOpts[0];
      if (
        (userSendMethod === 'xhr' || userSendMethod === 'xhrpost') &&
        userSendMethodAndOpts.includes('withCredentials')
      ) {
        options['xhrWithCredentials'] = true;
      }
      if (!SEND_METHOD_VALUES.includes(userSendMethod)) {
        userSendMethod = SEND_METHOD.AUTO;
      }
    }

    return {'sendMethod': userSendMethod, 'options': options};
  }

  /**
   * Checks if gadgets.io.makeRequest is defined.
   *
   * @return True if gadgets.io.makeRequest is defined in this scope.
   */
  private static isMakeRequestDefined(): boolean {
    return !!goog.getObjectByName('gadgets.io.makeRequest');
  }

  /**
   * Checks if the url is same domain.
   *
   * @param location The url of the current document location.
   * @param url The url to check.
   * @return True if the url is same domain.
   */
  private static isSameDomainUrl(location: string, url: string): boolean {
    return utils.haveSameDomain(
      location,
      new Uri(location).resolve(new Uri(url)).toString(),
    );
  }

  /**
   * Issue a query using the gadget.io.makeRequest API.
   * @param url The data source url.
   * @param params The options to use for the makeRequest call.
   */
  private sendMakeRequestQuery(url: string, params: AnyDuringMigration) {
    const gadgetsIo = goog.getObjectByName('gadgets.io');
    if (params[gadgetsIo.RequestParameters.CONTENT_TYPE] == null) {
      params[gadgetsIo.RequestParameters.CONTENT_TYPE] =
        gadgetsIo.ContentType.TEXT;
    }
    if (params[gadgetsIo.RequestParameters.AUTHORIZATION] == null) {
      params[gadgetsIo.RequestParameters.AUTHORIZATION] =
        gadgetsIo.AuthorizationType.SIGNED;
    }
    if (params['OAUTH_ENABLE_PRIVATE_NETWORK'] == null) {
      params['OAUTH_ENABLE_PRIVATE_NETWORK'] = true;
    }

    if (params['OAUTH_ADD_EMAIL'] == null) {
      params['OAUTH_ADD_EMAIL'] = true;
    }
    gadgetsIo.makeRequest(url, () => this.handleMakeRequestResponse, params);
    this.startCountDown();
  }

  /**
   * Handle the response of a makeRequest query.
   * @param makeRequestResponse The makeRequest response.
   */
  private handleMakeRequestResponse(makeRequestResponse: AnyDuringMigration) {
    if (makeRequestResponse != null && makeRequestResponse['data']) {
      // Eval of a jsonP object (no extra parenthesis should be added).
      if (SUPPORT_UNSAFE_JSONP) {
        // Should be disabled since JSONP is not safe.
        // safeGlobal.globalEval(
        //   window,
        //   // FIXME:
        //   // Construct from literals instead of `${makeRequestResponse['data']}`,
        //   // see the corresponding entries in go/ts-dom-sink.
        //   safeScript`${makeRequestResponse['data']}`,
        // );
        throw new Error(
          'google.visualization.Query: JSONP is no longer supported.',
        );
      } else {
        throw new Error('google.visualization.Query: JSONP is not supported.');
      }
    } else {
      const reason = 'make_request_failed';
      const errorMessage = 'gadgets.io.makeRequest failed';
      let detailedMessage = '';
      if (makeRequestResponse && makeRequestResponse['errors']) {
        const errors = makeRequestResponse['errors'];
        detailedMessage = errors.join(' ');
      }
      this.setErrorResponse(reason, errorMessage, detailedMessage);
    }
  }

  /**
   * Downloads a Jsonp response, either via JsonpSandbox or xhr.
   * Adds a timeout handler for cases when the response is delayed.
   */
  private downloadJsonp(url: string) {
    this.startCountDown();

    // Always use XHR with Edge browser, since the jsonpSandbox fails.
    let useXhr = this.strictJSON || userAgent.EDGE;
    // But don't use XHR with old trix spreadsheets which redirect to new URL
    // without passing through some security-related headers, so XHR fails.
    if (url.match(/^https?:\/\/spreadsheets.google.com/)) {
      useXhr = false;
    }

    if (useXhr) {
      this.downloadJsonpViaXhr(url);
    } else {
      this.downloadJsonpViaSandbox(url);
    }
  }

  /**
   * Downloads a Jsonp response via XHR,
   * Note this is not the same as sendMethod: 'xhr' since it extracts the
   * strict JSON from a JSONP response.
   */
  private downloadJsonpViaXhr(url: string) {
    xhr.get(url).then(
      // resolve:
      (responseText) => {
        const extractJSON = (str: string, prefix: string, suffix: string) => {
          const prefixRE = new RegExp(`^${prefix}`, 'g');
          const suffixRE = new RegExp(`${suffix}$`, 'g');
          str = str.replace(prefixRE, '');
          str = str.replace(suffixRE, '');
          return str;
        };

        try {
          const jsonStr = extractJSON(
            responseText,
            '[\\s\\S]*google\\.visualization\\.Query\\.setResponse\\(',
            '\\);?[\\s]*',
          );

          Query.setResponse(gvizJson.deserialize(jsonStr));
        } catch (error: unknown) {
          throw new Error(
            `Error handling Query strict JSON response: ${error}`,
          );
        }
      },
      // reject:
      (error) => {
        throw new Error(`Error handling Query: ${error}`);
      },
    );
  }

  /**
   * Downloads a Jsonp response via JsonpSandbox.
   */
  private downloadJsonpViaSandbox(url: string) {
    if (!JSONP_SANDBOX_SUPPORTED) {
      throw new Error('JSONP Sandbox is not supported');
    }
    const jsonp = new JsonpSandbox(url, /* timeout= */ 0);
    // This query mechanism doesn't support setting the 'tqx=responseHandler:'
    // parameter to specify the callback name, so the default is always used.
    // More info:
    // https://developers.google.com/chart/interactive/docs/dev/implementing_data_source#request-format
    jsonp.setCallbackName('google.visualization.Query.setResponse', '');
    jsonp.fetch().then(Query.setResponse);
  }

  /**
   * Returns the head of the document, creating one if need be.
   * @return The head of the document.
   */
  static getHead(): Element {
    // Add a new head if doesn't exist.
    const dom = getDomHelper();
    if (dom.getElementsByTagNameAndClass('head').length === 0) {
      const htmlElement = dom.getElementsByTagNameAndClass('html')[0];
      const bodyElement = dom.getElementsByTagNameAndClass('body')[0];
      const headElement = dom.createElement('head');
      htmlElement.insertBefore(headElement, bodyElement);
    }
    return dom.getElementsByTagNameAndClass('head')[0];
  }

  /**
   * Clears the timeout timer, if any.
   */
  private clearTimeoutTimer() {
    if (this.timeoutTimerId) {
      clearTimeout(this.timeoutTimerId);
      this.timeoutTimerId = null;
    }
  }

  /**
   * Calls the response handler with a timeout error.
   */
  private timeoutReached() {
    const reason = 'timeout';
    const errorMessage = 'Request timed out';
    this.setErrorResponse(reason, errorMessage);
  }

  /**
   * Starts the count down, so if after the time specified in the timeout value
   * there is still no response, we throw timeout error.
   * Sets a timeout handler to be called in case the query response is delayed.
   */
  protected startCountDown() {
    // For closures.
    this.clearTimeoutTimer();
    this.timeoutTimerId = setTimeout(() => {
      this.timeoutReached();
    }, this.timeoutSeconds * 1000);
  }

  /**
   * Set the refresh interval. If set to zero, time based refresh will not
   * occur.
   * @param intervalSeconds The automatic refresh interval in seconds.
   */
  setRefreshInterval(intervalSeconds: number) {
    // TODO(b/186345209): Investigate whether we should call stopRefreshInterval
    // this.stopRefreshInterval();

    // Check that intervalSeconds is a non-negative number
    if (typeof intervalSeconds !== 'number' || intervalSeconds < 0) {
      throw new Error('Refresh interval must be a non-negative number');
    }
    this.refreshInterval = intervalSeconds;
    this.refreshIntervalChanged = true;
  }

  /**
   * Stops the refresh interval, if any.
   */
  private stopRefreshInterval() {
    // TODO(b/186345209): Investigate reset of refreshIntervalChanged here.
    // this.refreshIntervalChanged = false;

    if (this.refreshIntervalId) {
      clearTimeout(this.refreshIntervalId);
      this.refreshIntervalId = null;
    }
  }

  /**
   * If refreshInterval has changed, then reset.
   */
  private checkRefreshInterval() {
    if (this.refreshIntervalChanged) {
      this.resetRefreshInterval();
    }
  }

  /**
   * Resets the data refresh interval.
   * i.e., stops it and if necessary, starts it again.
   */
  private resetRefreshInterval() {
    this.stopRefreshInterval();
    // TODO(b/186345209): Should this condition be moved inside refresh loop
    if (this.refreshInterval !== 0 && this.refreshable && this.isActive) {
      const setupNextRefresh = () => {
        this.refreshIntervalId = setTimeout(
          refreshQuery,
          this.refreshInterval * 1000,
        );
      };
      const refreshQuery = () => {
        this.sendQuery();
        setupNextRefresh();
      };
      setupNextRefresh();

      this.refreshIntervalChanged = false;
    }
  }

  send(responseHandler: (response: QueryResponse) => void) {
    this.isActive = true;
    this.responseHandler = responseHandler;
    this.sendQuery();
  }

  /**
   * Issues a query using the gadget.io.makeRequest API.
   * @param responseHandler The callback function to be called when
   *     the response is received.
   * @param params The options to use for the makeRequest call.
   * @deprecated (since March 26, 2009).
   */
  makeRequest(responseHandler: Function, params?: AnyDuringMigration) {
    this.isActive = true;
    // Save the callback so that it can be called when the response arrives.
    this.responseHandler = responseHandler;
    this.sendMethod = 'makeRequest';
    this.makeRequestParams = params || {};
    this.sendQuery();
  }

  /**
   * Stops sending the query.
   */
  abort() {
    this.isActive = false;
    this.clearTimeoutTimer();
    this.stopRefreshInterval();
  }

  /**
   * Cancel any pending or refreshing requests and clean up any resources
   * being used by the Query, in preparation for a new query, or to dispose.
   */
  clear() {
    this.abort();
  }

  /**
   * Handle a query response that was returned by the data source.
   * @param responseObj The query response object as returned by
   *     the datasource server. Example and reference can be found at
   *     http://wiki/Main/GvizResponseDescription.
   */
  private handleResponse(responseObj: AnyDuringMigration) {
    this.clearTimeoutTimer();

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
      if (responseHandler) {
        responseHandler.call(responseHandler, queryResponse);
      }
    }
  }

  /**
   * Sets timeout in seconds, meaning, how many seconds to wait before
   * activating an error handler with TIMEOUT error.
   * Note that this function does *not* activate the timer, but only sets the
   * value.
   * @param timeoutSeconds How many seconds to wait before
   *     activating an error handler with TIMEOUT error.
   */
  setTimeout(timeoutSeconds: number) {
    if (
      typeof timeoutSeconds !== 'number' ||
      isNaN(timeoutSeconds) ||
      timeoutSeconds <= 0
    ) {
      throw new Error('Timeout must be a positive number');
    }
    this.timeoutSeconds = timeoutSeconds;
  }

  /**
   * Sets the query to be (or not to be) re-executed.
   * In events that all queries are refreshed, should this query be re-executed.
   * @param refreshable Should the query be re-executed when all
   *     queries are refreshed.
   * @return The refreshable flag passed as a parameter.
   */
  setRefreshable(refreshable: boolean): boolean {
    if (typeof refreshable !== 'boolean') {
      throw new Error('Refreshable must be a boolean');
    }
    return (this.refreshable = refreshable);
  }

  /**
   * Sets the query. The query is given in sql-like format.
   * @param queryString The query string.
   */
  setQuery(queryString: string) {
    if (typeof queryString !== 'string') {
      throw new Error('queryString must be a string');
    }
    this.query = queryString;
  }

  /**
   * Sets the handler type. You can use null to specify the default handler
   * type. This is used internally only for server specific decorators
   * (handlers), and is not documented for third parties.
   * @param handlerType The handler type or null for the default handler
   *     type.
   */
  setHandlerType(handlerType: string | null) {
    this.handlerType = handlerType;
    if (handlerType != null) {
      this.setHandlerParameter('type', handlerType);
    }
  }

  /**
   * Sets the value of a specific handler parameter. This should be used only if
   * the handlerType is not the default. If called multiple times with the same
   * name, the subsequent values override the previous ones. This is used
   * internally only for server specific decorators (handlers), and is not
   * documented for third parties.
   * Note on escaping : The name and value are escaped for colon and semicolon
   * as follows (it is crucial for correctness that the first step occurs first
   * !)
   * 1) \ --> \\
   * 2) : --> \c
   * 3) ; --> \s
   * @param name The parameter name.
   * @param value The parameter value.
   */
  setHandlerParameter(name: string, value: string) {
    // replacing any occurrence of backslash with a double backslash. This
    // allows for correct escaping of colon and semicolon using the backslash
    // character.
    name = name.replace(/\\/g, '\\\\');
    value = value.replace(/\\/g, '\\\\');
    // escape ':' character.
    name = name.replace(/:/g, '\\c');
    value = value.replace(/:/g, '\\c');
    // escape ';' character.
    name = name.replace(/;/g, '\\s');
    value = value.replace(/;/g, '\\s');
    if (!this.handlerParameters) {
      this.handlerParameters = {};
    }
    this.handlerParameters[name] = value;
  }
}
