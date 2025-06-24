# Loader Directory

This directory is responsible for dynamically loading Google Charts packages, external scripts (like the Google Maps API and WebFontLoader), and managing related resources. It ensures that necessary code modules and assets are available when needed by the charting library.

## Core Functionality

*   **`loader.ts`**:
    *   `resolveConstructor(userVizType)`: Takes a string representing a chart or control type (e.g., "PieChart", "StringFilter") and attempts to find its constructor function. It searches predefined namespaces (`google.visualization`, `google.charts`) and the global scope. This is crucial for instantiating chart objects dynamically based on user requests.
    *   `loadApi(moduleName, moduleVersion, settings)`: A wrapper around `google.charts.load()` (or the older `google.load()`). It handles loading core visualization APIs and specific chart packages. It also manages locale settings and a queue to sequentialize multiple load requests, ensuring that dependencies are loaded in order.
*   **`load_script.ts`**: Provides functions (`load`, `loadMany`) for dynamically loading external JavaScript files.
    *   It uses Closure Library's `jsloader.safeLoad` and `jsloader.safeLoadMany` for secure script loading.
    *   It supports loading scripts with specified timeouts and attributes (like `async`, `defer`).
    *   `makeUrlStruct` and `getTrustedUrl` are used to construct `TrustedResourceUrl` objects, which are required for safe script loading.
*   **`utils.ts`**: Contains utility functions related to the loading process:
    *   `isWindowLoaded()`: Returns a Promise that resolves when the browser window has finished loading.
    *   `loadedResources`, `getResourcePromise()`, `getResourceLoaded()`, `setResourcePromise()`, `setResourceLoaded()`: Manage a cache of resources (scripts, CSS files) that have been or are being loaded to prevent redundant loading.
    *   `getModulePath()`: Determines the base path for loading static chart modules, considering configurations like `google.visualization.ModulePath` or constructing it from `google.loader.GoogleApisBase` and `google.visualization.Version`.
    *   `makeCssUrl()`: Constructs a URL for fetching CSS files.
    *   `getLocale()`: Retrieves the currently loaded locale (e.g., 'en', 'fr').
*   **`packages.ts`**:
    *   `CHART_TYPE_MAP`: A mapping from visualization class names (e.g., "PieChart", "Table") to their corresponding package names (e.g., "corechart", "table"). This is essential for `google.charts.load` to know which package to fetch for a given chart type.
    *   `isCoreChart(type)`: Checks if a given chart type belongs to the "corechart" package.
    *   `getPackage(type)`: Returns the package name for a given chart type.
*   **`dynamic_loading.ts`**:
    *   Manages "safe mode" for HTML and style sanitization. When enabled, untrusted HTML input is sanitized.
    *   Provides `getSafeHtml()` and `getSafeStyle()` which use Closure Library's sanitizers.
    *   `getSafeType()`: Sanitizes visualization type strings.
    *   Defines constants like `GVIZ_IS_MOBILE` and `BUILT_FOR_DYNAMIC_LOADING` (set during the build process).
*   **`safe.ts`**:
    *   `safenUpType(vizType)`: Checks a given visualization type string against a whitelist of allowed visualization names. This is a security measure to prevent loading arbitrary or potentially unsafe code.
    *   `allowedVisualizations`: A `Set` containing the names of all officially supported and vetted visualizations.
*   **`batch_geocoder.ts`**: A utility for batch geocoding addresses using the Google Maps API. It manages loading the Maps API if needed, caching results, and handling request batching and retries. It defines `BatchRequest` and `RequestGroup` for managing geocoding tasks.
*   **`webfonts.ts`**: Implements `WebFontLoader`, a class for loading custom web fonts (typically Google Fonts) that might be specified in chart options. It uses the WebFontLoader library (`WebFont.load`).
*   **`url_struct.ts`**: Defines the `UrlStruct` interface, a helper structure for `load_script.ts` to manage components of a URL before it's constructed into a `TrustedResourceUrl`.
*   **`loader_test.ts`**: Contains unit tests for the `loader.ts` module, particularly for `resolveConstructor`.

## How It Works (Simplified Loading Flow)

1.  A user or another part of the library calls `google.charts.load()` (often via `loader.ts#loadApi`) specifying packages and a callback.
2.  `loader.ts` may queue the request if other loads are in progress.
3.  When it's time to load, `loadApi` determines the correct module paths using `utils.ts#getModulePath`.
4.  `load_script.ts#loadMany` (or `load_script.ts#load` for single scripts) is used to fetch the JavaScript files for the requested packages. This uses `TrustedResourceUrl` for security.
5.  `utils.ts` tracks loaded resources to avoid refetching.
6.  If chart options specify custom fonts, `webfonts.ts#WebFontLoader` might be used to load them.
7.  If a chart requires geocoding (like GeoChart), `batch_geocoder.ts` might be invoked, which can also trigger dynamic loading of the Google Maps API via `load_script.ts`.
8.  Once all necessary scripts for a requested visualization (e.g., "PieChart") are loaded, its constructor becomes available.
9.  `loader.ts#resolveConstructor` can then be used to get a reference to this constructor, allowing the chart to be instantiated.
10. `dynamic_loading.ts` and `safe.ts` ensure that type names are vetted and HTML/styles are sanitized if "safe mode" is active.

## Relationships to Other Parts of the Code

*   **Entry Points (e.g., `jsapi_compiled.js`, `jsapi_debug.js` or similar top-level library files)**: The public `google.charts.load` and `google.charts.setOnLoadCallback` functions are the primary interface to this loader system.
*   **All Chart and Control Wrappers (e.g., `wrapper/chart_wrapper.ts`, `wrapper/control_wrapper.ts`)**: When a wrapper is instantiated with a chart type string, it will eventually use `loader.ts#resolveConstructor` (often indirectly via a chart factory) after ensuring the necessary packages are loaded.
*   **Visualizations Requiring External APIs**:
    *   `GeoChart` and other mapping visualizations depend on `batch_geocoder.ts` and, by extension, the dynamic loading of the Google Maps API.
*   **`common/options.ts`**: Options like `fontName` can trigger `WebFontLoader`.
*   **Any component rendering HTML from data**: Might use `dynamic_loading.ts#getSafeHtml` for sanitization.

The loader directory is fundamental for the modularity and on-demand loading capabilities of the Google Charts library, allowing users to only load the code they need for the specific charts they are using. It also plays a role in security through type vetting and HTML sanitization.The `README.md` for the `loader` directory has been created.
