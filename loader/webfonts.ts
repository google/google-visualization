/**
 * @fileoverview A WebFontLoader for CoreCharts and GeoChart
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

import {Resolver} from '@npm//@closure/promise/resolver';

// tslint:disable:ban-types Migration

/**
 * Constructor for WebFontLoader
 * @unrestricted
 */
export class WebFontLoader {
  /**
   * Hardcoded list of font families.
   */
  static FONT_FAMILIES: string[] = [
    'arial',
    'comic sans ms',
    'courier new',
    'georgia',
    'impact',
    'times new roman',
    'trebuchet ms',
    'verdana',
  ];
  private readonly fonts: string[];
  /**
   * @param fonts An array of strings, fontNames to load.
   * @param resolver Resolves when fonts are ready.
   */
  constructor(fonts: string[] | null, resolver: Resolver) {
    /**
     * Holds the list of fonts to load.
     */
    this.fonts = fonts || [];

    this.loadfonts(resolver);
  }

  /**
   * Generate a font predicate to be used with a recursive object find.
   * @param fontName The name of the key under which fonts will be stored.
   * @return The function predicate.
   */
  static fontPredicate(
    fontName: string,
  ): (
    v: AnyDuringMigration,
    k: AnyDuringMigration,
    o: AnyDuringMigration,
  ) => boolean {
    return (v, k, o) => {
      return (
        k === fontName &&
        typeof v === 'string' &&
        WebFontLoader.FONT_FAMILIES.indexOf(v.toLowerCase()) === -1
      );
    };
  }

  /**
   * Load the given fonts.
   * @param resolver Resolves when fonts are ready.
   */
  private loadfonts(resolver: Resolver) {
    const webFont = goog.global['WebFont'];
    if (this.fonts.length === 0 || !webFont) {
      resolver.resolve(null);
      return;
    }
    webFont.load({
      google: {families: this.fonts},
      active() {
        resolver.resolve();
      },
      fontinactive() {
        resolver.reject('One or more fonts could not be loaded');
      },
    });
  }
}
