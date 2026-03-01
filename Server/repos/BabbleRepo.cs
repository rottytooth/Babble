using Babble.DataAccess;
using Babble.Models;

namespace Babble.Repos;

public class BabbleRepo
{
    private readonly LexiconDao _lexiconDao;

    public BabbleRepo(LexiconDao lexiconDao)
    {
        _lexiconDao = lexiconDao;
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

    public Task<string> Assign(TermDefinition termdef)
    {
        var retval = _lexiconDao.Assign(termdef);
        return retval;
    }
}
