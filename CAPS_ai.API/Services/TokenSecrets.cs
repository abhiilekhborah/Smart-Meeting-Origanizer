using System.Security.Cryptography;
namespace CAPS_ai.API.Services;

public static class TokenSecrets
{
    public static string Create() => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
    public static string Hash(string token)
    {
        if (token is null || token.Length != 64 || !token.All(char.IsAsciiHexDigit))
            throw new ApiException(400, "A token must contain exactly 64 hexadecimal characters.");
        return Convert.ToHexString(SHA256.HashData(Convert.FromHexString(token)));
    }
    public static bool Matches(string token, string? storedHash)
    {
        var hash = Hash(token);
        return storedHash != null && CryptographicOperations.FixedTimeEquals(Convert.FromHexString(hash), Convert.FromHexString(storedHash));
    }
}
