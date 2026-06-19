/***************************************************************
 * ExpenseRequestBulkActions.gs
 ***************************************************************/

/**
 * Bulk approval / rejection / hold update
 */
function bulkUpdateExpenseRequestApproval_(data) {
  const requestIds = Array.isArray(data.requestIds)
    ? data.requestIds.map(toStr_).filter(Boolean)
    : [];

  if (!requestIds.length) {
    throw new Error("No requestIds provided");
  }

  const reqSheet = getExpenseRequestsSheet_();
  const headers = getHeaders_(reqSheet);
  const values = reqSheet.getDataRange().getValues();

  const reqIdIdx = headers.indexOf("Request ID");

  if (reqIdIdx < 0) {
    throw new Error("Expense Requests missing Request ID");
  }

  const updated = [];
  const skipped = [];

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const currentId = toStr_(row[reqIdIdx]);

    if (!requestIds.includes(currentId)) continue;

    const obj = {};
    headers.forEach((h, j) => {
      obj[h] = row[j];
    });

    // =========================================================
    // UPDATE VALUES
    // =========================================================

    obj["Approval Status"] =
      toStr_(data.approvalStatus) ||
      toStr_(obj["Approval Status"]);

    obj["Linked Entity Type"] =
      toStr_(data["Linked Entity Type"]) ||
      toStr_(obj["Linked Entity Type"]);

    obj["Linked Entity ID"] =
      toStr_(data["Linked Entity ID"]) ||
      toStr_(obj["Linked Entity ID"]);

    obj["Linked Entity Name"] =
      toStr_(data["Linked Entity Name"]) ||
      toStr_(obj["Linked Entity Name"]);

    obj["Existing Cost Sheet ID"] =
      toStr_(data["Existing Cost Sheet ID"]) ||
      toStr_(obj["Existing Cost Sheet ID"]);

    obj["Existing Cost Sheet Name"] =
      toStr_(data["Existing Cost Sheet Name"]) ||
      toStr_(obj["Existing Cost Sheet Name"]);

    obj["Operations Remarks"] =
      toStr_(data["Operations Remarks"]) ||
      toStr_(obj["Operations Remarks"]);

    obj["Rejection Remarks"] =
      toStr_(data["Rejection Remarks"]) ||
      toStr_(obj["Rejection Remarks"]);

    obj["Hold Remarks"] =
      toStr_(data["Hold Remarks"]) ||
      toStr_(obj["Hold Remarks"]);

    // =========================================================
    // ATTRIBUTION STATUS
    // =========================================================

    const hasCostSheet =
      toStr_(obj["Existing Cost Sheet ID"]);

    const hasLinkedEntity =
      toStr_(obj["Linked Entity ID"]) ||
      toStr_(obj["Linked Entity Name"]);

    obj["Attribution Status"] =
      (hasCostSheet || hasLinkedEntity)
        ? "Mapped"
        : "Pending Mapping";

    // =========================================================
    // AUDIT
    // =========================================================

    obj["Last Updated On"] = now_();

    if (headers.includes("Action By")) {
      obj["Action By"] =
        toStr_(data.actionBy) ||
        toStr_(obj["Action By"]);
    }

    if (headers.includes("Action By Email")) {
      obj["Action By Email"] =
        toStr_(data.actionByEmail) ||
        toStr_(obj["Action By Email"]);
    }

    if (headers.includes("Action By Role")) {
      obj["Action By Role"] =
        toStr_(data.actionByRole) ||
        toStr_(obj["Action By Role"]);
    }

    // =========================================================
    // WRITE ROW
    // =========================================================

    const updatedRow = buildRowFromHeaders_(headers, obj);

    reqSheet
      .getRange(i + 1, 1, 1, headers.length)
      .setValues([updatedRow]);

    updated.push(currentId);
  }

  return {
    success: true,
    updatedCount: updated.length,
    updated: updated,
    skipped: skipped
  };
}


/**
 * Resolve cost sheet from:
 * 1. Existing Cost Sheet
 * 2. Linked Entity mapping
 */
function resolveCostSheetForExpenseSync_(reqObj, data) {

  const explicitCostSheetId = toStr_(
    data["Existing Cost Sheet ID"] ||
    reqObj["Existing Cost Sheet ID"]
  );

  const costSheets = getCostSheets_();

  // =========================================================
  // DIRECT COST SHEET
  // =========================================================

  if (explicitCostSheetId) {

    const matchedDirect = costSheets.find(function (r) {
      return (
        toStr_(r["Cost Sheet ID"]) === explicitCostSheetId
      );
    });

    if (!matchedDirect) {
      throw new Error(
        "Mapped Cost Sheet not found: " +
        explicitCostSheetId
      );
    }

    return matchedDirect;
  }

  // =========================================================
  // LINKED ENTITY
  // =========================================================

  const linkedEntityType = toStr_(
    data["Linked Entity Type"] ||
    reqObj["Linked Entity Type"]
  );

  const linkedEntityId = toStr_(
    data["Linked Entity ID"] ||
    reqObj["Linked Entity ID"]
  );

  const linkedEntityName = toStr_(
    data["Linked Entity Name"] ||
    reqObj["Linked Entity Name"]
  );

  if (
    !linkedEntityType &&
    !linkedEntityId &&
    !linkedEntityName
  ) {
    throw new Error(
      "Either Existing Cost Sheet or Linked Entity mapping is required before sync"
    );
  }

  let matched = null;

  // Exact type + ID
  if (linkedEntityType && linkedEntityId) {

    matched = costSheets.find(function (r) {
      return (
        toStr_(r["Linked Entity Type"]) === linkedEntityType &&
        toStr_(r["Linked Entity ID"]) === linkedEntityId
      );
    });
  }

  // Type + Name
  if (!matched && linkedEntityType && linkedEntityName) {

    matched = costSheets.find(function (r) {
      return (
        toStr_(r["Linked Entity Type"]) === linkedEntityType &&
        toStr_(r["Linked Entity Name"]) === linkedEntityName
      );
    });
  }

  // ID only
  if (!matched && linkedEntityId) {

    matched = costSheets.find(function (r) {
      return (
        toStr_(r["Linked Entity ID"]) === linkedEntityId
      );
    });
  }

  // Name only
  if (!matched && linkedEntityName) {

    matched = costSheets.find(function (r) {
      return (
        toStr_(r["Linked Entity Name"]) === linkedEntityName
      );
    });
  }

  if (!matched) {
    throw new Error(
      "No Cost Sheet found for linked entity mapping: " +
      [
        linkedEntityType,
        linkedEntityId,
        linkedEntityName
      ]
      .filter(Boolean)
      .join(" | ")
    );
  }

  return matched;
}


/**
 * Bulk sync expense requests
 */
function bulkSyncExpenseRequestsToCostLine_(data) {

  const requestIds = Array.isArray(data.requestIds)
    ? data.requestIds.map(toStr_).filter(Boolean)
    : [];

  if (!requestIds.length) {
    throw new Error("No requestIds provided");
  }

  const results = [];
  const errors = [];

  requestIds.forEach(function (requestId) {

    try {

      const res = syncExpenseRequestToCostLine_({
        requestId: requestId,

        syncedBy: data.syncedBy,
        syncedByEmail: data.syncedByEmail,
        syncedByRole: data.syncedByRole,

        headName: data.headName,
        subcategory: data.subcategory,

        amount: data.amount,
        gstPct: data.gstPct,

        expenseDate: data.expenseDate,
        details: data.details,

        paymentStatus: data.paymentStatus,
        voucherNo: data.voucherNo,

        "Linked Entity Type":
          data["Linked Entity Type"],

        "Linked Entity ID":
          data["Linked Entity ID"],

        "Linked Entity Name":
          data["Linked Entity Name"],

        "Existing Cost Sheet ID":
          data["Existing Cost Sheet ID"],

        "Existing Cost Sheet Name":
          data["Existing Cost Sheet Name"]
      });

      results.push({
        requestId: requestId,
        success: true,
        response: res
      });

    } catch (err) {

      Logger.log(
        "BULK_SYNC_ERROR requestId=" +
        requestId +
        " error=" +
        err
      );

      errors.push({
        requestId: requestId,
        success: false,
        error: String(err)
      });
    }
  });

  return {
    success: errors.length === 0,
    processed: results.length,
    failed: errors.length,
    results: results,
    errors: errors
  };
}

function bulkReviewExpenseRequests_(data) {
  const rows = Array.isArray(data.rows) ? data.rows : [];

  if (!rows.length) {
    throw new Error("bulkReviewExpenseRequests_ requires rows");
  }

  const reqSheet = getExpenseRequestsSheet_();
  const headers = getHeaders_(reqSheet);
  const values = reqSheet.getDataRange().getValues();

  const reqIdIdx = headers.indexOf("Request ID");
  if (reqIdIdx < 0) throw new Error("Expense Requests missing Request ID");

  const updated = [];
  const missing = [];

  rows.forEach(function (incoming) {
    const requestId = toStr_(incoming.requestId);
    if (!requestId) return;

    let rowIndex = -1;
    let obj = null;

    for (let i = 1; i < values.length; i++) {
      if (toStr_(values[i][reqIdIdx]) === requestId) {
        rowIndex = i + 1;
        obj = {};
        headers.forEach(function (h, j) {
          obj[h] = values[i][j];
        });
        break;
      }
    }

    if (!obj || rowIndex < 0) {
      missing.push(requestId);
      return;
    }

    obj["Approval Status"] = toStr_(incoming.approvalStatus || obj["Approval Status"]);

    if (headers.includes("Particular")) {
      obj["Particular"] = toStr_(incoming.particular || obj["Particular"]);
    }

    if (headers.includes("Description")) {
      obj["Description"] = toStr_(incoming.description || obj["Description"]);
    }

    if (headers.includes("Amount")) {
      const amount = toNum_(incoming.amount);
      obj["Amount"] = amount || obj["Amount"];
    }

    obj["Linked Entity Type"] =
      toStr_(incoming["Linked Entity Type"]) || toStr_(obj["Linked Entity Type"]);

    obj["Linked Entity ID"] =
      toStr_(incoming["Linked Entity ID"]) || toStr_(obj["Linked Entity ID"]);

    obj["Linked Entity Name"] =
      toStr_(incoming["Linked Entity Name"]) || toStr_(obj["Linked Entity Name"]);

    obj["Existing Cost Sheet ID"] =
      toStr_(incoming["Existing Cost Sheet ID"]) || toStr_(obj["Existing Cost Sheet ID"]);

    obj["Existing Cost Sheet Name"] =
      toStr_(incoming["Existing Cost Sheet Name"]) || toStr_(obj["Existing Cost Sheet Name"]);

    obj["Operations Remarks"] =
      toStr_(incoming.operationsRemarks) || toStr_(obj["Operations Remarks"]);

    obj["Rejection Remarks"] =
      toStr_(incoming.rejectionRemarks) || toStr_(obj["Rejection Remarks"]);

    obj["Hold Remarks"] =
      toStr_(incoming.holdRemarks) || toStr_(obj["Hold Remarks"]);

    const hasCostSheet = toStr_(obj["Existing Cost Sheet ID"]);
    const hasLinkedEntity =
      toStr_(obj["Linked Entity ID"]) || toStr_(obj["Linked Entity Name"]);

    obj["Attribution Status"] =
      hasCostSheet || hasLinkedEntity ? "Mapped" : "Pending Mapping";

    obj["Last Updated On"] = now_();

    if (headers.includes("Action By")) {
      obj["Action By"] = toStr_(data.actionBy);
    }

    if (headers.includes("Action By Email")) {
      obj["Action By Email"] = toStr_(data.actionByEmail);
    }

    if (headers.includes("Action By Role")) {
      obj["Action By Role"] = toStr_(data.actionByRole);
    }

    const updatedRow = buildRowFromHeaders_(headers, obj);
    reqSheet.getRange(rowIndex, 1, 1, headers.length).setValues([updatedRow]);

    updated.push(requestId);
  });

  return {
    success: true,
    updatedCount: updated.length,
    updated: updated,
    missing: missing
  };
}