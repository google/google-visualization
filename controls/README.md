# Controls Directory

This directory contains the core logic for creating and managing interactive controls that can be used to manipulate and filter data displayed in charts and other visualizations. It defines the foundational classes for different types of controls and the mechanisms for them to interact with data and other components.

## Core Functionality

*   **`control.ts`**: Defines the base `Control` class, which serves as the foundation for all specific control types (like filters, operators, setters). It manages shared infrastructure such as:
    *   Handling a container element for rendering the control's UI.
    *   Managing the control's internal state, which typically reflects user input.
    *   Processing configuration options (`Options`).
    *   Interacting with a `ControlUi` instance for rendering and user interaction.
    *   Firing events like `statechange` (on user interaction) and `ready` (after drawing).
*   **`control_ui.ts`**: Defines the `ControlUi` abstract class, which is the base for all UI implementations of controls. It separates the control's logic from its visual presentation. UI implementations are responsible for:
    *   Rendering the control's interface within a given container.
    *   Managing their own state based on user interactions.
    *   Firing `uichange` events when the user interacts with the UI.
*   **`filter.ts`**: Defines the `Filter` class, a subclass of `Control`. Filters are specialized controls that modify the view of a DataTable by selecting a subset of rows or columns based on user input, without altering the underlying data.
*   **`operator.ts`**: Defines the `Operator` class, another subclass of `Control`. Operators can transform their input DataTable more freely, potentially emitting an output DataTable that is structurally different from the input (e.g., aggregation).
*   **`setter.ts`**: Defines the `Setter` class. Setters are controls that can programmatically set properties or options on other chart or control wrappers. Their state typically maps input paths (from their own state) to output paths (properties on target wrappers).
*   **`choreographer.ts`**: Implements the `Choreographer` class, which is responsible for managing the "wiring" and data flow between multiple controls and visualizations that share a common underlying `DataTable`. It handles:
    *   Dependencies between participants (controls and charts).
    *   Dispatching `DataView` updates in response to control state changes.
    *   Coordinating redraws of affected participants.
    *   Managing a `DrawIteration` to handle asynchronous drawing.
*   **`dashboard.ts`**: Provides a public facade, the `Dashboard` class, for assembling and managing a collection of controls and visualizations. It uses a `Choreographer` internally to handle the logic of interactions and data flow.
*   **`dag.ts`**: Implements a Directed Acyclic Graph (`DAG`) data structure. This is used by the `Choreographer` to represent and manage the dependencies between controls and charts, ensuring that updates flow in the correct order and to detect cyclical dependencies.

## How It Works (Simplified Flow)

1.  A `Dashboard` is created, which internally instantiates a `Choreographer`.
2.  `ControlWrapper` and `ChartWrapper` instances are bound together using the `Dashboard.bind()` method. This registers them with the `Choreographer` and sets up dependencies in its internal `DAG`.
3.  When the `Dashboard.draw(dataTable)` method is called:
    *   The `Choreographer` receives the data.
    *   A `DrawIteration` begins.
    *   Controls and charts are drawn in topological order based on the `DAG`.
    *   Each `Control` instance (e.g., a `Filter`) prepares its options and state.
    *   The `Control` instantiates and draws its associated `ControlUi`.
4.  When a user interacts with a `ControlUi`:
    *   The `ControlUi` fires a `uichange` event.
    *   The `Control` updates its internal state.
    *   The `Control` (typically) fires a `statechange` event.
5.  The `Choreographer` listens for `statechange` (or `ready` for programmatic changes) events from controls:
    *   It starts or updates a `DrawIteration`.
    *   For a `Filter` control, it calls `applyFilter()` to get a new `DataView`.
    *   For an `Operator` control, it calls `applyOperator()` to get a new `DataTable`.
    *   For a `Setter` control, it calls `apply()` which updates properties on target wrappers.
    *   The `Choreographer` then propagates these new data views/tables or property changes to dependent charts and controls, triggering their redraw.

## Relationships to Other Parts of the Code

*   **`wrapper/`**: `ControlWrapper` (and `ChartWrapper`) are essential for encapsulating controls (and charts) and their configurations. The `Choreographer` and `Dashboard` primarily interact with these wrappers.
*   **`data/`**: Controls operate on `AbstractDataTable`, `DataTable`, and `DataView` objects. Filters produce `DataView`s, while Operators can produce new `DataTable`s.
*   **`events/`**: The controls system relies heavily on the eventing mechanism (`events.ts`, `chart_event_types.ts`) to communicate state changes and readiness.
*   **`common/`**:
    *   `options.ts`: Used by `Control` to manage its configuration.
    *   `selection.ts`: While not directly used by the base controls here, the overall dashboard selection state might be influenced by control interactions.
    *   `error_handler.ts`: Used for managing errors within controls and the choreographer.
*   **Specific UI Implementations**: Concrete UI implementations for controls (which might reside in other directories or be user-provided) would subclass `ControlUi`.
*   **Visualizations (e.g., `visualization/corechart/`)**: These are the consumers of the `DataView`s or `DataTable`s produced or modified by the controls, and are redrawn by the `Choreographer`.

This directory forms the backbone of interactive dashboards, enabling users to dynamically explore and refine their data visualizations.The `README.md` for the `controls` directory has been created.
