/**
 * @fileoverview A base class for all visualizations.
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

import {Disposable} from '@npm//@closure/disposable/disposable';
import {Promise as GoogPromise} from '@npm//@closure/promise/promise';
import {Resolver} from '@npm//@closure/promise/resolver';
import * as style from '@npm//@closure/style/style';
import {AnyCallbackWrapper, AsyncHelper} from '../common/async_helper';
import {ErrorHandler} from '../common/error_handler';
import {Options} from '../common/options';
import {AbstractDataTable} from '../data/abstract_datatable';
import * as datautils from '../data/datautils';
import {validateContainer} from '../dom/dom';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * The default visualization width, if not specified otherwise.
 */
const DEFAULT_WIDTH = 400;

/**
 * The default visualization height, if not specified otherwise.
 */
const DEFAULT_HEIGHT = 200;

/**
 * Base class for all visualizations and controls.
 */
export abstract class AbstractVisualization extends Disposable {
  container: Element;
  protected errorHandler: ErrorHandler;

  private asyncHelper: AsyncHelper | null = null;
  protected fontWaitResolver: Resolver | null;

  /**
   * @param container The DOM element container for the visualization.
   */
  constructor(container: Element | null) {
    super();

    this.container = validateContainer(container);

    this.errorHandler = new ErrorHandler(this, this.container);

    this.fontWaitResolver = GoogPromise.withResolver();
  }

  /**
   * Returns the container.
   */
  getContainer(): Element {
    return this.container;
  }

  /**
   * Returns the desired width of the chart.
   * The value is determined by what specified in the options's width or by the
   * container's width. If these are not given, using the default value - either
   * the one given here or the global DEFAULT_WIDTH.
   *
   * TODO(dlaliberte): Also handle the style of the div and not just
   * clientWidth.
   *
   * @param options The options given to the chart.
   * @param defaultWidth The default width for the chart.
   * @return The chart width to use.
   */
  protected getWidth(options: Options, defaultWidth?: number): number {
    return (
      options.inferOptionalNonNegativeNumberValue('width') ||
      style.getContentBoxSize(this.container).width ||
      defaultWidth ||
      DEFAULT_WIDTH
    );
  }

  /**
   * Returns the desired height of the chart.
   * The value is determined by what specified in the options's height or by the
   * container's height. If these are not given, using the default value -
   * either the one given here or the global DEFAULT_HEIGHT.
   *
   * TODO(dlaliberte): Also handle the style of the div and not just
   * clientHeight.
   *
   * @param options The options given to the chart.
   * @param defaultHeight The default height for the chart.
   * @return The chart height to use.
   */
  protected getHeight(options: Options, defaultHeight?: number): number {
    return (
      options.inferOptionalNonNegativeNumberValue('height') ||
      style.getContentBoxSize(this.container).height ||
      defaultHeight ||
      DEFAULT_HEIGHT
    );
  }

  /**
   * Set the rejection function for the fontWaitResolver.
   */
  protected setResolverReject(rejectFunc: (p1?: AnyDuringMigration) => void) {
    if (this.fontWaitResolver) {
      this.fontWaitResolver.reject = rejectFunc;
    }
  }

  /**
   * Draws the chart. Triggers 'error' event in case any errors are detected
   * while doing so. If drawing was successful, a 'ready' event should be
   * triggered, but it's not the business of this function to handle the 'ready'
   * event. The data is nullable because existing code relies on it.
   *
   * @param data The data table.
   * @param options The visualization options.
   * @param state The state of the chart.
   */
  draw(
    data: AbstractDataTable | null, //
    options?: Object | null | undefined, //
    state?: Object | null | undefined,
  ) {
    this.errorHandler.safeExecute(() => {
      datautils.validateDataTable(data);
      if (data == null) {
        throw new Error('Undefined or null data');
      }

      if (this.fontWaitResolver) {
        this.fontWaitResolver.promise.cancel();
      }
      this.fontWaitResolver = GoogPromise.withResolver();
      if (this.asyncHelper) {
        this.asyncHelper.cancelPendingCallbacks();
      }
      this.asyncHelper = new AsyncHelper(this.errorHandler);
      const asyncWrapper = this.asyncHelper.wrapCallback.bind(this.asyncHelper);

      // TODO(dlaliberte): Convert the options to gviz.Options.
      this.drawInternal(asyncWrapper, data, options, state);
    });
  }

  /**
   * Draws the chart. This is overridden by each visualization.
   * @param asyncWrapper A function that accepts a callback (and possibly
   *     a 'this' context object) and wraps it for async execution.
   * @param data The data table.
   * @param options The visualization options.
   * @param state The state of the chart.
   */
  protected abstract drawInternal(
    asyncWrapper: AnyCallbackWrapper,
    data: AbstractDataTable,
    options?: Object | null | undefined,
    state?: Object | null | undefined,
  ): void;

  // TODO(b/176192913) Define ChartLayoutInterface for all charts?
  // getChartLayoutInterface

  /**
   * Gets an image representation of a chart.
   * Not abstract, so charts must override to support it.
   * @return An image URI of the chart.
   */
  getImageURI(): string {
    return '';
  }

  /**
   * Removes all memory allocated for this visualization, that won't be picked
   * up by the garbage collector, and cancels pending asynchronous callbacks.
   * TODO(dlaliberte): Should be named clear() because it applies to more than
   * just charts.  In particular, Controls are also AbstractVisualizations.
   * @export
   */
  clearChart() {
    if (this.asyncHelper) {
      this.asyncHelper.cancelPendingCallbacks();
      this.asyncHelper = null;
    }
    if (this.fontWaitResolver && this.fontWaitResolver.promise) {
      this.fontWaitResolver.promise.cancel();
      this.fontWaitResolver = null;
    }
    this.clearInternal();
  }

  /**
   * Called by clearChart, this is overridden by each visualization.
   * Clearing erases the chart drawing and readies the chart for drawing again.
   * Clearing can dispose of components in the object, but it must *NOT* dispose
   * the chart object itself, which should only happen when throwing the object
   * itself away.  An infinite loop will result otherwise.
   */
  protected clearInternal() {}

  override disposeInternal() {
    // In case the chart was not cleared, do it now.
    this.clearChart();
    super.disposeInternal();
  }
}
