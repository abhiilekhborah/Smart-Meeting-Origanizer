using Npgsql;
using Microsoft.EntityFrameworkCore;
using SmartMeet.API.Data;
using SmartMeet.API.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<SessionService>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(o => {
    o.AddSecurityDefinition("Session", new Microsoft.OpenApi.OpenApiSecurityScheme {
        Type = Microsoft.OpenApi.SecuritySchemeType.Http, Scheme = "bearer",
        Description = "Server-issued anonymous session token returned by create meeting or join. Not a JWT." });
    o.AddSecurityRequirement(document => new Microsoft.OpenApi.OpenApiSecurityRequirement {
        [new Microsoft.OpenApi.OpenApiSecuritySchemeReference("Session", document)] = new List<string>() });
});
builder.Services.AddDbContext<SmartMeetDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("SmartMeetDB")));
builder.Services.AddScoped<IMeetingService, MeetingService>();
builder.Services.AddScoped<IQuestionService, QuestionService>();
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod()));
var app = builder.Build();
app.Use(async (context, next) =>
{
    try { await next(); }
    catch (Exception ex)
    {
        var (status, detail) = ex switch
        {
            ApiException e => (e.Status, e.Message),
            DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } } => (409, "Another request changed the queue. Refresh and try again."),
            PostgresException { SqlState: PostgresErrorCodes.DeadlockDetected or PostgresErrorCodes.SerializationFailure } => (409, "A simultaneous request changed this meeting. Please retry."),
            DbUpdateException { InnerException: NpgsqlException } => (503, "PostgreSQL is unavailable. Check the connection string and database migrations."),
            NpgsqlException => (503, "PostgreSQL is unavailable. Check the connection string and database migrations."),
            _ => (500, "An unexpected server error occurred.")
        };
        app.Logger.LogError(ex, "Request failed with status {Status}", status);
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new { title = detail, status });
    }
});
app.UseCors();
if (app.Environment.IsDevelopment()) { app.UseSwagger(); app.UseSwaggerUI(); }
app.MapControllers();
app.Run();
public partial class Program { }
