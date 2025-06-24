# Tree Directory

This directory contains modules for representing, manipulating, and laying out tree data structures. This is particularly useful for visualizations like TreeMaps or OrgCharts, but the core tree structures are generic.

## Core Functionality

*   **`node.ts`**: Defines the `Node` interface, which is the fundamental read-only contract for a tree node. It includes methods for:
    *   Getting ID (`getId`), name (`getName`), parent (`getParent`), and children (`getChildren`, `getChildAt`, `getChildCount`).
    *   Querying tree properties like depth (`getDepth`), height (`getHeight`), and ancestors (`getAncestors`).
    *   Checking if a node is a leaf (`isLeaf`) or if it contains another node (`contains`).
    *   Traversing the subtree (`traverse`).
    *   Finding nodes within the subtree (`find`).
    *   Aggregating values over the subtree (`calcAggregatedValue`).
*   **`node_base.ts`**: Implements `NodeBase`, a concrete class that provides the basic functionality outlined in the `Node` interface. It manages parent-child relationships and includes implementations for traversal, finding, and aggregation.
*   **`data_node.ts`**: Defines the `DataNode` interface, which extends `Node`. `DataNode` represents a tree node that is directly associated with a row in a `DataTable`. It adds methods to:
    *   Get the associated `DataTable` and row index (`getDataTable`, `getRow`).
    *   Access values and formatted values from the corresponding data table row (`getValue`, `getFormattedValue`, `getRowProperty`).
*   **`data_node_impl.ts`**: Implements `DataNodeImpl`, a concrete class for `DataNode`. It links a tree node directly to a row in an `AbstractDataTable`.
*   **`nodeid.ts`**: Defines the `NodeId` type, which can be a `string` or a `number`, used for identifying nodes.
*   **`tree.ts`**: Defines the `Tree` interface, representing a tree structure (which can actually be a forest of multiple trees). Key methods include:
    *   Getting root nodes (`getRootNodes`).
    *   Getting a node by its ID (`getNodeById`).
    *   Tree-wide traversal and find operations.
    *   Tree-wide aggregation.
*   **`tree_base.ts`**: Implements `TreeBase`, a concrete class providing the basic functionality for a `Tree`. It manages a list of root nodes and a map for quick lookup of nodes by their ID.
*   **`data_tree.ts`**: Implements `DataTree`, a subclass of `TreeBase`. This class constructs a tree structure directly from an `AbstractDataTable`. The data table is expected to have specific columns defining the node ID and its parent's ID, thus encoding the tree hierarchy. It handles errors like cycles or duplicate IDs.
*   **`projected_tree.ts`**: Implements `ProjectedTree`, which creates a new tree structure based on an existing tree (the "source" tree). It projects the structure of the source tree, but allows for the creation of new node objects using a provided `nodeFactory` function. This is useful for creating a tree with additional properties or behaviors (like layout information) based on an underlying data tree.
*   **`tree_aggregation.ts`**: Provides predefined aggregation functions (e.g., `sumNoOverride`, `averageNoOverride`) that can be used with the `calcAggregatedValue` method of `Node` and `Tree` to compute aggregate values over subtrees.
*   **`tree_layout.ts`**: Implements the `TreeLayout` class, which calculates the visual layout for a tree structure. It uses a top-down approach based on a variation of the Reingold-Tilford algorithm to arrange nodes in horizontal layers, minimizing overlaps and spacing them appropriately. It takes functions to determine node width and height, as well as horizontal and vertical spacing. The output is a set of X and Y coordinates for each node.
    *   `LayoutNode`: An internal helper class used by `TreeLayout` to augment tree nodes with layout-specific data (e.g., `x`, `y` coordinates, contour pointers).
*   **`tree_layout_test.ts`**: Contains unit tests for the `TreeLayout` algorithm, ensuring correct positioning for various tree structures and configurations.

## How It Works

1.  **Data Representation**: A tree is often initially represented in a `DataTable` where rows define nodes and their parent-child relationships (e.g., a column for node ID, a column for parent ID).
2.  **Tree Construction**: A `DataTree` can be constructed from this `DataTable`, parsing the relationships to build an in-memory tree of `DataNodeImpl` objects.
3.  **Projection (Optional)**: If specialized nodes are needed (e.g., for layout or specific visual properties), a `ProjectedTree` can be created from the `DataTree` using a `nodeFactory` to transform `DataNodeImpl` instances into custom node types (that still adhere to the `Node` interface).
4.  **Layout**: A `TreeLayout` instance is created with the tree (either `DataTree` or `ProjectedTree`) and functions/parameters defining node sizes and spacing. The `TreeLayout` computes X and Y coordinates for each node.
5.  **Rendering**: A chart visualization (like `TreeMap` or `OrgChart`) would then use the original node data (from `DataNode`) and the layout coordinates (from `TreeLayout`) to render the tree using a graphics renderer.
6.  **Aggregation (Optional)**: `calcAggregatedValue` can be used on nodes or the entire tree to compute values like the sum of sizes of all children, etc., which might be needed for sizing or coloring nodes in the visualization.

## Relationships to Other Parts of the Code

*   **`visualization/treemap/` and `visualization/orgchart/`**: These chart types are the primary consumers of the tree structures and layout algorithms provided in this directory. They would use `DataTree` to parse their input `DataTable` and `TreeLayout` to determine node positions.
*   **`data/`**:
    *   `AbstractDataTable`, `DataTable`: `DataTree` takes an `AbstractDataTable` as input. `DataNodeImpl` instances hold a reference to the `AbstractDataTable` and a row index to access their underlying data.
*   **`graphics/`**: The layout coordinates produced by `TreeLayout` are used by a graphics renderer to draw the tree nodes and connecting lines.
*   **`common/`**: May use basic utilities if needed, but the core tree logic is largely self-contained or relies on data structures.

This directory provides a robust and flexible system for handling hierarchical data, from basic tree representation to complex layout algorithms, forming the foundation for tree-based visualizations.The `README.md` for the `tree` directory has been created.
