# Events and Interactivity Directory

This directory is central to handling user interactions and managing the dynamic state of charts. It defines how charts respond to mouse events, touch gestures, and programmatic changes, and how these interactions translate into visual feedback (like highlights, tooltips) and events that developers can subscribe to.

## Core Functionality

*   **`events.ts`**: Provides the basic eventing infrastructure. It allows adding and removing custom event listeners to arbitrary objects (like chart instances) and triggering custom events (e.g., `select`, `ready`). This is a foundational layer for communication between chart components and user code.
*   **`chart_event_types.ts`**: Defines enumerations for various chart and control event types, such as `ChartEventType` (e.g., `READY`, `SELECT`, `MOUSE_OVER`) and `ControlEventType` (e.g., `STATE_CHANGE`).
*   **`interaction_events.ts`**: Defines types and enums specifically for interaction events, including `EventType` (a detailed breakdown of interaction events like `DATUM_HOVER_IN`, `LEGEND_CLICK`), `TargetType` (e.g., `DATUM`, `SERIE`, `LEGEND_ENTRY`), and `OperationType` (e.g., `HOVER_IN`, `CLICK`). It also provides a utility to generate specific event types by combining target and operation.
*   **`chart_state.ts`**: Defines the `ChartState` class, which encapsulates the interactive state of a chart. This includes:
    *   `selected`: The currently selected elements (rows, columns, cells), managed by a `Selection` object from `common/selection.ts`.
    *   `focused`: The currently focused element (e.g., a specific data point, series, or category).
    *   `annotations`: State related to annotations (focused, expanded).
    *   `legend`: State related to the legend (focused entry, current page).
    *   `actionsMenu`: State for any actions menu associated with tooltips.
    *   `cursor`: Current mouse cursor position and position at last click.
    *   `overlayBox`: Defines a temporary box for visual feedback during interactions like drag-to-zoom.
*   **`chart_event_handler.ts`**: An abstract base class for handling DOM events on a chart. It listens to browser events (mouseover, click, etc.) on the chart's rendering surface or overlay.
    *   **`axis_chart_event_handler.ts`**: A concrete implementation for axis-based charts (lines, bars, scatter, etc.). It detects which chart element (datum, category, annotation) is being interacted with based on cursor position and sensitivity areas.
    *   **`pie_chart_event_handler.ts`**: A concrete implementation for pie charts, detecting interactions with pie slices.
*   **`gesture_handler.ts`**: Processes sequences of pointer events (mousedown, mousemove, mouseup) to detect gestures like dragging. It then dispatches higher-level gesture events (e.g., `CHART_DRAG_START`, `CHART_DRAG`, `CHART_DRAG_END`).
*   **`chart_interactivity_definer.ts`**: An abstract base class responsible for translating a `ChartState` into a visual "interactivity layer" for a `ChartDefinition`. This layer specifies how chart elements should change visually in response to the current state (e.g., highlighting a focused series).
    *   **`axis_chart_interactivity_definer.ts`**: Implementation for axis-based charts, defining how elements like points, lines, and bars should be highlighted (e.g., adding glows or rings). It also handles crosshair rendering.
    *   **`pie_chart_interactivity_definer.ts`**: Implementation for pie charts, defining how slices are highlighted or exploded.
*   **`chart_event_dispatcher.ts`**: Takes changes in `ChartState` and dispatches the appropriate high-level `ChartEventType` events (like `select`, `onmouseover`) to the user-facing chart object.

*   **`explorer/` subdirectory**: Contains code specifically for chart explorer functionalities like drag-to-pan and scroll-to-zoom (see `events/explorer/README.md`).

## How It Works (Simplified Flow)

1.  A `ChartEventHandler` (e.g., `AxisChartEventHandler`) is set up to listen to DOM events on the chart's canvas or overlay.
2.  When a DOM event occurs (e.g., mousemove), the `ChartEventHandler` detects the logical chart element (`targetElementID`) under the cursor.
3.  It may pass raw events to a `GestureHandler` to detect drags or other gestures.
4.  The `ChartEventHandler` dispatches low-level `interaction_events.EventType` (e.g., `DATUM_HOVER_IN`) to an internal `EventTarget`.
5.  An `EventHandler` (a separate class, `event_handler.ts`) listens to these internal interaction events.
6.  Based on the incoming interaction event and the chart's interactivity options (e.g., `focusTarget`, `selectionMode`), the `EventHandler` updates the `ChartState`.
7.  The `EventHandler` then schedules a callback (often via a `Scheduler` from `common/scheduler.ts` to batch updates).
8.  When the scheduled callback executes:
    *   A `ChartInteractivityDefiner` (e.g., `AxisChartInteractivityDefiner`) uses the updated `ChartState` and the base `ChartDefinition` to generate an "interactivity layer" (another partial `ChartDefinition`). This layer specifies visual changes (e.g., a point should now have a glow).
    *   The chart is re-rendered using the base definition overlaid with the interactivity layer.
    *   A `ChartEventDispatcher` compares the previous `ChartState` with the current one and fires appropriate public `ChartEventType` events (e.g., `onmouseover`, `select`) on the main chart object, which developers can listen to.

## Relationships to Other Parts of the Code

*   **`visualization/corechart/` (and other chart types)**:
    *   Charts instantiate and use `ChartEventHandler`, `EventHandler`, `ChartInteractivityDefiner`, and `ChartEventDispatcher` to manage their interactivity.
    *   `ChartDefinition` is the core data structure that interactivity definers modify.
    *   The rendering pipeline uses the output of the interactivity definer.
*   **`common/`**:
    *   `options.ts` and `option_types.ts`: Provide configuration that dictates interactive behavior (e.g., `focusTarget`, `selectionMode`, `tooltip.trigger`).
    *   `selection.ts`: The `ChartState` uses a `Selection` object.
    *   `scheduler.ts`: Used by `EventHandler` to batch state updates.
*   **`graphics/`**:
    *   `AbstractRenderer` and `OverlayArea`: Used by `ChartEventHandler` to attach DOM event listeners and get cursor positions.
    *   Visual elements like `Brush`, `PathSegments` are used by `ChartInteractivityDefiner` to specify highlights.
*   **`tooltip/`**: `ChartInteractivityDefiner` interacts with `TooltipDefiner` and `ActionsMenuDefiner` to manage the display of tooltips and context menus based on the chart's state.

This directory is crucial for making charts interactive and responsive to user input, providing both visual feedback and a programmable event model.The `README.md` for the `events` directory has been created.
