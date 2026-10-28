# Render deployment and uptime monitoring

## Live deployment

- App: https://caps-ai-meetings-organizer.onrender.com/
- Uptime endpoint: https://caps-ai-meetings-organizer.onrender.com/health
- Database readiness: https://caps-ai-meetings-organizer.onrender.com/health/ready
- Render service: `caps-ai-meetings-organizer`, free Docker, Singapore; main branch auto-deploys.
- Render database: `caps-ai-db`, PostgreSQL 16, private internal connection, external access blocked.
- The free database created on 28 October 2026 expires on **27 November 2026**. Back it up or choose a paid database before expiry.
- UptimeRobot HTTP(S) monitor checks the uptime endpoint every five minutes.

## Deployment layout

The Docker image builds Angular with Node 24, publishes the ASP.NET Core 10 API, and serves both from one HTTPS origin. PostgreSQL is a separate managed database. New invitation URLs/QR codes use the deployed browser origin automatically when app-settings.ts has an empty publicApplicationBaseUrl.

Files:

- `Dockerfile`: multistage frontend/backend build, non-root runtime.
- `.dockerignore`: excludes backups, local secrets, dependencies, generated files, and checks.
- `deploy/start.sh`: applies migrations only when RUN_MIGRATIONS=true, then listens on Render's PORT (default 10000).
- `render.yaml`: free Singapore web/database Blueprint with secret database-property binding.
- `DatabaseConfiguration.cs`: accepts a secret DATABASE_URL, preserves the existing local connection setting, decodes PostgreSQL URL credentials, and requires encrypted cloud connections.
- `DeploymentMigration.cs`: explicit `--migrate` entry point; rejects an existing application schema without its matching migration history.

Cloud deployments use a fresh PostgreSQL database. This does not upload local participant records or change the Mac's database. Keep cloud migration history so subsequent deploys can apply only pending migrations.

## Required runtime configuration

| Variable | Value |
|---|---|
| ASPNETCORE_ENVIRONMENT | Production |
| DATABASE_URL | Render PostgreSQL internal connection URL, stored only as a secret environment variable |
| RUN_MIGRATIONS | true for the fresh managed cloud database |
| PORT | Supplied by Render |

Never commit the database password/URL. The Blueprint obtains it with fromDatabase rather than storing credentials in YAML. A direct service creation can use the same internal URL in its environment settings.

Local app startup remains `dotnet run --project CAPS_ai.API` and `npm start` in CAPS_ai-frontend. No local migration is run automatically.

## Monitoring endpoints

- `/health`: cheap liveness response for public uptime monitoring.
- `/health/ready`: checks that PostgreSQL accepts a connection; suitable for Render readiness checks.
- Unknown `/api/...` routes return 404 instead of the Angular HTML shell. Angular deep links such as `/join/{code}` return index.html.

## UptimeRobot

The configured HTTP(S) monitor targets `https://caps-ai-meetings-organizer.onrender.com/health` with a five-minute interval. No API token or organizer session belongs in the monitoring URL.

UptimeRobot's free monitoring interval is currently five minutes. Render free web services currently sleep after 15 minutes without inbound traffic. Incoming monitoring requests can keep a service active but do not guarantee uptime, prevent maintenance restarts, or bypass plan quotas. Do not use /robots.txt as the wake-up target.

Render grants 750 free instance hours per workspace per month, shared by all its free services. Continuous monitoring consumes running hours. This workspace already had three free services before CAPS_ai was added. Free Render PostgreSQL expires after 30 days; export data before expiry or intentionally upgrade the database. Paid always-on compute requires an explicit plan/budget choice.

Sources: [Render free limits](https://render.com/docs/free), [PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting), [UptimeRobot intervals](https://help.uptimerobot.com/en/articles/11360876-what-is-a-monitoring-interval-in-uptimerobot).
