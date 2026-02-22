Feature: Tasks API

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists
    And I own a task list named "Test List"

  Scenario: AC-T1 Create task with correct order
    When I POST a task with title "Task 1" to that list
    Then the status is 201
    And the task has title "Task 1" and order 0 and status "TODO"
    When I POST a task with title "Task 2" to that list
    Then the new task has order 1

  Scenario: AC-T2 Owner can update task
    Given I have a task "Task 1" in that list
    When I PATCH that task with body '{"status":"IN_PROGRESS","title":"Updated"}'
    Then the status is 200
    And the task has status "IN_PROGRESS" and title "Updated"

  Scenario: AC-T3 Owner can delete task
    Given I have a task "Task 1" in that list
    When I DELETE that task with my cookie
    Then the status is 204

  Scenario: AC-T4 Reorder tasks
    Given I have tasks "Task 1", "Task 2", "Task 3" in that list
    When I PUT reorder with reverse order
    Then the status is 200
    And the list tasks are in reverse order

  Scenario: AC-T5 READ-permission user cannot write tasks
    Given "bob@example.com" has READ access to that list
    When user "bob@example.com" POSTs a task "Sneaky Task" to that list
    Then the status is 403
    When user "bob@example.com" PUTs reorder on that list
    Then the status is 403
