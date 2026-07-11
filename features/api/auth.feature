Feature: Authentication API

  Scenario: Register with valid data
    When I POST "/api/auth/register" with body '{"email":"alice@example.com","password":"password123","name":"Alice"}'
    Then the status is 201
    And the response body has user.email "alice@example.com"
    And the response body has user.name "Alice"
    And the response body has no user.passwordHash
    And the response sets an HttpOnly SameSite=Strict cookie named "token"

  Scenario: Register with a short password returns 400
    When I POST "/api/auth/register" with body '{"email":"shortpw@example.com","password":"short","name":"Short"}'
    Then the status is 400
    And the response body has error "password must be at least 8 characters"

  Scenario: Duplicate email returns 409
    Given a user exists with email "dup@example.com" and password "password123" and name "Dup"
    When I POST "/api/auth/register" with body '{"email":"dup@example.com","password":"otherpass","name":"Dup2"}'
    Then the status is 409

  Scenario: Login with valid credentials
    Given a user exists with email "login@example.com" and password "password123" and name "Login"
    When I POST "/api/auth/login" with body '{"email":"login@example.com","password":"password123"}'
    Then the status is 200
    And the response sets a cookie named "token"

  Scenario: Login with wrong password returns 401
    Given a user exists with email "wrong@example.com" and password "password123" and name "Wrong"
    When I POST "/api/auth/login" with body '{"email":"wrong@example.com","password":"bad"}'
    Then the status is 401

  Scenario: Login with unknown email returns 401
    When I POST "/api/auth/login" with body '{"email":"nobody@example.com","password":"password123"}'
    Then the status is 401

  Scenario: GET me with valid cookie returns user
    Given I am logged in as "me@example.com" with password "password123"
    When I GET "/api/auth/me" with my cookie
    Then the status is 200
    And the response body has user.email "me@example.com"

  Scenario: GET me without cookie returns 401
    When I GET "/api/auth/me"
    Then the status is 401

  Scenario: Logout clears cookie
    Given I am logged in as "logout@example.com" with password "password123"
    When I POST "/api/auth/logout" with my cookie
    Then the status is 200

  Scenario: Token cookie has HttpOnly and SameSite=Strict
    When I POST "/api/auth/register" with body '{"email":"flags@example.com","password":"password123","name":"Flags"}'
    Then the response sets an HttpOnly SameSite=Strict cookie named "token"
