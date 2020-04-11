// 'use strict';
//
// describe('Resource Error', function () {
//   const ErrorWatch = require('../dist/errorWatch');
//
//   describe('load img', function () {
//     let cb = null;
//     let img = null;
//     beforeEach(function () {
//       img = document.createElement('img');
//       document.body.appendChild(img);
//       console.log('step1');
//     });
//     it('img should load error', function (done) {
//       function h1(stack, isWindowError, error) {
//         expect(stack.message).toBe(`img is load error`);
//         expect(stack.name).toMatch(`xxx.png`);
//         expect(stack.mode).toBe('resource');
//         expect(stack.stack).toBe(null);
//         done();
//       }
//       cb = h1;
//       ErrorWatch.report.subscribe(cb);
//       img.src = 'xxx.png';
//       console.log('step2');
//     });
//
//     afterEach(function () {
//       ErrorWatch.report.unsubscribe(cb);
//       img.remove();
//       img = null;
//       console.log('step3');
//     });
//   });
//
//   describe('load script', function () {
//     let cb = null;
//     let script = null;
//     beforeEach(function () {
//       script = document.createElement('script');
//       document.body.appendChild(script);
//       console.log('step4');
//     });
//     it('script should load error', function (done) {
//       function h2(stack, isWindowError, error) {
//         expect(stack.message).toBe(`script is load error`);
//         expect(stack.name).toMatch(`aaa.js`);
//         expect(stack.mode).toBe('resource');
//         expect(stack.stack).toBe(null);
//         done();
//       }
//       cb = h2;
//       ErrorWatch.report.subscribe(cb);
//       script.src = 'aaa.js';
//       console.log('step5');
//     });
//
//     afterEach(function () {
//       ErrorWatch.report.unsubscribe(cb);
//       script.remove();
//       script = null;
//       console.log('step6');
//     });
//   });
//
//   describe('uninstallResourceError', function () {
//     let cb = null;
//     let script = null;
//     let timerCallback = jest.fn();
//
//     beforeEach(function () {
//       script = document.createElement('script');
//       document.body.appendChild(script);
//
//       console.log('step7');
//     });
//
//     afterEach(function() {
//       // ErrorWatch.report.unsubscribe(cb);
//       script.remove();
//       console.log('step9');
//     });
//
//     it('not toHaveBeenCalled', function (done) {
//       function h3(stack, isWindowError, error) {
//         timerCallback();
//       }
//       cb = h3;
//       ErrorWatch.report.subscribe(cb);
//       ErrorWatch.report.unsubscribe(cb);
//       script.onerror = function() {
//         expect(timerCallback.mock.calls.length).toBe(0);
//         done();
//       };
//       script.src = 'bbb.js';
//       console.log('step8');
//     });
//   });
//
//
// });
