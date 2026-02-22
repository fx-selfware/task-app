Feature: Authentication

  Scenario: Unauthenticated visitor is redirected to login from root
    Given I am not logged in
    When I visit "/"
    Then I am redirected to "/login"

  Scenario: Unauthenticated visitor is redirected from task-lists
    Given I am not logged in
    When I visit "/task-lists"
    Then I am redirected to "/login"

  Scenario: New user registers and reaches task lists
    Given I am on the register page
    When I fill in name "E2E User", email "<unique>@example.com", password "password123"
    And I submit the form
    Then I am on the task lists page

  Scenario: Registered user can log in
    Given I am on the register page
    When I fill in name "Login User", email "<unique2>@example.com", password "password123"
    And I submit the form
    Then I am on the task lists page
    When I log out via API
    And I am on the login page
    And I fill in email "<unique2>@example.com" and password "password123"
    And I submit the form
    Then I am on the task lists page

  Scenario: Login with wrong password shows error
    Given I am on the login page
    When I fill in email "nobody@example.com" and password "wrongpassword"
    And I submit the form
    Then I remain on the login page
    And I see an error message
