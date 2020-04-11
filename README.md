# 前端错误解析

根据 [TraceKit](https://github.com/csnover/TraceKit) 改造。
改动点：

1. 使用 `es6` 对源文件进行改写，根据功能拆分成小文件便于维护；
1. 使用 `rollup` ，方便打成 `UMD`、`ES` 包，压缩代码；
1. 增加资源加载错误上报；
1. 测试套件由 `jasmine` 改成了 `Jest`。

## 安装

```bash
npm i error-watch
```

## 使用

- es6

```javaScript
import ErrorWatch from 'error-watch';

/**
* 错误监控回调函数
* @param stack {Object|null} 依次根据 Error 对象属性 stacktrace、stack、message和调用链 callers 来解析出错误行列等信息
* @param isWindowError {Boolean} 是否触发 window 监听事件，手动 try/catch 获取 err 解析为 false
* @param error {Error|null} 原始 err
*/
function receiveError(stack, isWindowError, error) {
  const data = encodeURIComponent(JSON.stringify({
    ...stack, // 错误解析的对象
    // isWindowError
    url: window.location.href, // 报错页面
  }));
  // img 上报
  // 注意分析数据有可能过大，需要考虑 ajax？
  new Image().src = 'https://your-websize.com/api/handleError?data=' + data;
}

// 监听错误
ErrorWatch.report.subscribe(receiveError);
```

- 脚本直接引入

```javascript
<script src="./dist/errorWatch.min.js"></script>
<scritp>
ErrorWatch.report.subscribe(function() {...});
</script>
```

### 错误回调处理函数，传入三个参数

- stack，成功是个 `Object` 否则是 `null`，可以用来结合 `SourceMap` 定位错误。
```json
{
  "mode": "stack",
  "name": "ReferenceError",
  "message": "thisIsAbug is not defined",
  "stack": [
    {
      "url": "http://localhost:7001/public/js/traceKit.min.js",
      "func": "Object.makeError",
      "args": [],
      "line": 1,
      "column": 9435,
      "context": null
    },
    {
      "url": "http://localhost:7001/public/demo.html",
      "func": "?",
      "args": [],
      "line": 49,
      "column": 12,
      "context": null
    }
  ]
}
```

- isWindowError，可选上报，区分自动还是手动。由于 try/catch 吐出来的 error 信息丰富，对于定位错误帮助较大，可以为业务逻辑自定义错误。
```javascript
try {
  /*
   * your code
   */
  throw new Error('oops');
} catch (e) {
  ErrorWatch.report(e);
}
```

- error，原始错误对象，上述的 stack 如果内部解析成功，则例如 stack.stack 已翻译成数组，会抛弃原始的 stack。
如果需要可以这么做。

```javascript
{
  ...stack,
  errorStack: error && error.stack,
}
```

- 完整实例

```json
{
  "mode": "stack",
  "name": "ReferenceError",
  "message": "thisIsAbug is not defined",
  "stack": [
    {
      "url": "http://localhost:7001/public/js/traceKit.min.js",
      "func": "Object.makeError",
      "args": [],
      "line": 1,
      "column": 9435,
      "context": null
    },
    {
      "url": "http://localhost:7001/public/demo.html",
      "func": "?",
      "args": [],
      "line": 49,
      "column": 12,
      "context": null
    }
  ],
  "errorStack": "ReferenceError: thisIsAbug is not defined\n    at Object.makeError (http://localhost:7001/public/js/traceKit.min.js:1:9435)\n    at http://localhost:7001/public/demo.html:49:12",
  "url": "http://localhost:7001/public/demo.html"
}
```

### 资源加载错误上报信息
- stack，根据 `mode` 是 `resource`，来区分资源加载错误。
````json
{
    "message": "img is load error",
    "mode": "resource",
    "name": "http://domain/404.jpg",
    "stack": null,
    "url": "http://localhost:7001/public/demo.html"
}
````
### 建议
- 尽量不用匿名函数，都给它加个名字，便于错误定位。
```javascript
Api.foo = function Api_foo() {
};
const bar = function barFn() {
};
```
- Script error. 跨域脚本无法拿到错误信息。
1. 跨源资源共享机制 `CORS` ：`Access-Control-Allow-Origin: Your-allow-origin`
1. 脚本属性 `crossOrigin` ：`<script src="xxx.js" crossOrigin="anonymous"></script>`

## npm scripts

- `npm run build` 根据 `rollup.config.js` 配置文件进行打包。
- `npm test` 单元测试。

## 阅读源码

阅读源码前，可以参考下关于JS错误知识的一些讨论 [错误监控原理分析](https://github.com/Godiswill/blog/issues/7)。
