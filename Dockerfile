# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS frontend
WORKDIR /src/frontend
COPY CAPS_ai-frontend/package.json CAPS_ai-frontend/package-lock.json ./
RUN npm ci
COPY CAPS_ai-frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS backend
WORKDIR /src
COPY CAPS_ai.API/CAPS_ai.API.csproj CAPS_ai.API/
RUN dotnet restore CAPS_ai.API/CAPS_ai.API.csproj
COPY CAPS_ai.API/ CAPS_ai.API/
RUN dotnet publish CAPS_ai.API/CAPS_ai.API.csproj -c Release -o /publish --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=backend /publish/ ./
COPY --from=frontend /src/frontend/dist/caps-ai/browser/ ./wwwroot/
COPY deploy/start.sh ./start.sh
RUN chmod +x /app/start.sh && chown -R app:app /app
ENV ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_HTTP_PORTS=10000
USER app
EXPOSE 10000
ENTRYPOINT ["/app/start.sh"]
