/**
 * @fileoverview Labeled legend builder. Draws the labeled legend according to
 * its definition.
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

import {AbstractRenderer} from '../graphics/abstract_renderer';
import {DrawingGroup} from '../graphics/drawing_group';
import {PathSegments} from '../graphics/path_segments';
import {DrawTextBlockFunc} from '../text/text_block_object';

import {Token, generateId} from '../visualization/corechart/id_utils';

import {LabeledLegendDefinition} from './labeled_legend_definition';

/**
 * Builds the labeled legend from its definition.
 * @param renderer The drawing renderer.
 * @param drawTextBlockFunc Function for drawing text blocks.
 * @param labeledLegendDefinition The definition for the labeled legend.
 * @param drawingGroup A drawing group to be filled with the legend.
 * @param registerElementFunc Function for registering an element. See
 *     `gviz.canviz.ChartBuilder#registerElement`.
 */
export function build(
  renderer: AbstractRenderer,
  drawTextBlockFunc: DrawTextBlockFunc,
  labeledLegendDefinition: LabeledLegendDefinition,
  drawingGroup: DrawingGroup,
  registerElementFunc: (p1: Element, p2: string, p3?: string) => void,
) {
  for (let i = 0; i < labeledLegendDefinition.length; ++i) {
    const legendEntry = labeledLegendDefinition[i];
    const legendEntryGroup: DrawingGroup = renderer.createGroup();
    const legendEntryLineGroup = renderer.createGroup();

    // Drawing the line with a circle at the start point.
    const linePath = new PathSegments();
    linePath.move(
      Number(legendEntry.startPoint.x) + 0.5,
      legendEntry.startPoint.y + 0.5,
    );
    linePath.addLine(
      legendEntry.cornerPointX + 0.5,
      legendEntry.startPoint.y + 0.5,
    );
    linePath.addLine(
      legendEntry.cornerPointX + 0.5,
      legendEntry.endPoint.y + 0.5,
    );
    linePath.addLine(
      legendEntry.endPoint.x + 0.5,
      legendEntry.endPoint.y + 0.5,
    );
    renderer.drawPath(linePath, legendEntry.lineBrush, legendEntryLineGroup);
    renderer.drawCircle(
      legendEntry.startPoint.x + 0.5,
      legendEntry.startPoint.y + 0.5,
      legendEntry.startPointRadius,
      legendEntry.startPointBrush,
      legendEntryLineGroup,
    );

    // Drawing the text above and below the line.
    // const textWidth = Math.abs(
    //     legendEntry.cornerPointX - legendEntry.endPoint.x);
    drawTextBlockFunc(legendEntry.aboveText, legendEntryGroup);
    drawTextBlockFunc(legendEntry.belowText, legendEntryGroup);

    renderer.appendChild(drawingGroup, legendEntryGroup);
    renderer.appendChild(drawingGroup, legendEntryLineGroup);

    const legendEntryID = generateId([Token.LEGEND_ENTRY, legendEntry.index]);
    registerElementFunc(legendEntryGroup.getElement(), legendEntryID);
  }
}
