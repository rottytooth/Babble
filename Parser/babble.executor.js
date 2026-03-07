
// babble.executor
//
// The main REPL entry point for the Babble client. Takes a line of Babble code,
// parses and analyzes it, then routes it to the appropriate handler:
//
//   about                — fetches server info (/info) and prints name/version/build date.
//   def / defn / define  — serializes the definition and POSTs it to the server
//                          (/assign), after verifying all unknown symbols exist
//                          in the server's Term table (/resolve_all).
//   handle               — sets babble.executor.handle (the current user handle)
//                          and requests a password challenge from the caller.
//   source               — fetches the original stored line for a term from the server
//                          (/resolve/<term>) and returns it via callback.
//   doc / desc / man     — fetches documentation text for a term from the server
//                          (/resolve/<term>/doc) and returns it via callback.
//   everything else      — converts the AST back to code (babble.code_emitter)
//                          and evaluates it via babble.core.eval_clojure_safe().
//
// Callers: client-side REPL / UI — nothing else should call ex() directly.
//
// Entry:   babble.executor.ex(line, callback)
//            line      — a string of Babble source code (one expression)
//            callback  — function(response) where response is { status, message, ... }
//                        status is 'success', 'error', 'warning', or 'verify_pwd'
//
// Depends on: babble.parser, babble.analyzer, babble.code_emitter, babble.core

babble.executor =
(function() {
    "use strict";

    const resolve_url = '/resolve/';
    const assign_url = '/assign';

    const preset_args = {
        "about": 0,
        "handle": 1,
        "source": 1,
        "doc": 1,
        "desc": 1,
        "man": 1
    };

    async function verify_symbols(symbols) {
        // Check if there are any unknown symbols to verify
        if (!symbols.unknowns || symbols.unknowns.length === 0) {
            return { status: "success" };
        }

        try {
            const unrecognized = [];
            for (const unknown of symbols.unknowns) {
                const name = String(unknown.name);
                const arity = Number.isInteger(unknown.arity) ? unknown.arity : 0;
                const response = await fetch(`/resolve/${encodeURIComponent(name)}?arity=${arity}`);

                if (response.status === 404) {
                    unrecognized.push(`${name}/${arity}`);
                    continue;
                }

                if (!response.ok) {
                    return {
                        status: "error",
                        message: "Failed to verify symbols with server"
                    };
                }
            }

            if (unrecognized.length > 0) {
                return {
                    status: "error",
                    message: `One or more symbols are unrecognized: ${unrecognized.join(', ')}`
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

    // Walk an AST node and return a Map of {name → arity} for each symbol in
    // symbolNames that appears in function-call position. Symbols used only in
    // value position are omitted (callers default those to 0).
    function findCallArities(node, symbolNames) {
        const arities = new Map();
        function walk(n) {
            if (Array.isArray(n)) { n.forEach(walk); return; }
            if (!n || typeof n !== 'object') return;
            if (n.type === 'list' && Array.isArray(n.value) && n.value.length > 0) {
                const head = n.value[0];
                if (head.type === 'symbol' && symbolNames.has(head.value)) {
                    arities.set(head.value, n.value.length - 1);
                }
                n.value.forEach(walk);
            } else if (n.value !== undefined) {
                if (Array.isArray(n.value)) n.value.forEach(walk);
                else walk(n.value);
            }
        }
        walk(node);
        return arities;
    }

    // Fetch definitions for all unknown symbols, plus their transitive dependencies
    // (since a fetched term's body may itself reference other Babble terms).
    // unknowns: array of {name, arity} objects.
    // Throws if any symbol cannot be resolved.
    async function collect_symbol_defs(unknowns) {
        const defs = {};
        // Queue holds {name, arity} items; arity drives which overload to fetch.
        const queue = unknowns.map(u => (typeof u === 'string' ? { name: u, arity: 0 } : u));
        const visited = new Set();
        while (queue.length > 0) {
            const { name, arity } = queue.shift();
            if (visited.has(name)) continue;
            visited.add(name);
            // Resolve the term — throws on failure so the caller can report the error.
            const termResponse = await resolve_term(name, arity);
            defs[name] = termResponse;
            // For transitive deps, scan the definition AST to find what arity
            // each dep symbol is called with inside this term's body.
            const depNames = (termResponse.symbols || []).map(d => String(d));
            if (depNames.length > 0) {
                let defAst = termResponse.definition;
                try { defAst = expandLocsToSymbols(defAst, depNames); } catch (_) {}
                const depArities = findCallArities(defAst, new Set(depNames));
                for (const depName of depNames) {
                    if (!visited.has(depName)) {
                        queue.push({ name: depName, arity: depArities.get(depName) ?? 0 });
                    }
                }
            }
        }
        return defs;
    }

    // Walk an AST node, replacing unknown symbol references with inline
    // (fn [params] body) nodes so the expression is self-contained when
    // handed to SCI — no SCI namespace mutation required.
    function substitute_symbols(node, defs) {
        if (Array.isArray(node)) return node.map(n => substitute_symbols(n, defs));
        if (node === null || typeof node !== 'object') return node;
        if (node.type === 'symbol' && node.value && defs[node.value]
                && node.symbolType !== 'local' && node.symbolType !== 'builtin') {
            const term = defs[node.value];
            const termSymbols = (term.symbols || []).map(s => String(s));
            const params = (term.params || []).map(p => String(p));
            let defAst = term.definition;
            if (termSymbols.length > 0 && defAst) {
                defAst = expandLocsToSymbols(defAst, termSymbols);
            }
            // Recursively substitute within the body (handles transitive deps)
            defAst = substitute_symbols(defAst, defs);
            // definition is stored as an array of body expressions; spread them into the fn form.
            const bodyExprs = Array.isArray(defAst) ? defAst : [defAst];
            return {
                type: 'list',
                value: [
                    { type: 'symbol', value: 'fn' },
                    { type: 'vector', value: params.map(p => ({ type: 'symbol', value: p })) },
                    ...bodyExprs
                ]
            };
        }
        if (node.value !== undefined && typeof node.value === 'object') {
            return { ...node, value: substitute_symbols(node.value, defs) };
        }
        return node;
    }

    // Walk an AST node and expand {type:"symbol", loc:N} back to {type:"symbol", value:symbolList[N]}.
    function expandLocsToSymbols(node, symbolList) {
        if (!symbolList || symbolList.length === 0) return node;
        if (Array.isArray(node)) {
            return node.map(n => expandLocsToSymbols(n, symbolList));
        }
        if (node === null || typeof node !== 'object') return node;
        if (node.type === 'symbol' && node.loc !== undefined) {
            return { type: 'symbol', value: symbolList[node.loc] };
        }
        if (node.value !== undefined && typeof node.value === 'object') {
            return { ...node, value: expandLocsToSymbols(node.value, symbolList) };
        }
        return node;
    }

    // Walk an AST node and replace any symbol node whose value appears in symbolList
    // with a loc-reference node: {type:"symbol", loc:N} where N is the index in symbolList.
    function replaceSymbolsWithLocs(node, symbolList) {
        if (!symbolList || symbolList.length === 0) return node;
        if (Array.isArray(node)) {
            return node.map(n => replaceSymbolsWithLocs(n, symbolList));
        }
        if (node === null || typeof node !== 'object') return node;
        if (node.type === 'symbol' && typeof node.value === 'string') {
            const idx = symbolList.indexOf(node.value);
            if (idx !== -1) {
                return { type: 'symbol', loc: idx };
            }
        }
        if (node.value !== undefined && typeof node.value === 'object') {
            return { ...node, value: replaceSymbolsWithLocs(node.value, symbolList) };
        }
        return node;
    }

    async function call_server_assign(term, definition, params, symbols, line, creator, ipaddr, doc) {
        if (params === undefined)
            params = "";

        let builtIns = symbols.builtIns || [];
        let symbolsUnknown = (symbols.unknowns || []).map(u => u.name);
        let symbolCalls = (symbols.unknowns || []).map(u => ({
            name: String(u.name),
            arity: Number.isInteger(u.arity) ? u.arity : 0
        }));

        // Replace unknown symbol names with their loc index before storing,
        // so that renaming a symbol only requires updating the Symbols column.
        try {
            let defObj = JSON.parse(definition);
            defObj = replaceSymbolsWithLocs(defObj, symbolsUnknown);
            if (Array.isArray(defObj) && defObj.length === 1) defObj = defObj[0];
            definition = JSON.stringify(defObj);
        } catch (_) {}
        try {
            let lineObj = JSON.parse(line);
            lineObj = replaceSymbolsWithLocs(lineObj, symbolsUnknown);
            line = JSON.stringify(lineObj);
        } catch (_) {}

        let body = {"term":term,"definition":definition,"params":params,"line":line,"creator":creator,"ipaddr":ipaddr,"doc":doc, "builtIns":builtIns, "symbols":symbolsUnknown, "symbolCalls":symbolCalls};

        const response = await fetch(assign_url, {
            method:'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
        if (response.status == 409) {
            console.log(response);
            let data = await response.json();
            if (data.type === "circular_dependency") {
                return {"status":"error","message":`circular dependency: '${term}' depends on '${data.error}', which already depends on '${term}'`};
            }
            return {"status":"willnotadd","old_def":data.error};
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
        // Verify that all unknown symbols exist in the Term table before proceeding
        const verifyResult = await verify_symbols(symbols);
        if (verifyResult.status === "error") {
            callback({"status":"error","message":verifyResult.message});
            return;
        }

        // ast is an array with one element (the def/defn/define expression)
        // def, defn, and define are all aliases — always treated as defn.
        const defForm = ast[0];
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

        const nextElement = defForm.value[bodyStart];

        function handleAssignResult(result, callback, name) {
            if (result.status === "willnotadd") {
                let oldDefCode = result.old_def;
                try {
                    const oldDefAst = JSON.parse(result.old_def);
                    oldDefCode = babble.code_emitter.astToCode(oldDefAst);
                } catch (e) {}
                callback({"status":"error","message":`bad request: The term ${name} already has a definition: ${oldDefCode}`});
            } else if (result.status === "error") {
                callback({"status":"error","message":result.message});
            } else {
                callback(result);
            }
        }

        if (nextElement && nextElement.type === 'list' && nextElement.value?.[0]?.type === 'vector') {
            // Multi-arity defn — each clause is ([params] body...)
            const arities = defForm.value.slice(bodyStart);
            const promises = [];

            for (const arityClause of arities) {
                if (arityClause.type === 'list' && arityClause.value.length > 0) {
                    const params = arityClause.value[0].value.map(p => p.value);
                    const bodyExpressions = arityClause.value.slice(1);
                    const definition = JSON.stringify(bodyExpressions);
                    promises.push(
                        call_server_assign(name, definition, params, symbols, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring)
                    );
                }
            }

            Promise.all(promises).then(results => {
                const error = results.find(r => r.status === "willnotadd" || r.status === "error");
                if (error) {
                    handleAssignResult(error, callback, name);
                } else {
                    callback({"status":"success","message":`${name} is now assigned (${results.length} arity)`});
                }
            }).catch(error => {
                callback({"status":"error","message":`Failed to assign multi-arity definition: ${error.message}`});
            });
        } else {
            // Single-arity defn — params vector is optional; defaults to []
            const hasParamVector = nextElement && nextElement.type === 'vector';
            const params = hasParamVector ? nextElement.value.map(p => p.value) : [];
            const bodyExpressions = defForm.value.slice(hasParamVector ? bodyStart + 1 : bodyStart);
            const definition = JSON.stringify(bodyExpressions);

            call_server_assign(name, definition, params, symbols, JSON.stringify(defForm), babble.executor.handle, ipaddr, docstring).then(result => {
                handleAssignResult(result, callback, name);
            }).catch(error => {
                callback({"status":"error","message":`Failed to assign definition: ${error.message}`});
            });
        }
    }

    async function resolve_doc(term) {
        const response = await fetch(`${resolve_url}${encodeURIComponent(term)}/doc`);

        if (!response.ok) {
            let details = "";
            try {
                const err = await response.json();
                details = err?.error || err?.title || err?.detail || "";
            } catch (_) {
                try {
                    details = await response.text();
                } catch (_) {}
            }
            if (response.status === 404) {
                throw new Error(details || `Term '${term}' is unknown`);
            }
            throw new Error(details || `Could not resolve documentation for '${term}'`);
        }

        return await response.json();
    }

    async function resolve_term(term, arity) {
        const base = `${resolve_url}${encodeURIComponent(term)}`;
        const url = (arity != null) ? `${base}?arity=${arity}` : base;
        const response = await fetch(url);

        if (!response.ok) {
            let details = "";
            try {
                const err = await response.json();
                details = err?.error || err?.title || err?.detail || "";
            } catch (_) {
                try {
                    details = await response.text();
                } catch (_) {}
            }
            if (response.status === 404) {
                throw new Error(details || `Term '${term}' is unknown`);
            }
            throw new Error(details || `Could not resolve term '${term}' with arity ${arity}`);
        }

        return await response.json();
    }

    // Fetches all arity overloads of a term — returns an array of {name, params, line, symbols, ...} objects.
    async function resolve_term_all(term) {
        const response = await fetch(`${resolve_url}${encodeURIComponent(term)}`);

        if (!response.ok) {
            let details = "";
            try {
                const err = await response.json();
                details = err?.error || err?.title || err?.detail || "";
            } catch (_) {
                try { details = await response.text(); } catch (_) {}
            }
            if (response.status === 404) {
                throw new Error(details || `Term '${term}' is unknown`);
            }
            throw new Error(details || `Could not resolve term '${term}'`);
        }

        return await response.json();
    }

    function normalize_stored_line(rawLine, symbols) {
        let current = rawLine;

        if (typeof current === 'string') {
            try {
                current = JSON.parse(current);
            } catch (_) {}
        }

        if (typeof current === 'string') {
            return current;
        }

        if (current === null || current === undefined) {
            return "";
        }

        if (typeof current === 'object') {
            if (symbols && symbols.length > 0) {
                current = expandLocsToSymbols(current, symbols);
            }
            try {
                return babble.code_emitter.astToCode(current);
            } catch (_) {
                try {
                    return JSON.stringify(current);
                } catch (_) {
                    return String(current);
                }
            }
        }

        return String(current);
    }

    async function ex(line, callback) {
        try {
            var ast = babble.parser.parse(line);
        } catch (error) {
            callback({"status":"error","message":`SyntaxError: ${error.message}`});
            return; 
        }
        let resp = await babble.analyzer.analyze(ast);
        if (resp.status !== "success") {
            callback(resp);
            return;
        }
        
        // Check if the first expression is define, an existing term, or something else requiring special handling
        if (ast && ast.length > 0 && ast[0].type === 'list' && ast[0].value && ast[0].value.length > 0) {
            const firstSymbol = ast[0].value[0];

            if (firstSymbol.type !== 'symbol') {
                callback({"status":"error","message":"First element of expression must be a symbol"});
            }
            switch (firstSymbol.value) {
                case 'about':
                    try {
                        const infoResponse = await fetch('/info');
                        if (!infoResponse.ok) {
                            callback({"status":"error","message":"Could not retrieve server info"});
                            return;
                        }
                        const info = await infoResponse.json();
                        callback({"status":"success","message":`${info.projectName} v${info.version}, built ${info.buildDate}`});
                    } catch (error) {
                        callback({"status":"error","message":`Could not retrieve server info: ${error.message}`});
                    }
                    return;
                case 'def':
                case 'defn':
                    callback({"status":"error","message":`'${firstSymbol.value}' is not supported — use 'define' instead`});
                    return;
                case 'define':
                    await assign_definition(ast, resp.symbols, callback);
                    return;
                case 'handle':
                    if (ast[0].value.length < 2) {
                        callback({"status":"error","message":"Missing handle argument"});
                        return;
                    }
                    if (!ast[0].value[1].value || typeof ast[0].value[1].value !== 'string') {
                        callback({"status":"error","message":"Handle must be a symbol or string"});
                        return;
                    }
                    babble.executor.handle = ast[0].value[1].value;
                    callback({"status":"verify_pwd", "message":"handle to be verified", "handle": babble.executor.handle});
                    return;
                case "source":
                    if (ast[0].value.length < 2) {
                        callback({"status":"error","message":"Missing term argument"});
                        return;
                    }
                    if (!ast[0].value[1].value || typeof ast[0].value[1].value !== 'string') {
                        callback({"status":"error","message":"Source target must be a symbol or string"});
                        return;
                    }
                    try {
                        const termResponses = await resolve_term_all(ast[0].value[1].value);
                        const lines = termResponses.map(r => normalize_stored_line(r.line, r.symbols));
                        callback({"status":"success", "message": lines.join('\n')});
                    } catch (error) {
                        callback({"status":"error", "message": error.message});
                    }
                    return;
                case "doc":
                case "desc":
                case "man":
                    if (ast[0].value.length < 2) {
                        callback({"status":"error","message":"Missing term argument"});
                        return;
                    }
                    if (!ast[0].value[1].value || typeof ast[0].value[1].value !== 'string') {
                        callback({"status":"error","message":"Doc target must be a symbol or string"});
                        return;
                    }
                    try {
                        const docResponse = await resolve_doc(ast[0].value[1].value);
                        callback({"status":"success", "message": docResponse.doc || ""});
                    } catch (error) {
                        callback({"status":"error", "message": error.message});
                    }
                    return;
            }
        }
        // this is not a define (or other handled by executor), so just eval it.
        // Inline any unknown (server-defined) symbols into the AST as (fn [params] body)
        // nodes before generating code, so the expression is self-contained for SCI.
        const unknowns = resp.symbols.unknowns || [];
        let evalAst = ast;
        if (unknowns.length > 0) {
            let defs;
            try {
                defs = await collect_symbol_defs(unknowns);
            } catch (error) {
                callback({"status":"error","message":error.message});
                return;
            }
            evalAst = substitute_symbols(ast, defs);
        }
        let reworked_code = babble.code_emitter.astToCode(evalAst);

        var x = babble.core.eval_clojure_safe(reworked_code);
        if (x.success)
            callback({"status":"success","message":x.result});
        else
            callback({"status":"error","message":x.error});
}

    // exposed methods
    return {
        ex: ex
    };
})();

babble.executor.handle = null;