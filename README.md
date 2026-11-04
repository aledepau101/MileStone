# MileStone

MileStone is a web app that helps graduate students plan and track their thesis milestones. It is built with HTML, CSS, and JavaScript and runs entirely in the browser. Data is stored with localStorage.

## Installing Dependencies
There are no packages to install. You need:

A modern web browser (Chrome, Edge, Firefox, or Safari).
Visual Studio Code.
The Live Server extension for VS Code (search “Live Server” by Ritwick Dey in the Extensions panel).

## Running the Application Locally
1. Clone the repo.
2. Open the folder in VS Code (code .).
3. Right-click signup.html (or the app’s schedule planner, such as schedule-planner.html) and choose Open with Live Server.
4. The app will open in your browser.

## Implemented feature
1. Sign up and login. New users can create an account on the signup page and then log in. Account information is stored in the browser’s localStorage. After logging in, the user is taken to the dashboard.

2. Calendar event management. A logged-in user can create events that appear on both the Month and Week tabs of the calendar. Events can be edited or deleted, and changes show up in both views. Events are saved in localStorage, so they remain after a page refresh.

## Testing the Features

Sign up and login
1. Start the app with Live Server and open signup.html.
2, Sign up: Enter the required details (for example name, email, and password) and submit. You'll be taken to the dashboard. 
3. Login: Log in with the same credentials. Confirm you reach the dashboard.
4. Invalid login: Try a wrong password or an unregistered email. Confirm the app rejects the attempt and shows an error.
5. Validation: Try submitting the signup form with empty fields. Confirm it does not create an account.

Schedule Planner
1. After logging in, open the schedule planner page.
2. Create: Add a new event with a title, date, and time. Confirm it appears on the Month tab on the correct day.
3. Week view: Switch to the Week tab and confirm the same event appears on the correct day and time slot.
4. Edit: Open the event, change its title or date, and save. Confirm the update shows in both Month and Week views.
5. Delete: Delete the event. Confirm it disappears from both views.
6. Create an event, then refresh the page. Confirm the event is still there.

