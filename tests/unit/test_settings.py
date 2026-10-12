from __future__ import annotations

from typing import Any

import pytest
from pydantic import SecretStr, ValidationError

from app.core.settings import Settings


def production_settings(**overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "environment": "production",
        "debug": False,
        "app_secret": SecretStr("Aa1!bB2@cC3#dD4$eE5%fF6^gG7&hH8*iI9("),
        "runtime_database_url": SecretStr(
            "postgresql+psycopg://qubrix_runtime:secret@localhost/qubrix_dev"
        ),
        "oidc_provider": "oidc",
        "oidc_issuer": "https://identity.example.invalid",
        "oidc_audience": "qubrix-api",
        "key_provider": "kms",
        "cors_origins": ["https://console.example.invalid"],
        "cors_allow_credentials": False,
    }
    values.update(overrides)
    return values


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"debug": True}, "debug must be false"),
        ({"app_secret": SecretStr("short")}, "strong, non-default secret"),
        ({"app_secret": SecretStr("a" * 48)}, "strong, non-default secret"),
        (
            {"app_secret": SecretStr("replace-with-a-random-secret-and-more")},
            "strong, non-default secret",
        ),
        (
            {"cors_origins": ["*"], "cors_allow_credentials": True},
            "wildcard origin",
        ),
        ({"oidc_provider": "development"}, "development OIDC provider"),
        ({"key_provider": "software"}, "software key provider"),
        ({"runtime_database_url": None}, "runtime_database_url is required"),
        ({"oidc_issuer": None}, "oidc_issuer is required"),
        ({"oidc_audience": None}, "oidc_audience is required"),
        ({"cors_origins": []}, "cors_origins must contain"),
    ],
)
def test_insecure_production_settings_are_rejected(override: dict[str, Any], message: str) -> None:
    values = production_settings(**override)
    with pytest.raises(ValidationError, match=message):
        Settings.model_validate(values)


def test_valid_production_configuration_is_accepted(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("RUNTIME_TEST_DATABASE_URL", raising=False)
    monkeypatch.delenv("QUBRIX_RUNTIME_TEST_DATABASE_URL", raising=False)
    settings = Settings.model_validate(production_settings())
    assert settings.environment == "production"


def test_runtime_test_url_is_not_allowed_in_production() -> None:
    values = production_settings(
        runtime_test_database_url=SecretStr(
            "postgresql+psycopg://qubrix_runtime:secret@localhost/qubrix_test"
        )
    )
    with pytest.raises(ValidationError, match="forbidden in production"):
        Settings.model_validate(values)


def test_settings_load_unprefixed_database_environment_names(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://qubrix_app:secret@localhost/qubrix_dev"
    )
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg://qubrix_app:secret@localhost/qubrix_test",
    )
    settings = Settings()
    assert settings.database_url is not None
    assert settings.test_database_url is not None
