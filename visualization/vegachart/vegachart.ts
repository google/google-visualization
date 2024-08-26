/**
 * @fileoverview A 'vega' visualization.
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

import * as vega from 'vega';
import {AnyCallbackWrapper} from '../../common/async_helper';
import {Options as GvizOptions, UserOptions} from '../../common/options';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {Data} from '../../data/data';
import {DataObject, Value} from '../../data/types';
import {ChartEventDispatcher} from '../../events/chart_event_dispatcher';
import {ChartEventType} from '../../events/chart_event_types';
import {calcChartAreaLayout} from '../../graphics/chart_area';
import {VegaVisualization} from '../../visualization/vega/vega-visualization';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * The VegaChart visualization
 */
export class VegaChart extends VegaVisualization {
  height = 0;
  width = 0;

  private readonly chartEventDispatcher: ChartEventDispatcher;
  private clearListeners?: () => void;

  /**
   * Creates a new instance of a VegaChart, still with one hardcoded chart.
   * The container is a DOM element which will contain the visualization.
   */
  constructor(container: Element | null) {
    super(container);

    /**
     * Dispatcher of chart events.
     */
    this.chartEventDispatcher = new ChartEventDispatcher(this);
  }

  getSelection(): [] {
    return [];
  }

  setSelection() {}

  /**
   * Calculates and merges user options with the vega spec options for height,
   *  width, and padding.  Modify the spec options accordingly.
   *  Precedence is the same as for other charts, but with the override
   *  by the vega specs, if specified.
   *
   *  1.a user options size,
   *  1.b vega spec size,
   *  2. container size,
   *  3. default size (400 x 200).
   */
  updateContainerDimensions(options: GvizOptions) {
    const containerWidth = this.getWidth(options);
    const containerHeight = this.getHeight(options);

    // Get all the user-defined chartArea options.
    // These are now all numbers for sizes. Any percentage values
    // are converted relative to the container width or height.
    const userChartArea = {
      width: options.inferOptionalAbsOrPercentageValue(
        'chartArea.width',
        containerWidth,
      ),
      left: options.inferOptionalAbsOrPercentageValue(
        'chartArea.left',
        containerWidth,
      ),
      right: options.inferOptionalAbsOrPercentageValue(
        'chartArea.right',
        containerWidth,
      ),
      height: options.inferOptionalAbsOrPercentageValue(
        'chartArea.height',
        containerHeight,
      ),
      top: options.inferOptionalAbsOrPercentageValue(
        'chartArea.top',
        containerHeight,
      ),
      bottom: options.inferOptionalAbsOrPercentageValue(
        'chartArea.bottom',
        containerHeight,
      ),
    };

    // Note that this ChartArea type defines positions of the chart area,
    // not sizes, for left, right, top, bottom.
    const chartArea = calcChartAreaLayout(
      containerWidth,
      containerHeight,
      userChartArea,
    );

    // Compute the padding sizes from the chartArea positions, but only if
    // the user options specified a corresponding value.
    const padding = {
      top:
        userChartArea.top != null //
          ? chartArea.top
          : undefined,
      bottom:
        userChartArea.bottom != null //
          ? containerHeight - chartArea.bottom
          : undefined,
      left:
        userChartArea.left != null //
          ? chartArea.left
          : undefined,
      right:
        userChartArea.right != null //
          ? containerWidth - chartArea.right
          : undefined,
    };

    const spec: AnyDuringMigration = this.vegaLiteSpec || this.vegaSpec || {};
    const hwp = {
      height: spec['height'] ?? chartArea.height,
      width: spec['width'] ?? chartArea.width,
      padding: spec['padding'],
    };

    const specPadding = hwp.padding ?? {};
    // If the padding is either a single number or a SignalRef, we leave it
    // as is.  Otherwise, it must be an object, so we can add missing values.
    if (typeof specPadding === 'object') {
      const specPaddingObject = specPadding as {
        top?: number;
        bottom?: number;
        left?: number;
        right?: number;
      };
      specPaddingObject.top = specPaddingObject.top ?? padding.top;
      specPaddingObject.bottom = specPaddingObject.bottom ?? padding.bottom;
      specPaddingObject.left = specPaddingObject.left ?? padding.left;
      specPaddingObject.right = specPaddingObject.right ?? padding.right;
      hwp.padding = specPaddingObject;
    }

    // Only apply height, width, padding, and autosize options if
    // not using vegaLite's *concat, facet, or repeat layouts, which
    // don't use these top level options as expected.
    // In fact, don't use any of these overrides, since they will override
    // the default behavior of Vega. We'll have to revisit this later.
    //
    // TODO(b/191368136) Decide how to override vega size-related specs.
    //     if (!this.vegaLiteSpec ||
    //         !(spec['concat'] || spec['vconcat'] || spec['hconcat'] ||
    //           spec['facet'] || spec['repeat'])) {
    //       // Modify whatever is in spec.
    //       spec['height'] = hwp['height'];
    //       spec['width'] = hwp['width'];
    //       spec['padding'] = hwp['padding'];

    //       spec['autosize'] =
    //           spec['autosize'] ?? {type: 'none', contains: 'content'};
    //     }
  }

  /**
   * Draws the chart. This is overridden by each visualization.
   * @param asyncWrapper A function that accepts a callback (and possibly a
   *     'this' context object) and wraps it for async execution.
   * @param data The data table.
   * @param userOptions The visualization options.
   * @param state The state of the chart.
   */
  override drawInternal(
    asyncWrapper: AnyCallbackWrapper, //
    data: AbstractDataTable, //
    userOptions: UserOptions = {}, //
    state: {},
  ) {
    // TODO(dlaliberte): Add error handling.
    // google.visualization.errors.removeAll(this.container);

    // Initialize the options with the user and default options.
    const options = new GvizOptions([userOptions, {}]);

    this.getVegaSpecFromOptions(options);

    this.updateContainerDimensions(options);

    this.addDataToOptions(options, data);

    this.processVegaSpec();

    const eventListeners = options.inferValue('eventListeners') ?? {};
    const signalListeners = options.inferValue('signalListeners') ?? {};

    const afterDrawing = (view: vega.View) => {
      this.chartEventDispatcher.dispatchEvent(ChartEventType.READY);
      for (const [name, handler] of Object.entries(eventListeners)) {
        view.addEventListener(name, handler as vega.EventListenerHandler);
      }
      for (const [name, handler] of Object.entries(signalListeners)) {
        view.addSignalListener(name, handler as vega.SignalListenerHandler);
      }
      this.clearListeners = () => {
        for (const [name, handler] of Object.entries(eventListeners)) {
          view.removeEventListener(name, handler as vega.EventListenerHandler);
        }
        for (const [name, handler] of Object.entries(signalListeners)) {
          view.removeSignalListener(
            name,
            handler as vega.SignalListenerHandler,
          );
        }
      };
    };
    this.drawInVegaContainer(asyncWrapper, afterDrawing);
  }

  // Merge the user data with the vega data or vegaLite datasets spec.
  // TODO(dlaliberte) Integrate this with Options processing.
  addDataToOptions(options: GvizOptions, data: AbstractDataTable) {
    // Build a map from vega data 'name' properties to DataObject(s).
    const dataVegaObjectsToMap = (
      dataObjects?: vega.Data[] | DataObject | DataObject[] | null,
    ) => {
      const dataMap: {[s: string]: {}} = {};
      if (dataObjects) {
        // Normalize the dataObjects to be an array.
        dataObjects = Array.isArray(dataObjects) ? dataObjects : [dataObjects];
        for (const dataObject of dataObjects) {
          // Note that dataObject includes the 'name' and 'value' properties.
          const key = dataObject['name'];
          dataMap[key] = dataObject;
        }
      }
      return dataMap;
    };

    // Build a map from names to DataObject|DataRecords
    let vegaDataMap: {[key: string]: AnyDuringMigration} = this.vegaLiteSpec
      ? this.vegaLiteSpec['datasets'] || {}
      : this.vegaSpec != null
        ? dataVegaObjectsToMap(this.vegaSpec.data)
        : {};

    // List of names of data objects, used later to reconstruct vegaDataSpec.
    let names = Object.keys(vegaDataMap);
    if (data instanceof Data) {
      // If data is a Data object, merge its data into the vega data map.
      const userDataMap = dataVegaObjectsToMap(data.getData());
      // The userDataMap entries should override vegaDataMap of the same name,
      // so we spread its entries last.
      vegaDataMap = {...vegaDataMap, ...userDataMap};
      // But new data entries in userDataMap must come first in the list,
      // which we do by removing its names from names, and then adding to the
      // front of the list.
      const userNames = Object.keys(userDataMap);
      names = names.filter((name) => userNames.indexOf(name) === -1);
      names = [...userNames, ...names];
    } else {
      // If data is a datatable or dataview, convert it to vega.ValuesData,
      // and add it as the 'datatable' property, overiding any pre-existing
      // 'datatable'.
      if (names.indexOf('datatable') === -1) {
        names.unshift('datatable');
      }
      vegaDataMap = {
        ...vegaDataMap,
        'datatable': this.dataTableToVegaValuesData(data),
      };
    }

    // Now inject the datatable into the vegaLite or vega spec.
    if (this.vegaLiteSpec) {
      // Map the DataObjects back to vegaLite data values.
      for (const key in vegaDataMap) {
        if (vegaDataMap.hasOwnProperty(key)) {
          const dataObject: DataObject = vegaDataMap[key];
          vegaDataMap[key] = dataObject.values;
        }
      }
      this.vegaLiteSpec['datasets'] = vegaDataMap;
    } else {
      // Map the vegaDataMap back to an array using the order of names.
      const vegaDataArray = names.map((key) => vegaDataMap[key]) as vega.Data[];
      // Set the data property with the whole data array.
      this.vegaSpec!.data = vegaDataArray;
    }
  }

  /**
   * Simple converter from GViz DataTable/DataView into vega.ValuesData
   * in which the property names are the column ids, as used by Vega and
   * VegaLite.
   */
  dataTableToVegaValuesData(data: AbstractDataTable): vega.ValuesData {
    const numCols = data.getNumberOfColumns();
    const numRows = data.getNumberOfRows();

    const columnIds = [];
    for (let i = 0; i < numCols; i++) {
      columnIds.push(data.getColumnId(i));
    }

    const rows = [];
    for (let i = 0; i < numRows; i++) {
      const row: {[key: string]: Value | null} = {};
      rows.push(row);
      for (let j = 0; j < numCols; j++) {
        row[columnIds[j]] = data.getValue(i, j);
      }
    }
    return {'name': 'datatable', 'values': rows};
  }

  override clearInternal() {
    if (this.clearListeners) {
      this.clearListeners();
      this.clearListeners = undefined;
    }
  }
}
