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

import {BreakIteratorInterface} from './break_iterator_interface';
import * as constants from './constants';
import {LevelClassifier} from './level_classifier';

// Intl.v8BreakIterator is not defined in the global namespace.
// TODO(dlaliberte): Replace with Intl.Segmenter
// tslint:disable:ban-types

/**
 * A break iterator that uses the v8BreakIterator under the covers.
 * @unrestricted
 */
export class WrappedV8BreakIterator implements BreakIteratorInterface {
  /** A mapping of iterator type to v8BreakIterator instance. */
  private readonly iterators: {[key: string]: AnyDuringMigration} = {};

  /** The classifier that will map break types to priority levels. */
  private readonly classifier: LevelClassifier;

  /**
   * Holds the positions for each break level that are ahead of the cursor.
   * A mapping of level number to array of positions.
   */
  private pending: {[key: number]: number[]} = {};

  /**
   * The cursor. Points to the current break in the text. Could potentially
   * point to 0, right after first() is called.
   */
  private cursor: number | null = null;

  /** The text that this iterator is iterating over. */
  private text: string | null = null;

  /** @param optLocales The locales argument to pass to the iterators. */
  constructor(private readonly optLocales?: string[]) {
    this.classifier = new LevelClassifier();

    this.classify('line', 'number', constants.HARD_LINE_BREAK);
    this.classify(
      'line',
      'none',
      [constants.SOFT_LINE_BREAK, constants.MIDWORD_BREAK],
      (position) => {
        return this.text![position - 1] === constants.SOFT_HYPHEN
          ? constants.MIDWORD_BREAK
          : constants.SOFT_LINE_BREAK;
      },
    );
    this.classify('character', null, constants.CHARACTER_BREAK);
  }

  /** Assigns text to be segmented to the iterator. */
  adoptText(text: string) {
    this.text = text;
    for (const iteratorType in this.iterators) {
      if (!this.iterators.hasOwnProperty(iteratorType)) continue;
      this.iterators[iteratorType].adoptText(text);
    }
  }

  /**
   * Returns the iterator instance of the given iterator type. If the iterator
   * type doesn't have an instance, it will construct one here.
   * @param iteratorType The iterator type to fetch.
   */
  private getIterator(iteratorType: string): AnyDuringMigration {
    let iterator = this.iterators[iteratorType];
    if (!iterator) {
      iterator = this.iterators[iteratorType] = new (
        window as AnyDuringMigration
      )['Intl']['v8BreakIterator'](this.optLocales, {'type': iteratorType});
      if (this.text != null) {
        iterator.adoptText(this.text);
      }
      if (this.cursor != null) {
        // The iterator will be advanced during the next fetch.
        iterator.first();
      }
    }
    return iterator;
  }

  /**
   * Sets up the classifier to classify things of iteratorType and breakType as
   * the given level. @see LevelClassifier.add.
   * @param iteratorType The type of the iterator.
   * @param breakType The break type.
   * @param levelOrLevels If a classifier is specified, then this should be an array of possible levels that the classifier may return. If it is not specified, then it should be level that this iteratorType and ?breakType combination should map to. If a breakType is not specified, then all breaks that come from the given iteratorType will be classified under this rule.
   * @param optClassifier An optional classifier function to run to get the level for this rule.
   */
  classify(
    iteratorType: string,
    breakType: string | null,
    levelOrLevels: number | number[],
    optClassifier?: (p1: number) => number,
  ) {
    this.classifier.add(iteratorType, breakType, levelOrLevels, optClassifier);
  }

  /**
   * If a level is specified, returns the iterator types for that level. If not,
   * returns all the iterator types recognized by the classifier.
   * @param optLevel The level.
   */
  private getIteratorTypes(optLevel?: number): string[] {
    return this.classifier.iteratorTypes(optLevel);
  }

  /**
   * Adds the position to the relevant break level pending stream.
   * @param iteratorType The iterator type.
   * @param breakType The break type.
   * @param position The position at which the break occurs.
   */
  private addPending(
    iteratorType: string,
    breakType: string,
    position: number,
  ) {
    const breakLevel = this.classifier.classify(
      iteratorType,
      breakType,
      position,
    );
    if (breakLevel == null) {
      throw new Error(
        'Break type ' +
          breakType +
          ' in ' +
          iteratorType +
          ' iterator was classified as null.',
      );
    }
    // tslint:disable-next-line:ban-unsafe-reflection
    if (!(breakLevel in this.pending)) {
      this.pending[breakLevel] = [];
    }
    this.pending[breakLevel].push(position);
  }

  /**
   * Advances the iterator until the next break.
   * @param iteratorType The type of the iterator.
   * @param iterator The v8BreakIterator instance.
   * @return True if the iterator is exhausted.
   * @suppress {strictPrimitiveOperators} Auto-added to unblock check_level=STRICT
   */
  private advanceIterator(
    iteratorType: string,
    iterator: AnyDuringMigration,
  ): boolean {
    iterator.next();
    if (iterator.current() >= this.text!.length) {
      return true;
    } else if (iterator.current() > this.cursor!) {
      this.addPending(iteratorType, iterator.breakType(), iterator.current());
    }
    return false;
  }

  /**
   * Advances all the iterators until they reach the given position.
   * @param position The position until which to advance the given iterators.
   */
  private advanceUntilPosition(position: number) {
    for (const iteratorType in this.iterators) {
      if (!this.iterators.hasOwnProperty(iteratorType)) continue;
      const iterator = this.getIterator(iteratorType);
      while (iterator.current() <= position) {
        this.advanceIterator(iteratorType, iterator);
      }
    }
  }

  /**
   * Advances all relevant iterators either until they are exhausted or until
   * they hit the next break type that is at the given level.
   * @param level The level until which to advance.
   * @suppress {strictPrimitiveOperators} Auto-added to unblock check_level=STRICT
   */
  private advanceUntilNextLevel(level: number) {
    const pending = this.pending[level];
    // If there are things in pending that were before where the cursor is now,
    // remove them.
    while (pending && pending.length > 0 && pending[0] <= this.cursor!) {
      pending.shift();
    }
    const iterators = this.getIteratorTypes(level);
    const finishedIterators: {[key: string]: boolean} = {};
    let endLoop = false;
    while (
      !endLoop &&
      (!this.pending[level] || this.pending[level].length === 0)
    ) {
      endLoop = true;
      const leni = iterators.length;
      for (let i = 0; i < leni; i++) {
        const iteratorType = iterators[i];
        const iterator = this.getIterator(iteratorType);
        if (finishedIterators[iteratorType]) {
          continue;
        }
        endLoop = false;
        if (this.advanceIterator(iteratorType, iterator)) {
          finishedIterators[iteratorType] = true;
        }
      }
    }
  }

  /** Returns index of the first break and moves pointer to it. */
  first(): number {
    const iteratorTypes = this.getIteratorTypes();
    const leni = iteratorTypes.length;
    for (let i = 0; i < leni; i++) {
      this.getIterator(iteratorTypes[i]).first();
    }
    this.pending = {};
    return (this.cursor = 0);
  }

  /** Returns index of the current break. */
  current(): number {
    return this.cursor || 0;
  }

  /**
   * Returns index of the next break at the given level and moves pointer to it.
   */
  next(level: number): number {
    this.advanceUntilNextLevel(level);
    const pending = this.pending[level];
    if (pending != null && pending.length > 0) {
      this.cursor = pending.shift()!;
      this.advanceUntilPosition(this.cursor);
      return this.cursor;
    }
    return this.text!.length;
  }

  /** Returns index of the next break at the given level. */
  peek(level: number): number {
    this.advanceUntilNextLevel(level);
    const pending = this.pending[level];
    return pending != null && pending.length > 0
      ? pending[0]
      : this.text!.length;
  }
}
