/**
 * @fileoverview Color Bar Legend definition.
 *
 * This class includes all the properties and measures that are needed to
 * draw the color-bar legend.
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

import {ColorBarPosition} from '../common/option_types';
import {Definition} from './definition';
import {Scale} from './scale';
import * as types from './types';

/** ColorBarDefinition */
export interface ColorBarDefinition {
  position: ColorBarPosition;
  scale: Scale;
  drawingOptions: types.Options;
  definition: Definition;
}
