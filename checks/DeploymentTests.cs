using Microsoft.Extensions.Configuration;
using Npgsql;
using CAPS_ai.API.Services;
using Xunit;
namespace CAPS_ai.Tests;
public class DeploymentTests
{
    private static IConfiguration Config(Dictionary<string,string?> values) => new ConfigurationBuilder().AddInMemoryCollection(values).Build();
    [Fact] public void ExistingLocalConnectionIsPreserved()
    {
        const string local="Host=localhost;Database=SmartMeetDB;Timeout=5";
        Assert.Equal(local,DatabaseConfiguration.Resolve(Config(new(){{"ConnectionStrings:SmartMeetDB",local}})));
    }
    [Fact] public void CloudUrlTakesPriorityAndDecodesCredentials()
    {
        var value=DatabaseConfiguration.Resolve(Config(new(){{"DATABASE_URL","postgresql://test_user:example%40test%3Bvalue@db.example.test:5433/caps_ai?sslmode=require"},{"ConnectionStrings:SmartMeetDB","Host=localhost"}}));
        var parsed=new NpgsqlConnectionStringBuilder(value);
        Assert.Equal("db.example.test",parsed.Host);Assert.Equal(5433,parsed.Port);Assert.Equal("caps_ai",parsed.Database);
        Assert.Equal("test_user",parsed.Username);Assert.Equal("example@test;value",parsed.Password);Assert.Equal(SslMode.Require,parsed.SslMode);Assert.Equal(20,parsed.MaxPoolSize);
    }
    [Theory] [InlineData("not-a-url")] [InlineData("https://example.test/db")] [InlineData("postgresql://example.test/db")] [InlineData("postgresql://user:example@db.example.test/")]
    public void InvalidUrlsFailWithoutLeakingTheirContents(string url)
    {
        var error=Assert.Throws<InvalidOperationException>(()=>DatabaseConfiguration.Resolve(Config(new(){{"DATABASE_URL",url}})));
        Assert.DoesNotContain(url,error.Message);
    }
    [Theory] [InlineData("disable")] [InlineData("prefer")]
    public void CloudUrlsCannotSilentlyFallBackToPlaintext(string mode)=>Assert.Throws<InvalidOperationException>(()=>DatabaseConfiguration.Resolve(Config(new(){{"DATABASE_URL",$"postgresql://user:example@db.example.test/caps_ai?sslmode={mode}"}})));
}
