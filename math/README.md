# Math Directory

This directory contains mathematical utilities and an expression parsing/rendering system.

## Core Functionality

### General Math Utilities:

*   **`coordinate.ts`**: Defines a simple `Coordinate` class with `x` and `y` properties. Includes a static `clone` method and an instance `clone` method.
*   **`trig.ts`**: Provides basic trigonometric helper functions:
    *   `sec(x)`: Calculates the secant of x.
    *   `cot(x)`: Calculates the cotangent of x.
*   **`vector_utils.ts`**: Contains utility functions for working with 2D vectors (using Closure Library's `Vec2`) and related geometric calculations:
    *   `round(vec)`: Rounds the coordinates of a vector.
    *   `sumAll(...vectors)`: Sums multiple vectors.
    *   `sumOfSizes(...sizes)`: Sums multiple `Size` objects.
    *   `vectorInDirection(angle, magnitude)`: Creates a vector with a given angle and magnitude.
    *   `vectorOnEllipse(angle, radiusX, radiusY)`: Creates a vector on an ellipse.
    *   `pairToVector(pair)` and `pairsToVectors(pairs)`: Converts `[x,y]` pairs to `Vec2` objects.
    *   `rectangleDiagonal(rectangleSize)`: Calculates the diagonal vector of a rectangle.
    *   `cornersOfRectangle(center, size)`: Returns the four corner coordinates of a rectangle.
    *   `centerOfRectangleAdjacentToPerpendicular(...)`: Calculates the center for positioning a rectangle adjacent to a perpendicular line.
    *   `cornersToRectangle(x1, y1, x2, y2)`: Creates a `GoogRect` from two opposite corners.
    *   `positionBoxInEllipticSlice(...)`: Positions a box within an elliptical slice, touching the edges.
    *   `circleAdjacentToConvexShape(...)`: Positions a unit circle adjacent to a convex shape along a ray.
    *   `pointsOnLineOfDistanceOneToPoint(...)`: Finds points on a ray at a unit distance from a given point.
    *   `isConvexShapeInInfiniteSlice(...)`: Checks if a convex shape is contained within an infinite angular slice.

### Expression Engine (`math/expression/`):

This sub-directory implements a system for representing, simplifying, and rendering mathematical expressions.

*   **`expression.ts`**: Defines the abstract base class `Expression` for all expression tree nodes. Key methods include `compose()` (to convert to a token sequence) and `simplify()`.
*   **Concrete Expression Classes**:
    *   `add.ts` (`Add`): Represents addition/subtraction of multiple expressions.
    *   `call.ts` (`Call`): Represents a function call with a name and arguments.
    *   `eq.ts` (`Eq`): Represents an equality expression with multiple components.
    *   `mul.ts` (`Mul`): Represents multiplication of multiple expressions, with an option to collapse terms.
    *   `neg.ts` (`Neg`): Represents negation of an expression.
    *   `number.ts` (`GVizNumber`): Represents a numeric literal.
    *   `power.ts` (`Pow`): Represents exponentiation.
    *   `variable.ts` (`Variable`): Represents a variable with a name.
*   **Operator Base Classes**:
    *   `nary_operator.ts` (`NaryOperator`): Base class for operators that can take multiple components (e.g., `Add`, `Mul`, `Eq`). Handles precedence for parentheses during composition.
    *   `unary_operator.ts` (`UnaryOperator`): Base class for operators that take a single component (e.g., `Neg`).
*   **Tokens (`math/expression/tokens/`)**: These classes represent the lexical tokens of a mathematical expression.
    *   `token.ts`: Defines the `Token` interface with a `getSymbol()` method.
    *   `symbols.ts`: An `enum Symbol` that lists all possible token types (e.g., `NUMBER`, `IDENTIFIER`, `PLUS`, `OPEN_PAREN`).
    *   Specific token classes (e.g., `plus.ts`, `minus.ts`, `number.ts`, `identifier.ts`, `open_paren.ts`) implement the `Token` interface.
*   **Renderer (`math/expression/renderer/`)**:
    *   `string_renderer.ts` (`StringRenderer`): Takes a sequence of `Token`s (produced by an `Expression`'s `compose()` method) and renders them as a human-readable string. It uses a map of renderers for different token symbols and can take a custom number formatter.

## How the Expression Engine Works (Simplified)

1.  Mathematical expressions are constructed as a tree of `Expression` objects (e.g., `new Add([new GVizNumber(5), new Variable('x')])`).
2.  The `simplify()` method can be called on an expression tree to perform algebraic simplifications (e.g., `Neg(Neg(x))` becomes `x`).
3.  The `compose()` method on an expression converts the expression tree into a linear sequence of `Token` objects. This process also handles operator precedence by inserting parentheses where necessary.
4.  A `StringRenderer` can then take this token sequence and convert it into a string representation of the expression.

## Relationships to Other Parts of the Code

*   **General Math Utilities (`coordinate.ts`, `trig.ts`, `vector_utils.ts`)**:
    *   `graphics/`: These utilities are likely used extensively within the graphics rendering pipeline for positioning elements, calculating paths, and performing geometric transformations. For example, `vectorOnEllipse` could be used in drawing pie chart slices or arc segments. `cornersOfRectangle` is fundamental for any rectangular drawing.
    *   `axis/`: Axis drawing involves many geometric calculations where these utilities would be helpful.
    *   `legend/`: Positioning legend items, especially in `labeled_legend_definer.ts`, might use vector math.
*   **Expression Engine (`math/expression/`)**:
    *   The primary consumer of this engine is not immediately obvious from the provided file list but it's designed for scenarios where mathematical formulas might need to be parsed, represented, or displayed.
    *   **Potential Uses**:
        *   **Calculated Columns/Fields**: If the charting library supports defining new data columns based on formulas involving other columns (though this functionality is more directly seen in `data/predefined.ts` for simpler cases).
        *   **Trendlines/Regression**: If trendline equations are generated and need to be displayed or manipulated.
        *   **Custom Charting Logic**: Advanced charting types or custom drawing routines that involve user-defined mathematical expressions.
        *   **Annotation Text**: If annotations can include dynamically calculated values based on expressions.
    *   `format/numberformat.ts`: The `StringRenderer` can accept a number formatter, which could be an instance of `NumberFormat` or a compatible custom function.

The `math` directory provides both low-level geometric and trigonometric utilities essential for graphical rendering, and a more specialized, self-contained expression engine for symbolic math representation.The `README.md` for the `math` directory and its subdirectories has been created.
