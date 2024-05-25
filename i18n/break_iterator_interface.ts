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

/** The interface that a BreakIterator needs to fulfil. */
export interface BreakIteratorInterface {
  /** Assigns text to be segmented to the iterator. */
  adoptText(text: string): void;

  /** Returns index of the first break and moves pointer to it. */
  first(): number;

  /** Returns index of the current break. */
  current(): number;

  /**
   * Returns index of the next break at the given level and moves pointer to it.
   */
  next(level: number): number;

  /** Returns index of the next break at the given level. */
  peek(level: number): number;
}
