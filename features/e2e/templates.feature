Feature: Templates

  Background:
    Given I am logged in as a new user

  @ac
  Scenario: A user can create a template and see it on the templates page
    When I navigate to the templates page
    And I create a template named "Sprint Template"
    Then "Sprint Template" is visible on the templates page

  Scenario: A user can reorder template tasks by dragging
    Given I have a template named "Reorder Template"
    When I open the template "Reorder Template"
    And I add a template task named "First Task"
    And I add a template task named "Second Task"
    And I drag the template task "Second Task" above "First Task"
    Then "Second Task" appears before "First Task" in the template

  Scenario: A user can share a template and see real-time updates from a collaborator
    Given I have a template named "Shared Template"
    And a collaborator exists with email "tpl-collab@example.com"
    When I open the template "Shared Template"
    And I open the template share modal
    And I invite "tpl-collab@example.com" with "Write" permission to the template
    Then "tpl-collab@example.com" is listed in the template share modal with "Write" access
    When I close the dialog
    And the collaborator "tpl-collab@example.com" opens the template "Shared Template"
    And I add a template task named "Live Template Task"
    Then the collaborator sees "Live Template Task" in the template without refreshing

