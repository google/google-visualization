# Formatting Directory

This directory contains modules responsible for formatting data values into human-readable strings. These formatters are used for displaying values in chart labels, tooltips, and potentially within the data table itself.

## Core Functionality

*   **`format.ts`**: Defines the abstract base class `Format`. All specific formatters (like `DateFormat`, `NumberFormat`) inherit from this class. It establishes a common interface, primarily the `formatValue(value)` method and a `format(dataTable, columnIndex)` method to apply formatting to an entire column.
*   **`numberformat.ts`**: Implements `NumberFormat` for formatting numeric values. It supports:
    *   ICU-like number patterns (e.g., `#,##0.00`, `scientific`, `percent`).
    *   Customization of decimal separators, grouping separators, fraction digits, and significant digits.
    *   Prefixes and suffixes (e.g., "$", "%").
    *   Handling of negative numbers (color, parentheses).
    *   Scaling factors.
*   **`dateformat.ts`**: Implements `DateFormat` for formatting `Date` and `DateTime` objects. It leverages Closure Library's `goog.i18n.DateTimeFormat` and supports:
    *   Predefined formats (short, medium, long, full for date, time, or datetime).
    *   Custom ICU date/time patterns.
    *   Time zone handling.
*   **`timeofdayformat.ts`**: Implements `TimeOfDayFormat` specifically for formatting `timeofday` array values (e.g., `[hours, minutes, seconds, milliseconds]`). It internally uses `DateFormat` by converting the `timeofday` array to a `Date` object (typically relative to epoch January 1, 1970).
*   **`stringformat.ts`**: A simple `StringFormat` class that essentially converts any value to its string representation using `String()`.
*   **`arrowformat.ts`**: Implements `TableArrowFormat`. This formatter doesn't change the textual value but adds CSS classes to cells to display up or down arrows based on whether a numeric value is above or below a specified base.
*   **`barformat.ts`**: Implements `BarFormat`. This formatter renders simple horizontal bars within table cells to visually represent numeric values. It can show positive/negative bars relative to a base value and can optionally display the numeric value alongside the bar.
*   **`colorformat.ts`**: Implements `ColorFormat`. This formatter applies foreground and background colors to cells based on whether their value falls within predefined ranges. It also supports gradient coloring across a range.
*   **`patternformat.ts`**: Implements `TablePatternFormat`. This formatter allows creating a new string by substituting placeholders in a pattern string with formatted values from multiple source columns in a `DataTable`. For example, a pattern like "Sales in {0}: ${1}" could combine a region name from one column and a sales figure from another.
*   **`formatting.ts`**: Provides higher-level formatting utilities and builders:
    *   `INumberFormatter` and `TimeFormatter` interfaces.
    *   `TimeFormatterImpl`: A concrete implementation of `TimeFormatter` that uses `DateFormat`.
    *   `NumberFormatterBuilder`: A builder class to construct `NumberFormatter` instances with various options (decimal places, significant digits, units, order of magnitude formatting).
    *   `NumberFormatter`: The class built by `NumberFormatterBuilder`, which can handle more complex formatting scenarios like units (e.g., "10 kg") and order of magnitude suffixes (e.g., "10M" for 10 million).
*   **`order_of_magnitudes.ts`**: Contains logic and predefined constants for formatting numbers with order of magnitude suffixes (K, M, B, T for kilo, million, billion, trillion, etc.), including internationalized versions. Used by `NumberFormatter`.
*   **`patterns.ts`**: Contains logic (`applyPatternOptions`) to attempt to apply number formatting patterns found in a `DataTable`'s column metadata to the corresponding chart axis options. This is somewhat of a legacy feature, primarily for compatibility with data sources like Trix.
*   **`date_formatter.ts`**: Provides a singleton, memoized version of `DateFormat` (`DateFormatter.getInstance()`) for potentially improved performance when formatting many dates with the same pattern.

## Relationships to Other Parts of the Code

*   **`data/`**:
    *   `DataTable` and `DataView` have a `format(columnIndex, formatter)` method that accepts instances of `Format` subclasses to apply formatting to entire columns.
    *   `getFormattedValue()` methods in `DataTable` and `DataView` use these formatters (or default formatters if none are explicitly set on the column) to produce string representations of cell values.
    *   `datautils.ts` contains `getDefaultFormattedValue` which uses these formatters.
*   **`axis/`**:
    *   Axis definers (e.g., `axis_definer.ts`, `date_tick_definer.ts`) use formatters (like `DateFormat`, `NumberFormat`, `TimeFormatterImpl` from `formatting.ts`) to create human-readable labels for axis ticks.
*   **`tooltip/`**: Tooltip generation logic (e.g., `tooltip_body_creator.ts`) uses these formatters to display data values within tooltips.
*   **`visualization/table/`**: The `Table` visualization directly uses these formatters to display cell content. `TableArrowFormat`, `BarFormat`, and `ColorFormat` are specifically designed for enhancing table cell presentation.
*   **`common/options.ts`**: Chart options often include formatting patterns (e.g., `hAxis.format`, `vAxis.format`, `tooltip.textStyle`) that are consumed by these formatting modules.
*   **`i18n/`**: `DateFormat` and `NumberFormat` rely on Closure Library's i18n components (`goog.i18n.DateTimeFormat`, `goog.i18n.NumberFormat`) for locale-aware formatting.

The formatters in this directory are essential for presenting data in a user-friendly and culturally appropriate manner throughout the charting library.The `README.md` for the `format` directory has been created.
