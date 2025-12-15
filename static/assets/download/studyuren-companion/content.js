const ALLOWED_SITES = ["itslearning.com", "somtoday.nl", "bijsven.nl", "studygo.com", "chatgpt.com", "claude.ai"];

fetch("https://studyuren.bijsven.nl/allowed_sites.json").then(res => res.json()).then(data => {
    ALLOWED_SITES = data;
});

let sessionActive = false;
let overlayRoot = null;
const isStudyurenPage = window.location.hostname.includes('studyuren.bijsven.nl') || 
                        window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';


let lastActivity = Date.now();
const ACTIVITY_INTERVAL = 5000;

function updateActivity() {
    lastActivity = Date.now();
}

window.addEventListener("mousemove", updateActivity);
window.addEventListener("keydown", updateActivity);
window.addEventListener("scroll", updateActivity);

setInterval(() => {
    if (Date.now() - lastActivity < ACTIVITY_INTERVAL) {
        chrome.runtime.sendMessage({ type: "studyuren:user-active" });
    }
}, 2000);



window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;

    switch (event.data.type) {
        case "studyuren:start-session":
            if (isStudyurenPage) {
                
                chrome.runtime.sendMessage({ type: "studyuren:start-session" });
            }
            break;
        case "studyuren:end-session":
            if (isStudyurenPage) {
                
                chrome.runtime.sendMessage({ type: "studyuren:end-session" });
            }
            break;
        case "studyuren:extension:request":
            
            chrome.runtime.sendMessage({ type: "studyuren:extension:request" }, (response) => {
                
            });
            break;
        case "studyuren:session:force-stop":
            console.log("sessie wordt geprobeerd te stoppen in content.js")
            chrome.runtime.sendMessage({ type: "studyuren:force-stop" });
            break;
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    

    switch (msg.type) {
        case "studyuren:session:start":
            handleSessionStart();
            break;
        case "studyuren:session:end":
            handleSessionEnd();
            break;
        case "studyuren:website:blocked":
            if (isStudyurenPage) {
                window.postMessage({
                    type: "studyuren:website:blocked",
                    data: { url: msg.data.url }
                }, "*");
            }
            break;
        case "studyuren:extension:response":
            window.postMessage({
                type: "studyuren:extension:response",
                version: msg.version
            }, "*");
            break;
        case "studyuren:session:force-stop":
            console.log("sessie wordt geprobeerd te stoppen in content.js")
            window.postMessage({ type: "studyuren:force-stop" }, "*");
            break;
    }
    return true;
});

if (!isStudyurenPage) {
    
    chrome.runtime.sendMessage({ type: "studyuren:check-session" });
} else {
    
}

function handleSessionStart() {
    if (sessionActive) {
        
        return;
    }
    sessionActive = true;

    
    if (!isStudyurenPage && isAllowedSite()) {
        
        showOverlay();
    }
    
    
    if (!isStudyurenPage && !isAllowedSite()) {
        
        chrome.runtime.sendMessage({
            type: "studyuren:block-site",
            data: { url: window.location.href }
        });
    }
}

function handleSessionEnd() {
    if (!sessionActive) {
        
        return;
    }
    sessionActive = false;
    
    hideOverlay();
}

function isAllowedSite() {
    return ALLOWED_SITES.some(site => window.location.hostname.includes(site));
}

function showOverlay() {
    if (overlayRoot) return; 
    
    overlayRoot = createFocusOverlay();
    document.body.appendChild(overlayRoot);
}

function hideOverlay() {
    if (overlayRoot) {
        overlayRoot.remove();
        overlayRoot = null;
    }
}

function createFocusOverlay() {
    const shadowHost = document.createElement("div");
    shadowHost.style.cssText = `all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647; width: 0; height: 0; pointer-events: none;`;
    const shadowRoot = shadowHost.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
        * { 
            font-family: "Google Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
            color: white !important;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.5; }
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    shadowRoot.appendChild(style);

    const overlay = document.createElement("div");
    overlay.style.cssText = `
        all: initial;
        position: fixed;
        top: 48px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2147483647;
        cursor: pointer;
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.75);
        backdrop-filter: blur(10px);
        height: 48px;
        width: 192px;
        border-radius: 9999px;
        pointer-events: auto;
        font-size: 14px;
        transition: all 0.2s ease;
        animation: fadeIn 0.3s ease;
    `;

    overlay.addEventListener('mouseenter', () => {
        overlay.style.background = 'rgba(0, 0, 0, 0.85)';
        overlay.style.transform = 'translateX(-50%) scale(1.05)';
    });

    overlay.addEventListener('mouseleave', () => {
        overlay.style.background = 'rgba(0, 0, 0, 0.75)';
        overlay.style.transform = 'translateX(-50%) scale(1)';
    });

    overlay.addEventListener('click', () => {
        
        
        chrome.runtime.sendMessage({ type: "studyuren:focus-studyuren-tab" });
    });

    const pulseDot = document.createElement("div");
    pulseDot.style.cssText = `
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background-color: #10B981;
        animation: pulse 2s infinite;
    `;

    const label = document.createElement("p");
    label.style.cssText = 'margin: 0; font-weight: 500;';
    label.textContent = "Studyuren Sessie";

    overlay.appendChild(pulseDot);
    overlay.appendChild(label);
    shadowRoot.appendChild(overlay);

    return shadowHost;
}


if (!isStudyurenPage && !isAllowedSite()) {
    chrome.runtime.sendMessage({ type: "studyuren:check-session" });
    
    setTimeout(() => {
        if (sessionActive) {
            chrome.runtime.sendMessage({
                type: "studyuren:block-site",
                data: { url: window.location.href }
            });
        }
    }, 500);
} else {
    
}