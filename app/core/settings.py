from __future__ import annotations

from functools import lru_cache
from typing import Any, Literal
from urllib.parse import parse_qs, unquote, urlsplit

from pydantic import Field as PydanticField
from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import (
    BaseSettings,
    PydanticBaseSettingsSource,
    SettingsConfigDict,
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="QUBRIX_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        env_prefix_target="variable",
        populate_by_name=False,
    )

    environment: Literal["development", "test", "production"] = "development"
    debug: bool = False
    app_secret: SecretStr | None = None
    runtime_database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias="RUNTIME_DATABASE_URL",
    )
    runtime_test_database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias="RUNTIME_TEST_DATABASE_URL",
    )
    test_database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias="TEST_DATABASE_URL",
    )
    allow_nonlocal_test_database_host: bool = False
    database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias="DATABASE_URL",
    )
    oidc_provider: Literal["development", "oidc"] = "development"
    oidc_issuer: str | None = None
    oidc_audience: str | None = None
    jwks_url: str | None = None
    jwks_cache_lifetime_seconds: int = PydanticField(default=300, ge=30, le=86_400)
    jwks_stale_key_grace_seconds: int = PydanticField(default=300, ge=0, le=3_600)
    max_token_lifetime_seconds: int = PydanticField(default=3_600, ge=60, le=86_400)
    clock_skew_leeway_seconds: int = PydanticField(default=60, ge=0, le=300)
    allowed_algorithms: list[str] = PydanticField(default_factory=lambda: ["RS256", "ES256"])
    key_provider: Literal["software", "kms"] = "software"
    cors_origins: list[str] = PydanticField(default_factory=list)
    cors_allow_credentials: bool = False
    request_body_max_bytes: int = PydanticField(default=1_048_576, ge=1_024, le=10_485_760)
    replay_freshness_window_seconds: int = PydanticField(default=2_592_000, ge=60, le=2_592_000)
    timestamp_skew_tolerance_seconds: int = PydanticField(default=300, ge=0, le=3_600)
    service_events_per_minute: int = PydanticField(default=60, ge=1, le=10_000)
    crypto_requests_per_minute: int = PydanticField(default=10, ge=1, le=1_000)
    human_reads_per_minute: int = PydanticField(default=120, ge=1, le=10_000)
    human_writes_per_minute: int = PydanticField(default=30, ge=1, le=1_000)
    db_pool_size: int = PydanticField(default=5, ge=1, le=100)
    db_max_overflow: int = PydanticField(default=5, ge=0, le=100)
    db_statement_timeout_ms: int = PydanticField(default=5000, ge=100, le=120_000)

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[Any, ...]:
        del cls, settings_cls

        def production_aware_dotenv() -> dict[str, Any]:
            init_values = init_settings()
            env_values = env_settings()
            explicit_environment = init_values.get("environment", env_values.get("environment"))
            if explicit_environment == "production":
                return {}

            dotenv_values = dotenv_settings()
            if dotenv_values.get("environment") == "production":
                return {"environment": "production"}
            return dotenv_values

        return (
            init_settings,
            env_settings,
            production_aware_dotenv,
            file_secret_settings,
        )

    @field_validator("allowed_algorithms")
    @classmethod
    def algorithms_are_explicitly_allowed(cls, value: list[str]) -> list[str]:
        allowed = {"RS256", "ES256", "PS256", "EdDSA"}
        if (
            not value
            or len(value) > len(allowed)
            or len(value) != len(set(value))
            or not set(value) <= allowed
        ):
            raise ValueError("allowed_algorithms must be a non-empty unique algorithm allowlist")
        return value

    @field_validator("jwks_url")
    @classmethod
    def jwks_url_is_https(cls, value: str | None) -> str | None:
        if value is None:
            return value
        parsed = urlsplit(value)
        if (
            len(value) > 2_048
            or value != value.strip()
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or parsed.query
            or parsed.fragment
            or not (
                parsed.scheme == "https"
                or (
                    parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
                )
            )
        ):
            raise ValueError("jwks_url must be HTTPS, except for an HTTP localhost test URL")
        return value

    @model_validator(mode="after")
    def validate_production_configuration(self) -> Settings:
        if self.environment != "production":
            return self

        problems: list[str] = []
        if self.debug:
            problems.append("debug must be false")
        if self.app_secret is None or not self._is_strong_secret(
            self.app_secret.get_secret_value()
        ):
            problems.append("app_secret must be set to a strong, non-default secret")
        if self.test_database_url is not None:
            problems.append("test_database_url is forbidden in production")
        if self.database_url is not None:
            problems.append("database_url owner credentials are forbidden in production")
        if self.runtime_database_url is None:
            problems.append("runtime_database_url is required")
        else:
            problems.extend(self._runtime_database_url_problems())
        if self.runtime_test_database_url is not None:
            problems.append("runtime_test_database_url is forbidden in production")
        if self.allow_nonlocal_test_database_host:
            problems.append("allow_nonlocal_test_database_host is forbidden in production")
        if self.oidc_provider != "oidc":
            problems.append("the development OIDC provider is forbidden")
        if self.oidc_issuer is None:
            problems.append("oidc_issuer is required")
        elif not self._is_https_url(self.oidc_issuer, allow_path=True):
            problems.append(
                "oidc_issuer must be an HTTPS URL without credentials, query, or fragment"
            )
        if not self.oidc_audience:
            problems.append("oidc_audience is required")
        if self.jwks_url is None:
            problems.append("jwks_url is required")
        elif not self._is_https_url(self.jwks_url, allow_path=True):
            problems.append("jwks_url must be HTTPS in production")
        if self.key_provider != "kms":
            problems.append("the software key provider is forbidden")
        if not self.cors_origins:
            problems.append("cors_origins must contain allowed production origins")
        elif not all(self._is_explicit_https_origin(origin) for origin in self.cors_origins):
            problems.append("cors_origins must contain only explicit HTTPS origins")

        if problems:
            raise ValueError("invalid production settings: " + "; ".join(problems))
        return self

    @staticmethod
    def _is_strong_secret(secret: str) -> bool:
        lowered_secret = secret.lower()
        return (
            len(secret) >= 32
            and len(set(secret)) >= 12
            and not any(
                marker in lowered_secret
                for marker in (
                    "change-me",
                    "changeme",
                    "secret",
                    "development",
                    "test",
                    "replace-with",
                )
            )
        )

    @staticmethod
    def _is_https_url(value: str, *, allow_path: bool) -> bool:
        parsed = urlsplit(value)
        return (
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
            and (allow_path or parsed.path in {"", "/"})
            and not parsed.query
            and not parsed.fragment
        )

    @staticmethod
    def _is_explicit_https_origin(value: str) -> bool:
        parsed = urlsplit(value)
        return (
            len(value) <= 2_048
            and value == value.strip()
            and value not in {"*", "null"}
            and "*" not in value
            and parsed.scheme == "https"
            and bool(parsed.hostname)
            and parsed.username is None
            and parsed.password is None
            and not parsed.path
            and not parsed.query
            and not parsed.fragment
        )

    def _runtime_database_url_problems(self) -> list[str]:
        assert self.runtime_database_url is not None
        value = self.runtime_database_url.get_secret_value()
        parsed = urlsplit(value)
        problems: list[str] = []
        if parsed.scheme != "postgresql+psycopg":
            problems.append("runtime_database_url must use postgresql+psycopg")
        if not parsed.hostname:
            problems.append("runtime_database_url must include a database host")
        role = unquote(parsed.username or "")
        if not role or role.lower() in {"qubrix_app", "postgres"}:
            problems.append("runtime_database_url must use a non-owner runtime role")
        if not parsed.password:
            problems.append("runtime_database_url must include a password")
        database_name = unquote(parsed.path.lstrip("/"))
        if not database_name or database_name.endswith("_test"):
            problems.append("runtime_database_url must target a named non-test database")
        sslmodes = parse_qs(parsed.query).get("sslmode", [])
        if len(sslmodes) != 1 or sslmodes[0].lower() not in {"require", "verify-full"}:
            problems.append(
                "runtime_database_url must require TLS with sslmode=require or verify-full"
            )
        return problems


@lru_cache
def get_settings() -> Settings:
    return Settings()
