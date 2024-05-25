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

import {assertEquals, assertThrowsWithMessage} from '../common/test_utils';

import {resolveConstructor} from './loader';
import * as gvizSafe from './safe';

describe('loader test', () => {
  it('resolveConstructor', () => {
    const googleVisualizationType = () => {};
    const type = () => {};
    goog.exportSymbol(
      'google.visualization.__CustomType',
      googleVisualizationType,
    );
    gvizSafe.TEST_ONLY.allowVisualizationForTests!(
      'google.visualization.__CustomType',
    );

    let resolvedType = resolveConstructor('__CustomType');
    assertEquals(
      // '__CustomType should have been resolved in the google.visualziation '
      // + 'namespace',
      googleVisualizationType,
      resolvedType,
    );

    goog.exportSymbol('__CustomType', type);
    gvizSafe.TEST_ONLY.allowVisualizationForTests!('__CustomType');

    resolvedType = resolveConstructor('__CustomType');
    assertEquals(
      // 'When a type is available under the same name both in the global ' +
      // 'namespace and in the google.visualization one, the latter should ' +
      // 'take precedence',
      googleVisualizationType,
      resolvedType,
    );

    assertThrowsWithMessage(() => {
      resolveConstructor('__NonExistentType');
    }, 'Failure: Unable to resolve constructor for "__NonExistentType"');
  });
});
