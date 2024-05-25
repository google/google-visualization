/**
 * @fileoverview This file provides the data builder for trendlines.
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

import * as numberScale from '../common/number_scale_util';
import {DataBuilder} from './data_builder';

/**
 * Given the parameters for a trendline, compiles data such that the data has
 * a reasonable density.
 * @unrestricted
 */
export class LinearDataBuilder extends DataBuilder {
  /**
   * @param maxgap The maximum gap size that should appear. Anything bigger than
   *     this number will be broken down.
   * @param slope The slope of the trendline.
   * @param offset The intercept of the trendline.
   * @param domainScale The scale to convert from data-space to screen-space and
   *     back.
   */
  constructor(
    maxgap: number,
    slope: number,
    offset: number,
    domainScale?: numberScale.Converter,
  ) {
    super(
      maxgap,
      (x: AnyDuringAssistedMigration) => offset + slope * x,
      domainScale,
    );
  }
}
