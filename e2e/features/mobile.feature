Feature: Mobile layout

  Background:
    Given I am using a 375px wide viewport
    And I am logged in as a new user

  Scenario: The sidebar is hidden by default on a narrow viewport
    Then the sidebar is not visible

  Scenario: A hamburger button opens the sidebar and the backdrop closes it
    When I click the hamburger button
    Then the sidebar is visible
    When I click the backdrop
    Then the sidebar is not visible
