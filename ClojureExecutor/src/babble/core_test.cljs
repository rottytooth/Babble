(ns babble.core-test
  (:require [cljs.test :refer-macros [deftest is testing run-tests]]
            [babble.core :as core]))

(deftest test-eval-clojure
  (testing "Basic arithmetic evaluation"
    (let [result (core/eval-clojure "(+ 1 2 3)")]
      (is (.-success result))
      (is (= 6 (.-result result)))
      (is (nil? (.-error result)))))

  (testing "Map function evaluation"
    (let [result (core/eval-clojure "(map inc [1 2 3])")]
      (is (.-success result))
      (is (= [2 3 4] (js->clj (.-result result))))))

  (testing "Invalid code returns error"
    (let [result (core/eval-clojure "invalid syntax here")]
      (is (not (.-success result)))
      (is (some? (.-error result)))))

  (testing "Complex expression"
    (let [result (core/eval-clojure "(reduce + (range 1 11))")]
      (is (.-success result))
      (is (= 55 (.-result result))))))

(deftest test-eval-clojure-safe
  (testing "Safe evaluation of valid code"
    (let [result (core/eval-clojure-safe "(* 6 7)")]
      (is (.-success result))
      (is (= 42 (.-result result)))))

  (testing "Safe evaluation never throws"
    (let [result (core/eval-clojure-safe "completely invalid")]
      (is (not (.-success result)))
      (is (some? (.-error result))))))

(deftest test-read-clojure
  (testing "Reading simple EDN map"
    (let [result (core/read-clojure "{:name \"Alice\" :age 30}")]
      (is (.-success result))
      (let [data (js->clj (.-result result) :keywordize-keys true)]
        (is (= "Alice" (:name data)))
        (is (= 30 (:age data))))))

  (testing "Reading EDN vector"
    (let [result (core/read-clojure "[1 2 3 4 5]")]
      (is (.-success result))
      (is (= [1 2 3 4 5] (js->clj (.-result result))))))

  (testing "Reading invalid EDN returns error"
    (let [result (core/read-clojure "{invalid edn")]
      (is (not (.-success result)))
      (is (some? (.-error result)))))

  (testing "Reading nested structures"
    (let [result (core/read-clojure "{:users [{:name \"Bob\"} {:name \"Carol\"}]}")]
      (is (.-success result)))))

(deftest test-basic-functions
  (testing "Greet function"
    (is (= "Hello from ClojureScript, World!" (core/greet "World"))))

  (testing "Add function"
    (is (= 5 (core/add 2 3)))
    (is (= 100 (core/add 42 58))))

  (testing "Multiply function"
    (is (= 6 (core/multiply 2 3)))
    (is (= 50 (core/multiply 10 5)))))

;; Run all tests
(defn ^:export run-all-tests []
  (run-tests 'babble.core-test))
