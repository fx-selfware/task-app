Feature: Mobile layout

  Background:
    Given I am using a 375px wide viewport
    And I am logged in as a new user

  @touch-only
  Scenario: Tasks can be reordered by dragging on a mobile viewport
    Given I have a task list with tasks "Alpha" and "Beta" ready to view
    When I drag "Beta" above "Alpha"
    Then "Beta" appears before "Alpha" in the task list

  Scenario: Pressing Enter in the composer creates the task
    Given I have a task list named "Quick Add"
    When I open the task list "Quick Add"
    And I type "Buy groceries" in the composer then press Enter
    Then "Buy groceries" is visible in the task list

# The overflow menu is gone. The rule it protected is not: a touch device has no
# hover, so a row's actions must be reachable without one.
@touch-only
Scenario: Row actions are reachable on a touch device without hovering
  Given I have a task list with tasks "Alpha" and "Beta" ready to view
  When I open the row "Alpha"
  Then the row actions are visible without hovering

  # Direction A trades the row's visible controls for gestures. Each one still
  # has a non-gesture route, so these prove the shortcut, not the only way in.
  @touch-only
  Scenario: Swiping a task right completes it
    Given I have a task list with tasks "Alpha" and "Beta" ready to view
    When I swipe "Alpha" right
    Then the completed section shows 1 completed task
    And "Alpha" is no longer visible in the task list

  @touch-only
  Scenario: Swiping a task left reveals its actions
    Given I have a task list with tasks "Alpha" and "Beta" ready to view
    When I swipe "Alpha" left
    Then the row actions for "Alpha" are revealed

  @touch-only
  Scenario: A short swipe springs back and changes nothing
    Given I have a task list with tasks "Alpha" and "Beta" ready to view
    When I swipe "Alpha" left by 20 pixels
    Then the row actions for "Alpha" are not revealed
    And "Alpha" is visible in the task list
