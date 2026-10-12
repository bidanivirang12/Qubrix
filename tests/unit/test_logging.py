import logging

from app.core.logging import JsonFormatter, RedactionFilter


def test_filter_redacts_sensitive_fields_and_bearer_tokens() -> None:
    record = logging.LogRecord(
        "test",
        logging.INFO,
        __file__,
        1,
        "request Authorization: Bearer abc.def.secret",
        (),
        None,
    )
    record.runtime_database_url = "postgresql://user:secret@localhost/db"
    record.__dict__["attributes"] = {
        "device_ref": "safe",
        "plaintext": "sensitive-value",
    }

    assert RedactionFilter().filter(record)
    result = JsonFormatter().format(record)

    assert "abc.def.secret" not in result
    assert "postgresql://user:secret" not in result
    assert "sensitive-value" not in result
    assert "[REDACTED]" in result
    attributes = record.__dict__["attributes"]
    assert attributes["device_ref"] == "safe"
    assert attributes["plaintext"] == "[REDACTED]"
