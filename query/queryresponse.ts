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

import * as errors from '../common/errors';
import {DataTable} from '../data/datatable';
import {ResponseVersion} from './response_version';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A query response class.
 * This class represents the response for a query, containing the data itself,
 * and the meta data.
 */
export class QueryResponse {
  /**
   * Signature (hash value) of the result of a query execution.
   */
  private readonly signature: string | null = null;

  /**
   * The data table of the response.
   */
  private readonly dataTable: DataTable | null = null;

  private readonly responseVersion: ResponseVersion;
  private readonly executionStatus: string;

  // tslint:disable:enforce-name-casing Spelling expected externally
  static ExecutionStatus = {
    OK: 'ok',
    WARNING: 'warning',
    ERROR: 'error',
  };

  /**
   * Errors in the response.
   */
  private readonly errors: AnyDuringMigration[] = [];

  /**
   * Warnings in the response.
   */
  private readonly warnings: AnyDuringMigration[] = [];

  /**
   * @param responseObj The query response object as returned by
   *     the datasource server. Example and reference can be found at
   *     {@link http://wiki/Main/GvizResponseDescription}.
   * @see Query
   */
  constructor(private readonly responseObj: AnyDuringMigration) {
    /**
     * The raw response in JSON.
     */
    this.responseObj = responseObj;

    /**
     * Version of query execution.
     */
    this.responseVersion = QueryResponse.getVersionFromResponse(responseObj);

    /**
     * Status of query execution.
     */
    this.executionStatus = responseObj['status'];

    this.warnings = responseObj['warnings'] || [];
    this.errors = responseObj['errors'] || [];
    QueryResponse.sanitizeMessages(this.warnings);
    QueryResponse.sanitizeMessages(this.errors);

    if (this.executionStatus !== QueryResponse.ExecutionStatus.ERROR) {
      this.signature = responseObj['sig'];

      this.dataTable = new DataTable(
        responseObj['table'],
        this.responseVersion,
      );
    }
  }

  /**
   * Sanitize the detailed_message from the array.
   * @param messages The messages to sanitize their
   *     detailed_messages.
   */
  private static sanitizeMessages(messages: AnyDuringMigration[]) {
    for (let i = 0; i < messages.length; i++) {
      const detailedMessage = messages[i]['detailed_message'];
      if (detailedMessage) {
        messages[i]['detailed_message'] =
          QueryResponse.escapeDetailedMessage(detailedMessage);
      }
    }
  }

  /**
   * Checks if the string needs to be escaped, and escapes it in that case.
   * The allowed string (the strings that don't need to be escaped are
   * string without "<", and html strings with only text and <a> tags
   * with only "href" attribute, and without "javascript:".
   * @param message The string to check.
   * @return The same message, or the escaped message.
   */
  private static escapeDetailedMessage(message: string): string {
    if (!message) {
      return '';
    }

    if (
      message.match(DETAILED_MESSAGE_A_TAG_REGEXP) &&
      !message.match(BAD_JAVASCRIPT_REGEXP)
    ) {
      // No need to escape.
      return message;
    } else {
      // Need to html escape.
      return message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }
  }

  /**
   * Returns the version from the response.
   * @param responseObj The query response object as returned by
   *     the data source.
   * @return The version.
   */
  static getVersionFromResponse(
    responseObj: AnyDuringMigration,
  ): ResponseVersion {
    // Version specific code:
    // Get the version.
    // If a version is not specified, or, if it is not a valid string,
    // we treat the response as version 0.6.
    const responseVersion =
      responseObj['version'] || ResponseVersion.VERSION_0_6;
    if (Object.values(ResponseVersion).includes(responseVersion)) {
      return responseVersion;
    } else {
      return ResponseVersion.VERSION_0_6;
    }
  }

  /**
   * Returns the query response version.
   * @return The response version.
   */
  getVersion(): ResponseVersion {
    return this.responseVersion;
  }

  /**
   * Returns the execution status code from the enum codes of ExecutionStatus.
   * @return The execution
   *     status code.
   */
  getExecutionStatus(): string {
    return this.executionStatus;
  }

  /**
   * Returns true if query ended with an error.
   * @return True if query execution ended with an error.
   */
  isError(): boolean {
    return this.executionStatus === QueryResponse.ExecutionStatus.ERROR;
  }

  /**
   * Returns true if query ended with a warning message.
   * @return True if query execution returned with a warning.
   */
  hasWarning(): boolean {
    return this.executionStatus === QueryResponse.ExecutionStatus.WARNING;
  }

  /**
   * Returns true if the specified reason is contained in this response.
   * @param reason The reason to check.
   * @return True if the specified reason is contained in this response.
   */
  containsReason(reason: string): boolean {
    // Currently we support internally only one reason, but the API should
    // support multiple reasons.

    // TODO(dlaliberte): Support multiple reasons.
    for (let i = 0; i < this.errors.length; i++) {
      if (this.errors[i]['reason'] === reason) {
        return true;
      }
    }
    for (let i = 0; i < this.warnings.length; i++) {
      if (this.warnings[i]['reason'] === reason) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns the data signature, used to detect data-not-modified situations.
   * @return The data signature.
   */
  getDataSignature(): string | null {
    return this.signature;
  }

  /**
   * Returns the data table of this response. May return null if the response
   * has an error and it does not contain data.
   * @return The data table, or null if the
   *     query ended with an error.
   */
  getDataTable(): DataTable | null {
    return this.dataTable;
  }

  /**
   * Returns the property from the array of the errors or warnings.
   * @param property 'reason', 'message' or 'detailed_message'.
   *     The property to take.
   * // TODO(dlaliberte): Support multiple errors/warnings better.
   * @return The first property, or null in case that
   *     there isn't such.
   */
  private getErrorsOrWarningsProperties(property: string): string | null {
    if (
      this.isError() &&
      this.errors &&
      this.errors[0] &&
      this.errors[0][property]
    ) {
      return this.errors[0][property];
    }
    if (
      this.hasWarning() &&
      this.warnings &&
      this.warnings[0] &&
      this.warnings[0][property]
    ) {
      return this.warnings[0][property];
    }
    return null;
  }

  /**
   * Returns the query execution reasons for errors or warnings. Returns an
   * empty array if the status is OK.
   * @return The error or warning reason codes, or an empty array
   *     if the status is OK.
   */
  getReasons(): string[] {
    const reason = this.getErrorsOrWarningsProperties('reason');
    return reason != null && reason !== '' ? [reason] : [];
  }

  /**
   * Returns the query execution short error or warning message.
   * @return The error or warning short message text.
   */
  getMessage(): string {
    return this.getErrorsOrWarningsProperties('message') || '';
  }

  /**
   * Returns the query execution detailed error or warning message.
   * @return The error or warning detailed message text.
   */
  getDetailedMessage(): string {
    return this.getErrorsOrWarningsProperties('detailed_message') || '';
  }

  /**
   * Returns the raw response object in JSON.
   * @return The raw response.
   */
  getResponseObj(): AnyDuringMigration | null {
    return this.responseObj;
  }

  /**
   * Adds an error based on a queryResponse. If queryResponse status is 'error'
   * or 'warning' extracts the relevant message, sets the options and displays
   * an error block using google.visualization.errors.addError().
   * In case the response status is 'ok' returns null, nothing is displayed.
   *
   * If queryResponse or container are null throws an error.
   *
   * Note: may receive a google.visualization.QueryResponse and so externs are
   * required.
   *
   * @param container The container specified by the user.
   *     Note: A null container will result in a js error.
   * @param response The query response.
   * @return The error id (unique for the given page), null if addition
   *     failed.
   */
  static prepareError(container: Element, response: QueryResponse): {} | null {
    errors.validateContainerOrThrow(container);

    if (!response) {
      const msg = errors.INTERNAL_ERROR_MSG_PREFIX + ' response is null';
      throw new Error(msg);
    }

    if (!(response.isError() || response.hasWarning())) {
      return null;
    }

    // TODO(dlaliberte): make getReasons return ALL reasons.
    const reasons = response.getReasons();
    let showInTooltip = true;
    if (response.isError()) {
      showInTooltip = !(
        reasons.includes('user_not_authenticated') ||
        reasons.includes('invalid_query')
      );
    }
    const message = response.getMessage();
    const detailedMessage = response.getDetailedMessage();
    const options: AnyDuringMigration = {'showInTooltip': showInTooltip};
    options['type'] = response.isError() ? 'error' : 'warning';
    options['removeDuplicates'] = true;
    return {container, message, detailedMessage, options};
  }

  /**
   * @param container The container specified by the user.
   *     Note: A null container will result in a JS error.
   * @param response The query response.
   * @return The error id (unique for the given page), null if addition
   *     failed.
   */
  static addError(container: Element, response: QueryResponse): string | null {
    const ed: AnyDuringMigration = QueryResponse.prepareError(
      container,
      response,
    );
    if (ed == null) {
      return null;
    }
    return errors.addError(
      ed.container,
      ed.message,
      ed.detailedMessage,
      ed.options,
    );
  }
}

/**
 * A regex for only <a href="...">...</a>,
 * so these are the things that we allow to be unescaped in detailed_message.
 */
const DETAILED_MESSAGE_A_TAG_REGEXP = new RegExp(
  '^[^<]*' + // 0 or more non < characters.
    '(<a' + // Maybe <a> tag.
    '(( )+target=(\'_blank\')?("_blank")?)?' + // Maybe, target property.
    '( )+(href=(\'[^\']*\')?("[^"]*")?)' + // Maybe, href property.
    '>[^<]*</a>[^<]*)*$',
);
// Close the <a> tag, and can repeat.

/**
 * A regexp that matches evil a href's. This regexp is matches against only if
 * the string matches positively against
 * {@see google.visualization.QueryResponse.DETAILED_MESSAGE_A_TAG_REGEXP} and should match if
 * the string should NOT be allowed.
 */
const BAD_JAVASCRIPT_REGEXP = new RegExp('javascript((s)?( )?)*:');
