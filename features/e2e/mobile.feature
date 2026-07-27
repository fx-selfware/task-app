Feature: Mobile layout

  Background:
    Given I am using a 375px wide viewport
    And I am logged in as a new user

  # The floating add button is gone, but the layering risk it guarded against is
  # not: the composer is bottom-anchored too, and must stay behind the backdrop.
  Scenario: The sidebar opens and its backdrop covers the composer
    Given I have a task list named "Composer Test"
    When I click the hamburger button
    And I open the task list "Composer Test"
    Then the sidebar is not visible
    When I click the hamburger button
    Then the sidebar is visible
    And clicking the composer area hits the backdrop instead
    Then the sidebar is not visible

  @touch-only
  Scenario: Tasks can be reordered by dragging on a mobile viewport
    Given I have a task list with tasks "Alpha" and "Beta" ready to view
    When I drag "Beta" above "Alpha"
    Then "Beta" appears before "Alpha" in the task list

  Scenario: Pressing Enter in the composer creates the task
    Given I have a task list named "Quick Add"
    When I click the hamburger button
    And I open the task list "Quick Add"
    And I type "Buy groceries" in the composer then press Enter
    Then "Buy groceries" is visible in the task list

# The overflow menu is gone. The rule it protected is not: a touch device has no
# hover, so a row's actions must be reachable without one.
@touch-only
Scenario: Row actions are reachable on a touch device without hovering
  Given I have a task list with tasks "Alpha" and "Beta" ready to view
  When I open the row "Alpha"
  Then the row actions are visible without hovering
