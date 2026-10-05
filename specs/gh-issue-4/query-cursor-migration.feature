Feature: Per-query pagination cursors for LocalStorageDataSource
  As an application using entropic-bond-local-storage
  I want each query to own its pagination cursor
  So that interleaved find/next calls on a single LocalStorage data source do not mix result sets

  Background:
    Given a LocalStorageDataSource is the active data source
    And a collection containing ordered documents "user1" to "user6"

  Scenario: Find returns a cursor that pages the matching documents. Issue: #4 [REQ-1]
    Given a LocalStorage data source with six ordered documents
    When the data source finds documents with a limit of 2
    Then the cursor retrieves documents "user1" and "user2"
    And the cursor retrieves documents "user3" and "user4" on the next call

  Scenario: Find without a query returns a cursor over every document. Issue: #4 [REQ-2]
    Given a LocalStorage data source with six ordered documents
    When the data source finds without a query
    Then the cursor retrieves all six documents

  Scenario: Continue a model's own query with next. Issue: #4 [REQ-3]
    Given a model for the document collection
    When the model finds the first 2 documents
    And the model requests the next page
    Then the model receives documents "user3" and "user4"

  Scenario: Interleaved pagination on two models of one collection keeps each result set. Issue: #4 [REQ-4]
    Given two models for the document collection
    When the first model finds the first 2 documents
    And the second model finds the first 3 documents
    And the first model requests the next page
    And the second model requests the next page
    Then the first model receives documents "user3" and "user4"
    And the second model receives documents "user4", "user5" and "user6"

  Scenario: Interleaved pagination across collections does not mix result sets. Issue: #4 [REQ-5]
    Given a model for the document collection
    And a model for a different document collection
    When the first model finds the first 2 documents
    And the second model finds the first document
    And the first model requests the next page
    Then the first model receives documents "user3" and "user4"

  Scenario: Re-running a query resets pagination for that model only. Issue: #4 [REQ-6]
    Given two models for the document collection
    When the first model finds the first 2 documents
    And the second model finds the first 2 documents
    And the first model finds all documents
    And the second model requests the next page
    Then the second model receives documents "user3" and "user4"
