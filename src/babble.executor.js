
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

    async function topline_expression(tree) {
        let retexp = "";
        try {
            retexp = await process_expression(tree);
        } catch(err) {
            if (!err.status) {
                err.status = "error";
                err.message = "internal error: " + err.message;
            }
            return {"status":err.status, "message": err.message};
        }
        return {"status":"success", "message": retexp};
    }

    async function process_expression(tree, locals) {
        // console.log(`running expression ${line}, expression name ${tree.id}, params ${tree.params}`);

        switch(tree.type) {
            case "IntLiteral":
            case "FloatLiteral":
                return tree.value;
            case "StringLiteral":
                return '"' + JSON.stringify(tree.value) + '"';
            case "Local":
                if (tree.name in locals) {
                    return locals[tree.name];
                }
                else 
                    throw {
                        status: "error",
                        message: `syntax error: could not find param with the name ${tree.name}`
                    };
        }

        // if it is a pre-determined expression
        if (tree.preset) {
            if (preset_args[tree.id] !== undefined) {
                if (tree.args.length !== preset_args[tree.id]) {
                    throw {
                        status: "error",
                        message: `${tree.id} requires ${preset_args[tree.id]} argument(s)`
                    };
                }
            }

            if ("+-/*^".indexOf(tree.id) > -1) {
                let add_string = "";
                // just add all the params
                for (let i = 0; i < tree.args.length; i++) {
                    if (i > 0) {
                        add_string += ` ${tree.id} `;
                    }
                    add_string += await process_expression(tree.args[i], locals);
                }
                let final_value = eval(add_string);
                return final_value;
            }
            if (tree.id === "source") {
                if (tree.args[0].type !== "local") {
                    throw {
                        status: "error",
                        message: `you can't source ${tree.args[0].name}`
                    }
                }
                let retset = await resolve(tree.args[0].name);
                return JSON.parse(retset.line);
            }
            if (tree.id === "handle") {
                babble.executor.handle = tree.args[0].name;
                return `handle assigned to ${babble.executor.handle}`;
            }
            if (tree.id === "doc") {
                let doc = await resolve(tree.args[0].name, true);
                return doc['doc'];
            }
        }
        let def_tree = await resolve(tree.id);

        // params don't match expected count
        if (def_tree.params.length !== tree.args.length) {
            let errorstr = `syntax error: expression ${tree.id} requires ${def_tree.params.length} params but received ${tree.args.length}`;

            // if it's short, tell which params were not provided
            if (def_tree.params.length > tree.args.length) {
                let missing_params = def_tree.params.slice(tree.args.length, def_tree.params.length).join(",");

                errorstr += `; missing values for param(s) ${missing_params}`;
            }
            throw {
                status: "error",
                message: errorstr
            };
        }

        // create mapping of passed params
        let parameter_mapping = {};
        for (let i = 0; i < def_tree.params.length; i++){
            parameter_mapping[def_tree.params[i]] = tree.args[i]; 
        }

        let children = def_tree.definition; 

        if (!Array.isArray(children)) {
            children = [children];
        }

        let response = "";
        for (let i = 0; i < children.length; i++) {
            if (i > 0) {
                response += " , ";
            }
            switch (children[i].type) {
                case "expression":
                    response += await process_expression(children[i], parameter_mapping);
                    break;
            }
        }

        console.log(response);
        return response;
    }

    async function resolve(term, doc_only=false) {
        let url = `${resolve_url}${term}`;

        if (doc_only) {
            url = `${resolve_url}${term}/doc`;
        }

        const response = await fetch(url);

        // catch 404
        if (response.status == 404) {
            // term is undefined
            console.log("404");
            throw {
                status:"error",
                message:`syntax error: expression "${term}" is not recognized`
            };
        }
        let retset = await response.json();
        retset.status = "found";
        return retset;
    }

    async function assign(term, definition, params, line, creator, doc) {
        if (params === undefined)
            params = "";

        // doubly encode json content
        line = JSON.stringify(line);
        params = JSON.stringify(params);
        definition = JSON.stringify(definition);

        let body = {"term":term,"definition":definition,"params":params,"line":line,"creator":creator, "doc":doc};

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
            return {"status":"error","message":"internal error: Could not process request, likely an issue with the endpoint itself"};
        }
        if (response.status == 200) {
            // added successfully
            return {"status":"success","message":`${term} is now assigned`};
        }
        // I don't think we should ever get here
        return {"status":"waiting", "message": "assignment is still in waiting state"};
    }

    /*
     * tree: tree for calling expression
     * callback: callback function, to send json describing result
     * line: the actual line of code
     * creator: used for def only, who is defining this function
     */
    function ex(tree, callback, line, creator) {
        console.log(JSON.stringify(tree));

        try {
            switch(tree.type) {
                case "expression":
                    topline_expression(tree).then(result => {
                        if (result.status === "notfound") {
                            callback({"status":"error","message":`error: ${tree.id} is not recognized`});
                        } else {

                            // this should just be a straight return
                            callback(result);
                        }
                    });
                    return;

                case "def_expression":
                    if (babble.executor.handle === undefined || babble.executor.handle === null) {
                        callback({"status": "error", "message": "please select a handle with (handle xxx) before def'ing a new command"});
                        return;
                    }
                    assign(tree.id, tree.exp, tree.params, line, babble.executor.handle, tree.doc).then(result => {
                        if (result.status === "willnotadd") {
                            callback({"status":"error","message":`bad request: The term ${tree.id} already has a definition: ${result.old_def}`});
                        } else if (result.status === "error") {
                            callback({"status":"error","message":result.message})
                        } else {
                            //TODO: add check that every expression used by this one is already defined
                            callback(result);
                        }
                    });
                    return;
            }
        } catch(ex) {
            return {"status":"error","message":`An internal error has occurred in the executor: ${ex}`};
        }
    }

    // exposed methods
    return {
        ex: ex
    };

})();

babble.executor.handle = null;
