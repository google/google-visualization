/**
 * @fileoverview The annotation definer, used to position annotations in an axis chart.
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
import {
  assert,
  assertNumber,
} from '@npm//@closure/asserts/asserts';

import * as googObject from '@npm//@closure/object/object';

import * as googColor from '@npm//@closure/color/color';
import {Rect as GoogRect} from '@npm//@closure/math/rect';
import {Options} from '../../common/options';
import {AxisChartDefinerInterface} from './axis_chart_definer_interface';

import {
  AnnotationStyle,
  Direction,
  Orientation,
  SerieType,
  SeriesRelativeColor,
} from '../../common/option_types';
import {Brush} from '../../graphics/brush';
import {
  TextBlock,
  TextBlockPosition,
  TextBlockTypeObject,
} from '../../text/text_block';

import * as gvizJson from '../../common/json';
import {TextAlign} from '../../text/text_align';

import {Coordinate as GvizCoordinate} from '../../math/coordinate';
import {PartialTextStyleProperties, TextStyle} from '../../text/text_style';
import {calcTextLayout} from '../../text/text_utils';
import {
  Annotation,
  ScaledDatumDefinition,
  StackingType,
} from '../../visualization/corechart/chart_definition_types';
import {
  ColumnRole,
  RoleToColumnMapping,
} from '../../visualization/corechart/serie_columns';
import * as chartdefinitionutil from './chart_definition_utils';

/**
 * An annotation definer constructor.
 * This class is responsible for calculating annotation positions.
 */
export class AnnotationDefiner {
  /**
   * @param chartDefiner The chart definer.
   * @param options The options.
   */
  constructor(
    private readonly chartDefiner: AxisChartDefinerInterface,
    private readonly options: Options,
  ) {}

  /**
   * Positions all annotations in the chart, both datum and domain annotations.
   */
  positionAnnotations() {
    const chartDef = this.chartDefiner.getChartDefinition();
    const options = this.options;
    const domainAxis = this.chartDefiner.getDomainAxisDefiner();

    const orientation: Orientation =
      chartDef.orientation || Orientation.HORIZONTAL;
    assert(orientation != null);

    if (!domainAxis) {
      // TODO(dlaliberte) This happens with the diff scatter chart.
      return;
    }

    let hAxisDir: Direction | null = domainAxis.direction;
    let vAxisDir: Direction | null = Direction.BACKWARD;

    // For domain annotations, the vertical axis direction defaults to BACKWARD
    // so the 'point' annotation is above the horizontal axis, and when
    // domain orientation is 'vertical', the horizontal axis direction is
    // FORWARD so the 'point' annotation is on the right side of the vertical
    // axis. This is wrong when the vertical axis is on the right side.
    // TODO(dlaliberte) Fix this for targetAxisIndex: 'right'
    if (orientation === Orientation.VERTICAL) {
      hAxisDir = Direction.FORWARD;
      vAxisDir = domainAxis.direction;
    }

    // Are variable width bars being used here?
    const divisionDef = this.chartDefiner.getDivisionDefinition();
    const isVariableWidthBars = divisionDef && divisionDef.variableWidth;

    const defaultTextStyle: PartialTextStyleProperties = {
      fontName: chartDef.defaultFontName,
      fontSize: chartDef.defaultFontSize,
      auraColor: chartDef.insideLabelsAuraColor,
    };

    // Position domain annotations.
    // TODO(dlaliberte): Support multiple domains.

    const domainAnnotationTextStyle = options.inferTextStyleValue(
      ['annotations.domain.textStyle', 'annotations.textStyle'],
      defaultTextStyle,
    );
    const domainAnnotationBoxStyle = options.inferBrushValue([
      'annotations.domain.boxStyle',
      'annotations.boxStyle',
    ]);
    const domainAnnotationStemColor = options.inferColorValue(
      [
        'annotations.domain.stem.color',
        'annotations.domain.stemColor',
        'annotations.stem.color',
        'annotations.stemColor',
      ],
      '',
    );
    const domainAnnotationStemLength = options.inferNumberValue(
      [
        'annotations.domain.stem.length',
        'annotations.domain.stemLength',
        'annotations.stem.length',
        'annotations.stemLength',
      ],
      5,
    );

    let defaultAngle = 90; // for horizontal domain
    if (orientation === Orientation.VERTICAL) {
      defaultAngle = 0;
    }
    const domainAnnotationStemAngle = options.inferNumberValue(
      ['annotations.domain.stem.angle', 'annotations.stem.angle'],
      defaultAngle,
    );

    let domainAnnotationStyle = options.inferStringValue(
      ['annotations.domain.style', 'annotations.style'],
      AnnotationStyle.POINT,
      AnnotationStyle,
    ) as AnnotationStyle;
    if (domainAnnotationStyle === AnnotationStyle.LETTER) {
      // Convert 'letter' to 'point'
      domainAnnotationStyle = AnnotationStyle.POINT;
    }

    chartDef.categories.forEach((category, categoryIndex) => {
      const categoryPointAnnotations: AnnotationDefinerAnnotation[] = [];
      const categoryLineAnnotations: AnnotationDefinerAnnotation[] = [];

      chartDef.domainsColumnStructure.forEach(
        (domainsColumnStructure, domainIndex) => {
          const annotations = this.extractAnnotations(
            categoryIndex,
            domainsColumnStructure.columns,
            domainAnnotationStyle,
          );
          googArray.extend(categoryPointAnnotations, annotations.point);
          googArray.extend(categoryLineAnnotations, annotations.line);
        },
      );
      if (!categoryPointAnnotations.length && !categoryLineAnnotations.length) {
        // No annotations found.
        return;
      }

      const numericDomainValue =
        this.chartDefiner.getNumericDomainValue(categoryIndex);
      const d = domainAxis.calcPosForNumOrError(numericDomainValue);

      let x = null;
      let y = null;
      if (orientation === Orientation.VERTICAL) {
        x = chartDef.chartArea.left;
        y = d;
      } else {
        x = d;
        y = chartDef.chartArea.top + chartDef.chartArea.height; // == bottom
      }

      // We position the point annotations and line annotations separately.
      if (categoryPointAnnotations.length) {
        category.annotation = this.positionPointAnnotation(
          x,
          y,
          null,
          /* serie.type = */ SerieType.NONE,
          /* color = */ '',
          /* isStacked = */ false,
          orientation,
          hAxisDir,
          vAxisDir,
          categoryPointAnnotations,
          domainAnnotationTextStyle,
          domainAnnotationBoxStyle,
          domainAnnotationStemLength,
          domainAnnotationStemColor,
          domainAnnotationStemAngle,
        );
      }
      if (categoryLineAnnotations.length) {
        if (chartDef.orientation === Orientation.VERTICAL) {
          x = null;
        } else {
          y = null;
        }
        category.annotation = this.positionLineAnnotation(
          x,
          y,
          orientation,
          categoryLineAnnotations,
          domainAnnotationTextStyle,
          domainAnnotationStemColor,
        );
      }
    });

    // Position datum annotations.
    const relativeColors = googObject.getValues(SeriesRelativeColor);
    const globalUseHighContrast = options.inferBooleanValue(
      ['annotations.datum.highContrast', 'annotations.highContrast'],
      true,
    );
    const globalOutsideOnly = options.inferBooleanValue(
      ['annotations.datum.alwaysOutside', 'annotations.alwaysOutside'],
      false,
    );
    const defaultDatumAnnotationTextStyle = options.inferTextStyleValue(
      ['annotations.datum.textStyle', 'annotations.textStyle'],
      defaultTextStyle,
      relativeColors,
    );
    const defaultDatumAnnotationBoxStyle = options.inferBrushValue([
      'annotations.datum.boxStyle',
      'annotations.boxStyle',
    ]);
    const defaultDatumAnnotationStemColor = options.inferColorValue(
      [
        'annotations.datum.stem.color',
        'annotations.datum.stemColor',
        'annotations.stem.color',
        'annotations.stemColor',
      ],
      '',
      relativeColors,
    );
    const defaultDatumAnnotationStemLength = options.inferNumberValue(
      [
        'annotations.datum.stem.length',
        'annotations.datum.stemLength',
        'annotations.stem.length',
        'annotations.stemLength',
      ],
      12,
    );

    let defaultDatumAnnotationStyle = options.inferStringValue(
      ['annotations.datum.style', 'annotations.style'],
      AnnotationStyle.POINT,
      AnnotationStyle,
    ) as AnnotationStyle;
    if (defaultDatumAnnotationStyle === AnnotationStyle.LETTER) {
      // Convert 'letter' to 'point'
      defaultDatumAnnotationStyle = AnnotationStyle.POINT;
    }

    chartDef.series.forEach((serie, serieIndex) => {
      // No support for annotations with candlesticks or bubbles yet.
      if (
        serie.type === SerieType.AREA ||
        serie.type === SerieType.BARS ||
        serie.type === SerieType.LINE ||
        serie.type === SerieType.SCATTER ||
        serie.type === SerieType.STEPPED_AREA
      ) {
        // We compute the series-specific configurations.
        const optionsPrefix = `series.${serieIndex}.annotations.`;
        const useHighContrast = options.inferBooleanValue(
          `${optionsPrefix}highContrast`,
          globalUseHighContrast,
        );
        const alwaysOutside = options.inferBooleanValue(
          `${optionsPrefix}alwaysOutside`,
          globalOutsideOnly,
        );
        const serieAnnotationTextStyle = options.inferTextStyleValue(
          `${optionsPrefix}textStyle`,
          defaultDatumAnnotationTextStyle,
          relativeColors,
        );
        serieAnnotationTextStyle.color =
          chartdefinitionutil.resolveSerieRelativeColor(
            serieAnnotationTextStyle.color,
            serie.color,
          );
        const serieAnnotationBoxStyle = options.inferBrushValue(
          [`${optionsPrefix}boxStyle`],
          defaultDatumAnnotationBoxStyle,
        );

        let serieAnnotationStemColor = options.inferColorValue(
          [`${optionsPrefix}stemColor`, `${optionsPrefix}stem.color`],
          defaultDatumAnnotationStemColor,
          relativeColors,
        );
        const serieAnnotationStemLength = options.inferNumberValue(
          [`${optionsPrefix}stemLength`, `${optionsPrefix}stem.length`],
          defaultDatumAnnotationStemLength,
        );
        const serieAnnotationStemAngle = options.inferNumberValue(
          [`${optionsPrefix}stem.angle`],
          defaultDatumAnnotationStemLength,
        );

        serieAnnotationStemColor =
          chartdefinitionutil.resolveSerieRelativeColor(
            serieAnnotationStemColor,
            serie.color,
          );

        let serieAnnotationStyle = options.inferStringValue(
          `${optionsPrefix}style`,
          defaultDatumAnnotationStyle,
          AnnotationStyle,
        ) as AnnotationStyle;
        if (serieAnnotationStyle === AnnotationStyle.LETTER) {
          // Convert 'letter' to 'point'
          serieAnnotationStyle = AnnotationStyle.POINT;
        }

        const targetAxis = this.chartDefiner.getTargetAxisDefiner(
          serie.targetAxisIndex,
        );

        for (let i = 0; i < serie.points.length; ++i) {
          if (serie.points[i] == null || serie.points[i]!.scaled == null) {
            continue;
          }

          const point = serie.points[i];
          const annotationsIndex = i;
          const annotations = this.extractAnnotations(
            annotationsIndex,
            serie.columns as RoleToColumnMapping,
            defaultDatumAnnotationStyle,
          );
          const scaledPoint = point!.scaled as ScaledDatumDefinition;
          // Attempt to use the pointBrush's fill color, if not, fall back on
          // the series color, but parse it first in case it's a named color,
          // like red.
          const seriesColor = serie.pointBrush.hasFill()
            ? serie.pointBrush.getFill()
            : useHighContrast
              ? '#fff'
              : '#000';
          const datumColor =
            point!.brush && point!.brush.hasFill()
              ? point!.brush.getFill()
              : seriesColor;

          let textStyle;

          if (datumColor !== seriesColor && useHighContrast) {
            // We want the annotation text color to match the color of this
            // datum.
            textStyle = googObject.clone(serieAnnotationTextStyle) as TextStyle;

            // Give the text style a higher contrast color.
            // TODO(dlaliberte): Rip this out into a helper method.
            const factors = [0.1, 0.2, 0.3];
            const rgbDatumColor = googColor.hexToRgb(datumColor);
            const bgColor = googColor.hexToRgb(
              chartDef.backgroundBrush.getFill(),
            );
            const darkerDatumColors = factors.map((factor) =>
              googColor.darken(rgbDatumColor, factor),
            );
            const lighterDatumColors = factors.map((factor) =>
              googColor.lighten(rgbDatumColor, factor),
            );
            const datumColors = [rgbDatumColor].concat(
              darkerDatumColors,
              lighterDatumColors,
            );
            const candidateTextColor = googColor.rgbArrayToHex(
              googColor.highContrast(bgColor, datumColors),
            );
            textStyle.color = candidateTextColor;
          } else {
            textStyle = serieAnnotationTextStyle;
          }

          let x = null;
          let y = null;
          let bar = null;
          const hAxis =
            orientation === Orientation.VERTICAL ? targetAxis! : domainAxis;
          const vAxis =
            orientation === Orientation.VERTICAL ? domainAxis : targetAxis!;

          if (scaledPoint.x != null) {
            // Position at point.
            x = scaledPoint.x;
            y = scaledPoint.y;
          } else if (scaledPoint.bar != null || scaledPoint.left != null) {
            // Get the bar, defined one of two ways.
            bar = scaledPoint.bar;
            if (bar == null) {
              bar = new GoogRect(
                scaledPoint.left,
                scaledPoint.top,
                scaledPoint.width,
                scaledPoint.height,
              );
            }
            x = bar.left;
            y = bar.top;
            if (isVariableWidthBars) {
              // Position at 'end' of bar
              if (hAxis.direction === 1) {
                x = bar.left + bar.width;
              }
              if (vAxis.direction === 1) {
                y = bar.top + bar.height;
              }
            } else {
              // Position at midpoint of bar
              if (orientation === Orientation.VERTICAL) {
                y = bar.top + bar.height / 2;
                if (hAxis.direction === 1) {
                  x = bar.left + bar.width;
                }
              } else {
                x = bar.left + bar.width / 2;
                if (vAxis.direction === 1) {
                  y = bar.top + bar.height;
                }
              }
            }
          }

          if (annotations.point.length) {
            serie.points[i]!.annotation = this.positionPointAnnotation(
              x,
              y,
              bar,
              serie.type,
              datumColor,
              chartDef.stackingType !== StackingType.NONE,
              orientation,
              hAxis.direction,
              vAxis.direction,
              annotations.point,
              textStyle,
              serieAnnotationBoxStyle,
              serieAnnotationStemLength,
              serieAnnotationStemColor,
              serieAnnotationStemAngle,
              useHighContrast,
              alwaysOutside,
            );
          }
          if (annotations.line.length) {
            serie.points[i]!.annotation = this.positionLineAnnotation(
              x,
              y,
              orientation,
              annotations.line,
              serieAnnotationTextStyle,
              serieAnnotationStemColor,
            );
          }
        }
      }
    });
  }

  /**
   * Extracts all annotations of a given data element, by style (line/point).
   * Does so by understanding, based on the column structure, what annotations
   * should be drawn for the elements. Note that the column structure contains
   * what columns contain the element data and annotations and the row number is
   * given as a separate argument. Returns a list of annotations for each style,
   * where each annotation has a short form and the full text. Note also that
   * the annotations text column must follow the annotation column.
   *
   * @param rowNumber The row number.
   * @param roleToColumns The element's column structure.
   * @param defaultStyle The default annotation style to use.
   * @return The trail of annotations linked to the element.
   *     Each member contains a short form paired with the full annotation text.
   */
  private extractAnnotations(
    rowNumber: number,
    roleToColumns: RoleToColumnMapping,
    defaultStyle: AnnotationStyle,
  ): TrailOfAnnotations {
    const dataView = this.chartDefiner.getDataView();

    const annotationColumns = roleToColumns[ColumnRole.ANNOTATION];
    const annotations: TrailOfAnnotations = {
      line: [],
      point: [],
    } as TrailOfAnnotations;
    if (annotationColumns == null) {
      return annotations;
    }
    // TODO(dlaliberte): Deprecate ANNOTATION_TEXT role. Replace it TOOLTIP.
    const tooltipColumns = roleToColumns[ColumnRole.ANNOTATION_TEXT] || [];
    for (let i = 0; i < annotationColumns.length; ++i) {
      const annotationColumn = annotationColumns[i];
      let annotationTooltipColumn: number | null = annotationColumn + 1;
      const hasAnnotationTooltipColumn =
        googArray.indexOf(tooltipColumns, annotationTooltipColumn) >= 0;
      const annotationTooltipText = !hasAnnotationTooltipColumn
        ? null
        : dataView.getFormattedValue(rowNumber, annotationTooltipColumn);
      if (!annotationTooltipText) {
        // If there is no text or null, ignore this tooltip.
        annotationTooltipColumn = null;
      }
      const annotationValue = dataView.getValue(rowNumber, annotationColumn);
      if (annotationValue != null) {
        const annotation = {
          text: dataView.getFormattedValue(rowNumber, annotationColumn),
          tooltipColumnIndex: annotationTooltipColumn,
          rowIndex: rowNumber,
        };
        // We extract the style to know if this is a line annotation or point.
        const optionPath = `annotation.${annotationColumn}.style`;
        const style = this.options.inferStringValue(
          optionPath,
          defaultStyle,
          AnnotationStyle,
        ) as AnnotationStyle;

        if (style === AnnotationStyle.LINE) {
          annotations.line.push(annotation);
        } else {
          annotations.point.push(annotation);
        }
      }
    }
    return annotations;
  }

  /**
   * Positions a point annotation in a given position.
   *
   * @param x The x position, or null.
   * @param y The y position, or null.
   * @param bar The rectangle for the bar, or null.
   * @param type The type of the serie to position in.
   * @param color The series' color.
   * @param isStacked Whether the bars are stacked or not.
   * @param orientation The orientation of the chart domain.
   * @param hAxisDir The direction of the hAxis.
   * @param vAxisDir The direction of the vAxis.
   * @param annotations The annotations.
   * @param textStyle The style of the annotation text.
   * @param boxStyle The style for the box around the text.
   * @param stemLength The length of the stem leading from the point to the text.
   * @param stemColor The color of the stem.
   * @param stemAngle The angle of the stem.
   * @param useHighContrast When false, will use the exact color given or true by default.
   * @param alwaysOutside When true, will always position the annotation outside the bar, false (or undefined) will use the default behavior.
   * @return The annotation.
   */
  private positionPointAnnotation(
    x: number | null,
    y: number | null,
    bar: GoogRect | null,
    type: SerieType,
    color: string,
    isStacked: boolean,
    orientation: Orientation,
    hAxisDir: Direction | null,
    vAxisDir: Direction | null,
    annotations: AnnotationDefinerAnnotation[],
    textStyle: TextStyle,
    boxStyle: Brush,
    stemLength: number,
    stemColor: string,
    stemAngle: number,
    useHighContrast?: boolean,
    alwaysOutside?: boolean,
  ): Annotation {
    const chartDef = this.chartDefiner.getChartDefinition();

    const numAnnotations = annotations.length;

    const annotationColors = [
      [64, 64, 64],
      [128, 128, 128],
      [255, 255, 255],
    ];

    useHighContrast = useHighContrast == null ? true : useHighContrast;

    const isBarLike =
      type === SerieType.BARS || type === SerieType.STEPPED_AREA;

    // Target may be a bar/rectangle (top, left, width, height) or a point x, y.
    if (isBarLike && bar) {
      if (orientation === Orientation.VERTICAL) {
        // Vertical center of bar.
        y = Math.floor(bar.top + bar.height / 2);
      } else {
        // Horizontal center of bar.
        x = Math.floor(bar.left + bar.width / 2);
      }
    }

    if (
      (orientation === Orientation.HORIZONTAL && vAxisDir === 1) ||
      (orientation === Orientation.VERTICAL && hAxisDir === 1)
    ) {
      stemLength *= -1;
    }

    const defaultPositionInBar =
      orientation === Orientation.HORIZONTAL
        ? vAxisDir === Direction.FORWARD
          ? TextBlockPosition.BOTTOM
          : TextBlockPosition.TOP
        : hAxisDir === Direction.FORWARD
          ? TextBlockPosition.RIGHT
          : TextBlockPosition.LEFT;

    // The following assumes x and y are defined, though the above doesn't
    // seem to guarantee it.
    assert(x != null && y != null);
    let labelX = x;
    let labelY = y! - stemLength;
    if (orientation === Orientation.VERTICAL) {
      labelX = x! - stemLength;
      labelY = y!;
    }
    const offsetY = 0; // Increment for multiple annotations.

    // In case there is not enough vertical space, we flip the annotation.
    // The actual stem length is positive or negative according to the
    // direction. A negative direction goes up or left.
    let actualStemLength = -stemLength;
    let noStem = false;

    // Compute total height of all annotations. Assumes one-line annotations.
    // TODO(dlaliberte) Do the same for width, but we don't know total width.
    const totalHeight = stemLength + textStyle.fontSize * numAnnotations;
    if (
      y! - totalHeight < chartDef.chartArea.top &&
      y! + totalHeight < chartDef.chartArea.bottom
    ) {
      labelY = y! + totalHeight;
      actualStemLength = stemLength;
    }

    /** Define the annotation labels. */
    const labels: TextBlock[] = [];
    for (let i = 0; i < numAnnotations; i++) {
      const annotation = annotations[i];
      const textSize = this.chartDefiner.getTextMeasureFunction()(
        annotation.text,
        textStyle,
      );

      const label: TextBlockTypeObject = {} as TextBlockTypeObject;
      const anchor = new GvizCoordinate(
        labelX == null ? undefined : labelX,
        labelY == null ? undefined : labelY,
      );
      let labelInBar = null;
      label.textStyle = new TextStyle(textStyle);

      if (!isBarLike) {
        // No bar is easy.

        label.paralAlign = TextAlign.CENTER;
        label.perpenAlign = TextAlign.END;
      } else {
        if (bar && !alwaysOutside && numAnnotations === 1) {
          // Try to fit in the bar.
          const seriesColor = googColor.hexToRgb(color);
          const candidateLabelColor = googColor.rgbArrayToHex(
            googColor.highContrast(seriesColor, annotationColors),
          );

          const newTextStyle = gvizJson.clone(textStyle) as TextStyle;
          if (useHighContrast) {
            newTextStyle.auraColor = 'none';
            newTextStyle.color = candidateLabelColor;
          }
          const offsetRect = new GoogRect(
            bar.left,
            bar.top + offsetY,
            bar.width,
            bar.height,
          );
          labelInBar = TextBlock.createToFit(
            annotation.text,
            newTextStyle,
            defaultPositionInBar,
            offsetRect,
            this.chartDefiner.getTextMeasureFunction(),
            this.chartDefiner.isTooltipEnabled(),
            4,
            2,
          );
        }
      }

      if (labelInBar && !labelInBar.truncated && numAnnotations === 1) {
        labels.push(labelInBar);
        // Not used?
        noStem = true;
      } else {
        // Either label did not fit in bar, or more than one annotation,
        // OR requested to be outside (i.e. alwaysOutside was set).
        switch (orientation) {
          case Orientation.HORIZONTAL:
            label.paralAlign = TextAlign.CENTER;
            label.perpenAlign =
              vAxisDir === -1 ? TextAlign.END : TextAlign.START;
            break;
          case Orientation.VERTICAL:
            label.paralAlign = hAxisDir === 1 ? TextAlign.START : TextAlign.END;
            label.perpenAlign = TextAlign.CENTER;
            break;
          default:
            throw new Error('Unsupported orientation');
        }
        label.text = annotation.text;
        label.textStyle = textStyle;
        label.boxStyle = boxStyle;
        label.anchor = anchor;
        label.truncated = false;
        label.lines = [
          {x: 0, y: 0, length: textSize.width, text: annotation.text},
        ];
        label.angle = 0;

        // TODO(dlaliberte): push tooltip stuff on labels in bars.
        const tooltipColumnIndex = annotation.tooltipColumnIndex;
        if (this.chartDefiner.isTooltipEnabled()) {
          if (tooltipColumnIndex != null) {
            label.tooltipText = this.chartDefiner.getCustomTooltipText(
              tooltipColumnIndex,
              annotation.rowIndex,
            );
          }
        }
        const labelTextBlock = new TextBlock(label);
        labels.push(labelTextBlock);
        // For next label, if any:
        assert(vAxisDir != null);
        labelY += vAxisDir! * textStyle.fontSize * label.lines.length;
      }
    }
    // end for loop.

    // Return the complete annotation definition.
    stemLength = noStem ? 0 : actualStemLength;

    let stemOrientation = Orientation.VERTICAL;
    if (orientation === Orientation.VERTICAL) {
      stemOrientation = Orientation.HORIZONTAL;
    }
    return {
      stem: {
        x,
        y,
        length: stemLength,
        orientation: stemOrientation, // angle: stemAngle,  // TODO(dlaliberte) make this work
        color: stemColor,
      },
      labels,
      bundle: null,
    } as unknown as Annotation;
    // bundles are disabled for now
  }

  /**
   * Positions a line annotation.  If x or y is null, the line annotation
   * will take the entire width or height of the chart area.
   * @param x The x position, or null.
   * @param y The y position, or null.
   * @param orientation The orientation of the chart.
   * @param annotations The annotation.
   * @param textStyle The style of the annotation text.
   * @param lineColor The color of the line.
   * @return The annotation.
   */
  private positionLineAnnotation(
    x: number | null,
    y: number | null,
    orientation: Orientation,
    annotations: AnnotationDefinerAnnotation[],
    textStyle: TextStyle,
    lineColor: string,
  ): Annotation {
    // TODO(dlaliberte): Handle Line Annotations better with Bars.
    const chartDef = this.chartDefiner.getChartDefinition();

    // We leave a margin of half font size from each side of the text.
    const margins = textStyle.fontSize;

    // Calculate the text layout of each annotation.
    const textLayouts = [];
    const textMeasureFunction = this.chartDefiner.getTextMeasureFunction();
    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      const textLayout = calcTextLayout(
        textMeasureFunction,
        annotation.text,
        textStyle,
        chartDef.chartArea.height - margins,
      );
      textLayouts.push(textLayout);
    }

    // For horizontal chart orientation
    let lineOrientation = Orientation.VERTICAL;
    let angle = 270; // We write the text from bottom to top.
    let lineD1 = y;
    let lineBegin = chartDef.chartArea.top;
    let lineEnd = chartDef.chartArea.bottom;

    if (orientation === Orientation.VERTICAL) {
      lineOrientation = Orientation.HORIZONTAL;
      angle = 0; // left to right.
      lineD1 = x;
      lineBegin = chartDef.chartArea.left;
      lineEnd = chartDef.chartArea.right;
    }

    // Calculate the position of the stem line.
    let stemBegin;
    let stemEnd;
    if (x != null && y != null) {
      // Calculate the maximal text length in pixels.
      let maxAnnotationLength = 0;
      for (let i = 0; i < textLayouts.length; i++) {
        const textLayout = textLayouts[i];
        maxAnnotationLength = Math.max(
          maxAnnotationLength,
          textLayout.maxLineWidth,
        );
      }
      // The length of the stem is the maximal text length with margins.
      // Note that this value cannot exceed the chart height because of the
      // maximal width constraint passed to the calcTextLayout call above.
      const stemLength = maxAnnotationLength + margins;

      // Try to position the stem's center in the given position.
      // Ensure the stem's top and bottom are inside the chart area.
      assert(lineD1 != null);
      stemBegin = Math.max(Math.round(lineD1! - stemLength / 2), lineBegin);
      stemEnd = Math.min(stemBegin + stemLength, lineEnd);
      stemBegin = stemEnd - stemLength;
    } else {
      // Should be full length.
      stemBegin = lineBegin;
      stemEnd = lineEnd;
    }
    const stemMiddle = Math.round((stemBegin + stemEnd) / 2);

    let lineX = x;
    let lineY = stemBegin;
    if (orientation === Orientation.VERTICAL) {
      lineX = stemBegin;
      lineY = y!;
    }

    // Define the annotation labels.
    let labelX;
    let labelY;
    // Keep 2 pixels of space between the line and the text.
    if (orientation === Orientation.VERTICAL) {
      labelX = stemMiddle;
      labelY = y! + 2;
    } else {
      labelX = x! + 2;
      labelY = stemMiddle;
    }
    const labels = [];
    for (let i = 0; i < annotations.length; i++) {
      const annotation = annotations[i];
      const textLayout = textLayouts[i];
      const label: TextBlockTypeObject = {
        text: annotation,
        textStyle,
        lines: [
          {
            x: labelX,
            y: labelY,
            length: textLayout.maxLineWidth,
            text: textLayout.lines[0] || '',
          },
        ], // Might be empty array.
        paralAlign: TextAlign.CENTER,
        perpenAlign: TextAlign.START,
        anchor: null,
        angle,
      } as unknown as TextBlockTypeObject;
      const tooltipColumnIndex = annotation.tooltipColumnIndex;
      if (this.chartDefiner.isTooltipEnabled() && tooltipColumnIndex != null) {
        // Suppressing errors for ts-migration.
        //   TS2339: Property 'tooltipText' does not exist on type '{ text: AnnotationDefinerAnnotation; textStyle: TextStyle; lines: { x: number; y: number; length: number; text: string; }[]; paralAlign: TextAlign; perpenAlign: TextAlign; a...
        // ts-ignore
        label.tooltipText = this.chartDefiner.getCustomTooltipText(
          tooltipColumnIndex,
          annotation.rowIndex,
        );
      }
      labels.push(label);

      if (orientation === Orientation.VERTICAL) {
        labelY += textStyle.fontSize;
      } else {
        labelX += textStyle.fontSize;
      }
    }

    // Suppressing errors for ts-migration.
    //   TS2352: Conversion of type '{ stem: { x: number; y: number; length: number; orientation: defaults.Orientation; color: string; }; labels: { text: AnnotationDefinerAnnotation; textStyle: TextStyle; ... 4 more ...; angle: number; }...
    // ts-ignore
    return {
      stem: {
        x: assertNumber(lineX),
        y: assertNumber(lineY),
        length: stemEnd - stemBegin,
        orientation: lineOrientation,
        color: lineColor,
      },
      labels,
      bundle: null,
    } as unknown as Annotation;
  }
}

/**
 * The annotations, structured as following:
 * text: The annotation text (NOT the annotation TOOLTIP text).
 * tooltipColumnIndex: Index of the tooltip column associated with the
 *     annotation (null if none exists).
 * rowIndex: Index of the data row associated with the annotation.
 *
 * TODO(dlaliberte): Investigate why we need to encode the column index
 * into the annotation itself.
 */
interface AnnotationDefinerAnnotation {
  text: string;
  tooltipColumnIndex: number | null;
  rowIndex: number;
}

interface TrailOfAnnotations {
  point: AnnotationDefinerAnnotation[];
  line: AnnotationDefinerAnnotation[];
}
