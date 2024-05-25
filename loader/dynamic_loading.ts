/**
 * @fileoverview Common utility functions for visualizations.
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

// tslint:disable:ban-unchecked-conversions

import {sanitizeInlineStyleString} from '@npm//@closure/html/sanitizer/csssanitizer';
import {HtmlSanitizer} from '@npm//@closure/html/sanitizer/htmlsanitizer';
import {
  SafeHtml,
  SafeStyle,
  sanitizeUrl,
} from 'google3/third_party/javascript/safevalues';

import {safenUpType} from './safe';

/** @define Are we compiling for mobile or not? Set in BUILD file. */
const GVIZ_IS_MOBILE_DEF: boolean = goog.define('GVIZ_IS_MOBILE', false);

const GVIZ_IS_MOBILE = GVIZ_IS_MOBILE_DEF;

/**
 * @define Is the code able to do dynamic loading? Set in BUILD file.
 *     We support dynamic loading under all circumstances, except when using
 *     gviz as a library.
 */
const BUILT_FOR_DYNAMIC_LOADING = goog.define(
  'BUILT_FOR_DYNAMIC_LOADING',
  false,
);

/**
 * Default sanitizer for untrusted html input. This is already lenient but can
 * be changed further by clients if they need to allow project specific
 * things like url formats, data attributes or custom elements.
 */
const htmlSanitizer: HtmlSanitizer = new HtmlSanitizer.Builder()
  .allowCssStyles()
  // TODO(dlaliberte): This is temporary to allow the release of gviz.
  .allowDataAttributes(['data-safe-link'])
  // TODO(dlaliberte): This is temporary to allow the release of gviz.
  .allowCustomElementTag('iron-icon', ['icon'])
  .withCustomNamePolicy((name) => name)
  .withCustomTokenPolicy((token) => token)
  .withCustomNetworkRequestUrlPolicy((str, hints = {}) => {
    // Allow data: URIs by default for images.
    if (hints.tagName === 'img' && hints.attributeName === 'src') {
      if (str.startsWith('data:')) {
        return sanitizeUrl(str);
      }
    }
    return sanitizeUrl(str);
  })
  .withCustomUrlPolicy((url) => sanitizeUrl(url))
  .build();

/**
 * Sanitizing function for gviz. By default this uses the internal sanitizer,
 * but it can be modified by clients to use their own sanitizer and / or
 * unchecked conversion if the sanitizer API does not work for their use case..
 */
let sanitizeHtml: (html: string) => SafeHtml = (html) =>
  htmlSanitizer.sanitize(html);

/**
 * Whether we are in safe mode or not.
 * In safe mode, untrusted html is transparently sanitized. This has to stay
 * private to this module so that, once this file has been loaded, it can only
 * change from `false` -> `true`.
 * This is true for direct blaze clients (BUILT_FOR_DYNAMIC_LOADING == false)
 * For clients that load the code dynamically, it uses a flag set in the loader.
 */
let safeMode: boolean =
  !BUILT_FOR_DYNAMIC_LOADING ||
  goog.getObjectByName('goog.visualization.isSafeMode') ||
  false;

/** Enables safeMode for the lib. */
function enableSafeMode() {
  safeMode = true;
}

function isSafeMode(): boolean {
  return safeMode;
}

/** Allows clients to change the default html sanitizer that is used by gviz. */
function setHtmlSanitizingFunction(sanitizeHtmlFn: (p1: string) => SafeHtml) {
  sanitizeHtml = sanitizeHtmlFn;
}

/** Converts the given string -- assumed to be HTML -- to a SafeHtml object. */
export function getSafeHtml(html: string): SafeHtml {
  if (safeMode) {
    return sanitizeHtml(html);
  } else {
    // FYI, this used to be allowed with return legacyUnsafeHtml(html);
    throw new Error('Unsafe html is no longer allowed in unsafe mode');
  }
}

/**
 * Converts the given string -- assumed to be inline CSS -- to a SafeStyle
 * object.
 */
function getSafeStyle(style: string): SafeStyle {
  if (isSafeMode()) {
    return sanitizeInlineStyleString(style);
  } else {
    // FTI, this used to be allowed with return legacyUnsafeStyle(style);
    throw new Error('Unsafe style is no longer allowed in unsafe mode');
  }
}

/**
 * Converts the given string -- assumed to be a visualization name --
 *     to a safe type.
 * object.
 */
function getSafeType(userType: string): string {
  let type = userType;
  if (isSafeMode()) {
    type = safenUpType(userType);
  }
  return type;
}

/** Container to attach properties. */
// tslint:disable-next-line:enforce-name-casing
export const DynamicLoading = {
  GVIZ_IS_MOBILE,
  BUILT_FOR_DYNAMIC_LOADING,
  enableSafeMode,
  isSafeMode,
  setHtmlSanitizingFunction,
  getSafeHtml,
  getSafeStyle,
  getSafeType,
};
