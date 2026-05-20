from dataclasses import dataclass, field


@dataclass
class Settings:
    broker_url: str = "redis://localhost:6379/0"
    result_backend: str | None = None
    host: str = "0.0.0.0"
    port: int = 5556
    # How long (seconds) to keep task history in memory
    task_history_limit: int = 10_000
    # Celery inspect timeout in seconds
    inspect_timeout: float = 2.0


settings = Settings()
