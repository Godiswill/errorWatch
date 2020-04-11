//Default options:
export const remoteFetching = false;     // 获取远程源文件，没什么用关掉
export const collectWindowErrors = true; // 是否通知 window 全局错误，开启，关掉了这个脚本就没意义了
export const collectSourceErrors = true; // 是否在捕获阶段获取资源加载错误，默认开启
export const linesOfContext = 11;        // 5 lines before, the offending line, 5 lines after，没啥用
export const debug = false;
export const reportFuncName = 'ErrorWatch.report';
