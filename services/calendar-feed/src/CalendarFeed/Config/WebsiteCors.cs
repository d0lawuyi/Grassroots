namespace CalendarFeed.Config;

// The Grassroots website runs in a browser on a different address than this API, so the
// browser asks first ("may this page call you?") before sending a request. CORS is the
// answer: only these pages may call the API from a browser. The phone app isn't a browser,
// so it never asks and isn't affected.
public static class WebsiteCors
{
    public const string PolicyName = "website";

    public static readonly string[] Origins =
    [
        "https://d0lawuyi.github.io", // the live website on GitHub Pages
        "http://localhost:8081",      // npx expo start --web on your PC
    ];

    // Only what the app sends: GET for feeds, POST for making teams, the sign-in token and JSON.
    public static readonly string[] Methods = ["GET", "POST"];
    public static readonly string[] Headers = ["Authorization", "Content-Type"];
}
