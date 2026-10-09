# Starter task runner: the single source of truth for checks. The GitHub
# workflow is a thin wrapper that calls these recipes.

set shell := ["bash", "-euo", "pipefail", "-c"]

# List the commands.
default:
    @just --list --unsorted

# Lockfiles in sync, clean install, lint, build, and the agent importing with no provider key. CI's build job.
check:
    npm ci
    npm run lint
    SECTR_AGUI_URL="${SECTR_AGUI_URL:-https://api.sectr.dev/ag-ui/support-agent/chat_oai}" npm run build
    cd agent && uv lock --check && uv sync --frozen
    # `sectr dev` / deploy import app.py before secrets are injected.
    cd agent && env -u OPENAI_API_KEY uv run --frozen python -c "import app"

# Full turn, approval and resume on both routes (CI's smoke job). Needs SECTR_AGUI_URL; with SECTR_INVOCATION_KEY it runs against a deployed agent, without it against `sectr dev`.
smoke:
    @[ -n "${SECTR_AGUI_URL:-}" ] || { echo "set SECTR_AGUI_URL (the chat_oai route's AG-UI URL)" >&2; exit 2; }
    npm run smoke
