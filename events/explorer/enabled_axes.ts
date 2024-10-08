/**
 * @fileoverview Class that tells which axes are enabled.
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

/**
 * Class that tells which axes are enabled.
 * @unrestricted
 */
export class EnabledAxes {
  /**
   * @param horizontal If the horizontal axis is enabled.
   * @param vertical If the vertical axis is enabled.
   */
  constructor(
    public horizontal: boolean,
    public vertical: boolean,
  ) {}
}
