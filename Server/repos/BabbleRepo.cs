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
    public Task<string> Resolve(string name, int? arity)
    {
        return arity.HasValue
            ? _lexiconDao.Resolve(name, arity.Value)
            : _lexiconDao.ResolveAllArities(name);
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
