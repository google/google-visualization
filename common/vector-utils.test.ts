import { describe, it, expect } from 'vitest';
import { Vector2 } from 'three';
import {
    createVec2,
    vec2Difference,
    vec2Sum,
    vec2Dot,
    vec2Cross,
    vec2Distance,
    vec2DistanceSquared,
    vec2Normalize,
    vec2Scale,
    vec2Rotate,
    vec2Angle,
    vec2AngleBetween,
    vec2Lerp,
    vec2Reflect,
    vec2Project,
    vec2ApproximatelyEqual,
    xyPairToVec2,
    vec2ToXYPair,
    vec2FromPolar,
    vec2ToPolar,
    vec2Clamp,
    vec2Perpendicular,
} from './vector-utils';

describe('vector-utils', () => {
    describe('createVec2', () => {
        it('should create a Vector2 with specified coordinates', () => {
            const v = createVec2(3, 4);
            expect(v.x).toBe(3);
            expect(v.y).toBe(4);
        });
    });

    describe('vec2Difference', () => {
        it('should calculate vector difference', () => {
            const v1 = new Vector2(5, 3);
            const v2 = new Vector2(2, 1);
            const result = vec2Difference(v1, v2);
            expect(result.x).toBe(3);
            expect(result.y).toBe(2);
        });
    });

    describe('vec2Sum', () => {
        it('should calculate vector sum', () => {
            const v1 = new Vector2(2, 3);
            const v2 = new Vector2(1, 4);
            const result = vec2Sum(v1, v2);
            expect(result.x).toBe(3);
            expect(result.y).toBe(7);
        });
    });

    describe('vec2Dot', () => {
        it('should calculate dot product', () => {
            const v1 = new Vector2(2, 3);
            const v2 = new Vector2(4, 1);
            const result = vec2Dot(v1, v2);
            expect(result).toBe(11); // 2*4 + 3*1
        });
    });

    describe('vec2Cross', () => {
        it('should calculate cross product (2D scalar)', () => {
            const v1 = new Vector2(2, 3);
            const v2 = new Vector2(4, 1);
            const result = vec2Cross(v1, v2);
            expect(result).toBe(-10); // 2*1 - 3*4
        });
    });

    describe('vec2Distance', () => {
        it('should calculate distance between vectors', () => {
            const v1 = new Vector2(0, 0);
            const v2 = new Vector2(3, 4);
            const result = vec2Distance(v1, v2);
            expect(result).toBe(5);
        });
    });

    describe('vec2DistanceSquared', () => {
        it('should calculate squared distance between vectors', () => {
            const v1 = new Vector2(0, 0);
            const v2 = new Vector2(3, 4);
            const result = vec2DistanceSquared(v1, v2);
            expect(result).toBe(25);
        });
    });

    describe('vec2Normalize', () => {
        it('should normalize vector to unit length', () => {
            const v = new Vector2(3, 4);
            const result = vec2Normalize(v);
            expect(result.length()).toBeCloseTo(1);
            expect(result.x).toBeCloseTo(0.6);
            expect(result.y).toBeCloseTo(0.8);
        });

        it('should handle zero vector', () => {
            const v = new Vector2(0, 0);
            const result = vec2Normalize(v);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });
    });

    describe('vec2Scale', () => {
        it('should scale vector by scalar', () => {
            const v = new Vector2(2, 3);
            const result = vec2Scale(v, 2);
            expect(result.x).toBe(4);
            expect(result.y).toBe(6);
        });

        it('should handle negative scaling', () => {
            const v = new Vector2(2, 3);
            const result = vec2Scale(v, -1);
            expect(result.x).toBe(-2);
            expect(result.y).toBe(-3);
        });
    });

    describe('vec2Rotate', () => {
        it('should rotate vector by 90 degrees', () => {
            const v = new Vector2(1, 0);
            const result = vec2Rotate(v, Math.PI / 2);
            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(1);
        });

        it('should rotate vector by 180 degrees', () => {
            const v = new Vector2(1, 0);
            const result = vec2Rotate(v, Math.PI);
            expect(result.x).toBeCloseTo(-1);
            expect(result.y).toBeCloseTo(0);
        });
    });

    describe('vec2Angle', () => {
        it('should return correct angle for unit vectors', () => {
            expect(vec2Angle(new Vector2(1, 0))).toBeCloseTo(0);
            expect(vec2Angle(new Vector2(0, 1))).toBeCloseTo(Math.PI / 2);
            expect(vec2Angle(new Vector2(-1, 0))).toBeCloseTo(Math.PI);
            expect(vec2Angle(new Vector2(0, -1))).toBeCloseTo(-Math.PI / 2);
        });

        it('should handle diagonal vectors', () => {
            expect(vec2Angle(new Vector2(1, 1))).toBeCloseTo(Math.PI / 4);
            expect(vec2Angle(new Vector2(-1, -1))).toBeCloseTo(-3 * Math.PI / 4);
        });
    });

    describe('vec2AngleBetween', () => {
        it('should calculate angle between perpendicular vectors', () => {
            const v1 = new Vector2(1, 0);
            const v2 = new Vector2(0, 1);
            const result = vec2AngleBetween(v1, v2);
            expect(result).toBeCloseTo(Math.PI / 2);
        });

        it('should calculate angle between parallel vectors', () => {
            const v1 = new Vector2(1, 0);
            const v2 = new Vector2(2, 0);
            const result = vec2AngleBetween(v1, v2);
            expect(result).toBeCloseTo(0);
        });

        it('should calculate angle between opposite vectors', () => {
            const v1 = new Vector2(1, 0);
            const v2 = new Vector2(-1, 0);
            const result = vec2AngleBetween(v1, v2);
            expect(result).toBeCloseTo(Math.PI);
        });
    });

    describe('vec2Lerp', () => {
        it('should interpolate between vectors', () => {
            const v1 = new Vector2(0, 0);
            const v2 = new Vector2(10, 20);
            const result = vec2Lerp(v1, v2, 0.5);
            expect(result.x).toBe(5);
            expect(result.y).toBe(10);
        });

        it('should return start vector at t=0', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(10, 20);
            const result = vec2Lerp(v1, v2, 0);
            expect(result.x).toBe(1);
            expect(result.y).toBe(2);
        });

        it('should return end vector at t=1', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(10, 20);
            const result = vec2Lerp(v1, v2, 1);
            expect(result.x).toBe(10);
            expect(result.y).toBe(20);
        });
    });

    describe('vec2Reflect', () => {
        it('should reflect vector across horizontal normal', () => {
            const v = new Vector2(1, 1);
            const normal = new Vector2(0, 1);
            const result = vec2Reflect(v, normal);
            expect(result.x).toBeCloseTo(1);
            expect(result.y).toBeCloseTo(-1);
        });

        it('should reflect vector across vertical normal', () => {
            const v = new Vector2(1, 1);
            const normal = new Vector2(1, 0);
            const result = vec2Reflect(v, normal);
            expect(result.x).toBeCloseTo(-1);
            expect(result.y).toBeCloseTo(1);
        });
    });

    describe('vec2Project', () => {
        it('should project vector onto another vector', () => {
            const v1 = new Vector2(3, 4);
            const v2 = new Vector2(1, 0);
            const result = vec2Project(v1, v2);
            expect(result.x).toBe(3);
            expect(result.y).toBe(0);
        });

        it('should handle zero vector projection', () => {
            const v1 = new Vector2(3, 4);
            const v2 = new Vector2(0, 0);
            const result = vec2Project(v1, v2);
            expect(result.x).toBe(0);
            expect(result.y).toBe(0);
        });
    });

    describe('vec2ApproximatelyEqual', () => {
        it('should return true for approximately equal vectors', () => {
            const v1 = new Vector2(1.0000001, 2.0000001);
            const v2 = new Vector2(1.0000002, 2.0000002);
            expect(vec2ApproximatelyEqual(v1, v2)).toBe(true);
        });

        it('should return false for significantly different vectors', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(1.1, 2.1);
            expect(vec2ApproximatelyEqual(v1, v2)).toBe(false);
        });

        it('should respect custom tolerance', () => {
            const v1 = new Vector2(1, 2);
            const v2 = new Vector2(1.05, 2.05);
            expect(vec2ApproximatelyEqual(v1, v2, 0.1)).toBe(true);
            expect(vec2ApproximatelyEqual(v1, v2, 0.01)).toBe(false);
        });
    });

    describe('xyPairToVec2', () => {
        it('should convert XYPair to Vector2', () => {
            const pair = { x: 3, y: 4 };
            const result = xyPairToVec2(pair);
            expect(result.x).toBe(3);
            expect(result.y).toBe(4);
            expect(result).toBeInstanceOf(Vector2);
        });
    });

    describe('vec2ToXYPair', () => {
        it('should convert Vector2 to XYPair', () => {
            const v = new Vector2(3, 4);
            const result = vec2ToXYPair(v);
            expect(result.x).toBe(3);
            expect(result.y).toBe(4);
            expect(typeof result).toBe('object');
        });
    });

    describe('vec2FromPolar', () => {
        it('should create vector from polar coordinates', () => {
            const result = vec2FromPolar(5, 0);
            expect(result.x).toBeCloseTo(5);
            expect(result.y).toBeCloseTo(0);
        });

        it('should handle 90 degree angle', () => {
            const result = vec2FromPolar(5, Math.PI / 2);
            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBeCloseTo(5);
        });

        it('should handle 45 degree angle', () => {
            const result = vec2FromPolar(Math.sqrt(2), Math.PI / 4);
            expect(result.x).toBeCloseTo(1);
            expect(result.y).toBeCloseTo(1);
        });
    });

    describe('vec2ToPolar', () => {
        it('should convert vector to polar coordinates', () => {
            const v = new Vector2(3, 4);
            const result = vec2ToPolar(v);
            expect(result.radius).toBeCloseTo(5);
            expect(result.angle).toBeCloseTo(Math.atan2(4, 3));
        });

        it('should handle unit vectors', () => {
            const v = new Vector2(1, 0);
            const result = vec2ToPolar(v);
            expect(result.radius).toBeCloseTo(1);
            expect(result.angle).toBeCloseTo(0);
        });
    });

    describe('vec2Clamp', () => {
        it('should clamp vector components within bounds', () => {
            const v = new Vector2(5, 10);
            const result = vec2Clamp(v, 0, 3, 0, 8);
            expect(result.x).toBe(3);
            expect(result.y).toBe(8);
        });

        it('should not clamp components already within bounds', () => {
            const v = new Vector2(2, 5);
            const result = vec2Clamp(v, 0, 10, 0, 10);
            expect(result.x).toBe(2);
            expect(result.y).toBe(5);
        });

        it('should clamp negative values', () => {
            const v = new Vector2(-5, -10);
            const result = vec2Clamp(v, -3, 3, -8, 8);
            expect(result.x).toBe(-3);
            expect(result.y).toBe(-8);
        });
    });

    describe('vec2Perpendicular', () => {
        it('should return perpendicular vector', () => {
            const v = new Vector2(1, 0);
            const result = vec2Perpendicular(v);
            expect(result.x).toBeCloseTo(0);
            expect(result.y).toBe(1);
        });

        it('should maintain length', () => {
            const v = new Vector2(3, 4);
            const result = vec2Perpendicular(v);
            expect(result.length()).toBeCloseTo(v.length());
        });

        it('should be perpendicular (dot product = 0)', () => {
            const v = new Vector2(3, 4);
            const result = vec2Perpendicular(v);
            expect(vec2Dot(v, result)).toBeCloseTo(0);
        });
    });
});
