# EMMS BET — GitHub Pages fixed build

## Why the old page looked broken
The old `index.html` used absolute asset paths:

- `/style.css`
- `/app.js`

Those paths point to the domain root. On a GitHub Pages project site such as `https://username.github.io/repository/`, the assets are inside the repository path, so the browser requested the wrong URLs. That is why the page appeared as plain HTML.

The fixed build uses relative paths:

- `./style.css`
- `./app.js`

## Important GitHub Pages limitation
GitHub Pages serves static files only. It cannot run the Node/Express `server.js` API contained in this project.

For GitHub Pages, this build therefore includes a **local sandbox demo engine** in `app.js`. It lets you test navigation, demo login/signup, wallet screens, simulated M-Pesa/Airtel flows, demo bets, KYC and responsible-gambling screens entirely in the browser. No real money is moved.

## Demo login
User:
`user@emmsbet.test`
`password123`

Admin:
`admin@emmsbet.test`
`admin123`

## Deploy on GitHub Pages
Upload the contents of the `public` folder to the root of the GitHub repository that is publishing the site, then enable GitHub Pages from the repository's Pages settings.

For a real server/API deployment, run the Node project on a host that supports Node.js and point the frontend/API configuration to that server.
