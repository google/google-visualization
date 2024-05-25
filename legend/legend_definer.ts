/**
 * @fileoverview Legend definer.
 *
 * Calculates the measures needed to draw the legend.
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
import {Coordinate} from '@npm//@closure/math/coordinate';
import * as googMath from '@npm//@closure/math/math';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import * as googObject from '@npm//@closure/object/object';

import {memoize} from '../common/cache/memoize';
import {GOLDEN_RATIO} from '../common/constants';
import {
  LEGEND_ICON_WIDTH_SCALE_FACTOR_MAX,
  LEGEND_ICON_WIDTH_SCALE_FACTOR_MIN,
} from '../common/defaults';

import {
  Alignment,
  InteractivityModel,
  LegendPosition,
  Orientation,
  SerieType,
} from '../common/option_types';
import {Options as GvizOptions} from '../common/options';
import * as util from '../common/util';
import {Brush} from '../graphics/brush';
import {TextStyle} from '../text/text_style';

import {Coordinate as MathCoordinate} from '../math/coordinate';
import {TextAlign} from '../text/text_align';
import {TextMeasureFunction} from '../text/text_measure_function';

import {ChartDefinition} from '../visualization/corechart/chart_definition';
import * as chartdefinitionutil from '../visualization/corechart/chart_definition_utils';

import {TextLayout, calcTextLayout} from '../text/text_utils';
import {Entry, LegendDefinition, Page, ScrollItems} from './legend_definition';
import {LineLabelDescriptor} from './line_label_descriptor';
import {LineLabelPositioner} from './line_label_positioner';

// tslint:disable:ban-types Migration
// tslint:disable:ban-ts-suppressions

/**
 * A legend definer constructor.
 * This class is responsible for calculating legend entries (position, text,
 * etc).
 * @unrestricted
 */
export class LegendDefiner {
  /** The legend position, one of LegendPosition. */
  private readonly position: LegendPosition;

  /**
   * The legend alignment, one of Alignment.
   * Can be null if not given, and then the default depends on the legend's
   * location.
   */
  private readonly alignment: Alignment;

  /** The legend orientation. Determined by the legend position. */
  private readonly orientation: Orientation;

  /** The legend text style. */
  private readonly textStyle: TextStyle;

  /** Determines whether to show scroll buttons. */
  private showScrollButtons = false;

  /** The legend paging text style. */
  private readonly pagingTextStyle: TextStyle;

  /** The function used for measuring text. */
  private readonly textMeasureFunction: TextMeasureFunction;

  /** The height of the icon's square. */
  iconHeight: number;

  /** The width of the icon's square. */
  iconWidth: number;

  /**
   * The gap to the right of the icon, between item's icon and the item's
   * label. This is a function of the fontSize, so it *should* be a
   * textPadding.
   */
  gapIconRight: number;

  /** The area box of the legend. */
  private area: googMath.Box | null = null;

  /**
   * All visible legend entries, from all pages.
   * type {?Array.<{text:string, brush:?Brush, index:number}>}
   */
  private allVisibleEntries: Page | null = null;

  /** Whether or not to show page indices. */
  showPageIndex: boolean;

  /**
   * The scroll arrows direction - horizontal or vertical.
   * If not specifically set in the options, uses the legend's orientation.
   */
  scrollArrowsOrientation: Orientation;

  /** The active scroll arrows brush. */
  scrollArrowsActiveBrush: Brush;

  /** The inactive scroll arrows brush. */
  scrollArrowsInactiveBrush: Brush;

  /** The default displayed page index. */
  currentPageIndex: number;

  /**
   * An array of pages. Each page contains an array of its entries drawing
   * data.
   */
  pages: Page[] | null = null;

  /** The gap between scroll arrows and the legend page index. */
  private readonly gapScrollText: number;

  /** The Y coordinate of the top of the scroll items. */
  private scrollItemsY = 0;

  /** The X coordinate of left side of the scroll previous button. */
  private scrollPreviousX = 0;

  /** The X coordinate of left side of the scroll next button. */
  private scrollNextX = 0;

  /**
   * The max number of lines to allocate for the legend when the legend is
   * horizontal. Zero means "as much as possible".
   */
  maxLinesPerHorizontalPage: number;

  /**
   * The actual number of lines allocated for the legend when the legend is
   * horizontal.
   */
  actualLinesPerHorizontalPage = 0;

  /**
   * @param chartDefinition The chart definition.
   * @param options The options.
   * @param defaultPosition The default legend position. If null, ignore user's
   *     request and always use NONE.
   * @param iconWidthScaleFactor Optional scale factor to be used for width of
   *     colored icon (used to define a category in legend). If null, just use a
   *     square for the icon (width = height).
   */
  constructor(
    private readonly chartDefinition: ChartDefinition,
    options: GvizOptions,
    defaultPosition: LegendPosition | null,
    iconWidthScaleFactor?: number | null,
  ) {
    this.position = defaultPosition
      ? (options.inferStringValue(
          'legend.position',
          defaultPosition,
          LegendPosition,
        ) as LegendPosition)
      : LegendPosition.NONE;

    const defaultAlignment =
      this.position === LegendPosition.BOTTOM
        ? Alignment.CENTER
        : Alignment.START;

    this.alignment = options.inferStringValue(
      'legend.alignment',
      defaultAlignment,
      Alignment,
    ) as Alignment;

    let orientation = Orientation.HORIZONTAL;
    if (
      this.position === LegendPosition.LEFT ||
      this.position === LegendPosition.RIGHT ||
      this.position === LegendPosition.LABELED ||
      this.position === LegendPosition.BOTTOM_VERT
    ) {
      orientation = Orientation.VERTICAL;
    }

    this.orientation = orientation;

    const defaultTextStyle = {
      fontName: chartDefinition.defaultFontName,
      fontSize: chartDefinition.defaultFontSize,
      auraColor:
        this.position === LegendPosition.INSIDE
          ? chartDefinition.insideLabelsAuraColor
          : 'none',
    };

    this.textStyle = options.inferTextStyleValue(
      'legend.textStyle',
      defaultTextStyle,
    );

    this.pagingTextStyle = options.inferTextStyleValue(
      'legend.pagingTextStyle',
      this.textStyle,
    );

    this.textMeasureFunction = memoize(
      // The cast below is needed because memoize() requires a
      // non-null param, but chartDefinition.textMeasureFunction
      // isn't set non-null.
      chartDefinition.textMeasureFunction as (
        ...p1: AnyDuringMigration[]
      ) => AnyDuringMigration, // The default cache size of 1000 is not
      // enough for fast performance
      // when there are hundreds of entries in the legend.
      {size: 10000},
    ) as TextMeasureFunction;

    this.iconHeight = this.textStyle.fontSize;

    // Ensures valid value for width scale factor for icon.
    iconWidthScaleFactor = iconWidthScaleFactor
      ? googMath.clamp(
          iconWidthScaleFactor,
          LEGEND_ICON_WIDTH_SCALE_FACTOR_MIN,
          LEGEND_ICON_WIDTH_SCALE_FACTOR_MAX,
        )
      : 1;

    this.iconWidth = this.iconHeight * iconWidthScaleFactor;

    this.gapIconRight = Math.round(
      this.textStyle.fontSize / (GOLDEN_RATIO * GOLDEN_RATIO),
    );

    this.showPageIndex = options.inferBooleanValue(
      'legend.showPageIndex',
      true,
    );

    this.scrollArrowsOrientation = options.inferStringValue(
      'legend.scrollArrows.orientation',
      this.orientation,
      Orientation,
    ) as Orientation;

    this.scrollArrowsActiveBrush = options.inferBrushValue(
      'legend.scrollArrows.activeColor',
    );

    this.scrollArrowsInactiveBrush = options.inferBrushValue(
      'legend.scrollArrows.inactiveColor',
    );

    this.currentPageIndex = options.inferNonNegativeNumberValue(
      'legend.pageIndex',
      0,
    );

    this.gapScrollText = this.gapIconRight;

    this.maxLinesPerHorizontalPage =
      this.position === LegendPosition.TOP
        ? options.inferNonNegativeNumberValue('legend.maxLines', 1)
        : 1;
  }

  /**
   * Returns the legend position.
   * @return The legend position.
   */
  getPosition(): LegendPosition {
    return this.position;
  }

  /**
   * Returns the legend text style.
   * @return The legend text style.
   */
  getTextStyle(): TextStyle {
    return this.textStyle;
  }

  /**
   * Returns the legend area.
   * @return The legend area.
   */
  getArea(): googMath.Box | null {
    return this.area;
  }

  /**
   * Sets the legend area. A reference to the given box object is stored inside,
   * so its content shouldn't be changed externally.
   * @param area The legend area.
   */
  setArea(area: googMath.Box | null) {
    this.area = area;
  }

  /** Calculate the legend entries to display. */
  calcLegendEntries() {
    this.allVisibleEntries = this.chartDefinition.legendEntries.filter(
      (legendEntry) => legendEntry.isVisible,
    ) as AnyDuringMigration[];
  }

  /**
   * Calculates the legend definition. Must be called only after calling
   * calcLegendEntries().
   * @return The legend definition.
   */
  define(): LegendDefinition | null {
    if (!this.area) {
      return null;
    }
    asserts.assert(this.allVisibleEntries != null);

    if (this.position !== LegendPosition.NONE) {
      if (this.orientation === Orientation.VERTICAL) {
        this.calcVerticalLayout();
      } else {
        this.calcHorizontalLayout();
      }
    }

    let pageIndex = 0;
    let currentPage = null;
    let scrollItems = null;
    if (this.pages && this.pages.length > 0) {
      if (this.pages.length > 1) {
        // When specified currentPageIndex is greater than number of available
        // pages, set currentPageIndex to maximum available page index.
        pageIndex =
          this.currentPageIndex < this.pages.length
            ? this.currentPageIndex
            : this.pages.length - 1;
      }

      currentPage = this.pages[pageIndex];
      scrollItems = this.showScrollButtons
        ? this.calcScrollItems(
            pageIndex,
            pageIndex > 0,
            pageIndex < this.pages.length - 1,
          )
        : null;
    }

    return {
      position: this.position,
      area: this.area,
      pages: this.pages,
      currentPage,
      currentPageIndex: pageIndex,
      scrollItems,
    };
  }

  /** Does the actual work for @see calcLayout, for the vertical case. */
  private calcVerticalLayout() {
    const nonTextWidth = this.iconWidth + this.gapIconRight;
    const textWidth = Math.max(
      this.area!.right - this.area!.left - nonTextWidth,
      0,
    );
    const legendHeight = this.area!.bottom - this.area!.top;
    const legendWithPagingHeight = Math.max(
      legendHeight - this.iconHeight * 2,
      0,
    );

    asserts.assert(this.allVisibleEntries != null);
    const allVisibleEntries = this.allVisibleEntries;

    const chartDef = this.chartDefinition;
    // Reverse allVisibleEntries if needed (for stacked bars/area).
    if (chartdefinitionutil.reverseSeriesLabelsVertically(chartDef)) {
      // Note that this also reverse the allVisibleEntries member.
      allVisibleEntries!.reverse();
    }

    // Get the legend distribution to lines assuming we have infinite space.
    let optimisticLayouts = allVisibleEntries!.map(function (
      this: LegendDefiner,
      entry,
    ) {
      const layout = calcTextLayout(
        this.textMeasureFunction,
        entry.text as string,
        this.textStyle,
        textWidth,
        Infinity,
      );
      // We need at least one line (even if it is empty) for each legend
      // entry.
      if (layout.lines.length === 0) {
        layout.lines = [''];
      }
      return layout;
    }, this);

    if (
      this.position === LegendPosition.LABELED &&
      (chartDef.defaultSerieType === SerieType.LINE ||
        chartDef.defaultSerieType === SerieType.AREA)
    ) {
      // Using only one page.
      const page = this.calcVerticalEntriesByDataPosition(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'Page | null' is not assignable to
        //   parameter of type 'Page'.
        // ts-ignore was either removed or relocated below
        optimisticLayouts,
        legendHeight,
        // @ts-ignore inserted
        allVisibleEntries,
      );
      this.pages = [page];
      return;
    }

    let allocated = this.allocateHeightsForVerticalEntries(
      optimisticLayouts,
      legendHeight,
    );
    this.showScrollButtons =
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'Page | null' is not assignable to
      //   parameter of type 'Page'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      this.hasNextVerticalEntries(allVisibleEntries, allocated);
    if (!this.showScrollButtons) {
      // All entries fit in one page (or scrolling is disabled).
      const page =
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'Page | null' is not assignable to
        //   parameter of type 'Page'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        this.calcVerticalEntriesByAllocation(allocated, allVisibleEntries);
      this.pages = [page];
    } else {
      // Recalculate while leaving space for the scroll buttons.
      allocated = this.allocateHeightsForVerticalEntries(
        optimisticLayouts,
        legendWithPagingHeight,
      );

      if (allocated[0] === undefined || allocated[0].length === 0) {
        // No page can hold even a single line of a legend item, so there is no
        // reason for scroll buttons.
        this.showScrollButtons = false;
        return;
      }

      // Calculate pages.
      this.pages = [];
      let entries = allVisibleEntries;
      while (entries!.length > 0) {
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'Page | null' is not assignable to
        //   parameter of type 'Page'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        const page = this.calcVerticalEntriesByAllocation(allocated, entries);
        this.pages.push(page);

        // Find the size of the current page.
        let index = 0;
        while (
          allocated[index] !== undefined &&
          allocated[index].length !== 0
        ) {
          ++index;
        }
        optimisticLayouts = optimisticLayouts.slice(index);
        // Calculate next page.
        allocated = this.allocateHeightsForVerticalEntries(
          optimisticLayouts,
          legendWithPagingHeight,
        );
        entries = entries!.slice(index);
      }

      if (this.showScrollButtons) {
        // The scroll items are set at the bottom of the legend area - their
        // height is equal to an icon's width.
        this.scrollItemsY = Math.round(
          this.area!.bottom - this.textStyle.fontSize,
        );
        // The scroll items are aligned to the left of the legend area - in line
        // with the icons of the legend entries.
        this.scrollPreviousX = this.area!.left;
        this.scrollNextX =
          this.scrollPreviousX + this.textStyle.fontSize + this.gapScrollText;
        if (this.showPageIndex) {
          const pageIndexSize = this.calcMaxPageIndexSize(this.pages.length);
          this.scrollNextX += pageIndexSize + this.gapScrollText;
        }
      }
    }
  }

  /**
   * Allocates heights for entries in a vertical legend.
   *
   * @param optimisticLayouts The layout of the text of each entry.
   *     Each item is the return value of @see calcTextLayout.
   * @param legendHeight The max height of the legend.
   * @return The allocated heights. This is the return value of
   *     util.distributeRealEstateWithKeys.
   */
  private allocateHeightsForVerticalEntries(
    optimisticLayouts: Array<{lines: string[]; needTooltip: boolean}>,
    legendHeight: number,
  ): AnyDuringMigration {
    const fontSize = this.textStyle.fontSize;
    const vPadBetweenEntries = Math.round(fontSize / GOLDEN_RATIO);
    const vPadBetweenLines = Math.round(fontSize / (2 * GOLDEN_RATIO));
    const entryFirstLineHeight = fontSize + vPadBetweenEntries;
    const entryNextLinesHeight = fontSize + vPadBetweenLines;

    // Get the height needed for each line in the layout assuming we have
    // infinite space.
    const entriesRealEstate = this.calcVerticalEntriesRealEstate(
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type '{ lines: string[]; needTooltip: boolean;
      //   }[]' is not assignable to parameter of type 'TextLayout[]'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      optimisticLayouts,
      entryFirstLineHeight,
      entryNextLinesHeight,
    );

    return util.distributeRealEstateWithKeys(entriesRealEstate, legendHeight);
  }

  /**
   * Returns the last visible y value of a line, whether a data point or the
   * intersection of the line with the view window maximum.
   * If there isn't even a single data points with a y value it returns null.
   * @param serieIndex The index of the serie.
   * @return The last screen value of the line.
   */
  private getLastLineValueOfSerie(serieIndex: number): number | null {
    const hAxis = googObject.getAnyValue(this.chartDefinition.hAxes);
    const serie = this.chartDefinition.series[serieIndex];
    // Extract x,y coordinates from serie points. Keep null points.
    const points = serie.points.map((point) =>
      chartdefinitionutil.isDatumNull(point)
        ? null
        : new Coordinate(point!.scaled!.x, point!.scaled!.y),
    );

    // Check whether the line intersects with the view window maximum.
    const lineValueAtViewWindowMax = util.piecewiseLinearInterpolation(
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type '(Coordinate | null)[]' is not assignable
      //   to parameter of type 'Coordinate[]'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      points,
      hAxis!.endPos,
      serie.interpolateNulls,
    );
    if (lineValueAtViewWindowMax !== null) {
      return lineValueAtViewWindowMax;
    }
    // Line does not intersect with view window maximum.
    // Return the data value of the point preceding the view window maximum.
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type '(Coordinate | null)[]' is not assignable to
    //   parameter of type 'Coordinate[]'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    return this.getLastValuePreceding(points, hAxis!.endPos);
  }

  /**
   * Given a set of x,y coordinates and an x value, returns the y value of the
   * last coordinate preceding that value.
   * If no coordinate precedes the given value, return null.
   * @param coordinates The coordinates.
   * @param x The x value.
   * @return The y value of the last coordinate preceding the given value.
   */
  private getLastValuePreceding(
    coordinates: Coordinate[],
    x: number,
  ): number | null {
    coordinates = coordinates.filter((x) => x != null);
    const compareFn = (x: AnyDuringMigration, coordinate: AnyDuringMigration) =>
      googArray.defaultCompare(x, coordinate.x);
    const i = googArray.binarySearch(coordinates, x, compareFn);
    // See documentation of goog.array.binarySearch
    const insertionIndex = -(i + 1);
    const precedingCoordinates = coordinates.slice(0, insertionIndex);
    // Find the last non-null coordinates out of all preceding coordinates.
    const coordinate = googArray.findRight(
      precedingCoordinates,
      (coordinate) => coordinate.y !== null,
    );
    return coordinate ? coordinate.y : null;
  }

  /**
   * Calculates label positions for line labels so that the label vertical
   * position is as close to the last value of the line. Assumes that all labels
   * will fit given the current font size.
   *
   * @param optimisticLayouts The layout of the text of each entry.
   *     Each item is the return value of @see calcTextLayout.
   * @param allVisibleEntries The legend entries to try to place. Only entries
   *     for which some height was allocated will be used.
   * @return The entries to display.
   */
  private calcVerticalEntriesByDataPosition(
    optimisticLayouts: Array<{lines: string[]; needTooltip: boolean}>,
    legendHeight: number,
    allVisibleEntries: Page,
  ): Page {
    const maxTextWidth = this.area!.right - this.area!.left;
    const labelStartXPos = Math.round(this.area!.left);
    const labelDescriptors = [];
    const entries = [];
    const useDiveLegend =
      this.chartDefinition.interactivityModel === InteractivityModel.DIVE;
    let lineHeight = 0;

    for (let i = 0; i < allVisibleEntries.length; i++) {
      const originalEntry = allVisibleEntries[i];
      const allocatedRowsForEntry = optimisticLayouts[i].lines.length;
      const textLayout = calcTextLayout(
        this.textMeasureFunction,
        originalEntry.text as string,
        this.textStyle,
        maxTextWidth,
        allocatedRowsForEntry,
      );

      // Create legend entry and styles.
      const entry = {};
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'id' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.id = originalEntry.id;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'brush' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.brush = originalEntry.brush.clone();
      const textStyle = googObject.clone(this.textStyle) as TextStyle;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'brush' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      textStyle.color = entry.brush.getFill();
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'textBlock' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.textBlock = {
        text: originalEntry.text,
        textStyle,
        boxStyle: null,
        lines: [],
        paralAlign: TextAlign.START,
        perpenAlign: TextAlign.START,
        tooltip: textLayout.needTooltip ? originalEntry.text : '',
        anchor: null,
        angle: 0,
      };
      if (textStyle.auraColor) {
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'brush' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.brush.setStroke(textStyle.auraColor, 1);
      }
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'isVisible' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.isVisible = true;

      for (let j = 0; j < textLayout.lines.length; j++) {
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'textBlock' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.textBlock.lines.push({
          length: maxTextWidth,
          text: textLayout.lines[j],
        });
      }

      if (useDiveLegend) {
        // Determine position of the remove button.
        const textWidth =
          // Suppressing errors for ts-migration.
          //   TS2339: Property 'textBlock' does not exist on type '{}'.
          // ts-ignore was either removed or relocated below
          this.textMeasureFunction(
            // @ts-ignore inserted
            entry.textBlock.lines[0].text,
            textStyle,
          ).width;
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'removeSerieButton' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.removeSerieButton = {};
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'removeSerieButton' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.removeSerieButton.coordinates = {
          x: labelStartXPos + textWidth + 5,
        };
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'removeSerieButton' does not exist on type '{}'.
        //   TS2339: Property 'brush' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.removeSerieButton.brush = entry.brush;
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'removeSerieButton' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.removeSerieButton.isVisible = false;
      }
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'index' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.index = originalEntry.index;

      // Find closest data value to place label near.
      // TODO(dlaliberte): Handle null in a less hacky way.
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'index' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      const desiredPosition = this.getLastLineValueOfSerie(entry.index) || 0;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'textBlock' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      const firstLine = entry.textBlock.lines[0];
      // TODO(dlaliberte): lineHeight should only have to be calculated once.
      lineHeight = this.textMeasureFunction(firstLine, textStyle).height;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'textBlock' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      const textHeight = entry.textBlock.lines.length * lineHeight;
      const descriptor = new LineLabelDescriptor(
        desiredPosition,
        textHeight,
        entry as Entry,
      );
      labelDescriptors.push(descriptor);

      entries.push(entry);
    }

    // Calculate positions using the positioner and assign them.
    const lineLabelPositioner = new LineLabelPositioner(
      legendHeight,
      labelDescriptors,
    );
    lineLabelPositioner.adjustPositions();
    for (let j = 0; j < labelDescriptors.length; j++) {
      const descriptor = labelDescriptors[j];
      const calculatedYPos = descriptor.getTop();
      const entry = descriptor.getLabelEntry();
      const lines = entry!.textBlock.lines;
      for (let i = 0; i < lines.length; i++) {
        lines[i].y = Math.round(i * lineHeight + calculatedYPos);
        lines[i].x = labelStartXPos;
        if (useDiveLegend) {
          entry!.removeSerieButton!.coordinates!.y = lines[i].y;
        }
      }
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type '{}[]' is not assignable to type 'Page'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    return entries;
  }

  /**
   * Calculates the position and layout of legend entries by their allocated
   * heights.
   *
   * @param allocated The allocated heights. This is the return value of
   *     util.distributeRealEstateWithKeys.
   * @param allVisibleEntries The legend entries to try to place. Only entries
   *     for which some height was allocated will be used.
   * @return The entries to display.
   */
  private calcVerticalEntriesByAllocation(
    allocated: AnyDuringMigration,
    allVisibleEntries: Page,
  ): Page {
    const nonTextWidth = this.iconWidth + this.gapIconRight;
    const maxTextWidth = this.area!.right - this.area!.left - nonTextWidth;
    const fontSize = this.textStyle.fontSize;
    const vPadBetweenEntries = Math.round(fontSize / GOLDEN_RATIO);
    const vPadBetweenLines = Math.round(fontSize / (2 * GOLDEN_RATIO));
    const entryFirstLineHeight = fontSize + vPadBetweenEntries;
    const entryNextLinesHeight = fontSize + vPadBetweenLines;

    // Reset entries.
    const entries = [];
    let y = 0;
    const x = Math.round(this.area!.left);
    for (let i = 0; i < allVisibleEntries.length; i++) {
      const originalEntry = allVisibleEntries[i];
      const allocatedForEntry = allocated[i].length;
      if (allocatedForEntry === 0) {
        continue;
      }

      const textLayout = calcTextLayout(
        this.textMeasureFunction,
        originalEntry.text as string,
        this.textStyle,
        maxTextWidth,
        allocatedForEntry,
      );

      const entry = {};
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'id' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.id = originalEntry.id;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'textBlock' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.textBlock = {
        text: originalEntry.text,
        textStyle: this.textStyle,
        boxStyle: null,
        lines: [],
        anchor: new MathCoordinate(x, 0),
        paralAlign: TextAlign.START,
        perpenAlign: TextAlign.START,
        tooltip: textLayout.needTooltip ? originalEntry.text : '',
        angle: 0,
      };
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square = {};
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square.coordinates = new GoogRect(
        x,
        y,
        this.iconWidth,
        this.iconHeight,
      );
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square.brush = originalEntry.brush.clone();
      if (this.textStyle.auraColor) {
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'square' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.square.brush.setStroke(this.textStyle.auraColor, 1);
      }
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'isVisible' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.isVisible = true;

      for (let j = 0; j < textLayout.lines.length; j++) {
        if (j > 0) {
          y += entryNextLinesHeight;
        }
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'textBlock' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.textBlock.lines.push({
          x: nonTextWidth,
          y,
          length: maxTextWidth,
          text: textLayout.lines[j],
        });
      }

      // Suppressing errors for ts-migration.
      //   TS2339: Property 'index' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.index = originalEntry.index;
      // The variable 'y' holds the top coordinate of the legend lines. At this
      // point it holds the coordinate of the last line of that entry, and we
      // want to advance it to the first line of the next entry. This means a
      // "between entries" spacing.
      y += entryFirstLineHeight;

      entries.push(entry);
    }

    // Align the entire legend according to the alignment, either to the top,
    // bottom or center. We do so by shifting the y position of all entries.
    // When scrolling buttons are visible, we only allow top alignment.
    let offsetY = Math.round(this.area!.top);
    if (!this.showScrollButtons) {
      const usedHeight = y - vPadBetweenEntries;
      const totalHeight = this.area!.bottom - this.area!.top;
      if (this.alignment === Alignment.END) {
        offsetY += totalHeight - usedHeight;
      } else if (this.alignment === Alignment.CENTER) {
        offsetY += Math.floor((totalHeight - usedHeight) / 2);
      }
    }
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square.coordinates.top += offsetY;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'textBlock' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.textBlock.anchor.y += offsetY;
    }

    // Suppressing errors for ts-migration.
    //   TS2322: Type '{}[]' is not assignable to type 'Page'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    return entries;
  }

  /**
   * Calculates the needed height of each line of the legend entries.
   *
   * @param optimisticLayouts The entries layout assuming there is infinite
   *     space for the legend.
   * @param entryFirstLineHeight The height of the first line in an entry.
   * @param entryNextLinesHeight The height of all lines but the first line in
   *     an entry.
   * @return The legend lines height allocation to be used as input to the
   *     distribution algorithm. The array contains the allocation for the first
   *     line of every entry first, and then the second line of every entry and
   *     so on, because the distribution algorithm expects to get the array in
   *     descending order of priority.
   */
  private calcVerticalEntriesRealEstate(
    optimisticLayouts: TextLayout[],
    entryFirstLineHeight: number,
    entryNextLinesHeight: number,
  ): Array<{key: number; min: number; extra: number[]}> {
    const maxEntryNumOfLines = optimisticLayouts.reduce(
      (max, layout) => Math.max(max, layout.lines.length),
      0,
    );

    const entriesRealEstate: AnyDuringMigration[] = [];
    for (let i = 0; i < maxEntryNumOfLines; i++) {
      // The first line of every entry needs more space above it than other
      // lines of that entry because the space between entries is larger than
      // the space between lines of the same entry.
      const lineHeight = i === 0 ? entryFirstLineHeight : entryNextLinesHeight;
      optimisticLayouts.forEach(function (this: LegendDefiner, layout, j) {
        if (i < layout.lines.length) {
          // The above comment is correct for all entries but the first one. The
          // first line of the first entry needs zero space above it, since
          // there's nothing above it. This condition assigns fontSize to
          // 'height' in this case, which means zero space.
          const height =
            i === 0 && j === 0 ? this.textStyle.fontSize : lineHeight;
          entriesRealEstate.push({key: j, min: height, extra: []});
        }
      }, this);
    }

    return entriesRealEstate;
  }

  /**
   * Checks if there are entries that we can't fit in the available space.
   *
   * @param allVisibleEntries All the entries that we are currently trying to
   *     show.
   * @param allocated The allocated heights. This is the return value of
   *     util.distributeRealEstateWithKeys.
   * @return Whether there are entries that we can't fit.
   */
  private hasNextVerticalEntries(
    allVisibleEntries: Page,
    allocated: AnyDuringMigration,
  ): boolean {
    const lastEntryIndex = allVisibleEntries.length - 1;
    // Currently, the distribution to pages is done by allocating to each entry
    // a single line and in the last page the lines are distributed evenly.
    // Therefore, it is possible to scroll ahead if we have more than one entry
    // to show and there are entries that don't fit in the available space.
    return allVisibleEntries.length > 1 && allocated[lastEntryIndex].length < 1;
  }

  /**
   * Calculate how many lines are needed to fit the whole horizontal legend in
   * the given width. This value is capped by 'maxLines' if it is not 0. Must be
   * called only after calling calcLegendEntries().
   *
   * @param legendWidth The width of the legend area.
   * @return The number of lines needed to fit the legend.
   */
  calcMaxNeededLines(legendWidth: number): number {
    asserts.assert(this.allVisibleEntries != null);
    let entries = this.allVisibleEntries;
    let allocated =
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'Page | null' is not assignable to
      //   parameter of type 'Page'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      this.allocateWidthsForHorizontalEntries(entries, legendWidth);
    let lines = 1;
    while (
      (this.maxLinesPerHorizontalPage === 0 ||
        this.maxLinesPerHorizontalPage > lines) &&
      allocated.length < entries!.length
    ) {
      // There is a need for another line.
      ++lines;
      entries = entries!.slice(allocated.length);
      allocated = this.allocateWidthsForHorizontalEntries(entries, legendWidth);
    }
    return lines;
  }

  /** Does the actual work for @see calcLayout, for the horizontal case. */
  private calcHorizontalLayout() {
    // Calculate the entries distribution to pages.
    // First try to fit everything in a single page. Otherwise, the entries
    // compete with the page index, so first try to use less than 10 pages (a
    // single digit in the page index), if that fails try to use less than 100
    // pages. If we need even more than that, show no page index at all - that
    // always works.
    const maxAllowedPages = [1, 9, 99, 0];
    for (let i = 0; i < maxAllowedPages.length; ++i) {
      if (this.setHorizontalPages(maxAllowedPages[i])) {
        break;
      }
    }

    if (this.showScrollButtons) {
      // The scroll items are set at middle of the legend area.
      this.scrollItemsY = Math.round(
        (this.area!.top + this.area!.bottom - this.textStyle.fontSize) / 2,
      );
      // The scroll items are aligned to the right of the legend area.
      this.scrollNextX = this.area!.right - this.textStyle.fontSize;
      this.scrollPreviousX =
        this.scrollNextX - this.gapScrollText - this.textStyle.fontSize;
      if (this.showPageIndex) {
        const pageIndexSize = this.calcMaxPageIndexSize(this.pages!.length);
        this.scrollPreviousX -= pageIndexSize + this.gapScrollText;
      }
    }
  }

  /**
   * Tries to set the legend entries into pages. The 'maxAllowedPages' defines
   * how much room is left to place the entries after subtracting the space
   * needed for the scroll items. This may influence the resulting number of
   * pages and if the result is more than 'maxAllowedPages' pages, the
   * assignment fails. If the assignment fails, the method does not undo its
   * changes.
   *
   * If the space that remains for the entries is too small to contain even a
   * single entry, the scrolling items will not be shown and the method will
   * return true.
   *
   * @param maxAllowedPages The maximal number of pages allowed to create. If
   *     this is 0, it is assumed that the page index is not shown.
   * @return Whether the assignment succeeded or not.
   */
  private setHorizontalPages(maxAllowedPages: number): boolean {
    let totalWidth = this.area!.right - this.area!.left;
    let singlePage = false;
    // Compute (again) gap between items.
    const gapBetweenItems = Math.round(this.textStyle.fontSize * GOLDEN_RATIO);
    if (maxAllowedPages !== 1) {
      // Subtract the size of the scroll items (2 arrows and the page index).
      // Also include padding to the left, same as gap between items.
      totalWidth -=
        gapBetweenItems + this.gapScrollText + this.textStyle.fontSize * 2;
      singlePage = true;
      if (maxAllowedPages !== 0) {
        totalWidth -=
          this.calcMaxPageIndexSize(maxAllowedPages) + this.gapIconRight;
      }
    }

    asserts.assert(this.allVisibleEntries != null);
    let allocated = this.allocateWidthsForHorizontalEntries(
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'Page | null' is not assignable to
      //   parameter of type 'Page'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      this.allVisibleEntries,
      totalWidth,
    );

    if (allocated.length === 0) {
      // No page can hold even a single legend entry, so there is no reason for
      // scroll buttons.
      this.showScrollButtons = false;
      return true;
    }

    this.pages = [];
    let entries = this.allVisibleEntries;
    while (entries!.length > 0) {
      if (maxAllowedPages > 0 && this.pages.length === maxAllowedPages) {
        // We need more pages than permitted.
        return false;
      }
      const row = this.calcHorizontalEntriesByAllocation(
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'Page | null' is not assignable to
        //   parameter of type 'Page'.
        // ts-ignore was either removed or relocated below
        allocated,
        // @ts-ignore inserted
        entries,
        singlePage,
      );
      const rows = [row];
      for (
        let linesCount = 1;
        linesCount < this.actualLinesPerHorizontalPage;
        linesCount++
      ) {
        if (entries!.length === allocated.length) {
          // All entries fit in this page.
          break;
        } else {
          entries = entries!.slice(allocated.length);
          // Calculate next row.
          allocated = this.allocateWidthsForHorizontalEntries(
            entries,
            totalWidth,
          );
          rows.push(
            this.calcHorizontalEntriesByAllocation(
              allocated,
              entries,
              singlePage,
            ),
          );
        }
      }
      const page = this.distributeHeightsForHorizontalPage(rows);
      this.pages.push(page);

      entries = entries!.slice(allocated.length);
      // Calculate next page.
      allocated = this.allocateWidthsForHorizontalEntries(entries, totalWidth);
    }

    this.showScrollButtons = this.pages.length > 1;

    return true;
  }

  /**
   * Distribute the rows of a page so it will be vertically centered in the
   * legend area.
   *
   * @param pageRows The rows of the page. It's an array of rows where each row
   *     is an array of entries.
   * @return The entries to display.
   */
  private distributeHeightsForHorizontalPage(pageRows: Entry[][]): Entry[] {
    // Calculate how high each row should be.
    const topY = this.area!.top;
    const bottomY = this.area!.bottom;
    const totalHeight = bottomY - topY;
    const heightForOneLine = this.textStyle.fontSize;
    const heightForAllText =
      this.actualLinesPerHorizontalPage * heightForOneLine;
    const heightForAllSpaces = totalHeight - heightForAllText;
    const heightForOneSpace =
      this.actualLinesPerHorizontalPage > 1
        ? heightForAllSpaces / (this.actualLinesPerHorizontalPage - 1)
        : 0;

    const actualHeight =
      (heightForOneLine + heightForOneSpace) * pageRows.length -
      heightForOneSpace;
    // The offset is non-zero only in cases where the number of lines in this
    // page is smaller than the number of lines per page in general. This can
    // happen only if actualLinesPerHorizontalPage is more than 1 and we're in
    // the last page, so there's not enough entries to fill all available lines.
    let offset = (totalHeight - actualHeight) / 2;
    const page: AnyDuringMigration[] = [];
    pageRows.forEach((row) => {
      const roundOffset = Math.round(offset);
      row.forEach((entry) => {
        // The entry already has all properties correctly set by now, except the
        // Y coordinate, which we adjust here.
        entry.textBlock.anchor!.y += roundOffset;
        entry.square!.coordinates.top += roundOffset;
      });
      offset += heightForOneLine + heightForOneSpace;
      googArray.extend(page, row);
    });
    return page;
  }

  /**
   * Allocates widths for entries in a horizontal legend.
   *
   * @param allVisibleEntries The legend entries to allocate space for.
   * @param totalWidth The available width to position the entries.
   * @return An array that contains the width that each entry gets. The array
   *     contains only the widths of entries that fit, so it can be shorter than
   *     the size of 'allVisibleEntries'.
   */
  private allocateWidthsForHorizontalEntries(
    allVisibleEntries: Page,
    totalWidth: number,
  ): number[] {
    const nonTextWidth = this.iconWidth + this.gapIconRight;

    // Golden Ratio Lesson #57:
    // The expression below "(w*(2-GR))/2" is equal to "(w-w/GR)/2".
    // We would like the width of the chart area to be equal "w/GR".
    // So, "w-w/GR" denotes the total width of the right and left margins.
    // "(w-w/GR)/2" is the size of a single "golden margin" (the right or the
    // left).

    // We would like the minimal trimmed size of an entry to be equal to the
    // width of a "golden margin" that depends only on the width on the chart.
    // This calculation does not rely on the size of the actual right margin,
    // because this size can be modified by the user and create unwanted
    // results. Also, we don't want this value to be greater than the actual
    // space allocated to the legend entries.
    const minTrimmedWidth = Math.min(
      (this.chartDefinition.width * (2 - GOLDEN_RATIO)) / 2,
      totalWidth,
    );

    if (minTrimmedWidth < nonTextWidth) {
      // The width is too small to hold even an entry icon.
      return [];
    }

    // Get the legend widths distribution assuming we have infinite space.
    const entriesRealEstate = this.calcHorizontalEntriesRealEstate(
      minTrimmedWidth,
      allVisibleEntries,
    );
    // Get the widths distribution among the entries that fit the available
    // space.
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type '{ min: number; extra: number[]; }[]' is not
    //   assignable to parameter of type 'RealEstateItem[]'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    const result = util.distributeRealEstate(entriesRealEstate, totalWidth);
    // TODO(dlaliberte): Avoid cast of result. Update distributeRealEstate.
    return result as number[];
  }

  /**
   * Calculates the position and layout of legend entries by their allocated
   * widths.
   *
   * @param allocatedWidths The allocated widths. This is the return value of
   *     allocateWidthsForHorizontalEntries.
   * @param allVisibleEntries The legend entries to try to place. Only entries
   *     for which some width was allocated will be used.
   * @param singlePage Whether we are in a single page mode, meaning without
   *     page buttons.
   * @return The entries to display.
   */
  private calcHorizontalEntriesByAllocation(
    allocatedWidths: number[],
    allVisibleEntries: Page,
    singlePage: boolean,
  ): Page {
    const totalWidth = this.area!.right - this.area!.left;
    const nonTextWidth = this.iconWidth + this.gapIconRight;
    // The gap between the label of item i and the icon of item i+1.
    const gapBetweenItems = Math.round(this.textStyle.fontSize * GOLDEN_RATIO);

    // Setting the entries.
    const entries = [];
    let x = 0;
    const y = Math.round(this.area!.top);
    for (let i = 0; i < allocatedWidths.length; i++) {
      const originalEntry = allVisibleEntries[i];
      const allowedTextWidth =
        allocatedWidths[i] - nonTextWidth - (i > 0 ? gapBetweenItems : 0);
      const textLayout = calcTextLayout(
        this.textMeasureFunction,
        originalEntry.text as string,
        this.textStyle,
        allowedTextWidth,
        1,
      );
      const displayedText =
        textLayout.lines.length > 0 ? textLayout.lines[0] : '';
      const displayedTextWidth = this.textMeasureFunction(
        displayedText,
        this.textStyle,
      ).width;
      const lines = [
        {
          x: x + nonTextWidth,
          y: 0, // The actual text width we put in the entry might be smaller
          // than
          // allowedTextWidth, and we want the real one.
          length: displayedTextWidth,
          text: displayedText,
        },
      ];

      const entry = {};
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'id' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.id = originalEntry.id;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'textBlock' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.textBlock = {
        text: originalEntry.text,
        textStyle: this.textStyle,
        boxStyle: null,
        lines: displayedText ? lines : [],
        anchor: new MathCoordinate(0, y),
        paralAlign: TextAlign.START,
        perpenAlign: TextAlign.START,
        tooltip: textLayout.needTooltip ? originalEntry.text : '',
        angle: 0,
      };
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'isVisible' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.isVisible = true;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square = {};
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square.brush = originalEntry.brush.clone();
      if (this.textStyle.auraColor) {
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'square' does not exist on type '{}'.
        // ts-ignore was either removed or relocated below
        // @ts-ignore inserted
        entry.square.brush.setStroke(this.textStyle.auraColor, 1);
      }
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square.coordinates = new GoogRect(
        x,
        y,
        this.iconWidth,
        this.iconHeight,
      );
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'index' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.index = originalEntry.index;
      entries.push(entry);
      x += displayedTextWidth + nonTextWidth + gapBetweenItems;
    }

    // Align the entire legend according to the alignment, either to the left,
    // right or center. We do so by shifting the x position of all entries.
    // When scrolling buttons are visible, we only allow left alignment.
    let offsetX = this.area!.left;
    if (!singlePage) {
      const usedWidth = x - gapBetweenItems;
      if (this.alignment === Alignment.END) {
        offsetX += totalWidth - usedWidth;
      } else if (this.alignment === Alignment.CENTER) {
        offsetX += Math.floor((totalWidth - usedWidth) / 2);
      }
    }
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'square' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.square.coordinates.left += offsetX;
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'textBlock' does not exist on type '{}'.
      // ts-ignore was either removed or relocated below
      // @ts-ignore inserted
      entry.textBlock.anchor.x += offsetX;
    }

    // Suppressing errors for ts-migration.
    //   TS2322: Type '{}[]' is not assignable to type 'Page'.
    // ts-ignore was either removed or relocated below
    // @ts-ignore inserted
    return entries;
  }

  /**
   * Calculates the needed width for each of the legend entries.
   *
   * @param minTrimmedWidth The minimal width of a trimmed entry.
   * @param allVisibleEntries The entries in the legend.
   * @return The legend lines width requirements for the allocation algorithm.
   *     The extra contains a single number which is the reminder of the entry
   *     past the minimum.
   */
  private calcHorizontalEntriesRealEstate(
    minTrimmedWidth: number,
    allVisibleEntries: Page,
  ): Array<{min: number; extra: number[]}> {
    const nonTextWidth = this.iconWidth + this.gapIconRight;
    // The gap between the label of item i and the icon of item i+1.
    const gapBetweenItems = Math.round(this.textStyle.fontSize * GOLDEN_RATIO);

    // The minimal trimmed width must be at least the 'non text width'.
    asserts.assert(minTrimmedWidth >= nonTextWidth);

    const entriesRealEstate = allVisibleEntries.map(function (
      this: LegendDefiner,
      entry,
      i,
    ) {
      const textWidth = this.textMeasureFunction(
        entry.text as string,
        this.textStyle,
      ).width;
      const maxWidth = textWidth + nonTextWidth;
      let minWidth = Math.min(minTrimmedWidth, maxWidth);
      const extra = maxWidth - minWidth;
      if (i > 0) {
        minWidth += gapBetweenItems;
      }
      return {min: minWidth, extra: [extra]};
    }, this);

    return entriesRealEstate;
  }

  /**
   * Calculates the size of the widest page index text.
   *
   * @param lastPage The last page number.
   * @return The max possible size of the page index text.
   */
  private calcMaxPageIndexSize(lastPage: number): number {
    // Assuming 0 is the widest digit - calculate the widest possible page
    // index.
    let pageIndex = '0';
    while (lastPage >= 10) {
      pageIndex += '0';
      lastPage /= 10;
    }
    const pageText = `${pageIndex}/${pageIndex}`;
    return this.textMeasureFunction(pageText, this.pagingTextStyle).width;
  }

  /**
   * Calculates the scroll arrows icons and paging index.
   *
   * @param pageIndex The index of the current page.
   * @param hasPrevious Whether there's a need for a 'previous' button.
   * @param hasNext Whether there's a need for a 'next' button.
   * @return Drawing data for the scroll buttons.
   */
  private calcScrollItems(
    pageIndex: number,
    hasPrevious: boolean,
    hasNext: boolean,
  ): ScrollItems {
    const y = this.scrollItemsY;
    // Create the page index text block.
    let pageIndexTextBlock = null;
    if (this.showPageIndex) {
      // The page index text format is <current>/<total>.
      const pageIndexText = `${pageIndex + 1}/${this.pages!.length}`;
      const x = this.scrollPreviousX + this.textStyle.fontSize;
      const length = this.scrollNextX - x;
      pageIndexTextBlock = {
        text: pageIndexText,
        textStyle: this.pagingTextStyle,
        boxStyle: null,
        lines: [{x: x + length / 2, y, text: pageIndexText, length}],
        paralAlign: TextAlign.CENTER,
        perpenAlign: TextAlign.START,
        tooltip: '',
        anchor: null,
        angle: 0,
      };
    }

    const useUpDown = this.scrollArrowsOrientation === Orientation.VERTICAL;

    const buttonWidth = this.textStyle.fontSize;
    const halfButtonWidth = Math.round(buttonWidth / 2);

    // Create arrows.
    const prevButtonX = this.scrollPreviousX;
    const nextButtonX = this.scrollNextX;
    let previousPath = null;
    let nextPath = null;
    if (useUpDown) {
      // Draw an up arrow.
      // Bottom right corner, then the tip and finally the bottom left corner.
      previousPath = [
        {x: prevButtonX + buttonWidth, y: y + buttonWidth},
        {x: prevButtonX + halfButtonWidth, y},
        {x: prevButtonX, y: y + buttonWidth},
      ];
      // Draw a down array.
      // Top left corner, then the top right corner and finally the tip.
      nextPath = [
        {x: nextButtonX, y},
        {x: nextButtonX + buttonWidth, y},
        {x: nextButtonX + halfButtonWidth, y: y + buttonWidth},
      ];
    } else {
      // Draw a left arrow.
      // Bottom right corner, then the top right corner and finally the tip.
      previousPath = [
        {x: prevButtonX + buttonWidth, y: y + buttonWidth},
        {x: prevButtonX + buttonWidth, y},
        {x: prevButtonX, y: y + halfButtonWidth},
      ];
      // Draw a right array.
      // Top left corner, then the tip and finally the bottom left corner.
      nextPath = [
        {x: nextButtonX, y},
        {x: nextButtonX + buttonWidth, y: y + halfButtonWidth},
        {x: nextButtonX, y: y + buttonWidth},
      ];
    }

    const brushes = {
      active: this.scrollArrowsActiveBrush,
      inactive: this.scrollArrowsInactiveBrush,
    };

    const previousButton = {
      path: previousPath,
      active: hasPrevious,
      brushes,
      brush: hasPrevious ? brushes.active : brushes.inactive,
    };

    const nextButton = {
      path: nextPath,
      active: hasNext,
      brushes,
      brush: hasNext ? brushes.active : brushes.inactive,
    };

    return {
      previousButton,
      nextButton,
      pageIndexTextBlock,
    } as ScrollItems;
  }
}
