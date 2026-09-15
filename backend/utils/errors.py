"""Shared exception types used across the calculation and campaign modules."""

from __future__ import annotations


class CalculationValidationError(Exception):
    """Raised when the AR file fails validation (missing sheets, no payment-date column)."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code
