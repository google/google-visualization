/**
 * @fileoverview Class for handling thrown interaction events.
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
import {Disposable} from '@npm//@closure/disposable/disposable';
import * as events from '@npm//@closure/events/events';
import {
  ChartType,
  FocusTarget,
  InteractivityModel,
  SelectionMode,
} from '../common/option_types';
import {Scheduler} from '../common/scheduler';
import {
  EventType,
  Event as InteractionEventsEvent,
} from '../events/interaction_events';
import {ActionsMenuDefinition} from '../tooltip/actions_menu_definer';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {Datum} from '../visualization/corechart/chart_definition_types';
import {ColumnRole} from '../visualization/corechart/serie_columns';
import {ChartEventDispatcher} from './chart_event_dispatcher';
import {ChartEventType} from './chart_event_types';
import {ChartState} from './chart_state';
import {Features} from './explorer/features';

// tslint:disable:ban-types
// tslint:disable:ban-ts-suppressions

/**
 * A class that handles interaction events.
 * It has a register method which sets its handler methods as listeners to the
 * corresponding gviz.canviz.interactionEvents.EventTypes.
 * The handler methods use the chart definition and the current chart state to
 * determine the next chart state and update it accordingly.
 * @unrestricted
 */
export class EventHandler extends Disposable {
  /**
   * The scheduler is used to make sure the callback is not called for every
   * event, but rather after a certain time period has elapsed. This is done,
   * for example, to avoid a flicker effect when hovering over many elements
   * in a short time period.
   */
  private readonly scheduler: Scheduler;

  private readonly features: Features;

  /**
   * @param chartDefinition The chart definition.
   * @param chartState The chart state.
   * @param interactionEventTarget The target of the InteractionEventsEvent.
   * @param chartEventDispatcher Used to dispatch low-level chart events (such as MOUSE_MOVE and CLICK) immediately, bypassing the scheduler mechanism.
   * @param callback The callback function to call after handling a InteractionEventsEvent.
   * @param features Takes in events to notify all interactive features of what has occurred.
   */
  constructor(
    private chartDefinition: ChartDefinition,
    private readonly chartState: ChartState,
    private readonly interactionEventTarget: events.EventTarget,
    private readonly chartEventDispatcher: ChartEventDispatcher,
    callback: () => AnyDuringMigration,
    features: Features,
  ) {
    super();

    this.scheduler = new Scheduler(callback);
    this.registerDisposable(this.scheduler);

    this.features = features;
    this.features.setScheduler(this.scheduler);

    this.registerEventHandlers();
  }

  override disposeInternal() {
    events.removeAll(this.interactionEventTarget);
    super.disposeInternal();
  }

  /**
   * Sets the chart definition.
   * @param chartDefinition The new chart definition.
   */
  setChartDefinition(chartDefinition: ChartDefinition) {
    this.chartDefinition = chartDefinition;
  }

  /** If there is a pending callback activation, cancel it. */
  cancelPendingEvents() {
    this.scheduler.stopCountdown();
  }

  /**
   * Handles a general hover-in event on the entire chart canvas (not just the
   * chart area).
   * @param event The event object.
   */
  private handleChartHoverIn(event: InteractionEventsEvent) {
    this.chartState.cursor.position = event.data.cursorPosition || null;
    this.scheduler.updateCountdown(5);
    // TODO(dlaliberte): Enqueue a general HOVER_IN ChartEvent.
  }

  /**
   * Handles a general hover-out event on the entire chart canvas (not just the
   * chart area).
   * @param event The event object.
   */
  private handleChartHoverOut(event: InteractionEventsEvent) {} // TODO(dlaliberte): Enqueue a general HOVER_OUT ChartEvent.

  /**
   * Handles a general mouse move event on the entire chart canvas (not just the
   * chart area). This causes us to fire a mouse move event with the ID of the
   * hovered target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartMouseMove(event: InteractionEventsEvent) {
    this.chartState.cursor.position = event.data.cursorPosition || null;
    this.chartEventDispatcher.dispatchEvent(ChartEventType.MOUSE_MOVE, {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
    });
  }

  /**
   * Handles the mouseup event on the entire chart canvas (not just the chart
   * area). This causes us to fire a mouseup event with the ID of the target,
   * together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartMouseUp(event: InteractionEventsEvent) {
    this.chartEventDispatcher.dispatchEvent(ChartEventType.MOUSE_UP, {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
    });
  }

  /**
   * Handles the mousedown event on the entire chart canvas (not just the chart
   * area). This causes us to fire a mousedown event with the ID of the target,
   * together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartMouseDown(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'shiftKey': event.data.shiftKey,
    };
    this.chartEventDispatcher.dispatchEvent(ChartEventType.MOUSE_DOWN, data);
    this.features.publish(
      ChartEventType.MOUSE_DOWN,
      data,
      event.data.preventDefault,
    );
  }

  /**
   * Handles the click event on the entire chart canvas (not just the chart
   * area). This causes us to fire a click event with the ID of the clicked
   * target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartClick(event: InteractionEventsEvent) {
    this.chartEventDispatcher.dispatchEvent(ChartEventType.CLICK, {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
    });
  }

  /**
   * Handles the right click event on the entire chart canvas (not just the
   * chart area). This causes us to fire a right-click event with the ID of the
   * clicked target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartRightClick(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
    };
    this.chartEventDispatcher.dispatchEvent(ChartEventType.RIGHT_CLICK, data);
    this.features.publish(
      ChartEventType.RIGHT_CLICK,
      data,
      event.data.preventDefault,
    );
  }

  /**
   * Handles the double click event on the entire chart canvas (not just the
   * chart area). This causes us to fire a double-click event with the ID of the
   * clicked target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartDblClick(event: InteractionEventsEvent) {
    this.chartEventDispatcher.dispatchEvent(ChartEventType.DBL_CLICK, {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
    });
  }

  /**
   * Handles the scroll event on the entire chart canvas (not just the chart
   * area). This causes us to fire a scroll event with the ID of the clicked
   * target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartScroll(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'wheelDelta': event.data.wheelDelta,
    };
    this.chartEventDispatcher.dispatchEvent(ChartEventType.SCROLL, data);
    this.features.publish(
      ChartEventType.SCROLL,
      data,
      event.data.preventDefault,
    );
  }

  /**
   * Handles the drag start event on the entire chart canvas (not just the chart
   * area). This causes us to fire a dragstart event with the ID of the clicked
   * target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartDragStart(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'shiftKey': event.data.shiftKey,
    };
    this.chartEventDispatcher.dispatchEvent(ChartEventType.DRAG_START, data);
    this.features.publish(ChartEventType.DRAG_START, data);
  }

  /**
   * Handles the drag event on the entire chart canvas (not just the chart
   * area). This causes us to fire a drag event with the ID of the clicked
   * target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartDrag(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'shiftKey': event.data.shiftKey,
    };
    this.chartEventDispatcher.dispatchEvent(ChartEventType.DRAG, data);
    this.features.publish(ChartEventType.DRAG, data);
  }

  /**
   * Handles the drag end event on the entire chart canvas (not just the chart
   * area). This causes us to fire a dragend event with the ID of the clicked
   * target, together with the x/y coordinates of the cursor.
   * @param event The event object.
   */
  private handleChartDragEnd(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'shiftKey': event.data.shiftKey,
    };
    this.chartEventDispatcher.dispatchEvent(ChartEventType.DRAG_END, data);
    this.features.publish(ChartEventType.DRAG_END, data);
  }

  /**
   * Handles the pinch start event on the entire chart canvas (not just the
   * chart area). This causes us to fire a pinchstart event with the ID of the
   * clicked target, together with the x/y coordinates of the cursor, as well as
   * gesture data (currently just scale).
   * @param event The event object.
   */
  private handleChartPinchStart(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'gesture': event.data.gestureDetails,
    };
    this.features.publish(
      ChartEventType.PINCH_START,
      data,
      event.data.preventDefault,
    );
  }

  /**
   * Handles the pinch change event on the entire chart canvas (not just the
   * chart area). This causes us to fire a pinchchange event with the ID of the
   * clicked target, together with the x/y coordinates of the cursor, as well as
   * gesture data (currently just scale).
   * @param event The event object.
   */
  private handleChartPinch(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'gesture': event.data.gestureDetails,
    };
    this.features.publish(
      ChartEventType.PINCH,
      data,
      event.data.preventDefault,
    );
  }

  /**
   * Handles the pinch end event on the entire chart canvas (not just the chart
   * area). This causes us to fire a pinchend event with the ID of the clicked
   * target, together with the x/y coordinates of the cursor, as well as gesture
   * data (currently just scale).
   * @param event The event object.
   */
  private handleChartPinchEnd(event: InteractionEventsEvent) {
    const data = {
      'targetID': event.data.targetID,
      'x': event.data.cursorPosition!.x,
      'y': event.data.cursorPosition!.y,
      'gesture': event.data.gestureDetails,
    };
    this.features.publish(
      ChartEventType.PINCH_END,
      data,
      event.data.preventDefault,
    );
  }

  /**
   * Handles the hover-in event on a category.
   * Marks the hovered category as focused in the chart state.
   * @param event The event object.
   */
  private handleCategoryHoverIn(event: InteractionEventsEvent) {
    const categoryIndex = event.data.datumIndex;
    this.chartState.focused.category = categoryIndex ?? null;

    this.scheduler.updateCountdown(50);
  }

  /**
   * Handles the hover-out event on a category.
   * Clears the focused category in the chart state.
   * @param event The event object.
   */
  private handleCategoryHoverOut(event: InteractionEventsEvent) {
    this.unfocusCategory();

    this.scheduler.updateCountdown(50);
  }

  /**
   * Handles the click event on a category.
   * Toggles the selection of the category in the chart state.
   * @param event The event object.
   */
  private handleCategoryClick(event: InteractionEventsEvent) {
    const chartDefinition = this.chartDefinition;

    // TODO(dlaliberte): positionAtLastClick should be removed from the chart state.
    // AxisChartInteractivityDefiner should keep a frozen copy of the cursor
    // position for internal usage.
    this.chartState.cursor.positionAtLastClick =
      this.chartState.cursor.position!.clone();

    const categoryIndex = asserts.assertNumber(event.data.datumIndex);

    const isAnySeriesInteractive = chartDefinition.series.some(
      (series) => series.enableInteractivity,
    );

    if (!isAnySeriesInteractive) {
      return;
    }

    // Toggle the selection of the category.
    const rowIndex = chartDefinition.categories[categoryIndex].dataTableIdx;
    const isSingle = chartDefinition.selectionMode === SelectionMode.SINGLE;

    // Category selection must now operate in two distinct modes:
    // 1. We select the entire category (row)
    // 2. We select all the data in a single category (cell)

    // If we have single selection, we don't really have to worry about this
    // logic, since the entire selection will be cleared before setting any new
    // selection.
    if (!isSingle && chartDefinition.focusTarget.has(FocusTarget.DATUM)) {
      // But if 'datum' is a possible selection, and the user clicked on a
      // category, we have to select each individual cell.

      const selectedColumns = new Set<number>();
      const unselectedColumns = new Set<number>();
      this.chartDefinition.series.forEach((series) => {
        const point = series.points[rowIndex];
        if (point == null || point.isNull) {
          // null points are disregarded.
          return;
        }
        const columnIndex = series.dataTableIdx;
        if (this.chartState.selected.containsCell(rowIndex, columnIndex)) {
          selectedColumns.add(columnIndex);
        } else {
          unselectedColumns.add(columnIndex);
        }
      });

      const selectedCount = selectedColumns.size;
      const unselectedCount = unselectedColumns.size;

      if (selectedCount > 0 && unselectedCount === 0) {
        // The category is selected, deselect all the items.
        selectedColumns.forEach((column) => {
          this.chartState.selected.removeCell(rowIndex, column);
        });
      } else if (unselectedCount > 0) {
        // The category is not selected, select all the items.
        unselectedColumns.forEach((column) => {
          this.chartState.selected.addCell(rowIndex, column);
        });
      }
    } else {
      this.chartState.selected.toggleRow(rowIndex, isSingle);
    }

    this.scheduler.updateCountdown(0);
  }

  /**
   * Handles the hover-in event on a legend entry.
   * Marks the legend entry as focused in the chart state.
   * @param event The event object.
   */
  private handleLegendEntryHoverIn(event: InteractionEventsEvent) {
    if (this.chartDefinition.chartType === ChartType.BUBBLE) {
      // No data table element to associate the legend entry with.
      return;
    }
    this.chartState.legend.focused.entry = event.data.legendEntryIndex ?? null;
    this.scheduler.updateCountdown(50);
  }

  /**
   * Handles the hover-out event on a legend entry.
   * Clears the focused legend entry in the chart state.
   * @param event The event object.
   */
  private handleLegendEntryHoverOut(event: InteractionEventsEvent) {
    if (this.chartDefinition.chartType === ChartType.BUBBLE) {
      // No data table element to associate the legend entry with.
      return;
    }
    this.chartState.legend.focused.entry = null;
    this.scheduler.updateCountdown(250);
  }

  /**
   * Handles the click event on a legend entry.
   * Toggles the selection of the corresponding serie in the chart state.
   * @param event The event object.
   */
  private handleLegendEntryClick(event: InteractionEventsEvent) {
    if (this.chartDefinition.chartType === ChartType.BUBBLE) {
      // No data table element to associate the legend entry with.
      return;
    }
    // TODO(dlaliberte): Select the legend entry, not the serie.
    this.toggleSerieSelection(
      asserts.assertNumber(event.data.legendEntryIndex),
    );
    this.scheduler.updateCountdown(0);
  }

  /**
   * Handles the click event on a legend previous/next button.
   * Changes the current legend entries page in the chart state.
   * @param event The event object.
   */
  private handleLegendScrollButtonClick(event: InteractionEventsEvent) {
    if (this.chartState.legend.currentPageIndex == null) {
      // If the current page index has not been initialized yet, do so here.
      this.chartState.legend.currentPageIndex =
        event.data.currentPageIndex || 0;
      this.chartState.legend.totalPages = event.data.totalPages || 0;
    }
    // Scroll according to given step.
    this.chartState.legend.currentPageIndex += event.data.scrollStep!;
    this.scheduler.updateCountdown(0);
  }

  /**
   * Handles the hover-in event on a serie.
   * Has effect only if focus target is SERIES, in which case it marks the serie
   * as focused in the chart state.
   * Note that the focus target of Pie charts is always SERIES.
   * @param event The event object.
   */
  private handleSerieHoverIn(event: InteractionEventsEvent) {
    if (this.chartDefinition.chartType === ChartType.BUBBLE) {
      // No data table element to associate the serie with.
      return;
    }
    const focusTarget = this.chartDefinition.focusTarget;
    const interactivityModel = this.chartDefinition.interactivityModel;
    if (
      focusTarget.has(FocusTarget.SERIES) ||
      interactivityModel === InteractivityModel.DIVE
    ) {
      this.chartState.focused.serie = event.data.serieIndex ?? null;
      this.scheduler.updateCountdown(50);
    }
  }

  /**
   * Handles the hover-out event on a serie.
   * Has effect only if focus target is SERIES, in which case it clears the
   * focused serie in the chart state.
   * Note that the focus target of Pie charts is always SERIES.
   * @param event The event object.
   */
  private handleSerieHoverOut(event: InteractionEventsEvent) {
    if (this.chartDefinition.chartType === ChartType.BUBBLE) {
      // No data table element to associate the serie with.
      return;
    }
    const focusTarget = this.chartDefinition.focusTarget;
    const interactivityModel = this.chartDefinition.interactivityModel;
    if (
      focusTarget.has(FocusTarget.SERIES) ||
      interactivityModel === InteractivityModel.DIVE
    ) {
      this.unfocusSerie();
      this.scheduler.updateCountdown(250);
    }
  }

  /**
   * Handles the click event on a serie.
   * Has effect only if focus target is SERIES, in which case it toggles the
   * selection of the serie in the chart state.
   * Note that the focus target of Pie charts is always SERIES.
   * @param event The event object.
   */
  private handleSerieClick(event: InteractionEventsEvent) {
    if (this.chartDefinition.chartType === ChartType.BUBBLE) {
      // No data table element to associate the serie with.
      return;
    }
    const focusTarget = this.chartDefinition.focusTarget;
    if (focusTarget.has(FocusTarget.SERIES)) {
      const serieIndex = event.data.serieIndex;
      this.toggleSerieSelection(asserts.assertNumber(serieIndex));
      this.scheduler.updateCountdown(0);
    }
  }

  /**
   * Handles the hover-in event on a remove-serie button.
   * Forwards the event to the legend entry.
   * @param event The event object.
   */
  private handleRemoveSerieButtonHoverIn(event: InteractionEventsEvent) {
    this.handleLegendEntryHoverIn(event);
  }

  /**
   * Handles the hover-out event on a remove-serie button.
   * Forwards the event to the legend entry.
   * @param event The event object.
   */
  private handleRemoveSerieButtonHoverOut(event: InteractionEventsEvent) {
    this.handleLegendEntryHoverOut(event);
  }

  /**
   * Handles the click event on a remove-serie button.
   * @param event The event object.
   */
  private handleRemoveSerieButtonClick(event: InteractionEventsEvent) {
    this.chartEventDispatcher.dispatchEvent(ChartEventType.REMOVE_SERIE, {
      'index': event.data.legendEntryIndex,
    });
  }

  /**
   * Handles the hover-in event on a data point.
   * Marks the datum as focused in the chart state.
   * @param event The event object.
   */
  private handleDatumHoverIn(event: InteractionEventsEvent) {
    const focusTarget = this.chartDefinition.focusTarget;
    if (focusTarget.has(FocusTarget.DATUM)) {
      this.chartState.focused.serie = event.data.serieIndex ?? null;
      this.chartState.focused.datum = event.data.datumIndex ?? null;
    } else if (focusTarget.has(FocusTarget.SERIES)) {
      this.handleSerieHoverIn(event);
      return;
    } else if (focusTarget.has(FocusTarget.CATEGORY)) {
      this.handleCategoryHoverIn(event);
      return;
    }
    this.scheduler.updateCountdown(50);
  }

  /**
   * Handles the hover-out event on a data point.
   * Clears the focused datum in the chart state.
   * @param event The event object.
   */
  private handleDatumHoverOut(event: InteractionEventsEvent) {
    const focusTarget = this.chartDefinition.focusTarget;
    if (focusTarget.has(FocusTarget.DATUM)) {
      this.unfocusDatum();
    } else if (focusTarget.has(FocusTarget.SERIES)) {
      this.handleSerieHoverOut(event);
      return;
    } else if (focusTarget.has(FocusTarget.CATEGORY)) {
      this.handleCategoryHoverOut(event);
      return;
    }
    this.scheduler.updateCountdown(250);
  }

  /**
   * Handles the click event on a data point.
   * Toggles the selection of the datum in the chart state.
   * @param event The event object.
   */
  private handleDatumClick(event: InteractionEventsEvent) {
    const chartDefinition = this.chartDefinition;

    if (chartDefinition.focusTarget.has(FocusTarget.DATUM)) {
      const isSingle = chartDefinition.selectionMode === SelectionMode.SINGLE;
      asserts.assertNumber(event.data.datumIndex);
      asserts.assertNumber(event.data.serieIndex);
      const datum: Datum = {
        category: event.data.datumIndex,
        serie: event.data.serieIndex,
      } as Datum;
      const serie = chartDefinition.series[datum.serie];

      if (serie.enableInteractivity) {
        if (chartDefinition.chartType === ChartType.BUBBLE) {
          this.chartState.selected.toggleRow(datum.category, isSingle);
        } else {
          // You can only select points on non-virtual series.
          if (!serie.isVirtual) {
            const cellRef = chartDefinition.getCellRefForDatum(datum);

            const focusTarget = this.chartDefinition.focusTarget;
            if (focusTarget.has(FocusTarget.DATUM)) {
              this.chartState.selected.toggleCell(
                cellRef.row,
                cellRef.column,
                isSingle,
              );
            } else if (focusTarget.has(FocusTarget.SERIES)) {
              this.chartState.selected.toggleColumn(cellRef.column, isSingle);
            }
          }
        }
      }
      this.scheduler.updateCountdown(0);
    } else if (chartDefinition.focusTarget.has(FocusTarget.SERIES)) {
      this.handleSerieClick(event);
    } else if (chartDefinition.focusTarget.has(FocusTarget.CATEGORY)) {
      this.handleCategoryClick(event);
    }
  }

  /**
   * Handles the hover-in event on an annotation.
   * Marks the annotation as focused in the chart state.
   * @param event The event object.
   */
  private handleAnnotationHoverIn(event: InteractionEventsEvent) {
    const annotationIndex = event.data.annotationIndex;
    if (annotationIndex === -1) {
      // The event was on a collapsed annotations bundle -- ignore.
      return;
    }
    // Mark the annotation as focused.
    asserts.assertNumber(event.data.datumIndex);
    asserts.assertNumber(annotationIndex);
    this.chartState.annotations.focused = {
      row: event.data.datumIndex!,
      column: this.getAnnotationColumn(
        event.data.serieIndex ?? null,
        annotationIndex!,
      ),
    };

    // When minimize usage of DOM events is true we stop the propagation of
    // mouse move events that are used to trigger focus events on datum. Because
    // of that, any datum that is behind this annotation will not be focused
    // out, so we do this manually here.
    this.unfocusDatum();
    this.scheduler.updateCountdown(50);
  }

  /**
   * Handles the hover-out event on an annotation.
   * Clears the focused annotation in the chart state.
   * @param event The event object.
   */
  private handleAnnotationHoverOut(event: InteractionEventsEvent) {
    if (event.data.annotationIndex === -1) {
      // The event was on a collapsed annotations bundle -- ignore.
      return;
    }
    this.chartState.annotations.focused = null;
    this.scheduler.updateCountdown(250);
  }

  /**
   * Handles the click event on an annotation.
   * Toggles the selection of the annotation in the chart state.
   * @param event The event object.
   */
  private handleAnnotationClick(event: InteractionEventsEvent) {
    const chartDefinition = this.chartDefinition;
    const isSingle = chartDefinition.selectionMode === SelectionMode.SINGLE;
    const datumIndex = asserts.assertNumber(event.data.datumIndex);
    const serieIndex = event.data.serieIndex ?? null;
    const annotationIndex = event.data.annotationIndex;

    if (
      serieIndex == null ||
      chartDefinition.series[serieIndex].enableInteractivity
    ) {
      if (annotationIndex === -1) {
        // The click was on a collapsed annotations bundle -- expand it, and
        // collapse the currently expanded bundle.
        this.chartState.annotations.expanded = {
          serieIndex,
          datumOrCategoryIndex: datumIndex,
        };
      } else {
        // Select the annotation cells corresponding to the serie and datum
        // index.
        asserts.assertNumber(annotationIndex);
        const column = this.getAnnotationColumn(serieIndex, annotationIndex!);
        this.chartState.selected.toggleCell(datumIndex, column, isSingle);
      }
    }

    this.scheduler.updateCountdown(0);
  }

  /**
   * Handles the hover-in event on a tooltip.
   * Marks the datum/serie/category associated with the tooltip as focused in
   * the chart state.
   * @param event The event object.
   */
  private handleTooltipHoverIn(event: InteractionEventsEvent) {}

  /**
   * Handles the hover-out event on a tooltip.
   * Clears the focused datum/serie/category associated with the tooltip in the
   * chart state.
   * @param event The event object.
   */
  private handleTooltipHoverOut(event: InteractionEventsEvent) {}

  /**
   * Handles the hover-in event on an actions menu entry.
   * Marks the actions menu entry as focused in the chart state.
   * @param event The event object.
   */
  private handleActionsMenuEntryHoverIn(event: InteractionEventsEvent) {
    this.chartState.actionsMenu.focused.entryID = event.data.entryID || null;
    this.scheduler.updateCountdown(50);
  }

  /**
   * Handles the hover-out event on an actions menu entry.
   * Clears the focused actions menu entry in the chart state.
   * @param event The event object.
   */
  private handleActionsMenuEntryHoverOut(event: InteractionEventsEvent) {
    this.chartState.actionsMenu.focused.entryID = null;
    this.scheduler.updateCountdown(250);
  }

  /**
   * Handles the click event on an actions menu entry.
   * Clears the focused actions menu entry in the chart state.
   * @param event The event object.
   */
  private handleActionsMenuEntryClick(event: InteractionEventsEvent) {
    const actionDef = this.chartState.actionsMenu
      .focused as unknown as ActionsMenuDefinition;
    const action = actionDef.action as (() => AnyDuringMigration) | undefined;
    if (action) {
      action();
    }
    this.scheduler.updateCountdown(250);
  }

  /** Handles the ready signal. */
  handleReady() {
    this.features.publish(ChartEventType.READY);
  }

  /** Clears the focused datum in the chart state. */
  private unfocusDatum() {
    this.chartState.focused.serie = null;
    this.chartState.focused.datum = null;
  }

  /** Clears the focused serie in the chart state. */
  private unfocusSerie() {
    this.chartState.focused.serie = null;
  }

  /** Clears the focused category in the chart state. */
  private unfocusCategory() {
    this.chartState.cursor.position = null;
    this.chartState.focused.category = null;
  }

  /**
   * Get the annotation column index of a specific annotation in a serie (or a
   * category if the serie index is null).
   * @param serieIndex The serie index or null (for category annotations).
   * @param annotationIndex The annotation index.
   * @return The column index of the annotation.
   */
  private getAnnotationColumn(
    serieIndex: number | null,
    annotationIndex: number,
  ): number {
    const chartDefinition = this.chartDefinition;
    let annotationColumns: number[] | null = null;
    if (serieIndex != null) {
      const serie = chartDefinition.series[serieIndex];
      annotationColumns = serie.columns[ColumnRole.ANNOTATION];
    } else {
      // Category annotation.
      for (let i = 0; i < chartDefinition.domainsColumnStructure.length; ++i) {
        const domainColumnStructure = chartDefinition.domainsColumnStructure[i];
        annotationColumns =
          domainColumnStructure.columns[ColumnRole.ANNOTATION];
      }
    }
    // This code assumes there are columns with the ANNOTATION role for the
    // given serie index.
    asserts.assert(
      annotationColumns != null && annotationIndex < annotationColumns.length,
    );
    return annotationColumns![annotationIndex];
  }

  /** Registers the event handlers of the chart. */
  private registerEventHandlers() {
    const setEventHandler = (
      eventType: AnyDuringMigration,
      eventHandler: AnyDuringMigration,
    ) => {
      events.listen(
        this.interactionEventTarget,
        eventType,
        eventHandler.bind(this),
      );
    };
    // Chart canvas
    setEventHandler(EventType.CHART_HOVER_IN, this.handleChartHoverIn);
    setEventHandler(EventType.CHART_HOVER_OUT, this.handleChartHoverOut);
    setEventHandler(EventType.CHART_MOUSE_MOVE, this.handleChartMouseMove);
    setEventHandler(EventType.CHART_MOUSE_UP, this.handleChartMouseUp);
    setEventHandler(EventType.CHART_MOUSE_DOWN, this.handleChartMouseDown);
    setEventHandler(EventType.CHART_CLICK, this.handleChartClick);
    setEventHandler(EventType.CHART_RIGHT_CLICK, this.handleChartRightClick);
    setEventHandler(EventType.CHART_DBL_CLICK, this.handleChartDblClick);
    setEventHandler(EventType.CHART_SCROLL, this.handleChartScroll);
    setEventHandler(EventType.CHART_DRAG_START, this.handleChartDragStart);
    setEventHandler(EventType.CHART_DRAG, this.handleChartDrag);
    setEventHandler(EventType.CHART_DRAG_END, this.handleChartDragEnd);
    setEventHandler(EventType.CHART_PINCH_START, this.handleChartPinchStart);
    setEventHandler(EventType.CHART_PINCH, this.handleChartPinch);
    setEventHandler(EventType.CHART_PINCH_END, this.handleChartPinchEnd);
    // Category
    setEventHandler(EventType.CATEGORY_HOVER_IN, this.handleCategoryHoverIn);
    setEventHandler(EventType.CATEGORY_HOVER_OUT, this.handleCategoryHoverOut);
    setEventHandler(EventType.CATEGORY_CLICK, this.handleCategoryClick);
    // Legend
    setEventHandler(
      EventType.LEGEND_ENTRY_HOVER_IN,
      this.handleLegendEntryHoverIn,
    );
    setEventHandler(
      EventType.LEGEND_ENTRY_HOVER_OUT,
      this.handleLegendEntryHoverOut,
    );
    setEventHandler(EventType.LEGEND_ENTRY_CLICK, this.handleLegendEntryClick);
    setEventHandler(
      EventType.LEGEND_SCROLL_BUTTON_CLICK,
      this.handleLegendScrollButtonClick,
    );
    // Serie
    setEventHandler(EventType.SERIE_HOVER_IN, this.handleSerieHoverIn);
    setEventHandler(EventType.SERIE_HOVER_OUT, this.handleSerieHoverOut);
    setEventHandler(EventType.SERIE_CLICK, this.handleSerieClick);
    setEventHandler(
      EventType.REMOVE_SERIE_BUTTON_HOVER_IN,
      this.handleRemoveSerieButtonHoverIn,
    );
    setEventHandler(
      EventType.REMOVE_SERIE_BUTTON_HOVER_OUT,
      this.handleRemoveSerieButtonHoverOut,
    );
    setEventHandler(
      EventType.REMOVE_SERIE_BUTTON_CLICK,
      this.handleRemoveSerieButtonClick,
    );
    // Datum
    setEventHandler(EventType.DATUM_HOVER_IN, this.handleDatumHoverIn);
    setEventHandler(EventType.DATUM_HOVER_OUT, this.handleDatumHoverOut);
    setEventHandler(EventType.DATUM_CLICK, this.handleDatumClick);
    // Annotation
    setEventHandler(
      EventType.ANNOTATION_HOVER_IN,
      this.handleAnnotationHoverIn,
    );
    setEventHandler(
      EventType.ANNOTATION_HOVER_OUT,
      this.handleAnnotationHoverOut,
    );
    setEventHandler(EventType.ANNOTATION_CLICK, this.handleAnnotationClick);
    // Tooltip
    setEventHandler(EventType.TOOLTIP_HOVER_IN, this.handleTooltipHoverIn);
    setEventHandler(EventType.TOOLTIP_HOVER_OUT, this.handleTooltipHoverOut);
    // Actions Menu
    setEventHandler(
      EventType.ACTIONS_MENU_ENTRY_HOVER_IN,
      this.handleActionsMenuEntryHoverIn,
    );
    setEventHandler(
      EventType.ACTIONS_MENU_ENTRY_HOVER_OUT,
      this.handleActionsMenuEntryHoverOut,
    );
    setEventHandler(
      EventType.ACTIONS_MENU_ENTRY_CLICK,
      this.handleActionsMenuEntryClick,
    );
  }

  /**
   * Toggles the selection of a given serie in the chart state.
   * Takes the chart type and the selection mode under consideration.
   * @param serieIndex The index of the selected serie.
   */
  private toggleSerieSelection(serieIndex: number) {
    const chartDefinition = this.chartDefinition;
    if (!chartDefinition.series[serieIndex].enableInteractivity) {
      return;
    }
    const isSingle = chartDefinition.selectionMode === SelectionMode.SINGLE;
    const focusTarget = chartDefinition.focusTarget;
    const dataTableIdx = chartDefinition.series[serieIndex].dataTableIdx;
    if (chartDefinition.chartType === ChartType.PIE) {
      this.chartState.selected.toggleRow(dataTableIdx, isSingle);
    } else {
      // Series selection must now operate in two distinct modes:
      // 1. We select the entire series (column)
      // 2. We select all the data in a single series (cell)

      // If we have single selection, we don't really have to worry about this
      // logic, since the entire selection will be cleared before setting any
      // new selection.
      if (!isSingle && focusTarget.has(FocusTarget.DATUM)) {
        // But if 'datum' is a possible selection, and the user clicked on a
        // series, we have to select each individual cell.

        const points = this.chartDefinition.series[serieIndex].points;

        const selectedRows = new Set<number>();
        const unselectedRows = new Set<number>();
        points.forEach(function (this: EventHandler, point, category) {
          if (point == null || point.isNull) {
            // null points are disregarded.
            return;
          }
          if (this.chartState.selected.containsCell(category, dataTableIdx)) {
            selectedRows.add(category);
          } else {
            unselectedRows.add(category);
          }
        }, this);

        const selectedCount = selectedRows.size;
        const unselectedCount = unselectedRows.size;

        if (selectedCount > 0 && unselectedCount === 0) {
          // The series is selected, deselect all the items.
          selectedRows.forEach((category) => {
            this.chartState.selected.removeCell(category, dataTableIdx);
          });
        } else if (unselectedCount > 0) {
          // The series is not selected, select all the items.
          unselectedRows.forEach((category) => {
            this.chartState.selected.addCell(category, dataTableIdx);
          });
        }
      } else {
        this.chartState.selected.toggleColumn(dataTableIdx, isSingle);
      }
    }
  }
}
