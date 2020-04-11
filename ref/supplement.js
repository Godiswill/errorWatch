function exceptionalException(message) {
  'use strict';
  if (exceptionalException.emailErrors !== false) {
    exceptionalException.emailErrors = confirm('We had an error reporting an error! Please email us so we can fix it?');
  }
}
//test
//exceptionalException('try 1!');
//exceptionalException('try 2!');

//I have much better versions of the code below, you should totally bark at me if you want that code
var dev = (window.localStorage ? localStorage.getItem('workingLocally') : false);

/**
 * sendError
 * accepts string or object. if object, it gets stringified
 * if there is a failure to send due to being offline, it will retry in 2 minutes.
 */
function sendError(uniqueData) {
  'use strict';
  //hrmm..
  try {
    if (!uniqueData.stack) {
      uniqueData.stack = (new Error('make stack')).stack;
      if (uniqueData.stack) {
        uniqueData.stack = uniqueData.stack.toString();
      }
    }
  } catch (e) {}
  if (typeof uniqueData !== 'string') {
    uniqueData = JSON.stringify(uniqueData);
  }

  function jserrorPostFail() {
    checkOnline(function(online) {
      if (online) {
        //if online, alert error
        var args = [].slice.call(arguments, 0);
        var xhr;
        if (args[0].getAllResponseHeaders) {
          xhr = args[0];
        } else {
          xhr = args[2];
        }
        try {
          args.push('headers:' + xhr.getAllResponseHeaders());
        } catch (e) { }
        args.push('uniqueData: ' + uniqueData);
        exceptionalException(JSON.stringify(args));
      } else {
        //if offline, retry request
        console.log('failure from being offline. Will retry in 2 minutes.');
        setTimeout(function offlineRetryIn2Min() {
          fireRequest();
        }, 1000 * 60 * 2); //2 minutes
      }
    });
  };

  function fireRequest() {
    var data = {'sub.domain.com': uniqueData};
    if (dev) {
      data = {'dev': 'test'}; //still send intentionally failiing request to better simulate production
      console.error(uniqueData);
    }
    console.warn('sendError');
    $.ajax({
      url: 'https://foo.com/jserror/',
      type: 'POST', //POST has no request size limit like GET
      data: data
    })
      .fail(jserrorPostFail)
      .done(function jserrorPostDone(resp) {
        console.warn('sendError END ' + resp);
        if (resp.status === 'error') {
          jserrorPostFail.apply(this, arguments);
        }
      });
  }
  fireRequest();
}

TraceKit.report.subscribe(sendError);


/**
 * Usage:
 * $.ajax()
 * .fail(ajaxFail(function(){
 *   //apology: alert('Sorry that action failed')
 * }))
 *
 * In the future, I hope to directly modify the fail function to only trigger when there's actually a server or api error
 * Failures due to beign offline will go into a que, and the window onoffline event will trigger.
 * Polling every X seconds can be done to try and get back online, and trigger window ononline handler
 */
function ajaxFail(apology) {
  if (!apology) {
    apology = function noop(){};
  } else if (apology.getAllResponseHeaders) {
    alert('You are supposed to call ajaxFail like: ajaxFail(), you can pass in a callback to alert a sorry message to the user if you want.');
  }
  return function ajaxFailFnName(xhr, status, errorThrown) {
    var args = [].slice.call(arguments, 0);
    apology.apply(this, args);
    var headers = xhr.getAllResponseHeaders();
    if (headers) {
      args.push('headers:' + headers);
    }
    checkOnline(function ajaxFailCheckOffline(online) {
      if (online) {
        sendError(args);
      } else {
        //que or something to retry, but don't save to localStorage, just the in-page memory
        //Storing to localStorage would result in pretty unpredictable behavior
        //for users and probably other js code too.

        //I also plan to
      }
    });
  };
}

//checkOnline is defined in check-online.js: http://github.com/devinrhode2/check-online



//OTHER I DONT KNOW POTENTIALLY BETTER VERSION

var exceptionalException = function exceptionalExceptionF(message) {
  'use strict';
  alert('HOLY MOLY! Please email this error to support@'+location.host+'.com: \n\nSubject:Error\n' + message);
};

/**
 * sendError
 * accepts string or object. if object, it gets stringified
 * if there is a failure to send due to being offline, it will retry in 2 minutes.
 */
function sendError(error) {
  'use strict';
  try {
    if (!error.stack) {
      error.stack = (new Error('force-added stack')).stack;
      if (error.stack) {
        error.stack = error.stack.toString();
      }
    }
  } catch (e) {}

  if (typeof uniqueData !== 'string') {
    uniqueData = JSON.stringify(uniqueData);
  }

  $.ajax({
    url: 'https://parsing-api.trackif.com/jserror/',
    type: 'POST',
    data: data
  })
    .fail(jserrorPostFail)
    .done(function jserrorPostDone(resp) {
      console.warn('sendError END ' + resp);
      if (resp.status === 'error') {
        jserrorPostFail.apply(this, arguments);
      }
    });
}

//override
(function jQueryAjaxOverride($) {

  //apologizeAndReport, for when we have an error with the request and we're online:
  //Broken out of ajaxFail for less memory use.
  function apologizeAndReport(args, apology) {
    sendError(args);
    //Maybe TraceKit.report(Error('ajax error'), args); //... probably...
    try {
      //if you do $.ajax().fail(ajaxFail) this will throw because apology will the the xhr object and not a function
      apology && apology.apply(this, args);
    } catch (e) {
      //if you did $.ajax().fail(ajaxFail) we know what's up
      if (apology.getAllResponseHeaders) {
        alert('You are supposed to call ajaxFail like: \n' +
          '$.ajax().fail(ajaxFail(function(){ \n' +
          'alert(\'sorry we suck\'); \n' +
          '}))');
      } else { //else user has error in apology
        throw e;
      }
    }
  }

  function ajaxFail(apology) {
    return function ajaxFailsFnForjQuery(xhr, status, errorThrown) {
      checkOnline(function ajaxFailCheckOffline(online) {
        if (online) {
          //looks like we have an explicit error reponse
          apologizeAndReport.call(this, args, apology);
        } else {
          //que or something to retry, but don't save to localStorage, just the in-page memory
          //Storing to localStorage would result in pretty unpredictable behavior
          //for users and probably other js code too.
          runAjax();
        }
      }, arguments);
    };
  }

  extendFunction('$.ajax', function ajaxExtension(ajaxArgs, normalAjax) {
    //let's re-attempt every 2 minutes.
    if (ajaxArgs[1].reconnect) {

    }

    function runAjax() {
      var jax = normalAjax.apply(this, ajaxArgs);
      jax.fail = extendFunction(jax.fail, function failOverride(args, oldFail) {
        return oldFail(
          ajaxFail(
            args[0], //args[0] is the failureCallback
            ajaxArgs[1].reconnect || ajaxArgs[0].reconnect
          )
        );
      });
      return jax;
    }
    return runAjax();
  });

  //$.ajax.reconnect(); //try reconnecting, you can manually make //return setTimeout that you can override? OR if no timeout arg, default..

}(jQuery));
