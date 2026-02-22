Feature: Mobile layout

  Background:
    Given I am using a 375px wide viewport
    And I am logged in as a new user

  Scenario: The sidebar is hidden by default on a narrow viewport
    Then the sidebar is not visible

  Scenario: A hamburger button opens the sidebar and the backdrop closes it
    When I click the hamburger button
    Then the sidebar is visible
    When I click the backdrop
    Then the sidebar is not visible

  @touch-only
  Scenario: Tasks can be reordered by dragging on a mobile viewport
    Given I have a task list with tasks "Alpha" and "Beta" ready to view
    When I drag "Beta" above "Alpha"
    Then "Beta" appears before "Alpha" in the task list

@touch-only
Scenario: The delete button is always visible on a touch device without hovering
  Given I have a task list with tasks "Alpha" and "Beta" ready to view
  Then the delete button is visible without hovering
