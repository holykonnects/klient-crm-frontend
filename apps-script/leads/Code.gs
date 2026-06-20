/**
 * @OnlyAuthorize
 * @scope https://www.googleapis.com/auth/spreadsheets
 * @scope https://www.googleapis.com/auth/drive
 * @scope https://www.googleapis.com/auth/script.external_request
 */

function testAuthorization() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('Spreadsheet title: ' + ss.getName());
}

function onOpen() { 
  // Add a custom menu to the Google Sheet
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Klient Konnect')
    .addItem('Generate Prefilled Links', 'generatePrefilledLinks')
    .addItem('Generate Lead ID', 'generateLeadIDs')
    .addItem('Convert Leads', 'transferQualifiedLeads')
    .addItem('Distribute Leads','distributeLeadsToEndUser')
    .addToUi();
}

function stepwiseLeadManagement() {
  Logger.log('Starting Lead Management Process');

  // Step 1: Generate Lead IDs
  Logger.log('Executing Step 1: Generate Lead IDs');
  generateLeadIDs();
  Logger.log('Step 1 complete.');

  // Step 2: Generate Prefilled Links
  Logger.log('Executing Step 2: Generate Prefilled Links');
  generatePrefilledLinks();
  Logger.log('Step 2 complete.');

  // Step 3: Distribute Leads to End Users
  Logger.log('Executing Step 3: Distribute Leads to End Users');
  distributeLeadsToEndUser();
  Logger.log('Step 3 complete.');

  // Step 4: Transfer Qualified Leads
  Logger.log('Executing Step 4: Transfer Qualified Leads');
  transferQualifiedLeads();
  Logger.log('Step 4 complete. Lead Management Process finished.');
}


function generatePrefilledLinks() {
  var sheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0'; // Replace with your actual sheet ID
  var targetSheetName = 'Form responses 1'; // Replace with your actual sheet name
  
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(targetSheetName);
  
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();
  
  for (var i = 1; i < data.length; i++) {
    var responses = data[i];

    // Check if the row is not blank and if the prefilled link already exists in the last column
    if (responses[0] && responses[1] && responses[2] && !responses[responses.length - 1]) { 
      // Generate the prefilled link
      var prefilledLink = generatePrefilledLink(responses);
      
      // Create a clickable hyperlink
      var clickableLink = '=HYPERLINK("' + prefilledLink + '", "Update Lead")';
      
      // Update the 'Deal Creation' column (assuming column X is the last column)
      sheet.getRange(i + 1, 24).setFormula(clickableLink); // i + 1 for the correct row index

      Logger.log('Prefilled link generated and stored for row ' + (i + 1));
    }
  }
}

function onEdit(e) {
  var sheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0'; // Replace with your actual sheet ID
  var targetSheetName = 'Form responses 1'; // Replace with your actual sheet name

  // Check if the event object has a range property
  if (!e || !e.range) return;

  // Get the active spreadsheet and check the ID
  var activeSpreadsheet = e.source;
  if (activeSpreadsheet.getId() !== sheetId) return; // Ensure we are in the correct spreadsheet

  // Get the active sheet from the event
  var activeSheet = e.range.getSheet();

  // Check if the edited sheet is the target sheet
  if (activeSheet.getName() === targetSheetName) {
    var startRow = e.range.getRow();
    var numRows = e.range.getNumRows();

    // Loop through all the rows affected
    for (var i = 0; i < numRows; i++) {
      var currentRow = startRow + i;
      var responses = activeSheet.getRange(currentRow, 1, 1, activeSheet.getLastColumn()).getValues()[0];

      // Check if the required fields are not blank
      if (responses[0] && responses[1] && responses[2]) { // Adjust based on your requirements
        // Generate the prefilled link for the current row
        var prefilledLink = generatePrefilledLink(responses);
        
        // Create a clickable hyperlink
        var clickableLink = '=HYPERLINK("' + prefilledLink + '", "Update Lead")';
        
        // Update the 'Deal Creation' column (column X, which is the 24th column)
        activeSheet.getRange(currentRow, 24).setFormula(clickableLink); // Column X is column 24
        Logger.log('Prefilled link updated for row ' + currentRow + ' in column X.');
      } else {
        Logger.log('Skipping row ' + currentRow + ' due to missing essential fields.');
      }
    }
    
    Logger.log('Prefilled links updated for rows starting at ' + startRow);
    
    // Call the transferQualifiedLeads function to check for new qualified leads
    transferQualifiedLeads(); // Trigger the transfer after updating prefilled links
    Logger.log('Transfer of qualified leads function was executed after editing rows starting at ' + startRow);
  }
}

// Function to generate the prefilled link
function generatePrefilledLink(responses) {
  // Map the required fields to the corresponding entries
  var leadowner = responses [1];
  var firstName = responses[2];     // Assuming column C stores First Name
  var lastName = responses[3];      // Assuming column D stores Last Name
  var company = responses[4];       // Assuming column E stores Company
  var mobileNumber = responses[5];  // Assuming column F stores Mobile Number
  var emailID = responses[6];       // Assuming column G stores Email ID
  var fax = responses[7];           // Assuming column H stores Fax
  var website = responses[8];       // Assuming column I stores Website
  var leadSource = responses[9];    // Assuming column J stores Lead Source
  var leadStatus = responses[10];   // Assuming column K stores Lead Status
  var industry = responses[11];     // Assuming column L stores Industry
  var numberOfEmployees = responses[12]; // Assuming column M stores Number of Employees
  var annualRevenue = responses[13]; // Assuming column N stores Annual Revenue
  var socialMedia = responses[14];  // Assuming column O stores Social Media
  var description = responses[15];  // Assuming column P stores Description
  var street = responses[16];       // Assuming column Q stores Street
  var city = responses[17];         // Assuming column R stores City
  var state = responses[18];        // Assuming column S stores State
  var country = responses[19];      // Assuming column T stores Country
  var pincode = responses[20];      // Assuming column U stores Pincode
  var additionalDescription = responses[21]; // Assuming column V stores Additional Description
  var leadID = responses[22];       // Assuming column W stores Lead ID

  //https://docs.google.com/forms/d/e/1FAIpQLSfcFzzlqDCdlBK58iNV5AWLpJM7rQFADIXpKw5182dwOAH2jQ/viewform?usp=pp_url&entry.382320733=Nitest+Kumar&entry.97376243=firstname&entry.461328421=lastname&entry.595395094=company&entry.159263935=mobilenumber&entry.288566598=emailid&entry.1830695020=fax&entry.1638620245=website&entry.1083761663=Seminar&entry.396867408=Contacted&entry.1376066188=CPWD&entry.43979889=numberofemployees&entry.1989724413=annualrevenue&entry.1019765555=socialmedia&entry.1922882768=description&entry.2064231740=street&entry.1963491498=city&entry.1998507869=state&entry.1748437282=country&entry.369502378=pincode&entry.1066602877=additionaldescription&entry.832822168=leadid
  // Generate the prefilled form link using the provided URL template with dynamic values
  var prefilledLink = "https://docs.google.com/forms/d/e/1FAIpQLSfcFzzlqDCdlBK58iNV5AWLpJM7rQFADIXpKw5182dwOAH2jQ/viewform?usp=pp_url"
    + "&entry.382320733=" + encodeURIComponent(leadowner)
    + "&entry.382320733=" + encodeURIComponent(firstName)
    + "&entry.97376243=" + encodeURIComponent(firstName)
    + "&entry.461328421=" + encodeURIComponent(lastName)
    + "&entry.595395094=" + encodeURIComponent(company)
    + "&entry.159263935=" + encodeURIComponent(mobileNumber)
    + "&entry.288566598=" + encodeURIComponent(emailID)
    + "&entry.1830695020=" + encodeURIComponent(fax)
    + "&entry.1638620245=" + encodeURIComponent(website)
    + "&entry.1083761663=" + encodeURIComponent(leadSource)  // Lead source from the response
    + "&entry.396867408=" + encodeURIComponent(leadStatus)   // Lead status from the response
    + "&entry.1376066188=" + encodeURIComponent(industry)    // Industry from the response
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
    + "&entry.832822168=" + encodeURIComponent(leadID);

  return prefilledLink;
}

function generateLeadIDs() {
  var sheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0'; // Replace with your actual sheet ID
  var targetSheetName = 'Form responses 1'; // Replace with your actual sheet name
  
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName(targetSheetName);
  
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();
  
  var mobileNumberColumn = 5; // Column F for Mobile Number (0-based index is 5)
  var leadIDColumn = 22;      // Column W for Lead ID (0-based index is 22)
  var timestampColumn = 0;    // Column A for the initial timestamp (0-based index is 0)

  // Create a map to store mobile number and associated Lead IDs based on the initial timestamp
  var mobileNumberMap = {};

  // Loop through all rows and populate the mobileNumberMap with existing Lead IDs
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var mobileNumber = row[mobileNumberColumn];
    var leadID = row[leadIDColumn];

    if (mobileNumber && leadID) {
      mobileNumberMap[mobileNumber] = leadID; // Store mobile number and its corresponding lead ID
    }
  }

  // Loop through all rows again to generate or assign Lead IDs
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var mobileNumber = row[mobileNumberColumn];
    var leadID = row[leadIDColumn];
    var initialTimestamp = row[timestampColumn]; // Use the form submission timestamp from column A

    if (mobileNumber) {
      // Check if the mobile number already has a Lead ID
      if (mobileNumberMap[mobileNumber]) {
        // Assign the existing Lead ID
        sheet.getRange(i + 1, leadIDColumn + 1).setValue(mobileNumberMap[mobileNumber]);
        Logger.log('Assigned existing Lead ID ' + mobileNumberMap[mobileNumber] + ' for row ' + (i + 1));
      } else if (!leadID) {
        // Generate a new Lead ID based on the initial timestamp
        var newLeadID = generateLeadID(initialTimestamp);
        sheet.getRange(i + 1, leadIDColumn + 1).setValue(newLeadID);
        Logger.log('Generated new Lead ID ' + newLeadID + ' for row ' + (i + 1));

        // Add the new mobile number and Lead ID to the map
        mobileNumberMap[mobileNumber] = newLeadID;
      }
    }
  }
}

// Function to generate Lead ID based on the timestamp (column A)
function generateLeadID(timestamp) {
  var date = new Date(timestamp);
  
  var year = date.getFullYear();
  var month = ('0' + (date.getMonth() + 1)).slice(-2); 
  var day = ('0' + date.getDate()).slice(-2);
  var hours = ('0' + date.getHours()).slice(-2);
  var minutes = ('0' + date.getMinutes()).slice(-2);
  var seconds = ('0' + date.getSeconds()).slice(-2);
  var milliseconds = ('00' + date.getMilliseconds()).slice(-3);
  
  return year + month + day + hours + minutes + seconds + milliseconds;
}


function transferQualifiedLeads() {
  try {
    var sourceSheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0'; 
    var sourceSheetName = 'Form responses 1'; 
    var targetSheetId = '1K9JT7C88oOVdAvapDOieWaiYj6Wd_XRZ1CCNiYzUhG8'; 
    var targetSheetName = 'Qualified Leads'; 

    var sourceSS = SpreadsheetApp.openById(sourceSheetId);
    var sourceSheet = sourceSS.getSheetByName(sourceSheetName);
    Logger.log('Source sheet loaded: ' + sourceSheetName);
    
    var targetSS = SpreadsheetApp.openById(targetSheetId);
    var targetSheet = targetSS.getSheetByName(targetSheetName);
    Logger.log('Target sheet loaded: ' + targetSheetName);
    
    var dataRange = sourceSheet.getDataRange();
    var data = dataRange.getValues();
    Logger.log('Data range obtained. Total rows: ' + data.length);

    var qualifiedLeads = [];

    var timestampColumnIndex = 24; // Column index for timestamps in the target sheet (0-based)
    var sourceLeadIDColumnIndex = 22; 
    var targetLeadIDColumnIndex = 21; 
    var leadStatusColumnIndex = 10;   

    var headersToTransfer = {
      'Lead Owner': 1,
      'First Name': 2,
      'Last Name': 3,
      'Company': 4,
      'Mobile Number': 5,
      'Email ID': 6,
      'Fax': 7,
      'Website': 8,
      'Lead Source': 9,
      'Lead Status': 10,
      'Industry': 11,
      'Number of Employees': 12,
      'Annual Revenue': 13,
      'Social Media': 14,
      'Description': 15,
      'Street': 16,
      'City': 17,
      'State': 18,
      'Country': 19,
      'PinCode': 20,
      'Additional Description': 21,
      'Lead ID': 22,
      'Prefilled Link': 23
    };

    var existingData = targetSheet.getDataRange().getValues();
    var existingLeadIDs = existingData.map(row => row[targetLeadIDColumnIndex]); 

    for (var i = 1; i < data.length; i++) {
      Logger.log('Processing row: ' + (i + 1));
      var responses = data[i];

      if (responses[leadStatusColumnIndex] === 'Qualified') {
        var currentLeadID = responses[sourceLeadIDColumnIndex]; 
        
        if (!existingLeadIDs.includes(currentLeadID)) {
          var leadData = [];
          for (var header of Object.keys(headersToTransfer)) {
            leadData.push(responses[headersToTransfer[header]]); 
          }
          qualifiedLeads.push(leadData); 
          Logger.log('Qualified lead found for row: ' + (i + 1));
        } else {
          Logger.log('Lead ID already exists for row: ' + (i + 1) + ', skipping this lead.');
        }
      }
    }

    if (qualifiedLeads.length > 0) {
      targetSheet.getRange(targetSheet.getLastRow() + 1, 1, qualifiedLeads.length, qualifiedLeads[0].length).setValues(qualifiedLeads);
      Logger.log('New qualified leads transferred to the target sheet.');

      var targetStartRow = targetSheet.getLastRow() - qualifiedLeads.length + 1; 
      var transferTimestamp = formatDateAsYYYYMMDDHHMMSSS(new Date()); // Capture and format the timestamp

      for (var j = 0; j < qualifiedLeads.length; j++) {
        targetSheet.getRange(targetStartRow + j, timestampColumnIndex + 1).setValue(transferTimestamp); // Set formatted timestamp
        Logger.log('Timestamp set for row: ' + (targetStartRow + j) + ' with value: ' + transferTimestamp);
      }

      var headersArray = Object.keys(headersToTransfer);
      var existingHeaders = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
      var headersNeedToBeAdded = headersArray.filter(header => !existingHeaders.includes(header));
      if (headersNeedToBeAdded.length > 0) {
        targetSheet.insertRowBefore(1); 
        targetSheet.getRange(1, 1, 1, headersArray.length).setValues([headersArray]); 
        Logger.log('Headers added to target sheet: ' + headersArray.join(', '));
      }

    } else {
      Logger.log('No new qualified leads found.');
    }
  } catch (error) {
    Logger.log('Error: ' + error.message);
  }
}

// Helper function to format the date as YYYYMMDDHHMMSSS
function formatDateAsYYYYMMDDHHMMSSS(date) {
  var year = date.getFullYear();
  var month = ('0' + (date.getMonth() + 1)).slice(-2);
  var day = ('0' + date.getDate()).slice(-2);
  var hours = ('0' + date.getHours()).slice(-2);
  var minutes = ('0' + date.getMinutes()).slice(-2);
  var seconds = ('0' + date.getSeconds()).slice(-2);
  var milliseconds = ('00' + date.getMilliseconds()).slice(-3);

  return year + month + day + hours + minutes + seconds + milliseconds;
}

function distributeLeadsToEndUser() {
  Logger.log('Starting the distributeLeadsToEndUser function.');
  
  var sourceSheetId = '1vJbB0fmBQhd6XGTNbjUAi7Bt71lHNyau2TBMXTCdoM0'; // ID of the Qualified Leads sheet
  var designatedFolderId = '14KwGob5YpqkzGY52frxC_iGvT2hD5tz9'; // Google Drive folder ID for distributed leads

  var sourceSS = SpreadsheetApp.openById(sourceSheetId);
  var sourceSheet = sourceSS.getSheetByName('Form responses 1'); // Adjust if the name is different
  
  var dataRange = sourceSheet.getDataRange();
  var data = dataRange.getValues();
  
  var leadsByUser = {};
  Logger.log('Fetched data from the source sheet.');

  // Group leads by end user
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var endUser = row[1]; // Assuming the end user name is in column B (index 1)
    
    if (!leadsByUser[endUser]) {
      leadsByUser[endUser] = [];
    }
    leadsByUser[endUser].push(row);
  }
  Logger.log('Grouped leads by user.');

  // Iterate through each end user to add leads to the "Leads" worksheet
  for (var user in leadsByUser) {
    Logger.log('Processing leads for user: ' + user);
    
    var leads = leadsByUser[user];
    
    // Try to find the user's existing file or create a new one
    var userSheetId = getOrCreateUserSheet(user, designatedFolderId);
    var userSheet = SpreadsheetApp.openById(userSheetId);
    
    // Check if the "Leads" sheet exists, if not, create it
    var leadsSheet = userSheet.getSheetByName('Leads');
    if (!leadsSheet) {
      leadsSheet = userSheet.insertSheet('Leads'); // Create a new sheet named "Leads"
      
      // Delete the default "Sheet1" if it exists
      var defaultSheet = userSheet.getSheetByName('Sheet1');
      if (defaultSheet) {
        userSheet.deleteSheet(defaultSheet);
        Logger.log('Deleted default "Sheet1" for user: ' + user);
      }
      
      // Add headers to the new Leads sheet, including 'Timestamp'
      var headers = ['Timestamp', 'Lead Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number', 'Email ID', 
                     'Fax', 'Website', 'Lead Source', 'Lead Status', 'Industry', 
                     'Number of Employees', 'Annual Revenue', 'Social Media', 
                     'Description', 'Street', 'City', 'State', 'Country', 
                     'PinCode', 'Additional Description', 'Lead ID', 'Prefilled Link'];
      leadsSheet.appendRow(headers); // Append headers to the Leads sheet
      Logger.log('Created "Leads" sheet and added headers for user: ' + user);
    }

    // Append qualified leads to the leads sheet
    for (var j = 0; j < leads.length; j++) {
      var leadData = leads[j];
      
      // Check if a timestamp is present in column Y (index 24) before transferring
      if (!leadData[24]) { // Column Y is index 24 (0-based index)
        leadsSheet.appendRow(leadData); // Append the lead data
        Logger.log('Appended lead data for user: ' + user);

        // Generate prefilled link for the current lead
        var prefilledLink = generatePrefilledLink(leadData);
        var clickableLink = '=HYPERLINK("' + prefilledLink + '", "Update Lead")';

        // Set the clickable link in the last column (assuming it's the 24th column)
        leadsSheet.getRange(leadsSheet.getLastRow(), 24).setFormula(clickableLink); // Assuming column X (24th column)
        Logger.log('Added prefilled link for lead for user: ' + user);
      } else {
        Logger.log('Skipping lead for user: ' + user + ' as it has already been transferred.');
      }
    }

    Logger.log('Distributed leads to: ' + user);
  }
  
  // Call the timestamp update function to store a timestamp in column Y for all leads
  updateTimestampForAllLeads(sourceSheet);
  Logger.log('Timestamp update completed for all leads.');

  Logger.log('Exiting the distributeLeadsToEndUser function.');
}

// Helper function to get or create a user sheet in the designated folder
function getOrCreateUserSheet(userName, folderId) {
  Logger.log('Attempting to find or create a sheet for user: ' + userName);
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFilesByName(userName);
  
  if (files.hasNext()) {
    Logger.log('Found existing sheet for user: ' + userName);
    return files.next().getId(); // Return the ID of the existing file
  } else {
    // Create a new sheet for the user if not found
    Logger.log('No existing sheet found for user: ' + userName + '. Creating a new sheet.');
    var newUserSheet = SpreadsheetApp.create(userName);
    var newFile = DriveApp.getFileById(newUserSheet.getId());
    folder.addFile(newFile); // Add the file to the designated folder
    DriveApp.getRootFolder().removeFile(newFile); // Remove from root folder
    Logger.log('Created new sheet for user: ' + userName);
    return newUserSheet.getId();
  }
}

// Helper function to format timestamp in YYYYMMDDHHMMSSS format
function formatTimestamp(date) {
  var year = date.getFullYear();
  var month = ('0' + (date.getMonth() + 1)).slice(-2);
  var day = ('0' + date.getDate()).slice(-2);
  var hours = ('0' + date.getHours()).slice(-2);
  var minutes = ('0' + date.getMinutes()).slice(-2);
  var seconds = ('0' + date.getSeconds()).slice(-2);
  var milliseconds = ('00' + date.getMilliseconds()).slice(-3);

  return year + month + day + hours + minutes + seconds + milliseconds;
}

// Function to update the timestamp for all leads in column Y (index 24)
function updateTimestampForAllLeads(sheet) {
  Logger.log('Starting the updateTimestampForAllLeads function.');
  var dataRange = sheet.getDataRange();
  var data = dataRange.getValues();

  for (var i = 1; i < data.length; i++) {
    // Check if the lead does not already have a timestamp in column Y
    if (!data[i][24]) { // Column Y is index 24 (0-based index)
      var timestamp = formatTimestamp(new Date());
      sheet.getRange(i + 1, 25).setValue(timestamp); // Update with formatted timestamp in column Y
      Logger.log('Timestamp updated for row ' + (i + 1));
    }
  }
  Logger.log('Completed timestamp update for all leads.');
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

    // Get values for dynamic subject
    const firstName = values[headers.indexOf('First Name')] || '';
    const lastName = values[headers.indexOf('Last Name')] || '';
    const mobile = values[headers.indexOf('Mobile Number')] || '';
    const company = values[headers.indexOf('Company')] || '';
    const leadSource = values[headers.indexOf('Lead Source')] || '';
    const accountOwner = values[headers.indexOf('Lead Owner')] || '';

    if (!accountOwner) {
      Logger.log("❌ Account Owner is missing.");
      return;
    }

    // Lookup email from validation sheet
    const validationSheet = SpreadsheetApp.openById(validationSheetId).getSheetByName(validationSheetName);
    const validationData = validationSheet.getRange(2, 1, validationSheet.getLastRow() - 1, 5).getValues(); // A to E

    const matchedRow = validationData.find(row => row[0] == accountOwner); // Column A = Account Owner
    const recipientEmail = matchedRow ? matchedRow[4] : null; // Column E = Email

    if (!recipientEmail) {
      Logger.log(`❌ No email found for Lead Owner: ${accountOwner}`);
      return;
    }

    // Compose email content
    const subject = `Lead Updated: ${firstName} ${lastName} | ${mobile} | ${company} | Source: ${leadSource}`;
    const htmlTable = headers.map((h, i) =>
      `<tr><td style="padding:4px;border:1px solid #ccc;"><b>${h}</b></td><td style="padding:4px;border:1px solid #ccc;">${values[i]}</td></tr>`
    ).join('');
    const htmlBody = `
      <p>Hello ${accountOwner},</p>
      <p>A new lead form has been submitted with the following details:</p>
      <table style="border-collapse:collapse;border:1px solid #ccc;">${htmlTable}</table>
      <p>Click on the link to set up a meeting:</p>
      <p><a href="https://crm.klientkonnect.com/calendar" target="_blank"> Schedule a Meeting</a></p>
      <p>Regards,<br/>Klient Konnect Team</p>
    `;

    // Send using GmailApp
    GmailApp.sendEmail(recipientEmail, subject, '', {
      htmlBody: htmlBody,
      cc: 'Holy@klientkonnect.com,Sidhant@ridosports.com,Sandeep@ridosports.com'
    });

    Logger.log(`✅ Email sent to ${recipientEmail} with subject: ${subject}`);

  } catch (err) {
    Logger.log("❗ Error in onFormSubmit: " + err.stack);
  }
}

function authorizeGmailApp() {
  GmailApp.sendEmail(Session.getActiveUser().getEmail(), 'Authorization Test', 'This is a one-time permission check.');
}

