import { describe, it, expect } from 'vitest';
import {
  removeFirstElement,
  removeLastElement,
  arraysAlmostEqual,
  arrayMultiSlice,
  binarySearchArray,
  peekArray,
  mergeArrays,
  rangeMap,
} from './array-utils';

describe('array-utils', () => {
    describe('removeFirstElement', () => {
        it('should remove the first element', () => {
            expect(removeFirstElement([1, 2, 3, 4])).toEqual([2, 3, 4]);
            expect(removeFirstElement(['a', 'b', 'c'])).toEqual(['b', 'c']);
        });

        it('should return empty array for single element array', () => {
            expect(removeFirstElement([42])).toEqual([]);
        });

        it('should not modify original array', () => {
            const original = [1, 2, 3];
            const result = removeFirstElement(original);
            expect(original).toEqual([1, 2, 3]);
            expect(result).toEqual([2, 3]);
        });

        it('should throw for empty array', () => {
            expect(() => removeFirstElement([])).toThrow('Array cannot be empty');
        });
    });

    describe('removeLastElement', () => {
        it('should remove the last element', () => {
            expect(removeLastElement([1, 2, 3, 4])).toEqual([1, 2, 3]);
            expect(removeLastElement(['a', 'b', 'c'])).toEqual(['a', 'b']);
        });

        it('should return empty array for single element array', () => {
            expect(removeLastElement([42])).toEqual([]);
        });

        it('should not modify original array', () => {
            const original = [1, 2, 3];
            const result = removeLastElement(original);
            expect(original).toEqual([1, 2, 3]);
            expect(result).toEqual([1, 2]);
        });

        it('should throw for empty array', () => {
            expect(() => removeLastElement([])).toThrow('Array cannot be empty');
        });
    });

    describe('arraysAlmostEqual', () => {
        it('should return true for both null arrays', () => {
            expect(arraysAlmostEqual(null, null, 0.1)).toBe(true);
        });

        it('should return false if only one array is null', () => {
            expect(arraysAlmostEqual([1, 2], null, 0.1)).toBe(false);
            expect(arraysAlmostEqual(null, [1, 2], 0.1)).toBe(false);
        });

        it('should return false for arrays of different lengths', () => {
            expect(arraysAlmostEqual([1, 2], [1, 2, 3], 0.1)).toBe(false);
        });

        it('should return true for exactly equal arrays', () => {
            expect(arraysAlmostEqual([1, 2, 3], [1, 2, 3], 0.1)).toBe(true);
        });

        it('should return true for arrays within tolerance', () => {
            expect(arraysAlmostEqual([1.0, 2.0], [1.05, 2.05], 0.1)).toBe(true);
        });

        it('should return false for arrays outside tolerance', () => {
            expect(arraysAlmostEqual([1.0, 2.0], [1.2, 2.2], 0.1)).toBe(false);
        });

        it('should use custom diff function when provided', () => {
            const customDiff = (a: any, b: any) => Math.abs(a.length - b.length);
            expect(
                arraysAlmostEqual(
                    ['hello', 'world'],
                    ['hello', 'world'],
                    0.1,
                    customDiff
                )
            ).toBe(true);
            expect(
                arraysAlmostEqual(
                    ['hi', 'there'],
                    ['hello', 'world'],
                    3, // 'hi' vs 'hello' = |2-5|=3, 'there' vs 'world' = |5-5|=0, max diff is 3
                    customDiff
                )
            ).toBe(true); // length differences are within tolerance
            expect(
                arraysAlmostEqual(
                    ['hi', 'there'],
                    ['hello', 'world'],
                    2, // This should be false since max diff is 3 > 2
                    customDiff
                )
            ).toBe(false); // length differences exceed tolerance
        });

        it('should handle empty arrays', () => {
            expect(arraysAlmostEqual([], [], 0.1)).toBe(true);
        });
    });

    describe('arrayMultiSlice', () => {
        const testArray = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

        it('should handle single slice', () => {
            expect(arrayMultiSlice(testArray, 2, 5)).toEqual([2, 3, 4]);
        });

        it('should handle multiple slices', () => {
            expect(arrayMultiSlice(testArray, 1, 3, 6, 8)).toEqual([1, 2, 6, 7]);
        });

        it('should handle overlapping slices', () => {
            expect(arrayMultiSlice(testArray, 1, 4, 3, 6)).toEqual([1, 2, 3, 3, 4, 5]);
        });

        it('should handle indices beyond array bounds', () => {
            expect(arrayMultiSlice(testArray, 8, 15)).toEqual([8, 9]);
            expect(arrayMultiSlice(testArray, 15, 20)).toEqual([]);
        });

        it('should handle empty slices', () => {
            expect(arrayMultiSlice(testArray, 3, 3)).toEqual([]);
            expect(arrayMultiSlice(testArray, 5, 4)).toEqual([]); // end < start
        });

        it('should throw for odd number of arguments', () => {
            expect(() => arrayMultiSlice(testArray, 1, 2, 3)).toThrow('sliceArgs must have even number of arguments');
        });

        it('should handle no slice arguments', () => {
            expect(arrayMultiSlice(testArray)).toEqual([]);
        });
    });

    describe('binarySearchArray', () => {
        const sortedNumbers = [1, 3, 5, 7, 9, 11, 13];
        const sortedStrings = ['apple', 'banana', 'cherry', 'date'];

        it('should find existing elements', () => {
            expect(binarySearchArray(sortedNumbers, 5)).toBe(2);
            expect(binarySearchArray(sortedNumbers, 1)).toBe(0);
            expect(binarySearchArray(sortedNumbers, 13)).toBe(6);
        });

        it('should return negative insertion point for non-existing elements', () => {
            expect(binarySearchArray(sortedNumbers, 4)).toBe(-3); // should insert at index 2
            expect(binarySearchArray(sortedNumbers, 0)).toBe(-1); // should insert at index 0
            expect(binarySearchArray(sortedNumbers, 15)).toBe(-8); // should insert at index 7
        });

        it('should work with custom compare function', () => {
            const reverseCompare = (a: number, b: number) => b - a;
            const reverseSorted = [13, 11, 9, 7, 5, 3, 1];
            expect(binarySearchArray(reverseSorted, 7, reverseCompare)).toBe(3);
            expect(binarySearchArray(reverseSorted, 8, reverseCompare)).toBe(-4);
        });

        it('should work with strings', () => {
            expect(binarySearchArray(sortedStrings, 'cherry')).toBe(2);
            expect(binarySearchArray(sortedStrings, 'blueberry')).toBe(-3);
        });

        it('should handle empty array', () => {
            expect(binarySearchArray([], 5)).toBe(-1);
        });

        it('should handle single element array', () => {
            expect(binarySearchArray([5], 5)).toBe(0);
            expect(binarySearchArray([5], 3)).toBe(-1);
            expect(binarySearchArray([5], 7)).toBe(-2);
        });
    });

    describe('peekArray', () => {
        it('should return last element of array', () => {
            expect(peekArray([1, 2, 3])).toBe(3);
            expect(peekArray(['a', 'b', 'c'])).toBe('c');
            expect(peekArray([42])).toBe(42);
        });

        it('should throw for empty array', () => {
            expect(() => peekArray([])).toThrow('Array cannot be empty');
        });

        it('should not modify original array', () => {
            const original = [1, 2, 3];
            const result = peekArray(original);
            expect(original).toEqual([1, 2, 3]);
            expect(result).toBe(3);
        });
    });

    describe('mergeArrays', () => {
        it('should return null for empty arrays', () => {
            expect(mergeArrays([], [1, 2, 3])).toBeNull();
            expect(mergeArrays([1, 2, 3], [])).toBeNull();
            expect(mergeArrays([], [])).toBeNull();
        });

        it('should merge sorted arrays with same values', () => {
            const result = mergeArrays([1, 3, 5], [1, 3, 5]);
            expect(result).toHaveLength(3);
            expect(result![0]).toEqual({ value: 1, ar1: 0, ar2: 0 });
            expect(result![1]).toEqual({ value: 3, ar1: 1, ar2: 1 });
            expect(result![2]).toEqual({ value: 5, ar1: 2, ar2: 2 });
        });

        it('should merge arrays with different values', () => {
            const result = mergeArrays([1, 5], [2, 4]);
            expect(result).toHaveLength(4);
            expect(result![0]).toEqual({ value: 1, ar1: 0, ar2: 0 });
            expect(result![1]).toEqual({ value: 2, ar1: 0, ar2: 0 });
            expect(result![2]).toEqual({ value: 4, ar1: 1, ar2: 1 });
            expect(result![3]).toEqual({ value: 5, ar1: 1, ar2: 1 });
        });

        it('should work with custom getValue function', () => {
            const objects1 = [{ val: 1 }, { val: 3 }];
            const objects2 = [{ val: 2 }, { val: 4 }];
            const getValue = (obj: { val: number }) => obj.val;

            const result = mergeArrays(objects1, objects2, getValue);
            expect(result).toHaveLength(4);
            expect(result![0].value).toBe(1);
            expect(result![1].value).toBe(2);
            expect(result![2].value).toBe(3);
            expect(result![3].value).toBe(4);
        });

        it('should handle null values', () => {
            const result = mergeArrays([1, null, 5], [2, 4]);
            expect(result).not.toBeNull();
            expect(result!.some(item => item.value === null)).toBe(true);
        });

        it('should return null for null input arrays', () => {
            expect(mergeArrays(null as any, [1, 2])).toBeNull();
            expect(mergeArrays([1, 2], null as any)).toBeNull();
        });
    });

    describe('rangeMap', () => {
        it('should create array with mapped indices', () => {
            const result = rangeMap(5, (i) => i * 2);
            expect(result).toEqual([0, 2, 4, 6, 8]);
        });

        it('should handle zero length', () => {
            const result = rangeMap(0, (i) => i);
            expect(result).toEqual([]);
        });

        it('should work with string mapping', () => {
            const result = rangeMap(3, (i) => `item-${i}`);
            expect(result).toEqual(['item-0', 'item-1', 'item-2']);
        });

        it('should work with object mapping', () => {
            const result = rangeMap(3, (i) => ({ index: i, value: i * i }));
            expect(result).toEqual([
                { index: 0, value: 0 },
                { index: 1, value: 1 },
                { index: 2, value: 4 }
            ]);
        });

        it('should use provided context object', () => {
            const context = { multiplier: 3 };
            const result = rangeMap(3, function(i) { return i * this.multiplier; }, context);
            expect(result).toEqual([0, 3, 6]);
        });

        it('should handle large ranges efficiently', () => {
            const result = rangeMap(1000, (i) => i);
            expect(result).toHaveLength(1000);
            expect(result[0]).toBe(0);
            expect(result[999]).toBe(999);
        });
    });
});
