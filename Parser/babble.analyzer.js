babble.analyzer = {
    analyze(ast) {
      const errors = [];
      const warnings = [];
      
      // Analyze each top-level form
      if (Array.isArray(ast)) {
        ast.forEach((form, idx) => {
          this.analyzeForm(form, { 
            isTopLevel: true, 
            inDefinition: false,
            boundVars: new Set(),
            formIndex: idx 
          }, errors, warnings);
        });
      } else {
        this.analyzeForm(ast, { 
          isTopLevel: true, 
          inDefinition: false,
          boundVars: new Set(),
          formIndex: 0 
        }, errors, warnings);
      }
      
      if (errors.length > 0) {
        return {
          status: 'error',
          message: errors.join('\n'),
          errors: errors,
          warnings: warnings,
          ast: ast
        };
      }
      
      if (warnings.length > 0) {
        return {
          status: 'warning',
          message: warnings.join('\n'),
          errors: [],
          warnings: warnings,
          ast: ast
        };
      }
      
      return {
        status: 'success',
        message: 'Analysis completed successfully',
        errors: [],
        warnings: [],
        ast: ast
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
          this.analyzeForm(form.value, context, errors, warnings);
          break;
          
        case 'with-meta':
          this.analyzeForm(form.meta, context, errors, warnings);
          this.analyzeForm(form.value, context, errors, warnings);
          break;
          
        case 'anonymous-function':
          this.analyzeAnonymousFunction(form, context, errors, warnings);
          break;
          
        case 'symbol':
          this.analyzeSymbol(form, context, errors, warnings);
          break;
          
        case 'tagged-literal':
          this.analyzeForm(form.value, context, errors, warnings);
          break;
          
        // Literals don't need semantic analysis
        case 'number':
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
        
        // Check for def/defn at non-top-level
        if ((op === 'def' || op === 'defn') && !context.isTopLevel) {
          errors.push(`'${op}' can only be used at the top level, not inside other forms`);
          return;
        }
        
        switch (op) {
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
    
    analyzeDef(form, context, errors, warnings) {
      if (form.value.length < 2 || form.value.length > 3) {
        errors.push(`'def' requires 1 or 2 arguments (name and optional init), got ${form.value.length - 1}`);
        return;
      }
      
      const name = form.value[1];
      if (name.type !== 'symbol') {
        errors.push(`'def' name must be a symbol, got ${name.type}`);
        return;
      }
      
      if (form.value.length === 3) {
        this.analyzeForm(form.value[2], { ...context, isTopLevel: false, inDefinition: true }, errors, warnings);
      }
    },
    
    analyzeDefn(form, context, errors, warnings) {
      if (form.value.length < 3) {
        errors.push(`'defn' requires at least 2 arguments (name and params), got ${form.value.length - 1}`);
        return;
      }
      
      const name = form.value[1];
      if (name.type !== 'symbol') {
        errors.push(`'defn' name must be a symbol, got ${name.type}`);
        return;
      }
      
      let bodyStart = 2;
      
      // Check for docstring
      if (form.value[2].type === 'string') {
        bodyStart = 3;
        if (form.value.length < 4) {
          errors.push(`'defn' with docstring requires parameter vector`);
          return;
        }
      }
      
      // Check for metadata map
      if (form.value[bodyStart].type === 'map') {
        bodyStart++;
        if (form.value.length <= bodyStart) {
          errors.push(`'defn' with metadata requires parameter vector`);
          return;
        }
      }
      
      const params = form.value[bodyStart];
      if (params.type !== 'vector') {
        errors.push(`'defn' parameter list must be a vector, got ${params.type}`);
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
        } else if (param.type !== 'keyword') { // & rest-params use keywords sometimes
          errors.push(`Parameter must be a symbol, got ${param.type}`);
        }
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
      
      // This is a simplified check - a real analyzer would have a symbol table
      if (!context.boundVars.has(name) && !this.isBuiltIn(name)) {
        // This is just a warning since we don't have full context
        // warnings.push(`Possibly undefined var: ${name}`);
      }
    },
    
    isBuiltIn(name) {
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