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

import * as singleton from '@npm//@closure/singleton/singleton';
import {BreakIteratorInterface} from './break_iterator_interface';
import {ManualBreakIterator} from './manual_break_iterator';
import {WrappedV8BreakIterator} from './wrapped_v8_break_iterator';

/**
 * A BreakIteratorFactory provides the available break iterator on this
 * platform.
 * @unrestricted
 */
export class BreakIteratorFactory {
  /** Whether the v8BreakIterator is available or not. */
  private v8BreakIteratorAvailable: boolean;

  constructor() {
    this.v8BreakIteratorAvailable =
      window['Intl'] &&
      // tslint:disable-next-line:ban-types
      !!(window as AnyDuringMigration)['Intl']['v8BreakIterator'];
  }

  /** Forces this factory to always produce a ManualBreakIterator. */
  forceManualBreakIterator() {
    this.v8BreakIteratorAvailable = false;
  }

  /** @param optLocales An optional list of locales. */
  getBreakIterator(optLocales?: string[]): BreakIteratorInterface {
    if (this.v8BreakIteratorAvailable) {
      return new WrappedV8BreakIterator(optLocales);
    }
    return new ManualBreakIterator();
  }

  static getInstance(): BreakIteratorFactory {
    return singleton.getInstance(BreakIteratorFactory);
  }
}
