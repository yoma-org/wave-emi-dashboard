# V3 Vision Pipeline — Deployment & Testing Guide

## Quick Status

- [x] Step 0: Groq Vision API test — PASSED (llama-4-scout model available)
- [x] Step 1: v3 JSON built with all fixes, pushed to GitHub
- [x] Step 2: Gmail Trigger verified — attachment_0 binary present (727 kB, image/png)
- [x] Step 3: Deactivated v2 pipeline
- [ ] **Step 4: Import v3 into n8n Cloud** <-- YOU ARE HERE
- [ ] Step 5: Set credentials (Gmail + Groq API key)
- [ ] Step 6: Test full pipeline with attachment
- [ ] Step 7: Test without attachment (v2 compatibility)
- [ ] Step 8: Publish to production

---

## What's Fixed in This JSON (all debugged issues resolved)

| Issue | Fix Applied |
|-------|------------|
| `this.getWorkflowStaticData is not a function` | Replaced with `$getWorkflowStaticData('global')` (Task Runner compatible) |
| `this.helpers.httpRequest` not available | Replaced with `helpers.httpRequest()` (no `this.`) |
| `this.helpers.getBinaryDataBuffer` not available | Replaced with `helpers.getBinaryDataBuffer()` (no `this.`) |
| Code node mode wrong | Both Code nodes set to `"mode": "runOnceForEachItem"` |
| Gmail Trigger missing Download Attachments | typeVersion 1.3, `downloadAttachments: true` under `options` |
| GitHub Push Protection blocking API keys | All keys replaced with `REPLACE_WITH_GROQ_API_KEY` placeholder |
| Missing `Bearer` prefix on API key | Already included in header value — just paste key after `Bearer ` |

---

## Step 4: Import v3 into n8n Cloud

1. **Delete** the current v3 workflow in n8n Cloud (if any exists)
2. Download `n8n-workflow-v3.json` from GitHub (or use the local file)
3. In n8n Cloud: **Add Workflow** > **Import from file** > select the JSON
4. Verify you see **9 nodes** in the workflow canvas:
   - Webhook Trigger
   - Gmail Trigger
   - Prepare for AI v3
   - Groq AI Extract
   - Vision Process
   - AI Parse & Validate v3
   - Route by Source
   - Respond with Dashboard URL
   - Send Gmail Notification

---

## Step 5: Set Credentials

### 5a: Gmail OAuth2 (2 nodes)

1. **Gmail Trigger** > Parameters > Credential > select your Gmail OAuth2
2. **Send Gmail Notification** > Parameters > Credential > select your Gmail OAuth2

### 5b: Verify Gmail Trigger Settings

After import, double-check:
- **Parameters > Options > Download Attachments** = ON
- **Simplify** = OFF
- If Download Attachments is missing, upgrade node to v1.3 (click version at bottom of Settings tab)

### 5c: Groq API Key (2 places)

Your key: (use your Groq API key from https://console.groq.com/keys)

**Place 1 — Groq AI Extract (HTTP Request node):**
- Click the node > Headers > Authorization
- Replace `REPLACE_WITH_GROQ_API_KEY` so the full value reads:
  ```
  Bearer <YOUR_GROQ_API_KEY>
  ```
- **Keep the `Bearer ` prefix!** (with space after it)

**Place 2 — Vision Process (Code node):**
- Click the node > find `REPLACE_WITH_GROQ_API_KEY` in the code (~line 43)
- Replace so the line reads:
  ```javascript
  'Authorization': 'Bearer <YOUR_GROQ_API_KEY>',
  ```

### 5d: Verify Code Node Modes

Should be correct from import, but double-check:
- **Prepare for AI v3** > Mode: **Run Once for Each Item**
- **Vision Process** > Mode: **Run Once for Each Item**

### 5e: Verify Code Has No `this.` (Quick Sanity Check)

Click into each Code node and search (Ctrl+F) for `this.` — there should be **zero** matches.
- Prepare for AI v3: should use `$getWorkflowStaticData` and `helpers.getBinaryDataBuffer`
- Vision Process: should use `$getWorkflowStaticData` and `helpers.httpRequest`

---

## Step 6: Test Full Pipeline (WITH Attachment)

1. Load the test email in Gmail Trigger (Fetch Test Event — use the email with PNG attachment)
2. Click **Test Workflow** (runs all nodes)
3. Check each node output:

### Node: Prepare for AI v3
| Field | Expected |
|-------|----------|
| `vision_eligible` | `true` |
| `attachment_base64` | Object with `base64`, `mimeType`, `filename` |
| `attachment_count` | `1` |
| `_source` | `email` |
| `from_email` | sender's address |
| `original_subject` | "Salary Disbursement Request - ACME Innovations Ltd" |

### Node: Groq AI Extract
| Field | Expected |
|-------|----------|
| `choices[0].message.content` | JSON with company, amount, approvers |

### Node: Vision Process
| Field | Expected |
|-------|----------|
| `_vision_status` | `"success"` |
| `_vision_result.doc_type` | `"bank_slip"` or similar |
| `_vision_result.total_amount` | A number from the image |
| `_vision_result.confidence` | 0.0 to 1.0 |
| `attachment_base64` | Should NOT be present (cleared after use) |

### Node: AI Parse & Validate v3
| Field | Expected |
|-------|----------|
| `vision_parsed` | `true` |
| `vision_confidence` | Same as above |
| `amount` | From email text |
| `amount_on_document` | From bank slip image |
| `scenario` | `NORMAL` or `AMOUNT_MISMATCH` |
| `dashboard_url` | Long URL with base64 ticket |

### Node: Send Gmail Notification
- Branded email sent to xaondk@gmail.com
- Contains dashboard URL
- Open URL > Finance page > should show Vision AI block

**Troubleshooting:**
| Symptom | Fix |
|---------|-----|
| `_vision_status: "api_error"` | Check Groq API key in Vision Process code |
| `_vision_status: "none"` | Check `vision_eligible` in Prepare node |
| `this.getWorkflowStaticData is not a function` | Code still has old `this.` syntax — re-import JSON |
| `getBinaryDataBuffer` error | n8n Cloud version must be >= 1.114.0 |
| No `attachment_0` in Gmail Trigger | Download Attachments not ON (Parameters > Options) |

---

## Step 7: Test WITHOUT Attachment (v2 Compatibility)

Send a new email to **xaondk@gmail.com** with NO attachment:

**Subject:**
```
Salary Disbursement - Golden Dragon Ltd
```

**Body:**
```
Please process salary disbursement for Golden Dragon Ltd.
Amount: 15,000,000 MMK (SalaryToMA)

Approved by:
- U Aung Myint, Sales HOD — Approved
- Daw Su Su Lwin, Finance Manager — Approved
```

**Expected (should behave like v2):**
- `vision_eligible: false`
- `_vision_status: "none"`
- `vision_parsed: false`
- Text extraction + authority matrix + notification all work normally
- No Vision AI block on dashboard Finance page

---

## Step 8: Publish to Production

1. Toggle v3 workflow **Active** in n8n Cloud
2. Keep **v2 deactivated** (both trigger on xaondk@gmail.com)
3. v3 handles everything v2 did + vision

**Rollback:** Deactivate v3, reactivate v2. They are independent workflows.

---

## Reference Notes

### Pipeline Mailbox
- **xaondk@gmail.com** (NOT dknguyen0105vietnam@gmail.com)

### n8n Task Runner (Cloud 2.14.2)
Code nodes run in a JS sandbox. The old `this.*` API does NOT work:
- `this.getWorkflowStaticData()` --> `$getWorkflowStaticData()`
- `this.helpers.httpRequest()` --> `helpers.httpRequest()`
- `this.helpers.getBinaryDataBuffer()` --> `helpers.getBinaryDataBuffer()`

### Rate Limits
- Static Data only persists in **production** (active workflow), NOT manual test clicks
- 100 text calls/day, 20 vision calls/day, circuit breaker at 3 consecutive errors
- For demo: don't worry about limits — plenty of headroom

### Gmail Trigger v1.3
- Download Attachments toggle: **Parameters > Options** (NOT Settings tab)
- Simplify: OFF (need full headers)
- Attachments arrive as binary: `attachment_0`, `attachment_1`, etc.
