/**
 * @fileoverview Common functions for displaying errors for jsapi
 * packages (E.g., query helpers, gadget helper, visualizations) and for
 * external users.
 *
 * The errors/messages would be displayed above any other content in the
 * given container.
 * The given container content is not affected as the errors are appended
 * in a separate div.
 * Note: In case of a visualization the same container for the visualization
 * can be used. However, the owner of the container is responsible for
 * not hiding/blocking/removing the errors (e.g., if its content is always
 * floating to the top the errors will be hidden).
 *
 * The dom structure of an error is as follows
 *
 * container - element specified by the callee
 *   'div' - holding all errors
 *     'div' - holding a single error
 *        'span' - holding the message of the error
 *        'span' - (optional) holding the detailed message
 *        'span' - (optional) a clickable 'x' to remove the error from display.
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

import * as assertsDom from '@npm//@closure/asserts/dom';
import * as googDom from '@npm//@closure/dom/dom';
import {TagName} from '@npm//@closure/dom/tagname';
import * as log from '@npm//@closure/log/log';

import {getDocument, getDomHelper} from '../dom/dom';
import {createLogger} from './logger';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * External class name.
 */
export const EXTERNAL_CLASS_NAME = 'google-visualization-errors';

/**
 * Error element id prefix.
 */
export const ERROR_ID_PREFIX: string = EXTERNAL_CLASS_NAME + '-';

/**
 * External error message prefix.
 */
export const INTERNAL_ERROR_MSG_PREFIX: string = EXTERNAL_CLASS_NAME + ':';

/**
 * The id prefix for the div holding all errors.
 */
export const ALL_ERRORS_DIV_ID_PREFIX: string = EXTERNAL_CLASS_NAME + '-all-';

/**
 * An error message in case the container is null.
 */
export const CONTAINER_NULL_MSG: string =
  INTERNAL_ERROR_MSG_PREFIX + ' container is null';

/**
 * Css style for the span holding an error with type 'error'.
 */
export const ERROR_STYLE =
  'background-color: #c00000; color: white; padding: 2px;';

/**
 * Css style for the span holding an error with type 'warning'.
 */
export const WARNING_STYLE: string =
  'background-color: #fff4c2; color: black; ' +
  'white-space: nowrap; padding: 2px; ' +
  'border: 1px solid black;';

/**
 * Css style for the wrapper div holding an error span.
 */
export const WRAPPER_STYLE =
  'font: normal 0.8em arial,sans-serif; margin-bottom: 5px;';

/**
 * Css style for a remove span.
 */
export const REMOVE_ELEMENT_STYLE: string =
  'font-size: 1.1em; color: #00c; font-weight: bold; ' +
  'cursor: pointer; padding-left: 10px; color: black;' +
  'text-align: right; vertical-align: top;';

/**
 * A counter to generate unique error div ids for this page.
 */
let errorsCounterId = 0;

/**
 * Adds an error to the given container.
 *
 * @param container The container in which error messages would
 *     be displayed, appended to its top.
 *     Note: A null container will result in a js error.
 * @param message The error message.
 * @param detailedMessage The error detailed message.
 * @param options A set of options for displaying the error.
 * @return The error id (unique for the given page).
 *
 *   Supported options:
 *     showInTooltip {boolean} If true, shows the detailed message
 *         in the error element title, else, as appended text (default=true).
 *     type {string} (error|warning) Sets the type of the error, affects
 *         the css style of the error (default=error).
 *     style {string} A style string for the error message (default='').
 *         If specified, the given string is appended to the predefined style
 *         string based on the specified type.
 *         Example: 'background-color: #3f9; padding: 2px;'
 *     removable {boolean} Indicates if the message can be removed by a mouse
 *         click (default=false).
 *     removeDuplicates {boolean} True if to remove other errors messages in
 *         this container that are exact duplicates of this error
 *         (default=false).
 */
export function addError(
  container: Element,
  message: string,
  detailedMessage?: string | null,
  options?: AnyDuringMigration | null,
): string {
  if (!validateContainer(container)) {
    throw new Error(`${CONTAINER_NULL_MSG}. message: ${message}`);
  }

  // Inits the user params - supports many signatures
  const params = initUserParams(message, detailedMessage, options);
  const errorMessage = params['errorMessage'];
  detailedMessage = params['detailedMessage'];
  options = params['options'];

  // parse user options
  const showInTooltip =
    options['showInTooltip'] != null ? !!options['showInTooltip'] : true;
  const type = options['type'] === 'warning' ? 'warning' : 'error';
  let style = type === 'error' ? ERROR_STYLE : WARNING_STYLE;
  style += options['style'] ? options['style'] : '';
  const removable = !!options['removable'];

  // Create the error element that will be added to the all errors div.
  const dom = getDomHelper();
  const errorDiv = dom.createDom(
    TagName.SPAN,
    {'style': style},
    dom.createTextNode(errorMessage),
  );
  const elementId = `${ERROR_ID_PREFIX}${errorsCounterId++}`;
  const errorWrapperDiv = dom.createDom(
    TagName.DIV,
    {'id': elementId, 'style': WRAPPER_STYLE},
    errorDiv,
  );

  if (detailedMessage) {
    // Add detailed message
    if (showInTooltip) {
      errorDiv.title = detailedMessage;
    } else {
      const details = dom.createDom(
        TagName.SPAN,
        {},
        dom.createTextNode(detailedMessage),
      );
      dom.appendChild(
        errorWrapperDiv,
        dom.createDom(TagName.DIV, {'style': 'padding: 2px'}, details),
      );
    }
  }

  if (removable) {
    // Add remove span
    const removeSpan = dom.createDom(
      TagName.SPAN,
      {'style': REMOVE_ELEMENT_STYLE},
      dom.createTextNode('\u00D7'),
    );
    removeSpan.onclick = () => {
      handleRemove(errorWrapperDiv);
    };
    dom.appendChild(errorDiv, removeSpan);
  }
  addElement(container, errorWrapperDiv);
  if (options['removeDuplicates']) {
    removeDuplicates(container, errorWrapperDiv);
  }

  const logger = createLogger('Google Charts');
  if (type === 'warning') {
    log.warning(logger, errorMessage);
  } else {
    log.error(logger, errorMessage);
  }

  return elementId;
}

/**
 * Clears all errors.
 * @param container The container specified by the user.
 *     Note: A null container will result in a js error.
 *
 */
export function removeAll(container: Element) {
  validateContainerOrThrow(container);
  const errorsDiv = getErrorsDivFromContainer(container, false);
  if (errorsDiv) {
    (errorsDiv as unknown as ElementCSSInlineStyle).style.display = 'none';
    googDom.removeChildren(errorsDiv);
  }
}

/**
 * Removes a div holding an error. If the container for all error becomes empty
 * sets its display to none.
 * @param id The element id of a div containing an error.
 * @return True if the error was found and removed, false otherwise.
 */
export function removeError(id: string): boolean {
  const doc = getDocument();
  const element = doc.getElementById(id);
  if (element != null && validateErrorElement(element)) {
    handleRemove(assertsDom.assertIsElement(element));
    return true;
  }
  return false;
}

/**
 * Returns the container in which the error with the given id resides.
 *
 * @param errorId The error id (unique for the given page).
 * @return The container for the error identified by the given id,
 *     null if there is no error with the given id.
 */
export function getContainer(errorId: string): Element | null {
  const doc = getDocument();
  const element = doc.getElementById(errorId);
  if (
    element != null &&
    validateErrorElement(element) &&
    element.parentNode != null &&
    element.parentNode.parentNode != null
  ) {
    return element.parentNode.parentNode as Element;
  }
  return null;
}

/**
 * Wraps a callback function in a try catch so that errors are added to the
 * container as error messages instead of propagating to the caller.
 *
 * @param callback A function to wrap in a try catch.
 * @param handler A handler for error scenarios.
 *     Either a dom element to display an error message or a function to
 *     execute (takes the error object as a parameter).
 * @return A function that executes the callback function in a
 *     try catch block.  If the callback function throws an exception, the
 *     handler is used.
 */
export function createProtectedCallback(
  callback: (p1: AnyDuringMigration) => AnyDuringMigration,
  handler: Element | ((p1: AnyDuringMigration) => AnyDuringMigration),
): () => AnyDuringMigration {
  // TODO(dlaliberte): Avoid using 'function' just to use 'arguments'.
  // tslint:disable:only-arrow-functions
  const funcWithArgs = function () {
    if (goog.DEBUG) {
      callback.apply(null, arguments as unknown as [AnyDuringMigration]);
    } else {
      try {
        callback.apply(null, arguments as unknown as [AnyDuringMigration]);
      } catch (x: AnyDuringUnknownInCatchMigration) {
        if (typeof handler === 'function') {
          handler(x);
        } else {
          addError(handler, x.message);
        }
      }
    }
  };
  return funcWithArgs;
}

/**
 * Removes a div holding an error. If the div for all error becomes empty
 * sets its display to none.
 * @param element The element holding the error.
 */
export function handleRemove(element: Element) {
  const allErrorsDiv = element.parentNode;
  googDom.removeNode(element);
  if (allErrorsDiv && allErrorsDiv.childNodes.length === 0) {
    (allErrorsDiv as unknown as ElementCSSInlineStyle).style.display = 'none';
  }
}

/**
 * Validates the given element is an error element created by this class.
 * @param element A "candidate" error element.
 * @return True if this is an error element, false otherwise.
 */
export function validateErrorElement(element: Element): boolean {
  if (
    googDom.isNodeLike(element) &&
    element.id &&
    element.id.startsWith(ERROR_ID_PREFIX)
  ) {
    const allErrorsDiv = element.parentNode as Element;
    if (
      allErrorsDiv &&
      allErrorsDiv.id &&
      allErrorsDiv.id.startsWith(ALL_ERRORS_DIV_ID_PREFIX)
    ) {
      if (allErrorsDiv.parentNode) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Gets the set of user params and inits them to support as much signatures
 * and mistakes as possible.
 *
 * @param message The error message.
 * @param optDetailedMessage The error detailed message.
 * @param options A set of options for displaying the error.
 * @return An object with the params to use for the given error.
 */
export function initUserParams(
  message: string,
  optDetailedMessage?: string | null,
  options?: AnyDuringMigration | null,
): AnyDuringMigration {
  // Init user variables. Try to support all signatures.
  let errorMessage = message != null && message ? message : 'error';
  let detailedMessage = '';
  options = options || {};
  const numArgs = arguments.length;
  if (numArgs === 2) {
    if (optDetailedMessage && typeof optDetailedMessage === 'object') {
      options = optDetailedMessage;
    } else {
      detailedMessage =
        optDetailedMessage != null ? optDetailedMessage : detailedMessage;
    }
  } else {
    if (numArgs === 3) {
      detailedMessage =
        optDetailedMessage != null ? optDetailedMessage : detailedMessage;
    }
  }

  // Trim messages to remove all spaces, blanks etc.
  errorMessage = errorMessage.trim();
  detailedMessage = (detailedMessage || '').trim();
  return {
    'errorMessage': errorMessage,
    'detailedMessage': detailedMessage,
    'options': options,
  };
}

/**
 * Validates the given container is not null and is a dom node.
 * Compiler should automatically validate in most cases, so this function
 * is applicable when loading Google Charts dynamically.
 * TODO(dlaliberte): Merge with gvizDom.validateContainer.
 *
 * @param container The container specified by the user.
 * @return True if the container is valid, false otherwise.
 */
export function validateContainer(container: Element | null): boolean {
  return container != null && googDom.isNodeLike(container);
}

/**
 * Validates the container, or throws error with given message, or default.
 */
export function validateContainerOrThrow(container: Element | null, msg = '') {
  if (!validateContainer(container)) {
    throw new Error(msg || CONTAINER_NULL_MSG);
  }
}

/**
 * Gets a div for displaying all errors for the given container. Creates
 * one if there is no such div in the given container.
 * Verifies that the div is the first child of the container.
 * @param container The container specified by the user.
 * @param createNew If to create a new one if there is no such
 *     div in the specified container.
 * @return The div for displaying all errors.
 */
export function getErrorsDivFromContainer(
  container: Element,
  createNew: boolean,
): Element | null {
  const childs = container.childNodes;
  let errorsDiv = null;
  const dom = getDomHelper();
  for (let i = 0; i < childs.length; i++) {
    // Assume there is one errors div in a single container.
    const child = childs[i] as Element;
    if (child.id && child.id.startsWith(ALL_ERRORS_DIV_ID_PREFIX)) {
      errorsDiv = child;
      dom.removeNode(errorsDiv);
      break;
    }
  }
  if (!errorsDiv && createNew) {
    const id = `${ALL_ERRORS_DIV_ID_PREFIX}${errorsCounterId++}`;
    errorsDiv = dom.createDom(
      TagName.DIV,
      {'id': id, 'style': 'display: none; padding-top: 2px'},
      null,
    );
  }
  // Append as the first child of the container.
  if (errorsDiv) {
    const firstChild = container.firstChild;
    if (firstChild) {
      dom.insertSiblingBefore(errorsDiv, firstChild);
    } else {
      dom.appendChild(container, errorsDiv);
    }
  }
  return errorsDiv as Element | null;
}

/**
 * Adds an error element to the div holding all errors.
 *
 * @param container The container specified by the user.
 * @param domElement A dom element displaying an error.
 */
export function addElement(container: Element, domElement: Element) {
  const errorsDiv = assertsDom.assertIsElement(
    getErrorsDivFromContainer(container, true),
  );
  (errorsDiv as unknown as ElementCSSInlineStyle).style.display = 'block';
  googDom.appendChild(errorsDiv, domElement);
}

/**
 * Applies a handler over every error div in this container.
 *
 * @param container The container specified by the user.
 * @param handler A method to apply on each of the error
 *     divs in the container.
 */
export function forEachErrorElement(
  container: Element,
  handler: (p1: Element) => AnyDuringMigration,
) {
  const errorsDiv = getErrorsDivFromContainer(container, true);
  const errors = errorsDiv && googDom.getChildren(errorsDiv);
  for (const errorDiv of errors) {
    if (validateErrorElement(errorDiv)) {
      handler(errorDiv);
    }
  }
}

/**
 * Removes error divs from the container with the exact same structure as the
 * specified error div.
 *
 * @param container The container specified by the user.
 * @param errorDiv An error div.
 * @return The number of elements removed.
 */
export function removeDuplicates(
  container: Element,
  errorDiv: Element,
): number {
  const idRegExp = /id="?google-visualization-errors-[0-9]*"?/;
  let errorDivOuterHtml = googDom.getOuterHtml(errorDiv);
  errorDivOuterHtml = errorDivOuterHtml.replace(idRegExp, '');
  const elementsToRemove: Element[] = [];
  forEachErrorElement(container, (el) => {
    if (el !== errorDiv) {
      let elOuterHtml = googDom.getOuterHtml(el);
      elOuterHtml = elOuterHtml.replace(idRegExp, '');
      if (elOuterHtml === errorDivOuterHtml) {
        elementsToRemove.push(el);
      }
    }
  });
  for (const element of elementsToRemove) {
    handleRemove(element);
  }
  return elementsToRemove.length;
}
