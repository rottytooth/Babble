using Microsoft.Data.Sqlite;

namespace Babble.Models;

public class LexiconDao : IDisposable
{
    private readonly SqliteConnection _connection;
    private bool _disposed = false;

    const string ResolveQuery = "SELECT Params, Definition, Line FROM Term WHERE Name=@name;";

    const string ResolveDocQuery = "SELECT Doc FROM Term WHERE Name=@name;";

    const string InsertQuery = @"INSERT INTO Term 
        (Name, Params, ParamNum, Definition, Line, Creator, IPAddr, Doc) 
        VALUES 
        (@name, @params, @paramcount, @def, @line, @creator, @ipaddr, @doc);";

    public LexiconDao()
    {
        var connectionString = $"Data Source={Path.Combine(Directory.GetCurrentDirectory(), "BabbleLexicon.db")}";
        _connection = new SqliteConnection(connectionString);
        _connection.Open();
        Console.WriteLine($"Connected to SQLite database: BabbleLexicon.db");
    }

    public async Task<string> Resolve(string name)
    {

        using var command = _connection.CreateCommand();
        command.CommandText = ResolveQuery;
        command.Parameters.AddWithValue("@name", name);

        var results = new List<Dictionary<string, object>>();
        
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var row = new Dictionary<string, object>
            {
                ["Params"] = reader["Params"],
                ["Definition"] = reader["Definition"],
                ["Line"] = reader["Line"]
            };
            results.Add(row);
        }

        if (results.Count == 1)
        {
            var paramsValue = results[0]["Params"]?.ToString();
            var paramsArray = paramsValue == "null" || string.IsNullOrEmpty(paramsValue) 
                ? new object[0] 
                : System.Text.Json.JsonSerializer.Deserialize<object[]>(paramsValue) ?? new object[0];

            var definitionJson = results[0]["Definition"]?.ToString() ?? "{}";
            var definition = System.Text.Json.JsonSerializer.Deserialize<object>(definitionJson);

            var retpacket = new
            {
                name = name,
                @params = paramsArray,
                definition = definition,
                line = results[0]["Line"]
            };

            return System.Text.Json.JsonSerializer.Serialize(retpacket);
        }
        else if (results.Count == 0)
        {
            throw new LexicalException($"Term '{name}' is unknown");
        }
        else
        {
            // log error here
            throw new LexicalException($"Multiple definitions found for term '{name}'");
        }
    }

    public async Task<string> ResolveDoc(string name)
    {

        using var command = _connection.CreateCommand();
        command.CommandText = ResolveDocQuery;
        command.Parameters.AddWithValue("@name", name);

        var results = new List<object>();
        
        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            results.Add(reader["Doc"]);
        }

        if (results.Count == 1)
        {
            var docResult = new { doc = results[0]?.ToString() ?? "" };
            return System.Text.Json.JsonSerializer.Serialize(docResult);
        }
        else if (results.Count == 0)
        {
            throw new LexicalException($"Term '{name}' is unknown");
        }
        else
        {
            // log error here
            throw new LexicalException($"Multiple entries found for term '{name}'");
        }
    }

    public async Task<string> Assign(TermDefinition termdef)
    {
        string parameters;
        int paramCount;

        if (string.IsNullOrEmpty(termdef.Params) || termdef.Params == "[]")
        {
            parameters = "null";
            paramCount = 0;
        }
        else
        {
            parameters = termdef.Params;
            paramCount = termdef.Params.Count(c => c == ',') + 1;
        }

        using var command = _connection.CreateCommand();
        command.CommandText = InsertQuery;
        command.Parameters.AddWithValue("@name", termdef.Term);
        command.Parameters.AddWithValue("@params", parameters);
        command.Parameters.AddWithValue("@paramcount", paramCount);
        command.Parameters.AddWithValue("@def", termdef.Definition);
        command.Parameters.AddWithValue("@line", termdef.Line);
        command.Parameters.AddWithValue("@creator", termdef.Creator ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@ipaddr", termdef.IPAddr ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@doc", termdef.Doc ?? (object)DBNull.Value);

        try
        {
            var result = await command.ExecuteNonQueryAsync();
            Console.WriteLine($"Inserted {result} row(s)");
            return "{\"complete\": true}";
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == SQLitePCL.raw.SQLITE_CONSTRAINT)
        {
            // Get the real definition of the term, since assignment could not happen
            const string resolveQuery = @"
                SELECT Line 
                FROM Term 
                WHERE Name = :name";

            using var resolveCommand = _connection.CreateCommand();
            resolveCommand.CommandText = resolveQuery;
            resolveCommand.Parameters.AddWithValue(":name", termdef.Term);

            using var reader = await resolveCommand.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                var oldLine = reader["Line"]?.ToString() ?? "";
                throw new LexicalException($"Term already exists: {oldLine}");
            }
            
            throw new LexicalException($"Term '{termdef.Term}' already exists");
        }
        catch (Exception ex)
        {
            // log error here
            throw new LexicalException($"Database error: {ex.Message}");
        }
    }

    public SqliteConnection Connection => _connection;

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                _connection?.Close();
                _connection?.Dispose();
                Console.WriteLine("SQLite database connection closed.");
            }
            _disposed = true;
        }
    }

    ~LexiconDao()
    {
        Dispose(false);
    }
}
