/**
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

import 'jasmine';

import {Features} from '../../events/explorer/features';
import {ScatterChart} from './corecharts';

type TestCustomFeaturesType = typeof Features & {
  test: string | undefined;
};

class TestCustomFeatures extends Features {
  static test = 'Test';
}

describe('corechart test', () => {
  describe('features', () => {
    let chart: ScatterChart;
    beforeEach(() => {
      const element = document.createElement('div');
      chart = new ScatterChart(element);
    });

    it('should initial to default Features', () => {
      const features = chart.getExplorerFeatures();
      expect(features).toBeDefined();
      expect(typeof features).toBe('function');
      expect(features.EVENT_COUNTDOWN_TIME).toBeDefined();
      expect(features.prototype.init).toBeDefined();
      expect(features.prototype.setScheduler).toBeDefined();
      expect(features.prototype.getEnabledFeatures).toBeDefined();
      expect(features.prototype.getPubsub).toBeDefined();
      expect(features.prototype.init).toBeDefined();
    });

    it('should not have a test property', () => {
      const features = chart.getExplorerFeatures();
      expect((features as TestCustomFeaturesType).test).toBe(undefined);
    });

    it('should be able to set custom Features', () => {
      chart.setExplorerFeatures(TestCustomFeatures);
      const features = chart.getExplorerFeatures();
      expect(features).toBeDefined();
      expect(typeof features).toBe('function');
      expect(features.EVENT_COUNTDOWN_TIME).toBeDefined();
      expect(features.prototype.init).toBeDefined();
      expect(features.prototype.setScheduler).toBeDefined();
      expect(features.prototype.getEnabledFeatures).toBeDefined();
      expect(features.prototype.getPubsub).toBeDefined();
      expect(features.prototype.init).toBeDefined();
      expect((features as TestCustomFeaturesType).test).toBe('Test');
    });

    it('should have a test property', () => {
      chart.setExplorerFeatures(TestCustomFeatures);
      const features = chart.getExplorerFeatures();
      expect((features as TestCustomFeaturesType).test).toBe('Test');
    });

    it('should be able to reset Features', () => {
      chart.setExplorerFeatures(TestCustomFeatures);
      let features = chart.getExplorerFeatures();
      expect((features as TestCustomFeaturesType).test).toBe('Test');
      chart.resetExplorerFeatures();
      features = chart.getExplorerFeatures();
      expect((features as TestCustomFeaturesType).test).toBe(undefined);
    });
  });

  describe('triggerExplorerAction', () => {
    let chart: ScatterChart;
    beforeEach(() => {
      const element = document.createElement('div');
      chart = new ScatterChart(element);
    });

    it('should call customExplorerActionCallbacks', () => {
      chart.customExplorerActionCallbacks = {'foo': () => null};
      spyOn(chart.customExplorerActionCallbacks, 'foo');
      chart.triggerExplorerAction('foo');

      expect(chart.customExplorerActionCallbacks['foo']).toHaveBeenCalled();
    });
  });
});
