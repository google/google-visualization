/**
 * @fileoverview A file with calls to register the various scales in the
 * scale repository.
 * Initializes the following:
 * <ul>
 *  <li>Timeofday scale.
 *  <li>Date scale.
 *  <li>Datetime scale.
 *  <li>Duration scale.
 *  <li>Numeric scale.
 * </ul>
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

import {DatetimeValueScale} from './datetime_value_scale';
import {NumericValueScale} from './numeric_value_scale';
import {ScaleRepository} from './scale_repository';
import {TimeofdayValueScale} from './timeofday_value_scale';

/**
 * Initializes the scale repository.
 */
export const scaleinit = {};

// Notice we are not calling the builder functions, but
// are passing them to the register function as 'pointers'
// to builder functions (see ScaleRepository interface)
ScaleRepository.instance().registerScale(
  'timeofday',
  TimeofdayValueScale.buildTimeofdayValueScale,
);

ScaleRepository.instance().registerScale(
  'date',
  DatetimeValueScale.buildDateValueScale,
);

ScaleRepository.instance().registerScale(
  'datetime',
  DatetimeValueScale.buildDateTimeValueScale,
);

ScaleRepository.instance().registerScale(
  'number',
  NumericValueScale.buildNumericValueScale,
);
