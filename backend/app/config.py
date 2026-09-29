"""
Application Configuration Module.

Manages application-wide environment settings using Pydantic Settings.
Reads environment variables from the OS or a local .env file.
"""

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
    database_url: str
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080
    anthropic_api_key: str

    # Pydantic Settings configuration: read from .env file and ignore unmodeled extra env variables
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


# Global instantiated settings instance used across backend services
settings = Settings()