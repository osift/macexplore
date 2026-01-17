window.pywebviewCallbacks = {};
window.pywebview = {
    api: new Proxy({}, {
        get: function(target, prop) {
            return function(...args) {
                return new Promise((resolve, reject) => {
                    const callbackId = Math.random().toString(36).substring(7);

                    window.pywebviewCallbacks[callbackId] = (result) => {
                        delete window.pywebviewCallbacks[callbackId];
                        resolve(result);
                    };

                    webkit.messageHandlers.pywebview.postMessage({
                        method: prop,
                        params: args,
                        callbackId: callbackId
                    });
                });
            };
        }
    })
};
