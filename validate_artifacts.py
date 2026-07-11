#!/usr/bin/env python3
"""
validate_artifacts.py — check a case folder (or a whole artifacts dir) against contracts.py.

Both builders run this before every merge. Exit code 0 = all cases pass, 1 = something failed.

Usage:
    python validate_artifacts.py artifacts_mock/case_C0035     # one case
    python validate_artifacts.py artifacts_mock                # every case_*/ inside
    python validate_artifacts.py                               # defaults to ./artifacts_mock
"""

from __future__ import annotations

import glob
import os
import sys

import contracts


def _find_cases(path: str) -> list[str]:
    """A path that is itself a case folder → [path]; otherwise its case_*/ children."""
    if os.path.isdir(path) and os.path.basename(path.rstrip("/")).startswith("case_"):
        return [path]
    return sorted(glob.glob(os.path.join(path, "case_*")))


def main(argv: list[str]) -> int:
    target = argv[1] if len(argv) > 1 else "artifacts_mock"
    if not os.path.isdir(target):
        print(f"✗ path not found: {target}")
        return 1

    cases = _find_cases(target)
    if not cases:
        print(f"✗ no case_*/ folders found under {target}")
        return 1

    all_ok = True
    for case_dir in cases:
        errs = contracts.validate_case(case_dir)
        name = os.path.relpath(case_dir)
        if errs:
            all_ok = False
            print(f"✗ {name} — {len(errs)} problem(s):")
            for e in errs:
                print(f"    · {e}")
        else:
            print(f"✓ {name} — passes the contract")

    print()
    print("ALL CASES PASS ✅" if all_ok else "VALIDATION FAILED ❌")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
