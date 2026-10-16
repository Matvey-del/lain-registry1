# Lain Registry - wings cosmetics deployment

The Minecraft client reads and writes wing cosmetics through these routes:
- `GET /cosmetics?names=Steve,Alex`
- `PUT /cosmetics/:nick` with JSON `{ "enabled": true, "style": "ANGEL" | "DEMON" | "CYBER" }`

## Deploy to Render
1. Push the contents of `registry-server` to the GitHub repository used by the Render Web Service, or set the service Root Directory to `LainVisuals/registry-server` if deploying this combined repository.
2. Build command: `npm install`
3. Start command: `npm start`
4. Add a persistent disk mounted at `/var/data`.
5. Add environment variable `LAIN_REGISTRY_DATA_FILE=/var/data/cosmetics.json`.
6. Deploy and verify `https://lain-registry.onrender.com/` returns `ok`.
7. Verify `https://lain-registry.onrender.com/cosmetics?names=YourNick` returns JSON containing a `cosmetics` object. Before any user has saved preferences, it will be empty.

## Test a save
Send a PUT request to `/cosmetics/YourNick` with JSON body `{"enabled":true,"style":"ANGEL"}` and then GET `/cosmetics?names=YourNick`. Use a real Minecraft nickname (3-16 letters, digits, or underscore).

## Important
The client only displays another player's wings after that player's preference has been saved to the registry and the viewing client successfully fetches it. Both players need this client mod. Current write API does not authenticate nick ownership; use only on a trusted registry until authentication is added.
