/**
 * @fileoverview A collection of enums.
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

import {fail} from '@npm//@closure/asserts/asserts';
import * as functions from '@npm//@closure/functions/functions';
import * as fxEasing from '@npm//@closure/fx/easing';
import {Options} from './options';

/**
 * Enumeration of the possible easing types.
 * Easing type.
 */
export enum EasingType {
  LINEAR = 'linear',
  IN = 'in',
  OUT = 'out',
  IN_AND_OUT = 'inAndOut',
}

/**
 * Returns an easing function corresponding the given type. An easing function
 * is a function that accepts a number in the range [0,1] and returns a number,
 * typically also in the range [0,1] (but doesn't have to be). It should,
 * however, return 0 for input 0 and 1 for input 1. Its purpose is to make the
 * the animation progress non-linear, and so giving a nice visual effect.
 * @param easingType The easing function type.
 * @return The easing function.
 */
function getEasingFunction(easingType: EasingType): (p1: number) => number {
  switch (easingType) {
    case EasingType.LINEAR:
      return functions.identity;
    case EasingType.IN:
      return fxEasing.easeIn;
    case EasingType.OUT:
      return fxEasing.easeOut;
    case EasingType.IN_AND_OUT:
      return fxEasing.inAndOut;
    default:
      fail(`Invalid easing type "${easingType}"`);
  }
  return functions.identity;
}

/**
 * Properties needed for performing animation. 'duration' is in milliseconds and
 * 'easing' is the progress function.
 */
export interface Properties {
  startup: boolean;
  duration: number;
  easing: (p1: number) => number;
  maxFramesPerSecond: number;
}

/**
 * Reads animation properties from the options.
 * @param options The options.
 * @param defaultDuration The default animation duration.
 * @param defaultMaxFramesPerSecond The default maxFramesPerSecond.
 * @param defaultEasingType The default animation
 *     easing type.
 * @return The animation properties, or null if no
 *     animation was requested (animation duration is zero).
 */
export function getProperties(
  options: Options,
  defaultDuration: number,
  defaultMaxFramesPerSecond: number,
  defaultEasingType: EasingType,
): Properties | null {
  const startup = options.inferBooleanValue('animation.startup', false);
  const duration = options.inferNonNegativeNumberValue(
    'animation.duration',
    defaultDuration,
  );
  if (!duration) {
    // Zero means no animation.
    return null;
  }
  const maxFramesPerSecond = options.inferNonNegativeNumberValue(
    'animation.maxFramesPerSecond',
    defaultMaxFramesPerSecond,
  );

  const easingType = options.inferStringValue(
    'animation.easing',
    defaultEasingType,
    // tslint:disable-next-line:no-enum-object-escape
    EasingType,
  ) as EasingType;

  const easingFunction = getEasingFunction(easingType);
  return {startup, duration, easing: easingFunction, maxFramesPerSecond};
}
