using System.Text;
using System.Text.Json;

namespace CalendarFeed.Config;

/// <summary>
/// Finds the Supabase address and secret key. Looks at environment variables first,
/// then a .env file here, then the Python tools' .env, so one key file serves both.
/// </summary>
internal sealed record Settings(string SupabaseUrl, string ServiceKey)
{
    public static Settings Load(string contentRoot)
    {
        var files = new[]
        {
            Path.Combine(contentRoot, ".env"),
            Path.Combine(contentRoot, "..", "..", ".env"),                  // services/calendar-feed/.env
            Path.Combine(contentRoot, "..", "..", "..", "python", ".env"),  // services/python/.env
        };
        var fromFiles = new Dictionary<string, string>();
        // Earlier files win, so read the list backwards. (Enumerable.Reverse is spelled out
        // because in C# 14 files.Reverse() would pick the in-place Span version.)
        foreach (var file in Enumerable.Reverse(files))
        {
            foreach (var (k, v) in ReadEnvFile(file)) fromFiles[k] = v;
        }

        string Get(string key) =>
            Environment.GetEnvironmentVariable(key) ?? fromFiles.GetValueOrDefault(key) ?? "";

        var url = Get("SUPABASE_URL").TrimEnd('/');
        if (url.EndsWith("/rest/v1", StringComparison.Ordinal)) url = url[..^"/rest/v1".Length];
        var key = Get("SUPABASE_SERVICE_ROLE_KEY");

        if (url.Length == 0)
            throw new InvalidOperationException("SUPABASE_URL is missing. Set it as an environment variable or in services/python/.env.");
        if (key.Length == 0)
            throw new InvalidOperationException("SUPABASE_SERVICE_ROLE_KEY is missing. Set it as an environment variable or in services/python/.env.");
        if (KeyRole(key) == "anon")
            throw new InvalidOperationException("SUPABASE_SERVICE_ROLE_KEY is the public (anon/publishable) key. Use the secret key from Supabase > Project Settings > API Keys.");

        return new Settings(url, key);
    }

    internal static IEnumerable<(string Key, string Value)> ReadEnvFile(string path)
    {
        if (!File.Exists(path)) yield break;
        foreach (var raw in File.ReadAllLines(path))
        {
            var line = raw.Trim();
            if (line.Length == 0 || line.StartsWith('#')) continue;
            var eq = line.IndexOf('=');
            if (eq <= 0) continue;
            yield return (line[..eq].Trim(), line[(eq + 1)..].Trim().Trim('"', '\''));
        }
    }

    /// <summary>"anon", "service_role" or null. Same check as the Python tools' key_role().</summary>
    internal static string? KeyRole(string key)
    {
        if (key.StartsWith("sb_publishable_", StringComparison.Ordinal)) return "anon";
        if (key.StartsWith("sb_secret_", StringComparison.Ordinal)) return "service_role";
        var parts = key.Split('.');
        if (parts.Length != 3) return null;
        try
        {
            var payload = parts[1].Replace('-', '+').Replace('_', '/');
            payload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
            using var doc = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)));
            return doc.RootElement.TryGetProperty("role", out var role) ? role.GetString() : null;
        }
        catch (Exception e) when (e is FormatException or JsonException)
        {
            return null;
        }
    }
}
