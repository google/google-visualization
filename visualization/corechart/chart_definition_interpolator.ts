/**
 * @fileoverview A class for interpolating between two chart definitions.
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

import * as googArray from '@npm//@closure/array/array';
import * as asserts from '@npm//@closure/asserts/asserts';
import * as googMath from '@npm//@closure/math/math';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import * as googObject from '@npm//@closure/object/object';
import {AxisType, ChartType, Orientation} from '../../common/option_types';
import * as util from '../../common/util';
import {Value} from '../../data/types';
import {Brush} from '../../graphics/brush';
import * as graphicsUtil from '../../graphics/util';
import {TextStyle} from '../../text/text_style';

import {Coordinate} from '../../math/coordinate';

import {Page} from '../../legend/legend_definition';
import {TextBlock} from '../../text/text_block_object';
import {
  AxisDefinition,
  TextItem,
  TickLine,
  TickLinesOrigin,
  ValueConversion,
} from '../../visualization/corechart/axis_definition';
import {ChartDefinition} from './chart_definition';
import * as chartDefinitionTypes from './chart_definition_types';

// tslint:disable:ban-types  Migration
// tslint:disable:ban-ts-suppressions
// tslint:disable:triple-equals  values might be null or undefined

/** Typedef for mapping points from one series to another. */
interface Mapping {
  idx: number;
  existsInOriginal: boolean;
}

/**
 * Given two chart definitions, the interpolate() function of this class
 * calculates a merged version of the two, based on a zero-to-one ratio.
 */
export class ChartDefinitionInterpolator {
  /**
   * A chart definition to be used as a base to the resulting interpolated
   * chart definition. All possible ratio-independent pre-processing is done
   * to it after initialization, and all ratio-depending processing is added
   * to it once the ratio is given.
   */
  private readonly interpolated: ChartDefinition;

  /**
   * This object contains replacements for hAxes. Each element is itself an
   * array with 2 elements, one for chart def 1, and one for chart def 2.
   * While interpolating, we want to change some of the values in hAxes, but
   * since it's a read-only structure, we need to create a replacement
   * structure.
   */
  private readonly hAxesSubstitute: {[key: number]: AxisDefinition[]} | null =
    null;

  /**
   * A replacement for vAxes. See this.hAxesSubstitute.
   * above.
   */
  private readonly vAxesSubstitute: {[key: number]: AxisDefinition[]} | null =
    null;

  /** The series to interpolate from chartDef1. */
  private series1: chartDefinitionTypes.SerieDefinition[] | null = null;

  /** The series to interpolate from chartDef2. */
  private series2: chartDefinitionTypes.SerieDefinition[] | null = null;

  // Legend animation is disabled for now.

  /** The legend entries to interpolate from chartDef1. */
  private readonly legendEntries1: Page | null = null;

  /** The legend entries to interpolate from chartDef2. */
  private readonly legendEntries2: Page | null = null;

  /**
   * @param chartDef1 A chart definition.
   * @param chartDef2 A chart definition.
   */
  constructor(
    private readonly chartDef1: ChartDefinition,
    private readonly chartDef2: ChartDefinition,
  ) {
    this.interpolated = googObject.clone(chartDef1) as ChartDefinition;

    let changedSize =
      chartDef1.width != chartDef2.width ||
      chartDef1.height != chartDef2.height;
    if (!changedSize && chartDef1.chartArea && chartDef2.chartArea) {
      changedSize =
        chartDef1.chartArea.width != chartDef2.chartArea.width ||
        chartDef1.chartArea.height != chartDef2.chartArea.height ||
        chartDef1.chartArea.left != chartDef2.chartArea.left ||
        chartDef1.chartArea.top != chartDef2.chartArea.top;
    }

    if (this.interpolated.title && changedSize) {
      // Hide the title while interpolating if size has changed.
      this.interpolated.title.textStyle.opacity = 0;
    }

    if (this.interpolated.hAxes) {
      // Suppressing errors for ts-migration.
      //   TS2322: Type '{ [key: string]: { [key: string]: any; }; }' is not
      //   assignable to type '{ [key: number]: AxisDefinition; }'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      this.interpolated.hAxes = googObject.map(
        this.interpolated.hAxes,
        googObject.clone,
      );

      // Suppressing errors for ts-migration.
      //   TS2322: Type '{ [key: string]: AxisDefinition[] | null; }' is not
      //   assignable to type '{ [key: number]: AxisDefinition[]; }'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      this.hAxesSubstitute = googObject.map(
        chartDef1.hAxes,
        function (hAxis, i) {
          return ChartDefinitionInterpolator.prepareAxis(
            chartDef1.hAxes[i],
            chartDef2.hAxes[i],
            this.interpolated.hAxes[i],
            true,
            false,
            changedSize,
          );
        },
        this,
      );
    }
    if (this.interpolated.vAxes) {
      // Suppressing errors for ts-migration.
      //   TS2322: Type '{ [key: string]: { [key: string]: any; }; }' is not
      //   assignable to type '{ [key: number]: AxisDefinition; }'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      this.interpolated.vAxes = googObject.map(
        this.interpolated.vAxes,
        googObject.clone,
      );

      // Suppressing errors for ts-migration.
      //   TS2322: Type '{ [key: string]: AxisDefinition[] | null; }' is not
      //   assignable to type '{ [key: number]: AxisDefinition[]; }'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      this.vAxesSubstitute = googObject.map(
        chartDef1.vAxes,
        function (vAxis, i) {
          return ChartDefinitionInterpolator.prepareAxis(
            chartDef1.vAxes[i],
            chartDef2.vAxes[i],
            this.interpolated.vAxes[i],
            false,
            true,
            changedSize,
          );
        },
        this,
      );
    }

    this.prepareSeries();

    this.prepareLegend();
  }

  /**
   * Prepares an axis for interpolation. It prepares both the interpolated axis
   * and the axes that will be used instead of the axis in chart definition 1
   * and 2 (axis 1 substitute and axis 2 substitute). To avoid changing the
   * original axis definition, we copy it. We could simply deep copy it
   * entirely, but this would be inefficient. So instead we only deep copy the
   * paths leading to the properties that changed by the substitute/interpolated
   * definition, and keep a reference to the rest of the properties.
   * @param axis1 Axis definition from chart def 1.
   * @param axis2 Axis definition from chart def 2.
   * @param interpolated The interpolation chart def to be prepared.
   * @param rescaleTextX Should X coordinate of text elements be rescaled
   *     according to data value from chart def 1 and scaling function from
   *     chart def 2.
   * @param rescaleTextY See rescaleTextX.
   * @param changedSize Whether chart has changed size.
   * @return An array of 2 elements, one for the axis to be used instead of
   *     axis1, and one for the axis to be used instead of axis2, while
   *     interpolating.
   */
  private static prepareAxis(
    axis1: AxisDefinition,
    axis2: AxisDefinition,
    interpolated: AxisDefinition,
    rescaleTextX: boolean,
    rescaleTextY: boolean,
    changedSize: boolean,
  ): AxisDefinition[] | null {
    if (!axis1 || !axis2) {
      return null;
    }
    const axis1Substitute = googObject.clone(axis1) as AxisDefinition;
    // Axis 2 substitute is actually a copy of axis 1, not axis 2, because it
    // contains the same number of gridlines as in axis1, with the same data
    // values and associated text.
    const axis2Substitute = googObject.clone(axis1) as AxisDefinition;

    axis2Substitute.ticklinesOrigin = axis2.ticklinesOrigin;
    axis2Substitute.startPos = axis2.startPos;
    axis2Substitute.endPos = axis2.endPos;

    // Hide the title while interpolating.
    if (interpolated.title && changedSize) {
      interpolated.title.textStyle.opacity = 0;
    }

    // Must be the same types of values
    if (
      axis1.type == AxisType.VALUE &&
      axis2.type == AxisType.VALUE &&
      axis1.dataType === axis2.dataType
    ) {
      // Continuous axis.

      // The baseline.
      if (axis1.baseline && axis2.baseline) {
        axis2Substitute.baseline = axis2.baseline;
        interpolated.baseline = googObject.clone(
          interpolated.baseline,
        ) as TickLine;
      }

      // The gridline/text coordinates of chart-definition-2's axis definition
      // are converted to be in the scale of chart-definition-1's axis
      // definition. We want to interpolate these elements such that they'll
      // keep their data values (from chart def 1), but move to the position
      // calculated with the scaling of chart def 2. The values are overridden
      // in the chart-def-2 replacement and not the original chart def 2.

      axis2Substitute.number = googObject.clone(
        axis2Substitute.number,
      ) as ValueConversion;
      axis2Substitute.position = googObject.clone(
        axis2Substitute.position,
      ) as ValueConversion;

      interpolated.number = googObject.clone(
        interpolated.number,
      ) as ValueConversion;
      interpolated.position = googObject.clone(
        interpolated.position,
      ) as ValueConversion;

      axis2Substitute.position.fromValue = axis2.position.fromValue;

      // The gridlines.
      if (axis1.gridlines && axis2.gridlines) {
        axis2Substitute.gridlines = googArray.clone(axis2Substitute.gridlines);
        interpolated.gridlines = googArray.clone(interpolated.gridlines);
        const substituteGridlines = axis2Substitute.gridlines;
        const interpolatedGridlines = interpolated.gridlines;
        for (let i = 0; i < substituteGridlines.length; i++) {
          substituteGridlines[i] = googObject.clone(
            substituteGridlines[i],
          ) as TickLine;
          interpolatedGridlines[i] = googObject.clone(
            interpolatedGridlines[i],
          ) as TickLine;
          const substituteGridline = substituteGridlines[i];
          const substituteNumber = axis1.number.fromValue(
            substituteGridline.dataValue,
          );
          const substituteValue = axis2.number.toValue(substituteNumber);
          substituteGridline.coordinate = axis2.position.fromValue(
            substituteValue,
          ) as number;
        }
      }

      // The text.
      if (axis1.text && axis2.text) {
        axis2Substitute.text = googArray.clone(axis2Substitute.text);
        interpolated.text = googArray.clone(interpolated.text);
        const substituteText = axis2Substitute.text;
        const interpolatedText = interpolated.text;
        ChartDefinitionInterpolator.cloneAxisText(substituteText);
        ChartDefinitionInterpolator.cloneAxisText(interpolatedText);
        for (let i = 0; i < substituteText.length; i++) {
          const substituteTextItem = substituteText[i];

          ChartDefinitionInterpolator.prepareTextItem(
            axis1,
            axis2,
            axis1.text[i],
            axis2.text[i],
            substituteTextItem,
            rescaleTextX,
            rescaleTextY,
          );
        }
      }
    } else {
      // Not both value axes, so treat as Category axis.

      if (axis1.text && axis2.text) {
        const textEditDistance = util.calcEditDistance(
          axis1.text,
          axis2.text,
          (item1, item2) => item1.dataValue == item2.dataValue,
        );

        axis1Substitute.text = axis1.text.filter(
          (item, i) => textEditDistance.map1[i] != null,
        );
        axis2Substitute.text = axis2.text.filter(
          (item, i) => textEditDistance.map2[i] != null,
        );
        interpolated.text = googArray.clone(axis1Substitute.text);

        ChartDefinitionInterpolator.cloneAxisText(axis1Substitute.text);
        ChartDefinitionInterpolator.cloneAxisText(axis2Substitute.text);
        ChartDefinitionInterpolator.cloneAxisText(interpolated.text);
      }
    }

    return [axis1Substitute, axis2Substitute];
  }

  /**
   * Prepares an axis text item for interpolation.
   * @param axis1 Axis definition from chart def 1.
   * @param axis2 Axis definition from chart def 2.
   * @param axis1text A text item.
   * @param axis2text A text item.
   * @param substituteTextItem A text item in the axis 2 substitute.
   * @param rescaleX Should X coordinate be rescaled according to data value
   *     from chart def 1 and scaling function from chart def 2.
   * @param rescaleY See rescaleX.
   */
  private static prepareTextItem(
    axis1: AxisDefinition,
    axis2: AxisDefinition,
    axis1text: TextItem,
    axis2text: TextItem,
    substituteTextItem: TextItem,
    rescaleX: boolean,
    rescaleY: boolean,
  ) {
    const substituteTextBlock = substituteTextItem.textBlock;
    const substituteNumber = axis1.number.fromValue(
      substituteTextItem.dataValue,
    );
    const substituteValue = axis2.number.toValue(substituteNumber);

    const scaled1 = axis1.position.fromValue(substituteTextItem.dataValue);
    const scaled2 = axis2.position.fromValue(substituteValue);
    if (scaled1 == null || scaled2 == null) {
      return;
    }

    if (rescaleX) {
      const offset = axis1text.textBlock!.anchor!.x - scaled1;
      substituteTextBlock!.anchor!.x = scaled2 + offset;
      if (axis2text) {
        substituteTextBlock!.anchor!.y = axis2text.textBlock!.anchor!.y;
      }
    }
    if (rescaleY) {
      const offset = axis1text.textBlock!.anchor!.y - scaled1;
      substituteTextBlock!.anchor!.y = scaled2 + offset;
      if (axis2text) {
        substituteTextBlock!.anchor!.x = axis2text.textBlock!.anchor!.x;
      }
    }
  }

  /**
   * Clones the content of the 'text' array of an axis definition.
   * @param text The text array.
   */
  private static cloneAxisText(text: TextItem[]) {
    text.forEach((textItem, i) => {
      text[i] = googObject.clone(text[i]) as TextItem;
      textItem = text[i];
      textItem.textBlock = googObject.clone(
        textItem.textBlock as TextBlock,
      ) as TextBlock;
      const textBlock = textItem.textBlock;
      if (textBlock.anchor) {
        textBlock.anchor = Coordinate.clone(textBlock.anchor);
      }
    });
  }

  /**
   * Find the series that exist both in chartDef1 and in chartDef2, according to
   * their ID. Interpolate only these series, and ignore series that are only in
   * one of them.
   */
  private prepareSeries() {
    const chartDef1 = this.chartDef1;
    const chartDef2 = this.chartDef2;

    if (!chartDef1.series || !chartDef2.series) {
      return;
    }

    const seriesEditDistance = util.calcEditDistance(
      chartDef1.series,
      chartDef2.series,
      (serie1, serie2) => serie1.id == serie2.id,
    );

    this.series1 = chartDef1.series.filter(
      (serie, i) => seriesEditDistance.map1[i] != null,
    );
    this.series2 = chartDef2.series.filter(
      (serie, i) => seriesEditDistance.map2[i] != null,
    );

    asserts.assert(this.series1.length == this.series2.length);

    if (
      chartDef1.chartType == ChartType.FUNCTION ||
      chartDef1.chartType == ChartType.SCATTER
    ) {
      // Category-based charts.
      const domain1Axis =
        chartDef1.orientation == null ||
        chartDef1.orientation == Orientation.HORIZONTAL
          ? chartDef1.hAxes[0]
          : chartDef1.vAxes[0];
      const domain2Axis =
        chartDef2.orientation == null ||
        chartDef2.orientation == Orientation.HORIZONTAL
          ? chartDef2.hAxes[0]
          : chartDef2.vAxes[0];
      // Must be the same types of values
      if (
        domain1Axis.type == AxisType.VALUE &&
        domain2Axis.type == AxisType.VALUE &&
        domain1Axis.dataType === domain2Axis.dataType
      ) {
        this.preparePointsForContinuousDomain(
          domain1Axis.number.fromValue,
          domain1Axis.number.toValue,
        );
      } else {
        this.preparePointsForDiscreteDomain();
      }
    } else if (chartDef1.chartType == ChartType.BUBBLE) {
      // Bubble chart has no categories.
      this.preparePointsForBubbleChart();
    }
  }

  /**
   * For discrete domain axis, makes sure both chart definitions have the same
   * number of points. It computes edit-distance of the categories, and finds
   * which points exist in both, and which exist only in one of them. For
   * each category that exists only in one of them, artificial points for this
   * category are added to all series - points which are interpolation of the
   * adjacent points in the serie. This is done to ensure meaningful animation
   * in cases of adding/removing categories.
   */
  private preparePointsForDiscreteDomain() {
    const categories1 = this.chartDef1.categories;
    const categories2 = this.chartDef2.categories;
    if (!categories1 || !categories2) {
      // TODO(avrahamy): Handle empty data better.
      return;
    }

    // Generate similar output to calcEditDistance(),
    // while avoiding its o(n^2) performance.
    // map1 is an object that maps each index of categories1
    //   into the corresponding index in categories2.
    // map2 is the opposite.
    const map1 = {};
    const map2 = {};
    const categories1Indices = {};
    const categories2Indices = {};
    categories1.forEach((category, index) => {
      if (category.data != null) {
        const categoryData = category.data as string;
        (categories1Indices as AnyDuringMigration)[categoryData] = index;
      }
    });
    categories2.forEach((category, index) => {
      if (category.data != null) {
        const categoryData = category.data as string;
        (categories2Indices as AnyDuringMigration)[categoryData] = index;
      }
    });
    // Create map1
    categories1.forEach((category, index) => {
      if (category.data != null) {
        const categoryData = category.data as string;
        const value = (categories2Indices as AnyDuringMigration)[categoryData];
        (map1 as AnyDuringMigration)[index] = value;
      }
    });
    // Create map2
    categories2.forEach((category, index) => {
      if (category.data != null) {
        const categoryData = category.data as string;
        let value = (categories1Indices as AnyDuringMigration)[categoryData];
        if ((map1 as AnyDuringMigration)[value] !== index) {
          // Duplicate value.
          value = null;
        }
        (map2 as AnyDuringMigration)[index] = value;
      }
    });
    // Correct mismatches in map1 due to duplicates.
    categories1.forEach((category, index) => {
      if (category.data != null) {
        const categoryData = category.data as string;
        const value = (categories1Indices as AnyDuringMigration)[categoryData];
        if ((map1 as AnyDuringMigration)[value] !== index) {
          (map2 as AnyDuringMigration)[index] = null;
        }
      }
    });

    // Calculate the new array of categories, which is a union of the two input
    // category arrays, preserving order.
    let idx1 = 0; // Index into categories1.
    let idx2 = 0; // Index into categories2.
    const interpolatedCategories = [];
    // This will contain, for each element in interpolatedCategories, an object
    // that points to the original category arrays.
    const categoryMapping = [];
    while (idx1 < categories1.length || idx2 < categories2.length) {
      if (
        idx1 < categories1.length &&
        (map1 as AnyDuringMigration)[idx1] == null
      ) {
        // A category in chartDef1 doesn't exist in chartDef2.
        categoryMapping.push({
          c1: {idx: idx1, existsInOriginal: true},
          c2: {idx: idx2, existsInOriginal: false},
        });
        interpolatedCategories.push({data: categories1[idx1].data});
        idx1++;
        continue;
      }

      if (
        idx2 < categories2.length &&
        (map2 as AnyDuringMigration)[idx2] == null
      ) {
        // A category in chartDef2 doesn't exist in chartDef1.
        categoryMapping.push({
          c1: {idx: idx1, existsInOriginal: false},
          c2: {idx: idx2, existsInOriginal: true},
        });
        interpolatedCategories.push({data: categories2[idx2].data});
        idx2++;
        continue;
      }

      // If neither idx1 nor idx2 point to null, they must point to each other.
      // The following asserts are failing for unknown reasons.
      // TODO(dlaliberte): Figure out what happened here.
      // asserts.assert(idx1 < categories1.length);
      // asserts.assert(idx2 < categories2.length);
      // asserts.assert(
      //   idx1 ==
      //     (map2 as AnyDuringMigration)[(map1 as AnyDuringMigration)[idx1]],
      // );
      // asserts.assert(
      //   idx2 ==
      //     (map1 as AnyDuringMigration)[(map2 as AnyDuringMigration)[idx2]],
      // );

      categoryMapping.push({
        c1: {idx: idx1, existsInOriginal: true},
        c2: {idx: idx2, existsInOriginal: true},
      });
      // The following assert *ought* to be fine, but the logic in
      // prepareSeries decides that if the domain types are different between
      // the two chart definitions, it should pretend both domain types are
      // discrete. Most domain types are sufficiently different as to be
      // incomparable, but date and datetime values (from two "different" types
      // of domains) have the same JS data type, and *could* be compared, but
      // not with ==. That is the main problem here.
      // TODO(dlaliberte): Figure out how to avoid all this by using a smarter
      // version of preparePointsForContinuousDomain when appropriate.
      // goog.asserts.assert(categories1[idx1].data == categories2[idx2].data);
      interpolatedCategories.push({data: categories1[idx1].data});
      idx1++;
      idx2++;
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type '{ data: Value; }[]' is not assignable to type
    //   'CategoryDefinition[]'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    this.interpolated.categories = interpolatedCategories;

    // The following function interpolates 2 points in the 'points' array, the
    // point in index 'idx' and the point before it (idx - 1). If either of
    // those go beyond the boundaries of the array, return the boundary point
    // instead of doing interpolation.
    const interpolateAdjacentPoints = (
      points: AnyDuringMigration,
      idx: number,
    ) => {
      if (idx == 0) {
        return points[0];
      } else if (idx >= points.length) {
        return googArray.peek(points);
      } else {
        // The ratio used is 0.5 because we want the new point to be a
        // right-in-the-middle interpolation of the two input points.
        return ChartDefinitionInterpolator.interpolatePoint(
          points[idx - 1],
          points[idx],
          0.5,
        );
      }
    };

    // If the point already existed in the original points array, take it as is,
    // otherwise make a new point which is exactly in the middle of the two most
    // relevant points from the original array.
    if (this.chartDef1.isDiff) {
      this.makeNewDiffPoints(
        categoryMapping,
        (points, mapping, pointsPerCategory, k) =>
          mapping.existsInOriginal
            ? points[mapping.idx * pointsPerCategory + k]
            : interpolateAdjacentPoints(
                points,
                mapping.idx * pointsPerCategory + k,
              ),
      );
    } else {
      this.makeNewPoints(categoryMapping, (points, mapping) =>
        mapping.existsInOriginal
          ? points[mapping.idx]
          : interpolateAdjacentPoints(points, mapping.idx),
      );
    }
  }

  /**
   * For continuous domain axis. For each point, find the point in the other
   * chart definition that is the closest to it (only in the domain coordinate).
   * A pair of points that each is the closest to the other one is considered a
   * good match. Each good pair is considered two end-points for interpolation
   * (interpolation will be done from point1 to point2). For points for which no
   * good match was found we create a duplicate of the closest point in the
   * other chart definition, and together they are interpolation end-points.
   * This is done to ensure meaningful animation in cases of adding/removing
   * points.
   * @param dataToNumber A function that transforms a data value to a
   *     corresponding numeric value.
   * @param numberToData A function that transforms a numeric value to a
   *     corresponding data value.
   */
  private preparePointsForContinuousDomain(
    dataToNumber: (p1: Value) => number | null,
    numberToData: (p1: number | null) => AnyDuringMigration,
  ) {
    const categories1 = this.chartDef1.categories;
    const categories2 = this.chartDef2.categories;
    if (!categories1 || !categories2) {
      return;
    }
    if (categories1.length == 0 || categories2.length == 0) {
      // No data. Empty the interpolated categories and series.
      // TODO(dlaliberte): Interpolate to or from 0 values for series.
      this.interpolated.categories = [];
      this.makeNewPoints([], (a, b) => null);
      return;
    }

    const getCategoryDataAsNumber = (category: AnyDuringMigration) =>
      dataToNumber(category.data);
    const interpolatedCategories = [];
    // This will contain, for each element in the category union, an object that
    // points to the original category arrays.
    const categoryMapping = [];

    // TODO(dlaliberte): When we have row identifiers to compare things,
    // we can avoid the following hacks.
    if (categories1.length === categories2.length) {
      // Special case, assume one-to-one mapping.
      for (let i = 0; i < categories1.length; i++) {
        categoryMapping.push({c1: i, c2: i});
        interpolatedCategories.push({
          data: numberToData(
            googMath.average(
              // Suppressing errors for ts-migration.
              //   TS2345: Argument of type 'number | null' is not assignable to
              //   parameter of type 'number'.
              // ts-ignore was either removed or relocated below
              // @ts-ignore inserted
              getCategoryDataAsNumber(categories1[i]),
              getCategoryDataAsNumber(categories2[i]),
            ),
          ),
        });
      }
    } else {
      // Category arrays are different lengths.  Merge them by nearest values.
      const merged =
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '(category: AnyDuringMigration) =>
        //   number | null' is not assignable to parameter of type '(p1:
        //   CategoryDefinition) => number'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        util.mergeArrays(categories1, categories2, getCategoryDataAsNumber);
      merged!.forEach((item) => {
        const ar1 = item.ar1;
        const ar2 = item.ar2;
        let data;
        if (categories1[ar1] != null && categories2[ar2] != null) {
          data = numberToData(
            googMath.average(
              // Suppressing errors for ts-migration.
              //   TS2345: Argument of type 'number | null' is not assignable to
              //   parameter of type 'number'.
              // ts-ignore was either removed or relocated below
              // @ts-ignore inserted
              getCategoryDataAsNumber(categories1[ar1]),
              getCategoryDataAsNumber(categories2[ar2]),
            ),
          );
        }
        if (data != null) {
          categoryMapping.push({c1: ar1, c2: ar2});
          interpolatedCategories.push({data});
        }
      });
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type '{ data: any; }[]' is not assignable to type
    //   'CategoryDefinition[]'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    this.interpolated.categories = interpolatedCategories;

    if (this.chartDef1.isDiff) {
      this.makeNewDiffPoints(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '{ c1: number; c2: number; }[]' is not
        //   assignable to parameter of type '{ c1: Mapping; c2: Mapping;
        //   }[]'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        categoryMapping,
        (points, idx: number, pointsPerCategory, k) =>
          // Suppressing errors for ts-migration.
          //   TS2352: Conversion of type 'Mapping' to type 'number' may be
          //   a mistake because neither type sufficiently overlaps with the
          //   other. If this was intentional, convert the expression to
          //   'unknown' first.
          // ts-ignore was either removed or relocated below
          points[idx * pointsPerCategory + k],
      );
    } else {
      this.makeNewPoints(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type '{ c1: number; c2: number; }[]' is not
        //   assignable to parameter of type '{ c1: Mapping; c2: Mapping;
        //   }[]'. TS2352: Conversion of type 'Mapping' to type 'number' may
        //   be a mistake because neither type sufficiently overlaps with the
        //   other. If this was intentional, convert the expression to
        //   'unknown' first.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        categoryMapping,
        // @ts-ignore inserted
        (points, idx) => points[idx],
      );
    }
  }

  /**
   * For bubble chart, makes sure both chart definitions have the same number of
   * bubbles. Both charts can contain multiple points (bubbles) with the same
   * id. The ids are not unique across the datatable rows, but used to identify
   * instances of the same bubble which, by definition, have the same id.
   * It compares the bubble ids, and finds which bubbles exist in both,
   * and which bubbles exist only in one of them.  Bubbles that exist
   * in both are interpolated by motion, and the others are faded in or out.
   */
  private preparePointsForBubbleChart() {
    const serie1 = this.series1![0];
    const serie2 = this.series2![0];
    const points1 = serie1.points;
    const points2 = serie2.points;
    const pointsToFadeOut: AnyDuringMigration[] = [];
    const pointsToFadeIn: AnyDuringMigration[] = [];

    const categoryMapping: AnyDuringMigration[] = [];
    // Pair up points with same ids from the two arrays, preserving order.
    // Also accumulate extras to fade out or fade in.
    const points2Map = {};
    points2.forEach((point, idx) => {
      if (point == null) {
        return;
      }
      if ((points2Map as AnyDuringMigration)[point.id] === undefined) {
        (points2Map as AnyDuringMigration)[point.id] = [];
      }
      (points2Map as AnyDuringMigration)[point.id].push(idx);
    });
    googObject.forEach(points1, (point, idx1) => {
      if (point == null) {
        return;
      }
      const pointsIdx =
        point.id && (points2Map as AnyDuringMigration)[point.id];
      const idx2 = pointsIdx && pointsIdx.shift();
      if (idx2 !== undefined) {
        categoryMapping.push({c1: idx1, c2: idx2});
      } else {
        // Not in points2, so fade out.
        pointsToFadeOut.push(point);
      }
    });
    // All remaining points2 are extra, to be fadedIn.
    googObject.forEach(points2Map, (points, id) => {
      points.forEach((idx2: AnyDuringMigration) => {
        const point = points2[idx2];
        pointsToFadeIn.push(point);
      });
    });

    this.makeNewPoints(
      // Suppressing errors for ts-migration.
      //   TS2352: Conversion of type 'Mapping' to type 'number' may be a
      //   mistake because neither type sufficiently overlaps with the other.
      //   If this was intentional, convert the expression to 'unknown' first.
      // ts-ignore was either removed or relocated below
      categoryMapping,
      // @ts-ignore inserted
      (points, idx) => points[idx as number],
    );

    // Create missing points to fade in or out.
    const cloneMissingPoint = (point: AnyDuringMigration) => {
      const newPoint = googObject.clone(
        point,
      ) as chartDefinitionTypes.DatumDefinition;
      newPoint.scaled = googObject.clone(
        newPoint.scaled,
      ) as chartDefinitionTypes.ScaledDatumDefinition;
      newPoint.scaled.brush = newPoint.scaled.brush!.clone();
      newPoint.scaled.brush.setFillOpacity(0);
      newPoint.scaled.brush.setStrokeOpacity(0);
      newPoint.textStyle = googObject.clone(newPoint.textStyle) as TextStyle;
      newPoint.textStyle.opacity = 0;
      return newPoint;
    };
    const fadingOutPoints = pointsToFadeOut.map(cloneMissingPoint);
    const fadingInPoints = pointsToFadeIn.map(cloneMissingPoint);
    // Add corresponding points in the same order.
    this.series1![0].extraPoints = pointsToFadeOut.concat(fadingInPoints);
    this.series2![0].extraPoints = fadingOutPoints.concat(pointsToFadeIn);
  }

  /**
   * Creates new points array for each serie, for both chart definition 1 and
   * chart definition 2. All series must have the same number of points to allow
   * interpolation.
   * @param domainMapping An array whose length is the number of points each
   *     serie should have while interpolating. This is the union of categories
   *     in the category domain case, or the equivalent in the value domain
   *     case. Each element contains two fields, c1 and c2, which contains
   *     information on how to create the point for series in chart definition 1
   *     and chart definition 2, respectively. The c1/c2 fields are passed to
   *     the getPoint function that will return the new point.
   * @param getPoint A function that knows to return a point based on original
   *     points array and the information passed to it.
   */
  private makeNewPoints(
    domainMapping: Array<{c1: Mapping; c2: Mapping}>,
    getPoint: (
      p1: AnyDuringMigration[],
      p2: Mapping,
    ) => AnyDuringMigration | null,
  ) {
    for (let i = 0; i < this.series1!.length; i++) {
      const points1 = this.series1![i].points;
      const points2 = this.series2![i].points;
      let newPoints1 = [];
      let newPoints2 = [];

      if (this.series1![i].isVirtual) {
        // For virtual series (trendlines), just copy the points. Don't try to
        // be smart here.
        newPoints1 = googArray.clone(this.series1![i].points);
        newPoints2 = googArray.clone(this.series2![i].points);
      } else {
        for (let j = 0; j < domainMapping.length; j++) {
          const mapping = domainMapping[j];
          const point1 = getPoint(points1, mapping.c1);
          const point2 = getPoint(points2, mapping.c2);
          if (point1 && point2) {
            // Pass through non-null points though they may have isNull set.
            // This allows the two lists of points to remain synchronized,
            // one to one.
            newPoints1.push(point1);
            newPoints2.push(point2);
          }
        }
      }

      this.series1![i] = ChartDefinitionInterpolator.cloneSerie(
        this.series1![i],
        newPoints1,
      );
      this.series2![i] = ChartDefinitionInterpolator.cloneSerie(
        this.series2![i],
        newPoints2,
      );
    }
  }

  /**
   * Creates new points array for each serie, for both chart definition 1 and
   * chart definition 2. All series must have the same number of points to allow
   * interpolation.  This is specifically for diff charts that have 2 points
   * per category for each series.
   * @param domainMapping An array whose length is the number of points each
   *     serie should have while interpolating. This is the union of categories
   *     in the category domain case, or the equivalent in the value domain
   *     case. Each element contains two fields, c1 and c2, which contains
   *     information on how to create the point for series in chart definition 1
   *     and chart definition 2, respectively. The c1/c2 fields are passed to
   *     the getPoint function that will return the new point.
   * @param getPoint A function that knows to return a point based on original
   *     points array and the information passed to it.
   */
  private makeNewDiffPoints(
    domainMapping: Array<{c1: Mapping; c2: Mapping}>,
    getPoint: (
      p1: AnyDuringMigration[],
      p2: Mapping,
      p3: number,
      p4: number,
    ) => AnyDuringMigration,
  ) {
    for (let i = 0; i < this.series1!.length; i++) {
      const points1 = this.series1![i].points;
      const points2 = this.series2![i].points;
      const newPoints1 = [];
      const newPoints2 = [];

      if (domainMapping.length > 0) {
        const points1PerCategory = Math.ceil(
          points1.length / domainMapping.length,
        );
        const points2PerCategory = Math.ceil(
          points2.length / domainMapping.length,
        );

        if (this.chartDef1.chartType == ChartType.FUNCTION) {
          asserts.assert(
            Math.floor(points1.length / points1PerCategory) ===
              this.chartDef1.categories.length,
          );
          asserts.assert(
            Math.floor(points2.length / points2PerCategory) ===
              this.chartDef2.categories.length,
          );
        }

        for (let j = 0; j < domainMapping.length; j++) {
          const mapping = domainMapping[j];
          for (let k = 0; k < points1PerCategory; k++) {
            const point1 = getPoint(points1, mapping.c1, points1PerCategory, k);
            if (point1) {
              newPoints1.push(point1);
            }
          }
          for (let k = 0; k < points2PerCategory; k++) {
            const point2 = getPoint(points2, mapping.c2, points2PerCategory, k);
            if (point2) {
              newPoints2.push(point2);
            }
          }
        }
      }

      this.series1![i] = ChartDefinitionInterpolator.cloneSerie(
        this.series1![i],
        newPoints1,
      );
      this.series2![i] = ChartDefinitionInterpolator.cloneSerie(
        this.series2![i],
        newPoints2,
      );
    }
  }

  /**
   * Clone a serie, prepared for interpolation with new array of points.
   * @param serie A serie to clone.
   * @param newPoints A new array of points, replacing the old one.
   * @return A clone of the given serie with the new points override the old.
   */
  private static cloneSerie(
    serie: chartDefinitionTypes.SerieDefinition,
    newPoints: chartDefinitionTypes.DatumDefinition[],
  ): chartDefinitionTypes.SerieDefinition {
    const newSerie = googObject.clone(
      serie,
    ) as chartDefinitionTypes.SerieDefinition;
    newSerie.points = newPoints;
    return newSerie;
  }

  /**
   * Find the legend entries that exist both in chartDef1 and in chartDef2,
   * according to their ID. Interpolate only these entries, and ignore entries
   * that are only in one of them. Similar to what is done for the series.
   */
  private prepareLegend() {
    // Just hide the legend while interpolating.
    const chartDef1 = this.chartDef1;
    const chartDef2 = this.chartDef2;

    if (
      !chartDef1.legend ||
      !chartDef1.legend.pages ||
      !chartDef2.legend ||
      !chartDef2.legend.pages
    ) {
      return;
    }
    this.interpolated.legend = null;
  }

  /**
   * Interpolates two values:
   * - if they have the same value, use that value.
   * - if they are both Brushes, interpolate the brushes.
   * - if the yare both arrays, interpolate each element recursively.
   * - if they are both objects, interpolate recursively field by field.
   * - if they are both strings, use v1.
   * - if they are both numbers, interpolate numerically.
   * - otherwise - return null.
   *
   * @param v1 Some value.
   * @param v2 Some value.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to v1/v2.
   * @return The interpolated result.
   */
  private static interpolateValue<T>(v1: T, v2: T, ratio: number): T {
    if (v1 === v2) {
      return v1;
    }

    if (v1 && v1.constructor == Brush && v2 && v2.constructor == Brush) {
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'Brush' is not assignable to type 'T'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      return ChartDefinitionInterpolator.interpolateBrush(
        v1 as Brush,
        v2 as Brush,
        ratio,
      );
    }

    if (Array.isArray(v1) && Array.isArray(v2)) {
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'any[]' is not assignable to type 'T'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      return ChartDefinitionInterpolator.interpolateArray(
        v1 as AnyDuringMigration[],
        v2 as AnyDuringMigration[],
        ratio,
      );
    }

    // The goog.isObject test must be done after the goog.isArray because
    // goog.isObject returns true for arrays.
    if (goog.isObject(v1) || goog.isObject(v2)) {
      return ChartDefinitionInterpolator.interpolateObject(
        v1 as AnyDuringMigration,
        v2 as AnyDuringMigration,
        ratio,
      );
    }

    if (typeof v1 === 'string' || typeof v2 === 'string') {
      return v1;
    }

    if (typeof v1 === 'number' && typeof v2 === 'number') {
      // Suppressing errors for ts-migration.
      //   TS2322: Type '0 | (T & number)' is not assignable to type 'T'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      v1 = !isNaN(v1) ? v1 : 0;
      // Suppressing errors for ts-migration.
      //   TS2322: Type '0 | (T & number)' is not assignable to type 'T'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      v2 = !isNaN(v2) ? v2 : 0;

      // If either v1 or v2 is Infinity, just return Infinity. This prevents
      // cases where we could get Infinity * 0 (either because ratio is 0 or 1)
      // and consequently generate a NaN
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'T' is not assignable to parameter of type
      //   'number'. TS2345: Argument of type 'T' is not assignable to parameter
      //   of type 'number'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      if (!isFinite(v1) || !isFinite(v2)) {
        // Suppressing errors for ts-migration.
        //   TS2322: Type 'number' is not assignable to type 'T'.
        // ts-ignore was either removed or relocated below
// @ts-ignore inserted
        return Infinity;
      }
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'number' is not assignable to type 'T'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      return v1 * (1 - ratio) + v2 * ratio;
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type 'null' is not assignable to type 'T'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    return null;
  }

  /**
   * Constructs a brush that is an interpolation of two other brushes
   * by interpolating each of the properties of the brushes.
   *
   * @param brush1 A brush.
   * @param brush2 A brush.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to brush1/brush2.
   * @return The interpolated structure.
   */
  private static interpolateBrush(
    brush1: Brush,
    brush2: Brush,
    ratio: number,
  ): Brush {
    return new Brush({
      fill: graphicsUtil.blendHexColors(
        brush1.getFill(),
        brush2.getFill(),
        1 - ratio,
      ),
      fillOpacity: ChartDefinitionInterpolator.interpolateValue(
        brush1.getFillOpacity(),
        brush2.getFillOpacity(),
        ratio,
      ),
      stroke: graphicsUtil.blendHexColors(
        brush1.getStroke(),
        brush2.getStroke(),
        1 - ratio,
      ),
      strokeWidth: ChartDefinitionInterpolator.interpolateValue(
        brush1.getStrokeWidth(),
        brush2.getStrokeWidth(),
        ratio,
      ),
      strokeOpacity: ChartDefinitionInterpolator.interpolateValue(
        brush1.getStrokeOpacity(),
        brush2.getStrokeOpacity(),
        ratio,
      ),
      strokeDashStyle: brush1.getStrokeDashStyle(), // No support for gradient/pattern
      // interpolation.
      gradient: brush1.getGradient(),
      pattern: brush1.getPattern(),
    });
  }

  /**
   * Constructs an array that is an interpolation of two other arrays
   * by interpolating each of the corresponding elements in the arrays.
   *
   * @param arr1 An array.
   * @param arr2 An array.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to arr1/arr2.
   * @return The interpolated structure.
   */
  private static interpolateArray(
    arr1: AnyDuringMigration[],
    arr2: AnyDuringMigration[],
    ratio: number,
  ): AnyDuringMigration[] {
    if (!arr1) {
      return arr2;
    }
    if (!arr2) {
      return arr1;
    }
    const result = [];
    // If both arr1 and arr2 are non-null, we handle only indices that exist in
    // both (i.e, the result's length is the minimum of the two array). For
    // those elements we take the greatest common denominator (see
    // interpolateValue above for details).
    const len = Math.min(arr1.length, arr2.length);
    for (let i = 0; i < len; i++) {
      result.push(
        ChartDefinitionInterpolator.interpolateValue(arr1[i], arr2[i], ratio),
      );
    }
    return result;
  }

  /**
   * Constructs an object that is an interpolation of two other objects
   * by interpolating each of the common properties of the objects.
   *
   * @param obj1 An object.
   * @param obj2 An object.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to obj1/obj2.
   * @return The interpolated structure.
   */
  private static interpolateObject(
    obj1: AnyDuringMigration,
    obj2: AnyDuringMigration,
    ratio: number,
  ): AnyDuringMigration {
    if (!obj1) {
      return obj2;
    }
    if (!obj2) {
      return obj1;
    }
    const result = {};
    // If both obj1 and obj2 are non-null, we assume their structure is similar.
    // The code below discards any key that doesn't exist in both. For keys that
    // exist in both, we take the "greatest common denominator" (see
    // interpolateValue above for details).
    googObject.forEach(obj1, (value, key) => {
      if (obj2[key] === undefined) {
        return;
      }
      (result as AnyDuringMigration)[key] =
        ChartDefinitionInterpolator.interpolateValue(
          obj1[key],
          obj2[key],
          ratio,
        );
    });
    return result;
  }

  /**
   * Determines if the given coordinate is within the chart area boundaries. Can
   * check either the X coordinate or the Y coordinate (or both).
   * @param x The X coordinate.
   * @param y The Y coordinate.
   * @param chartArea The chart area dimensions.
   * @param limitByX Should the isVisible property be limited by the X
   *     coordinate.
   * @param limitByY See limitByX.
   * @return Is the coordinates within the limits.
   */
  private static isCoordinateInLimits(
    x: number,
    y: number,
    chartArea: {top: number; bottom: number; left: number; right: number},
    limitByX: boolean,
    limitByY: boolean,
  ): boolean {
    const inXLimits =
      !limitByX ||
      (chartArea ? x >= chartArea.left && x <= chartArea.right : false);
    const inYLimits =
      !limitByY ||
      (chartArea ? y >= chartArea.top && y <= chartArea.bottom : false);
    return inXLimits && inYLimits;
  }

  /**
   * Interpolates two text blocks, given a ratio between them.
   * @param textBlock1 A text block.
   * @param textBlock2 A text block.
   * @param interpolated The output text block.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to textBlock1/textBlock2.
   */
  private static interpolateTextBlock(
    textBlock1: TextBlock,
    textBlock2: TextBlock,
    interpolated: TextBlock,
    ratio: number,
  ) {
    if (!interpolated || !interpolated.anchor) {
      return;
    }

    interpolated.anchor.x = ChartDefinitionInterpolator.interpolateValue(
      textBlock1.anchor!.x,
      textBlock2.anchor!.x,
      ratio,
    );
    interpolated.anchor.y = ChartDefinitionInterpolator.interpolateValue(
      textBlock1.anchor!.y,
      textBlock2.anchor!.y,
      ratio,
    );
  }

  /**
   * Interpolates two axis text items, given a ratio between them.
   * @param item1 An axis text item.
   * @param item2 An axis text item.
   * @param interpolated The output axis text item.
   * @param isInLimits A function the checks whether a given coordinate is
   *     within the visible limits.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to item1/item2.
   */
  private static interpolateTextItem(
    item1: TextItem,
    item2: TextItem,
    interpolated: TextItem,
    isInLimits: (p1: number, p2: number) => boolean,
    ratio: number,
  ) {
    if (!interpolated) {
      return;
    }

    ChartDefinitionInterpolator.interpolateTextBlock(
      item1.textBlock as TextBlock,
      item2.textBlock as TextBlock,
      interpolated.textBlock as TextBlock,
      ratio,
    );

    if (interpolated.textBlock) {
      const hasLines = interpolated.textBlock.lines.length > 0;
      const firstLineX = hasLines ? interpolated.textBlock.lines[0].x : 0;
      const firstLineY = hasLines ? interpolated.textBlock.lines[0].y : 0;
      interpolated.isVisible = isInLimits(
        firstLineX + interpolated.textBlock.anchor!.x,
        firstLineY + interpolated.textBlock.anchor!.y,
      );
    }
  }

  /**
   * Interpolates two axis definitions, given a ratio between them.
   * @param axis1 An axis definition.
   * @param axis2 An axis definition.
   * @param interpolated The output axis definition.
   * @param isInLimits A function the checks whether a given coordinate is
   *     within the visible limits.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to axis1/axis2.
   */
  private static interpolateAxis(
    axis1: AxisDefinition,
    axis2: AxisDefinition,
    interpolated: AxisDefinition,
    isInLimits: (p1: number, p2: number) => boolean,
    ratio: number,
  ) {
    if (
      axis1.position &&
      axis1.position.fromValue &&
      axis2.position &&
      axis2.position.fromValue
    ) {
      // The interpolated value-to-position conversion function is based on the
      // two original functions, with the given 'ratio' of interpolating between
      // them.
      interpolated.position.fromValue = (v) => {
        const p1 = axis1.position.fromValue(v);
        const p2 = axis2.position.fromValue(v);
        return ChartDefinitionInterpolator.interpolateValue(p1, p2, ratio);
      };
    }

    // Titles
    if (axis1.title && axis2.title) {
      interpolated.title.lines.forEach((line, i) => {
        line.x = ChartDefinitionInterpolator.interpolateValue(
          axis1.title.lines[i].x,
          axis2.title.lines[i].x,
          ratio,
        );
        line.y = ChartDefinitionInterpolator.interpolateValue(
          axis1.title.lines[i].y,
          axis2.title.lines[i].y,
          ratio,
        );
      });
    }

    // The baseline.
    if (axis1.baseline && axis2.baseline) {
      const baseline = interpolated.baseline;
      baseline!.coordinate = ChartDefinitionInterpolator.interpolateValue(
        axis1.baseline.coordinate,
        axis2.baseline.coordinate,
        ratio,
      );
    }

    // The gridlines.
    if (axis1.gridlines && axis2.gridlines) {
      interpolated.gridlines.forEach((gridline, i) => {
        gridline.coordinate = ChartDefinitionInterpolator.interpolateValue(
          axis1.gridlines[i].coordinate,
          axis2.gridlines[i].coordinate,
          ratio,
        );
        gridline.isVisible = isInLimits(
          gridline.coordinate,
          gridline.coordinate,
        );
      });
    }

    // The ticklines origin.
    if (axis1.ticklinesOrigin && axis2.ticklinesOrigin) {
      interpolated.ticklinesOrigin =
        ChartDefinitionInterpolator.interpolateObject(
          axis1.ticklinesOrigin,
          axis2.ticklinesOrigin,
          ratio,
        ) as TickLinesOrigin;
    }
    if (axis1.startPos != null && axis2.startPos != null) {
      interpolated.startPos = ChartDefinitionInterpolator.interpolateValue(
        axis1.startPos,
        axis2.startPos,
        ratio,
      );
    }
    if (axis1.endPos != null && axis2.endPos != null) {
      interpolated.endPos = ChartDefinitionInterpolator.interpolateValue(
        axis1.endPos,
        axis2.endPos,
        ratio,
      );
    }

    // The text.
    if (axis1.text && axis2.text) {
      interpolated.text.forEach((textItem, i) => {
        ChartDefinitionInterpolator.interpolateTextItem(
          axis1.text[i],
          axis2.text[i],
          textItem,
          isInLimits,
          ratio,
        );
      });
    }
  }

  /**
   * Interpolates two points, given a ratio between them.
   * This assumes that for all axis charts, the 'scaled', 'leftControlPoint' and
   * 'rightControlPoint' objects are plain objects with only numeric fields, so
   * it interpolates those numeric fields. We also interpolate textStyle for
   * color and opacity.  We don't bother handling other fields like 'nonScaled'
   * and 'formattedValue' because the builder doesn't need them for drawing the
   * chart.
   * @param point1 A point.
   * @param point2 A point.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to axis1/axis2.
   * @return The interpolated point.
   */
  private static interpolatePoint(
    point1: chartDefinitionTypes.DatumDefinition | null,
    point2: chartDefinitionTypes.DatumDefinition | null,
    ratio: number,
  ): chartDefinitionTypes.DatumDefinition | null {
    if (!point1 || !point2) {
      return null;
    }

    const result = googObject.clone(
      point1,
    ) as chartDefinitionTypes.DatumDefinition;

    if (point1.isNull || point2.isNull) {
      result.isNull = true;
    }

    // Interpolate several values.
    if (point1.scaled !== undefined || point2.scaled !== undefined) {
      result.scaled = ChartDefinitionInterpolator.interpolateValue(
        point1.scaled || {},
        point2.scaled || {},
        ratio,
      ) as chartDefinitionTypes.ScaledDatumDefinition;
      result.nonScaled = ChartDefinitionInterpolator.interpolateValue(
        point1.nonScaled || {},
        point2.nonScaled || {},
        ratio,
      );
    }
    if (
      point1.leftControlPoint !== undefined &&
      point2.leftControlPoint !== undefined
    ) {
      result.leftControlPoint = ChartDefinitionInterpolator.interpolateValue(
        point1.leftControlPoint,
        point2.leftControlPoint,
        ratio,
      );
    }
    if (
      point1.rightControlPoint !== undefined &&
      point2.rightControlPoint !== undefined
    ) {
      result.rightControlPoint = ChartDefinitionInterpolator.interpolateValue(
        point1.rightControlPoint,
        point2.rightControlPoint,
        ratio,
      );
    }
    if (
      point1.textStyle !== undefined &&
      point2.textStyle !== undefined &&
      point1.textStyle !== point2.textStyle
    ) {
      result.textStyle = googObject.clone(point1.textStyle) as TextStyle;
      result.textStyle.color = graphicsUtil.blendHexColors(
        point1.textStyle!.color,
        point2.textStyle!.color,
        1 - ratio,
      );
      result.textStyle.opacity = ChartDefinitionInterpolator.interpolateValue(
        point1.textStyle!.opacity !== undefined ? point1.textStyle!.opacity : 1,
        point2.textStyle!.opacity !== undefined ? point2.textStyle!.opacity : 1,
        ratio,
      );
    }
    if (
      point1.annotation != null &&
      point2.annotation != null &&
      point1.annotation.labels[0].text === point2.annotation.labels[0].text
    ) {
      result.annotation = ChartDefinitionInterpolator.interpolateValue(
        point1.annotation,
        point2.annotation,
        ratio,
      );
    } else {
      // Suppressing errors for ts-migration.
      //   TS2790: The operand of a 'delete' operator must be optional.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      delete result.annotation;
    }

    return result;
  }

  /**
   * Interpolates two chart definitions, given a ratio between them.
   * @param ratio A number in the range [0,1] indicating the ratio of the
   *     weights given to chartDef1/chartDef2. A value of 0 means take only
   *     chartDef1 and ignore chartDef2. A value of 1 means the opposite.
   * @return A clone of the given chart definitions, interpolated with the given
   *     ratio.
   */
  interpolate(ratio: number): ChartDefinition {
    const interpolated = this.interpolated;

    if (interpolated.hAxes && this.hAxesSubstitute) {
      const hIsInLimits = (x: number, y: number) =>
        ChartDefinitionInterpolator.isCoordinateInLimits(
          x,
          y,
          interpolated.chartArea,
          true,
          false,
        );

      googObject.forEach(interpolated.hAxes, (hAxis, i) => {
        const substitute = this.hAxesSubstitute![i];
        if (!substitute) {
          return;
        }
        ChartDefinitionInterpolator.interpolateAxis(
          substitute[0],
          substitute[1],
          hAxis,
          hIsInLimits,
          ratio,
        );
      });
    }
    if (interpolated.vAxes && this.vAxesSubstitute) {
      const vIsInLimits = (x: number, y: number) =>
        ChartDefinitionInterpolator.isCoordinateInLimits(
          x,
          y,
          interpolated.chartArea,
          false,
          true,
        );

      googObject.forEach(interpolated.vAxes, (vAxis, i) => {
        const substitute = this.vAxesSubstitute![i];
        if (!substitute) {
          return;
        }
        ChartDefinitionInterpolator.interpolateAxis(
          substitute[0],
          substitute[1],
          vAxis,
          vIsInLimits,
          ratio,
        );
      });
    }

    if (this.series1 && this.series2) {
      interpolated.series = [];
      for (let i = 0; i < this.series1.length; ++i) {
        const serie1 = this.series1[i];
        const serie2 = this.series2[i];
        const interpolatedSerie = googObject.clone(
          serie2,
        ) as chartDefinitionTypes.SerieDefinition;
        if (serie1 && serie2 && serie1.type == serie2.type) {
          if (serie1.points && serie2.points) {
            interpolatedSerie.points = [];
            // The lengths may be different.
            for (let j = 0; j < serie1.points.length; j++) {
              interpolatedSerie.points[j] =
                ChartDefinitionInterpolator.interpolatePoint(
                  serie1.points[j],
                  serie2.points[j],
                  ratio,
                );
            }
            if (serie1.extraPoints && serie2.extraPoints) {
              for (let j = 0; j < serie1.extraPoints.length; j++) {
                interpolatedSerie.points.push(
                  ChartDefinitionInterpolator.interpolatePoint(
                    serie1.extraPoints[j],
                    serie2.extraPoints[j],
                    ratio,
                  ),
                );
              }
            }
          }
          if (
            serie1.intervals &&
            serie1.intervals.paths &&
            serie2.intervals &&
            serie2.intervals.paths
          ) {
            interpolatedSerie.intervals = googObject.clone(
              interpolatedSerie.intervals,
            ) as chartDefinitionTypes.Intervals;
            interpolatedSerie.intervals.paths =
              ChartDefinitionInterpolator.interpolateValue(
                serie1.intervals.paths,
                serie2.intervals.paths,
                ratio,
              );
          }
        }
        interpolated.series[i] = interpolatedSerie;
      }
    }

    if (interpolated.height) {
      interpolated.height = ChartDefinitionInterpolator.interpolateValue(
        this.chartDef1.height,
        this.chartDef2.height,
        ratio,
      );
    }
    if (interpolated.width) {
      interpolated.width = ChartDefinitionInterpolator.interpolateValue(
        this.chartDef1.width,
        this.chartDef2.width,
        ratio,
      );
    }
    if (interpolated.chartArea) {
      interpolated.chartArea = ChartDefinitionInterpolator.interpolateValue(
        this.chartDef1.chartArea,
        this.chartDef2.chartArea,
        ratio,
      );
    }

    if (
      this.legendEntries1 &&
      this.legendEntries2 &&
      interpolated.legend &&
      interpolated.legend.currentPage
    ) {
      for (let i = 0; i < interpolated.legend.currentPage.length; i++) {
        const interpolatedEntry = interpolated.legend.currentPage[i];
        const entry1 = this.legendEntries1[i];
        const entry2 = this.legendEntries2[i];

        // Interpolate the textBlock.
        //
        // To start with, the interpolated textBlock is cloned from the 2nd
        // chart (see prepareLegend method). In the code below, the position of
        // each text line is adjusted according to the interpolation ratio.
        //
        // Special cases:
        // 1. No text in entry1: the positions from entry2 are used.
        // 2. Less lines in entry1 than entry2: the position of the additional
        //    lines is interpolated using the position of the last line of
        //    entry1.
        // 3. More lines in entry1 than entry2: the additional lines do not
        // appear
        //    in the interpolation.
        //
        // Cases #1 and #3 work w/o any additional code here, because the
        // interpolated textBlock is already cloned from entry2.

        if (
          interpolatedEntry.textBlock &&
          interpolatedEntry.textBlock.lines &&
          entry1.textBlock &&
          entry1.textBlock.lines &&
          entry1.textBlock.lines.length !== 0 && // Case #1 above.
          entry2.textBlock &&
          entry2.textBlock.lines
        ) {
          const interpolatedLines = interpolatedEntry.textBlock.lines;
          const lines1 = entry1.textBlock.lines;
          const lines2 = entry2.textBlock.lines;
          const lines1Len = lines1.length;
          for (let j = 0; j < interpolatedLines.length; j++) {
            // Case #2 (see above): If the 1st chart doesn't have enough lines,
            // use the previous line position as the starting point.
            const pos1 = j < lines1Len ? lines1[j] : lines1[lines1Len - 1];

            interpolatedLines[j].x =
              ChartDefinitionInterpolator.interpolateValue(
                pos1.x,
                lines2[j].x,
                ratio,
              );
            interpolatedLines[j].y =
              ChartDefinitionInterpolator.interpolateValue(
                pos1.y,
                lines2[j].y,
                ratio,
              );
          }
        }
        // The square.
        if (
          interpolatedEntry.square &&
          interpolatedEntry.square.coordinates &&
          entry1.square &&
          entry1.square.coordinates &&
          entry2.square &&
          entry2.square.coordinates
        ) {
          const interpolatedCoordinates =
            ChartDefinitionInterpolator.interpolateValue(
              entry1.square.coordinates,
              entry2.square.coordinates,
              ratio,
            );
          interpolatedEntry.square.coordinates = new GoogRect(
            interpolatedCoordinates.left,
            interpolatedCoordinates.top,
            interpolatedCoordinates.width,
            interpolatedCoordinates.height,
          );
        }
        // The removeSerieButton.
        if (
          interpolatedEntry.removeSerieButton &&
          interpolatedEntry.removeSerieButton.coordinates &&
          entry1.removeSerieButton &&
          entry1.removeSerieButton.coordinates &&
          entry2.removeSerieButton &&
          entry2.removeSerieButton.coordinates
        ) {
          interpolatedEntry.removeSerieButton.coordinates =
            ChartDefinitionInterpolator.interpolateValue(
              entry1.removeSerieButton.coordinates,
              entry2.removeSerieButton.coordinates,
              ratio,
            ) as {x: number; y: number};
        }
      }
    }

    return interpolated;
  }
}
