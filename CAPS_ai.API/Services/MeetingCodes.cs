using System.Security.Cryptography;
using System.Text.RegularExpressions;
namespace CAPS_ai.API.Services;

public static partial class MeetingCodes
{
    public static string Generate()
    {
        var letters = new string(Enumerable.Range(0, 10).Select(_ => (char)('a' + RandomNumberGenerator.GetInt32(26))).ToArray());
        return $"{letters[..3]}-{letters[3..7]}-{letters[7..]}";
    }
    public static string Normalize(string code)
    {
        var value = code.Trim().ToLowerInvariant();
        // Existing invitations retain their original legacy or hexadecimal codes.
        if (!ValidCode().IsMatch(value)) throw new ApiException(400, "Invalid meeting code.");
        return value;
    }
    [GeneratedRegex(@"^(?:[a-z]{3}-[a-z]{4}-[a-z]{3}|[a-f0-9]{16}|legacy-[1-9][0-9]*)$", RegexOptions.CultureInvariant)]
    private static partial Regex ValidCode();
}
