# Data Directory

This directory is responsible for defining and managing the data structures used by the charting library. It provides the core classes for representing tabular data (`DataTable`), creating views on that data (`DataView`), and various utilities for data manipulation, validation, and conversion.

## Core Functionality

*   **`types.ts`**: Defines fundamental TypeScript types and interfaces used throughout the data handling modules. This includes:
    *   `Value`: Represents the type of a single cell value (e.g., `number`, `string`, `boolean`, `Date`, `number[]` for timeofday).
    *   `Cell`: An object representing a cell, potentially including a value (`v`), a formatted string (`f`), and properties (`p`).
    *   `ColumnType`: An enum for the data type of a column (e.g., `string`, `number`, `date`).
    *   `ColumnSpec`: An interface for defining a column's properties (id, label, type, role, pattern).
    *   `RowOfCells`: Represents a row as an object containing an array of `Cell`s.
    *   `TableSpec`: The JSON-like structure for defining a `DataTable`.
    *   `SortColumns`, `FilterColumns`, `GroupKeyColumnSpec`, `GroupAggregationColumnSpec`: Types for specifying sorting, filtering, and grouping operations.
*   **`abstract_datatable.ts` & `abstract_datatable_interface.ts`**: Define the `AbstractDataTable` class and its interface. This serves as a common base for both `DataTable` and `DataView`, ensuring they provide a consistent API for accessing and querying data (e.g., `getNumberOfRows()`, `getValue()`, `getColumnType()`).
*   **`datatable.ts`**: Implements the `DataTable` class, the primary container for tabular data. It allows:
    *   Adding and removing columns and rows.
    *   Setting and getting cell values, formatted values, and cell/row/column/table properties.
    *   Conversion to and from JSON and Plain Old JavaScript Object (POJO) formats.
    *   Static methods like `arrayToDataTable()` and `recordsToDataTable()` for easy instantiation from common data formats.
*   **`dataview.ts`**: Implements the `DataView` class, which provides a virtual, read-only view over an underlying `DataTable` or another `DataView`. It allows:
    *   Selecting a subset of columns and reordering them.
    *   Creating calculated columns based on existing columns or custom functions.
    *   Filtering and reordering rows.
    *   Hiding columns and rows without modifying the source data.
*   **`datautils.ts`**: A collection of utility functions for working with `AbstractDataTable` instances. This includes:
    *   Validation functions (e.g., `validateRowIndex`, `validateColumnIndex`, `validateTypeMatch`).
    *   Data querying functions (e.g., `getColumnRange`, `getDistinctValues`, `getSortedRows`, `getFilteredRows`).
    *   Formatting utilities (`getDefaultFormattedValue`, `dataTableToCsv`).
    *   Cell parsing (`parseCell`).
*   **`calc.ts`**: Provides common aggregation functions (e.g., `sum`, `count`, `avg`, `min`, `max`) and modifier functions (e.g., `month`) used with the `group` functionality.
*   **`group.ts`**: Implements the `group()` function, which performs SQL-like group-by operations on a `DataTable`. It allows grouping by specified key columns (potentially with modifier functions) and aggregating other columns.
*   **`join.ts`**: Implements the `join()` function, which performs SQL-like join operations (inner, left, right, full) between two `DataTable` instances based on specified key columns.
*   **`csv_to_datatable.ts`**: Provides the `CsvToDataTable` class for importing data from CSV text into a `DataTable`.
*   **`predefined.ts`**: Contains a map of predefined string identifiers to functions that can be used for calculated columns in a `DataView` (e.g., `emptyString`, `stringify`, `fillFromTop`).
*   **`data.ts`**: Defines a more generic `Data` class that can wrap an `AbstractDataTable` or an array of `DataObject` (often used for Vega charts). It provides a way to specify a "primary" data table from a potentially more complex data structure.
*   **`*_test.ts` files**: Unit tests for their corresponding modules, ensuring the correctness of data operations.

## Relationships to Other Parts of the Code

The `data` directory is a cornerstone of the library, providing the data foundation upon which visualizations are built.

*   **All Chart Types (e.g., `visualization/corechart/`, `visualization/table/`, etc.)**: All visualizations consume data in the form of an `AbstractDataTable` (either a `DataTable` or a `DataView`). They use its API to retrieve values, column types, labels, and properties to render the chart.
*   **`controls/`**:
    *   Controls like `Filter` operate on an input `DataTable` and produce a `DataView` to filter what's shown in linked charts.
    *   `Operator` controls can consume a `DataTable` and produce a new, transformed `DataTable`.
    *   The `Choreographer` manages the flow of `DataTable` and `DataView` instances between controls and charts.
*   **`format/`**: Formatters from the `format/` directory (e.g., `DateFormat`, `NumberFormat`) are used by `DataTable` and `DataView` (via `datautils.ts`) to generate default formatted string representations of cell values.
*   **`query/`**: The `QueryResponse` class often wraps a `DataTable` when data is fetched from a remote source.
*   **`wrapper/`**: `ChartWrapper` and `ControlWrapper` manage `DataTable` or `DataView` instances for the visualizations or controls they wrap.
*   **`common/json.ts`**: Used by `DataTable` for its `toJSON()` and constructor (when taking a JSON string) methods.
*   **`common/object.ts`**: Utilities from here might be used for object manipulation within data structures.

The integrity and consistency of the data layer are critical for the correct functioning of the entire charting library.The `README.md` for the `data` directory has been created.
