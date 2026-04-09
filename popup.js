const domainEl = document.getElementById("domain");
const toggleEl = document.getElementById("allow-toggle");
const statusEl = document.getElementById("status");
const manageButtonEl = document.getElementById("manage-domains");
const openOptionsEl = document.getElementById("open-options");

let currentDomain = "";

manageButtonEl.addEventListener("click", openOptionsPage);
openOptionsEl.addEventListener("click", openOptionsPage);

initialize().catch((error) => {
  domainEl.textContent = "Unavailable";
  statusEl.textContent = error?.message || "Could not read the current tab.";
  toggleEl.disabled = true;
});

async function initialize() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = new URL(tab.url);

  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("This page does not support autoplay controls.");
  }

  currentDomain = normalizeDomain(url.hostname);
  domainEl.textContent = currentDomain;

  const settings = await chrome.runtime.sendMessage({ type: "getSettings" });
  const isBlocked = hostnameMatchesDomainList(currentDomain, settings.blockedDomains || []);

  toggleEl.checked = isBlocked;
  statusEl.textContent = isBlocked
    ? "Autoplay is blocked here."
    : "Autoplay is allowed here.";

  toggleEl.addEventListener("change", onToggleChange);
}

async function onToggleChange() {
  toggleEl.disabled = true;
  statusEl.textContent = "Saving...";

  const response = await chrome.runtime.sendMessage({
    type: "setDomainBlocked",
    domain: currentDomain,
    blocked: toggleEl.checked
  });

  if (response?.error) {
    statusEl.textContent = response.error;
    toggleEl.disabled = false;
    return;
  }

  statusEl.textContent = toggleEl.checked
    ? "Autoplay is now blocked on this domain."
    : "Autoplay is now allowed on this domain.";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.id) {
    await chrome.tabs.reload(tab.id);
  }

  window.close();
}

function openOptionsPage() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function hostnameMatchesDomainList(currentHostname, domains) {
  return domains.some((domain) => {
    const normalized = normalizeDomain(domain);
    return currentHostname === normalized || currentHostname.endsWith(`.${normalized}`);
  });
}

function normalizeDomain(domain) {
  return String(domain || "").trim().toLowerCase().replace(/^www\./, "");
}
