import { describe, it, expect } from 'vitest';
import { Vector2 } from 'three';
import {
  functionTangentCalculator,
  phaseTangentCalculator,
  calculateControlPoints,
  evaluateCubicBezier,
  evaluateQuadraticBezier,
  cubicBezierDerivative,
  sampleCubicBezier,
  createSmoothPath,
  cubicBezierLength,
  cubicBezierParameterAtLength,
} from './curve-utils';

describe('curve-utils', () => {
    describe('functionTangentCalculator', () => {
        it('should calculate tangent for normal case', () => {
            const vectorFromPrevious = { x: 2, y: 1 };
            const vectorToNext = { x: 3, y: 2 };
            const result = functionTangentCalculator(vectorFromPrevious, vectorToNext, 1);

            // Expected slope = (1/2 + 2/3) / 2 = (3/6 + 4/6) / 2 = 7/12
            // Expected dx = 1/3 * min(2, 3) = 2/3
            // Expected dy = dx * slope = (2/3) * (7/12) = 7/18
            expect(result.x).toBeCloseTo(2 / 3);
            expect(result.y).toBeCloseTo(7 / 18);
        });

        it('should handle zero x in first vector', () => {
            const vectorFromPrevious = { x: 0, y: 4 };
            const vectorToNext = { x: 2, y: 1 };
            const result = functionTangentCalculator(vectorFromPrevious, vectorToNext, 1);

            expect(result.x).toBe(0);
            expect(result.y).toBeCloseTo(4 / 6); // dy * smoothingFactor / 6
        });

        it('should handle zero x in second vector', () => {
            const vectorFromPrevious = { x: 2, y: 3 };
            const vectorToNext = { x: 0, y: 5 };
            const result = functionTangentCalculator(vectorFromPrevious, vectorToNext, 1);

            expect(result.x).toBe(0);
            expect(result.y).toBeCloseTo(5 / 6); // dy * smoothingFactor / 6
        });

        it('should handle both x values being zero', () => {
            const vectorFromPrevious = { x: 0, y: 2 };
            const vectorToNext = { x: 0, y: 3 };
            const result = functionTangentCalculator(vectorFromPrevious, vectorToNext, 1);

            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        it('should respect smoothing factor', () => {
            const vectorFromPrevious = { x: 3, y: 1 };
            const vectorToNext = { x: 3, y: 2 };
            const result1 = functionTangentCalculator(vectorFromPrevious, vectorToNext, 0.5);
            const result2 = functionTangentCalculator(vectorFromPrevious, vectorToNext, 1);

            expect(result1.x).toBeCloseTo(result2.x * 0.5);
            expect(result1.y).toBeCloseTo(result2.y * 0.5);
        });

        it('should handle negative x values', () => {
            const vectorFromPrevious = { x: -2, y: 1 };
            const vectorToNext = { x: -3, y: 2 };
            const result = functionTangentCalculator(vectorFromPrevious, vectorToNext, 1);

            expect(result.x).toBeLessThan(0); // Should be negative
        });
    });

    describe('phaseTangentCalculator', () => {
        it('should calculate tangent for normal vectors', () => {
            const v1 = new Vector2(3, 4); // magnitude 5
            const v2 = new Vector2(5, 12); // magnitude 13
            const result = phaseTangentCalculator(v1, v2, 1);

            expect(result).toBeInstanceOf(Vector2);
            expect(result.length()).toBeGreaterThan(0);
        });

        it('should handle zero magnitude vectors', () => {
            const v1 = new Vector2(0, 0);
            const v2 = new Vector2(3, 4);
            const result = phaseTangentCalculator(v1, v2, 1);

            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });

        it('should respect smoothing factor', () => {
            const v1 = new Vector2(1, 1);
            const v2 = new Vector2(1, 1);
            const result1 = phaseTangentCalculator(v1, v2, 0.5);
            const result2 = phaseTangentCalculator(v1, v2, 1);

            expect(result1.length()).toBeCloseTo(result2.length() * 0.5);
        });

        it('should handle equal magnitude vectors', () => {
            const v1 = new Vector2(3, 4); // magnitude 5
            const v2 = new Vector2(4, 3); // magnitude 5
            const result = phaseTangentCalculator(v1, v2, 1);

            expect(result).toBeInstanceOf(Vector2);
            expect(result.length()).toBeGreaterThan(0);
        });
    });

    describe('calculateControlPoints', () => {
        it('should calculate control points for simple line', () => {
            const points = [
                new Vector2(0, 0),
                new Vector2(1, 1),
                new Vector2(2, 2),
            ];
            const result = calculateControlPoints(points, 1, true, false, false);

            expect(result).toHaveLength(3);
            expect(result[0]).toHaveLength(2); // Two control points per point
            expect(result[1]).toHaveLength(2);
            expect(result[2]).toHaveLength(2);
        });

        it('should handle null points', () => {
            const points = [
                new Vector2(0, 0),
                null,
                new Vector2(2, 2),
            ];
            const result = calculateControlPoints(points, 1, true, false, false);

            expect(result).toHaveLength(3);
            expect(result[0]).toHaveLength(2);
            expect(result[1]).toBeNull();
            expect(result[2]).toHaveLength(2);
        });

        it('should handle closed curves', () => {
            const points = [
                new Vector2(0, 0),
                new Vector2(1, 1),
                new Vector2(0, 2),
            ];
            const result = calculateControlPoints(points, 1, false, true, false);

            expect(result).toHaveLength(3);
            // All points should have control points in a closed curve
            expect(result[0]).toHaveLength(2);
            expect(result[1]).toHaveLength(2);
            expect(result[2]).toHaveLength(2);
        });

        it('should handle single point', () => {
            const points = [new Vector2(1, 1)];
            const result = calculateControlPoints(points, 1, true, false, false);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveLength(2);
            // Control points should be the same as the original point
            expect(result[0]![0].equals(points[0])).toBe(true);
            expect(result[0]![1].equals(points[0])).toBe(true);
        });

        it('should respect smoothing factor', () => {
            const points = [
                new Vector2(0, 0),
                new Vector2(1, 1),
                new Vector2(2, 0),
            ];
            const result1 = calculateControlPoints(points, 0, true, false, false);
            const result2 = calculateControlPoints(points, 1, true, false, false);

            // With smoothing factor 0, control points should be closer to original points
            const distance1 = result1[1]![0].distanceTo(points[1]);
            const distance2 = result2[1]![0].distanceTo(points[1]);
            expect(distance1).toBeLessThan(distance2);
        });
    });

    describe('evaluateCubicBezier', () => {
        it('should return start point at t=0', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const result = evaluateCubicBezier(p0, p1, p2, p3, 0);
            expect(result.equals(p0)).toBe(true);
        });

        it('should return end point at t=1', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const result = evaluateCubicBezier(p0, p1, p2, p3, 1);
            expect(result.equals(p3)).toBe(true);
        });

        it('should interpolate at t=0.5', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(0, 1);
            const p2 = new Vector2(1, 1);
            const p3 = new Vector2(1, 0);

            const result = evaluateCubicBezier(p0, p1, p2, p3, 0.5);
            expect(result.x).toBeCloseTo(0.5);
            expect(result.y).toBeCloseTo(0.75);
        });

        it('should handle linear case', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 2);
            const p3 = new Vector2(3, 3);

            const result = evaluateCubicBezier(p0, p1, p2, p3, 0.5);
            expect(result.x).toBeCloseTo(1.5);
            expect(result.y).toBeCloseTo(1.5);
        });
    });

    describe('evaluateQuadraticBezier', () => {
        it('should return start point at t=0', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 0);

            const result = evaluateQuadraticBezier(p0, p1, p2, 0);
            expect(result.equals(p0)).toBe(true);
        });

        it('should return end point at t=1', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 0);

            const result = evaluateQuadraticBezier(p0, p1, p2, 1);
            expect(result.equals(p2)).toBe(true);
        });

        it('should interpolate at t=0.5', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 2);
            const p2 = new Vector2(2, 0);

            const result = evaluateQuadraticBezier(p0, p1, p2, 0.5);
            expect(result.x).toBeCloseTo(1);
            expect(result.y).toBeCloseTo(1);
        });
    });

    describe('cubicBezierDerivative', () => {
        it('should calculate derivative at curve endpoints', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const derivativeAtStart = cubicBezierDerivative(p0, p1, p2, p3, 0);
            const derivativeAtEnd = cubicBezierDerivative(p0, p1, p2, p3, 1);

            // At t=0, derivative should be 3*(p1-p0)
            expect(derivativeAtStart.x).toBeCloseTo(3);
            expect(derivativeAtStart.y).toBeCloseTo(3);

            // At t=1, derivative should be 3*(p3-p2)
            expect(derivativeAtEnd.x).toBeCloseTo(3);
            expect(derivativeAtEnd.y).toBeCloseTo(-3);
        });

        it('should handle horizontal tangent', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 0);
            const p2 = new Vector2(2, 0);
            const p3 = new Vector2(3, 0);

            const derivative = cubicBezierDerivative(p0, p1, p2, p3, 0.5);
            expect(derivative.x).toBeCloseTo(3);
            expect(derivative.y).toBeCloseTo(0);
        });
    });

    describe('sampleCubicBezier', () => {
        it('should generate correct number of samples', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const samples = sampleCubicBezier(p0, p1, p2, p3, 5);
            expect(samples).toHaveLength(5);
        });

        it('should include start and end points', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const samples = sampleCubicBezier(p0, p1, p2, p3, 3);
            expect(samples[0].equals(p0)).toBe(true);
            expect(samples[2].equals(p3)).toBe(true);
        });

        it('should handle single sample', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const samples = sampleCubicBezier(p0, p1, p2, p3, 1);
            expect(samples).toHaveLength(1);
            expect(samples[0].equals(p0)).toBe(true);
        });
    });

    describe('createSmoothPath', () => {
        it('should create smooth path from points and control points', () => {
            const points = [
                new Vector2(0, 0),
                new Vector2(1, 1),
                new Vector2(2, 0),
            ];
            const controlPoints = [
                [new Vector2(-0.1, -0.1), new Vector2(0.1, 0.1)],
                [new Vector2(0.9, 1.1), new Vector2(1.1, 0.9)],
                [new Vector2(1.9, 0.1), new Vector2(2.1, -0.1)],
            ];

            const path = createSmoothPath(points, controlPoints, 5);
            expect(path.length).toBeGreaterThan(points.length);
            expect(path[0].equals(points[0])).toBe(true);
        });

        it('should handle null points', () => {
            const points = [
                new Vector2(0, 0),
                null,
                new Vector2(2, 0),
            ];
            const controlPoints = [
                [new Vector2(-0.1, -0.1), new Vector2(0.1, 0.1)],
                null,
                [new Vector2(1.9, 0.1), new Vector2(2.1, -0.1)],
            ];

            const path = createSmoothPath(points, controlPoints, 5);
            // No valid consecutive pairs exist, so path should be empty
            expect(path.length).toBe(0);
        });

        it('should create straight lines when no control points available', () => {
            const points = [
                new Vector2(0, 0),
                new Vector2(1, 1),
            ];
            const controlPoints = [null, null];

            const path = createSmoothPath(points, controlPoints, 5);
            expect(path).toHaveLength(2);
            expect(path[0].equals(points[0])).toBe(true);
            expect(path[1].equals(points[1])).toBe(true);
        });

        it('should handle empty input', () => {
            const path = createSmoothPath([], [], 5);
            expect(path).toHaveLength(0);
        });
    });

    describe('cubicBezierLength', () => {
        it('should calculate length of straight line', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 0);
            const p2 = new Vector2(2, 0);
            const p3 = new Vector2(3, 0);

            const length = cubicBezierLength(p0, p1, p2, p3);
            expect(length).toBeCloseTo(3, 1); // Should be approximately 3
        });

        it('should return positive length', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const length = cubicBezierLength(p0, p1, p2, p3);
            expect(length).toBeGreaterThan(0);
        });

        it('should return zero for point curve', () => {
            const p = new Vector2(1, 1);
            const length = cubicBezierLength(p, p, p, p);
            expect(length).toBeCloseTo(0);
        });

        it('should handle different sample counts', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const length1 = cubicBezierLength(p0, p1, p2, p3, 10);
            const length2 = cubicBezierLength(p0, p1, p2, p3, 100);

            // More samples should give more accurate result
            expect(Math.abs(length1 - length2)).toBeLessThan(0.5);
        });
    });

    describe('cubicBezierParameterAtLength', () => {
        it('should return 0 for length 0', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const t = cubicBezierParameterAtLength(p0, p1, p2, p3, 0);
            expect(t).toBeCloseTo(0);
        });

        it('should return 1 for full length', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const fullLength = cubicBezierLength(p0, p1, p2, p3);
            const t = cubicBezierParameterAtLength(p0, p1, p2, p3, fullLength);
            expect(t).toBeCloseTo(1, 1);
        });

        it('should return value between 0 and 1 for partial length', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const fullLength = cubicBezierLength(p0, p1, p2, p3);
            const t = cubicBezierParameterAtLength(p0, p1, p2, p3, fullLength / 2);

            expect(t).toBeGreaterThan(0);
            expect(t).toBeLessThan(1);
        });

        it('should handle straight line case', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 0);
            const p2 = new Vector2(2, 0);
            const p3 = new Vector2(3, 0);

            const t = cubicBezierParameterAtLength(p0, p1, p2, p3, 1.5);
            expect(t).toBeCloseTo(0.5, 1);
        });

        it('should respect tolerance parameter', () => {
            const p0 = new Vector2(0, 0);
            const p1 = new Vector2(1, 1);
            const p2 = new Vector2(2, 1);
            const p3 = new Vector2(3, 0);

            const fullLength = cubicBezierLength(p0, p1, p2, p3);
            const t1 = cubicBezierParameterAtLength(p0, p1, p2, p3, fullLength / 2, 0.1);
            const t2 = cubicBezierParameterAtLength(p0, p1, p2, p3, fullLength / 2, 0.001);

            // More precise tolerance should give more accurate result
            expect(Math.abs(t1 - t2)).toBeLessThan(0.1);
        });
    });
});
