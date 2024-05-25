/**
 * @fileoverview Utility functions for nightingale layout.
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

import {Size} from '@npm//@closure/math/size';
import * as googString from '@npm//@closure/string/string';
import {BreakIteratorFactory} from '../i18n/break_iterator_factory';
import {BreakIteratorInterface} from '../i18n/break_iterator_interface';
import * as constants from '../i18n/constants';
import {memoize} from './cache/memoize';
import * as gvizJson from './json';

// tslint:disable:ban-types
// tslint:disable:ban-ts-suppressions TS migration

interface StyleValue {
  [key: string]: AnyDuringMigration;
}

/**
 * Calculates the requested size based on the size in the metrics (if any), the
 * current size of the layout, and the minimum and maximum size.
 * @param metricsSize The size of this dimension in the metrics.
 * @param layoutSize The current size of the layout.
 * @param minSize The minimum possible size of this dimension.
 * @param maxSize The maximum possible size of this dimension.
 */
export function calculateRequestedSize(
  metricsSize: number | null,
  layoutSize: number,
  minSize: number,
  maxSize: number,
): number | null {
  let requestedSize = metricsSize;

  if (
    (requestedSize == null ||
      !isFinite(requestedSize) ||
      requestedSize > maxSize) &&
    layoutSize > maxSize
  ) {
    requestedSize = maxSize;
  }

  if (
    (requestedSize == null ||
      !isFinite(requestedSize) ||
      requestedSize < minSize) &&
    layoutSize < minSize
  ) {
    requestedSize = minSize;
  }

  return requestedSize;
}

/**
 * Recursively iterates over the given object and concatenates all the property
 * names. Then puts them in the target, concatenated with '.'. For example:
 * The object {'a': 5, 'b': {'c': 'hello'}} would translate to
 * {'a': 5, 'b.c': 'hello}.
 * Dotted styles are prioritized, so {'a.b': 5, 'a': {'b': 7}} would yield
 * {'a.b': 5}.
 * Note: this function mutates the target.
 * @param object The source object.
 * @param prefix An array of prefixes.
 * @param target The target object.
 * @param optConcatenationToken An optional concatenation token to use instead of '.'.
 */
function flattenStyleInternal(
  object: StyleValue,
  prefix: string[],
  target: StyleValue,
  optConcatenationToken?: string,
) {
  const concatenationToken =
    optConcatenationToken == null ? '.' : optConcatenationToken;
  for (const key in object) {
    if (!object.hasOwnProperty(key)) {
      continue;
    }

    if (object[key] instanceof Object && !(object[key] instanceof Array)) {
      flattenStyleInternal(
        object[key],
        prefix.concat(key),
        target,
        concatenationToken,
      );
    } else {
      const concatenatedKey = prefix.concat(key).join(concatenationToken);
      if (!target.hasOwnProperty(concatenatedKey)) {
        target[concatenatedKey] = object[key];
      }
    }
  }
}

/**
 * Recursively iterates over the given object and concatenates all the property
 * names. Then puts them in the target, concatenated with '.'. For example:
 * The object {'a': 5, 'b': {'c': 'hello'}} would translate to
 * {'a': 5, 'b.c': 'hello}.
 * @param object The source object.
 * @param optConcatenationToken An optional concatenation token to use instead of '.'.
 * @return The flattened object
 */
export function flattenStyle(
  object: {},
  optConcatenationToken?: string,
): StyleValue {
  const target = {};
  flattenStyleInternal(object, [], target, optConcatenationToken);
  return target;
}

/**
 * Determines the lowest level break that can be used next.
 * @param measureText A function that takes a string and returns the width of that string.
 * @param partialText A function that takes in a range and returns the string in that range. The string being sliced should be the same as the string that the breakIterator contains. The semantics of this function should be similar to string.slice.
 * @param breakIterator The break iterator.
 * @param lastBreak The position at which the last break occurred.
 * @param width The maximum width that can fit on a line.
 * @param optDontBreakWords If true, a line break will never be inserted in the middle of a word unless there is another hint, such as a zero-width space or soft hyphen, default = false.
 * @return The lowest level at which a break will fit on a line, or the level that occurs most closely to the lastBreak.
 */
export function determineNextBreakLevel(
  measureText: (p1: string) => number,
  partialText: (p1: number, p2: number) => string,
  breakIterator: BreakIteratorInterface,
  lastBreak: number,
  width: number,
  optDontBreakWords?: boolean,
): number {
  let shortestLevel = null;
  const maxBreakLevel = optDontBreakWords
    ? constants.MIDWORD_BREAK
    : constants.CHARACTER_BREAK;
  for (let breakLevel = 0; breakLevel <= maxBreakLevel; breakLevel++) {
    const potentialNextBreak = breakIterator.peek(breakLevel);
    if (shortestLevel == null || potentialNextBreak < shortestLevel.position) {
      shortestLevel = {position: potentialNextBreak, level: breakLevel};
    }
    if (measureText(partialText(lastBreak, potentialNextBreak)) <= width) {
      return breakLevel;
    }
  }
  return (shortestLevel && shortestLevel.level) || maxBreakLevel;
}

/**
 * Generates a partial text function (such as the one that
 * determineNextBreakLevel needs) that appends a hyphen when the sliced string
 * ends with a soft hyphen.
 * @param text The text to bind the function to.
 * @return The partial text function.
 */
export function generatePartialTextFunction(
  text: string,
): (p1: number, p2: number) => string {
  return (start, end) => {
    let slicedText = googString.trim(text.slice(start, end));
    if (slicedText[slicedText.length - 1] === constants.SOFT_HYPHEN) {
      slicedText = slicedText.slice(0, slicedText.length - 1) + '-';
    }
    return slicedText;
  };
}

/**
 * Truncates text to the given length. If the length is not specified returns
 * the whole text with an ellipses attached to the end. If an entire ellipses
 * can fit, uses the ellipses unicode character. If not, then it tries to fit as
 * many dots as it can.
 * @param text The text to truncate.
 * @param optLength The length to truncate to.
 * @return The truncated text.
 */
export function getTruncatedText(text: string, optLength?: number): string {
  const length = optLength == null ? text.length : optLength;
  if (length >= 0) {
    return googString.trim(text.slice(0, length)) + constants.ELLIPSES;
  } else {
    return '...'.slice(0, length);
  }
}

/**
 * Truncates a given string until it fits the given width.
 * @param measureText A function that takes a string and returns the width of that string.
 * @param text The text to truncate.
 * @param width The width that the text should fit.
 * @param optRequireOneChar If true, we must include at least one character in the original text, default = false.
 * @return The truncated text.
 */
export function truncateText(
  measureText: (p1: string) => number,
  text: string,
  width: number,
  optRequireOneChar?: boolean,
): string {
  if (measureText(getTruncatedText(text)) <= width) {
    // We can fit the whole line + ellipses.
    return getTruncatedText(text);
  } else {
    // Modify the breakiterator to use the line text and reset it.
    const breakIterator = BreakIteratorFactory.getInstance().getBreakIterator([
      goog.LOCALE,
    ]);
    breakIterator.adoptText(text);
    breakIterator.first();
    // Find the first character break.
    let nextBreak = breakIterator.next(constants.CHARACTER_BREAK);
    // Whether the first character will fit without any dots.
    const firstCharFits = measureText(text.slice(0, nextBreak)) <= width;
    if (
      (optRequireOneChar && !firstCharFits) ||
      (!optRequireOneChar &&
        measureText(getTruncatedText(text, nextBreak)) > width)
    ) {
      // If we can't fit the first character, try to fit some dots.
      for (let i = 0; i >= -3; i--) {
        text = getTruncatedText(text, i);
        if (measureText(text) <= width) {
          break;
        }
      }
    } else {
      // We can fit the first character, so iterate over all the character
      // breaks until we find something that we can't fit.
      while (
        measureText(
          getTruncatedText(text, breakIterator.peek(constants.CHARACTER_BREAK)),
        ) <= width
      ) {
        nextBreak = breakIterator.next(constants.CHARACTER_BREAK);
      }
      if (
        optRequireOneChar &&
        measureText(getTruncatedText(text, nextBreak)) > width
      ) {
        // If at least one character is required, and we can't fit text with
        // ellipses, try to fit text without ellipses.
        const partialText = text.slice(0, nextBreak);
        for (let i = 0; i >= -3; i--) {
          text = partialText + getTruncatedText(text, i);
          if (measureText(text) <= width) {
            break;
          }
        }
      } else {
        text = getTruncatedText(text, nextBreak);
      }
    }
  }
  return text;
}

/**
 * Breaks a given string into lines, and possibly truncates the last line.
 * @param measureText A function that takes a string or an array of strings and returns the size of that string.
 * @param text The text that should be broken up.
 * @param style the style of the text.
 * @param width The maximum width that the text can take up.
 * @param maxLines The maximum number of lines that the text can be.
 * @param optOptions A set of extra options to configure the behavior of the line- breaking algorithm.
 *   truncate: Whether words should be truncated or not, default = true.
 *   requireOneChar: If true, we must include at least one character in the original text, default = false.
 *   dontBreakWords: If true, a line break will never be inserted in the middle of a word unless there is another hint, such as a zero-width space or soft hyphen, default = false.
 * @return An object containing the lines array and a 'truncated' boolean telling whether the text was truncated or not.
 */
function breakLinesInternal(
  measureText: (
    p1: string[] | string,
    // tslint:disable-next-line:ban-types
    p2?: AnyDuringMigration,
  ) => {width: number; height: number} | Size,
  text: string,
  // tslint:disable-next-line:ban-types
  style: AnyDuringMigration,
  width: number,
  maxLines: number,
  optOptions?: {
    truncate?: boolean;
    requireOneChar?: boolean;
    dontBreakWords?: boolean;
  },
): {lines: string[]; truncated: boolean} {
  if (text === '') {
    return {lines: [], truncated: false};
  }

  const options = {
    truncate:
      optOptions == null || optOptions.truncate == null
        ? true
        : optOptions.truncate,
    requireOneChar:
      optOptions == null || optOptions.requireOneChar == null
        ? false
        : optOptions.requireOneChar,
    dontBreakWords:
      optOptions == null || optOptions.dontBreakWords == null
        ? false
        : optOptions.dontBreakWords,
  };

  const originalMeasureText = measureText;
  // Suppressing errors for ts-migration.
  //   TS2322: Type '(text: string | string[]) => number' is not assignable to type '(p1: string | string[], p2?: any) => { width: number; height: number; } | Size'.
  // @ts-ignore
  measureText =  (text) => {
    return originalMeasureText(text, style).width;
  };

  const breakIterator = BreakIteratorFactory.getInstance().getBreakIterator([
    goog.LOCALE,
  ]);
  breakIterator.adoptText(text);
  breakIterator.first();

  let wasTruncated = false;
  const partialText = generatePartialTextFunction(text);

  // Break the text into lines. This is done in 3 steps:
  // 1. Determine the break level that will fit.
  // 2. Iterate on that break level until it no longer fits.
  // 3. Add the break.
  let needsTruncation = false;
  let lines = [];
  let lastBreak = 0;
  while (true) {
    // 1. Determine the break level that will fit.
    const nextBreakLevel = determineNextBreakLevel(
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type '(p1: string | string[], p2?: any) => { width: number; height: number; } | Size' is not assignable to parameter of type '(p1: string) => number'.
      // @ts-ignore
      measureText,
      partialText,
      breakIterator,
      lastBreak,
      width,
      options.dontBreakWords,
    );
    let nextBreak = breakIterator.next(nextBreakLevel);
    if (nextBreakLevel !== constants.HARD_LINE_BREAK) {
      // Hard line breaks are required, we can't just find the next one.
      // 2. Iterate on that break level until it no longer fits.
      while (
        nextBreak < text.length &&
        (measureText(
          partialText(lastBreak, breakIterator.peek(nextBreakLevel)),
        ) as unknown as number) <= width
      ) {
        nextBreak = breakIterator.next(nextBreakLevel);
      }
    }
    // 3. Add the break.
    lines.push(partialText(lastBreak, nextBreak));

    // At this point we need to check if we should stop. We stop if one of the
    // following conditions is met:
    // 1. The next break is at the end of the string. This means that we have
    //    reached the end of the string and there is nothing more to iterate
    //    over.
    // 2. The number of lines is at max lines.
    // 3. The slice of text that we found doesn't fit on a line. This could
    //    happen when the width of the line is so thin that even a character
    //    cannot fit.
    const lineFits =
      (measureText(lines[lines.length - 1]) as unknown as number) <= width;
    if (nextBreak >= text.length || lines.length >= maxLines || !lineFits) {
      // If we haven't yet reached the end of the string, and truncation is
      // enabled, set the truncation flag to true.
      if ((nextBreak < text.length || !lineFits) && options.truncate) {
        // Since the text will be truncated, it should be a little longer than
        // is allowed. However, we shouldn't do this for hard breaks.
        if (nextBreakLevel !== constants.HARD_LINE_BREAK) {
          lines[lines.length - 1] = partialText(
            lastBreak,
            breakIterator.peek(nextBreakLevel),
          );
        }
        needsTruncation = true;
      } else if (nextBreak < text.length) {
        wasTruncated = true;
      }
      break;
    }
    lastBreak = nextBreak;
  }

  if (needsTruncation) {
    // When truncating text, we should require one char if the option is on and
    // there's only one line to truncate. This is because if there is more than
    // one line to truncate, we are already showing at least one char.
    lines[lines.length - 1] = truncateText(
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type '(p1: string | string[], p2?: any) => { width: number; height: number; } | Size' is not assignable to parameter of type '(p1: string) => number'.
      // @ts-ignore
      measureText,
      lines[lines.length - 1],
      width,
      options.requireOneChar && lines.length === 1,
    );
    wasTruncated = true;
  }

  if (lines.length === 1 && lines[0] === '') {
    lines = [];
  }

  return {lines, truncated: wasTruncated};
}

/**
 * Breaks a given string into lines, and possibly truncates the last line.
 * @param measureText A function that takes a string or an array of strings and returns the size of that string.
 * @param text The text that should be broken up.
 * @param style the style of the text.
 * @param width The maximum width that the text can take up.
 * @param maxLines The maximum number of lines that the text can be.
 * @param optOptions A set of extra options to configure the behavior of the line- breaking algorithm.
 *   truncate: Whether words should be truncated or not, default = true.
 *   requireOneChar: If true, we must include at least one character in the original text, default = false.
 *   dontBreakWords: If true, a line break will never be inserted in the middle of a word unless there is another hint, such as a zero-width space or soft hyphen, default = false.
 * @return An object containing the lines array and a 'truncated' boolean telling whether the text was truncated or not.
 */
export const breakLines = memoize(
  // tslint:disable-next-line:ban-types
  breakLinesInternal as (...p1: AnyDuringMigration[]) => AnyDuringMigration,
  {
    serializer(functionUuid, ...args) {
      const argArray = [functionUuid, ...args];
      return gvizJson.stringify(argArray);
    },
  },
);
