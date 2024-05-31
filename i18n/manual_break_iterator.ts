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
import * as graphemeBreak from '@npm//@closure/i18n/graphemebreak';
import {BreakIteratorInterface} from './break_iterator_interface';
import * as constants from './constants';

/**
 * A naive implementation of a BreakIterator that can be used for line breaking.
 * @unrestricted
 */
export class ManualBreakIterator implements BreakIteratorInterface {
  /** The text this iterator is iterating over. */
  private text: string | null = null;

  /** Where this cursor is in the text. */
  private cursor: number | null = null;

  /** Assigns text to be segmented to the iterator. */
  adoptText(text: string) {
    this.text = text;
  }

  /** Returns index of the first break and moves pointer to it. */
  first(): number {
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
    const next = this.peek(level);
    if (next == null) {
      return next;
    }
    return (this.cursor = next);
  }

  /**
   * Locates the next instance of a given regexp from the current cursor
   * position.
   * @param re The regexp to search for.
   * @return The index after the occurrence of the regexp.
   */
  private findNextRegexp(re: RegExp): number {
    asserts.assert(re.global);
    asserts.assert(this.cursor !== null);
    asserts.assert(this.text !== null);
    re.lastIndex = this.cursor!;
    const result = re.exec(this.text!);
    if (!result || result.index < 0) {
      return this.text!.length;
    }
    return result.index + result[0].length;
  }

  /**
   * Locates the next hard break from the current cursor position. A hard break
   * is defined as one of:
   * 1. A carriage return followed by a newline (\r\n)
   * 2. A newline
   * 3. A carriage return.
   */
  private findNextHardBreak(): number {
    return this.findNextRegexp(/(\r\n|\n|\r)/g);
  }

  /**
   * Locates the next soft break from the current cursor position. A soft break
   * is defined either a non-word character (such as punctuation) or a sequence
   * of whitespace characters.
   */
  private findNextSoftBreak(): number {
    // 2009 is the Unicode code point for Thin Space.
    // 200B is the Unicode code point for Zero Width Space.
    return this.findNextRegexp(
      /([`~!@#$%^&*()_+\-=\[\]\\{}|;\':",\.\/<>?]|[ \t\u2009\u200b]+)/g,
    );
  }

  /**
   * Locates the next midword break from the current cursor position. A midword
   * break is defined as any place in the middle of a word that a newline can be
   * inserted. Currently, the only supported instance of this is the soft
   * hyphen.
   */
  private findNextMidwordBreak(): number {
    // 00AD is the Unicode code point for the Soft Hyphen.
    return this.findNextRegexp(/[\u00ad]/g);
  }

  /**
   * Locates the next character break from the current cursor position. A
   * character break is defined as any boundary between characters. This is
   * important for languages such as Thai, where multiple Unicode characters are
   * combined into one visual character.
   */
  private findNextCharacterBreak(): number {
    const leni = this.text!.length;
    for (let i = this.cursor! + 1; i < leni; i++) {
      if (
        graphemeBreak.hasGraphemeBreak(
          this.text!.charCodeAt(i - 1),
          this.text!.charCodeAt(i),
          /* opt_extended */ false,
        )
      ) {
        return i;
      }
    }
    return this.text!.length;
  }

  /** Returns index of the next break at the given level. */
  peek(level: number): number {
    asserts.assert(this.text !== null);
    asserts.assert(this.cursor !== null);
    if (level === constants.HARD_LINE_BREAK) {
      return this.findNextHardBreak();
    } else if (level === constants.SOFT_LINE_BREAK) {
      return this.findNextSoftBreak();
    } else if (level === constants.MIDWORD_BREAK) {
      return this.findNextMidwordBreak();
    } else if (level === constants.CHARACTER_BREAK) {
      return this.findNextCharacterBreak();
    } else {
      return this.text!.length;
    }
  }
}
