import { describe, it, expect } from 'vitest';
import {
  absNumericDiff,
  roughlyEquals,
  countRequiredDecimalPrecision,
  getExponent,
  roundToNumSignificantDigits,
  closestValueTo,
  extrapolatedClosestValueTo,
  findClosestValue,
  clamp,
  lerp,
  mapRange,
  inRange,
  degreesToRadians,
  radiansToDegrees,
} from './math-utils';

describe('math-utils', () => {
    describe('absNumericDiff', () => {
        it('should return absolute difference between two numbers', () => {
            expect(absNumericDiff(5, 3)).toBe(2);
            expect(absNumericDiff(3, 5)).toBe(2);
            expect(absNumericDiff(-5, 3)).toBe(8);
            expect(absNumericDiff(5, -3)).toBe(8);
            expect(absNumericDiff(-5, -3)).toBe(2);
        });

        it('should handle zero differences', () => {
            expect(absNumericDiff(5, 5)).toBe(0);
            expect(absNumericDiff(0, 0)).toBe(0);
            expect(absNumericDiff(-5, -5)).toBe(0);
        });

        it('should handle floating point numbers', () => {
            expect(absNumericDiff(1.5, 2.7)).toBeCloseTo(1.2);
            expect(absNumericDiff(0.1, 0.2)).toBeCloseTo(0.1);
        });
    });

    describe('roughlyEquals', () => {
        it('should return true for exactly equal numbers', () => {
            expect(roughlyEquals(5, 5)).toBe(true);
            expect(roughlyEquals(0, 0)).toBe(true);
            expect(roughlyEquals(-5, -5)).toBe(true);
        });

        it('should return true for numbers within default threshold', () => {
            expect(roughlyEquals(1.0, 1.000001)).toBe(true);
            expect(roughlyEquals(1.0, 0.999999)).toBe(true);
        });

        it('should return false for numbers outside default threshold', () => {
            expect(roughlyEquals(1.0, 1.1)).toBe(false);
            expect(roughlyEquals(1.0, 0.9)).toBe(false);
        });

        it('should use custom threshold when provided', () => {
            expect(roughlyEquals(1.0, 1.05, 0.1)).toBe(true);
            expect(roughlyEquals(1.0, 1.15, 0.1)).toBe(false);
        });

        it('should handle Infinity values', () => {
            expect(roughlyEquals(Infinity, Infinity)).toBe(true);
            expect(roughlyEquals(-Infinity, -Infinity)).toBe(true);
            expect(roughlyEquals(Infinity, -Infinity)).toBe(false);
        });

        it('should throw for negative threshold', () => {
            expect(() => roughlyEquals(1, 2, -0.1)).toThrow('threshold must be non-negative');
        });
    });

    describe('countRequiredDecimalPrecision', () => {
        it('should return 0 for zero', () => {
            expect(countRequiredDecimalPrecision(0)).toBe(0);
        });

        it('should return 0 for integers', () => {
            expect(countRequiredDecimalPrecision(7)).toBe(0);
            expect(countRequiredDecimalPrecision(100)).toBe(0);
            expect(countRequiredDecimalPrecision(-42)).toBe(0);
        });

        it('should return correct precision for decimal numbers', () => {
            expect(countRequiredDecimalPrecision(1.5)).toBe(1);
            expect(countRequiredDecimalPrecision(1.25)).toBe(2);
            expect(countRequiredDecimalPrecision(0.125)).toBe(3);
            expect(countRequiredDecimalPrecision(0.0023)).toBe(4);
        });

        it('should handle negative decimal numbers', () => {
            expect(countRequiredDecimalPrecision(-1.5)).toBe(1);
            expect(countRequiredDecimalPrecision(-0.125)).toBe(3);
        });

        it('should cap at 16 decimal places', () => {
            // Very small number that would require more than 16 decimal places
            const verySmall = 1e-20;
            expect(countRequiredDecimalPrecision(verySmall)).toBe(16);
        });
    });

    describe('getExponent', () => {
        it('should return correct exponent for powers of 10', () => {
            expect(getExponent(1)).toBe(0);
            expect(getExponent(10)).toBe(1);
            expect(getExponent(100)).toBe(2);
            expect(getExponent(1000)).toBe(3);
        });

        it('should return correct exponent for numbers between powers of 10', () => {
            expect(getExponent(5)).toBe(0);
            expect(getExponent(50)).toBe(1);
            expect(getExponent(500)).toBe(2);
        });

        it('should handle decimal numbers', () => {
            expect(getExponent(0.1)).toBe(-1);
            expect(getExponent(0.01)).toBe(-2);
            expect(getExponent(0.5)).toBe(-1);
        });

        it('should return -Infinity for zero', () => {
            expect(getExponent(0)).toBe(-Infinity);
        });

        it('should return NaN for negative numbers', () => {
            expect(getExponent(-5)).toBeNaN();
        });
    });

    describe('roundToNumSignificantDigits', () => {
        it('should return zero unchanged', () => {
            expect(roundToNumSignificantDigits(3, 0)).toBe(0);
        });

        it('should return very small numbers unchanged', () => {
            const verySmall = 1e-300;
            expect(roundToNumSignificantDigits(3, verySmall)).toBe(verySmall);
        });

        it('should round to specified significant digits', () => {
            expect(roundToNumSignificantDigits(2, 1234)).toBe(1200);
            expect(roundToNumSignificantDigits(3, 1234)).toBe(1230);
            expect(roundToNumSignificantDigits(2, 1.234)).toBe(1.2);
            expect(roundToNumSignificantDigits(3, 0.01234)).toBe(0.0123);
        });

        it('should handle negative numbers', () => {
            expect(roundToNumSignificantDigits(2, -1234)).toBe(-1200);
            expect(roundToNumSignificantDigits(3, -1.234)).toBe(-1.23);
        });

        it('should throw for invalid numSignificantDigits', () => {
            expect(() => roundToNumSignificantDigits(0, 123)).toThrow('numSignificantDigits must be > 0');
            expect(() => roundToNumSignificantDigits(-1, 123)).toThrow('numSignificantDigits must be > 0');
            expect(() => roundToNumSignificantDigits(Infinity, 123)).toThrow('numSignificantDigits must be finite');
        });
    });

    describe('closestValueTo', () => {
        const table = [
            [0, 10],
            [5, 15],
            [10, 20],
            [15, 25],
            [20, 30]
        ];

        it('should find exact matches', () => {
            expect(closestValueTo(10, table)).toBe(2);
            expect(closestValueTo(5, table)).toBe(1);
        });

        it('should find closest value when target is between values', () => {
            expect(closestValueTo(7, table)).toBe(1); // closer to 5 than 10
            expect(closestValueTo(8, table)).toBe(2); // closer to 10 than 5
        });

        it('should return 0 for values smaller than minimum', () => {
            expect(closestValueTo(-5, table)).toBe(0);
        });

        it('should return last index for values larger than maximum', () => {
            expect(closestValueTo(25, table)).toBe(4);
        });

        it('should work with different column indices', () => {
            expect(closestValueTo(18, table, 1)).toBe(2); // using second column, 18 is closest to 20 at index 2
        });

        it('should round down for exact middle values', () => {
            expect(closestValueTo(7.5, table)).toBe(1); // exactly between 5 and 10
        });
    });

    describe('extrapolatedClosestValueTo', () => {
        const table = [
            [0],
            [10],
            [12],
            [20]
        ];

        it('should use regular closestValueTo for values within table range', () => {
            const result = extrapolatedClosestValueTo(10, table);
            expect(result).toEqual([1, 10]);
        });

        it('should extrapolate for values beyond table range', () => {
            const result = extrapolatedClosestValueTo(30, table, 2);
            expect(result).toHaveLength(2);
            expect(result[0]).toBeGreaterThan(3); // virtual index beyond table
            expect(result[1]).toBeGreaterThan(20); // extrapolated value
        });

        it('should handle empty table', () => {
            const result = extrapolatedClosestValueTo(10, []);
            expect(result).toEqual([0, 10]); // Should return target value for empty table
        });

        it('should work with no repeating intervals', () => {
            const result = extrapolatedClosestValueTo(25, table, 0);
            expect(result).toHaveLength(2);
        });
    });

    describe('findClosestValue', () => {
        const sortedArray = [1, 3, 5, 7, 9, 11];

        it('should throw for empty array', () => {
            expect(() => findClosestValue([], 5)).toThrow('Array cannot be empty');
        });

        it('should return exact match when value exists', () => {
            expect(findClosestValue(sortedArray, 5)).toBe(5);
            expect(findClosestValue(sortedArray, 1)).toBe(1);
            expect(findClosestValue(sortedArray, 11)).toBe(11);
        });

        it('should return closest value when target is between values', () => {
            expect(findClosestValue(sortedArray, 4)).toBe(3); // closer to 3 than 5
            expect(findClosestValue(sortedArray, 6)).toBe(5); // closer to 5 than 7
            expect(findClosestValue(sortedArray, 8)).toBe(7); // closer to 7 than 9
        });

        it('should return first element for values smaller than minimum', () => {
            expect(findClosestValue(sortedArray, 0)).toBe(1);
            expect(findClosestValue(sortedArray, -10)).toBe(1);
        });

        it('should return last element for values larger than maximum', () => {
            expect(findClosestValue(sortedArray, 15)).toBe(11);
            expect(findClosestValue(sortedArray, 100)).toBe(11);
        });

        it('should handle single element array', () => {
            expect(findClosestValue([42], 10)).toBe(42);
            expect(findClosestValue([42], 42)).toBe(42);
            expect(findClosestValue([42], 100)).toBe(42);
        });

        it('should handle exact middle values consistently', () => {
            expect(findClosestValue(sortedArray, 4)).toBe(3); // exactly between 3 and 5
            expect(findClosestValue(sortedArray, 6)).toBe(5); // exactly between 5 and 7
        });
    });

    describe('clamp', () => {
        it('should clamp values within range', () => {
            expect(clamp(5, 0, 10)).toBe(5);
            expect(clamp(0, 0, 10)).toBe(0);
            expect(clamp(10, 0, 10)).toBe(10);
        });

        it('should clamp values below minimum', () => {
            expect(clamp(-5, 0, 10)).toBe(0);
            expect(clamp(-100, -50, 50)).toBe(-50);
        });

        it('should clamp values above maximum', () => {
            expect(clamp(15, 0, 10)).toBe(10);
            expect(clamp(100, -50, 50)).toBe(50);
        });

        it('should handle negative ranges', () => {
            expect(clamp(-5, -10, -1)).toBe(-5);
            expect(clamp(-15, -10, -1)).toBe(-10);
            expect(clamp(0, -10, -1)).toBe(-1);
        });

        it('should throw for invalid range', () => {
            expect(() => clamp(5, 10, 0)).toThrow('min must be less than or equal to max');
        });

        it('should handle floating point numbers', () => {
            expect(clamp(1.5, 0.5, 2.5)).toBe(1.5);
            expect(clamp(0.1, 0.5, 2.5)).toBe(0.5);
            expect(clamp(3.0, 0.5, 2.5)).toBe(2.5);
        });
    });

    describe('lerp', () => {
        it('should interpolate between two values', () => {
            expect(lerp(0, 10, 0.5)).toBe(5);
            expect(lerp(0, 10, 0)).toBe(0);
            expect(lerp(0, 10, 1)).toBe(10);
        });

        it('should handle negative values', () => {
            expect(lerp(-10, 10, 0.5)).toBe(0);
            expect(lerp(-5, -1, 0.5)).toBe(-3);
        });

        it('should handle values outside 0-1 range', () => {
            expect(lerp(0, 10, 1.5)).toBe(15);
            expect(lerp(0, 10, -0.5)).toBe(-5);
        });

        it('should handle floating point interpolation', () => {
            expect(lerp(1.0, 2.0, 0.25)).toBe(1.25);
            expect(lerp(1.0, 2.0, 0.75)).toBe(1.75);
        });

        it('should handle same start and end values', () => {
            expect(lerp(5, 5, 0.5)).toBe(5);
            expect(lerp(5, 5, 0)).toBe(5);
            expect(lerp(5, 5, 1)).toBe(5);
        });
    });

    describe('mapRange', () => {
        it('should map values between ranges', () => {
            expect(mapRange(5, 0, 10, 0, 100)).toBe(50);
            expect(mapRange(0, 0, 10, 0, 100)).toBe(0);
            expect(mapRange(10, 0, 10, 0, 100)).toBe(100);
        });

        it('should handle negative ranges', () => {
            expect(mapRange(0, -10, 10, 0, 100)).toBe(50);
            expect(mapRange(-5, -10, 10, 0, 100)).toBe(25);
        });

        it('should handle inverted ranges', () => {
            expect(mapRange(5, 0, 10, 100, 0)).toBe(50);
            expect(mapRange(0, 0, 10, 100, 0)).toBe(100);
            expect(mapRange(10, 0, 10, 100, 0)).toBe(0);
        });

        it('should handle zero source range', () => {
            expect(mapRange(5, 5, 5, 0, 100)).toBe(0); // Should return toMin
            expect(mapRange(5, 5, 5, 10, 20)).toBe(10);
        });

        it('should handle floating point ranges', () => {
            expect(mapRange(1.5, 1.0, 2.0, 10.0, 20.0)).toBe(15.0);
            expect(mapRange(0.25, 0, 1, -1, 1)).toBe(-0.5);
        });

        it('should handle values outside source range', () => {
            expect(mapRange(15, 0, 10, 0, 100)).toBe(150); // Extrapolation
            expect(mapRange(-5, 0, 10, 0, 100)).toBe(-50);
        });
    });

    describe('inRange', () => {
        it('should return true for values within range', () => {
            expect(inRange(5, 0, 10)).toBe(true);
            expect(inRange(0, 0, 10)).toBe(true);
            expect(inRange(10, 0, 10)).toBe(true);
        });

        it('should return false for values outside range', () => {
            expect(inRange(-1, 0, 10)).toBe(false);
            expect(inRange(11, 0, 10)).toBe(false);
        });

        it('should handle negative ranges', () => {
            expect(inRange(-5, -10, -1)).toBe(true);
            expect(inRange(-15, -10, -1)).toBe(false);
            expect(inRange(0, -10, -1)).toBe(false);
        });

        it('should handle floating point ranges', () => {
            expect(inRange(1.5, 1.0, 2.0)).toBe(true);
            expect(inRange(0.5, 1.0, 2.0)).toBe(false);
            expect(inRange(2.5, 1.0, 2.0)).toBe(false);
        });

        it('should handle single point range', () => {
            expect(inRange(5, 5, 5)).toBe(true);
            expect(inRange(4, 5, 5)).toBe(false);
            expect(inRange(6, 5, 5)).toBe(false);
        });
    });

    describe('degreesToRadians', () => {
        it('should convert common degree values', () => {
            expect(degreesToRadians(0)).toBe(0);
            expect(degreesToRadians(90)).toBeCloseTo(Math.PI / 2);
            expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
            expect(degreesToRadians(270)).toBeCloseTo(3 * Math.PI / 2);
            expect(degreesToRadians(360)).toBeCloseTo(2 * Math.PI);
        });

        it('should handle negative degrees', () => {
            expect(degreesToRadians(-90)).toBeCloseTo(-Math.PI / 2);
            expect(degreesToRadians(-180)).toBeCloseTo(-Math.PI);
        });

        it('should handle fractional degrees', () => {
            expect(degreesToRadians(45)).toBeCloseTo(Math.PI / 4);
            expect(degreesToRadians(30)).toBeCloseTo(Math.PI / 6);
            expect(degreesToRadians(60)).toBeCloseTo(Math.PI / 3);
        });

        it('should handle large degree values', () => {
            expect(degreesToRadians(720)).toBeCloseTo(4 * Math.PI);
            expect(degreesToRadians(450)).toBeCloseTo(2.5 * Math.PI);
        });
    });

    describe('radiansToDegrees', () => {
        it('should convert common radian values', () => {
            expect(radiansToDegrees(0)).toBe(0);
            expect(radiansToDegrees(Math.PI / 2)).toBeCloseTo(90);
            expect(radiansToDegrees(Math.PI)).toBeCloseTo(180);
            expect(radiansToDegrees(3 * Math.PI / 2)).toBeCloseTo(270);
            expect(radiansToDegrees(2 * Math.PI)).toBeCloseTo(360);
        });

        it('should handle negative radians', () => {
            expect(radiansToDegrees(-Math.PI / 2)).toBeCloseTo(-90);
            expect(radiansToDegrees(-Math.PI)).toBeCloseTo(-180);
        });

        it('should handle fractional radians', () => {
            expect(radiansToDegrees(Math.PI / 4)).toBeCloseTo(45);
            expect(radiansToDegrees(Math.PI / 6)).toBeCloseTo(30);
            expect(radiansToDegrees(Math.PI / 3)).toBeCloseTo(60);
        });

        it('should handle large radian values', () => {
            expect(radiansToDegrees(4 * Math.PI)).toBeCloseTo(720);
            expect(radiansToDegrees(2.5 * Math.PI)).toBeCloseTo(450);
        });

        it('should be inverse of degreesToRadians', () => {
            const degrees = [0, 30, 45, 90, 180, 270, 360, -90, -180];
            degrees.forEach(deg => {
                expect(radiansToDegrees(degreesToRadians(deg))).toBeCloseTo(deg);
            });
        });
    });
});
