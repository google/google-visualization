/**
 * @fileoverview ChartEventDispatcher dispatches chart events to user.
 *
 * @license
 * Copyright 2021 Google LLC
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
import {Disposable} from '@npm//@closure/disposable/disposable';
import {ChartType} from '../common/option_types';
import * as visualizationEvents from './events';

import {ChartEventType} from './chart_event_types';
import {ChartState, FocusType} from './chart_state';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Dispatches chart events to the user, according to changes in the chart state.
 * @unrestricted
 */
export class ChartEventDispatcher extends Disposable {
  /**
   * @param eventSource The object the user listens to chart events
   *     on.
   */
  constructor(private eventSource: AnyDuringMigration) {
    super();
  }

  /**
   * Compares the previous and current states of the chart to establish which
   * events should be dispatched to user, and dispatches them.
   *
   * TODO(dlaliberte): Use a helper class to convert logical names to data table
   * indices. Then the chart type and series will no longer be necessary.
   *
   * @param previousChartState The previous chart state.
   * @param currentChartState The current chart state.
   * @param chartType The chart type.
   * @param series The series section from the chart definition.
   */
  dispatchByStateChange(
    previousChartState: ChartState, //
    currentChartState: ChartState, //
    chartType: ChartType, //
    series: AnyDuringMigration[],
  ) {
    const events = [];

    let currentFocus: FocusType | null = currentChartState.focused;
    let previousFocus: FocusType | null = previousChartState.focused;
    if (
      currentFocus.serie !== previousFocus.serie ||
      currentFocus.datum !== previousFocus.datum
    ) {
      if (previousFocus.serie != null) {
        // Dispatch mouseout event for serie / datum.
        events.push(
          this.createDatumEvent(
            ChartEventType.MOUSE_OUT,
            previousFocus.serie,
            previousFocus.datum,
            chartType,
            series,
          ),
        );
      }
      if (currentFocus.serie != null) {
        // Dispatch mouseover event for serie / datum.
        events.push(
          this.createDatumEvent(
            ChartEventType.MOUSE_OVER,
            currentFocus.serie,
            currentFocus.datum,
            chartType,
            series,
          ),
        );
      }
    }
    if (currentFocus.category !== previousFocus.category) {
      if (previousFocus.category != null) {
        // Dispatch mouseout event for category.
        const focusedCategory = previousFocus.category;
        events.push({
          type: ChartEventType.MOUSE_OUT,
          data: {'row': focusedCategory, 'column': null},
        });
      }
      if (currentFocus.category != null) {
        // Dispatch mouseover event for category.
        const focusedCategory = currentFocus.category;
        events.push({
          type: ChartEventType.MOUSE_OVER,
          data: {'row': focusedCategory, 'column': null},
        });
      }
    }

    currentFocus = currentChartState.annotations.focused;
    previousFocus = previousChartState.annotations.focused;
    if (
      previousFocus &&
      (!currentFocus ||
        currentFocus.row !== previousFocus.row ||
        currentFocus.column !== previousFocus.column)
    ) {
      // Dispatch mouseout event for annotations.
      events.push({
        type: ChartEventType.MOUSE_OUT,
        data: {'row': previousFocus.row, 'column': previousFocus.column},
      });
    }
    if (
      currentFocus &&
      (!previousFocus ||
        currentFocus.row !== previousFocus.row ||
        currentFocus.column !== previousFocus.column)
    ) {
      // Dispatch mouseover event for annotations.
      events.push({
        type: ChartEventType.MOUSE_OVER,
        data: {'row': currentFocus.row, 'column': currentFocus.column},
      });
    }

    currentFocus = currentChartState.legend.focused;
    previousFocus = previousChartState.legend.focused;
    if (currentFocus.entry !== previousFocus.entry) {
      if (previousFocus.entry != null) {
        // Dispatch mouseout event for serie.
        events.push(
          this.createDatumEvent(
            ChartEventType.MOUSE_OUT,
            previousFocus.entry,
            null,
            chartType,
            series,
          ),
        );
      }
      if (currentFocus.entry != null) {
        // Dispatch mouseover event for serie.
        events.push(
          this.createDatumEvent(
            ChartEventType.MOUSE_OVER,
            currentFocus.entry,
            null,
            chartType,
            series,
          ),
        );
      }
    }

    // Dispatch select event for serie / datum / category.
    if (!currentChartState.selected.equals(previousChartState.selected)) {
      // Note that we dispatch only one select event also when more than a
      // single element has been selected since the last time we dispatched
      // events.
      events.push({type: ChartEventType.SELECT});
    }

    // Dispatch legend pagination event.
    if (
      currentChartState.legend.currentPageIndex !==
        previousChartState.legend.currentPageIndex ||
      currentChartState.legend.totalPages !==
        previousChartState.legend.totalPages
    ) {
      events.push({
        type: ChartEventType.LEGEND_PAGINATION,
        data: {
          'currentPageIndex': currentChartState.legend.currentPageIndex,
          'totalPages': currentChartState.legend.totalPages,
        },
      });
    }

    for (const event of events) {
      this.dispatchEvent(event.type, event.data);
    }
  }

  /**
   * Dispatches an event to the user.
   * The data of the event must contain string keys, so that the user can see
   * them even when this code is obfuscated.
   * @param eventType The event to trigger.
   * @param eventData = null The data of the event.
   */
  dispatchEvent(
    eventType: ChartEventType,
    eventData: AnyDuringMigration = null,
  ) {
    asserts.assert(this.eventSource);
    visualizationEvents.trigger(this.eventSource, eventType, eventData);
  }

  /**
   * Creates a datum (or serie, depending on datumIndex) related event ready to
   * be dispatched.
   * @param eventType The type of the event.
   * @param serieIndex The index of the serie.
   * @param datumIndex The index of the datum (within the serie it
   *     belongs to) or null if the event is related to the whole serie.
   * @param chartType The chart type.
   * @param series The series section from the chart definition.
   * @return The created event.
   */
  private createDatumEvent(
    eventType: ChartEventType, //
    serieIndex: number, //
    datumIndex: number | null, //
    chartType: ChartType, //
    series: AnyDuringMigration[],
  ): {
    type: ChartEventType; //
    data: {row: number | null; column: number | null};
  } {
    const serie = series[serieIndex];
    let row;
    let column;
    if (chartType === ChartType.PIE) {
      row = serie.dataTableIdx;
      column = null;
    } else {
      row = datumIndex;
      column = serie.dataTableIdx;
    }
    return {type: eventType, data: {'row': row, 'column': column}};
  }

  override disposeInternal() {
    this.eventSource = null;
    super.disposeInternal();
  }
}
