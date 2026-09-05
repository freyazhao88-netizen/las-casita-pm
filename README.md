# Las Casita — Project Manager

A web app for tracking employee attendance/payroll, material costs, project
progress, inspections, and building client quotes (English/Chinese).

## Starting the app

Double-click **`Start Las Casita App.command`** in this folder. A terminal window
will open and, after a moment, print:

```
Las Casita PM app running at http://localhost:4173
```

Open that link in your browser (Chrome/Safari). Keep the terminal window open while
you're using the app — closing it stops the server. To stop it on purpose, click into
that window and press `Ctrl+C`.

**Login:** sign in with your Supabase account email/password (e.g.
`freyazhao88@gmail.com`). You can change your password anytime under **⚙ Settings**
in the app. To add another person a login (e.g. a foreman), they'd need a Supabase
Auth account created for them — ask and I can set one up.

## Using it from your phone / a foreman's phone (same WiFi)

While your computer is running the app and both devices are on the same WiFi network,
open this on the other device's browser:

```
http://192.168.86.26:4173
```

(If that stops working later, your computer's local IP may have changed — ask and I can
look it up again, or run `ipconfig getifaddr en0` in Terminal.)

This only works while your computer is on, awake, and running the app, and only on the
same WiFi network — it will not work from a job site on cellular data. When you're ready
for real remote/job-site access, this app can be deployed to a small always-on host
(e.g. Railway/Render) with no changes to the features — just ask.

## What's in each tab

- **Dashboard** — total labor + material cost per project, vs. quoted amount, stage
  progress, and upcoming/failed inspections at a glance.
- **Projects** — create projects, edit details, filter by status or client name.
- **Attendance** — log each work day (employee, project, days, day rate — defaults from
  the employee's rate but editable per entry), mark entries paid/unpaid. Monthly summary
  shows total days & wages per employee, broken down by project.
- **Materials** — log purchases per project — flat amount or qty × unit price, payment
  status/method/invoice #, with running totals.
- **Employees** — roster with default day rate; SSN / ID number are masked by default
  (click "show" to reveal).
- **Inspections** — every inspection across every project in one filterable table
  (by project or status), with department, date, and notes editable inline.
- **Quotes** — the quote builder: pick categories from the library or add custom line
  items, choose "flat amount" or "qty × rate" per item, edit the payment schedule and
  exclusions, link a quote to a project, add a lead source, toggle the client-facing
  preview between **EN / 中文**, and use **Print / Save PDF** to export.

## Data storage

Data lives in a **Supabase** Postgres database (cloud-hosted), not on this computer —
so it survives reinstalls and could later be reached from other devices/locations.
Connection details are in `app/.env` (`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`) —
keep that file private; anyone with it has full access to your data. The table
definitions are in `app/supabase-schema.sql` for reference.

## Notes on this build

- Node.js is bundled in `app/.tools/` so this runs without installing anything on your
  Mac. Don't move or delete that folder.
- Login is a real account (Supabase Auth), not a shared password — each person who
  needs access should get their own account rather than sharing yours.
