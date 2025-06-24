# Chart Explorer Utilities Directory

This directory contains modules that implement interactive chart exploration features, such as zooming and panning. These features allow users to dynamically change the displayed view of the chart data.

## Core Functionality

*   **`explorer.ts`**: This is the main orchestrator for chart exploration. The `Explorer` class:
    *   Checks if a chart type is compatible with exploration features.
    *   Initializes various explorer types (like drag-to-pan, scroll-to-zoom) based on chart options.
    *   Manages a `Viewport` instance to keep track of the current visible data range.
    *   Subscribes to chart events (via a `PubSub` mechanism managed by `features.ts`) to trigger exploration actions.
*   **`base_explorer_type.ts`**: Defines the `BaseExplorerType` abstract class, which serves as the foundation for all specific exploration interaction types (e.g., `DragToPan`, `ScrollToZoom`). It provides common functionalities like:
    *   Access to the chart state, layout, enabled axes, and the shared `PubSub` instance.
    *   A `Viewport` instance to manage the visible data range.
    *   A method `updateOptions()` to modify the chart's `hAxis.viewWindow` and `vAxis.viewWindow` options based on the current viewport, which in turn triggers a chart redraw.
*   **`viewport.ts`**: The `Viewport` class holds the state of the chart's current view window (min/max values for X and Y axes). It also stores the original data range and provides methods to convert screen coordinates to axis values based on the current chart layout. It handles constraints like maximum zoom in/out levels.
*   **Specific Explorer Types**:
    *   **`drag_to_pan.ts`**: Implements panning by dragging the mouse. It updates the viewport's min/max values based on the drag distance.
    *   **`drag_to_zoom.ts`**: Implements zooming by dragging a selection box. The selected box defines the new viewport.
    *   **`scroll_to_zoom.ts`**: Implements zooming using the mouse scroll wheel. Scrolling up typically zooms in, and scrolling down zooms out, centered (by default) on the chart's midpoint.
    *   **`pinch_to_zoom.ts`**: Implements zooming using pinch gestures on touch devices.
    *   **`right_click_to_reset.ts`**: Implements resetting the zoom/pan to the original full data view when the user right-clicks on the chart.
*   **`enabled_axes.ts`**: A simple class (`EnabledAxes`) to indicate whether the horizontal and/or vertical axes are enabled for exploration.
*   **`features.ts`**: The `Features` class acts as a higher-level manager that can instantiate and manage multiple features, including the `Explorer`. It uses a `PubSub` (Publish/Subscribe) pattern to allow different features to communicate and react to chart events.
*   **`common.ts`**: Contains shared constants and utility functions for the explorer modules, such as default zoom levels and checking if a cursor position is within the chart boundaries.

## How It Works (Simplified Flow)

1.  If the `explorer` option is enabled for a chart, an `Explorer` instance is created by the `Features` manager.
2.  The `Explorer` initializes specific `BaseExplorerType` instances (e.g., `DragToPan`, `ScrollToZoom`) based on the `explorer.actions` options.
3.  These explorer types subscribe to relevant chart events (e.g., `DRAG_START`, `SCROLL`) published by the `Features` class's `PubSub` instance.
4.  When an subscribed event occurs (e.g., user starts dragging):
    *   The corresponding explorer type (e.g., `DragToPan`) handles the event.
    *   It interacts with its `Viewport` instance to calculate new min/max values for the axes based on the user's action (e.g., how far they dragged).
    *   It calls `updateOptions()` on `BaseExplorerType`.
5.  `updateOptions()` modifies the `chartState.nextFrameOptions` by setting the `hAxis.viewWindow` and `vAxis.viewWindow` properties to reflect the new viewport.
6.  This change in `chartState` (managed by `EventHandler` in the parent `events` directory) eventually triggers a chart redraw, which then uses the updated viewWindow options to render the new zoomed/panned state.
7.  The `Viewport` is updated with the new layout information after the chart is ready (`READY` event) to ensure subsequent calculations are based on the current view.

## Relationships to Other Parts of the Code

*   **`events/` (Parent Directory)**:
    *   The explorer features are typically activated and managed by the `Features` class within the main event handling system.
    *   Explorer types subscribe to `ChartEventType`s (like `DRAG_START`, `SCROLL`, `RIGHT_CLICK`) that are published by the `Features` manager, which in turn often originate from the `ChartEventHandler` and `GestureHandler`.
    *   Explorer types update the `ChartState` by modifying `nextFrameOptions`, which is then used by the `ChartInteractivityDefiner` and rendering pipeline.
*   **`common/options.ts`**: Explorer behavior is configured through the `explorer` path in the chart options (e.g., `explorer.actions`, `explorer.maxZoomOut`).
*   **`visualization/corechart/`**:
    *   `ChartLayoutInterface` and `ChartDefinition` are used by the `Viewport` and explorer types to understand the chart's current dimensions, axis types, and original data ranges.
    *   The ultimate effect of the explorer is to change the `viewWindow` options of the horizontal and vertical axes defined in `ChartDefinition`, leading to a re-rendering of the chart with a new data view.

The explorer utilities provide powerful interactive capabilities, allowing users to focus on specific regions of their data within axis-based charts.The `README.md` for the `events/explorer` directory has been created.
