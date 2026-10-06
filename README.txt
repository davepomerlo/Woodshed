WOODSHED — standalone guitar practice app
==========================================

This folder is the whole app. It runs in any modern browser and can be
installed to a phone's home screen or a computer like a normal app.
It works offline after the first visit.

QUICK TEST ON A COMPUTER
  Double-click index.html. Everything works except offline mode and
  "install" (those need the app to be served over https, see below).

PUT IT ONLINE (free) WITH GITHUB PAGES
  1. Create a free account at github.com.
  2. New repository -> name it "woodshed" -> Public -> Create.
  3. "uploading an existing file" -> drag in EVERYTHING inside this folder
     (index.html, all .js files, manifest.webmanifest, sw.js, the icons folder)
     -> Commit changes.
  4. Settings -> Pages -> Source: "Deploy from a branch" -> Branch: main, / (root) -> Save.
  5. After a minute or two your app is at  https://YOUR-NAME.github.io/woodshed/

INSTALL IT
  iPhone/iPad (Safari): open the link -> Share button -> "Add to Home Screen".
  Android (Chrome): open the link -> menu (⋮) -> "Install app" / "Add to Home screen".
  Windows/Mac (Chrome or Edge): open the link -> install icon at the right of the
  address bar (or menu -> "Install Woodshed").

YOUR DATA
  Your log, best tempos and saved place stay on each device.
  To move them: Log tab -> "Save backup file", then "Import backup…" on the other device.

UPDATING THE APP LATER
  1. Replace the changed files in the GitHub repository.
  2. Open sw.js and change  VERSION = 'woodshed-v1'  to 'woodshed-v2' (v3, v4… each time).
  3. Open the app, close it, open it again: the second launch runs the new version.
