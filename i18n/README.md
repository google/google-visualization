# Internationalization (i18n) Directory

This directory contains modules related to internationalization and localization, primarily focusing on text processing, such as line breaking and number/date formatting, by leveraging Closure Library's i18n capabilities.

## Core Functionality

*   **`format.ts`**: This module acts as a shim or re-exporter for various `goog.i18n` classes from the Closure Library. This includes:
    *   `DateTimePatterns`: Standard patterns for date and time formatting.
    *   `DateTimeSymbols`: Symbols used in date/time formatting (e.g., month names, day names) for different locales.
    *   `NumberFormatSymbols`: Symbols used in number formatting (e.g., decimal separator, group separator) for different locales.
    *   `DateTimeFormat`: The core Closure class for formatting and parsing dates and times.
    *   `NumberFormat`: The core Closure class for formatting and parsing numbers.
    *   `TimeZone`: A class for representing and working with time zones.
    By centralizing these imports, it provides a consistent access point for i18n formatting tools used elsewhere in the charting library.

*   **`break_iterator_interface.ts`**: Defines the `BreakIteratorInterface`. This interface specifies the contract for classes that can segment text into meaningful units (like words, lines, or characters) based on locale-specific rules. Key methods include `adoptText()`, `first()`, `current()`, `next(level)`, and `peek(level)`.

*   **`break_iterator_factory.ts`**: Implements `BreakIteratorFactory`, a singleton factory responsible for providing an appropriate `BreakIteratorInterface` implementation. It checks for the availability of the native `Intl.v8BreakIterator` (if the environment supports it) and falls back to a manual implementation if necessary.

*   **`wrapped_v8_break_iterator.ts`**: Provides `WrappedV8BreakIterator`, an implementation of `BreakIteratorInterface` that wraps the browser's native `Intl.v8BreakIterator` (when available). This is generally more performant and accurate for complex scripts. It uses a `LevelClassifier` to map different break types from the underlying V8 iterator to semantic break levels (e.g., hard line break, soft line break).

*   **`manual_break_iterator.ts`**: Implements `ManualBreakIterator`, a simpler, JavaScript-based fallback implementation of `BreakIteratorInterface`. It uses regular expressions and `goog.i18n.graphemeBreak` for basic line breaking logic. This is used when `Intl.v8BreakIterator` is not available.

*   **`level_classifier.ts`**: Defines the `LevelClassifier` class. This class is used by `WrappedV8BreakIterator` to categorize breaks returned by different types of underlying iterators (e.g., line break iterator, character break iterator) into a consistent set of priority levels (hard break, soft break, midword break, character break).

*   **`constants.ts`**: Defines constants related to text breaking, such as:
    *   `SOFT_HYPHEN`: The soft hyphen character.
    *   `ELLIPSES`: The ellipsis character.
    *   `HARD_LINE_BREAK`, `SOFT_LINE_BREAK`, `MIDWORD_BREAK`, `CHARACTER_BREAK`: Numeric priority levels for different types of breaks.

## How It Works (Text Breaking Example)

1.  Code needing to break text (e.g., for layout in `common/layout_utils.ts`) obtains a break iterator instance from `BreakIteratorFactory.getInstance().getBreakIterator()`.
2.  The factory decides whether to provide a `WrappedV8BreakIterator` (preferred) or a `ManualBreakIterator`.
3.  The text to be broken is passed to the iterator's `adoptText()` method.
4.  The consuming code then uses methods like `next(level)` or `peek(level)` to find appropriate break points in the text based on desired break levels (e.g., try to find a soft line break before resorting to a character break).

## Relationships to Other Parts of the Code

*   **`format/`**:
    *   `dateformat.ts` and `numberformat.ts` heavily rely on the re-exported `goog.i18n.DateTimeFormat`, `goog.i18n.NumberFormat`, `goog.i18n.DateTimePatterns`, and `goog.i18n.DateTimeSymbols` from `i18n/format.ts` for their core formatting logic.
*   **`common/layout_utils.ts`**: Uses the `BreakIteratorFactory` and the `BreakIteratorInterface` to perform line breaking for text layout within charts (e.g., for axis labels, titles, legend entries). The constants from `i18n/constants.ts` (like `SOFT_HYPHEN`, `ELLIPSES`, and break levels) are also used here.
*   **`axis/axis_definer.ts`**: Indirectly uses `i18n/format.ts` through the `format/` classes for formatting axis tick labels.
*   **`tooltip/tooltip_body_creator.ts`**: Indirectly uses `i18n/format.ts` through the `format/` classes for formatting values displayed in tooltips.

The `i18n` directory provides essential internationalization support, ensuring that text is handled and displayed correctly according to locale-specific conventions, particularly for text segmentation (line breaking) and the underlying formatting of dates and numbers.The `README.md` for the `i18n` directory has been created.
