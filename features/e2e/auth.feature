Feature: Authentication

  @ac
  Scenario: A visitor who is not logged in is redirected to the login page
    Given I am not logged in
    When I visit "/"
    Then I am redirected to "/login"

  @ac
  Scenario: A new user can register and is taken to their task lists
    Given I am on the register page
    When I fill in name "E2E User", email "<unique>@example.com", password "password123"
    And I submit the form
    Then I am on the task lists page

  @ac
  Scenario: A registered user can log in and is taken to their task lists
    Given I am on the register page
    When I fill in name "Login User", email "<unique2>@example.com", password "password123"
    And I submit the form
    Then I am on the task lists page
    When I click the logout button
    Then I am redirected to "/login"
    When I fill in email "<unique2>@example.com" and password "password123"
    And I submit the form
    Then I am on the task lists page
