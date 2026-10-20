# nouveauhermes

The Hermes Agent install that backs nouveaubot.

Hermes supplies the agent loop, its learning mechanisms, and the messaging
gateways. This directory holds the parts that are ours: the `nouveau-bids`
skill and the configuration that points Hermes at Gemini.

## Install

    curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash
    hermes config set model.provider gemini
    hermes config set model.default gemini-pro-latest

Put a Google AI Studio key in `~/.hermes/.env` as `GEMINI_API_KEY`.

## Skill

    cp -R hermes/skills/nouveau-bids ~/.hermes/skills/
    python3 ~/.hermes/skills/nouveau-bids/scripts/profile.py init

The company profile lives at `~/.hermes/nouveau/profile.json`, outside this
repository. It holds a tax identification number, officer names, and insurance
details, and is never committed.

## The rule this is built around

A value reaches a bid form only when a person has marked it verified. The
model chooses what to do; it never supplies a company fact. These forms carry
perjury clauses, so a plausible invented value is a false statement to a
government body rather than a defect to fix later.
