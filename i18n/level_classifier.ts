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

import * as asserts from '@npm//@closure/asserts/asserts';

/**
 * A structure that is capable of registering classifications for line breaks.
 * Used specifically in the WrappedV8BreakIterator to classify the ouputs of the
 * separate iterators and their different break types.
 * @unrestricted
 */
export class LevelClassifier {
  /**
   * A map from the iterator type to one of:
   * - A level (number).
   * - A classifier (An object containing a classifier function and the
   * possible levels that it will output).
   * - A map from break type to level or classifier.
   */
  private readonly levelMap: {
    [key: string]:
      | number
      | {classifier: Function; levels: number[]}
      | {[key: string]: number | {classifier: Function; levels: number[]}};
  } = {};

  /**
   * Adds a classification to this classifier. There are two primary cases here:
   * 1. A breakType is specified:
   *   In this case, if the classifier is specified, then
   * @param iteratorType The type of iterator that this classification applies to.
   * @param breakType The type of break that this classification applies to. If null, then the classification applies to all break types.
   * @param level If a classifier function is given, then this must be an array of the possible levels that the classifier function will return. If one is not specified, then this should be a number signifying the priority level of this iteratorType and breakType combination.
   * @param optClassifier A classifier function that takes the position of the break as an input and returns the level.
   */
  add(
    iteratorType: string,
    breakType: string | null,
    level: number | number[],
    optClassifier?: (p1: number) => number,
  ) {
    // If a classifier is specified, then level must be an array. If it's not,
    // then level must be a number.
    asserts.assert(
      (optClassifier && Array.isArray(level)) ||
        (!optClassifier && !Array.isArray(level)),
    );
    if (breakType == null) {
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'number | number[] |
      // { classifier: (p1: number) => number; levels: number | number[]; }'
      // is not assignable to type 'number |
      // { classifier: Function; levels: number[]; } |
      // { [key: string]: number | { classifier: Func...
      // tslint:disable-next-line:ban-ts-suppressions
      // @ts-ignore
      this.levelMap[iteratorType] = optClassifier
        ? {classifier: optClassifier, levels: level}
        : level;
    } else {
      if (!(iteratorType in this.levelMap)) {
        this.levelMap[iteratorType] = {};
      }
      // tslint:disable-next-line:ban-types
      (this.levelMap as AnyDuringMigration)[iteratorType][breakType] =
        optClassifier ? {classifier: optClassifier, levels: level} : level;
    }
  }

  /**
   * If a level is not specified, returns all the iterator types that this
   * classifier knows about. If a level is specified, then returns all the
   * iterator types for that given level.
   * @param optLevel The level for which to return iterator types.
   * @suppress {strictMissingProperties} TODO(b/214874268): Remove strictMissingProperties suppression after b/214427036 is fixed
   */
  iteratorTypes(optLevel?: number): string[] {
    if (optLevel == null) {
      return Object.keys(this.levelMap);
    }
    const level = optLevel;
    const iteratorTypes = [];
    for (const iteratorType in this.levelMap) {
      if (!this.levelMap.hasOwnProperty(iteratorType)) continue;
      const iteratorClassifications = this.levelMap[iteratorType];
      if (typeof iteratorClassifications === 'number') {
        if (iteratorClassifications === level) {
          iteratorTypes.push(iteratorType);
        }
      } else if (iteratorClassifications.classifier) {
        if ((iteratorClassifications.levels as number[]).indexOf(level) >= 0) {
          iteratorTypes.push(iteratorType);
        }
      } else {
        for (const breakType in iteratorClassifications) {
          if (!iteratorClassifications.hasOwnProperty(breakType)) continue;
          const classification = // tslint:disable-next-line:ban-types
            (iteratorClassifications as AnyDuringMigration)[breakType];
          if (typeof classification === 'number') {
            if (classification === level) {
              iteratorTypes.push(iteratorType);
            }
          } else if (classification.classifier) {
            if (classification.levels.indexOf(level) >= 0) {
              iteratorTypes.push(iteratorType);
            }
          } else {
            throw new Error('Unknown type');
          }
        }
      }
    }
    return iteratorTypes;
  }

  /**
   * Classifies a break.
   * @param iteratorType The iterator type.
   * @param breakType The break type.
   * @param position The position at which the break occurs.
   * @return The priority level of this break.
   * @suppress {strictMissingProperties} TODO(b/214874268): Remove strictMissingProperties suppression after b/214427036 is fixed
   */
  classify(
    iteratorType: string,
    breakType: string,
    position: number,
  ): number | null {
    if (!(iteratorType in this.levelMap)) {
      throw new Error('Error: unknown iterator type ' + iteratorType);
    }
    let iteratorClassifications = this.levelMap[iteratorType];
    if (typeof iteratorClassifications === 'number') {
      return iteratorClassifications;
    } else if (iteratorClassifications.classifier) {
      const classifier = iteratorClassifications.classifier as (
        p1: number,
      ) => number;
      return classifier(position);
    }

    if (breakType in iteratorClassifications) {
      // tslint:disable-next-line:ban-types
      iteratorClassifications = (iteratorClassifications as AnyDuringMigration)[
        breakType
      ];
      if (typeof iteratorClassifications === 'number') {
        return iteratorClassifications;
      } else if (iteratorClassifications.classifier) {
        const classifier = iteratorClassifications.classifier as (
          p1: number,
        ) => number;
        return classifier(position);
      }
    }
    return null;
  }
}
