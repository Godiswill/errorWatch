import report from "./report";

/**
 * Wrap any function in a ErrorWatch reporter<br/>
 * Example: `func = ErrorWatch.wrap(func);`
 *
 * @param {Function} func Function to be wrapped
 * @return {Function} The wrapped func
 * @memberof ErrorWatch
 */
export function wrap(func) {
  function wrapped() {
    try {
      return func.apply(this, arguments);
    } catch (e) {
      report(e);
      throw e;
    }
  }
  return wrapped;
}
