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

import {UserOptions} from '../common/options';
import {Control} from '../controls/control';

import {Wrapper, WRAPPER_KIND} from './wrapper';

/**
 * A wrapper for a visualization control and all the context needed to draw
 * it.
 * Specializes the generic Wrapper for controls.
 * TODO(dlaliberte): At the moment this is limited to exporting the 'name' and
 * 'type' settings as 'controlType' and 'controlName' respectively, but
 * control-specific logic should refactored in this class.
 * @unrestricted
 */
export class ControlWrapper extends Wrapper {
  /**
   * @param specification An object specifying the information needed to draw
   *     the control.
   */
  constructor(specification?: string | UserOptions) {
    super(WRAPPER_KIND.CONTROL, specification);
  }

  /**
   * Returns the current drawn control.
   * @return The current drawn control.
   */
  override getVisualization(): Control | null {
    return this.visualization as Control | null;
  }

  /**
   * Returns the current drawn control.
   * @return The current drawn control.
   */
  getControl(): Control | null {
    return this.getVisualization();
  }

  /**
   * Sets the control type.
   * @param type The control type.
   */
  setControlType(type: string) {
    this.setType(type);
  }

  /**
   * Returns the control type.
   * @return The control type.
   */
  getControlType() {
    return this.getType();
  }

  /**
   * Sets the control name
   * @param name The control name.
   */
  setControlName(name: string) {
    this.setName(name);
  }

  /**
   * Returns the control name.
   * @return The control name.
   */
  getControlName() {
    return this.getName();
  }
}
