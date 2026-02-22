Feature: Task Lists

  Background:
    Given I am logged in as a new user

  Scenario: Create a task list and see it in the sidebar
    When I create a task list named "Shopping"
    Then "Shopping" appears in the sidebar

  Scenario: Edit a task name
    Given I have a task list named "My List"
    When I open the task list "My List"
    And I add a task named "Buy milk"
    And I edit the task "Buy milk" to be named "Buy oat milk"
    Then "Buy oat milk" is visible in the task list
    And "Buy milk" is no longer visible in the task list

  Scenario: Share a task list by email
    Given I have a task list named "Work"
    And a collaborator exists with email "collab@example.com"
    When I open the share modal for "Work"
    And I invite "collab@example.com" with "Read" permission
    Then "collab@example.com" is listed in the share modal with "Read" access
