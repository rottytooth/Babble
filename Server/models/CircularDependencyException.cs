namespace Babble.Models;

public class CircularDependencyException : Exception
{
    public string OffendingTerm { get; }

    public CircularDependencyException(string offendingTerm)
        : base($"Circular dependency: '{offendingTerm}' already depends on this term")
    {
        OffendingTerm = offendingTerm;
    }
}
