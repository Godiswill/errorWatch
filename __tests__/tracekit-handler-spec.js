'use strict';

describe('Handler', function () {
  const ErrorWatch = require('../dist/errorWatch');

  it('it should not go into an infinite loop', done => {
    let stacks = [];

    function handler(stackInfo) {
      stacks.push(stackInfo);
    }

    function throwException() {
      throw new Error('Boom!');
    }

    ErrorWatch.report.subscribe(handler);
    expect(function () {
      ErrorWatch.wrap(throwException)();
    }).toThrow();

    setTimeout(function () {
      ErrorWatch.report.unsubscribe(handler);
      expect(stacks.length).toBe(1);
      done();
    }, 1000);
  }, 2000);

  it('should get extra arguments (isWindowError and exception)', done => {
    const handler = jest.fn();
    const exception = new Error('Boom!');

    function throwException() {
      throw exception;
    }

    ErrorWatch.report.subscribe(handler);
    expect(function () {
      ErrorWatch.wrap(throwException)();
    }).toThrow();

    setTimeout(function () {
      ErrorWatch.report.unsubscribe(handler);

      expect(handler.mock.calls.length).toEqual(1);

      var isWindowError = handler.mock.calls[0][1];
      expect(isWindowError).toEqual(false);

      var e = handler.mock.calls[0][2];
      expect(e).toEqual(exception);

      done();
    }, 1000);
  }, 2000);

  // NOTE: This will not pass currently because errors are rethrown.
  /* it('it should call report handler once', function (done){
      var handlerCalledCount = 0;
      ErrorWatch.report.subscribe(function(stackInfo) {
          handlerCalledCount++;
      });

      function handleAndReportException() {
          try {
              a++;
          } catch (ex) {
              ErrorWatch.report(ex);
          }
      }

      expect(handleAndReportException).not.toThrow();
      setTimeout(function () {
          expect(handlerCalledCount).toBe(1);
          done();
      }, 1000);
  }, 2000); */
});
