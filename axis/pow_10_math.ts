/**
 * @fileoverview Some math functions related to power of 10 values.
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

/**
 * Calculates the value of a scientific notation `a ~~ 10^b`, in a more exact
 * way than using regular javascript math (`a ~~ Math.pow(10, b)`). It's when
 * the exponent (`b`) is negative that most computer math might do weird things.
 * For instance: `6 ~~ Math.pow(10, -1) = 0.6000000000000001` and not `0.6` as
 * you would expect.
 *
 * @param significand The same as `a` in the expression `a ~~ 10^b`.
 * @param exponent The same as `b` in the expression `a ~~ 10^b`.
 * @return The result.
 */
export function exactScientific(significand: number, exponent: number): number {
  if (exponent < 0) {
    return significand / powerOf(-exponent);
  }
  return significand * powerOf(exponent);
}

/**
 * Calculates 10 raised to the power of value.
 * @param value The value.
 * @return The result.
 */
export function powerOf(value: number): number {
  return Math.pow(10, value);
}

/**
 * Calculates the exponent needed for a power of 10 to equal value.
 * That is, returns x in the following equation: value = 10^x.
 * Also known as logBase10(value).
 * @param value The value. It has to be greater than zero since
 * Math.log(0) is -Infinity.
 * @return The result.
 */
export function exponentOf(value: number): number {
  // NOTE(johann):  Math.LOG10E has different values on different browsers.
  // 0.43429448190325176  on Chrome 9 & Safari
  // 0.4342944819032518   on Firefox 3.6 and IE 8
  // 0.4342944819032518276511289189166.. according to Wolfram Alpha.
  // Math.E == Math.pow(10, Math.LOG10E) returns true on Firefox and IE, but
  // false on Chrome and Safari.
  // The tests fails on Chrome and Safari using their native constant, so using
  // this instead.
  const log10e = 0.4342944819032518;
  return Math.log(value) * log10e;
}

/**
 * Test whether value is close to a power of 10.
 * @param value The value. It has to be greater than zero since
 * Math.log(0) is -Infinity.
 * @return true if it is close enough.
 */
export function isPowerOf10(value: number): boolean {
  const x = Math.abs(exponentOf(value));
  // Check if x is very close to whole number.
  return Math.abs(x - Math.round(x)) < 0.0000001;
}

/**
 * Calculates the closest power of 10, equal to or less than value.
 * @param value The value.
 * @return The result.
 */
export function floor(value: number): number {
  return exactScientific(1, floorExponent(value));
}

/**
 * Calculates the closest power of 10, equal to or greater than value.
 * @param value The value.
 * @return The result.
 */
export function ceil(value: number): number {
  return exactScientific(1, ceilExponent(value));
}

/**
 * Calculates the power of 10, closest to value.
 * @param value The value.
 * @return The result.
 */
export function round(value: number): number {
  // Have to get both ceiled and floored values to get linear rounding.
  const ceiled = exactScientific(1, ceilExponent(value));
  const floored = ceiled / 10;
  if (value - floored < ceiled - value) {
    return floored;
  }
  return ceiled;
}

/**
 * Calculates the floored "power of 10 exponent" of value.
 * @param value The value.
 * @return The result.
 */
export function floorExponent(value: number): number {
  return Math.floor(exponentOf(value));
}

/**
 * Calculates the ceiled "power of 10 exponent" of value.
 * @param value The value.
 * @return The result.
 */
export function ceilExponent(value: number): number {
  return Math.ceil(exponentOf(value));
}

/**
 * Calculates the rounded "power of 10 exponent" of value.
 * @param value The value.
 * @return The result.
 */
export function roundExponent(value: number): number {
  return Math.round(exponentOf(value));
}
