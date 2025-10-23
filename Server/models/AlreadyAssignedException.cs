namespace Babble.Models;

public class AlreadyAssignedException : Exception
{
    public AlreadyAssignedException() : base()
    {
    }

    public AlreadyAssignedException(string message) : base(message)
    {
    }

    public AlreadyAssignedException(string message, Exception innerException) : base(message, innerException)
    {
    }
}
