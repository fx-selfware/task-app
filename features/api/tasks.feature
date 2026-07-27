Feature: Tasks API

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists
    And I own a task list named "Test List"

  Scenario: Create task with correct order
    When I POST a task with title "Task 1" to that list
    Then the status is 201
    And the task has title "Task 1" and order 0 and status "TODO"
    When I POST a task with title "Task 2" to that list
    Then the new task has order 1

  Scenario: Owner can update task
    Given I have a task "Task 1" in that list
    When I PATCH that task with body '{"status":"DONE","title":"Updated"}'
    Then the status is 200
    And the task has status "DONE" and title "Updated"

  # An update carrying nothing to apply is the client's mistake, and every other
  # endpoint already says so with a 400. These used to reach the database with
  # an empty SET and come back as a 500 with a stack trace in the server log —
  # which is what a write cut off in transit looks like on a phone that loses
  # signal mid-request, so it charged real 500s against a client-side problem.
  Scenario: An update with no fields is rejected rather than failing
    Given I have a task "Task 1" in that list
    When I PATCH that task with body '{}'
    Then the status is 400
    And the response body has error "no fields to update"

  Scenario: An update naming only unknown fields is rejected rather than failing
    Given I have a task "Task 1" in that list
    When I PATCH that task with body '{"colour":"red"}'
    Then the status is 400
    And the response body has error "no fields to update"

  Scenario: An update whose body was cut off in transit is rejected rather than failing
    Given I have a task "Task 1" in that list
    When I PATCH that task with a body that was cut off in transit
    Then the status is 400
    And the response body has error "invalid JSON body"

  Scenario: Owner can delete task
    Given I have a task "Task 1" in that list
    When I DELETE that task with my cookie
    Then the status is 204

  Scenario: Reorder tasks
    Given I have tasks "Task 1", "Task 2", "Task 3" in that list
    When I PUT reorder with reverse order
    Then the status is 200
    And the list tasks are in reverse order

  Scenario: READ-permission user cannot write tasks
    Given "bob@example.com" has READ access to that list
    When user "bob@example.com" POSTs a task "Sneaky Task" to that list
    Then the status is 403
    When user "bob@example.com" PUTs reorder on that list
    Then the status is 403

  Scenario: Owner can delete all completed tasks
    Given I have a task "Done Task" in that list
    And I have a task "Todo Task" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Done Task"
    When I DELETE completed tasks from that list
    Then the status is 204
    And the list contains only "Todo Task"

  # --- Subtask scenarios ---

  Scenario: Create subtask under a parent
    Given I have a task "Parent Task" in that list
    When I POST a subtask with title "Subtask 1" under "Parent Task"
    Then the status is 201
    And the subtask has title "Subtask 1" and order 0

  Scenario: Cannot create subtask under a subtask
    Given I have a task "Parent Task" in that list
    And I have a subtask "Sub 1" under "Parent Task" in that list
    When I POST a subtask with title "Nested" under "Sub 1"
    Then the status is 400

  Scenario: Completing a parent auto-completes subtasks
    Given I have a task "Parent Task" in that list
    And I have a subtask "Sub A" under "Parent Task" in that list
    And I have a subtask "Sub B" under "Parent Task" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Parent Task"
    Then the status is 200
    And all subtasks of "Parent Task" have status "DONE"

  Scenario: Completing a subtask does not complete the parent
    Given I have a task "Parent Task" in that list
    And I have a subtask "Sub A" under "Parent Task" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Sub A"
    Then the status is 200
    And task "Parent Task" still has status "TODO"

  Scenario: Un-completing a subtask also un-completes its parent
    Given I have a task "Parent Task" in that list
    And I have a subtask "Sub A" under "Parent Task" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Parent Task"
    Then all subtasks of "Parent Task" have status "DONE"
    When I PATCH that task with body '{"status":"TODO"}' for "Sub A"
    Then the status is 200
    And task "Parent Task" still has status "TODO"
    And task "Sub A" still has status "TODO"

  Scenario: Deleting parent cascades to subtasks
    Given I have a task "Parent Task" in that list
    And I have a subtask "Sub A" under "Parent Task" in that list
    When I DELETE task "Parent Task" from that list
    Then the status is 204
    And the list has 0 tasks

  Scenario: Reorder subtasks within parent
    Given I have a task "Parent" in that list
    And I have subtasks "Sub A", "Sub B", "Sub C" under "Parent" in that list
    When I PUT reorder subtasks under "Parent" with reverse order
    Then the status is 200
    And the subtasks of "Parent" are in reverse order

  Scenario: Cannot add subtask to a completed parent
    Given I have a task "Parent" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Parent"
    And I POST a subtask with title "New Sub" under "Parent"
    Then the status is 400

  Scenario: Delete completed subtasks of a parent
    Given I have a task "Parent" in that list
    And I have a subtask "Done Sub" under "Parent" in that list
    And I have a subtask "Todo Sub" under "Parent" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Done Sub"
    And I DELETE completed subtasks of "Parent" from that list
    Then the status is 204
    And task "Parent" has 1 subtask

  # --- Move task scenarios ---

  Scenario: Promote subtask to top-level (placed after former parent)
    Given I have tasks "Task A", "Task B", "Task C" in that list
    And I have a subtask "Sub 1" under "Task B" in that list
    When I move task "Sub 1" to top-level in that list
    Then the status is 200
    And the top-level task order is "Task A", "Task B", "Sub 1", "Task C"

  Scenario: Demote top-level task to subtask (placed as last subtask)
    Given I have a task "Task A" in that list
    And I have a subtask "Sub X" under "Task A" in that list
    And I have a task "Task B" in that list
    When I move task "Task B" under "Task A" in that list
    Then the status is 200
    And task "Task B" is a subtask of "Task A"

  Scenario: Cannot demote a task that has subtasks
    Given I have a task "Parent" in that list
    And I have a subtask "Sub" under "Parent" in that list
    And I have a task "Other" in that list
    When I move task "Parent" under "Other" in that list
    Then the status is 400

  Scenario: Cannot move a completed task
    Given I have a task "Done Task" in that list
    And I have a task "Other" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Done Task"
    And I move task "Done Task" under "Other" in that list
    Then the status is 400

  Scenario: Cannot demote under a completed parent
    Given I have a task "Parent" in that list
    And I have a task "Orphan" in that list
    When I PATCH that task with body '{"status":"DONE"}' for "Parent"
    And I move task "Orphan" under "Parent" in that list
    Then the status is 400

  Scenario: A client-supplied id is used as the task id
    Given I own a task list named "Id List"
    When I POST a task titled "Chosen" with id "abcdefghij0123456789"
    Then the status is 201
    And the created task has id "abcdefghij0123456789"

  Scenario: A malformed client id is ignored rather than rejected
    Given I own a task list named "Id List"
    When I POST a task titled "Server Id" with id "../../etc/passwd"
    Then the status is 201
    And the created task has a server-generated id

  Scenario: A client id already in use falls back to a server-generated one
    Given I own a task list named "Id List"
    And I have a task "First" in that list
    When I POST a task titled "Second" reusing the id of "First"
    Then the status is 201
    And the created task has a server-generated id

  Scenario: An unknown status is rejected
    Given I own a task list named "Status List"
    And I have a task "Solid" in that list
    When I PATCH that task with body '{"status":"PWNED"}'
    Then the status is 400

  Scenario: Deleting completed tasks removes a completed parent and its subtasks
    Given I own a task list named "Cleanup List"
    And I have a task "Parent" in that list
    And I have a subtask "Child" under "Parent" in that list
    And I have a task "Survivor" in that list
    And I PATCH that task with body '{"status":"DONE"}' for "Parent"
    When I DELETE completed tasks from that list
    Then the status is 204
    And the list contains only "Survivor"
