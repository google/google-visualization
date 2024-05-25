/**
 * @license
 * Copyright 2024 Google LLC
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

import {fail} from '@npm//@closure/asserts/asserts';
import * as googObject from '@npm//@closure/object/object';

import * as gvizDom from '../dom/dom';
import {AbstractVisualization} from '../visualization/abstract_visualization';

import {DynamicLoading} from './dynamic_loading';
import {getLocale} from './utils';

// tslint:disable:ban-types Migration

/**
 * The class with a constructor used to instantiate an AbstractVisualization.
 */
export interface AbstractVisualizationConstructor {
  new (container: Element): AbstractVisualization;
}

/**
 * Resolves a constructor function given the name of the class to instantiate.
 * The name is first looked up in the google.visualization or google.charts
 * namespaces, and then if not found, in the goog.global namespace.
 *
 * @param userVizType The name of the class to instantiate.
 * @return The constructor for the named class, or null if the
 *     constructor is not found.
 */
export function resolveConstructor(
  userVizType: string,
): AbstractVisualizationConstructor | null {
  if (typeof userVizType !== 'string') {
    fail('Chart type must be a string.  Found ' + typeof userVizType + '.');
  }
  const vizType = DynamicLoading.getSafeType(userVizType);
  const global = gvizDom.getGlobal();
  const paths = [
    `google.visualization.${vizType}`,
    `google.charts.${vizType}`,
    vizType,
  ];

  for (const path of paths) {
    const obj = goog.getObjectByName(path, global);
    if (typeof obj === 'function') {
      return obj;
    }
  }

  if (!DynamicLoading.BUILT_FOR_DYNAMIC_LOADING) {
    fail(`Unable to resolve constructor for "${userVizType}"`);
  }
  return null;
}

// Sequentialize loadApi requests.
// Assume there is only one top-level load request, since we can't
// sequentialize those, at least not for google.load().
const requests: Array<() => void> = [];

/**
 * Wrapper around google.charts.load(). If called from code that uses gviz
 * as a library, then we want to skip this.
 *
 * @param moduleName The package name, e.g. 'visualization'.
 * @param moduleVersion The version to load, e.g. '1.1'.
 * @param settings Optional settings
 */
export function loadApi(
  moduleName: string,
  moduleVersion: string,
  settings?: AnyDuringMigration,
) {
  if (!DynamicLoading.BUILT_FOR_DYNAMIC_LOADING) {
    // Better to assert failure than to fail silently.
    fail(
      `Attempting to load "${moduleName}` +
        '" when not built for dynamic loading.',
    );
  }
  // Clone the settings since we will modify them.
  settings = settings == null ? {} : googObject.clone(settings);

  const lang = getLocale();
  if (lang && !settings['language']) {
    settings['language'] = lang;
  }
  settings['debug'] =
    settings['debug'] || goog.getObjectByName('google.visualization.isDebug');
  settings['pseudo'] =
    settings['pseudo'] || goog.getObjectByName('google.visualization.isPseudo');

  // Figure out which loader to use.
  const loader =
    goog.getObjectByName('google.charts.load') ||
    // Use google.load() instead, assuming it is available.
    goog.getObjectByName('google.load');

  if (!loader) {
    // TODO(dlaliberte) Maybe first load jsapi, then try again.
    throw new Error('No loader available.');
  }
  const loaderCaller = () => {
    loader(moduleName, moduleVersion, settings);
  };

  // Replace the callback with one that can be updated.
  // This is so we can call deferred requests.
  const thisCallback = settings['callback'] || (() => {});
  settings['callback'] = () => {
    thisCallback();
    // console.info('Call first item in the queue of requests, for ' +
    //    document.location.href);
    if (requests.length > 0) {
      const f = requests.shift();
      if (f) {
        f();
      }
    }
  };

  const proceedToLoad = () => {
    // console.info('proceedToLoad ' + settings['packages'].join(', '));
    loaderCaller();
  };

  if (requests.length === 0) {
    // No previous requests, so proceed now.
    proceedToLoad();
  } else {
    // Previous requests in progress, so defer this load.
    requests.push(proceedToLoad);
  }
}
