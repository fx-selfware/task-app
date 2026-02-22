Feature: Task Lists

  Background:
    Given I am logged in as a new user

  Scenario: Create a task list and see it in the sidebar
    When I create a task list named "Shopping"
    Then "Shopping" appears in the sidebar

  Scenario: Share a task list by email
    Given I have a task list named "Work"
    And a collaborator exists with email "collab@example.com"
    When I open the share modal for "Work"
    And I invite "collab@example.com" with "Read" permission
    Then "collab@example.com" is listed in the share modal with "Read" access
