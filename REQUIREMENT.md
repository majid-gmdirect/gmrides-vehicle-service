# Vehicle document change requests — requirements

This document explains how **change requests** work for vehicle documents in `gmrides-vehicle-service`. It is written so another agent (or developer) can implement the **client/UI flows** without reading the whole codebase.

**Base URL:** `{API_BASE}/api/vehicles`  
**Auth:** `Authorization: Bearer <JWT>` on every request below.

---

## 1. What problem this solves

Drivers upload vehicle documents (inspection, insurance, PCO, permission letter, schedule). An admin reviews them and sets status to `ACCEPTED` or `REJECTED`.

Once a document is **`ACCEPTED`**, the driver **must not** edit it directly. They must submit a **change request**. An admin reviews that request and either:

- **ACCEPTED** — proposed data is copied onto the live document (document stays `ACCEPTED`).
- **REJECTED** — live document is unchanged; driver can submit another request later.

While a change request is **pending**, the live document still shows the old accepted data, plus a `pendingChangeRequest` hint on list/detail APIs.

---

## 2. Data models (Prisma)

### 2.1 Live documents (target of change requests)

| Model | DB table | `targetType` enum |
|--------|----------|-------------------|
| `VehicleInspection` | inspections | `INSPECTION` |
| `VehicleInsurance` | insurances | `INSURANCE` |
| `VehiclePcoDocument` | pco docs | `PCO_DOCUMENT` |
| `PermissionLetter` | permission letters | `PERMISSION_LETTER` |
| `VehicleSchedule` | schedules | `SCHEDULE` |

Each live row has:

- `status`: `PENDING` \| `ACCEPTED` \| `REJECTED`
- `document`: JSON from upload service (optional)
- `rejectedReason`: set when admin rejects (optional)

**Uploadable field on all five models:** `document` (JSON).

Other fields (dates, provider, badge number, etc.) exist on some models but are **optional** for change requests. This spec focuses on **`document`** uploads because that is the common client flow.

### 2.2 Change request row

`VehicleDocumentChangeRequest`:

| Field | Meaning |
|--------|---------|
| `driverId` | Owner driver user id |
| `vehicleId` | Vehicle id |
| `targetType` | Which document kind (see table above) |
| `targetDocumentId` | Id of the live inspection/insurance/etc. row |
| `status` | `PENDING_REVIEW` \| `ACCEPTED` \| `REJECTED` \| `CANCELLED` |
| `payload` | JSON snapshot of proposed values (includes `document`) |
| `driver_note` | Optional message from driver |
| `rejected_reason` | Set when admin rejects the **request** |
| `reviewed_by_id`, `reviewed_at` | Set when admin finishes review |

**Rule:** At most **one** `PENDING_REVIEW` request per live document (enforced in DB).

---

## 3. Business rules (must follow)

### 3.1 When to use change requests vs direct update

| Live `status` | Driver may `PATCH` live document? | Driver may submit change request? |
|---------------|-----------------------------------|-----------------------------------|
| `PENDING` | Yes | No — edit live row instead |
| `REJECTED` | Yes (resubmit) | No |
| `ACCEPTED` | **No** → `409 DOCUMENT_LOCKED` | **Yes** (only path for driver edits) |

Admins always patch live documents directly (including setting `status` / `rejectedReason`).

### 3.2 Submit change request

- Caller role: **DRIVER** only (not admin).
- Live document must exist and belong to `vehicleId` + `driverId`.
- Live document `status` must be **`ACCEPTED`**.
- Payload must differ from current document (at minimum a new `document` ref).
- If another request is already `PENDING_REVIEW` for same document → `409 Conflict`.

### 3.3 Admin review change request

- Caller role: **ADMIN**.
- Request must be `PENDING_REVIEW`.
- Live document must still be **`ACCEPTED`**.
- `decision: ACCEPTED` → merge `payload` into live row; live `status` stays `ACCEPTED`.
- `decision: REJECTED` → require `rejectedReason`; live row unchanged.
- Driver receives **email only** (no app push) via notification service.

### 3.4 Cancel

- Driver only; request must be `PENDING_REVIEW` → set to `CANCELLED`.

---

## 4. Document upload shape

Upload files via your upload service first, then send the returned reference in API bodies:

```json
{
  "document": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/path/to/file.pdf"
  }
}
```

- `id` and `url` are the stable fields stored in `payload` / live `document`.
- Only include fields you intend to change; omitted fields keep existing live values in the built payload.

Optional on every submit body:

```json
{
  "driver_note": "Replaced expired certificate"
}
```

---

## 5. API routes — driver

All paths are under `{API_BASE}/api/vehicles`.

Replace:

- `{driverId}` — driver user UUID (must match JWT for driver calls)
- `{vehicleId}` — vehicle UUID
- `{documentId}` — id of the live inspection / insurance / pco / permission letter / schedule row
- `{requestId}` — change request UUID

### 5.1 Submit change request (document-only examples)

**Inspection**

```http
POST /driver/{driverId}/vehicles/{vehicleId}/inspections/{inspectionId}/change-requests
Role: DRIVER
Content-Type: application/json

{
  "document": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/mot.pdf"
  },
  "driver_note": "Updated MOT certificate"
}
```

**Insurance**

```http
POST /driver/{driverId}/vehicles/{vehicleId}/insurances/{insuranceId}/change-requests
Role: DRIVER

{
  "document": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/policy.pdf"
  }
}
```

**PCO document**

```http
POST /driver/{driverId}/vehicles/{vehicleId}/pco-docs/{pcoDocId}/change-requests
Role: DRIVER

{
  "document": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/pco.pdf"
  }
}
```

**Permission letter**

```http
POST /driver/{driverId}/vehicles/{vehicleId}/permission-letters/{permissionLetterId}/change-requests
Role: DRIVER

{
  "document": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/permission-letter.pdf"
  }
}
```

**Vehicle schedule**

```http
POST /driver/{driverId}/vehicles/{vehicleId}/schedules/{scheduleId}/change-requests
Role: DRIVER

{
  "document": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/schedule.pdf"
  }
}
```

**Success response shape (all submit routes):**

```json
{
  "success": true,
  "data": {
    "id": "change-request-uuid",
    "driverId": "...",
    "vehicleId": "...",
    "targetType": "INSPECTION",
    "targetDocumentId": "...",
    "status": "PENDING_REVIEW",
    "payload": {
      "document": { "id": "...", "url": "..." }
    },
    "driver_note": "...",
    "rejected_reason": null,
    "reviewed_by_id": null,
    "reviewed_at": null,
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Vehicle document change request submitted successfully"
}
```

### 5.2 List change requests for one document

```http
GET /driver/{driverId}/vehicles/{vehicleId}/inspections/{inspectionId}/change-requests
Role: DRIVER | ADMIN
```

Same path pattern for `insurances/{insuranceId}`, `pco-docs/{pcoDocId}`, `permission-letters/{permissionLetterId}`, `schedules/{scheduleId}`.

Returns array of change requests (newest first).

### 5.3 Get one change request

```http
GET /driver/{driverId}/vehicle-document-change-requests/{requestId}
Role: DRIVER | ADMIN
```

### 5.4 Cancel pending request

```http
PATCH /driver/{driverId}/vehicle-document-change-requests/{requestId}/cancel
Role: DRIVER
```

No body. Only works when `status` is `PENDING_REVIEW`.

### 5.5 See pending state on live document (no extra call required)

When listing or getting a live document, if a pending change request exists:

```http
GET /driver/{driverId}/vehicles/{vehicleId}/inspections/{inspectionId}
Role: DRIVER | ADMIN
```

```json
{
  "success": true,
  "data": {
    "id": "...",
    "status": "ACCEPTED",
    "document": { "id": "...", "url": "..." },
    "pendingChangeRequest": {
      "id": "change-request-uuid",
      "status": "PENDING_REVIEW",
      "createdAt": "2026-05-18T12:00:00.000Z"
    }
  }
}
```

If no pending request: `"pendingChangeRequest": null`.

### 5.6 What happens if driver patches accepted document directly

```http
PATCH /driver/{driverId}/vehicles/{vehicleId}/inspections/{inspectionId}
Role: DRIVER

{ "document": { "id": "...", "url": "..." } }
```

**Response `409`:**

```json
{
  "statusCode": 409,
  "message": "Document is accepted. Submit a change request instead of updating it directly.",
  "code": "DOCUMENT_LOCKED"
}
```

**Client action:** show “Request change” UI and call the matching `POST .../change-requests` route.

---

## 6. API routes — admin

Prefix: `{API_BASE}/api/vehicles/admin`

### 6.1 List pending / all requests for a vehicle

```http
GET /vehicles/{vehicleId}/document-change-requests?status=PENDING_REVIEW
Role: ADMIN
```

Optional query:

- `status` — `PENDING_REVIEW` \| `ACCEPTED` \| `REJECTED` \| `CANCELLED`
- `targetType` — `INSPECTION` \| `INSURANCE` \| `PCO_DOCUMENT` \| `PERMISSION_LETTER` \| `SCHEDULE`

### 6.2 List for a driver

```http
GET /drivers/{driverId}/vehicle-document-change-requests?status=PENDING_REVIEW
Role: ADMIN
```

Same query params as above.

### 6.3 Get one request (compare payload vs live doc)

```http
GET /vehicle-document-change-requests/{requestId}
Role: ADMIN
```

Use `data.payload.document` as the proposed file; fetch live document via normal GET inspection/insurance/etc. for current file.

### 6.4 Accept change request

```http
PATCH /vehicle-document-change-requests/{requestId}/review
Role: ADMIN
Content-Type: application/json

{
  "decision": "ACCEPTED"
}
```

Effect:

- Live document `document` (and any other fields in `payload`) updated.
- Live `status` remains `ACCEPTED`.
- Request `status` → `ACCEPTED`.
- Driver emailed (email only).

### 6.5 Reject change request

```http
PATCH /vehicle-document-change-requests/{requestId}/review
Role: ADMIN

{
  "decision": "REJECTED",
  "rejectedReason": "Uploaded file is not readable. Please upload a clearer scan."
}
```

`rejectedReason` is **required** when `decision` is `REJECTED`.

Effect:

- Live document **unchanged**.
- Request `status` → `REJECTED`.
- Driver emailed with reason (email only).

### 6.6 Delete completed change request (admin cleanup)

Use after a request has been reviewed (`ACCEPTED`, `REJECTED`, or `CANCELLED`) to remove the record from the database. **Does not change the live document** — only deletes the change-request row.

```http
DELETE /admin/vehicle-document-change-requests/{requestId}
Role: ADMIN
```

No body.

**Allowed when request `status` is:** `ACCEPTED`, `REJECTED`, or `CANCELLED`.

**Not allowed when `status` is `PENDING_REVIEW`** → `409 Conflict`  
(Reject via review or ask the driver to cancel first.)

**Success:**

```json
{
  "success": true,
  "data": null,
  "message": "Vehicle document change request deleted successfully"
}
```

Typical flow: admin accepts request → live document updated → admin deletes the change-request row to keep the queue/history clean.

---

## 7. End-to-end flows (agent checklist)

### Flow A — First-time document until accepted

1. Driver `POST` live document with `document` → status `PENDING`.
2. Admin `PATCH` live document with `"status": "ACCEPTED"` (admin review route or PATCH with admin role).
3. Driver receives approval email.
4. **Do not** use change-request APIs in this flow.

### Flow B — Replace file after accepted (change request)

1. Confirm live GET shows `status: "ACCEPTED"`.
2. Driver uploads new file via upload service.
3. Driver `POST .../change-requests` with new `document` only.
4. UI shows `pendingChangeRequest` on live document GET.
5. Admin `GET /admin/vehicles/{vehicleId}/document-change-requests?status=PENDING_REVIEW`.
6. Admin `PATCH .../review` with `ACCEPTED` or `REJECTED`.
7. Refresh live GET — `document.url` updated only if accepted; `pendingChangeRequest` becomes null.
8. (Optional) Admin `DELETE /admin/vehicle-document-change-requests/{requestId}` to remove the completed request record.

### Flow C — Driver cancels before admin acts

1. `PATCH /driver/{driverId}/vehicle-document-change-requests/{requestId}/cancel`
2. `pendingChangeRequest` cleared on live document.

### Flow D — Rejected live document (not change request)

1. Live status `REJECTED`.
2. Driver `PATCH` live document with new `document` directly (no change request).
3. Status becomes `PENDING` again for re-review.

---

## 8. Errors to handle in UI

| HTTP | When | User message idea |
|------|------|-------------------|
| `409` + `DOCUMENT_LOCKED` | Driver PATCH on `ACCEPTED` | “Request a change instead of editing directly.” |
| `409` | Second pending request same doc | “You already have a pending change request.” |
| `409` | Admin DELETE while `PENDING_REVIEW` | “Reject or cancel the request first.” |
| `400` | Submit when not `ACCEPTED` | “You can edit this document directly while it is pending review.” |
| `400` | No diff in payload | “No changes detected.” |
| `400` | Reject without `rejectedReason` | “Rejection reason is required.” |
| `403` | Wrong role | “Not allowed.” |
| `404` | Wrong ids | “Document or request not found.” |

---

## 9. Notifications

| Event | Recipient | Channel |
|--------|-----------|---------|
| Change request submitted | Admins | Email only |
| Change request accepted | Driver | Email only |
| Change request rejected | Driver | Email only |
| Live document accepted/rejected (initial review) | Driver | Email only |

Requires RabbitMQ queue `notification_queue` and notification-service running.

---

## 10. Route summary table

| Action | Method | Path |
|--------|--------|------|
| Submit inspection change | POST | `/driver/{driverId}/vehicles/{vehicleId}/inspections/{inspectionId}/change-requests` |
| Submit insurance change | POST | `/driver/{driverId}/vehicles/{vehicleId}/insurances/{insuranceId}/change-requests` |
| Submit PCO change | POST | `/driver/{driverId}/vehicles/{vehicleId}/pco-docs/{pcoDocId}/change-requests` |
| Submit permission letter change | POST | `/driver/{driverId}/vehicles/{vehicleId}/permission-letters/{permissionLetterId}/change-requests` |
| Submit schedule change | POST | `/driver/{driverId}/vehicles/{vehicleId}/schedules/{scheduleId}/change-requests` |
| List requests per document | GET | Same base as submit, without trailing `change-requests` on POST — use `.../{id}/change-requests` |
| Get one request | GET | `/driver/{driverId}/vehicle-document-change-requests/{requestId}` |
| Cancel request | PATCH | `/driver/{driverId}/vehicle-document-change-requests/{requestId}/cancel` |
| Admin list by vehicle | GET | `/admin/vehicles/{vehicleId}/document-change-requests` |
| Admin list by driver | GET | `/admin/drivers/{driverId}/vehicle-document-change-requests` |
| Admin get request | GET | `/admin/vehicle-document-change-requests/{requestId}` |
| Admin review | PATCH | `/admin/vehicle-document-change-requests/{requestId}/review` |
| Admin delete completed request | DELETE | `/admin/vehicle-document-change-requests/{requestId}` |

---

## 11. Optional fields (not required for document-only clients)

If the product later needs them, the same POST bodies may also include (all optional):

| `targetType` | Extra optional fields in submit body |
|--------------|--------------------------------------|
| `INSPECTION` | `inspectionType`, `inspectionDate`, `expiryDate` |
| `INSURANCE` | `provider`, `policyNumber`, `startDate`, `endDate` |
| `PCO_DOCUMENT` | `badgeNumber`, `issueDate`, `expiryDate` |
| `PERMISSION_LETTER` | — (`document` only) |
| `SCHEDULE` | — (`document` only) |

For a **document replacement-only** client, sending only `document` (+ optional `driver_note`) is sufficient.

---

## 12. Related service (outside vehicle-service)

Aggregated driver document status (user-service):

```http
GET {API_BASE}/api/users/driver/{driverId}/document-status
```

Includes vehicle document statuses when vehicle-service is reachable (`vehicleDocumentsLoaded: true`).

---

## 13. Vehicle profile change requests (`Vehicle` model)

Same pattern as document change requests, but for the **`Vehicle`** row (`isApproved` instead of document `status`).

### 13.1 Rules

| `isApproved` | Driver may `PATCH` vehicle? | Driver may submit change request? |
|--------------|----------------------------|-----------------------------------|
| `false` | Yes | No — edit vehicle directly |
| `true` | **No** → `409 VEHICLE_LOCKED` | **Yes** |

Admin sets approval:

```http
PATCH /api/vehicles/admin/vehicles/{vehicleId}/approval
Body: { "isApproved": true }
```

Driver receives **email only** when vehicle is first approved.

### 13.2 Submit vehicle change request (upload-focused example)

Only send fields you want to change. All fields from create/update vehicle are allowed in the body.

```http
POST /driver/{driverId}/vehicles/{vehicleId}/change-requests
Role: DRIVER

{
  "permission_letter": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/permission.pdf"
  },
  "vehicle_schedule": {
    "id": "upload-file-uuid",
    "url": "https://storage.example.com/schedule.pdf"
  },
  "driver_note": "Updated permission letter and schedule"
}
```

You may also include `make`, `model`, `year`, `color`, `plateNumber`, `isActive` if needed.

### 13.3 Driver routes (vehicle profile)

| Action | Method | Path |
|--------|--------|------|
| Submit | POST | `/driver/{driverId}/vehicles/{vehicleId}/change-requests` |
| List | GET | `/driver/{driverId}/vehicles/{vehicleId}/change-requests` |
| Get one | GET | `/driver/{driverId}/vehicle-change-requests/{requestId}` |
| Cancel | PATCH | `/driver/{driverId}/vehicle-change-requests/{requestId}/cancel` |

`GET /driver/{driverId}/vehicles/{vehicleId}` includes `pendingChangeRequest` when applicable.

### 13.4 Admin routes (vehicle profile)

| Action | Method | Path |
|--------|--------|------|
| List by vehicle | GET | `/admin/vehicles/{vehicleId}/vehicle-change-requests` |
| List by driver | GET | `/admin/drivers/{driverId}/vehicle-change-requests` |
| Get one | GET | `/admin/vehicle-profile-change-requests/{requestId}` |
| Review | PATCH | `/admin/vehicle-profile-change-requests/{requestId}/review` |
| Delete completed | DELETE | `/admin/vehicle-profile-change-requests/{requestId}` |

Review body (same as documents):

```json
{ "decision": "ACCEPTED" }
```

```json
{
  "decision": "REJECTED",
  "rejectedReason": "Plate number format is invalid on the uploaded documents."
}
```

### 13.5 Errors

| Code | When |
|------|------|
| `VEHICLE_LOCKED` | Driver PATCH/DELETE on approved vehicle |
| `409` | Pending change request already exists |
| `400` | Submit when `isApproved` is false |
