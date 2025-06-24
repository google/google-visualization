import { describe, it, expect } from 'vitest';
import {
  STRING_ZEROES,
  padString,
  padWithZeros,
  capitalize,
  toCamelCase,
  toKebabCase,
  toSnakeCase,
  truncate,
  escapeHtml,
  unescapeHtml,
  cleanWhitespace,
  isBlank,
  isNumeric,
  isValidEmail,
  splitIntoWords,
  countOccurrences,
  replaceAll,
  escapeRegExp,
  randomString,
  formatTemplate,
  toTitleCase,
  reverse,
  isPalindrome,
} from './string-utils';

describe('string-utils', () => {
    describe('STRING_ZEROES', () => {
        it('should be a string of zeros', () => {
            expect(STRING_ZEROES).toBe('0000000000000000');
            expect(STRING_ZEROES.length).toBe(16);
        });
    });

    describe('padString', () => {
        it('should pad string on the left by default', () => {
            expect(padString('123', 5)).toBe('00123');
            expect(padString('abc', 6, 'x')).toBe('xxxabc');
        });

        it('should pad string on the right when specified', () => {
            expect(padString('123', 5, '0', false)).toBe('12300');
            expect(padString('abc', 6, 'x', false)).toBe('abcxxx');
        });

        it('should return original string if already long enough', () => {
            expect(padString('12345', 3)).toBe('12345');
            expect(padString('hello', 5)).toBe('hello');
        });

        it('should handle empty strings', () => {
            expect(padString('', 3)).toBe('000');
            expect(padString('', 3, 'x')).toBe('xxx');
        });
    });

    describe('padWithZeros', () => {
        it('should pad numbers with leading zeros', () => {
            expect(padWithZeros(123, 5)).toBe('00123');
            expect(padWithZeros(7, 3)).toBe('007');
        });

        it('should handle numbers that are already long enough', () => {
            expect(padWithZeros(12345, 3)).toBe('12345');
            expect(padWithZeros(100, 3)).toBe('100');
        });

        it('should handle zero', () => {
            expect(padWithZeros(0, 3)).toBe('000');
        });

        it('should handle very long padding', () => {
            expect(padWithZeros(1, 20)).toBe('00000000000000000001');
        });
    });

    describe('capitalize', () => {
        it('should capitalize first letter', () => {
            expect(capitalize('hello')).toBe('Hello');
            expect(capitalize('world')).toBe('World');
        });

        it('should handle already capitalized strings', () => {
            expect(capitalize('Hello')).toBe('Hello');
            expect(capitalize('WORLD')).toBe('WORLD');
        });

        it('should handle empty strings', () => {
            expect(capitalize('')).toBe('');
        });

        it('should handle single character strings', () => {
            expect(capitalize('a')).toBe('A');
            expect(capitalize('A')).toBe('A');
        });
    });

    describe('toCamelCase', () => {
        it('should convert strings to camelCase', () => {
            expect(toCamelCase('hello world')).toBe('helloWorld');
            expect(toCamelCase('foo bar baz')).toBe('fooBarBaz');
        });

        it('should handle already camelCase strings', () => {
            expect(toCamelCase('helloWorld')).toBe('helloWorld');
        });

        it('should handle single words', () => {
            expect(toCamelCase('hello')).toBe('hello');
            expect(toCamelCase('HELLO')).toBe('hELLO');
        });

        it('should handle empty strings', () => {
            expect(toCamelCase('')).toBe('');
        });
    });

    describe('toKebabCase', () => {
        it('should convert strings to kebab-case', () => {
            expect(toKebabCase('helloWorld')).toBe('hello-world');
            expect(toKebabCase('foo bar baz')).toBe('foo-bar-baz');
            expect(toKebabCase('foo_bar_baz')).toBe('foo-bar-baz');
        });

        it('should handle already kebab-case strings', () => {
            expect(toKebabCase('hello-world')).toBe('hello-world');
        });

        it('should handle single words', () => {
            expect(toKebabCase('hello')).toBe('hello');
        });
    });

    describe('toSnakeCase', () => {
        it('should convert strings to snake_case', () => {
            expect(toSnakeCase('helloWorld')).toBe('hello_world');
            expect(toSnakeCase('foo bar baz')).toBe('foo_bar_baz');
            expect(toSnakeCase('foo-bar-baz')).toBe('foo_bar_baz');
        });

        it('should handle already snake_case strings', () => {
            expect(toSnakeCase('hello_world')).toBe('hello_world');
        });

        it('should handle single words', () => {
            expect(toSnakeCase('hello')).toBe('hello');
        });
    });

    describe('truncate', () => {
        it('should truncate long strings', () => {
            expect(truncate('hello world', 8)).toBe('hello...');
            expect(truncate('hello world', 5)).toBe('he...');
        });

        it('should not truncate short strings', () => {
            expect(truncate('hello', 10)).toBe('hello');
            expect(truncate('hello', 5)).toBe('hello');
        });

        it('should handle custom ellipsis', () => {
            expect(truncate('hello world', 8, '---')).toBe('hello---');
        });

        it('should handle edge cases', () => {
            expect(truncate('hello', 3, '...')).toBe('...');
            expect(truncate('hello', 2, '...')).toBe('..');
        });
    });

    describe('escapeHtml', () => {
        it('should escape HTML special characters', () => {
            expect(escapeHtml('<div>Hello & "World"</div>')).toBe(
                '<div>Hello & "World"</div>'
            );
            expect(escapeHtml("It's a 'test'")).toBe("It's a 'test'");
        });

        it('should handle strings without special characters', () => {
            expect(escapeHtml('Hello World')).toBe('Hello World');
        });

        it('should handle empty strings', () => {
            expect(escapeHtml('')).toBe('');
        });
    });

    describe('unescapeHtml', () => {
        it('should unescape HTML entities', () => {
            expect(unescapeHtml('<div>Hello & "World"</div>')).toBe(
                '<div>Hello & "World"</div>'
            );
            expect(unescapeHtml("It's a 'test'")).toBe("It's a 'test'");
        });

        it('should handle strings without entities', () => {
            expect(unescapeHtml('Hello World')).toBe('Hello World');
        });

        it('should handle empty strings', () => {
            expect(unescapeHtml('')).toBe('');
        });
    });

    describe('cleanWhitespace', () => {
        it('should remove extra whitespace', () => {
            expect(cleanWhitespace('  hello   world  ')).toBe('hello world');
            expect(cleanWhitespace('hello\n\nworld\t\ttest')).toBe('hello world test');
        });

        it('should handle normal strings', () => {
            expect(cleanWhitespace('hello world')).toBe('hello world');
        });

        it('should handle empty strings', () => {
            expect(cleanWhitespace('')).toBe('');
            expect(cleanWhitespace('   ')).toBe('');
        });
    });

    describe('isBlank', () => {
        it('should return true for blank strings', () => {
            expect(isBlank('')).toBe(true);
            expect(isBlank('   ')).toBe(true);
            expect(isBlank('\t\n')).toBe(true);
            expect(isBlank(null)).toBe(true);
            expect(isBlank(undefined)).toBe(true);
        });

        it('should return false for non-blank strings', () => {
            expect(isBlank('hello')).toBe(false);
            expect(isBlank(' hello ')).toBe(false);
            expect(isBlank('0')).toBe(false);
        });
    });

    describe('isNumeric', () => {
        it('should return true for numeric strings', () => {
            expect(isNumeric('123')).toBe(true);
            expect(isNumeric('0')).toBe(true);
            expect(isNumeric('999999')).toBe(true);
        });

        it('should return false for non-numeric strings', () => {
            expect(isNumeric('123.45')).toBe(false);
            expect(isNumeric('abc')).toBe(false);
            expect(isNumeric('12a3')).toBe(false);
            expect(isNumeric('')).toBe(false);
            expect(isNumeric('-123')).toBe(false);
        });
    });

    describe('isValidEmail', () => {
        it('should return true for valid email addresses', () => {
            expect(isValidEmail('test@example.com')).toBe(true);
            expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
            expect(isValidEmail('user+tag@example.org')).toBe(true);
        });

        it('should return false for invalid email addresses', () => {
            expect(isValidEmail('invalid')).toBe(false);
            expect(isValidEmail('invalid@')).toBe(false);
            expect(isValidEmail('@invalid.com')).toBe(false);
            expect(isValidEmail('invalid@.com')).toBe(false);
            expect(isValidEmail('invalid@com')).toBe(false);
            expect(isValidEmail('')).toBe(false);
        });
    });

    describe('splitIntoWords', () => {
        it('should split strings into words', () => {
            expect(splitIntoWords('hello world')).toEqual(['hello', 'world']);
            expect(splitIntoWords('foo-bar_baz')).toEqual(['foo', 'bar', 'baz']);
            expect(splitIntoWords('  hello   world  ')).toEqual(['hello', 'world']);
        });

        it('should handle single words', () => {
            expect(splitIntoWords('hello')).toEqual(['hello']);
        });

        it('should handle empty strings', () => {
            expect(splitIntoWords('')).toEqual([]);
            expect(splitIntoWords('   ')).toEqual([]);
        });
    });

    describe('countOccurrences', () => {
        it('should count occurrences case-sensitively by default', () => {
            expect(countOccurrences('hello world hello', 'hello')).toBe(2);
            expect(countOccurrences('hello world Hello', 'hello')).toBe(1);
        });

        it('should count occurrences case-insensitively when specified', () => {
            expect(countOccurrences('hello world Hello', 'hello', false)).toBe(2);
            expect(countOccurrences('HELLO world hello', 'Hello', false)).toBe(2);
        });

        it('should not count overlapping matches by default', () => {
            expect(countOccurrences('aaa', 'aa')).toBe(1);
            expect(countOccurrences('aaaa', 'aa')).toBe(2);
        });

        it('should count overlapping matches when specified', () => {
            expect(countOccurrences('aaa', 'aa', true, true)).toBe(2);
            expect(countOccurrences('aaaa', 'aa', true, true)).toBe(3);
            expect(countOccurrences('ababa', 'aba', true, true)).toBe(2);
        });

        it('should handle edge cases', () => {
            expect(countOccurrences('hello', '')).toBe(0);
            expect(countOccurrences('', 'hello')).toBe(0);
            expect(countOccurrences('hello', 'hello')).toBe(1);
        });
    });

    describe('replaceAll', () => {
        it('should replace all occurrences case-sensitively by default', () => {
            expect(replaceAll('hello world hello', 'hello', 'hi')).toBe('hi world hi');
            expect(replaceAll('hello world Hello', 'hello', 'hi')).toBe('hi world Hello');
        });

        it('should replace all occurrences case-insensitively when specified', () => {
            expect(replaceAll('hello world Hello', 'hello', 'hi', false)).toBe('hi world hi');
        });

        it('should handle edge cases', () => {
            expect(replaceAll('hello', '', 'x')).toBe('hello');
            expect(replaceAll('', 'hello', 'hi')).toBe('');
            expect(replaceAll('hello', 'hello', 'hi')).toBe('hi');
        });
    });

    describe('escapeRegExp', () => {
        it('should escape special regex characters', () => {
            expect(escapeRegExp('hello.world')).toBe('hello\\.world');
            expect(escapeRegExp('test[123]')).toBe('test\\[123\\]');
            expect(escapeRegExp('a+b*c?')).toBe('a\\+b\\*c\\?');
            expect(escapeRegExp('(test)')).toBe('\\(test\\)');
        });

        it('should handle strings without special characters', () => {
            expect(escapeRegExp('hello world')).toBe('hello world');
        });
    });

    describe('randomString', () => {
        it('should generate strings of correct length', () => {
            expect(randomString(5)).toHaveLength(5);
            expect(randomString(10)).toHaveLength(10);
            expect(randomString(0)).toHaveLength(0);
        });

        it('should use custom charset when provided', () => {
            const result = randomString(10, 'abc');
            expect(result).toHaveLength(10);
            expect(/^[abc]+$/.test(result)).toBe(true);
        });

        it('should generate different strings', () => {
            const str1 = randomString(20);
            const str2 = randomString(20);
            expect(str1).not.toBe(str2); // Very unlikely to be the same
        });
    });

    describe('formatTemplate', () => {
        it('should format template strings', () => {
            expect(formatTemplate('Hello {name}!', { name: 'World' })).toBe('Hello World!');
            expect(formatTemplate('{greeting} {name}!', { greeting: 'Hi', name: 'John' })).toBe('Hi John!');
        });

        it('should handle missing values', () => {
            expect(formatTemplate('Hello {name}!', {})).toBe('Hello {name}!');
            expect(formatTemplate('Hello {name}!', { other: 'value' })).toBe('Hello {name}!');
        });

        it('should handle various data types', () => {
            expect(formatTemplate('Count: {count}', { count: 42 })).toBe('Count: 42');
            expect(formatTemplate('Active: {active}', { active: true })).toBe('Active: true');
        });

        it('should handle empty templates', () => {
            expect(formatTemplate('', { name: 'test' })).toBe('');
            expect(formatTemplate('no placeholders', { name: 'test' })).toBe('no placeholders');
        });
    });

    describe('toTitleCase', () => {
        it('should convert strings to title case', () => {
            expect(toTitleCase('hello world')).toBe('Hello World');
            expect(toTitleCase('foo bar baz')).toBe('Foo Bar Baz');
            expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
        });

        it('should handle single words', () => {
            expect(toTitleCase('hello')).toBe('Hello');
            expect(toTitleCase('HELLO')).toBe('Hello');
        });

        it('should handle empty strings', () => {
            expect(toTitleCase('')).toBe('');
        });
    });
});
