
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
        callback({"status":"success","message":"yay!"});
    }

    // exposed methods
    return {
        ex: ex
    };
})();

babble.executor.handle = null;