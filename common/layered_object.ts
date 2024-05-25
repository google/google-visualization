/**
 * @fileoverview A utility class for an object consisting of several layers,
 * where every layer can add new properties to the object or override
 * properties defined by previous layers.
 * The "compact" method returns a compact representation of the object, where
 * every property has its latest value (values which have been overridden do
 * not appear in this representation). For example, [{a:5, b:3}, {a:666}] is
 * compacted into {a:666, b:3}.
 *
 * Several notes:
 * - Properties introduced in higher levels will be added to the compact
 *   object. For example, [{a:666}, {a:5, b:3}] is merged into {a:5, b:3}. This
 *   semantics is consistent with overriding the "undefined" value these
 *   properties had in lower levels.
 * - Sub-objects are considered leafs in the following cases:
 *   1) Non objects (e.g., primitives).
 *   2) Arrays - There is no simple option to override a value at a specific
 *      index.
 *   3) Clone-able class objects (which implement the clone() method).
 *   4) Dates - (Object for which isDateLike() returns true).
 *   Leaf objects may be replaced altogether by a layer, however, their
 *   fields are not subject to a specific override.
 * - Overriding layers cannot delete properties. The user may get a similar
 *   behavior by assigning some special value (e.g., null) to the erased
 *   properties and act accordingly.
 * - Overriding layer may not change the type of an object. One can override
 *   an object with a null value and vice versa, but not, for example,
 *   override a number with a string.
 * - Note: do not use self-referencing objects in the layers. That may cause
 *   a non terminating computation.
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

import {assert} from '@npm//@closure/asserts/asserts';

import {isDateLike} from './object';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * Builds a layered object.
 * Initially, no layers exist.
 * @unrestricted
 */
export class LayeredObject {
  private readonly layers: AnyDuringMigration[];
  private readonly compacted: AnyDuringMigration[];
  /**
   * @param numberOfLayers Number of layers.
   */
  constructor(numberOfLayers: number) {
    assert(
      numberOfLayers > 0,
      `Expecting one or more layers, got ${numberOfLayers}`,
    );

    /**
     * The layers, ordered from least to most significant.
     */
    this.layers = new Array(numberOfLayers).fill({});

    /**
     * The merged value of each partial set of layers. The i'th location
     * contains the merged value of layers [0..i].
     */
    this.compacted = new Array(numberOfLayers).fill({});
  }

  /**
   * Sets the  value of a specific layer. The layered object does not change the
   * content of the given layers.
   * Note: calling this method will result in eager evaluation of the compact
   * form, thus making the compact method immediate.
   * @param index The index of the layer to set.
   * @param layer The value of the layer to set.
   */
  setLayer(index: number, layer: AnyDuringMigration) {
    const numberOfLayers = this.layers.length;
    assert(
      index >= 0 && index < numberOfLayers,
      'Index %s is out of range [0,%s]',
      index,
      numberOfLayers - 1,
    );
    this.layers[index] = layer;
    // Updating the merged value of layers [index, numberOfLayers-1].
    for (let i = index; i < numberOfLayers; ++i) {
      this.compacted[i] = this.recursivelyAddSubLayer(
        i === 0 ? {} : this.compacted[i - 1],
        this.layers[i],
      );
    }
  }

  /**
   * Returns true iff the value given is considered a leaf.
   * For details, see the file overview.
   * @param v The value to inspect.
   * @return True iff the value given is considered a leaf.
   */
  private isLeaf(v: AnyDuringMigration): boolean {
    const typeOfValue = goog.typeOf(v);
    // Note that we only check for clone() on objects not arrays.
    // This is because some javascript libraries such as MooTools extend the
    // prototype of Array with a clone() method.
    // Arrays are never leaves.
    // TODO(dlaliberte): We would incur the same issue if some library augmented the
    // prototype of Object with a clone() method. Maybe testing for a clone()
    // method is not the logical thing to do to detect Objects we want to treat
    // as leaves.
    return (
      (typeOfValue !== 'object' && typeOfValue !== 'array') ||
      (typeOfValue === 'object' && typeof v.clone === 'function') ||
      isDateLike(v)
    );
  }

  /**
   * Recursively adds the given layer to the given compact structure.
   *
   * @param subCompact The part of the compacted structure we recursing
   *     on.
   * @param subLayer The part of the layer we recursing on.
   * @return The new value for subCompact, after subLayer was used
   *     for overriding values in it.
   */
  private recursivelyAddSubLayer(
    subCompact: AnyDuringMigration,
    subLayer: AnyDuringMigration,
  ): AnyDuringMigration {
    // *, Leaf - return as is.
    // Leaf, non-leaf - return as is.
    // *, Array - return as is.
    if (
      this.isLeaf(subLayer) ||
      this.isLeaf(subCompact) ||
      Array.isArray(subLayer)
    ) {
      return subLayer;
    }

    // Array, Object - override specific values (no new keys).
    // Object, Object - override specific values (allow new keys).
    const subLayerObject = subLayer;
    if (goog.typeOf(subCompact) === 'object') {
      // Overriding an object
      const subCompactObject = subCompact;
      const ret = {...subCompactObject};
      for (const key in subLayerObject) {
        if (!subLayerObject.hasOwnProperty(key)) continue;
        const val = subLayerObject[key];
        if (
          subCompactObject == null ||
          !(key in subCompactObject) ||
          subCompact[key] == null
        ) {
          // New key, reusing the existing value.
          ret[key] = val;
        } else {
          // An existing key, merging the values recursively.
          ret[key] = this.recursivelyAddSubLayer(subCompact[key], val);
        }
      }
      return ret;
    } else {
      // Overriding an array.
      const ret = Array.from(subCompact as AnyDuringMigration[]);
      for (const key in subLayerObject) {
        if (!subLayerObject.hasOwnProperty(key)) continue;
        const val = subLayerObject[key];
        // Overriding a specific array element.
        ret[Number(key)] = this.recursivelyAddSubLayer(subCompact[key], val);
      }
      return ret;
    }
  }

  /**
   * Returns the compact form of all the layers.
   * @return The compact form of all the layers.
   */
  compact(): AnyDuringMigration {
    return this.compacted[this.compacted.length - 1];
  }
}
