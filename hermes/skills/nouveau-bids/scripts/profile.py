#!/usr/bin/env python3
"""Company profile store for Nouveau Elevator bids.

Every value carries a confidence and the place it came from. Only values
marked verified are ever drawn onto a form: these documents are signed under
penalties of perjury, so an unchecked value must not reach one by accident.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

PROFILE_PATH = Path.home() / ".hermes" / "nouveau" / "profile.json"

SCALAR_KEYS = [
    "legalName", "dba", "entityType", "stateOfIncorporation",
    "registeredInMassachusetts", "federalId", "ueiSam",
    "massContractorLicense", "dcammCertNumber", "dcammCertExpires",
    "address", "mailingAddress", "phone", "fax", "email", "website",
    "notaryName", "yearsInBusiness", "employeeCount", "mechanicCount",
    "unionAffiliation", "osha10Compliant",
]

LIST_KEYS = ["officers", "references", "section3Employees", "hudPriorParticipation"]

NESTED_KEYS = ["generalLiability", "automobile", "workersComp", "umbrella",
               "authorizedSignatory"]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load() -> dict:
    if not PROFILE_PATH.exists():
        return {}
    try:
        return json.loads(PROFILE_PATH.read_text())
    except json.JSONDecodeError as exc:
        sys.exit(f"Profile at {PROFILE_PATH} is not valid JSON: {exc}")


def save(profile: dict) -> None:
    PROFILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    profile["updatedAt"] = _now()
    PROFILE_PATH.write_text(json.dumps(profile, indent=2) + "\n")
    # The profile holds a tax identification number and officer names.
    PROFILE_PATH.chmod(0o600)


def cmd_init(_: argparse.Namespace) -> None:
    if PROFILE_PATH.exists():
        sys.exit(f"A profile already exists at {PROFILE_PATH}.")
    save({"facts": {}})
    print(f"Created an empty profile at {PROFILE_PATH}.")
    print("Add values with: profile.py set <key> <value> [--verified]")


def cmd_set(args: argparse.Namespace) -> None:
    profile = load() or {"facts": {}}
    facts = profile.setdefault("facts", {})

    known = SCALAR_KEYS + LIST_KEYS + NESTED_KEYS
    root = args.key.split(".")[0]
    if root not in known:
        print(f"Warning: '{root}' is not a known profile key.", file=sys.stderr)
        print(f"Known keys: {', '.join(sorted(known))}", file=sys.stderr)

    facts[args.key] = {
        "value": args.value,
        "confidence": "verified" if args.verified else "needs_review",
        "source": args.source or "entered by operator",
        "verifiedAt": _now() if args.verified else None,
    }
    save(profile)

    state = "verified" if args.verified else "unverified (will not auto-fill)"
    print(f"Set {args.key} = {args.value}  [{state}]")


def cmd_verify(args: argparse.Namespace) -> None:
    profile = load()
    fact = profile.get("facts", {}).get(args.key)
    if not fact:
        sys.exit(f"No value recorded for '{args.key}'.")

    fact["confidence"] = "verified"
    fact["verifiedAt"] = _now()
    save(profile)
    print(f"Verified {args.key} = {fact['value']}")


def cmd_show(args: argparse.Namespace) -> None:
    profile = load()
    facts = profile.get("facts", {})

    if not facts:
        print(f"No profile yet. Create one with: profile.py init")
        return

    verified = {k: v for k, v in facts.items() if v["confidence"] == "verified"}
    pending = {k: v for k, v in facts.items() if v["confidence"] != "verified"}

    if args.json:
        print(json.dumps(profile, indent=2))
        return

    print(f"Profile: {PROFILE_PATH}")
    print(f"  {len(verified)} verified, {len(pending)} awaiting confirmation\n")

    for title, group in (("Verified", verified), ("Awaiting confirmation", pending)):
        if not group:
            continue
        print(f"{title}:")
        for key in sorted(group):
            print(f"  {key:30} {group[key]['value']}")
            print(f"  {'':30} ← {group[key]['source']}")
        print()

    missing = [k for k in SCALAR_KEYS if k not in facts]
    if missing:
        print(f"Not yet recorded ({len(missing)}):")
        print("  " + ", ".join(missing))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("init", help="create an empty profile").set_defaults(func=cmd_init)

    p_set = sub.add_parser("set", help="record a value")
    p_set.add_argument("key")
    p_set.add_argument("value")
    p_set.add_argument("--verified", action="store_true",
                       help="only when a person has confirmed this value")
    p_set.add_argument("--source", default="", help="where this value came from")
    p_set.set_defaults(func=cmd_set)

    p_ver = sub.add_parser("verify", help="confirm a recorded value")
    p_ver.add_argument("key")
    p_ver.set_defaults(func=cmd_verify)

    p_show = sub.add_parser("show", help="print the profile")
    p_show.add_argument("--json", action="store_true")
    p_show.set_defaults(func=cmd_show)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
