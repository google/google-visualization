/**
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

import {Console} from '@npm//@closure/debug/console';
import {DivConsole} from '@npm//@closure/debug/divconsole';
import * as log from '@npm//@closure/log/log';

import {getDomHelper} from '../dom/dom';

// TODO(b/174915969): Merge with charteditor/logger, and visualization/corechart

/**
 * Holds a cache of currently existing divs used for log console.
 */
const LOGGER_DIV_CONSOLES: {[key: string]: DivConsole} = {};

/**
 * The default ID of the div that contains the log output.
 */
const DEFAULT_LOG_DIV_ID = 'gviz-log-div';

/**
 * Initialize the logging framework. Note that there's only a single logging
 * stream in the system, and so the div (if given) is connected to all loggers,
 * not only to the logger of the given className (that is returned by this
 * function).
 * @param className The class name to initialize the logger with.
 * @param divName The HTML div name that to output log messages
 *     to. If unspecified, use VisCommon.DEFAULT_LOG_DIV_ID.
 * @param level The initial log level.
 * @return The logger for this class.
 */
export function createLogger(
  className: string,
  divName?: string,
  level?: log.Level,
): log.Logger | null {
  const logger = log.getLogger(className, level || log.Logger.Level.ALL);
  if (goog.DEBUG && logger) {
    // Attach firebug console to the logger.
    Console.instance = Console.instance || new Console();
    Console.instance.setCapturing(true);
    // Attache the log_console div so that it shows log messages provided by
    // the chart.
    divName = divName != null ? divName : DEFAULT_LOG_DIV_ID;
    const dom = getDomHelper();
    const div = dom.getElement(divName);
    if (div && !LOGGER_DIV_CONSOLES[divName]) {
      const console = new DivConsole(div);
      console.setCapturing(true);
      LOGGER_DIV_CONSOLES[divName] = console;
    }
  }
  return logger;
}
