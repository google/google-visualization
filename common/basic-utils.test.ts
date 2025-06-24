import { describe, it, expect } from 'vitest';
import {
  STRING_ZEROES,
  PRECISION_THRESHOLD,
  numberOrNull,
  getKeyEnsureDefault,
  concatSuffix
} from './basic-utils';

describe('basic-utils', () => {
  describe('constants', () => {
    it('should have STRING_ZEROES with correct length', () => {
      expect(STRING_ZEROES).toBe('0000000000000000');
      expect(STRING_ZEROES.length).toBe(16);
    });

    it('should have PRECISION_THRESHOLD as a very small number', () => {
      expect(PRECISION_THRESHOLD).toBe(0.000000000000001);
      expect(PRECISION_THRESHOLD).toBeLessThan(0.000001);
    });
  });

  describe('numberOrNull', () => {
    it('should return null for null input', () => {
      expect(numberOrNull(null)).toBeNull();
    });

    it('should return null for empty string input', () => {
      expect(numberOrNull('')).toBeNull();
    });

    it('should return a number for a valid numeric string', () => {
      expect(numberOrNull('123')).toBe(123);
    });

    it('should return a negative number for a valid negative numeric string', () => {
      expect(numberOrNull('-456')).toBe(-456);
    });

    it('should return a floating-point number for a valid float string', () => {
      expect(numberOrNull('123.45')).toBe(123.45);
    });

    it('should return NaN for a non-numeric string', () => {
      expect(numberOrNull('abc')).toBeNaN();
    });

    it('should return 0 for "0"', () => {
      expect(numberOrNull('0')).toBe(0);
    });

    it('should handle scientific notation', () => {
      expect(numberOrNull('1e5')).toBe(100000);
      expect(numberOrNull('1.23e-4')).toBe(0.000123);
    });
  });

  describe('getKeyEnsureDefault', () => {
    it('should return existing value if key exists', () => {
      const obj = { foo: 'bar' };
      expect(getKeyEnsureDefault(obj, 'foo', 'default')).toBe('bar');
    });

    it('should set and return default value if key does not exist', () => {
      const obj: Record<string, string> = {};
      expect(getKeyEnsureDefault(obj, 'foo', 'default')).toBe('default');
      expect(obj.foo).toBe('default');
    });

    it('should set and return default value if key is null', () => {
      const obj = { foo: null };
      expect(getKeyEnsureDefault(obj, 'foo', 'default')).toBe('default');
      expect(obj.foo).toBe('default');
    });

    it('should work with arrays', () => {
      const arr: (string | undefined)[] = [];
      expect(getKeyEnsureDefault(arr, 0, 'first')).toBe('first');
      expect(arr[0]).toBe('first');
    });

    it('should work with numeric keys', () => {
      const obj: Record<number, string> = {};
      expect(getKeyEnsureDefault(obj, 42, 'answer')).toBe('answer');
      expect(obj[42]).toBe('answer');
    });

    it('should not override falsy but defined values', () => {
      const obj = { foo: 0, bar: false, baz: '' };
      expect(getKeyEnsureDefault(obj, 'foo', 999)).toBe(0);
      expect(getKeyEnsureDefault(obj, 'bar', true)).toBe(false);
      expect(getKeyEnsureDefault(obj, 'baz', 'default')).toBe('');
    });
  });

  describe('concatSuffix', () => {
    it('should handle single root path as string', () => {
      expect(concatSuffix('root', 'property')).toEqual(['root.property']);
    });

    it('should handle multiple root paths as array', () => {
      expect(concatSuffix(['root1', 'root2'], 'property')).toEqual([
        'root1.property',
        'root2.property'
      ]);
    });

    it('should handle empty array', () => {
      expect(concatSuffix([], 'property')).toEqual([]);
    });

    it('should handle complex property names', () => {
      expect(concatSuffix('root', 'nested.property')).toEqual(['root.nested.property']);
    });

    it('should handle multiple roots with complex properties', () => {
      expect(concatSuffix(['a', 'b', 'c'], 'x.y')).toEqual([
        'a.x.y',
        'b.x.y',
        'c.x.y'
      ]);
    });
  });
});
