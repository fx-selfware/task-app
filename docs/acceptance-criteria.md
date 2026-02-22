# Acceptance Criteria

## Auth
- A visitor trying to access any page is redirected to the login page
- A new user can register with name, email and password and is taken to their task lists
- A returning user can log in and is taken to their task lists
- Logging in with a wrong password shows an error on the login page
- Registering with an email already in use shows an error

## Task Lists
- A user can create a new task list and it immediately appears in the sidebar
- A user can share a task list with another user by entering their email address
- The share modal shows who currently has access and at what permission level

## Mobile
- On a 375 px viewport the sidebar is hidden by default
- A hamburger button opens the sidebar; clicking the backdrop closes it

---

## How to verify

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build -d --wait -V
npm --prefix e2e install && BASE_URL=http://localhost:8099 npm --prefix e2e test
docker compose -f docker-compose.yml -f docker-compose.test.yml down
```

View the report:
```bash
npm --prefix e2e run report
```

Run interactively (watch each test in the browser):
```bash
npm --prefix e2e install && BASE_URL=http://localhost:8099 npm --prefix e2e run test:ui
```
