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

import {Const} from '@npm//@closure/string/const';

/**
 * A structure for accumulating components for a TrustedResourceUrl.
 * The format must be a literal constant string, with optional parameters
 * specified by substrings of the form "%{key}".
 * The values for these parameters will be provided by the args object.
 * Other params are passed to TrustedResourceUrl.formatWithParams.
 */
export interface UrlStruct {
  readonly format: Const;
  readonly args: {[key: string]: string | number | Const};
  readonly params: {[key: string]: string} | undefined;
}
