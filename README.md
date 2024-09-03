This repository contains the open-source subset of the Google Visualization API, aka Google Charts.

The user documentation for Google Charts is at: https://developers.google.com/chart.

All the code in this repo will be TypeScript, with dependencies only on Google's Javascript Closure library.

Issues for this library may be posted by members of the public in the associated repo: https://github.com/google/google-visualization-issues/issues

Privacy Policy
==============

Google Charts is a library, not a service.  So it does not store data itself
regarding use of any features of the library.  However, there are two exceptions
that may apply depending on your use case.

See https://policies.google.com/privacy for the general Google privacy policy.

Use of google.visualization.Query
---------------------------------

If you use the `google.visualization.Query` class and methods to request data
from a Google Sheets spreadsheet, whether it is your data or someone else's,
you will be sending requests to the Google Sheets service.
This also applies when you use the query mechanism
indirectly, which happens if you use the `dataSourceUrl` property or `setDataSourceUrl`
method via an instance of `google.visualization.ChartWrapper` or the
`google.visualization.drawChart` method.

The sheets service has its own privacy policy, which is the same as the general
[Google Privacy and Terms](https://policies.google.com/privacy).

See [how to change the
sharing-related settings of a spreadsheet](https://support.google.com/drive/answer/2494893).


Use of google.visualization.GeoChart
------------------------------------

(Not yet available in this repo... but soon)
If you use the `google.visualization.GeoChart` together with the geocoding feature
for looking up locations by their names, then the Google Maps service will likely
be used. You will also need to get a Google Maps "API Key" to use this service.
Google Maps has its own privacy policy, which is the same as the general
[Google Privacy and Terms](https://policies.google.com/privacy).
