namespace CalendarFeed.Config;

// The Grassroots website runs in a browser on a different address than this API, so the
// browser asks first ("may this page call you?") before sending a request. CORS is the
// answer: only these pages may call the API from a browser. The phone app isn't a browser,
// so it never asks and isn't affected.
public static class WebsiteCors
{
    public const string PolicyName = "website";

    // Exact addresses: the live website on Vercel and "npx expo start --web" on your PC.
    public static readonly string[] Origins =
    [
        "http://localhost:8081",
    ];

    // Vercel preview builds (one per pull request) get addresses like
    // grassroots-git-web-version-<account>.vercel.app. Only addresses ending in your own
    // account's suffix are allowed, so someone else's Vercel site can't call the API.
    public static readonly string[] VercelSuffixes =
    [
    ];

    // Only what the app sends: GET for feeds, POST for making teams, the sign-in token and JSON.
    public static readonly string[] Methods = ["GET", "POST"];
    public static readonly string[] Headers = ["Authorization", "Content-Type"];

    public static bool IsAllowed(string origin)
    {
        if (Origins.Contains(origin, StringComparer.OrdinalIgnoreCase)) return true;
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps) return false;
        return VercelSuffixes.Any(suffix => uri.Host.EndsWith(suffix, StringComparison.OrdinalIgnoreCase));
    }
}
