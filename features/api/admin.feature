Feature: Admin API

  Scenario: Non-admin cannot access admin endpoints
    Given I am logged in as "user@example.com" with password "password123"
    When I GET "/api/admin/users" with my cookie
    Then the status is 403

  Scenario: Admin can list users
    Given I am logged in as admin "admin@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists
    When I GET "/api/admin/users" with my cookie
    Then the status is 200
    And the users list contains "admin@example.com"
    And the users list contains "bob@example.com"

  Scenario: Admin can reset user password
    Given I am logged in as admin "admin@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists
    When I reset password for "bob@example.com" to "newpassword123"
    Then the status is 200
    And user "bob@example.com" can log in with password "newpassword123"

  Scenario: Admin password reset with short password returns 400
    Given I am logged in as admin "admin@example.com" with password "password123"
    And user "bob@example.com" with password "password123" exists
    When I reset password for "bob@example.com" to "short"
    Then the status is 400
