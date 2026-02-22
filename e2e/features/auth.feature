Feature: Authentication

  @ac
  Scenario: A visitor who is not logged in is redirected to the login page
    Given I am not logged in
    When I visit "/"
    Then I am redirected to "/login"

  Scenario: A visitor cannot access the task lists page without logging in
    Given I am not logged in
    When I visit "/task-lists"
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

  Scenario: Logging in with a wrong password shows an error message
    Given I am on the login page
    When I fill in email "nobody@example.com" and password "wrongpassword"
    And I submit the form
    Then I remain on the login page
    And I see an error message

  Scenario: Registering with an email already in use shows an error
    Given a user already exists with email "taken@example.com"
    And I am on the register page
    When I fill in name "New User", email "taken@example.com", password "password123"
    And I submit the form
    Then I see an error message
