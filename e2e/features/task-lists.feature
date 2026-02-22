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
