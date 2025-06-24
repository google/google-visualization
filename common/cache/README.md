# Common Cache Utilities Directory

This directory provides utilities for caching and memoization, which are used to optimize performance by storing the results of expensive function calls and reusing them when the same inputs occur again.

## Core Functionality

*   **`cache.ts`**: Defines the `Cache` interface, which outlines the basic contract for a cache implementation. This includes methods like `clear()`, `contains(key)`, `get(key)`, `put(key, value)`, and `size()`.
*   **`lru.ts`**: Implements a Least Recently Used (LRU) cache. This type of cache evicts the least recently accessed items first when it reaches its capacity. It uses a standard `Map` to store cache entries, leveraging the `Map`'s insertion order to track usage.
    *   `lru_test.ts`: Contains unit tests for the `LRU` cache implementation, ensuring its correctness in various scenarios like adding, getting, clearing, and capacity handling.
*   **`memoize.ts`**: Provides a `memoize` function that wraps another function to cache its return values. When the memoized function is called with the same arguments, the cached result is returned instead of re-executing the function. It uses a serializer to create cache keys from function arguments and an underlying cache (defaults to `LRU`) to store results.
    *   `memoize_test.ts`: Contains unit tests for the `memoize` function, verifying that it correctly caches results for functions with different argument types and for methods within classes.

## How It Works

1.  The `Cache` interface provides a generic contract for different cache implementations.
2.  `LRU` is a concrete implementation of this interface, providing a cache with a fixed capacity that evicts the least recently used items.
3.  The `memoize` function takes a target function and an optional configuration (serializer, cache instance, cache size).
4.  When the memoized function is called, its arguments are serialized into a string key.
5.  The underlying cache (e.g., `LRU`) is checked for this key.
    *   If the key exists, the cached result is returned immediately.
    *   If the key does not exist, the original target function is executed, its result is stored in the cache with the generated key, and then the result is returned.
6.  The memoized function also exposes methods like `clear()` and `setCapacity()` to manage the underlying cache.

## Relationships to Other Parts of the Code

*   **`common/` (Parent Directory)**:
    *   The `memoize` function is used in `common/layout_utils.ts` to cache the results of the `breakLinesInternal` function, which can be computationally intensive.
    *   The `Cache` interface and `LRU` implementation are general-purpose and could potentially be used by other modules within `common/` or elsewhere in the library if caching is beneficial.
*   **Performance-Critical Sections**: Any part of the charting library that involves repetitive, expensive computations with the same inputs is a candidate for using the `memoize` function to improve performance. This could include complex layout calculations, data transformations, or rendering logic.

The utilities in this directory are designed to be generic and can be applied to various parts of the codebase to optimize performance by reducing redundant computations.The `README.md` for `common/cache` has been created.

I'll now proceed to the `controls` directory.
