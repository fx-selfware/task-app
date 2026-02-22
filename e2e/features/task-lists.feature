Feature: Task Lists

  Background:
    Given I am logged in as a new user

  Scenario: Create a task list and see it in the sidebar
    When I create a task list named "Shopping"
    Then "Shopping" appears in the sidebar

  Scenario: Share a task list by email
    Given I have a task list named "Work"
    When I open the share modal for "Work"
    Then the share modal is visible with an email input
