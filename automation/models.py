#!/usr/bin/env python3
"""Shared models for the welcome automation."""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True, slots=True)
class ContributorPR:
    """A merged pull request candidate for the welcome automation."""

    repo: str
    pr_number: int
    pr_url: str
    pr_title: str
    contributor_login: str
    contributor_id: Optional[int]
    contributor_type: str
    merged_at: datetime
