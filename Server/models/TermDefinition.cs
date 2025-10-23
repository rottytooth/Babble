namespace Babble.Models;

public class TermDefinition
{
    public required string Term { get; set; }
    public required string Definition { get; set; }
    public string? Params { get; set; }
    public required string Line { get; set; }
    public string? Creator { get; set; }
    public string? IPAddr { get; set; }
    public string? Doc { get; set; }
    public string? BuiltIns { get; set; }
    public string? Symbols { get; set; }
}