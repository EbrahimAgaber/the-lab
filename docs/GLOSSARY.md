# The Lab Glossary (معجم مصطلحات المعمل الذكي)

Standard domain terminology mapping for all UI copy, error messages, and documentation.

## Master Data (البيانات الرئيسية)

| Arabic Term (الاسم المعتمد) | English Equivalent | Context / Definition |
|---|---|---|
| صنف | Item | Master item record (raw material, packaging, intermediate, finished) |
| مادة خام | Raw Material | Raw ingredient entering production (RAW) |
| مادة تعبئة وتغليف | Packaging Material | Primary/secondary packaging (PKG) |
| منتج نصف مصنّع | Intermediate Product | Semi-finished good generated during processing |
| منتج تام الصنع | Finished Good | Final marketable product |
| وحدة القياس | Unit of Measure (UoM) | Standard counting/weight/volume unit (KG, G, L, ML, PCS, etc.) |
| موقع تخزين | Storage Location | Warehouse, cold room, quarantine, scrap yard |
| مركز عمل / خط إنتاج | Work Center | Machine, line, or workstation with labor and overhead rates |
| مورّد | Supplier | Vendor supplying raw materials or services |

## Manufacturing & Costing (التشغيل والتكاليف)

| Arabic Term | English Equivalent | Context / Definition |
|---|---|---|
| وصفة تشغيل / تركيبة | Recipe / Formula | Standard Bill of Materials and operations for producing a batch |
| أمر تشغيل / إنتاج | Work Order | Production order executing a recipe for a specified quantity |
| هدر مسموح | Scrap Tolerance | Planned shrinkage or process loss percentage |
| منتج ثانوي | By-product | Recovered material with salvage value |
| مرحلة تشغيل | Routing Step | Specific operation performed at a work center |
| التكلفة المعيارية | Standard Cost | Baseline theoretical cost calculated from formula and routing |
| تكلفة فعلية | Actual Cost | Realized cost based on consumed lots and recorded labor hours |
| انحراف التكلفة | Cost Variance | Delta between standard planned cost and actual recorded cost |
| حجز مواد | Material Reservation | Allocating specific available lots to an upcoming work order |
| استهلاك مواد | Material Consumption | Deducting lots used in the work order from inventory |
| تسجيل الإنتاج الفعلي | Production Yield / Completion | Recording finished batch output lots and closing work order |

## Inventory & Quality Control (المخزون وضبط الجودة)

| Arabic Term | English Equivalent | Context / Definition |
|---|---|---|
| رقم التشغيلة / الدفعة | Lot / Batch Number | Unique tracking identifier for manufactured or received lots |
| حركة مخزون | Stock Movement | Any quantity delta (receipt, issue, transfer, consumption, yield) |
| رصيد متاح | Stock on Hand | Currently available inventory balance |
| حجر صحي / قيد الفحص | Quarantine | Initial QC status before lab inspection and approval |
| مُجاز / معتمد | Released (QC) | Approved for production consumption or delivery |
| مرفوض | Rejected (QC) | Fails quality specs; quarantined for scrap or return |
| جرد المخزون | Stock Count | Physical count verification and variance adjustment |
| فحص الجودة | Quality Inspection | Testing parameters against item specification sheets |
| شهادة مطابقة / تحليل | Certificate of Analysis (CoA) | Document affirming batch quality metrics |
| تتبّع التشغيلة | Lot Traceability | Forward (usage) and backward (provenance) lot genealogy |
