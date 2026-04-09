const DEFAULT_SETTINGS = {
  blockedDomains: []
};

const formEl = document.getElementById("domain-form");
const inputEl = document.getElementById("domain-input");
const statusEl = document.getElementById("form-status");
const countEl = document.getElementById("count");
const listEl = document.getElementById("domain-list");
const emptyStateEl = document.getElementById("empty-state");

formEl.addEventListener("submit", onSubmit);
listEl.addEventListener("click", onListClick);
chrome.storage.onChanged.addListener(onStorageChanged);

initialize().catch((error) => {
  statusEl.textContent = error?.message || "Could not load blocked domains.";
});

async function initialize() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  render(normalizeDomains(settings.blockedDomains));
}

async function onSubmit(event) {
  event.preventDefault();

  const domain = normalizeDomain(inputEl.value);

  if (!domain || !looksLikeDomain(domain)) {
    statusEl.textContent = "Enter a valid domain like abcnews.com.";
    return;
  }

  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const blockedDomains = new Set(normalizeDomains(settings.blockedDomains));

  if (blockedDomains.has(domain)) {
    statusEl.textContent = "That domain is already blocked.";
    return;
  }

  blockedDomains.add(domain);
  const nextDomains = Array.from(blockedDomains).sort();

  await chrome.storage.sync.set({ blockedDomains: nextDomains });
  inputEl.value = "";
  statusEl.textContent = `Autoplay will now be blocked on ${domain}.`;
}

async function onListClick(event) {
  const removeButton = event.target.closest("[data-domain]");

  if (!removeButton) {
    return;
  }

  const domain = removeButton.dataset.domain;
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const nextDomains = normalizeDomains(settings.blockedDomains).filter((item) => item !== domain);

  await chrome.storage.sync.set({ blockedDomains: nextDomains });
  statusEl.textContent = `Removed ${domain} from the blocked list.`;
}

function onStorageChanged(changes, areaName) {
  if (areaName !== "sync" || !changes.blockedDomains) {
    return;
  }

  render(normalizeDomains(changes.blockedDomains.newValue || []));
}

function render(domains) {
  countEl.textContent = `${domains.length} ${domains.length === 1 ? "domain" : "domains"}`;
  listEl.replaceChildren(...domains.map(createDomainItem));
  emptyStateEl.hidden = domains.length > 0;
}

function createDomainItem(domain) {
  const item = document.createElement("li");
  item.className = "domain-item";

  const name = document.createElement("span");
  name.className = "domain-name";
  name.textContent = domain;

  const removeButton = document.createElement("button");
  removeButton.className = "remove-button";
  removeButton.type = "button";
  removeButton.dataset.domain = domain;
  removeButton.textContent = "Remove";

  item.append(name, removeButton);
  return item;
}

function normalizeDomains(domains) {
  return [...new Set((domains || []).map(normalizeDomain).filter(Boolean))].sort();
}

function normalizeDomain(domain) {
  return String(domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^www\./, "");
}

function looksLikeDomain(domain) {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain);
}
