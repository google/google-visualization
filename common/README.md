# Common Utilities Directory

This directory houses a collection of fundamental TypeScript modules that provide shared utilities, constants, type definitions, and core functionalities used across various parts of the charting library.

## Core Functionality

*   **`options.ts`**: Manages chart configurations. It defines the `Options` class, which handles layered options (user-defined, theme-based, defaults) and provides methods to infer typed values from these options. This is central to how charts are customized.
*   **`option_types.ts`**: Contains enumerations for various option values, such as `ChartType`, `SerieType`, `LegendPosition`, `AxisType`, `EasingType`, etc. These enums provide type safety and clarity for chart configurations.
*   **`defaults.ts`**: Defines default option values for different chart components and types. This includes default colors, font sizes, axis properties, and behaviors.
*   **`theme.ts`**: Manages chart themes. It allows registering and retrieving predefined or custom themes (e.g., 'classic', 'material'), which are essentially sets of default options.
*   **`util.ts`**: A general-purpose utility module with functions for array manipulation, number operations (rounding, precision), geometric calculations (bounding boxes, interpolation), string manipulation, and comparison functions.
*   **`object.ts`**: Provides utilities for working with JavaScript objects, including deep comparison (`unsafeEquals`), cloning (`unsafeClone`, `clone`), hashing (`getHash`), and type guards (`isObject`, `isDateLike`).
*   **`json.ts`**: Handles serialization and deserialization of JavaScript objects to/from JSON, with special handling for `Date` objects.
*   **`timeutil.ts`**: Contains utilities for working with dates, times, and durations. This includes parsing and formatting durations, iterating over date ranges, and converting between different time representations (milliseconds, `Date` objects, duration arrays).
*   **`selection.ts` & `selection_object.ts`**: Manage the state of selected elements within a chart (e.g., selected data points, rows, or columns). `Selection` provides methods to add, remove, toggle, and query selections. `SelectionObject` defines the structure for a single selection item.
*   **`error_handler.ts` & `errors.ts`**: Provide a framework for handling and displaying errors and warnings that occur during chart rendering or operation. `ErrorHandler` can display messages within the chart container.
*   **`logger.ts`**: Sets up a logging framework, potentially integrating with browser consoles or custom div-based consoles for debugging.
*   **`animation.ts`**: Defines types and helpers related to chart animations, including easing functions and animation properties.
*   **`async_helper.ts`**: A utility for managing asynchronous callbacks, allowing for safe execution and cancellation.
*   **`constants.ts`**: Defines global constants like `GOLDEN_RATIO`.
*   **`layered_object.ts`**: Implements a utility for objects composed of multiple layers, where higher layers can override properties from lower layers.
*   **`layout_utils.ts`**: Contains utility functions specifically for layout calculations, such as text breaking and truncation.
*   **`messages.ts`**: Stores localized messages used in the charts (e.g., "No data", "Other").
*   **`number_scale_util.ts`**: Provides utilities for numeric scaling, including identity, logarithmic, and mirrored logarithmic scales.
*   **`scheduler.ts`**: A simple scheduler for invoking callbacks after a countdown.
*   **`size_scale.ts`**: A utility for scaling data values to visual sizes (e.g., for bubble chart radii), ensuring that the area is proportional to the value.
*   **`test_utils.ts`**: Contains utility functions and assertions to support unit testing, often acting as wrappers or replacements for standard testing framework functions.
*   **`cache/` subdirectory**: Contains utilities for caching and memoization (see `common/cache/README.md`).

## Relationships to Other Parts of the Code

The modules in the `common/` directory are fundamental and are imported by almost every other major part of the charting library:

*   **All Chart Types (e.g., `visualization/corechart/`, `visualization/piechart/`, etc.):** Heavily rely on `options.ts` for configuration, `defaults.ts` and `theme.ts` for styling, `error_handler.ts` for error reporting, and various utilities from `util.ts` and `object.ts`.
*   **`axis/`**: Uses `options.ts`, `timeutil.ts` (for date/time axes), `number_scale_util.ts`, and general utilities.
*   **`legend/` & `colorbar/`**: Use `options.ts` for configuration and styling.
*   **`format/`**: While `format/` provides formatting tools, `common/` utilities might consume these formatted strings or provide values to be formatted.
*   **`data/`**: `selection.ts` operates on row/column indices that correspond to the structure of `DataTable`.
*   **`graphics/`**: Utilities in `common/util.ts` might perform geometric calculations relevant to graphics rendering.
*   **Event Handling (e.g., `events/`):** `selection.ts` is crucial for managing selection state, which often triggers events. `async_helper.ts` can be used for managing event-driven callbacks.

Due to their foundational nature, changes in `common/` can have wide-ranging impacts across the entire library.The `README.md` for the `common` directory has been created.
