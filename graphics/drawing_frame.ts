/**
 * @fileoverview Drawing frame builds a renderer inside a given container.
 *
 * @license
 * Copyright 2024 Google LLC
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

import {setState} from '@npm//@closure/a11y/aria/aria';
import {forEach} from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {Disposable} from '@npm//@closure/disposable/disposable';
import {dispose} from '@npm//@closure/disposable/dispose';
import {
  DomHelper,
  getDomHelper,
  removeChildren,
} from '@npm//@closure/dom/dom';
import {randomInt} from '@npm//@closure/math/math';
import {Size} from '@npm//@closure/math/size';
import {compareVersions} from '@npm//@closure/string/string';
import {
  setPosition,
  setSize,
  setStyle,
} from '@npm//@closure/style/style';
import {
  EDGE,
  GECKO,
  IE,
  OPERA,
  VERSION,
  WEBKIT,
} from '@npm//@closure/useragent/useragent';

import {html, render} from 'lit-html';
import {AnyCallbackWrapper} from '../common/async_helper';
import {AbstractRenderer} from './abstract_renderer';
import {BrowserRenderer} from './browser_renderer';
import {setReferencePoint} from './cursor_position';
import {OverlayArea} from './overlay_area';
import {SvgRenderer} from './svg_renderer';

/**
 * Drawing frame builds a renderer inside a given container. This
 * class is responsible for choosing the right renderer (svg/canvas),
 * based on the user agent, and wrapping it in an iframe if needed.
 * A user of the drawing frame can get the renderer by supplying a callback to
 * the 'getRenderer' method. If the browser is not supported, displays an error
 * message in the given container.
 */
export class DrawingFrame extends Disposable {
  /** The id of the chart's frame. */
  private readonly frameId: string;

  /**
   * The user-handed container DOM element. This is the element that
   * everything will be stored in. We will create another div that we will
   * treat as the actual container, as we shouldn't modify the user's
   * container beyond just adding children to it.
   */
  private readonly userContainer: Element;

  /** A DOM helper for accessing and manipulating the container's document. */
  private readonly domHelper: DomHelper;

  /**
   * A DOM element in which rendering will happen. Defaults to the main body.
   * Note that the container may belong to a different frame than the one in
   * which the code was loaded.
   */
  protected container: Element;

  /**
   * There's a div for each renderer, and this div (renderersDiv) is the
   * container for all of them. We need a container div to hold them all
   * because the per-renderer divs are created lazily, and we want to ensure
   * that they are all behind the div that belongs to the overlay area, and
   * hence the overlay area is always the frontmost.
   */
  protected renderersDiv: HTMLElement | null = null;

  /** A div used for measuring text size. */
  private textMeasurementDiv: Element | null = null;

  /**
   * Whether the drawing frame is ready to provide renderers and overlay area.
   */
  private isReady = false;

  /** All renderers under this drawing frame. */
  private readonly renderers: AbstractRenderer[] = [];

  /**
   * A DOM element to which htmls that are placed above the chart such as
   * tooltips can be added.
   */
  private overlayArea: OverlayArea | null = null;

  private readonly rendererCtor: new (
    container: Element,
    textMeasurementDiv: Element,
  ) => BrowserRenderer;

  /**
   * Should we use an iFrame or not. We choose this according to the input
   * parameter and if the browser supports it.
   */
  private readonly useIFrame: boolean;

  /**
   * Wrapper around a renderer and its containing frame.
   * @param container A DOM element in which rendering will happen.
   *     TODO(dlaliberte): This should be an HTMLElement.
   * @param dimensions Dimension of the created frame.
   * @param asyncWrapper A function that accepts a callback and wraps it for async execution.
   * @param forceIFrame If false, we will avoid using an iFrame
   *     if the browser supports it (i.e. it supports SVG).
   */
  constructor(
    container: Element,
    protected dimensions: Size | null,
    asyncWrapper: AnyCallbackWrapper,
    forceIFrame: boolean,
  ) {
    super();
    const isSupported = DrawingFrame.isBrowserSupported();
    if (!isSupported) {
      throw new Error('Graphics is not supported');
    }

    this.frameId = DrawingFrame.generateFrameId();

    this.userContainer = container;
    setReferencePoint(this.userContainer);
    // Clear the content of the container.
    removeChildren(this.userContainer);

    this.domHelper = getDomHelper(this.userContainer);

    this.container = this.domHelper.createElement('div');
    (this.container as HTMLElement).style.position = 'relative';
    this.userContainer.appendChild(this.container);

    // Rendering implementor type, depends on the browser.
    this.rendererCtor = SvgRenderer;

    this.useIFrame = forceIFrame;

    // We start the process of creating the iFrame if needed.
    if (this.useIFrame) {
      this.createDrawingIframe();
    }
    // Initialize the renderer once the frame is fully loaded.
    this.waitUntilFrameReady(asyncWrapper);
  }

  /**
   * Waits until the iframe is ready (this.isFrameReady), possibly
   * asynchronously, and then executes this.onFrameReady.
   * @param asyncWrapper A function that accepts a callback and wraps it for async execution.
   */
  private waitUntilFrameReady(asyncWrapper: AnyCallbackWrapper) {
    const isFrameReady = this.isFrameReady.bind(this);
    const onFrameReady = this.onFrameReady.bind(this);
    const forceAsync = false;
    // Set forceAsync to true to force asynchronous behavior. This is useful to
    // test asynchronous behavior, because most modern browsers create the
    // iframe synchronously.
    if (forceAsync) {
      DrawingFrame.waitForConditionAsync(
        isFrameReady,
        onFrameReady,
        asyncWrapper,
      );
    } else {
      DrawingFrame.waitForCondition(isFrameReady, onFrameReady, asyncWrapper);
    }
  }

  /**
   * Called once the frame is ready, and continues creating what needs to
   * created (renderer and overlay area).
   */
  private onFrameReady() {
    // If there is an iFrame, the renderers div is the main div inside it.
    // Otherwise it is a div that is an immediate child of the container
    // alongside the overlay html element that is the other child of the
    // container.
    if (this.useIFrame) {
      const iFrameDoc = this.getIFrameDocument();
      assert(iFrameDoc.body != null);
      this.renderersDiv = iFrameDoc.getElementById('renderers') as HTMLElement;
      setReferencePoint(this.renderersDiv);
      this.textMeasurementDiv = DrawingFrame.createTextMeasurementDiv(
        iFrameDoc.body,
        this.dimensions,
      );
    } else {
      this.renderersDiv = this.domHelper.createElement('div') as HTMLElement;
      setStyle(this.renderersDiv, 'position', 'relative');
      if (this.dimensions) {
        setSize(this.renderersDiv, this.dimensions);
      }
      this.renderersDiv.dir = 'ltr';
      this.container.appendChild(this.renderersDiv);
      this.textMeasurementDiv = DrawingFrame.createTextMeasurementDiv(
        this.container,
        this.dimensions,
      );
    }
    this.isReady = true;
  }

  /**
   * Creates the text measurement div.
   * @param parent The parent element of the text measurement div.
   * @param dimensions Dimensions used to calculate area for new div.
   * @return New element, already added to parent, or null if dimensions is null.
   */
  static createTextMeasurementDiv(
    parent: Element,
    dimensions: Size | null,
  ): Element {
    assert(parent != null);

    const domHelper = getDomHelper(parent);
    const textMeasurementDiv = domHelper.createElement('div');
    // Position the div outside of visible area.
    const style = textMeasurementDiv.style;
    const top = dimensions ? dimensions.height + 10 : 0;
    const left = dimensions ? dimensions.width + 10 : 0;
    style.display = 'none';
    style.position = 'absolute';
    style.top = `${top}px`;
    style.left = `${left}px`;
    style.whiteSpace = 'nowrap';
    setState(textMeasurementDiv, 'hidden', true);
    textMeasurementDiv.setAttribute('aria-hidden', true);
    domHelper.appendChild(textMeasurementDiv, domHelper.createTextNode(' '));
    domHelper.appendChild(parent, textMeasurementDiv);
    return textMeasurementDiv;
  }

  /**
   * Creates the renderer. Should be called once the frame is ready.
   * @param isAbsolute Whether to use relative or absolute positioning. Default is true.
   */
  private createRenderer(isAbsolute = true) {
    const domHelper = getDomHelper(this.renderersDiv);
    const div = domHelper.createElement('div');
    if (isAbsolute) {
      // We want absolute renderers to overlap each other (be completely one
      // above the other), so we set their position style to 'absolute', and
      // their size to 100%. This is how you create overlapping divs in CSS.
      setStyle(div, 'position', 'absolute');
      setPosition(div, 0, 0);
    }
    setSize(div, '100%', '100%');
    this.renderersDiv!.appendChild(div);

    assert(this.textMeasurementDiv != null);
    const renderer = new this.rendererCtor(div, this.textMeasurementDiv!);
    this.registerDisposable(renderer);
    this.renderers.push(renderer);
  }

  /** Creates the overlay area. */
  private createOverlayArea() {
    let element;
    element = this.domHelper.createElement('div');
    this.overlayArea = new OverlayArea(element);
    this.domHelper.appendChild(this.container, this.overlayArea.getContainer());
  }

  /**
   * Returns true iff the frame is constructed. Condition is set by the code
   * embedded in the iframe.
   * @return True iff the frame is constructed.
   */
  private isFrameReady(): boolean {
    if (!this.useIFrame) {
      // If we do not use an iFrame, no need to wait.
      return true;
    }

    const iframeWindow = this.getIFrameWindow();
    if (iframeWindow) {
      // Check if iframe is loaded.
      const iframeDoc = this.getIFrameDocument();
      return (
        iframeDoc.readyState === 'complete' &&
        iframeDoc.body != null &&
        iframeDoc.getElementById('renderers') != null
      );
    }

    return false;
  }

  /**
   * Returns the renderer. If the drawing is ready to provide renderers, the
   * requested renderer is lazily created (created on first request).
   * @param index The index of the requested renderer. Higher index means higher z-order.
   * @param isAbsolute Whether to use relative or absolute positioning. Default is true.
   * @return The renderer if ready, null if not.
   */
  getRenderer(index?: number, isAbsolute = true): AbstractRenderer | null {
    if (!this.isReady) {
      return null;
    }
    index = index != null ? index : 0;
    while (this.renderers.length <= index) {
      this.createRenderer(isAbsolute);
    }
    return this.renderers[index];
  }

  /**
   * Returns the overlay area. If the drawing is ready to provide the overlay
   * area, the overlay area is lazily created (created on first request).
   * @return The overlay area if ready, null if not.
   */
  getOverlayArea(): OverlayArea | null {
    if (!this.isReady) {
      return null;
    }
    if (!this.overlayArea) {
      this.createOverlayArea();
    }
    return this.overlayArea;
  }

  /**
   * Used for waiting until the drawing frame (with its renderer/overlay area)
   * is ready . Either calls the callback immediately (synchronously) if it's
   * already ready, or asynchronously, once it's ready.
   * @param callback Called once it is ready to get the renderer/ overlay area.
   * @param asyncWrapper A function that accepts a callback and wraps it for async execution.
   */
  waitUntilReady(callback: () => void, asyncWrapper: AnyCallbackWrapper) {
    DrawingFrame.waitForCondition(
      () => {
        return this.renderersDiv != null;
      },
      callback,
      asyncWrapper,
    );
  }

  /**
   * Updates the drawing frame with new dimensions.
   * This doesn't do anything if we are not using an iFrame as the div will
   * adjust its size automatically. If the drawing frame is not ready - creation
   * of the iframe was canceled - create the iframe now.
   * @param dimensions Dimension of the created frame.
   * @param asyncWrapper A function that accepts a callback and wraps it for async execution.
   */
  update(dimensions: Size | null, asyncWrapper: AnyCallbackWrapper) {
    if (dimensions != null && !Size.equals(this.dimensions, dimensions)) {
      this.dimensions = dimensions;

      if (this.useIFrame) {
        const frame = this.getIFrame();
        if (frame) {
          frame.width = this.dimensions.width.toString();
          frame.height = this.dimensions.height.toString();
        }
      } else if (this.isReady) {
        setSize(this.renderersDiv, this.dimensions);
      }
    }
    if (!this.isReady) {
      this.waitUntilFrameReady(asyncWrapper);
    }
  }

  /**
   * Returns a unique id for the frame.
   * @return A unique id for the frame.
   */
  private static generateFrameId(): string {
    // We need to make sure to find an unused id.
    let chartId = randomInt(100000);
    // tslint:disable-next-line:ban-types  To allow keyword access.
    while ((window.frames as AnyDuringMigration)[`Drawing_Frame${chartId}`]) {
      chartId++;
    }
    return `Drawing_Frame${chartId}`;
  }

  /**
   * Returns the IFrame Document for this chart.
   * @return The IFrame Document for this chart. Null is returned if no iframe was created yet.
   */
  private getIFrameDocument(): Document {
    const iframe = this.getIFrame();
    if (!iframe) {
      throw new Error('No iframe');
    }
    return this.domHelper.getFrameContentDocument(iframe);
  }

  /**
   * Returns the IFrame Window for this chart.
   * @return The IFrame Window for this chart. Null is returned if no iframe was created yet.
   */
  private getIFrameWindow(): Window | null {
    const iframe = this.getIFrame();
    return iframe ? this.domHelper.getFrameContentWindow(iframe) : null;
  }

  /**
   * Returns the iframe element for this chart.
   * @return The iframe element for this chart.
   */
  private getIFrame(): HTMLIFrameElement {
    const elem = this.domHelper.getElement(this.frameId);
    return elem as HTMLIFrameElement;
  }

  /**
   * Create the visual element (iframe) for the graphics.
   * IFrames are used because SVG require that the page header have some
   * special attributes, and we do not want to force each application to have
   * these attributes.
   */
  private createDrawingIframe() {
    const width = this.dimensions
      ? `${this.dimensions.width.toString()}px`
      : '';
    const height = this.dimensions
      ? `${this.dimensions.height.toString()}px`
      : '';

    const drawingFrameIframe = html` <iframe
      name="${this.frameId}"
      id="${this.frameId}"
      type="image/svg+xml"
      frameborder="0"
      scrolling="no"
      marginheight="0"
      marginwidth="0"
      width="${width}"
      height="${height}"
      allowTransparency="true"
      srcdoc='<?xml version="1.0"?>
      <html
        xmlns="http://www.w3.org/1999/xhtml"
        xmlns:svg="http://www.w3.org/2000/svg"
        xmlns:xlink="http://www.w3.org/1999/xlink">
        <head></head>
        <body marginwidth="0" marginheight="0" style="background:transparent">
          <div id="renderers"></div>
        </body>
      </html>'>
    </iframe>`;

    render(drawingFrameIframe, this.container);
  }

  /**
   * Static function to check if browser is supported.
   *
   * @return True if the browser is supported.
   */
  private static isBrowserSupported(): boolean {
    const version = VERSION;
    if (IE) {
      return compareVersions(version, '9') >= 0;
    }
    if (GECKO) {
      return compareVersions(version, '1.8') >= 0;
    }
    if (OPERA) {
      return compareVersions(version, '9.0') >= 0;
    }
    if (WEBKIT) {
      return compareVersions(version, '420+') >= 0;
    }
    // All versions of Microsoft Edge are supported.
    return EDGE;
  }

  /**
   * Waits till a condition is satisfied and then calls a given callback
   * function. If the condition is satisfied immediately, the callback is called
   * immediately (synchronously). Otherwise, asyncWrapper is applied. Works in
   * intervals, polling to check if condition is satisfied each time.
   * @param condition The condition function.
   * @param callback The callback function.
   * @param asyncWrapper A function that accepts a callback and wraps it for async execution.
   * @param interval The polling interval. Defaults to 10ms.
   */
  static waitForCondition(
    condition: () => boolean,
    callback: () => void,
    asyncWrapper: AnyCallbackWrapper,
    interval?: number,
  ) {
    // Suppressing errors for ts-migration.
    //   TS2555: Expected at least 1 arguments, but got 0.
    // tslint:disable-next-line:ban-ts-suppressions
    // @ts-ignore
    if (condition.call()) {
      // Suppressing errors for ts-migration.
      //   TS2555: Expected at least 1 arguments, but got 0.
      // tslint:disable-next-line:ban-ts-suppressions
      // @ts-ignore
      callback.call();
      return;
    }

    DrawingFrame.waitForConditionAsync(
      condition,
      callback,
      asyncWrapper,
      interval,
    );
  }

  /**
   * Similar to waitForCondition, but always calls the callback asynchronously,
   * even if the condition is already met.
   * @param condition The condition function.
   * @param callback The callback function.
   * @param asyncWrapper A function that accepts a callback and wraps it for async execution.
   * @param interval The polling interval. Defaults to 10ms.
   */
  static waitForConditionAsync(
    condition: () => boolean,
    callback: () => void,
    asyncWrapper: AnyCallbackWrapper,
    interval?: number,
  ) {
    interval = interval != null ? interval : 10;
    setTimeout(
      asyncWrapper(() => {
        DrawingFrame.waitForCondition(
          condition,
          callback,
          asyncWrapper,
          interval,
        );
      }),
      interval,
    );
  }

  /**
   * Dispose a drawing frame.
   * Remove the renderer, its associated frame, and any memory allocated for it.
   * Note that the drawing frame is useless after this call.
   */
  override disposeInternal() {
    try {
      this.domHelper.removeChildren(this.userContainer);
      dispose(this.overlayArea);
      forEach(this.renderers, (renderer) => {
        dispose(renderer);
      });
    } catch (e) {}
    // Ignore exceptions from removeChildren et al as they are often the
    // result of access denied in IE8 and lower due to iframe shenanigans.
    // TODO(dlaliberte): Possibly do something with this result.
    super.disposeInternal();
  }
}
