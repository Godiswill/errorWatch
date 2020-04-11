/**
 * An object representing a single stack frame.
 * @typedef {Object} StackFrame
 * @property {string} url The JavaScript or HTML file URL.
 * @property {string} func The function name, or empty for anonymous functions (if guessing did not work).
 * @property {string[]?} args The arguments passed to the function, if known.
 * @property {number=} line The line number, if known.
 * @property {number=} column The column number, if known.
 * @property {string[]} context An array of source code lines; the middle element corresponds to the correct line#.
 * @memberof ErrorWatch
 */
/**
 * An object representing a JavaScript stack trace.
 * @typedef {Object} StackTrace
 * @property {string} name The name of the thrown exception.
 * @property {string} message The exception error message.
 * @property {ErrorWatch.StackFrame[]} stack An array of stack frames.
 * @property {string} mode 'stack', 'stacktrace', 'multiline', 'callers', 'onerror', or 'failed' -- method used to collect the stack trace.
 * @memberof ErrorWatch
 */
/**
 * ErrorWatch.computeStackTrace: cross-browser stack traces in JavaScript
 *
 * Syntax:
 *   ```js
 *   s = ErrorWatch.computeStackTrace.ofCaller([depth])
 *   s = ErrorWatch.computeStackTrace(exception) // consider using ErrorWatch.report instead (see below)
 *   ```
 *
 * Supports:
 *   - Firefox:  full stack trace with line numbers and unreliable column
 *               number on top frame
 *   - Opera 10: full stack trace with line and column numbers
 *   - Opera 9-: full stack trace with line numbers
 *   - Chrome:   full stack trace with line and column numbers
 *   - Safari:   line and column number for the topmost stacktrace element
 *               only
 *   - IE:       no line numbers whatsoever
 *
 * Tries to guess names of anonymous functions by looking for assignments
 * in the source code. In IE and Safari, we have to guess source file names
 * by searching for function bodies inside all page scripts. This will not
 * work for scripts that are loaded cross-domain.
 * Here be dragons: some function names may be guessed incorrectly, and
 * duplicate functions may be mismatched.
 *
 * ErrorWatch.computeStackTrace should only be used for tracing purposes.
 * Logging of unhandled exceptions should be done with ErrorWatch.report,
 * which builds on top of ErrorWatch.computeStackTrace and provides better
 * IE support by utilizing the window.onerror event to retrieve information
 * about the top of the stack.
 *
 * Note: In IE and Safari, no stack trace is recorded on the Error object,
 * so computeStackTrace instead walks its *own* chain of callers.
 * This means that:
 *  * in Safari, some methods may be missing from the stack trace;
 *  * in IE, the topmost function in the stack trace will always be the
 *    caller of computeStackTrace.
 *
 * This is okay for tracing (because you are likely to be calling
 * computeStackTrace from the function you want to be the topmost element
 * of the stack trace anyway), but not okay for logging unhandled
 * exceptions (because your catch block will likely be far away from the
 * inner function that actually caused the exception).
 *
 * Tracing example:
 *  ```js
 *     function trace(message) {
 *         var stackInfo = ErrorWatch.computeStackTrace.ofCaller();
 *         var data = message + "\n";
 *         for(var i in stackInfo.stack) {
 *             var item = stackInfo.stack[i];
 *             data += (item.func || '[anonymous]') + "() in " + item.url + ":" + (item.line || '0') + "\n";
 *         }
 *         if (window.console)
 *             console.info(data);
 *         else
 *             alert(data);
 *     }
 * ```
 * @memberof ErrorWatch
 * @namespace
 */
import { remoteFetching, linesOfContext, debug, reportFuncName } from './config';
import { _has, _isUndefined } from './utils';

const UNKNOWN_FUNCTION = '?';

let sourceCache = {};

/**
 * Attempts to retrieve source code via XMLHttpRequest, which is used
 * to look up anonymous function names.
 * @param {string} url URL of source code.
 * @return {string} Source contents.
 * @memberof ErrorWatch.computeStackTrace
 */
function loadSource(url) {
  if (!remoteFetching) { //Only attempt request if remoteFetching is on.
    return '';
  }
  try {
    const getXHR = function() {
      try {
        return new window.XMLHttpRequest();
      } catch (e) {
        // explicitly bubble up the exception if not found
        return new window.ActiveXObject('Microsoft.XMLHTTP');
      }
    };

    const request = getXHR();
    request.open('GET', url, false);
    request.send('');
    return request.responseText;
  } catch (e) {
    return '';
  }
}

/**
 * Retrieves source code from the source code cache.
 * @param {string} url URL of source code.
 * @return {Array.<string>} Source contents.
 * @memberof ErrorWatch.computeStackTrace
 */
function getSource(url) {
  if (typeof url !== 'string') {
    return [];
  }

  if (!_has(sourceCache, url)) {
    // URL needs to be able to fetched within the acceptable domain.  Otherwise,
    // cross-domain errors will be triggered.
    /*
        Regex matches:
        0 - Full Url
        1 - Protocol
        2 - Domain
        3 - Port (Useful for internal applications)
        4 - Path
    */
    let source = '',
        domain = '';
    try { domain = window.document.domain; } catch (e) { }
    const match = /(.*)\:\/\/([^:\/]+)([:\d]*)\/{0,1}([\s\S]*)/.exec(url);
    if (match && match[2] === domain) {
      source = loadSource(url);
    }
    sourceCache[url] = source ? source.split('\n') : [];
  }

  return sourceCache[url];
}

/**
 * Tries to use an externally loaded copy of source code to determine
 * the name of a function by looking at the name of the variable it was
 * assigned to, if any.
 * @param {string} url URL of source code.
 * @param {(string|number)} lineNo Line number in source code.
 * @return {string} The function name, if discoverable.
 * @memberof ErrorWatch.computeStackTrace
 */
function guessFunctionName(url, lineNo) {
  const reFunctionArgNames = /function ([^(]*)\(([^)]*)\)/,
    reGuessFunction = /['"]?([0-9A-Za-z$_]+)['"]?\s*[:=]\s*(function|eval|new Function)/,
    maxLines = 10,
    source = getSource(url);
  let line = '', m;

  if (!source.length) {
    return UNKNOWN_FUNCTION;
  }

  // Walk backwards from the first line in the function until we find the line which
  // matches the pattern above, which is the function definition
  for (let i = 0; i < maxLines; ++i) {
    line = source[lineNo - i] + line;

    if (!_isUndefined(line)) { // 这里有个bug，永远为 true
      if ((m = reGuessFunction.exec(line))) {
        return m[1];
      } else if ((m = reFunctionArgNames.exec(line))) {
        return m[1];
      }
    }
  }

  return UNKNOWN_FUNCTION;
}

/**
 * Retrieves the surrounding lines from where an exception occurred.
 * @param {string} url URL of source code.
 * @param {(string|number)} line Line number in source code to center around for context.
 * @return {?Array.<string>} Lines of source code.
 * @memberof ErrorWatch.computeStackTrace
 */
function gatherContext(url, line) {
  const source = getSource(url);

  if (!source.length) {
    return null;
  }

  let context = [],
    // linesBefore & linesAfter are inclusive with the offending line.
    // if linesOfContext is even, there will be one extra line
    //   *before* the offending line.
    linesBefore = Math.floor(linesOfContext / 2),
    // Add one extra line if linesOfContext is odd
    linesAfter = linesBefore + (linesOfContext % 2),
    start = Math.max(0, line - linesBefore - 1),
    end = Math.min(source.length, line + linesAfter - 1);

  line -= 1; // convert to 0-based index

  for (let i = start; i < end; ++i) {
    if (!_isUndefined(source[i])) {
      context.push(source[i]);
    }
  }

  return context.length > 0 ? context : null;
}

/**
 * Escapes special characters, except for whitespace, in a string to be
 * used inside a regular expression as a string literal.
 * @param {string} text The string.
 * @return {string} The escaped string literal.
 * @memberof ErrorWatch.computeStackTrace
 */
function escapeRegExp(text) {
  return text.replace(/[\-\[\]{}()*+?.,\\\^$|#]/g, '\\$&');
}

/**
 * Escapes special characters in a string to be used inside a regular
 * expression as a string literal. Also ensures that HTML entities will
 * be matched the same as their literal friends.
 * @param {string} body The string.
 * @return {string} The escaped string.
 * @memberof ErrorWatch.computeStackTrace
 */
function escapeCodeAsRegExpForMatchingInsideHTML(body) {
  return escapeRegExp(body).replace('<', '(?:<|&lt;)').replace('>', '(?:>|&gt;)').replace('&', '(?:&|&amp;)').replace('"', '(?:"|&quot;)').replace(/\s+/g, '\\s+');
}

/**
 * Determines where a code fragment occurs in the source code.
 * @param {RegExp} re The function definition.
 * @param {Array.<string>} urls A list of URLs to search.
 * @return {?Object.<string, (string|number)>} An object containing
 * the url, line, and column number of the defined function.
 * @memberof ErrorWatch.computeStackTrace
 */
function findSourceInUrls(re, urls) {
  let source, m;
  for (let i = 0, j = urls.length; i < j; ++i) {
    if ((source = getSource(urls[i])).length) {
      source = source.join('\n');
      if ((m = re.exec(source))) {

        return {
          'url': urls[i],
          'line': source.substring(0, m.index).split('\n').length,
          'column': m.index - source.lastIndexOf('\n', m.index) - 1
        };
      }
    }
  }

  return null;
}

/**
 * Determines at which column a code fragment occurs on a line of the
 * source code.
 * @param {string} fragment The code fragment.
 * @param {string} url The URL to search.
 * @param {(string|number)} line The line number to examine.
 * @return {?number} The column number.
 * @memberof ErrorWatch.computeStackTrace
 */
function findSourceInLine(fragment, url, line) {
  const source = getSource(url),
    re = new RegExp('\\b' + escapeRegExp(fragment) + '\\b');
  let m;

  line -= 1;

  if (source && source.length > line && (m = re.exec(source[line]))) {
    return m.index;
  }

  return null;
}

/**
 * Determines where a function was defined within the source code.
 * @param {(Function|string)} func A function reference or serialized
 * function definition.
 * @return {?Object.<string, (string|number)>} An object containing
 * the url, line, and column number of the defined function.
 * @memberof ErrorWatch.computeStackTrace
 */
function findSourceByFunctionBody(func) {
  if (_isUndefined(window && window.document)) {
    return null;
  }

  const urls = [window.location.href],
    scripts = window.document.getElementsByTagName('script'),
    code = '' + func,
    codeRE = /^function(?:\s+([\w$]+))?\s*\(([\w\s,]*)\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/,
    eventRE = /^function on([\w$]+)\s*\(event\)\s*\{\s*(\S[\s\S]*\S)\s*\}\s*$/;
  let body,
    re,
    parts,
    result;

  for (let i = 0; i < scripts.length; ++i) {
    const script = scripts[i];
    if (script.src) {
      urls.push(script.src);
    }
  }

  if (!(parts = codeRE.exec(code))) {
    re = new RegExp(escapeRegExp(code).replace(/\s+/g, '\\s+'));
  }

  // not sure if this is really necessary, but I don’t have a test
  // corpus large enough to confirm that and it was in the original.
  else {
    const name = parts[1] ? '\\s+' + parts[1] : '',
      args = parts[2].split(',').join('\\s*,\\s*');

    body = escapeRegExp(parts[3]).replace(/;$/, ';?'); // semicolon is inserted if the function ends with a comment.replace(/\s+/g, '\\s+');
    re = new RegExp('function' + name + '\\s*\\(\\s*' + args + '\\s*\\)\\s*{\\s*' + body + '\\s*}');
  }

  // look for a normal function definition
  if ((result = findSourceInUrls(re, urls))) {
    return result;
  }

  // look for an old-school event handler function
  if ((parts = eventRE.exec(code))) {
    const event = parts[1];
    body = escapeCodeAsRegExpForMatchingInsideHTML(parts[2]);

    // look for a function defined in HTML as an onXXX handler
    re = new RegExp('on' + event + '=[\\\'"]\\s*' + body + '\\s*[\\\'"]', 'i');

    if ((result = findSourceInUrls(re, urls[0]))) {
      return result;
    }

    // look for ???
    re = new RegExp(body);

    if ((result = findSourceInUrls(re, urls))) {
      return result;
    }
  }

  return null;
}

// Contents of Exception in various browsers.
//
// SAFARI:
// ex.message = Can't find variable: qq
// ex.line = 59
// ex.sourceId = 580238192
// ex.sourceURL = http://...
// ex.expressionBeginOffset = 96
// ex.expressionCaretOffset = 98
// ex.expressionEndOffset = 98
// ex.name = ReferenceError
//
// FIREFOX:
// ex.message = qq is not defined
// ex.fileName = http://...
// ex.lineNumber = 59
// ex.columnNumber = 69
// ex.stack = ...stack trace... (see the example below)
// ex.name = ReferenceError
//
// CHROME:
// ex.message = qq is not defined
// ex.name = ReferenceError
// ex.type = not_defined
// ex.arguments = ['aa']
// ex.stack = ...stack trace...
//
// INTERNET EXPLORER:
// ex.message = ...
// ex.name = ReferenceError
//
// OPERA:
// ex.message = ...message... (see the example below)
// ex.name = ReferenceError
// ex.opera#sourceloc = 11  (pretty much useless, duplicates the info in ex.message)
// ex.stacktrace = n/a; see 'opera:config#UserPrefs|Exceptions Have Stacktrace'

/**
 * Computes stack trace information from the stack property.
 * Chrome and Gecko use this property.
 * @param {Error} ex
 * @return {?ErrorWatch.StackTrace} Stack trace information.
 * @memberof ErrorWatch.computeStackTrace
 */
function computeStackTraceFromStackProp(ex) {
  if (!ex.stack) {
    return null;
  }

  const chrome = /^\s*at (.*?) ?\(((?:file|https?|blob|chrome-extension|native|eval|webpack|<anonymous>|\/).*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i,
    gecko = /^\s*(.*?)(?:\((.*?)\))?(?:^|@)((?:file|https?|blob|chrome|webpack|resource|\[native).*?|[^@]*bundle)(?::(\d+))?(?::(\d+))?\s*$/i,
    winjs = /^\s*at (?:((?:\[object object\])?.+) )?\(?((?:file|ms-appx|https?|webpack|blob):.*?):(\d+)(?::(\d+))?\)?\s*$/i,

    geckoEval = /(\S+) line (\d+)(?: > eval line \d+)* > eval/i,
    chromeEval = /\((\S*)(?::(\d+))(?::(\d+))\)/,

    lines = ex.stack.split('\n'),
    reference = /^(.*) is undefined$/.exec(ex.message);
  let stack = [],
    // Used to additionally parse URL/line/column from eval frames
    isEval,
    submatch,
    parts,
    element;

  for (let i = 0, j = lines.length; i < j; ++i) {
    if ((parts = chrome.exec(lines[i]))) {
      const isNative = parts[2] && parts[2].indexOf('native') === 0; // start of line
      isEval = parts[2] && parts[2].indexOf('eval') === 0; // start of line
      if (isEval && (submatch = chromeEval.exec(parts[2]))) {
        // throw out eval line/column and use top-most line/column number
        parts[2] = submatch[1]; // url
        parts[3] = submatch[2]; // line
        parts[4] = submatch[3]; // column
      }
      element = {
        'url': !isNative ? parts[2] : null,
        'func': parts[1] || UNKNOWN_FUNCTION,
        'args': isNative ? [parts[2]] : [],
        'line': parts[3] ? +parts[3] : null,
        'column': parts[4] ? +parts[4] : null
      };
    } else if ( parts = winjs.exec(lines[i]) ) {
      element = {
        'url': parts[2],
        'func': parts[1] || UNKNOWN_FUNCTION,
        'args': [],
        'line': +parts[3],
        'column': parts[4] ? +parts[4] : null
      };
    } else if ((parts = gecko.exec(lines[i]))) {
      isEval = parts[3] && parts[3].indexOf(' > eval') > -1;
      if (isEval && (submatch = geckoEval.exec(parts[3]))) {
        // throw out eval line/column and use top-most line number
        parts[3] = submatch[1];
        parts[4] = submatch[2];
        parts[5] = null; // no column when eval
      } else if (i === 0 && !parts[5] && !_isUndefined(ex.columnNumber)) {
        // FireFox uses this awesome columnNumber property for its top frame
        // Also note, Firefox's column number is 0-based and everything else expects 1-based,
        // so adding 1
        // NOTE: this hack doesn't work if top-most frame is eval
        stack[0].column = ex.columnNumber + 1;
      }
      element = {
        'url': parts[3],
        'func': parts[1] || UNKNOWN_FUNCTION,
        'args': parts[2] ? parts[2].split(',') : [],
        'line': parts[4] ? +parts[4] : null,
        'column': parts[5] ? +parts[5] : null
      };
    } else {
      continue;
    }

    if (!element.func && element.line) {
      element.func = guessFunctionName(element.url, element.line);
    }

    element.context = element.line ? gatherContext(element.url, element.line) : null;
    stack.push(element);
  }

  if (!stack.length) {
    return null;
  }

  if (stack[0] && stack[0].line && !stack[0].column && reference) {
    stack[0].column = findSourceInLine(reference[1], stack[0].url, stack[0].line);
  }

  return {
    'mode': 'stack',
    'name': ex.name,
    'message': ex.message,
    'stack': stack
  };
}

/**
 * Computes stack trace information from the stacktrace property.
 * Opera 10+ uses this property.
 * @param {Error} ex
 * @return {?ErrorWatch.StackTrace} Stack trace information.
 * @memberof ErrorWatch.computeStackTrace
 */
function computeStackTraceFromStacktraceProp(ex) {
  // Access and store the stacktrace property before doing ANYTHING
  // else to it because Opera is not very good at providing it
  // reliably in other circumstances.
  const stacktrace = ex.stacktrace;
  if (!stacktrace) {
    return;
  }

  const opera10Regex = / line (\d+).*script (?:in )?(\S+)(?:: in function (\S+))?$/i,
    opera11Regex = / line (\d+), column (\d+)\s*(?:in (?:<anonymous function: ([^>]+)>|([^\)]+))\((.*)\))? in (.*):\s*$/i,
    lines = stacktrace.split('\n');
  let stack = [],
    parts;

  for (let line = 0; line < lines.length; line += 2) {
    let element = null;
    if ((parts = opera10Regex.exec(lines[line]))) {
      element = {
        'url': parts[2],
        'line': +parts[1],
        'column': null,
        'func': parts[3],
        'args':[]
      };
    } else if ((parts = opera11Regex.exec(lines[line]))) {
      element = {
        'url': parts[6],
        'line': +parts[1],
        'column': +parts[2],
        'func': parts[3] || parts[4],
        'args': parts[5] ? parts[5].split(',') : []
      };
    }

    if (element) {
      if (!element.func && element.line) {
        element.func = guessFunctionName(element.url, element.line);
      }
      if (element.line) {
        try {
          element.context = gatherContext(element.url, element.line);
        } catch (exc) {}
      }

      if (!element.context) {
        element.context = [lines[line + 1]];
      }

      stack.push(element);
    }
  }

  if (!stack.length) {
    return null;
  }

  return {
    'mode': 'stacktrace',
    'name': ex.name,
    'message': ex.message,
    'stack': stack
  };
}

/**
 * NOT TESTED.
 * Computes stack trace information from an error message that includes
 * the stack trace.
 * Opera 9 and earlier use this method if the option to show stack
 * traces is turned on in opera:config.
 * @param {Error} ex
 * @return {?ErrorWatch.StackTrace} Stack information.
 * @memberof ErrorWatch.computeStackTrace
 */
function computeStackTraceFromOperaMultiLineMessage(ex) {
  // TODO: Clean this function up
  // Opera includes a stack trace into the exception message. An example is:
  //
  // Statement on line 3: Undefined variable: undefinedFunc
  // Backtrace:
  //   Line 3 of linked script file://localhost/Users/andreyvit/Projects/ErrorWatch/javascript-client/sample.js: In function zzz
  //         undefinedFunc(a);
  //   Line 7 of inline#1 script in file://localhost/Users/andreyvit/Projects/ErrorWatch/javascript-client/sample.html: In function yyy
  //           zzz(x, y, z);
  //   Line 3 of inline#1 script in file://localhost/Users/andreyvit/Projects/ErrorWatch/javascript-client/sample.html: In function xxx
  //           yyy(a, a, a);
  //   Line 1 of function script
  //     try { xxx('hi'); return false; } catch(ex) { ErrorWatch.report(ex); }
  //   ...

  const lines = ex.message.split('\n');
  if (lines.length < 4) {
    return null;
  }

  const lineRE1 = /^\s*Line (\d+) of linked script ((?:file|https?|blob)\S+)(?:: in function (\S+))?\s*$/i,
    lineRE2 = /^\s*Line (\d+) of inline#(\d+) script in ((?:file|https?|blob)\S+)(?:: in function (\S+))?\s*$/i,
    lineRE3 = /^\s*Line (\d+) of function script\s*$/i,
    stack = [],
    scripts = (window && window.document && window.document.getElementsByTagName('script'));
  let inlineScriptBlocks = [],
    parts;

  for (let s in scripts) {
    if (_has(scripts, s) && !scripts[s].src) {
      inlineScriptBlocks.push(scripts[s]);
    }
  }

  for (let line = 2; line < lines.length; line += 2) {
    let item = null;
    if ((parts = lineRE1.exec(lines[line]))) {
      item = {
        'url': parts[2],
        'func': parts[3],
        'args': [],
        'line': +parts[1],
        'column': null
      };
    } else if ((parts = lineRE2.exec(lines[line]))) {
      item = {
        'url': parts[3],
        'func': parts[4],
        'args': [],
        'line': +parts[1],
        'column': null // TODO: Check to see if inline#1 (+parts[2]) points to the script number or column number.
      };
      const relativeLine = (+parts[1]); // relative to the start of the <SCRIPT> block
      const script = inlineScriptBlocks[parts[2] - 1];
      if (script) {
        let source = getSource(item.url);
        if (source) {
          source = source.join('\n');
          const pos = source.indexOf(script.innerText);
          if (pos >= 0) {
            item.line = relativeLine + source.substring(0, pos).split('\n').length;
          }
        }
      }
    } else if ((parts = lineRE3.exec(lines[line]))) {
      const url = window.location.href.replace(/#.*$/, '');
      const re = new RegExp(escapeCodeAsRegExpForMatchingInsideHTML(lines[line + 1]));
      const src = findSourceInUrls(re, [url]);
      item = {
        'url': url,
        'func': '',
        'args': [],
        'line': src ? src.line : parts[1],
        'column': null
      };
    }

    if (item) {
      if (!item.func) {
        item.func = guessFunctionName(item.url, item.line);
      }
      const context = gatherContext(item.url, item.line);
      const midline = (context ? context[Math.floor(context.length / 2)] : null);
      if (context && midline.replace(/^\s*/, '') === lines[line + 1].replace(/^\s*/, '')) {
        item.context = context;
      } else {
        // if (context) alert("Context mismatch. Correct midline:\n" + lines[i+1] + "\n\nMidline:\n" + midline + "\n\nContext:\n" + context.join("\n") + "\n\nURL:\n" + item.url);
        item.context = [lines[line + 1]];
      }
      stack.push(item);
    }
  }
  if (!stack.length) {
    return null; // could not parse multiline exception message as Opera stack trace
  }

  return {
    'mode': 'multiline',
    'name': ex.name,
    'message': lines[0],
    'stack': stack
  };
}

/**
 * Adds information about the first frame to incomplete stack traces.
 * Safari and IE require this to get complete data on the first frame.
 * @param {ErrorWatch.StackTrace} stackInfo Stack trace information from
 * one of the compute* methods.
 * @param {string} url The URL of the script that caused an error.
 * @param {(number|string)} lineNo The line number of the script that
 * caused an error.
 * @param {string=} message The error generated by the browser, which
 * hopefully contains the name of the object that caused the error.
 * @return {boolean} Whether or not the stack information was
 * augmented.
 * @memberof ErrorWatch.computeStackTrace
 */
function augmentStackTraceWithInitialElement(stackInfo, url, lineNo, message) {
  let initial = {
    'url': url,
    'line': lineNo
  };

  if (initial.url && initial.line) {
    stackInfo.incomplete = false;

    if (!initial.func) {
      initial.func = guessFunctionName(initial.url, initial.line);
    }

    if (!initial.context) {
      initial.context = gatherContext(initial.url, initial.line);
    }

    const reference = / '([^']+)' /.exec(message);
    if (reference) {
      initial.column = findSourceInLine(reference[1], initial.url, initial.line);
    }

    if (stackInfo.stack.length > 0) {
      if (stackInfo.stack[0].url === initial.url) {
        if (stackInfo.stack[0].line === initial.line) {
          return false; // already in stack trace
        } else if (!stackInfo.stack[0].line && stackInfo.stack[0].func === initial.func) {
          stackInfo.stack[0].line = initial.line;
          stackInfo.stack[0].context = initial.context;
          return false;
        }
      }
    }

    stackInfo.stack.unshift(initial);
    stackInfo.partial = true;
    return true;
  } else {
    stackInfo.incomplete = true;
  }

  return false;
}

/**
 * Computes stack trace information by walking the arguments.caller
 * chain at the time the exception occurred. This will cause earlier
 * frames to be missed but is the only way to get any stack trace in
 * Safari and IE. The top frame is restored by
 * {@link augmentStackTraceWithInitialElement}.
 * @param {Error} ex
 * @return {ErrorWatch.StackTrace=} Stack trace information.
 * @memberof ErrorWatch.computeStackTrace
 */
function computeStackTraceByWalkingCallerChain(ex, depth) {
  const functionName = /function\s+([_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*)?\s*\(/i;
  let stack = [],
    funcs = {},
    recursion = false,
    parts,
    item,
    source;

  for (let curr = computeStackTraceByWalkingCallerChain.caller; curr && !recursion; curr = curr.caller) {
    if (curr === computeStackTrace || (curr && curr.__name__ === reportFuncName)) { // curr ===  report 避免循环依赖
      continue;
    }

    item = {
      'url': null,
      'func': UNKNOWN_FUNCTION,
      'args': [],
      'line': null,
      'column': null
    };

    if (curr.name) {
      item.func = curr.name;
    } else if ((parts = functionName.exec(curr.toString()))) {
      item.func = parts[1];
    }

    if (typeof item.func === 'undefined') {
      try {
        item.func = parts.input.substring(0, parts.input.indexOf('{'));
      } catch (e) { }
    }

    if ((source = findSourceByFunctionBody(curr))) {
      item.url = source.url;
      item.line = source.line;

      if (item.func === UNKNOWN_FUNCTION) {
        item.func = guessFunctionName(item.url, item.line);
      }

      const reference = / '([^']+)' /.exec(ex.message || ex.description);
      if (reference) {
        item.column = findSourceInLine(reference[1], source.url, source.line);
      }
    }

    if (funcs['' + curr]) {
      recursion = true;
    }else{
      funcs['' + curr] = true;
    }

    stack.push(item);
  }

  if (depth) {
    stack.splice(0, depth);
  }

  let result = {
    'mode': 'callers',
    'name': ex.name,
    'message': ex.message,
    'stack': stack
  };
  augmentStackTraceWithInitialElement(result, ex.sourceURL || ex.fileName, ex.line || ex.lineNumber, ex.message || ex.description);
  return result;
}

/**
 * Computes a stack trace for an exception.
 * @param {Error} ex
 * @param {(string|number)=} depth
 * @memberof ErrorWatch.computeStackTrace
 */
function computeStackTrace(ex, depth) {
  let stack = null;
  depth = (depth == null ? 0 : +depth);

  try {
    // This must be tried first because Opera 10 *destroys*
    // its stacktrace property if you try to access the stack
    // property first!!
    stack = computeStackTraceFromStacktraceProp(ex);
    if (stack) {
      return stack;
    }
  } catch (e) {
    if (debug) {
      throw e;
    }
  }

  try {
    stack = computeStackTraceFromStackProp(ex);
    if (stack) {
      return stack;
    }
  } catch (e) {
    if (debug) {
      throw e;
    }
  }

  try {
    stack = computeStackTraceFromOperaMultiLineMessage(ex);
    if (stack) {
      return stack;
    }
  } catch (e) {
    if (debug) {
      throw e;
    }
  }

  try {
    stack = computeStackTraceByWalkingCallerChain(ex, depth + 1);
    if (stack) {
      return stack;
    }
  } catch (e) {
    if (debug) {
      throw e;
    }
  }

  return {
    'name': ex.name,
    'message': ex.message,
    'mode': 'failed'
  };
}

/**
 * Logs a stacktrace starting from the previous call and working down.
 * @param {(number|string)=} depth How many frames deep to trace.
 * @return {ErrorWatch.StackTrace} Stack trace information.
 * @memberof ErrorWatch.computeStackTrace
 */
function computeStackTraceOfCaller(depth) {
  depth = (depth == null ? 0 : +depth) + 1; // "+ 1" because "ofCaller" should drop one frame
  try {
    throw new Error();
  } catch (ex) {
    return computeStackTrace(ex, depth + 1);
  }
}

computeStackTrace.augmentStackTraceWithInitialElement = augmentStackTraceWithInitialElement;
computeStackTrace.computeStackTraceFromStackProp = computeStackTraceFromStackProp;
computeStackTrace.guessFunctionName = guessFunctionName;
computeStackTrace.gatherContext = gatherContext;
computeStackTrace.ofCaller = computeStackTraceOfCaller;
computeStackTrace.getSource = getSource;

export default computeStackTrace;
