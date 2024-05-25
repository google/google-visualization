/**
 * @fileoverview A singleton version of DateFormat that has caching.
 * @license
 * Copyright 2022 Google LLC
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

import {
  enforceRtlInText,
  IS_RTL,
} from '@npm//@closure/i18n/bidi';

import {NumberFormat} from './numberformat';

/**
 * Represents a magnitude such as Kilo, Million, Billion.
 */
export interface Type {
  value: number;
  pattern?: string;
  singularString: string;
  pluralString: string;
}

const POWER_SYMBOL = {
  JA_TEN_POW_4: '万',
  JA_TEN_POW_7: '千万',
  JA_TEN_POW_8: '億',
  JA_TEN_POW_16: '京',

  CN_TEN_POW_4: '万',
  CN_TEN_POW_7: '千万',
  CN_TEN_POW_8: '亿',

  CN_CH_TEN_POW_4: '萬',
  CN_CH_TEN_POW_7: '千萬',
  CN_CH_TEN_POW_8: '億',
  CN_CH_TEN_POW_16: '京',

  KO_TEN_POW_4: '만',
  KO_TEN_POW_7: '천만',
  KO_TEN_POW_8: '억',
  KO_TEN_POW_16: '경',
};

/**
 * Returns a locale specific list of short form order of magnitude formatters.
 *
 * @param maxNumDecimals Number of decimals allowed in the formatted value.
 * @return The list of order of magnitudes.
 */
export function getShortI18NOOMFormatters(maxNumDecimals: number) : Formatter[] {
  const basePattern = NumberFormat.getNumDecimalsPattern(0, maxNumDecimals);
  return [
    getQuadrillionMagnitudeShort(basePattern),
    getTrillionMagnitudeShort(basePattern),
    getBillionMagnitudeShort(basePattern),
    getMillionMagnitudeShort(basePattern),
  ];
}

/**
 * Returns a locale specific list of long form order of magnitude formatters.
 *
 * @param maxNumDecimals Number of decimals allowed in the formatted
 *     value.
 * @return The list
 *     of order of magnitudes.
 */
export function getLongI18NOOMFormatters(maxNumDecimals: number) : Formatter[] {
  const basePattern = NumberFormat.getNumDecimalsPattern(0, maxNumDecimals);
  return [
    getQuadrillionMagnitudeLong(basePattern),
    getTrillionMagnitudeLong(basePattern),
    getBillionMagnitudeLong(basePattern),
    getMillionMagnitudeLong(basePattern),
  ];
}

/**
 * Adds an order of magnitude string to a pattern.
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @param orderOfMagnitudeString A magnitude string such as 'Million'.
 * @return The pattern pre- or post fixed by the magnitude string.
 */
function addOOM(basePattern: string, orderOfMagnitudeString: string) : string {
  /**
   * @desc Places a number relative to an order of magnitude. The
   * $basePattern is typically a number, but could be any string
   * representing a number, and the $orderOfMagnitudeString will be replaced
   * by a word such as Million, Billion and Trillion.  So, for example, the
   * value 1000000 might have a base pattern that is replaced by '1' and the
   * order of magnitude would be 'million'.
   */
  const MSG_NUMBER_WITH_ORDER_OF_MAGNITUDE = goog.getMsg(
    '{$basePattern} {$orderOfMagnitudeString}',
    {
      // tslint:disable-next-line:no-implicit-dictionary-conversion
      basePattern,
      // tslint:disable-next-line:no-implicit-dictionary-conversion
      orderOfMagnitudeString,
    },
  );
  return MSG_NUMBER_WITH_ORDER_OF_MAGNITUDE;
}

/**
 * Returns a locale specific order of magnitude formatter for millions.
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude million.
 */
export function getMillionMagnitudeLong(basePattern: string) : Formatter {
  /** @desc Million used for 1 million. */
  const MSG_MILLION_SINGULAR = goog.getMsg('Million');

  /** @desc Million used for numbers other than 1. */
  const MSG_MILLION_PLURAL = goog.getMsg('Million');

  return createFormatter(
    basePattern,
    Math.pow(10, 6),
    MSG_MILLION_SINGULAR,
    MSG_MILLION_PLURAL,
  );
}

/**
 * Returns a locale specific order of magnitude formatter for Billions.
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude Billion.
 */
export function getBillionMagnitudeLong(basePattern: string) : Formatter {
  /** @desc Billion used for 1 Billion. */
  const MSG_BILLION_SINGULAR = goog.getMsg('Billion');

  /** @desc Billion used for numbers other than 1. */
  const MSG_BILLION_PLURAL = goog.getMsg('Billion');

  return createFormatter(
    basePattern,
    Math.pow(10, 9),
    MSG_BILLION_SINGULAR,
    MSG_BILLION_PLURAL,
  );
}

/**
 * Returns a locale specific order of magnitude formatter for Trillions in
 * abbreviated form (T for Trillion in English).
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude trillion.
 */
export function getTrillionMagnitudeLong(basePattern: string) : Formatter {
  /** @desc Trillion used for 1 Trillion. */
  const MSG_TRILLION_SINGULAR = goog.getMsg('Trillion');

  /** @desc Trillion used for numbers other than 1. */
  const MSG_TRILLION_PLURAL = goog.getMsg('Trillion');

  return createFormatter(
    basePattern,
    Math.pow(10, 12),
    MSG_TRILLION_SINGULAR,
    MSG_TRILLION_PLURAL,
  );
}

/**
 * Returns a locale specific order of magnitude formatter for Quadrillion in
 * abbreviated form (Q for Quadrillion in English).
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude Quadrillion.
 */
export function getQuadrillionMagnitudeLong(basePattern: string) : Formatter {
  /** @desc Quadrillion used for 1 Quadrillion. */
  const MSG_QUADRILLION_SINGULAR = goog.getMsg('Quadrillion');

  /** @desc Quadrillion used for numbers other than 1. */
  const MSG_QUADRILLION_PLURAL = goog.getMsg('Quadrillion');

  return createFormatter(
    basePattern,
    Math.pow(10, 15),
    MSG_QUADRILLION_SINGULAR,
    MSG_QUADRILLION_PLURAL,
  );
}

/**
 * Returns a locale specific order of magnitude formatter for Million in
 * abbreviated form (M for Million in English).
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude million.
 */
export function getMillionMagnitudeShort(basePattern: string) : Formatter {
  /** @desc Abbreviation for Million. */
  const MSG_MILLION_ABBREV = goog.getMsg('M');

  return createFormatter(
    basePattern,
    Math.pow(10, 6),
    MSG_MILLION_ABBREV,
    MSG_MILLION_ABBREV,
  );
}

/**
 * Returns a locale specific order of magnitude formatter for Billion in
 * abbreviated form (B for Billion in English).
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude Billion.
 */
export function getBillionMagnitudeShort(basePattern: string) : Formatter {
  /** @desc Abbreviation for Billion. */
  const MSG_BILLION_ABBREV = goog.getMsg('B');

  return createFormatter(
    basePattern,
    Math.pow(10, 9),
    MSG_BILLION_ABBREV,
    MSG_BILLION_ABBREV,
  );
}

/**
 * Returns a locale specific order of magnitude formatter for Trillion in
 * abbreviated form (T for Trillion in English).
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude Trillion.
 */
export function getTrillionMagnitudeShort(basePattern: string) : Formatter {
  /** @desc Abbreviation for Trillion. */
  const MSG_TRILLION_ABBREV = goog.getMsg('T');

  return createFormatter(
    basePattern,
    Math.pow(10, 12),
    MSG_TRILLION_ABBREV,
    MSG_TRILLION_ABBREV,
  );
}

/**
 * Returns a locale specific order of magnitude formatter for Quadrillion in
 * abbreviated form (Q for Quadrillion in English).
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return A formatter for order of magnitude Quadrillion.
 */
export function getQuadrillionMagnitudeShort(basePattern: string) : Formatter {
  /** @desc Abbreviation for Quadrillion. */
  const MSG_QUADRILLION_ABBREV = goog.getMsg('Q');

  return createFormatter(
    basePattern,
    Math.pow(10, 15),
    MSG_QUADRILLION_ABBREV,
    MSG_QUADRILLION_ABBREV,
  );
}

/**
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @param magnitude The numeric value the magnitude represents.
 *     Example: For Million the magnitude is 10^6.
 * @param singularString The string for the singular multiple of
 *     the magnitude. Example 1 Million.
 * @param pluralString The string for multiples other than one.
 *     Example: 5 Million.
 * @return The formatter.
 */
export function createFormatter(basePattern: string, magnitude: number, singularString: string, pluralString: string) : Formatter { return new Formatter(basePattern, magnitude, singularString, pluralString); }

/**
 * Returns an array of Japanese magnitudes.
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return The list of order of magnitudes.
 */
export function getJapaneseFormatters(basePattern: string) : Formatter[] {
  return [
    createFormatter(
      basePattern,
      Math.pow(10, 16),
      POWER_SYMBOL.JA_TEN_POW_16,
      POWER_SYMBOL.JA_TEN_POW_16,
    ),
    getBillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 8),
      POWER_SYMBOL.JA_TEN_POW_8,
      POWER_SYMBOL.JA_TEN_POW_8,
    ),
    createFormatter(
      basePattern,
      Math.pow(10, 7),
      POWER_SYMBOL.JA_TEN_POW_7,
      POWER_SYMBOL.JA_TEN_POW_7,
    ),
    getMillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 4),
      POWER_SYMBOL.JA_TEN_POW_4,
      POWER_SYMBOL.JA_TEN_POW_4,
    ),
  ];
}

/**
 * Returns an array of simplified Chinese magnitudes.
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return The list
 *     of order of magnitudes.
 */
export function getSimplifiedCNFormatters(basePattern: string) : Formatter[] {
  return [
    getBillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 8),
      POWER_SYMBOL.CN_TEN_POW_8,
      POWER_SYMBOL.CN_TEN_POW_8,
    ),
    createFormatter(
      basePattern,
      Math.pow(10, 7),
      POWER_SYMBOL.CN_TEN_POW_7,
      POWER_SYMBOL.CN_TEN_POW_7,
    ),
    getMillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 4),
      POWER_SYMBOL.CN_TEN_POW_4,
      POWER_SYMBOL.CN_TEN_POW_4,
    ),
  ];
}

/**
 * Returns an array of traditional Chinese magnitudes.
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return The list
 *     of order of magnitudes.
 */
export function getTraditionalCNFormatters(basePattern: string) : Formatter[] {
  return [
    createFormatter(
      basePattern,
      Math.pow(10, 16),
      POWER_SYMBOL.CN_CH_TEN_POW_16,
      POWER_SYMBOL.CN_CH_TEN_POW_16,
    ),
    getBillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 8),
      POWER_SYMBOL.CN_CH_TEN_POW_8,
      POWER_SYMBOL.CN_CH_TEN_POW_8,
    ),
    createFormatter(
      basePattern,
      Math.pow(10, 7),
      POWER_SYMBOL.CN_CH_TEN_POW_7,
      POWER_SYMBOL.CN_CH_TEN_POW_7,
    ),
    getMillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 4),
      POWER_SYMBOL.CN_CH_TEN_POW_4,
      POWER_SYMBOL.CN_CH_TEN_POW_4,
    ),
  ];
}

/**
 * Returns an array of Korean formatters.
 * @param basePattern A number format pattern that will be augmented
 *     with magnitude string in locale specific order.
 * @return The list
 *     of order of magnitudes.
 */
export function getKoreanFormatters(basePattern: string) : Formatter[] {
  return [
    createFormatter(
      basePattern,
      Math.pow(10, 16),
      POWER_SYMBOL.KO_TEN_POW_16,
      POWER_SYMBOL.KO_TEN_POW_16,
    ),
    getBillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 8),
      POWER_SYMBOL.KO_TEN_POW_8,
      POWER_SYMBOL.KO_TEN_POW_8,
    ),
    createFormatter(
      basePattern,
      Math.pow(10, 7),
      POWER_SYMBOL.KO_TEN_POW_7,
      POWER_SYMBOL.KO_TEN_POW_7,
    ),
    getMillionMagnitudeLong(basePattern),
    createFormatter(
      basePattern,
      Math.pow(10, 4),
      POWER_SYMBOL.KO_TEN_POW_4,
      POWER_SYMBOL.KO_TEN_POW_4,
    ),
  ];
}

/**
 * Creates an OrderOfMagnitude.Formatter that formats numbers using
 * formatting patterns with order of magnitude strings such as
 * Million, Billion and Trillion.
 * Two patterns can be specified, one for the single multiple of
 * the magnitude, the other for all other numbers.
 */
export class Formatter {
  private readonly formatter: NumberFormat;

  /**
   * @param pattern The ICU pattern used for formatting.
   * @param magnitude The magnitude this formatter represents.
   *     For the Billion magnitude this number would be 10^6.
   * @param singularString The singular magnitude.
   * @param pluralString The plural form for the magnitude.
   */
  constructor(
    pattern: string | undefined,
    private readonly magnitude: number,
    public singularString: string,
    public pluralString: string,
  ) {
    /**
     * Formatter used for the plural magnitude.
     */
    this.formatter = new NumberFormat({'pattern': pattern});
  }

  /**
   * Returns an order of magnitude formatted string representation of a value.
   * @param value The value to format.
   * @return The formatted value.
   */
  format(value: number): string {
    const adjusted = value / this.magnitude;
    const formattedValue = this.formatter.formatValue(adjusted);

    const magnitudeString =
      Math.abs(adjusted) < 2 ? this.singularString : this.pluralString;
    let result = addOOM(formattedValue, magnitudeString);

    // The gviz chart sets itself to ltr.
    if (IS_RTL) {
      result = enforceRtlInText(result);
    }
    return result;
  }

  /**
   * @return The magnitude the formatter represents.
   */
  getMagnitude(): number {
    return this.magnitude;
  }
}
