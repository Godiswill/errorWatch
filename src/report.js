/**
 * Cross-browser processing of unhandled exceptions
 *
 * Syntax:
 * ```js
 *   ErrorWatch.report.subscribe(function(stackInfo) { ... })
 *   ErrorWatch.report.unsubscribe(function(stackInfo) { ... })
 *   ErrorWatch.report(exception)
 *   try { ...code... } catch(ex) { ErrorWatch.report(ex); }
 * ```
 *
 * Supports:
 *   - Firefox: full stack trace with line numbers, plus column number
 *     on top frame; column number is not guaranteed
 *   - Opera: full stack trace with line and column numbers
 *   - Chrome: full stack trace with line and column numbers
 *   - Safari: line and column number for the top frame only; some frames
 *     may be missing, and column number is not guaranteed
 *   - IE: line and column number for the top frame only; some frames
 *     may be missing, and column number is not guaranteed
 *
 * In theory, ErrorWatch should work on all of the following versions:
 *   - IE5.5+ (only 8.0 tested)
 *   - Firefox 0.9+ (only 3.5+ tested)
 *   - Opera 7+ (only 10.50 tested; versions 9 and earlier may require
 *     Exceptions Have Stacktrace to be enabled in opera:config)
 *   - Safari 3+ (only 4+ tested)
 *   - Chrome 1+ (only 5+ tested)
 *   - Konqueror 3.5+ (untested)
 *
 * Requires ErrorWatch.computeStackTrace.
 *
 * Tries to catch all unhandled exceptions and report them to the
 * subscribed handlers. Please note that ErrorWatch.report will rethrow the
 * exception. This is REQUIRED in order to get a useful stack trace in IE.
 * If the exception does not reach the top of the browser, you will only
 * get a stack trace from the point where ErrorWatch.report was called.
 *
 * Handlers receive a ErrorWatch.StackTrace object as described in the
 * ErrorWatch.computeStackTrace docs.
 *
 * @memberof ErrorWatch
 * @namespace
 */

import computeStackTrace from './computeStackTrace';
import {collectWindowErrors, reportFuncName} from './config';
import { _has } from './utils';
import { installResourceLoadError, uninstallResourceLoadError } from './resourceError';

// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error#Error_types
const ERROR_TYPES_RE = /^(?:[Uu]ncaught (?:exception: )?)?(?:((?:Eval|Internal|Range|Reference|Syntax|Type|URI|)Error): )?(.*)$/;


let handlers = [],
  lastException = null,
  lastExceptionStack = null;

/**
 * Add a crash handler.
 * @param {Function} handler
 * @memberof ErrorWatch.report
 */
function subscribe(handler) {
  installGlobalHandler();
  installGlobalUnhandledRejectionHandler();
  handlers.push(handler);
}

/**
 * Remove a crash handler.
 * @param {Function} handler
 * @memberof ErrorWatch.report
 */
function unsubscribe(handler) {
  for (let i = handlers.length - 1; i >= 0; --i) {
    if (handlers[i] === handler) {
      handlers.splice(i, 1);
    }
  }

  if (handlers.length === 0) {
    uninstallGlobalHandler();
    uninstallGlobalUnhandledRejectionHandler();
  }
}

/**
 * Dispatch stack information to all handlers.
 * @param {ErrorWatch.StackTrace} stack
 * @param {boolean} isWindowError Is this a top-level window error?
 * @param {Error=} error The error that's being handled (if available, null otherwise)
 * @memberof ErrorWatch.report
 * @throws An exception if an error occurs while calling an handler.
 */
function notifyHandlers(stack, isWindowError, error) {
  let exception = null;
  if (isWindowError && !collectWindowErrors) {
    return;
  }
  for (let i in handlers) {
    if (_has(handlers, i)) {
      try {
        handlers[i](stack, isWindowError, error);
      } catch (inner) {
        exception = inner;
      }
    }
  }

  if (exception) {
    throw exception;
  }
}

let _oldOnerrorHandler, _onErrorHandlerInstalled;
let _oldOnunhandledrejectionHandler, _onUnhandledRejectionHandlerInstalled;

/**
 * Ensures all global unhandled exceptions are recorded.
 * Supported by Gecko and IE.
 * @param {string} message Error message.
 * @param {string} url URL of script that generated the exception.
 * @param {(number|string)} lineNo The line number at which the error occurred.
 * @param {(number|string)=} columnNo The column number at which the error occurred.
 * @param {Error=} errorObj The actual Error object.
 * @memberof ErrorWatch.report
 */
function errorWatchWindowOnError(message, url, lineNo, columnNo, errorObj) {
  let stack = null;

  if (lastExceptionStack) {
    computeStackTrace.augmentStackTraceWithInitialElement(lastExceptionStack, url, lineNo, message);
    processLastException();
  } else if (errorObj) {
    stack = computeStackTrace(errorObj);
    notifyHandlers(stack, true, errorObj);
  } else {
    let location = {
      'url': url,
      'line': lineNo,
      'column': columnNo
    };

    let name;
    let msg = message; // must be new var or will modify original `arguments`
    if ({}.toString.call(message) === '[object String]') {
      const groups = message.match(ERROR_TYPES_RE);
      if (groups) {
        name = groups[1];
        msg = groups[2];
      }
    }

    location.func = computeStackTrace.guessFunctionName(location.url, location.line);
    location.context = computeStackTrace.gatherContext(location.url, location.line);
    stack = {
      'name': name,
      'message': msg,
      'mode': 'onerror',
      'stack': [location]
    };

    notifyHandlers(stack, true, null);
  }

  if (_oldOnerrorHandler) {
    return _oldOnerrorHandler.apply(this, arguments);
  }

  return false;
}

/**
 * Ensures all unhandled rejections are recorded.
 * @param {PromiseRejectionEvent} e event.
 * @memberof ErrorWatch.report
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onunhandledrejection
 * @see https://developer.mozilla.org/en-US/docs/Web/API/PromiseRejectionEvent
 */
function errorWatchWindowOnUnhandledRejection(e) {
  const stack = computeStackTrace(e.reason);
  notifyHandlers(stack, true, e.reason);
}

/**
 * Install a global onerror handler
 * @memberof ErrorWatch.report
 */
function installGlobalHandler() {
  if (_onErrorHandlerInstalled === true) {
    return;
  }

  _oldOnerrorHandler = window.onerror;
  window.onerror = errorWatchWindowOnError;
  installResourceLoadError(function handleResourceError(stack, isWindowError, error) {
    notifyHandlers(stack, isWindowError, error);
  });
  _onErrorHandlerInstalled = true;
}

/**
 * Uninstall the global onerror handler
 * @memberof ErrorWatch.report
 */
function uninstallGlobalHandler() {
  if (_onErrorHandlerInstalled) {
    window.onerror = _oldOnerrorHandler;
    uninstallResourceLoadError();
    _onErrorHandlerInstalled = false;
  }
}

/**
 * Install a global onunhandledrejection handler
 * @memberof ErrorWatch.report
 */
function installGlobalUnhandledRejectionHandler() {
  if (_onUnhandledRejectionHandlerInstalled === true) {
    return;
  }

  _oldOnunhandledrejectionHandler = window.onunhandledrejection;
  window.onunhandledrejection = errorWatchWindowOnUnhandledRejection;
  _onUnhandledRejectionHandlerInstalled = true;
}

/**
 * Uninstall the global onunhandledrejection handler
 * @memberof ErrorWatch.report
 */
function uninstallGlobalUnhandledRejectionHandler() {
  if (_onUnhandledRejectionHandlerInstalled) {
    window.onunhandledrejection = _oldOnunhandledrejectionHandler;
    _onUnhandledRejectionHandlerInstalled = false;
  }
}

/**
 * Process the most recent exception
 * @memberof ErrorWatch.report
 */
function processLastException() {
  let _lastExceptionStack = lastExceptionStack,
    _lastException = lastException;
  lastExceptionStack = null;
  lastException = null;
  notifyHandlers(_lastExceptionStack, false, _lastException);
}

/**
 * Reports an unhandled Error to ErrorWatch.
 * @param {Error} ex
 * @memberof ErrorWatch.report
 * @throws An exception if an incomplete stack trace is detected (old IE browsers).
 */
function report(ex) {
  if (lastExceptionStack) {
    if (lastException === ex) {
      return; // already caught by an inner catch block, ignore
    } else {
      processLastException();
    }
  }

  const stack = computeStackTrace(ex);
  lastExceptionStack = stack;
  lastException = ex;

  // If the stack trace is incomplete, wait for 2 seconds for
  // slow slow IE to see if onerror occurs or not before reporting
  // this exception; otherwise, we will end up with an incomplete
  // stack trace
  setTimeout(function () {
    if (lastException === ex) {
      processLastException();
    }
  }, (stack.incomplete ? 2000 : 0));

  throw ex; // re-throw to propagate to the top level (and cause window.onerror)
}

report.subscribe = subscribe;
report.unsubscribe = unsubscribe;

report.__name__ = reportFuncName;

export default report;
