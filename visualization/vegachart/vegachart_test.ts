/**
 * @fileoverview Scuba tests for VegaChart.
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

import 'jasmine'; // side-effect: declare jasmine global

import {Scuba} from 'google3/testing/karma/karma_scuba_framework';
import {setupScuba, setupVisualization} from '../test_utils';

import {barTest} from './testing/bar';
import {donutTest} from './testing/donut';
import {heatmapTest} from './testing/heatmap';
import {marginalChartsTest} from './testing/marginal_charts';
import {radarTest} from './testing/radar';
import {VegaChart} from './vegachart';

let scuba: Scuba;
let vis: VegaChart;

describe('Scuba', () => {
  beforeAll(() => {
    // Create a new Scuba client
    scuba = setupScuba(module);
  });

  beforeEach(() => {
    vis = setupVisualization(VegaChart);
  });

  afterEach(() => {
    vis.clearChart();
  });

  it('barTest', async () => {
    barTest(vis);
    expect(await scuba.diffElement('bar', '#visualization')).toHavePassed();
  });

  it('donutTest', async () => {
    donutTest(vis);
    expect(await scuba.diffElement('donut', '#visualization')).toHavePassed();
  });

  it('radarTest', async () => {
    radarTest(vis);
    expect(await scuba.diffElement('radar', '#visualization')).toHavePassed();
  });

  it('heatmapTest', async () => {
    heatmapTest(vis);
    expect(await scuba.diffElement('heatmap', '#visualization')).toHavePassed();
  });

  it('marginalChartsTest', async () => {
    marginalChartsTest(vis);
    expect(await scuba.diffPage('marginalCharts')).toHavePassed();
  });
});
