(ns babble.utils
  "Utility functions for Babble ClojureScript")

(defn ^:export format-code
  "Formats Babble code for display"
  [code]
  (-> code
      str/trim
      (str/replace #"\s+" " ")))

(defn ^:export parse-ast
  "Helper to work with AST structures"
  [ast-json]
  (js->clj (js/JSON.parse ast-json) :keywordize-keys true))

(defn ^:export ast-to-json
  "Convert ClojureScript data back to JSON"
  [data]
  (js/JSON.stringify (clj->js data)))

(defn ^:export deep-merge
  "Recursively merges maps"
  [& maps]
  (apply merge-with
         (fn [x y]
           (if (and (map? x) (map? y))
             (deep-merge x y)
             y))
         maps))
