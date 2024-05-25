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

import {TrustedResourceUrl} from '@npm//@closure/html/trustedresourceurl';
import {Deferred} from '@npm//@closure/mochikit/async/deferred';
import * as jsloader from '@npm//@closure/net/jsloader';
import {Const} from '@npm//@closure/string/const';
import * as userAgent from '@npm//@closure/useragent/useragent';

import {UrlStruct} from './url_struct';

// tslint:disable:deprecation  Const and formatWithParams are deprecated.
// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * The length of time, in milliseconds, we are prepared to wait for a
 * load request to complete.  Defaults to 30 seconds.
 */
const TIMEOUT_DELAY = 30000;

/**
 * Returns a UrlStruct given format and args.
 * The format must have "%{key}" components that correspond to args, when used
 * to build a TrustedResourceUrl.
 *
 * @param format Format for constructing url.
 * @param args in the format.
 * @param params Extra params for query string.
 */
export function makeUrlStruct(
  format: Const, //
  args: {[key: string]: string | number | Const}, //
  params?: {[key: string]: string},
): UrlStruct {
  return {format, args, params};
}

/**
 * Returns a TrustedResourceUrl from a UrlStruct.  This simply passes the
 * format and args to the TrustedResourceUrl.format method.
 */
export function getTrustedUrl(urlStruct: UrlStruct): TrustedResourceUrl {
  const params = urlStruct.params || {};
  return TrustedResourceUrl.formatWithParams(
    urlStruct.format,
    urlStruct.args,
    params,
  );
}

let internalSafeLoad = jsloader.safeLoad;

let testLoad: typeof internalLoad | null = null;

/**
 * Sets the internalLoader to load.  Used for testing.
 */
function setTestLoad(load: typeof internalLoad) {
  testLoad = load;
}

/**
 * Given a format and args that specify a URL for a script, loads the script
 * and then calls the callback function.
 * @param format Format for component.
 * @param args in the format.
 * @param params Extra params for query string
 * @return Promise resolved when the script has loaded.
 */
function internalLoad(
  format: Const, //
  args: {[key: string]: string | number | Const}, //
  params?: {[key: string]: string},
): Promise<void> {
  if (testLoad) {
    return testLoad(format, args, params);
  }

  params = params || {};
  const trustedUrl = TrustedResourceUrl.formatWithParams(format, args, params);
  const deferred = internalSafeLoad(trustedUrl, {
    timeout: TIMEOUT_DELAY,
    attributes: {
      // See comment in loadMany.
      'async': false as unknown as string,
      'defer': false as unknown as string,
    },
  });
  return new Promise((resolve) => {
    deferred.addCallback(resolve);
  });
}

/**
 * Allows internaSafeLoad to be replaced, for testing.
 */
function setSafeLoad(
  safeLoad: (p1: TrustedResourceUrl, p2: AnyDuringMigration | null) => Deferred,
) {
  internalSafeLoad = safeLoad;
}

/**
 * Functions for testing.
 */
export const TEST_ONLY = {
  setTestLoad,
  setSafeLoad,
};

/**
 * @param component.
 * @param in the format.
 * @param params Extra params for query string.
 * @return Promise resolved when the script has loaded.
 */
export const load = internalLoad;

/**
 * Given urlStructs that specify many URLs for scripts, loads all the scripts
 * and then calls the callback function.
 * @return Promise resolved when the scripts have loaded.
 */
export function loadMany(urlStructs: UrlStruct[]): Promise<void> {
  const trustedUrls = urlStructs.map(getTrustedUrl);
  if (trustedUrls.length === 0) {
    return Promise.resolve();
  }

  const loadOptions = {
    timeout: TIMEOUT_DELAY,
    attributes: {
      // Note that {'async': false} is different from not specifying the 'async'
      // attribute at all.  The explicit boolean false value causes the browser
      // to execute the scripts in the order they appear, which we depend on.
      // However, boolean false is not allowed (yet), and {'async': 'false'}
      // acts like a true value, so we have to cast for now.
      'async': false as unknown as string,
      'defer': false as unknown as string,
    },
  };

  const deferreds = [];
  if (!userAgent.IE || userAgent.isVersionOrHigher(11)) {
    for (const trustedUrl of trustedUrls) {
      deferreds.push(internalSafeLoad(trustedUrl, loadOptions));
    }
  } else {
    // IE10 or lower.
    // This is an alternative way, using safeLoadMany, but it takes longer.
    deferreds.push(jsloader.safeLoadMany(trustedUrls, loadOptions));
  }

  const result = Promise.all(
    deferreds.map((deferred) => {
      return new Promise((resolve) => {
        deferred.addCallback(resolve);
      });
    }),
  );
  return result as unknown as Promise<void>;
}
