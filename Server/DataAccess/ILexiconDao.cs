using Babble.Models;

namespace Babble.DataAccess;

public interface ILexiconDao : IDisposable
{
    Task<string> Resolve(string name, int paramNum);
    Task<string> ResolveAllArities(string name);
    Task<string> ResolveDoc(string name);
    Task<string> ResolveAll(string[] termNames);
    Task<string> Assign(TermDefinition termdef);
}
