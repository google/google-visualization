/**
 * @fileoverview A class for handling execution of asynchronous callbacks. See
 * the class description.
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

import {ErrorHandler} from './error_handler';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * A function that is wrapped by AsyncHelper.wrapCallback.
 */
export type CallbackWrapper<TArgs extends unknown[], TResult> = ( //
  ...args: TArgs
) => TResult;

/**
 * Simpler to use, no type args required.
 */
export type AnyCallbackWrapper = CallbackWrapper<
  AnyDuringMigration[],
  CallbackWrapper<unknown[], void>
>;

/**
 * Handles execution of asynchronous callbacks. Provides mechanism to execute
 * them safely and cancel them when no longer relevant. Allows error messages
 * to be displayed in the same manner as what happens in synchronous code.
 */
export class AsyncHelper {
  private readonly errorHandler: ErrorHandler | null;

  private isCanceled = false;

  /**
   * @param errorHandler The error handler to use for executing the callback.
   */
  constructor(errorHandler: ErrorHandler | undefined) {
    this.errorHandler = errorHandler || null;
  }

  /**
   * Wraps the given callback with code that aborts if canceled, and executes
   * the original callback safely if not canceled. Safe execution means no
   * errors are thrown at the user, but are handled by the error handler, which
   * results in 'error' events.
   *
   * @param callback The code to execute.
   * @param obj The object to act as this in the function's context.
   * @return The wrapped callback.
   */
  wrapCallback<TArgs extends unknown[], TResult>(
    callback: CallbackWrapper<TArgs, TResult | undefined>, //
    obj: AnyDuringMigration | undefined,
  ): //
  CallbackWrapper<TArgs, TResult | undefined> {
    const wrappedFunc = (...args: TArgs): TResult | undefined => {
      if (this.isCanceled) {
        return;
      }
      if (this.errorHandler) {
        return this.errorHandler.safeExecute(() => {
          return callback.apply(obj, args);
        });
      } else {
        return callback.apply(obj, args);
      }
    };
    return wrappedFunc;
  }

  /**
   * Cancels all async callbacks that have not yet started to execute.
   */
  cancelPendingCallbacks() {
    this.isCanceled = true;
  }
}
