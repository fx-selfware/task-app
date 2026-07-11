Feature: Template Shares API

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists
    And I have a template named "Shared Template"

  Scenario: Owner can share template with existing user
    When I POST a template share for "bob@example.com" with READ permission
    Then the status is 201
    And the template share has permission "READ"
    And the template share user email is "bob@example.com"

  Scenario: Share template with non-existent email returns 404
    When I POST a template share for "nobody@example.com" with READ permission
    Then the status is 404

  Scenario: Duplicate template share returns 409
    Given I have shared that template with "bob@example.com" as READ
    When I POST a template share for "bob@example.com" with WRITE permission
    Then the status is 409

  Scenario: Owner can list template shares
    Given I have shared that template with "bob@example.com" as READ
    When I GET the shares for that template
    Then the status is 200
    And there is 1 template share for "bob@example.com"

  Scenario: Owner can update template share permission
    Given I have shared that template with "bob@example.com" as READ
    When I PATCH that template share with permission "WRITE"
    Then the status is 200
    And the template share has permission "WRITE"

  Scenario: Owner can revoke template share
    Given I have shared that template with "bob@example.com" as READ
    When I DELETE that template share
    Then the status is 204

  Scenario: Shared user can view template with READ permission
    Given I have shared that template with "bob@example.com" as READ
    And I add a template task "Task A" to that template
    When user "bob@example.com" GETs that template
    Then the status is 200
    And the template has 1 task named "Task A"

  Scenario: Shared user with WRITE can rename template
    Given I have shared that template with "bob@example.com" as WRITE
    When user "bob@example.com" PATCHes that template with name "Renamed"
    Then the status is 200
    And the response body has template.name "Renamed"

  Scenario: Shared user with READ cannot rename template
    Given I have shared that template with "bob@example.com" as READ
    When user "bob@example.com" PATCHes that template with name "Renamed"
    Then the status is 404

  Scenario: Shared templates appear in GET /templates
    Given I have shared that template with "bob@example.com" as READ
    When user "bob@example.com" GETs "/api/templates"
    Then the status is 200
    And the shared templates contain "Shared Template"
