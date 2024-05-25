/**
 * @fileoverview The options theme for charts.
 * A theme object can contain the same properties as an Options object, and is
 * consulted for the value of a property if it's not found in the Options. The
 * idea is to allow specifying a predefined set of options (a theme), and then
 * override anything in it that needs to be overridden. A theme has a name by
 * which it is looked for in a themes registry (see registerTheme and getTheme).
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

import * as alpha from '@npm//@closure/color/alpha';
import * as googColor from '@npm//@closure/color/color';
import * as colors from '../graphics/colors';
import {NO_COLOR, parseColor} from '../graphics/util';

import {UserOptions} from './options';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringAssistedMigration = any;

const {
  BLUE,
  CYAN,
  DEEP_ORANGE,
  GREEN,
  INDIGO,
  LIME,
  PINK,
  PURPLE,
  RED,
  TEAL,
  YELLOW,
} = colors;

/** Static map from a theme name to the theme instance. */
const themes: UserOptions = {};

/**
 * Holds whether the predefined themes have already been registered in themes.
 */
let predefinedThemesRegistered = false;

/** Name of the classic theme. */
export const THEME_NAME_CLASSIC = 'classic';

/**
 * Name of the maximized theme.
 * Uses the entire canvas to draw the chart. Puts the legend, axis ticks and
 * titles inside the chart.
 */
export const THEME_NAME_MAXIMIZED = 'maximized';

/**
 * Name of the sparkline theme.
 * Disables interactivity, and draws only the area chart in
 * maximized mode and without the axes.
 */
export const THEME_NAME_SPARKLINE = 'sparkline';

/** Name of the Material "Lite" theme. */
export const THEME_NAME_MATERIAL_LITE = 'material';

/**
 * Register a color theme.
 *
 * @param theme The theme instance.
 * @param name The theme's name.
 */
export function registerTheme(theme: UserOptions, name: string) {
  themes[name] = theme;
}

/** Register the predefined themes. */
function registerPredefinedThemes() {
  registerClassicTheme();
  registerMaximizedTheme();
  registerSparklineTheme();
  registerMaterialTheme();

  predefinedThemesRegistered = true;
}

/** Create and register the 'classic' theme. */
function registerClassicTheme() {
  const theme = {
    'colors': [
      {'color': '#dea19b', 'dark': '#ad7d79', 'light': '#ffd1c9'},
      {'color': '#cdc785', 'dark': '#aea971', 'light': '#eeeeac'},
      {'color': '#d6b9db', 'dark': '#a992ad', 'light': '#fff0db'},
      {'color': '#a2c488', 'dark': '#7f9a6b', 'light': '#d2feb0'},
      {'color': '#ffbc46', 'dark': '#ce9839', 'light': '#eeee5b'},
      {'color': '#9bbdde', 'dark': '#7993ad', 'light': '#c991ff'},
    ],
    'backgroundColor': {
      'gradient': {
        'color1': '#8080ff',
        'color2': '#000020',
        'x1': '0%',
        'y1': '0%',
        'x2': '100%',
        'y2': '100%',
      },
    },
    'titleTextStyle': {'color': 'white'},
    'hAxis': {
      'textStyle': {'color': 'white'},
      'titleTextStyle': {'color': 'white'},
    },
    'vAxis': {
      'textStyle': {'color': 'white'},
      'titleTextStyle': {'color': 'white'},
    },
    'legend': {'textStyle': {'color': 'white'}},
    'chartArea': {'backgroundColor': {'stroke': '#e0e0e0', 'fill': 'none'}},
    'areaOpacity': 0.8,
  };
  registerTheme(theme, THEME_NAME_CLASSIC);
}

/** Create and register the 'maximized' theme. */
function registerMaximizedTheme() {
  // Create and register the 'maximized' theme.
  const theme = {
    'titlePosition': 'in',
    'axisTitlesPosition': 'in',
    'legend': {'position': 'in'},
    'chartArea': {
      'width': '100%',
      'height': '100%',
    } as AnyDuringAssistedMigration,
    'vAxis': {'textPosition': 'in'},
    'hAxis': {'textPosition': 'in'},
  };
  registerTheme(theme, THEME_NAME_MAXIMIZED);
}

/** Create and register the 'sparkline' theme. */
function registerSparklineTheme() {
  // Create and register the 'sparkline' theme.
  const theme = {
    'enableInteractivity': false,
    'legend': {'position': 'none'},
    'seriesType': 'area',
    'lineWidth': 1.6,
    'chartArea': {
      'width': '100%',
      'height': '100%',
    } as AnyDuringAssistedMigration,
    'vAxis': {
      'textPosition': 'none',
      'gridlines': {'color': 'none'},
      'baselineColor': 'none',
    },
    'hAxis': {
      'textPosition': 'none',
      'gridlines': {'color': 'none'},
      'baselineColor': 'none',
    },
  };
  registerTheme(theme, THEME_NAME_SPARKLINE);
}

/** Create and register the 'material' theme. */
function registerMaterialTheme() {
  const theme = {
    'bar': {
      'groupWidth': '65%',
    },
    'textStyle': {
      'color': '#757575',
      'fontName': 'Roboto',
    },
    'annotations': {
      'textStyle': {
        'color': '#757575',
        'fontName': 'Roboto',
      },
    },
    'bubble': {
      'highContrast': true,
      'textStyle': {
        'auraColor': 'none',
        'color': '#636363',
        'fontName': 'Roboto',
      },
    },
    'tooltip': {
      'textStyle': {
        'color': '#757575',
        'fontName': 'Roboto',
      },
      'boxStyle': {
        'stroke': '#b2b2b2',
        'strokeOpacity': 1,
        'strokeWidth': 1.5,
        'fill': 'white',
        'fillOpacity': 1,
        'shadow': {
          'radius': 1,
          'opacity': 0.2,
          'xOffset': 0,
          'yOffset': 2,
        },
      },
    },
    'vAxis': {
      'textStyle': {
        'color': '#757575',
        'fontName': 'Roboto',
        'fontSize': 12,
      },
      'gridlines': {
        'color': '#e0e0e0',
      },
      'baselineColor': '#9e9e9e',
    },
    'legend': {
      'newLegend': true,
      'pagingTextStyle': {'fontName': 'Roboto'},
      'textStyle': {
        'auraColor': 'none',
        'color': '#757575',
        'fontName': 'Roboto',
        'fontSize': 12,
      },
    },
    'hAxis': {
      'textStyle': {
        'color': '#757575',
        'fontName': 'Roboto',
        'fontSize': 12,
      },
      'gridlines': {
        'color': '#e0e0e0',
      },
      'baselineColor': '#9e9e9e',
    },
    'pieSliceTextStyle': {
      'color': '#ffffff',
      'fontName': 'Roboto',
      'fontSize': 14,
    },
    'pieResidueSliceColor': '#757575',
    'titleTextStyle': {
      'color': '#757575',
      'fontName': 'Roboto',
      'fontSize': 16,
      'bold': 'false',
    },
    'scatter': {
      'dataOpacity': 0.6,
    },
    'colorAxis': {
      'colors': [], // Forces the one,two-sided defaults:
      'one-sided-colors': [
        '#ffffff', // White
        BLUE['500'],
      ],
      'two-sided-colors': [
        BLUE['500'],
        '#ffffff', // White
        YELLOW['600'],
      ],
      'legend': {
        'textStyle': {
          'color': '#757575',
          'fontName': 'Roboto',
          'fontSize': 12,
        },
      },
    },
    'colors': [
      {'color': BLUE['500'], 'dark': BLUE['800'], 'light': BLUE['100']},
      {'color': RED['500'], 'dark': RED['900'], 'light': RED['100']},
      {'color': YELLOW['600'], 'dark': YELLOW['800'], 'light': YELLOW['100']},
      {'color': GREEN['500'], 'dark': GREEN['700'], 'light': GREEN['100']},
      {'color': PURPLE['400'], 'dark': PURPLE['800'], 'light': PURPLE['100']},
      {'color': CYAN['600'], 'dark': CYAN['800'], 'light': CYAN['100']},
      {
        'color': DEEP_ORANGE['400'],
        'dark': DEEP_ORANGE['700'],
        'light': DEEP_ORANGE['100'],
      },
      {'color': LIME['800'], 'dark': LIME['900'], 'light': LIME['100']},
      {'color': INDIGO['400'], 'dark': INDIGO['600'], 'light': INDIGO['100']},
      {'color': PINK['300'], 'dark': PINK['500'], 'light': PINK['100']},
      {'color': TEAL['700'], 'dark': TEAL['900'], 'light': TEAL['100']},
      {'color': PINK['700'], 'dark': PINK['900'], 'light': PINK['200']},
    ],
  };

  registerTheme(theme, THEME_NAME_MATERIAL_LITE);
}

/**
 * Static method that returns the theme with the given name.
 * If no such theme is defined, returns undefined.
 *
 * @param name  The theme's name.
 * @return  The registered theme with the specified name.
 */
export function getTheme(name: string): AnyDuringAssistedMigration {
  if (!predefinedThemesRegistered) {
    // Lazy initialization of predefined themes.
    registerPredefinedThemes();
  }
  return themes[name];
}

/**
 * A standard color representation, an object with color, dark & light
 * properties.
 */
export interface StandardColor {
  color: string;
  dark: string;
  light: string;
}

/**
 * Either an object in relative color representation, with 'color' and
 * possibly also 'darker' and 'lighter'.  Not really a 'relative' color,
 * however since it is not like 'greener' or 'lighter' by 25%.  Rather, this
 * is just a user-defined option for a color with darker and lighter colors.
 * Note 'declare' which forces the properties to be string names.
 */
export declare interface RelativeColor {
  color: string;
  darker?: string;
  lighter?: string;
}

/**
 * Converts string to RGBA array. Ex. 'rgba(0,0,0,0.2)' => [0, 0, 0, 0.2]
 * @return RGBA color array.
 */
function rgbaStyleToArray(rgba: string): number[] {
  return rgba
    .replace(/[^\d,.]/g, '')
    .split(',')
    .map((val) => Number(val));
}

/**
 * Returns a standard color representation. If either the darker or lighter
 * colors are not specified, we take the original color and adjust it (25%
 * darker or 25% lighter).
 *
 * @param color The input color.  A string color name or RelativeColor
 * @return The color object.
 */
export function toStandardColor(color: RelativeColor | string): StandardColor {
  const standardColor: StandardColor = {} as StandardColor;
  if (typeof color === 'string') {
    color = {color};
  }
  standardColor.color = color.color;
  const hexColor = parseColor(standardColor.color);
  if (hexColor === NO_COLOR) {
    standardColor.dark = color.darker || hexColor;
    standardColor.light = color.lighter || hexColor;
  } else {
    if (hexColor.includes('rgba')) {
      const rgbaArray = rgbaStyleToArray(hexColor);
      const rgbColor = rgbaArray.slice(0, 3);
      const a = rgbaArray[3] || 1;
      standardColor.dark = alpha.rgbaArrayToRgbaStyle([
        ...googColor.darken(rgbColor, 0.25),
        a,
      ]);
      standardColor.light = alpha.rgbaArrayToRgbaStyle([
        ...googColor.lighten(rgbColor, 0.25),
        a,
      ]);
    } else {
      const rgbColor = googColor.hexToRgb(hexColor);
      standardColor.dark =
        color.darker ||
        googColor.rgbArrayToHex(googColor.darken(rgbColor, 0.25));
      standardColor.light =
        color.lighter ||
        googColor.rgbArrayToHex(googColor.lighten(rgbColor, 0.25));
    }
  }
  return standardColor;
}
