/**
 * @fileoverview Define an object representing a path of segments. Each segment
 * consists of platform independent instructions on how to draw it.
 * Copyright 2011 Google Inc. All Rights Reserved.
 *
 * @license
 * Copyright 2024 Google LLC
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

import * as asserts from '@npm//@closure/asserts/asserts';

/**
 * Constructor for a PathSegments object.
 * @unrestricted
 */
export class PathSegments {
  /**
   * Array of path segments.
   */
  segments: Segment[] = [];

  /**
   * Adds a segment to the path.
   *
   * @param segment The segment to add.
   */
  addSegment(segment: Segment) {
    // The first segment must be of type 'move'.
    if (this.segments.length === 0) {
      asserts.assert(segment.type === SegmentType.MOVE);
    }

    this.segments.push(segment);
  }

  /**
   * Add a path command to move to a point.
   *
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   */
  move(x: number, y: number) {
    const segment = PathSegments.createMoveSegment(x, y);
    this.addSegment(segment);
  }

  /**
   * Add a path command to draw a straight line from the previous point to the
   * given point.
   *
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   */
  addLine(x: number, y: number) {
    const segment = PathSegments.createLineSegment(x, y);
    this.addSegment(segment);
  }

  /**
   * Add a path command to draw a cubic Bezier curve from current point to x,y
   * with x1,y1 as first control point, and x2,y2 as second control point.
   *
   * @param x1 X coordinate of first control point.
   * @param y1 Y coordinate of first control point.
   * @param x2 X coordinate of second control point.
   * @param y2 Y coordinate of second control point.
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   */
  addCurve(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ) {
    const segment = PathSegments.createCurveSegment(x1, y1, x2, y2, x, y);
    this.addSegment(segment);
  }

  /**
   * Add a path command to draw an ellipse arc.
   *
   * @param cx X coordinate of center of ellipse.
   * @param cy Y coordinate of center of ellipse.
   * @param rx Radius of ellipse on x axis.
   * @param ry Radius of ellipse on y axis.
   * @param fromAngle Starting angle for arc. Angle zero is straight
   *     up.
   * @param toAngle Ending angle for arc. Angle zero is straight up.
   * @param isClockwise Indication if drawing is clockwise or
   *                  counter-clockwise.
   */
  addArc(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    fromAngle: number,
    toAngle: number,
    isClockwise: boolean,
  ) {
    const segment = PathSegments.createArcSegment(
      cx,
      cy,
      rx,
      ry,
      fromAngle,
      toAngle,
      isClockwise,
    );
    this.addSegment(segment);
  }

  /**
   * Add path commands to draw a path of straight or curved lines from an array
   * of vertices.
   *
   * @param vertices The array of x,y
   *     coordinates.
   * @param controlPoints An
   *     optional array of control points. The outer array, if given, must be
   * the same length as the vertices array; the inner array is a pair of
   * vertices, representing the control points for a cubic Bezier curve around
   * the corresponding point in the vertices array.
   */
  extendFromVertices(
    vertices: Array<{x: number; y: number}>,
    controlPoints?: Array<Array<{x: number; y: number}>>,
  ) {
    if (vertices.length === 0) {
      return;
    }
    if (this.segments.length === 0) {
      this.move(vertices[0].x, vertices[0].y);
    } else {
      this.addLine(vertices[0].x, vertices[0].y);
    }
    if (controlPoints) {
      for (let i = 1; i < vertices.length; ++i) {
        this.addCurve(
          controlPoints[i - 1][1].x,
          controlPoints[i - 1][1].y,
          controlPoints[i][0].x,
          controlPoints[i][0].y,
          vertices[i].x,
          vertices[i].y,
        );
      }
    } else {
      for (let i = 1; i < vertices.length; ++i) {
        this.addLine(vertices[i].x, vertices[i].y);
      }
    }
  }

  /**
   * Add a path command to close the path by connecting the last point to the
   * first point.
   */
  close() {
    const segment = PathSegments.createCloseSegment();
    this.addSegment(segment);
  }

  /**
   * Creates a path segment to move to a point.
   *
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   * @return the new segment.
   */
  static createMoveSegment(x: number, y: number): Segment {
    asserts.assert(x != null);
    asserts.assert(y != null);
    const segment = {type: SegmentType.MOVE, data: {x, y}};
    return segment;
  }

  /**
   * Creates a path segment to draw a straight line from the previous point to
   * the given point.
   *
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   * @return the new segment.
   */
  static createLineSegment(x: number, y: number): Segment {
    asserts.assert(x != null);
    asserts.assert(y != null);
    const segment = {type: SegmentType.LINE, data: {x, y}};
    return segment;
  }

  /**
   * Creates a path segment to draw a cubic Bezier curve from current point to
   * x,y with x1,y1 as first control point, and x2,y2 as second control point.
   *
   * @param x1 X coordinate of first control point.
   * @param y1 Y coordinate of first control point.
   * @param x2 X coordinate of second control point.
   * @param y2 Y coordinate of second control point.
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   * @return the new segment.
   */
  static createCurveSegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): Segment {
    const segment = {type: SegmentType.CURVE, data: {x1, y1, x2, y2, x, y}};
    return segment;
  }

  /**
   * Creates a path segment to draw an ellipse arc.
   *
   * @param cx X coordinate of center of ellipse.
   * @param cy Y coordinate of center of ellipse.
   * @param rx Radius of ellipse on x axis.
   * @param ry Radius of ellipse on y axis.
   * @param fromAngle Starting angle for arc. Angle zero is straight
   *     up.
   * @param toAngle Ending angle for arc. Angle zero is straight up.
   * @param isClockwise Indication if drawing is clockwise or
   *                  counter-clockwise.
   * @return the new segment.
   */
  static createArcSegment(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    fromAngle: number,
    toAngle: number,
    isClockwise: boolean,
  ): Segment {
    const segment = {
      type: SegmentType.ARC,
      data: {cx, cy, rx, ry, fromAngle, toAngle, isClockwise},
    };
    return segment;
  }

  /**
   * Creates a path segment to close the path by connecting the last point to
   * the first point.
   *
   * @return the new segment.
   */
  static createCloseSegment(): Segment {
    const segment = {type: SegmentType.CLOSE, data: null};
    return segment;
  }

  /**
   * Creates a path from an array of coordinates.
   *
   * @param vertices The array of x,y
   *     coordinates.
   * @param isOpen Whether or not to keep the path open.
   *     Default is false.
   *
   * @return A path using the given coordinates.
   */
  static fromVertices(
    vertices: Array<{x: number; y: number}>,
    isOpen?: boolean,
  ): PathSegments {
    const path = new PathSegments();
    if (vertices.length > 0) {
      path.extendFromVertices(vertices);

      // Close the path if the optional parameter was not given or if it is
      // false.
      if (!isOpen) {
        path.close();
      }
    }
    return path;
  }
}

/**
 * Enumeration of all segment types.
 */
export enum SegmentType {
  MOVE = 'move',
  LINE = 'line',
  CURVE = 'curve',
  CLOSE = 'close',
  ARC = 'arc',
}

/**
 * A single segment in the path.
 */
export interface Segment {
  type: SegmentType;
  data: PointData | CurveData | ArcData | null;
}

/**
 * Additional data necessary to define a move segment.
 */
export interface PointData {
  x: number;
  y: number;
}

/**
 * Additional data necessary to define a curve segment.
 * See addCurve() for more details.
 */
export interface CurveData {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
}

/**
 * Additional data necessary to define an arc segment.
 * See addArc() for more details.
 */
export interface ArcData {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fromAngle: number;
  toAngle: number;
  isClockwise: boolean;
}
