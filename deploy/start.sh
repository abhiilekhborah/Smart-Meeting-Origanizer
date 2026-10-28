#!/bin/sh
set -eu
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  dotnet CAPS_ai.API.dll --migrate
fi
exec dotnet CAPS_ai.API.dll --urls "http://0.0.0.0:${PORT:-10000}"
