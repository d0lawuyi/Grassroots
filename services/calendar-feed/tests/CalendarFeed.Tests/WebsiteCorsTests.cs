using CalendarFeed.Config;

namespace CalendarFeed.Tests;

public class WebsiteCorsTests
{
    [Fact]
    public void Local_web_dev_may_call_the_api() => Assert.True(WebsiteCors.IsAllowed("http://localhost:8081"));

    [Theory]
    [InlineData("https://evil.example.com")]
    [InlineData("https://someone-else.vercel.app")]
    [InlineData("null")]
    [InlineData("")]
    public void Other_sites_may_not(string origin) => Assert.False(WebsiteCors.IsAllowed(origin));

    [Fact]
    public void Origins_are_exact_addresses()
    {
        // "*" would let any website call the API with a signed-in user's token.
        // A trailing slash or path never matches, because browsers send just scheme://host.
        Assert.All(WebsiteCors.Origins, origin =>
        {
            Assert.NotEqual("*", origin);
            Assert.True(Uri.TryCreate(origin, UriKind.Absolute, out var uri) && origin == uri.GetLeftPart(UriPartial.Authority), origin);
        });
    }

    [Fact]
    public void Vercel_suffixes_are_tied_to_one_account()
    {
        // A bare ".vercel.app" would allow every Vercel site in the world.
        Assert.All(WebsiteCors.VercelSuffixes, suffix =>
        {
            Assert.StartsWith("-", suffix);
            Assert.EndsWith(".vercel.app", suffix);
            Assert.True(suffix.Length > "-.vercel.app".Length + 3, suffix);
        });
    }

    [Fact]
    public void Only_the_methods_the_app_uses() => Assert.Equal(new[] { "GET", "POST" }, WebsiteCors.Methods);
}
