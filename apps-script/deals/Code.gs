function generatePrefilledLinksForResponses() {
  var sheetId = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4'; // Replace with your actual sheet ID
  var targetSheetName = 'Form responses 1'; // Replace with your actual sheet name
  
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(targetSheetName);

  if (!sheet) {
    Logger.log('Sheet not found: ' + targetSheetName);
    return; // Exit if the sheet does not exist
  }
  
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();

  // Ensure there is data in the sheet
  if (data.length < 2) {
    Logger.log('No data found in the sheet.');
    return; // Exit if there are no data rows
  }
  
  for (var i = 1; i < data.length; i++) {
    var responses = data[i];

    // Check if the required fields are not blank
    if (responses[0] && responses[1] && responses[2]) { // Adjust the indices based on your requirements
      // Generate the prefilled link for the current row
      var prefilledLink = generatePrefilledLink(responses);
      
      // Update the last column (column AS, which is index 44)
      sheet.getRange(i + 1, 44).setFormula('=HYPERLINK("' + prefilledLink + '", "Update Deal")'); // Set the clickable hyperlink
      Logger.log('Prefilled link generated and stored for row ' + (i + 1));
    } else {
      Logger.log('Skipping row ' + (i + 1) + ' due to missing essential fields.');
    }
  }
}

function generatePrefilledLink(responses) {
  // Map the required fields to the corresponding entries
  var endUser = responses[1]; // Account Owner
  var firstName = responses[2]; // First Name
  var lastName = responses[3]; // Last Name
  var company = responses[4]; // Company
  var mobileNumber = responses[5]; // Mobile Number
  var emailID = responses[6]; // Email ID
  var fax = responses[7]; // Fax
  var website = responses[8]; // Website
  var leadSource = responses[9]; // Lead Source
  var leadStatus = responses[10]; // Lead Status
  var industry = responses[11]; // Industry
  var numberOfEmployees = responses[12]; // Number of Employees
  var annualRevenue = responses[13]; // Annual Revenue
  var socialMedia = responses[14]; // Social Media
  var description = responses[15]; // Description
  var street = responses[16]; // Street
  var city = responses[17]; // City
  var state = responses[18]; // State
  var country = responses[19]; // Country
  var pincode = responses[20]; // PinCode
  var additionalDescription = responses[21]; // Additional Description
  var accountID = responses[22]; // Account ID
  var gstNumber = responses[23]; // GST Number
  var bankAccountNumber = responses[24]; // Bank Account Number
  var ifscCode = responses[25]; // IFSC Code
  var bankName = responses[26]; // Bank Name
  var bankAccountName = responses[27]; // Bank Account Name
  var bankingRemarks = responses[28]; // Banking Remarks
  var dealName = responses[29]; // Deal Name
  var dealType = responses[30]; // Type
  var dealAmount = responses[31]; // Deal Amount
  var nextStep = responses[32]; // Next Step
  var productRequired = responses[33]; // Product Required
  var remarks = responses[34]; // Remarks
  var stage = responses[35]; // Stage
  var orderID = responses[36]; // Order ID
  var orderAmount = responses[37]; // Order Amount
  var productDescription = responses[38]; // Product Description
  var orderDeliveryDetails = responses[40]; // Order Delivery Details
  var deliveryDate = responses[41]; // Delivery Date
  var orderRemarks = responses[42]; // Order Remarks

  // Generate the prefilled form link
  var prefilledLink = "https://docs.google.com/forms/d/e/1FAIpQLScOoleoqy7iakcsb7eUa8DLpEkw-ALndYdpo16LBZIdWfqbdw/viewform?usp=pp_url"
    + "&entry.382320733=" + encodeURIComponent(endUser)
    + "&entry.97376243=" + encodeURIComponent(firstName)
    + "&entry.461328421=" + encodeURIComponent(lastName)
    + "&entry.595395094=" + encodeURIComponent(company)
    + "&entry.159263935=" + encodeURIComponent(mobileNumber)
    + "&entry.288566598=" + encodeURIComponent(emailID)
    + "&entry.1830695020=" + encodeURIComponent(fax)
    + "&entry.1638620245=" + encodeURIComponent(website)
    + "&entry.1083761663=" + encodeURIComponent(leadSource)
    + "&entry.396867408=" + encodeURIComponent(leadStatus)
    + "&entry.1376066188=" + encodeURIComponent(industry)
    + "&entry.43979889=" + encodeURIComponent(numberOfEmployees)
    + "&entry.1989724413=" + encodeURIComponent(annualRevenue)
    + "&entry.1019765555=" + encodeURIComponent(socialMedia)
    + "&entry.1922882768=" + encodeURIComponent(description)
    + "&entry.2064231740=" + encodeURIComponent(street)
    + "&entry.1963491498=" + encodeURIComponent(city)
    + "&entry.1998507869=" + encodeURIComponent(state)
    + "&entry.1748437282=" + encodeURIComponent(country)
    + "&entry.369502378=" + encodeURIComponent(pincode)
    + "&entry.1066602877=" + encodeURIComponent(additionalDescription)
    + "&entry.832822168=" + encodeURIComponent(accountID)
    + "&entry.922424116=" + encodeURIComponent(gstNumber)
    + "&entry.1606909393=" + encodeURIComponent(bankAccountNumber)
    + "&entry.2063634235=" + encodeURIComponent(ifscCode)
    + "&entry.1261442588=" + encodeURIComponent(bankName)
    + "&entry.114694574=" + encodeURIComponent(bankAccountName)
    + "&entry.987626635=" + encodeURIComponent(bankingRemarks)
    + "&entry.1214907790=" + encodeURIComponent(dealName)
    + "&entry.1234322722=" + encodeURIComponent(dealType)
    + "&entry.1952574484=" + encodeURIComponent(dealAmount)
    + "&entry.2128333512=" + encodeURIComponent(nextStep)
    + "&entry.1077039398=" + encodeURIComponent(productRequired)
    + "&entry.1961730843=" + encodeURIComponent(remarks)
    + "&entry.1105858135=" + encodeURIComponent(stage)
    + "&entry.747452085=" + encodeURIComponent(orderAmount)
    + "&entry.1705310808=" + encodeURIComponent(productDescription)
    + "&entry.1509191017=" + encodeURIComponent(orderDeliveryDetails)
    + "&entry.2130715014=" + encodeURIComponent(deliveryDate)
    + "&entry.1460629656=" + encodeURIComponent(orderRemarks)
    + "&entry.1252259963=" + encodeURIComponent(orderID);

  return prefilledLink;
}
function distributeDealsToEndUsers() {
  var dealsSheetId = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4'; // Sheet ID where deals are stored
  var dealsSheetName = 'Form responses 1'; // Sheet name for deals
  var usersFolderId = '14KwGob5YpqkzGY52frxC_iGvT2hD5tz9'; // Folder ID containing user sheets

  var ss = SpreadsheetApp.openById(dealsSheetId);
  var dealsSheet = ss.getSheetByName(dealsSheetName);

  if (!dealsSheet) {
    Logger.log('Deals sheet not found: ' + dealsSheetName);
    return; // Exit if the deals sheet does not exist
  }

  var dealsDataRange = dealsSheet.getDataRange();
  var dealsData = dealsDataRange.getValues();

  // Create a map of end users to their corresponding file IDs
  var userFiles = {};
  var userSheets = DriveApp.getFolderById(usersFolderId).getFiles(); // Get user sheets in the folder

  while (userSheets.hasNext()) {
    var userFile = userSheets.next();
    var userSheet = SpreadsheetApp.open(userFile);
    var userSheetName = userSheet.getName(); // Assuming the sheet is named after the end user
    userFiles[userSheetName] = userFile.getId(); // Store the user file ID in the map
  }

  for (var i = 1; i < dealsData.length; i++) {
    var deal = dealsData[i];

    // Get the end user name from the deal data (adjust index based on your setup)
    var endUser = deal[1]; // Assuming end user name is in the 2nd column

    // Check if a timestamp is absent in column AS (index 44) of the source sheet
    var timestamp = deal[44]; // Adjust index for column AS
    if (!timestamp) {
      // No timestamp present, proceed with the deal distribution

      if (userFiles[endUser]) {
        var userSheetId = userFiles[endUser];
        var userSS = SpreadsheetApp.openById(userSheetId);
        var userDealsSheet = userSS.getSheetByName('Deals');

        if (!userDealsSheet) {
          userDealsSheet = userSS.insertSheet('Deals'); // Create new sheet if it doesn't exist
          // Add headers to the new Deals sheet
          var headers = ['Timestamp', 'Account Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number',
                         'Email ID', 'Fax', 'Website', 'Lead Source', 'Lead Status',
                         'Industry', 'Number of Employees', 'Annual Revenue', 'Social Media',
                         'Description', 'Street', 'City', 'State', 'Country', 'PinCode',
                         'Additional Description', 'Account ID', 'GST Number',
                         'Bank Account Number', 'IFSC Code', 'Bank Name',
                         'Bank Account Name', 'Banking Remarks', 'Deal Name',
                         'Type', 'Deal Amount', 'Next Step', 'Product Required',
                         'Remarks', 'Stage', 'Order ID', 'Order Amount',
                         'Product Description', 'Order Details', 'Order Delivery Details',
                         'Delivery Date', 'Order Remarks'];

          userDealsSheet.appendRow(headers); // Append headers to the Deals sheet
        }

        // Append the deal data to the user's Deals sheet
        userDealsSheet.appendRow(deal);
        Logger.log('Deal for ' + endUser + ' appended to their Deals sheet.');

        // Generate the prefilled link for the current deal
        var prefilledLink = generatePrefilledLink(deal);

        // Update the last column in the user's Deals sheet with the prefilled link
        var lastRow = userDealsSheet.getLastRow();
        userDealsSheet.getRange(lastRow, 44).setFormula('=HYPERLINK("' + prefilledLink + '", "Update Deal")'); // Assuming column AS (index 44) for prefilled link
        Logger.log('Prefilled link generated and stored for ' + endUser + ' deal.');

        // Update the deals sheet with a formatted timestamp in column AS
        var formattedTimestamp = formatDateAsYYYYDDMMHHMMSSS(new Date());
        dealsSheet.getRange(i + 1, 45).setValue(formattedTimestamp); // Adding timestamp in column AS (index 44)
        Logger.log('Timestamp updated for deal in row ' + (i + 1));
      } else {
        Logger.log('No user file found for end user: ' + endUser);
      }
    } else {
      Logger.log('Skipping deal for ' + endUser + ' as it already has a timestamp.');
    }
  }

  Logger.log('Deals distributed to respective end user files successfully.');
}

// Helper function to format the timestamp as YYYYDDMMHHMMSSS
function formatDateAsYYYYDDMMHHMMSSS(date) {
  var year = date.getFullYear();
  var day = ('0' + date.getDate()).slice(-2); // DD
  var month = ('0' + (date.getMonth() + 1)).slice(-2); // MM
  var hours = ('0' + date.getHours()).slice(-2); // HH
  var minutes = ('0' + date.getMinutes()).slice(-2); // MM
  var seconds = ('0' + date.getSeconds()).slice(-2); // SS
  var milliseconds = ('00' + date.getMilliseconds()).slice(-3); // SSS

  return year + day + month + hours + minutes + seconds + milliseconds; // Combine to YYYYDDMMHHMMSSS
}

function trackLeadActions() {
  // IDs for the sheets and folder
  var accountsSheetId = '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8';
  var dealsSheetId = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4';
  var folderId = '1vNW0lXT0qe8w4M8fMWRDOjjIB-WgXFLT';

  // Open the Accounts sheet and get the data
  var accountsSS = SpreadsheetApp.openById(accountsSheetId);
  var accountsSheet = accountsSS.getSheetByName('Qualified Leads');
  if (!accountsSheet) {
    Logger.log("Error: 'Qualified Leads' sheet not found in the Accounts spreadsheet.");
    return;
  }
  var accountsDataRange = accountsSheet.getDataRange();
  var accountsData = accountsDataRange.getValues();

  // Open the Deals sheet and get the data
  var dealsSS = SpreadsheetApp.openById(dealsSheetId);
  var dealsSheet = dealsSS.getSheetByName('Form responses 1');
  if (!dealsSheet) {
    Logger.log("Error: 'Form responses 1' sheet not found in the Deals spreadsheet.");
    return;
  }
  var dealsDataRange = dealsSheet.getDataRange();
  var dealsData = dealsDataRange.getValues();

  // Create or open the Tracking table file in the specified folder
  var trackingFile = getOrCreateTrackingFile(folderId, 'Tracking Table');
  var trackingSheet = trackingFile.getSheets()[0];
  
  // Clear previous data in the tracking sheet and set headers
  trackingSheet.clear();
  trackingSheet.appendRow(['Lead ID', 'Lead Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number', 'Account Added Date', 'Deal Created Date', 'Create Deal Link']);

  // Create a dictionary for quick lookup of deals by Account ID (from column W in the Deals sheet)
  var dealsDict = {};
  for (var i = 1; i < dealsData.length; i++) {
    var accountId = dealsData[i][22]; // Account ID in column W (index 22)
    var dealTimestamp = dealsData[i][0]; // Timestamp in column A (index 0)
    if (accountId) {
      dealsDict[accountId] = dealTimestamp; // Map Account ID to its timestamp
    }
  }

  // Iterate through Accounts data to populate the tracking table
  for (var j = 1; j < accountsData.length; j++) {
    var leadId = accountsData[j][21]; // Lead ID in column V (index 21)
    var leadOwner = accountsData[j][0]; // Lead Owner in column A
    var firstName = accountsData[j][1]; // First Name in column B
    var lastName = accountsData[j][2]; // Last Name in column C
    var company = accountsData[j][3]; // Company in column D
    var mobileNumber = accountsData[j][4]; // Mobile Number in column E
    var accountAddedDateRaw = accountsData[j][21]; // Account added date in column V (index 21)

    // Ensure accountAddedDateRaw is a string before passing it to convertTimestamp
    var accountAddedDate = accountAddedDateRaw ? convertTimestamp(String(accountAddedDateRaw)) : "No Date Found";

    // Convert account added date from YYYYMMDDHHMMSSS to DDMMYYYY HHMMSSS format
    var accountAddedDate = convertTimestamp(accountAddedDateRaw);

    // Fetch the "Create Deal" link formula from column X (index 23)
    var createDealLinkFormula = accountsSheet.getRange(j + 1, 24).getFormula();

    // Check if there's a deal created for this lead ID by looking it up in dealsDict (matching Account ID in Deals)
    var dealCreatedDate = dealsDict[leadId] || 'No Deal Created';

    // Append the row to the tracking table
    trackingSheet.appendRow([leadId, leadOwner, firstName, lastName, company, mobileNumber, accountAddedDate, dealCreatedDate, createDealLinkFormula]);
  }

  Logger.log('Tracking table updated with account and deal actions.');
}

// Helper function to create or get the Tracking file in the specified folder
function getOrCreateTrackingFile(folderId, fileName) {
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    Logger.log("Tracking file found.");
    return SpreadsheetApp.open(files.next());
  } else {
    Logger.log("Creating new tracking file.");
    var trackingFile = SpreadsheetApp.create(fileName);
    var file = DriveApp.getFileById(trackingFile.getId());
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file); // Remove from root folder
    return trackingFile;
  }
}

// Function to convert a timestamp from YYYYMMDDHHMMSSS to DDMMYYYY HHMMSSS format
function convertTimestamp(timestamp) {
  if (!timestamp || typeof timestamp !== "string") {
    Logger.log("Invalid timestamp: " + timestamp);
    return "Invalid Date"; // Fallback value to identify issues
  }

  // Ensure timestamp is at least 14 characters long (YYYYMMDDHHMMSS)
  if (timestamp.length < 14) {
    Logger.log("Malformed timestamp: " + timestamp);
    return "Invalid Date";
  }

  var year = timestamp.substring(0, 4);
  var month = timestamp.substring(4, 6);
  var day = timestamp.substring(6, 8);
  var hours = timestamp.substring(8, 10);
  var minutes = timestamp.substring(10, 12);
  var seconds = timestamp.substring(12, 14);
  var milliseconds = timestamp.length > 14 ? timestamp.substring(14, 17) : "000";

  return `${day}${month}${year} ${hours}${minutes}${seconds}${milliseconds}`;
}

function transferClosedWonDeals() {
  try {
    const sourceSheetId = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4';
    const sourceSheetName = 'Form Responses 1';
    const accountOwnersFolderId = '14KwGob5YpqkzGY52frxC_iGvT2hD5tz9';
    const closedWonColumn = 36; // Column AJ
    const accountOwnerColumn = 2; // Assuming Account Owner is in Column B (index 2)
    const prefilledLinkColumn = 46; // Column AT for links
    const accountIdColumn = 23; // Column W for Account ID
    const dealNameColumn = 30; // Column AD for Deal Name
    const timestampColumn = 47; // Last column

    Logger.log('Updating prefilled links in account owner sheets for Closed Won deals...');

    // Open source spreadsheet
    const sourceSpreadsheet = SpreadsheetApp.openById(sourceSheetId);
    const sourceSheet = sourceSpreadsheet.getSheetByName(sourceSheetName);
    if (!sourceSheet) {
      throw new Error(`Source sheet "${sourceSheetName}" not found.`);
    }
    Logger.log(`Opened source sheet: ${sourceSheetName}`);

    const data = sourceSheet.getDataRange().getValues();

    // Filter rows for "Closed Won" and no timestamp
    const filteredData = data.filter((row, index) => {
      return index === 0 || (row[closedWonColumn - 1] === 'Closed Won' && !row[timestampColumn - 1]);
    });

    if (filteredData.length < 2) {
      Logger.log('No new "Closed Won" deals to update.');
      return;
    }

    Logger.log(`Found ${filteredData.length - 1} new "Closed Won" deals to update.`);

    // Open folder containing account owner sheets
    const folder = DriveApp.getFolderById(accountOwnersFolderId);
    const files = folder.getFiles();
    const accountOwnerFiles = {};

    while (files.hasNext()) {
      const file = files.next();
      accountOwnerFiles[file.getName()] = file;
    }

    // Process each filtered row
    filteredData.slice(1).forEach(row => {
      const accountOwner = row[accountOwnerColumn - 1];
      const accountId = row[accountIdColumn - 1];
      const dealName = row[dealNameColumn - 1];

      if (!accountOwnerFiles[accountOwner]) {
        Logger.log(`No file found for account owner: ${accountOwner}`);
        return;
      }

      const accountFile = SpreadsheetApp.open(accountOwnerFiles[accountOwner]);
      const dealsSheet = accountFile.getSheetByName('deals');

      if (!dealsSheet) {
        Logger.log(`No "deals" sheet found in file for account owner: ${accountOwner}`);
        return;
      }

      const dealsData = dealsSheet.getDataRange().getValues();
      const dealIndex = dealsData.findIndex(dealRow => {
        const dealAccountId = dealRow[accountIdColumn - 1];
        const dealDealName = dealRow[dealNameColumn - 1];
        return dealAccountId === accountId && dealDealName === dealName;
      });

      if (dealIndex === -1) {
        Logger.log(`No matching deal found for account owner: ${accountOwner} with Account ID: ${accountId} and Deal Name: ${dealName}`);
        return;
      }

      // Recreate the prefilled link using a helper function
      const prefilledLink = createEnduserPrefilledLink(row);
      if (!prefilledLink) {
        Logger.log(`Failed to recreate prefilled link for Account ID: ${accountId}, Deal Name: ${dealName}. Skipping row.`);
        return;
      }

      // Set the prefilled link as a formula in the specified column
      const hyperlinkFormula = '=HYPERLINK("' + prefilledLink + '", "Create Order")';
      dealsSheet.getRange(dealIndex + 1, prefilledLinkColumn).setFormula(hyperlinkFormula);
      Logger.log(`Updated prefilled link as hyperlink formula for account owner: ${accountOwner} in "deals" sheet, row ${dealIndex + 1}.`);

      // Update timestamp in the source sheet
      const rowIndex = data.indexOf(row);
      const updateTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmsss');
      sourceSheet.getRange(rowIndex + 1, timestampColumn).setValue(updateTimestamp);
      Logger.log(`Timestamp updated for row ${rowIndex + 1}.`);
    });

    Logger.log('Prefilled links updated successfully in account owner sheets.');
  } catch (error) {
    Logger.log(`Error updating prefilled links: ${error.message}`);
    throw error;
  }
}
//https://docs.google.com/forms/d/e/1FAIpQLSenKnjtEEj0-1lOEZUVtIfh2YTb0uFjDwHZMSVcxBm_hD1CKg/viewform?usp=pp_url&entry.382320733=AK&entry.97376243=firstname&entry.461328421=lastname&entry.595395094=company&entry.159263935=mobilenumber&entry.288566598=emailid&entry.1830695020=fax&entry.1638620245=website&entry.1083761663=Public+Relations&entry.396867408=Contact+in+Future&entry.1376066188=Airforce&entry.43979889=numberofemployees&entry.1989724413=annualrevenue&entry.1019765555=socialmedia&entry.1922882768=description&entry.832822168=accountid&entry.655911030=Billing&entry.2064231740=Billingstreet&entry.1963491498=billingcity&entry.1998507869=billingstate&entry.1748437282=billingcountry&entry.369502378=billingpincode&entry.1066602877=billingadditionaldescription&entry.1644243284=shippingstreet&entry.1867895163=shippingcity&entry.913609089=shippingstate&entry.537925504=shippingcountry&entry.611416518=shippingpincode&entry.1086568529=shipping+additionaldescription&entry.922424116=gstnumber&entry.1606909393=bankaccountnumber&entry.2063634235=ifsccode&entry.1261442588=bankname&entry.114694574=bankaccountname&entry.987626635=bankingremarks&entry.1214907790=dealname&entry.1234322722=New+Business&entry.1952574484=dealamount&entry.2128333512=nextstep&entry.1961730843=remarks&entry.1105858135=Needs+Analysis&entry.1252259963=OrderID&entry.1077039398=Equipment&entry.747452085=orderamount&entry.1705310808=Full+Advance&entry.1509191017=onsidecontactname&entry.848860207=onsitecontactnumber&entry.2054674575=Site+Manager&entry.2130715014=orderdeliverydate&entry.1460629656=orderremarks

function createEnduserPrefilledLink(row) {
  try {
    const baseUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSenKnjtEEj0-1lOEZUVtIfh2YTb0uFjDwHZMSVcxBm_hD1CKg/viewform?usp=pp_url';
    const queryString =
      `entry.382320733=${encodeURIComponent(row[1])}` + // Account Owner
      `&entry.97376243=${encodeURIComponent(row[2])}` +  // First Name
      `&entry.461328421=${encodeURIComponent(row[3])}` +  // Last Name
      `&entry.595395094=${encodeURIComponent(row[4])}` +  // Company
      `&entry.159263935=${encodeURIComponent(row[5])}` +  // Mobile Number
      `&entry.288566598=${encodeURIComponent(row[6])}` +  // Email ID
      `&entry.1830695020=${encodeURIComponent(row[7])}` +  // Fax
      `&entry.1638620245=${encodeURIComponent(row[8])}` +  // Website
      `&entry.1083761663=${encodeURIComponent(row[9])}` +  // Lead Source
      `&entry.396867408=${encodeURIComponent(row[10])}` + // Lead Status
      `&entry.1376066188=${encodeURIComponent(row[11])}` + // Industry
      `&entry.43979889=${encodeURIComponent(row[12])}` + // Number of Employees
      `&entry.1989724413=${encodeURIComponent(row[13])}` + // Annual Revenue
      `&entry.1019765555=${encodeURIComponent(row[14])}` + // Social Media
      `&entry.1922882768=${encodeURIComponent(row[15])}` + // Description
      `&entry.832822168=${encodeURIComponent(row[22])}` + // Account ID
      `&entry.2064231740=${encodeURIComponent(row[16])}` + // Street
      `&entry.1963491498=${encodeURIComponent(row[17])}` + // City
      `&entry.1998507869=${encodeURIComponent(row[18])}` + // State
      `&entry.1748437282=${encodeURIComponent(row[19])}` + // Country
      `&entry.369502378=${encodeURIComponent(row[20])}` + // PinCode
      `&entry.1066602877=${encodeURIComponent(row[21])}` + // Additional Description
      `&entry.922424116=${encodeURIComponent(row[23])}` + // GST Number
      `&entry.1606909393=${encodeURIComponent(row[24])}` + // Bank Account Number
      `&entry.2063634235=${encodeURIComponent(row[25])}` + // IFSC Code
      `&entry.1261442588=${encodeURIComponent(row[26])}` + // Bank Name
      `&entry.114694574=${encodeURIComponent(row[27])}` + // Bank Account Name
      `&entry.987626635=${encodeURIComponent(row[28])}` + // Banking Remarks
      `&entry.1214907790=${encodeURIComponent(row[29])}` + // Deal Name
      `&entry.1234322722=${encodeURIComponent(row[30])}` + // Type
      `&entry.1952574484=${encodeURIComponent(row[31])}` + // Deal Amount
      `&entry.2128333512=${encodeURIComponent(row[32])}` + // Next Step
      `&entry.1961730843=${encodeURIComponent(row[34])}` + // Remarks
      `&entry.1105858135=${encodeURIComponent(row[35])}` + // Stage
      `&entry.1460629656=${encodeURIComponent(row[42])}`;  // Order Remarks

    const fullLink = `${baseUrl}&${queryString}`;
    Logger.log(`Generated Prefilled Link: ${fullLink}`);
    return fullLink;
  } catch (error) {
    Logger.log(`Error creating prefilled link: ${error.message}`);
    return null;
  }
}




function CreateOrderPrefilledLinks() {
  try {
    const sourceSheetId = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4';
    const sourceSheetName = 'Form Responses 1';
    const prefilledLinkColumn = 46; // Column AT for links
    const closedWonColumn = 36; // Column AJ
    const timestampColumn = 47; // Last column

    Logger.log('Generating prefilled links...');

    // Open source spreadsheet
    const sourceSpreadsheet = SpreadsheetApp.openById(sourceSheetId);
    const sourceSheet = sourceSpreadsheet.getSheetByName(sourceSheetName);
    if (!sourceSheet) {
      throw new Error(`Source sheet "${sourceSheetName}" not found.`);
    }
    Logger.log(`Opened source sheet: ${sourceSheetName}`);

    const data = sourceSheet.getDataRange().getValues();
    const headers = data[0];
    //https://docs.google.com/forms/d/e/1FAIpQLSenKnjtEEj0-1lOEZUVtIfh2YTb0uFjDwHZMSVcxBm_hD1CKg/viewform?usp=pp_url&entry.382320733=AK&entry.97376243=firstname&entry.461328421=lastname&entry.595395094=company&entry.159263935=mobilenumber&entry.288566598=emailid&entry.1830695020=fax&entry.1638620245=website&entry.1083761663=Public+Relations&entry.396867408=Contact+in+Future&entry.1376066188=Airforce&entry.43979889=numberofemployees&entry.1989724413=annualrevenue&entry.1019765555=socialmedia&entry.1922882768=description&entry.832822168=accountid&entry.655911030=Billing&entry.2064231740=Billingstreet&entry.1963491498=billingcity&entry.1998507869=billingstate&entry.1748437282=billingcountry&entry.369502378=billingpincode&entry.1066602877=billingadditionaldescription&entry.1644243284=shippingstreet&entry.1867895163=shippingcity&entry.913609089=shippingstate&entry.537925504=shippingcountry&entry.611416518=shippingpincode&entry.1086568529=shipping+additionaldescription&entry.922424116=gstnumber&entry.1606909393=bankaccountnumber&entry.2063634235=ifsccode&entry.1261442588=bankname&entry.114694574=bankaccountname&entry.987626635=bankingremarks&entry.1214907790=dealname&entry.1234322722=New+Business&entry.1952574484=dealamount&entry.2128333512=nextstep&entry.1961730843=remarks&entry.1105858135=Needs+Analysis&entry.1252259963=OrderID&entry.1077039398=Equipment&entry.747452085=orderamount&entry.1705310808=Full+Advance&entry.1509191017=onsidecontactname&entry.848860207=onsitecontactnumber&entry.2054674575=Site+Manager&entry.2130715014=orderdeliverydate&entry.1460629656=orderremarks
    const formEntries = {
      'Account Owner': 'entry.382320733',
      'First Name': 'entry.97376243',
      'Last Name': 'entry.461328421',
      'Company': 'entry.595395094',
      'Mobile Number': 'entry.159263935',
      'Email ID': 'entry.288566598',
      'Fax': 'entry.1830695020',
      'Website': 'entry.1638620245',
      'Lead Source': 'entry.1083761663',
      'Lead Status': 'entry.396867408',
      'Industry': 'entry.1376066188',
      'Number of Employees': 'entry.43979889',
      'Annual Revenue': 'entry.1989724413',
      'Social Media': 'entry.1019765555',
      'Description': 'entry.1922882768',
      'Account ID': 'entry.832822168',
      'Street': 'entry.2064231740',
      'City': 'entry.1963491498',
      'State': 'entry.1998507869',
      'Country': 'entry.1748437282',
      'PinCode': 'entry.369502378',
      'Additional Description': 'entry.1066602877',
      'GST Number': 'entry.922424116',
      'Bank Account Number': 'entry.1606909393',
      'IFSC Code': 'entry.2063634235',
      'Bank Name': 'entry.1261442588',
      'Bank Account Name': 'entry.114694574',
      'Banking Remarks': 'entry.987626635',
      'Deal Name': 'entry.1214907790',
      'Type': 'entry.1234322722',
      'Deal Amount': 'entry.1952574484',
      'Next Step': 'entry.2128333512',
      'Remarks': 'entry.1961730843',
      'Stage': 'entry.1105858135',
      'Order Remarks': 'entry.1460629656'
    };

    const baseUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSenKnjtEEj0-1lOEZUVtIfh2YTb0uFjDwHZMSVcxBm_hD1CKg/viewform?usp=pp_url';
    data.slice(1).forEach((row, idx) => {
      if (row[closedWonColumn - 1] === 'Closed Won' && !row[timestampColumn - 1]) {
        const params = Object.keys(formEntries).map(key => {
          const colIdx = headers.indexOf(key);
          return colIdx !== -1 ? `${formEntries[key]}=${encodeURIComponent(row[colIdx])}` : '';
        }).filter(Boolean).join('&');

        const prefilledLink = `${baseUrl}&${params}`;
        const linkWithName = `=HYPERLINK("${prefilledLink}", "Create Order")`;
        sourceSheet.getRange(idx + 2, prefilledLinkColumn).setValue(linkWithName);
        Logger.log(`Prefilled link generated for row ${idx + 2}: ${linkWithName}`);
      }
    });

    Logger.log('Prefilled links generated successfully.');

    // Call the transfer function after generating prefilled links
    transferClosedWonDeals();

  } catch (error) {
    Logger.log(`Error generating prefilled links: ${error.message}`);
    throw error;
  }
}



function trackLeadActionsv2() {
  // IDs for the sheets and folder
  var accountsSheetId = '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8';
  var dealsSheetId = '1GoZiI3HMDA_Ohkr50wwQlCiYWnT5EcNgDW3dWiZAJU4';
  var folderId = '1vNW0lXT0qe8w4M8fMWRDOjjIB-WgXFLT';

  // Open the Accounts sheet and get the data
  var accountsSS = SpreadsheetApp.openById(accountsSheetId);
  var accountsSheet = accountsSS.getSheetByName('Qualified Leads');
  if (!accountsSheet) {
    Logger.log("Error: 'Qualified Leads' sheet not found in the Accounts spreadsheet.");
    return;
  }
  var accountsDataRange = accountsSheet.getDataRange();
  var accountsData = accountsDataRange.getValues();

  // Open the Deals sheet and get the data
  var dealsSS = SpreadsheetApp.openById(dealsSheetId);
  var dealsSheet = dealsSS.getSheetByName('Form responses 1');
  if (!dealsSheet) {
    Logger.log("Error: 'Form responses 1' sheet not found in the Deals spreadsheet.");
    return;
  }
  var dealsDataRange = dealsSheet.getDataRange();
  var dealsData = dealsDataRange.getValues();

  // Create or open the Tracking table file in the specified folder
  var trackingFile = getOrCreateTrackingFile(folderId, 'Tracking Table');
  var trackingSheet = trackingFile.getSheets()[0];
  
  // Clear previous data in the tracking sheet and set headers
  trackingSheet.clear();
  trackingSheet.appendRow(['Lead ID', 'Lead Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number', 'Account Added Date', 'Deal Created Date', 'Create Deal Link']);

  // Create a dictionary for quick lookup of deals by Account ID (from column W in the Deals sheet)
  var dealsDict = {};
  for (var i = 1; i < dealsData.length; i++) {
    var accountId = dealsData[i][22]; // Account ID in column W (index 22)
    var dealTimestamp = dealsData[i][0]; // Timestamp in column A (index 0)
    if (accountId) {
      dealsDict[accountId] = dealTimestamp; // Map Account ID to its timestamp
    }
  }

  // Iterate through Accounts data to populate the tracking table
  for (var j = 1; j < accountsData.length; j++) {
    var leadId = accountsData[j][21]; // Lead ID in column V (index 21)
    var leadOwner = accountsData[j][0]; // Lead Owner in column A
    var firstName = accountsData[j][1]; // First Name in column B
    var lastName = accountsData[j][2]; // Last Name in column C
    var company = accountsData[j][3]; // Company in column D
    var mobileNumber = accountsData[j][4]; // Mobile Number in column E
    var accountAddedDateRaw = accountsData[j][22]; // Account added date in column W (index 22)

    // Log raw Account Added Date for debugging
    Logger.log(`Row ${j + 1} - Raw Account Added Date: ${accountAddedDateRaw} (Type: ${typeof accountAddedDateRaw})`);
    
    // Ensure accountAddedDateRaw is correctly retrieved as a string
    if (typeof accountAddedDateRaw === "number") {
      accountAddedDateRaw = accountAddedDateRaw.toFixed(0); // Convert to whole number string
    }
    
    var accountAddedDate = accountAddedDateRaw ? String(accountAddedDateRaw) : "No Date Found";

    // Fetch the "Create Deal" link formula from column X (index 23)
    var createDealLinkFormula = accountsSheet.getRange(j + 1, 24).getFormula();

    // Check if there's a deal created for this lead ID by looking it up in dealsDict (matching Account ID in Deals)
    var dealCreatedDate = dealsDict[leadId] || 'No Deal Created';

    // Append the row to the tracking table
    trackingSheet.appendRow([leadId, leadOwner, firstName, lastName, company, mobileNumber, accountAddedDate, dealCreatedDate, createDealLinkFormula]);
  }

  Logger.log('Tracking table updated with account and deal actions.');
}

function onFormSubmit(e) {
  try {
    const validationSheetId = '1YxYSLVuBrNOp8fYdA3s1dLzR3KFW0IaVMUvJ2AvY4aQ';
    const validationSheetName = 'Validation Tables';

    const sheet = e.range.getSheet();
    const submittedRow = e.range.getRow();
    const lastCol = sheet.getLastColumn();

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const values = sheet.getRange(submittedRow, 1, 1, lastCol).getValues()[0];

    // Get the Account Owner from the Deals sheet
    const ownerColIndex = headers.indexOf('Account Owner');
    if (ownerColIndex === -1) {
      Logger.log("❌ 'Account Owner' column not found in Deals sheet.");
      return;
    }

    const accountOwner = values[ownerColIndex];
    if (!accountOwner) {
      Logger.log("❌ Account Owner is missing for the submitted deal.");
      return;
    }

    // Lookup the corresponding email from Validation Sheet where Column A = Lead Owner, Column E = Email
    const validationSheet = SpreadsheetApp.openById(validationSheetId).getSheetByName(validationSheetName);
    const validationData = validationSheet.getRange(2, 1, validationSheet.getLastRow() - 1, 5).getValues(); // A to E

    const matchedRow = validationData.find(row => row[0] === accountOwner);
    const recipientEmail = matchedRow ? matchedRow[4] : null;

    if (!recipientEmail) {
      Logger.log(`❌ No email found for Account Owner: ${accountOwner}`);
      return;
    }

    // Generate subject with optional fields
    const dealName = values[headers.indexOf('Deal Name')] || '';
    const company = values[headers.indexOf('Company')] || '';
    const dealValue = values[headers.indexOf('Deal Value')] || '';
    const stage = values[headers.indexOf('Deal Stage')] || '';

    const subject = `New Deal Submitted: ${dealName} | ${company} | ₹${dealValue} | Stage: ${stage}`;

    // Build HTML body table
    const tableHtml = headers.map((h, i) =>
      `<tr><td style="padding:4px;border:1px solid #ccc;"><b>${h}</b></td><td style="padding:4px;border:1px solid #ccc;">${values[i]}</td></tr>`
    ).join('');
    const emailBody = `
      <p>Hello ${accountOwner},</p>
      <p>A new deal form has been submitted with the following details:</p>
      <table style="border-collapse:collapse;border:1px solid #ccc;">${tableHtml}</table>
      <p>Regards,<br/>Klient Konnect Team</p>
    `;

    // Send email using GmailApp
    GmailApp.sendEmail(recipientEmail, subject, '', {
      htmlBody: emailBody,
      cc: 'Holy@klientkonnect.com,Sidhant@ridosports.com,Sandeep@ridosports.com'
    });

    Logger.log(`✅ Deal email sent to ${recipientEmail}`);

  } catch (err) {
    Logger.log("❗ Error in onFormSubmit: " + err.stack);
  }
}




