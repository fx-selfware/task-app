Feature: Templates API

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists

  Scenario: Create template
    When I POST "/api/templates" with body '{"name":"Sprint Template"}' with my cookie
    Then the status is 201
    And the response body has template.name "Sprint Template"

  Scenario: Get templates returns only own templates
    Given I have a template named "Alice Template"
    And user "bob@example.com" has a template named "Bob Template"
    When I GET "/api/templates" with my cookie
    Then the status is 200
    And there is 1 template named "Alice Template"

  Scenario: Owner gets template with tasks
    Given I have a template named "My Template"
    And I add a template task "Task A" to that template
    When I GET that template
    Then the status is 200
    And the template has 1 task named "Task A"

  Scenario: Non-owner gets 404 for template
    Given I have a template named "Alice Template"
    When user "bob@example.com" GETs that template
    Then the status is 404

  Scenario: Owner can rename and delete template
    Given I have a template named "Old Name"
    When I PATCH that template with body '{"name":"New Name"}'
    Then the status is 200
    And the response body has template.name "New Name"
    When I DELETE that template
    Then the status is 204

  Scenario: Template task CRUD
    Given I have a template named "My Template"
    When I POST a template task "Task A" with description "Do this"
    Then the status is 201
    When I PATCH that template task with body '{"title":"Updated Task A"}'
    Then the status is 200
    And the template task has title "Updated Task A"
    When I DELETE that template task
    Then the status is 204

  Scenario: Apply template to list appends tasks
    Given I have a template named "Sprint" with tasks "Task 1" and "Task 2"
    And I own a task list named "My List"
    And that list has a task "Pre-existing"
    When I apply that template to that list
    Then the status is 201
    And 2 tasks are returned
    And the first applied task has order 1
    And the list has 3 total tasks
