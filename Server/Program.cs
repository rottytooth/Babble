using Babble.DataAccess;
using Babble.Models;
using Babble.Repos;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddRazorPages();

builder.Services.AddSingleton<LexiconDao>();
builder.Services.AddSingleton<BabbleGraphDao>();
builder.Services.AddSingleton<BabbleRepo>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();

app.Use(async (context, next) =>
{
    if (context.Request.Path.Equals("/console", StringComparison.Ordinal))
    {
        context.Response.Redirect("/console/", permanent: false);
        return;
    }

    await next();
});

app.MapRazorPages();


app.MapGet("/api/userip", (HttpContext context) =>
{
    return context.Connection.RemoteIpAddress?.ToString() ?? "";
});

app.MapGet("/info", () =>
{
    var assembly = System.Reflection.Assembly.GetExecutingAssembly();
    var version = assembly.GetName().Version?.ToString() ?? "1.0.0";

    return new
    {
        ProjectName = "Babble",
        Version = version,
        BuildDate = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss UTC")
    };
})
.WithName("GetProjectInfo");

app.MapGet("/builtins", () =>
{
    return Results.Ok(SemanticInterpreter.GetAllBuiltIns());
})
.WithName("GetBuiltIns");

// With ?arity=N → returns a single matching term object.
// Without arity   → returns a JSON array of all arity overloads.
app.MapGet("/resolve/{cmd_name}", async (string cmd_name, int? arity, BabbleRepo repo) =>
{
    try
    {
        var result = await repo.Resolve(cmd_name, arity);
        return Results.Content(result, "application/json");
    }
    catch (LexicalException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem($"An error occurred while resolving term: {ex.Message}");
    }
})
.WithName("ResolveTerm");

app.MapGet("/resolve_all/{cmd_names}", async (string cmd_names, BabbleRepo repo) =>
{
    try
    {
        var termNames = cmd_names.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        if (termNames.Length == 0)
        {
            return Results.BadRequest(new { error = "No term names provided" });
        }

        var result = await repo.ResolveAll(termNames);
        return Results.Content(result, "application/json");
    }
    catch (Exception ex)
    {
        return Results.Problem($"An error occurred while resolving terms: {ex.Message}");
    }
})
.WithName("ResolveAllTerms");

app.MapGet("/resolve/{cmd_name}/doc", async (string cmd_name, BabbleRepo repo) =>
{
    try
    {
        var result = await repo.ResolveDoc(cmd_name);
        return Results.Content(result, "application/json");
    }
    catch (LexicalException ex)
    {
        return Results.NotFound(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem($"An error occurred while resolving documentation: {ex.Message}");
    }
})
.WithName("ResolveTermDoc");

app.MapPost("/assign", async (TermDefinition termDefinition, BabbleRepo repo) =>
{
    try
    {
        var result = await repo.Assign(termDefinition);
        return Results.Content(result, "application/json");
    }
    catch (AlreadyAssignedException ex)
    {
        return Results.Conflict(new { error = ex.Message });
    }
    catch (Exception ex)
    {
        return Results.Problem($"An error occurred while assigning term: {ex.Message}");
    }
})
.WithName("AssignTerm");


// Handle application shutdown to close database connection
var applicationLifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
applicationLifetime.ApplicationStopping.Register(() =>
{
    var lexiconDao = app.Services.GetService<LexiconDao>();
    lexiconDao?.Dispose();
});

app.Run();
