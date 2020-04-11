import { collectSourceErrors } from './config';

let isRegisterListener = false;
let _handler = null;

/**
 * 资源加载错误上报
 * @param handler
 */
export function installResourceLoadError(handler) {
  if(!isRegisterListener && collectSourceErrors) {
    _handler = handler;
    window.addEventListener && window.addEventListener('error', function (e) {
      try {
        if(e.target !== window) {  // 避免重复上报
          const stack = {
            message: `${e.target.localName} is load error`,
            mode: 'resource',
            name: e.target.src || e.target.href || e.target.currentSrc,
            stack: null,
          };
          handler(stack, true, e);
        }
      } catch (e) {
        throw e;
      }
    }, true);
  }
  isRegisterListener = true;
}

/**
 * 移除资源错误加载监听
 */
export function uninstallResourceLoadError() {
  if(isRegisterListener && collectSourceErrors && _handler) {
    window.removeEventListener && window.removeEventListener('error', _handler);
    _handler = null;
    isRegisterListener = false;
  }
}
