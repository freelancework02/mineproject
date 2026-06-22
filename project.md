# Marketing CRM - Phase Wise Development Plan

## Project Overview

Build a complete Marketing CRM platform that allows businesses to:

- Import leads from Google Sheets / CSV files
- Detect duplicate leads before importing
- Manage lead profiles
- Make and receive calls using Twilio
- Send SMS and Bulk SMS campaigns
- Manage Twilio resources and logs
- Send Single and Bulk Emails
- Create Notes and Tasks
- Track communication history
- Maintain complete lead lifecycle

---

# Important Development Rule

This project MUST be developed phase by phase.

After completing each phase:

1. Verify all functionality.
2. Verify database migrations.
3. Verify security checks.
4. Verify UI functionality.
5. Verify API functionality.

Then STOP.

The AI must NOT automatically proceed to the next phase.

Instead respond:

```text
Phase X completed successfully.

All features have been implemented.
All migrations have been created.
All tests passed.

To start the next phase send:

START PHASE
```

Only after receiving:

```text
START PHASE
```

The AI can begin the next phase.

---

# Technology Stack

## Frontend

- Next.js (JSX)
- Tailwind CSS
- React Hooks
- Context API

## Backend

- Next.js API Routes

## Database

- Supabase PostgreSQL

## Authentication

- Supabase Auth

## Calling & SMS

- Twilio

## Email

- SendGrid

## File Storage

- Supabase Storage

## Deployment

- Vercel
- Supabase

---

# Project Folder Structure

```text
marketing-crm/

├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_auth.sql
│   ├── 003_leads.sql
│   ├── 004_twilio.sql
│   ├── 005_tasks.sql
│   └── ...
│
├── src/
│
├── components/
│
├── pages/
│
├── api/
│
├── services/
│
├── hooks/
│
├── utils/
│
├── lib/
│
├── public/
│
└── docs/
```

---

# Security Requirements

Must be followed in every phase.

## Authentication

- Supabase Authentication
- JWT Validation
- Session Validation

## Authorization

Role Based Access Control

Roles:

- Super Admin
- Admin
- Manager
- Agent

---

## Data Protection

- Row Level Security (RLS)
- SQL Injection Protection
- XSS Protection
- CSRF Protection
- Rate Limiting
- Audit Logs

---

## Secrets

Never expose:

- Twilio SID
- Twilio Auth Token
- SendGrid API Key
- Supabase Service Key

Store only in:

```env
.env.local
```

Server-side access only.

---

# PHASE 1

# Project Setup & Authentication

## Goal

Build secure project foundation.

---

## Tasks

### Create Next.js Project

```bash
npx create-next-app
```

### Install

- Tailwind CSS
- Supabase
- React Hook Form
- Zod
- Axios

---

## Configure

### Supabase

Create:

- Client
- Server Client

---

## Authentication Pages

### Login

Fields:

- Email
- Password

### Signup

Fields:

- Name
- Email
- Password

---

## Dashboard Layout

Create:

- Sidebar
- Header
- User Menu

---

## Database Migration

Create:

```text
migrations/001_initial_schema.sql
```

Tables:

### users

```sql
id
name
email
role
created_at
updated_at
```

---

## Deliverables

- Authentication
- Protected Routes
- Dashboard Layout
- User Session Management

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 2

# Lead Import System

## Goal

Import leads from:

- CSV
- Excel
- Google Sheets

---

## Features

### Upload File

Supported:

- CSV
- XLSX

---

### Google Sheet Import

User enters:

```text
Google Sheet URL
```

System fetches:

```text
Name
Phone
Email
Source
```

---

## Lead Validation

Check:

- Empty Email
- Invalid Email
- Invalid Phone

---

## Duplicate Detection

Check duplicates using:

```sql
email
phone
```

---

## Duplicate Review Screen

Show:

```text
Duplicate Found

Lead Name
Email
Phone

[Skip Duplicate]
[Import Anyway]
[Cancel Import]
```

---

## Database Migration

```text
migrations/002_leads.sql
```

### leads

```sql
id
name
email
phone
source
status
owner_id
created_at
updated_at
```

---

### lead_imports

```sql
id
file_name
total_records
duplicate_records
imported_records
created_by
created_at
```

---

## Deliverables

- CSV Import
- Excel Import
- Google Sheet Import
- Duplicate Detection

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 3

# Lead Management Module

## Goal

Lead Profile Management

---

## Lead List

Features:

- Search
- Filter
- Sort
- Pagination

---

## Lead Profile

Display

### Basic Info

```text
Name
Phone
Email
Source
```

---

### Activity Timeline

Show:

- Calls
- SMS
- Emails
- Notes
- Tasks

---

### Lead Status

Options

```text
New
Contacted
Interested
Follow Up
Won
Lost
```

---

### Lead Assignment

Assign to:

- User
- Team

---

## Database Migration

```sql
lead_activities
```

```sql
id
lead_id
activity_type
activity_data
created_by
created_at
```

---

## Deliverables

- Lead List
- Lead Profile
- Lead Assignment
- Activity Timeline

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 4

# Twilio Calling System

## Goal

Call directly from CRM.

---

## Features

### Click To Call

User clicks:

```text
Call Button
```

CRM initiates call.

---

### Incoming Calls

Support:

- Incoming Calls
- Outgoing Calls

---

### Call Recording

Store:

```text
Recording URL
Duration
Status
```

---

### Call Notes

Add notes after call.

---

### Call History

Display:

```text
Date
Duration
Status
Recording
Agent
```

---

## Database Migration

```sql
call_logs
```

```sql
id
lead_id
twilio_call_sid
direction
status
duration
recording_url
agent_id
created_at
```

---

## Deliverables

- Click To Call
- Call History
- Recordings
- Call Notes

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 5

# SMS & Bulk SMS Module

## Features

### Single SMS

Send to one lead.

---

### Bulk SMS

Send to:

- Filtered Leads
- Uploaded Lists

---

### SMS Templates

Create reusable templates.

---

### Delivery Status

Track:

- Sent
- Delivered
- Failed

---

## Database Migration

```sql
sms_logs
```

```sql
id
lead_id
message
status
twilio_message_sid
created_at
```

---

## Deliverables

- Single SMS
- Bulk SMS
- SMS Templates

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 6

# Twilio Administration Module

## Goal

Manage Twilio Account.

---

## Features

### Account Overview

Show:

- Balance
- Active Numbers
- Usage

---

### Phone Numbers

Display:

- Purchased Numbers
- Assigned Numbers

---

### Call Logs

Display all Twilio Calls.

---

### SMS Logs

Display all Twilio Messages.

---

### Recordings

Display all recordings.

---

### Webhook Monitoring

Track:

- Failures
- Successes

---

## Deliverables

- Twilio Dashboard
- Number Management
- Usage Tracking

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 7

# Email Module

## Goal

Email Marketing System

---

## Features

### Single Email

Send to one lead.

---

### Bulk Email

Send campaigns.

---

### Templates

Create:

- Marketing Templates
- Follow-up Templates

---

### Tracking

Track:

- Open Rate
- Click Rate
- Bounce Rate

---

## Database Migration

```sql
email_logs
```

```sql
id
lead_id
subject
status
provider_message_id
created_at
```

---

## Deliverables

- Single Email
- Bulk Email
- Email Templates

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 8

# Notes & Task System

## Features

### Notes

Add unlimited notes.

---

### Tasks

Create:

```text
Call Customer
Follow Up
Send Email
Meeting
```

---

### Task Status

```text
Pending
In Progress
Completed
```

---

### Reminder System

Due Date Notifications.

---

## Database Migration

```sql
notes
tasks
```

---

## Deliverables

- Notes
- Tasks
- Reminders

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 9

# Reporting & Analytics

## Lead Reports

- Total Leads
- New Leads
- Converted Leads

---

## Calling Reports

- Total Calls
- Connected Calls
- Missed Calls

---

## SMS Reports

- Sent
- Delivered
- Failed

---

## Email Reports

- Sent
- Opened
- Clicked

---

## Agent Reports

- Calls
- Tasks
- Leads

---

## Deliverables

- Analytics Dashboard
- Export Reports

---

STOP

Wait for:

```text
START PHASE
```

---

# PHASE 10

# Final Production Hardening

## Security Audit

Verify:

- Authentication
- Authorization
- RLS Policies
- API Security

---

## Performance

- Query Optimization
- Pagination
- Lazy Loading
- Caching

---

## Error Monitoring

Integrate:

- Sentry

---

## Logging

Create:

```sql
audit_logs
```

---

## Production Checklist

- HTTPS
- Backup Strategy
- Environment Variables
- Twilio Webhooks
- SendGrid Webhooks

---

## Final Deliverables

- Production Ready CRM
- Complete Documentation
- Migration Files
- Deployment Guide
- Security Guide
- API Documentation

---

# AI Development Rules

Before coding any phase:

1. Read previous phase completely.
2. Verify migration files exist.
3. Verify folder structure.
4. Generate migration file first.
5. Generate Supabase policies second.
6. Generate API routes third.
7. Generate UI fourth.
8. Generate testing checklist fifth.

After completion:

STOP.

Respond only:

```text
Phase Completed Successfully.

To continue send:

START PHASE
```

Never start the next phase automatically.