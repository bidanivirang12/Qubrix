# QUBRIX

### Building Trust in the Post-Quantum Era.

**QUBRIX** is a security-focused platform designed to help organizations understand, assess, and prepare for the evolving cryptographic landscape. It aims to bring cryptographic visibility, security intelligence, and post-quantum readiness into a unified platform.

As quantum computing advances, cryptographic systems that secure today's digital infrastructure may face new challenges. QUBRIX explores how organizations can identify cryptographic dependencies, assess potential vulnerabilities, and plan their transition towards quantum-resistant security.

---

## Overview

Modern applications rely on cryptography across APIs, authentication systems, communication channels, infrastructure, and data storage. However, organizations often lack centralized visibility into where cryptographic algorithms are used and how prepared their systems are for future cryptographic threats.

QUBRIX is being developed to address this challenge through a modular security architecture focused on:

- Cryptographic asset discovery and visibility.
- Cryptographic Bill of Materials (CBOM) generation and analysis.
- Identification of potentially vulnerable cryptographic implementations.
- Post-quantum cryptography readiness assessment.
- Security intelligence and actionable insights.
- Secure authentication and authorization.

The long-term objective is to make cryptographic risk assessment more transparent, structured, and actionable.

## Core Capabilities

### 1. Identity and Access Management
A backend authentication and authorization layer designed to enforce controlled access to platform resources.

- JWT-based authentication.
- JWKS-based public key verification.
- Role-based access control.
- Permission and scope validation.
- Organization-aware identity context.
- Identity and authorization inspection through the `Who Am I` API.

### 2. Cryptographic Visibility
A planned capability focused on identifying cryptographic components and dependencies across software systems.

- Cryptographic algorithm identification.
- Cryptographic dependency inventory.
- CBOM generation and analysis.
- Visibility into cryptographic implementation details.

### 3. Post-Quantum Readiness
A core product direction focused on helping organizations evaluate their exposure to emerging quantum-era cryptographic risks.

- Identification of quantum-vulnerable algorithms.
- Post-quantum cryptography assessment.
- Evaluation of migration requirements.
- Exploration of quantum-resistant cryptographic alternatives.

### 4. Security Analysis
A modular analysis architecture intended to connect cryptographic discovery with meaningful security insights.

- Security findings and risk identification.
- Cryptographic asset analysis.
- Structured security reporting.
- Integration with automated scanning workflows.

> Note: Capabilities described as product directions are part of the development roadmap and should not be interpreted as fully implemented features.

---

## Architecture and Technology Stack

QUBRIX follows a modular architecture with separate frontend, backend, and cryptographic analysis components.

| Layer | Technology |
|---|---|
| Backend API | Python, FastAPI |
| Frontend | TypeScript |
| Styling | Tailwind CSS |
| Cryptographic scanning | Go |
| Authentication | JWT, JWKS |
| Data validation | Pydantic |
| API communication | REST |
| Cryptographic inventory | CBOM-oriented workflows |
| Post-quantum security | Post-quantum cryptographic algorithms |

### High-Level Architecture

```text
                 QUBRIX PLATFORM
                        |
          +-------------+-------------+
          |                           |
     FRONTEND                    BACKEND API
  TypeScript / UI                  FastAPI
          |                           |
          |                 +---------+---------+
          |                 |                   |
          |            Authentication      Authorization
          |                 |                   |
          |                 +---------+---------+
          |                           |
          +---------------------------+
                                      |
                         CRYPTOGRAPHIC ANALYSIS
                                      |
                       +--------------+--------------+
                       |              |              |
                   CryptoScan       CBOM       PQC Assessment
                       |              |              |
                       +--------------+--------------+
                                      |
                              SECURITY INSIGHTS
```

*Conceptual architecture illustrating the intended system components.*

---

## Security Design

Security is a foundational consideration in QUBRIX's development.

The backend incorporates security-oriented practices such as:

- Token signature verification using trusted JWKS.
- JWT claim validation.
- Issuer and audience validation.
- Expiration and not-before checks.
- Role and permission enforcement.
- Structured logging with sensitive-data redaction.
- Configuration validation.
- Fail-closed handling of authentication verification failures.

The implementation is undergoing continued testing and hardening.

---

## Project Structure

The repository is organized around a modular backend and frontend architecture.

```text
QUBRIX/
│
├── app/
│   ├── main.py
│   └── core/
│       ├── auth_dependencies.py
│       ├── authorization.py
│       ├── jwt_auth.py
│       ├── logging.py
│       └── settings.py
│
├── tests/
│   ├── unit/
│   └── api/
│
├── frontend/
│
├── docs/
│
├── pyproject.toml
├── uv.lock
└── README.md
```

*This is a representative structure; additional modules and directories may exist in the repository.*

---

## Getting Started

### Prerequisites

- Python 3.12
- Node.js and npm (for frontend development)
- Git
- A supported package manager for the respective project components

### Clone the Repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd QUBRIX
```

### Backend Environment

Create and activate a Python virtual environment:

```bash
python -m venv .venv
```

Install the project dependencies using the repository's dependency configuration:

```bash
uv sync
```

Configure the required environment variables according to the project's settings and identity-provider configuration.

### Run the Backend

```bash
uv run uvicorn app.main:app --reload
```

When the application is running, FastAPI's interactive API documentation is generally available at:

```text
http://127.0.0.1:8000/docs
```

*Verify the actual application startup configuration and required environment variables before using these commands.*

---

## Testing

QUBRIX includes unit and API-level backend tests.

Run the backend test suite with:

```bash
python -m pytest -q
```

Run selected security-related tests:

```bash
python -m pytest tests/unit/auth tests/unit/test_logging.py tests/unit/test_logging_redaction.py tests/unit/test_settings.py -q
```

Python 3.12 is the required interpreter for the current backend configuration.

---

## Development Roadmap

QUBRIX is actively being developed, with the following areas forming its development direction:

- [x] FastAPI backend foundation.
- [x] JWT authentication foundation.
- [x] JWKS-based token verification.
- [x] Role and permission enforcement foundation.
- [x] Identity inspection endpoint.
- [ ] Complete authentication and logging test stabilization.
- [ ] Persistent security-event management.
- [ ] Organization-level data isolation.
- [ ] Cryptographic asset discovery.
- [ ] CBOM generation and analysis workflows.
- [ ] CryptoScan integration.
- [ ] Post-quantum cryptography assessment.
- [ ] Security reporting and analytics.
- [ ] Production deployment and operational hardening.

*The checklist reflects the development status currently established in the project discussions. Reconcile it with the actual repository before publishing.*

---

## Project Vision

QUBRIX aims to move beyond traditional vulnerability detection by addressing a less visible but increasingly important dimension of cybersecurity: cryptographic resilience.

The goal is to provide a structured foundation for understanding cryptographic dependencies, identifying long-term risks, and preparing digital infrastructure for the post-quantum transition.

**Discover. Assess. Secure. Prepare for the Quantum Era.**

---

## Contributing

Contributions, suggestions, and discussions are welcome as the platform evolves.

If you would like to contribute:

1. Fork the repository.
2. Create a feature branch.
3. Implement and test your changes.
4. Submit a pull request with a clear description of the implementation.

Please avoid committing secrets, credentials, private keys, or sensitive configuration files.

---

## License

The licensing terms for QUBRIX will be specified in the repository's `LICENSE` file.

If no license file is present, all rights remain reserved by the copyright holder.

---

**QUBRIX — Cryptographic Intelligence for a Quantum-Ready Future.**
