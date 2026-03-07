using Microsoft.Data.Sqlite;
using Babble.Models;

namespace Babble.DataAccess;

public class LexiconDao : IDisposable
{
    private readonly SqliteConnection _connection;
    private bool _disposed = false;

    // Use relaxed escaping so arithmetic symbols like + are stored as-is rather than \u002B.
    private static readonly System.Text.Json.JsonSerializerOptions _dbJsonOptions = new()
    {
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    const string ResolveQuery = @"
        SELECT t.Params, t.Definition, t.Line, t.Symbols AS SymbolNames
        FROM Term t
        WHERE t.Name = @name;";

    const string ResolveQueryWithArity = @"
        SELECT t.Params, t.Definition, t.Line, t.Symbols AS SymbolNames
        FROM Term t
        WHERE t.Name = @name AND t.ParamNum = @paramNum;";

    const string ResolveDocQuery = "SELECT Doc FROM Term WHERE Name=@name;";

    const string InsertQuery = @"INSERT INTO Term
        (Name, Params, ParamNum, Definition, Line, Creator, IPAddr, Doc, BuiltIns, Symbols)
        VALUES
        (@name, @params, @paramcount, @def, @line, @creator, @ipaddr, @doc, @builtins, @symbols);";

    public LexiconDao()
    {
        var connectionString = $"Data Source={Path.Combine(Directory.GetCurrentDirectory(), "BabbleLexicon.db")}";
        _connection = new SqliteConnection(connectionString);
        _connection.Open();
        Console.WriteLine($"Connected to SQLite database: BabbleLexicon.db");
    }

    // Resolves a term by exact arity. Throws if not found.
    public async Task<string> Resolve(string name, int arity)
    {
        using var command = _connection.CreateCommand();
        command.CommandText = ResolveQueryWithArity;
        command.Parameters.AddWithValue("@name", name);
        command.Parameters.AddWithValue("@paramNum", arity);

        using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync())
            throw new LexicalException($"Could not resolve term '{name}' with {arity} parameter(s)");

        var paramsRaw = reader["Params"]?.ToString();
        object[] paramsArray = string.IsNullOrEmpty(paramsRaw) || paramsRaw == "null"
            ? []
            : SafeDeserialize<object[]>(paramsRaw) ?? [paramsRaw];

        object[] symbolsArray = SafeDeserialize<object[]>(reader["SymbolNames"]?.ToString()) ?? [];

        var defRaw = reader["Definition"]?.ToString();
        var lineRaw = reader["Line"]?.ToString();

        var retpacket = new
        {
            name,
            @params = paramsArray,
            definition = SafeDeserialize<object>(defRaw) ?? defRaw ?? "{}",
            line = SafeDeserialize<object>(lineRaw) ?? lineRaw ?? "{}",
            symbols = symbolsArray
        };

        return System.Text.Json.JsonSerializer.Serialize(retpacket);
    }

    // Returns all arity overloads of a term as a JSON array. Throws if none found.
    public async Task<string> ResolveAllArities(string name)
    {
        using var command = _connection.CreateCommand();
        command.CommandText = ResolveQuery;
        command.Parameters.AddWithValue("@name", name);

        var results = new List<object>();

        using var reader = await command.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            var paramsRaw = reader["Params"]?.ToString();
            object[] paramsArray = string.IsNullOrEmpty(paramsRaw) || paramsRaw == "null"
                ? []
                : SafeDeserialize<object[]>(paramsRaw) ?? [paramsRaw];

            object[] symbolsArray = SafeDeserialize<object[]>(reader["SymbolNames"]?.ToString()) ?? [];
            var defRaw = reader["Definition"]?.ToString();
            var lineRaw = reader["Line"]?.ToString();

            results.Add(new
            {
                name = name,
                @params = paramsArray,
                definition = SafeDeserialize<object>(defRaw) ?? defRaw ?? "{}",
                line = SafeDeserialize<object>(lineRaw) ?? lineRaw ?? "{}",
                symbols = symbolsArray
            });
        }

        if (results.Count == 0)
            throw new LexicalException($"Term '{name}' is unknown");

        return System.Text.Json.JsonSerializer.Serialize(results);
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
        var paramCount = termdef.Params?.Count ?? 0;
        var parameters = paramCount == 0
            ? "null"
            : System.Text.Json.JsonSerializer.Serialize(termdef.Params, _dbJsonOptions);

        using var transaction = _connection.BeginTransaction();
        try
        {
            // Store symbol names directly in Term.Symbols (JSON); graph dependencies are managed in Neo4j.
            using var insertCommand = _connection.CreateCommand();
            insertCommand.Transaction = transaction;
            insertCommand.CommandText = InsertQuery;
            insertCommand.Parameters.AddWithValue("@name", termdef.Term);
            insertCommand.Parameters.AddWithValue("@params", parameters);
            insertCommand.Parameters.AddWithValue("@paramcount", paramCount);
            insertCommand.Parameters.AddWithValue("@def", termdef.Definition);
            insertCommand.Parameters.AddWithValue("@line", termdef.Line);
            insertCommand.Parameters.AddWithValue("@creator", termdef.Creator ?? (object)DBNull.Value);
            insertCommand.Parameters.AddWithValue("@ipaddr", termdef.IPAddr ?? (object)DBNull.Value);
            insertCommand.Parameters.AddWithValue("@doc", termdef.Doc ?? (object)DBNull.Value);
            var builtInsJson = termdef.BuiltIns == null || termdef.BuiltIns.Count == 0
                ? (object)DBNull.Value
                : System.Text.Json.JsonSerializer.Serialize(termdef.BuiltIns, _dbJsonOptions);
            insertCommand.Parameters.AddWithValue("@builtins", builtInsJson);
            var symbolsJson = termdef.Symbols == null || termdef.Symbols.Count == 0
                ? (object)DBNull.Value
                : System.Text.Json.JsonSerializer.Serialize(termdef.Symbols, _dbJsonOptions);
            insertCommand.Parameters.AddWithValue("@symbols", symbolsJson);

            await insertCommand.ExecuteNonQueryAsync();

            long newTermId;
            using (var idCommand = _connection.CreateCommand())
            {
                idCommand.Transaction = transaction;
                idCommand.CommandText = "SELECT last_insert_rowid();";
                var idResult = await idCommand.ExecuteScalarAsync();
                newTermId = Convert.ToInt64(idResult);
            }
            Console.WriteLine($"Inserted Term '{termdef.Term}' with ID {newTermId}");

            var symbolTerms = new List<SymbolTerm>();
            var arityAwareSymbolCalls = termdef.SymbolCalls?
                .Where(s => !string.IsNullOrWhiteSpace(s.Name))
                .Select(s => new { Name = s.Name.Trim(), Arity = (int?)s.Arity })
                .GroupBy(s => new { s.Name, s.Arity })
                .Select(g => g.First())
                .ToList();

            var legacySymbols = termdef.Symbols?
                .Where(s => !string.IsNullOrWhiteSpace(s))
                .Select(s => new { Name = s.Trim(), Arity = (int?)null })
                .GroupBy(s => s.Name)
                .Select(g => g.First())
                .ToList();

            var symbolsToValidate = (arityAwareSymbolCalls != null && arityAwareSymbolCalls.Count > 0)
                ? arityAwareSymbolCalls
                : legacySymbols;

            if (symbolsToValidate != null && symbolsToValidate.Count > 0)
            {
                foreach (var symbolRef in symbolsToValidate)
                {
                    using var symIdCmd = _connection.CreateCommand();
                    symIdCmd.Transaction = transaction;
                    if (symbolRef.Arity.HasValue)
                    {
                        symIdCmd.CommandText = "SELECT ID, ParamNum FROM Term WHERE Name = @name AND ParamNum = @paramNum LIMIT 1;";
                        symIdCmd.Parameters.AddWithValue("@paramNum", symbolRef.Arity.Value);
                    }
                    else
                    {
                        symIdCmd.CommandText = "SELECT ID, ParamNum FROM Term WHERE Name = @name LIMIT 1;";
                    }
                    symIdCmd.Parameters.AddWithValue("@name", symbolRef.Name);

                    using var symReader = await symIdCmd.ExecuteReaderAsync();
                    if (!await symReader.ReadAsync())
                    {
                        if (symbolRef.Arity.HasValue)
                            throw new LexicalException($"Symbol '{symbolRef.Name}' with arity {symbolRef.Arity.Value} is not defined");

                        throw new LexicalException($"Symbol '{symbolRef.Name}' is not defined");
                    }

                    symbolTerms.Add(new SymbolTerm
                    {
                        Id = Convert.ToInt64(symReader["ID"]),
                        Name = symbolRef.Name,
                        Arity = Convert.ToInt32(symReader["ParamNum"])
                    });
                }
            }

            transaction.Commit();
            return System.Text.Json.JsonSerializer.Serialize(new DatabaseResult
            {
                Complete = true,
                Id = newTermId,
                SymbolTerms = symbolTerms
            });
        }
        catch (LexicalException)
        {
            transaction.Rollback();
            throw;
        }
        catch (SqliteException ex) when (ex.SqliteErrorCode == SQLitePCL.raw.SQLITE_CONSTRAINT)
        {
            transaction.Rollback();

            // Get the existing definition so the caller can report what it was assigned to.
            using var resolveCommand = _connection.CreateCommand();
            resolveCommand.CommandText = "SELECT Line FROM Term WHERE Name = @name;";
            resolveCommand.Parameters.AddWithValue("@name", termdef.Term);

            using var reader = await resolveCommand.ExecuteReaderAsync();
            if (await reader.ReadAsync())
            {
                throw new AlreadyAssignedException(reader["Line"]?.ToString() ?? "");
            }

            throw new AlreadyAssignedException();
        }
        catch (Exception ex)
        {
            transaction.Rollback();
            throw new LexicalException($"Database error: {ex.Message}");
        }
    }

    private static T? SafeDeserialize<T>(string? json) where T : class
    {
        if (string.IsNullOrEmpty(json) || json == "null") return null;
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<T>(json);
        }
        catch (System.Text.Json.JsonException)
        {
            return null;
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
