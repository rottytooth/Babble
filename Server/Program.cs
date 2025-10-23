using Microsoft.Data.Sqlite;
using Babble.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// Register LexiconDao as a singleton service
builder.Services.AddSingleton<LexiconDao>();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseDefaultFiles();
app.UseStaticFiles();


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

app.MapGet("/resolve/{cmd_name}", async (string cmd_name, LexiconDao lexiconDao) =>
{
    try
    {
        var result = await lexiconDao.Resolve(cmd_name);
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

app.MapGet("/resolve_all/{cmd_names}", async (string cmd_names, LexiconDao lexiconDao) =>
{
    try
    {
        // Split the comma-separated list of term names
        var termNames = cmd_names.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        
        if (termNames.Length == 0)
        {
            return Results.BadRequest(new { error = "No term names provided" });
        }
        
        var result = await lexiconDao.ResolveAll(termNames);
        return Results.Content(result, "application/json");
    }
    catch (Exception ex)
    {
        return Results.Problem($"An error occurred while resolving terms: {ex.Message}");
    }
})
.WithName("ResolveAllTerms");

app.MapGet("/resolve/{cmd_name}/doc", async (string cmd_name, LexiconDao lexiconDao) =>
{
    try
    {
        var result = await lexiconDao.ResolveDoc(cmd_name);
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

app.MapPost("/assign", async (TermDefinition termDefinition, LexiconDao lexiconDao) =>
{
    try
    {
        var result = await lexiconDao.Assign(termDefinition);
        return Results.Content(result, "application/json");
    }
    // also should catch LexicalException
    catch (AlreadyAssignedException ex)
    {
        //FIXME: This gets thrown for a lot of other reasons
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
