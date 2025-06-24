import { describe, it, expect } from 'vitest';
import { Vector2 } from 'three';
import {
  piecewiseLinearInterpolation,
  binarySearch,
  binarySearchArray,
  lerp,
  inverseLerp,
  clamp,
  smoothstep,
  bilinearInterpolation,
  catmullRomInterpolation,
  mapRange,
} from './interpolation-utils';

describe('interpolation-utils', () => {
  describe('piecewiseLinearInterpolation', () => {
    it('should interpolate between two points', () => {
      const coordinates = [new Vector2(0, 0), new Vector2(2, 4)];

      const result = piecewiseLinearInterpolation(coordinates, 1, false);
      expect(result).toBe(2); // Linear interpolation: y = 2x
    });

    it('should return exact value at coordinate points', () => {
      const coordinates = [
        new Vector2(0, 1),
        new Vector2(1, 3),
        new Vector2(2, 5),
      ];

      expect(piecewiseLinearInterpolation(coordinates, 0, false)).toBe(1);
      expect(piecewiseLinearInterpolation(coordinates, 1, false)).toBe(3);
      expect(piecewiseLinearInterpolation(coordinates, 2, false)).toBe(5);
    });

    it('should return null for x outside range', () => {
      const coordinates = [new Vector2(1, 2), new Vector2(3, 6)];

      expect(piecewiseLinearInterpolation(coordinates, 0, false)).toBeNull();
      expect(piecewiseLinearInterpolation(coordinates, 4, false)).toBeNull();
    });

    it('should handle null coordinates when interpolateNulls is false', () => {
      const coordinates = [new Vector2(0, 0), null, new Vector2(2, 4)];

      // Should not interpolate across the null
      expect(piecewiseLinearInterpolation(coordinates, 1, false)).toBeNull();
    });

    it('should handle null coordinates when interpolateNulls is true', () => {
      const coordinates = [new Vector2(0, 0), null, new Vector2(2, 4)];

      // Should interpolate ignoring the null
      const result = piecewiseLinearInterpolation(coordinates, 1, true);
      expect(result).toBe(2);
    });

    it('should handle empty coordinates array', () => {
      expect(piecewiseLinearInterpolation([], 1, false)).toBeNull();
    });

    it('should handle single coordinate', () => {
      const coordinates = [new Vector2(1, 5)];

      expect(piecewiseLinearInterpolation(coordinates, 1, false)).toBe(5);
      expect(piecewiseLinearInterpolation(coordinates, 0, false)).toBeNull();
    });

    it('should handle multiple segments', () => {
      const coordinates = [
        new Vector2(0, 0),
        new Vector2(1, 2),
        new Vector2(3, 2),
        new Vector2(4, 6),
      ];

      expect(piecewiseLinearInterpolation(coordinates, 0.5, false)).toBe(1);
      expect(piecewiseLinearInterpolation(coordinates, 2, false)).toBe(2);
      expect(piecewiseLinearInterpolation(coordinates, 3.5, false)).toBe(4);
    });

    it('should handle infinite x values', () => {
      const coordinates = [new Vector2(0, 0), new Vector2(1, 1)];

      expect(
        piecewiseLinearInterpolation(coordinates, Infinity, false)
      ).toBeNull();
      expect(
        piecewiseLinearInterpolation(coordinates, -Infinity, false)
      ).toBeNull();
    });
  });

  describe('binarySearch', () => {
    it('should find existing element', () => {
      const arr = [1, 3, 5, 7, 9];
      const compareFn = (target: number, element: number) => target - element;

      expect(binarySearch(arr, 5, compareFn)).toBe(2);
      expect(binarySearch(arr, 1, compareFn)).toBe(0);
      expect(binarySearch(arr, 9, compareFn)).toBe(4);
    });

    it('should return negative insertion point for missing element', () => {
      const arr = [1, 3, 5, 7, 9];
      const compareFn = (target: number, element: number) => target - element;

      expect(binarySearch(arr, 4, compareFn)).toBe(-3); // Should insert at index 2
      expect(binarySearch(arr, 0, compareFn)).toBe(-1); // Should insert at index 0
      expect(binarySearch(arr, 10, compareFn)).toBe(-6); // Should insert at index 5
    });

    it('should handle empty array', () => {
      const arr: number[] = [];
      const compareFn = (target: number, element: number) => target - element;

      expect(binarySearch(arr, 5, compareFn)).toBe(-1);
    });

    it('should handle single element array', () => {
      const arr = [5];
      const compareFn = (target: number, element: number) => target - element;

      expect(binarySearch(arr, 5, compareFn)).toBe(0);
      expect(binarySearch(arr, 3, compareFn)).toBe(-1);
      expect(binarySearch(arr, 7, compareFn)).toBe(-2);
    });

    it('should find lowest index for duplicates', () => {
      const arr = [1, 3, 3, 3, 5];
      const compareFn = (target: number, element: number) => target - element;

      expect(binarySearch(arr, 3, compareFn)).toBe(1); // Lowest index of 3
    });

    it('should work with different types', () => {
      const arr = [
        { id: 1, name: 'a' },
        { id: 3, name: 'b' },
        { id: 5, name: 'c' },
      ];
      const compareFn = (target: number, element: { id: number }) =>
        target - element.id;

      expect(binarySearch(arr, 3, compareFn)).toBe(1);
      expect(binarySearch(arr, 4, compareFn)).toBe(-3);
    });
  });

  describe('binarySearchArray', () => {
    it('should work with default comparison', () => {
      const arr = [1, 3, 5, 7, 9];

      expect(binarySearchArray(arr, 5)).toBe(2);
      expect(binarySearchArray(arr, 4)).toBe(-3);
    });

    it('should work with custom comparison', () => {
      const arr = [9, 7, 5, 3, 1]; // Descending order
      const compareFn = (a: number, b: number) => b - a; // Reverse comparison

      expect(binarySearchArray(arr, 5, compareFn)).toBe(2);
      expect(binarySearchArray(arr, 6, compareFn)).toBe(-3);
    });
  });

  describe('lerp', () => {
    it('should interpolate between two values', () => {
      expect(lerp(0, 10, 0)).toBe(0);
      expect(lerp(0, 10, 1)).toBe(10);
      expect(lerp(0, 10, 0.5)).toBe(5);
      expect(lerp(0, 10, 0.25)).toBe(2.5);
    });

    it('should handle negative values', () => {
      expect(lerp(-5, 5, 0.5)).toBe(0);
      expect(lerp(-10, -5, 0.5)).toBe(-7.5);
    });

    it('should extrapolate outside 0-1 range', () => {
      expect(lerp(0, 10, 2)).toBe(20);
      expect(lerp(0, 10, -0.5)).toBe(-5);
    });
  });

  describe('inverseLerp', () => {
    it('should find parameter for given value', () => {
      expect(inverseLerp(0, 10, 5)).toBe(0.5);
      expect(inverseLerp(0, 10, 0)).toBe(0);
      expect(inverseLerp(0, 10, 10)).toBe(1);
      expect(inverseLerp(0, 10, 2.5)).toBe(0.25);
    });

    it('should handle same start and end values', () => {
      expect(inverseLerp(5, 5, 5)).toBe(0);
      expect(inverseLerp(5, 5, 10)).toBe(0);
    });

    it('should handle negative ranges', () => {
      expect(inverseLerp(-10, 10, 0)).toBe(0.5);
      expect(inverseLerp(-5, -2, -3.5)).toBe(0.5);
    });
  });

  describe('clamp', () => {
    it('should clamp values within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle edge cases', () => {
      expect(clamp(0, 0, 10)).toBe(0);
      expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should work with negative ranges', () => {
      expect(clamp(-5, -10, -1)).toBe(-5);
      expect(clamp(-15, -10, -1)).toBe(-10);
      expect(clamp(5, -10, -1)).toBe(-1);
    });
  });

  describe('smoothstep', () => {
    it('should return smooth interpolation', () => {
      expect(smoothstep(0, 1, 0)).toBe(0);
      expect(smoothstep(0, 1, 1)).toBe(1);
      expect(smoothstep(0, 1, 0.5)).toBe(0.5);
    });

    it('should be smoother than linear interpolation', () => {
      const linear = 0.25;
      const smooth = smoothstep(0, 1, 0.25);

      // Smoothstep should be less than linear at 0.25
      expect(smooth).toBeLessThan(linear);
      expect(smooth).toBeCloseTo(0.15625);
    });

    it('should clamp input values', () => {
      expect(smoothstep(0, 1, -0.5)).toBe(0);
      expect(smoothstep(0, 1, 1.5)).toBe(1);
    });

    it('should work with different ranges', () => {
      expect(smoothstep(10, 20, 15)).toBe(0.5);
      expect(smoothstep(-5, 5, 0)).toBe(0.5);
    });
  });

  describe('bilinearInterpolation', () => {
    it('should interpolate in 2D', () => {
      // Unit square with values at corners
      const result = bilinearInterpolation(
        0,
        1,
        0,
        1, // x0, x1, y0, y1
        0,
        1,
        2,
        3, // q00, q01, q10, q11
        0.5,
        0.5 // x, y
      );

      expect(result).toBe(1.5); // Average of all corner values
    });

    it('should return corner values at corners', () => {
      expect(bilinearInterpolation(0, 1, 0, 1, 10, 20, 30, 40, 0, 0)).toBe(10);
      expect(bilinearInterpolation(0, 1, 0, 1, 10, 20, 30, 40, 0, 1)).toBe(20);
      expect(bilinearInterpolation(0, 1, 0, 1, 10, 20, 30, 40, 1, 0)).toBe(30);
      expect(bilinearInterpolation(0, 1, 0, 1, 10, 20, 30, 40, 1, 1)).toBe(40);
    });

    it('should interpolate along edges', () => {
      const result = bilinearInterpolation(
        0,
        2,
        0,
        2,
        0,
        0,
        4,
        4,
        1,
        0 // Middle of bottom edge
      );

      expect(result).toBe(2); // Halfway between 0 and 4
    });
  });

  describe('catmullRomInterpolation', () => {
    it('should return start point at t=0', () => {
      const result = catmullRomInterpolation(0, 1, 2, 3, 0);
      expect(result).toBe(1);
    });

    it('should return end point at t=1', () => {
      const result = catmullRomInterpolation(0, 1, 2, 3, 1);
      expect(result).toBe(2);
    });

    it('should interpolate smoothly', () => {
      const result = catmullRomInterpolation(0, 1, 2, 3, 0.5);
      expect(result).toBeCloseTo(1.5);
    });

    it('should handle uniform spacing', () => {
      // Points at 0, 1, 2, 3 should give smooth curve
      const result = catmullRomInterpolation(0, 1, 2, 3, 0.5);
      expect(result).toBeGreaterThan(1);
      expect(result).toBeLessThan(2);
    });
  });

  describe('mapRange', () => {
    it('should map between ranges', () => {
      expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
      expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
      expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
    });

    it('should handle negative ranges', () => {
      expect(mapRange(0, -10, 10, 0, 100)).toBe(50);
      expect(mapRange(-5, -10, 10, 0, 100)).toBe(25);
    });

    it('should handle inverted ranges', () => {
      expect(mapRange(2, 0, 10, 100, 0)).toBe(80);
      expect(mapRange(0, 0, 10, 100, 0)).toBe(100);
      expect(mapRange(10, 0, 10, 100, 0)).toBe(0);
    });

    it('should handle zero-width source range', () => {
      expect(mapRange(5, 5, 5, 0, 100)).toBe(0); // Should return toMin
      expect(mapRange(5, 5, 5, 10, 20)).toBe(10);
    });

    it('should extrapolate beyond source range', () => {
      expect(mapRange(15, 0, 10, 0, 100)).toBe(150);
      expect(mapRange(-5, 0, 10, 0, 100)).toBe(-50);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle NaN values gracefully', () => {
      expect(lerp(0, 10, NaN)).toBeNaN();
      expect(clamp(NaN, 0, 10)).toBeNaN();
      expect(smoothstep(0, 1, NaN)).toBeNaN();
    });

    it('should handle Infinity values', () => {
      expect(lerp(0, Infinity, 0.5)).toBe(Infinity);
      expect(clamp(Infinity, 0, 10)).toBe(10);
      expect(clamp(-Infinity, 0, 10)).toBe(0);
    });

    it('should handle very small differences in coordinates', () => {
      const coordinates = [
        new Vector2(0, 0),
        new Vector2(1e-10, 1e-10),
        new Vector2(1, 1),
      ];

      const result = piecewiseLinearInterpolation(coordinates, 0.5, false);
      expect(result).toBeCloseTo(0.5, 5);
    });

    it('should handle duplicate x coordinates', () => {
      const coordinates = [
        new Vector2(0, 0),
        new Vector2(1, 5),
        new Vector2(1, 10), // Same x as previous
        new Vector2(2, 20),
      ];

      // Should return the first matching y value
      expect(piecewiseLinearInterpolation(coordinates, 1, false)).toBe(5);
    });

    it('should handle unsorted coordinates gracefully', () => {
      const coordinates = [
        new Vector2(2, 20),
        new Vector2(0, 0),
        new Vector2(1, 10),
      ];

      // Binary search assumes sorted data, so this might not work as expected
      // but shouldn't crash
      const result = piecewiseLinearInterpolation(coordinates, 1, false);
      expect(typeof result).toBe('number');
    });
  });

  describe('performance and precision', () => {
    it('should handle large arrays efficiently', () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i);
      const compareFn = (target: number, element: number) => target - element;

      const start = performance.now();
      const result = binarySearch(largeArray, 5000, compareFn);
      const end = performance.now();

      expect(result).toBe(5000);
      expect(end - start).toBeLessThan(10); // Should be very fast
    });

    it('should maintain precision with floating point numbers', () => {
      const a = 0.1;
      const b = 0.2;
      const result = lerp(a, b, 0.5);

      expect(result).toBeCloseTo(0.15, 10);
    });

    it('should handle very large coordinate arrays', () => {
      const coordinates = Array.from({ length: 1000 }, (_, i) =>
        new Vector2(i, i * 2)
      );

      const result = piecewiseLinearInterpolation(coordinates, 500.5, false);
      expect(result).toBeCloseTo(1001, 5);
    });
  });

  describe('mathematical properties', () => {
    it('should satisfy lerp identity properties', () => {
      const a = 5;
      const b = 15;

      // lerp(a, b, 0) = a
      expect(lerp(a, b, 0)).toBe(a);

      // lerp(a, b, 1) = b
      expect(lerp(a, b, 1)).toBe(b);

      // lerp(a, a, t) = a for any t
      expect(lerp(a, a, 0.7)).toBe(a);
    });

    it('should satisfy inverse lerp properties', () => {
      const a = 10;
      const b = 20;
      const value = 15;

      const t = inverseLerp(a, b, value);
      const reconstructed = lerp(a, b, t);

      expect(reconstructed).toBeCloseTo(value);
    });

    it('should satisfy smoothstep monotonicity', () => {
      const values = [0, 0.25, 0.5, 0.75, 1];
      const results = values.map(v => smoothstep(0, 1, v));

      // Results should be monotonically increasing
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
      }
    });

    it('should satisfy bilinear interpolation corner properties', () => {
      const q00 = 1, q01 = 2, q10 = 3, q11 = 4;

      // All corners should return exact values
      expect(bilinearInterpolation(0, 1, 0, 1, q00, q01, q10, q11, 0, 0)).toBe(q00);
      expect(bilinearInterpolation(0, 1, 0, 1, q00, q01, q10, q11, 0, 1)).toBe(q01);
      expect(bilinearInterpolation(0, 1, 0, 1, q00, q01, q10, q11, 1, 0)).toBe(q10);
      expect(bilinearInterpolation(0, 1, 0, 1, q00, q01, q10, q11, 1, 1)).toBe(q11);
    });

    it('should satisfy Catmull-Rom continuity', () => {
      // At t=0 and t=1, should return the middle control points
      expect(catmullRomInterpolation(0, 1, 2, 3, 0)).toBe(1);
      expect(catmullRomInterpolation(0, 1, 2, 3, 1)).toBe(2);

      // Should be smooth (no sudden jumps)
      const t1 = 0.4;
      const t2 = 0.6;
      const v1 = catmullRomInterpolation(0, 1, 2, 3, t1);
      const v2 = catmullRomInterpolation(0, 1, 2, 3, t2);

      expect(Math.abs(v2 - v1)).toBeLessThan(1); // Reasonable continuity
    });
  });
});
