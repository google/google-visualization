/**
 * @fileoverview An AxisDecoration contains information on how to draw a
 * decoration on an axis. Lines, ticks and labels are all decorations.
 * Copyright 2010 Google Inc. All Rights Reserved
 *
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

export enum Alignment {
  LEFT = 1,
  CENTER = 2,
  RIGHT = 3,
}

/**
 * Creates an AxisDecoration.
 */
export class AxisDecoration {
  labelAlignment: Alignment;

  /**
   * @param value Data value.
   * @param position Pixel position.
   * @param hasLinePrivate Whether decoration is a line.
   * @param hasTickPrivate Whether decoration is a tick.
   * @param isTickHeavyPrivate Whether decoration is a heavy tick.
   * @param label Label if any.
   * @param labelAlignment Alignment of label. Left, center or right.
   */
  constructor(
    public value: number,
    public position: number,
    private readonly hasLinePrivate: boolean,
    private readonly hasTickPrivate: boolean,
    private readonly isTickHeavyPrivate: boolean,
    public label: string | null,
    labelAlignment?: Alignment,
  ) {
    this.label = label;
    this.labelAlignment =
      labelAlignment != null ? labelAlignment : Alignment.CENTER;
  }

  /**
   * Creates a labeled line with a  heavy tick.
   * @param value Data value.
   * @param position Position for label.
   * @param label The label text.
   * @return The created decoration.
   */
  static makeLabeledLineWithHeavyTick(
    value: number,
    position: number,
    label: string,
  ): AxisDecoration {
    return new AxisDecoration(value, position, true, true, true, label);
  }

  /**
   * Creates a label.
   * @param value Data value.
   * @param position The position.
   * @param label The label.
   * @return The created decoration.
   */
  static makeLabel(
    value: number,
    position: number,
    label: string,
  ): AxisDecoration {
    return new AxisDecoration(value, position, false, false, false, label);
  }

  /**
   * Creates a left aligned label.
   * @param value Data value.
   * @param position The position.
   * @param label The label.
   * @return The created decoration.
   */
  static makeLeftAlignedLabel(
    value: number,
    position: number,
    label: string,
  ): AxisDecoration {
    return new AxisDecoration(
      value,
      position,
      false,
      false,
      false,
      label,
      Alignment.LEFT,
    );
  }

  /**
   * Creates a left aligned label with line and tick.
   * @param value Data value.
   * @param position The position.
   * @param label The label.
   * @return The created decoration.
   */
  static makeLeftAlignedLabelWithLineAndTick(
    value: number,
    position: number,
    label: string,
  ): AxisDecoration {
    return new AxisDecoration(
      value,
      position,
      true,
      true,
      false,
      label,
      Alignment.LEFT,
    );
  }

  /**
   * Creates a tick.
   * @param value Data value.
   * @param position Screen position.
   * @return The created decoration.
   */
  static makeTick(value: number, position: number): AxisDecoration {
    return new AxisDecoration(value, position, false, true, false, null);
  }

  /**
   * Creates a line with tick.
   * @param value Data value.
   * @param position Screen position.
   * @return The created decoration.
   */
  static makeLineWithTick(value: number, position: number): AxisDecoration {
    return new AxisDecoration(value, position, true, true, false, null);
  }

  /**
   * Creates a line and heavy tick.
   * @param value Data value.
   * @param position Screen position.
   * @return The created decoration.
   */
  static makeLineWithHeavyTick(
    value: number,
    position: number,
  ): AxisDecoration {
    return new AxisDecoration(value, position, true, true, true, null);
  }

  /**
   * Returns the rounded position.
   * TODO(dlaliberte) Fractional positions are possible.
   * @return Screen position of decoration.
   */
  getPosition(): number {
    return Math.round(this.position);
  }

  /**
   * Returns the data value.
   * @return Value.
   */
  getValue(): number {
    return this.value;
  }

  /**
   * @return True if line.
   */
  hasLine(): boolean {
    return this.hasLinePrivate;
  }

  /**
   * @return True if tick.
   */
  hasTick(): boolean {
    return this.hasTickPrivate;
  }

  /**
   * @return True if a heavy tick.
   */
  isTickHeavy(): boolean {
    return this.isTickHeavyPrivate;
  }

  /**
   * @return The label.
   */
  getLabel(): string | null {
    return this.label;
  }

  /**
   * @param label The label.
   */
  setLabel(label: string | null) {
    this.label = label;
  }

  /**
   * @return The alignment.
   */
  getLabelAlignment(): Alignment {
    return this.labelAlignment;
  }

  /**
   * @return True if aligned left.
   */
  labelAlignedLeft(): boolean {
    return this.labelAlignment === Alignment.LEFT;
  }

  /**
   * @return True if centered.
   */
  labelAlignedCenter(): boolean {
    return this.labelAlignment === Alignment.CENTER;
  }

  /**
   * @return True if aligned right.
   */
  labelAlignedRight(): boolean {
    return this.labelAlignment === Alignment.RIGHT;
  }
}

/**
 * Axis Decorations include major and minor gridlines,
 * each an array of axis decorations.
 */
export interface Decorations {
  majorGridlines: AxisDecoration[];
  minorGridlines: AxisDecoration[] | undefined;
  min?: number;
  max?: number;
}
