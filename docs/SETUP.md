# Setting up nouveaubot on another machine

Takes about fifteen minutes, most of it waiting on the Hermes installer.

There are two pieces: **nouveauhermes**, the agent, which runs as its own
process; and the **web app**, which is the interface to it. Both run locally.

Verified on macOS with Node 24.14.1 and Hermes Agent v0.22.2. Windows notes
are called out where the commands differ.

---

## 1. Prerequisites

You need Node 20 or newer, Git, and a Google AI Studio key.

    node -v        # 20+
    git --version

If Node is missing: https://nodejs.org, or `brew install node` on macOS.

Get an API key at https://aistudio.google.com/apikey. Keep it somewhere
private and do not paste it into a chat window, including this project's own.

---

## 2. Clone the repository

    git clone https://github.com/Nouveau-Elevator/nouveaubot.git
    cd nouveaubot
    npm install

The repository is private, so you need access to the Nouveau-Elevator
organisation. If `git clone` asks for a password, use the GitHub CLI instead:

    gh auth login
    gh repo clone Nouveau-Elevator/nouveaubot

---

## 3. Install Hermes Agent

**macOS, Linux, WSL2:**

    curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash

**Windows (PowerShell):**

    iex (irm https://hermes-agent.nousresearch.com/install.ps1)

This takes several minutes. It installs its own Python, Node, ripgrep and
FFmpeg under `~/.hermes` (`%LOCALAPPDATA%\hermes` on Windows) and does not
touch system versions of those.

Then reload your shell so the `hermes` command is found:

    source ~/.zshrc      # or ~/.bashrc

Check it:

    hermes --version

---

## 4. Point Hermes at Gemini

    hermes config set model.provider gemini
    hermes config set model.default gemini-pro-latest

Add your AI Studio key to Hermes' own environment file. On macOS and Linux
that is `~/.hermes/.env`; on Windows, `%LOCALAPPDATA%\hermes\.env`. Open it in
an editor and add one line:

    GEMINI_API_KEY=your-key-here

Confirm the agent answers:

    hermes -z "What model are you running on?"

---

## 5. Give it its identity and skill

Without these it is a general-purpose assistant that knows nothing about
Nouveau or bidding.

    cp hermes/SOUL.md ~/.hermes/SOUL.md
    cp -R hermes/skills/nouveau-bids ~/.hermes/skills/

Windows PowerShell:

    Copy-Item hermes\SOUL.md $env:LOCALAPPDATA\hermes\SOUL.md
    Copy-Item -Recurse hermes\skills\nouveau-bids $env:LOCALAPPDATA\hermes\skills\

Create the empty company profile:

    python3 ~/.hermes/skills/nouveau-bids/scripts/profile.py init

Check both landed:

    hermes skills list | grep nouveau
    hermes -z "Who are you?"

The second should answer that it is nouveaubot, working for Nouveau Elevator
Industries. If it says it is Hermes Agent built by Nous Research, SOUL.md is
not in the right place.

---

## 6. Open the gateway the web app talks through

The web app reaches the agent over Hermes' OpenAI-compatible HTTP gateway.
Pick a secret for it — any long random string:

    # macOS / Linux
    KEY=$(python3 -c "import secrets; print('nb_' + secrets.token_urlsafe(32))")
    echo "$KEY"

Configure the gateway with it:

    hermes config set platforms.api_server.enabled true
    hermes config set platforms.api_server.extra.key "$KEY"
    hermes config set platforms.api_server.extra.port 8642

Add the same value to `~/.hermes/.env` as a second line:

    API_SERVER_KEY=the-same-value

Start the gateway. It runs in the foreground, so give it its own terminal:

    hermes gateway run

To have it start automatically and survive reboots instead:

    hermes gateway install
    hermes gateway start

---

## 7. Configure the web app

    cp .env.example .env.local

Edit `.env.local` so it reads:

    GEMINI_API_KEY=your-aistudio-key
    HERMES_API_URL=http://127.0.0.1:8642/v1
    HERMES_API_KEY=the-same-gateway-secret-from-step-6

`HERMES_API_KEY` and `API_SERVER_KEY` must match exactly. A mismatch shows up
as "nouveauhermes rejected the key" in the interface.

`.env.local` is gitignored. Never commit it.

---

## 8. Run it

In a second terminal:

    npm run dev

Open http://localhost:3000.

The dot in the bottom left of the sidebar should be green and read
"nouveauhermes online". If it is red, the gateway in step 6 is not running.

---

## Checking it actually works

Three checks, in order of what they rule out:

    # 1. Is the gateway up?
    curl http://127.0.0.1:8642/health

    # 2. Does the web app see it?
    curl http://localhost:3000/api/health
    # expect {"online":true}

    # 3. Does the agent have its skill and profile?
    curl http://localhost:3000/api/profile

Then in the browser, ask it who it is. The right answer mentions Nouveau
Elevator and bidding.

---

## When something is wrong

**"nouveauhermes offline" in the sidebar.** The gateway is not running.
Start it with `hermes gateway run`, or check `hermes gateway status`.

**"nouveauhermes rejected the key."** `HERMES_API_KEY` in `.env.local` does
not match `API_SERVER_KEY` in `~/.hermes/.env`. They are two copies of one
secret and both must be identical.

**It answers as Hermes Agent and lists iMessage and p5.js skills.** SOUL.md
is missing from `~/.hermes/`. Repeat step 5.

**The profile panel shows 0 of 41 and nothing else.** That is correct on a
fresh install. The profile is deliberately empty until somebody confirms
facts into it.

**`hermes: command not found` after installing.** Reload the shell, or add
`~/.local/bin` to PATH.

**Next.js fails to build with "does not support external modules".** A client
component is importing something that reaches for `node:fs`. Server-only code
belongs in `src/lib/profile-store.ts`; anything the browser needs goes in
`src/lib/profile-schema.ts`.

---

## What lives where

    nouveaubot/              this repository — code only
      .env.local             your keys. Gitignored.
      hermes/SOUL.md         the identity, copied to ~/.hermes
      hermes/skills/         the nouveau-bids skill, copied to ~/.hermes

    ~/.hermes/               the agent. Not in any repository.
      .env                   GEMINI_API_KEY and API_SERVER_KEY
      SOUL.md                identity
      config.yaml            model and gateway settings
      skills/nouveau-bids/   the bidding skill
      nouveau/profile.json   company facts. Holds the federal tax ID.
      nouveau/uploads/       packets attached through the interface

Company data never enters the repository. If you move machines, the profile
has to be copied across deliberately or rebuilt from past bids.

---

## Two running processes

nouveaubot needs both at once:

    Terminal 1:  hermes gateway run     # the agent
    Terminal 2:  npm run dev            # the interface

Closing the first takes the agent offline, and the interface will say so
rather than fail silently.
