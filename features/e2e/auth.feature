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

  # A session lives in a cookie for a week, so reopening the app should only
  # ever land on the login screen for a session the server actually rejected.
  # A cold launch is the least reliable moment there is — a phone's radio
  # waking, a serverless function and a database both starting cold — and a
  # stumble there used to be indistinguishable from being signed out.

  @ac
  Scenario: A stumble on the session check while the app opens does not sign me out
    Given I am logged in as a new user
    And the session check fails once before recovering
    When I reopen the app
    Then I am still signed in

  @ac
  Scenario: A session the server rejects still sends me to the login screen
    Given I am logged in as a new user
    And my session token has expired
    When I reopen the app
    Then I am redirected to "/login"

  @ac
  Scenario: A server that cannot be reached offers a retry instead of a login screen
    Given I am logged in as a new user
    And the session check keeps failing
    When I reopen the app
    Then I am told the app cannot reach the server
    And I am on the task lists page

  @ac
  Scenario: Retrying once the server is back restores the app
    Given I am logged in as a new user
    And the session check keeps failing
    And I reopen the app
    And I am told the app cannot reach the server
    When the session check recovers
    And I retry reaching the server
    Then I am no longer told the app cannot reach the server
    And I am still signed in
