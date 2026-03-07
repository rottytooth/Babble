namespace Babble.Models;

public class SymbolCall
{
    public required string Name { get; set; }
    public int Arity { get; set; }
}

public class TermDefinition
{
    public required string Term { get; set; }
    public required string Definition { get; set; }
    public List<string>? Params { get; set; }
    public required string Line { get; set; }
    public string? Creator { get; set; }
    public string? IPAddr { get; set; }
    public string? Doc { get; set; }
    public List<string>? BuiltIns { get; set; }
    public List<string>? Symbols { get; set; }
    public List<SymbolCall>? SymbolCalls { get; set; }
}