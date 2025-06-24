import { describe, it, expect } from 'vitest';
import {
  objectsAlmostEqual,
  getKeyEnsureDefault,
  containsNoOtherProperties,
  concatSuffix,
  deepClone,
  shallowClone,
  isEmpty,
  getNestedProperty,
  setNestedProperty,
  deepMerge,
  pick,
  omit,
} from './object-utils';

describe('object-utils', () => {
  describe('objectsAlmostEqual', () => {
    it('should return true for both null objects', () => {
      expect(objectsAlmostEqual(null, null, 0.1)).toBe(true);
    });

    it('should return true if only one object is null', () => {
      expect(objectsAlmostEqual({ a: 1 }, null, 0.1)).toBe(true);
      expect(objectsAlmostEqual(null, { a: 1 }, 0.1)).toBe(true);
    });

    it('should return true for objects with values within tolerance', () => {
      const obj1 = { a: 1.0, b: 2.0 };
      const obj2 = { a: 1.05, b: 2.05 };
      expect(objectsAlmostEqual(obj1, obj2, 0.1)).toBe(true);
    });

    it('should return false for objects with values outside tolerance', () => {
      const obj1 = { a: 1.0, b: 2.0 };
      const obj2 = { a: 1.2, b: 2.2 };
      expect(objectsAlmostEqual(obj1, obj2, 0.1)).toBe(false);
    });

    it('should ignore keys that exist only in obj2', () => {
      const obj1 = { a: 1.0 };
      const obj2 = { a: 1.05, b: 2.0 };
      expect(objectsAlmostEqual(obj1, obj2, 0.1)).toBe(true);
    });

    it('should use custom diff function when provided', () => {
      const obj1 = { a: 'hello', b: 'world' };
      const obj2 = { a: 'hello', b: 'world' };
      const customDiff = (a: any, b: any) => Math.abs(a.length - b.length);
      expect(objectsAlmostEqual(obj1, obj2, 0.1, customDiff)).toBe(true);
    });

    it('should handle empty objects', () => {
      expect(objectsAlmostEqual({}, {}, 0.1)).toBe(true);
    });
  });

  describe('getKeyEnsureDefault', () => {
    it('should return existing value if key exists', () => {
      const obj = { a: 42, b: null };
      expect(getKeyEnsureDefault(obj, 'a', 100)).toBe(42);
    });

    it('should set and return default value if key is null', () => {
      const obj = { a: 42, b: null };
      expect(getKeyEnsureDefault(obj, 'b', 100)).toBe(100);
      expect(obj.b).toBe(100);
    });

    it('should set and return default value if key is undefined', () => {
      const obj: any = { a: 42 };
      expect(getKeyEnsureDefault(obj, 'c', 'default')).toBe('default');
      expect(obj.c).toBe('default');
    });

    it('should work with arrays', () => {
      const arr: any[] = [1, 2];
      expect(getKeyEnsureDefault(arr, 2, 'third')).toBe('third');
      expect(arr[2]).toBe('third');
    });

    it('should not override falsy but defined values', () => {
      const obj = { a: 0, b: '', c: false };
      expect(getKeyEnsureDefault(obj, 'a', 100)).toBe(0);
      expect(getKeyEnsureDefault(obj, 'b', 'default')).toBe('');
      expect(getKeyEnsureDefault(obj, 'c', true)).toBe(false);
    });
  });

  describe('containsNoOtherProperties', () => {
    it('should return true for object with only permitted properties', () => {
      const obj = { a: 1, b: 2 };
      expect(containsNoOtherProperties(obj, ['a', 'b', 'c'])).toBe(true);
    });

    it('should return false for object with non-permitted properties', () => {
      const obj = { a: 1, b: 2, d: 4 };
      expect(containsNoOtherProperties(obj, ['a', 'b', 'c'])).toBe(false);
    });

    it('should return true for empty object', () => {
      expect(containsNoOtherProperties({}, ['a', 'b'])).toBe(true);
    });

    it('should return true for object with subset of permitted properties', () => {
      const obj = { a: 1 };
      expect(containsNoOtherProperties(obj, ['a', 'b', 'c'])).toBe(true);
    });
  });

  describe('concatSuffix', () => {
    it('should handle string root path', () => {
      expect(concatSuffix('root', 'property')).toEqual(['root.property']);
    });

    it('should handle array of root paths', () => {
      expect(concatSuffix(['root1', 'root2'], 'property')).toEqual([
        'root1.property',
        'root2.property',
      ]);
    });

    it('should handle empty array', () => {
      expect(concatSuffix([], 'property')).toEqual([]);
    });

    it('should handle single element array', () => {
      expect(concatSuffix(['root'], 'property')).toEqual(['root.property']);
    });
  });

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42);
      expect(deepClone('hello')).toBe('hello');
      expect(deepClone(true)).toBe(true);
      expect(deepClone(null)).toBe(null);
    });

    it('should deep clone objects', () => {
      const original = { a: 1, b: { c: 2, d: [3, 4] } };
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
      expect(cloned.b.d).not.toBe(original.b.d);
    });

    it('should clone arrays', () => {
      const original = [1, { a: 2 }, [3, 4]];
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned[1]).not.toBe(original[1]);
      expect(cloned[2]).not.toBe(original[2]);
    });

    it('should handle nested structures', () => {
      const original = {
        level1: {
          level2: {
            level3: { value: 'deep' }
          }
        }
      };
      const cloned = deepClone(original);

      expect(cloned).toEqual(original);
      expect(cloned.level1.level2.level3).not.toBe(original.level1.level2.level3);
    });
  });

  describe('shallowClone', () => {
    it('should shallow clone objects', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = shallowClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).toBe(original.b); // shallow clone shares nested objects
    });

    it('should handle empty objects', () => {
      const original = {};
      const cloned = shallowClone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
    });
  });

  describe('isEmpty', () => {
    it('should return true for empty objects', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('should return false for non-empty objects', () => {
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty({ a: undefined })).toBe(false);
      expect(isEmpty({ a: null })).toBe(false);
    });
  });

  describe('getNestedProperty', () => {
    const testObj = {
      a: {
        b: {
          c: 'value'
        }
      },
      x: null,
      y: undefined
    };

    it('should get nested property values', () => {
      expect(getNestedProperty(testObj, 'a.b.c')).toBe('value');
    });

    it('should return undefined for non-existent paths', () => {
      expect(getNestedProperty(testObj, 'a.b.d')).toBeUndefined();
      expect(getNestedProperty(testObj, 'a.x.y')).toBeUndefined();
    });

    it('should return default value when provided', () => {
      expect(getNestedProperty(testObj, 'a.b.d', 'default')).toBe('default');
    });

    it('should handle null/undefined intermediate values', () => {
      expect(getNestedProperty(testObj, 'x.something')).toBeUndefined();
      expect(getNestedProperty(testObj, 'y.something', 'default')).toBe('default');
    });

    it('should handle single-level properties', () => {
      expect(getNestedProperty(testObj, 'x')).toBe(null);
      expect(getNestedProperty(testObj, 'y')).toBeUndefined();
    });
  });

  describe('setNestedProperty', () => {
    it('should set nested property values', () => {
      const obj = {};
      setNestedProperty(obj, 'a.b.c', 'value');
      expect(obj).toEqual({ a: { b: { c: 'value' } } });
    });

    it('should overwrite existing values', () => {
      const obj = { a: { b: { c: 'old' } } };
      setNestedProperty(obj, 'a.b.c', 'new');
      expect(obj.a.b.c).toBe('new');
    });

    it('should create intermediate objects', () => {
      const obj = { a: 1 };
      setNestedProperty(obj, 'a.b.c', 'value');
      expect(obj).toEqual({ a: { b: { c: 'value' } } });
    });

    it('should handle single-level properties', () => {
      const obj = {};
      setNestedProperty(obj, 'a', 'value');
      expect(obj).toEqual({ a: 'value' });
    });
  });

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const target = { a: 1, b: { c: 2, d: 3 } };
      const source = { b: { c: 4 }, e: 5 };
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: { c: 4, d: 3 }, e: 5 });
      expect(result).not.toBe(target); // should not mutate original
    });

    it('should handle arrays by replacement', () => {
      const target = { a: [1, 2, 3] };
      const source = { a: [4, 5] };
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: [4, 5] });
    });

    it('should handle null values', () => {
      const target = { a: { b: 1 } };
      const source = { a: null };
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: null });
    });

    it('should handle empty objects', () => {
      const target = { a: 1 };
      const source = {};
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1 });
    });
  });

  describe('pick', () => {
    const testObj = { a: 1, b: 2, c: 3, d: 4 };

    it('should pick specified properties', () => {
      const result = pick(testObj, ['a', 'c']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle non-existent keys', () => {
      const result = pick(testObj, ['a', 'x' as any]);
      expect(result).toEqual({ a: 1 });
    });

    it('should handle empty key array', () => {
      const result = pick(testObj, []);
      expect(result).toEqual({});
    });

    it('should not mutate original object', () => {
      const original = { a: 1, b: 2 };
      const result = pick(original, ['a']);
      expect(original).toEqual({ a: 1, b: 2 });
      expect(result).not.toBe(original);
    });
  });

  describe('omit', () => {
    const testObj = { a: 1, b: 2, c: 3, d: 4 };

    it('should omit specified properties', () => {
      const result = omit(testObj, ['b', 'd']);
      expect(result).toEqual({ a: 1, c: 3 });
    });

    it('should handle non-existent keys', () => {
      const result = omit(testObj, ['b', 'x' as any]);
      expect(result).toEqual({ a: 1, c: 3, d: 4 });
    });

    it('should handle empty key array', () => {
      const result = omit(testObj, []);
      expect(result).toEqual(testObj);
      expect(result).not.toBe(testObj); // should still create new object
    });

    it('should not mutate original object', () => {
      const original = { a: 1, b: 2 };
      const result = omit(original, ['b']);
      expect(original).toEqual({ a: 1, b: 2 });
      expect(result).not.toBe(original);
    });
  });
});
