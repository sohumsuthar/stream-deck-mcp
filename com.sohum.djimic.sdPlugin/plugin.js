// DJI Mic Bridge — Stream Deck Plugin (SDK v2)
// Green = mic ready, Red = service down, Yellow = clipping

const SERVICE_URL = "http://127.0.0.1:9090";
const POLL_INTERVAL = 4000;

const ICONS = {
    ready: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAADr0lEQVR4nO3dvXXUQBSG4QuHEjZxTAGEpgQHNEQFNERACd6QAhw72R4gsThirP9vRivd731Ce63dc+bljrR/RAAAAPj5sOWPLg+XP7UfCI7h9npb1cSqGxOOj6UhLboR4fiaC+nj3AGIx9vc+k8GRDyImO5gNCDiQd9YD5/2fiDY1+31di1/dnm4PNY6/uAJEtPn/IbCKW0JqTypZgIl1I/n2+/Hd5H8/HK9drdTp9G7CcT0ObcunqFwSl1IayPqT6HZy3icx5p4+rdbst2NISBICCiJtdOno04hAoKEgCAhIEgICBICSqJ7Lqd7bmeprc8FdQgIEgJKZO0UUqdPBC9lpLT0tbAI/QVVAkqq1avxb8f+1w2vxifVxdH6/UAElFzNWIZwEg0JAUFCQJAQECQEBAkBQUJAkBAQJAQECQFBQkCQEBAkBAQJAUFCQJAQECS8oWzA11+fR3/3/PSy4yM5Pt4T/WYqmjGuMfH9QIUt8Sh/l4n1BKoZgNM0YgJF/enhOo0sA2q12I4RWQaEeuwCaj0l3KaQ1Ul0f3Gfn16+Nzj+j97xax/+MPhoc/y/2NjObgtDXTYB7X1u4nIuZBMQ2iAgSAgIEtursNaX8S5sA3Jc7BbYwiAhIEgICBICgoSAILG9CuMyvg7bgBwXuwW2MEgICBICgoSAICEgSGyvwriMr8M2IMfFboEtDBICgoSAILEJaO9Pimb+ZGqfTUBow/YqjMv4OtJ8uULxxQmLbtfK0vs/6zZn/Q1lrRftrFFsZRcQ6rIMqNWUcJs+EaYBRdRfbMd4IhKdREdsP0FVTqy33s+Zg7M+iR6ydTHPHEEtts8Dlfox8H9lLJdqC4s47jZx1Me1BVsYqkkX0NKtaE+Zpk8pXUCle0d07/tvLWVA5b/yey1ieb/Zpk9E0oAijrdYR3s8taS7CivdYwpknzxWV2F7b2fZ4ymln0CdoXBqLm7r4x9JfwLZBBQxPn2UhW5xzKOzDShifgtbsvA1jnFm1gF1WpwLZQ+nQ0A9NUJyCadDQBOWBOUWTImAFsr8GpbC6nkgtEVAkBAQJAQECQFBYncVdu/PxmfAVRiqISBI7LYw6NjCUA0BQUJAkBAQJAQECQFBQkCQEBAkBAQJAUFCQJAQECQEBAkBQUJAkBAQJAQECQFBQkCQvAuo/35XoFT2wQSCZDAgphCGDHXBBIJkNCCmEPrGepicQESEiOkOZrcwIvI2t/6r4uBjzz6WDo5N04WQ8mLHAQCY+AuwvHTyEPxsvAAAAABJRU5ErkJggg==",
    error: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAADuklEQVR4nO3dPXITQRRF4WeKFWgBJiYjI2BlrICVEThzRowWoC2YxE1NtWc0P7d7NPPu+UKQR6rqw+tpCdsRAAAAfp62fNHz5fLW+oXgGK6326omVj2YcHwsDWnRgwjH11xIn+YuQDze5tb/bkDEg4j7HUwGRDwYmurh894vBPu63m4v9Z89Xy7fW11/9AaJ6XN+Y+HUtoRU31QzgRIaxvP249uHSJ5+v76Ux6nT6MMEYvqcW4lnLJxaCWltRMMpNHuMx3msiWf4uCXb3RQCgoSAklg7fQp1ChEQJAQECQFBQkCQEFAS5b2c8t7OUlvfCyoICBICSmTtFFKnTwQfZaS09LOwCP0DVQJKqten8e/X/t8Nn8YnVeLo/f+BCCi5lrGM4SYaEgKChIAgISBICAgSAoKEgCAhIEgICBICgoSAICEgSAgIEgKChIAgISBI+A9lI/5+fZ78uy9/rju+kuMjoHf3opl6HDGxhUXE8nhafV0m1hOoRQDlGq7TyHYCtZ4ertPIMqBei+0YkWVAaMcuoN5Twm0KWd1EV0fwnx2u/6s8j8tNtVVAQ2WxobHbwtCWTUB735u43AvZBIQ+CAgSAoLE9hTW8xjvxDYgx8XugS0MEgKChIAgISBICAgS21MYx/g2bANyXOwe2MIgISBICAgSAoKEgCCxPYVxjG/DNiDHxe6BLQwSAoKEgCCxCWjv7xR1+c5Um4DQh+0pjGN8G2l+b/zSn124x3eMLn3+s25zw98bb7eF9V60s0axlV1AaMsyoF5Twm36RJgGFNF+sR3jiUh0Ex2x/QZVubHe+jxnDs76JnrM1sU8cwSt2L4PVBvGwO/KWC7VFhZx3G3iqK9rC7YwNJMuoKVb0Z4yTZ9auoBqj47o0c/fW8qA6n/lj1rE+nmzTZ+IpAFFHG+xjvZ6Wkl3Cqs9YgpknzxWp7C9t7Ps8dTST6BiLJyWi9v7+kcynEA2AUVMTx9loXtc8+hsA4qY38KWLHyLa5yZdUBFj3uh7OEUw4BsP0wti90iJJdwxtgGVGw5pTkHU7MPqDb1WRrRjEv/PhD6IiBICAgSAoKEgCCxO4Vtfd9nzdc5ndiYQJAQECR2W5jT9rIHJhAkBAQJAUFCQJAQECQEBAkBQUJAkBAQJAQECQFBQkCQEBAkBAQJAUFCQJAQECQEBAkBQfIhoOHPfgFqdR9MIEhGA2IKYcxYF0wgSCYDYgphaKqHuxOIiBBxv4PZLYyIvM2t/6o4XH4EMJYPjk3ThZDyYscBAJj4Bz5vYUZzQzqnAAAAAElFTkSuQmCC",
    clip:  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJAAAACQCAYAAADnRuK4AAADuklEQVR4nO3d3W3bQBBF4XGQdzVgOE0ESBtpJxWknbRhwE3EcAOqwHnxBsSaFH/uLkXOPd9jIlMC9mSWK8V2BAAAgJ+HLV/09Hh5b/1CcAyvb9dVTax6MOH4WBrSogcRjq+5kL7MXYB4vM2t/82AiAcRtzuYDIh4MDTVw9e9Xwj29fp2fa7/7Onx8qPV9UdvkJg+5zcWTm1LSPVNNRMooWE87y/xKZKH7/FcHqdOo08TiOlzbiWesXBqJaS1EQ2n0OwxHuexJp7h45Zsd1MICBICSmLt9CnUKURAkBAQJAQECQFBQkBJlPdyyns7S219L6ggIEgIKJG1U0idPhF8lJHS0s/CIvQPVAkoqV6fxn9c+383fBqfVImj9/8HIqDkWsYyhptoSAgIEgKChIAgISBICAgSAoKEgCAhIEgICBICgoSAICEgSAgIEgKChIAg4T+Ujfj75zr5d99+XnZ8JcdHQB9uRTP1OGJiC4uI5fG0+rpMrCdQiwDKNVynke0Eaj09XKeRZUC9FtsxIsuA0I5dQL2nhNsUsrqJro7gvzpc/3d5HpebaquAhspiQ2O3haEtm4D2vjdxuReyCQh9EBAkBASJ7Sms5zHeiW1AjovdA1sYJAQECQFBQkCQEBAktqcwjvFt2AbkuNg9sIVBQkCQEBAkBAQJAUFiewrjGN+GbUCOi90DWxgkBAQJAUFiE9De3ynq8p2pNgGhD9tTGMf4NtL83vilP7twj+8YXfr8Z93mhr833m4L671oZ41iK7uA0JZlQL2mhNv0iTANKKL9YjvGE5HoJjpi+w2qcmO99XnOHJz1TfSYrYt55ghasX0fqDaMgd+VsVyqLSziuNvEUV/XFmxhaCZdQEu3oj1lmj61dAHV7h3RvZ+/t5QB1f/K77WI9fNmmz4RSQOKON5iHe31tJLuFFa7xxTIPnmsTmF7b2fZ46mln0DFWDgtF7f39Y9kOIFsAoqYnj7KQve45tHZBhQxv4UtWfgW1zgz64CKHvdC2cMphgHZfphaFrtFSC7hjLENqNhySnMOpmYfUG3qszSiGZf+fSD0RUCQEBAkBAQJAUFidwrb+r7Pmq9zOrExgSAhIEjstjCn7WUPTCBICAgSAoKEgCAhIEgICBICgoSAICEgSAgIEgKChIAgISBICAgSAoKEgCAhIEgICBICguRTQMOf/QLU6j6YQJCMBsQUwpixLphAkEwGxBTC0FQPNycQESHidgezWxgReZtb/1VxuPwIYCwfHJumCyHlxY4DADDxD/ojXj+7G79PAAAAAElFTkSuQmCC"
};

let ws = null;
let pluginUUID = null;
let contexts = {};
let pollTimer = null;
let lastStatus = null;

// Stream Deck SDK v2 calls this global function with connection params
function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID;

    ws = new WebSocket("ws://127.0.0.1:" + inPort);

    ws.onopen = function() {
        // Register plugin
        ws.send(JSON.stringify({
            event: inRegisterEvent,
            uuid: inPluginUUID
        }));
        startPolling();
    };

    ws.onmessage = function(evt) {
        var msg = JSON.parse(evt.data);
        handleEvent(msg);
    };

    ws.onerror = function(err) {
        console.error("[DJI Mic] WS error", err);
    };

    ws.onclose = function() {
        if (pollTimer) clearInterval(pollTimer);
    };
}

function handleEvent(msg) {
    switch (msg.event) {
        case "willAppear":
            contexts[msg.context] = true;
            updateButton(msg.context);
            break;
        case "willDisappear":
            delete contexts[msg.context];
            break;
        case "keyDown":
            triggerClip(msg.context);
            break;
    }
}

function send(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(payload));
    }
}

function setImage(ctx, icon) {
    send({ event: "setImage", context: ctx, payload: { image: icon, target: 0 } });
}

function setTitle(ctx, title) {
    send({ event: "setTitle", context: ctx, payload: { title: title, target: 0 } });
}

function showOk(ctx) { send({ event: "showOk", context: ctx }); }
function showAlert(ctx) { send({ event: "showAlert", context: ctx }); }

function checkStatus() {
    return new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", SERVICE_URL + "/status", true);
        xhr.timeout = 3000;
        xhr.onload = function() {
            try {
                lastStatus = JSON.parse(xhr.responseText);
                resolve(lastStatus.status === "running" && lastStatus.mic_connected);
            } catch(e) {
                lastStatus = null;
                resolve(false);
            }
        };
        xhr.onerror = function() { lastStatus = null; resolve(false); };
        xhr.ontimeout = function() { lastStatus = null; resolve(false); };
        xhr.send();
    });
}

function updateButton(ctx) {
    checkStatus().then(function(ready) {
        if (ready) {
            setImage(ctx, ICONS.ready);
            var secs = Math.round(lastStatus.buffered_seconds);
            setTitle(ctx, secs >= 90 ? "READY" : secs + "s");
        } else {
            setImage(ctx, ICONS.error);
            setTitle(ctx, "OFF");
        }
    });
}

function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(function() {
        var ctxList = Object.keys(contexts);
        for (var i = 0; i < ctxList.length; i++) {
            updateButton(ctxList[i]);
        }
    }, POLL_INTERVAL);
}

function triggerClip(ctx) {
    setImage(ctx, ICONS.clip);
    setTitle(ctx, "...");

    var xhr = new XMLHttpRequest();
    xhr.open("POST", SERVICE_URL + "/clip", true);
    xhr.timeout = 5000;
    xhr.onload = function() {
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.status === "ok") {
                showOk(ctx);
                setImage(ctx, ICONS.ready);
                setTitle(ctx, "SAVED");
                setTimeout(function() { updateButton(ctx); }, 2000);
            } else {
                showAlert(ctx);
                setTitle(ctx, "ERR");
                setTimeout(function() { updateButton(ctx); }, 3000);
            }
        } catch(e) {
            showAlert(ctx);
            setTimeout(function() { updateButton(ctx); }, 3000);
        }
    };
    xhr.onerror = function() {
        showAlert(ctx);
        setImage(ctx, ICONS.error);
        setTitle(ctx, "OFF");
        setTimeout(function() { updateButton(ctx); }, 3000);
    };
    xhr.ontimeout = xhr.onerror;
    xhr.send();
}
