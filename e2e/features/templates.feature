Feature: Templates

  Background:
    Given I am logged in as a new user

  @ac
  Scenario: A user can create a template and see it on the templates page
    When I navigate to the templates page
    And I create a template named "Sprint Template"
    Then "Sprint Template" is visible on the templates page

  @ac
  Scenario: A user can share a template by email and see who has access
    Given I have a template named "Shared Template"
    And a collaborator exists with email "tpl-collab@example.com"
    When I open the template "Shared Template"
    And I open the template share modal
    And I invite "tpl-collab@example.com" with "Read" permission to the template
    Then "tpl-collab@example.com" is listed in the template share modal with "Read" access
