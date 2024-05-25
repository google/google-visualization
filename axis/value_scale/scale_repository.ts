/**
 * @fileoverview A repository of ValueScale constructors to be built on demand.
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

import {ValueScale} from './value_scale';

// tslint:disable:ban-types

/** A static instance holding a reference to the repository singleton. */
let instance: ScaleRepository | null = null;

/**
 * A repository of ValueScale constructors to be built on demand.
 * Obsolete - do not use.
 */
export class ScaleRepository {
  /** The repository holding all instances. */
  private readonly repository: AnyDuringMigration = {};

  /**
   * Singleton access method.
   *
   * @return the repository instance.
   */
  static instance(): ScaleRepository {
    if (instance) {
      return instance;
    }
    instance = new ScaleRepository();
    return instance;
  }

  /**
   * Creates a scale of a specific type
   * @param datatype The type for which a scale should be built.
   * @return The created scale.
   */
  getScale(datatype: string): ValueScale | null {
    const ctor = this.repository[datatype];
    if (ctor) {
      const scale = ctor.apply(null, []);
      return scale;
    } else {
      return null;
    }
  }

  /**
   * Adds a constructor to the repository
   * @param datatype name of type the registered handles.
   * @param ctor The constructor for the scale indexed by datatype.
   */
  registerScale(datatype: string, ctor: () => ValueScale) {
    this.repository[datatype] = ctor;
  }
}
