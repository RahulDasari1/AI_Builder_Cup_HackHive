using Google.Cloud.Firestore;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using HackHive.Shared.Repositories;
using HackHive.Shared.Services;

namespace HackHive.Platform;

public static class PlatformSetup
{
    public static WebApplicationBuilder AddHackHivePlatform(this WebApplicationBuilder builder)
    {
        var projectId = builder.Configuration["FIREBASE_PROJECT_ID"]
            ?? throw new InvalidOperationException("FIREBASE_PROJECT_ID must be configured.");
        var webOrigin = builder.Configuration["WEB_ORIGIN"] ?? "http://localhost:4200";
        var issuer = $"https://securetoken.google.com/{projectId}";

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = issuer;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = issuer,
                    ValidateAudience = true,
                    ValidAudience = projectId,
                    ValidateLifetime = true,
                    NameClaimType = "user_id",
                    RoleClaimType = "role"
                };
            });
        builder.Services.AddAuthorization();
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("ai", context => RateLimitPartition.GetFixedWindowLimiter(
                context.User.FindFirst("user_id")?.Value
                    ?? context.Connection.RemoteIpAddress?.ToString()
                    ?? "anonymous",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 20,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                    AutoReplenishment = true
                }));
        });
        builder.Services.AddCors(options => options.AddPolicy("web", policy =>
            policy.WithOrigins(webOrigin, "https://aibuildercup2026-26b22.web.app", "https://aibuildercup2026-26b22.firebaseapp.com")
                  .AllowAnyHeader()
                  .AllowAnyMethod()));

        builder.Services.AddSingleton(_ => FirestoreDb.Create(projectId));
        builder.Services.AddHttpClient("gemini", client =>
            client.BaseAddress = new Uri("https://generativelanguage.googleapis.com/"));

        // Register Enterprise Data Access Layer (DAL) & Domain Services
        builder.Services.AddScoped<ILearningRepository, FirestoreLearningRepository>();
        builder.Services.AddScoped<IAssessmentRepository, FirestoreAssessmentRepository>();
        builder.Services.AddScoped<IReportRepository, FirestoreReportRepository>();
        builder.Services.AddScoped<IUserRepository, FirestoreUserRepository>();
        builder.Services.AddScoped<IGeminiAiService, GeminiAiService>();

        builder.Services.AddHealthChecks();
        return builder;
    }

    public static WebApplication UseHackHivePlatform(this WebApplication app)
    {
        app.UseCors("web");
        app.UseAuthentication();
        app.UseAuthorization();
        app.UseRateLimiter();
        app.MapHealthChecks("/healthz").AllowAnonymous();
        return app;
    }

    public static string RequireUserId(this System.Security.Claims.ClaimsPrincipal principal) =>
        principal.FindFirst("user_id")?.Value
        ?? principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
        ?? throw new UnauthorizedAccessException("A verified Firebase user is required.");
}