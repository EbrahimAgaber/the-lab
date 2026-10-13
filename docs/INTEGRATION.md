# The Lab (المعمل الذكي) — External Integration Contracts

This document specifies the integration contracts for The Lab. In compliance with Architecture Rule 8, integration with external systems (such as external POS, ERPs, or suppliers) is governed **strictly by contract**. No adapter implementation is included in this phase.

---

## 1. Outbox Pattern & Event Contract

To guarantee reliable, at-least-once, transactional message delivery to external systems without distributed transactions, The Lab uses a transactional outbox table inside its local SQLite database.

### Outbox Schema
```sql
CREATE TABLE sys_outbox (
  id TEXT PRIMARY KEY,                       -- UUIDv7 monotonic identifier
  event_name TEXT NOT NULL,                   -- e.g. 'inventory.movement.created'
  event_version INTEGER NOT NULL DEFAULT 1,   -- Schema revision number
  aggregate_type TEXT NOT NULL,               -- e.g. 'work_order', 'stock_movement'
  aggregate_id TEXT NOT NULL,                 -- ID of the modified entity
  payload_json TEXT NOT NULL,                 -- Full event payload matching schema
  idempotency_key TEXT NOT NULL UNIQUE,       -- Caller idempotency token
  occurred_at TEXT NOT NULL,                  -- ISO-8601 UTC timestamp
  published_at TEXT,                          -- NULL until exported/acknowledged
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX idx_sys_outbox_pending ON sys_outbox(published_at) WHERE published_at IS NULL;
```

---

## 2. Standard Event Specifications

All events adhere to a standard envelope:
```json
{
  "eventId": "018f4a10-2b3c-7000-8000-000000000001",
  "eventType": "inventory.movement.created",
  "version": 1,
  "timestamp": "2026-10-13T14:30:00.000Z",
  "producer": "the-lab.v1",
  "idempotencyKey": "wo-finish-wo-2026-00041-yield",
  "payload": {}
}
```

### Event 1: `inventory.movement.created` (v1)
Emitted whenever a movement is committed to the stock ledger.
```json
{
  "movementId": "mov-01928374",
  "type": "PRODUCTION_YIELD",
  "itemId": "itm-tomato-paste-800g",
  "lotNumber": "LT-20261013-01",
  "locationId": "loc-fg-central-wh",
  "quantityMinor": 5000000,
  "quantityScale": 4,
  "displayQuantity": "500.0000",
  "unit": "kg",
  "unitCostMinor": 1250,
  "costMinorTotal": 625000,
  "currency": "SAR",
  "referenceType": "WORK_ORDER",
  "referenceId": "WO-2026-00041",
  "actorId": "usr-supervisor-01"
}
```

### Event 2: `production.completed` (v1)
Emitted when a work order completes manufacturing and passes yield/scrap reconciliation.
```json
{
  "workOrderId": "WO-2026-00041",
  "recipeId": "rcp-tomato-paste-v2",
  "workCenterId": "wc-blending-line-1",
  "plannedQuantity": "500.0000",
  "actualYield": "495.5000",
  "scrapQuantity": "4.5000",
  "yieldPercentage": "99.10",
  "totalCostMinor": 625000,
  "producedLots": [
    {
      "lotNumber": "LT-20261013-01",
      "quantity": "495.5000",
      "expiryDate": "2027-10-13",
      "qcState": "QUARANTINE"
    }
  ],
  "consumedLots": [
    { "lotNumber": "RAW-TOM-2610", "itemId": "itm-fresh-tomato", "quantity": "600.0000" },
    { "lotNumber": "RAW-SLT-2601", "itemId": "itm-salt-foodgrade", "quantity": "15.0000" }
  ],
  "completedAt": "2026-10-13T14:28:00.000Z"
}
```

### Event 3: `purchase.received` (v1)
Emitted when goods arrive from a purchase order and enter quarantine inspection.
```json
{
  "receiptId": "GRN-2026-00109",
  "purchaseOrderId": "PO-2026-00088",
  "supplierId": "sup-almarai-industrial",
  "receivedItems": [
    {
      "itemId": "itm-whole-milk-bulk",
      "lotNumber": "LT-MILK-9901",
      "quantity": "1000.0000",
      "unit": "l",
      "unitPriceMinor": 420,
      "expiryDate": "2026-10-25",
      "targetLocationId": "loc-quarantine-coldroom"
    }
  ],
  "receivedAt": "2026-10-13T11:15:00.000Z"
}
```

---

## 3. Asynchronous File-Exchange Contract (CSV/Excel)

For non-networked environments or legacy ERP integrations, The Lab supports a deterministic, versioned CSV file exchange contract.

### File Format Standards
- **Encoding**: UTF-8 with Byte Order Mark (BOM) to guarantee clean rendering in Microsoft Excel for Arabic strings.
- **Delimiter**: Comma (`,`), quote character double-quote (`"`), escaping doubled quote (`""`).
- **Date Format**: ISO-8601 extended (`YYYY-MM-DDTHH:mm:ssZ`).
- **Money**: Exported in major units with 2 decimal places (`12.50 SAR`) and integer minor units in a separate raw column (`1250`).
- **Bidi**: Arabic text is unmodified logical order; lot and SKU codes are plain ASCII.

### Batch Import Format: Item Master (`items_import_v1.csv`)
```csv
code,name_ar,name_en,type,uom_code,cost_halalas,reorder_point,is_active
ITM-001,"طماطم طازجة صنف أ","Fresh Tomato Grade A",RAW,KG,250,500.0000,1
ITM-002,"معجون طماطم 800 جم","Tomato Paste 800g",FINISHED,PCS,1250,100.0000,1
```

### Batch Export Format: Inventory Movements (`movements_export_v1.csv`)
```csv
movement_id,timestamp,movement_type,item_code,lot_number,location_code,quantity_delta,unit_code,unit_cost_halalas,reference_type,reference_id,actor_id
MOV-1001,2026-10-13T10:00:00Z,RECEIPT,ITM-001,LT-261013-01,LOC-RAW,+1000.0000,KG,250,PURCHASE_RECEIPT,PO-88,USR-01
MOV-1002,2026-10-13T13:30:00Z,PRODUCTION_CONSUME,ITM-001,LT-261013-01,LOC-RAW,-600.0000,KG,250,WORK_ORDER,WO-41,USR-02
```
