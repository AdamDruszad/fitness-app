"""
Application Configuration Module.

Manages application-wide environment settings using Pydantic Settings.
Reads environment variables from the OS or a local .env file.
"""

from typing import Literal
from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Central application settings schema.
    
    Attributes:
        database_url: Database connection string (PostgreSQL for production, SQLite optional).
        secret_key: Secret key used to sign JWT authentication tokens.
        algorithm: Hashing algorithm for JWT (defaults to HS256).
        access_token_expire_minutes: Expiration duration for access tokens (defaults to 7 days).
        anthropic_api_key: API key for Anthropic Claude (used for workout plans, chat, overload suggestions).
    """
    database_url: SecretStr
    secret_key: SecretStr
    algorithm: Literal["HS256", "HS384", "HS512"] = "HS256"
    access_token_expire_minutes: int = Field(default=10080, ge=1, le=43200)
    anthropic_api_key: SecretStr
    allowed_origins: str = "https://fitness-app-two-tawny.vercel.app"

    @field_validator("secret_key")
    @classmethod
    def validate_signing_key(cls, value):
        if len(value.get_secret_value().strip()) < 32:
            raise ValueError("SECRET_KEY must contain at least 32 characters")
        return value

    @field_validator("database_url", "anthropic_api_key")
    @classmethod
    def validate_nonempty_secret(cls, value):
        if not value.get_secret_value().strip():
            raise ValueError("This setting must not be empty")
        return value

    # Pydantic Settings configuration: read from .env file and ignore unmodeled extra env variables
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)


# Global instantiated settings instance used across backend services
settings = Settings()
