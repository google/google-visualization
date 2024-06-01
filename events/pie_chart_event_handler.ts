/**
 * @fileoverview ChartEventHandler implementation for a pie chart.
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

import {BrowserEvent} from '@npm//@closure/events/events';
import {EventTarget as GoogEventTarget} from '@npm//@closure/events/eventtarget';

import {ChartType} from '../common/option_types';
import {AbstractRenderer} from '../graphics/abstract_renderer';
import {OverlayArea} from '../graphics/overlay_area';
import {Token, TOKEN_SEPARATOR} from '../visualization/corechart/id_utils';
import {ChartEventHandler} from './chart_event_handler';
import {
  generateEventType,
  OperationType,
  TargetType,
} from './interaction_events';

/** ChartEventHandler implementation for a pie chart. */
export class PieChartEventHandler extends ChartEventHandler {
  /**
   * @param interactionEventTarget The target to dispatch interaction events to.
   * @param renderer Used for hanging events on chart elements and obtaining the
   *     cursor position.
   * @param overlayArea Used for hanging events on the overlay area above the
   *     chart.
   */
  constructor(
    interactionEventTarget: GoogEventTarget,
    renderer: AbstractRenderer,
    overlayArea: OverlayArea,
  ) {
    super(interactionEventTarget, renderer, overlayArea, ChartType.PIE);
  }

  detectTargetElement(event: BrowserEvent): string {
    const eventTarget = event.target as Element;
    return this.renderer.getLogicalName(eventTarget);
  }

  /**
   * @param interactionEventOperationType The operation type: HOVER_IN,
   *     HOVER_OUT, CLICK or RIGHT_CLICK.
   * @param targetElementID The target element ID.
   */
  dispatchInteractionEventForContent(
    interactionEventOperationType: OperationType,
    targetElementID: string,
  ) {
    // Split the target element ID into tokens.
    // The first token is expected to be the type, and the rest indices.
    const targetElementTokens = targetElementID.split(TOKEN_SEPARATOR);
    const targetElementType = targetElementTokens[0];

    if (targetElementType === Token.SLICE) {
      // If the slice is interactive dispatch SLICE event.
      const sliceIndex = Number(targetElementTokens[1]);
      if (sliceIndex < 0) {
        // Ignore the bogus 'other' slice.
        return;
      }
      const interactionEventType = generateEventType(
        TargetType.SERIE,
        interactionEventOperationType,
      );
      const interactionEventData = {serieIndex: sliceIndex, datumIndex: null};
      this.dispatchEvent(interactionEventType, interactionEventData);
    }
  }
}
