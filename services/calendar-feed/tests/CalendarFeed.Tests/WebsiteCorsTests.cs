using CalendarFeed.Config;

namespace CalendarFeed.Tests;

public class WebsiteCorsTests
{
    [Fact]
    public void Live_website_may_call_the_api() => Assert.Contains("https://d0lawuyi.github.io", WebsiteCors.Origins);

    [Fact]
    public void No_wildcard_and_no_trailing_slashes()
    {
        // "*" would let any website call the API with a signed-in user's token.
        // A trailing slash never matches, because browsers send the origin without one.
        Assert.All(WebsiteCors.Origins, origin =>
        {
            Assert.NotEqual("*", origin);
            Assert.False(origin.EndsWith('/'), origin);
            Assert.True(Uri.TryCreate(origin, UriKind.Absolute, out var uri) && uri.AbsolutePath == "/", origin);
        });
    }

    [Fact]
    public void Only_the_methods_the_app_uses() => Assert.Equal(new[] { "GET", "POST" }, WebsiteCors.Methods);
}
