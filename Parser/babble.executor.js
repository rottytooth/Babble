
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

    async function call_server_assign(term, definition, params, line, creator, ipaddr, doc) {
        if (params === undefined)
            params = "";

        // doubly encode json content
        line = JSON.stringify(line);
        params = JSON.stringify(params);
        definition = JSON.stringify(definition);

        let body = {"term":term,"definition":definition,"params":params,"line":line,"creator":creator,"ipaddr":ipaddr,"doc":doc};

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
            return {"status":"willnotadd","old_def":old_def.detail};
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

    async function assign_definition(ast, callback) {
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
            
            call_server_assign(name, definition, params, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring).then(result => {
                if (result.status === "willnotadd") {
                    callback({"status":"error","message":`bad request: The term ${name} already has a definition: ${result.old_def}`});
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
                        call_server_assign(name, definition, params, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring)
                    );
                }
            }
            
            Promise.all(promises).then(results => {
                // Check if any failed
                const error = results.find(r => r.status === "willnotadd" || r.status === "error");
                if (error) {
                    if (error.status === "willnotadd") {
                        callback({"status":"error","message":`bad request: The term ${name} already has a definition: ${error.old_def}`});
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
            
            call_server_assign(name, definition, null, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring).then(result => {
                if (result.status === "willnotadd") {
                    callback({"status":"error","message":`bad request: The term ${name} already has a definition: ${result.old_def}`});
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
                await assign_definition(ast, callback);
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