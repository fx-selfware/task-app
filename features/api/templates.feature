Feature: Templates API

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists

  Scenario: Create template
    When I POST "/api/templates" with body '{"name":"Sprint Template"}' with my cookie
    Then the status is 201
    And the response body has template.name "Sprint Template"

  Scenario: Get templates returns only own templates
    Given I have a template named "Alice Template"
    And user "bob@example.com" has a template named "Bob Template"
    When I GET "/api/templates" with my cookie
    Then the status is 200
    And there is 1 template named "Alice Template"

  Scenario: Owner gets template with tasks
    Given I have a template named "My Template"
    And I add a template task "Task A" to that template
    When I GET that template
    Then the status is 200
    And the template has 1 task named "Task A"

  Scenario: Non-owner gets 404 for template
    Given I have a template named "Alice Template"
    When user "bob@example.com" GETs that template
    Then the status is 404

  Scenario: Owner can rename and delete template
    Given I have a template named "Old Name"
    When I PATCH that template with body '{"name":"New Name"}'
    Then the status is 200
    And the response body has template.name "New Name"
    When I DELETE that template
    Then the status is 204

  Scenario: Template task CRUD
    Given I have a template named "My Template"
    When I POST a template task "Task A" with description "Do this"
    Then the status is 201
    When I PATCH that template task with body '{"title":"Updated Task A"}'
    Then the status is 200
    And the template task has title "Updated Task A"

  # Same as the task endpoint: nothing to apply is a 400, not a database error.
  Scenario: A template task update with no fields is rejected rather than failing
    Given I have a template named "My Template"
    When I POST a template task "Task A" with description "Do this"
    And I PATCH that template task with body '{}'
    Then the status is 400
    And the response body has error "no fields to update"
    When I DELETE that template task
    Then the status is 204

  Scenario: Reorder template tasks
    Given I have a template named "My Template" with tasks "Task 1", "Task 2" and "Task 3"
    When I PUT reorder template tasks with reverse order
    Then the status is 200
    And the template tasks are in reverse order

  Scenario: READ-permission user cannot reorder template tasks
    Given I have a template named "Shared Template"
    And I add a template task "Task A" to that template
    And I add a template task "Task B" to that template
    And I have shared that template with "bob@example.com" as READ
    When user "bob@example.com" PUTs reorder on that template
    Then the status is 404

  Scenario: Apply template to list appends tasks
    Given I have a template named "Sprint" with tasks "Task 1" and "Task 2"
    And I own a task list named "My List"
    And that list has a task "Pre-existing"
    When I apply that template to that list
    Then the status is 201
    And 2 tasks are returned
    And the first applied task has order 1
    And the list has 3 total tasks

  # --- Subtask scenarios ---

  Scenario: Create template subtask
    Given I have a template named "My Template"
    And I add a template task "Parent" to that template
    When I POST a template subtask "Sub 1" under "Parent"
    Then the status is 201
    And the template subtask has title "Sub 1"

  Scenario: Cannot create template subtask under a subtask
    Given I have a template named "My Template"
    And I add a template task "Parent" to that template
    And I add a template subtask "Sub 1" under "Parent"
    When I POST a template subtask "Nested" under "Sub 1"
    Then the status is 400

  # --- Move template task scenarios ---

  Scenario: Promote template subtask to top-level
    Given I have a template named "My Template"
    And I add a template task "Task A" to that template
    And I add a template task "Task B" to that template
    And I add a template task "Task C" to that template
    And I add a template subtask "Sub 1" under "Task B"
    When I move template task "Sub 1" to top-level
    Then the status is 200
    And the template top-level order is "Task A", "Task B", "Sub 1", "Task C"

  Scenario: Demote template top-level task to subtask
    Given I have a template named "My Template"
    And I add a template task "Task A" to that template
    And I add a template task "Task B" to that template
    When I move template task "Task B" under "Task A"
    Then the status is 200
    And template task "Task B" is a subtask of "Task A"

  Scenario: Cannot demote template task that has subtasks
    Given I have a template named "My Template"
    And I add a template task "Parent" to that template
    And I add a template subtask "Sub" under "Parent"
    And I add a template task "Other" to that template
    When I move template task "Parent" under "Other"
    Then the status is 400

  Scenario: Apply template preserves subtask hierarchy
    Given I have a template named "Hierarchy Template"
    And I add a template task "Parent" to that template
    And I add a template subtask "Sub 1" under "Parent"
    And I add a template subtask "Sub 2" under "Parent"
    And I own a task list named "Target List"
    When I apply that template to that list
    Then the status is 201
    And 3 tasks are returned
    And the list task "Parent" has 2 subtasks
