
babble.executor = 
(function() {
    "use strict";

    const resolve_url = '/resolve/';
    const assign_url = '/assign';

    async function resolve(term) {
        // catch 404
        let url = `${resolve_url}${term}`;
        const response = await fetch(url);
        if (response.status == 404) {
            // term is undefined
            console.log("404");
            return {"status":"notfound"};
        }
        let retset = response.json();
        retset.status = "found";
        return retset;
    }

    async function assign(term, definition, params, line, creator) {
        if (params === undefined)
            params = "";

        // doubly encode json content
        line = JSON.stringify(line);
        params = JSON.stringify(params);
        definition = JSON.stringify(definition);

        let body = {"term":term,"definition":definition,"params":params,"line":line,"creator":creator};

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
            // malformed request, probably bad json
            console.log(response);
            console.log(body);
            return {"status":"error","message":"internal error: Could not process request, likely an issue with the endpoint itself"};
        }
        if (response.status == 200) {
            // added successfully
            return {"status":"success","message":`${term} is now assigned`};
        }
        return {"status":"waiting", "message": "assignment is still in waiting state"};
    };

    function ex(tree, callback, line, creator) {
        console.log(JSON.stringify(tree));

        switch(tree.type) {
            case "expression":
                // this is an expression that is not a built-in
                // so expression name (id) must be resolved
                resolve(tree.id).then(result => {
                    if (result.status === "notfound") {
                        callback({"status":"error","message":`error: ${tree.id} is not recognized`});
                    } else {
                        let def = result.definition;

                        // before callback, we need to actually run that line of code
                        // and then any other term that comes up in those lines of code, etc
                        callback({"status":"success","message":def});
                    }
                });

            case "def_expression":
                // check if already defined
                assign(tree.id, tree.exp, tree.params, line, creator).then(result => {
                    if (result.status === "willnotadd") {
                        //FIXME: this should look up the definition and return it
                        callback({"status":"error","message":`bad request: The term ${tree.id} already has a definition: ${result.old_def}`});
                    } else if (result.status === "error") {
                        callback({"status":"error","message":result.message})
                    } else {
                        callback(result);
                    }
                });
        }
    }

    return {
        ex: ex
    };
})();