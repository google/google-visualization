/**
 * @fileoverview Vega abstraction for visualizations built on Vega or VegaLite.
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

import {expressionInterpreter} from '@npm//@vega/expressionInterpreter';
import * as vega from 'vega';
import * as vegaEmbed from 'vega-embed';
import {AnyCallbackWrapper} from '../../common/async_helper';
import {Options as GvizOptions, UserOptions} from '../../common/options';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {AbstractVisualization} from '../abstract_visualization';
// I suspecct this is needed to ensure VegaLite is loaded.
// tslint:disable-next-line:no-unused-variable
import * as vegaLite from 'vega-lite';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/** A Vega Visualization */
export class VegaVisualization extends AbstractVisualization {
  vegaSpec?: vega.Spec;
  vegaLiteSpec?: vegaLite.TopLevelSpec;

  // Type should be something like vegaEmbed.EmbedOptions;
  vegaEmbedSpec?: AnyDuringMigration;

  /**
   * Creates a new instance of a VegaVisualization
   * @param container The DOM element which will contain the visualization.
   */
  constructor(container: Element | null) {
    super(container);
  }

  getVegaSpecFromOptions(options: GvizOptions) {
    // Only one of vega or vegaLite is used for now.
    // TODO(dlaliberte): Figure out how to merge a compiled vegaLite spec
    //   with a vega spec, where the vega spec overrides vegaLite.

    this.vegaSpec = options.inferValue('vega') || undefined;
    if (this.vegaSpec) {
      // Shallow clone the specs, to avoid changing user options.
      this.vegaSpec = {...this.vegaSpec};
    }

    this.vegaLiteSpec = options.inferValue('vegaLite') || undefined;
    if (this.vegaLiteSpec) {
      this.vegaLiteSpec = {...this.vegaLiteSpec};
    }

    this.vegaEmbedSpec = options.inferValue('vegaEmbed', null);
    if (this.vegaEmbedSpec) {
      this.vegaEmbedSpec = {...this.vegaEmbedSpec};
    }

    if (!this.vegaSpec && !this.vegaLiteSpec) {
      throw new Error('VegaChart requires either a vega or vegaLite option.');
    }
  }

  processVegaSpec() {
    // Compile vegaLite spec into vegaSpec.
    if (this.vegaLiteSpec) {
      this.vegaSpec = vegaLite.compile(this.vegaLiteSpec, {}).spec;
    }

    // VegaEmbed is also supported.
    if (this.vegaEmbedSpec) {
      this.vegaEmbedSpec['mode'] = 'vega';
      // In case it matters, set 'ast' to true.  We hardcode the use of
      // the expression interpreter in vega-visualization.
      this.vegaEmbedSpec['ast'] = true;
    }
  }

  /**
   * Draws the chart.
   * This is overridden by each visualization, but not used here since we
   * draw with drawInVegaContainer.  Perhaps that should be changed.
   *
   * @param asyncWrapper A function that accepts a callback (and possibly a
   *     'this' context object) and wraps it for async execution.
   * @param data The data table.
   * @param userOptions The visualization options.
   * @param state The state of the chart.
   */
  drawInternal(
    asyncWrapper: AnyCallbackWrapper, //
    data: AbstractDataTable, //
    userOptions: UserOptions = {}, //
    state: {},
  ) {}

  drawInVegaContainer(
    asyncWrapper: AnyCallbackWrapper, //
    afterDrawing: (view: vega.View) => void,
  ) {
    const spec = this.vegaSpec;
    if (spec == null) {
      throw new Error('No vega spec found');
    }

    const container = this.getContainer() as HTMLElement;
    const runner = asyncWrapper(() => {
      if (this.vegaEmbedSpec) {
        vegaEmbed
          .embed(container, this.vegaSpec!, this.vegaEmbedSpec)
          .then(({view}) => {
            // Args available: {view, spec, vgSpec, finalize}
            afterDrawing(view);
          });
        return;
      }

      // Hack to manually import vega, if it is undefined.
      // This is needed when debugging vegachart, since we don't load
      // vega_bundle_js.
      // tslint:disable-next-line:ban-module-namespace-object-escape
      let vegaValue = vega;
      if (typeof vegaValue === 'undefined') {
        vegaValue = (window as AnyDuringMigration)['vega'];
      }
      const vegaParse = vegaValue.parse;
      const vegaView = vegaValue.View;
      const vegaWarn = vegaValue.Warn;

      const config: vega.Config = {} as vega.Config;

      // We specify use of the expressionInterpreter in the next two lines.
      const parsedSpec = vegaParse(spec, config, {'ast': true});
      const view = new vegaView(parsedSpec, {'expr': expressionInterpreter});

      view.logLevel(vegaWarn); // set view logging level

      view.initialize(container);

      view.renderer('svg'); // set render type (defaults to 'canvas')
      view.hover(); // enable hover event processing
      view.runAsync().then(afterDrawing);
    });
    runner();
  }
}
