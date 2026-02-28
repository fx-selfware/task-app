Feature: Templates

  Background:
    Given I am logged in as a new user

  @ac
  Scenario: A user can create a template and see it on the templates page
    When I navigate to the templates page
    And I create a template named "Sprint Template"
    Then "Sprint Template" is visible on the templates page

  @ac
  Scenario: A user can reorder template tasks by dragging
    Given I have a template named "Reorder Template"
    When I open the template "Reorder Template"
    And I add a template task named "First Task"
    And I add a template task named "Second Task"
    And I drag the template task "Second Task" above "First Task"
    Then "Second Task" appears before "First Task" in the template

  @ac
  Scenario: Shared template updates in real-time when another user adds a task
    Given I have a template named "Realtime Template"
    And a collaborator exists with email "tpl-rt@example.com"
    When I open the template "Realtime Template"
    And I open the template share modal
    And I invite "tpl-rt@example.com" with "Write" permission to the template
    And I close the dialog
    And the collaborator "tpl-rt@example.com" opens the template "Realtime Template"
    And I add a template task named "Live Template Task"
    Then the collaborator sees "Live Template Task" in the template without refreshing

  @ac
  Scenario: A user can share a template by email and see who has access
    Given I have a template named "Shared Template"
    And a collaborator exists with email "tpl-collab@example.com"
    When I open the template "Shared Template"
    And I open the template share modal
    And I invite "tpl-collab@example.com" with "Read" permission to the template
    Then "tpl-collab@example.com" is listed in the template share modal with "Read" access
