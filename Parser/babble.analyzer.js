babble.analyzer = {
    analyze(ast) {
      const errors = [];
      const warnings = [];
      const symbolInfo = {
        builtIns: new Set(),
        locallyDefined: new Set(),
        unknowns: new Set()
      };
      
      // Analyze each top-level form
      if (Array.isArray(ast)) {
        ast.forEach((form, idx) => {
          this.analyzeForm(form, { 
            isTopLevel: true, 
            inDefinition: false,
            boundVars: new Set(),
            formIndex: idx,
            symbolInfo: symbolInfo
          }, errors, warnings);
        });
      } else {
        this.analyzeForm(ast, { 
          isTopLevel: true, 
          inDefinition: false,
          boundVars: new Set(),
          formIndex: 0,
          symbolInfo: symbolInfo
        }, errors, warnings);
      }
      
      if (errors.length > 0) {
        return {
          status: 'error',
          message: errors.join('\n'),
          errors: errors,
          warnings: warnings,
          ast: ast,
          symbols: {
            builtIns: Array.from(symbolInfo.builtIns),
            locallyDefined: Array.from(symbolInfo.locallyDefined),
            unknowns: Array.from(symbolInfo.unknowns)
          }
        };
      }
      
      if (warnings.length > 0) {
        return {
          status: 'warning',
          message: warnings.join('\n'),
          errors: [],
          warnings: warnings,
          ast: ast,
          symbols: {
            builtIns: Array.from(symbolInfo.builtIns),
            locallyDefined: Array.from(symbolInfo.locallyDefined),
            unknowns: Array.from(symbolInfo.unknowns)
          }
        };
      }
      
      return {
        status: 'success',
        message: 'Analysis completed successfully',
        errors: [],
        warnings: [],
        ast: ast,
        symbols: {
          builtIns: Array.from(symbolInfo.builtIns),
          locallyDefined: Array.from(symbolInfo.locallyDefined),
          unknowns: Array.from(symbolInfo.unknowns)
        }
      };
    },
    
    analyzeForm(form, context, errors, warnings) {
      if (!form || typeof form !== 'object') {
        return;
      }
      
      switch (form.type) {
        case 'list':
          this.analyzeList(form, context, errors, warnings);
          break;
          
        case 'vector':
          this.analyzeVector(form, context, errors, warnings);
          break;
          
        case 'map':
          this.analyzeMap(form, context, errors, warnings);
          break;
          
        case 'set':
          this.analyzeSet(form, context, errors, warnings);
          break;
          
        case 'quote':
        case 'syntax-quote':
          // Quoted forms are not evaluated, skip analysis
          break;
          
        case 'unquote':
        case 'unquote-splicing':
          if (!context.inSyntaxQuote) {
            errors.push(`${form.type} used outside of syntax-quote`);
          }
          this.analyzeForm(form.value, context, errors, warnings);
          break;
          
        case 'deref':
        case 'var':
        case 'var-quote':
          this.analyzeForm(form.value, context, errors, warnings);
          break;
          
        case 'meta':
        case 'with-meta':
          this.analyzeForm(form.meta || form.metadata, context, errors, warnings);
          this.analyzeForm(form.value, context, errors, warnings);
          break;
          
        case 'fn':
        case 'anonymous-function':
          this.analyzeAnonymousFunction(form, context, errors, warnings);
          break;
          
        case 'discard':
          // Discarded forms are not evaluated
          break;
          
        case 'symbol':
          this.analyzeSymbol(form, context, errors, warnings);
          break;
          
        case 'tagged-literal':
          this.analyzeForm(form.value, context, errors, warnings);
          break;
          
        // Literals don't need semantic analysis
        case 'number':
        case 'integer':
        case 'float':
        case 'string':
        case 'character':
        case 'boolean':
        case 'nil':
        case 'keyword':
        case 'regex':
        case 'ratio':
          break;
          
        default:
          warnings.push(`Unknown form type: ${form.type}`);
      }
    },
    
    analyzeList(form, context, errors, warnings) {
      if (!form.value || form.value.length === 0) {
        // Empty list is valid
        return;
      }
      
      const first = form.value[0];
      
      // Check if first element is a symbol (special form or function call)
      if (first.type === 'symbol') {
        const op = first.value;
        
        // Check for def/defn/define at non-top-level
        if ((op === 'def' || op === 'defn' || op === 'define') && !context.isTopLevel) {
          errors.push(`'${op}' can only be used at the top level, not inside other forms`);
          return;
        }
        
        switch (op) {
          case 'define':
            // 'define' can be either def or defn based on its structure
            this.analyzeDefine(form, context, errors, warnings);
            break;
            
          case 'def':
            this.analyzeDef(form, context, errors, warnings);
            break;
            
          case 'defn':
            this.analyzeDefn(form, context, errors, warnings);
            break;
            
          case 'let':
          case 'let*':
            this.analyzeLet(form, context, errors, warnings);
            break;
            
          case 'fn':
          case 'fn*':
            this.analyzeFn(form, context, errors, warnings);
            break;
            
          case 'if':
            this.analyzeIf(form, context, errors, warnings);
            break;
            
          case 'do':
            this.analyzeDo(form, context, errors, warnings);
            break;
            
          case 'loop':
            this.analyzeLoop(form, context, errors, warnings);
            break;
            
          case 'recur':
            this.analyzeRecur(form, context, errors, warnings);
            break;
            
          case 'quote':
            // Quoted forms are data, not code
            break;
            
          case 'var':
            if (form.value.length !== 2) {
              errors.push(`'var' requires exactly 1 argument, got ${form.value.length - 1}`);
            }
            break;
            
          default:
            // Regular function call - analyze all arguments
            this.analyzeFunctionCall(form, context, errors, warnings);
        }
      } else {
        // First element is not a symbol - could be a lambda or invalid
        this.analyzeForm(first, { ...context, isTopLevel: false }, errors, warnings);
        
        // Analyze remaining elements as arguments
        for (let i = 1; i < form.value.length; i++) {
          this.analyzeForm(form.value[i], { ...context, isTopLevel: false }, errors, warnings);
        }
      }
    },
    
    analyzeDefine(form, context, errors, warnings) {
      // 'define' can be either 'def' or 'defn' based on its structure
      // If any element after name (skipping optional docstring) is a vector or list, it's a defn
      // Otherwise, it's a def
      
      if (form.value.length < 3) {
        errors.push(`'define' requires at least 2 arguments, got ${form.value.length - 1}`);
        return;
      }
      
      const name = form.value[1];
      if (name.type !== 'symbol') {
        errors.push(`'define' name must be a symbol, got ${name.type}`);
        return;
      }
      
      let checkIndex = 2;
      
      // Skip docstring if present
      if (form.value[checkIndex] && form.value[checkIndex].type === 'string') {
        checkIndex = 3;
        if (form.value.length <= checkIndex) {
          errors.push(`'define' with docstring requires additional arguments`);
          return;
        }
      }
      
      // Check if it's a defn (has parameter vector or multi-arity lists) or def (has value)
      const nextElement = form.value[checkIndex];
      if (nextElement && (nextElement.type === 'vector' || nextElement.type === 'list')) {
        // It's a defn - delegate to analyzeDefn
        this.analyzeDefn(form, context, errors, warnings);
      } else {
        // It's a def - delegate to analyzeDef
        this.analyzeDef(form, context, errors, warnings);
      }
    },
    
    analyzeDef(form, context, errors, warnings) {
      // Valid forms:
      // (def name value)
      // (def name "docstring" value)
      
      const opName = form.value[0].value; // 'def' or 'define'
      
      if (form.value.length < 3) {
        errors.push(`'${opName}' requires at least 2 arguments (name and value), got ${form.value.length - 1}`);
        return;
      }
      
      if (form.value.length > 4) {
        errors.push(`'${opName}' accepts at most 3 arguments (name, optional docstring, and value), got ${form.value.length - 1}`);
        return;
      }
      
      const name = form.value[1];
      if (name.type !== 'symbol') {
        errors.push(`'${opName}' name must be a symbol, got ${name.type}`);
        return;
      }
      
      // Check for docstring
      if (form.value.length === 4) {
        const docstring = form.value[2];
        if (docstring.type !== 'string') {
          errors.push(`'${opName}' docstring must be a string, got ${docstring.type}`);
          return;
        }
        // Analyze the value (4th element)
        this.analyzeForm(form.value[3], { ...context, isTopLevel: false, inDefinition: true }, errors, warnings);
      } else {
        // Analyze the value (3rd element)
        this.analyzeForm(form.value[2], { ...context, isTopLevel: false, inDefinition: true }, errors, warnings);
      }
    },
    
    analyzeDefn(form, context, errors, warnings) {
      // Valid forms:
      // (defn name [params] body...)
      // (defn name "docstring" [params] body...)
      // (defn name ([params1] body1...) ([params2] body2...) ...) - multi-arity
      // (defn name "docstring" ([params1] body1...) ([params2] body2...) ...) - multi-arity with docstring
      
      const opName = form.value[0].value; // 'defn' or 'define'
      
      if (form.value.length < 3) {
        errors.push(`'${opName}' requires at least 2 arguments (name and params/body), got ${form.value.length - 1}`);
        return;
      }
      
      const name = form.value[1];
      if (name.type !== 'symbol') {
        errors.push(`'${opName}' name must be a symbol, got ${name.type}`);
        return;
      }
      
      let bodyStart = 2;
      
      // Check for docstring
      if (form.value[2] && form.value[2].type === 'string') {
        bodyStart = 3;
        if (form.value.length < 4) {
          errors.push(`'${opName}' with docstring requires parameter vector or arity clauses`);
          return;
        }
      }
      
      // Check if multi-arity (next element is a list, not a vector)
      if (form.value[bodyStart] && form.value[bodyStart].type === 'list') {
        // Multi-arity function
        this.analyzeMultiArityDefn(form, bodyStart, context, errors, warnings);
      } else {
        // Single-arity function
        this.analyzeSingleArityDefn(form, bodyStart, context, errors, warnings);
      }
    },
    
    analyzeSingleArityDefn(form, bodyStart, context, errors, warnings) {
      const opName = form.value[0].value;
      const params = form.value[bodyStart];
      
      if (!params) {
        errors.push(`'${opName}' requires parameter vector`);
        return;
      }
      
      if (params.type !== 'vector') {
        errors.push(`'${opName}' parameter list must be a vector, got ${params.type}`);
        return;
      }
      
      // Collect parameter names
      const paramNames = new Set();
      for (const param of params.value) {
        if (param.type === 'symbol') {
          if (paramNames.has(param.value)) {
            errors.push(`Duplicate parameter name: ${param.value}`);
          }
          paramNames.add(param.value);
        } else if (param.value !== '&') { // & for rest params
          errors.push(`Parameter must be a symbol, got ${param.type}`);
        }
      }
      
      // Ensure there's at least one body expression
      if (form.value.length <= bodyStart + 1) {
        errors.push(`'${opName}' requires at least one body expression`);
        return;
      }
      
      // Analyze body with parameters in scope
      const newContext = {
        ...context,
        isTopLevel: false,
        inDefinition: true,
        boundVars: new Set([...context.boundVars, ...paramNames]),
        inLoop: false
      };
      
      for (let i = bodyStart + 1; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], newContext, errors, warnings);
      }
    },
    
    analyzeMultiArityDefn(form, bodyStart, context, errors, warnings) {
      const opName = form.value[0].value;
      const arities = new Set();
      
      // Each element from bodyStart onward should be an arity clause
      for (let i = bodyStart; i < form.value.length; i++) {
        const clause = form.value[i];
        
        if (clause.type !== 'list') {
          errors.push(`'${opName}' multi-arity clause must be a list, got ${clause.type}`);
          continue;
        }
        
        if (!clause.value || clause.value.length < 1) {
          errors.push(`'${opName}' arity clause must have at least a parameter vector`);
          continue;
        }
        
        const params = clause.value[0];
        if (params.type !== 'vector') {
          errors.push(`'${opName}' arity clause must start with a parameter vector, got ${params.type}`);
          continue;
        }
        
        // Check for duplicate arities
        const arity = params.value.length;
        if (arities.has(arity)) {
          errors.push(`'${opName}' has duplicate arity: ${arity} parameters`);
        }
        arities.add(arity);
        
        // Collect parameter names
        const paramNames = new Set();
        for (const param of params.value) {
          if (param.type === 'symbol') {
            if (paramNames.has(param.value)) {
              errors.push(`Duplicate parameter name in arity clause: ${param.value}`);
            }
            paramNames.add(param.value);
          } else if (param.value !== '&') {
            errors.push(`Parameter must be a symbol, got ${param.type}`);
          }
        }
        
        // Ensure there's at least one body expression
        if (clause.value.length < 2) {
          errors.push(`'${opName}' arity clause requires at least one body expression`);
          continue;
        }
        
        // Analyze body with parameters in scope
        const newContext = {
          ...context,
          isTopLevel: false,
          inDefinition: true,
          boundVars: new Set([...context.boundVars, ...paramNames]),
          inLoop: false
        };
        
        for (let j = 1; j < clause.value.length; j++) {
          this.analyzeForm(clause.value[j], newContext, errors, warnings);
        }
      }
    },
    
    analyzeLet(form, context, errors, warnings) {
      if (form.value.length < 2) {
        errors.push(`'let' requires at least a binding vector, got ${form.value.length - 1} arguments`);
        return;
      }
      
      const bindings = form.value[1];
      if (bindings.type !== 'vector') {
        errors.push(`'let' bindings must be a vector, got ${bindings.type}`);
        return;
      }
      
      if (bindings.value.length % 2 !== 0) {
        errors.push(`'let' bindings must have an even number of forms (pairs of name and value)`);
        return;
      }
      
      const boundNames = new Set(context.boundVars);
      
      // Analyze bindings
      for (let i = 0; i < bindings.value.length; i += 2) {
        const name = bindings.value[i];
        const value = bindings.value[i + 1];
        
        if (name.type !== 'symbol') {
          errors.push(`'let' binding name must be a symbol, got ${name.type}`);
          continue;
        }
        
        // Analyze the value expression with current bound vars
        this.analyzeForm(value, { ...context, boundVars: boundNames, isTopLevel: false }, errors, warnings);
        
        // Add this binding for subsequent bindings
        boundNames.add(name.value);
      }
      
      // Analyze body with all bindings in scope
      const bodyContext = {
        ...context,
        boundVars: boundNames,
        isTopLevel: false
      };
      
      for (let i = 2; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], bodyContext, errors, warnings);
      }
    },
    
    analyzeFn(form, context, errors, warnings) {
      if (form.value.length < 2) {
        errors.push(`'fn' requires at least a parameter vector, got ${form.value.length - 1} arguments`);
        return;
      }
      
      let bodyStart = 1;
      let fnName = null;
      
      // Check for optional function name
      if (form.value[1].type === 'symbol') {
        fnName = form.value[1].value;
        bodyStart = 2;
      }
      
      if (form.value.length <= bodyStart) {
        errors.push(`'fn' requires a parameter vector`);
        return;
      }
      
      const params = form.value[bodyStart];
      if (params.type !== 'vector') {
        errors.push(`'fn' parameter list must be a vector, got ${params.type}`);
        return;
      }
      
      // Collect parameter names
      const paramNames = new Set();
      if (fnName) paramNames.add(fnName);
      
      for (const param of params.value) {
        if (param.type === 'symbol') {
          if (paramNames.has(param.value)) {
            errors.push(`Duplicate parameter name: ${param.value}`);
          }
          paramNames.add(param.value);
        }
      }
      
      // Analyze body
      const newContext = {
        ...context,
        isTopLevel: false,
        boundVars: new Set([...context.boundVars, ...paramNames]),
        inLoop: true // fn creates an implicit loop point for recur
      };
      
      for (let i = bodyStart + 1; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], newContext, errors, warnings);
      }
    },
    
    analyzeAnonymousFunction(form, context, errors, warnings) {
      // #(...) anonymous function syntax
      const newContext = {
        ...context,
        isTopLevel: false,
        boundVars: new Set([...context.boundVars, '%', '%1', '%2', '%3', '%&']),
        inLoop: true
      };
      
      form.value.forEach(f => {
        this.analyzeForm(f, newContext, errors, warnings);
      });
    },
    
    analyzeIf(form, context, errors, warnings) {
      if (form.value.length < 3 || form.value.length > 4) {
        errors.push(`'if' requires 2 or 3 arguments (test, then, optional else), got ${form.value.length - 1}`);
        return;
      }
      
      for (let i = 1; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], { ...context, isTopLevel: false }, errors, warnings);
      }
    },
    
    analyzeDo(form, context, errors, warnings) {
      for (let i = 1; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], { ...context, isTopLevel: false }, errors, warnings);
      }
    },
    
    analyzeLoop(form, context, errors, warnings) {
      if (form.value.length < 2) {
        errors.push(`'loop' requires at least a binding vector, got ${form.value.length - 1} arguments`);
        return;
      }
      
      const bindings = form.value[1];
      if (bindings.type !== 'vector') {
        errors.push(`'loop' bindings must be a vector, got ${bindings.type}`);
        return;
      }
      
      if (bindings.value.length % 2 !== 0) {
        errors.push(`'loop' bindings must have an even number of forms`);
        return;
      }
      
      const boundNames = new Set(context.boundVars);
      
      // Analyze bindings
      for (let i = 0; i < bindings.value.length; i += 2) {
        const name = bindings.value[i];
        const value = bindings.value[i + 1];
        
        if (name.type !== 'symbol') {
          errors.push(`'loop' binding name must be a symbol, got ${name.type}`);
          continue;
        }
        
        this.analyzeForm(value, { ...context, boundVars: boundNames, isTopLevel: false }, errors, warnings);
        boundNames.add(name.value);
      }
      
      // Analyze body with loop context
      const bodyContext = {
        ...context,
        boundVars: boundNames,
        isTopLevel: false,
        inLoop: true
      };
      
      for (let i = 2; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], bodyContext, errors, warnings);
      }
    },
    
    analyzeRecur(form, context, errors, warnings) {
      if (!context.inLoop) {
        errors.push(`'recur' can only be used inside 'loop', 'fn', or 'defn'`);
      }
      
      // Analyze arguments
      for (let i = 1; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], { ...context, isTopLevel: false }, errors, warnings);
      }
    },
    
    analyzeFunctionCall(form, context, errors, warnings) {
      // Analyze function position
      this.analyzeForm(form.value[0], { ...context, isTopLevel: false }, errors, warnings);
      
      // Analyze all arguments
      for (let i = 1; i < form.value.length; i++) {
        this.analyzeForm(form.value[i], { ...context, isTopLevel: false }, errors, warnings);
      }
    },
    
    analyzeVector(form, context, errors, warnings) {
      form.value.forEach(v => {
        this.analyzeForm(v, { ...context, isTopLevel: false }, errors, warnings);
      });
    },
    
    analyzeMap(form, context, errors, warnings) {
      form.value.forEach(pair => {
        this.analyzeForm(pair.key, { ...context, isTopLevel: false }, errors, warnings);
        this.analyzeForm(pair.value, { ...context, isTopLevel: false }, errors, warnings);
      });
    },
    
    analyzeSet(form, context, errors, warnings) {
      const values = new Set();
      form.value.forEach(v => {
        const key = JSON.stringify(v);
        if (values.has(key)) {
          warnings.push(`Duplicate value in set: ${v.value || v.type}`);
        }
        values.add(key);
        this.analyzeForm(v, { ...context, isTopLevel: false }, errors, warnings);
      });
    },
    
    analyzeSymbol(form, context, errors, warnings) {
      // Check for common typos or undefined vars (very basic check)
      const name = form.value;
      
      // Skip special symbols
      if (name === '&' || name.startsWith('%')) {
        return;
      }
      
      // Determine symbol classification and mark it in the AST
      if (context.boundVars.has(name)) {
        // Locally defined (parameter, let binding, etc.)
        form.symbolType = 'local';
        if (context.symbolInfo) {
          context.symbolInfo.locallyDefined.add(name);
        }
      } else if (this.isBuiltIn(name)) {
        // Built-in function or special form
        form.symbolType = 'builtin';
        if (context.symbolInfo) {
          context.symbolInfo.builtIns.add(name);
        }
      } else {
        // Unknown - possibly user-defined or undefined
        form.symbolType = 'unknown';
        if (context.symbolInfo) {
          context.symbolInfo.unknowns.add(name);
        }
        // This is just a warning since we don't have full context
        // warnings.push(`Possibly undefined var: ${name}`);
      }
    },
    
    isBuiltIn(name) {
      //FIXME: This should use keyword list from SemanticInterpreter.cs

      // Common Clojure built-ins
      const builtins = new Set([
        '+', '-', '*', '/', '=', '<', '>', '<=', '>=',
        'not', 'and', 'or',
        'cons', 'conj', 'first', 'rest', 'list', 'vector', 'hash-map', 'hash-set',
        'println', 'print', 'pr', 'prn', 'str',
        'map', 'reduce', 'filter', 'remove', 'take', 'drop',
        'inc', 'dec', 'count', 'empty?', 'nil?', 'some?',
        'get', 'assoc', 'dissoc', 'update', 'keys', 'vals',
        'atom', 'swap!', 'reset!', 'deref',
        'throw', 'try', 'catch', 'finally',
        'ns', 'require', 'import', 'use'
      ]);
      
      return builtins.has(name);
    }
  };