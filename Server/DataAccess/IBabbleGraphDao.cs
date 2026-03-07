namespace Babble.DataAccess;

public interface IBabbleGraphDao
{
    bool IsAvailable { get; }
    Task CreateTermAsync(string termId, string name, int arity);
    Task<string?> CheckForCycleAsync(string termName, IList<string> depNames);
    Task CreateTermDependenciesAsync(string fromTermId, IList<string> toTermIds);
}
