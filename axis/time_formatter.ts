/**
 * @fileoverview Provides a time formatter interface and a simple time formatter
 * used for testing.
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

export abstract class TimeFormatter {
  /**
   * Measures the width of a text field.
   * @param duration A time duration.
   */
  abstract setTimeUnit(duration: number): void;

  /**
   * Formats point in time to a string depending on the time unit.
   * @param time Point in time to format.
   * @return The formatted string.
   */
  abstract format(time: number): string;
}
