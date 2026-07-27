Feature: Admin

  Scenario: A non-admin user does not see Admin on the You tab
    Given I am logged in as a new user
    When I open the You tab
    Then the You tab does not offer "User management"

  @ac
  Scenario: An admin user can see the admin page with a list of users
    Given I am logged in as an admin user
    When I open the You tab
    Then the You tab offers "User management"
    When I open "User management" from the You tab
    Then I see the admin users table
