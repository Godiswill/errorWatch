import { wrap } from './wrap';

// global reference to slice
const _slice = [].slice;

/**
 * Extends support for global error handling for asynchronous browser
 * functions. Adopted from Closure Library's errorhandler.js
 * @memberof ErrorWatch
 */
function _helper(fnName) {
  const originalFn = window[fnName];

  window[fnName] = function errorWatchAsyncExtension() {
    // Make a copy of the arguments
    let args = _slice.call(arguments);
    const originalCallback = args[0];
    if (typeof (originalCallback) === 'function') {
      args[0] = wrap(originalCallback);
    }
    // IE < 9 doesn't support .call/.apply on setInterval/setTimeout, but it
    // also only supports 2 argument and doesn't care what "this" is, so we
    // can just call the original function directly.
    if (originalFn.apply) {
      return originalFn.apply(this, args);
    } else {
      return originalFn(args[0], args[1]);
    }
  };
}

export function extendToAsynchronousCallbacks() {
  _helper('setTimeout');
  _helper('setInterval');
}
