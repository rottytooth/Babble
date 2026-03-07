using Babble.Models;
using Neo4j.Driver;

namespace Babble.DataAccess;

public class BabbleGraphDao : IBabbleGraphDao, IAsyncDisposable
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

    // Returns the name of the first dependency that would create a cycle, or null if safe.
    // Checks by name so it can run before the new term is inserted (no rollback needed).
    public async Task<string?> CheckForCycleAsync(string termName, IList<string> depNames)
    {
        if (_driver == null) throw new InvalidOperationException("Neo4j is not available.");
        if (depNames == null || depNames.Count == 0) return null;

        // Fetch all edges in the subgraph reachable from the dep nodes.
        var query = @"
            MATCH (start:Term)
            WHERE start.name IN $dep_names
            MATCH (start)-[:USES*0..]->(n)
            OPTIONAL MATCH (n)-[:USES]->(m)
            RETURN DISTINCT n.name AS from_node, m.name AS to_node
        ";

        var edges = new Dictionary<string, List<string>>();
        await using var session = _driver.AsyncSession(o => o.WithDatabase(_database));
        var cursor = await session.RunAsync(query, new { dep_names = depNames });
        while (await cursor.FetchAsync())
        {
            var from = cursor.Current["from_node"].As<string>();
            var to = cursor.Current["to_node"].As<string?>();
            if (to == null) continue;
            if (!edges.TryGetValue(from, out var list))
                edges[from] = list = [];
            list.Add(to);
        }

        var snapshot = new AdjacencySnapshot(edges);
        var detector = new CycleDetector();
        foreach (var dep in depNames)
        {
            if (detector.WouldCreateCycle(snapshot, termName, dep))
                return dep;
        }
        return null;
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

    sealed class AdjacencySnapshot(Dictionary<string, List<string>> edges) : IGraphSnapshot
    {
        public IEnumerable<string> GetDependencies(string node)
            => edges.TryGetValue(node, out var deps) ? deps : [];
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
