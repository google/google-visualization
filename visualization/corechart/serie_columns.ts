/**
 * @fileoverview Definitions for describing the column structure of data for a
 * chart.
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

import {SerieType} from '../../common/option_types';

/**
 * Enumeration of all column role types, alphabetically.
 * Column role.
 */
export enum ColumnRole {
  ID = 'id',
  ANNOTATION = 'annotation',
  ANNOTATION_TEXT = 'annotationText',
  CERTAINTY = 'certainty',
  DATA = 'data',
  DOMAIN = 'domain',
  EMPHASIS = 'emphasis',
  INTERVAL = 'interval',
  SCOPE = 'scope',
  TOOLTIP = 'tooltip',
  DIFF_OLD_DATA = 'old-data',
  STYLE = 'style',
}

/**
 * A structure that holds the set of columns that compose a serie or a category.
 * Maps from column role (ColumnRole) to an array of column indices
 * that compose the serie / category.
 */
export interface RoleToColumnMapping {
  [key: string]: number[];
}

/**
 * A structure defining the columns that the serie is built of, its type, its
 * data type and the index of its domain.
 */
export interface Structure {
  columns: RoleToColumnMapping;
  type: SerieType;
  dataType: string;
  domainIndex: number;
}

/** A structure defining the columns comprising all domain values. */
export interface DomainColumnStructure {
  columns: RoleToColumnMapping;
}

/**
 * A structure describing the role and serie/domain of a data table column.
 * Either serieIndex or domainIndex must be null, depending whether the column
 * represents a domain or a serie (correspondingly).
 */
export interface ColumnRoleInfo {
  serieIndex?: number | null | undefined;
  domainIndex?: number | null | undefined;
  role: ColumnRole;
  roleIndex?: number | null | undefined;
}
