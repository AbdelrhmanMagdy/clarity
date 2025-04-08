import { clarity, version, helper } from "clarity-js";
import { enableClarityLiveMode } from "./config";

if (enableClarityLiveMode) {
    liveClarity();
} else {
    localClarity();
}

// // Execute clarity-js in context of the webpage
function localClarity(): void {
    if (typeof window !== "undefined") {
        const w = window as any;
        const c = 'clarity';

        // Stop any existing instance of clarity-js
        if (w[c]) { w[c]("stop"); }

        // Re-wire clarity-js for developer tools and expose helper methods as part of the global object
        w[c] = function (method: string, ...args: any[]): void { return clarity[method](...args); }
        w[c].h = function (method: string, ...args: any[]): void { return helper[method](...args); }
        w[c].v = version;

        // Notify developer tools that clarity-js is wired up
        window.postMessage({ action: "wireup" }, "*");
    }
};

function liveClarity() {
    if (typeof window === "undefined") return;

    const scriptContent = `
        (function() {
            const targetDomain = "clarity.ms/collect";
  
            // Intercept XMLHttpRequest
            const originalXhrOpen = XMLHttpRequest.prototype.open;
            const originalXhrSend = XMLHttpRequest.prototype.send;
            
            XMLHttpRequest.prototype.open = function(method, url, ...rest) {
                this._method = method;
                this._url = url;
                originalXhrOpen.apply(this, [method, url, ...rest]);
            };
  
            XMLHttpRequest.prototype.send = function(body) {
                if (this._url && this._url.includes(targetDomain)) {
                    try {
                        if (body instanceof Uint8Array) {
                            window.postMessage({ 
                                action: "clarity-live-data", 
                                payload: Array.from(body) 
                            }, "*");
                        }
                    } catch (err) {
                        console.error("XHR Decompression error:", err);
                    }
                }
                originalXhrSend.apply(this, [body]);
            };
        })();
    `;

    const script = document.createElement("script");
    script.textContent = scriptContent;
    document.documentElement.appendChild(script);
    script.remove();
};
