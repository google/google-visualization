/**
 * @fileoverview String manipulation utilities.
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

// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * String of zero digits used for number-to-string padding
 */
export const STRING_ZEROES = '0000000000000000';

/**
 * Pads a string to a specified length with a given character.
 * @param str The string to pad.
 * @param length The desired length.
 * @param padChar The character to pad with. Defaults to '0'.
 * @param padLeft Whether to pad on the left (true) or right (false). Defaults to true.
 * @return The padded string.
 */
export function padString(
  str: string,
  length: number,
  padChar = '0',
  padLeft = true,
): string {
  if (str.length >= length) {
    return str;
  }

  const padLength = length - str.length;
  const padding = padChar.repeat(padLength);

  return padLeft ? padding + str : str + padding;
}

/**
 * Pads a number with leading zeros to a specified length.
 * @param num The number to pad.
 * @param length The desired string length.
 * @return The zero-padded string.
 */
export function padWithZeros(num: number, length: number): string {
  const str = num.toString();
  if (str.length >= length) {
    return str;
  }

  const zerosNeeded = length - str.length;
  if (zerosNeeded <= STRING_ZEROES.length) {
    return STRING_ZEROES.substring(0, zerosNeeded) + str;
  }

  // For very long padding, use repeat
  return '0'.repeat(zerosNeeded) + str;
}

/**
 * Capitalizes the first letter of a string.
 * @param str The string to capitalize.
 * @return The capitalized string.
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Converts a string to camelCase.
 * @param str The string to convert.
 * @return The camelCase string.
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, '');
}

/**
 * Converts a string to kebab-case.
 * @param str The string to convert.
 * @return The kebab-case string.
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Converts a string to snake_case.
 * @param str The string to convert.
 * @return The snake_case string.
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Truncates a string to a specified length and adds ellipsis if needed.
 * @param str The string to truncate.
 * @param maxLength The maximum length.
 * @param ellipsis The ellipsis string to append. Defaults to '...'.
 * @return The truncated string.
 */
export function truncate(str: string, maxLength: number, ellipsis = '...'): string {
  if (str.length <= maxLength) {
    return str;
  }

  const truncateLength = maxLength - ellipsis.length;
  if (truncateLength <= 0) {
    return ellipsis.substring(0, maxLength);
  }

  return str.substring(0, truncateLength) + ellipsis;
}

/**
 * Escapes HTML special characters in a string.
 * @param str The string to escape.
 * @return The escaped string.
 */
export function escapeHtml(str: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": "'",
    '/': '/',
  };

  return str.replace(/[&<>"'/]/g, (match) => htmlEscapes[match]);
}

/**
 * Unescapes HTML entities in a string.
 * @param str The string to unescape.
 * @return The unescaped string.
 */
export function unescapeHtml(str: string): string {
  const htmlUnescapes: Record<string, string> = {
    '&': '&',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": "'",
    '/': '/',
  };

  return str.replace(/&(?:amp|lt|gt|quot|#x27|#x2F);/g, (match) => htmlUnescapes[match]);
}

/**
 * Removes leading and trailing whitespace from a string.
 * Also removes extra whitespace between words.
 * @param str The string to clean.
 * @return The cleaned string.
 */
export function cleanWhitespace(str: string): string {
  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Checks if a string is empty or contains only whitespace.
 * @param str The string to check.
 * @return True if the string is empty or whitespace-only.
 */
export function isBlank(str: string | null | undefined): boolean {
  return !str || str.trim().length === 0;
}

/**
 * Checks if a string contains only numeric characters.
 * @param str The string to check.
 * @return True if the string contains only digits.
 */
export function isNumeric(str: string): boolean {
  return /^\d+$/.test(str);
}

/**
 * Checks if a string is a valid email address.
 * @param str The string to check.
 * @return True if the string is a valid email format.
 */
export function isValidEmail(str: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

/**
 * Splits a string into words, handling various separators.
 * @param str The string to split.
 * @return An array of words.
 */
export function splitIntoWords(str: string): string[] {
  return str
    .trim()
    .split(/[\s\-_]+/)
    .filter(word => word.length > 0);
}

/**
 * Counts the number of occurrences of a substring in a string.
 * @param str The string to search in.
 * @param searchStr The substring to count.
 * @param caseSensitive Whether the search should be case-sensitive. Defaults to true.
 * @param allowOverlapping Whether to count overlapping matches. Defaults to false.
 * @return The number of occurrences.
 */
export function countOccurrences(
  str: string,
  searchStr: string,
  caseSensitive = true,
  allowOverlapping = false,
): number {
  if (!searchStr) return 0;

  const haystack = caseSensitive ? str : str.toLowerCase();
  const needle = caseSensitive ? searchStr : searchStr.toLowerCase();

  let count = 0;
  let position = 0;

  while ((position = haystack.indexOf(needle, position)) !== -1) {
    count++;
    position += allowOverlapping ? 1 : needle.length;
  }

  return count;
}

/**
 * Replaces all occurrences of a substring with another string.
 * @param str The string to perform replacements on.
 * @param searchStr The substring to replace.
 * @param replaceStr The replacement string.
 * @param caseSensitive Whether the search should be case-sensitive. Defaults to true.
 * @return The string with replacements made.
 */
export function replaceAll(
  str: string,
  searchStr: string,
  replaceStr: string,
  caseSensitive = true,
): string {
  if (!searchStr) return str;

  if (caseSensitive) {
    return str.split(searchStr).join(replaceStr);
  } else {
    const regex = new RegExp(escapeRegExp(searchStr), 'gi');
    return str.replace(regex, replaceStr);
  }
}

/**
 * Escapes special characters in a string for use in a regular expression.
 * @param str The string to escape.
 * @return The escaped string.
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Generates a random string of specified length.
 * @param length The desired length.
 * @param charset The character set to use. Defaults to alphanumeric.
 * @return The random string.
 */
export function randomString(
  length: number,
  charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Formats a template string with named placeholders.
 * @param template The template string with {name} placeholders.
 * @param values The values to substitute.
 * @return The formatted string.
 */
export function formatTemplate(
  template: string,
  values: Record<string, AnyDuringMigration>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return values.hasOwnProperty(key) ? String(values[key]) : match;
  });
}

/**
 * Converts a string to title case (capitalizes first letter of each word).
 * @param str The string to convert.
 * @return The title case string.
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

/**
 * Reverses a string.
 * @param str The string to reverse.
 * @return The reversed string.
 */
export function reverse(str: string): string {
  return str.split('').reverse().join('');
}

/**
 * Checks if a string is a palindrome.
 * @param str The string to check.
 * @param caseSensitive Whether the check should be case-sensitive. Defaults to false.
 * @return True if the string is a palindrome.
 */
export function isPalindrome(str: string, caseSensitive = false): boolean {
  const cleaned = caseSensitive ? str : str.toLowerCase();
  return cleaned === reverse(cleaned);
}
