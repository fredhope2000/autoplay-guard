const SETTINGS_FALLBACK = {
  blockedDomains: []
};

let isBlockedDomain = false;
let recentUserGestureAt = 0;

const hostname = normalizeDomain(window.location.hostname);

trackUserIntent();
observeStorageChanges();

initialize().catch(() => {
  enforceAgainstDocument();
  observeMutations();
});

async function initialize() {
  const settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  applySettings(settings);
  enforceAgainstDocument();
  observeMutations();
}

function applySettings(settings) {
  const blockedDomains = Array.isArray(settings?.blockedDomains)
    ? settings.blockedDomains.map(normalizeDomain).filter(Boolean)
    : SETTINGS_FALLBACK.blockedDomains;

  isBlockedDomain = hostnameMatchesDomainList(hostname, blockedDomains);
}

function trackUserIntent() {
  const markUserIntent = () => {
    recentUserGestureAt = Date.now();
  };

  document.addEventListener("pointerdown", markUserIntent, true);
  document.addEventListener("keydown", markUserIntent, true);
  document.addEventListener("touchstart", markUserIntent, true);

  document.addEventListener(
    "play",
    (event) => {
      if (!(event.target instanceof HTMLMediaElement)) {
        return;
      }

      if (shouldAllowPlayback()) {
        return;
      }

      pauseMediaElement(event.target);
    },
    true
  );
}

function observeStorageChanges() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync" || !changes.blockedDomains) {
      return;
    }

    applySettings({ blockedDomains: changes.blockedDomains.newValue || [] });

    if (isBlockedDomain) {
      enforceAgainstDocument();
    }
  });
}

function observeMutations() {
  const observer = new MutationObserver((mutations) => {
    if (!isBlockedDomain) {
      return;
    }

    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        collectMediaElements(node).forEach(prepareMediaElement);
      }
    }
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true
  });
}

function enforceAgainstDocument() {
  if (!isBlockedDomain) {
    return;
  }

  document.querySelectorAll("video, audio").forEach(prepareMediaElement);

  window.setTimeout(() => {
    document.querySelectorAll("video, audio").forEach((element) => {
      if (!shouldAllowPlayback()) {
        pauseMediaElement(element);
      }
    });
  }, 1500);
}

function collectMediaElements(node) {
  if (!(node instanceof Element)) {
    return [];
  }

  if (node.matches("video, audio")) {
    return [node];
  }

  return Array.from(node.querySelectorAll("video, audio"));
}

function prepareMediaElement(element) {
  if (!(element instanceof HTMLMediaElement)) {
    return;
  }

  element.autoplay = false;
  element.removeAttribute("autoplay");

  if (!shouldAllowPlayback()) {
    pauseMediaElement(element);
  }
}

function pauseMediaElement(element) {
  try {
    element.pause();
  } catch (error) {
    return;
  }

  if (!Number.isNaN(element.currentTime) && element.currentTime > 0.25) {
    try {
      element.currentTime = 0;
    } catch (error) {
      return;
    }
  }
}

function shouldAllowPlayback() {
  return !isBlockedDomain || Date.now() - recentUserGestureAt < 1500;
}

function hostnameMatchesDomainList(currentHostname, domains) {
  return domains.some((domain) => {
    return currentHostname === domain || currentHostname.endsWith(`.${domain}`);
  });
}

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^www\./, "");
}
