const DEFAULT_SETTINGS = {
  blockedDomains: []
};

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({
    blockedDomains: normalizeDomains(current.blockedDomains)
  });

  await refreshAllTabBadges();
});

chrome.runtime.onStartup.addListener(() => {
  refreshAllTabBadges().catch(() => {});
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  await updateActionForTabId(tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "loading" || changeInfo.url || tab.url) {
    await updateActionForTab(tab);
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "sync" && changes.blockedDomains) {
    refreshAllTabBadges().catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "getSettings") {
    chrome.storage.sync
      .get(DEFAULT_SETTINGS)
      .then((settings) => {
        sendResponse({
          blockedDomains: normalizeDomains(settings.blockedDomains)
        });
      })
      .catch(() => {
        sendResponse(DEFAULT_SETTINGS);
      });

    return true;
  }

  if (message?.type === "setDomainBlocked") {
    chrome.storage.sync
      .get(DEFAULT_SETTINGS)
      .then(async (settings) => {
        const nextDomains = new Set(normalizeDomains(settings.blockedDomains));

        if (message.blocked) {
          nextDomains.add(normalizeDomain(message.domain));
        } else {
          nextDomains.delete(normalizeDomain(message.domain));
        }

        const payload = {
          blockedDomains: Array.from(nextDomains).sort()
        };

        await chrome.storage.sync.set(payload);
        await updateActionForTabId(sender.tab?.id);
        sendResponse(payload);
      })
      .catch((error) => {
        sendResponse({
          error: error?.message || "Failed to update settings."
        });
      });

    return true;
  }

  return false;
});

function normalizeDomains(domains) {
  return [...new Set((domains || []).map(normalizeDomain).filter(Boolean))].sort();
}

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^\*\./, "").replace(/^www\./, "");
}

async function refreshAllTabBadges() {
  const tabs = await chrome.tabs.query({});
  await Promise.all(tabs.map((tab) => updateActionForTab(tab)));
}

async function updateActionForTabId(tabId) {
  if (!tabId) {
    return;
  }

  const tab = await chrome.tabs.get(tabId);
  await updateActionForTab(tab);
}

async function updateActionForTab(tab) {
  if (!tab?.id) {
    return;
  }

  const domain = getDomainFromUrl(tab.url);

  if (!domain) {
    await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
    await chrome.action.setTitle({
      tabId: tab.id,
      title: "Autoplay Guard"
    });
    return;
  }

  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const isBlocked = hostnameMatchesDomainList(domain, normalizeDomains(settings.blockedDomains));

  await chrome.action.setBadgeText({ tabId: tab.id, text: "" });
  await chrome.action.setIcon({
    tabId: tab.id,
    imageData: createIconImageData(isBlocked ? "#c62828" : "#9e9e9e")
  });

  if (isBlocked) {
    await chrome.action.setTitle({
      tabId: tab.id,
      title: `Autoplay blocked on ${domain}`
    });
    return;
  }

  await chrome.action.setTitle({
    tabId: tab.id,
    title: `Autoplay allowed on ${domain}`
  });
}

function getDomainFromUrl(url) {
  try {
    const parsed = new URL(url);

    if (!/^https?:$/.test(parsed.protocol)) {
      return "";
    }

    return normalizeDomain(parsed.hostname);
  } catch (error) {
    return "";
  }
}

function hostnameMatchesDomainList(currentHostname, domains) {
  return domains.some((domain) => {
    return currentHostname === domain || currentHostname.endsWith(`.${domain}`);
  });
}

function createIconImageData(fillColor) {
  return {
    16: drawIcon(16, fillColor),
    32: drawIcon(32, fillColor)
  };
}

function drawIcon(size, fillColor) {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");
  const inset = Math.max(1, Math.round(size * 0.125));
  const cornerRadius = Math.max(2, Math.round(size * 0.22));

  context.clearRect(0, 0, size, size);
  context.fillStyle = fillColor;
  roundRect(context, inset, inset, size - inset * 2, size - inset * 2, cornerRadius);
  context.fill();

  context.fillStyle = "#ffffff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `700 ${Math.round(size * 0.68)}px Arial`;
  context.fillText("A", size / 2, size / 2 + Math.round(size * 0.03));

  return context.getImageData(0, 0, size, size);
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}
