const ALLOWED_SITES = ["itslearning.com", "somtoday.nl", "bijsven.nl", "studygo.com", "chatgpt.com" ];

fetch("https://studyuren.bijsven.nl/allowed_sites.json").then(res => res.json()).then(data => {
    ALLOWED_SITES = data;
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
    }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "studyuren:user-active") {
        if (studyurenTabId) {
            chrome.tabs.sendMessage(studyurenTabId, { type: "studyuren:session:active" });
        }
    }
});


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

    chrome.tabs.query({}, (tabs) => {
    if (!focusedWindow) {
        focusStudyurenTab()
        console.log('[Background] No focussed window');
        if (sessionActive) {
            console.log('[Background] Browser lost focus, stopping session.');
            const studyTab = tabs.find(t => 
                t.url && (t.url.includes('studyuren.bijsven.nl') || t.url.includes('localhost'))
            );

            sessionActive = false;

            chrome.tabs.sendMessage(studyTab.id, {
                type: "studyuren:session:force-stop"
            }, () => {
                if (chrome.runtime.lastError) {
                    console.log('[Background] Kon stop bericht niet sturen');
                }
            });

            broadcastSessionState();
        }
    } else if (focusedWindow.id !== lastFocusedWindowId) {
        console.log('[Background] Nieuw focused window:', focusedWindow.id);
        lastFocusedWindowId = focusedWindow.id;
    }
    });

}, 1000);
