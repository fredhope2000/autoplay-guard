# Autoplay Guard

Local Chrome extension that allows autoplay by default, with per-domain opt-in blocking.

## Load it in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this `autoplay-guard` folder.

## Use it

1. Visit a site with autoplaying media, such as `abcnews.com`.
2. Open the extension popup.
3. Turn the toggle on if you want autoplay blocked on that domain.
4. Leave the toggle off if you want that domain to keep autoplay enabled.

The extension reloads the current tab after you change the toggle so the new rule applies immediately.

## Manage the blocked list

- Open the popup and click the `A` button or `Manage blocked domains`.
- Or open the extension's options page from `chrome://extensions`.

From there you can review every blocked domain, add one manually, or remove one without visiting the site first.
