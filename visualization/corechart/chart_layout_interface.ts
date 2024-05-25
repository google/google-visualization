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

import {Value} from '../../data/types';

/** Bounding box returned by getBoundingBox */
export declare interface BoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Type of object returned by getChartLayoutInterface. */
export declare interface ChartLayoutInterface {
  getChartAreaBoundingBox: () => BoundingBox;
  getBoundingBox: (elementId: string) => BoundingBox | null;
  getXLocation: (value: Value | null, axisIndex?: number) => number | null;
  getYLocation: (value: Value | null, axisIndex?: number) => number | null;
  getVAxisValue: (value: number, axisIndex?: number) => Value;
  getHAxisValue: (value: number, axisIndex?: number) => Value;
  getPointDatum: (
    x: number,
    y: number,
    r: number,
  ) => {row: number; col?: number} | null;
}
