
babble.code_emitter = 
(function() {
    "use strict";

    function astToCode(ast) {
        // Convert an AST node or array of nodes back to Babble code
        
        // Handle string input (JSON that needs to be parsed)
        if (typeof ast === 'string') {
            try {
                ast = JSON.parse(ast);
            } catch (e) {
                // If it's not valid JSON, return it as-is
                return ast;
            }
        }
        
        if (Array.isArray(ast)) {
            // Top-level array of expressions
            return ast.map(node => nodeToCode(node)).join('\n');
        }
        
        let retset = nodeToCode(ast);
        return retset;
    }
    
    function nodeToCode(node) {
        if (!node || typeof node !== 'object') {
            return '';
        }
        
        // Handle string input (nested JSON strings)
        if (typeof node === 'string') {
            try {
                node = JSON.parse(node);
            } catch (e) {
                return node;
            }
        }
        
        switch (node.type) {
            case 'list':
                // (expr1 expr2 ...)
                if (!node.value || !Array.isArray(node.value)) {
                    return '()';
                }
                const listContents = node.value.map(n => nodeToCode(n)).join(' ');
                return `(${listContents})`;
                
            case 'vector':
                // [expr1 expr2 ...]
                if (!node.value || !Array.isArray(node.value)) {
                    return '[]';
                }
                const vectorContents = node.value.map(n => nodeToCode(n)).join(' ');
                return `[${vectorContents}]`;
                
            case 'map':
                // {:key1 val1 :key2 val2}
                if (!node.value || !Array.isArray(node.value)) {
                    return '{}';
                }
                // Map entries are {key, value} pairs
                const mapContents = node.value.map(entry => {
                    const keyCode = nodeToCode(entry.key);
                    const valueCode = nodeToCode(entry.value);
                    return `${keyCode} ${valueCode}`;
                }).join(' ');
                return `{${mapContents}}`;
                
            case 'set':
                // #{expr1 expr2 ...}
                if (!node.value || !Array.isArray(node.value)) {
                    return '#{}';
                }
                const setContents = node.value.map(n => nodeToCode(n)).join(' ');
                return `#{${setContents}}`;
                
            case 'symbol':
                // Plain symbol name
                return node.value || '';
                
            case 'keyword':
                // :keyword (value already includes the colon)
                return node.value || ':';
                
            case 'number':
            case 'integer':
            case 'float':
            case 'IntLiteral':     // Alternative naming from parser
            case 'FloatLiteral':   // Alternative naming from parser
                // Numeric literal
                return String(node.value);
                
            case 'string':
            case 'StringLiteral':  // Alternative naming from parser
                // String literal - need to re-escape if not already done
                const escaped = (node.value || '')
                    .replace(/\\/g, '\\\\')
                    .replace(/"/g, '\\"')
                    .replace(/\n/g, '\\n')
                    .replace(/\r/g, '\\r')
                    .replace(/\t/g, '\\t');
                return `"${escaped}"`;
                
            case 'boolean':
            case 'BooleanLiteral': // Alternative naming from parser
                // true or false
                return String(node.value);
                
            case 'nil':
                // nil
                return 'nil';
                
            case 'quote':
                // 'expr
                return `'${nodeToCode(node.value)}`;
                
            case 'syntax-quote':
                // `expr
                return '`' + nodeToCode(node.value);
                
            case 'unquote':
                // ~expr
                return `~${nodeToCode(node.value)}`;
                
            case 'unquote-splicing':
                // ~@expr
                return `~@${nodeToCode(node.value)}`;
                
            case 'deref':
                // @expr
                return `@${nodeToCode(node.value)}`;
                
            case 'var-quote':
                // #'expr
                return `#'${nodeToCode(node.value)}`;
                
            case 'meta':
                // ^metadata expr
                if (node.value && Array.isArray(node.value) && node.value.length >= 2) {
                    return `^${nodeToCode(node.value[0])} ${nodeToCode(node.value[1])}`;
                }
                return '';
                
            case 'discard':
                // #_expr
                return `#_${nodeToCode(node.value)}`;
                
            case 'regex':
                // #"pattern"
                return `#"${node.value || ''}"`;
                
            case 'fn':
                // #(expr) - anonymous function shorthand
                return `#(${nodeToCode(node.value)})`;
                
            default:
                // Unknown type - try to handle gracefully
                // Log warning for debugging
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn(`Unknown AST node type: ${node.type}`, node);
                }
                
                if (node.value !== undefined) {
                    if (Array.isArray(node.value)) {
                        return node.value.map(n => nodeToCode(n)).join(' ');
                    }
                    return String(node.value);
                }
                return '';
        }
    }

    // exposed methods
    return {
        astToCode: astToCode
    };
})();
