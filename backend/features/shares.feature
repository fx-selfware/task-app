Feature: Shares API

  Background:
    Given I am logged in as "alice@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists
    And I own a task list named "Test List"

  Scenario: AC-S1 Owner can share with existing user
    When I POST a share for "bob@example.com" with READ permission
    Then the status is 201
    And the share has permission "READ"
    And the share user email is "bob@example.com"

  Scenario: AC-S2 Share with non-existent email returns 404
    When I POST a share for "nobody@example.com" with READ permission
    Then the status is 404

  Scenario: AC-SEC4 Duplicate share returns 409
    Given I have shared that list with "bob@example.com" as READ
    When I POST a share for "bob@example.com" with WRITE permission
    Then the status is 409

  Scenario: AC-S3 Owner can list shares
    Given I have shared that list with "bob@example.com" as READ
    When I GET the shares for that list
    Then the status is 200
    And there is 1 share for "bob@example.com"

  Scenario: AC-S4 Owner can update share permission
    Given I have shared that list with "bob@example.com" as READ
    When I PATCH that share with permission "WRITE"
    Then the status is 200
    And the share has permission "WRITE"

  Scenario: AC-S5 Owner can revoke share
    Given I have shared that list with "bob@example.com" as READ
    When I DELETE that share
    Then the status is 204
    And user "bob@example.com" cannot access that list
