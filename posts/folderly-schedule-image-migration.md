---
title: moving folderly's schedule images out of synced rows
date: 2026-10-16
tags: engineering, folderly, typescript
description: How I moved Folderly's schedule images from base64 in synced database rows to object storage, and the retry loop I found in the image queue afterwards.
---

I didn't design the first version of Folderly's schedule images, which a teammate built to store each image as base64 inside a synced database row. I designed and shipped its replacement in January 2026, moving the images into object storage. Base64 made up 629 MB of the 641 MB schedules table, and every sync shipped it to every device.

The change landed as one TypeScript PR (about 380 added lines): old images kept rendering, new ones went through the app's attachment queue, and I wrote a server-side script to move the existing data. A few days later I found why that queue, also a teammate's code, was sending thousands of failed requests an hour to storage, and wrote the fix.

## Context

Folderly is a planner app I co-founded, with over 1M users. The current app is React Native and Expo, written in TypeScript. Each device keeps a local SQLite copy of the user's data, synced from Supabase Postgres through PowerSync.

The schedule screen shows the current class as an iPod-style card with a cover image. In the first version, which a teammate built in early January 2026, the image picker stored each picked image as a base64 string in the `image` column of `folderly_schedules`. User cards and course images already went through an attachment queue backed by Supabase Storage. Schedules were the one place still storing images inline.

What that cost, from the PR description:

- Schedules table: 641 MB
- Base64 image data: 629 MB of that (97%)
- Images: 220 KB on average, 2.6 MB at the largest

The table grew in step with users, and every sync pulled those blobs down to every device.

## Before and after

![The synced row now carries a UUID instead of the image](images/folderly-schedule-image-path.svg)

Rows that haven't been migrated still render, because the hook falls back to the base64 column.

## Interface decisions

### One hook decides where an image comes from

Screens call `useScheduleImageUri(schedule)` and get back a URI or nothing. It tries storage first and falls back to the legacy base64 column, so old and new rows render the same way during rollout. When the old column goes, the fallback is deleted in one place.

```ts
export function useScheduleImageUri(
  schedule: Schedule | null,
): string | undefined {
  const { imageUri } = useAttachmentUrl(schedule?.imageId ?? null);
  if (imageUri) return imageUri;
  if (schedule?.image) return `data:image/jpeg;base64,${schedule.image}`;
  return undefined;
}
```

### The preview component takes a URI, not base64

`IPodPreview` used to receive a raw base64 prop and build the data URI itself. I changed the prop to `imageUri`, so the component no longer knows where an image is stored. The schedule screen passes whatever the hook resolves, and the edit form passes the picked image's local file.

### Setting an `image_id` clears the old base64

In `updateSchedule`, writing `imageId` also writes `image = NULL` unless the caller set `image` itself. A row can't end up holding both, so once a user picks a new image the blob stops syncing.

### The form shows a new image before it uploads

Picking an image saves it into the attachment queue and returns its UUID. The form previews the local copy straight away, and the queue uploads it in the background. A slow or offline upload doesn't block saving the schedule.

## Migration

Existing images move through a one-off server-side script, written to run before the app update ships. My first version ran on the device instead, and I replaced it the same day. Reading that first version back, it had three problems:

- It ran once per device, not once per row. A user with a phone and a tablet could migrate the same row on both before either write synced, leaving an orphaned upload.
- Users who never opened the updated app kept their base64, so the table would never fully shrink.
- A failed row still counted toward the total, and the "done" flag got set anyway. With enough failures at the front of the queue, some rows were never attempted.

The replacement runs against Supabase with the service role key, in batches of 10 with a 500 ms pause. Before running it on production data I added:

- Pre-flight checks for the database connection, the new column and the storage bucket
- A `--dry-run` mode that reports what would move and how large each image is
- One row update that sets `image_id` and clears `image` together, only after the upload succeeds, so a failed row keeps its base64 for the next run
- Deleting the uploaded file when that row update fails, so a failure leaves no orphans
- `upsert: false` on upload, so a UUID collision fails loudly instead of overwriting another image
- Resumability: it only selects rows that still have no `image_id`, so it can stop and rerun safely
- Progress, rate and a list of failed IDs in the output

The rollout order was part of the PR: add the column, deploy the PowerSync sync rules, run the script, confirm zero rows still need migrating, run `VACUUM FULL` to reclaim the space, then ship the app update.

## What broke in production

In early February I traced thousands of 400 errors an hour against Supabase Storage to the attachment queue, which every Folderly image, schedules included, now goes through. A teammate built the queue and its error handling; I found the cause and wrote the fix. Users saw nothing. Each user with an image reference whose file was missing from storage caused about 240 failed requests an hour, so the volume grew with active users.

Two bugs combined into a loop that never stopped:

1. The download error handler searched `error.toString()` for the text `"status":400`. Supabase's `StorageApiError` prints only its class name and message, so the status never appeared, and every 400 and 404 was retried as if it were transient.
2. Even when a download was marked as not retryable, it came back. The queue's base class only watches records in states below `ARCHIVED`, so an archived record looked new to the watcher, which overwrote it back to `QUEUED_SYNC`.

The result: every 30 seconds, for each user and each missing image, the queue tried a `.jpg` download, then a `.png`, failed both, and queued itself again.

The fix reads `error.status` directly instead of parsing a string. A download that fails for good is marked `SYNCED` with an empty placeholder file, not `ARCHIVED`. The watcher does see `SYNCED` records, and it skips any whose local file exists, which breaks the loop.

## Since launch

The PR merged on 29 January 2026. As of September 2026, the hook, the `image_id` column and the queue's schedule watcher are still the only path for schedule images, and the hook is unchanged since it landed.

The PR projected the table dropping from 641 MB to about 20 MB once the script and `VACUUM FULL` had run.

One step from the PR is still open: dropping the `image` column, deleting the base64 fallback in the hook, and retiring the script. I planned it as a separate PR once the rollout was stable.
