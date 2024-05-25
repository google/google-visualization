/**
 * @fileoverview ChartEventHandler implementation for an axis chart.
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

import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {
  getPointSensitivityAreaRadius,
  isSeriePathBased,
} from '../visualization/corechart/chart_definition_utils';
import {
  TOKEN_PRECEDENCE,
  TOKEN_SEPARATOR,
  Token,
  generateId,
} from '../visualization/corechart/id_utils';
import {ChartEventHandler} from './chart_event_handler';

import {
  indexOf,
  peek,
} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {BrowserEvent} from '@npm//@closure/events/events';
import {EventTarget} from '@npm//@closure/events/eventtarget';
import {EventType} from '@npm//@closure/events/eventtype';
import {Coordinate} from '@npm//@closure/math/coordinate';
import {Rect} from '@npm//@closure/math/rect';
import {ChartType, FocusTarget} from '../common/option_types';
import {numberOrNull} from '../common/util';
import {TargetType, generateEventType} from '../events/interaction_events';
import * as interactionEvents from './interaction_events';

import {AbstractRenderer} from '../graphics/abstract_renderer';
import {OverlayArea} from '../graphics/overlay_area';

/** ChartEventHandler implementation for an axis chart. */
export class AxisChartEventHandler extends ChartEventHandler {
  // TODO(dlaliberte): Either store sensitivity areas of both points and
  // categories in this structure, or keep them both in the chart definition.
  /**
   * Sensitivity area of points.
   * Point logical name is used as key.
   */
  private pointSensitivityAreas: PointSensitivityAreaMap;

  /**
   * @param interactionEventTarget The target to dispatch interaction events to.
   * @param renderer Used for hanging events on chart elements and obtaining the
   *     cursor position.
   * @param overlayArea Used for hanging events on the overlay area above the
   *     chart.
   * @param chartDefinition The chart definition.
   */
  constructor(
    interactionEventTarget: EventTarget,
    renderer: AbstractRenderer,
    overlayArea: OverlayArea,
    private chartDefinition: ChartDefinition,
  ) {
    super(
      interactionEventTarget,
      renderer,
      overlayArea,
      chartDefinition.chartType,
    );

    // TODO(dlaliberte): Either store sensitivity areas of both points and
    // categories in this structure, or keep them both in the chart definition.
    /**
     * Sensitivity area of points.
     * Point logical name is used as key.
     */
    this.pointSensitivityAreas = this.createpointSensitivityAreas();
  }

  /**
   * Updates the chart definition.
   * @param chartDefinition The chart definition.
   */
  updateChartDefinition(chartDefinition: ChartDefinition) {
    this.chartDefinition = chartDefinition;
    this.pointSensitivityAreas = this.createpointSensitivityAreas();
  }

  /** @return A map of point logical names to their sensitivity areas. */
  private createpointSensitivityAreas(): PointSensitivityAreaMap {
    const chartDefinition = this.chartDefinition;
    // Currently there is no sensitivity area for bubbles, even small ones.
    if (
      chartDefinition.chartType !== ChartType.FUNCTION &&
      chartDefinition.chartType !== ChartType.SCATTER
    ) {
      return {};
    }

    const pointSensitivityAreas = {};
    // Iterate over all data points of all series and a create sensitivity area
    // for each point.
    const series = chartDefinition.series;
    for (let serieIndex = 0; serieIndex < series.length; serieIndex++) {
      const serie = series[serieIndex];
      if (!isSeriePathBased(serie)) {
        // Skip series with no point elements (bars, candlesticks etc.).
        continue;
      }
      const points = serie.points;
      for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
        const point = points[pointIndex];
        if (!point || !point.scaled || point.isNull) {
          // Skip null points.
          continue;
        }

        const pointID = generateId([Token.POINT, serieIndex, pointIndex]);
        const pointSensitivityAreaRadius = getPointSensitivityAreaRadius(
          point,
          serie,
        );
        assert(pointSensitivityAreaRadius != null);

        (pointSensitivityAreas as AnyDuringAssistedMigration)[pointID] = {
          center: point.scaled,
          radius: pointSensitivityAreaRadius,
          serieIndex,
          datumIndex: pointIndex,
        };
      }
    }
    return pointSensitivityAreas;
  }

  detectTargetElement(event: BrowserEvent): string {
    const eventTarget = event.target as Element;
    // The hovered element (visible, drawn on the canvas).
    const hoveredElement = this.renderer.getLogicalName(eventTarget);
    assert(hoveredElement != null);

    // The hovered sensitivity area (invisible, not drawn on canvas).
    const cursorPosition = this.getCursorPosition(event);
    if (!cursorPosition) {
      // If the cursor position could not be found, let the target element be
      // the entire chart.
      return Token.CHART;
    }

    let hoveredSensitivityArea =
      this.detectHoveredSensitivityArea(cursorPosition);

    if (event.type === EventType.MOUSEOUT) {
      // The target element of a MOUSEOUT event is the hovered out element or
      // sensitivity area. Note that although hoveredElement indeed holds the
      // hovered out element, hoveredSensitivityArea holds the hovered IN
      // sensitivity area. The code below updates it to hold the hovered OUT
      // sensitivity area, if any.

      // Note that we are cheating here: getHoveredElementID() does not
      // necessarily return a sensitivity area, but if it returns an element
      // then this element must be the same as hoveredElement. This is fine, as
      // this makes the code return the hovered element.
      const previouslyHoveredSensitivityArea = this.getHoveredElementID();

      if (previouslyHoveredSensitivityArea == null) {
        // MOUSEOUT is generally expected to be preceded by MOUSEOVER.
        // However, when moving from an element inside an IFrame (say a bar)
        // onto an element outside of the IFrame (such as an HTML tooltip), and
        // then from the tooltip back into the IFrame onto another element (say
        // a gridline) the following events are fired in this order:
        // 1. MOUSEOVER is fired for the tooltip upon entering it.
        // 2. MOUSEOUT is fired for the tooltip upon leaving it.
        // 3. MOUSEOUT is fired for the bar upon leaving the tooltip.
        // 4. MOUSEOVER is fired for the gridline upon leaving the tooltip.
        // Normally, we would expect the events to fire in this order: 3, 1,
        // 2, 4. When detectTargetElement is called for the 3rd event, the
        // previously hovered element is null, and we have no idea what it was
        // before that. We guess it was a DOM element and return it (if it was a
        // sensitivity area then we are lying, which may not be so dangerous as
        // we expect the 4th event to be fired soon and hopefully put things
        // straight).
        return hoveredElement;
      }

      if (hoveredSensitivityArea === previouslyHoveredSensitivityArea) {
        // No sensitivity area was hovered out.
        hoveredSensitivityArea = null;
      } else {
        // The previously hovered sensitivity area has been hovered out.
        hoveredSensitivityArea = previouslyHoveredSensitivityArea;
      }
    }

    let targetElement;
    if (hoveredSensitivityArea == null) {
      targetElement = hoveredElement;
    } else if (this.validateDetectedTargetElement(hoveredElement)) {
      // Compare the precedence of the hovered element and sensitivity area.
      const hoveredElementPrecedence =
        this.getElementPrecedence(hoveredElement);
      const hoveredSensitivityAreaPrecedence = this.getElementPrecedence(
        hoveredSensitivityArea,
      );

      targetElement =
        hoveredElementPrecedence > hoveredSensitivityAreaPrecedence
          ? hoveredElement
          : hoveredSensitivityArea;
    } else {
      targetElement = hoveredSensitivityArea;
    }

    if (this.validateDetectedTargetElement(targetElement)) {
      return targetElement;
    }
    // If the target element is invalid we would like to return the foremost
    // valid element it hides. However, having no way of discovering that
    // element, we return the chart as default.
    return Token.CHART;
  }

  /**
   * Returns the logical name of the element that the cursor currently resides
   * within its sensitivity area. If no elements are hovered it returns null.
   * See detectHoveredCategory() and detectHoveredPoint() for more information.
   * @param cursorPosition The cursor position.
   * @return The logical name of the hovered datum, or null.
   */
  private detectHoveredSensitivityArea(
    cursorPosition: Coordinate,
  ): string | null {
    // Sensitivity areas are not interactive outside the chart area.
    // We subtract 1 from each side because a MOUSEOUT DOM event is fired when
    // hovering over the edges of the chart area, and we want to be consistent.
    const chartArea = new Rect(
      Number(this.chartDefinition.chartArea.left) + 1,
      Number(this.chartDefinition.chartArea.top) + 1,
      this.chartDefinition.chartArea.width - 2,
      this.chartDefinition.chartArea.height - 2,
    );
    if (!chartArea.contains(cursorPosition)) {
      return null;
    }

    const focusTarget = this.chartDefinition.focusTarget;
    let hoveredElement = null;
    if (focusTarget.has(FocusTarget.DATUM)) {
      hoveredElement = this.detectHoveredPoint(cursorPosition);
    }

    if (hoveredElement == null && focusTarget.has(FocusTarget.CATEGORY)) {
      hoveredElement = this.detectHoveredCategory(cursorPosition);
    }

    return hoveredElement;
  }

  /**
   * Given the cursor position, return the category whose sensitivity area is
   * hovered.
   * If no category is hovered (outside the chart area for example), return
   * null.
   * @param cursorPosition The cursor position.
   * @return The logical name of the hovered category, or null if no category is
   *     hovered.
   */
  private detectHoveredCategory(cursorPosition: Coordinate): string | null {
    // Iterate over the categories and return the one that contains the cursor.
    const categories = this.chartDefinition.categories;
    for (let i = 0; i < categories.length; i++) {
      // AnyDuringAssistedMigration because:  Property 'sensitivityArea' does
      // not exist on type 'CategoryDefinition'.
      const sensitivityArea = (categories[i] as AnyDuringAssistedMigration)
        .sensitivityArea;
      if (sensitivityArea && sensitivityArea.contains(cursorPosition)) {
        return generateId([Token.CATEGORY_SENSITIVITY_AREA, i]);
      }
    }
    return null;
  }

  /**
   * Given the cursor position, return the point whose sensitivity area is
   * hovered.
   * If several points are hovered choose the one whose center is the closest to
   * the cursor position.
   * If no points are hovered it returns null.
   * @param cursorPosition The cursor position.
   * @return The logical name of the hovered point, or null if no points are
   *     hovered.
   */
  private detectHoveredPoint(cursorPosition: Coordinate): string | null {
    const x = cursorPosition.x;
    const y = cursorPosition.y;

    // The hovered point whose center is the closest to the cursor.
    let hoveredPoint = null;
    // Minimum squared distance (so far) from the cursor to the center of a
    // circle containing it.
    let minD2 = Infinity;
    for (const pointID in this.pointSensitivityAreas) {
      if (!this.pointSensitivityAreas.hasOwnProperty(pointID)) continue;
      const circle = this.pointSensitivityAreas[pointID];
      const cx = circle.center.x;
      const cy = circle.center.y;
      const r = circle.radius;

      // Optimization: first test whether the cursor resides within the square
      // bounding the circle.
      // Note: Using 'Math.abs(cx - x) <= r' seemed to be a bit slower (tested
      // on Firefox with 2000 circles).
      if (cx - x <= r && cx - x >= -r && cy - y <= r && cy - y >= -r) {
        // Now test whether the cursor is actually within the circle itself.
        const d2 = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (d2 <= r * r) {
          // Test if it is the closest circle so far.
          if (d2 <= minD2) {
            hoveredPoint = generateId([
              Token.POINT_SENSITIVITY_AREA,
              circle.serieIndex,
              circle.datumIndex,
            ]);
            minD2 = d2;
          }
        }
      }
    }
    return hoveredPoint;
  }

  /**
   * Returns whether a detected target element is valid under the given chart
   * configuration.
   * An example of an invalid detection is that of a datum when the focus target
   * is CATEGORY. This happens when hovering over the part of a point peeking
   * out of the chart area.
   * @param targetElementID The ID of the detected target element.
   * @return Whether the detected target element is valid.
   */
  private validateDetectedTargetElement(targetElementID: string): boolean {
    // TODO(dlaliberte): Consider a dictionary to map focus targets to the elements
    // they support.
    const focusTarget = this.chartDefinition.focusTarget;
    if (
      focusTarget.has(FocusTarget.CATEGORY) &&
      !focusTarget.has(FocusTarget.DATUM)
    ) {
      // Split the target element ID into tokens.
      // The first token is expected to be the type, and the rest indices.
      const targetElementTokens = targetElementID.split(TOKEN_SEPARATOR);
      const targetElementType = targetElementTokens[0];
      // Detected target element is invalid if it is a datum.
      return (
        targetElementType !== Token.BAR &&
        targetElementType !== Token.BUBBLE &&
        targetElementType !== Token.CANDLESTICK &&
        targetElementType !== Token.BOXPLOT &&
        targetElementType !== Token.POINT &&
        targetElementType !== Token.POINT_SENSITIVITY_AREA &&
        targetElementType !== Token.STEPPED_AREA_BAR
      );
    }
    return true;
  }

  /**
   * Returns the precedence of an element by its logical name.
   * @param elementLogicalName The logical name of the element.
   * @return The element precedence (greater is frontal).
   */
  private getElementPrecedence(elementLogicalName: string): number {
    const elementTokens = elementLogicalName.split(TOKEN_SEPARATOR);
    return indexOf(TOKEN_PRECEDENCE, elementTokens[0]);
  }

  /**
   * @param interactionEventOperationType The operation type: HOVER_IN,
   *     HOVER_OUT, CLICK or RIGHT_CLICK.
   * @param targetElementID The target element ID.
   */
  dispatchInteractionEventForContent(
    interactionEventOperationType: interactionEvents.OperationType,
    targetElementID: string,
  ) {
    // Split the target element ID into tokens.
    // The first token is expected to be the type, and the rest indices.
    const targetElementTokens = targetElementID.split(TOKEN_SEPARATOR);
    const targetElementType = targetElementTokens[0];

    let interactionEventType;
    let interactionEventData;
    let serieIndex;

    switch (targetElementType) {
      case Token.BAR:
      case Token.BUBBLE:
      case Token.CANDLESTICK:
      case Token.BOXPLOT:
      case Token.POINT:
      case Token.POINT_SENSITIVITY_AREA:
      case Token.STEPPED_AREA_BAR:
        // If serie is interactive dispatch DATUM event.
        serieIndex = numberOrNull(targetElementTokens[1]);
        const datumIndex = numberOrNull(targetElementTokens[2]);
        interactionEventType = generateEventType(
          TargetType.DATUM,
          interactionEventOperationType,
        );
        interactionEventData = {serieIndex, datumIndex};
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      case Token.CATEGORY_SENSITIVITY_AREA:
        // Dispatch CATEGORY event.
        const categoryIndex = numberOrNull(targetElementTokens[1]);
        interactionEventType = generateEventType(
          TargetType.CATEGORY,
          interactionEventOperationType,
        );
        interactionEventData = {serieIndex: null, datumIndex: categoryIndex};
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      case Token.ANNOTATION_TEXT:
        this.dispatchAnnotationEvent(
          interactionEventOperationType,
          targetElementTokens,
        );
        break;

      case Token.LINE:
      case Token.AREA:
        // If serie is interactive dispatch SERIE event.
        serieIndex = numberOrNull(targetElementTokens[1]);
        interactionEventType = generateEventType(
          TargetType.SERIE,
          interactionEventOperationType,
        );
        interactionEventData = {serieIndex, datumIndex: null};
        this.dispatchEvent(interactionEventType, interactionEventData);
        break;

      default:
      // An error is not expected, so we'll just ignore it for now.
      // TODO(dlaliberte): Decide whether we should throw an error.
      // throw new Error(`unexpected targetElementType
      // "${targetElementType}"`);
    }
  }

  /**
   * Dispatches an annotation related event.
   * @param operationType The operation type: HOVER_IN, HOVER_OUT, CLICK or
   *     RIGHT_CLICK.
   * @param targetElementTokens The target element ID, split up into tokens.
   */
  private dispatchAnnotationEvent(
    operationType: interactionEvents.OperationType,
    targetElementTokens: string[],
  ) {
    const interactionEventType = generateEventType(
      TargetType.ANNOTATION,
      operationType,
    );
    // Set the annotation index to null if the event is on the stem.
    const annotationIndex = numberOrNull(peek(targetElementTokens));
    let interactionEventData;
    if (targetElementTokens.length === 3) {
      // Category annotation, dispatch ANNOTATION event.
      const categoryIndex = numberOrNull(targetElementTokens[1]);
      interactionEventData = {
        serieIndex: null,
        datumIndex: categoryIndex,
        annotationIndex,
      };
    } else {
      // Datum annotation, if serie is interactive dispatch ANNOTATION event.
      const serieIndex = numberOrNull(targetElementTokens[1]);
      const datumIndex = numberOrNull(targetElementTokens[2]);
      interactionEventData = {
        serieIndex,
        datumIndex,
        annotationIndex,
      };
    }
    this.dispatchEvent(interactionEventType, interactionEventData);
  }
}

/** Data of every point sensitivity area. */
interface PointSensitivityAreaData {
  center: Coordinate;
  radius: number;
  serieIndex: number;
  datumIndex: number;
}

/** Data of every point sensitivity area. */
interface PointSensitivityAreaMap {
  [key: string]: PointSensitivityAreaData;
}
