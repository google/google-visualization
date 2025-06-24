# Query Directory

This directory contains modules related to fetching and handling data from Google Visualization API data sources. It defines classes for creating queries, sending them, and processing the responses.

## Core Functionality

*   **`abstractquery.ts`**: Defines the `AbstractQuery` interface, which outlines the basic contract for any query object, primarily the `send(responseHandler)` method.
*   **`query.ts`**: Implements the `Query` class, the standard mechanism for sending a request to a GViz data source URL. It handles:
    *   Constructing the full query URL, including parameters for the query language (`tq`), request ID (`reqId`), and potentially other options like refresh intervals or data signatures (`sig`).
    *   Choosing the appropriate send method (`xhr`, `scriptInjection`, `makeRequest`) based on options or by auto-detecting same-domain requests.
    *   Managing pending requests and timeouts.
    *   Providing a static `setResponse` callback that data sources use to deliver JSONP responses.
    *   Handling and normalizing Trix (Google Sheets) URLs.
*   **`queryresponse.ts`**: Implements the `QueryResponse` class, which wraps the JSON object returned by a data source. It provides methods to:
    *   Access the `DataTable` (if the query was successful).
    *   Check the execution status (`ok`, `warning`, `error`).
    *   Retrieve error or warning messages and reasons.
    *   Get the data signature.
    *   Includes static methods for sanitizing messages and preparing/displaying errors in a container element.
*   **`response_version.ts`**: Defines the `ResponseVersion` enum (e.g., `VERSION_0_5`, `VERSION_0_6`) to specify the GViz response protocol version.
*   **`customquery.ts`**: Implements `CustomQuery`, which allows users to provide their own request handler function. This is useful for data sources that don't adhere to the standard GViz protocol or require custom logic for fetching data. The custom request handler is responsible for eventually calling a response handler with the data.
*   **`authquery.ts` (DEPRECATED)**: Implements `AuthQuery`, a class designed for making authenticated requests to GViz data sources using OAuth or the older AuthSubJS API. It handles authentication tokens and authenticated XHR requests. **This module is marked as deprecated.**
*   **`parsedquery.ts`**: Defines `ParsedQuery` and `Column` classes. These are used to represent the server-side parsed structure of a GViz query (like SQL clauses: SELECT, WHERE, ORDER BY, GROUP BY, etc.) if this information is returned in the query response (typically in the `tqx.parsedQuery` part of the JSON). This is more for introspection of how the server interpreted the query rather than client-side query construction.
*   **`trix_utils.ts`**: Contains utility functions specifically for working with Trix (Google Sheets) URLs. This includes:
    *   Identifying Trix and Ritz (newer Sheets editor) URLs.
    *   Normalizing these URLs (e.g., ensuring HTTPS, standardizing paths like `/tq` or `/gviz/tq`).
    *   Extracting and setting parameters like `headers`, `tq` (query), and `range` from Trix URLs.
    *   Converting spreadsheet cell/range notation (e.g., "A1", "A1:B2") to coordinates and sizes.

## How It Works (Simplified Query Flow)

1.  A `Query` object is instantiated with a data source URL and optional settings.
2.  The user might set a query string using `setQuery("SELECT A, B WHERE C > 10")`.
3.  The `send(callback)` method is called.
4.  `Query` constructs the full URL, adding `tq`, `reqId`, and other parameters.
5.  Based on the `sendMethod` option or URL properties:
    *   For same-domain, an XHR request might be made.
    *   For cross-domain, historically script injection (JSONP) was common. `Query` handles this by creating a script tag. Modern approaches might involve XHR with CORS if the server supports it, or `makeRequest` in gadget environments. `downloadJsonpViaXhr` and `downloadJsonpViaSandbox` suggest mechanisms for handling JSONP responses.
    *   `AuthQuery` (if used, though deprecated) would handle adding authentication tokens.
6.  The data source processes the request and returns a JSONP response, which is a JavaScript snippet that calls `google.visualization.Query.setResponse(responseData)`.
7.  The static `Query.setResponse` method finds the pending `Query` instance using the `reqId` from the response.
8.  It creates a `QueryResponse` object from the `responseData`.
9.  The original callback provided to `send()` is invoked with this `QueryResponse` object.
10. The callback can then access the `DataTable` (via `queryResponse.getDataTable()`) or error details.

## Relationships to Other Parts of the Code

*   **`data/datatable.ts`**: The `QueryResponse` object, upon successful query execution, contains a `DataTable` instance that holds the fetched data. The constructor of `DataTable` can accept the JSON table specification part of a query response.
*   **`wrapper/chart_wrapper.ts` & `wrapper/control_wrapper.ts`**: These wrappers often internally use a `Query` object to fetch data when a data source URL is provided to them.
*   **`loader/`**: The query mechanism might be used after necessary packages are loaded. Some query parameters or URLs might be influenced by loader settings (e.g., locale affecting request headers or parameters).
*   **`common/json.ts`**: Used by `Query` and `QueryResponse` for parsing and serializing JSON, especially for handling `Date` objects correctly.
*   **`common/errors.ts`**: `QueryResponse.addError` uses this module to display error messages in a specified container.

The `query` directory is essential for enabling Google Charts to consume data from external data sources that adhere to the Google Visualization API protocol.The `README.md` for the `query` directory has been created.
