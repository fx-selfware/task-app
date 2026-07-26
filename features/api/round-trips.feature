Feature: Database round trips

  Every statement is a network round trip to Turso in production, so response
  time is set by how many an endpoint issues, not by how much data it moves.
  These budgets are the contract: exceeding one means an N+1, an unbatched
  read, or an interactive transaction crept back in. Counts come from the
  x-db-round-trips header (see lib/dbMetrics.ts).

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists

  Scenario: Listing task lists costs the same whether you have 1 or 20
    Given I own 20 task lists each with 3 tasks
    When I GET "/api/task-lists" with my cookie
    Then the status is 200
    And the request used at most 1 database round trip

  Scenario: Reading a list with its tasks, shares and members
    Given I own a task list named "Detail List"
    And I have a task "Task A" in that list
    And I share that task list with "bob@example.com" as WRITE
    When I GET that task list with my cookie
    Then the status is 200
    And the request used at most 2 database round trips

  Scenario: Creating a task
    Given I own a task list named "Write List"
    When I POST a task titled "New Task" to that list
    Then the status is 201
    And the request used at most 2 database round trips

  Scenario: Completing a parent task cascades to its subtasks in one write
    Given I own a task list named "Cascade List"
    And I have a task "Parent" in that list
    And I have a subtask "Child" under "Parent" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Parent"
    Then the status is 200
    And the request used at most 2 database round trips

  Scenario: Reordering tasks
    Given I own a task list named "Order List"
    And I have tasks "One", "Two", "Three" in that list
    When I PUT reorder with reverse order
    Then the status is 200
    And the request used at most 2 database round trips

  Scenario: Deleting completed tasks
    Given I own a task list named "Cleanup List"
    And I have a task "Done One" in that list
    And I have a task "Done Two" in that list
    When I DELETE completed tasks from that list
    Then the status is 204
    And the request used at most 2 database round trips

  Scenario: Listing templates costs the same whether you have 1 or 20
    Given I own 20 templates each with 3 tasks
    When I GET "/api/templates" with my cookie
    Then the status is 200
    And the request used at most 1 database round trip

  Scenario: Reading a template with its tasks
    Given I have a template named "Detail Template"
    And I add a template task "Step 1" to that template
    When I GET that template
    Then the status is 200
    And the request used at most 1 database round trip

  Scenario: Applying a template writes every task in one batch
    Given I have a template named "Apply Template"
    And I add a template task "Step 1" to that template
    And I add a template subtask "Step 1a" under "Step 1"
    And I add a template task "Step 2" to that template
    And I own a task list named "Target List"
    When I apply that template to that list
    Then the status is 201
    And the request used at most 2 database round trips
