/**
 * @fileoverview Define an object representing a path of segments. Similar to
 * PathSegments, only that each segment can have a different brush.
 * Copyright 2011 Google Inc. All Rights Reserved.
 *
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
import {Coordinate} from '@npm//@closure/math/coordinate';
import * as googMath from '@npm//@closure/math/math';
import {
  ArcData,
  PathSegments,
  Segment,
  SegmentType,
} from '../graphics/path_segments';

import {AbstractRenderer} from './abstract_renderer';
import {Brush} from './brush';

/**
 * Constructor for a PathSegments object.
 * @unrestricted
 */
export class MultiBrushPathSegments {
  /**
   * Array of path segments.
   */
  segments: MultiBrushSegment[] = [];

  /**
   * Adds a segment to be drawn with a specific brush.
   *
   * @param brush The brush to use.
   * @param segment The segment to add.
   */
  addSegment(brush: Brush | null, segment: Segment) {
    // The first segment must be of type 'move'.
    if (this.segments.length === 0) {
      asserts.assert(segment.type === SegmentType.MOVE);
    }

    this.segments.push({brush, segment});
  }

  /**
   * Add a path command to move to a point.
   *
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   */
  move(x: number, y: number) {
    const segment = PathSegments.createMoveSegment(x, y);
    this.addSegment(null, segment);
  }

  /**
   * Add a path command to draw a straight line from the previous point to the
   * given point.
   *
   * @param brush The brush to use for this segment.
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   */
  addLine(brush: Brush, x: number, y: number) {
    const segment = PathSegments.createLineSegment(x, y);
    this.addSegment(brush, segment);
  }

  /**
   * Add a path command to draw a cubic Bezier curve from current point to x,y
   * with x1,y1 as first control point, and x2,y2 as second control point.
   *
   * @param brush The brush to use for this segment.
   * @param x1 X coordinate of first control point.
   * @param y1 Y coordinate of first control point.
   * @param x2 X coordinate of second control point.
   * @param y2 Y coordinate of second control point.
   * @param x X coordinate of destination point.
   * @param y Y coordinate of destination point.
   */
  addCurve(
    brush: Brush,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ) {
    const segment = PathSegments.createCurveSegment(x1, y1, x2, y2, x, y);
    this.addSegment(brush, segment);
  }

  /**
   * Add a path command to draw an ellipse arc.
   *
   * @param brush The brush to use for this segment.
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
    brush: Brush,
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
    this.addSegment(brush, segment);
  }

  /**
   * Add a path command to close the path by connecting the last point to the
   * first point.
   *
   * @param brush The brush to use for this segment.
   */
  close(brush: Brush) {
    // When rendering a multi-brush path, we first split the path into several
    // single-brush paths which have "holes" in them.
    // Using the 'close' segment will not work as expected when there are
    // "holes", so we preemptively translate it into a 'line' segment.
    asserts.assert(this.segments.length !== 0);
    const startPos = this.segments[0].segment.data as Coordinate;
    this.addLine(brush, startPos.x, startPos.y);
  }

  /**
   * Gets the path of a given brush. If there's no path for the given brush, we
   * create a new one, and add it to 'paths' for future reference.
   *
   * @param paths The array of existing paths.
   * @param brush The brush we need a path for.
   * @return The path for the given brush.
   */
  private static getPathByBrush(paths: Path[], brush: Brush): Path {
    // Find the path for the given brush.
    for (let p = 0; p < paths.length; p++) {
      const path = paths[p];
      if (Brush.equals(brush, path.brush)) {
        return path;
      }
    }

    // Couldn't find path - create a new one.
    const path: Path = {brush, segments: new PathSegments(), endPos: null};
    paths.push(path);
    return path;
  }

  /**
   * Calculates the end position of a given path segment.
   *
   * @param segment The segment.
   * @return The end position of the segment.
   */
  private static calcSegmentEndPos(segment: Segment): Coordinate {
    switch (segment.type) {
      case SegmentType.MOVE:
      case SegmentType.LINE:
      case SegmentType.CURVE:
        const pos = segment.data as Coordinate;
        return new Coordinate(pos.x, pos.y);
      case SegmentType.ARC:
        const arc = segment.data as ArcData;

        // Calculate the end coordinate of the arc
        const toAngle = googMath.standardAngle(arc.toAngle);
        const toAngleDx = googMath.angleDx(toAngle - 90, arc.rx);
        const toAngleDy = googMath.angleDy(toAngle - 90, arc.ry);
        return new Coordinate(arc.cx + toAngleDx, arc.cy + toAngleDy);
      case SegmentType.CLOSE:
      default:
        // Don't know how and don't need to handle close segments.
        // See 'close' method for more details.
        asserts.assert(false);
        return new Coordinate(0, 0);
    }
  }

  /**
   * Builds several PathSegments objects for this multi-brush path.
   * We split the input path into several paths, one per each different brush
   * (our renderer cannot switch brushes in a single path).
   *
   * For example let's say we have a path with 2 brushes, b1 and b2:
   * "M0,0 L5,0(b1) L5,5(b2) L7,7(b2) M5,7 L0,7(b1) L0,5(b2)".
   * This function will split it into two paths:
   *   path1(b1) = "M0,0 L5,0 M5,7 L0,7".
   *   path2(b2) = "M5,0 L5,5 L7,7 M0,7 L0,5".
   *
   * @return paths The array of single-brush paths to draw.
   */
  private buildPaths(): Path[] {
    const paths: Path[] = [];
    let curPos = null;

    for (let i = 0; i < this.segments.length; i++) {
      const brushSegment = this.segments[i];
      const segment = brushSegment.segment;

      if (segment.type === SegmentType.MOVE) {
        // For 'move' segments all we need to do is keep track of the position.
        // The actual 'move' instruction will be added to the path relevant to
        // the next segment.
        curPos = MultiBrushPathSegments.calcSegmentEndPos(segment);
      } else {
        // Get the path that is relevant to this segment (according to brush).
        const brush = brushSegment.brush;
        asserts.assert(brush != null);
        const path = MultiBrushPathSegments.getPathByBrush(
          paths,
          brush as Brush,
        );

        // The first segment must be 'move', so curPos should be set by now.
        asserts.assert(curPos != null);
        if (curPos == null) {
          throw new Error('curPos should not be null');
        }

        // Make sure that the path continues from our current position.
        // Use the 'move' instruction if necessary.
        // This can happen if the last segment had a different brush, or was of
        // type 'move'.
        if (!Coordinate.equals(path.endPos, curPos)) {
          path.segments.move(curPos.x, curPos.y);
        }

        // Add the segment to the path.
        path.segments.addSegment(segment);

        // Keep track of the current position.
        curPos = path.endPos =
          MultiBrushPathSegments.calcSegmentEndPos(segment);
      }
    }

    return paths;
  }

  /**
   * Creates a DOM element for the specified paths.
   * If more than one path is given, a group element is created with a child
   * path element for each path. If there is only one path, a single path
   * element is created.
   *
   * @param renderer The renderer to use.
   * @param paths The
   *     paths.
   * @return The created element, or null if no paths are specified.
   */
  private static createPathElement(
    renderer: AbstractRenderer,
    paths: Path[],
  ): Element | null {
    if (paths.length === 0) {
      // No paths --> null.
      return null;
    } else if (paths.length === 1) {
      // Single path --> single element.
      return renderer.createPath(paths[0].segments, paths[0].brush);
    } else {
      // Multiple paths --> put under group element.
      const pathGroup = renderer.createGroup();
      for (let p = 0; p < paths.length; p++) {
        const path = paths[p];
        const pathElement = renderer.createPath(path.segments, path.brush);
        renderer.appendChild(pathGroup, pathElement);
      }
      return pathGroup.getElement();
    }
  }

  /**
   * Creates a renderable DOM element from this multi-brush path.
   * The element can be either a path element (when a single brush was used) or
   * a group element.
   *
   * @param renderer The renderer to use.
   * @return The rendered element, or null if the path is empty.
   */
  createPath(renderer: AbstractRenderer): Element | null {
    // Convert the multi brush path to several single brush paths.
    const paths = this.buildPaths();

    // Create a DOM element for the specified path.
    return MultiBrushPathSegments.createPathElement(renderer, paths);
  }

  /**
   * Derive a new single-brush path segments object from this one.
   * The new object is identical to this one, only without brush information.
   *
   * @return the newly created path segments.
   */
  toSingleBrush(): PathSegments {
    const path = new PathSegments();

    // Add this path segments to the new path.
    for (let i = 0; i < this.segments.length; i++) {
      const brushSegment = this.segments[i];
      path.addSegment(brushSegment.segment);
    }

    return path;
  }
}

/**
 * A single segment in the multi-brush path.
 */
interface MultiBrushSegment {
  brush: Brush | null;
  segment: Segment;
}

/**
 * Information about a single-brush path.
 */
interface Path {
  segments: PathSegments;
  brush: Brush;
  endPos: Coordinate | null;
}
