using System.Text.Json;
using Babble.DataAccess;
using Babble.Models;

namespace Babble.Repos;

public class BabbleRepo
{
    private readonly ILexiconDao _lexiconDao;
    private readonly IBabbleGraphDao _babbleGraphDao;

    public BabbleRepo(ILexiconDao lexiconDao, IBabbleGraphDao babbleGraphDao)
    {
        _lexiconDao = lexiconDao;
        _babbleGraphDao = babbleGraphDao;
    }

    // With arity → exact match; without → all arity overloads as a JSON array.
    // With resolveDependencies → recursively resolves all transitive deps; requires arity.
    // Dependencies are returned in topological order (deepest first).
    public async Task<string> Resolve(string name, int? arity, bool resolveDependencies = false)
    {
        if (!resolveDependencies)
            return arity.HasValue
                ? await _lexiconDao.Resolve(name, arity.Value)
                : await _lexiconDao.ResolveAllArities(name);

        var termJson = await _lexiconDao.Resolve(name, arity!.Value);

        string[] rootSymbols;
        using (var doc = JsonDocument.Parse(termJson))
        {
            rootSymbols = doc.RootElement.TryGetProperty("symbols", out var symsEl)
                ? [.. symsEl.EnumerateArray().Select(e => e.GetString()!).Where(s => s != null)]
                : [];
        }

        var depElements = new List<string>();
        await CollectDepsTopological(rootSymbols, [name], depElements);

        return $"{{\"term\":{termJson},\"dependencies\":[{string.Join(",", depElements)}]}}";
    }

    // Post-order DFS: recurse into a node's deps before adding the node itself,
    // so the result list is in topological order (leaves first).
    private async Task CollectDepsTopological(IEnumerable<string> symbols, HashSet<string> visited, List<string> result)
    {
        foreach (var sym in symbols)
        {
            if (!visited.Add(sym)) continue;

            var arityJson = await _lexiconDao.ResolveAllArities(sym);

            var childSymbols = new List<string>();
            var termElements = new List<string>();
            using (var doc = JsonDocument.Parse(arityJson))
            {
                foreach (var elem in doc.RootElement.EnumerateArray())
                {
                    termElements.Add(elem.GetRawText());
                    if (elem.TryGetProperty("symbols", out var symsEl))
                    {
                        foreach (var s in symsEl.EnumerateArray())
                        {
                            var sName = s.GetString();
                            if (sName != null) childSymbols.Add(sName);
                        }
                    }
                }
            }

            await CollectDepsTopological(childSymbols.ToArray(), visited, result);
            result.AddRange(termElements);
        }
    }

    // Resolves all requested names + their transitive deps in a single topological pass.
    // Returns {"ordered":[...all term objects, leaves first, deduped by name...]}.
    public async Task<string> ResolveAllWithDeps(IEnumerable<string> names)
    {
        var visited = new HashSet<string>();
        var elements = new List<string>();
        await CollectDepsTopological(names.Distinct(), visited, elements);
        return $"{{\"ordered\":[{string.Join(",", elements)}]}}";
    }

    public Task<string> ResolveAll(string[] termNames)
    {
        return _lexiconDao.ResolveAll(termNames);
    }

    public Task<string> ResolveDoc(string name)
    {
        return _lexiconDao.ResolveDoc(name);
    }

    public async Task<string> Assign(TermDefinition termdef)
    {
        if (_babbleGraphDao.IsAvailable && termdef.Symbols?.Count > 0)
        {
            var circular = await _babbleGraphDao.CheckForCycleAsync(termdef.Term, termdef.Symbols);
            if (circular != null)
                throw new CircularDependencyException(circular);
        }

        var retval = await _lexiconDao.Assign(termdef);
        var result = JsonSerializer.Deserialize<DatabaseResult>(retval);
        if (result == null || !result.Complete)
        {
            // We are unlikely to get here, as LexiconDao should throw an exception on failure
            throw new LexicalException($"Failed to assign term definition for '{termdef.Term}'.");
        }

        var arity = termdef.Params?.Count ?? 0;

        if (_babbleGraphDao.IsAvailable)
        {
            try
            {
                await _babbleGraphDao.CreateTermAsync(result.Id.ToString(), termdef.Term, arity);
                foreach (var sym in result.SymbolTerms)
                {
                    await _babbleGraphDao.CreateTermAsync(sym.Id.ToString(), sym.Name, sym.Arity);
                }
                if (result.SymbolTerms.Count > 0)
                {
                    var toIds = result.SymbolTerms.Select(s => s.Id.ToString()).ToList();
                    await _babbleGraphDao.CreateTermDependenciesAsync(result.Id.ToString(), toIds);
                }
                Console.WriteLine($"Neo4j: created Term node for '{termdef.Term}' (id={result.Id}, deps={result.SymbolTerms.Count})");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Neo4j: failed to create Term node for '{termdef.Term}': {ex.Message}");
            }
        }
        else
        {
            Console.WriteLine($"Neo4j: skipped Term node for '{termdef.Term}' (not available)");
        }

        return retval;
    }
}
