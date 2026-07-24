# RefluxCare — Product Specification

## Purpose

RefluxCare is a private, mobile-first personal tracking application. It helps
the user record daily activities, meals, medicines, symptoms, and burping, then
look for repeated patterns that can be discussed with a doctor.

The application supports self-observation. It does not diagnose disease,
determine that a food is medically unsafe, or change prescribed treatment.

## First-version questions

The application should help answer:

1. What was I doing when a symptom occurred?
2. What and when did I eat?
3. How many times did I burp?
4. Did burping or another symptom increase after a particular food, meal size,
   activity, posture, medicine, or time of day?
5. Are symptoms improving or worsening across days and weeks?

## Core experience

### Today timeline

The home screen shows all events in chronological order:

- Meals and drinks
- Medicines
- Activities
- Posture changes
- Burps
- Other symptoms
- Sleep and wake times

Every event stores an exact timestamp. Events can be corrected when they were
entered late.

### Quick burp counter

The home screen has a large **Burp +1** button designed for one-handed use.

Each tap creates a timestamped burp event. Consecutive taps close together may
be displayed as a burst (for example, "4 burps in 2 minutes") without losing
the individual event times.

The user can also enter a remembered count later, with an estimated time and an
"entered later" marker.

### Activity logging

An activity entry records:

- Activity type: working, sitting, walking, exercising, travelling, resting,
  sleeping, or custom
- Start and optional end time
- Posture: upright, bent forward, lying left, lying right, lying on back, or
  custom
- Optional note

### Meal logging

A meal entry records:

- Meal type
- Foods and drinks
- Portion size: small, medium, or large
- Start time
- Optional end time
- Spicy, oily/fried, caffeinated, carbonated, or custom tags
- Optional photo and note

Foods are not labelled as triggers from one occurrence. The analysis uses
repeated observations and clearly distinguishes association from causation.

### Symptom logging

Initially supported symptoms:

- Heartburn
- Regurgitation
- Burping
- Chest discomfort
- Throat irritation
- Bloating
- Nausea
- Breathing discomfort
- Custom symptom

A symptom entry records severity from 0–10, start time, optional end time,
posture, activity, and a note.

Urgent symptoms must display a clear message to seek appropriate medical care;
the application must not attempt to diagnose them.

## Analysis

The first analysis will calculate:

- Burps by hour and by day
- Burps in configurable windows after meals
- Symptom severity by time of day
- Repeated associations with foods, tags, meal size, posture, and activities
- Seven-day and thirty-day trends

All results must use language such as "associated with" or "observed after,"
not "caused by."

## Privacy

- Health data is private by default.
- Test reports and prescriptions must not be publicly accessible.
- Personally identifying details should be redacted before external sharing.
- Medical records require access control, encryption in transit, backups, and
  an explicit delete/export mechanism before production use.

## Initial product boundary

The first version is for one user. Social features, public profiles, automatic
diagnosis, medication changes, and automatic surgery recommendations are out of
scope.
