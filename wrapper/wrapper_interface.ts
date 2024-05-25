/**
 * @fileoverview An interface wrapper for either charts or controls defining all
 * the context needed to draw it.
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

import {AbstractDataTable} from '../data/abstract_datatable';
import {AbstractVisualization} from '../visualization/abstract_visualization';

// tslint:disable:ban-types Migration

/**
 * Interface for DataTables and DataViews (virtual DataTables).
 */
export interface WrapperInterface {
  /**
   * Returns the current drawn viz.
   * @return The current drawn viz.
   */
  getVisualization(): AbstractVisualization | null;

  /**
   * Sets the viz object.
   * @param visualization The viz object to use.
   */
  setVisualization(visualization: AbstractVisualization | null): void;

  /**
   * Sets the viz type.
   * @param type The type.
   */
  setType(type: string): void;

  /**
   * Returns the viz type.
   * @return The type.
   */
  getType(): string;

  /**
   * Sets the viz name
   * @param name The name.
   */
  setName(name: string): void;

  /**
   * Returns the viz name.
   * @return The name.
   */
  getName(): string;

  /**
   * Sets a visualization property for this wrapper.
   * Note: the key may be a path, but the first component of the key
   * must be a top-level property of the wrapper,
   * e.g. 'options.vAxis.viewWindow.max'.
   * If any nested objects on the path are null or undefined,
   * setProperty() will create new objects at the specified path,
   * kind of like mkdir -p.
   * @param key The path of the property.
   * @param value The value of the property.
   */
  setProperty(key: string, value: AnyDuringMigration): void;

  /**
   * Returns the DataTable for this Wrapper.
   *
   * @return The DataTable for this Wrapper.
   */
  getDataTable(): AbstractDataTable | null;
}
