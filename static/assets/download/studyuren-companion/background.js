let ALLOWED_SITES = ["itslearning.com", "somtoday.nl", "bijsven.nl", "studygo.com", "chatgpt.com" ];

fetch("https://studyuren.bijsven.nl/allowed_sites.json")
    .then(res => res.json())
    .then(data => {
        ALLOWED_SITES = data;
    })
    .catch(() => {
        // keep the fallback list if remote fetch fails
    });

let sessionActive = false;
let studyurenTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    switch (msg.type) {
        case "studyuren:extension:request":
            if (sender.tab?.id) {
                chrome.tabs.sendMessage(sender.tab.id, {
                    type: "studyuren:extension:response",
                    version: chrome.runtime.getManifest().version
                });
            }
            sendResponse({ success: true });
            return true;
            break;

        case "studyuren:start-session":
            sessionActive = true;
            studyurenTabId = sender.tab?.id || null;
            console.log('[Background] Sessie gestart, Studyuren tab:', studyurenTabId);
            closeExistingBlockedTabs();
            broadcastSessionState();
            break;

        case "studyuren:end-session":
            sessionActive = false;
            console.log('[Background] Sessie gestopt');
            broadcastSessionState();
            break;

        case "studyuren:check-session":
            if (sender.tab?.id) {
                sendSessionState(sender.tab.id);
            }
            break;

        case "studyuren:block-site":
            if (sender.tab?.id) {
                blockSiteAndNotify(sender.tab.id, msg.data?.url || sender.tab.url);
            }
            break;
            
        case "studyuren:focus-studyuren-tab":
            focusStudyurenTab();
            break;
            
        case "studyuren:check-in-start":
            // Broadcast check-in start to all other tabs with timing data
            broadcastCheckIn(true, msg.data);
            break;

        case "studyuren:check-in-end":
            // Broadcast check-in end to all tabs
            broadcastCheckIn(false, msg.data);
            break;
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "studyuren:user-active") {
        if (studyurenTabId) {
            chrome.tabs.sendMessage(studyurenTabId, { type: "studyuren:session:active" });
        }
        // Broadcast to all tabs that activity was detected
        broadcastActivityConfirmed();
    }
});

function broadcastActivityConfirmed() {
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab.id || tab.id === studyurenTabId) return;
            
            chrome.tabs.sendMessage(tab.id, {
                type: "studyuren:activity-confirmed"
            }, () => {
                if (chrome.runtime.lastError) return;
            });
        });
    });
}

function broadcastCheckIn(isActive, data = {}) {
    console.log(
        '[Background] Broadcasting check-in:',
        isActive ? 'START' : 'END',
        data?.duration ? `(${data.duration}s)` : ''
    );

    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab.id || tab.id === studyurenTabId) return;

            chrome.tabs.sendMessage(tab.id, {
                type: isActive ? "studyuren:check-in:start" : "studyuren:check-in:end",
                data
            }, () => {
                if (chrome.runtime.lastError) return;
            });
        });
    });
}

function broadcastSessionState() {
    console.log('[Background] Broadcasting sessie status:', sessionActive ? 'START' : 'END');
    
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab.id) return;
            
            if (tab.id === studyurenTabId) {
                return;
            }
            
            chrome.tabs.sendMessage(tab.id, {
                type: sessionActive ? "studyuren:session:start" : "studyuren:session:end"
            }, () => {
                if (chrome.runtime.lastError) return;
            });
        });
    });
}

function sendSessionState(tabId) {
    if (!tabId) return;
    
    if (tabId === studyurenTabId) {
        return;
    }
        
    chrome.tabs.sendMessage(tabId, {
        type: sessionActive ? "studyuren:session:start" : "studyuren:session:end"
    }, () => {
        if (chrome.runtime.lastError) return;
    });
}

function blockSiteAndNotify(blockedTabId, blockedUrl) {
    console.log('[Background] Blokkeren:', blockedUrl);
    
    chrome.tabs.query({}, (tabs) => {
        const studyTab = tabs.find(t => 
            t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
        );

        if (studyTab && studyTab.id) {
            chrome.windows.update(studyTab.windowId, { focused: true });
            chrome.tabs.update(studyTab.id, { active: true });
            chrome.tabs.remove(blockedTabId);

            chrome.tabs.sendMessage(studyTab.id, {
                type: "studyuren:website:blocked",
                data: { url: blockedUrl }
            });
        } else {
            sessionActive = false;
            broadcastSessionState();
            if (blockedTabId) {
                chrome.tabs.remove(blockedTabId);
            }
        }
    });
}

function focusStudyurenTab() {
    console.log('[Background] Focus to Studyuren Tab');
    
    chrome.tabs.query({}, (tabs) => {
        const studyTab = tabs.find(t => 
            t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
        );

        if (studyTab && studyTab.id) {
            chrome.windows.update(studyTab.windowId, { focused: true });
            chrome.tabs.update(studyTab.id, { active: true });
            console.log('[Background] focused on tab', studyTab.id);
        } else {
            console.log('[Background] Studyuren tab lost.');
        }
    });
}

setInterval(() => {
    if (!sessionActive) return;

    chrome.tabs.query({}, (tabs) => {
        const studyTab = tabs.find(t => 
            t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
        );

        if (!studyTab) {
            console.log('[Background] Studyuren has been closed, stopping extension session.');
            sessionActive = false;
            studyurenTabId = null;
            broadcastSessionState();
        } else if (studyTab.id !== studyurenTabId) {
            console.log('[Background] TabID update:', studyurenTabId, '->', studyTab.id);
            studyurenTabId = studyTab.id;
        }
    });
}, 2000);

chrome.tabs.onRemoved.addListener((tabId) => {
    if (tabId === studyurenTabId) {
        console.log('[Background] Studyuren tab gesloten, sessie stoppen');
        sessionActive = false;
        studyurenTabId = null;
        broadcastSessionState();
    }
});

function closeExistingBlockedTabs() {    
    console.log('[Background] Check alle bestaande tabs voor niet-toegestane sites');
    
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (!tab.url || !tab.id) return;
            
            if (tab.id === studyurenTabId) return;
            
            try {
                const url = new URL(tab.url);
                const hostname = url.hostname;
                
                const isAllowed = ALLOWED_SITES.some(site => hostname.includes(site));
                
                if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') return;
                
                if (!isAllowed) {
                    console.log('[Background] Closing not-allowed tab:', hostname);
                    
                    if (studyurenTabId) {
                        chrome.tabs.sendMessage(studyurenTabId, {
                            type: "studyuren:website:blocked",
                            data: { url: tab.url }
                        }, () => {
                            chrome.tabs.remove(tab.id);
                        });
                    } else {
                        chrome.tabs.remove(tab.id);
                    }
                }
            } catch (e) {
                console.log('[Background] Cant parse URL:', tab.url);
            }
        });
    });
}

let lastFocusedWindowId = null;

setInterval(async () => {
    const windows = await chrome.windows.getAll({populate: false});
    const focusedWindow = windows.find(w => w.focused);

    if (focusedWindow && focusedWindow.id !== lastFocusedWindowId) {
        console.log('[Background] Nieuw focused window:', focusedWindow.id);
        lastFocusedWindowId = focusedWindow.id;
    }

    if (sessionActive) {
        chrome.tabs.query({}, (tabs) => {
            const studyTab = tabs.find(t =>
                t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
            );

            if (!studyTab) {
                console.log('[Background] Studyuren tab gesloten, sessie stoppen.');
                sessionActive = false;
                studyurenTabId = null;
                broadcastSessionState();
            } else if (studyTab.id !== studyurenTabId) {
                console.log('[Background] TabID update:', studyurenTabId, '->', studyTab.id);
                studyurenTabId = studyTab.id;
            }

            if (!focusedWindow) {
                console.log('[Background] Browser lost focus, sessie blijft actief maar Studyuren-tab wordt niet geforceerd.');
            }
        });
    }
}, 1000);