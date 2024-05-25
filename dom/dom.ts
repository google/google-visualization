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

import {DomHelper} from '@npm//@closure/dom/dom';

// tslint:disable:ban-types Migration

/**
 * Cached DomHelper.
 */
let domHelper: DomHelper | null = null;

/**
 * Returns cached DomHelper.  Create if not yet defined.
 */
export function getDomHelper(): DomHelper {
  if (domHelper == null) {
    domHelper = new DomHelper();
  }
  return domHelper;
}

/**
 * Returns current document
 */
export function getDocument(): Document {
  const dom = getDomHelper();
  return dom.getDocument();
}

/**
 * Returns the global context, typically the current window.
 */
export function getGlobal(): {[key: string]: AnyDuringMigration} {
  const dom = getDomHelper();
  return dom.getWindow() as {[key: string]: AnyDuringMigration};
}

/**
 * Returns the current window, typically the global context.
 */
export function getWindow(): Window {
  return getGlobal() as Window;
}

/**
 * @return The location of the current page.
 */
export function getLocation(): string {
  return getDocument().location.href;
}

/**
 * Validates a given object is a dom element. Throws an exception if container
 * is not validated.
 * @param container A candidate dom object.
 * @return The container, with a stricter type.
 */
export function validateContainer(container: Element | null): Element {
  const dom = getDomHelper();
  if (!container || !dom.isNodeLike(container)) {
    throw new Error('Container is not defined');
  }
  return container;
}
