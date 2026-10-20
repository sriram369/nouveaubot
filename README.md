# nouveaubot

Nouveau Elevator bids on public housing authority contracts for elevator
preventive maintenance. Each solicitation arrives as a single PDF of two
hundred or more pages, of which roughly a dozen are forms that must be filled
and returned. The same state and federal forms recur across every authority,
so the work is almost entirely repetition.

nouveaubot reads a packet, reports what must be submitted and when, and fills
the recurring forms from company facts a person has confirmed.

## How it is put together

    browser ──▶ Next.js ──▶ nouveauhermes ──▶ Gemini
                             (Hermes Agent)
                                  │
                         nouveau-bids skill
                                  │
                    ~/.hermes/nouveau/profile.json

The web app is the interface. nouveauhermes is the agent: it owns the loop,
the tools, the skills, and the memory, and it is reachable over Hermes'
OpenAI-compatible gateway. The company profile is a file both of them read.

## Running it

    npm install
    cp .env.example .env.local        # add a Google AI Studio key

    cp -R hermes/SOUL.md ~/.hermes/SOUL.md
    cp -R hermes/skills/nouveau-bids ~/.hermes/skills/
    hermes gateway run                # the agent

    npm run dev                       # the interface

See `hermes/README.md` for installing Hermes itself.

## The rule the design is built around

A value reaches a bid form only when a person has marked it confirmed. The
model decides what to do; it never supplies a company fact.

These forms are signed under penalties of perjury. A plausible invented tax
identification number is a false statement to a government body, not a defect
to correct in the next release. So facts travel one way — from a person, or
from a document a person approved — and anything unconfirmed is shown for
review rather than printed.

The same reasoning covers deadlines. When a packet contradicts itself, every
version is reported with its page and the user is told to confirm in writing
with the awarding authority. Nothing picks one.

## What is not automated

Bid price, surety bonds, notarisation, and certificates issued by the
Commonwealth. These are named as outstanding and left to a person.

## Layout

    src/app            interface and API routes
    src/lib/hermes.ts  the wire to nouveauhermes
    src/lib/fill       form field resolution and PDF overlay
    src/lib/forms      form templates and field maps
    hermes/            SOUL.md and the nouveau-bids skill

Company data is never committed. `.env.local` and the profile both sit
outside this repository.
