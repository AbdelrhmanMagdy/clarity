import config from "./config";

chrome.runtime.onMessage.addListener(function(message: any): void {
  if (message.action === "activate") {
    activate();
  } else if (message.action === "warn") {
    console.warn(message.message);
  }
});

chrome.runtime.sendMessage({ action: "activate" }, function(response: any): void {
  if (response && response.success) {
    activate();
  }
});

function activate(): void {
  setup(chrome.extension.getURL('clarity.js'));
}

function setup(url: string): void {
  // Execute script in the webpage context
  let script = document.createElement("script");
  script.setAttribute('type', 'text/javascript');
  script.setAttribute('src', url);
  document.body.appendChild(script);
  
  window.addEventListener("message", function(event: MessageEvent): void {
      if (event.source === window && event.data.action) {
        switch (event.data.action) {
          case "wireup":
            chrome.storage.sync.get({ clarity: { showText: true, leanMode: false } }, (items: any) => {
              let c = config();
              let script = document.createElement("script");
              script.innerText = wireup({
                regions: c.regions,
                fraud: c.fraud,
                mask: c.mask,
                unmask: c.unmask,
                drop: c.drop,
                showText: items.clarity.showText,
                leanMode: items.clarity.leanMode
              });
              document.body.appendChild(script);
            });
            break;
          case "upload":
            upload(event.data.payload);
            break;
          case "clarity-live-data":
            decompress(event.data.payload).then(upload);
            break;
        }
      }
  });
}

function wireup(settings: any): string {
  let code = ((): void => {
    window["clarity"]("start", {
      delay: 500,
      lean: "$__leanMode__$",
      regions: "$__regions__$",
      fraud: "$__fraud__$",
      drop: "$__drop__$",
      mask: "$__mask__$",
      unmask: "$__unmask__$",
      content: "$__showText__$",
      upload: (data: string): void => { window.postMessage({ action: "upload", payload: data }, "*"); },
      projectId: "devtools"
    });
  }).toString();
  Object.keys(settings).forEach(s => code = code.replace(`"$__${s}__$"`, JSON.stringify(settings[s])));
  return `(${code})();`;
}

function upload(data: string): void {
  chrome.runtime.sendMessage({ action: "payload", payload: data }, function(response: any): void {
    if (!(response && response.success)) {
      console.warn("Payload failure, dev tools likely not open.");
    }
  });
}

async function decompress(compressedData) {
  if (!compressedData 
    || compressedData.length === 0 
    || window["DecompressionStream"] as any === undefined 
    || window["TextDecoderStream"] as any === undefined) 
    return null;

  try {
      const uint8Array = new Uint8Array(compressedData);

      const stream = new ReadableStream({
          start(controller) {
              controller.enqueue(uint8Array);
              controller.close();
          }
      });

      const decompressedStream = stream
          .pipeThrough(new (window["DecompressionStream"] as any)("gzip")) 
          .pipeThrough(new (window["TextDecoderStream"] as any)()); 

      const reader = decompressedStream.getReader();
      let decompressedText = "";

      while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          decompressedText += value;
      }

      return decompressedText;
  } catch (error) {
      console.error("Native decompression failed:", error);
      return null;
  }
}