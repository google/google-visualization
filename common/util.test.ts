import { describe, it, expect } from 'vitest';
import { numberOrNull } from './util';

describe('numberOrNull', () => {
  it('should return null for null input', () => {
    expect(numberOrNull(null)).toBeNull();
  });

  it('should return null for an empty string input', () => {
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
});
