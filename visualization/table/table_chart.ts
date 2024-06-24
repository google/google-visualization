/**
 * @fileoverview An html table visualization.
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

import * as googArray from '@npm//@closure/array/array';
import {assert} from '@npm//@closure/asserts/asserts';
import {assertIsElement} from '@npm//@closure/asserts/dom';
import {dispose} from '@npm//@closure/disposable/dispose';
import {
  add,
  addAll,
  contains,
  remove,
  removeAll,
  set,
} from '@npm//@closure/dom/classlist';
import {
  DomHelper,
  removeChildren,
} from '@npm//@closure/dom/dom';
import {TagName} from '@npm//@closure/dom/tagname';
import {BrowserEvent} from '@npm//@closure/events/browserevent';
import {EventHandler} from '@npm//@closure/events/eventhandler';
import {EventType} from '@npm//@closure/events/eventtype';
import {KeyCodes} from '@npm//@closure/events/keycodes';
import {
  clone,
  forEach,
} from '@npm//@closure/object/object';
import {
  isEmptyOrWhitespace,
  isNumeric,
  makeSafe,
  trim,
} from '@npm//@closure/string/string';
import * as style from '@npm//@closure/style/style';
import {ButtonSide} from '@npm//@closure/ui/buttonside';
import {Component} from '@npm//@closure/ui/component';
import {ControlContent} from '@npm//@closure/ui/controlcontent';
import {CustomButton} from '@npm//@closure/ui/custombutton';
import {
  GECKO,
  IE,
  MAC,
  VERSION,
} from '@npm//@closure/useragent/useragent';
import {safeElement} from '@npm//@safevalues/dom';

import {AnyCallbackWrapper} from '../../common/async_helper';
import {Options, UserOptions} from '../../common/options';
import {Selection} from '../../common/selection';
import {AbstractDataTable} from '../../data/abstract_datatable';
import {DataView} from '../../data/dataview';
import {getDomHelper} from '../../dom/dom';
import * as events from '../../events/events';
import {NumberFormat} from '../../format/numberformat';
import {DynamicLoading as VisCommon} from '../../loader/dynamic_loading';
import {AbstractVisualization} from '../../visualization/abstract_visualization';

import {PageManager, SortInfo} from './page_manager';
import {TableRow} from './table_row';

const {getSafeHtml, getSafeStyle} = VisCommon;
const {trigger} = events;

const {A, DIV, SPAN, TABLE, TBODY, TD, TH, THEAD, TR} = TagName;
const {CLICK, KEYPRESS, MOUSEDOWN, MOUSEOUT, MOUSEOVER, SCROLL} = EventType;

// tslint:disable:ban-types  Migration
// tslint:disable:ban-ts-suppressions

/**
 * Constructs a new table. The table is rendered by the draw method.
 * Expected data format:
 *   Anything goes
 * Supported options:
 *   allowHtml {boolean} If true, allows HTML in the displayed value
 *       (default=false).
 *   allowHtmlSafely {boolean} (default=false, undocumented)
 *   sanitizeHtml {boolean} If used together with allowHtml, will sanitize HTML
 *       to prevent script execution before rendering. (default=false).
 *   keepScrollPosition {boolean} Preserve the scroll position between redraws.
 *       (default=false)
 *   scrollTransition {string} Whether to show css transition of frozen
 *       column and row headers when scrolling.  (default=disable, undocumented)
 *   firstRowNumber {number} The row number for the first row in the
 *       table UI (default=1). Shown only if showRowNumber is true.
 *   showRowNumber {boolean} If true, shows the row number (default=false).
 *   sort {string} enable/event/disable (default=enable). 'enable' means that
 *       the sorting will be done by the table visualization,
 *       and that a 'sort' event will be triggered after sorting.
 *       'event' means that when a user clicks on a column header,
 *       a 'sort' event will be fired but no actual sorting will be performed
 *       by the table, assuming that the application that listens on the
 *       'sort' event will do the sorting.
 *       'disable' means that headers are not clickable and users can not sort.
 *   startPage {number} The first table page to display (default=0).
 *   page {string} enable/event/disable (default=disable). 'enable' means
 *       that the pagination will be done by the table visualization,
 *       and that a 'page' event will be triggered after pagination.
 *       'event' means that when a user clicks on a pagination button,
 *       a 'page' event will be fired but no actual pagination will be
 *       performed by the table, assuming that the application that listens on
 *       the 'page' event will do the paging.
 *       'disable' means that no pagination buttons appear and the user cannot
 *       switch pages.
 *   pageSize {number} Relevant only when the page option is 'enable'/'event'.
 *       If positive makes the table show pages with the specified number of
 *       rows at each page.  Number of pages will be computed from the pageSize.
 *       (default=10)
 *   pagingButtons {string} both/prev/next/auto/<number>
 *      Was pagingButtonsConfiguration.  The options are as follows:
 *       both - enable prev and next buttons
 *       prev - only prev button is enabled
 *       next - only next button is enabled
 *       auto - the buttons are enable according to the current page, on the
 *           first page only next, on the last page only prev and otherwise
 *           both are enabled.  (default=auto)
 *       number - the number of paging buttons to show.  Implies auto for the
 *           next and prev buttons.  This explicit number will override computed
 *           number from pageSize.
 *   pagingSymbols {Object} An object with the following properties
 *       {'prev': prevSymbol, 'next': nextSymbol}. The symbols
 *       would show as the paging buttons values.
 *       Only relevant when paging is enabled and when. If allowHtml=true the
 *       symbol can contain html content otherwise it would be treated as text.
 *       If images are provide the buttons enable/disable appearance may vary.
 *       (default=right and left arrow images).
 *   width {string} Width property of generated table (e.g. '100pt'). If
 *       not specified, the browser will set the width automatically. If
 *       numeric value is specified - pixels units would be assumed.
 *   height {string} Height property of generated table (e.g. '50cm'). If
 *       not specified, the browser will set the height automatically If.
 *       numeric value is specified - pixels units would be assumed.
 *   sortColumn {number} Specifies a column (index) in the data by which the
 *       data should be sorted. The column would also be marked with a small
 *       arrow indicating its sort order, next to the column's header. The
 *       column numbers are zero based {0, 1, ...}.
 *   sortAscending {boolean} (default=true) The order in which the sort column
 *       is sorted. True for ascending, false for descending.
 *   scrollLeftStartPosition {number} If a scroll bar is showing sets its
 *       scroll left start position (default=0).
 *   alternatingRowStyle {boolean} (default=true) Determines if alternating
 *       style will be assigned to odd and even rows.
 *   frozenColumns {number} The number of frozen columns (default=-1).
 *       -1 : no frozen columns
 *        0 : only row numbers (if exist)
 *        x : (0 < x < num cols) x frozen columns along with row number column
 *            if one exists.
 *        Frozen columns will appear only if the table is added with a
 *        horizontal scroll bar.
 *   frozenColumnsBackground {string} The background color of the frozen
 *       columns (default='#fafafa').
 *       TODO(dlaliberte): not supported.
 *   rtlTable {boolean} Show the table in right-to-left directionality
 *       only works for the simple html table case - no scrollPane nor paging
 *       (default=false).
 *       TODO(dlaliberte): remove limitations for rtl table.
 *   cssClassNames {Object} A map of css class names to use for styling the
 *       table, e.g., {'headerRow': 'my-header-row-class-name'}.
 *       For specific styling use row and cell custom properties.
 *       Supported table elements:
 *         headerRow - css class name for the table header row ('tr').
 *         tableRow - css class name for a table row ('tr').
 *         oddTableRow - css class name for an odd table header row ('tr').
 *             Applicable only if alternatingRowStyle is true ('tr').
 *         selectedTableRow - css class name for a selected table row ('tr').
 *         hoverTableRow - css class name for a hovered table row ('tr').
 *         headerCell - css class name for a header row cell ('td').
 *         tableCell - css class name for a table cell ('td').
 *         rowNumberCell - css class name for a row number cell.
 *             Only applicable if showRowNumber is true ('td').
 *   useHeaderClickCapture {boolean} Whether to register the sort handler in
 *       the capture phase (if true) or the bubble phase (if false).
 * Supported (dataTable) custom properties:
 *    Row:
 *      rowColor {string} A color for the row. Note: will affect the row even
 *           when it is clicked or mouse hovered.
 *    Cell:
 *      className {string} A name of a css class to assign to the specified
 *          table cell. The class replaces any other default class otherwise
 *          assigned to the cell.
 *      style {string} A style string to assign to the specified table
 *          cell. Requires the allowHtml option set to true.
 * Events:
 *     select - Thrown when a table row is (un)selected.
 *         Event parameters are {}.
 *     ready - Thrown when the chart has finished rendering.
 *         Event parameters are null.
 *     page - Thrown when a next/prev button is clicked.
 *         Event parameters are {'page': number}.
 *     sort - Thrown when a table column header is clicked.
 *         Event parameters are {'column': number, 'ascending': boolean,
 *            'sortedIndexes': Array<number> }
 * @unrestricted
 */
export class Table extends AbstractVisualization {
  /**
   * A flag to indicate that this table instance is rendering for the first
   * time.
   * @see Table.prototype.waitForCss
   */
  private firstTimeRendered = true;

  /** A div on which we check if the table css file was loaded. */
  private checkCssLoadedDiv: Element | null = null;

  /**
   * Arrays of CSS class names used in the table visualization.
   * If names are specified by the user in options['cssClassNames'], these names
   * are used otherwise the names are taken from
   * CSS_DEFAULT.
   *
   * Note: The names are set in setCustomClassNames after each call to draw()
   * with the passed options.
   */
  private cssClassNames: {[key: string]: string[]} | null = null;

  /**
   * The last selected TableRow (using mouse clicks), by default it is the
   * first row in the current page.
   * @see gviz.PageInfo.getPageRow_.
   */
  private lastSelectedTableRow: TableRow | null = null;

  /** The current data table. */
  private data: AbstractDataTable | null = null;

  /** The current data view, used to maintain row order between sorts. */
  private dataView: DataView | null = null;

  /** The current drawing options. */
  private options: Options | null = null;

  /** The page manager for this table.  Initialized by drawInternal */
  private pageManager!: PageManager;

  /** An array of all the tableRows in the current page. */
  private page: TableRow[] | null = null;

  /**
   * The number of frozen columns. A number x: 0 <= x < number of columns.
   * -1 means no frozen columns.
   */
  private numFrozenColumns: number = -1;

  /** A flag indicating if the data has rows. */
  private hasRows = false;

  /** The paging prev button. Null if paging is disabled. */
  private prevButton: CustomButton | null = null;

  /** The paging next button. Null if paging is disabled. */
  private nextButton: CustomButton | null = null;

  /** The scroll pane left start position */
  private scrollLeftStartPosition = 0;

  /**
   * An event handler using which events are registered and later on cleared.
   */
  private eventHandler: EventHandler | null = null;

  // Table Option Memoizations:
  // These mirror there setting names above and inherit their documentation.

  allowHtml = false;
  allowHtmlSafely = false;
  sanitizeHtml = false;
  showRowNumber = false;
  sort = 'enable';
  useHeaderClickCapture = true;

  // TODO(dlaliberte) Frozen columns - Change default to 0 if bugs are fixed

  /** A dom helper for rendering the html. */
  private readonly dom: DomHelper;

  /**
   * A set of the selected rows. The key is the selected row index, and
   * the value is just set to 1.
   */
  private readonly selectedRows: Selection;

  /** A cache of elements, reused if possible when redrawing. */
  private elementCache: {[key: string]: Element} = {};

  /** The Scroll Pane DIV, containing the table. */
  private scrollPane: Element | null = null;

  /** The Scroll Table, in the scrollPane. */
  private scrollTable: Element | null = null;

  /** The header TR */
  private headerRow: Element | null = null;

  /** The timeout for scrolling. */
  private scrollingTimeout: number | null = null;

  /** The list of THs in the frozen header row. */
  private frozenRowTHs: Element[] | null = null;

  /** The list of TDs in the frozen columns. */
  private frozenColsTDs: Element[] | null = null;

  /** The list of THs in both frozen columns and the header row. */
  private frozenTopLeftTHs: Element[] | null = null;

  /**
   * @suppress {strictMissingProperties} Auto-added to unblock
   * check_level=STRICT
   */
  initialContainerSize: AnyDuringMigration;

  /** @param container The html container to draw in. */
  constructor(container: Element | null) {
    super(container);

    // TODO(dlaliberte) Frozen columns - Change default to 0 if bugs are fixed

    this.dom = getDomHelper();

    this.selectedRows = new Selection();
  }

  drawInternal(
    asyncWrapper: AnyCallbackWrapper,
    dataTable: AbstractDataTable,
    userOptions: UserOptions = {},
    state?: {},
  ) {
    if (!dataTable) {
      throw new Error('Data table is not defined');
    }

    const options = (this.options = new Options([userOptions]));

    // Memoize repeatedly used options:
    this.allowHtml = options.inferBooleanValue('allowHtml', false);
    this.allowHtmlSafely = options.inferBooleanValue('allowHtmlSafely', false);
    this.sanitizeHtml = options.inferBooleanValue('sanitizeHtml', false);
    this.showRowNumber = options.inferBooleanValue('showRowNumber', false);
    this.sort = options.inferStringValue('sort', 'enable');
    this.useHeaderClickCapture = options.inferBooleanValue(
      'useHeaderClickCapture',
      true,
    );

    // Clear the selection object.
    this.selectedRows.clear();

    this.data = dataTable;
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'AbstractDataTable | null' is not assignable
    //   to parameter of type 'AbstractDataTable'.
    // @ts-ignore
    this.dataView = new DataView(this.data);

    this.pageManager = new PageManager(this.dataView, this.options, this.sort);

    this.hasRows = this.data.getNumberOfRows() > 0;
    if (this.hasRows) {
      const startPage = options.inferOptionalNumberValue('startPage');
      if (startPage) {
        this.pageManager.setPageIndex(startPage);
      }

      // If sort is not disabled and a sort column was given, store it in the
      // page manager.
      const sortColumn = options.inferOptionalNumberValue('sortColumn');
      if (this.sort !== 'disable' && sortColumn != null) {
        const sortAscending = options.inferBooleanValue('sortAscending', true);
        // The pageManager keeps record of the sortColumn and its order. The
        // actual sorting however would be performed only if local sort is
        // enabled (@see pagemanager.js).
        this.pageManager.setSort(sortColumn, !sortAscending);
      }

      this.lastSelectedTableRow = this.pageManager.getFirstTableRowInPage();
    }

    // The scroll pane start position (if there is a scroll page), can be set
    // by the user, a wrapper or after operations such as sort and page.
    this.scrollLeftStartPosition = options.inferNumberValue(
      'scrollLeftStartPosition',
      0,
    );

    this.numFrozenColumns = Math.max(
      -1,
      options.inferNumberValue('frozenColumns', -1),
    );

    this.cssClassNames = clone(CSS_DEFAULT);

    // This should be at the end of the draw method as it may redraw.
    this.setupCss();
  }

  /** Triggers a 'ready' for the table */
  private triggerReadyEvent() {
    trigger(this, 'ready', null);
  }

  /**
   * Returns an object with the current table sort information. The object has
   * the following properties:
   * 'column': column index of the sort column
   * 'ascending': a flag indicating the sort order
   * 'sortedIndexes' : a map from ui row indexes to data row indexes.
   * When there is no sort the info is:
   *     {'column': -1, 'ascending': true, 'sortedIndexes': null}
   * Note: If the method is called before draw() a null is returned.
   * @see gviz.datautil.getSortedRows.
   * @return Object that holds 'column', 'ascending', and 'sortedIndexes'.
   */
  getSortInfo(): SortInfo | null {
    if (this.pageManager) {
      return this.pageManager.getSortInfo();
    } else {
      return null;
    }
  }

  /**
   * Redraws the table in the given container.
   * @param reuseElements Whether to use the previous elements.
   */
  private redraw(reuseElements?: boolean) {
    const options = this.options;
    const dom = this.dom;

    if (!reuseElements) {
      // Clear the old chart and cache.
      this.clear();

      this.initialContainerSize = style.getContentBoxSize(this.container);
    }

    // TODO(dlaliberte): Some redraws might be able to reuse same page.
    this.page = null; // trigger calculation of a new page

    // Initialize the event handler.
    if (!this.eventHandler) {
      this.eventHandler = new EventHandler();
    }

    // Decide whether to create frozen columns.  When showRowNumber is true,
    // then the row number column index is effectively -1, so we can freeze all
    // the rest of the columns by specifying numFrozenColumns: 0.
    const numFrozenColumns = this.numFrozenColumns;

    let width = options!.inferStringValue('width', '');
    let height = options!.inferStringValue('height', '');
    // Maybe fix height greater than '100%', which is effectively ignored.

    // Get the content element that holds the main table and other panes,
    // and is where scrolling happens.
    let contentElement = this.elementCache[ElementName.CONTENT];
    if (!contentElement) {
      contentElement = dom.createDom(DIV, {
        'class': 'google-visualization-table', // The following style is necessary
        // to create new stacking context.
        'style': 'position:relative; z-index:0',
      });
      this.elementCache[ElementName.CONTENT] = contentElement;
      dom.appendChild(this.container, contentElement);
    }

    // Hide the content element. After all manipulations are finished,
    // visibility will be restored.
    style.setStyle(contentElement, {
      'visibility': 'hidden',
      'max-width': '100%',
      'max-height': '100%',
    });

    if (width) {
      width = Table.addUnitsIfRequired(width);
      style.setStyle(contentElement, {'width': width});
    }

    // Height must be handled differently from width. Only set if non-zero and
    // set it after width so content wrapping is done, which affects height.
    if (height) {
      height = Table.addUnitsIfRequired(height);
      // Remember to not do this here:
      // goog.style.setStyle(contentElement, {'height': height});
    }

    // Create or update the scroll pane which contains the whole table
    const scrollPane = (this.scrollPane =
      this.updateScrollPane(contentElement));
    const scrollTable = (this.scrollTable = dom.getElementsByTagNameAndClass(
      'table',
      null,
      scrollPane,
    )[0]);

    // Get current position, if any.
    const keepScrollPosition = options!.inferBooleanValue(
      'keepScrollPosition',
      false,
    );
    let scrollLeft = this.scrollLeftStartPosition;
    let scrollTop = 0;
    if (keepScrollPosition && this.scrollPane) {
      scrollLeft = this.scrollPane.scrollLeft;
      scrollTop = this.scrollPane.scrollTop;
    }

    style.setStyle(scrollPane, {
      // Don't set the height here.  Conditionally set below.
      'overflow': 'auto',
      'max-width': '100%',
      'max-height': '100%',
    });

    const absoluteHeight = height && height.toString().indexOf('%') === -1;

    // For explicit width option, set everything.
    if (width) {
      style.setStyle(contentElement, {'width': width});
      style.setStyle(scrollPane, {'width': '100%'});
      style.setStyle(scrollTable, {'width': '100%'});
    }

    // For explicit height option, maybe set everything.
    if (height) {
      style.setStyle(contentElement, {'height': height});
      let wrapperHeight = height;
      // For percentage height, use table wrapper height of 100%.
      if (height.toString().indexOf('%') > -1) {
        wrapperHeight = '100%';
      }
      style.setStyle(scrollPane, {'height': wrapperHeight});
      style.setStyle(scrollTable, {'height': wrapperHeight});
    }

    if (!height && this.initialContainerSize['height'] > 0) {
      const contentHeight = style.getContentBoxSize(contentElement).height;
      const scrollPaneHeight = style.getContentBoxSize(scrollPane).height;
      if (contentHeight < scrollPaneHeight) {
        style.setStyle(contentElement, {'height': '100%'});
      }
      style.setStyle(scrollPane, {'height': '100%'});
    }

    // Clear cache of frozen cells.
    this.frozenRowTHs = null;

    // Update the scrollPane one time when first drawing.
    this.handleScroll();

    // Add paging controls.
    if (this.pageManager.getPagingEnabled()) {
      let pagingElement = this.elementCache[ElementName.PAGING_CONTROLS];
      if (!pagingElement) {
        pagingElement = dom.createDom(DIV);
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'PAGE_DIV' comes from an index signature, so it
        //   must be accessed with ['PAGE_DIV'].
        // @ts-ignore
        addAll(pagingElement, this.cssClassNames!.PAGE_DIV);
        this.elementCache[ElementName.PAGING_CONTROLS] = pagingElement;
        // Create the clear float div.
        const clearFloatDiv = dom.createDom(DIV);
        style.setStyle(clearFloatDiv, {
          'clear': 'both',
          'width': '100%',
          'height': '0px',
        });
        this.elementCache[ElementName.CLEAR_FLOAT] = clearFloatDiv;
      }
      // Get contentElement's offsetHeight with updated paging controls.
      dom.removeChildren(pagingElement);
      style.setStyle(scrollPane, {'height': ''});
      this.updatePagingControls(contentElement);
      const contentHeight = style.getContentBoxSize(contentElement).height;
      const pagingHeight = style.getBorderBoxSize(pagingElement).height;
      const scrollPaneHeight = contentHeight - pagingHeight;
      if (
        scrollPaneHeight > 0 &&
        (this.initialContainerSize['height'] > 0 || absoluteHeight)
      ) {
        // Adjust the scrollPane to fit the contentElement.
        style.setStyle(scrollPane, {'height': `${scrollPaneHeight}px`});
      }
    }

    // Set the table directionality. Not supported in case of frozen columns.
    const rtl = options!.inferBooleanValue('rtlTable', false);
    if (rtl && numFrozenColumns === -1) {
      // Suppressing errors for ts-migration.
      //   TS2339: Property 'style' does not exist on type 'Element'.
      // @ts-ignore
      this.scrollTable!.style.direction = 'rtl';
    }

    // Adjust the scrolling position.
    scrollPane.scrollTop = scrollTop;
    scrollPane.scrollLeft = scrollLeft;

    // Now make the content visible.
    style.setStyle(contentElement, {'visibility': ''});
  }

  /** Handle the scrolling of the scrollPane. */
  private handleScroll(): boolean {
    const scrollPane = this.scrollPane;
    const dom = this.dom;

    // Remember last top and left, to avoid scrolling if not needed.
    let lastTop: AnyDuringMigration;
    let lastLeft: AnyDuringMigration;

    // Check scrollTransition option, default false.
    const scrollTransition =
      this.options!.inferStringValue('scrollTransition', 'disable') ===
      'enable';

    if (scrollTransition) {
      add(scrollPane, 'scrolling');
      remove(scrollPane, 'doneScrolling');
    }

    if (!this.frozenRowTHs) {
      lastTop = 0;
      lastLeft = 0;
      // Get all the frozen row and column cells.
      // These will be repositioned after each scroll event.
      // Suppressing errors for ts-migration.
      //   TS2322: Type 'ChildNode[]' is not assignable to type 'Element[]'.
      // @ts-ignore
      this.frozenRowTHs = googArray.clone(this.headerRow!.childNodes);
      this.frozenColsTDs = googArray.clone(
        dom.getElementsByClass('frozen-column', this.scrollTable),
      );
      if (GECKO) {
        this.frozenTopLeftTHs = [];
        // Firefox does not yet support "position:relative" for table cells,
        // so we need to use "-moz-transform: translate" instead.
        // And for that, we need to separate out the top-left cells.
        // Must iterate over a clone of frozenRowTDs so we can remove items.

        this.frozenRowTHs!.forEach((th) => {
          assertIsElement(th);
          if (contains(th, 'frozen-column')) {
            // Add to TopLeft and remove from frozen Rows and Cols.
            this.frozenTopLeftTHs!.push(th);
            googArray.remove(this.frozenRowTHs, th);
            googArray.remove(this.frozenColsTDs, th);
          }
        });
      }
    }

    const scrollFrozenCells = () => {
      this.scrollingTimeout = null;

      const top = scrollPane!.scrollTop;
      const topPx = `${top}px`;
      const left = scrollPane!.scrollLeft;
      const leftPx = `${left}px`;

      /* TODO(dlaliberte): Try to reduce transition delay. Not very smooth yet.
            var lastScrollUpdate = 0;
            var lastDelay = 200;
            var now = new Date().getTime();
            var rawDelay = Math.max(20, Math.min(200, now - lastScrollUpdate));
            var delay = ((rawDelay + lastDelay) / 2) + 'ms';
            lastDelay = rawDelay;
            lastScrollUpdate = now;
            */

      if (scrollTransition) {
        // Start the transition.
        add(scrollPane, 'doneScrolling');
        remove(scrollPane, 'scrolling');
      }

      if (!GECKO) {
        if (top !== lastTop) {
          this.frozenRowTHs!.forEach((th) => {
            style.setStyle(th, {'top': topPx});
          });
        }

        if (left !== lastLeft) {
          this.frozenColsTDs!.forEach((td) => {
            style.setStyle(td, {'left': leftPx});
          });
        }
      } else {
        // For Firefox, we use -moz-transform instead.
        if (top !== lastTop) {
          this.frozenRowTHs!.forEach((th) => {
            style.setStyle(th, {'-moz-transform': `translateY(${top - 1}px)`});
          });
        }

        if (left !== lastLeft) {
          this.frozenColsTDs!.forEach((td) => {
            style.setStyle(td, {'-moz-transform': `translateX(${leftPx})`});
          });
        }

        this.frozenTopLeftTHs!.forEach((th) => {
          style.setStyle(th, {
            '-moz-transform': `translate3D(${leftPx},${top - 1}px,0)`,
          });
        });
      }

      lastTop = top;
      lastLeft = left;
    };

    if (this.scrollingTimeout) {
      clearTimeout(this.scrollingTimeout);
    }
    if (scrollTransition) {
      this.scrollingTimeout = setTimeout(scrollFrozenCells, 10);
    } else {
      // Call immediately
      scrollFrozenCells();
    }

    return true;
  }

  /**
   * Creates or updates a pane holding the table.
   *
   * @param container The element to put the pane in.
   * @return The newly created or previously existing pane.
   */
  private updateScrollPane(container: Element): Element {
    const dom = this.dom;
    const options = this.options;
    // By this time, cssClassNames has a value.
    assert(this.cssClassNames != null);
    const cssClassNames = this.cssClassNames;
    const data = this.data as AbstractDataTable;
    const colTypes = Table.getColumnTypes(data);
    // Suppressing errors for ts-migration.
    //   TS2345: Argument of type 'Object' is not assignable to parameter of
    //   type '{ [key: string]: string[]; }'.
    // @ts-ignore
    const cellClassNames = Table.getCellCssClassNames(data, cssClassNames);
    let headerRow;

    // Remember whether we are updating an existing pane or creating a new one.
    let updatingPane = false;
    let table = null;
    let pane = this.elementCache[ElementName.SCROLL_PANE];
    if (pane) {
      updatingPane = true;
      table = dom.getElementsByTagNameAndClass('table', null, pane)[0];
      assert(table != null);

      // Get the header and update it.
      headerRow = this.headerRow;
      this.updateHeaderRow(true, headerRow, cellClassNames);
    } else {
      // Create a new pane.
      pane = this.dom.createDom(DIV, {'style': 'position: relative;'});
      dom.appendChild(container, pane);
      this.elementCache[ElementName.SCROLL_PANE] = pane;

      // TODO(dlaliberte): Check whether we need to defer setting the event
      // handlers until after ready event. e.g. for Polymer.
      this.eventHandler!.listen(pane, SCROLL, (event) => {
        this.handleScroll();
      });

      // Create a new header row
      headerRow = this.headerRow = this.updateHeaderRow(
        true,
        null,
        cellClassNames,
      );
    }

    const frozenColumnsBackground = options!.inferOptionalColorValue(
      'frozenColumnsBackground',
    );
    const numFrozenCells = this.numFrozenColumns + (this.showRowNumber ? 1 : 0);
    const nodes = dom.getChildren(headerRow);
    googArray.forEach(nodes, (td, i) => {
      if (i < numFrozenCells) {
        const tdElement = assertIsElement(td);
        add(tdElement, 'frozen-column');
        if (frozenColumnsBackground) {
          style.setStyle(tdElement, {
            'background-color': frozenColumnsBackground,
          });
        }
      }
    });
    if (numFrozenCells > 0 && nodes.length > numFrozenCells) {
      const node = nodes[numFrozenCells - 1];
      add(node, 'last-frozen-column');
    }

    const hideColumns = null;
    if (updatingPane) {
      assert(table != null);
      this.updateTable(
        table,
        headerRow,
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'Options | null' is not assignable to
        //   parameter of type 'Options'.
        // @ts-ignore
        options,
        cellClassNames,
        colTypes,
        hideColumns,
      );
    } else {
      // Create the table and pane.
      table = this.updateTable(
        null,
        headerRow,
        // Suppressing errors for ts-migration.
        //   TS2345: Argument of type 'Options | null' is not assignable to
        //   parameter of type 'Options'.
        // @ts-ignore
        options,
        cellClassNames,
        colTypes,
        hideColumns,
      );

      dom.appendChild(pane, table);
    }
    return pane;
  }

  /**
   * Creates or updates an html table with the given properties
   * and the data table passed in to draw.
   * @param table The table element to update, or null if none.
   * @param headerRow The header row of the table, or null.
   * @param options The visualization options.
   * @param cellClasses The array of cell class names for each column.
   * @param colTypes The array of column types.
   * @param hideColumns Starting number of columns to hide, or null if none
   *     hidden.
   *
   * @return An html table.
   */
  private updateTable(
    table: Element | null,
    headerRow: Element | null,
    options: Options,
    cellClasses: string[][],
    colTypes: string[],
    hideColumns: number | null,
  ): Element {
    const data = this.data;
    const dom = this.dom;
    const cssClassNames = this.cssClassNames;
    let tbody;
    if (table) {
      tbody = dom.getElementsByTagNameAndClass('tbody', null, table)[0];
      removeChildren(tbody);
    } else {
      table = dom.createDom(TABLE, {'cellspacing': '0'});
      /**
       * @suppress {strictMissingProperties} Auto-added to unblock
       * check_level=STRICT
       */
      // Suppressing errors for ts-migration.
      //   TS4111: Property 'TABLE' comes from an index signature, so it must be
      //   accessed with ['TABLE'].
      // @ts-ignore
      addAll(table, cssClassNames!.TABLE);
      const thead = dom.createDom(THEAD);
      dom.appendChild(table, thead);
      dom.appendChild(thead, headerRow);

      tbody = dom.createDom(TBODY);
      dom.appendChild(table, tbody);
    }

    const numberFormatter = new NumberFormat({
      'fractionDigits': 0,
      'pattern': '#',
    });

    const frozenColumnsBackground = options.inferOptionalColorValue(
      'frozenColumnsBackground',
    );

    // Add all rows
    if (this.page == null) {
      this.page = this.hasRows
        ? this.pageManager.calculateTableRowsInCurrentPage()
        : [];
    }
    const page = this.page;
    const numFrozenColumns = this.numFrozenColumns;
    /**
     * @suppress {strictPrimitiveOperators} Auto-added to unblock
     * check_level=STRICT
     */
    const firstHiddenColumn = hideColumns! - (this.showRowNumber ? 1 : 0);

    let alternatingRowStyle = options.inferBooleanValue(
      'alternatingRowStyle',
      true,
    );
    alternatingRowStyle =
      alternatingRowStyle != null ? alternatingRowStyle : true;
    for (let i = 0; i < page.length; i++) {
      const evenRow = i % 2 === 0;
      const tableRow = page[i];
      const dataRowIndex = tableRow.getDataRowIndex();
      const isSelected = this.selectedRows.containsRow(dataRowIndex);
      const rowColor = data!.getRowProperty(dataRowIndex, 'rowColor') as string;
      const className = data!.getRowProperty(
        dataRowIndex,
        'className',
      ) as string;
      tableRow.setEven(evenRow);
      tableRow.setSelected(isSelected);

      const tr = dom.createDom(TR);

      if (className) {
        set(tr, className);
      }
      if (isSelected) {
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'TR_SELECTED' comes from an index signature, so it
        //   must be accessed with ['TR_SELECTED'].
        // @ts-ignore
        addAll(tr, cssClassNames!.TR_SELECTED);
      }
      if (alternatingRowStyle) {
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'TR_EVEN' comes from an index signature, so it
        //   must be accessed with ['TR_EVEN']. TS4111: Property 'TR_ODD' comes
        //   from an index signature, so it must be accessed with ['TR_ODD'].
        // @ts-ignore
        addAll(tr, evenRow ? cssClassNames!.TR_EVEN : cssClassNames!.TR_ODD);
      } else {
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'TR_EVEN' comes from an index signature, so it
        //   must be accessed with ['TR_EVEN'].
        // @ts-ignore
        addAll(tr, cssClassNames!.TR_EVEN);
      }

      this.eventHandler!.listen(
        tr,
        MOUSEDOWN,
        this.handleRowMouseDown.bind(this, tableRow),
      );
      this.eventHandler!.listen(
        tr,
        MOUSEOVER,
        this.handleRowMouseOver.bind(this, tableRow),
      );
      this.eventHandler!.listen(
        tr,
        MOUSEOUT,
        this.handleRowMouseOut.bind(this, tableRow),
      );
      dom.appendChild(tbody, tr);

      if (this.showRowNumber) {
        const td = dom.createDom(TD);
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'TD' comes from an index signature, so it must be
        //   accessed with ['TD'].
        // @ts-ignore
        addAll(td, cssClassNames!.TD);
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'SEQ' comes from an index signature, so it must be
        //   accessed with ['SEQ'].
        // @ts-ignore
        addAll(td, cssClassNames!.SEQ);
        dom.appendChild(tr, td);
        dom.appendChild(
          td,
          dom.createTextNode(
            numberFormatter.formatValue(tableRow.getDisplayNumber()),
          ),
        );
        if (rowColor) {
          style.setStyle(td, {'background-color': rowColor});
        }
        if (numFrozenColumns >= 0) {
          add(td, 'frozen-column');
          if (0 === numFrozenColumns) {
            add(td, 'last-frozen-column');
          }
          if (frozenColumnsBackground) {
            style.setStyle(td, {'background-color': frozenColumnsBackground});
          }
        }
      }

      const numColumns = data!.getNumberOfColumns();
      // c is the current column being created.
      // c may increase by more than one depending on colSpan.
      let colSpan;
      for (let c = 0; c < numColumns; c += colSpan) {
        const r = tableRow.getDataRowIndex();

        let classNames = cellClasses[c];
        const classNameProp = data!.getProperty(r, c, 'className');
        if (classNameProp && typeof classNameProp === 'string') {
          classNames = classNames.concat(trim(classNameProp).split(/\s+/));
        }

        // Gets the colspan property for the table cell.
        colSpan = Number(data!.getProperty(r, c, '__td-colSpan'));
        colSpan = colSpan && Math.min(colSpan, numColumns - c);
        if (!colSpan || colSpan <= 1) {
          // If undefined or 0, set to 1.
          colSpan = 1;
        }

        const td = dom.createDom(TD, {'colSpan': colSpan});

        addAll(td, classNames || []);
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'TD' comes from an index signature, so it must be
        //   accessed with ['TD'].
        // @ts-ignore
        addAll(td, cssClassNames!.TD);
        dom.appendChild(tr, td);

        if (rowColor) {
          style.setStyle(td, {'background-color': rowColor});
        }

        const v = data!.getValue(r, c);
        let fv = data!.getFormattedValue(r, c);

        if (v == null) {
          fv = isEmptyOrWhitespace(makeSafe(fv)) ? '\u00A0' : fv;
        } else {
          if (colTypes[c] === 'boolean') {
            fv = v ? '\u2714' : '\u2717'; // checkmark or fancy X
          }
        }
        if (this.allowHtml || this.allowHtmlSafely) {
          safeElement.setInnerHtml(td, getSafeHtml(fv));
          // TODO(dlaliberte): Add row and col properties of style
          // Apply cell styles
          const styles = data!.getProperty(r, c, 'style');
          if (styles) {
            // TODO(dlaliberte): Maybe do this; td.style.cssText(getSafeStyle(String(styles)));
            // tslint:disable-next-line:deprecation
            safeElement.setCssText(td, getSafeStyle(String(styles)));
          }
        } else {
          dom.appendChild(td, dom.createTextNode(fv));
        }
        if (c <= numFrozenColumns - 1) {
          add(td, 'frozen-column');
          if (c === numFrozenColumns - 1) {
            add(td, 'last-frozen-column');
          }
          if (frozenColumnsBackground) {
            style.setStyle(td, {'background-color': frozenColumnsBackground});
          }
        }

        if (hideColumns != null && c >= firstHiddenColumn) {
          Table.setElementHidden(td);
        }
      }
    }
    // Suppressing errors for ts-migration.
    //   TS2322: Type 'Element | null' is not assignable to type 'Element'.
    // @ts-ignore
    return table;
  }

  /**
   * Creates or updates the dom for the table header.
   *
   * @param addClickHandler Whether to add a click handler for each column
   *     header.
   *
   * @return A TR element for the table header row.
   */
  private updateHeaderRow(
    addClickHandler: boolean,
    currentHeader: Element | null,
    cellClassNames: string[][],
  ): Element {
    const data = this.data;
    const cssClassNames = this.cssClassNames;
    const enableSortIndicators =
      this.sort !== 'disable' && data!.getNumberOfRows() > 0;

    const updateHeaders = (headerRow: AnyDuringMigration) => {
      const cells = headerRow.childNodes;
      // Update current sort column
      const sortOrderClasses = [
        'unsorted',
        'sort-descending',
        'sort-ascending',
      ];
      const sortColumnIndex = this.pageManager.getSortColumnIndex();

      googArray.forEach(cells, (th) => {
        const index = th['index'];
        removeAll(th, sortOrderClasses);
        if (enableSortIndicators) {
          const sortThisColumn = sortColumnIndex === index;
          let sortOrderIndex = 0;
          if (sortThisColumn) {
            sortOrderIndex = this.pageManager.getSortOrder() ? 2 : 1;
          }
          add(th, sortOrderClasses[sortOrderIndex]);
        }
      });
    };

    if (currentHeader) {
      updateHeaders(currentHeader);
      return currentHeader;
    }

    const dom = this.dom;
    const numColumns = data!.getNumberOfColumns();

    const tr = dom.createDom(TR);
    /**
     * @suppress {strictMissingProperties} Auto-added to unblock
     * check_level=STRICT
     */
    // Suppressing errors for ts-migration.
    //   TS4111: Property 'TR_HEAD' comes from an index signature, so it must be
    //   accessed with ['TR_HEAD'].
    // @ts-ignore
    addAll(tr, cssClassNames!.TR_HEAD);

    let th;
    if (this.showRowNumber && data!.getNumberOfColumns() > 0) {
      // Construct row-number cell:
      th = dom.createDom(TH);
      /**
       * @suppress {strictMissingProperties} Auto-added to unblock
       * check_level=STRICT
       */
      // Suppressing errors for ts-migration.
      //   TS4111: Property 'TH' comes from an index signature, so it must be
      //   accessed with ['TH'].
      // @ts-ignore
      addAll(th, cssClassNames!.TH);
      th.textContent = '\xa0'; // Non-breakable space.
      dom.appendChild(tr, th);
    }
    for (let c = 0; c < numColumns; c++) {
      th = dom.createDom(TH, {'index': c});
      /**
       * @suppress {strictMissingProperties} Auto-added to unblock
       * check_level=STRICT
       */
      // Suppressing errors for ts-migration.
      //   TS4111: Property 'TH' comes from an index signature, so it must be
      //   accessed with ['TH'].
      // @ts-ignore
      addAll(th, cssClassNames!.TH);
      addAll(th, cellClassNames[c] || []);
      dom.appendChild(tr, th);
      const label = data!.getColumnLabel(c);
      const labelElement = th;
      if (this.allowHtml || this.allowHtmlSafely) {
        safeElement.setInnerHtml(labelElement, getSafeHtml(label));
      } else {
        dom.appendChild(labelElement, dom.createTextNode(label));
      }
      if (enableSortIndicators) {
        const sortIndicator = dom.createDom(SPAN);
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'SORTIND' comes from an index signature, so it
        //   must be accessed with ['SORTIND'].
        // @ts-ignore
        addAll(sortIndicator, cssClassNames!.SORTIND);
        dom.appendChild(th, sortIndicator);
        th.setAttribute('tabindex', 0);
        th.setAttribute('role', 'button');

        /**
         * @desc Description of the table header which when clicked will sort
         * the corresponding column.
         */
        const MSG_SORT_COLUMN = goog.getMsg('Sort column');
        th.setAttribute('aria-label', MSG_SORT_COLUMN);
      }
      // Attach event handlers for sorting.
      if (addClickHandler) {
        // The handler will be added to all panes it is requested on, yet
        // only the top most will handle the event and others won't be getting
        // the event (overlapping and not descendants panes)
        this.eventHandler!.listen(
          th,
          CLICK,
          this.handleHeaderClick.bind(this, c),
          this.useHeaderClickCapture,
        );
        this.eventHandler!.listen(
          th,
          KEYPRESS,
          this.handleHeaderKeypress.bind(this, c),
          this.useHeaderClickCapture,
        );
      }
    }
    updateHeaders(tr);

    return tr;
  }

  /**
   * Creates or updates paging controls. The paging controls are added
   * to the current content element holding the table and all related panes.
   *
   * @param contentElement The element holding all the table and all related
   *     panes.
   */
  private updatePagingControls(contentElement: Element) {
    const options = this.options;
    const dom = this.dom;
    const cssClassNames = this.cssClassNames;
    // Create pagination elements: prev and next controls.
    const pagingSymbols = options!.inferObjectValue('pagingSymbols', {});
    // Create the paging buttons symbols.
    const prevSymbolText = (pagingSymbols as AnyDuringMigration)['prev'];
    const nextSymbolText = (pagingSymbols as AnyDuringMigration)['next'];
    const allowHtml = this.allowHtml || this.allowHtmlSafely;
    let prevSymbolDef: ControlContent;
    let nextSymbolDef: ControlContent;

    if (prevSymbolText) {
      if (allowHtml) {
        prevSymbolDef = dom.createDom(SPAN);
        safeElement.setInnerHtml(prevSymbolDef, getSafeHtml(prevSymbolText));
      } else {
        // Note that this string will be treated as plain text by the
        // CustomButton implementation -- no HTML escaping is necessary.
        prevSymbolDef = String(prevSymbolText);
      }
    } else {
      prevSymbolDef = dom.createDom(SPAN, {'alt': 'previous'});
      /**
       * @suppress {strictMissingProperties} Auto-added to unblock
       * check_level=STRICT
       */
      // Suppressing errors for ts-migration.
      //   TS4111: Property 'PAGE_PREV' comes from an index signature, so it
      //   must be accessed with ['PAGE_PREV'].
      // @ts-ignore
      addAll(prevSymbolDef, cssClassNames!.PAGE_PREV);
    }

    if (nextSymbolText) {
      if (allowHtml) {
        nextSymbolDef = dom.createDom(SPAN);
        safeElement.setInnerHtml(nextSymbolDef, getSafeHtml(nextSymbolText));
      } else {
        nextSymbolDef = String(nextSymbolText);
      }
    } else {
      nextSymbolDef = dom.createDom(SPAN, {'alt': 'next'});
      /**
       * @suppress {strictMissingProperties} Auto-added to unblock
       * check_level=STRICT
       */
      // Suppressing errors for ts-migration.
      //   TS4111: Property 'PAGE_NEXT' comes from an index signature, so it
      //   must be accessed with ['PAGE_NEXT'].
      // @ts-ignore
      addAll(nextSymbolDef, cssClassNames!.PAGE_NEXT);
    }
    dispose(this.prevButton);
    dispose(this.nextButton);
    const prev = (this.prevButton = new CustomButton(prevSymbolDef));
    const next = (this.nextButton = new CustomButton(nextSymbolDef));
    prev.setCollapsed(ButtonSide.END);
    next.setCollapsed(ButtonSide.START);
    this.eventHandler!.listen(
      prev,
      Component.EventType.ACTION,
      () => {
        this.handlePaging(false);
      },
      false,
    );
    this.eventHandler!.listen(
      next,
      Component.EventType.ACTION,
      () => {
        this.handlePaging(true);
      },
      false,
    );
    this.configurePagingButtons();

    const pagingElement = this.elementCache[ElementName.PAGING_CONTROLS];
    dom.appendChild(contentElement, pagingElement);
    const clearFloatDiv = this.elementCache[ElementName.CLEAR_FLOAT];
    dom.appendChild(contentElement, clearFloatDiv);

    prev.render(pagingElement);
    next.render(pagingElement);

    if (this.pageManager.getNumberOfPages() <= 1) {
      return;
    }

    /* List of page numbers. */
    const pnDom = dom.createDom(DIV);
    /**
     * @suppress {strictMissingProperties} Auto-added to unblock
     * check_level=STRICT
     */
    // Suppressing errors for ts-migration.
    //   TS4111: Property 'PAGE_NUMBERS' comes from an index signature, so it
    //   must be accessed with ['PAGE_NUMBERS'].
    // @ts-ignore
    addAll(pnDom, cssClassNames!.PAGE_NUMBERS);
    dom.appendChild(pagingElement, pnDom);

    const pageCnt = this.pageManager.getNumberOfPages();
    const currentPage = this.pageManager.getCurrentPageIndex();
    const numPagingButtons: number =
      this.pageManager.getNumberOfPagingButtons() || pageCnt;

    if (numPagingButtons == null || numPagingButtons > 0) {
      // First make all page number buttons.
      const currentPageNum = currentPage;
      const beforePageNums = this.makePageNumbers(0, currentPageNum - 1);
      const afterPageNums = this.makePageNumbers(
        currentPageNum + 1,
        pageCnt - 1,
      );
      let pageNums = beforePageNums
        .concat(currentPageNum, afterPageNums)
        .map((pageNum) => ({n: pageNum, current: currentPageNum === pageNum}));

      // Now select numPagingButtons buttons from the range of all buttons
      // such that the current page is near the middle.  For an even number of
      // buttons, the number before the current page will be smaller, unless
      // we are near the end.
      const halfNumButtons = Math.floor((numPagingButtons - 1) / 2);
      let firstIndex = Math.max(0, beforePageNums.length - halfNumButtons);
      const afterLastIndex = Math.min(pageCnt, firstIndex + numPagingButtons);
      // In case the last index is at the end, back up the first index.
      firstIndex = Math.max(0, afterLastIndex - numPagingButtons);
      pageNums = pageNums.slice(firstIndex, afterLastIndex);
      pageNums.forEach((pageInfo) => {
        const n = pageInfo.n;
        const numLink = dom.createDom(A, {
          'href': 'javascript:void(0)',
          'class': pageInfo.current ? 'current' : '',
        });
        /**
         * @suppress {strictMissingProperties} Auto-added to unblock
         * check_level=STRICT
         */
        // Suppressing errors for ts-migration.
        //   TS4111: Property 'PAGE_NUMBER' comes from an index signature, so it
        //   must be accessed with ['PAGE_NUMBER'].
        // @ts-ignore
        addAll(numLink, cssClassNames!.PAGE_NUMBER);
        numLink.textContent = String(Number(n) + 1);
        this.eventHandler!.listenWithScope(
          numLink,
          CLICK,
          function (event) {
            // Prevent CSP violations when the element is clicked on.
            event.preventDefault();

            this.handleGotoPage(n);
          },
          false,
          this,
        );
        dom.appendChild(pnDom, numLink);
      });
    }
  }

  /**
   * Return an array of representative page numbers between n1 and n2.
   * The numbers returned will be the first and last, and multiples of
   * powers of 10 within that range.  If the range size is less than 10,
   * then all the numbers are iterated.
   * @param n1 The leftmost number in the range, origin 0.
   * @param n2 The rightmost number in the range, origin 0.
   * @return The array of page numbers.
   */
  private makePageNumbers(n1: number, n2: number): number[] {
    const pages = [];
    if (n1 + 10 > n2) {
      // Just iterate over all of them.
      for (let n = n1; n <= n2; n++) {
        pages.push(n);
      }
    } else {
      let left = n1;
      pages.push(left);
      let right = n2;
      pages.push(right);
      let pow10 = 10;
      while (left < right) {
        left = pow10 * Math.ceil((left + 2) / pow10) - 1;
        if (left < right) {
          pages.push(left);
        }
        right = pow10 * Math.floor(right / pow10) - 1;
        if (left < right) {
          pages.push(right);
        }
        pow10 *= 10;
      }
      pages.sort(googArray.defaultCompare);
    }
    return pages;
  }

  /**
   * Handles a view next/prev page event on the data table.
   * @param isNext True if next page is requested, false if prev page.
   */
  private handlePaging(isNext: boolean) {
    const pageCnt = this.pageManager.getNumberOfPages();
    const currentPage: number = this.pageManager.getCurrentPageIndex();
    const nextPageNum = isNext
      ? Math.min(pageCnt, currentPage + 1)
      : Math.max(0, currentPage - 1);
    this.handleGotoPage(nextPageNum);
  }

  /**
   * Handles a page number click event for the data table.
   * @param pageNum The number of the page to go to.
   */
  private handleGotoPage(pageNum: number) {
    if (this.pageManager.getPagingEnabled()) {
      this.pageManager.setPageIndex(pageNum);
      this.storeScrollPosition();
      this.redraw(true);
    }
    this.configurePagingButtons();
    // The page property in the event is the requested next page.
    trigger(this, 'page', {'page': pageNum});
  }

  /**
   * Configure the paging buttons according the user pagingButtons.
   * In the 'auto' case enable/disable according to the current page index.
   */
  private configurePagingButtons() {
    this.nextButton!.setEnabled(this.pageManager.isNextButtonEnabled());
    this.prevButton!.setEnabled(this.pageManager.isPrevButtonEnabled());
  }

  /**
   * Sets custom css class names specified by the user by side effect.
   * The user can pass css class names for table elements as described
   * is cssClassNames option.
   */
  private setCustomClassNames() {
    const customCssNames = this.cssClassNames;
    const optionsClassNames = this.options!.inferObjectValue('cssClassNames');
    if (optionsClassNames) {
      // Set the user given css class names.
      // tslint:disable-next-line:no-implicit-dictionary-conversion
      forEach(CLASSNAME_TO_OPTION_NAME, (optionName, name) => {
        const optionClassName = (optionsClassNames as AnyDuringMigration)[
          optionName
        ];
        if (goog.isArrayLike(optionClassName)) {
          customCssNames![name] = optionClassName;
        } else if (optionClassName) {
          customCssNames![name] = trim(optionClassName).split(/\s+/);
        }
      });
    }
  }

  /**
   * Checks that the css file was loaded by verifying that a specific class name
   * is present. In some cases CSS may not be fully loaded by the time the table
   * renders.
   *
   * Called by @see Table.prototype.waitForCss
   *
   * @return True if the css was loaded false otherwise.
   */
  private checkCssLoaded(): boolean {
    let checkDiv = this.checkCssLoadedDiv;
    if (!checkDiv) {
      const container = this.container;
      checkDiv = this.dom.createDom(
        DIV,
        {
          'style': 'position: absolute; top: -5000px;',
          'class': 'google-visualization-table-loadtest',
        },
        this.dom.createTextNode('\u00A0'),
      );
      this.dom.appendChild(container, checkDiv);
      this.checkCssLoadedDiv = checkDiv;
    }
    const paddingLeft = style.getPaddingBox(checkDiv).left;
    return Number(paddingLeft) === 6;
  }

  /**
   * Waits for the css class to load and calls draw when it arrives.
   * If css does not load eventually, only calls ready event (without draw).
   * The method waits for: counter * CSS_WAIT_INCREMENT milliseconds.
   * The total is about 10 seconds, but the first iterations are shorter,
   * i.e. 0, 200, 400, ...
   *
   * @param counter The counter for how many times wait was called.
   */
  private waitForCss(counter: number) {
    if (counter < WAIT_FOR_CSS_MAX_ITERATIONS) {
      if (this.checkCssLoaded()) {
        assert(this.data != null);
        this.draw(this.data, this.options);
      } else {
        const waitTime = counter * CSS_WAIT_INCREMENT;
        counter++;
        setTimeout(this.waitForCss.bind(this, counter), waitTime);
      }
    } else {
      // Give up waiting.
      this.dom.removeNode(this.checkCssLoadedDiv);
      this.triggerReadyEvent();
    }
  }

  private setupCss() {
    this.setCustomClassNames();
    let isCssLoaded = true;
    if (this.firstTimeRendered) {
      // Check that css was loaded before rendering begins
      isCssLoaded = this.checkCssLoaded();
      this.firstTimeRendered = false;
    }
    this.redraw();

    if (!isCssLoaded) {
      // Will trigger 'ready' event when done.
      this.waitForCss(0);
    } else {
      this.dom.removeNode(this.checkCssLoadedDiv);
      this.triggerReadyEvent();
    }
  }

  /**
   * Returns the selected rows as an array of objects each of which has a row
   * property containing the row number of a selected row.
   * @return An array of objects where the row property of each object in the
   *     array contains the row number of a selected row.
   */
  getSelection(): AnyDuringMigration[] {
    return this.selectedRows.getSelection();
  }

  /**
   * Selects the specified rows, and un-selects any row that is not specified.
   * @param selection The row property of each object in the array contains a
   *     row number. These and only these are to be selected. The row number is
   *     the Data row number.
   */
  setSelection(selection: AnyDuringMigration[] | null) {
    // In case there is no data table ignore the selection.
    // E.g., if a null data was passed or when draw was never called.
    if (!this.data) {
      return;
    }
    const changes = this.selectedRows.setSelection(selection);

    const page = this.page;

    // Reset the last (user) selected page row.
    this.lastSelectedTableRow = this.pageManager.getFirstTableRowInPage();

    const htmlTableRows = this.getHtmlTableRows();
    let tr;
    const cssClassNames = this.cssClassNames;

    // Remove selection from rows no longer selected.
    const removedRowIndexes = changes.getRemoved().getRowIndexes();
    for (let i = 0; i < removedRowIndexes.length; i++) {
      const dataRowInd = removedRowIndexes[i];
      const pageRowInd =
        this.pageManager.getPageRowIndexByDataRowIndex(dataRowInd);
      if (pageRowInd !== -1) {
        const tableRow = page![pageRowInd];
        tableRow.setSelected(false);
        tr = htmlTableRows[pageRowInd];
        if (tr) {
          /**
           * @suppress {strictMissingProperties} Auto-added to unblock
           * check_level=STRICT
           */
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'Node' is not assignable to parameter of
          //   type 'Element'. TS4111: Property 'TR_SELECTED' comes from an
          //   index signature, so it must be accessed with ['TR_SELECTED'].
          // @ts-ignore
          removeAll(tr, cssClassNames!.TR_SELECTED);
        }
      }
    }

    // Add new selected rows.
    const addedRowIndexes = changes.getAdded().getRowIndexes();
    for (let i = 0; i < addedRowIndexes.length; i++) {
      const dataRowInd = addedRowIndexes[i];
      const pageRowInd =
        this.pageManager.getPageRowIndexByDataRowIndex(dataRowInd);
      if (pageRowInd !== -1) {
        const tableRow = page![pageRowInd];
        tableRow.setSelected(true);
        tr = htmlTableRows[pageRowInd];
        if (tr) {
          /**
           * @suppress {strictMissingProperties} Auto-added to unblock
           * check_level=STRICT
           */
          // Suppressing errors for ts-migration.
          //   TS2345: Argument of type 'Node' is not assignable to parameter of
          //   type 'Element'. TS4111: Property 'TR_SELECTED' comes from an
          //   index signature, so it must be accessed with ['TR_SELECTED'].
          // @ts-ignore
          addAll(tr, cssClassNames!.TR_SELECTED);
        }
      }
    }
  }

  /**
   * Handles a mouse down event on a table row.
   *
   * @param tableRow A table row.
   * @param e The browser event.
   */
  private handleRowMouseDown(tableRow: TableRow, e: Event) {
    let selectedRows;
    const lastSelectedTableRow = this.lastSelectedTableRow;
    const currDataRowIndex = tableRow.getDataRowIndex();
    // We save the state of the modifier key which is platform dependent
    // (usually ctrl except on mac where it is meta).
    // Suppressing errors for ts-migration.
    //   TS2339: Property 'metaKey' does not exist on type 'Event'.
    //   TS2339: Property 'ctrlKey' does not exist on type 'Event'.
    // @ts-ignore
    const platformModifierKeyState = MAC ? e.metaKey : e.ctrlKey;

    // If shift is pressed select all rows between last selected row and the
    // current selection.
    // Suppressing errors for ts-migration.
    //   TS2339: Property 'shiftKey' does not exist on type 'Event'.
    // @ts-ignore
    if (e.shiftKey) {
      e.preventDefault();
      const start = Math.min(
          tableRow.getUIRowIndex(), lastSelectedTableRow!.getUIRowIndex());
      const end = Math.max(
          tableRow.getUIRowIndex(), lastSelectedTableRow!.getUIRowIndex());
      // If the modifier is also pressed leave the last selection, otherwise
      // clear previous selection.
      if (platformModifierKeyState) {
        selectedRows = this.selectedRows.getSelection();
      } else {
        selectedRows = [];
      }
      const rows = this.pageManager.getTableRowsInRangeByUIRows(start, end);
      for (let i = 0; i < rows.length; i++) {
        selectedRows.push({'row': rows[i].getDataRowIndex()});
      }
    } else if (platformModifierKeyState) {
      e.preventDefault();
      selectedRows = this.selectedRows.getSelection();

      if (this.selectedRows.containsRow(currDataRowIndex)) {
        const newSelectionForRemove = new Selection();
        newSelectionForRemove.setSelection(selectedRows);
        newSelectionForRemove.removeRow(currDataRowIndex);
        selectedRows = newSelectionForRemove.getSelection();
      } else {
        selectedRows.push({'row': currDataRowIndex});
      }
    } else {
      // Click on a selected row removes the selection (toggle)
      selectedRows = this.selectedRows.containsRow(currDataRowIndex) ?
          null :
          [{'row': currDataRowIndex}];
    }
    // Note: clears last selected row.
    this.setSelection(selectedRows);
    // Mark the current rowInd as the last row selected if shift is not
    // selected. If shift is selected, set last selected row to the previous
    // last selected row.
    // Suppressing errors for ts-migration.
    //   TS2339: Property 'shiftKey' does not exist on type 'Event'.
    // @ts-ignore
    if (!e.shiftKey) {
      this.lastSelectedTableRow = tableRow;
    } else {
      this.lastSelectedTableRow = lastSelectedTableRow;
    }
    trigger(this, 'select', {});
  }

  /**
   * Handles a mouse over event on a table row.
   * This is an internal event to help the user know on which row it is
   * over. It does not relate to external events.
   *
   * @param tableRow A table row.
   */
  private handleRowMouseOver(tableRow: TableRow) {
    const tableRows = this.getHtmlTableRows();
    const cssClassNames = this.cssClassNames;
    const pageRowIndex = tableRow.getPageRowIndex();
    const tr = tableRows[pageRowIndex];
    if (tr) {
      /**
       * @suppress {strictMissingProperties} Auto-added to unblock
       * check_level=STRICT
       */
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'Node' is not assignable to parameter of
      //   type 'Element'. TS4111: Property 'TR_MOUSEOVER' comes from an index
      //   signature, so it must be accessed with ['TR_MOUSEOVER'].
      // @ts-ignore
      addAll(tr, cssClassNames!.TR_MOUSEOVER);
    }
  }

  /**
   * Handles a mouse out event on a table row.
   * This is an internal event to help the user know on which row it is
   * over. It does not relate to external events.
   * @param tableRow A table row.
   */
  private handleRowMouseOut(tableRow: TableRow) {
    const tableRows = this.getHtmlTableRows();
    const pageRowIndex = tableRow.getPageRowIndex();
    const cssClassNames = this.cssClassNames;
    const tr = tableRows[pageRowIndex];
    if (tr) {
      /**
       * @suppress {strictMissingProperties} Auto-added to unblock
       * check_level=STRICT
       */
      // Suppressing errors for ts-migration.
      //   TS2345: Argument of type 'Node' is not assignable to parameter of
      //   type 'Element'. TS4111: Property 'TR_MOUSEOVER' comes from an index
      //   signature, so it must be accessed with ['TR_MOUSEOVER'].
      // @ts-ignore
      removeAll(tr, cssClassNames!.TR_MOUSEOVER);
    }
  }

  /**
   * Get the html table rows.
   * @return The html table rows (array of tr's).
   */
  private getHtmlTableRows(): NodeList {
    return this.dom.getElementsByTagNameAndClass(
      'tbody',
      null,
      this.scrollTable,
    )[0].childNodes;
  }

  /**
   * Handles a click on a column header for sorting.
   * @param colInd The index of the clicked column.
   */
  private handleHeaderClick(colInd: number) {
    let sortAscending = this.pageManager.getSortOrder();
    const sortColumnIndex = this.pageManager.getSortColumnIndex();

    if (sortColumnIndex === colInd) {
      sortAscending = !sortAscending;
    } else {
      sortAscending = true;
    }

    if (this.sort !== 'event') {
      // if 'enable' or empty
      this.pageManager.setSort(colInd, !sortAscending);
      this.pageManager.setPageIndex(0);
      this.lastSelectedTableRow = this.pageManager.getFirstTableRowInPage();
      this.storeScrollPosition();
      this.redraw(true);
      // Throw a 'sort' event with the current table sort information.
      trigger(this, 'sort', this.pageManager.getSortInfo());
    } else {
      // In case of 'event' only - notifies listener with the requested
      // sort but doesn't change the internal state of the table (pageManager).
      trigger(this, 'sort', {
        'column': colInd,
        'ascending': sortAscending,
        'sortedIndexes': null,
      });
    }
  }

  /**
   * Handles a keypress event on a column header for sorting.
   * @param colInd The index of the clicked column.
   * @param event Browser's event object.
   */
  private handleHeaderKeypress(colInd: number, event: BrowserEvent) {
    if (event.keyCode === KeyCodes.ENTER) {
      this.handleHeaderClick(colInd);
    }
  }

  /**
   * Stores the scrolling start position based on the current scroll pane.
   * Used before redraw is called .
   */
  private storeScrollPosition() {
    if (this.scrollPane) {
      this.scrollLeftStartPosition = this.scrollPane.scrollLeft;
    }
  }

  /**
   * Clears the drawing elements.
   * Remove any resources allocated by the redraw() method.
   */
  private clear() {
    // Dispose of the event handlers.
    dispose(this.eventHandler);
    this.eventHandler = null;

    // Clear the DOM elements.
    this.dom.removeChildren(this.container);

    // Dispose of the button objects.
    dispose(this.prevButton);
    this.prevButton = null;
    dispose(this.nextButton);
    this.nextButton = null;

    this.elementCache = {};
  }

  /**
   * Clears the chart.
   * Remove any resources allocated for this chart.
   */
  override clearChart() {
    // Clear resources allocated by the redraw() method.
    this.clear();

    // Clear the selection object.
    this.selectedRows.clear();

    // Clear the page manager.
    // Will be reset by drawInternal.
    // this.pageManager = null;
  }

  /**
   * Returns the given string with 'px' appended if it is numeric.
   * @param dimension The dimension string.
   * @return A qualified dimension string.
   */
  private static addUnitsIfRequired(dimension: string): string {
    if (isEmptyOrWhitespace(makeSafe(dimension))) {
      return dimension;
    }
    let res = dimension;
    if (isNumeric(dimension) && String(dimension) !== '0') {
      res += 'px';
    }
    return res;
  }

  /**
   * Returns CSS class names for table cells according to the column they are
   * in. These class names should apply to header and body cells.
   *
   * @param data The data.
   * @param cssClassNames The name of the css classes used in the table
   *     visualization.
   *
   * @return The css class names for table cells according to the column they
   *     are in.
   */
  private static getCellCssClassNames(
    data: AbstractDataTable,
    cssClassNames: {[key: string]: string[]},
  ): string[][] {
    return Table.getColumnTypes(data).map((type, c) => {
      // Check column property first:
      let classNames: AnyDuringMigration[] = [];
      const customClassName = data.getColumnProperty(c, 'className');

      // If no column property, use the column type:
      switch (type) {
        case 'boolean':
          /**
           * @suppress {strictMissingProperties} Auto-added to unblock
           * check_level=STRICT
           */
          // Suppressing errors for ts-migration.
          //   TS4111: Property 'CELL_BOOLEAN' comes from an index signature,
          //   so it must be accessed with ['CELL_BOOLEAN'].
          // @ts-ignore
          classNames = cssClassNames.CELL_BOOLEAN;
          break;
        case 'number':
          /**
           * @suppress {strictMissingProperties} Auto-added to unblock
           * check_level=STRICT
           */
          // Suppressing errors for ts-migration.
          //   TS4111: Property 'CELL_NUMBER' comes from an index signature,
          //   so it must be accessed with ['CELL_NUMBER'].
          // @ts-ignore
          classNames = cssClassNames.CELL_NUMBER;
          break;
        case 'date':
        case 'datetime':
        case 'timeofday':
          /**
           * @suppress {strictMissingProperties} Auto-added to unblock
           * check_level=STRICT
           */
          // Suppressing errors for ts-migration.
          //   TS4111: Property 'CELL_DATE' comes from an index signature, so
          //   it must be accessed with ['CELL_DATE'].
          // @ts-ignore
          classNames = cssClassNames.CELL_DATE;
          break;
        default:
          // throw new Error(`Unexpected column type "${type}"`);
          // Not an error?  Just break.
          break;
      }
      if (customClassName && typeof customClassName === 'string') {
        classNames = classNames.concat(trim(customClassName).split(/\s+/));
      }

      return classNames;
    });
  }

  /**
   * Returns the array of column types for the given data.
   *
   * @param data The data.
   *
   * @return An array with the given data column types.
   */
  private static getColumnTypes(data: AbstractDataTable): string[] {
    const colTypes = [];
    for (let c = 0; c < data.getNumberOfColumns(); c++) {
      colTypes.push(data.getColumnType(c));
    }
    return colTypes;
  }

  /**
   * Sets an element to be hidden.
   *
   * @param element The element.
   */
  private static setElementHidden(element: Element) {
    add(element, HIDDEN_CLASS);
    Table.setElementTransparent(element);
  }

  /**
   * Sets an element to be transparent.
   *
   * @param element The element.
   */
  private static setElementTransparent(element: Element) {
    /**
     * @suppress {strictPrimitiveOperators} Auto-added to unblock
     * check_level=STRICT
     */
    add(
      element,
      IE && Number(VERSION) < 7 ? TRANSPARENT_CLASS_IE6 : TRANSPARENT_CLASS,
    );
  }
}

/**
 * The number of timeout iterations to wait for css loading.
 * @see Table.prototype.waitForCss
 */
const WAIT_FOR_CSS_MAX_ITERATIONS = 10;

/**
 * How much to increment the timeout while waiting for css file to be loaded.
 * @see Table.prototype.waitForCss
 */
const CSS_WAIT_INCREMENT = 200;

/** The CSS class name prefix. */
const CSSPREFIX = 'google-visualization-table-';

/** Arrays of default CSS class names for each component of the table. */
const CSS_DEFAULT = {
  TABLE: [`${CSSPREFIX}table`],
  TR_HEAD: [`${CSSPREFIX}tr-head`],
  TR_EVEN: [`${CSSPREFIX}tr-even`],
  TR_ODD: [`${CSSPREFIX}tr-odd`],
  TR_SELECTED: [`${CSSPREFIX}tr-sel`],
  TR_MOUSEOVER: [`${CSSPREFIX}tr-over`],
  TH: [`${CSSPREFIX}th`, 'gradient'],
  TD: [`${CSSPREFIX}td`],
  CELL_NUMBER: [`${CSSPREFIX}type-number`],
  CELL_DATE: [`${CSSPREFIX}type-date`],
  CELL_BOOLEAN: [`${CSSPREFIX}type-bool`],
  SEQ: [`${CSSPREFIX}seq`],
  SORT: [`${CSSPREFIX}sorthdr`],
  SORTIND: [`${CSSPREFIX}sortind`],
  PAGE_DIV: [`${CSSPREFIX}div-page`, 'gradient'],
  PAGE_NUMBERS: [`${CSSPREFIX}page-numbers`],
  PAGE_NUMBER: [`${CSSPREFIX}page-number`, 'gradient'],
  PAGE_PREV: [`${CSSPREFIX}page-prev`],
  PAGE_NEXT: [`${CSSPREFIX}page-next`],
};

/**
 * A map between a css class name and the corresponding attribute of
 * cssClassNames options (both reference the same table element).
 */
const CLASSNAME_TO_OPTION_NAME = {
  TR_HEAD: 'headerRow',
  TR_EVEN: 'tableRow',
  TR_ODD: 'oddTableRow',
  TR_SELECTED: 'selectedTableRow',
  TR_MOUSEOVER: 'hoverTableRow',
  TH: 'headerCell',
  TD: 'tableCell',
  SEQ: 'rowNumberCell',
};

/**
 * The names of various elements in the table display,
 *   used mostly for cache lookup
 */
enum ElementName {
  CONTENT = 'content',
  SCROLL_PANE = 'scroll-pane',
  HEADER = 'header',
  FROZEN_TABLE = 'frozen-table',
  FROZEN_HEADER = 'frozen-header',
  PAGING_CONTROLS = 'paging-controls',
  CLEAR_FLOAT = 'clear-float',
}

/** The class for a transparent element. */
const TRANSPARENT_CLASS = 'transparent';

/**
 * The class for a transparent element in IE6 (borderColor is not set
 * due to an IE6 bug).
 */
const TRANSPARENT_CLASS_IE6 = 'transparentIE6';

/** The class for a hidden element. */
const HIDDEN_CLASS = 'google-visualization-hidden';
