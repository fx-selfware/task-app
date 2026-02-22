Feature: Mobile layout

  Background:
    Given I am using a 375px wide viewport
    And I am logged in as a new user

  Scenario: Sidebar is hidden by default on mobile
    Then the sidebar is not visible

  Scenario: Hamburger button toggles the sidebar
    When I click the hamburger button
    Then the sidebar is visible
    When I click the backdrop
    Then the sidebar is not visible
