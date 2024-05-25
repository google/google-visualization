/**
 * @fileoverview A utilities for scaling values of size dimension.
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

import {assert} from '@npm//@closure/asserts/asserts';

import {BoxCoxMapper} from '../axis/box_cox_mapper';

import {Options} from './options';

/**
 * A converter that transforms a number to another number, and vice versa.
 * The transform function is used to convert from data values,
 * which are numbers, to a numeric space which is one step closer to the
 * screen coordinates.  The inverse function does the reverse transform.
 */
export interface Converter {
  transform: (p1: number) => number;
  inverse: (p1: number) => number;
}

/**
 * The available scales.
 */
export enum ScaleType {
  PIECEWISE_LINEAR = 'piecewiseLinear',
  LOG = 'log',
  MIRROR_LOG = 'mirrorLog',
}

/**
 * Returns an identity number scale that converts a number to itself.
 * @return See above.
 */
export function getIdentityScale(): Converter {
  return {
    transform(v) {
      return v;
    },
    inverse(n) {
      return n;
    },
  };
}

/**
 * Returns a logarithmic number scale that converts a number to the base 10 log
 * of itself.
 *
 * @param zeroThreshold The limit for values to treat as zero.
 * @return See above.
 */
export function getLogScale(zeroThreshold: number): Converter {
  const boxCoxMapper = new BoxCoxMapper( // Note min of 0 does not work, so use
    // fraction of zeroThreshold.
    zeroThreshold * 0.5,
    zeroThreshold,
    0,
    1,
    0,
  );

  return {
    transform(v) {
      return v == null ? v : boxCoxMapper.getScreenValue(v);
    },
    inverse(n) {
      return n == null ? n : boxCoxMapper.getDataValue(n);
    },
  };
}

/**
 * Returns a logarithmic number with the same sign as the one passed in.
 * The range [-zeroThreshold..zeroThreshold] is all treated as zero.
 *
 * @param zeroThreshold The limit for values to treat as zero.
 * @return See above.
 */
export function getMirroredLogScale(zeroThreshold: number): Converter {
  assert(zeroThreshold > 0);

  const boxCoxMapper = new BoxCoxMapper( // The min and max must be at least as
    // large as the zeroThreshold
    -zeroThreshold,
    zeroThreshold,
    -1,
    1,
    0,
    zeroThreshold,
  );

  return {
    transform(v) {
      return v == null ? v : boxCoxMapper.getScreenValue(v);
    },
    inverse(n) {
      return n == null ? n : boxCoxMapper.getDataValue(n);
    },
  };
}

/**
 * Determines which scaleType to use.
 * The more flexible 'scaleType' overrides the 'logScale' option if present.
 *
 * @param options The options.
 * @param logOptionsPath The option path for log scale.
 * @param scaleOptionsPath A more general option path
 *     for the scale.
 * @return The scale type to use.
 */
export function getScaleType(
  options: Options,
  logOptionsPath: string | string[],
  scaleOptionsPath: string | string[],
): ScaleType {
  const scaleType = options.inferOptionalStringValue(
    scaleOptionsPath,
    // tslint:disable-next-line:no-enum-object-escape
    ScaleType,
  ) as ScaleType | null;
  if (scaleType) {
    return scaleType;
  } else {
    return options.inferBooleanValue(logOptionsPath)
      ? ScaleType.LOG
      : ScaleType.PIECEWISE_LINEAR;
  }
}

/**
 * Returns a number scale, either identity of logarithmic, based on the options.
 * The more flexible 'scaleType' overrides the 'logScale' option if present.
 *
 * @param scaleType The scale to use.
 * @param valueToZeroDistance The closest distance to zero. Only
 *     required for LOG and MIRROR_LOG.
 * @return See above.
 */
export function getScale(
  scaleType: ScaleType,
  valueToZeroDistance: number,
): Converter {
  switch (scaleType) {
    case ScaleType.PIECEWISE_LINEAR:
      return getIdentityScale();
    case ScaleType.LOG:
      return getLogScale(valueToZeroDistance);
    case ScaleType.MIRROR_LOG:
      return getMirroredLogScale(valueToZeroDistance);
    default:
      return getIdentityScale();
  }
}

/**
 * The preferred options key for the log scale option.
 */
export const LOG_SCALE_OPTIONS_KEY = 'logScale';

/**
 * The preferred options key for the log scale option.
 */
export const SCALE_TYPE_OPTIONS_KEY = 'scaleType';
