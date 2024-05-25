/**
 * @fileoverview Utilities for the Google Charts google.charts.loader.Utils.
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

import * as asserts from '@npm//@closure/asserts/asserts';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * The default base url for the google APIs, without the schema.
 */
const DEFAULT_APIS_BASE = '//ajax.googleapis.com/ajax';

/**
 * The default path to the static files, appended to APIs base.
 */
const DEFAULT_STATIC_PATH = '/static/modules/gviz/';

/**
 * The default version of the google charts API
 */
const DEFAULT_VERSION = 'current';

/**
 * Returns a Promise that resolves if/when the window has finished loading.
 */
export function isWindowLoaded(): Promise<void> {
  return new Promise((resolve: () => void) => {
    // Already loaded.
    if (
      typeof window === 'undefined' ||
      // no DOM / V8
      document.readyState === 'complete'
    ) {
      resolve();
    } else if (window.addEventListener) {
      // W3C DOM
      document.addEventListener('DOMContentLoaded', resolve, true);
      window.addEventListener('load', resolve, true);
    } else if ((window as AnyDuringMigration).attachEvent) {
      // IE DOM
      (window as AnyDuringMigration).attachEvent('onload', resolve);
    } else {
      if (typeof window.onload !== 'function') {
        window.onload = resolve;
      } else {
        /**
         * window.onload function may or may not get an event arg.
         */
        window.onload = (event: Event) => {
          if (window.onload) {
            window.onload(event);
          }
          resolve();
        };
      }
    }
  });
}

/**
 * The set of resources that have been loaded previously, or are being loaded.
 * Used for subsequent load requests to avoid reloading the same packages,
 * or css files.  The value associated with each resource key is undefined,
 * if the resource has not been requested, and an object once loading starts,
 * containing a promise that resolves when the loadng completes.
 * Subsequent load requests can wait on the same resource to complete loading.
 * We also record whether the resource has actually been loaded.
 */
let loadedResources: {
  [key: string]: {
    //
    promise?: Promise<AnyDuringMigration> | null;
    loaded: boolean; // True once loading is completed.
  };
} = {};

/**
 * Resets loadedResources to empty.
 */
export function resetLoadedResources() {
  loadedResources = {};
}

/**
 * Returns the promise associated with the key, if any.
 */
export function getResourcePromise(
  key: string,
): Promise<AnyDuringMigration> | null | void {
  return loadedResources[key] && loadedResources[key].promise;
}

/**
 * Returns whether the resource associated with the key has been loaded.
 */
export function getResourceLoaded(key: string): boolean {
  return loadedResources[key] && loadedResources[key].loaded;
}

/**
 * Sets the promise for the key.
 */
export function setResourcePromise(key: string, promise: Promise<void>) {
  // Make sure it is not already promised or loaded.
  asserts.assert(
    loadedResources[key] == null,
    `Resource loaded more than once: ${key}`,
  );
  loadedResources[key] = {promise, loaded: false};
}

/**
 * Records that the resource for the key has been loaded.
 */
export function setResourceLoaded(key: string) {
  // Make sure it is not already loaded.
  if (!loadedResources[key]) {
    loadedResources[key] = {loaded: false};
  } else {
    asserts.assert(
      !loadedResources[key].loaded,
      `Resource loaded more than once: ${key}`,
    );
  }
  loadedResources[key].loaded = true;
}

/**
 * Returns the module path based on the google.visualization.ModulePath,
 * google.loader.GoogleApisBase, and google.visualization.Version
 * parameters set in the loader response (google.load()).
 * Examples:
 * http://ajax.googleapis.com/ajax/static/modules/gviz/1.0
 * http://localhost:3222/ajax/static/modules/gviz/1.1
 *
 * Default values:
 *   apisBase - //ajax.googleapis.com/ajax
 *   version - 'current'
 * @return The module path.
 */
export function getModulePath(): string {
  const modulePath = goog.getObjectByName('google.visualization.ModulePath');
  if (modulePath != null) {
    return modulePath;
  }
  // Otherwise, construct module path from apisBase and version.
  let apisBase = goog.getObjectByName('google.loader.GoogleApisBase');
  if (apisBase == null) {
    apisBase = DEFAULT_APIS_BASE;
  }
  let version = goog.getObjectByName('google.visualization.Version');
  if (version == null) {
    version = DEFAULT_VERSION;
  }
  return `${apisBase}${DEFAULT_STATIC_PATH}${version}`;
}

/**
 * Makes a URL for fetching a css file, given the args.
 */
export function makeCssUrl(args: {[key: string]: string}): string {
  const makeCssUrl = goog.getObjectByName('google.charts.loader.makeCssUrl');
  return makeCssUrl(args);
}

/**
 * Gets the loaded locale, default 'en'.
 * @return The locale name.
 */
export function getLocale(): string {
  let locale = 'en';
  // Default to English.
  // google.visualization.Locale is an object set in the global environment
  // by the loader with all the locale information.
  locale = goog.getObjectByName('google.visualization.Locale') || locale;
  return locale;
}
