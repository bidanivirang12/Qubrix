from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, SecretStr, field_validator, model_validator
from pydantic import Field as PydanticField
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="QUBRIX_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    environment: Literal["development", "test", "production"] = "development"
    debug: bool = False
    app_secret: SecretStr = SecretStr("change-me")
    runtime_database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias=AliasChoices("RUNTIME_DATABASE_URL", "QUBRIX_RUNTIME_DATABASE_URL"),
    )
    runtime_test_database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias=AliasChoices(
            "RUNTIME_TEST_DATABASE_URL", "QUBRIX_RUNTIME_TEST_DATABASE_URL"
        ),
    )
    test_database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias=AliasChoices("TEST_DATABASE_URL", "QUBRIX_TEST_DATABASE_URL"),
    )
    database_url: SecretStr | None = PydanticField(
        default=None,
        validation_alias=AliasChoices("DATABASE_URL", "QUBRIX_DATABASE_URL"),
    )
    oidc_provider: Literal["development", "oidc"] = "development"
    oidc_issuer: str | None = None
    oidc_audience: str | None = None
    key_provider: Literal["software", "kms"] = "software"
    cors_origins: list[str] = []
    cors_allow_credentials: bool = False
    db_pool_size: int = 5
    db_max_overflow: int = 5
    db_statement_timeout_ms: int = 5000

    @field_validator("db_pool_size")
    @classmethod
    def pool_size_is_positive(cls, value: int) -> int:
        if value < 1:
            raise ValueError("db_pool_size must be positive")
        return value

    @field_validator("db_max_overflow")
    @classmethod
    def max_overflow_is_non_negative(cls, value: int) -> int:
        if value < 0:
            raise ValueError("db_max_overflow cannot be negative")
        return value

    @field_validator("db_statement_timeout_ms")
    @classmethod
    def statement_timeout_is_bounded(cls, value: int) -> int:
        if not 100 <= value <= 120_000:
            raise ValueError("db_statement_timeout_ms must be between 100 and 120000")
        return value

    @model_validator(mode="after")
    def validate_production_configuration(self) -> Settings:
        if self.environment != "production":
            return self

        problems: list[str] = []
        if self.debug:
            problems.append("debug must be false")
        secret = self.app_secret.get_secret_value()
        lowered_secret = secret.lower()
        if (
            len(secret) < 32
            or len(set(secret)) < 12
            or any(
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
        ):
            problems.append(
                "app_secret must be a strong, non-default secret of at least 32 characters"
            )
        if self.runtime_database_url is None:
            problems.append("runtime_database_url is required")
        if self.runtime_test_database_url is not None:
            problems.append("runtime_test_database_url is forbidden in production")
        if self.oidc_provider != "oidc":
            problems.append("the development OIDC provider is forbidden")
        if self.oidc_issuer is None:
            problems.append("oidc_issuer is required")
        if not self.oidc_audience:
            problems.append("oidc_audience is required")
        if self.key_provider != "kms":
            problems.append("the software key provider is forbidden")
        if not self.cors_origins:
            problems.append("cors_origins must contain allowed production origins")
        if self.cors_allow_credentials and "*" in self.cors_origins:
            problems.append("credentialed CORS cannot use a wildcard origin")

        if problems:
            raise ValueError("invalid production settings: " + "; ".join(problems))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
