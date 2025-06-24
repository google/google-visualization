# Colorbar Directory

This directory contains the TypeScript code for defining, building, and rendering color bars (also known as color legends or gradient legends) within charts. Color bars are used to visually represent a continuous range of data values through a gradient of colors.

## Core Functionality

*   **`scale.ts`**: Defines the `Scale` class, which is a logical representation of a sequence of color gradients associated with a numeric scale. It manages an array of numeric values and a corresponding array of colors. It can interpolate a color for any given value within its range.
*   **`types.ts`**: Contains type definitions specific to the color bar, such as `Marker` (a point on the color bar), `Orientation` (horizontal/vertical), and `Options` (drawing parameters like position, size, text style).
*   **`definition.ts`**: Defines interfaces for the structural components of a color bar, such as `ColorGradientRectangleDefinition` (for a segment of the gradient), `MarkerDefinition` (for a triangular indicator), and `TextItemDefinition` (for labels on the color bar). The main `Definition` interface aggregates these.
*   **`definer.ts`**: Contains the core logic (`define` function) for building a `Definition` object. It takes a `Scale` object, drawing options, and marker information to calculate the geometric properties of all the color bar elements (gradient rectangles, markers, text labels).
*   **`builder.ts`**: Provides the `draw` function, which takes a `Definition` object (produced by `definer.ts`) and uses an `AbstractRenderer` to draw the color bar onto a `DrawingGroup`. It handles rendering the gradient, markers, and text.
*   **`color_bar_definer.ts`**: This class acts as a higher-level coordinator for creating a complete `ColorBarDefinition` (defined in `color_bar_definition.ts`). It takes chart options, determines the position and style of the color bar, and uses the `definer.ts` logic to generate the detailed drawing definition.
*   **`color_bar_definition.ts`**: Defines the `ColorBarDefinition` interface, which encapsulates all information needed to render a color bar, including its position, the `Scale` it represents, drawing options, and the detailed `Definition` from `definition.ts`.

## How It Works

1.  A `Scale` is created, often based on chart data range and color options specified by the user (e.g., `colorAxis.colors`, `colorAxis.values`).
2.  The `ColorBarDefiner` is instantiated with chart-wide options (like font, position preferences).
3.  The `ColorBarDefiner` is provided with the `Scale` and an area (a `Box`) where the color bar should be drawn.
4.  The `ColorBarDefiner` uses the `define` function from `definer.ts` to calculate all the geometric and style properties of the color bar elements (gradient segments, markers, text labels), resulting in a `definition.Definition` object.
5.  This `definition.Definition`, along with other high-level properties, is wrapped in a `ColorBarDefinition` object.
6.  Finally, the `draw` function in `builder.ts` takes the `ColorBarDefinition` and uses a renderer to draw the color bar onto the chart.

## Relationships to Other Parts of the Code

*   **`common/`**:
    *   `options.ts`: Used by `ColorBarDefiner` and `Scale` to read configuration like position, colors, values, and text styles from the chart options.
    *   `option_types.ts`: Provides `ColorBarPosition` enum.
    *   `util.ts`: May be used for utility functions like `getOverriddenRange`.
*   **`graphics/`**:
    *   `abstract_renderer.ts`: The `builder.ts` uses an `AbstractRenderer` to perform drawing operations.
    *   `drawing_group.ts`: The color bar is rendered into a `DrawingGroup`.
    *   `path_segments.ts`: Used by `builder.ts` to create paths for markers.
    *   `brush.ts`: Used extensively to define colors and gradients for the color bar segments and markers.
    *   `util.ts` (in `graphics/`): `blendHexColors` is used by `Scale` for color interpolation.
*   **`text/`**:
    *   `text_style.ts`: Used to define the style of text labels on the color bar.
    *   `text_measure_function.ts`: Used by `definer.ts` to measure text for layout purposes.
    *   `text_align.ts`: Used by `builder.ts` for text alignment during rendering.
*   **`format/`**:
    *   `numberformat.ts`: Used by `definer.ts` to format numeric labels for the color bar's extreme values.
*   **`visualization/corechart/`**: The `CoreChart` or similar chart types would instantiate `ColorBarDefiner`, provide it with the necessary scale and area, and then use `colorbar.draw` to render the legend if configured. The `AxisDefiner` might interact with `ColorBarDefiner` to coordinate layout space.The `README.md` for the `colorbar` directory has been created.
