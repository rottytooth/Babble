namespace Babble.Models;

public class LexicalException : Exception
{
    public LexicalException() : base()
    {
    }

    public LexicalException(string message) : base(message)
    {
    }

    public LexicalException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
