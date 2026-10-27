# @kieksme/csp-cli

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

The customer API runtime image includes `curl` for hosting-platform HTTP
healthchecks. For Coolify, check `GET /health` on internal port 3001 and expect
HTTP 200. See [deployment](../../docs/deployment.md) for the settings.

Alle Portal-Builds enthalten standardmäßig `noindex, nofollow`, eine sperrende `robots.txt` und eine `_headers`-Vorlage. Bei Unterpfad-Hosting muss `robots.txt` zusätzlich am Domain-Root veröffentlicht werden. Suchmaschinensteuerung ist keine Zugriffssperre und garantiert keine Entfernung bestehender Suchtreffer.
