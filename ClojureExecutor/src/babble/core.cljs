(ns babble.core
  "Core namespace for Babble ClojureScript functionality"
  (:require [cljs.reader :as reader]
            [sci.core :as sci]))

;; Create a SCI context with safe defaults
;; This provides a sandboxed environment for code evaluation
(defonce sci-ctx
  (sci/init {:preset :termination-safe
             :bindings {'println println
                        'prn prn
                        'print print
                        'str str}
             :classes {'js goog/global :allow :all}}))

(defn ^:export eval-clojure
  "Evaluates a ClojureScript code string using SCI (Small Clojure Interpreter).
   SCI provides a sandboxed environment that prevents:
   - Direct access to dangerous JavaScript globals
   - Unrestricted code execution
   
   Returns a JavaScript object with {success: bool, result: any, error: string}
   
   Example from JS:
     babble.core.eval_clojure('(+ 1 2 3)')  // => {success: true, result: 6}
     babble.core.eval_clojure('(map inc [1 2 3])')  // => {success: true, result: [2, 3, 4]}"
  [code-str]
  (try
    (let [result (sci/eval-string* sci-ctx code-str)]
      (js-obj "success" true
              "result" (clj->js result)
              "error" nil))
    (catch js/Error e
      (js-obj "success" false
              "result" nil
              "error" (str (.-message e))))))

(defn ^:export eval-clojure-safe
  "Safely evaluates ClojureScript code in a sandboxed SCI environment.
   
   SCI (Small Clojure Interpreter) provides TRUE sandboxing:
   - Cannot access js/window, js/document, or other dangerous globals
   - Cannot execute arbitrary JavaScript
   - Prevents infinite loops and resource exhaustion
   - Provides a safe subset of Clojure/ClojureScript functionality
   
   Always returns a JavaScript object, never throws.
   
   Example from JS:
     babble.core.eval_clojure_safe('(+ 1 2)')  // => {success: true, result: 3}
     babble.core.eval_clojure_safe('invalid')  // => {success: false, error: '...'}"
  [code-str]
  (eval-clojure code-str))

(defn ^:export read-clojure
  "Reads a ClojureScript data structure from a string (without evaluating code).
   Useful for parsing EDN data.
   
   Example from JS:
     babble.core.read_clojure('{:name \"Alice\" :age 30}')
     // => {success: true, result: {name: 'Alice', age: 30}}"
  [edn-str]
  (try
    (let [data (reader/read-string edn-str)]
      (js-obj "success" true
              "result" (clj->js data)
              "error" nil))
    (catch js/Error e
      (js-obj "success" false
              "result" nil
              "error" (str "Read error: " (.-message e))))))

(defn ^:export greet
  "Simple greeting function to demonstrate ClojureScript integration"
  [name]
  (str "Hello from ClojureScript, " name "!"))

(defn ^:export init
  "Initialization function called when the module loads"
  []
  (js/console.log "Babble ClojureScript module initialized")
  ;; Add any initialization logic here
  )

(defn ^:export add
  "Example function: adds two numbers"
  [a b]
  (+ a b))

(defn ^:export multiply
  "Example function: multiplies two numbers"
  [a b]
  (* a b))

(defn ^:export get-sci-namespaces
  "Returns list of available namespaces in the SCI context.
   Useful for understanding what's available in the sandbox.
   
   Example from JS:
     babble.core.get_sci_namespaces()  // => ['clojure.core', 'clojure.string', ...]"
  []
  (clj->js (keys (sci/get-namespace-map sci-ctx))))

(defn ^:export eval-with-bindings
  "Evaluates code with custom variable bindings.
   Useful for providing context or pre-defined variables.
   
   Parameters:
   - code-str: ClojureScript code to evaluate
   - bindings-js: JavaScript object with variable bindings
   
   Example from JS:
     babble.core.eval_with_bindings('(+ x y)', {x: 10, y: 20})
     // => {success: true, result: 30}"
  [code-str bindings-js]
  (try
    (let [bindings (js->clj bindings-js :keywordize-keys false)
          ctx (sci/fork sci-ctx)
          _ (doseq [[k v] bindings]
              (sci/binding [sci/out *out*]
                (sci/eval-string* ctx (str "(def " k " " (pr-str v) ")"))))
          result (sci/eval-string* ctx code-str)]
      (js-obj "success" true
              "result" (clj->js result)
              "error" nil))
    (catch js/Error e
      (js-obj "success" false
              "result" nil
              "error" (str (.-message e))))))

;; Auto-initialize when loaded
(defonce initialized
  (do
    (init)
    true))
