import report from './report';
import computeStackTrace from './computeStackTrace';
import {wrap} from './wrap';
import { extendToAsynchronousCallbacks } from './tryCatch';

const _oldErrorWatch = window.ErrorWatch;
let ErrorWatch;
/**
 * Export ErrorWatch out to another variable<br/>
 * Example: `var TK = ErrorWatch.noConflict()`
 * @return {Object} The ErrorWatch object
 * @memberof ErrorWatch
 */
function noConflict() {
  window.ErrorWatch = _oldErrorWatch;
  return ErrorWatch;
}

function makeError() {
  const tmp = thisIsAbug;
  return tmp + '';
}

ErrorWatch =  {
  noConflict,
  report,
  computeStackTrace,
  wrap,
  extendToAsynchronousCallbacks,
  makeError,
};

export default ErrorWatch;
