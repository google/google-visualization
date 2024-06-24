/**
 * @fileoverview GViz Authenticated Query using the AuthSubJS API.
 *
 * ##########################################################################
 * ########################### DEPRECATED ###################################
 * ##########################################################################
 *
 * This package contains code for communicating with a gviz data source
 * using OAuth or AuthSubJS. The main (client side) player is gviz.AuthQuery.
 * Note: it was built along with server side support in trix which was
 * removed for the time being.
 *
 * ---------------------------------------------------------------------------
 * BUILD file dependency should look like:
 *
 * # The auth lib holding the google.accounts API (part of 'default') .
 * js_binary(name = 'auth',
 *           srcs = ['//gdata/clients/js/accounts:authsub-lib',
 *                   'googleaccounts_exports.js'],
 *           compile = 1,
 *           externs_list = ['//javascript/externs:common',
 *                           'accounts-externs.js'],
 *            defs = COMPILER_FLAGS)
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

import {CrossDomainRpc} from '@npm//@closure/net/crossdomainrpc';
import {Uri} from '@npm//@closure/uri/uri';
import {getDomHelper, getGlobal} from '../dom/dom';

import {Query} from './query';
import {QueryResponse} from './queryresponse';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Creates a new authQuery
 */
export class AuthQuery extends Query {
  /**
   * Unique session ID, based on current time and a random factor.
   */
  sessionId = `${new Date().getTime()}-${
    Math.floor(Math.random() * 899) + 100
  }`;

  /**
   * A flag to indicate if this is the first call to the constructor.
   */
  private static isFirstInstance = true;

  /**
   * A flag to indicate if the auth lib are present. If not, no auth library
   * calls (e.g., login, checkLogin) can be performed.
   */
  private static isAuthLibAvailable = false;

  private readonly scope: string;
  private readonly hasDummyResource: boolean;

  /**
   * HTTP headers.
   */
  private readonly headers: AnyDuringMigration = {
    'X-If-No-Redirect': '1',
    'Content-Length': 0,
  };

  override responseHandler: AnyDuringMigration = this.responseHandler;

  /**
   * @param url The query url.
   * @param scope The query scope. If scope is not specified the
   *     url parameter is taken as scope.
   *
   * TODO(dlaliberte): Set the gviz timeouts so that they are aligned with the
   * xd timeouts.
   * TODO(dlaliberte): handle illegal jsonP formats (e.g., {a:'abc='12''})
   * TODO(dlaliberte): Add tests
   * TODO(dlaliberte): See how to restrict scope to specific sheets and/or
   * specific queries.
   */
  constructor(url: string, scope?: string | null) {
    // Call Query's constructor.
    super(url);

    /**
     * The data source provider scope for the given url.
     * Note: dataSourceUrl may differ from url @see query.js.
     */
    this.scope = scope || this.dataSourceUrl;

    /**
     * A flag to indicate if a dummy resource is required and present.
     * TODO(dlaliberte): remove this check if
     * CrossDomainRpc.getDummyResourceUri_ is sufficient.
     */
    this.hasDummyResource = AuthQuery.checkDummyResource();

    // Init the authentication methods handlers from google.accounts.user.
    if (AuthQuery.isFirstInstance) {
      AuthQuery.setAuthMethodsAvailable();
      AuthQuery.isFirstInstance = false;
    }
  }

  /**
   * Removes all parameters (after ? or #) from URI.
   * @param uri URI to remove parameters from.
   * @return URI with all parameters removed.
   */
  static removeUriParams(uri: string): string {
    // remove everything after question mark
    const question = uri.indexOf('?');
    if (question > 0) {
      uri = uri.substring(0, question);
    }

    // remove everything after hash mark
    const hash = uri.indexOf('#');
    if (hash > 0) {
      uri = uri.substring(0, hash);
    }

    return uri;
  }

  /**
   * Login the current user to the current scope for the current page.
   * @see google3/googledata/gaia/frontend/public/guser/user.js
   * @param scope An optional scope to login to.
   * @return An authentication token, or an empty string in case of an
   *     error.
   */
  login(scope?: string): string {
    if (!this.validateAuthLibPresent()) {
      return '';
    }
    scope = scope || this.getScope();

    // TODO(dlaliberte): The following call supports scopes with out query
    // parameters.
    // It should be possible to not remove the params (# should be removed) and
    // get a finer scope for the login.
    const user = goog.getObjectByName('google.accounts.user');
    const result = user.login(AuthQuery.removeUriParams(scope));
    return result as string;
  }

  /**
   * @see google3/googledata/gaia/frontend/public/guser/user.js
   * @param callback An optional callback method.
   * @return Returns false if user already logged out or in case of an
   *     error.
   */
  logout(callback?: Function | null): boolean {
    if (!this.validateAuthLibPresent()) {
      return false;
    }
    const user = goog.getObjectByName('google.accounts.user');
    return user.logout(callback);
  }

  /**
   * Checks the login of the current user and the from the current page to the
   * given scope.
   * @see google3/googledata/gaia/frontend/public/guser/user.js
   * @return A token, if one exists. If no token exists for the
   *     specified scope or an error occurs, this method returns an empty
   * string.
   */
  checkLogin(uri: string): string {
    if (!this.validateAuthLibPresent()) {
      return '';
    }
    const scope = uri || this.getScope();
    const user = goog.getObjectByName('google.accounts.user');
    const result = user.checkLogin(AuthQuery.removeUriParams(scope));
    return result as string;
  }

  /**
   * Checks if the auth library is present and reports an error if not. In case
   * the query's is active uses the query's responseHandler and otherWise throws
   * an error.
   * @return Whether the auth library is present.
   */
  private validateAuthLibPresent(): boolean {
    if (AuthQuery.isAuthLibAvailable) {
      return true;
    } else {
      // Error state.
      if (this.isActive) {
        // Use query error mechanism.
        this.errorHandler(NO_AUTH_LIB_ERROR_MESSAGE);
        return false;
      } else {
        throw new Error(NO_AUTH_LIB_ERROR_MESSAGE);
      }
    }
  }

  /**
   * Checks if the google.accounts.user auth methods are available and sets the
   * isAuthLibAvailable flag accordingly.
   */
  private static setAuthMethodsAvailable() {
    const user = goog.getObjectByName('google.accounts.user');
    AuthQuery.isAuthLibAvailable = !!(
      user &&
      user['login'] &&
      user['logout'] &&
      user['checkLogin']
    );
  }

  /**
   * Sends an authenticated request to the given url with the given scope token.
   * Handles all error states. When the response returns, extracts the
   * responseText and evals it (the responseText is a gviz jsonP response).
   *
   * Note: We do not call checkLogin() so that the request is always sent. In
   * case the resource can be accessed with no auth token
   * the response will hold the relevant gviz response and otherwise a
   * "user not authenticated" error, which in turn should result a login() call.
   *
   * TODO(dlaliberte): Add the code to to handle a "user not authenticated"
   * error for the special case of AuthQuery.
   * @param responseHandler The function to call when query results
   *     are returned.
   */
  override send(responseHandler: Function) {
    // Create the full url for the query
    const url = this.addModifiersToUrl(this.dataSourceUrl);
    // Register the query so that results can be matched to queries.

    Query.storePendingRequest(String(this.requestId), this);

    this.responseHandler = AuthQuery.getAuthQueryResponseHandler(
      responseHandler,
      this.getScope(),
    );

    if (!this.hasDummyResource) {
      this.errorHandler(NO_RESOURCE_MESSAGE);
      return;
    }

    const headers = this.headers;
    this.setAuthHeaders(url, headers);
    // Send the request with a single retry.
    this.sendRequest(url, this.headers, true);

    // Set a timeout for the query.
    this.startCountDown();
  }

  /**
   * DEPRECATED: This function is deprecated and will always cause an error.
   *
   * The function relies on methods defined in query.js.
   * E.g., the eval call would (usually) trigger the
   * google.visualization.Query.setResponse method.
   * @param req The request object.
   */
  resultHandler(req: AnyDuringMigration) {
    // Request should already be OK - double check here.
    this.errorHandler('gviz.AuthQuery is deprecated, calls will always fail.');
  }

  /**
   * Handles errors when using the AuthQuery object.
   * @param error The error object or an error message.
   */
  errorHandler(error: Error | string) {
    let detailedMessage = '';
    if (error instanceof Error) {
      detailedMessage = error.message ? `Message: ${error.message}` : '';
      // If available, output HTTP error code and status text
      const cause: AnyDuringMigration = (error as AnyDuringMigration).cause;
      if (cause) {
        const errorStatus = cause.status;
        const statusText = cause.statusText;
        detailedMessage +=
          ` Root cause: HTTP error ${errorStatus}` +
          ` with status text of: ${statusText}`;
      }
    } else {
      if (typeof error === 'string') {
        detailedMessage = String(error);
      }
    }
    this.setErrorResponse(
      'authsub failed',
      'authsub query failed',
      detailedMessage,
    );
  }

  /**
   * Sends a request to the url using the given transport and handles several
   * retry scenarios.
   * @param uri URI of request.
   * @param headers Headers to send in request.
   * @param retry Whether to retry the request if there's an error.
   */
  private sendRequest(
    uri: string,
    headers: AnyDuringMigration,
    retry: boolean,
  ) {
    let retryUri;
    const ff = (req: AnyDuringMigration): AnyDuringMigration => {
      if (req.status < STATUS.NOT_OK) {
        this.resultHandler(req);
      } else {
        if (retry && req.status === STATUS.PRECONDITION_FAILED) {
          // On Mac OS/X Dashboard or Safari or default installation of IE
          // (where the default cookie setting of 'Medium' 'blocks 3rd-party
          // cookies that save information that can be used to contact you
          // without your explicit consent'; see bug 828752), S cookie is
          // not set.  Simple retrying will not work.  Redirect.
          retryUri = req.getResponseHeader('X-Redirect-Location');
          this.sendRequest(retryUri, headers, false);
        } else {
          if (retry && req.status === STATUS.FOUND) {
            // A 302 response code with the accompanying 'Location' header. This
            // response can come from OpenSocial's gadgets.io.makeRequest.
            retryUri = req.getResponseHeader('Location');
            this.sendRequest(retryUri, headers, false);
          } else {
            if (retry && req.status === STATUS.INTERNAL_SERVER_ERROR) {
              // IE does not follow 302 on feed and 302 on Firefox no longer an
              // XD2 request, which causes XD2 response to time out and thus
              // this 500.  However, this first attempt gets the 'S' cookie set.
              // Retrying allows us to go to right shard from now on.
              retryUri = uri;
              this.sendRequest(retryUri, headers, false);
            } else {
              if (
                req.status === STATUS.BAD_REQUEST &&
                req.responseText === 'Invalid Feed Type'
              ) {
                this.errorHandler(req.responseText);
              } else {
                // Safari returns 'OK' for an HTTP 401 (Unauthorized) response.
                // Change it to a more descriptive error letting the user know
                // that things are, in fact, not 'OK'.  Note that since the
                // 'req' object is readonly, the best we can do here is change
                // the Error message; the statusText doesn't change.
                let message = req.statusText;
                if (
                  req.status === STATUS.UNAUTHORIZED &&
                  req.statusText === 'OK'
                ) {
                  message = 'Authorization required';
                }
                const error = new Error(message) as AnyDuringMigration;
                error.cause = req;
                if (req.responseHeaders) {
                  error.statusTextContentType =
                    req.responseHeaders['Content-Type'];
                }
                this.errorHandler(error);
              }
            }
          }
        }
      }
    };
    this.sendRequestToTransport(uri, headers, ff);
  }

  /**
   * Returns a response handler for an AuthQuery. The new response handler, in
   * case of a "user not authenticated" response, will replace the response
   * detailed message with a message that enables the user to call login().
   *
   * The new response handler will call the user provided response handler
   * before returning - in all cases.
   *
   * @param responseHandler A response handler
   *    passed by the callee to send().
   * @param scope The scope of the current authquery.
   * @return A new response handler that takes
   *     care of "user not authenticated" cases.
   */
  private static getAuthQueryResponseHandler(
    responseHandler: Function,
    scope: string,
  ): Function {
    const noAuthReason = 'user_not_authenticated';
    let loginCall = '';
    let loginMsg = '';
    // Create a login message in case user is not authenticated. The message
    // is an html <a> element that when clicked will trigger a login().
    if (AuthQuery.isAuthLibAvailable) {
      const scopeToLogin = AuthQuery.removeUriParams(scope);
      loginCall = "google.accounts.user.login('" + scopeToLogin + "');";
      loginMsg = '<a href="#" onclick="' + loginCall + '">login</a>';
    }
    return (queryResponse: QueryResponse) => {
      if (
        queryResponse.isError() &&
        queryResponse.containsReason(noAuthReason) &&
        loginCall
      ) {
        const newResponseObj = {
          'version': queryResponse.getVersion(),
          'status': queryResponse.getExecutionStatus(),
          'errors': [
            {
              'reason': noAuthReason,
              'message': queryResponse.getMessage(),
              'detailed_message': '',
            },
          ],
        };
        const newResponse = new QueryResponse(newResponseObj);
        // TODO(dlaliberte): find a nicer way to insert an illegal
        // detailed_message to QueryResponse. The problem here is that we want
        // to pass a login message to the user the container a method call. If
        // we set this message as is, the QueryResponse constructor will
        // sanitize the message as it contains "bad" javascript. With the
        // following method override we make sure that the user trying to access
        // the detailed message will receive the one with the login message and
        // the google.accounts.user.login() call.
        // tslint:disable-next-line:no-dict-access-on-struct-type
        newResponse['getDetailedMessage'] = () => {
          return loginMsg;
        };
        responseHandler(newResponse);
      } else {
        responseHandler(queryResponse);
      }
    };
  }

  /**
   * Returns the scope to authenticate against.
   * @return The scope.
   */
  private getScope(): string {
    return this.scope;
  }

  /**
   * Sets the auth header for the request.
   * @param url The query url.
   * @param headers The request headers.
   */
  private setAuthHeaders(url: string, headers: AnyDuringMigration) {
    const token = this.checkLogin(url);
    if (token) {
      headers['Authorization'] = 'AuthSub token=' + token;
    }
  }

  /**
   * Sends a request to the input url using closure.net.CrossDomainRpc.
   * after setting all the relevant headers and parameters.
   * @param uri URI of request.
   * @param headers Headers to send in request.
   * @param continuation Function to call on the response.
   */
  private sendRequestToTransport(
    uri: string,
    headers: AnyDuringMigration,
    continuation: (req: AnyDuringMigration) => AnyDuringMigration,
  ) {
    // Use a unique session key to defeat browser caching.
    // Use 'user-agent' for now before 'gssn' is implemented.
    const userAgent = AuthQuery.getUserAgent(this.sessionId);

    // Pass on query parameters on URI.
    const params = this.parseQueryParameters(uri);
    // Prepare other parameters.
    params.alt = ALT.JSON_XD;
    // Set the user agent param.
    params['user-agent'] = userAgent;

    // Set headers.
    headers['X-HTTP-Method-Override'] = 'GET';

    CrossDomainRpc.send(
      uri,
      (e: AnyDuringMigration) => {
        if (e.target.status < STATUS.NOT_OK) {
          e.target.responseText = (e.target.responseText || '').trim() || null;
        }
        // Save response text as status text if no status text.
        if (!e.target.statusText) {
          e.target.statusText = e.target.responseText;
        }
        continuation(e.target);
      },
      'POST',
      params,
      headers,
    );
  }

  /**
   * Parses URI to extract query parameters.  Does not support multiple values
   * of the same key.
   * @param uri URI to parse.
   * @return params Map to save query parameters into.
   */
  private parseQueryParameters(uri: string): AnyDuringMigration {
    const params: AnyDuringMigration = {};
    const uriObject = Uri.parse(uri);
    const queryData = uriObject.getQueryData();
    const keys = queryData.getKeys();
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const values = queryData.getValues(key);
      params[key] = values && values.length > 0 ? values[0] : null;
    }
    return params;
  }

  /**
   * Checks for existence of dummy resource required for IE in this release.
   * We check this on other browsers too to align the behavior.
   *
   * TODO(dlaliberte): remove this after crossDomainRpc is updated to work
   * without a dummy resource img (in IE).
   * @return True if suitable dummy resource is found; false otherwise.
   */
  private static checkDummyResource(): boolean {
    const dom = getDomHelper();
    const images = dom.getElementsByTagNameAndClass('img');
    const href = dom.getWindow().location.href;
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      if (Uri.haveSameDomain(image.src, href)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the user agent with the given session id.
   * Note: A user agent is created with a unique session key to defeat browser
   * caching.
   * @param sessionId A unique session key for each authQuery instance.
   * @return The user agent with the given session id.
   */
  private static getUserAgent(sessionId: string): string {
    const applicationName = 'google.visualization';
    const global = getGlobal();
    return encodeURIComponent(
      `${applicationName} GData-JavaScript/` +
        `${global['GData_API_Version'] || 'dev'} ${sessionId}`,
    );
  }
}

/**
 * Enum of http response status codes.
 * TODO(dlaliberte): Part these status codes to closure (e.g.
 * goog.net.HttpResponseCodes)
 */
enum STATUS {
  OK = 200,
  NOT_OK = 300,
  FOUND = 302,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  PRECONDITION_FAILED = 412,
  INTERNAL_SERVER_ERROR = 500,
}

/**
 * Values for parameter 'alt'.
 */
enum ALT {
  JSON_XD = 'json-xd',
}

/**
 * An error message for the case a dummy resource is missing.
 */
const NO_RESOURCE_MESSAGE =
  'An image of the same domain is ' +
  'required on this page for authenticated reads and all writes.';

/**
 * An error message for the case auth libs are missing.
 */
const NO_AUTH_LIB_ERROR_MESSAGE =
  'cannot perfrom authentication - missing auth lib.';
