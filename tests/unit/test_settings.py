from __future__ import annotations

import logging
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from pydantic import SecretStr, ValidationError
from sqlalchemy.ext.asyncio import AsyncEngine

from app.core.settings import Settings, get_settings
from app.main import create_app


@pytest.fixture(autouse=True)
def isolate_settings_environment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Any:
    monkeypatch.chdir(tmp_path)
    for name in (
        "DATABASE_URL",
        "TEST_DATABASE_URL",
        "RUNTIME_DATABASE_URL",
        "RUNTIME_TEST_DATABASE_URL",
        "QUBRIX_DATABASE_URL",
        "QUBRIX_TEST_DATABASE_URL",
        "QUBRIX_RUNTIME_DATABASE_URL",
        "QUBRIX_RUNTIME_TEST_DATABASE_URL",
        "QUBRIX_ENVIRONMENT",
        "QUBRIX_DEBUG",
        "QUBRIX_APP_SECRET",
        "QUBRIX_OIDC_PROVIDER",
        "QUBRIX_OIDC_ISSUER",
        "QUBRIX_OIDC_AUDIENCE",
        "QUBRIX_JWKS_URL",
        "QUBRIX_JWKS_CACHE_LIFETIME_SECONDS",
        "QUBRIX_CLOCK_SKEW_LEEWAY_SECONDS",
        "QUBRIX_ALLOWED_ALGORITHMS",
        "QUBRIX_KEY_PROVIDER",
        "QUBRIX_CORS_ORIGINS",
        "QUBRIX_ALLOW_NONLOCAL_TEST_DATABASE_HOST",
        "QUBRIX_CORS_ALLOW_CREDENTIALS",
        "QUBRIX_REQUEST_BODY_MAX_BYTES",
        "QUBRIX_REPLAY_FRESHNESS_WINDOW_SECONDS",
        "QUBRIX_TIMESTAMP_SKEW_TOLERANCE_SECONDS",
        "QUBRIX_SERVICE_EVENTS_PER_MINUTE",
        "QUBRIX_CRYPTO_REQUESTS_PER_MINUTE",
        "QUBRIX_HUMAN_READS_PER_MINUTE",
        "QUBRIX_HUMAN_WRITES_PER_MINUTE",
        "QUBRIX_DB_POOL_SIZE",
        "QUBRIX_DB_MAX_OVERFLOW",
        "QUBRIX_DB_STATEMENT_TIMEOUT_MS",
    ):
        monkeypatch.delenv(name, raising=False)
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def production_settings(**overrides: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "environment": "production",
        "debug": False,
        "app_secret": SecretStr("Aa1!bB2@cC3#dD4$eE5%fF6^gG7&hH8*iI9("),
        "runtime_database_url": SecretStr(
            "postgresql+psycopg://qubrix_runtime:runtime-db-password"
            "@db.example.invalid:5432/qubrix_prod?sslmode=verify-full"
        ),
        "oidc_provider": "oidc",
        "oidc_issuer": "https://identity.example.invalid/tenant",
        "oidc_audience": "qubrix-api",
        "jwks_url": "https://identity.example.invalid/tenant/keys",
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
        ({"app_secret": None}, "app_secret must be set"),
        ({"app_secret": SecretStr("short")}, "strong, non-default secret"),
        ({"app_secret": SecretStr("a" * 48)}, "strong, non-default secret"),
        (
            {"app_secret": SecretStr("replace-with-a-random-secret-of-at-least-32-characters")},
            "strong, non-default secret",
        ),
        ({"oidc_provider": "development"}, "development OIDC provider"),
        ({"key_provider": "software"}, "software key provider"),
        ({"runtime_database_url": None}, "runtime_database_url is required"),
        (
            {"allow_nonlocal_test_database_host": True},
            "allow_nonlocal_test_database_host is forbidden in production",
        ),
        ({"oidc_issuer": None}, "oidc_issuer is required"),
        ({"oidc_audience": None}, "oidc_audience is required"),
        ({"jwks_url": None}, "jwks_url is required"),
        ({"cors_origins": []}, "cors_origins must contain"),
    ],
)
def test_insecure_production_settings_are_rejected(override: dict[str, Any], message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        Settings.model_validate(production_settings(**override))


def test_valid_production_configuration_is_accepted() -> None:
    settings = Settings.model_validate(production_settings())
    assert settings.environment == "production"


def test_phase_three_setting_defaults_match_proposed_adr_defaults() -> None:
    settings = Settings()
    assert settings.jwks_cache_lifetime_seconds == 300
    assert settings.clock_skew_leeway_seconds == 60
    assert settings.allowed_algorithms == ["RS256", "ES256"]
    assert settings.request_body_max_bytes == 1_048_576
    assert settings.replay_freshness_window_seconds == 2_592_000
    assert settings.timestamp_skew_tolerance_seconds == 300
    assert settings.service_events_per_minute == 60
    assert settings.crypto_requests_per_minute == 10
    assert settings.human_reads_per_minute == 120
    assert settings.human_writes_per_minute == 30


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("test_database_url", SecretStr("postgresql://owner/db_test"), "test_database_url"),
        ("database_url", SecretStr("postgresql://owner:pw@db/qubrix_prod"), "database_url"),
        (
            "runtime_test_database_url",
            SecretStr("postgresql://runtime:pw@db/qubrix_test"),
            "runtime_test_database_url",
        ),
    ],
)
def test_owner_and_test_database_urls_are_rejected_in_production(
    field: str, value: SecretStr, message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        Settings.model_validate(production_settings(**{field: value}))


@pytest.mark.parametrize(
    ("url", "message"),
    [
        (
            "postgresql://qubrix_runtime:pw@db.example.invalid/qubrix_prod?sslmode=require",
            "postgresql\\+psycopg",
        ),
        (
            "postgresql+psycopg://qubrix_runtime:pw@db.example.invalid/qubrix_test?sslmode=require",
            "non-test database",
        ),
        (
            "postgresql+psycopg://qubrix_app:pw@db.example.invalid/qubrix_prod?sslmode=require",
            "non-owner runtime role",
        ),
        (
            "postgresql+psycopg://postgres:pw@db.example.invalid/qubrix_prod?sslmode=require",
            "non-owner runtime role",
        ),
        (
            "postgresql+psycopg://:pw@db.example.invalid/qubrix_prod?sslmode=require",
            "non-owner runtime role",
        ),
        (
            "postgresql+psycopg://qubrix_runtime@db.example.invalid/qubrix_prod?sslmode=require",
            "must include a password",
        ),
        (
            "postgresql+psycopg://qubrix_runtime:pw@db.example.invalid/qubrix_prod",
            "must require TLS",
        ),
        (
            "postgresql+psycopg://qubrix_runtime:pw@db.example.invalid/qubrix_prod?sslmode=disable",
            "must require TLS",
        ),
    ],
)
def test_invalid_production_runtime_database_urls_are_rejected(url: str, message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        Settings.model_validate(production_settings(runtime_database_url=SecretStr(url)))


@pytest.mark.parametrize(
    "issuer",
    [
        "http://identity.example.invalid",
        "https://user:password@identity.example.invalid",
        "https://identity.example.invalid?tenant=one",
        "https://identity.example.invalid#fragment",
    ],
)
def test_invalid_production_oidc_issuer_is_rejected(issuer: str) -> None:
    with pytest.raises(ValidationError, match="oidc_issuer must be an HTTPS URL"):
        Settings.model_validate(production_settings(oidc_issuer=issuer))


@pytest.mark.parametrize(
    "origins",
    [
        ["*"],
        ["null"],
        ["http://console.example.invalid"],
        ["https://console.example.invalid/path"],
        ["https://*.example.invalid"],
        ["https://user:pw@console.example.invalid"],
        ["https://console.example.invalid?x=1"],
        [f"https://{'a' * 2_049}"],
    ],
)
def test_invalid_production_cors_origins_are_rejected(origins: list[str]) -> None:
    with pytest.raises(ValidationError, match="explicit HTTPS origins"):
        Settings.model_validate(production_settings(cors_origins=origins))


@pytest.mark.parametrize(
    ("field", "invalid_value"),
    [
        ("jwks_cache_lifetime_seconds", 29),
        ("jwks_cache_lifetime_seconds", 86_401),
        ("clock_skew_leeway_seconds", -1),
        ("clock_skew_leeway_seconds", 301),
        ("request_body_max_bytes", 1_023),
        ("request_body_max_bytes", 10_485_761),
        ("replay_freshness_window_seconds", 59),
        ("replay_freshness_window_seconds", 2_592_001),
        ("timestamp_skew_tolerance_seconds", -1),
        ("timestamp_skew_tolerance_seconds", 3_601),
        ("service_events_per_minute", 0),
        ("crypto_requests_per_minute", 1_001),
        ("human_reads_per_minute", 10_001),
        ("human_writes_per_minute", 1_001),
    ],
)
def test_phase_three_settings_are_bounded(field: str, invalid_value: int) -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate({field: invalid_value})


@pytest.mark.parametrize("algorithms", [[], ["none"], ["RS256", "RS256"]])
def test_algorithm_allowlist_rejects_empty_or_unsafe_values(algorithms: list[str]) -> None:
    with pytest.raises(ValidationError, match="algorithm allowlist"):
        Settings.model_validate({"allowed_algorithms": algorithms})


def test_jwks_url_must_be_https_without_userinfo_query_or_fragment() -> None:
    for url in (
        "http://identity.example.invalid/keys",
        "https://user:pw@identity.example.invalid/keys",
        "https://identity.example.invalid/keys?tenant=x",
        "https://identity.example.invalid/keys#key",
        f"https://identity.example.invalid/{'x' * 2_048}",
    ):
        with pytest.raises(ValidationError, match="jwks_url must be an HTTPS URL"):
            Settings.model_validate({"jwks_url": url})


def test_production_rejects_env_example_placeholders(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("QUBRIX_ENVIRONMENT", "production")
    example = (Path(__file__).parents[2] / ".env.example").read_text(encoding="utf-8")
    monkeypatch.chdir(tmp_path)
    (Path.cwd() / ".env").write_text(example, encoding="utf-8")
    with pytest.raises(ValidationError, match="invalid production settings"):
        Settings()


def test_production_ignores_dotenv_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".env").write_text(
        "QUBRIX_APP_SECRET=replace-with-a-random-secret-of-at-least-32-characters\n"
        "RUNTIME_DATABASE_URL=postgresql+psycopg://qubrix_runtime:pw"
        "@db.example.invalid/qubrix_prod?sslmode=require\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("QUBRIX_ENVIRONMENT", "production")
    with pytest.raises(ValidationError, match="app_secret must be set"):
        Settings()


def test_canonical_database_environment_names_and_settings_cache(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://owner:pw@db/qubrix_dev")
    monkeypatch.setenv("QUBRIX_DATABASE_URL", "postgresql://ignored:pw@db/ignored")
    settings = get_settings()
    assert settings.database_url is not None
    assert settings.database_url.get_secret_value() == "postgresql://owner:pw@db/qubrix_dev"


def test_removed_prefixed_database_alias_is_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QUBRIX_DATABASE_URL", "postgresql://ignored:pw@db/ignored")
    assert Settings().database_url is None


def test_settings_repr_and_model_dump_redact_sensitive_values() -> None:
    secret = "Aa1!bB2@cC3#dD4$eE5%fF6^gG7&hH8*iI9("
    database_url = "postgresql://role:db-password@db.example.invalid/qubrix_dev"
    settings = Settings(
        app_secret=SecretStr(secret),
        runtime_database_url=SecretStr(database_url),
        database_url=SecretStr(database_url),
        test_database_url=SecretStr("postgresql://role:test-password@db/qubrix_test"),
    )
    representations = (
        repr(settings),
        repr(settings.model_dump()),
        repr(settings.model_dump(mode="json")),
    )
    for representation in representations:
        assert secret not in representation
        assert "db-password" not in representation
        assert "test-password" not in representation
        assert "db.example.invalid" not in representation


@pytest.mark.asyncio
async def test_startup_logs_do_not_contain_url_password_or_secret(
    caplog: pytest.LogCaptureFixture,
) -> None:
    secret = "Aa1!bB2@cC3#dD4$eE5%fF6^gG7&hH8*iI9("
    database_url = "postgresql://role:db-password@db.example.invalid/qubrix_dev"
    settings = Settings(
        app_secret=SecretStr(secret),
        runtime_database_url=SecretStr(database_url),
    )
    engine = AsyncMock(spec=AsyncEngine)
    app: FastAPI = create_app(settings, engine_factory=lambda _: engine)
    caplog.set_level(logging.INFO)
    async with app.router.lifespan_context(app):
        pass
    logged = caplog.text
    assert secret not in logged
    assert "db-password" not in logged
    assert "db.example.invalid" not in logged
