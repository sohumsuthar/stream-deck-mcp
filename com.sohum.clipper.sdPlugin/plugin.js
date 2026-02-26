// Clipper — Stream Deck Plugin (SDK v2)
// Camera clip + mic clip with live server status
// Red = server off, Green = buffer ready, Yellow = saving

var SERVER_URL = "http://127.0.0.1:7891";
var MIC_URL = "http://127.0.0.1:9090";
var START_VBS = "P:\\sohum\\stream-deck-mcp\\scripts\\start-server.vbs";
var POLL_INTERVAL = 4000;
var FAST_POLL = 1500;

// ── Base64 icon generation via canvas ──

function makeIcon(color, ringColor) {
    var c = document.createElement("canvas");
    c.width = 144; c.height = 144;
    var g = c.getContext("2d");
    // Background
    g.fillStyle = "#1a1a2e";
    g.fillRect(0, 0, 144, 144);
    // Outer ring
    g.beginPath();
    g.arc(72, 68, 42, 0, Math.PI * 2);
    g.strokeStyle = ringColor || color;
    g.lineWidth = 4;
    g.stroke();
    // Inner circle
    g.beginPath();
    g.arc(72, 68, 32, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    return c.toDataURL("image/png");
}

function makePulseIcon(color, ringColor, progress) {
    var c = document.createElement("canvas");
    c.width = 144; c.height = 144;
    var g = c.getContext("2d");
    g.fillStyle = "#1a1a2e";
    g.fillRect(0, 0, 144, 144);
    // Progress ring
    g.beginPath();
    g.arc(72, 68, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    g.strokeStyle = ringColor || color;
    g.lineWidth = 4;
    g.stroke();
    // Background ring (dim)
    g.beginPath();
    g.arc(72, 68, 42, -Math.PI / 2 + Math.PI * 2 * progress, -Math.PI / 2 + Math.PI * 2);
    g.strokeStyle = "#333";
    g.lineWidth = 4;
    g.stroke();
    // Inner circle
    g.beginPath();
    g.arc(72, 68, 32, 0, Math.PI * 2);
    g.fillStyle = color;
    g.fill();
    return c.toDataURL("image/png");
}

var ICONS = {
    red: null,
    green: null,
    yellow: null,
    micRed: null,
    micGreen: null,
    micYellow: null
};

function initIcons() {
    ICONS.red = makeIcon("#cc3333", "#661111");
    ICONS.green = makeIcon("#33cc33", "#116611");
    ICONS.yellow = makeIcon("#cccc33", "#666611");
    ICONS.micRed = makeIcon("#cc3333", "#661111");
    ICONS.micGreen = makeIcon("#3399cc", "#115566");
    ICONS.micYellow = makeIcon("#cccc33", "#666611");
}

// ── WebSocket + State ──

var ws = null;
var pluginUUID = null;
// contexts: { contextId: { action: "com.sohum.clipper.clip"|"com.sohum.clipper.micclip" } }
var contexts = {};
var pollTimer = null;
var fastPollTimer = null;
var serverUp = false;
var micUp = false;
var camStatus = null;
var micStatus = null;

function connectElgatoStreamDeckSocket(inPort, inPluginUUID, inRegisterEvent, inInfo) {
    pluginUUID = inPluginUUID;
    initIcons();

    ws = new WebSocket("ws://127.0.0.1:" + inPort);

    ws.onopen = function() {
        ws.send(JSON.stringify({ event: inRegisterEvent, uuid: inPluginUUID }));
        startPolling();
    };

    ws.onmessage = function(evt) {
        var msg = JSON.parse(evt.data);
        handleEvent(msg);
    };

    ws.onerror = function(err) {
        console.error("[Clipper] WS error", err);
    };

    ws.onclose = function() {
        if (pollTimer) clearInterval(pollTimer);
        if (fastPollTimer) clearInterval(fastPollTimer);
    };
}

function handleEvent(msg) {
    switch (msg.event) {
        case "willAppear":
            contexts[msg.context] = { action: msg.action };
            updateButton(msg.context);
            break;
        case "willDisappear":
            delete contexts[msg.context];
            break;
        case "keyDown":
            handlePress(msg.context, msg.action);
            break;
    }
}

// ── WebSocket helpers ──

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

function openUrl(url) {
    send({ event: "openUrl", payload: { url: url } });
}

// ── Status polling ──

function checkServerStatus() {
    return new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", SERVER_URL + "/camera/status", true);
        xhr.timeout = 3000;
        xhr.onload = function() {
            try {
                camStatus = JSON.parse(xhr.responseText);
                serverUp = true;
                resolve(true);
            } catch(e) {
                serverUp = false;
                camStatus = null;
                resolve(false);
            }
        };
        xhr.onerror = function() { serverUp = false; camStatus = null; resolve(false); };
        xhr.ontimeout = function() { serverUp = false; camStatus = null; resolve(false); };
        xhr.send();
    });
}

function checkMicStatus() {
    return new Promise(function(resolve) {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", MIC_URL + "/status", true);
        xhr.timeout = 3000;
        xhr.onload = function() {
            try {
                micStatus = JSON.parse(xhr.responseText);
                micUp = micStatus.status === "running";
                resolve(micUp);
            } catch(e) {
                micUp = false;
                micStatus = null;
                resolve(false);
            }
        };
        xhr.onerror = function() { micUp = false; micStatus = null; resolve(false); };
        xhr.ontimeout = function() { micUp = false; micStatus = null; resolve(false); };
        xhr.send();
    });
}

function updateButton(ctx) {
    var info = contexts[ctx];
    if (!info) return;

    if (info.action === "com.sohum.clipper.clip") {
        checkServerStatus().then(function() {
            if (serverUp && camStatus) {
                var secs = camStatus.seconds || 0;
                var progress = Math.min(secs / 90, 1);
                if (progress >= 1) {
                    setImage(ctx, ICONS.green);
                    setTitle(ctx, "READY");
                } else {
                    setImage(ctx, makePulseIcon("#33cc33", "#116611", progress));
                    setTitle(ctx, secs + "s");
                }
            } else {
                setImage(ctx, ICONS.red);
                setTitle(ctx, "OFF");
            }
        });
    } else if (info.action === "com.sohum.clipper.micclip") {
        checkMicStatus().then(function() {
            if (micUp && micStatus) {
                var secs = Math.round(micStatus.buffered_seconds || 0);
                var progress = Math.min(secs / 90, 1);
                if (progress >= 1) {
                    setImage(ctx, ICONS.micGreen);
                    setTitle(ctx, "READY");
                } else {
                    setImage(ctx, makePulseIcon("#3399cc", "#115566", progress));
                    setTitle(ctx, secs + "s");
                }
            } else {
                setImage(ctx, ICONS.micRed);
                setTitle(ctx, "OFF");
            }
        });
    }
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

function startFastPoll() {
    if (fastPollTimer) clearInterval(fastPollTimer);
    var count = 0;
    fastPollTimer = setInterval(function() {
        count++;
        var ctxList = Object.keys(contexts);
        for (var i = 0; i < ctxList.length; i++) {
            updateButton(ctxList[i]);
        }
        if (count > 20 || serverUp) {
            clearInterval(fastPollTimer);
            fastPollTimer = null;
        }
    }, FAST_POLL);
}

// ── Button press handlers ──

function handlePress(ctx, action) {
    if (action === "com.sohum.clipper.clip") {
        if (!serverUp) {
            // Server is off — start it
            setImage(ctx, ICONS.yellow);
            setTitle(ctx, "Starting...");
            openUrl(START_VBS);
            startFastPoll();
            return;
        }
        triggerClip(ctx);
    } else if (action === "com.sohum.clipper.micclip") {
        if (!micUp) {
            // Mic service off — start main server which starts mic service
            setImage(ctx, ICONS.micYellow);
            setTitle(ctx, "Starting...");
            openUrl(START_VBS);
            startFastPoll();
            return;
        }
        triggerMicClip(ctx);
    }
}

function triggerClip(ctx) {
    setImage(ctx, ICONS.yellow);
    setTitle(ctx, "...");

    // Fire camera clip
    var xhr1 = new XMLHttpRequest();
    xhr1.open("GET", SERVER_URL + "/camera/clip", true);
    xhr1.timeout = 15000;
    xhr1.onload = function() {
        try {
            var data = JSON.parse(xhr1.responseText);
            if (data.ok) {
                showOk(ctx);
                setImage(ctx, ICONS.green);
                setTitle(ctx, "SAVED");
            } else {
                showAlert(ctx);
                setImage(ctx, ICONS.red);
                setTitle(ctx, "ERR");
            }
        } catch(e) {
            showAlert(ctx);
            setTitle(ctx, "ERR");
        }
        setTimeout(function() { updateButton(ctx); }, 2000);
    };
    xhr1.onerror = function() {
        showAlert(ctx);
        setImage(ctx, ICONS.red);
        setTitle(ctx, "ERR");
        setTimeout(function() { updateButton(ctx); }, 3000);
    };
    xhr1.ontimeout = xhr1.onerror;
    xhr1.send();

    // Also fire mic-only clip in parallel (fire-and-forget)
    // Use /clip/mic to only clip the DJI Mic source, not cam audio
    // (cam audio would duplicate since we already have the video)
    var xhr2 = new XMLHttpRequest();
    xhr2.open("POST", MIC_URL + "/clip/mic", true);
    xhr2.timeout = 5000;
    xhr2.send();
}

function triggerMicClip(ctx) {
    setImage(ctx, ICONS.micYellow);
    setTitle(ctx, "...");

    var xhr = new XMLHttpRequest();
    xhr.open("POST", MIC_URL + "/clip", true);
    xhr.timeout = 5000;
    xhr.onload = function() {
        try {
            var data = JSON.parse(xhr.responseText);
            if (data.status === "ok") {
                showOk(ctx);
                setImage(ctx, ICONS.micGreen);
                setTitle(ctx, "SAVED");
            } else {
                showAlert(ctx);
                setTitle(ctx, "ERR");
            }
        } catch(e) {
            showAlert(ctx);
            setTitle(ctx, "ERR");
        }
        setTimeout(function() { updateButton(ctx); }, 2000);
    };
    xhr.onerror = function() {
        showAlert(ctx);
        setImage(ctx, ICONS.micRed);
        setTitle(ctx, "OFF");
        setTimeout(function() { updateButton(ctx); }, 3000);
    };
    xhr.ontimeout = xhr.onerror;
    xhr.send();
}
