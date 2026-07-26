Feature: Optimistic updates

  Over a slow connection the interface must not wait for the server to agree.
  Every scenario here stalls the API before acting, so a passing assertion
  proves the change was rendered from the local cache — if the UI needed a
  response, none is coming.

  Background:
    Given I am logged in as a new user
    And I have a task list named "Optimistic List"
    And I open the task list "Optimistic List"

  @ac
  Scenario: A new task appears before the server responds
    Given I have a task named "Existing Task"
    And the API stops responding
    When I submit a new task named "Instant Task"
    Then "Instant Task" is visible in the task list

  @ac
  Scenario: A deleted task disappears before the server responds
    Given I have a task named "Doomed Task"
    And the API stops responding
    When I delete the task "Doomed Task"
    Then "Doomed Task" is no longer visible in the task list

  @ac
  Scenario: A renamed list updates its heading before the server responds
    Given the API stops responding
    When I submit a rename of the list to "Renamed List"
    Then the list heading is "Renamed List"

  @ac
  Scenario: The edit dialog closes before the server responds
    Given I have a task named "Editable Task"
    And the API stops responding
    When I submit an edit of the task "Editable Task" titled "Edited Task"
    Then no dialog is open
    And "Edited Task" is visible in the task list

  @ac
  Scenario: A moved subtask reparents before the server responds
    Given I have a task named "Parent Task"
    And I have a task named "Wandering Task"
    And the API stops responding
    When I move the task "Wandering Task" under "Parent Task"
    Then "Wandering Task" is visible as a subtask of "Parent Task"

  @ac
  Scenario: A new list appears before the server responds
    Given I am viewing the task lists page
    And the API stops responding
    When I submit a new list named "Instant List"
    Then "Instant List" appears in the sidebar

  @ac
  Scenario: A new template task appears before the server responds
    Given I have a template named "Optimistic Template"
    And I open the template "Optimistic Template"
    And the API stops responding
    When I submit a new template task named "Instant Step"
    Then "Instant Step" is visible in the task list

  @ac
  Scenario: A subtask can be added to a task the server has not acknowledged yet
    Given the API responds slowly
    When I submit a new task named "Fresh Parent"
    And I add a subtask named "Fresh Child" to "Fresh Parent"
    Then "Fresh Child" is visible as a subtask of "Fresh Parent"

  @ac
  Scenario: A write that fails is rolled back and reported
    Given writes to the API start failing
    When I submit a new task named "Rejected Task"
    Then an error message is visible
    And "Rejected Task" is no longer visible in the task list
