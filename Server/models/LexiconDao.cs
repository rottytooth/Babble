using Microsoft.Data.Sqlite;

namespace Babble.Models;

public class LexiconDao : IDisposable
{
    private readonly SqliteConnection _connection;
    private bool _disposed = false;

    const string ResolveQuery = "SELECT Params, Definition, Line FROM Term WHERE Name=@name;";

    const string ResolveDocQuery = "SELECT Doc FROM Term WHERE Name=@name;";

    const string InsertQuery = @"INSERT INTO Term 
        (Name, Params, ParamNum, Definition, Line, Creator, IPAddr, Doc, BuiltIns, Symbols) 
        VALUES 
        (@name, @params, @paramcount, @def, @line, @creator, @ipaddr, @doc, @builtins, @symbols);";

    const string InsertDependencyQuery = @"INSERT INTO TermDependency 
        (TermID, DependentTermID) 
        VALUES 
        (@termid, @dependenttermid);";

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

    public async Task<string> ResolveAll(string[] termNames)
    {
        var results = new List<object>();
        
        foreach (var termName in termNames)
        {
            using var command = _connection.CreateCommand();
            command.CommandText = "SELECT COUNT(*) FROM Term WHERE Name = @name;";
            command.Parameters.AddWithValue("@name", termName);
            
            var count = await command.ExecuteScalarAsync();
            var exists = Convert.ToInt32(count) > 0;
            
            results.Add(new
            {
                name = termName,
                exists = exists
            });
        }
        
        return System.Text.Json.JsonSerializer.Serialize(results);
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
        command.Parameters.AddWithValue("@builtins", termdef.BuiltIns ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("@symbols", termdef.Symbols ?? (object)DBNull.Value);
        try
        {
            var result = await command.ExecuteNonQueryAsync();
            Console.WriteLine($"Inserted {result} row(s)");
            
            // Get the ID of the newly inserted Term
            long newTermId;
            using (var idCommand = _connection.CreateCommand())
            {
                idCommand.CommandText = "SELECT last_insert_rowid();";
                var idResult = await idCommand.ExecuteScalarAsync();
                newTermId = Convert.ToInt64(idResult);
            }
            Console.WriteLine($"New Term ID: {newTermId}");
            
            // Add TermDependency entries for each symbol in the Symbols field
            if (!string.IsNullOrEmpty(termdef.Symbols) && termdef.Symbols != "[]")
            {
                try
                {
                    var symbols = System.Text.Json.JsonSerializer.Deserialize<string[]>(termdef.Symbols);
                    if (symbols != null && symbols.Length > 0)
                    {
                        foreach (var symbolName in symbols)
                        {
                            // Find the Term ID for this symbol name
                            using var lookupCommand = _connection.CreateCommand();
                            lookupCommand.CommandText = "SELECT ID FROM Term WHERE Name = @name LIMIT 1;";
                            lookupCommand.Parameters.AddWithValue("@name", symbolName);
                            
                            var dependentTermId = await lookupCommand.ExecuteScalarAsync();
                            
                            if (dependentTermId != null)
                            {
                                // Insert the dependency relationship
                                using var depCommand = _connection.CreateCommand();
                                depCommand.CommandText = InsertDependencyQuery;
                                depCommand.Parameters.AddWithValue("@termid", newTermId);
                                depCommand.Parameters.AddWithValue("@dependenttermid", dependentTermId);
                                
                                try
                                {
                                    await depCommand.ExecuteNonQueryAsync();
                                    Console.WriteLine($"Added dependency: Term {newTermId} depends on Term {dependentTermId} ({symbolName})");
                                }
                                catch (SqliteException depEx) when (depEx.SqliteErrorCode == SQLitePCL.raw.SQLITE_CONSTRAINT)
                                {
                                    // Duplicate dependency entry, ignore
                                    Console.WriteLine($"Dependency already exists: {newTermId} -> {dependentTermId}");
                                }
                            }
                            else
                            {
                                Console.WriteLine($"Warning: Symbol '{symbolName}' not found in Term table, skipping dependency");
                            }
                        }
                    }
                }
                catch (System.Text.Json.JsonException jsonEx)
                {
                    Console.WriteLine($"Warning: Could not parse Symbols JSON: {jsonEx.Message}");
                }
            }
            
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
                throw new AlreadyAssignedException(reader["Line"]?.ToString() ?? "");
            }

            throw new AlreadyAssignedException();
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
