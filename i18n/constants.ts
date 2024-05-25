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

/**
 * The character for the soft hyphen.
 */
export const SOFT_HYPHEN = '\u00ad';

/** The character for ellipses (...). */
export const ELLIPSES = '\u2026';

/** The numeric priority of a hard line break (\n, \r\n). */
export const HARD_LINE_BREAK = 0;

/** The numeric priority of a soft line break (spaces, hyphens, etc). */
export const SOFT_LINE_BREAK = 1;

/**
 * The numeric priority of a midword break (soft hyphen, zero width space, etc).
 */
export const MIDWORD_BREAK = 2;

/** The numeric priority of a character break. */
export const CHARACTER_BREAK = 3;
