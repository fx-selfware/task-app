Feature: Task Lists

  Background:
    Given I am logged in as a new user

  @ac
  Scenario: A user can create a new task list and see it in the sidebar
    When I create a task list named "Shopping"
    Then "Shopping" appears in the sidebar

  @ac
  Scenario: A user can edit a task's title and description
    Given I have a task list named "My List"
    When I open the task list "My List"
    And I add a task named "Buy milk"
    And I edit the task "Buy milk" to have title "Buy oat milk" and description "From the oat aisle"
    Then "Buy oat milk" is visible in the task list
    And "Buy milk" is no longer visible in the task list
    And "From the oat aisle" is visible in the task list

  @ac
  Scenario: A user can share a task list by email and see who has access
    Given I have a task list named "Work"
    And a collaborator exists with email "collab@example.com"
    When I open the share modal for "Work"
    And I invite "collab@example.com" with "Read" permission
    Then "collab@example.com" is listed in the share modal with "Read" access

  @ac
  Scenario: A user can complete tasks, uncheck them, and delete all completed tasks
    Given I have a task list named "Todo App"
    When I open the task list "Todo App"
    And I add a task named "Task A"
    And I add a task named "Task B"
    And I check the checkbox for "Task A"
    Then the completed section shows 1 completed task
    And "Task A" is no longer visible in the task list
    When I expand the completed section
    And I uncheck the checkbox for "Task A"
    Then "Task A" is visible in the task list
    And the completed section is not visible
    When I check the checkbox for "Task A"
    And I check the checkbox for "Task B"
    And I expand the completed section
    Then "Task A" appears with strikethrough styling
    And I click "Delete completed"
    And I confirm the deletion
    Then the completed section is not visible

  @ac
  Scenario: Shared list updates in real-time when another user adds a task
    Given I have a task list named "Realtime List"
    And a collaborator exists with email "rt@example.com"
    When I open the share modal for "Realtime List"
    And I invite "rt@example.com" with "Write" permission
    And I close the dialog
    And the collaborator "rt@example.com" opens the task list "Realtime List"
    And I add a task named "Live Update Task"
    Then the collaborator sees "Live Update Task" without refreshing

  @ac
  Scenario: A user can add a subtask to a task
    Given I have a task list named "Subtask List"
    When I open the task list "Subtask List"
    And I add a task named "Parent Task"
    And I add a subtask named "Child Task" to "Parent Task"
    Then "Child Task" is visible in the task list

  Scenario: Completing a parent task completes its subtasks and unchecking a subtask reopens the parent
    Given I have a task list named "Cascade List"
    When I open the task list "Cascade List"
    And I add a task named "Parent"
    And I add a subtask named "Sub1" to "Parent"
    And I check the checkbox for "Parent"
    Then the completed section shows 2 completed tasks
    When I expand the completed section
    And I uncheck the checkbox for "Sub1"
    Then "Parent" is visible in the task list
    And "Sub1" is visible in the task list

  Scenario: Subtasks are collapsible
    Given I have a task list named "Collapse List"
    When I open the task list "Collapse List"
    And I add a task named "Parent"
    And I add a subtask named "Sub1" to "Parent"
    And I collapse the subtasks of "Parent"
    Then "Sub1" is no longer visible in the task list
    When I expand the subtasks of "Parent"
    Then "Sub1" is visible in the task list

  Scenario: All subtasks are hidden while dragging a parent task
    Given I have a task list named "Drag Hide List"
    When I open the task list "Drag Hide List"
    And I add a task named "First"
    And I add a subtask named "Sub1" to "First"
    And I add a task named "Second"
    And I add a subtask named "Sub2" to "Second"
    Then "Sub1" is visible in the task list
    And "Sub2" is visible in the task list
    When I start dragging "First"
    Then "Sub1" is no longer visible in the task list
    And "Sub2" is no longer visible in the task list
    When I release the drag
    Then "Sub1" is visible in the task list
    And "Sub2" is visible in the task list

  Scenario: The app displays a build version in the sidebar
    Then the sidebar shows a real build hash
