# Tooltip Directory

This directory is responsible for the definition, creation, layout, and rendering of tooltips that appear when users interact with chart elements. It handles both native (SVG/Canvas-based) and HTML tooltips, including the creation of their content and visual appearance.

## Core Functionality

*   **`tooltip_definition.ts`**: Defines the core TypeScript interfaces for tooltip structures.
    *   `TooltipDefinition`: A union type for `NativeTooltipDefinition` or `HtmlTooltipDefinition`.
    *   `NativeTooltipDefinition`: Describes a tooltip rendered using the chart's native graphics (SVG/Canvas), including `boxStyle` (a `Brush`), `outline` (bounding box and handle points), and `bodyLayout`.
    *   `HtmlTooltipDefinition`: Describes an HTML-based tooltip, including the `html` content (`SafeHtml`), `anchor` and `pivot` points for positioning, and `boundaries`.
    *   `Outline`: Defines the tooltip's shape (a `Box` and optional `handlePoints` for a callout).
    *   `BodyLayout`: Describes the layout of entries within the tooltip body.
    *   `BodyEntry`, `BodyLine`, `BodySeparator`, `BodyItem`: Interfaces for structuring the content of a tooltip body, allowing for lines of text, colored squares, and separators.
    *   `InteractionState`: An important interface passed around, containing `chartDefinition`, `actionsMenuEntries`, `interactivityLayer`, and `actionsMenuState`, providing context for tooltip creation.
*   **`tooltip_definer.ts`**: Contains the `TooltipDefiner` class, which is the main orchestrator for creating `TooltipDefinition` objects. It:
    *   Reads tooltip-related options (trigger, ignoreBounds, pivot).
    *   Uses a `TooltipBodyCreator` to generate the content of the tooltip.
    *   Calculates the tooltip's anchor and pivot points based on the interacted chart element.
    *   For native tooltips, it uses `tooltip_definer_utils.calcTooltipOutline` and `tooltip_definer_utils.calcTooltipBodyLayout` to determine the precise geometry and layout.
    *   For HTML tooltips, it uses `html_definer.createTooltipDefinition`.
*   **`tooltip_definer_utils.ts`**: Provides utility functions for `TooltipDefiner`, specifically for native tooltips:
    *   `createBodyTextLineEntry`, `createBodySeparatorEntry`, etc.: Helper functions to construct parts of the `TooltipBody`.
    *   `calcBaseUnit()`: Calculates a base unit (often related to font size) for layout.
    *   `calcTooltipSize()`: Calculates the overall width and height of the tooltip body.
    *   `calcTooltipOutline()`: Determines the tooltip's bounding box and handle (callout triangle) geometry, considering chart boundaries and pivot points.
    *   `calcTooltipBodyLayout()`: Arranges the `BodyEntry` items within the calculated outline.
*   **`tooltip_body_creator.ts`**: Defines the abstract `TooltipBodyCreator` class. Subclasses are responsible for generating the actual `Body` (content) of a tooltip based on the interacted chart element and chart state.
*   **`tooltip_body_creator_default.ts`**: The `TooltipBodyCreatorDefault` is a concrete implementation that creates standard tooltip content, often showing series names, category names, and values. It can handle single-item tooltips and aggregated tooltips (when multiple items are selected or focused).
*   **`dive_tooltip_body_creator.ts`**: A specialized `DiveTooltipBodyCreator` (likely for "Google Public Data Explorer" style charts, historically known as "Dive" charts) that formats tooltips with a large bold value and smaller gray time/category information underneath.
*   **`tooltip_builder.ts`**: Contains functions (`draw`, `create`) for rendering a `NativeTooltipDefinition` using an `AbstractRenderer` onto a `DrawingGroup`. It draws the outline (box and handle) and then the body content.
*   **`html_definer.ts` & `html_builder.ts`**:
    *   `html_definer.ts`: Contains `createTooltipDefinition` (specific to HTML tooltips) which prepares an `HtmlTooltipDefinition` by converting a structured `Body` into a `SafeHtml` object.
    *   `html_builder.ts`: Contains `draw` and `positionTooltip` for HTML tooltips. `draw` creates the HTML element in the DOM and `positionTooltip` calculates its top-left position based on anchor, pivot, and boundaries.
*   **`actions_menu_definer.ts`**: Defines `ActionsMenuDefiner` and `ActionsMenuDefinition`. This allows defining a context menu that can be embedded within a tooltip, providing interactive options related to the hovered/selected data.
*   **`aggregator.ts`**, **`category_aggregator.ts`**, **`series_aggregator.ts`**: These classes are used by `TooltipBodyCreatorDefault` when `aggregationTarget` is specified in the chart options. They provide logic to group and summarize data from multiple selected/focused items for display in an aggregated tooltip.
    *   `Aggregator`: Abstract base class.
    *   `CategoryAggregator`: Aggregates data by category.
    *   `SeriesAggregator`: Aggregates data by series.
*   **`tooltip_utils.ts`**: Provides utility functions for tooltip positioning, specifically `adjustTooltipHorizontally` and `adjustTooltipVertically`, which attempt to keep the tooltip within specified boundaries by flipping or shifting it.
*   **`defs.ts`**: Contains common definitions, like `DEFAULT_MARGINS` for tooltips.

## How It Works (Simplified Flow)

1.  When a user interaction (e.g., hover, click) occurs that should trigger a tooltip, the `ChartInteractivityDefiner` (from the `events` directory) initiates tooltip creation.
2.  It calls a method on `TooltipDefiner` (e.g., `createTooltip()`).
3.  `TooltipDefiner` determines the `anchor` (point on the chart element) and `pivot` (point the tooltip tries to position itself away from).
4.  `TooltipDefiner` uses its configured `TooltipBodyCreator` (e.g., `TooltipBodyCreatorDefault`) to generate the `Body` of the tooltip. This involves fetching relevant data from the `ChartDefinition` and formatting it into lines and items.
5.  If the chart is configured for HTML tooltips (`isHtmlTooltip` is true):
    *   `html_definer.createTooltipDefinition` is called, which uses `html_definer.toHtml` to convert the `Body` into `SafeHtml`.
    *   The `HtmlTooltipDefinition` is returned.
    *   Later, `html_builder.draw` will use this to create and position the HTML element in the DOM.
6.  If the chart uses native tooltips:
    *   `tooltip_definer_utils.calcTooltipSize`, `calcTooltipOutline`, and `calcTooltipBodyLayout` are used to determine the geometry and layout of the tooltip.
    *   A `NativeTooltipDefinition` is returned.
    *   Later, `tooltip_builder.draw` will use this and an `AbstractRenderer` to draw the tooltip.
7.  If an `ActionsMenuDefiner` is involved, it can augment the tooltip body with menu entries, and its state influences the interactivity layer of the tooltip definition.

## Relationships to Other Parts of the Code

*   **`events/chart_interactivity_definer.ts`**: This is the primary consumer of `TooltipDefiner`. It calls methods on `TooltipDefiner` to get a `TooltipDefinition` when the chart state indicates a tooltip should be shown.
*   **`graphics/`**:
    *   `AbstractRenderer`: Used by `tooltip_builder.ts` to draw native tooltips.
    *   `Brush`: Used in `NativeTooltipDefinition` for styling the tooltip box and by `tooltip_definer_utils` for items like colored squares.
    *   `DrawingGroup`: Native tooltips are rendered into a `DrawingGroup`.
*   **`text/`**:
    *   `TextStyle`: Used extensively to define the appearance of text within tooltips.
    *   `TextMeasureFunction`: Passed to `TooltipDefiner` and `tooltip_definer_utils` to accurately measure text for layout.
*   **`common/`**:
    *   `options.ts`: Tooltip behavior and appearance (e.g., `tooltip.trigger`, `tooltip.textStyle`, `tooltip.isHtml`) are configured via chart options.
    *   `option_types.ts`: Defines `TooltipTrigger` enum.
    *   `Coordinate`, `Box`: Mathematical types from Closure used for positioning and boundaries.
*   **`visualization/corechart/chart_definition.ts`**: The `TooltipBodyCreator` and `TooltipDefiner` read data (values, labels, series info) from the `ChartDefinition` to populate tooltip content. The generated `TooltipDefinition` can also be attached back to elements within an interactivity layer of the `ChartDefinition`.
*   **`loader/dynamic_loading.ts`**: `getSafeHtml` is used by `html_definer.ts` and `html_builder.ts` if HTML tooltips contain user-provided HTML.

The tooltip system is a key component for providing users with detailed information about specific chart elements upon interaction.The `README.md` for the `tooltip` directory has been created.
