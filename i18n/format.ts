/**
 * @fileoverview Shim for goog.i18n classes.
 *
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

export * as DateTimePatterns from 'goog:goog.i18n.DateTimePatterns'; // from //third_party/javascript/closure/i18n:datetimepatterns
export * as DateTimeSymbols from 'goog:goog.i18n.DateTimeSymbols'; // from //third_party/javascript/closure/i18n:datetimesymbols
export * as NumberFormatSymbols from 'goog:goog.i18n.NumberFormatSymbols'; // from //third_party/javascript/closure/i18n:numberformatsymbols
export {DateTimeFormat} from '@npm//@closure/i18n/datetimeformat';
export {NumberFormat} from '@npm//@closure/i18n/numberformat';
export {TimeZone} from '@npm//@closure/i18n/timezone';
