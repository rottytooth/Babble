using Neo4j.Driver;

namespace Babble.Models;

public class BabbleGraphDao : IAsyncDisposable
{
    private readonly IDriver _driver;
    private readonly string _database;
    private bool _disposed;

    public BabbleGraphDao(IConfiguration configuration)
    {
        var section = configuration.GetSection("Neo4j");
        var uri = section["Uri"];
        var user = section["User"];
        var password = section["Password"];
        _database = section["Database"] ?? "Babble";

        if (string.IsNullOrWhiteSpace(uri) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException("Neo4j configuration is missing. Configure Neo4j:Uri, Neo4j:User, Neo4j:Password, and optionally Neo4j:Database.");
        }

        _driver = GraphDatabase.Driver(uri, AuthTokens.Basic(user, password));
        _driver.VerifyConnectivityAsync().GetAwaiter().GetResult();
        Console.WriteLine($"Connected to Neo4j database: {_database}");
    }

    public async Task CreateTermAsync(string termId, string name, int arity)
    {
        var query = @"
            CREATE (t:Term {
                term_id: $term_id,
                name: $name,
                arity: $arity,
                created_at: datetime(),
                updated_at: datetime()
            })
            RETURN t
        ";

        var parameters = new
        {
            term_id = termId,
            name = name,
            arity = arity
        };

        await using var session = _driver.AsyncSession();
        await session.RunAsync(query, parameters);
    }

    // public async Task<IReadOnlyList<IRecord>> RunReadAsync(string cypher, object? parameters = null)
    // {
    //     ThrowIfDisposed();

    //     var queryParameters = parameters ?? new { };
    //     await using var session = _driver.AsyncSession(options =>
    //         options.WithDatabase(_database).WithDefaultAccessMode(AccessMode.Read));

    //     var cursor = await session.RunAsync(cypher, queryParameters);
    //     return await cursor.ToListAsync();
    // }

    // public async Task<IResultSummary> RunWriteAsync(string cypher, object? parameters = null)
    // {
    //     ThrowIfDisposed();

    //     var queryParameters = parameters ?? new { };
    //     await using var session = _driver.AsyncSession(options =>
    //         options.WithDatabase(_database).WithDefaultAccessMode(AccessMode.Write));

    //     var cursor = await session.RunAsync(cypher, queryParameters);
    //     return await cursor.ConsumeAsync();
    // }

    // public async Task<bool> IsHealthyAsync()
    // {
    //     ThrowIfDisposed();

    //     try
    //     {
    //         await _driver.VerifyConnectivityAsync();
    //         return true;
    //     }
    //     catch
    //     {
    //         return false;
    //     }
    // }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        await _driver.DisposeAsync();
        _disposed = true;
        Console.WriteLine("Neo4j driver connection closed.");
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
        {
            throw new ObjectDisposedException(nameof(BabbleGraphDao));
        }
    }
}
