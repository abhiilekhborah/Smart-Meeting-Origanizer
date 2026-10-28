using Npgsql;
namespace CAPS_ai.API.Services;

public static class DatabaseConfiguration
{
    public static string Resolve(IConfiguration configuration)
    {
        var url = configuration["DATABASE_URL"];
        if (string.IsNullOrWhiteSpace(url)) return configuration.GetConnectionString("SmartMeetDB")
            ?? throw new InvalidOperationException("Configure DATABASE_URL or ConnectionStrings:SmartMeetDB.");
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("postgres" or "postgresql")
            || string.IsNullOrEmpty(uri.Host) || string.IsNullOrEmpty(uri.UserInfo) || uri.AbsolutePath.Length < 2)
            throw new InvalidOperationException("DATABASE_URL must be a valid PostgreSQL URL.");
        var credentials = uri.UserInfo.Split(':', 2);
        var settings = new NpgsqlConnectionStringBuilder {
            Host = uri.Host, Port = uri.Port > 0 ? uri.Port : 5432,
            Database = Uri.UnescapeDataString(uri.AbsolutePath[1..]),
            Username = Uri.UnescapeDataString(credentials[0]),
            Password = credentials.Length > 1 ? Uri.UnescapeDataString(credentials[1]) : "",
            SslMode = SslMode.Require, Timeout = 15, MaxPoolSize = 20
        };
        // Render's private connection supports TLS with a self-signed certificate.
        // sslmode=require encrypts the link without falling back to plaintext.
        foreach (var item in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var pair = item.Split('=', 2);
            if (pair[0] != "sslmode" || pair.Length != 2) continue;
            settings.SslMode = pair[1] switch {
                "require" => SslMode.Require, "verify-full" => SslMode.VerifyFull,
                "verify-ca" => SslMode.VerifyCA,
                _ => throw new InvalidOperationException("DATABASE_URL requires an encrypted sslmode.")
            };
        }
        return settings.ConnectionString;
    }
}
