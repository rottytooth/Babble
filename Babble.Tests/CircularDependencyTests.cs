using System.Text.Json;
using Babble.DataAccess;
using Babble.Models;
using Babble.Repos;
using Xunit;

namespace Babble.Tests;

// ── CycleDetector tests ───────────────────────────────────────────────────────

class FakeSnapshot : IGraphSnapshot
{
    private readonly Dictionary<string, List<string>> _edges = [];

    public FakeSnapshot(params (string from, string to)[] edges)
    {
        foreach (var (from, to) in edges)
        {
            if (!_edges.TryGetValue(from, out var list))
                _edges[from] = list = [];
            list.Add(to);
        }
    }

    public IEnumerable<string> GetDependencies(string node)
        => _edges.TryGetValue(node, out var deps) ? deps : [];
}

public class CycleDetectorTests
{
    private readonly CycleDetector _detector = new();

    [Fact]
    public void WouldCreateCycle_NoCycleExists_ReturnsFalse()
    {
        // A → B → C; adding C → D is safe
        var snapshot = new FakeSnapshot(("A", "B"), ("B", "C"));
        Assert.False(_detector.WouldCreateCycle(snapshot, "C", "D"));
    }

    [Fact]
    public void WouldCreateCycle_DirectCycle_ReturnsTrue()
    {
        // A → B; adding B → A creates a cycle
        var snapshot = new FakeSnapshot(("A", "B"));
        Assert.True(_detector.WouldCreateCycle(snapshot, "B", "A"));
    }

    [Fact]
    public void WouldCreateCycle_TransitiveCycle_ReturnsTrue()
    {
        // A → B → C; adding C → A creates a cycle
        var snapshot = new FakeSnapshot(("A", "B"), ("B", "C"));
        Assert.True(_detector.WouldCreateCycle(snapshot, "C", "A"));
    }

    [Fact]
    public void WouldCreateCycle_EmptyGraph_ReturnsFalse()
    {
        var snapshot = new FakeSnapshot();
        Assert.False(_detector.WouldCreateCycle(snapshot, "A", "B"));
    }
}

// ── Fakes ────────────────────────────────────────────────────────────────────

class FakeBabbleGraphDao : IBabbleGraphDao
{
    public bool IsAvailable { get; set; } = true;
    public string? CycleResult { get; set; } = null;

    public Task<string?> CheckForCycleAsync(string termName, IList<string> depNames)
        => Task.FromResult(CycleResult);

    public Task CreateTermAsync(string termId, string name, int arity) => Task.CompletedTask;
    public Task CreateTermDependenciesAsync(string fromTermId, IList<string> toTermIds) => Task.CompletedTask;
}

class FakeLexiconDao : ILexiconDao
{
    public bool AssignWasCalled { get; private set; }

    public Task<string> Assign(TermDefinition termdef)
    {
        AssignWasCalled = true;
        return Task.FromResult(JsonSerializer.Serialize(new DatabaseResult { Complete = true, Id = 1, SymbolTerms = [] }));
    }

    public Task<string> Resolve(string name, int paramNum) => Task.FromResult("{}");
    public Task<string> ResolveAllArities(string name) => Task.FromResult("[]");
    public Task<string> ResolveDoc(string name) => Task.FromResult("{}");
    public Task<string> ResolveAll(string[] termNames) => Task.FromResult("[]");
    public void Dispose() { }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

public class BabbleRepoAssignTests
{
    // Cycle detected: throws CircularDependencyException with the offending term name,
    // and does NOT call through to SQLite.
    [Fact]
    public async Task Assign_CycleDetected_ThrowsBeforeSQLiteWrite()
    {
        var lexicon = new FakeLexiconDao();
        var repo = new BabbleRepo(lexicon, new FakeBabbleGraphDao { CycleResult = "b" });

        var ex = await Assert.ThrowsAsync<CircularDependencyException>(
            () => repo.Assign(new TermDefinition { Term = "a", Definition = "{}", Line = "{}", Symbols = ["b"] }));

        Assert.Equal("b", ex.OffendingTerm);
        Assert.False(lexicon.AssignWasCalled);
    }

    // No cycle: CheckForCycleAsync returns null, assign proceeds normally.
    [Fact]
    public async Task Assign_NoCycle_Succeeds()
    {
        var repo = new BabbleRepo(new FakeLexiconDao(), new FakeBabbleGraphDao { CycleResult = null });
        await repo.Assign(new TermDefinition { Term = "a", Definition = "{}", Line = "{}", Symbols = ["b"] });
    }

    // Graph unavailable: cycle check is skipped, assign proceeds (Neo4j is best-effort).
    [Fact]
    public async Task Assign_GraphUnavailable_SkipsCycleCheck()
    {
        var repo = new BabbleRepo(new FakeLexiconDao(), new FakeBabbleGraphDao { IsAvailable = false });
        await repo.Assign(new TermDefinition { Term = "a", Definition = "{}", Line = "{}", Symbols = ["b"] });
    }
}
