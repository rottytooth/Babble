namespace Babble.Models;

public interface IGraphSnapshot
{
    IEnumerable<string> GetDependencies(string node);
}

public class CycleDetector
{
    // Returns true if adding the edge from→to would create a cycle
    // (i.e., if 'to' can already reach 'from' in the snapshot).
    public bool WouldCreateCycle(IGraphSnapshot snapshot, string from, string to)
    {
        var visited = new HashSet<string>();
        var stack = new Stack<string>();
        stack.Push(to);
        while (stack.Count > 0)
        {
            var node = stack.Pop();
            if (node == from) return true;
            if (!visited.Add(node)) continue;
            foreach (var dep in snapshot.GetDependencies(node))
                stack.Push(dep);
        }
        return false;
    }
}
