---
name: nouveau-bids
description: Reads housing authority bid packets and fills their forms.
version: 1.0.0
author: Sriram (sriram369), Nouveau Elevator
license: MIT
metadata:
  hermes:
    tags: [procurement, forms, pdf, construction]
    category: productivity
---

# Nouveau Bids Skill

Nouveau Elevator bids on public housing authority elevator maintenance
contracts. Each solicitation arrives as a single PDF of two hundred or more
pages, of which roughly a dozen are forms that must be filled and returned.
The same state and federal forms recur across every authority, so the work is
almost entirely repetition.

This skill reads a packet, reports what must be submitted, and fills the
recurring forms from a company profile that a person has confirmed. It does
not decide the bid price and it does not sign anything.

## When to Use

- A new Invitation for Bids or Request for Proposals arrives as a PDF.
- Someone asks what a packet requires, or when it is due.
- A previously submitted bid needs to be mined for company details.
- A recurring form needs filling for a new authority.

## Prerequisites

- A company profile at `~/.hermes/nouveau/profile.yaml`. Create it with
  `scripts/profile.py init` and fill it in. Nothing fills until it exists.
- `read_file` and `terminal` for the scripts below.

## How to Run

Read a packet:

    python3 scripts/read_packet.py <packet.pdf>

Inspect or edit the profile:

    python3 scripts/profile.py show
    python3 scripts/profile.py set federalId "04-1234567" --verified

Check what a form needs before filling it:

    python3 scripts/fill.py check <form-id>

## Quick Reference

| Item | Who produces it |
|---|---|
| Corporate Identification, REAP, References, EEO, Section 3 list | This skill, from the profile |
| HUD 5369-A, HUD 2530 | This skill, from the profile |
| Bid price | Sales. Never inferred. |
| Bid bond | Surety agent |
| Notarised affidavits | A notary |
| DCAMM certificate and update statement | Issued by the Commonwealth |

## Procedure

1. Read the packet and locate its submission checklist. That checklist, not
   the table of contents, is the authoritative list of what must be returned.
2. Report every stated deadline separately. Packets frequently carry a stale
   cover page beside a current advertisement, and the two disagree.
3. Separate the forms this skill can prepare from the ones a person must
   obtain. Say which is which before offering to do anything.
4. For each preparable form, check readiness against the profile and report
   what is missing. Ask for the missing values.
5. Fill only after the operator approves. Leave blank anything needing a
   person and list it as an outstanding item.

## Pitfalls

- **Never supply a company fact from your own knowledge.** Tax identification
  numbers, licence numbers, insurance limits, and references come from the
  profile or from the operator in conversation. These forms carry perjury
  clauses; a plausible invented value is a false statement to a government
  body, not a typo.
- **Never reconcile conflicting deadlines.** Report both and tell the operator
  to confirm in writing with the awarding authority.
- **An unverified profile value does not fill.** It is shown for confirmation
  first. Confirmation is the operator's word, not your inference.
- **A form map learned from one authority is reused for others.** Verify the
  revision marker printed on the form still matches before reusing a map.

## Verification

After filling, confirm each of these before telling the operator it is done:

- Every drawn value traces to a profile field marked verified.
- Every blank is listed in the outstanding items.
- The deadline reported matches what the operator confirmed, not what the
  cover page claimed.
