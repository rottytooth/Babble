namespace Babble.Models;

public class SymbolTerm
{
    public long Id { get; set; }
    public string Name { get; set; } = "";
    public int Arity { get; set; }
}

public class DatabaseResult
{
    public bool Complete { get; set; }
    public long Id { get; set; }
    public List<SymbolTerm> SymbolTerms { get; set; } = [];
}
