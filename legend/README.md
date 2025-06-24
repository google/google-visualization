# Legend Directory

This directory is dedicated to the definition, layout, and rendering of chart legends. It handles different types of legends, including standard legends with swatches and labels, and more specialized "labeled legends" which connect labels directly to chart elements (often lines).

## Core Functionality

*   **`legend_definition.ts`**: Defines the core TypeScript interfaces for a legend's structure.
    *   `LegendDefinition`: The top-level interface describing a legend, including its `position`, `area` (bounding box), `pages` (if paginated), `currentPage`, `currentPageIndex`, and `scrollItems`.
    *   `Entry`: Represents a single item in the legend (e.g., for a series or category). It includes properties like the `brush` (for the color swatch), `textBlock` (for the label), `isVisible`, and `index`.
    *   `Page`: An array of `Entry` objects, representing one page of a paginated legend.
    *   `ScrollItems`: Defines the visual elements for legend pagination (previous/next buttons, page index text).
*   **`legend_definer.ts`**: Contains the `LegendDefiner` class. This class is responsible for:
    *   Reading legend-related options (position, alignment, text style, etc.).
    *   Calculating the layout of legend entries, including pagination if the entries don't fit in the allocated area.
    *   Determining the size and position of legend icons (swatches) and text labels.
    *   Handling both vertical and horizontal legend orientations.
    *   Producing a `LegendDefinition` object that can be used for rendering.
*   **`labeled_legend_definition.ts`**: Defines the `LabeledLegendDefinitionEntry` interface and `LabeledLegendDefinition` type, which are specific to "labeled legends."
    *   `LabeledLegendDefinitionEntry`: Describes a single entry in a labeled legend. This includes the `startPoint` (on the chart element), `cornerPointX` (for line bending), `endPoint` (where the label is), brushes for the line and start point, and `TextBlock`s for text above and below the connecting line.
*   **`labeled_legend_definer.ts`**: Contains the `define` function for labeled legends. This function:
    *   Takes an array of `EntryInfo` (which specifies the origin point on the chart, text, and importance for each label).
    *   Calculates the optimal vertical positions for these labels within a given legend area to minimize overlaps and ensure lines connect clearly.
    *   Uses a force-simulation-like algorithm (`calcEntriesLayoutAttempt`, `simulateForceSystem`) to resolve label overlaps and fit them into the available space.
    *   Produces a `LabeledLegendDefinition` array.
*   **`labeled_legend_builder.ts`**: Contains the `build` function that takes a `LabeledLegendDefinition` (from `labeled_legend_definer.ts`) and an `AbstractRenderer` to draw the labeled legend (lines, start points, and text blocks) onto a `DrawingGroup`.
*   **`line_label_descriptor.ts`**: Defines the `LineLabelDescriptor` class, used by `LineLabelPositioner` to manage properties of individual labels during the layout process for labeled legends (e.g., desired Y position, height).
*   **`line_label_positioner.ts`**: Implements the `LineLabelPositioner` class. This class takes a set of `LineLabelDescriptor`s and adjusts their vertical positions to avoid overlaps while trying to keep them close to their associated chart lines. This is a key part of the layout algorithm for labeled legends.

## How It Works

**Standard Legend:**

1.  `LegendDefiner` is initialized with chart options and data (specifically, the legend entries derived from series/categories).
2.  It calculates the required space for each entry (icon + text).
3.  If the legend is positioned (`top`, `bottom`, `left`, `right`), it arranges entries into one or more pages to fit within the allocated `area`.
4.  If pagination is needed, it calculates the positions for scroll buttons and page indicators.
5.  The result is a `LegendDefinition` object.
6.  A separate rendering mechanism (likely in `visualization/corechart/`) would then take this `LegendDefinition` and use a graphics renderer to draw the legend.

**Labeled Legend:**

1.  The `define` function in `labeled_legend_definer.ts` receives `EntryInfo` for each line/series that needs a direct label.
2.  `LineLabelPositioner` and its associated algorithms are used to determine the optimal Y-coordinates for each label to prevent overlap and maintain proximity to the data line's end.
3.  This process generates a `LabeledLegendDefinition`.
4.  The `build` function in `labeled_legend_builder.ts` takes this definition and uses a renderer to draw the connecting lines, start markers, and text labels.

## Relationships to Other Parts of the Code

*   **`visualization/corechart/`**: Core chart types (like LineChart, PieChart, BarChart) instantiate and use `LegendDefiner` to create and manage their legends. The `ChartDefinition` object, a central data structure, will hold the `LegendDefinition`.
*   **`graphics/`**:
    *   `AbstractRenderer`: Used by `labeled_legend_builder.ts` to draw the labeled legend. Standard legends are also drawn using a renderer, typically orchestrated by the chart itself.
    *   `Brush`: Used to define the colors and styles of legend icons, lines, and text.
    *   `DrawingGroup`: Legends are often rendered into their own drawing group.
*   **`text/`**:
    *   `TextStyle`: Defines the appearance of legend text.
    *   `TextBlock` and `text_utils.ts`: Used for laying out and measuring legend text.
    *   `TextMeasureFunction`: Passed to definers to accurately measure text for layout.
*   **`common/`**:
    *   `options.ts`: Legend appearance and behavior are heavily configured through chart options (e.g., `legend.position`, `legend.textStyle`).
    *   `option_types.ts`: Defines enums like `LegendPosition` and `Alignment`.
    *   `util.ts`: General utility functions might be used for layout calculations.
*   **`events/`**: User interactions with the legend (e.g., clicking on an entry, paginating) trigger events that are handled by the chart's event system. The legend definition might include information to link legend items to their corresponding series for interactivity.

The legend directory is crucial for providing context to the data presented in charts, allowing users to identify and understand different series or categories.The `README.md` for the `legend` directory has been created.
