Feature: Task Lists API

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists

  Scenario: Create list owned by current user
    When I POST "/api/task-lists" with body '{"name":"My List"}' with my cookie
    Then the status is 201
    And the response body has list.name "My List"
    And the list is owned by me

  Scenario: Get returns owned and shared lists
    Given I own a task list named "Alice List"
    And user "bob@example.com" owns a task list named "Bob List" shared with me as READ
    When I GET "/api/task-lists" with my cookie
    Then the status is 200
    And the response has 1 owned list named "Alice List"
    And the response has 1 shared list named "Bob List"

  Scenario: Get list detail as owner
    Given I own a task list named "Detail List"
    When I GET that task list with my cookie
    Then the status is 200
    And the response includes tasks and shares
    And the response has isOwner true

  Scenario: Owner can rename list
    Given I own a task list named "Old Name"
    When I PATCH that task list with body '{"name":"New Name"}' with my cookie
    Then the status is 200
    And the response body has list.name "New Name"

  Scenario: Owner can delete list
    Given I own a task list named "To Delete"
    When I DELETE that task list with my cookie
    Then the status is 204
    And GET that task list returns 404

  Scenario: Non-member gets 404
    Given I own a task list named "Private List"
    When user "bob@example.com" GETs that task list
    Then the status is 404

  Scenario: Non-owner cannot rename list
    Given I own a task list named "Alice List"
    And I share that task list with "bob@example.com" as WRITE
    When user "bob@example.com" PATCHes that task list with body '{"name":"Hijacked"}'
    Then the status is 403

  Scenario: Non-owner cannot delete list
    Given I own a task list named "Alice List"
    And I share that task list with "bob@example.com" as WRITE
    When user "bob@example.com" DELETEs that task list
    Then the status is 403
