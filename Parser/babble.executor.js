
babble.executor = 
(function() {
    "use strict";

    const resolve_url = '/resolve/';
    const assign_url = '/assign';

    const preset_args = {
        "handle": 1,
        "source": 1,
        "doc": 1
    };

    async function verify_symbols(symbols) {
        // Check if there are any unknown symbols to verify
        if (!symbols.unknowns || symbols.unknowns.length === 0) {
            return { status: "success" };
        }

        try {
            // Call the resolve_all endpoint with comma-separated unknown symbols
            const symbolNames = symbols.unknowns.join(',');
            const response = await fetch(`/resolve_all/${symbolNames}`);
            
            if (!response.ok) {
                return { 
                    status: "error", 
                    message: "Failed to verify symbols with server" 
                };
            }

            const results = await response.json();
            
            // Find any symbols that don't exist (exists === false)
            const unrecognized = results
                .filter(r => !r.exists)
                .map(r => r.name);
            
            if (unrecognized.length > 0) {
                return {
                    status: "error",
                    message: `One or more commands are unrecognized: ${unrecognized.join(', ')}`
                };
            }
            
            return { status: "success" };
        } catch (error) {
            return {
                status: "error",
                message: `Error verifying symbols: ${error.message}`
            };
        }
    }

    async function call_server_assign(term, definition, params, symbols, line, creator, ipaddr, doc) {
        if (params === undefined)
            params = "";

        // doubly encode json content
        line = JSON.stringify(line);
        params = JSON.stringify(params);
        definition = JSON.stringify(definition);

        // Convert arrays to JSON strings (symbols.builtIns and symbols.unknowns are already arrays)
        let builtIns = JSON.stringify(symbols.builtIns || []);
        let symbolsUnknown = JSON.stringify(symbols.unknowns || []);

        // Verify that all unknown symbols are defined in the Term table
        const verifyResult = await verify_symbols(symbols);
        if (verifyResult.status === "error") {
            return verifyResult;
        }

        let body = {"term":term,"definition":definition,"params":params,"line":line,"creator":creator,"ipaddr":ipaddr,"doc":doc, "builtIns":builtIns, "symbols":symbolsUnknown};

        const response = await fetch(assign_url, {
            method:'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (response.status == 409) {
            // the assignment failed because it is already defined
            console.log(response);
            let old_def = await response.json();
            return {"status":"willnotadd","old_def":old_def.error};
        } 
        if (response.status == 422) {
            // malformed request, probably bad json
            console.log(response);
            console.log(body);
            return {"status":"error","message":"internal error: Could not process request, likely bad json"};
        }
        if (response.status == 500) {
            // endpoint issues
            console.log(response);
            console.log(body);
            return {"status":"error","message":"internal error: Could not process request"};
        }
        if (response.status == 200) {
            // added successfully
            return {"status":"success","message":`${term} is now assigned`};
        }

        console.log("error: unexpected response from server");
        console.log(response);
        return {"status":"error", "message": "internal error, please refer to log"};
    }

    async function assign_definition(ast, symbols, callback) {
        //FIXME: this still does not handle def correctly yet

        // ast is an array with one element (the def/defn/define expression)
        const defForm = ast[0];
        const op = defForm.value[0].value; // 'def', 'defn', or 'define'
        const name = defForm.value[1].value; // the symbol being defined
        
        let bodyStart = 2;
        let docstring = null;
        
        // Check for docstring
        if (defForm.value[bodyStart] && defForm.value[bodyStart].type === 'string') {
            docstring = defForm.value[bodyStart].value;
            bodyStart = 3;
        }
        
        // Get IP address
        let ipaddr = await getIpaddr();
        
        // Determine if this is a def or defn
        const nextElement = defForm.value[bodyStart];
        
        if (nextElement && nextElement.type === 'vector') {
            // Single-arity defn
            const params = JSON.stringify(nextElement.value.map(p => p.value));
            const bodyExpressions = defForm.value.slice(bodyStart + 1);
            const definition = JSON.stringify(bodyExpressions);
            
            call_server_assign(name, definition, params, symbols, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring).then(result => {
                if (result.status === "willnotadd") {
                    // Parse the old definition and convert it back to code
                    let oldDefCode = result.old_def;
                    try {
                        const oldDefAst = JSON.parse(result.old_def);
                        oldDefCode = babble.code_emitter.astToCode(oldDefAst);
                    } catch (e) {
                        // If parsing fails, use the raw value
                    }
                    callback({"status":"error","message":`bad request: The term ${name} already has a definition: ${oldDefCode}`});
                } else if (result.status === "error") {
                    callback({"status":"error","message":result.message});
                } else {
                    //TODO: add check that every expression used by this one is already defined
                    callback(result);
                }
            }).catch(error => {
                callback({"status":"error","message":`Failed to assign definition: ${error.message}`});
            });
        } else if (nextElement && nextElement.type === 'list') {
            // Multi-arity defn - each clause is (params body...)
            const arities = defForm.value.slice(bodyStart);
            const promises = [];
            
            for (const arityClause of arities) {
                if (arityClause.type === 'list' && arityClause.value.length > 0) {
                    const params = JSON.stringify(arityClause.value[0].value.map(p => p.value));
                    const bodyExpressions = arityClause.value.slice(1);
                    const definition = JSON.stringify(bodyExpressions);
                    
                    promises.push(
                        call_server_assign(name, definition, params, symbols, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring)
                    );
                }
            }
            
            Promise.all(promises).then(results => {
                // Check if any failed
                const error = results.find(r => r.status === "willnotadd" || r.status === "error");
                if (error) {
                    if (error.status === "willnotadd") {
                        // Parse the old definition and convert it back to code
                        let oldDefCode = error.old_def;
                        try {
                            const oldDefAst = JSON.parse(error.old_def);
                            oldDefCode = babble.code_emitter.astToCode(oldDefAst);
                        } catch (e) {
                            // If parsing fails, use the raw value
                        }
                        callback({"status":"error","message":`bad request: The term ${name} already has a definition: ${oldDefCode}`});
                    } else {
                        callback({"status":"error","message":error.message});
                    }
                } else {
                    callback({"status":"success","message":`${name} is now assigned (${results.length} arity)`});
                }
            }).catch(error => {
                callback({"status":"error","message":`Failed to assign multi-arity definition: ${error.message}`});
            });
        } else {
            // def - simple value assignment
            const value = defForm.value[bodyStart];
            const definition = JSON.stringify(value);
            
            call_server_assign(name, definition, null, symbols, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring).then(result => {
                if (result.status === "willnotadd") {
                    // Parse the old definition and convert it back to code
                    let oldDefCode = result.old_def;
                    try {
                        const oldDefAst = JSON.parse(result.old_def);
                        oldDefCode = babble.code_emitter.astToCode(oldDefAst);
                    } catch (e) {
                        // If parsing fails, use the raw value
                    }
                    callback({"status":"error","message":`bad request: The term ${name} already has a definition: ${oldDefCode}`});
                } else if (result.status === "error") {
                    callback({"status":"error","message":result.message});
                } else {
                    //TODO: add check that every expression used by this one is already defined
                    callback(result);
                }
            }).catch(error => {
                callback({"status":"error","message":`Failed to assign definition: ${error.message}`});
            });
        }
    }

    async function ex(line, callback) {
        try {
            var ast = babble.parser.parse(line);
        } catch (error) {
            callback({"status":"error","message":`SyntaxError: ${error.message}`});
            return; 
        }
        let resp = babble.analyzer.analyze(ast);
        if (resp.status !== "success") {
            callback(resp);
            return;
        }
        
        // Check if the first expression is def, defn, or define
        if (ast && ast.length > 0 && ast[0].type === 'list' && ast[0].value && ast[0].value.length > 0) {
            const firstSymbol = ast[0].value[0];
            if (firstSymbol.type === 'symbol' && 
                (firstSymbol.value === 'def' || firstSymbol.value === 'defn' || firstSymbol.value === 'define')) {
                await assign_definition(ast, resp.symbols, callback);
                return;
            }
        }

        callback({"status":"success","message":"yay!"});
    }

    // exposed methods
    return {
        ex: ex
    };
})();

babble.executor.handle = null;