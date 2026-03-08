Feature: Mobile layout

  Background:
    Given I am using a 375px wide viewport
    And I am logged in as a new user

  Scenario: A hamburger button opens the sidebar and the backdrop closes it
    Then the sidebar is not visible
    When I click the hamburger button
    Then the sidebar is visible
    When I click the backdrop
    Then the sidebar is not visible

  @touch-only
  Scenario: Tasks can be reordered by dragging on a mobile viewport
    Given I have a task list with tasks "Alpha" and "Beta" ready to view
    When I drag "Beta" above "Alpha"
    Then "Beta" appears before "Alpha" in the task list

  Scenario: Pressing Enter on the task title input creates the task
    Given I have a task list named "Quick Add"
    When I click the hamburger button
    And I open the task list "Quick Add"
    And I press "+ Task" and type "Buy groceries" then press Enter
    Then "Buy groceries" is visible in the task list

@touch-only
Scenario: The task actions menu is always visible on a touch device without hovering
  Given I have a task list with tasks "Alpha" and "Beta" ready to view
  Then the task actions button is visible without hovering
