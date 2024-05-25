/**
 * @fileoverview A builder of pseudo ChartDefinition objects, which can be used
 * as the second layer of a gviz.util.LayeredObject to override the properties
 * in the base layer of a chart definition and provide visual effects when
 * interacting with the chart.
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

import {assert} from '@npm//@closure/asserts/asserts';
import {Size as GoogSize} from '@npm//@closure/math/size';
import {FocusTarget, InteractivityModel} from '../common/option_types';
import {Options} from '../common/options';
import {LegendDefinition, ScrollItems} from '../legend/legend_definition';
import {TextStyle} from '../text/text_style';
import {
  ActionsMenuDefiner,
  ActionsMenuDefinition,
} from '../tooltip/actions_menu_definer';
import {DiveTooltipBodyCreator} from '../tooltip/dive_tooltip_body_creator';
import {TooltipBodyCreator} from '../tooltip/tooltip_body_creator';
import {TooltipBodyCreatorDefault} from '../tooltip/tooltip_body_creator_default';
import {TooltipDefiner} from '../tooltip/tooltip_definer';
import {ChartDefinition} from '../visualization/corechart/chart_definition';
import {ChartState} from './chart_state';

/** Base class of chart interactivity definers. */
export abstract class ChartInteractivityDefiner {
  /** Used to add tooltips to objects in the interactivity layer. */
  protected tooltipDefiner: TooltipDefiner;

  /**
   * A ChartInteractivityDefiner takes the base layer of a chart definition and
   * a chart state, and generates the interactivity layer of the chart
   * definition. The two layers together can be used to form a
   * gviz.util.LayeredObject. The c-tor does the setting up based on the chart
   * configuration options.
   * TODO(dlaliberte): Pass a single "parsed options" parameter.
   * @param chartOptions The chart configuration options.
   * @param chartDimensions Width and height of the chart.
   * @param chartTextStyle Default text style used throughout the chart.
   * @param interactivityModel The interactivity model.
   * @param focusTarget The focus target.
   * @param actionsMenuDefiner An optional actions menu definer.
   */
  constructor(
    chartOptions: Options,
    chartDimensions: GoogSize,
    chartTextStyle: TextStyle,
    interactivityModel: InteractivityModel,
    focusTarget: Set<FocusTarget>,
    protected actionsMenuDefiner?: ActionsMenuDefiner,
  ) {
    if (
      interactivityModel !== InteractivityModel.DIVE &&
      !this.actionsMenuDefiner
    ) {
      this.actionsMenuDefiner = new ActionsMenuDefiner(
        chartOptions,
        chartTextStyle,
      );
    } else if (this.actionsMenuDefiner != null) {
      this.actionsMenuDefiner.updateOptions(chartOptions, chartTextStyle);
    }

    const tooltipBodyCreator = this.createTooltipBodyCreator(
      chartOptions,
      chartTextStyle,
      interactivityModel,
      focusTarget,
    );

    this.tooltipDefiner = new TooltipDefiner(
      chartOptions,
      tooltipBodyCreator,
      chartDimensions,
    );
  }

  /**
   * Gets the actions menu definer or undefined if one does not exist.
   * @return The actions menu definer.
   */
  getActionsMenuDefiner(): ActionsMenuDefiner | undefined {
    return this.actionsMenuDefiner;
  }

  /**
   * Takes the base layer of a chart definition and a chart state, and returns
   * the interactivity layer of the chart definition. The two layers together
   * can be used to form a gviz.util.LayeredObject.
   *
   * @param chartDefinition The base layer of the chart definition.
   * @param chartState The state will induce which properties of the base layer should be overridden.
   * @return The interactivity layer of the chart definition.
   */
  generateInteractivityLayer(
    chartDefinition: ChartDefinition,
    chartState: ChartState,
  ): ChartDefinition {
    const interactivityLayer: ChartDefinition = {} as ChartDefinition;

    // Legend scrolling is dealt the same way in Axis and Pie charts.
    if (chartState.legend.currentPageIndex != null) {
      this.calcLegendScrolling(chartDefinition, chartState, interactivityLayer);
    }

    // Allow the implementing class to extend the interactivity layer.
    this.extendInteractivityLayer(
      chartDefinition,
      chartState,
      interactivityLayer,
    );

    return interactivityLayer;
  }

  /**
   * Adds or modifies an action with the specified ID.
   * @param action The action definition.
   */
  setAction(action: ActionsMenuDefinition) {
    this.actionsMenuDefiner && this.actionsMenuDefiner.setEntry(action);
  }

  /**
   * Gets the action with the specified ID.
   * @param action The action definition.
   * @return The action definition or undefined.
   */
  getAction(action: string): ActionsMenuDefinition | undefined {
    if (this.actionsMenuDefiner) {
      return this.actionsMenuDefiner.getAction(action);
    }
    return undefined;
  }

  /**
   * Removes the action with the given action ID.
   * @param action The action ID that should be removed.
   */
  removeAction(action: string) {
    if (this.actionsMenuDefiner) {
      this.actionsMenuDefiner.removeEntry(action);
    }
  }

  abstract extendInteractivityLayer(
    chartDefinition: ChartDefinition,
    chartState: ChartState,
    interactivityLayer: ChartDefinition,
  ): void;

  abstract equalChartStates(
    chartState1: ChartState,
    chartState2: ChartState,
  ): boolean;

  /**
   * Factory method for creating a TooltipBodyCreator suitable for the
   * interactivity model.
   * @param chartOptions The chart configuration options.
   * @param chartTextStyle Default text style used throughout the chart.
   * @param interactivityModel The interactivity model.
   * @param focusTarget The focus target.
   * @return A tooltip body creator.
   */
  private createTooltipBodyCreator(
    chartOptions: Options,
    chartTextStyle: TextStyle,
    interactivityModel: InteractivityModel,
    focusTarget: Set<FocusTarget>,
  ): TooltipBodyCreator {
    if (interactivityModel === InteractivityModel.DIVE) {
      return new DiveTooltipBodyCreator(
        chartOptions,
        chartTextStyle,
        focusTarget,
      );
    }
    return new TooltipBodyCreatorDefault(
      chartOptions,
      chartTextStyle,
      focusTarget,
      this.actionsMenuDefiner,
    );
  }

  /**
   * Fills the interactivity layer to reflect changes incurring from scrolling
   * the legend.
   *
   * @param chartDefinition The base layer of the chart definition.
   * @param chartState The state will induce which properties of the base layer should be overridden.
   * @param interactivityLayer The interactivity layer of the chart definition.
   */
  private calcLegendScrolling(
    chartDefinition: ChartDefinition,
    chartState: ChartState,
    interactivityLayer: ChartDefinition,
  ) {
    interactivityLayer.legend =
      interactivityLayer.legend || ({} as LegendDefinition);
    const legendDefinition = chartDefinition.legend as LegendDefinition;

    // Update the current entry page.
    assert(typeof chartState.legend.currentPageIndex === 'number');
    const currentPageIndex = chartState.legend.currentPageIndex!;
    interactivityLayer.legend.currentPage =
      legendDefinition.pages![currentPageIndex];

    // Create the page index text block.
    // Only the page index text changes. The format is <current>/<total>.
    const interactivePageIndexText = `${currentPageIndex + 1}/${
      legendDefinition.pages!.length
    }`;
    const interactivePageIndexTextBlock = {
      text: interactivePageIndexText,
      lines: {0: {text: interactivePageIndexText}},
    };

    // Create the buttons.
    // Only the activity and the brush change.

    const previousButton = legendDefinition.scrollItems!.previousButton;
    const hasPrevious = currentPageIndex > 0;
    const interactivePreviousButton = {
      brush: hasPrevious
        ? previousButton.brushes.active
        : previousButton.brushes.inactive,
      active: hasPrevious,
    };

    const nextButton = legendDefinition.scrollItems!.nextButton;
    const hasNext = currentPageIndex < legendDefinition.pages!.length - 1;
    const interactiveNextButton = {
      brush: hasNext ? nextButton.brushes.active : nextButton.brushes.inactive,
      active: hasNext,
    };

    // Update the scroll items.
    interactivityLayer.legend.scrollItems = {
      previousButton: interactivePreviousButton,
      nextButton: interactiveNextButton,
      pageIndexTextBlock: interactivePageIndexTextBlock,
    } as unknown as ScrollItems;
  }
}
