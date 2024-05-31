/**
 * @fileoverview A library to use google maps api for geocoding multiple
 * addresses.  We have two modes of operation:
 * - RequestGroup - Simple geocoding, in which the callback is called once,
 *   with all the results.
 * - BatchRequest. Where the callback is called for each set of results.
 *
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// taze: google from //third_party/javascript/typings/googlemaps:google_maps_without_externs

import {
  getLogger,
  info,
  Logger,
  warning,
} from '@npm//@closure/log/log';
import {isObject} from '../common/object';
// tslint:disable-next-line:deprecation
import {Const} from '@npm//@closure/string/const';
import {Timer} from '@npm//@closure/timer/timer';

import {parse, stringify} from '../common/json';
import {unsafeClone} from '../common/object';
import * as loadScript from './load_script';

// tslint:disable:ban-types Migration
// tslint:disable-next-line:no-any For use by external code.
type AnyDuringMigration = any;

/**
 * The google maps API service, dynamically loaded if needed.
 */
// tslint:disable-next-line:deprecation
const MAPS_API_URL_FORMAT: Const = Const.from(
  'https://maps.googleapis.com/maps/api/js?key=%{key}',
);

/**
 * A set of callbacks that should be called once the maps API is loaded.
 */
let loadMapsApiCallbacks: Array<() => AnyDuringMigration> = [];

/**
 * Checks if the maps api V3 has been loaded to the page.
 * @return True iff the maps api is loaded.
 */
function isMapsApiV3Loaded(): boolean {
  return !!goog.getObjectByName('google.maps.DirectionsService');
}

// Trick for telling TS compiler that goog.addSingletonGetter adds the
// getInstance static method.
// tslint:disable-next-line:class-as-namespace
abstract class Singleton {
  /** @nocollapse */
  static getInstance(): BatchGeocoder {
    throw new Error('Must be overridden');
  }
}

/**
 * The BatchGeocoder
 */
export class BatchGeocoder extends Singleton {
  /**
   * The maximum number of requests that can be geocoded simultaneously.
   */
  static MAX_REQUESTS = 400;

  private readonly logger: Logger | null;
  private readonly geocoder: google.maps.Geocoder;

  /**
   * A cache to avoid calling the same request twice.
   * This is a mapping from the serialized json of the request to the
   * goeocoding result for it, which are the response and status.
   *
   * {!Object<string, {
   *     response: !Array<!google.maps.GeocoderResult>,
   *     status: !google.maps.GeocoderStatus}>}
   */
  private readonly cache: {
    [key: string]: {
      response: google.maps.GeocoderResult[];
      status: google.maps.GeocoderStatus;
    };
  } = {};

  private readonly activeRequests: Set<string>;
  private readonly requestHandlerMap: Map<string, BatchRequest[]>;

  // pendingRequests is managed as a queue.
  private readonly pendingRequests: AnyDuringMigration[];

  /**
   * Constructs a new batch geocoder.
   * Note: The class requires the google map API V3 to be loaded to the page.
   * @see loadMapsApi().
   * The geocoder geocodes an array of requests given in one of the following
   * formats:
   *   addresses (Array<string>) - each cell is an address string.
   *   objects (Array<Object>) - each cell is an object with properties
   *       address (string) — The address to geocode.
   *       latLng (google.maps.LatLng) — The LatLng for which you wish to obtain
   *           the closest, human-readable address. If specified the address is
   *           ignored. (optional).
   *       bounds (google.maps.LatLngBounds) — The LatLngBounds within which to
   *           bias geocode results more prominently. (optional).
   *       language (string) — The language in which to return results.
   *           (optional).
   *       region (string) — The region code, specified as a IANA language
   *           region subtag. (optional).
   *           @link http://www.iana.org/assignments/language-subtag-registry
   * The results are given as an array of response objects. Each response
   * matches the request in the corresponding array index. If a request could
   * not be geocoded, null is added to the responses array.
   * For more information on the format of the request and response see
   * {@link http://code.google.com/apis/maps/documentation/v3/services.html}
   */
  constructor() {
    super();

    /**
     * Logger.
     */
    this.logger = getLogger('gviz.util.BatchGeocoder', Logger.Level.ALL);

    /**
     * The google maps geocoder to use. The Geocoder is dynamically loaded,
     * so if not yet done, google.maps.Geocoder() will throw an error.
     * Keeps a cache of geocoded addresses.
     * @suppress {checkTypes}
     */
    this.geocoder = new google.maps.Geocoder();
    // We add the empty result for an empty request, to avoid calling the API
    // for these requests even once.
    this.cache[stringify({'address': ''})] = {
      response: [],
      status: google.maps.GeocoderStatus.ZERO_RESULTS,
    };
    /**
     * The set of active requests for which we are still waiting for a response.
     * These requests may be requests that were fired off for which the response
     * simply hasn't come in yet, or they may be requests that failed that we
     * are retrying. If a request is in the cache, it will never be in
     * activeRequests_, but may be in pendingRequests_.
     */
    this.activeRequests = new Set();

    /**
     * A map of raw geocoding requests to their handlers
     * (BatchRequest objects). This is used to notify the Request
     * objects when a response comes in.
     */
    this.requestHandlerMap = new Map();

    /**
     * This is an ordered queue of raw geocoding requests, mainly used to
     * maintain the order in which requests have come in. When a new Request
     * object comes in, each request in that object will be added to the queue
     * and to the requests_ map.
     */
    this.pendingRequests = [];
  }

  /**
   * Geocodes a batch of requests. When geocoding is done, the callback function
   * is called once with geocoding responses for all the requests.
   * If the function is called before geocoding is done, an exception is thrown.
   *
   * @see class overview for the format of the geocoding requests and responses.
   *
   * @param request The request to
   *     geocode.
   */
  geocodeBatch(request: BatchRequest) {
    const addresses = request.getRequests();
    addresses.forEach((address) => {
      const serializedAddress = stringify(address);
      if (serializedAddress in this.cache) {
        // If a request comes in for something we've already processed, there's
        // no point in making it wait.
        const response = this.cache[serializedAddress];
        request.finish(address, response);
      } else {
        if (!this.requestHandlerMap.has(serializedAddress)) {
          this.pendingRequests.push(address);
          this.requestHandlerMap.set(serializedAddress, []);
        }
        this.requestHandlerMap.get(serializedAddress)!.push(request);
      }
    });
    this.geocodeNextRequest();
  }

  /**
   * Geocodes the next request. Before geocoding, we check if this request is
   * already in the cache.
   */
  private geocodeNextRequest() {
    if (this.pendingRequests.length === 0 && this.activeRequests.size === 0) {
      return;
    }
    const address =
      this.activeRequests.size > 0
        ? parse(this.activeRequests.values().next().value)
        : this.pendingRequests[0]; // Note: this element is shifted off below.
    const serializedAddress = stringify(address);
    if (serializedAddress in this.cache) {
      // The request is in the cache, use that.
      this.requestHandlerMap.get(serializedAddress);
      const response = this.cache[serializedAddress];
      this.pendingRequests.shift();
      this.handleRequestResolved(address, response.response, response.status);
      this.requestHandlerMap.delete(serializedAddress);
    } else {
      if (this.activeRequests.size === 0 && this.pendingRequests.length > 0) {
        // Check if requests still care about this.
        this.pendingRequests.shift();
        const requests = this.requestHandlerMap.get(
          serializedAddress,
        ) as BatchRequest[];
        if (requests.every((request) => request.isCancelled())) {
          this.handleRequestResolved(address, null, null);
        } else {
          // Only geocode if there are no in-flight requests.
          this.activeRequests.add(serializedAddress);
          this.doGeocode(
            address,
            this.handleRequestResolved.bind(this, address),
          );
        }
      } else if (this.activeRequests.size > 0) {
        // We already have at least one in progress request. It must have
        // failed. Try it again.
        this.doGeocode(address, this.handleRequestResolved.bind(this, address));
      }
    }
  }

  /**
   * Does the actual geocoding of an address.
   * @param address The request that should be geocoded.
   * @param callback The function to call when geocoding is done.
   */
  private doGeocode(
    address: string | AnyDuringMigration,
    callback: (
      p1: google.maps.GeocoderResult[] | null,
      p2: google.maps.GeocoderStatus,
    ) => AnyDuringMigration,
  ) {
    if (isObject(address)) {
      address = unsafeClone(address);
      if (address['bounds']) {
        const bounds = address['bounds'];
        address['bounds'] = new google.maps.LatLngBounds(
          new google.maps.LatLng(bounds['lo']['lat'], bounds['lo']['lng']),
          new google.maps.LatLng(bounds['hi']['lat'], bounds['hi']['lng']),
        );
      }
    }
    address = address as {[key: string]: AnyDuringMigration};
    this.geocoder.geocode(address, callback);
  }

  /**
   * Marks a request as completed and calls the callbacks for the requests that
   * included this request object.
   * @param request The request that was completed.
   * @param response The response for the given request.
   */
  private completeRequest(
    request: AnyDuringMigration | string,
    response: AnyDuringMigration,
  ) {
    const serializedRequest = stringify(request);
    const requests = this.requestHandlerMap.get(
      serializedRequest,
    ) as BatchRequest[];
    if (requests != null) {
      requests.forEach((req) => {
        if (!req.isCancelled()) {
          req.finish(request, response);
        }
      });
    }
    this.activeRequests.delete(serializedRequest);
    this.requestHandlerMap.delete(serializedRequest);
  }

  /**
   * Called when a single request was geocoded.
   *
   * @param request The original request.
   * @param response An array of geocoding
   *     responses.
   * @param status The geocoding status.
   */
  private handleRequestResolved(
    request: AnyDuringMigration, //
    response: google.maps.GeocoderResult[] | null,
    status: google.maps.GeocoderStatus | null,
  ) {
    let delay = 0;
    const requestType = request['latLng'] ? 'latLng' : 'address';
    let requestString = request[requestType];
    requestString = /*this.nextRequestIndex_ + ' ' +*/ requestString;
    if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {
      // Query refused.
      info(this.logger, `query refused, retrying: ${requestString}`);
      // Calling the next request with a delay.
      // Theoretically it should work again in 1000 ms but to be on the safe
      // side we use 520 (we expect it to require two calls, total of 1040 ms).
      delay = 520;
    } else if (status === google.maps.GeocoderStatus.OK) {
      // Query success, store responses (also in the cache).
      const serializedRequest = stringify(request);
      info(this.logger, `Added ${serializedRequest} to the cache.`);
      if (!response || !status) {
        throw new Error('There must be a response and status here.');
      }
      const responseObject = {response, status};
      this.cache[serializedRequest] = responseObject;
      // We are caching results of canceled requests, but avoid changing the
      // state (which is aligned with the new request).
      const response0 = response[0] as AnyDuringMigration;
      const responseString =
        requestType === 'address'
          ? response0['geometry']['location'].toString()
          : response0['formatted_address'];
      info(
        this.logger,
        `geocoding response for ${requestString}: ${responseString}`,
      );
      this.completeRequest(request, responseObject);
    } else {
      warning(this.logger, `error ${status} in geocoding ${requestString}`);
      // Since the current request was canceled, we avoid changing the state
      // (which is aligned with the new request).
      this.completeRequest(request, {response: null, status});
    }

    Timer.callOnce(this.geocodeNextRequest.bind(this), delay, this);
  }

  /**
   * Adds the maps api to the given page.
   * @param callback A callback function.
   * @param key A mapsApiKey to use if provided. If `key` is
   *     undefined, use the `the google.visualization.mapsApiKey`. If `key`
   *     or (mapsApiKey) is an empty string, then avoid loading the Maps API and
   *     and just call the callback.
   */
  static loadMapsApi(
    callback:
      | (() => AnyDuringMigration)
      | ((p1: AnyDuringMigration | null) => AnyDuringMigration),
    key?: string,
  ) {
    if (isMapsApiV3Loaded()) {
      // AnyDuringMigration because:  Expected 1 arguments, but got 0.
      (callback as AnyDuringMigration)();
      return;
    }
    // AnyDuringMigration because:  Argument of type '(() => any) | ((p1: any)
    // => any)' is not assignable to parameter of type '() => any'.
    loadMapsApiCallbacks.push(callback as AnyDuringMigration);
    function callbackWrapper() {
      if (isMapsApiV3Loaded()) {
        const callbacks = loadMapsApiCallbacks;
        loadMapsApiCallbacks = [];
        callbacks.forEach((aCallback) => {
          aCallback();
        });
      } else {
        throw new Error('Error: cannot load Maps API.');
      }
    }
    if (loadMapsApiCallbacks.length === 1) {
      // Loading the API only if this is the first request.
      // Note: this will break pages with code already using maps API V2
      // not for gviz.
      const urlFormat = MAPS_API_URL_FORMAT;
      key = key || goog.getObjectByName('google.visualization.mapsApiKey');
      if (key === '') {
        // If the key is blank, disable calling Maps API.
        callback({disableMapsApi: true});
        return;
      }
      const args = {'key': typeof key === 'string' ? key : ''};
      loadScript.load(urlFormat, args).then(callbackWrapper);
    }
  }
}
goog.addSingletonGetter(BatchGeocoder);

/**
 * A batch request of addresses or lat longs that should be geocoded. The
 * callback will be called as results come in, every batchSize results. If
 * batchSize is not specified, it will default to the number of addresses that
 * were requested; meaning that the callback will call only once, when all the
 * addresses have been geocoded.
 */
export class BatchRequest {
  /**
   * A pointer to the next [batchSize] set of addresses that should be returned.
   */
  private requestPointer = 0;

  /**
   * Whether this request was cancelled or not.
   */
  private cancelled = false;

  private readonly requests: AnyDuringMigration[] | string[];
  private readonly responses: Map<string, AnyDuringMigration>;
  private readonly batchsize: number;

  /**
   * @param requests The request objects that should be geocoded.
   * @param callback The function called for set of batchSize results.
   * @param batchSize An optional batch size parameter.
   */
  constructor(
    requests: AnyDuringMigration[] | string[], //
    private readonly callback: Function, //
    batchSize?: number,
  ) {
    /**
     * An array of the addresses that this request cares about.
     */
    this.requests = requests || [];

    /**
     * A map of serialized request object to returned response.
     */
    this.responses = new Map();

    /**
     * The frequency at which batches should be returned.
     */
    this.batchsize = batchSize || this.requests.length;
  }

  /**
   * @return The request objects that should be
   *     geocoded.
   */
  getRequests(): AnyDuringMigration[] | string[] {
    return this.requests;
  }

  /**
   * @return Whether this request was cancelled or not.
   */
  isCancelled(): boolean {
    return this.cancelled;
  }

  /**
   * Cancel this request.
   */
  cancel() {
    this.cancelled = true;
  }

  /**
   * The function that should be called when the result of a request is
   * returned. If the accumulated number of requests (in order) is greater than
   * or equal to the batch size, the callback will be fired with batchSize
   * responses.
   * @param request The request that has been completed.
   * @param response The geocoding response for the request.
   */
  finish(request: AnyDuringMigration | string, response: AnyDuringMigration) {
    const serializedRequest = stringify(request);
    if (!this.responses.has(serializedRequest)) {
      this.responses.set(serializedRequest, response);
    }
    const batchedResponses = [];
    if (!this.cancelled) {
      // Iterate over all the requests from the current request pointer until we
      // hit one that doesn't yet have a response.
      const size = this.requests.length;
      for (let i = this.requestPointer; i < size; i++) {
        const addr = stringify(this.requests[i]);
        if (!this.responses.has(addr)) {
          break;
        }
        let res = this.responses.get(addr);
        if (res != null) {
          res = res.response;
        }
        batchedResponses.push(res);
      }
      // If the number of responses is less than the batch size (and it's not
      // just because it's the last batch), return. We will return all the
      // responses as one batch next time this is called.
      if (
        batchedResponses.length < this.batchsize &&
        this.requestPointer + batchedResponses.length < size
      ) {
        return;
      }
      this.requestPointer += batchedResponses.length;
      this.callback(batchedResponses);
      if (this.requestPointer >= this.requests.length) {
        this.cancel();
      }
    }
  }
}

/**
 * A collection of geocoding requests. Mainly used for the ability to cancel all
 * of them at once.
 */
export class RequestGroup {
  private requests: BatchRequest[] = [];

  /**
   * The geocoder instance that should be used for requests.
   */
  private geocoder: BatchGeocoder | null = null;

  /**
   * Adds a geocoding request to the pool.
   * @param request The request that
   *     should be added.
   */
  add(request: BatchRequest) {
    this.requests.push(request);
  }

  /**
   * Create and fire a geocoding requests for the given set of maps requests
   * (string, address, or latlong).
   * @param requests The geocoding requests.
   * @param callback The callback that should be fired every batchSize
   *     responses.
   * @param batchSize The batch size.
   * @param key The mapsApiKey to use.
   */
  create(
    requests: string[] | AnyDuringMigration[],
    callback: Function,
    batchSize?: number,
    key?: string,
  ) {
    if (this.geocoder != null) {
      const request = new BatchRequest(requests, callback, batchSize);
      this.add(request);
      this.geocoder.geocodeBatch(request);
    } else {
      const afterLoadCallback = (options = {}) => {
        // AnyDuringMigration because:  Property 'disableMapsApi' does not exist
        // on type '{}'.
        if (options && (options as AnyDuringMigration).disableMapsApi) {
          // Return without geocoding if the maps API is disabled.
          return;
        }
        if (this.geocoder == null) {
          // AnyDuringMigration because:  Property 'getInstance' does not exist
          // on type 'typeof BatchGeocoder'.
          this.geocoder = (BatchGeocoder as AnyDuringMigration).getInstance();
        }
        this.create(requests, callback, batchSize);
      };
      BatchGeocoder.loadMapsApi(afterLoadCallback, key);
    }
  }

  /**
   * Cancels all the geocoding requests.
   */
  cancel() {
    this.requests.forEach((request) => {
      request.cancel();
    });
    this.requests = [];
  }
}
