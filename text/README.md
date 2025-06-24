# Text Handling Directory

This directory contains modules related to the processing, styling, layout, and measurement of text within the charting library. These utilities are essential for rendering labels, titles, tooltips, and other textual elements accurately and aesthetically.

## Core Functionality

*   **`text_style.ts`**: Defines the `TextStyle` class (and `TextStyleProperties` interface), which encapsulates all styling attributes for a piece of text. This includes:
    *   `fontName`
    *   `fontSize`
    *   `color`
    *   `opacity`
    *   `auraColor` (for a glow effect around text)
    *   `auraWidth`
    *   `bold` (boolean)
    *   `italic` (boolean)
    *   `underline` (boolean)
    It provides methods to set and get these properties and includes default text style values.

*   **`text_align.ts`**:
    *   Defines the `TextAlign` enum (`START`, `CENTER`, `END`), used for specifying horizontal or vertical alignment of text.
    *   Provides utility functions:
        *   `getAbsoluteCoordinates()`: Calculates the absolute start and end coordinates of text given a relative anchor point, length, and alignment.
        *   `getRelativeCoordinate()`: Calculates a relative anchor point given absolute start/end coordinates and alignment.

*   **`line.ts`**: Defines the `Line` class, representing a single line of text with its `x`, `y` coordinates, `length` (allocated width/height), and the actual `text` string.

*   **`text_block_object.ts` & `text_block.ts`**:
    *   `text_block_object.ts`: Defines the `TextBlock` interface (and `Line` interface again, which seems redundant with `line.ts`). A `TextBlock` represents a multi-line block of text and includes:
        *   The original `text` string.
        *   A `textStyle` object.
        *   An array of `Line` objects (the broken-down lines).
        *   `paralAlign` and `perpenAlign` (parallel and perpendicular alignment).
        *   `tooltip` string.
        *   `angle` of rotation.
        *   `anchor` `Coordinate`.
        *   `boxStyle` (a `Brush` for a background box).
        *   `tooltipText` (a more structured tooltip content).
    *   `text_block.ts`: Implements the `TextBlock` class based on the interface. It includes methods for calculating the bounding box of a single line or the entire text block (`calcLineBoundingBox`, `calcBoundingBox`). It also has a static `createToFit` method to generate a `TextBlock` that fits within a given rectangle, handling line breaking and truncation.

*   **`text_measure_function.ts`**: Defines the `TextMeasureFunction` type. This is a function signature for any function that can measure the dimensions (width and height) of a given text string using a specific `TextStyle`. This abstraction allows different rendering engines or environments to provide their own text measurement logic.

*   **`text_utils.ts`**:
    *   `calcTextLayout()`: A core utility function that takes text, style, available width, and max lines, and returns a `TextLayout` object. The `TextLayout` includes the broken-down `lines` array and a `needTooltip` boolean indicating if the text was truncated. This function uses the line-breaking logic from `common/layout_utils.ts`.
    *   `tooltipCssStyle()`: Generates a CSS style object suitable for HTML tooltips based on a `TextStyle`.

## How It Works

1.  **Styling**: `TextStyle` objects are created and configured (often from chart options) to define the appearance of text.
2.  **Measurement**: A `TextMeasureFunction` (appropriate for the current rendering context, e.g., SVG or Canvas) is used to determine the dimensions of text strings with their given styles.
3.  **Layout**:
    *   For simple text, its position is determined by its anchor and alignment (`TextAlign`).
    *   For text that needs to fit within a constrained area, `text_utils.calcTextLayout()` is used. This function, in turn, relies on line-breaking algorithms (often from `common/layout_utils.ts` which uses `i18n/break_iterator_factory.ts`) to split the text into multiple lines if necessary and to truncate it with ellipses if it still doesn't fit.
4.  **Representation**: The laid-out text is often represented as a `TextBlock` object, which contains the individual `Line` objects, overall style, and positioning information.
5.  **Rendering**: The `TextBlock` (or individual lines and styles) is then passed to a graphics renderer (`graphics/abstract_renderer.ts` and its implementations) to be drawn on the chart.

## Relationships to Other Parts of the Code

*   **`graphics/`**:
    *   `AbstractRenderer` (and its subclasses `SvgRenderer`, `CanvasRenderer`) have methods like `createText()`, `drawText()`, `createTextOnLineByAngle()` that take `TextStyle` objects and text strings to render text. They use the `TextMeasureFunction` (often provided by the renderer itself or `DrawingFrame`) for layout calculations before drawing.
    *   `Brush` objects (from `graphics/brush.ts`) can be used for `TextBlock.boxStyle`.
*   **`common/layout_utils.ts`**: Contains the `breakLines` function, which is the core text-breaking algorithm used by `text_utils.calcTextLayout()`. This, in turn, uses the break iterators from `i18n/`.
*   **`common/options.ts`**: Chart options extensively define text styles for various elements (titles, labels, legend entries, tooltips). These options are parsed into `TextStyle` objects.
*   **`axis/`**: Axis definers (`axis_definer.ts`, `horizontal_axis_definer.ts`, `vertical_axis_definer.ts`) use `TextBlock`s to represent axis titles and tick labels. They rely on text measurement and layout utilities to position these elements correctly and avoid overlaps.
*   **`legend/`**: Legend definers (`legend_definer.ts`, `labeled_legend_definer.ts`) use `TextBlock`s for legend entry labels and use text measurement for layout.
*   **`tooltip/`**: Tooltip components use `TextStyle` and potentially `TextBlock` utilities for displaying tooltip content. `text_utils.tooltipCssStyle()` is specifically for HTML tooltips.
*   **`visualization/corechart/`**: Chart definitions (`ChartDefinition`) store `TextBlock` objects for elements like titles, and chart builders use these text utilities to prepare text for rendering.

The `text` directory provides a comprehensive suite of tools for managing all aspects of text in charts, from basic styling to complex layout and measurement, ensuring that textual information is displayed clearly and effectively.The `README.md` for the `text` directory has been created.
