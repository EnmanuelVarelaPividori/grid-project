# Team deployment notes — SURF Research Cloud (not deployed)

The screenshot asks the team to set up a shared environment on **SURF Research Cloud**. The GridShare ZIP deliberately runs locally first and **has not** been connected to your SURF workspace, because your team must authorize that environment.

For a **private team-only demo** (not a production release), on a suitable SURF Ubuntu VM:

1. Ask your SURF project admin to create the instance and grant the right project members access, following SURF policies.
2. Copy this folder onto the VM (for example through a Git repository or encrypted SCP). Do not commit `data/gridshare.sqlite3`, emails, or private energy data.
3. Check `python3 --version` (3.10 or later). Run `python3 app.py`. It listens only on `127.0.0.1:8765` on the VM.
4. From your own laptop use SSH tunneling: `ssh -L 8765:127.0.0.1:8765 your-user@your-surf-vm` and visit http://127.0.0.1:8765 in your laptop's browser.
5. **Do not open port 8765 to the public internet.** The local account feature does not perform real authentication or multiuser isolation; requests and public opt-in are only app-local concepts.

For a future secure shared web deployment you would need multiuser authorization, TLS, separate accounts & roles, connection ownership verification, consent/audit logging, rate limits, hardened persistence and a privacy/legal review. That is a distinct engineering project, not a change to a port binding.
