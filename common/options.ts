/**
 * @fileoverview The chart options, views, and default values.
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

import * as asserts from '@npm//@closure/asserts/asserts';
import {Brush, BrushProperties} from '../graphics/brush';
import {PatternStyle, StrokeDashStyleType} from '../graphics/types';
import * as util from '../graphics/util';
import {TextStyle, TextStyleProperties} from '../text/text_style';
import * as gvizObject from './object';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
// tslint:disable:no-implicit-dictionary-conversion

// type AnyDuringMigration = any;

/**
 * GViz user options are currently typeless.
 * TODO(dlaliberte): Need to define specific types for options appropriate to
 * each context.  Each chart type has different options, but substructures
 * of options are also treated as options. So we need templated types.
 */
export type UserOptions = AnyDuringMigration;

/**
 * A string or array of strings representing alternative paths
 * through the options structure.
 */
export type OptionPath = string | string[];

/** The names of option types, used to look up a type spec. */
type NamedOptionType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'numberOrString'
  | 'primitive'
  | 'ratio'
  | 'nonNegative'
  | 'absOrPercentage'
  | 'arrayOfNumber'
  | 'arrayOfString'
  | 'color'
  | 'object';

/**
 * Map from each NamedOptionType to TypeSpec values.  The values are defined
 * at the end of this file, after definitions of infer methods.
 */
let NAMED_TYPE_SPEC_MAP: {[N in NamedOptionType]: TypeSpec};

/**
 * Any of the variations of option type specifications.  These are interpreted
 * by {@see #inferOptionalTypedObjectValue}, given an Options instance,
 * a type (as ObjectProperties), an optionPath, and optional settings
 * which are passed on to handlers, which may be inferOptional methods.
 *
 * If the handler is a String, it must be one of the named types in
 * NamedOptionType and the name will be looked up in
 * NamedTypeSpecMap to find another TypeSpec, processed recursively.
 *
 * If the handler is an Array, each element must be an alternative TypeSpec,
 * and the first one that results in a non-null value is used.
 *
 * If the handler is an Object, it must be a ObjectTypeSpec, where the 'type'
 * must be a TypeSpec. Depending on the type, there might be other properties.
 *  - settings will be passed to an infer method for a named type.
 *  - properties will be used with an 'object' type.
 *
 * If the handler is a function, it must be one of the inferOptional methods,
 * which take an optionPath, and an optional settings argument.
 */
type TypeSpec =
  | NamedOptionType
  | ObjectTypeSpec
  | TypeSpecArray
  | ((p1: OptionPath, p2?: AnyDuringMigration) => AnyDuringMigration);

interface TypeSpecArray extends Array<TypeSpec> {}

/**
 * An Object that specifies a type, with name, settings, or properties,
 * depending on the type.
 */
interface ObjectTypeSpec {
  // type is typically a NamedOptionType
  type: TypeSpec;
  // name of an option property, used in an ObjectProperties.
  //  (This may be generalized to a path in the near future.)
  name: string | undefined;
  // settings is any value which will be passed to infer methods
  // to constrain how conversion of option values is done.
  settings?: unknown;
  // properties that apply when the type is 'object'.
  properties?: ObjectProperties;
}

/**
 * An Object that specifies the structure of an Object that will be created
 * from options, including all of its properties, and the type of each property
 * value. The names of these properties will typically be unquoted, which will
 * be obfuscated by the JS compiler.
 *
 * Each of the property values of this ObjectProperties is an ObjectTypeSpec
 * that has a name property, to specify the name of the option that it
 * corresponds to.  Typically this name will a quoted version of the property
 * that it will end up in, but they could be different.
 *
 * E.g. If the options contained this object: { 'a': 'abc', 'bees': [1, 2, 3] }
 * it could have this ObjectProperties:
 *
 * { a: { name: 'a', type: 'string },
 *   b: { name: 'bees', type: 'arrayOfNumber' } }
 *
 * which will be interpreted to create this object: { a: 'abc', b: [1, 2, 3] }
 *
 * typedef {!Object<!gviz.Options.ObjectTypeSpec>}
 */
interface ObjectProperties {
  [key: string]: ObjectTypeSpec;
}

/** The type specification for a Brush option. */
const BRUSH_OPTION_TYPE: ObjectProperties = {
  fill: {name: 'fill', type: 'color'},
  fillOpacity: {name: 'fillOpacity', type: 'ratio'},
  stroke: {name: 'stroke', type: 'color'},
  strokeOpacity: {name: 'strokeOpacity', type: 'ratio'},
  strokeWidth: {name: 'strokeWidth', type: 'nonNegative'},
  strokeDashStyle: {
    name: 'strokeDashStyle',
    type: [
      'arrayOfNumber',
      {type: 'string', settings: StrokeDashStyleType},
    ] as TypeSpecArray,
  },
  rx: {name: 'rx', type: 'number'},
  ry: {name: 'ry', type: 'number'},
  gradient: {
    name: 'gradient',
    type: 'object',
    properties: {
      color1: {name: 'color1', type: 'color'},
      color2: {name: 'color2', type: 'color'},
      opacity1: {name: 'opacity1', type: 'ratio'},
      opacity2: {name: 'opacity2', type: 'ratio'},
      x1: {name: 'x1', type: 'numberOrString'},
      // absOrPercentage?
      y1: {name: 'y1', type: 'numberOrString'},
      x2: {name: 'x2', type: 'numberOrString'},
      y2: {name: 'y2', type: 'numberOrString'},
      sharpTransition: {name: 'sharpTransition', type: 'boolean'},
      useObjectBoundingBoxUnits: {
        name: 'useObjectBoundingBoxUnits',
        type: 'boolean',
      },
    },
  },
  shadow: {
    name: 'shadow',
    type: 'object',
    properties: {
      radius: {name: 'radius', type: 'number'},
      opacity: {name: 'opacity', type: 'ratio'},
      xOffset: {name: 'xOffset', type: 'number'},
      yOffset: {name: 'yOffset', type: 'number'},
    },
  },
  pattern: {
    name: 'pattern',
    type: 'object',
    properties: {
      color: {name: 'color', type: 'color'},
      backgroundColor: {name: 'backgroundColor', type: 'color'},
      style: {
        name: 'style',
        type: {type: 'string', settings: PatternStyle} as ObjectTypeSpec,
      },
    },
  },
};

/** The type specification for a Text Style option. */
const TEXT_STYLE_OPTION_TYPE: ObjectProperties = {
  color: {name: 'color', type: 'color'},
  opacity: {name: 'opacity', type: 'ratio'},
  auraColor: {name: 'auraColor', type: 'color'},
  auraWidth: {name: 'auraWidth', type: 'nonNegative'},
  fontName: {name: 'fontName', type: 'string'},
  fontSize: {name: 'fontSize', type: 'nonNegative'},
  bold: {name: 'bold', type: 'boolean'},
  italic: {name: 'italic', type: 'boolean'},
  underline: {name: 'underline', type: 'boolean'},
};

/**
 * The class of GViz options, containing user options, and default options.
 */
export class Options {
  /**
   * Holds the layers of option objects. There should always be at least one.
   */
  private readonly layers: UserOptions[];

  /**
   * Maintains the mapping from group index to layer index.
   * Layer group 0 always starts at layer 0.
   * The initial layers are treated as separate groups.
   * We actually maintain the sizes of each layer group for simplicity.
   */
  private readonly layerGroupSizes: number[];

  /** Used for constructing a view. */
  private readonly basePath: OptionPath | null;
  private readonly isFlat: boolean;

  /**
   * Constructor for chart options. All inferXXXValue() functions will look for
   * a given key in all layers, by order of priority, and return the first
   * match.
   *
   * @param layers An array of layers, each
   *     containing some or all the options. Lowest index has highest priority.
   * @param basePath  The base path for options.
   *     If defined, this path will be prepended every time an access is
   *     made on this options object.  This is how views are implemented.
   * @param isFlat Whether the layers
   *     in this object are flat. This is not actually enforced.
   */
  constructor(
    layers: UserOptions[],
    basePath?: OptionPath,
    isFlat?: boolean,
    layerGroupSizes?: number[],
  ) {
    this.layers = layers || [{}];
    this.layerGroupSizes =
      layerGroupSizes || new Array(this.layers.length).fill(1);
    this.basePath = basePath || null;
    this.isFlat = isFlat != null ? isFlat : false;
  }

  /**
   * Constructs a new Options object that is a view into this at the given path.
   * For example, after constructing view = options.view('a'),
   * calling view.inferValue('b') will return options with the path 'a.b'.
   */
  view(path: OptionPath): Options {
    // If this is already a view, make sure to add the view path.
    path = this.canonicalizePaths(path);
    return new Options(
      Array.from(this.layers),
      path,
      this.isFlat,
      Array.from(this.layerGroupSizes),
    );
  }

  /**
   * Calculates the absolute paths, relative to this Options' view.
   * @see #combinePaths for how the paths are combined.
   *
   * @param optionPath The relative path(s).
   * @return The absolute paths.
   */
  canonicalizePaths(optionPath: OptionPath): OptionPath {
    if (typeof optionPath === 'string') {
      optionPath = [optionPath];
    }
    if (this.basePath != null) {
      return Options.combinePaths(this.basePath, optionPath);
    }
    return optionPath;
  }

  /**
   * Combines two paths or path arrays into a single array of absolute paths.
   * Here are some examples: #combinePaths('a', 'b') -> 'a.b'
   * #combinePaths('a.b', 'c') -> 'a.b.c'
   * #combinePaths('a.b', '') -> 'a.b'
   * #combinePaths('', 'c') -> 'c'
   * #combinePaths(['a', 'b'], 'c') -> ['a.c', 'b.c']
   * #combinePaths('a', ['b', 'c']) -> ['a.b', 'a.c']
   * #combinePaths('a', []) -> ['a']
   * #combinePaths([], 'a') -> ['a']
   * #combinePaths(['a', 'b'], ['c', 'd']) -> ['a.c', 'a.d', 'b.c', 'b.d']
   * #combinePaths(['a', 'b'], ['c', 'd', '']) -> ['a.c', 'a.d', 'a',
   *                                               'b.c', 'b.d', 'b']
   * #combinePaths(['a', 'b', ''], ['c', 'd']) -> ['a.c', 'a.d',
   *                                               'b.c', 'b.d',
   *                                               'c', 'd']
   */
  static combinePaths(
    optionPath1: OptionPath,
    optionPath2: OptionPath,
  ): OptionPath {
    const paths1 =
      typeof optionPath1 === 'string' ? [optionPath1] : optionPath1;
    const paths2 =
      typeof optionPath2 === 'string' ? [optionPath2] : optionPath2;
    if (paths1.length === 0) {
      return paths2;
    }
    if (paths2.length === 0) {
      return paths1;
    }
    const output: AnyDuringMigration[] = [];
    asserts.assertArray(paths1);
    for (const path1 of paths1) {
      const path1IsEmpty = path1 == null || path1 === '';

      // For some reason, if we do this assert outside of the forEach, it
      // doesn't work. So we have to do it inside the loop.
      asserts.assertArray(paths2);
      for (const path2 of paths2) {
        const path2IsEmpty = path2 == null || path2 === '';
        if (!path1IsEmpty && !path2IsEmpty) {
          output.push(path1 + '.' + path2);
        } else {
          if (!path1IsEmpty) {
            output.push(path1);
          } else {
            if (!path2IsEmpty) {
              output.push(path2);
            }
          }
        }
      }
    }
    return output;
  }

  /**
   * Insert the layer before the layerGroupIndex'th layer.
   * When used with a view, the layer is used to extend an object at the
   * basePath.
   *
   * @param layerGroupIndex Index of layer group to insert before.
   * @param layer The layer of options to insert.
   */
  insertLayer(layerGroupIndex: number, layer: AnyDuringMigration | null) {
    if (this.basePath) {
      // This is a view, so need to extend an object at some path.
      // Use the first basePath, since it has the highest priority.
      const optionsObj = {};
      const path = this.basePath[0];
      const keys = path.split('.');
      gvizObject.extendByKeys(optionsObj, keys, layer);
      layer = optionsObj;
    }

    // Compute the layerIndex by adding up preceding layerGroupSizes.
    let layerIndex = 0;
    for (let index = 0; index < layerGroupIndex; index++) {
      if (index === this.layerGroupSizes.length) {
        // Extend the layer groups with a zero size group.
        this.layerGroupSizes.push(0);
      }
      layerIndex += this.layerGroupSizes[index];
    }

    // Increase the size of this group.
    this.layerGroupSizes[layerGroupIndex]++;

    // Insert the layer at the computed layerIndex.
    // was: goog.array.insertAt(this.layers, layer, layerIndex);
    this.layers.splice(layerIndex, 0, layer);
  }

  /**
   * @param optionPath The option path.
   * @return Whether all the values at the path are either null or
   *     undefined.
   */
  isNullOrUndefined(optionPath: OptionPath): boolean {
    const value = this.inferValue(optionPath);
    return value == null;
  }

  /**
   * Returns an array of all the object keys in the object(s) at the path in all
   * option layers.
   *
   * @param optionPath The option path.
   */
  getObjectKeys(optionPath: OptionPath): string[] {
    optionPath = this.canonicalizePaths(optionPath);
    const keySet = new Set<string>();
    for (const layer of this.layers) {
      const layerValue = Options.getValue(layer, optionPath);
      if (layerValue && typeof layerValue === 'object') {
        for (const item of Object.keys(layerValue)) {
          keySet.add(item);
        }
      }
    }
    return Array.from(keySet);
  }

  // * Applies the function f to every element in the array as an options view
  // * into that element. For example, calling #mapArrayValues('hAxes', f) would
  // * call f with options.view('hAxes.0'), options.view('hAxes.1'), etc.
  // * If an array does not exist at any of the given paths, null will be
  // * returned.
  // *
  // * param optionPath The option path at which
  // *     the array is located.
  // * param f The function to apply.
  // * param context The optional context object to call f with.

  // Not used currently.  Broken typing.

  // mapArrayValues<T>(
  //     optionPath: OptionPath,
  //     f: (p1: Options, p2: number) => T,
  //     context?: AnyDuringMigration
  //     ): T[]|null {
  //   const values = this.inferValue(optionPath, null, (value) => {
  //     if (typeof value === 'object') {
  //       return value;
  //     }
  //     return null;
  //   });
  //   if (!Array.isArray(values)) {
  //     return values;
  //   }
  //   return goog.array.map(values, (value, index) => {
  //     return f.call(
  //         context, this.view(Options.combinePaths(optionPath,
  //         String(index))), index);
  //   });
  // }

  /**
   * Recursively clone the srcOptions while merging with the dstOptions.
   * This is similar to goog.object.extend except it is recursive.
   * It is similar to merge_, except:
   *  - it does a deep clone of the source, though not for arrays.
   *  - nulls in source do *not* override.
   *
   * @param dstOptions The original options object.
   * @param srcOptions The options to merge in.
   */
  private static flattenHelper(
    dstOptions: {[key: string]: AnyDuringMigration},
    srcOptions: {[key: string]: AnyDuringMigration},
  ) {
    for (const key of Object.keys(srcOptions)) {
      const value = srcOptions[key];
      if (value != null && value instanceof Object && !Array.isArray(value)) {
        dstOptions[key] = dstOptions[key] || {};
        Options.flattenHelper(dstOptions[key], value);
      } else {
        // Any other type of destination value is replaced,
        // but not if the source is null or undefined.
        if (value != null) {
          dstOptions[key] = value;
        }
      }
    }
  }

  /**
   * Flattens all the layers into one object. The object to flatten into
   * is dstOptions if provided, or a new empty object.
   * Uses extend so lower priority layers do not override.
   * @param dstOptions The object to flatten into.
   * @return A single object with all the layers folded into one.
   */
  flattenLayers(dstOptions: AnyDuringMigration = {}): AnyDuringMigration {
    // Because extending an object overwrites existing fields, scan the layers
    // from lowest to highest priority.
    for (let i = this.layers.length - 1; i >= 0; i--) {
      asserts.assert(dstOptions);
      Options.flattenHelper(dstOptions, this.layers[i]);
    }
    return dstOptions;
  }

  /**
   * Gets a value from a UserOptions object by option path.
   * Searches in multiple option paths and returns the first value found.
   *
   * @param options A UserOptions object, not a gviz.Options object.
   * @param optionPath The option path.
   *     If optionPath is a string, it must be of the form "A.B.C..."
   *     which represent options[A][B][C].
   *     If optionPath is an array, each element of the array is a string
   *     of the above format, and each is used in turn to find a value;
   *     the first value found is returned.
   * @param func A transformation function to be applied onto value.
   * @param isFlat Whether we should do a flat object access.
   * @return The option's value.
   */
  private static getValue(
    options: UserOptions,
    optionPath: OptionPath,
    func?: (p1: AnyDuringMigration) => AnyDuringMigration,
    isFlat?: boolean,
  ): AnyDuringMigration | null {
    if (typeof optionPath === 'string') {
      optionPath = [optionPath];
    }
    for (let i = 0; i < optionPath.length; ++i) {
      const value = Options.getValueFromSpecificPath(
        options,
        optionPath[i],
        func,
        isFlat,
      );
      if (value != null) {
        return value;
      }
    }
    return null;
  }

  /**
   * Gets a value from an options object by option path.
   * @param options An options object, not a gviz.Options object.
   * @param optionPathString The option path. The options path is of
   *     the form "A.B.C..." which represent options[A][B][C]...
   * @param func A transformation function to be
   *     applied onto value.
   * @param isFlat Whether we should do a flat object access.
   * @return The option's value.
   */
  private static getValueFromSpecificPath(
    options: UserOptions,
    optionPathString: string,
    func?: (p1: AnyDuringMigration) => AnyDuringMigration,
    isFlat?: boolean,
  ): AnyDuringMigration | null {
    const value = isFlat
      ? options[optionPathString]
      : gvizObject.getObjectByName(optionPathString, options);
    if (value != null && typeof func === 'function') {
      return func(value);
    }
    return value;
  }

  /**
   * Returns an array of all the values from the options using the optionPath.
   * The defaultValue is appended to the end.
   *
   * The resulting array is ordered in priority from first layer to last,
   * and from first optionPath to last.  This is the same order as required for
   * getMergedObjectValues.
   *
   * @param optionPath See inferValue.
   * @param defaultValue Default values for object fields.
   * @return The option values.
   */
  getValues(
    optionPath: OptionPath,
    defaultValue?: Object | null,
  ): AnyDuringMigration[] {
    const values = [];
    if (defaultValue != null) {
      values.push(defaultValue);
    }
    optionPath = this.canonicalizePaths(optionPath);

    // Because extending an object overwrites existing fields,
    // scan the layers from lowest to highest priority, i.e. in reverse order.
    for (let i = this.layers.length - 1; i >= 0; i--) {
      // Since the extend of an object overrides the values, we need to start
      // from the last option path (which is least important).
      for (let j = optionPath.length - 1; j >= 0; j--) {
        const optionValue = Options.getValueFromSpecificPath(
          this.layers[i],
          optionPath[j],
          undefined,
          this.isFlat,
        );
        if (optionValue != null) {
          values.unshift(optionValue);
        }
      }
    }
    return values;
  }

  /**
   * Returns the merged value from the options at the optionPath specified.
   * The defaultValue or an empty object is always used to start with,
   * and then gviz.object.deepExtend() is used to merge in each option layer.
   *
   * For example, the option can specify
   *  - '{x: 1, y: 1, z: {a: 5}}'
   * and defaultValue can be
   *  - '{y: 2, z: {b: 3}}'
   * and the result would be
   *  - '{x: 1, y: 1, z: {a: 5, b: 3}}'.
   *
   * @param optionPath See inferValue.
   * @param defaultValue Default values for object fields.
   * @return The option value.
   */
  private getMergedObjectValue(
    optionPath: OptionPath,
    defaultValue?: Object | null,
  ): AnyDuringMigration {
    const result = {};
    const values = this.getValues(optionPath, defaultValue);

    // Because extending an object should overwrite existing fields,
    // scan the values from lowest to highest priority, i.e. in reverse order.
    for (let i = values.length - 1; i >= 0; i--) {
      const optionValue = values[i];
      // If a value found is not an object, just ignore it.
      if (typeof optionValue !== 'object') {
        return;
      }
      asserts.assert(typeof optionValue === 'object');
      gvizObject.deepExtend(result, optionValue);
    }
    return result;
  }

  /**
   * Gets the value from the options using the option path provided.
   * If the option is not found, the defaultValue is used.
   * If func is provided, it is applied to the value if found, or
   * the defaultValue otherwise.
   *
   * @param optionPath The option path.
   * @param defaultValue What to use if optionPath is not found.
   * @param func A function to be applied onto the found value,
   *   or defaultValue.
   * @return The option value.
   */
  inferValue<T, Q>(
    optionPath: OptionPath,
    defaultValue?: Q | null,
    func?: (value: T | Q) => T | null,
  ): T | null {
    let value = null;
    optionPath = this.canonicalizePaths(optionPath);
    for (let i = 0; i < this.layers.length; i++) {
      value = Options.getValue(this.layers[i], optionPath, func, this.isFlat);
      if (value != null) {
        return value;
      }
    }

    // Use the defaultValue instead.
    if (defaultValue != null && func) {
      value = func(defaultValue);
    } else {
      value = defaultValue as unknown as T;
    }
    return value != null ? value : null;
  }

  /**
   * Returns a deeply merged object value at the optionPath.
   * The func is applied to the value, which should return an object, or
   * null if the value is not acceptable.  If no option value is found,
   * and if there is no defaultValue, or if the func returns null, then
   * a new empty object is returned.
   *
   * This is different from inferValue in that it uses getMergedObjectValue()
   * to recursively merge at all levels and across all option layers,
   * starting with the defaultValue.
   *
   * For example, the option value can specify
   *  - '{x: 1, y: 1}'
   * and defaultValue can be
   *  - '{y: 2, z: 2}'
   * and the result would be
   *  - '{x: 1, y: 1, z: 2}'.
   *
   * @param optionPath See inferValue.
   * @param defaultValue Default values for object fields.
   * @param func A transformation function to be applied to the value.
   * @return The option value.
   */
  inferObjectValue(
    optionPath: OptionPath,
    defaultValue?: Object | null,
    func?: (p1: Object) => Object | null,
  ): Object {
    let result = this.getMergedObjectValue(optionPath, defaultValue);
    if (func) {
      result = func(result);
    }
    return result || {};
  }

  /*
   * There are two variations on how we infer values for most options, (1) with
   * and (2) without an optional default value.  Both ways convert the option
   * value found to the required type, and both can customize how the values
   * are converted with an optional settings parameter.
   *
   * 1. infer<Typed>Value(optionPath, defaultValue, converterSettings)
   *     These methods call: inferTypedValue(converter, baseValue,
   *       optionPath, defaultValue, converterSettings)
   *
   *     Returns the converted value if found, at the optionPath,
   *     or the converted default value (if != null),
   *     or the converted baseValue, or the unconverted baseValue otherwise.
   *     e.g. inferStringType uses convertToString with a baseValue of ''.
   *
   * 2. inferOptional<Typed>Value(converter, optionPath, converterSettings)
   *     These methods call: inferOptionalTypedValue(converter, baseValue,
   *       optionPath, converterSettings)
   *
   *     Returns the converted value if found, or null if not found.
   *     e.g. inferOptionalStringType.
   *
   * Note that the infer<Typed>Value methods ALWAYS return a value of the
   * right type, whereas the inferOptional<Type>Value methods MAY return null
   * if there is no value found or if the converter fails.
   *
   * All values looked up in options are passed through the converter configured
   * for that type.  If the default or base value is used, it is also converted.
   *
   * Each type of value has its own converter function, which inputs a value
   * of any type and outputs a value of the required type, or null if the
   * converter fails.  Each converter may be given an optional converterSettings
   * value to customize how the conversion is done.
   *
   * An option that is null or undefined is equivalent to it not being found,
   * at least for that path in the options.
   */

  /**
   * Finds a value at the optionPath, or uses the defaultValue or
   * the converted or unconverted baseValue otherwise.
   * The converter is applied to this value with the converterSettings.
   * S is the type of settings (which may be null)
   * T is the type of the result, and the baseValue
   * Q is the type of a value found in options, or the optional defaultValue.
   */
  inferTypedValue<S, T, Q>(
    converter: (p1: T | Q, p2?: S) => T | null,
    baseValue: T,
    optionPath: OptionPath,
    defaultValue?: Q | null,
    converterSettings?: S,
  ): T {
    const converterWithSettings = (value: T | Q): T | null => {
      return converter(value, converterSettings);
    };
    let value = this.inferValue(
      optionPath,
      defaultValue,
      converterWithSettings,
    );
    if (value == null) {
      // Convert the baseValue, which may be necessary to clone it.
      value = converterWithSettings(baseValue);
      if (value == null) {
        // Use the unconverted baseValue as last resort.
        value = baseValue;
      }
    }
    if (value == null) {
      throw new Error(`Unexpected null value for ${optionPath}`);
    }
    return value;
  }

  /**
   * Returns a value at the optionPath.
   * if a non-null defined value is found, the converter is applied to it,
   * using the converterSettings. Otherwise null will be returned.
   *
   * @template S, T
   */
  inferOptionalTypedValue<S, T, Q>(
    converter: (p1: T | Q, p2?: S) => T | null,
    optionPath: OptionPath,
    converterSettings?: S,
  ): T | null {
    const converterWithSettings = (value: T | Q): T | null => {
      return converter(value, converterSettings);
    };
    const value = this.inferValue(optionPath, null, converterWithSettings);
    if (value == null) {
      return null;
    }
    return value;
  }

  /**
   * Returns an object generated by inferring options corresponding to each
   * of the properties of the given objectProperties found at the optionPath
   * in any of the layers of this gviz.Options instance.
   * {@see TypeSpec} for details on how option types are processed.
   *
   * If no object is found, or if no properties of the resulting object have
   * non-null values, null is returned.
   *
   * If settings is specified, this value must be an object that parallels
   * the structure of objectProperties, specifying any optional settings for
   * the same set of properties.  Each settings value is passed only to
   * corresponding infer methods, unless overridden by a ObjectTypeSpec with its
   * own settings.
   * {@see #inferTextStyleValue} for an example of settings.
   */
  inferOptionalTypedObjectValue(
    objectProperties: ObjectProperties,
    optionPath: OptionPath,
    settings?: {[key: string]: AnyDuringMigration},
  ): Object | null {
    /**
     * Helper to handle any of the type specifications that may be found
     * in an ObjectProperties.  Note this ALSO handles other TypeSpecs besides
     * the ObjectTypeSpecs, for recursive handling of nested types.
     *
     * Returns the optionValue found for the optionName of type optionType,
     * or null if not found, or if the conversion fails.
     *
     * @param optionType The type for this option.
     * @param optionName Used recursively when looking up options.
     * @param settings Additional settings passed to infer methods.
     */
    const handleAnyTypeSpec = (
      optionType: TypeSpec,
      optionName: string,
      settings?: AnyDuringMigration,
    ): AnyDuringMigration => {
      // The returned value
      let optionValue = null;

      /**
       * Helper to handle the case when optionType is an ObjectTypeSpec.
       */
      const handleObjectTypeSpec = () => {
        const objectTypeSpec = optionType as ObjectTypeSpec;
        const type = objectTypeSpec.type;

        // optionType MUST HAVE a type property.
        asserts.assert(type);

        // Is it an 'object' type spec, or some other type.
        if (type === 'object') {
          // { type: 'object', properties: { a: typeSpec, b: typeSpec }}
          // Recurse on the ObjectProperties in properties.
          const objectType = objectTypeSpec.properties!;
          asserts.assert(
            objectType,
            'Properties required for "object" type of ' + optionName,
          );
          asserts.assert(
            settings === undefined || typeof settings === 'object',
            'Non-null settings for ObjectProperties of ' +
              optionName +
              ' must be an object.',
          );

          // Create a view relative to the optionName.
          const propOptions = this.view(optionName);
          optionValue = propOptions.inferOptionalTypedObjectValue(
            objectType,
            '',
            settings,
          );
        } else {
          // For any other type, handle recursively.
          // e.g. { type: 'string', settings: enum }
          // Override the type's name and settings with dynamic values.
          optionValue = handleAnyTypeSpec(
            type,
            asserts.assertString(optionName || objectTypeSpec.name),
            settings || objectTypeSpec.settings,
          );
        }
      };
      if (Array.isArray(optionType)) {
        // An Array of alternative types.  Return first non-null result.
        // e.g. [number, string]
        optionType.find((altType) => {
          optionValue = handleAnyTypeSpec(altType, optionName, settings);
          return optionValue != null;
        });
      } else {
        if (gvizObject.asObjectOrNull(optionType)) {
          // Examples:
          // { type: 'string', settings: enum }
          // { type: 'object', properties: { a: typeSpec, b: typeSpec }}
          handleObjectTypeSpec();
        } else {
          if (typeof optionType === 'string') {
            // Must be a NamedOptionType.
            // e.g. 'string' or 'arrayOfString'
            const namedType = optionType;
            const typeSpec = NAMED_TYPE_SPEC_MAP[namedType];
            asserts.assert(typeSpec, 'Unknown option type: ' + namedType);
            optionValue = handleAnyTypeSpec(typeSpec, optionName, settings);
          } else {
            if (typeof optionType === 'function') {
              // Here we finally use the optionName to find an option.
              optionValue = optionType.call(this, optionName, settings);
            }
          }
        }
      }
      return optionValue;
    };

    // Process the objectProperties out here, since recursive calls on
    // inferOptionalTypedObjectValue set up a new context for processing
    // the properties at that level, while handleAnyTypeSpec processes options
    // within the object.
    let result: AnyDuringMigration = null;
    for (const p in objectProperties) {
      if (!objectProperties.hasOwnProperty(p)) continue;
      const typeSpec = objectProperties[p];
      const optionName = typeSpec.name!;
      asserts.assert(optionName, `Name required for type of property ${p}`);
      const optionValue = handleAnyTypeSpec(
        typeSpec,
        optionName,
        settings && settings[p],
      );
      if (optionValue != null) {
        if (result == null) {
          result = {};
        }
        result[p] = optionValue;
      }
    }
    return result;
  }

  /**
   * Converts a value to an object.  If func is specified, this function
   * is applied to the value.  If the resulting value is not a strict object
   * (i.e. not an Array, Function or Date) then null is returned.
   *
   * @param value The original value.
   * @return The value as object, or null if unable to convert.
   */
  static convertToObject(
    value: AnyDuringMigration,
    func?: (p1: AnyDuringMigration) => Object | null,
  ): Object | null {
    if (func) {
      value = func(value);
    }
    return gvizObject.asObjectOrNull(value);
  }

  /**
   * Returns the whole object value found at optionPath.  Unlike
   * inferObjectValue, the result is NOT merged with other objects.  If not
   * found, the defaultValue or a new empty object will be used.  If the func is
   * specified, it will be applied to the value, and it must return an Object.
   *
   */
  inferWholeObjectValue(
    optionPath: OptionPath,
    defaultValue?: Object | null,
    func?: (p1: AnyDuringMigration) => Object,
  ): Object {
    return this.inferTypedValue(
      Options.convertToObject,
      {},
      optionPath,
      defaultValue || {},
      func,
    );
  }

  /**
   * Converts a value to a string, but not if it is null or an Object.
   * If enumObj is specified, it must be an enum of strings,
   * and it is used to check if the parameter value is
   * a valid string for this enum.  If not valid, it returns null.
   *
   * @param value The original value.
   * @param enumObj The enum object or a string array.
   * @return The value as string, or null if unable to convert.
   */
  static convertToString(
    value: AnyDuringMigration,
    enumObj?: {[key: string]: string | null} | {[k: number]: string} | string[],
  ): string | null {
    const strValue =
      value != null && typeof value !== 'object' ? String(value) : null;
    if (!enumObj) {
      return strValue;
    } else if (Array.isArray(enumObj)) {
      return strValue != null && enumObj.includes(strValue) ? strValue : null;
    } else {
      return Object.values(enumObj).includes(strValue) ? strValue : null;
    }
  }

  /**
   * Returns a string value for the option at optionPath.
   * If not found, the defaultValue or empty string is used.
   * If enumObj is specified, then the string value must match one of
   * the enum string values.  If it fails to match, an empty string is returned.
   *
   * @param enumObj An enum of strings.
   * @return The option value of type string, or ''.
   */
  inferStringValue(
    optionPath: OptionPath,
    defaultValue?: string,
    enumObj?:
      | {[key in NamedOptionType]: string}
      | {[k: number]: string}
      | string[],
  ): string {
    return this.inferTypedValue(
      Options.convertToString,
      '',
      optionPath,
      defaultValue,
      enumObj,
    );
  }

  /**
   * Returns a string value for the option at optionPath, or null if not found.
   * If enumObj is specified, then the string value must match one of the
   * enum string values.
   *
   * @param enumObj An enum of strings.
   * @return The option value of type string, or null if not found.
   */
  inferOptionalStringValue(
    optionPath: OptionPath,
    enumObj?:
      | {[key in NamedOptionType]: string}
      | {[k: number]: string}
      | string[],
  ): string | null {
    return this.inferOptionalTypedValue(
      Options.convertToString,
      optionPath,
      enumObj,
    );
  }

  /**
   * Same as inferStringValue, with different order of arguments.
   * @deprecated Use inferStringValue(optionPath, defaultValue, enumObj)
   * TODO(dlaliberte): Replace all calls with:
   *   inferStringValue(optionPath, defaultValue, enumObj)
   *
   * @param enumObj The enum object.
   * @return The option value of type string if found., and if it
   *     matches a valid enum value, otherwise returns defaultValue.
   */
  inferEnumValue(
    optionPath: OptionPath,
    enumObj: {[key in NamedOptionType]: string} | {[k: number]: string},
    defaultValue?: string,
  ): string {
    return this.inferStringValue(optionPath, defaultValue, enumObj);
  }

  /**
   * Identical to inferOptionalStringValue.
   * @deprecated Use inferOptionalStringValue(optionPath, enumObj)
   * TODO(dlaliberte): Replace all calls with:
   *   inferOptionalStringValue(optionPath, enumObj)
   */
  inferOptionalEnumValue(
    optionPath: OptionPath,
    enumObj?:
      | {[key in NamedOptionType]: string}
      | {[k: number]: string}
      | string[],
  ): string | null {
    return this.inferOptionalStringValue(optionPath, enumObj);
  }

  /**
   * Converts a value into an Array of string, or returns null if it can't.
   * The value can be a string by itself, which is wrapped in an Array of that
   * string, or else it must be an array of values which are converted to
   * strings. If an enumObj is specified, each of the strings must match
   * one of the enum strings or else they will be filtered out.
   *
   * @param value The original value.
   * @param enumObj The enum object.
   * @return The value as an array of string, or null if unable
   *     to convert.
   */
  static convertToStringArray(
    value: string | null | AnyDuringMigration[],
    enumObj?: {[key: string]: string | null},
  ): string[] | null {
    if (value == null) {
      return null;
    }
    if (typeof value === 'string') {
      value = [value];
    }
    if (Array.isArray(value)) {
      return value
        .map((value) => {
          return Options.convertToString(value, enumObj);
        })
        .filter((value) => value != null) as string[];
    } else {
      return null;
    }
  }

  /**
   * Returns a string array value for the option at optionPath.
   * If not found, the defaultValue or empty array is used.
   * If enumObj is specified, then each string value must match one of
   * the enum string values, or it will be filtered out.
   *
   * @param enumObj An enum of strings.
   * @return The option value of type string[] or [].
   */
  inferStringArrayValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
    enumObj?: {[key: string]: string | null},
  ): string[] {
    return this.inferTypedValue(
      Options.convertToStringArray,
      [],
      optionPath,
      defaultValue,
      enumObj,
    );
  }

  /**
   * Returns a string array value for the option at optionPath, or null if not
   * found. If enumObj is specified, then each string value must match one of
   * the enum string values, or it will be replaced by null.
   *
   * @param enumObj An enum of strings.
   * @return The option value of type Array of string, or null.
   */
  inferOptionalStringArrayValue(
    optionPath: OptionPath,
    enumObj?: {[key: string]: string | null},
  ): string[] | null {
    return this.inferOptionalTypedValue(
      Options.convertToStringArray,
      optionPath,
      enumObj,
    );
  }

  /**
   * Converts a value to type boolean.
   * Alternative representations are 1 or '1' or 'true' for true
   * and 0 or '0' or 'false' for false.  Mixed case is also allowed.
   *
   * @param value The original value.
   * @return The value as boolean, or null if unable to convert.
   */
  static convertToBoolean(
    value: boolean | number | string | null,
  ): boolean | null {
    if (value == null) {
      return null;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const s = String(value); // Converts number to string.
    if (s === '1' || s.toLowerCase() === 'true') {
      return true;
    } else {
      if (s === '0' || s.toLowerCase() === 'false') {
        return false;
      } else {
        return null;
      }
    }
  }

  /**
   * Returns a boolean value for the option at optionPath.
   * If not found, the defaultValue or false is used.
   *
   * @return The option value of type boolean, or false.
   */
  inferBooleanValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
  ): boolean {
    return this.inferTypedValue(
      Options.convertToBoolean,
      false,
      optionPath,
      defaultValue,
    );
  }

  /**
   * Returns a boolean value for the option at optionPath, or null if not found.
   *
   * @return The option value of type boolean, or null if not found.
   */
  inferOptionalBooleanValue(optionPath: OptionPath): boolean | null {
    return this.inferOptionalTypedValue(Options.convertToBoolean, optionPath);
  }

  /**
   * Converts a value to type number, or null if unable to convert.
   * Uses goog.string.toNumber to parse string.
   *
   * @param value The original value.
   * @return The value as number, or null if unable to convert.
   */
  static convertToNumber(value: number | string | null): number | null {
    if (value == null) {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    const res = Number(String(value).trim());
    return isNaN(res) ? null : res;
  }

  /**
   * Returns a number value for the option at optionPath.
   * If not found, the defaultValue or 0 is used.
   *
   * @return The option value of type number, or 0.
   */
  inferNumberValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
  ): number {
    return this.inferTypedValue(
      Options.convertToNumber,
      0,
      optionPath,
      defaultValue,
    );
  }

  /**
   * Returns a number value for the option at optionPath, or null if not found.
   *
   * @return The option value of type number, or null if not found.
   */
  inferOptionalNumberValue(optionPath: OptionPath): number | null {
    return this.inferOptionalTypedValue(Options.convertToNumber, optionPath);
  }

  /**
   * Converts a value to type number or string.
   * @param value The original value.
   * @return The value as number, string, or null if unable to
   *   convert.
   */
  static convertToNumberOrString(
    value: number | string | null,
  ): number | string | null {
    if (value == null) {
      return null;
    }
    if (typeof value === 'number' || typeof value === 'string') {
      return value;
    }
    return null;
  }

  /**
   * Returns a number or string value for the option at optionPath.
   * If not found, the defaultValue or 0 is used.
   *
   * @return The option value of type number, or 0.
   */
  inferNumberOrStringValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
  ): number | string {
    return this.inferTypedValue(
      Options.convertToNumberOrString,
      0,
      optionPath,
      defaultValue,
    );
  }

  /**
   * Returns a number or string value for the option at optionPath,
   * or null if not found.
   *
   * @return The option value of type number or string,
   *      or null if not found.
   */
  inferOptionalNumberOrStringValue(
    optionPath: OptionPath,
  ): number | string | null {
    return this.inferOptionalTypedValue(
      Options.convertToNumberOrString,
      optionPath,
    );
  }

  /**
   * Converts a value to type number, string, or boolean.
   * @param value The original value.
   * @return The value as number, string, boolean, or
   *   null if unable to convert.
   */
  static convertToPrimitive(
    value: number | string | boolean | null,
  ): number | string | boolean | null {
    if (value == null) {
      return null;
    }
    if (
      typeof value === 'number' ||
      typeof value === 'string' ||
      typeof value === 'boolean'
    ) {
      return value;
    }
    return null;
  }

  /**
   * Returns a number, string, or boolean value for the option at optionPath.
   * If not found, the defaultValue or 0 is used.
   *
   * @return The option value of type number, string,
   *     boolean, or 0 if not found.
   */
  inferPrimitiveValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
  ): number | string | boolean {
    return this.inferTypedValue(
      Options.convertToPrimitive,
      0,
      optionPath,
      defaultValue,
    );
  }

  /**
   * Returns a number, string, or boolean value for the option at optionPath,
   * or null if not found.
   *
   * @return The option value of type number, string,
   *      or boolean, or null if not found.
   */
  inferOptionalPrimitiveValue(
    optionPath: OptionPath,
  ): number | string | boolean | null {
    return this.inferOptionalTypedValue(Options.convertToPrimitive, optionPath);
  }

  /**
   * Converts a value to type Array<number>.
   * @param value The original value.
   * @return The value as a number[], or null if unable to convert.
   */
  static convertToNumberArray(value: AnyDuringMigration): number[] | null {
    if (value == null) {
      return null;
    }
    if (Array.isArray(value)) {
      return value
        .map(Options.convertToNumber)
        .filter((value) => value != null) as number[];
    }
    return null;
  }

  /**
   * Returns a number array value for the option at optionPath.
   * If not found, the defaultValue or empty array is used.
   *
   * @return The option value of type Array of number, or [].
   */
  inferNumberArrayValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
  ): number[] {
    return this.inferTypedValue(
      Options.convertToNumberArray,
      [],
      optionPath,
      defaultValue || [],
    );
  }

  /**
   * Returns a number array value for the option at optionPath, or null if not
   * found.
   *
   * @return The option value of type Array of number, or null.
   */
  inferOptionalNumberArrayValue(optionPath: OptionPath): number[] | null {
    return this.inferOptionalTypedValue(
      Options.convertToNumberArray,
      optionPath,
    );
  }

  /**
   * Converts a value to type non-negative number.
   * @param value The original value.
   * @return The value as number, or null if unable to convert.
   */
  static convertToNonNegativeNumber(value: AnyDuringMigration): number | null {
    const num = Options.convertToNumber(value);
    return num != null && num >= 0 ? num : null;
  }

  /**
   * Returns a non-negative number value for the option at optionPath.
   * If not found, the defaultValue or 0 is used.
   *
   * @return The option value of type number, or 0.
   */
  inferNonNegativeNumberValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
  ): number {
    return this.inferTypedValue(
      Options.convertToNonNegativeNumber,
      0,
      optionPath,
      defaultValue,
    );
  }

  /**
   * Returns a non-negative number value for the option at optionPath,
   * or null if not found.
   *
   * @return The option value of type number, or null if not found.
   */
  inferOptionalNonNegativeNumberValue(optionPath: OptionPath): number | null {
    return this.inferOptionalTypedValue(
      Options.convertToNonNegativeNumber,
      optionPath,
    );
  }

  /**
   * Converts a value to type ratio number (ranged [0-1] inclusive).
   * The numeric value is clamped to the [0-1] range.
   * @param value The original value.
   * @return The value as number, or null if unable to convert.
   */
  static convertToRatioNumber(value: AnyDuringMigration): number | null {
    const num = Options.convertToNumber(value);
    return num != null ? Math.min(Math.max(num, 0), 1) : null;
  }

  /**
   * Returns a number in the range [0-1] for the option at optionPath.
   * If not found, the defaultValue or 0 is used.
   *
   * @return The option value of type number, or 0.
   */
  inferRatioNumberValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
  ): number {
    return this.inferTypedValue(
      Options.convertToRatioNumber,
      0,
      optionPath,
      defaultValue,
    );
  }

  /**
   * Returns a number in the range [0-1] for the option at optionPath,
   * or null if not found.
   *
   * @return The option value of type number, or null if not found.
   */
  inferOptionalRatioNumberValue(optionPath: OptionPath): number | null {
    return this.inferOptionalTypedValue(
      Options.convertToRatioNumber,
      optionPath,
    );
  }

  /**
   * Converts a value to type string and parses it as color.  The color value
   * is returned as a hex string (e.g. #ff00ff) or special color name, if valid,
   * or null if not.
   *
   * Also allowed, for backward compatibility, is a color object of the form
   * {'color': 'red', 'lighter': 'pink', 'darker': 'darkred'}.  But there
   * would be an ambiguity between color objects and other objects such as
   * the result of parsing the style "fill { opacity: 0.25 }".
   * {@see google.visualization.style.parseStyle}
   * The object is accepted as a color if it has a 'color', 'lighter' or
   * 'darker' property.
   *
   * Some special color names are supported in a couple cases.
   * - If the value is the empty string, the special color
   *     gviz.graphics.util.NO_COLOR ('none') is returned.
   * - The array additionalValues may list more color names to be considered
   *     as valid, and if one of these is found, it will be used as
   *     the converted color.
   * TODO(dlaliberte): value and return value should allow !Object,
   * since that is how it has been used for many years.  Perhaps colors should
   * be converted to objects always, and include support for opacity.
   *
   * @param value The original value.
   * @param additionalValues Additional valid string names.
   * @return The parsed value as a string, or null if invalid.
   */
  static convertToColor(
    value: AnyDuringMigration,
    additionalValues?: string[],
  ): string | null {
    if (value == null) {
      return null;
    }
    if (value === '') {
      return util.NO_COLOR;
    }
    if (typeof value === 'object') {
      // This is the special case where the value is an Object.
      // But check that it is of the right form.
      if (value['color'] || value['lighter'] || value['darker']) {
        return value;
      } else {
        return null;
      }
    }
    const res = Options.convertToString(value);
    if (
      Array.isArray(additionalValues) &&
      res != null &&
      additionalValues.includes(res)
    ) {
      return res;
    }
    try {
      return util.parseColor(res);
    } catch (e: unknown) {
      return null;
    }
  }

  /**
   * Returns a value of type string that is the parsed color value or
   * special name. If additionalValues is specified, this is passed to
   * convertToColor to provide additional color names.  If no valid color
   * is found, NO_COLOR is returned.
   * TODO(dlaliberte): defaultValue and return value should allow !Object,
   * since that is how it has been used for many years.
   *
   * @return The converted value of type string, otherwise
   *     the default value, if defined, or NO_COLOR ('none').
   */
  inferColorValue(
    optionPath: OptionPath,
    defaultValue?: string,
    additionalValues?: string[],
  ): string {
    return this.inferTypedValue(
      Options.convertToColor,
      util.NO_COLOR,
      optionPath,
      defaultValue,
      additionalValues,
    );
  }

  /**
   * Returns a value of type string that is the parsed color value or
   * special name. If additionalValues is specified, this is passed to
   * convertToColor to provide additional color names.  If no valid color
   * is found, null is returned.
   *
   * @return The converted value of type string, otherwise
   *     the default value, if defined, or null if no valid color is found.
   */
  inferOptionalColorValue(
    optionPath: OptionPath,
    additionalValues?: string[],
  ): string | null {
    return this.inferOptionalTypedValue(
      Options.convertToColor,
      optionPath,
      additionalValues,
    );
  }

  /**
   * Same as {@see inferValue}, but returns a time of day array.
   * TODO(dlaliberte): Decide if this is obsolete.
   *
   * @param optionPath See inferValue.
   * @return The time of day array if present, otherwise returns
   *     null.
   */
  inferOptionalTimeOfDayValue(optionPath: OptionPath): number[] | null {
    const value = this.inferValue(optionPath, null);
    if (typeof value === 'string') {
      // First assume hour format (HH:MM:SS).
      let tokens = value.split(':');
      if (tokens.length === 1) {
        // Assume a list of numbers (HH,MM,SS).
        tokens = value.split(',');
      }
      if (tokens.length === 3) {
        const hours = Number(tokens[0].trim());
        const minutes = Number(tokens[1].trim());
        const seconds = Number(tokens[2].trim());
        if (seconds >= 0 && minutes >= 0 && hours >= 0) {
          return [hours, minutes, seconds];
        }
      }
    }
    if (!Array.isArray(value) || (value.length !== 3 && value.length !== 4)) {
      return null;
    }
    return value as number[] | null;
  }

  /**
   * Converts a value to a number. The value can be either a number, or a
   * string that is a number followed by '%'. In the percent case, it's
   * converted to the percentage of the whole. The value is always clamped
   * between 0 and 'whole'. The 'whole' number MAY be negative, and 1 is used if
   * not specified. If the value cannot be converted, null is returned.
   *
   * @param value The original value.
   * @param whole The value to be considered as 100%.
   * @return The value as a number, or null if unable to convert.
   */
  static convertAbsOrPercentageToNumber(
    value: AnyDuringMigration,
    whole?: number,
  ): number | null {
    whole = whole != null ? whole : 1;
    asserts.assert(isFinite(whole), '"whole" must be a finite number.');
    let result = Options.convertToNumber(value);
    if (result == null) {
      // Check if value is a percentage string.
      let strValue = Options.convertToString(value);
      if (strValue != null) {
        strValue = strValue.trim();
        if (strValue.endsWith('%')) {
          // The value is a percentage string.
          const strNum = strValue.slice(0, -1); // remove '%'.
          const percentage = Number(strNum);
          result = (whole * percentage) / 100;
        }
      }
    }
    if (result != null) {
      if (whole === 0) {
        result = 0;
      } else {
        // Clamp the result between 0 and 'whole'.
        result = whole * Math.min(Math.max(result / whole, 0), 1);
      }
    }
    return result;
  }

  /**
   * Returns an absolute or percentage value converted to a number for the
   * option at optionPath.  If not found, the defaultValue or 0 is used.
   * A percentage value is relative to the optional whole parameter.
   *
   * @return The option value of type number, or 0.
   */
  inferAbsOrPercentageValue(
    optionPath: OptionPath,
    defaultValue?: AnyDuringMigration,
    whole?: number,
  ): number {
    return this.inferTypedValue(
      Options.convertAbsOrPercentageToNumber,
      0,
      optionPath,
      defaultValue,
      whole,
    );
  }

  /**
   * Returns an absolute or percentage value converted to a number for the
   * option at optionPath.  If not found, null is returned.
   *
   * @return The option value of type number, or 0.
   */
  inferOptionalAbsOrPercentageValue(
    optionPath: OptionPath,
    whole?: number,
  ): number | null {
    return this.inferOptionalTypedValue(
      Options.convertAbsOrPercentageToNumber,
      optionPath,
      whole,
    );
  }

  /**
   * Returns a Brush from the options at the optionPath, or in the
   * defaultValue.
   *
   * As a special case, any value found, including the defaultValue,
   * could be a string that we parse to a hex color, which is then used
   * as the fill color.  The defaultValue could instead be a Brush, or
   * BrushProperties.
   *
   * @param
   *     defaultValue
   * @return The brush object.
   */
  inferBrushValue(
    optionPath: OptionPath,
    defaultValue?: string | BrushProperties | Brush,
  ): Brush {
    // Determine how to handle the defaultValue.
    let defaultBrush = null;
    let value = null;
    if (defaultValue instanceof Brush) {
      // Use this as the starting brush below.
      defaultBrush = new Brush(defaultValue.getProperties());
    } else {
      // Must be a string or a gviz.graphics.Brush.BrushProperties.
      // or null or undefined.
      if (typeof defaultValue === 'object') {
        // Must be gviz.graphics.Brush.BrushProperties, so create a defaultBrush
        // with these properties.
        defaultBrush = new Brush(defaultValue);
      } else {
        // Must be a string, so use it as the fill color.
        value = defaultValue;
      }
    }
    let values = this.getValues(optionPath, value);

    // Special case for fill: some of the values found at any layer/optionPath
    // or defaultValue may be just a string, interpreted as the fill color. So
    // we need to convert those to objects with 'fill' color.
    values = values.map((fillOrObj) => {
      // Note: fillOrObj might be an empty string.
      if (typeof fillOrObj === 'string') {
        fillOrObj = {'fill': Options.convertToColor(fillOrObj)};
      }
      return fillOrObj;
    });

    // Use values, which is now an Array of Object, as layers in a new Options
    // object, from which we can just extract the brush properties.
    const options = new Options(values);
    const props = options.inferOptionalTypedObjectValue(BRUSH_OPTION_TYPE, '');
    const brush = defaultBrush || new Brush();
    brush.setProperties(props as BrushProperties);

    // Special case for Brush options:
    // If no fill, use transparent brush that catches events.
    // We don't do this for all Brushes, yet.
    const transparentBrush = Brush.TRANSPARENT_BRUSH;
    if (!brush.hasFill()) {
      brush.setFill(transparentBrush.fill);
      brush.setFillOpacity(transparentBrush.fillOpacity);
    }

    // Similarly for no stroke.
    if (!brush.hasStroke()) {
      brush.setStroke(transparentBrush.stroke);
      brush.setStrokeOpacity(transparentBrush.strokeOpacity);
    }
    return brush;
  }

  /**
   * Returns a TextStyle object from the options at the optionPath using
   * properties of the defaultValue for properties not found in the options.
   * If no defaultValue is provided, the default TextStyle values will be
   * used.
   *
   * @param optionPath See inferObjectValue.
   * @return The text style created.
   */
  inferTextStyleValue(
    optionPath: OptionPath,
    defaultValue?: Partial<TextStyleProperties>,
    additionalColorValues?: string[],
  ): TextStyle {
    const values = this.getValues(optionPath);
    const options = new Options(values);
    const textStyleSettings = {
      color: additionalColorValues,
      auraColor: additionalColorValues,
    };
    const props = options.inferOptionalTypedObjectValue(
      TEXT_STYLE_OPTION_TYPE,
      '',
      textStyleSettings,
    );
    const textStyle = new TextStyle(defaultValue || {});
    textStyle.setProperties(props as Partial<TextStyleProperties> | null);
    return textStyle;
  }
}

// These are defined after the infer methods, which are the values associated
// with each type name.
NAMED_TYPE_SPEC_MAP = {
  'string': Options.prototype.inferOptionalStringValue,
  'number': Options.prototype.inferOptionalNumberValue,
  'boolean': Options.prototype.inferOptionalBooleanValue,
  'numberOrString': ['number', 'string'],
  'primitive': Options.prototype.inferOptionalPrimitiveValue,
  // TODO(dlaliberte): Maybe use: ['number', 'boolean', 'string'],
  'ratio': Options.prototype.inferOptionalRatioNumberValue,
  'nonNegative': Options.prototype.inferOptionalNonNegativeNumberValue,
  'absOrPercentage': Options.prototype.inferOptionalAbsOrPercentageValue,
  'arrayOfNumber': Options.prototype.inferOptionalNumberArrayValue,
  'arrayOfString': Options.prototype.inferOptionalStringArrayValue,
  'color': Options.prototype.inferOptionalColorValue,
  'object': Options.prototype.inferObjectValue,
};

// Code to handle options for DateTicksUnitConfig.
// Not used now, but will do so once we resolve typing issue.

/**
 * The type specification for a single DateTicksUnitConfig option.
 */
// const DATE_TICKS_UNIT_CONFIG_TYPE: ObjectProperties = {
//   format: {name: 'format', type: 'arrayOfString'},
//   interval: {name: 'interval', type: 'arrayOfNumber'}
// };

/**
 * Returns a DateTicksUnitConfig object if found at the optionPath, or in
 * defaultValue. Otherwise, it returns an object with empty arrays.
 *
 * @return The unit config.
 */
// inferDateTicksUnitConfigValue(
//     optionPath: OptionPath,
//     defaultValue?: DateTicksUnitConfig): DateTicksUnitConfig {
//   const defaultProps = defaultValue || {format: [], interval: []};
//   const values = this.getValues(optionPath);
//   const options = new Options(values);
//   const props = options.inferOptionalTypedObjectValue(
//       DATE_TICKS_UNIT_CONFIG_TYPE, '');
//   const result = (props || {} as DateTicksUnitConfig);
//   result.format = result.format || defaultProps.format;
//   result.interval = result.interval || defaultProps.interval;
//   return result;
// }
