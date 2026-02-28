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
    And I click "Delete completed"
    Then the completed section is not visible

  Scenario: Completed section is collapsed by default
    Given I have a task list named "Todo App"
    When I open the task list "Todo App"
    And I add a task named "Task A"
    And I check the checkbox for "Task A"
    Then the completed section header is visible but tasks are hidden

  Scenario: Completed tasks show with strikethrough
    Given I have a task list named "Todo App"
    When I open the task list "Todo App"
    And I add a task named "Task A"
    And I check the checkbox for "Task A"
    And I expand the completed section
    Then "Task A" appears with strikethrough styling

  Scenario: The app displays a build version in the sidebar
    Then the sidebar shows a real build hash
