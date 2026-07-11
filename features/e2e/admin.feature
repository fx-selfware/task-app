Feature: Admin

  @ac
  Scenario: A non-admin user does not see the Admin link in the sidebar
    Given I am logged in as a new user
    Then the sidebar does not have an "Admin" link

  @ac
  Scenario: An admin user can see the admin page with a list of users
    Given I am logged in as an admin user
    Then the sidebar has an "Admin" link
    When I click the "Admin" link in the sidebar
    Then I see the admin users table
