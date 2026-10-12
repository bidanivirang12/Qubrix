from __future__ import annotations

import uvicorn


def main() -> None:
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        loop="app.core.asyncio_support:selector_loop_factory",
    )


if __name__ == "__main__":
    main()
