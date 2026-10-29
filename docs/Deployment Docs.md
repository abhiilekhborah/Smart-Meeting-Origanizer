# Deployment Docs

## CAPS.ai Meetings Organizer

Deployment date: **28 October 2026**  
Application URL: https://caps-ai-meetings-organizer.onrender.com/

## 1. How to explain the deployment

> I deployed CAPS.ai Meetings Organizer on Render using Docker. The frontend is built with Angular, the backend uses ASP.NET Core, and the database is PostgreSQL. Docker builds the frontend and backend together, and ASP.NET Core serves both from one application URL. I created a separate managed PostgreSQL database on Render and connected it to the backend using a private database URL stored in an environment variable. Entity Framework Core migrations created the database tables. The GitHub main branch is connected to Render for automatic deployment. I also configured UptimeRobot to check the application every five minutes.

## 2. Deployment architecture

```text
GitHub repository — main branch
              |
              | Render builds the Dockerfile
              v
Render web service — HTTPS public URL
  |
  +-- Angular frontend: HTML, CSS, JavaScript
  |
  +-- ASP.NET Core backend: /api endpoints
              |
              | EF Core + Npgsql
              | Private database connection with TLS
              v
Render managed PostgreSQL database

UptimeRobot -- HTTP request every 5 minutes --> /health
Render readiness check --------------------> /health/ready
```

The frontend and backend run in **one web service**. PostgreSQL runs separately as a managed database. Node.js is used to build Angular; it is not the production API server.

## 3. Technologies and their purpose

| Technology | Purpose in deployment |
|---|---|
| GitHub | Stores the source code and supplies it to Render |
| Render | Builds and hosts the application and managed database |
| Docker | Packages the application and its runtime dependencies |
| Angular | Provides the browser interface |
| ASP.NET Core 10 | Runs the API and serves the built frontend |
| PostgreSQL 16 | Stores meetings, attendees, questions, and migration history |
| Entity Framework Core | Maps C# models to database tables and applies schema migrations |
| Npgsql | Provides PostgreSQL connectivity for .NET and EF Core |
| UptimeRobot | Sends periodic requests to check application availability |

## 4. Steps used to deploy

### Step 1: Prepare the application

The application originally ran locally with Angular and ASP.NET Core on separate ports. For production, it was configured so that ASP.NET Core also serves Angular's compiled files from its `wwwroot` directory.

Frontend requests use relative API paths such as `/api/meetings`. This lets the browser call the backend using the same public domain as the frontend.

Angular routes also have a server fallback. Opening an invitation URL such as `/join/ABC123` returns the Angular application, which then handles the route. Unknown `/api/...` routes still return HTTP 404.

### Step 2: Create a Dockerfile

The Dockerfile uses three stages:

1. **Frontend build:** uses Node.js 24, installs packages with `npm ci`, and runs `npm run build`.
2. **Backend build:** uses the .NET 10 SDK, restores NuGet packages, and publishes the API in Release mode.
3. **Runtime:** uses the ASP.NET Core 10 runtime image and copies in the published backend and compiled Angular files.

The final container runs as the non-root `app` user. Build tools and the frontend development server are not needed in the running container.

The `.dockerignore` file excludes local secrets, backups, dependencies, and generated files from the Docker build context.

### Step 3: Create the cloud database

A fresh managed PostgreSQL 16 database named `caps-ai-db` was created in Render's Singapore region. The web service was created in the same region so it could use Render's internal database connection.

External database access was blocked. Local database records were not copied to the cloud database.

### Step 4: Configure environment variables

The web service received these settings:

| Variable | Configured purpose |
|---|---|
| `ASPNETCORE_ENVIRONMENT=Production` | Runs ASP.NET Core in production mode |
| `DATABASE_URL` | Contains the private PostgreSQL connection URL |
| `RUN_MIGRATIONS=true` | Applies pending database migrations before the API starts |
| `PORT` | Supplied by Render; tells the application which port to listen on |

The actual database password and connection URL are stored in Render's environment settings. They are not included in the source code or this document.

`DatabaseConfiguration.cs` reads `DATABASE_URL` and converts it to an Npgsql connection string. `Program.cs` registers the database context using:

```csharp
builder.Services.AddDbContext<CAPS_aiDbContext>(o =>
    o.UseNpgsql(DatabaseConfiguration.Resolve(builder.Configuration)));
```

The existing local `ConnectionStrings:SmartMeetDB` setting remains available for local development.

### Step 5: Apply database migrations and start the API

The Docker container runs `deploy/start.sh`:

```sh
#!/bin/sh
set -eu
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  dotnet CAPS_ai.API.dll --migrate
fi
exec dotnet CAPS_ai.API.dll --urls "http://0.0.0.0:${PORT:-10000}"
```

The migration command creates the schema in the fresh cloud database. Later starts apply only pending migrations. The cloud `__EFMigrationsHistory` table records which migrations have already run and should be retained.

`DeploymentMigration.cs` also prevents replaying the initial migrations if application tables already exist but their migration history is missing. A migration failure stops startup instead of continuing with an incomplete schema.

The API listens on `0.0.0.0` so Render can reach it. Render provides the public HTTPS endpoint and forwards requests to the container's HTTP port. The `exec` command allows the .NET process to receive shutdown signals directly.

### Step 6: Connect GitHub and create the web service

The deployment files were committed and pushed to the existing GitHub repository. A Render Docker web service was created with these settings:

| Setting | Value |
|---|---|
| Service name | `caps-ai-meetings-organizer` |
| Source branch | `main` |
| Runtime | Docker |
| Dockerfile | `./Dockerfile` |
| Build context | Repository root (`.`) |
| Region | Singapore |
| Plan at deployment | Free |
| Auto-deploy | Enabled on commits |
| Health check path | `/health/ready` |

This deployment was created through the Render integration, with the readiness path configured in the dashboard. The repository also includes `render.yaml` as a Blueprint describing the intended service and database configuration; the live deployment was not created by importing that Blueprint.

After a push to `main`, Render builds a new image and starts a replacement instance. The deployment is complete when Render reports it as **Live** and the application responds successfully.

### Step 7: Configure monitoring

An HTTP(S) monitor was created in UptimeRobot for:

```text
https://caps-ai-meetings-organizer.onrender.com/health
```

Its interval was set to **five minutes**, and its first check reported **Up**.

`/health` checks whether the application responds. `/health/ready` additionally checks whether PostgreSQL accepts a connection; Render uses this endpoint to determine readiness.

The periodic requests can reduce inactivity-related sleeping. Monitoring does not guarantee continuous uptime or remove Render's plan limits.

## 5. Files to show when explaining the implementation

Paths below are relative to the `CAPS_ai` repository root.

| File | What to explain |
|---|---|
| `Dockerfile` | Builds Angular and .NET, then packages the production application |
| `.dockerignore` | Keeps unnecessary files and local secrets out of the build context |
| `deploy/start.sh` | Runs migrations and starts the backend on Render's port |
| `render.yaml` | Describes the Render web service, database, environment binding, and readiness path |
| `CAPS_ai.API/Program.cs` | Registers PostgreSQL, serves frontend files, maps API routes, and defines health endpoints |
| `CAPS_ai.API/Services/DatabaseConfiguration.cs` | Reads the cloud database URL and creates the Npgsql connection configuration |
| `CAPS_ai.API/Services/DeploymentMigration.cs` | Applies migrations safely during explicit deployment startup |
| `CAPS_ai.API/Data/CAPS_aiDbContext.cs` | Defines the EF Core database context and model configuration |
| `CAPS_ai.API/Migrations/` | Contains the versioned database schema changes |
| `checks/DeploymentTests.cs` | Checks database URL parsing and deployment connection settings |

## 6. Verification performed

- Built the complete Docker image successfully.
- Passed 34 backend checks and 23 frontend checks.
- Passed 53 API integration checks against a disposable PostgreSQL database and containerized application.
- Verified that a container restart retained database records and did not replay completed migrations.
- Verified that migration startup rejects an existing application schema without migration history.
- Verified the live frontend, invitation deep link, API, and PostgreSQL readiness endpoint over HTTPS.
- Confirmed Render reported the final deployment as Live.
- Confirmed UptimeRobot reported Up with a five-minute interval.
- Scanned the committed Git history for secrets; no leaks were detected by the scanner.

Temporary test containers and temporary credential files were removed after verification.

## 7. Common presentation questions

**Where is the frontend hosted?**  
The compiled Angular frontend is served by ASP.NET Core inside the Render Docker web service.

**Where is the backend hosted?**  
The ASP.NET Core API runs in the same Render web service as the frontend.

**Where is the database hosted?**  
In a separate Render-managed PostgreSQL instance in Singapore.

**How did the backend connect to PostgreSQL?**  
Render stores the private database URL in `DATABASE_URL`. The backend reads it, builds an Npgsql connection string, and registers EF Core with `UseNpgsql`.

**Did you deploy the local database?**  
A fresh cloud database was created. EF Core migrations created its schema; local participant records were not uploaded.

**Why use Docker?**  
Docker provides a repeatable build for both Angular and .NET and packages the required runtime into one deployable image.

**How do changes reach the website?**  
Push the changes to the connected GitHub `main` branch. Render automatically rebuilds and deploys the application.

**Will data disappear when the application redeploys?**  
Normal web-service redeploys do not remove data from the separate PostgreSQL database. The database still has its own retention, backup, and plan limits.

**What does UptimeRobot do?**  
It requests `/health` every five minutes and tracks availability. It does not host the application or database.

**Why is Swagger not available on the public deployment?**  
The code enables Swagger only in Development. Render runs the application in Production.

## 8. Free-plan details recorded at deployment

At deployment, Render's free web services slept after 15 minutes without inbound traffic, and free instance hours were shared across the workspace. The workspace already contained three other free web services, so continuous monitoring could consume the shared allowance.

The free PostgreSQL instance created for this assignment had an expiry date of **27 November 2026**. Monitoring the web service does not extend the database lifetime. Export required data before that expiry or arrange a suitable database plan.

These are the conditions recorded on 28 October 2026; check the provider dashboard for subsequent changes.

References: [Render Docker deployment](https://render.com/docs/docker), [Render deployments](https://render.com/docs/deploys), [Render free-plan limits](https://render.com/docs/free), [Render PostgreSQL connections](https://render.com/docs/postgresql-creating-connecting), [UptimeRobot monitoring intervals](https://help.uptimerobot.com/en/articles/11360876-what-is-a-monitoring-interval-in-uptimerobot).
