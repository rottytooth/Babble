using Neo4j.Driver;

namespace Babble.DataAccess;

public class BabbleGraphDao : IAsyncDisposable
{
    private readonly IDriver? _driver;
    private readonly string _database;
    private bool _disposed;

    public bool IsAvailable => _driver != null;

    public BabbleGraphDao(IConfiguration configuration)
    {
        var section = configuration.GetSection("Neo4j");
        var uri = section["Uri"];
        var user = section["User"];
        var password = section["Password"];
        _database = section["Database"] ?? "Babble";

        if (string.IsNullOrWhiteSpace(uri) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
        {
            Console.WriteLine("Neo4j configuration is missing — graph storage disabled. Configure Neo4j:Uri, Neo4j:User, Neo4j:Password to enable.");
            return;
        }

        try
        {
            _driver = GraphDatabase.Driver(uri, AuthTokens.Basic(user, password));
            _driver.VerifyConnectivityAsync().GetAwaiter().GetResult();
            Console.WriteLine($"Connected to Neo4j database: {_database}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to connect to Neo4j at '{uri}': {ex.Message} — graph storage disabled.");
            _driver = null;
        }
    }

    public async Task CreateTermAsync(string termId, string name, int arity)
    {
        if (_driver == null) throw new InvalidOperationException("Neo4j is not available.");

        var query = @"
            MERGE (t:Term {term_id: $term_id})
            ON CREATE SET t.name = $name, t.arity = $arity, t.created_at = datetime()
            SET t.updated_at = datetime()
            RETURN t
        ";

        var parameters = new
        {
            term_id = termId,
            name = name,
            arity = arity
        };

        await using var session = _driver.AsyncSession(o => o.WithDatabase(_database));
        var cursor = await session.RunAsync(query, parameters);
        await cursor.ConsumeAsync();
    }

    public async Task CreateTermDependenciesAsync(string fromTermId, IList<string> toTermIds)
    {
        if (_driver == null) throw new InvalidOperationException("Neo4j is not available.");
        if (toTermIds == null || toTermIds.Count == 0) return;

        var query = @"
            MATCH (a:Term {term_id: $from})
            UNWIND $tos AS to_id
            MATCH (b:Term {term_id: to_id})
            CREATE (a)-[:USES]->(b)
        ";

        await using var session = _driver.AsyncSession(o => o.WithDatabase(_database));
        var cursor = await session.RunAsync(query, new { from = fromTermId, tos = toTermIds });
        await cursor.ConsumeAsync();
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed)
        {
            return;
        }

        if (_driver != null) await _driver.DisposeAsync();
        _disposed = true;
        Console.WriteLine("Neo4j driver connection closed.");
    }
}
