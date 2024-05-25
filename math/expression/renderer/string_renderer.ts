/**
 * @fileoverview This file provides the string renderer for math expressions.
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

import {Identifier} from '../tokens/identifier';
import {Number as TokenNumber} from '../tokens/number';
import {Symbol} from '../tokens/symbols';
import {Token} from '../tokens/token';

const {
  CLOSE_PAREN,
  EQUALS,
  IDENTIFIER,
  MINUS,
  NEGATE,
  NUMBER,
  OPEN_PAREN,
  PLUS,
  POWER,
  SEPARATOR_COMMA,
  TIMES,
} = Symbol;

type RendererSig = (token: Token, renderer: StringRenderer) => string;

/** A string renderer for mathematical expressions. */
export class StringRenderer {
  formatter: (p1: number) => string;

  private readonly renderers: Map<string, RendererSig>;

  /**
   * @param numberFormatter An optional function that takes in a number and
   *     outputs a string.
   */
  constructor(numberFormatter: (p1: number) => string = String) {
    this.formatter = numberFormatter;

    this.renderers = this.initializeRenderers();
  }

  private initializeRenderers(): Map<string, RendererSig> {
    const renderers = new Map<string, RendererSig>();
    renderers.set(NUMBER, (token: Token, renderer: StringRenderer) => {
      const tokenNumber = token as TokenNumber;
      return renderer.formatter(tokenNumber.value);
    });
    renderers.set(IDENTIFIER, (token: Token, renderer: StringRenderer) => {
      const tokenIdentifier = token as Identifier;
      return tokenIdentifier.name;
    });
    renderers.set(PLUS, (token: Token, renderer: StringRenderer) => ' + ');
    renderers.set(MINUS, (token: Token, renderer: StringRenderer) => ' - ');
    renderers.set(NEGATE, (token: Token, renderer: StringRenderer) => '-');
    renderers.set(EQUALS, (token: Token, renderer: StringRenderer) => ' = ');
    renderers.set(TIMES, (token: Token, renderer: StringRenderer) => ' * ');
    renderers.set(OPEN_PAREN, (token: Token, renderer: StringRenderer) => '(');
    renderers.set(CLOSE_PAREN, (token: Token, renderer: StringRenderer) => ')');
    renderers.set(
      SEPARATOR_COMMA,
      (token: Token, renderer: StringRenderer) => ', ',
    );
    renderers.set(POWER, (token: Token, renderer: StringRenderer) => '^');
    return renderers;
  }

  /**
   * Renders a sequence of tokens as a string.
   * @param tokens The sequence of tokens that should be renderered.
   * @return The string-rendered expression.
   */
  render(tokens: Token[]): string {
    return tokens
      .map((token) => this.renderers.get(token.getSymbol())!(token, this), this)
      .join('');
  }
}
