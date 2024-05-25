/**
 * @fileoverview This file provides the ability to add logical name to rendered
 * elements and to retrieve them.
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

import * as dom from '@npm//@closure/dom/dom';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * The attribute we use to denote the logical name of the element.
 */
const LOGICAL_NAME_ATTRIBUTE = 'logicalname';

/**
 * The default logical name.
 */
export const DEFAULT_NAME = '_default_';

/**
 * Setting the logical name of an element.
 * @param element The element to add the logical name to.
 * @param name The logical name to add.
 */
export function setLogicalName(element: Element | null, name: string) {
  if (element) {
    (element as AnyDuringMigration)[LOGICAL_NAME_ATTRIBUTE] = name;
  }
}

/**
 * Getting the logical name of an element.
 * If this element doesn't have a name, we climb up his ancestors until we find
 * a logical name or we reach the end of the dom tree and then return the
 * default logical name DEFAULT_NAME.
 * @param element The element to find the logical name for.
 * @return The matching logical name.
 */
export function getLogicalName(element: Element | null): string {
  const namedElement = dom.getAncestor(
    element,
    (e) => (e as AnyDuringMigration)[LOGICAL_NAME_ATTRIBUTE] != null,
    true,
  );
  // In case we reached the end of the dom without finding a logical name then
  // namedElement would be null. In such a case we simply return
  // gviz.graphics.logicalname.DEFAULT_NAME. This is not expected to happen as
  // we set a logical name to the main canvas group, but better to be on the
  // safe side here.
  if (!namedElement) {
    return DEFAULT_NAME;
  }
  return (namedElement as AnyDuringMigration)[LOGICAL_NAME_ATTRIBUTE];
}
