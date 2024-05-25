/**
 * @fileoverview A class for visualization error handling. Allows adding error
 * messages to be viewed by the user, and running code in a "safe" mode, where
 * any exception is displayed as message to the user.
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

import * as style from '@npm//@closure/style/style';

import * as events from '../events/events';
import * as errors from './errors';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Builds a error handler.
 * Note: the general guidelines are that if the error is blocking the
 * visualization rendering, it's an error, otherwise a warning. However each
 * visualization can set its own style and error behavior, by calling the
 * errors API directly.
 * @unrestricted
 */
export class ErrorHandler {
  private readonly errorDiv: HTMLDivElement | null = null;

  /**
   * @param visualization The visualization.
   * @param container A container in which the visualization will be drawn.
   * @param createFloatingDiv Whether to create a floating div
   *     for showing the errors in. (default=false).
   */
  constructor(
    private readonly visualization: AnyDuringMigration, //
    private readonly container: Element, //
    createFloatingDiv = false,
  ) {
    this.visualization = visualization;
    this.container = container;

    if (createFloatingDiv) {
      const computedPosition = style.getComputedPosition(container);
      if (computedPosition === '' || computedPosition === 'static') {
        style.setStyle(container, 'position', 'relative');
      }
      // TODO(dlaliberte): Consider putting errorDiv inside its own relative
      // position div rather than making the container be positioned.
      this.errorDiv = document.createElement('div');
      style.setStyle(this.errorDiv, {
        position: 'absolute',
        top: 0,
        left: 0,
        'z-index': 1,
      });
    }
  }

  /**
   * Returns the element to add a message to.
   *
   * @return See the function description.
   */
  private getTargetElement(): Element {
    if (this.errorDiv) {
      if (this.errorDiv.parentNode !== this.container) {
        // Append the error div to the container if this isn't the case.
        this.container.appendChild(this.errorDiv);
      }
      return this.errorDiv;
    } else {
      return this.container;
    }
  }

  /**
   * Adds a message of type 'error'.
   *
   * @param message The error message.
   */
  addError(message: string) {
    this.addMessage(message, 'error');
  }

  /**
   * Adds a message of type 'warning'.
   *
   * @param message The error message.
   * @param triggerEvent Whether an 'error' event should be triggered.
   *     Default value is true.
   */
  addWarning(message: string, triggerEvent = true) {
    this.addMessage(message, 'warning', triggerEvent);
  }

  /**
   * Adds a message.
   *
   * @param message The message.
   * @param type The message type.
   * @param triggerEvent Whether an 'error' event should be triggered.
   *     Default value is true.
   */
  private addMessage(message: string, type: string, triggerEvent = true) {
    // TODO(dlaliberte): Maybe add message=error and detailed_message=message.
    // TODO(dlaliberte): Maybe add truncation for long messages.
    const element = this.getTargetElement();
    const errorOptions = {'removable': true, 'type': type};
    const id = errors.addError(element, message, null, errorOptions);
    triggerEvent = triggerEvent == null ? true : triggerEvent;
    if (triggerEvent) {
      const eventOptions = {
        'id': id,
        'message': message,
        'detailedMessage': '',
        'options': errorOptions,
      };
      events.trigger(this.visualization, 'error', eventOptions);
    }
  }

  /**
   * Removes all messages.
   */
  removeAll() {
    const element = this.getTargetElement();
    errors.removeAll(element);
  }

  /**
   * Executes a function in release/debug mode as follows:
   * 1) In release mode: inside a try/catch block where exceptions trigger an
   *    error event and an error message, but avoid throwing exceptions at the
   *    user).
   * 2) In debug mode: exception are not blocked (allow the browser to report
   *    the correct location of the error).
   * @param func The code to execute.
   * @param obj The object to act as this in the function's
   *     context.
   * @return The result of executing func.
   */
  safeExecute(
    func: () => AnyDuringMigration,
    obj?: AnyDuringMigration,
  ): AnyDuringMigration {
    const caller = () => {
      if (!obj) {
        return func();
      }
      return func.call(obj);
    };
    if (goog.DEBUG) {
      return caller();
    } else {
      try {
        return caller();
      } catch (e: AnyDuringUnknownInCatchMigration) {
        this.addError(e.message);
        return undefined;
      }
    }
  }
}
